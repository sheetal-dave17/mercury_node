var libs = {};

libs.xss = require('xss');
libs.async = require('async');
libs.web3 = require('web3');
libs.ethereumjsUtil = require('ethereumjs-util');
libs.lodash = require('lodash');

var emarket = {}
emarket.defaults = require('./../../emarket/defaults');
emarket.sync = require('./../../emarket/sync');
emarket.utils = require('./../../emarket/utils');
emarket.escrows = require('./../../emarket/escrows');
emarket.store = require('./../../emarket/store');

emarket.wallets = {};
emarket.wallets.wallets = require('./../../emarket/wallets/wallets');
emarket.wallets.aes = require('./../../emarket/wallets/aes');

emarket.db = {};
emarket.db.events = require('./../../emarket/db/events');
emarket.db.orders = require('./../../emarket/db/orders');
emarket.db.ipfsListings = require('./../../emarket/db/ipfsListings');

emarket.ethereum = {};
emarket.ethereum.api = require('./../../emarket/ethereum/api');
emarket.ethereum.eth = require('./../../emarket/ethereum/eth');

emarket.ipfs = {};
emarket.ipfs.contract = require('./../../emarket/ipfs/contract');
emarket.ipfs.storage = require('./../../emarket/ipfs/storage');
emarket.ipfs.store = require('./../../emarket/ipfs/store');

var myxss = new libs.xss.FilterXSS({ whiteList: {} });

emarket.ipfs.orders = function () { }

var the = emarket.ipfs.orders;
the.myname = 'emarket.ipfs.orders';

the.syncAllEscrowOrders = function (options, progressCallback, callback) {

  ///HACK: we use direct DB access to have items without duplicates filtering.
  ///      We need all items to have all escrows available.

  emarket.db.ipfsListings.select(function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    emarket.store.listingsFilterEscrow(result.items, options, true, function(result2) {

      if (result2.result != 'ok') {

        callback(result2);
        return;
      }

      var ipfsListings = result2.items;

      var escrowAddresses = {};

      // prepare a map of all escrows
      libs.lodash.forEach(ipfsListings.items, function(item) {

        escrowAddresses[item.escrow] = true;
      });

      var escrowAddressesArray = [];

      // convert map to array of keys
      libs.lodash.forEach(escrowAddresses, function(value, key) {

        escrowAddressesArray.push(key);
      });

      emarket.escrows.syncOrdersList(escrowAddressesArray, true, options, progressCallback, callback);
      return;
    });
  });
}

the.syncAllMyPurchases = function (escrows, options, progressCallback, callback) {

  emarket.escrows.syncOrdersList(escrows, true, options, progressCallback, callback);
}

the.syncAllMyOrders = function (options, progressCallback, callback) {

  ///HACK: we use direct DB access to have items without duplicates filtering.
  ///      We need all items to have all escrows available.

  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  emarket.db.ipfsListings.selectWithSender(account, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    emarket.store.listingsFilterEscrow(result.items, options, true, function(result2) {

      if (result2.result != 'ok') {

        callback(result2);
        return;
      }

      var ipfsListings = result2.items;

      var escrowAddresses = {};

      // prepare a map of my escrows
      libs.lodash.forEach(ipfsListings, function(item) {

        escrowAddresses[item.escrow] = true;
      });

      var escrowAddressesArray = [];

      // convert map to array of keys
      libs.lodash.forEach(escrowAddresses, function(value, key) {

        escrowAddressesArray.push(key);
      });

      the.syncAllMyPurchases(escrowAddressesArray, options, progressCallback, callback);
      return;
    });
  });
}

the.getOrders = function (goods, callback) {

  getDepositsWithOrders(goods, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    callback({ result: 'ok', orders: result.items });
    return;
  });
}

