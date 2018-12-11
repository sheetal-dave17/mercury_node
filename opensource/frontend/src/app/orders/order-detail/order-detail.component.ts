import { OrdersService } from './../orders.service';
import { ViewItemsService } from '../../view-items/view-items.service';
import { NotificationsService } from './../../utils/notifications.service';
import { HttpService } from './../../utils/http.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ORDER_STATUS, GlobalService } from './../../utils/global.service';
import { Component, OnInit, EventEmitter } from '@angular/core';
import * as $ from 'jquery';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';


@Component({
    selector: 'app-order-detail',
    templateUrl: './order-detail.component.html',
    styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent {
    private item: any = {};
    private orders: any = [{}];
    private visual: any = {
        expandDetails: false
    }
    // private conflict: boolean = false;
    // private conflictCount: number = 0;
    private starter;
    private statuses = ORDER_STATUS;
    private message: string = '';
    private category: string = '';
    private chatAddress: string = "";
    private myPurchase: boolean = false;
    private translateParams: any = {};
    private goInit =  new BehaviorSubject<any>(true);
    public subscription;
    public finalized = false;
    public inProgress;
    private addressID: any;
    private disputeDeclined: boolean = false;
    public myItem;
    private finalFormattedOrders = [];

    constructor(
        private route: ActivatedRoute,
        private http: HttpService,
        private notifications: NotificationsService,
        private gs: GlobalService,
        private router: Router,
        private viewItemService: ViewItemsService,
        private ordersService: OrdersService
    ) {

    }
    ngOnInit() {
        this.inProgress = this.http.getActionInProgress();
        this.getInfo();

        this.myItem = this.item.sender == this.gs.wallet.address;

    }
    reviews;
    goReviews(address) {
        this.router.navigateByUrl('userReviews/' + address);
    }

    syncOrderAndParse(again = false, params) {
        let addressArray = [];
        addressArray.push(this.addressID)
        let res = { result: 'ok', item: this.gs.temp };

        if (this.subscription) this.subscription.unsubscribe();

        if (res.result == 'ok') {
            this.item = res['item'];
            console.log('got orders list for this trade', this.item, this.gs.wallet);
            if (this.item.cat && this.item.cat.length)
                this.category = this.item.cat[0]
            this.item.endTimestamp = this.item.endTimestamp * 1000;
            this.item.timestamp = this.item.timestamp * 1000;
            if (this.item.sender != this.gs.wallet['address']) {
                this.chatAddress = this.item.sender;
                this.myPurchase = true;
            } else {
                this.myPurchase = false;
                this.chatAddress = this.item.formatted_orders[0].sender;
            }
            let type = 'sell';
            if (this.myPurchase) type = 'buy';
            let item4chat = this.item.address;
            if (!this.item.address || !this.item.address.length || this.item.address == '1') item4chat = this.item.hashIpfs;
            console.log('chat goInit', { address: this.chatAddress, goodsAddress: item4chat, type: type, goodsTitle: this.item.title, sender: this.gs.wallet['address'] });
            this.goInit.next({ address: this.chatAddress, goodsAddress: item4chat, type: type, goodsTitle: this.item.title, sender: this.gs.wallet['address'] });
           

            


            let resArr = [];
            let finalizedIndex = -1;
            let spliceStatus = false;

            if (this.item['orders'] && !this.gs.temp) {
                // this.gs.formatOrders(this.item.sender, this.item['orders'][0], resArr)
            } else {
                resArr = this.gs.temp;
                this.gs.temp = null;
                delete this.gs.temp;
            }


            this.http.getRatingByAddress(this.chatAddress).subscribe(res => {
                if (!res['rating']) res['rating'] = 0;
                console.log('reviews', res);
                this.reviews = res;
            })
            this.translateParams = { value: this.chatAddress };
            // TODO Need to find the route cause of the issue
            this.item.formatted_orders.forEach(item => {
                if (this.finalFormattedOrders.findIndex(i => i.eventType === item.eventType) === -1) {
                    this.finalFormattedOrders.push(item)
                }
            });
            this.checkBlockers()
        }
        else
            this.notifications.showMessage('', 'ERROR.WHATEVER');

        console.log('the item', this.item);
        this.checkConflict(this.item);
        //     },
        //     err => {
        //         this.notifications.showMessage('', 'ERROR.WHATEVER');
        //     }
        // )
        //        this.gs.big(false);
    }

    checkConflict(item) {
        for (var i = 0; i < this.item['formatted_orders'].length; i++) {
            if (this.item['formatted_orders'][i]['eventType'].toString().startsWith('12')) {
                if (this.item['formatted_orders'][i]['sender'] == this.gs.wallet.address) { this.disputeDeclined = true; }
            }
        }
    }
    getInfo(id = false) {

        this.route.params
            .subscribe((params: any) => {
                if (id) this.addressID = id;
                else this.addressID = params['id'];
                console.log('cachedOrders', this.gs.temp);
                this.syncOrderAndParse(true, params);

                //if the item was IPFS initially, put the original escrow
                if (this.item.hashIpfs && this.item.hashIpfs.length) {
                    console.log('going to get escrow of ipfs item', this.item.hashIpfs);
                    this.ordersService.getItemByHash(this.item.hashIpfs, this.item.addressIpfs).subscribe((itemIpfs: any) => {
                        console.log('got item escrow by hashIpfs', itemIpfs);
                        this.item.escrowIpfs = itemIpfs && itemIpfs.item && itemIpfs.item.escrow;
                        this.checkBlockers()
                    })
                }

                console.log('tradeId', this.addressID);


                // this.processOrders(this.addressID);

            });

    }

    hasBlocker;
    checkBlockers() {
        
        let blockers = this.gs.getCachedBlockers();
        if (this.item.formatted_orders[0] && blockers[this.item.formatted_orders[0].tradeId]) {
            if(this.item.formatted_orders.length == blockers[this.item.formatted_orders[0].tradeId])
            {
                this.hasBlocker = true;
                console.log('has blocker!');
            }
        }
        console.log('check blockers', blockers, this.item.formatted_orders[0]);
    }

    processOrders(tradeId) {
        let orders = this.ordersService.getOrdersByTradeId(tradeId);
        console.log('got orders by Trade ID', orders);
    }


    findOrder(orders) {

    }

    getOwner(item) {
        let buyer = item['formatted_orders'][0]['sender'];
        let seller = false;
        if (buyer != this.gs.wallet.address) seller = true;
        return seller;
    }
    getMoney() {

        if (this.hasBlocker) {
            this.gs.confirmation.emit({ type: 'blocker' });
        }
        else
            this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.get_funds });

        let subscripition = this.gs.confirmation.subscribe(answer => {
            if (answer == 'yes') {
                this.gs.addCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                subscripition.unsubscribe();
                let seller = this.getOwner(this.item);
                let data: any = {
                    tradeId: this.item.formatted_orders[0].tradeId,
                    key: this.item.formatted_orders[0].key,
                    senderKey: this.item.formatted_orders[0].pubkey,
                    // senderKey: this.item.pubkey,
                    goods: { address: this.item.address, escrow: this.item.escrow, title: this.item.title },
                    privateMessage: this.message
                };
                if (!seller) this.router.navigateByUrl('/buy/purchases');
                else this.router.navigateByUrl('/items/orders')

                if (this.item.escrowIpfs) {
                    console.log('is an IPFS item!');
                    data.isIpfs = true;
                    data.goods.escrow = this.item.escrowIpfs;
                }

                this.http.claimDispute(data, this.item).subscribe(
                    res => {

                        if (res['result'] && res['result'] == 'ok') {
                            this.notifications.showMessage('COMMON.SUCCESS');

                        } else {
                            this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                            this.notifications.showMessage(res['error'], 'ERROR.WHATEVER');
                        }
                    },
                    err => {
                        this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                        this.notifications.showMessage('', 'ERROR.WHATEVER');
                    }
                )
            } else subscripition.unsubscribe();
        });
    }


    finalize(dispute = false) {
        if (this.hasBlocker) {
            this.gs.confirmation.emit({ type: 'blocker' });
        }
        else
            this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.get_funds });

        // this.notifications.showMessage('Success! Thank you.');
        let senderKey;
        if (this.myPurchase) senderKey = this.item.pubkey;
        else senderKey = this.item.orders[0].pubkey;
        this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.finalize });

        let subscripition = this.gs.confirmation.subscribe(answer => {
            if (answer == 'yes') {
                this.gs.addCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                subscripition.unsubscribe();
                let seller = this.getOwner(this.item);
                let data: any = {
                    tradeId: this.item.formatted_orders[0].tradeId,
                    key: this.item.formatted_orders[0].key,
                    senderKey: this.item['formatted_orders'][0]['sender'] == this.gs.wallet.address ? this.item.pubkey : this.item.formatted_orders[0].pubkey,
                    goods: {
                        address: this.item.address,
                        escrow: this.item.escrow,
                        title: this.item.title
                    },
                    privateMessage: this.message,
                    isIpfs: false
                };
                if (this.item.escrowIpfs) {
                    console.log('is an IPFS item!');
                    data.isIpfs = true;
                    data.goods.escrow = this.item.escrowIpfs;
                }
                if (!seller) this.router.navigateByUrl('/buy/purchases');
                else this.router.navigateByUrl('/items/orders')
                this.http.closeDispute(data, this.item, dispute, seller).subscribe(
                    res => {

                        if (res['result'] && res['result'] == 'ok') {
                            this.notifications.showMessage('COMMON.SUCCESS');

                        } else {
                            this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                            this.notifications.showMessage(res['error'], 'ERROR.WHATEVER');
                        }
                    },
                    err => {
                        this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                        this.notifications.showMessage('', 'ERROR.WHATEVER');
                    }
                )
            } else subscripition.unsubscribe();
        });
    }

    writeReview() {
        localStorage.setItem('finalized-' + this.item.address + '-' + this.chatAddress, 'Y');
        if (this.myPurchase)
            this.router.navigateByUrl('/writeReview/buy/' + this.item.address + '/' + this.item.sender);
        else this.router.navigateByUrl('/writeReview/sell/' + this.item.address + '/' + this.chatAddress)
    }

    dispute() {
        if (this.hasBlocker) {
            this.gs.confirmation.emit({ type: 'blocker' });
        }
        else
            this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.get_funds, bbt: this.gs.bbtListing });
        let subscripition = this.gs.confirmation.subscribe(answer => {
            if (answer == 'yes') {
                this.gs.addCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                subscripition.unsubscribe();
                let seller = this.getOwner(this.item);
                let data: any = {
                    tradeId: this.item.formatted_orders[0].tradeId,
                    key: this.item.formatted_orders[0].key,
                    senderKey: this.item['formatted_orders'][0]['sender'] == this.gs.wallet.address ? this.item.pubkey : this.item.formatted_orders[0].pubkey,
                    goods: { address: this.item.address, escrow: this.item.escrow, title: this.item.title },
                    privateMessage: this.message
                };
                if (!seller) this.router.navigateByUrl('/buy/purchases');
                else this.router.navigateByUrl('/items/orders')

                if (this.item.escrowIpfs) {
                    console.log('is an IPFS item!');
                    data.isIpfs = true;
                    data.goods.escrow = this.item.escrowIpfs;
                }


                this.http.openDispute(data, this.item, seller).subscribe(
                    res => {
                        if (res['result'] && res['result'] == 'ok') {
                            this.notifications.showMessage('COMMON.SUCCESS');

                        } else {
                            this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                            this.notifications.showMessage(res['error'], 'ERROR.WHATEVER');
                        }
                    },
                    err => {
                        this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                        this.notifications.showMessage('', 'ERROR.WHATEVER');
                    }
                )
            } else subscripition.unsubscribe();
        })
    }

    private data: any = {

    };
    acceptBuy() {
        if(this.hasBlocker) {
            this.gs.confirmation.emit({ type: 'blocker' });
        }
        else 
            this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.get_funds });

        let subscripition = this.gs.confirmation.subscribe(answer => {
            if (answer == 'yes') {
                this.gs.addCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                subscripition.unsubscribe();
                let data: any = {
                    tradeId: this.item.formatted_orders[0].tradeId,
                    key: this.item.formatted_orders[0].key,
                    senderKey: this.item.formatted_orders[0].pubkey,
                    goods: { address: this.item.address, title: this.item.title },
                    privateMessage: this.message
                };
                this.router.navigateByUrl('/items/orders')

                this.ordersService.acceptBuy(data, this.item).subscribe(
                    res => {
                        if (res['result'] && res['result'] == 'ok') {
                            this.notifications.showMessage('COMMON.SUCCESS');

                        } else {
                            this.notifications.showMessage(res['error'], 'ERROR.WHATEVER');
                        }
                    },
                    err => {
                        this.notifications.showMessage('', 'ERROR.WHATEVER');
                    }
                )
            } else subscripition.unsubscribe();
        });
    }
    rejectBuy() {
        if(this.hasBlocker) {
            this.gs.confirmation.emit({ type: 'blocker' });
        }
        else 
            this.gs.confirmation.emit({ type: 'pop', gas: this.gs.gasPrices.reject_buy });
        
        let subscripition = this.gs.confirmation.subscribe(answer => {
            if (answer == 'yes') {
                this.gs.addCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                subscripition.unsubscribe();
                let data: any = {
                    tradeId: this.item.formatted_orders[0].tradeId,
                    key: this.item.formatted_orders[0].key,
                    senderKey: this.item.formatted_orders[0].pubkey,
                    goods: { address: this.item.address, title: this.item.title },
                    privateMessage: this.message
                };
                this.router.navigateByUrl('/items/orders')
                this.ordersService.rejectBuy(data, this.item).subscribe(
                    res => {
                        if (res['result'] && res['result'] == 'ok') {
                            this.notifications.showMessage('COMMON.SUCCESS');

                        } else {
                            this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                            this.notifications.showMessage(res['error'], 'ERROR.WHATEVER');
                        }
                    },
                    err => {
                        this.gs.removeCacheBlocker(this.item.formatted_orders[0].tradeId, this.item.formatted_orders.length);
                        this.notifications.showMessage('', 'ERROR.WHATEVER');
                    }
                )
            } else subscripition.unsubscribe();
        })
    }

}
