var libs = {};
libs.async = require('async');
libs.web3 = require('web3');
libs.crypto = require('crypto');
libs.ethereumjsUtil = require('ethereumjs-util');
libs.lodash = require('lodash');

var emarket = {};
emarket.defaults = require('./../emarket/defaults');
emarket.default_contracts = require('./../emarket/default_contracts');
emarket.testdata = require('./../emarket/testdata');
emarket.sync = require('./../emarket/sync');
emarket.goods = require('./../emarket/goods');
emarket.escrows = require('./../emarket/escrows');
emarket.utils = require('./../emarket/utils');

emarket.wallets = {};
emarket.wallets.aes = require('./../emarket/wallets/aes');
emarket.wallets.wallets = require('./../emarket/wallets/wallets');

emarket.ethereum = {};
emarket.ethereum.api = require('./../emarket/ethereum/api');
emarket.ethereum.eth = require('./../emarket/ethereum/eth');

emarket.db = {};
emarket.db.events = require('./../emarket/db/events');
emarket.db.listings = require('./../emarket/db/listings');
emarket.db.contracts = require('./../emarket/db/contracts');
emarket.db.feedbbt = require('./../emarket/db/feedbbt');
emarket.db.orders = require('./../emarket/db/orders');

emarket.token = {};
emarket.token.api = require('./../emarket/token/api');

emarket.store = function () { }

var the = emarket.store;
the.myname = 'emarket.store';

the.sync = function (options, progressCallback, callback) {

  emarket.sync.syncHelper(
    options, the.myname + '.sync',
    emarket.default_contracts.storeContractAddress, emarket.default_contracts.storeContractAbi, 'LogStore',
    function (item) {
      // console.log('function item', item);
      var datatype = parseInt(item.returnValues.eventType);
      if (datatype != 1) return false;

      return true;
    },
    syncStoreBody,
    progressCallback, callback);
}

the.sell = function (wallet, goods, callback) {

  var answer = {};
  var account = wallet.getAddressString();
  console.log('sell() from account ' + account);

  //Fix possible invalid fields for the goods object
  if (!goods.tags) goods.tags = [];
  if (!goods.timespan) goods.timespan = 2419200;
  if (!goods.currency) goods.currency = 'ETH';
  if (!goods.escrow) goods.escrow = emarket.default_contracts.defaultEscrowContractAddress;

  goods.pubkey = wallet.getCurve25519PublicKeyString();
  console.log('goods ' + JSON.stringify(goods));

  if (emarket.defaults.isTesting) {

    answer.result = 'ok';
    answer.hash = emarket.testdata.sellItemHash;
    callback(answer);
    return;
  }

  emarket.ethereum.api.ethdeploy(
    wallet,
    emarket.default_contracts.PRODUCT_CONTRACT_BYTECODE,
    emarket.default_contracts.goodsContractAbi,
    [ goods.escrow, goods.saleCount, '' + goods.price ],
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      if(!result || !result.contractAddress) {

        callback(result);
        return;
      }

      if (result.result != 'ok') {

        callback(result);
        return;
      }

      goods.address = result.contractAddress.toLowerCase();

      // now we add deployed Product to the store
      storeAdd(wallet, goods, function(result2) {

        if (result2.result != 'ok') {

          callback(result2);
          return;
        }

        result2.address = goods.address;
        callback(result2);
        return;
      });
      return;
    });
}

