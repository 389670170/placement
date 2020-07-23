/**
 * 全局服务器（处理整个游戏的全局数据，如全服排行榜）.
 */

global.fs = require('fs');
global.clone = require('clone');
global.util = require('util');
global.clone = require('clone');
global.common = require('./common.js');
global.http = require('http');
global.Player = require('./logic/player.js').Player;
global.config = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');

var server = require('./server.js');
var logic = require('./global_server/');
var csv = require('./csv.js');

require('./global.js');

global.gCache = null;
global.gDBWorld = null;

global.gServer = null;
global.gLegionWarTopList = null;
global.gActivity = null;
global.gFightRank = null;
global.gTick = null;

var tickInterval = 60 * 30;

require('./global.js');
require('./logger.js');
setupLog('global_server');

server.loadGlobalServerConf('global');
(function main() {
    server.loadConf('global');
    server.loadCache(function (cache) {
        global.gCache = cache;
        INFO('redis connected');
    });

    server.loadDB(function (db) {
        global.gDBWorld = db.collection('world');

        INFO('mongodb connected');

        loadGlobalServer(function () {
            server.startWebServer('global_server', config.GlobalServerPort, config.GlobalServerHost, function (query, res, resp) {
                var logicHandler = null;
                var module = logic[query.mod];

                if (module) {
                    logicHandler = module[query.act];
                }

                if (!logicHandler) {
                    if (query.mod == 'gm' && query.act == 'settime') {
                        clearInterval(gTick);
                        tickFunc();
                        setInterval(tickFunc, tickInterval * 1000);
                    }
                    else {
                        resp.code = 1;
                        resp.desc = 'act ' + query.act + ' not support in mod ' + query.mod;
                    }

                    onReqHandled(res, resp);
                    return;

                }

                logicHandler(query, res, resp);
            }, function (callback) {
                saveGlobalServer(callback);
            });

            tickFunc(); // 启动前立即检查一次状态
            gTick = setInterval(tickFunc, tickInterval * 1000);
        });
    });
})();

function tickFunc() {
    // 每周重置活动
    var now = common.getTime();
    var todayTime = getResetTime();
    var nextDayTime = todayTime + 86400;
    if (gActivity.time < todayTime || (gActivity.time < nextDayTime && now + tickInterval > nextDayTime)) {
        var resetWeek = false;
        var thisWeekTime = getWeekResetTime();
        var nextWeekTime = thisWeekTime + 86400 * 7;
        if (gActivity.weekTime < thisWeekTime || (gActivity.weekTime < nextWeekTime && now + tickInterval > nextWeekTime)) {
            resetWeek = true;
        }

        var timeout = gActivity.time < todayTime ? 0 : nextDayTime - now;
        setTimeout(function () {
            gActivity.resetByDay();

            if (resetWeek) {
                gActivity.resetByWeek();
            }
        }, timeout * 1000);
    }

    gActivity.fixLuckyWheelRank();
    gActivity.fixPromoteWheelRank();
}

/**
 * 加载全局服务器
 * @param callback
 */
function loadGlobalServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 加载全服列表
    loader.addLoad('Server');
    var Server = require('./global_server/server.js').Server;
    gServer = new Server();
    gServer.init(function (succ) {
        if (!succ) {
            ERROR("can't load Server");
            process.exit(-1);
        }
        INFO('Server loaded');
        loader.onLoad('Server');
    });

    // 加载军团段位排行榜
    loader.addLoad('LegionWarTopList');
    var LegionWarTopList = require('./global_server/legionwar_toplist').LegionWarTopList;
    gLegionWarTopList = new LegionWarTopList();
    gLegionWarTopList.init(function (succ) {
        if (!succ) {
            ERROR("can't load LegionWarTopList");
            process.exit(-1);
        }
        INFO('LegionWarTopList loaded');
        loader.onLoad('LegionWarTopList');
    });

    // 加载全服活动
    loader.addLoad('Activity');
    var Activity = require('./global_server/activity').Activity;
    gActivity = new Activity();
    gActivity.init(function (succ) {
        if (!succ) {
            ERROR("can't load Activity");
            process.exit(-1);
        }
        INFO('Activity loaded');
        loader.onLoad('Activity');
    });

    loader.onLoad('empty');

    // 加载全服战力最大数据
    loader.addLoad('FightRank');
    var FightRank = require('./global_server/fight_rank.js').FightRank;
    var tFightRank = new FightRank();
    gFightRank = tFightRank;
    tFightRank.init(function (succ) {
        if (!succ) {
            ERROR("can't load FightRank");
            process.exit(-1);
        }
        INFO('FightRank loaded');
        loader.onLoad('FightRank');
    });

    loader.onLoad('empty');
}

/**
 * 保存全局服务器
 * @param callback
 */
function saveGlobalServer(callback) {
    var loader = new common.Loader(callback);
    loader.addLoad('empty');

    // 保存军团段位排行榜数据
    loader.addLoad('Server');
    gServer.save(function (succ) {
        loader.onLoad('Server');
    });

    // 保存军团段位排行榜数据
    loader.addLoad('LegionWarTopList');
    gLegionWarTopList.save(function (succ) {
        loader.onLoad('LegionWarTopList');
    });

    // 保存全服活动数据
    loader.addLoad('Activity');
    gActivity.save(function (succ) {
        loader.onLoad('Activity');
    });

    // 保存全服战力最大数据
    loader.addLoad('FightRank');
    gFightRank.save(function (succ) {
        loader.onLoad('FightRank');
    });

    loader.onLoad('empty');
}

global.requestServer = function (sid, query, callback) {
    var resp = {};
    var options = {
        host: gServer.servers[sid][0],
        port: gServer.servers[sid][1],
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var worldResp = null;
            try {
                worldResp = JSON.parse(data);
            } catch (error) {
                ERROR('' + sid + ' world resp ' + data);
                delete gServer.servers[sid];
                worldResp = null;
            }

            if (!worldResp) {
                resp.code = 1;
                resp.desc = 'request ' + sid + ' world error';
            } else {
                resp.code = worldResp.code;
                resp.desc = worldResp.desc;
                resp.data = worldResp.data;
            }

            callback && callback(sid, resp);
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request ' + sid + ' world error';
        console.log(err);
        callback && callback(sid);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
}
