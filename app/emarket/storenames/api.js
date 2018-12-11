var libs = {};
libs.xss = require('xss');
libs.async = require('async');

var emarket = {}
emarket.storenames = {};
emarket.ethereum = {};
emarket.wallets = {};
emarket.db = {};

emarket.defaults = require('./../../emarket/defaults');
emarket.sync = require('./../../emarket/sync');
emarket.utils = require('./../../emarket/utils');
emarket.ethereum.api = require('./../../emarket/ethereum/api');
emarket.ethereum.web3 = require('./../../emarket/ethereum/web3');
emarket.ethereum.eth = require('./../../emarket/ethereum/eth');
emarket.wallets.wallets = require('./../../emarket/wallets/wallets');
emarket.db.events = require('./../../emarket/db/events');
emarket.db.storenames = require('./../../emarket/db/storenames');

emarket.storenames.api = function () {}

var the = emarket.storenames.api;
the.myname = 'emarket.storenames.api';

the.store2Abi = [{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_version","type":"uint256"},{"name":"_dataInfo","type":"string"}],"name":"add","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_version","type":"uint256"},{"name":"_dataInfo","type":"string"}],"name":"remove","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"contentCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":false,"stateMutability":"nonpayable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"version","type":"uint256"},{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"timePage","type":"uint256"},{"indexed":false,"name":"eventType","type":"uint16"},{"indexed":false,"name":"dataInfo","type":"string"}],"name":"LogStore","type":"event"}];

the.store2Address = '0xde29140943dd13fdcf782d51854b5042fd640d99';
if(emarket.defaults.isTestnet) the.store2Address = '0x37925cfb05aec6333b8cb2d0d1ae68ccfe6a22ba';
if(emarket.defaults.isTestnet && emarket.defaults.privateTestnet) the.store2Address = '';

var myxss = new libs.xss.FilterXSS({ whiteList: {} });

the.sync = function (options, progressCallback, callback) {

  emarket.sync.syncHelper(
    options, the.myname + '.sync',
    the.store2Address, the.store2Abi, 'LogStore',
    function (item) {
      return true;
    },
    syncStoreBody,
    progressCallback, callback);
}

// add storename to the contract. One per user.
the.add = function (wallet, options, storename, callback) {

  var dataInfo = { s: storename };

  emarket.ethereum.api.ethcall(
    wallet,
    the.store2Address,
    the.store2Abi,
    'add',
    [ emarket.defaults.marketVersion, JSON.stringify(dataInfo) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,

    function(result) {
  
      callback(result);
      return;
    }
  );
}

// remove storename from the contract. Will likely not be used.
the.remove = function (wallet, options, storename, callback) {

  var dataInfo = { s: storename };

  emarket.ethereum.api.ethcall(
    wallet,
    the.store2Address,
    the.store2Abi,
    'remove',
    [ emarket.defaults.marketVersion, JSON.stringify(dataInfo) ],
    '0',
    emarket.defaults.ethTimeoutBlocks,

    function(result) {
  
      callback(result);
      return;
    }
  );
}

// get the storename for given user
the.storenamesUser = function (options, account, callback) {

  emarket.db.storenames.selectWithSender(account, callback);
}

// get the storenames list from the contract. Contains the full list of the users with corresponding storenames.
the.storenames = function (options, callback) {

  emarket.db.storenames.select(callback);
}

// private functions

//callback fired when all items are synced either successfully or not
function syncStoreBody(address, event, options, progressCallback, callback) {

  var datainfo = event.payload;
  var dataobject = JSON.parse(datainfo);

  dataobject.height = parseInt(event.blockNumber);
  dataobject.blockNumber = parseInt(event.blockNumber);
  dataobject.version = parseInt(event.version);
  dataobject.timestamp = parseInt(event.timestamp);
  dataobject.sender = event.sender.toLowerCase();
  dataobject.eventType = event.eventType;

  var storename = dataobject.s;
  if (!storename) {

    callback({ result: 'error', error: 'Storename parse error', type: 'permanent' });
    return;
  }

  dataobject.storename = myxss.process(storename);

  event.data = dataobject;

  var context = { contentCount: 0, height: 0, recentHeight: 0, processed: 0, event: event };

  libs.async.waterfall([
    libs.async.apply(emarket.utils.asyncFindTimestampForEvent, options, context),
    libs.async.apply(saveEventToDB)
  ],
    function (asyncError, asyncResult) {

      if (asyncError) {

        callback({ result: 'error', error: asyncError.error, type: asyncError.type });
        return;
      }

      callback({ result: 'ok', item: asyncResult });
      return;
    }
  );
}

//store event into events DB
function saveEventToDB(context, asyncCallback) {

  var event = context.event;
  event.data.timestamp = event.timestamp;

  // insert item if eventType == ADD
  if(event.data.eventType == 1) {

    var item = { address: event.data.sender, storename: event.data.storename };
    emarket.db.storenames.insert(item, function (result) {

      asyncCallback(null, context);
      return;
    });

    return;
  }

  // remove item if eventType == REMOVE
  if(event.data.eventType == 2) {

    ///TODO: mark storename as deleted when this event occurs
    console.log('Deleted item ' + event.data.storename + ' for user ' + event.data.sender);

    asyncCallback(null, context);
    return;
  }

  asyncCallback(null, context);
  return;
}

module.exports = the