the.sellEstimate = function (wallet, goods, callback) {

  //Fix possible invalid fields for the goods object
  if (!goods.tags) goods.tags = [];
  if (!goods.timespan) goods.timespan = 2419200;
  if (!goods.currency) goods.currency = 'ETH';
  if (!goods.escrow) goods.escrow = emarket.default_contracts.defaultEscrowContractAddress;

  goods.pubkey = wallet.getCurve25519PublicKeyString();

  emarket.ethereum.api.ethdeployEstimate(
    wallet.getAddressString(),
    emarket.default_contracts.PRODUCT_CONTRACT_BYTECODE,
    emarket.default_contracts.goodsContractAbi,
    [ goods.escrow, goods.saleCount, '' + goods.price ],
    
    function(result) {

      if (result.result != 'ok') {

        callback(result);
        return;
      }

      var deployGas = result.gas;

      ///HACK: any string with the length of the address to estimate the gas spent to store
      goods.address = '0x0000000000000000000000000000000000000000';

      // now estimate the addition to the store
      storeAddEstimate(wallet, goods, function(result2) {

        if (result2.result != 'ok') {

          callback(result2);
          return;
        }

        var addGas = result2.gas;
        var totalGas = deployGas + addGas;

        callback({ result: 'ok', gas: totalGas });
        return;
      });
    }
  );
}

the.getListings = function (options, callback) {

  emarket.db.listings.select(function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    the.listingsFilterEscrow(result.items, options, false, callback);
    return;
  });
}

the.getStoreListings = function (options, callback) {

  emarket.db.listings.selectStoreName(function (result) {

    if (result.result != 'ok') {
      callback(result);
      return;
    }

    the.storenameFilterEscrow(result.items, options, false, callback);
    return;
  });
}

the.selectedStoresListings = function (options, callback) {

  emarket.db.listings.selectSelectedStore(options, function (result) {

    if (result.result != 'ok') {
      callback(result);
      return;
    }

    the.storelistingsFilterEscrow(result.items, options, false, callback);
    return;
    });
}

the.getMyListings = function (callback) {

  console.log('listings get');
  var web3 = new libs.web3(libs.web3.givenProvider);
  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  ///TODO: filter escrow contract

  emarket.db.listings.selectWithSender(account, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    var items = [];
    libs.lodash.forEach(result.items, function(item) {

      var goodsItem = emarket.goods.fromDb(item);
      goodsItem.priceEth = web3.utils.fromWei(goodsItem.price, 'ether');
      items.push(goodsItem);
    });

    callback({ result: 'ok', items: items });
    return;
  });
}

the.buy = function (wallet, goods, count, payment, privateMessage, tradeIdSaved, sessionKeySaved, callback) {

  var answer = {};
  var web3 = new libs.web3(libs.web3.givenProvider);
  var account = wallet.getAddressString();

  console.log('buy() from account ' + account);

  var tradeId = tradeIdSaved;

  if(!tradeId) {

    var rndbuf = libs.crypto.randomBytes(8);
    tradeId = web3.utils.toBN('0x' + rndbuf.toString('hex')).toString();
  }

  var datainfo = {};
  var escrowDatainfo = {};

  //private key for encryption
  var key = sessionKeySaved;

  if(!key) {

    var encPrivkey = wallet.getCurve25519PrivateKey();
    var encPubkeyStr = wallet.getCurve25519PublicKeyString();
    key = emarket.wallets.aes.createSessionKey(encPrivkey, libs.ethereumjsUtil.toBuffer(goods.pubkey));
  }

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
    wallet,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'buy',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo), JSON.stringify(escrowDatainfo), count ],
    payment,
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      result.tradeId = tradeId;
      result.key = key;
      callback(result);
      return;
    }
  );
}

the.buyEstimate = function (wallet, goods, count, payment, privateMessage, callback) {

  var web3 = new libs.web3(libs.web3.givenProvider);
  var account = wallet.getAddressString();

  var rndbuf = libs.crypto.randomBytes(8);
  var tradeId =  web3.utils.toBN('0x' + rndbuf.toString('hex')).toString();

  var datainfo = {};
  var escrowDatainfo = {};

  //private key for encryption
  var encPrivkey = wallet.getCurve25519PrivateKey();
  var encPubkeyStr = wallet.getCurve25519PublicKeyString();
  var key = emarket.wallets.aes.createSessionKey(encPrivkey, libs.ethereumjsUtil.toBuffer(goods.pubkey));
  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, key);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove sensitive information
  delete encMessage.key.key;

  datainfo.private = encMessage;

  emarket.ethereum.api.ethcallEstimate(
    account,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'buy',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo), JSON.stringify(escrowDatainfo), count ],
    payment,

    function (result) {

      if (result.result != 'ok') {

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

the.fakeBuy = function (wallet, goods, sessionKey, buyer, tradeId, count, payment,
  buyerPrivateMessage, privateMessage, callback) {

  var answer = {};
  var account = wallet.getAddressString();

  console.log('fakeBuy() from account ' + account);

  var datainfo = {};
  var encPubkeyStr = wallet.getCurve25519PublicKeyString();
  var encMessage = { msg: '' };

  if(sessionKey && sessionKey.key) {

    encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);
  }

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

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
    wallet,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'fakeBuy',
    [ emarket.defaults.marketVersion, tradeId, buyer,
      JSON.stringify(buyerPrivateMessage), JSON.stringify(datainfo), payment, count ],
    '0',
    emarket.defaults.ethTimeoutBlocks,
    callback
  );
}