the.getMyOrders = function (options, callback) {

  ///HACK: we use direct DB access to have items without duplicates filtering.
  ///      We need all items to have all escrows available.

  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  emarket.db.ipfsListings.selectWithSender(account, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    emarket.store.listingsFilterEscrow(result.items, options, true, function(result2) {

      if (result2.result != 'ok') {

        callback(result2);
        return;
      }

      var ipfsListings = result2.items;

      if (!ipfsListings || (ipfsListings.length == 0)) {

        callback({ result: 'ok', okItems: [], errorItems: [] });
        return;
      }

      var state = { okItems: [], errorItems: [] };

      // prepare a callback to call after all items are processed
      var afterCallback = libs.lodash.after(ipfsListings.length, callback);

      libs.lodash.forEach(ipfsListings, function(item) {

        var itemCopy = libs.lodash.clone(item);
        itemCopy.orders = [];

        getDepositsWithOrders(item, function (result) {

          if (result.result != 'ok') {
      
            state.errorItems.push({ item: itemCopy, error: result.error });
            afterCallback({ result: 'ok', okItems: state.okItems, errorItems: state.errorItems });
            return;
          }

          itemCopy.orders = result.items;
          state.okItems.push(itemCopy);
      
          afterCallback({ result: 'ok', okItems: state.okItems, errorItems: state.errorItems });
          return;
        });
      });
    });
  });
}

the.getMyPurchases = function (hashArray, options, callback) {

  emarket.db.ipfsListings.selectWithHashes(hashArray, function (result) {

    console.log('selectWithHashes', result);
    if (result.result != 'ok') {

      callback(result);
      return;
    }

    emarket.store.listingsFilterEscrow(result.items, options, true, function(result2) {

      if (result2.result != 'ok') {

        callback(result2);
        return;
      }

      var ipfsListings = result2.items;

      if (!ipfsListings || (ipfsListings.length == 0)) {

        callback({ result: 'ok', okItems: [], errorItems: [] });
        return;
      }

      var state = { okItems: [], errorItems: [] };

      // prepare a callback to call after all items are processed
      var afterCallback = libs.lodash.after(ipfsListings.length, callback);

      libs.lodash.forEach(ipfsListings, function(item) {

        var itemCopy = libs.lodash.clone(item);
        itemCopy.orders = [];

        getDepositsWithOrders(item, function (result) {

          if (result.result != 'ok') {
      
            state.errorItems.push({ item: itemCopy, error: result.error });
            afterCallback({ result: 'ok', okItems: state.okItems, errorItems: state.errorItems });
            return;
          }

          itemCopy.orders = result.items;
          state.okItems.push(itemCopy);
      
          afterCallback({ result: 'ok', okItems: state.okItems, errorItems: state.errorItems });
          return;
        });
      });
    });
  });
}

/// private functions

function getDepositsWithOrders(goods, callback) {

  var account = emarket.wallets.wallets.currentWallet.getAddressString().toLowerCase();
  var encPrivkey = emarket.wallets.wallets.currentWallet.getCurve25519PrivateKey();

  if (!goods.pubkey) {

    if (goods.payload) {

      var parsedPayload = {};

      try {
        parsedPayload = JSON.parse(goods.payload);
      } catch (err) {

      }

      if (parsedPayload && parsedPayload.pubkey) goods.pubkey = parsedPayload.pubkey;
    }
  }

  getDeposits(goods, function(result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    constructOrdersForBuyEvents(result.items, goods, account, encPrivkey, callback);
    return;
  });
}

