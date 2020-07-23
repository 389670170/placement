/**
 * 日志服务器
 */

global.fs     = require('fs');
global.clone    = require('clone');
global.util     = require('util');
global.clone    = require('clone');
global.common   = require('./common.js');
global.config   = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
global.async    = require('async');

var LogType = require('./logserver/enum.js').LogType;
var server  = require('./server.js');
var logic   = require('./logserver/');

require('./global.js');

global.gCache = null;

global.gDBWorld = null;
global.gLogManager = null;

var tickInterval = 60 * 30;
var tickCount = 0;

require('./global.js');
require('./logger.js');
setupLog('logserver');
server.loadGlobalServerConf('logserver');
(function main() {
    server.loadCache(function(cache){
        global.gCache = cache;
        INFO('redis connected');
    });

    server.loadConf('logserver');
    server.loadLogDB(function(db){
        global.gDBWorld = db.collection('world');
        initDB(db);

        INFO('mongodb connected');

        loadLogServer(function() {
            server.startWebServer('logserver', config.LogServerPort, config.LogServerHost , function(query, res, resp) {
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
                saveLogServer(function () {
                    LOG('logserver saved');
                    callback();
                });
            });

            setInterval(function() {
                gLogManager.update();
            }, 10 * 1000);
        });
    });
})();

function initDB(db) {
    global.gDBArray = [];
    // 各种货币
    global.gDBArray[LogType.LOG_CURRENCY_PRODUCE] = db.collection('currency_produce');
    global.gDBArray[LogType.LOG_CURRENCY_CONSUME] = db.collection('currency_consume');
    // 道具材料
    global.gDBArray[LogType.LOG_MATERIAL_PRODUCE] = db.collection('material_produce');
    global.gDBArray[LogType.LOG_MATERIAL_CONSUME] = db.collection('material_consume');
    // 装备
    global.gDBArray[LogType.LOG_EQUIP_PRODUCE] = db.collection('equip_produce');
    global.gDBArray[LogType.LOG_EQUIP_CONSUME] = db.collection('equip_consume');
    // 卡牌
    global.gDBArray[LogType.LOG_CARD_PRODUCE] = db.collection('card_produce');
    global.gDBArray[LogType.LOG_CARD_CONSUME] = db.collection('card_consume');
    // 龙晶
    global.gDBArray[LogType.LOG_DRAGON_PRODUCE] = db.collection('dragon_produce');
    global.gDBArray[LogType.LOG_DRAGON_CONSUME] = db.collection('dragon_consume');
    // 卡牌碎片
    global.gDBArray[LogType.LOG_CARD_FRAGMENT_PRODUCE] = db.collection('card_fragment_produce');
    global.gDBArray[LogType.LOG_CARD_FRAGMENT_CONSUME] = db.collection('card_fragment_consume');
    // 装备碎片
    global.gDBArray[LogType.LOG_EQUIP_FRAGMENT_PRODUCE] = db.collection('equip_fragment_produce');
    global.gDBArray[LogType.LOG_EQUIP_FRAGMENT_CONSUME] = db.collection('equip_fragment_consume');
    // 宝石
    global.gDBArray[LogType.LOG_GEM_PRODUCE] = db.collection('gem_produce');
    global.gDBArray[LogType.LOG_GEM_CONSUME] = db.collection('gem_consume');
    // 小兵装备
    global.gDBArray[LogType.LOG_SOLDIER_EQUIP_PRODUCE] = db.collection('soldier_equip_produce');
    global.gDBArray[LogType.LOG_SOLDIER_EQUIP_CONSUME] = db.collection('soldier_equip_consume');
    // 符文
    global.gDBArray[LogType.LOG_RUNE_PRODUCE] = db.collection('rune_produce');
    global.gDBArray[LogType.LOG_RUNE_CONSUME] = db.collection('rune_consume');
}

// 加载日志服务器
function loadLogServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 加载日志模块
    loader.addLoad('logserver');
    var LogManager = require('./logserver/logmanager').LogManager;
    global.gLogManager = new LogManager();
    gLogManager.init(function(succ){
        if (!succ) {
            ERROR("can't load LogManager");
            process.exit(-1);
        }

        INFO('LogManager loaded');
        loader.onLoad('logserver');
    });

    loader.onLoad('empty');
}

// 保存日志服务器
function saveLogServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 保存日志模块
    loader.addLoad('logserver');
    gLogManager.save(function(succ) {
        loader.onLoad('logserver');
    });

    loader.onLoad('empty');
}