the.fakeBuyEstimate = function (wallet, goods, sessionKey, buyer, tradeId, count, payment,
  buyerPrivateMessage, privateMessage, callback) {

  var datainfo = {};
  var encPubkeyStr = emarket.wallets.wallets.currentWallet.getCurve25519PublicKeyString();
  var encMessage = { msg: '' };

  if(sessionKey && sessionKey.key) {

    encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);
  }

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  emarket.ethereum.api.ethcallEstimate(
    wallet.getAddressString(),
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'fakeBuy',
    [ emarket.defaults.marketVersion, tradeId, buyer,
      JSON.stringify(buyerPrivateMessage), JSON.stringify(datainfo), payment, count ],
    '0',
    callback
  );
}

the.cancel = function (goods, callback) {

  var answer = {};
  var account = emarket.wallets.wallets.currentWallet.getAddressString();

  console.log('cancel() from account ' + account);

  var datainfo = {};

  if (emarket.defaults.isTesting) {

    answer.result = 'ok';
    answer.hash = emarket.testdata.cancelItemHash;
    callback(answer);
    return;
  }

  emarket.ethereum.api.ethcall(
    emarket.wallets.wallets.currentWallet,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'cancel',
    [ emarket.defaults.marketVersion, JSON.stringify(datainfo) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      if(result.result != 'ok') {

        callback(result);
        return;
      }

      console.log('Result', result.result);

      ///TODO: mark as deleted instead of deleting from DB

      emarket.db.listings.delete(goods,(obj)=>{
        console.log('Successfully Cancelled');
      });

      callback(result);
      return;
    }
  );
}

the.cancelEstimate = function (wallet, goods, callback) {

  var datainfo = {};

  emarket.ethereum.api.ethcallEstimate(
    wallet.getAddressString(),
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'cancel',
    [ emarket.defaults.marketVersion, JSON.stringify(datainfo) ],
    '0',
    callback
  );
}

//sessionKey is optionally decrypted session key
the.accept = function (wallet, goods, senderKey, tradeId, privateMessage, sessionKey, callback) {

  var answer = {};
  var account = wallet.getAddressString();
  var encPubkeyStr = wallet.getCurve25519PublicKeyString();

  console.log('accept() from account ' + account);

  var datainfo = {};

  if(!sessionKey || !sessionKey.key) {

    var senderKeyBuffer = libs.ethereumjsUtil.toBuffer(senderKey);
    var recipientKey = wallet.getCurve25519PrivateKey();
    sessionKey = emarket.wallets.aes.readSessionKey(senderKeyBuffer, recipientKey, sessionKey);
  }

  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  if (emarket.defaults.isTesting) {

    console.log('datainfo: ' + JSON.stringify(datainfo));
    answer.result = 'ok';
    answer.hash = emarket.testdata.acceptItemHash;
    answer.tradeId = tradeId;
    answer.key = sessionKey;
    callback(answer);
    return;
  }

  emarket.ethereum.api.ethcall(
    wallet,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'accept',
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

the.acceptEstimate = function (wallet, goods, senderKey, tradeId, privateMessage, sessionKey, callback) {

  var datainfo = {};
  var encPubkeyStr = wallet.getCurve25519PublicKeyString();

  if(!sessionKey || !sessionKey.key) {

    var senderKeyBuffer = libs.ethereumjsUtil.toBuffer(senderKey);
    var recipientKey = wallet.getCurve25519PrivateKey();
    sessionKey = emarket.wallets.aes.readSessionKey(senderKeyBuffer, recipientKey, sessionKey);
  }  

  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  emarket.ethereum.api.ethcallEstimate(
    wallet.getAddressString(),
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'accept',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo) ],
    '0',

    function (result) {

      result.key = sessionKey;
      callback(result);
    }
  );
}

