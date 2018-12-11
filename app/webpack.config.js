const path = require('path');
var nodeExternals = require('webpack-node-externals');
const JavaScriptObfuscator = require('webpack-obfuscator');


module.exports = {
    entry: {
        marketbindings: './marketbindings.js',
        defaults: './emarket/defaults.js',
        store: './emarket/store.js',
        db: './emarket/db/db.js',
        dbmigrate: './emarket/db/dbmigrate.js',
        events: './emarket/db/events.js',
        transactionLog: './emarket/db/transactionLog.js',
        stores: './emarket/db/storenames.js',
        transactions: './emarket_electron/transactions.js',
        fe_config: './emarket_electron/fe_config.js',
        appbindings: './appbindings.js'
    },
    output: {
        path: path.resolve(__dirname),
        filename: '../opensource/core/[name].bundle.js',
        libraryTarget: 'commonjs-module',
    },
    node: {
        __dirname: false,
        __filename: false,
        console: 'mock'
    },
    mode: 'production',
    target: 'node',   // THIS IS THE IMPORTANT PART
    externals: [nodeExternals()],
    plugins: [
        new JavaScriptObfuscator({
            rotateUnicodeArray: true
        }, [])
    ]
};