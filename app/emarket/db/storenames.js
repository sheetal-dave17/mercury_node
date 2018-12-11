var emarket = {};
emarket.defaults = require('./../../emarket/defaults');
emarket.testdata = require('./../../emarket/testdata');

emarket.db = {};
emarket.db.db = require('./../../emarket/db/db');

emarket.db.storenames = function () {}

var the = emarket.db.storenames;
the.myname = 'emarket.db.storenames';

the.create = function(callback) {

  emarket.db.db.use(
    function(callback) {

      emarket.db.db.db.serialize(function() {

        emarket.db.db.db.run('CREATE TABLE IF NOT EXISTS storenames (\
          address VARCHAR(50) PRIMARY KEY, \
          storename VARCHAR(200) NOT NULL)');
        emarket.db.db.db.run('CREATE UNIQUE INDEX IF NOT EXISTS storenames_address_idx ON storenames (address)');
        callback({ result: 'ok' });
        return;
      });
    },
    callback);
}

the.insert = function(item, callback) {

  emarket.db.db.use(
    function(callback) {

      emarket.db.db.db.run('INSERT OR REPLACE INTO storenames VALUES (?, ?)',
        [ item.address, item.storename ],
        function(err) {

          if(err) {

            callback({ result: 'error', error: err });
            return;
          }

          callback({ result: 'ok' });
          return;
        });

      return;
    },
    callback);
};

the.selectWithSender = function(address, callback) {

  emarket.db.db.use(
    function(callback) {

      emarket.db.db.db.all("SELECT storename FROM storenames WHERE address = ?", [ address ], function(err, rows) {

        if(err) {
          
          callback({ result: 'error', error: err });
          return;
        }

        callback({ result: 'ok', items: rows });
        return;
      });
    },
    callback);
}

the.select = function(callback) {

  var answer = {};

  emarket.db.db.use(
    function(callback) {

      emarket.db.db.db.all('SELECT * FROM storenames ORDER BY rowid ASC', [], function(err, rows) {

        if(err) {

          callback({ result: 'error', error: err });
          return;
        }

        answer.result = 'ok';
        answer.items = rows;
        callback(answer);
        return;
      });
    },
    callback);
}

module.exports = the;