//sessionKey is optionally decrypted session key
the.reject = function (wallet, goods, senderKey, tradeId, privateMessage, sessionKey, callback) {

  var answer = {};
  var account = wallet.getAddressString();
  var encPubkeyStr = wallet.getCurve25519PublicKeyString();

  console.log('reject() from account ' + account);

  var datainfo = {};
  var escrowDatainfo = {};

  if(!sessionKey || !sessionKey.key) {

    var senderKeyBuffer = libs.ethereumjsUtil.toBuffer(senderKey);
    var recipientKey = wallet.getCurve25519PrivateKey();
    sessionKey = emarket.wallets.aes.readSessionKey(senderKeyBuffer, recipientKey, sessionKey);
  }

  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  if (emarket.defaults.isTesting) {

    console.log('datainfo: ' + JSON.stringify(datainfo));
    answer.result = 'ok';
    answer.hash = emarket.testdata.rejectItemHash;
    answer.tradeId = tradeId;
    answer.key = sessionKey;
    callback(answer);
    return;
  }

  emarket.ethereum.api.ethcall(
    wallet,
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'reject',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo), JSON.stringify(escrowDatainfo) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,

    function (result) {

      result.tradeId = tradeId;
      result.key = sessionKey;
      callback(result);
    }
  );
}

//sessionKey is optionally decrypted session key
the.rejectEstimate = function (wallet, goods, senderKey, tradeId, privateMessage, sessionKey, callback) {

  var encPubkeyStr = wallet.getCurve25519PublicKeyString();

  var datainfo = {};
  var escrowDatainfo = {};

  if(!sessionKey || !sessionKey.key) {

    var senderKeyBuffer = libs.ethereumjsUtil.toBuffer(senderKey);
    var recipientKey = wallet.getCurve25519PrivateKey();
    sessionKey = emarket.wallets.aes.readSessionKey(senderKeyBuffer, recipientKey, sessionKey);
  }

  var encMessage = emarket.wallets.aes.encryptForSession(privateMessage, sessionKey);

  //add sender pubkey
  encMessage.pubkey = encPubkeyStr;

  //remove key info - not needed
  delete encMessage.key;

  datainfo.private = encMessage;

  emarket.ethereum.api.ethcallEstimate(
    wallet.getAddressString(),
    goods.address,
    emarket.default_contracts.goodsContractAbi,
    'reject',
    [ emarket.defaults.marketVersion, tradeId, JSON.stringify(datainfo), JSON.stringify(escrowDatainfo) ],
    '0',

    function (result) {

      result.key = sessionKey;
      callback(result);
    }
  );
}

the.getItem = function (address, options, progressCallback, callback) {

  if (emarket.defaults.isTesting) {

    var matchIndex = libs.lodash.findIndex(emarket.testdata.allListings,

      function(item) { return item.address == address; }
    );

    if(matchIndex < 0) {

      callback({ result: 'ok', item: {} });
      return;
    }

    var item = emarket.testdata.allListings[matchIndex];
    callback({ result: 'ok', item: item });
    return;
  }

  //update status for the item when it is requested
  var goods = { address: address };
  updateListing(goods, options, progressCallback,

    function (result) {

      if (result.result != 'ok') {
        callback(result);
        return;
      }

      var goodsItem = emarket.goods.fromDb(result.item);
      callback({ result: 'ok', item: goodsItem });
      return;
    }
  );
}

