var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var TerritoryWar = require('./territorywar/territorywar').TerritoryWar;
var Replay = require('./territorywar/replay.js').Replay;

(function main(){
    server.loadDB(function(db){

        var loader = new common.Loader(function() {
            process.exit(0);
        });

        db.createCollection('user', {}, function (err, result) {
        });

        db.createCollection('replay', {}, function (err, result) {
        });

        db.createCollection('territory', {}, function (err, result) {
        });

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            // 创建军团战数据
            loader.addLoad('TerritoryWar');
            TerritoryWar.create(function () {
                loader.onLoad('TerritoryWar');
            });

            loader.addLoad('replay');
            Replay.create(function () {
                loader.onLoad('replay');
            });
        });

    });
})();