// find all escrow deposits for desired goods.
// Escrow orders should be synced with local DB.
function getDeposits(goods, callback) {

  //search all orders of type = 14 (deposit)
  emarket.db.orders.selectWithAddressAndEventType(goods.escrow, 14, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    var state = { total: result.items.length, items: [], processed: 0, skipped: 0 };

    libs.async.filter(result.items,
      function (depositEvent, callback1) {

        state.processed++;

        try {

          var payloadData = JSON.parse(depositEvent.payload);

          // we check the deposit is for desired seller
          if (depositEvent.recipient != goods.sender) {

            state.skipped++;
            callback1(null, true);
            return;
          }

          // we check the deposit is for desired goods hash
          if (payloadData.hash != goods.hashIpfs) {

            state.skipped++;
            callback1(null, true);
            return;
          }

          // we check the deposit is for desired goods address
          if (payloadData.id != goods.addressIpfs) {

            state.skipped++;
            callback1(null, true);
            return;
          }

          state.items.push(depositEvent);

          callback1(null, true);
          return;

        } catch (err) {

          // catch JSON parse errors

          state.skipped++;
          console.log('Error processing order for ' + goods.hashIpfs + ' item. ' + err);
          callback1(null, false);
          return;
        }
      },
      function (err2, result) {

        if (err2) {

          callback(err2);
          return;
        }

        callback({ result: 'ok', items: state.items, processed: state.processed, skipped: state.skipped });
        return;
      }
    );
  });
}

// use an array of buy events to construct the decrypted history of the trade
function constructOrdersForBuyEvents(buyEvents, goods, account, privateKey, callback) {

  var state = { total: buyEvents.length, processed: 0, skipped: 0, buyings: {} };

  libs.async.filter(buyEvents,
      
    function (buyOrder, callback1) {

      try {

        var buyId = buyOrder.tradeId;
        var payloadData = JSON.parse(buyOrder.payload);

        var dataObject = payloadData.private;

        if (dataObject) {
          buyOrder.pubkey = dataObject.pubkey;
          buyOrder.key = dataObject.key;
        }

        state.buyings[buyId] = buyOrder;
        state.buyings[buyId].orders = [];

        try {

          if ((account.length > 0) && (buyOrder.sender.toLowerCase() == account)) {

            var decKey = emarket.wallets.aes.readSessionKey(libs.ethereumjsUtil.toBuffer(goods.pubkey),
              privateKey, buyOrder.key);

            state.buyings[buyId].key = decKey;
          }

          if ((account.length > 0) && (goods.sender.toLowerCase() == account)) {

            var decKey = emarket.wallets.aes.readSessionKey(libs.ethereumjsUtil.toBuffer(buyOrder.pubkey),
              privateKey, buyOrder.key);

            state.buyings[buyId].key = decKey;
          }
        } catch (err) {

          //skip decryption error
        }

        emarket.db.orders.selectWithTradeId(buyOrder.tradeId, function (result) {

          state.processed++;

          if (result.result != 'ok') {

            state.skipped++;
            callback1(null, false);
            return;
          }

          libs.lodash.forEach(result.items, function (item) {

            // skip non-escrow events
            if (item.eventType < 11) {
              return true;
            }

            var payloadData = JSON.parse(item.payload);

            var privateMessage = payloadData.private;

            if (!privateMessage) {
              privateMessage = { msg: "" };
            }

            privateMessage.decrypted = false;

            try {

              if ((account.length > 0) &&
                (buyOrder.sender.toLowerCase() == account) || (goods.sender.toLowerCase() == account)) {

                var message = emarket.wallets.aes.decryptForSession(privateMessage, state.buyings[buyOrder.tradeId].key);
                privateMessage.msg = myxss.process(message.msg);
                privateMessage.decrypted = true;
              }
            } catch (err) {

              //skip decryption error
            }

            item.private = privateMessage;

            //decode some fields encoded into payload

            item.payment = '0';
            item.count = 0;

            if(typeof payloadData.payment != 'undefined') item.payment = myxss.process(payloadData.payment);
            if(typeof payloadData.count != 'undefined') item.count = parseInt(payloadData.count);

            state.buyings[buyOrder.tradeId].orders.push(item);
          });

          callback1(null, true);
          return;
        });

      } catch (err2) {

        console.log('Error processing order for ' + goods.hashIpfs + ' item. ' + err2);
        
        //skip order parsing error
        state.skipped++;
        callback1(null, false);
        return;
      }
    },
    function (err, result) {

      if (err) {

        callback(err);
        return;
      }

      callback({ result: 'ok', items: state.buyings,
        processed: state.processed, skipped: state.skipped, total: state.total });
      return;
    }
  );
}

module.exports = the
