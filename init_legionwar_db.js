var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var LegionWar = require('./legionwar/legionwar').LegionWar;

(function main(){
    server.loadDB(function(db){

        var loader = new common.Loader(function() {
            process.exit(0);
        });

        // 军团数据表
        db.createCollection('legion', {}, function(err, result) {});

        // 机器人数据
        db.createCollection('robot', {}, function(err, result) {});

        // 军团战历史数据
        db.createCollection('history', {}, function(err, result) {});

        // 军团排行榜
        db.createCollection('ranklist', {}, function(err, result) {});

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            // 创建军团战数据
            loader.addLoad('LegionWar');
            LegionWar.create(function () {
                loader.onLoad('LegionWar');
            });
        });
    });
})();