the.listingsFilterEscrow = function(listings, options, isIpfs, callback) {

  var web3 = new libs.web3(libs.web3.givenProvider);

  if (!listings || (listings.length == 0)) {

    callback({ result: 'ok', items: [], processed: 0, skipped: 0 });
    return;
  }

  var state = { items: [], total: listings.length, processed: 0, skipped: 0, i: 0 };

  libs.async.filterLimit(listings, 1,

    function(item, callback1) {

      state.i++;
      state.processed++;

      var goodsItem = emarket.goods.fromDb(item);

      if(goodsItem.escrow.length == 0) {

        state.skipped++;
        callback1(null, true);
        return;
      }

      emarket.escrows.findContractVersion(goodsItem.escrow, isIpfs, options, function(result2) {

        if(result2.result != 'ok') {

          state.skipped++;
          callback1(null, true);
          return;
        }

        if(result2.version != 1) {

          state.skipped++;
          callback1(null, true);
          return;
        }

        goodsItem.priceEth = web3.utils.fromWei(goodsItem.price, 'ether');
        state.items.push(goodsItem);
        callback1(null, true);
        return;
      });
    },

    function(err, result3) {

      if(err) {

        callback(err);
        return;
      }

      callback({ result: 'ok', items: state.items, processed: state.processed, skipped: state.skipped });
      return;
    }
  );
}

//private functions

//callback fired when all items are synced either successfully or not
function syncStoreBody(address, event, options, progressCallback, callback) {

  if (event.synced) {

    callback({ result: 'ok', event: event });
    return;
  }

  var datainfo = event.payload;
  var dataobject = JSON.parse(datainfo);

  dataobject.height = parseInt(event.blockNumber);
  dataobject.blockNumber = parseInt(event.blockNumber);
  dataobject.version = parseInt(event.version);
  dataobject.timestamp = parseInt(event.timestamp);
  dataobject.sender = event.sender.toLowerCase();

  var goodsItem = emarket.goods.fromStoreData({}, dataobject);
  if (!goodsItem) {

    callback({ result: 'error', error: 'Listing parse error', type: 'permanent' });
    return;
  }

  if (!goodsItem.address || goodsItem.address == '') {

    callback({ result: 'error', error: 'Address parse error', type: 'permanent' });
    return;
  }

  if (goodsItem.address.length != 42) {

    console.log('Wrong goods address: ' + goodsItem.address);
  }

  event.goods = goodsItem;

  var context = { contentCount: 0, height: 0, recentHeight: 0, processed: 0, event: event };

  libs.async.waterfall([

    libs.async.apply(checkContractVersion, context),
    libs.async.apply(findContractVersionForListing, options),
    libs.async.apply(checkCorrectVersion, options),
    libs.async.apply(emarket.utils.asyncFindTimestampForEvent, options),
    libs.async.apply(saveEventToDB),
    libs.async.apply(syncLoadedEvents, options, progressCallback)
  ],
    function (asyncError, asyncResult) {

      if (asyncError) {

        callback({ result: 'error', error: asyncError.error, type: asyncError.type });
        return;
      }

      callback({ result: 'ok', item: asyncResult });
    }
  );
}

//check contract version in db
function checkContractVersion(context, asyncCallback) {

  var event = context.event;

  if (typeof event.productContractVersion !== 'undefined') {

    asyncCallback(null, context);
    return;
  }

  //productContractVersion not available - check contract code
  //look for existing record for this contract
  emarket.db.contracts.select(event.goods.address, function (result) {

    if (result.result != 'ok') {

      asyncCallback({ error: result.error, type: 'temporary' }, null);
      return;
    }

    context.event.productContract = result.item;
    asyncCallback(null, context);
    return;
  });
}

