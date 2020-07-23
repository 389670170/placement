/*
 CountryWar 服战
 */

global.fs     = require('fs');
global.clone    = require('clone');
global.util     = require('util');
global.clone    = require('clone');
global.common   = require('./common.js');
global.Player   = require('./logic/player.js').Player;
global.config   = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');

var server  = require('./server.js');
var logic   = require('./countrywar/');

require('./global.js');

global.gDBUser = null;
global.gDBCountryWar = null;
global.gDBRooms = null;

global.gCountryWar = null;
global.gUserInfo = null;
global.gReplay = null;
global.gCache = null;

var tickInterval = 60 * 30;
var tickCount = 0;

// 初始化日志
require('./logger.js');
setupLog('countrywar');
server.loadGlobalServerConf('countrywar');
(function main() {
    // 加载服务器配置
    server.loadConf('countrywar');
    server.loadCache(function(cache){
        global.gCache = cache;
        INFO('redis connected');
    });

    // 加载数据库数据
    server.loadDB(function(db){
        global.gDBUser = db.collection('user');
        global.gDBCountryWar = db.collection('countrywar');
        global.gDBRooms = db.collection('rooms');

        INFO('mongodb connected');

        loadCountryWar(function(){

            server.startWebServer('countrywar', config.CountryWarPort, config.CountryWarHost, function(query, res, resp) {
                // 服务器消息处理
                var logicHandler = null;
                var module = logic[query.mod];
                if( module ) {
                    logicHandler = module[query.act];
                }

                if( !logicHandler ) {
                    resp.code = 1;
                    resp.desc = 'act ' + query.act + ' not support in mod ' + query.mod;
                    onReqHandled(res, resp);
                    return;
                }

                logicHandler(query, res, resp);
            }, function(callback) {
                // 服务器退出处理
                saveCountryWar(function () {
                    LOG('countrywar saved');
                    callback();
                });
            });
        });

    });
})();

// 加载服战数据
function loadCountryWar(callback) {
    var counter = 3;
    function onLoad(){
        counter -= 1;
        if( counter <= 0 ) {
            callback && callback();
            timer();

            // 读取服务器列表
            var phpReq = {
                uid : 1,
                act : 'get_server_list',
                args : {
                    uid : 1,
                },
            };
            var phpResp = {};
            phpResp.code = 0;
            phpResp.desc = '';
            requestPHP(phpReq, phpResp, function () {
                if (phpResp.code == 0) {
                    gCountryWar.initWebServerList(phpResp['desc']);
                }
            });
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./countrywar/user.js').UserInfo;
    gUserInfo = new UserInfo();
    gUserInfo.init(function(succ){
        if(!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        INFO('user loaded');
        onLoad();

        // 加载服战数据
        var CountryWar = require('./countrywar/countrywar.js').CountryWar;
        global.gCountryWar = new CountryWar();
        gCountryWar.init(function(succ){
            if( !succ ) {
                ERROR("can't load countrywar");
                process.exit(-1);
            }
            INFO('countrywar loaded');
            onLoad();
        });

        var Replay = require('./countrywar/replay.js').Replay;
        gReplay = new Replay();
        gReplay.init(function(succ) {
            if (!succ) {
                ERROR('cannot load replay');
                process.exit(-1);
            }

            INFO('replay loaded');
            onLoad();
        });
    });
}

// 保存服战数据
function saveCountryWar(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    loader.addLoad('user');
    gUserInfo.save(function() {loader.onLoad('user');});

    loader.addLoad('countrywar');
    gCountryWar.save(function() {loader.onLoad('countrywar');});

    loader.addLoad('replay');
    gReplay.save(function(succ) {loader.onLoad('replay');});

    loader.onLoad('empty');
}

// 定时保存
function timer() {
    setInterval(function() {
        gCountryWar.tick();
        tickCount++;
        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gCountryWar.save();

            tickCount = 0;
        }
    }, 1000);
}
