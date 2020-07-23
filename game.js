/*
    Game服务器
    Debug模式: node game.js debugger,zzx,zzx1
    Game模式:  node game.js serverId
*/

global.fs = require('fs');
global.util = require('util');
global.url = require('url');
global.clone = require('clone');
global.common = require('./common.js');
global.config = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');

var server = require('./server.js');
global.logic = require('./logic');
var logic = global.logic;

global.gDBUser = null;
global.gDBAnalysis = null;

global.gPlayers = null;
global.gServerStartTime = common.getTime();
global.gTimezone = (new Date()).getTimezoneOffset() / -60;

// delete this
global.debugging = true;
global.gVerify = 0;
global.gCDKey = 1;

// 欧美，关闭CDKEY
if (config.platform == 'facebook') {
    global.gCDKey = 0;
}

global.gAuthTimes = {};
global.logic_event_mgr = logic["logic_event_mgr"];

// 要统计的项目
var guide_items = {
    'guide_city': 1,    // 出主城
    'guide_dragon': 7,    // 开启火龙
    'guide_help': 13,   // 开启救公主
    'guide_arena': 25,   // 竞技场引导结束
}

server.loadGlobalServerConf('game', function () {
    (function main() {
        require('./global.js');

        // Debug 模式
        var isDebug = false;
        if (process.argv.indexOf('debugger') > 0) {
            isDebug = true;
        }

        var serverId = parseInt(process.argv[process.argv.length - 1]);
        require('./logger.js');
        setupLog('game' + serverId);
        CreateLoggerDB();
        if (isNaN(serverId) || serverId <= 0 || serverId > config.GameCount) {
            ERROR('invalid game serverid');
            process.exit(-1);
        }

        server.loadConf('game');
        server.loadDB(function (db) {
            // 启动Game服务器
            INFO('mongodb connected');
            global.gDBUser = db.collection('user');
            global.gDBAnalysis = db.collection('analysis');
            global.gDBPlat = db.collection('plat');

            // var phpReq = {
            //     uid: 1,
            //     act: 'get_order',
            //     args: {
            //         uid: 1,
            //         ext: 'avgiftbag_4103',
            //         // sid: 13,
            //         sid: config.ServerId,
            //     },
            // };
            // var tPhpResp = {};
            // global.tPayedPlayerDict = {};
            // requestPHP(phpReq, tPhpResp, () => {
            //     // console.log("----- ", (tPhpResp));
            //     if (tPhpResp.code) { return; }
            //     for (var tKey in tPhpResp.data) {
            //         var item = tPhpResp.data[tKey];
            //         var tOpenID = item.openid;
            //         global.tPayedPlayerDict[tOpenID] = global.tPayedPlayerDict[tOpenID] || [];
            //         global.tPayedPlayerDict[tOpenID].push(
            //             {
            //                 id: item.orderid,
            //                 openid: item.openid,
            //             }
            //         );
            //     }

            //     // console.log(global.tPayedPlayerDict);
            // });

            // var cursor = db.collection('pay').find({ $where: "this._id.indexOf('avgiftbag_4103') != -1" }, { "_id": 1, "openid": 1, "uid": 1 });
            // global.tPayedPlayerDict = {};
            // cursor.each(function (err, item) {
            //     if (err || !item) { return; }
            //     global.tPayedPlayerDict[item.uid] = {
            //         id: item._id,
            //         openid: item.openid,
            //         uid: item.uid
            //     }
            // }.bind(this));

            global.gPlayers = new logic['player'].PlayerManager();
            if (isDebug) {
                debugging = true;
                require('./debug.js').Debug();
                return;
            }

            var serverName = 'game' + serverId;
            var port = config.GameListenBegin + serverId - 1;
            server.startWebServer(serverName, port, '0.0.0.0', function (query, res, resp) {
                do {
                    var now = common.getTime();

                    if (config.develop && !query.auth_time && !query.auth_key && !query.stime) {
                        query.auth_time = gAuthTimes[query.uid] || now - 1;
                        query.auth_key = common.sha1(query.uid + '-' + query.auth_time).substring(0, 10);
                        query.stime = common.getTime();
                        query.sig = common.genHack(+query.seq, +query.stime, JSON.parse(res._args));
                    }

                    if (query.mod != 'gm' || query.act == 'refresh_pay') {
                        if (!query.auth_key || !query.auth_time || isNaN(query.auth_time)) {
                            resp.code = 1; resp.desc = 'no auth_key, auth_time'; break;
                        }

                        var authTime = +query.auth_time;
                        var uid = +query.uid;
                        var key = query.auth_key;

                        var curTime = common.getTime();
                        var transTime = Math.abs(curTime - query.stime);
                        if (transTime >= 2) {
                            var clientSendTimeString = common.getDateTimeString(query.stime);
                            var curTimeString = common.getDateTimeString(curTime);
                            ERROR(util.format('[%s]-[%s], delay time = %d %s %s %s', clientSendTimeString, curTimeString, transTime, query.uid, query.mod, query.act));
                        }

                        if (!config.NoHack) {
                            // 服务器重启，以及更改时间, 踢掉所有人
                            if (authTime < gServerStartTime || now < authTime) {
                                resp.code = 2; resp.desc = 'restart or change time'; break;
                            }

                            if (isNaN(query.stime) || !query.sig || (Math.abs(common.getTime() - query.stime) > 60)
                                || !common.verifyHack(+query.seq, +query.stime, query.sig, res._args)) {
                                if (gPlayers.players[uid]) {
                                    gPlayers.kick(uid);
                                    DEBUG(`zcg kick:   ${common.getTime()}`)
                                    DEBUG(query)
                                }
                                resp.data = query;
                                resp.code = 4; resp.desc = 'hack'; break;
                            }

                            if (!query.seq && (query.act != 'login' && query.act != 'refresh_pay' && query.act != 'handshake')) {
                                resp.code = 1; resp.desc = 'no sequence'; break;
                            }
                        }

                        // 每天到点踢掉所有人
                        if (authTime < getResetTime()) {
                            resp.code = 5; resp.desc = 'reset all'; break;
                        }

                        if (query.mod == 'user' && query.act == 'login') {
                            query.args.ip = res._ip;
                            gAuthTimes[uid] = authTime;
                        } else {
                            // 玩家数据必须已经加载，否则视为长时间未操作
                            if (!config.NoHack && !config.develop) {
                                if (!gPlayers.players[uid]) {
                                    DEBUG(`zcg long no opration:   ${common.getTime()}`)
                                    DEBUG(query)
                                    resp.code = 4; resp.desc = 'long no opration'; break;
                                }
                                if (authTime != gAuthTimes[uid]) {
                                    resp.code = 3; resp.desc = 'logined on another device'; break;
                                }
                            }
                        }

                        // 你的账号在别的设备登录了
                        if (!config.NoHack && !common.verifyAuth(uid, key, authTime)) {
                            resp.code = 2; resp.desc = 'verify fail'; break;
                        }
                    } else if (query.act == 'reload') {

                        for (var mod in logic) {
                            var path = require.resolve('./logic/' + mod);
                            delete require.cache[path];
                            logic[mod] = require('./logic/' + mod);
                        }

                        initLogicMod();

                        var oldPlayers = gPlayers.players;
                        gPlayers = new logic['player'].PlayerManager();
                        gPlayers.players = oldPlayers;
                        server.loadGlobalServerConf('game');
                        server.loadConf('game');
                        requestWorld(query, {});
                        global.gc();
                        resp.code = 0; resp.desc = 'reload success';
                        break;
                    } else {
                        query.ip = res._ip;
                    }

                    var logicHandler = null;
                    var module = logic[query.mod];

                    if (module) {
                        logicHandler = module[query.act];
                    } else {
                        DEBUG('module ' + query.mod + ' not exist');
                    }

                    if (!logicHandler) {
                        resp.code = 1;
                        resp.desc = 'act ' + query.act + ' not support in mod ' + query.mod;
                        break;
                    }
                } while (false);

                if (resp.code != 0) {
                    onReqHandled(res, resp);
                    return;
                }
                gPlayers.get(query.uid, function (player) {
                    try {
                        if (query.mod == 'user' && query.act == 'login') {
                            player.seq = query.seq - 1;
                        }
                        handleGameReq(player, query, res, resp);
                    } catch (error) {
                        ERROR('cause by ' + query.uid);
                        ERROR('query : ' + JSON.stringify(query));
                        ERROR(error.stack);
                        requestPHP({ uid: query.uid, act: 'mark_error', args: { sid: config.ServerId, server: 'game' } }, {});
                        LogError(error.stack);

                        // TODO : world报错能反向踢掉game, 踢掉后能先主动断开长连接, 再踢出数据
                        //gPlayers.kick(query.uid);
                    }
                });
            }, function (callback) {

                // 退出处理
                var loader = new common.Loader(callback);
                loader.addLoad('empty');    // 防止没有需要Load的时候不结束
                // delete this
                DEBUG('start stopping : ' + (new Date()) / 1000);

                ///////////////////

                var players = gPlayers.players;
                for (var uid in players) {
                    var player = players[uid];
                    loader.addLoad(1);

                    // 退出前重新计算战斗力
                    player.getFightForce();
                    player.save(true, function () {
                        loader.onLoad(1);
                    });

                }
                loader.onLoad('empty');
                SaveLog(function () {
                    console.log("保存玩家日志..................完成");
                });
            });

            initLogicMod();

            setInterval(function () {                               // 每秒处理一次逻辑循环
                update(common.getTime());
            }, 1000);

            setInterval(function () {
                // 踢掉已经下线的玩家,判断条件: 30分钟没有发出任何操作的用户
                gPlayers.kick();
            }, 1000 * 60 * 30);

            if (!config.Debug) {
                setInterval(function () {
                    // 每隔3个小时执行一次gc
                    if (global.gc) {
                        global.gc();
                    }
                }, 1000 * 3600 * 3);
            }
        });
    })();
});

