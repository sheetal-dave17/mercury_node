var libs = {};



libs.sqlite3 = require('sqlite3');

var emarket = {};
emarket.defaults = require('./../../emarket/defaults');

emarket.db = {};

emarket.db.db = function () { }

var the = emarket.db.db;

//database storage
the.db;
the.path = 'block.sqlite';


// TODO: figure out why when built with webpack it cant get path from index.js
libs.path = require('path');
libs.electron = require('electron');
var electronApp;
if(libs.electron)
  electronApp = libs.electron.app
if (electronApp && electronApp.getPath) {

  //for running 2 accounts
  let arg = process.argv[2];
  if (!arg) arg = process.argv[1];
  let suffix = '-' + arg;
  if (!arg || (arg != 'first' && arg != 'second')) suffix = '';
  the.path = libs.path.join(electronApp.getPath('documents'), 'bitboost' + suffix + '.sqlite');
  if (emarket.defaults.isTestnet) dbName = libs.path.join(electronApp.getPath('documents'), 'bitboost-testnet' + suffix + '.sqlite');
}
//use persistent storage with sqlite or RAM based storage
the.useSqlite = true;

the.open = function (path) {

  the.path = path;
  console.log('open DB', path);
  the.db = new libs.sqlite3.Database(path);
}

the.close = function () {

  try {
    if (the.db) {
      the.db.close();
    }
  } catch (err) {

  }
}

the.use = function (fn, callback) {

  the.db = new libs.sqlite3.Database(the.path, function (err) {

    if (err) {

      callback({ result: 'error', error: err });
      return;
    }

    try {

      fn(function (result) {

        callback(result);
        return;
      });
    } catch (err2) {

      the.close();
      callback({ result: 'error', error: err2 });
      return;
    }
  });
}

module.exports = the