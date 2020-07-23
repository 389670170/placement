var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var CountryWar = require('./countrywar/countrywar.js').CountryWar;
var Replay = require('./countrywar/replay.js').Replay;

(function main(){
    server.loadDB(function(db){
        var loader = new common.Loader(function() {
            process.exit(0);
        });

        db.createCollection('user', {}, function(err, result) {});

        db.createCollection('replay', {}, function(err, result) {});

        db.createCollection('rooms', {}, function(err, result) {});

        db.createCollection('countrywar', {}, function(err, result){
            global.gDBCountryWar = db.collection('countrywar');

            loader.addLoad('countrywar');
            CountryWar.create(function () {
                loader.onLoad('countrywar');
            });

            loader.addLoad('replay');
            Replay.create(function() {
                loader.onLoad('replay');
            });
        });
    });
})();
