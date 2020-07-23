/**
 * 军团战服务器
 */

global.fs     = require('fs');
global.clone    = require('clone');
global.util     = require('util');
global.clone    = require('clone');
global.common   = require('./common.js');
global.Player   = require('./logic/player.js').Player;
global.config   = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
global.async    = require('async');

var server  = require('./server.js');
var logic   = require('./legionwar/');
var ErrorCode = require('./legionwar/error.js').ErrorCode;
var findErrorString = require('./legionwar/error.js').findErrorString;

require('./global.js');

global.gCache = null;
global.gDBRegister = null;
global.gDBWorld = null;
global.gDBLegion = null;
global.gDBRobot = null;
global.gDBHistory = null;
global.gDBRankList = null;

global.gLegionWar = null;

var tickInterval = 60 * 30;
var tickCount = 0;

require('./global.js');
require('./logger.js');
setupLog('legionwar');
server.loadGlobalServerConf('legionwar');
(function main() {
    server.loadCache(function(cache){
        global.gCache = cache;
        INFO('redis connected');
    });

    server.loadConf('legionwar');
    server.loadDB(function(db){
        gDBRegister = db.collection('register');
        gDBWorld = db.collection('world');
        gDBLegion = db.collection('legion');
        gDBRobot = db.collection('robot');
        gDBHistory = db.collection('history');
        gDBRankList = db.collection('ranklist');
        INFO('mongodb connected');

        loadLegionwarServer(function() {
            server.startWebServer('legionwar', config.LegionWarServerPort, config.LegionWarServerHost , function(query, res, resp) {
                var logicHandler = null;
                var module = logic[query.mod];

                if (module) {
                    logicHandler = module[query.act];
                }

                if (!logicHandler) {
                    resp.code = 1;
                    resp.desc = 'act ' + query.act + ' not support in mod ' + query.mod;
                    onReqHandled(res, resp);
                    return;
                }

                /*if (query.args.stage != gLegionWar.stage) {
                 if ((query.args.stage != 2 && query.args.stage != 0) || gLegionWar.stage != 3) {
                 resp.code = ErrorCode.ERROR_STAGE_NOT_EQUAL;
                 resp.desc = findErrorString(ErrorCode.ERROR_STAGE_NOT_EQUAL);
                 onReqHandled(res, resp);
                 return;
                 }
                 }*/

                logicHandler(query, res, resp);
            }, function(callback) {
                saveLegionwarServer(function () {
                    LOG('LegionWar saved');
                    callback();
                });
            });

            setInterval(function() {
                gLegionWar.update();
                gLegionWar.updateBattle();
            }, 10 * 1000);

            setInterval(function() {
                gLegionWar.save();
            }, 30 * 60 * 1000);
        });
    });
})();

// 加载军团战服务器
function loadLegionwarServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 加载军团战模块
    loader.addLoad('LegionWar');
    var LegionWar = require('./legionwar/legionwar').LegionWar;
    global.gLegionWar = new LegionWar();
    gLegionWar.init(function(succ){
        if (!succ) {
            ERROR("can't load LegionWar");
            process.exit(-1);
        }

        INFO('LegionWar loaded');
        loader.onLoad('LegionWar');
    });

    loader.onLoad('empty');
}

// 保存军团战服务器
function saveLegionwarServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 保存军团战模块
    loader.addLoad('LegionWar');
    gLegionWar.save(function(succ) {
        loader.onLoad('LegionWar');
    });

    loader.onLoad('empty');
}
