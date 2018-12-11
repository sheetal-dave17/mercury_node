import { NotificationsService } from './../utils/notifications.service';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { GlobalService, ORDER_STATUS } from './../utils/global.service';
import { Injectable, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { OrdersService } from '../orders/orders.service';
import { ViewItemsService } from '../view-items/view-items.service';

export interface Sync {
  title: string;
  progress?: any;
  time?: number;
  error?: boolean;
  current?: boolean;
}

export const SYNCS: Array<Sync> = [
  { title: 'allListings' },
  { title: 'orders' },
  { title: 'purchases' }
]


declare var ipc: any;
@Injectable()
export class SyncService {
  private ipcRenderer = ipc;
  // public syncer: EventEmitter<any>;

  public syncList: BehaviorSubject<Array<Sync>> = new BehaviorSubject(SYNCS);
  private currentSync: number = 0;

  constructor(
    private ordersService: OrdersService,
    private viewItemsService: ViewItemsService,
    private gs: GlobalService,
    private notification: NotificationsService
  ) {
    // this.syncer = new EventEmitter<any>();
  }


  // to test the ordersSequence method without waiting for a sync
  public getOrdersSimple() {
    return new Promise((resolve, reject) => {
      this.get('orders').then(res => {
        let temp = this.syncList.getValue();
        resolve(res);
      }).catch(err => {
        reject()
      })
    })
  }

  // to test the ordersSequence method without waiting for a sync
  public getPurchasesSimple() {
    return new Promise((resolve, reject) => {
      this.get('purchases').then(res => {
        let temp = this.syncList.getValue();
        resolve(res);
      }).catch(err => {
        reject()
      })
    })
  }

  syncAndCache(syncNumber: number) {
    return new Promise((resolve, reject) => {
      let temp = this.syncList.getValue();
      temp[syncNumber].current = true;
      this.syncList.next(temp);
      switch (syncNumber) {
        // allListings
        case 0: {
          let temp = this.syncList.getValue();
          temp[syncNumber].progress = 'Syncing Store..';
          this.syncList.next(temp);
          this.sync('store').then(res => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress = 'Syncing IPFS Store..';
            this.syncList.next(temp);
            this.sync('storeIPFS').then(res => {
              let temp = this.syncList.getValue();
              temp[syncNumber].progress = 'Caching All Listings..';
              this.syncList.next(temp);
              this.get('allListings').then(res => {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress = 'Done!';
                temp[syncNumber].time = Date.now();
                temp[syncNumber].current = false;
                resolve();
                this.syncList.next(temp);
              }).catch(err => {
                // if (res.result != 'ok') {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress += ' Error!';
                temp[syncNumber].error = true;
                temp[syncNumber].current = false;
                reject();
                this.syncList.next(temp);
                // }
              })
            }).catch(err => {
              let temp = this.syncList.getValue();
              temp[syncNumber].progress += ' Error!';
              temp[syncNumber].error = true;
              temp[syncNumber].current = false;
              reject();
              this.syncList.next(temp);
            })
          }).catch(err => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress += ' Error!';
            temp[syncNumber].error = true;
            temp[syncNumber].current = false;
            reject();
            this.syncList.next(temp);
          })
        } break;
        // orders
        case 1: {
          let temp = this.syncList.getValue();
          temp[syncNumber].progress = 'Syncing Orders ETH..';
          this.syncList.next(temp);
          this.sync('myOrdersETH').then(res => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress = 'Syncing IPFS Orders..';
            this.syncList.next(temp);
            this.sync('allOrdersIPFS').then(res => {
              this.sync('myOrdersIPFS').then(res => {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress = 'Caching All Orders..';
                this.syncList.next(temp);
                this.get('orders').then(res => {
                  let temp = this.syncList.getValue();
                  temp[syncNumber].progress = 'Done!';
                  temp[syncNumber].time = Date.now();
                  temp[syncNumber].current = false;
                  resolve();
                  this.syncList.next(temp);
                }).catch(err => {
                  let temp = this.syncList.getValue();
                  temp[syncNumber].progress += ' Error!';
                  temp[syncNumber].error = true;
                  temp[syncNumber].current = false;
                  reject();
                  this.syncList.next(temp);
                })
              }).catch(err => {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress += ' Error!';
                temp[syncNumber].error = true;
                temp[syncNumber].current = false;
                reject();
                this.syncList.next(temp);
              })
            })
          }).catch(err => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress += ' Error!';
            temp[syncNumber].error = true;
            temp[syncNumber].current = false;
            reject();
            this.syncList.next(temp);
          })
        } break;
        // purchases
        case 2: {
          let temp = this.syncList.getValue();
          temp[syncNumber].progress = 'Syncing Purchases..';
          this.syncList.next(temp);
          this.sync('myPurchasesETH').then(res => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress = 'Syncing IPFS Purchases..';
            this.syncList.next(temp);
            this.sync('myPurchasesIPFS').then(res => {
              let temp = this.syncList.getValue();
              temp[syncNumber].progress = 'Caching All Purchases..';
              this.syncList.next(temp);
              this.get('purchases').then(res => {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress = 'Done!';
                temp[syncNumber].time = Date.now();
                temp[syncNumber].current = false;
                resolve();
                this.syncList.next(temp);
              }).catch(err => {
                let temp = this.syncList.getValue();
                temp[syncNumber].progress += ' Error!';
                temp[syncNumber].error = true;
                temp[syncNumber].current = false;
                reject();
                this.syncList.next(temp);
              })
            }).catch(err => {
              let temp = this.syncList.getValue();
              temp[syncNumber].progress += ' Error!';
              temp[syncNumber].error = true;
              temp[syncNumber].current = false;
              reject();
              this.syncList.next(temp);
            })
          }).catch(err => {
            let temp = this.syncList.getValue();
            temp[syncNumber].progress += ' Error!';
            temp[syncNumber].error = true;
            temp[syncNumber].current = false;
            reject();
            this.syncList.next(temp);
          })
        } break;
      }
    })
  }


  startSync() {
    this.syncAndCache(this.currentSync).then(() => {
      setTimeout(() => {
        this.nextSync();
        this.startSync();
      }, 30000);
    }).catch(() => {
      setTimeout(() => {
        this.nextSync();
        this.startSync();
      }, 30000);
    })
  }

  nextSync() {
    let nextSync = this.currentSync + 1;
    if (nextSync >= SYNCS.length) {
      nextSync = 0;
    }
    this.currentSync = nextSync;
  }


  syncStoreETH() {
    this.ipcRenderer.send('syncStore');
    return new Observable(observer => {
      this.ipcRenderer.once('syncStore', (event, arg) => {
        arg = JSON.parse(arg);
        observer.next(arg)
      })
    })
  }

  syncStoreIPFS() {
    this.ipcRenderer.send('syncStoreIPFS');
    return new Observable(observer => {
      this.ipcRenderer.once('syncStoreIPFS', (event, arg) => {
        arg = JSON.parse(arg);
        observer.next(arg)
      })
    })
  }

  sync(type: string, args: any = null) {
    return new Promise((resolve, reject) => {
      switch (type) {
        case 'allOrdersIPFS': {
          this.ordersService.syncAllOrdersIPFS().subscribe((res: any) => {
            if (res.result == 'ok')
              resolve(res)
            else reject(res);
          });
        } break;
        case 'myOrdersETH': {
          this.ordersService.syncOrdersETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myPurchasesETH': {
          //TODO: make it right by doing initial purchases sync only at the start of the app and then sync purchases by escrows and addresses
          this.ordersService.syncInitialPurchasesETH().subscribe((res: any) => {
            if (res.result == 'ok')
              resolve(res)
            else reject(res);
          })

        } break;
        case 'myOrdersIPFS': {
          this.ordersService.syncAllOrdersIPFSNew().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myPurchasesIPFS': {
          this.ordersService.syncAllPurchasesIPFSNew().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'allListingsETH': {
          this.syncStoreETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'allListingsIPFS': {
          this.syncStoreIPFS().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'store': {
          this.syncStoreETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          });
        } break;
        case 'storeIPFS': {
          this.syncStoreIPFS().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          });
        } break;
      }
    })
  }

  get(type: string, args: any = null) {
    return new Promise((resolve, reject) => {

      switch (type) {
        case 'orders': {
          this.ordersService.getOrders().subscribe((res: any) => {
            res.items.forEach(item => {
              let resArr = [];
              this.gs.formatOrders(this.gs.wallet.address, item.orderObj, resArr);
              item['formatted_orders'] = resArr;
              item['formatted_orders'] = this.orderSequence(item['formatted_orders']);
              item = this.assignMeta(item);
            })
            this.notification.sync('myOrders', res.items);
            this.ordersService.orders.next(res.items);
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'purchases': {
          this.ordersService.getPurchases().subscribe((res: any) => {
            res.items.forEach(item => {
              let resArr = [];
              this.gs.formatOrders(this.gs.wallet.address, item.orderObj, resArr);
              item['formatted_orders'] = resArr;
              item['formatted_orders'] = this.orderSequence(item['formatted_orders']);
              item = this.assignMeta(item);

            })
            this.notification.sync('myPurchases', res.items);
            this.ordersService.purchases.next(res.items);
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myOrdersETH': {
          this.ordersService.getOrdersETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myPurchasesIPFS': {
          this.ordersService.getPurchasesIPFS().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myPurchasesETH': {
          this.ordersService.getPurchasesETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myOrdersIPFS': {
          this.ordersService.getOrdersETH().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'myPurchasesIPFS': {
          this.ordersService.getOrdersIPFS().subscribe(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'allListingsETH': {
          this.viewItemsService.viewAll().then(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);

          })
        } break;
        case 'allListingsIPFS': {
          this.viewItemsService.viewAllIPFSListings().then(res => {
            if (res['result'] == 'ok')
              resolve(res)
            else reject(res);
          })
        } break;
        case 'allListings': {
          this.viewItemsService.getAllListings().subscribe((res: any) => {
            if (res['result'] == 'ok') {
              
              // set allListings BS to the resulting array
              this.viewItemsService.allListings.next(res['items']);
              // cache the resulting allListings array
              this.viewItemsService.cache();
              // create notifications out of expired items
              this.notification.syncSimple('expired', this.viewItemsService.getExpired());
              // create notifications out of sold items
              this.notification.syncSimple('sold', this.viewItemsService.getSoldOut());

              resolve(res)
            }
            else {
              reject(res);
            }
          })
        } break;
      }
    })
  }

  assignMeta(item) {
    item['currentStatusCode'] = item['formatted_orders'][item['formatted_orders'].length - 1]['currentStatusCode'];
    item['currentStatus'] = ORDER_STATUS[item['currentStatusCode']];
    item['updatedStatus'] = item['formatted_orders'][item['formatted_orders'].length - 1].timestamp;
    return item;
  }


  orderSequence(orderList: any[]) {
    let myWallet: string = this.gs.wallet.address;
    let othersWallet: string;
    let resArr = [];

    //conditions
    let conditions = {
      disputeOrders: [],
      rejectOrder: {
        index: null,
        value: null
      },
      finaliseOrder: {
        index: null,
        value: null
      },
      fakeBuyOrder: {
        index: null,
        value: null
      },
      getFunds: {
        index: null,
        value: null
      }
    }

    resArr = orderList.map((order, i) => {
      //do some META stuff, like set each order's human readable status etc
      order.currentStatusCode = order.eventType;

      if (!othersWallet && order.sender != myWallet) {
        othersWallet = order.sender;
      }


      if (order.eventType == 3) {
        conditions.rejectOrder.index = i;
        conditions.rejectOrder.value = order;
      }

      if (order.eventType == 5) {
        conditions.fakeBuyOrder.index = i;
        conditions.fakeBuyOrder.value = order;
      }

      if (order.eventType == 11) {
        conditions.finaliseOrder.index = i;
        conditions.finaliseOrder.value = order;
      }

      //TODO: confirm that getFunds returns 13 status ??
      if (order.eventType == 13) {
        conditions.getFunds.index = i;
        conditions.getFunds.value = order;
      }

      if (order.eventType == 12) {
        conditions.disputeOrders.push({
          index: i,
          value: order
        });
      }



      return order;

      // if the order is a dispute, disputeOrder = order
      // if the order is a rejection, rejectOrder = order
      // if the order is finalise, finaliseOrder = order
      // if the order is a fakeBuy, fakeBuyOrder = order
    })

    //now check the conditions and format resArr accordingly, e.g. (if conditions.fakeBuyOrder.index => swap the first order with fakeBuy and set the eventType to be 1 instead of 5

    //in case of fakeBuy -- ensure it goes first and assign a status of 1
    if (conditions.fakeBuyOrder.value) {

      resArr[conditions.fakeBuyOrder.index].currentStatusCode = 1;
      resArr[conditions.fakeBuyOrder.index].eventType = 1;
      resArr[conditions.fakeBuyOrder.index]['noNotification'] = true;
      if (conditions.fakeBuyOrder.index != 0) {
        let temp0 = JSON.parse(JSON.stringify(resArr[0]));
        let tempFakeBuy = JSON.parse(JSON.stringify(resArr[conditions.fakeBuyOrder.index]));
        // we dont want a notification for the fakeBuy because we have already had one for IPFS buy request        
        resArr[0] = tempFakeBuy;
        resArr[conditions.fakeBuyOrder.index] = temp0;
      }
    }

    //in case of rejectBuy -- swap the senders and remove finalise order from the array
    if (conditions.rejectOrder.value) {
      if (conditions.rejectOrder.value.sender == myWallet) {
        conditions.rejectOrder.value.sender = myWallet;
      } else {
        conditions.rejectOrder.value.sender = othersWallet;
      }
      resArr[conditions.rejectOrder.index] = conditions.rejectOrder.value;
      resArr.splice(conditions.finaliseOrder.index, 1);
      conditions.finaliseOrder = { value: null, index: null }

    }

    // in case of dispute -- we need to set status 121 for each next step in dispute after the first one
    if (conditions.disputeOrders.length) {
      conditions.disputeOrders.forEach((disputeOrder, disputeI) => {
        if (disputeI > 0) {
          resArr[disputeOrder.index].currentStatusCode = 121;
          resArr[disputeOrder.index].eventType = 121;
        }
      })
    }


    /* in case of finalise --  we need to figure out what kind of finalise is that
      1. finalise which appears with rejection (if there was a rejection in the list) -- remove the finalise order from the array
      2. normal finalise which comes after accept buy (default)
      3. finalise which also means resolve dispute (if there were disputes in the list) -- set status of 110 and swap senders
      4. finalise also means rejected if the only order in sequence is 14
    */
    if (conditions.finaliseOrder.value) {
      if (conditions.disputeOrders.length) {
        if (conditions.finaliseOrder.value.sender != resArr[0].sender) {
          conditions.finaliseOrder.value.currentStatusCode = 110;
          conditions.finaliseOrder.value.eventType = 110;
        }

        let tempLast = JSON.parse(JSON.stringify(resArr[resArr.length - 1]));
        resArr[resArr.length - 1] = JSON.parse(JSON.stringify(conditions.finaliseOrder.value));
        resArr[conditions.finaliseOrder.index] = tempLast;
      } else {
        resArr[conditions.finaliseOrder.index] = conditions.finaliseOrder.value;
      }



      if (resArr[0].eventType == 14 || resArr[1].eventType == 14) {
        resArr[conditions.finaliseOrder.index].eventType = 3;
        resArr[conditions.finaliseOrder.index].currentStatusCode = 3;
      }

    }

    if (conditions.getFunds.value && conditions.disputeOrders.length) {
      
      let tempLast = JSON.parse(JSON.stringify(resArr[resArr.length - 1]));
      resArr[resArr.length - 1] = JSON.parse(JSON.stringify(conditions.getFunds.value));
      resArr[resArr.length - 2] = tempLast;
    }






    return resArr;

  }


}