function update(now) {
    var proiority_list = [];
    for (var mod in logic) {
        if (!logic[mod] || !logic[mod].update) { continue; }
        var update_priority = logic[mod].update_priority || logic[mod].init_priority || logic[mod].priority || Number.MAX_SAFE_INTEGER;
        proiority_list.push({ priority: update_priority, logic: logic[mod] });
    }

    proiority_list = proiority_list.sort((a, b) => { return a.priority - b.priority });
    for (var i = 0; i < proiority_list.length; i++) {
        if (!proiority_list[i] || !proiority_list[i].logic) { continue; }
        if (!proiority_list[i].logic.update) { continue; }
        proiority_list[i].logic.update(now);
    }
}

function initLogicMod() {
    var proiority_list = [];
    for (var mod in logic) {
        if (!logic[mod] || !logic[mod].init) { continue; }
        var init_priority = logic[mod].init_priority || logic[mod].priority || Number.MAX_SAFE_INTEGER;
        proiority_list.push({ priority: init_priority, logic: logic[mod] });
    }

    proiority_list = proiority_list.sort((a, b) => { return a.priority - b.priority });
    for (var i = 0; i < proiority_list.length; i++) {
        if (!proiority_list[i] || !proiority_list[i].logic) { continue; }
        if (!proiority_list[i].logic.init) { continue; }
        proiority_list[i].logic.init();
    }
}

