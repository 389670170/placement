/**
 * 领地战服务器
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
var logic   = require('./territorywar/');
var ErrorCode = require('./territorywar/error.js').ErrorCode;
var findErrorString = require('./territorywar/error.js').findErrorString;

require('./global.js');

global.gReplay = null;
global.gCache = null;
global.gDBWorld = null;
global.gDBLegion = null;
global.gDBRobot = null;
global.gDBHistory = null;
global.gDBRankList = null;
global.gDBTerritory = null;

global.gTerritoryWar = null;
global.gTickFuncInterval = null;

var tickInterval = 60 * 30;
var tickCount = 0;

require('./global.js');
require('./logger.js');
setupLog('territorywar');

server.loadGlobalServerConf('territorywar');
(function main() {
    server.loadCache(function(cache){
        global.gCache = cache;
        INFO('redis connected');
    });

    server.loadConf('territorywar');
    server.loadDB(function(db){
        gDBUser = db.collection('user');
        gDBWorld = db.collection('world');
        gDBTerritory = db.collection('territory');
        INFO('mongodb connected');

        loadTerritorywarServer(function() {
            server.startWebServer('territorywar', config.TerritoryWarPort, config.TerritoryWarHost , function(query, res, resp) {
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

                logicHandler(query, res, resp);
            }, function(callback) {
                saveTerritoryWarServer(function () {
                    LOG('TerritoryWar saved');
                    callback();
                });
            });
        });
    });
})();
// 加载领地战服务器
function loadTerritorywarServer(callback) {
    var counter = 3;
    function onLoad(){
        counter -= 1;
        if( counter <= 0 ) {
            callback && callback();
            timer();
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./territorywar/user.js').UserInfo;
    gUserInfo = new UserInfo();
    gUserInfo.init(function(succ){
        if(!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        INFO('user loaded');
        onLoad();

        // 加载跨服战数据
        var TerritoryWar = require('./territorywar/territorywar.js').TerritoryWar;
        global.gTerritoryWar = new TerritoryWar();
        gTerritoryWar.init(function(succ){
            if( !succ ) {
                ERROR("can't load TerritoryWar");
                process.exit(-1);
            }
            INFO('TerritoryWar loaded');
            onLoad();
        });

        // 战报
        var Replay = require('./territorywar/replay').Replay;
        gReplay = new Replay();
        gReplay.init(function (succ) {
            if (!succ) {
                ERROR('cannot load replay');
                process.exit(-1)
            }

            INFO('replay loaded');
            onLoad();
        })
    });
}

// 保存领地战战服务器
function saveTerritoryWarServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    loader.addLoad('user');
    gUserInfo.save(function () {
        loader.onLoad('user');
    });

    // 保存军团战模块
    loader.addLoad('TerritoryWar');
    gTerritoryWar.save(function(succ) {
        loader.onLoad('TerritoryWar');
    });

    loader.addLoad('replay');
    gReplay.save(function () {
        loader.onLoad('replay');
    });

    loader.onLoad('empty');
}

// 时间推进
function timer() {
    // 每秒1次
    setInterval(function () {
        gTerritoryWar.tick();
        tickCount++;

        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gTerritoryWar.save();
            tickCount = 0;
        }
    }, 1000);

    gTerritoryWar.tickFunc();
    clearInterval(global.gTickFuncInterval);

    // 一天1次
    global.gTickFuncInterval = setInterval(function () {
        gTerritoryWar.tickFunc();
    }, tickInterval * 1000);
}