//find contract version for the listing
function findContractVersionForListing(options, context, asyncCallback) {

  var event = context.event;
  if (typeof event.productContractVersion !== 'undefined') {

    asyncCallback(null, context);
    return;
  }

  // remove bytecode metadata
  var expectedBytecode = emarket.default_contracts.PRODUCT_CONTRACT_RUNTIME_BYTECODE;
  expectedBytecode = expectedBytecode.slice(0, -86);

  if (event.productContract.contractCode && (event.productContract.contractCode.length > 0)) {

    var productContractVersion = 0;

    var gotBytecode = event.productContract.contractCode;
    gotBytecode = gotBytecode.slice(0, -86);

    if (gotBytecode.endsWith(expectedBytecode)) {
      productContractVersion = 1;
    }

    context.event.productContractVersion = productContractVersion;
    asyncCallback(null, context);
    return;
  }

  //no contract code available in local DB - fetch it from outside
  emarket.ethereum.eth.getCode(event.goods.address, options, function (result) {

    if (result.result != 'ok') {

      asyncCallback({ error: result.error, type: 'temporary' }, null);
      return;
    }

    var code = result.code;
    //check goods contract
    if (!code || code == '') {

      asyncCallback({ error: result.error, type: 'temporary' }, null);
      return;
    }

    var productContractVersion = 0;

    var gotBytecode = code;
    gotBytecode = gotBytecode.slice(0, -86);

    if (gotBytecode.endsWith(expectedBytecode)) {
      productContractVersion = 1;
    }

    context.event.productContractVersion = productContractVersion;
    context.event.productContract = { contractCode: code };
    emarket.db.contracts.insert(event.goods.address, context.event.productContract, function (result2) {

      asyncCallback(null, context);
      return;
    });

    return;
  });
}

// check correct product version
function checkCorrectVersion(options, context, asyncCallback) {

  var event = context.event;

  if(event.productContractVersion == 1) {

    asyncCallback(null, context);
    return;
  }

  asyncCallback({ error: 'Wrong Product contract', type: 'permanent' }, null);
}

//store event into events DB
function saveEventToDB(context, asyncCallback) {

  var event = context.event;

  if(event.productContractVersion != 1) {

    asyncCallback({ error: 'Wrong Product contract version', type: 'permanent' }, null);
    return;
  }

  //store event status so we do not make unnecessary calls
  emarket.db.events.insert(event, function (result) {

    context.event.goods.timestamp = event.timestamp;

    //look for existing record for this event
    emarket.db.listings.selectWithAddress(event.goods.address, function (result2) {

      if (result2.result != 'ok') {

        asyncCallback({ error: result2.error, type: 'temporary' }, null);
        return;
      }

      // skip if DB record exists
      if (result2.items.length > 0) {

        asyncCallback(null, context);
        return;
      }

      //no item found - we can create new record
      var goodsItem = libs.lodash.clone(context.event.goods);
      var goodsDB = emarket.goods.toDb(goodsItem);

      emarket.db.listings.insert(goodsDB, function (result3) {

        context.event.goods = goodsDB;
        asyncCallback(null, context);
        return;
      });
    });
  });
}

//events loaded - sync them
function syncLoadedEvents(options, progressCallback, context, asyncCallback) {

  //for the new item or not yet synced event - update goods status
  updateListing(context.event.goods, options, progressCallback,

    function (result) {

      if (result.result != 'ok') {

        asyncCallback({ error: result.error, type: 'temporary', context: context }, null);
        return;
      }

      asyncCallback(null, context);
      return;
    }
  );
}

//update goods status from the contract
function updateListing(goods, options, progressCallback, callback) {

  emarket.db.listings.selectWithAddress(goods.address, function (result) {

    if (result.result != 'ok') {

      callback(result);
      return;
    }

    if (result.items.length == 0) {

      callback({ result: 'error', error: 'No item found' });
      return;
    }

    var item = result.items[0];

    (function (item) {

      console.log('Updating the item ' + item.address);
      progressCallback({ source: the.myname + 'updateListing', type: 'processing', item: item.address });

      emarket.goods.fromProductFields(item, options, function (result2) {

        if (result2.result != 'ok') {

          console.log('result is not OK', result2);
          progressCallback({ source: the.myname + 'updateListing', type: 'error', error: result2.error });
          callback(result2);
          return;
        }

        emarket.db.listings.insert(result2.item, function (result3) {

          console.log('Updating the item ' + item.address + ' done');
          progressCallback({ source: the.myname + 'updateListing', type: 'done', item: item.address });

          callback({ result: 'ok', item: result2.item });
          return;
        });

        return;
      });
    })(item);
  });
}

