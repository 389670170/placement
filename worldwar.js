/*
    WorldWar 跨服服务器
*/

global.fs = require('fs');
global.clone = require('clone');
global.util = require('util');
global.clone = require('clone');
global.common = require('./common.js');
global.Player = require('./logic/player.js').Player;
global.config = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');

var server = require('./server.js');
var logic = require('./worldwar/');

require('./global.js');

global.gDBUser = null;
global.gDBReplay = null;
global.gDBWorld = null;

global.gWorldWar = null;
global.gUserInfo = null;

var tickInterval = 60 * 30;
var tickCount = 0;

server.loadGlobalServerConf('worldwar');
(function main() {
    require('./global.js');
    require('./logger.js');
    setupLog('worldwar');

    server.loadConf('worldwar');
    server.loadDB(function (db) {
        global.gDBUser = db.collection('user');
        global.gDBReplay = db.collection('replay');
        global.gDBWorld = db.collection('world');

        INFO('mongodb connected');

        loadWorldWar(function () {
            server.startWebServer('worldwar', config.WorldWarPort, config.WorldWarHost, function (query, res, resp) {
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

                try {
                    logicHandler(query, res, resp);
                } catch (error) {
                    ERROR('cause by ' + query.uid);
                    ERROR('query : ' + JSON.stringify(query));
                    ERROR(error.stack);
                    LogError(error.stack);
                }
            }, function (callback) {
                var loader = new common.Loader(callback);
                loader.addLoad('empty');

                loader.addLoad('user');
                gUserInfo.save(function () { loader.onLoad('user'); });
                loader.addLoad('worldwar');
                gWorldWar.saveWorldwar(function () { loader.onLoad('worldwar'); });

                loader.onLoad('empty');
            });
        });

        // 全局数据
        // 跨服战各阶段表
        global.gWorldWarProgressStages = [];

        var stages = Object.keys(gConfWorldWarSchedule);
        stages.sort(function (a, b) { return (+b) - (+a); });

        var rankProgressConf = gConfWorldWarSchedule[32];
        gWorldWarProgressStages.push({
            time: rankProgressConf.startWeek * 100 + gConfGlobal.resetHour,
            realopentime: rankProgressConf.startWeek * 100 + rankProgressConf.startHour,
            progress: 'rank',
            round: 0,
        });

        var endTime = rankProgressConf.endWeek * 100 + rankProgressConf.startHour;

        for (var i = 1, len = stages.length; i < len; i++) {
            var progress = stages[i];

            gWorldWarProgressStages.push({
                time: endTime,
                progress: 'sup_' + progress,
                round: 0,
            });

            var progressConf = gConfWorldWarSchedule[progress];
            endTime = progressConf.startWeek * 100 + progressConf.startHour;
            var oriEndTime = endTime;
            DEBUG("oriEndTime = " + oriEndTime);
            for (var j = 1; j <= 2; j++) {
                gWorldWarProgressStages.push({
                    time: endTime,
                    progress: progress,
                    round: j,
                });
                endTime = oriEndTime + j * progressConf.interval / 60;
                DEBUG(" j = " + j + " , endTime = " + endTime + " , interval = " + progressConf.interval);
            }
        }

        gWorldWarProgressStages.push({
            time: endTime,
            progress: 'close',
        });

        DEBUG(" XXXXXXXXXXXXXXXX " + JSON.stringify(gWorldWarProgressStages));
    });
})();
function loadWorldWar(callback) {
    var counter = 2;
    function onLoad() {
        counter -= 1;
        if (counter <= 0) {
            callback && callback();
            timer();
        }
    }

    // 加载跨服玩家数据
    var UserInfo = require('./worldwar/user.js').UserInfo;
    gUserInfo = new UserInfo();
    gUserInfo.init(function (succ) {
        if (!succ) {
            ERROR('cannot load user');
            process.exit(-1);
        }

        INFO('user loaded');
        onLoad();

        // 加载跨服战数据
        var WorldWar = require('./worldwar/worldwar.js').WorldWar;
        global.gWorldWar = new WorldWar();
        gWorldWar.init(function (succ) {
            if (!succ) {
                ERROR("can't load worldwar");
                process.exit(-1);
            }
            INFO('worldwar loaded');
            onLoad();
        });
    });
}

function timer() {
    setInterval(function () {
        gWorldWar.tick();
        tickCount++;
        if (tickCount >= tickInterval) {
            gUserInfo.save();
            gWorldWar.save();
            tickCount = 0;
        }
    }, 1000);
}