function handleGameReq(player, query, res, resp) {
    var logicHandler = logic[query.mod][query.act];

    if (config.develop) {
        query.seq = player.seq + 1;
        player.lock = false;
    }

    if (!logicHandler) {
        if (query.mod != 'gm' && query.act != 'reload') {
            resp.code = 1;
            resp.desc = '';
        }
        onReqHandled(res, resp);
    } else if (player.saveError) {
        resp.code = 1;
        resp.desc = 'last save error';
        onReqHandled(res, resp);
    } else if (player.lock && query.seq && query.act != 'handshake') {
        resp.code = 6;
        resp.desc = 'lock in ' + player.action.getEvent();
        onReqHandled(res, resp);
    } else if (+query.seq && query.seq != player.seq + 1) {
        if (query.seq == player.seq && query.mod == player.action.mod && query.act == player.action.act) {
            // 网络异常下的重复收到同一个请求
            resp.code = 7;
            resp.desc = 'repeat request';
            resp = player.action.resp;
            onReqHandled(res, resp);
        } else {
            resp.code = 6;
            resp.desc = 'invalid sequence';
            onReqHandled(res, resp);
        }
    } else {
        if (query.mod != 'user' || query.act != 'handshake') {
            player.lastActive = common.getTime();
            player.user.mark.active_time = player.lastActive;
            player.markDirty('mark.active_time');
        }

        player.lock = true;
        player.seq = +query.seq ? +query.seq : (query.act == 'login' ? +query.seq : player.seq);
        player.action.mod = query.mod;
        player.action.act = query.act;
        player.action.args = query.args;

        // 加打印
        var occur_time = (new Date()).getTime()

        logicHandler(player, query, resp, function () {
            player.lock = false;

            if (resp.code == 0) {
                // 更新新手引导步骤
                if ('guide' in query && player.user.mark.guide != query.guide) {
                    player.user.mark.guide = query.guide;
                    player.markDirty('mark.guide');

                    // 处理运营统计
                    var curTime = common.getTime();
                    var progress = player.user.battle.progress;
                    var online_stat = player.user.online_stat;

                    for (var k in guide_items) {
                        if (!online_stat[k]) {
                            if (progress > guide_items[k]) {
                                online_stat[k] = curTime;
                                player.markDirty(util.format('online_stat.%s', k));
                                DeviceLogCollect(player, k, {}, false);
                            }
                        }
                    }
                }

                if (player.hasTip) {
                    resp.data.tips = player.user.tips;
                    player.user.tips = {};
                    player.markDirty('tips');
                }

                // 保存更改数据
                player.save();
            }

            player.action.resp = resp;
            onReqHandled(res, resp);
        });
    }
};
