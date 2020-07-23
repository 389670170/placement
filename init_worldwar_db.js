var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var WorldWar = require('./worldwar/worldwar.js').WorldWar;

var worldItems = {};

(function main(){
    server.loadDB(function(db){
        db.createCollection('user', {}, function(err, result) {});

        db.createCollection('replay', {}, function(err, result) {});

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            WorldWar.create();
            worldItems['worldwar'] = 1;
        });

        setTimeout(function(){
            var cursor = db.collection('world').find({},{_id:1});
            cursor.each(function(err, item) {
                if (cursor.isClosed()) {
                    if (Object.keys(worldItems).length > 0) {
                        console.log('error');
                        process.exit(-1);
                    } else {
                        process.exit(0);
                    }
                } else {
                    if (!item) return;
                    delete worldItems[item._id];
                }
            });
        }, 1000);
    });
})();
