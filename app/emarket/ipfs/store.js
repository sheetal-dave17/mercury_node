var libs = {};
libs.async = require('async');
libs.web3 = require('web3');
libs.crypto = require('crypto');
libs.ethereumjsUtil = require('ethereumjs-util');

var emarket = {}
emarket.defaults = require('./../../emarket/defaults');
emarket.default_contracts = require('./../../emarket/default_contracts');
emarket.store = require('./../../emarket/store');
emarket.goods = require('./../../emarket/goods');
emarket.escrows = require('./../../emarket/escrows');
emarket.store = require('./../../emarket/store');

emarket.wallets = {};
emarket.wallets.wallets = require('./../../emarket/wallets/wallets');
emarket.wallets.aes = require('./../../emarket/wallets/aes');

emarket.ethereum = {};
emarket.ethereum.api = require('./../../emarket/ethereum/api');
emarket.ethereum.eth = require('./../../emarket/ethereum/eth');

emarket.db = {};
emarket.db.ipfsListings = require('./../../emarket/db/ipfsListings');
emarket.db.contracts = require('./../../emarket/db/contracts');
emarket.db.listings = require('./../../emarket/db/listings');

emarket.ipfs = {};
emarket.ipfs.contract = require('./../../emarket/ipfs/contract');
emarket.ipfs.storage = require('./../../emarket/ipfs/storage');

emarket.ipfs.store = function () {}

var the = emarket.ipfs.store;
the.myname = 'emarket.ipfs.store';

the.sync = function (options, progressCallback, callback) {

  emarket.ipfs.contract.sync(options,
    progressCallback,

    function(result) {

      if(result.result != 'ok') {

        callback(result);
        return;
      }

      emarket.ipfs.storage.sync(options, progressCallback, callback);
      return;
    });
}

the.getListings = function (options, callback) {

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

      // filter from duplicates
      listingsFilterHash(result2.items, callback);
      return;
    });
  });
}

// get an item from the DB using IPFS hash and address
the.getItem = function (options, hashIpfs, addressIpfs, callback) {

  emarket.db.ipfsListings.selectWithAddress(hashIpfs, addressIpfs, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    if (!result.items || (result.items.length == 0)) {

      callback({ result: 'error', error: 'Item not found' });
      return;
    }

    var goods = emarket.goods.fromDb(result.items[0]);
    callback({ result: 'ok', item: goods });
  });
}

//get All IPFS stores
the.getIPFSStoreListings = function (options, callback) {
  emarket.db.ipfsListings.selectIPFSStoreName(function (result) {
    if (result.result != 'ok') {
      callback(result);
      return;
    }
    callback({ result: 'ok', items: result.items });
    return;
  });
}

//get all selected IPFS stores item
the.selectedIPFSStoresListings = function (options, callback) {
  emarket.db.ipfsListings.selectIPFSSelectedStore(options, function (result) {
    if (result.result != 'ok') {

      callback(result);
      return;
    }

    emarket.store.listingsFilterEscrow(result.items, options, true, function(result2) {

      if (result2.result != 'ok') {

        callback(result2);
        return;
      }

      // filter from duplicates
      listingsFilterHash(result2.items, callback);
      return;
    });
  });
}

the.getMyListings = function (options, callback) {

  var wallet = emarket.wallets.wallets.currentWallet;
  var account = wallet.getAddressString();

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

      // filter from duplicates
      listingsFilterHash(result2.items, callback);
      return;
    });

    return;
  });
}

