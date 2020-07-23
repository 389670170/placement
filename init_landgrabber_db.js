var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var LandGrabber = require('./landgrabber/landgrabber.js').LandGrabber;
var Replay = require('./landgrabber/replay.js').Replay;

require('./server.js').loadConf('landgrabber', true);

(function main(){
    server.loadDB(function(db){
        var loader = new common.Loader(function() {
            process.exit(0);
        });

        db.createCollection('user', {}, function(err, result) {});

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            loader.addLoad('landgrabber');
            LandGrabber.create(function () {
                loader.onLoad('landgrabber');
            });

            loader.addLoad('replay');
            Replay.create(function() {
                loader.onLoad('replay');
            });
        });
    });
})();
