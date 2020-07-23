/**
 * 跨服村庄服务器
 */

global.fs     = require('fs');
global.clone    = require('clone');
global.util     = require('util');
global.clone    = require('clone');
global.common   = require('./common.js');
global.Player   = require('./logic/player.js').Player;
global.config   = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
global.async    = require('async');

require('./global.js');
require('./logger.js');

var server  = require('./server.js');
var logic   = require('./landgrabber/');
var ErrorCode = require('./landgrabber/error.js').ErrorCode;
var findErrorString = require('./landgrabber/error.js').findErrorString;

global.gDBUser = null;
global.gDBWorld = null;
global.gCache = null;

global.gUserInfo = null;
global.gLandGrabber = null;
global.gReplay = null;
global.gTick = null;

var tickInterval = 60 * 30;
var tickCount = 0;

setupLog('landgrabber');

server.loadGlobalServerConf('landgrabber', function () {
    (function main() {
        server.loadCache(function(cache){
            global.gCache = cache;
            INFO('redis connected');
        });

        server.loadConf('landgrabber');
        server.loadDB(function(db){
            gDBUser = db.collection('user');
            gDBWorld = db.collection('world');
            INFO('mongodb connected');

            loadLandGrabberServer(function() {
                server.startWebServer('landgrabber', config.LandGrabberPort, config.LandGrabberHost , function(query, res, resp) {
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

                    // 更新数据
                    if (query.uid && query.update) {
                        query.update = JSON.parse(query.update);
                        if (typeof(query.update) == 'object') {
                            gUserInfo.update(query.uid, query.update);
                        }
                    }

                    logicHandler(query, res, resp);
                }, function(callback) {
                    saveLandGrabberServer(function () {
                        LOG('landgrabber saved');
                        callback();
                    });
                });
            });
        });
    })();
});

// 加载跨服竞技场服务器
function loadLandGrabberServer(callback) {
    var counter = 3;
    function onLoad(){
        counter -= 1;
        if( counter <= 0 ) {
            callback && callback();
            timer();
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./landgrabber/user.js').UserInfo;
    global.gUserInfo = new UserInfo();
    gUserInfo.init(function(succ){
        if(!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        INFO('user loaded');
        onLoad();

        // 加载跨服竞技场数据
        var LandGrabber = require('./landgrabber/landgrabber.js').LandGrabber;
        global.gLandGrabber = new LandGrabber();
        gLandGrabber.init(function(succ){
            if( !succ ) {
                ERROR("can't load landgrabber");
                process.exit(-1);
            }
            INFO('landgrabber loaded');
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

            INFO('replay loaded');
            onLoad();
        })
    });
}

// 保存快富竞技场
function saveLandGrabberServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    loader.addLoad('user');
    gUserInfo.save(function () {
        loader.onLoad('user');
    });

    // 保存军团战模块
    loader.addLoad('landgrabber');
    gLandGrabber.save(function(succ) {
        loader.onLoad('landgrabber');
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
        tickCount++;

        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gLandGrabber.save();
            tickCount = 0;
        }

        gLandGrabber.tickFunc();
    }, 1000);

    gLandGrabber.tickFunc();

    // 30分钟1次
    clearInterval(gTick);
    tickFunc();
    gTick = setInterval(tickFunc, tickInterval*1000);
}

function tickFunc() {
    // 每日5点刷新及每周5点刷新
    var now = common.getTime();
    var todayTime = getResetTime();
    var nextDayTime = todayTime + 86400;
    if (gLandGrabber.resetTime < todayTime || (gLandGrabber.resetTime < nextDayTime && now + tickInterval > nextDayTime)) {
        var timeout = 0;
        if (gLandGrabber.resetTime >= todayTime) {
            timeout = (nextDayTime - now) * 1000;
        }

        setTimeout(function() {
            // 每日重置
            gUserInfo.resetByDay();
            gLandGrabber.resetByDay();
        }, timeout);
    }
}