// sell item using IPFS as a storage
the.sell = function(options, goods, callback) {

  var wallet = emarket.wallets.wallets.currentWallet;
  var account = wallet.getAddressString();
  console.log('IPFS sell() from account ' + account);

  //Fix possible invalid fields for the goods object
  if (!goods.tags) goods.tags = [];
  if (!goods.timespan) goods.timespan = 2419200;
  if (!goods.currency) goods.currency = 'ETH';
  if (!goods.escrow) goods.escrow = emarket.default_contracts.defaultEscrowDirectContractAddress;

  goods.pubkey = wallet.getCurve25519PublicKeyString();
  goods.addressIpfs = 1;

  var file = { items: [ goods ], sender: account };

  console.log('goods ' + JSON.stringify(goods));

  emarket.ipfs.storage.add(options, file, function(result) {

    if(result.result != 'ok') {

      callback(result);
      return;
    }

    console.log('goods listed to IPFS: file ' + result.hashIpfs + ', address ' + goods.addressIpfs);
    result.file = file;
    callback(result);
    return;
  });
}

// buy IPFS item. Sends money to escrow contract.
the.buy = function (options, goods, count, payment, privateMessage, callback) {

  var answer = {};
  var web3 = new libs.web3(libs.web3.givenProvider);
  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  console.log('IPFS buy() from account ' + account);

  var rndbuf = libs.crypto.randomBytes(8);
  var tradeId =  web3.utils.toBN('0x' + rndbuf.toString('hex')).toString();

  var datainfo = { count: count, hash: goods.hashIpfs, id: goods.addressIpfs };
  //private key for encryption
  var encPrivkey = emarket.wallets.wallets.currentWallet.getCurve25519PrivateKey();
  var encPubkeyStr = emarket.wallets.wallets.currentWallet.getCurve25519PublicKeyString();
  var key = emarket.wallets.aes.createSessionKey(encPrivkey, libs.ethereumjsUtil.toBuffer(goods.pubkey));
  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, key);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove sensitive information
  delete encMessage.key.key;

  datainfo.private = encMessage;

  if (emarket.defaults.isTesting) {

    console.log('datainfo: ' + JSON.stringify(datainfo));
    answer.result = 'ok';
    answer.hash = emarket.testdata.buyItemHash;
    answer.tradeId = tradeId;
    answer.key = key;
    callback(answer);
    return;
  }

  emarket.ethereum.api.ethcall(
    emarket.wallets.wallets.currentWallet,
    goods.escrow,
    emarket.default_contracts.escrowDirectContractAbi,
    'deposit',
    [ emarket.defaults.marketVersion, tradeId, goods.sender, JSON.stringify(datainfo) ],
    payment,
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      if(result.result != 'ok') {

        callback(result);
        return;
      }

      result.tradeId = tradeId;
      result.key = key;
      callback(result);
      return;
    }
  );
}

// accept the IPFS listing buy request
// goods - IPFS listing object
// newEscrow - what escrow should be used for the deployed version of the listing
// buyOrder - IPFS buy request data. Contains: buyer, tradeId, count, payment and privateMessage
// sessionKey - encryption key for our communication
// privateMessage - a message for the buyer
the.accept = function (wallet, options, goods, newEscrow, buyOrder, sessionKey, privateMessage, callback) {

  var account = wallet.getAddressString();

  console.log('IPFS accept() from account ' + account);

  // we have found a deposit for our IPFS listing.
  // let's deploy a Product first

  if(!newEscrow || (newEscrow.length < 42)) {

    newEscrow = emarket.default_contracts.defaultEscrowContractAddress;
  }

  goods.escrow = newEscrow;

  var context = { goods: goods, duplicateFound: false, fakeBuyResult: {} };

  libs.async.waterfall([

    libs.async.apply(syncStore, options, context),
    libs.async.apply(checkDuplicate, options),
    libs.async.apply(createClone, options, wallet),
    libs.async.apply(fakeBuyClone, options, wallet, buyOrder, sessionKey, privateMessage)
  ],
    function (asyncError, asyncResult) {

      if (asyncError) {

        callback({ result: 'error', error: asyncError.error, type: asyncError.type });
        return;
      }

      callback(context.fakeBuyResult);
      return;
    }
  );
}