the.storenameFilterEscrow = function(listings, options, isIpfs, callback) {

  var web3 = new libs.web3(libs.web3.givenProvider);

  if (!listings || (listings.length == 0)) {

    callback({ result: 'ok', items: [], processed: 0, skipped: 0 });
    return;
  }

  var state = { items: [], total: listings.length, processed: 0, skipped: 0, i: 0 };

  libs.async.filterLimit(listings, 1,

    function(item, callback1) {

      state.i++;
      state.processed++;

      if(item.escrow.length == 0) {

        state.skipped++;
        callback1(null, true);
        return;
      }

      emarket.escrows.findContractVersion(item.escrow, isIpfs, options, function(result2) {

        if(result2.result != 'ok') {

          state.skipped++;
          callback1(null, true);
          return;
        }

        if(result2.version != 1) {

          state.skipped++;
          callback1(null, true);
          return;
        }

        state.items.push(item);
        callback1(null, true);
        return;
      });
    },
    function(err, result3) {

      if(err) {

        callback(err);
        return;
      }
      callback({ result: 'ok', items: state.items, processed: state.processed, skipped: state.skipped });
      return;
    }
  );
}

the.storelistingsFilterEscrow = function(listings, options, isIpfs, callback) {

  var web3 = new libs.web3(libs.web3.givenProvider);

  if (!listings || (listings.length == 0)) {

    callback({ result: 'ok', items: [], processed: 0, skipped: 0 });
    return;
  }

  var state = { items: [], total: listings.length, processed: 0, skipped: 0, i: 0 };

  libs.async.filterLimit(listings, 1,

    function(item, callback1) {

      state.i++;
      state.processed++;

      var goodsItem = emarket.goods.fromDb(item);

      if(goodsItem.escrow.length == 0) {

        state.skipped++;
        callback1(null, true);
        return;
      }

      emarket.escrows.findContractVersion(goodsItem.escrow, isIpfs, options, function(result2) {

        if(result2.result != 'ok') {

          state.skipped++;
          callback1(null, true);
          return;
        }

        if(result2.version != 1) {

          state.skipped++;
          callback1(null, true);
          return;
        }

        goodsItem.priceEth = web3.utils.fromWei(goodsItem.price, 'ether');
        state.items.push(goodsItem);
        callback1(null, true);
        return;
      });
    },
    function(err, result3) {

      if(err) {

        callback(err);
        return;
      }
      callback({ result: 'ok', items: state.items, processed: state.processed, skipped: state.skipped });
      return;
    }
  );
}

function storeAdd(wallet, goods, callback) {

  if (goods.timespan > emarket.defaults.defaultExpireTime) {
    goods.timespan = emarket.defaults.defaultExpireTime;
  }

  emarket.ethereum.api.ethcall(
    wallet,
    emarket.default_contracts.storeContractAddress,
    emarket.default_contracts.storeContractAbi,
    'add',
    [ emarket.defaults.marketVersion, 1, goods.timespan, JSON.stringify(emarket.goods.toStoreData(goods)) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,
    callback
  );
}

function storeAddEstimate(wallet, goods, callback) {

  if (goods.timespan > emarket.defaults.defaultExpireTime) {
    goods.timespan = emarket.defaults.defaultExpireTime;
  }

  emarket.ethereum.api.ethcallEstimate(
    wallet.getAddressString(),
    emarket.default_contracts.storeContractAddress,
    emarket.default_contracts.storeContractAbi,
    'add',
    [ emarket.defaults.marketVersion, 1, goods.timespan, JSON.stringify(emarket.goods.toStoreData(goods)) ],
    '0',
    callback
  );
}

module.exports = the
