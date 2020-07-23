/**
 * 跨服竞技场服务器
 */

global.fs = require('fs');
global.clone = require('clone');
global.util = require('util');
global.clone = require('clone');
global.common = require('./common.js');
global.Player = require('./logic/player.js').Player;
global.config = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
global.async = require('async');

var server = require('./server.js');
var logic = require('./arena/');
var ErrorCode = require('./arena/error.js').ErrorCode;
var findErrorString = require('./arena/error.js').findErrorString;

require('./global.js');

global.gDBUser = null;
global.gDBWorld = null;
global.gCache = null;

global.gUserInfo = null;
global.gArena = null;
global.gReplay = null;

// 跨服活动数据
global.gActLuckyRotation = null;


var tickInterval = 60 * 1;
var tickCount = 0;

require('./global.js');
require('./logger.js');
setupLog('arena');
server.loadGlobalServerConf('arena');
(function main() {
    server.loadCache(function (cache) {
        global.gCache = cache;
        DEBUG('redis connected');
    });

    server.loadConf('arena');
    server.loadDB(function (db) {
        gDBUser = db.collection('user');
        gDBWorld = db.collection('world');
        DEBUG('mongodb connected');

        loadArenaServer(function () {
            server.startWebServer('arena', config.ArenaServerPort, config.ArenaServerHost, function (query, res, resp) {
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
            }, function (callback) {
                saveArenaServer(function () {
                    DEBUG('arena saved');
                    callback();
                });
            });
        });
    });
})();

// 加载跨服竞技场服务器
function loadArenaServer(callback) {
    var counter = 4;
    function onLoad() {
        counter -= 1;
        if (counter <= 0) {
            callback && callback();
            timer();
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./arena/user.js').UserInfo;
    global.gUserInfo = new UserInfo();
    gUserInfo.init(function (succ) {
        if (!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        DEBUG('user loaded');
        onLoad();

        // 加载跨服竞技场数据
        var Arena = require('./arena/arena.js').Arena;
        global.gArena = new Arena();
        gArena.init(function (succ) {
            if (!succ) {
                ERROR("can't load Arena");
                process.exit(-1);
            }
            DEBUG('Arena loaded');
            onLoad();
        });

        // 加载活动数据
        var ActLuckyRotation = require('./arena/act_lucky_rotate.js').ActLuckyRotation;
        global.gActLuckyRotation = new ActLuckyRotation();
        gActLuckyRotation.init(function (succ) {
            if (!succ) {
                ERROR("can't load ActLuckyRotation");
                // process.exit(-1);
            }

            DEBUG('ActLuckyRotation loaded');
            onLoad();
        });

        // 战报
        var Replay = require('./arena/replay').Replay;
        global.gReplay = new Replay();
        gReplay.init(function (succ) {
            if (!succ) {
                ERROR('cannot load replay');
                process.exit(-1)
            }

            DEBUG('replay loaded');
            onLoad();
        })
    });
}

// 保存快富竞技场
function saveArenaServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    loader.addLoad('user');
    gUserInfo.save(function () {
        loader.onLoad('user');
    });

    // 保存军团战模块
    loader.addLoad('arena');
    gArena.save(function (succ) {
        loader.onLoad('arena');
    });

    loader.addLoad('replay');
    gReplay.save(function () {
        loader.onLoad('replay');
    });

    loader.addLoad('act_lucky_rotate');
    gActLuckyRotation.save(function () {
        loader.onLoad('act_lucky_rotate');
    });

    loader.onLoad('empty');
}

// 时间推进
function timer() {
    // 每秒1次
    setInterval(function () {
        tickCount++;

        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gArena.save();
            tickCount = 0;
        }
    }, 1000);

    // 30分钟1次
    gArena.tickFunc();
    setInterval(function () {
        gArena.tickFunc();
    }, tickInterval * 1000);
}