the.reject = function (options, goods, sessionKey, tradeId, privateMessage, callback) {

  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  console.log('IPFS reject() from account ' + account);

  var datainfo = {};
  var encPubkeyStr = emarket.wallets.wallets.currentWallet.getCurve25519PublicKeyString();
  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  emarket.ethereum.api.ethcall(
    emarket.wallets.wallets.currentWallet,
    goods.escrow,
    emarket.default_contracts.escrowDirectContractAbi,
    'yes',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      result.tradeId = tradeId;
      result.key = sessionKey;
      callback(result);
    }
  );
}

//private functions

// filter IPFS listings if deployed contracts with clone is found
function listingsFilterHash(listings, callback) {

  if (!listings || (listings.length == 0)) {

    callback({ result: 'ok', items: [], processed: 0, skipped: 0 });
    return;
  }

  var state = { items: [], total: listings.length, processed: 0, skipped: 0, i: 0 };

  libs.async.filterLimit(listings, 1,

    function(item, callback1) {

      state.i++;

      emarket.db.listings.selectWithIpfsAddressSender(item.hashIpfs, item.addressIpfs, item.sender, function (result) {

        state.processed++;

        if(result.result != 'ok') {

          state.skipped++;
          callback1(null, true);
          return;
        }

        // duplicate found - skip
        if(result.items && (result.items.length > 0)) {

          state.skipped++;
          callback1(null, true);
          return;
        }

        state.items.push(item);
        callback1(null, true);
        return;
      });
    },

    function(err, result2) {

      if(err) {

        callback(err);
        return;
      }

      callback({ result: 'ok', items: state.items, processed: state.processed, skipped: state.skipped });
      return;
    }
  );
}

function syncStore(options, context, asyncCallback) {

  emarket.store.sync(options,

    // progress callback
    function(result) {},

    // sync callback
    function(result) {

      if(result.result != 'ok') {

        asyncCallback({ error: result.error, type: 'temporary' }, null);
        return;
      }

      asyncCallback(null, context);
      return;
    }
  );
}

function checkDuplicate(options, context, asyncCallback) {

  var goods = context.goods;

  // try to filter from duplicated

  emarket.db.listings.selectWithIpfsAddressSender(goods.hashIpfs, goods.addressIpfs, goods.sender, function (result) {

    if(result.result != 'ok') {

      asyncCallback({ error: result.error, type: 'temporary' }, null);
      return;
    }

    // no duplicates found
    if(result.items.length == 0) {

      asyncCallback(null, context);
      return;
    }

    context.duplicateFound = true;
    context.goods.address = result.items[0].address;

    asyncCallback(null, context);
    return;
  });
}

// create a clone of the IPFS item
function createClone(options, wallet, context, asyncCallback) {
  
  // skip clone creation if duplicate is found
  if(context.duplicateFound) {

    asyncCallback(null, context);
    return;
  }

  var goods = context.goods;

  emarket.store.sell(wallet, goods, function (result) {

    if (result.result != 'ok') {

      asyncCallback({ error: result.error, type: 'permanent' }, null);
      return;
    }

    context.goods.address = result.address;
    asyncCallback(null, context);
    return;
  });
}

function fakeBuyClone(options, wallet, buyOrder, sessionKey, privateMessage, context, asyncCallback) {

  // prepare a copy of buy request private data

  var buyerPrivate = {};
  var buyerInfo = { private: buyerPrivate, pubkey: buyOrder.pubkey };

  try {

    buyerPrivate = JSON.parse(buyOrder.payload).private;
    buyerInfo = { private: buyerPrivate, pubkey: buyOrder.pubkey };
  } catch(err) {
    // ignore error - private info is lost
  }

  var goods = context.goods;

  emarket.store.fakeBuy(wallet, goods, sessionKey, buyOrder.sender, buyOrder.tradeId, buyOrder.count,
      buyOrder.payment, buyerInfo, privateMessage,

    function(result) {

      if (result.result != 'ok') {

        asyncCallback({ error: result.error, type: 'permanent' }, null);
        return;
      }

      result.goods = goods;
      context.fakeBuyResult = result;
      asyncCallback(null, context);
      return;
    }
  );
}

module.exports = the
