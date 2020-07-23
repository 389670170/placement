var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var Arena = require('./arena/arena.js').Arena;
var Replay = require('./arena/replay.js').Replay;

// 跨服活动：幸运转盘
var ActLuckyRotation = require('./arena/act_lucky_rotate.js').ActLuckyRotation;


require('./server.js').loadConf('arena');

(function main(){
    server.loadDB(function(db){
        var loader = new common.Loader(function() {
            process.exit(0);
        });

        db.createCollection('user', {}, function(err, result) {});

        db.createCollection('replay', {}, function(err, result) {});

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            loader.addLoad('arena');
            Arena.create(function () {
                loader.onLoad('arena');
            });

            loader.addLoad('lucky_rotation');
            ActLuckyRotation.create( function() {
                loader.onLoad('lucky_rotation');
            })

            loader.addLoad('replay');
            Replay.create(function() {
                loader.onLoad('replay');
            });
        });
    });
})();
