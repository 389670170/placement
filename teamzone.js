/**
 * 小队领地服务器
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
var logic   = require('./teamzone/');
var ErrorCode = require('./teamzone/error.js').ErrorCode;
var findErrorString = require('./teamzone/error.js').findErrorString;

require('./global.js');

global.gCache = null;
global.gDBUser = null;
global.gDBWorld = null;

global.gUserInfo = null;
global.gTeamZone = null;

var tickInterval = 60 * 30;
var tickCount = 0;

require('./global.js');
require('./logger.js');
setupLog('teamzone');

server.loadGlobalServerConf('teamzone');
(function main() {

    server.loadCache(function(cache){
        global.gCache = cache;
        INFO('redis connected');
    });

    server.loadConf('teamzone');
    server.loadDB(function(db){
        global.gDBUser = db.collection('user');
        global.gDBWorld = db.collection('world');

        INFO('mongodb connected');

        loadTeamZoneServer(function() {
            server.startWebServer('teamzone', config.TeamZonePort, config.TeamZoneHost , function(query, res, resp) {
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
                saveTeamZoneServer(function () {
                    LOG('team zone saved');
                    callback();
                });
            });
        });
    });
})();
// 加载小队领地服务器
function loadTeamZoneServer(callback) {
    var counter = 2;
    function onLoad(){
        counter -= 1;
        if( counter <= 0 ) {
            callback && callback();
            timer();
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./teamzone/user.js').UserInfo;
    global.gUserInfo = new UserInfo();
    gUserInfo.init(function(succ){
        if(!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        INFO('user loaded');
        onLoad();

        // 加载跨服战数据
        var TeamZone = require('./teamzone/teamzone.js').TeamZone;
        global.gTeamZone = new TeamZone();
        gTeamZone.init(function(succ){
            if( !succ ) {
                ERROR("can't load team zone");
                process.exit(-1);
            }
            INFO('team zone loaded');
            onLoad();
        });
    });
}

// 保存小队领地服务器
function saveTeamZoneServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    loader.addLoad('user');
    gUserInfo.save(function () {
        loader.onLoad('user');
    });

    // 保存军团战模块
    loader.addLoad('TeamZone');
    gTeamZone.save(function(succ) {
        loader.onLoad('TeamZone');
    });

    loader.onLoad('empty');
}

// 时间推进
function timer() {
    // 每秒1次
    setInterval(function () {
        gTeamZone.tickFunc();
        tickCount++;

        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gTeamZone.save();
            tickCount = 0;
        }
    }, 1000);

    // 30分钟1次
    gTeamZone.tickFunc();
    setInterval(function () {
        gTeamZone.tickFunc();
    }, tickInterval*1000);
}
