var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var TeamZone = require('./teamzone/teamzone').TeamZone;

(function main(){
    server.loadDB(function(db){

        var loader = new common.Loader(function() {
            process.exit(0);
        });

        db.createCollection('user', {}, function (err, result) {
        });

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            // 创建小队领地数据
            loader.addLoad('TeamZone');
            TeamZone.create(function () {
                loader.onLoad('TeamZone');
            });
        });

    });
})();
