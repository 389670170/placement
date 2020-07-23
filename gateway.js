/*
    游戏网关: 新玩家注册,登录(获取密钥,World/Game服务器地址),登出
 */
var http = require('http');
var fs = require('fs');
var url = require('url');
var util = require('util');
var clone = require('clone');
var exec = require('child_process').exec;

var server = require('./server.js');
var common = require('./common.js');
var config;//  = require(fs.existsSync('../config.js') ? '../config.js' : './config.js');
if (process.argv[2]) {
    config = require(process.argv[2]);
}
else {
    config = require(fs.existsSync('../config.js') ? '../config.js' : './config.js');
}

global.gServerName = 'gateway';
global.gDBPlat = null;
global.gDBUser = null;
global.gUsers = {};     // 所有用户openid => uid 映射关系
global.gOpenIds = {};   // 所有用户uid => openid 映射关系
global.gBlocks = {};    // 所有禁止登陆openid

var GameServerIds = Object.getOwnPropertyNames(config.Games);

require('./logger.js');
setupLog('gateway');

server.loadGlobalServerConf('gateway', function () {
    (function main() {
        require('./global.js');
        server.loadDB(function (db) {
            INFO('mongodb connected');

            global.gDBPlat = db.collection('plat');
            global.gDBUser = db.collection('user');
            global.gDBPay = db.collection('pay');

            var cursor = gDBPlat.find();
            cursor.each(function (err, item) {
                if (err) {
                    ERROR(err);
                    process.exit(-1);
                }

                if (item) {
                    if (item._id == '_userid') {
                        return;
                    }

                    gUsers[item._id] = item.uid;
                    if (item.block) {
                        gBlocks[item._id] = 1;
                    }

                    for (var i = 0, len = item.uid.length; i < len; i++) {
                        gOpenIds[item._id] = item.uid[i];
                    }
                }

                if (cursor.isClosed()) {
                    startWebServer();
                }
            });
        }, 2);
    })();
});

var datFileRegex = /^\/(conf\/\w+.dat)\??/;
function startWebServer() {
    // 创建web服务器
    http.createServer(function (req, res) {
        if (req.method == 'POST') {
            req.connection.destroy();
            return;
        }

        var reqObj = url.parse(req.url, true);
        var query = reqObj.query || {};
        var path = reqObj.pathname;

        req.on('end', function () {
            if (path.endWith('/crossdomain.xml')) {
                res.writeHead(200, common.defaultHeaders);
                res.end(common.defaultCrossDomain);
                return;
            } else if (path.endWith('.html') || path.endWith('.js') || path.endWith('.ico') || path.endWith('.png') || path.endWith('.css')) {
                handleStaticFile('web/' + path.substr(path.indexOf('/')), res);
                return;
            } else if (path.beginWith('/log/')) {
                handleStaticFile(path.substr(1), res);
                return;
            } else if (path.beginWith('/global/')) {
                httpGet(gConfGlobalServer.globalHost, gConfGlobalServer.globalPort, path.substr(7), function (data) {
                    res.writeHead(200, common.defaultHeaders);
                    res.end(data);
                });
                return;
            } else if (path.beginWith('/legionwar/')) {
                httpGet(gConfGlobalServer.legionWarHost, gConfGlobalServer.legionWarPort, path.substr(10), function (data) {
                    res.writeHead(200, common.defaultHeaders);
                    res.end(data);
                });
                return;
            } else if (path.beginWith('/worldwar/')) {
                httpGet(gConfGlobalServer.worldWarHost, gConfGlobalServer.worldWarPort, path.substr(9), function (data) {
                    res.writeHead(200, common.defaultHeaders);
                    res.end(data);
                });
                return;
            } else if (path.beginWith('/territorywar/')) {
                httpGet(gConfGlobalServer.territoryWarHost, gConfGlobalServer.territoryWarHost, path.substr(13), function (data) {
                    res.writeHead(200, common.defaultHeaders);
                    res.end(data);
                });
                return;
            } else if (path.endWith('.dat')) {
                var segs = path.split('/');
                handleStaticFile((config.ConfDir ? config.ConfDir : 'conf') + '/' + segs[segs.length - 1], res);
                return;
            } else if (path.endWith('/conf.zip')) {
                handleStaticFile('conf.zip', res);
                return;
            } else if (path.endWith('/update_conf') && config.UpdateConf) {
                handleUpdateConf(res);
                return;
            }

            query.ip = getClientIp(req);
            handleReq(query, res);
            if (query.act == 'login') {
                LOG(util.format('LOGIN: %s %s', query.openid, req.connection.remoteAddress));
            }
        });

        req.resume();

    }).listen(config.GatewayListen);

    var pidFile = 'gateway.pid';

    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);
    process.on('SIGHUP', exit);

    process.on('uncaughtException', function (err) {
        ERROR(err.stack);
        LogError(err.stack);

        if (err.code == 'EADDRINUSE') {
            exit();
        }
    });

    function exit() {
        INFO('gateway shutdown');
        fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
        process.exit();
    }

    INFO('gateway start');
    fs.writeFileSync(pidFile, process.pid, 'utf8');
}

function handleReq(query, res) {
    var code = 1;
    var desc = '';
    if (!query.act) {
        desc = 'no act';
    } else if (!logic[query.act]) {
        desc = 'act ' + query.act + ' not support';
    } else {
        code = 0;
    }

    var resp = {
        'code': code,
        'desc': desc,
        'data': {}
    };

    if (resp.code != 0) {
        onReqHandled(res, resp);
    } else {
        logic[query.act](query, res, resp);
    }
}

// -------------------处理静态文件访问---------------------------------

var staticFilePool = {};
function handleStaticFile(file, res) {
    if (file in staticFilePool) {
        sendStaticFile(file, staticFilePool[file], res);
    } else {
        fs.exists(file, function (exists) {
            if (exists) {
                fs.readFile(file, function (err, data) {
                    //staticFilePool[file] = data;
                    sendStaticFile(file, data, res);
                    delete staticFilePool[file];
                });
            } else {
                res.writeHead(404, common.defaultHeaders);
                res.end();
            }
        });
    }
}

function sendStaticFile(file, content, res) {
    if (file.endWith('html') || file.endWith('htm')) {
        res.writeHead(200, common.htmlHeaders);
    }
    res.end(content);
}

function handleUpdateConf(res) {
    res.writeHead(200, common.htmlHeaders);
    res.end('成功');

    var pwd = process.cwd();
    exec(util.format("%s/replace_conf %s %s", process.cwd(), process.cwd(), config.UpdateConf));
}

// --------------------请求逻辑处理-----------------------------------

function onReqHandled(res, data) {
    if (data.code) {
        LOG(data.desc);
    }
    res.end(JSON.stringify(data));
}

function addNewUserToPHP(req, res, resp, uid, openid) {
    var openid = req.openid;
    var opentime = req.opentime;

    // 通知php添加了新用户, 用于下次登录时给出默认服
    var phpReq = {
        uid: uid,
        act: 'new_user',
        client_ip: req.ip,
        args: {
            openid: openid,
            opentime: opentime,
            openkey: req.openkey,
        },
    };

    var phpResp = {
        code: 0,
        desc: '',
    };
    requestPHP(phpReq, phpResp, function () {
        if (phpResp.code == 0) {
            gUsers[openid] = [uid];
            onLogIn(req, res, resp, uid, openid);
        } else {
            gUsers[openid] = [uid];
            onLogIn(req, res, resp, uid, openid);
            /* fish
            resp.code = 1; resp.desc = phpResp.desc;
            onReqHandled(res, resp);
            footprint(openid, uid, 0, 'gateway_ERROR_requestPHPError');
            */
        }
    });
}

var logic = {};
// 登录,如果是新用户完成注册
logic.login = function (req, res, resp) {
    var openid = req.openid;
    if (!openid) {
        openid = 0;
    }

    var uid = req.uid;
    if (!uid) {
        uid = 0;
    }

    //ERROR('GATEWAY LOGIN:'+uid);
    footprint(openid, uid, '', 'gateway_receiveLogin');
    do {
        if (!req.openid || !req.openkey) {
            resp.code = 1;
            resp.desc = 'no openid or openkey';
            footprint(openid, uid, 0, 'gateway_ERROR_NoOpenIdOrOpenKey');
            break;
        }

        var opentime = req.opentime;
        if (!config.NoHack && !common.verifyGatewayAuth(openid, opentime, req.openkey)) {
            resp.code = 8;
            resp.desc = 'openkey verify fail';
            footprint(openid, uid, 0, 'gateway_ERROR_openkeyVerifyFailed');
            break;
        }

        if (gBlocks[openid]) {
            resp.code = 9;
            resp.desc = 'blocked user';
            footprint(openid, uid, 0, 'gateway_ERROR_blockUser');
            break;
        }
    } while (false);

    if (resp.code != 0) {
        onReqHandled(res, resp);
        return;
    }

    var existUid = gUsers[openid];
    if (existUid) {
        if (req.uid) {
            // check
            if (existUid.indexOf(+req.uid) < 0) {
                resp.code = 1; resp.desc = "uid error";
                onReqHandled(res, resp);
                footprint(openid, uid, 0, 'gateway_ERROR_uidError');
                return;
            }
            onLogIn(req, res, resp, +req.uid, openid);
        } else {
            req.uid = existUid[0];
            addNewUserToPHP(req, res, resp, req.uid);
            return;
        }
    } else {
        // 注册新用户
        ERROR('GATEWAY LOGIN:new user');
        gDBPlat.findOneAndUpdate({ _id: '_userid' }, { $inc: { 'ai': 1 } }, { 'returnOriginal': false }, function (err, result) {
            if (!err) {
                var newUID = result.value.ai;
                gDBPlat.insertOne({ _id: openid, uid: [newUID], time: common.getTime() }, function (err, result) {
                    if (err) {
                        resp.code = 2;
                        resp.desc = 'on create';
                        onReqHandled(res, resp);
                        footprint(openid, uid, 0, 'gateway_ERROR_createUserError');
                    } else {
                        gUsers[openid] = [newUID];
                        // 通知php添加了新用户, 用于下次登录时给出默认服
                        addNewUserToPHP(req, res, resp, newUID, openid);
                    };
                });
            } else {
                resp.code = 3;
                resp.desc = 'generate id';
                onReqHandled(res, resp);
                footprint(openid, uid, 0, 'gateway_ERROR_generateIdError');
            }
        });
    }
};

// GM管理接口
logic.gm = function (req, res, resp) {
    var openid = req.openid;
    var existUids = gUsers[openid];
    if (req.method == 'get_server_time') {
        res.writeHead(200, common.defaultHeaders);
        res.end(JSON.stringify({
            code: 0,
            desc: '',
            data: {
                time: common.getTime(),
            }
        }));
        return;
    }


    if (req.method == 'exchange_account') {
        var old_openid = req.old_openid;
        var add_uid = req.add_uid;
        var new_openid = req.new_openid;
        var msg_str = '添加成功';
        var existUid = gUsers[old_openid];
        var new_existUid = gUsers[new_openid];
        if (!new_existUid) {
            if (existUid && add_uid && add_uid == existUid) {
                gDBPlat.deleteOne({ _id: old_openid });
                gUsers[old_openid] = null;
                gDBPlat.insertOne({ _id: new_openid, uid: [add_uid], time: common.getTime() }, function (err, result) {
                    if (err) {
                        resp.code = 2;
                        resp.desc = 'on create';
                        onHandled(res, resp);
                    } else {
                        gUsers[new_openid] = [add_uid];
                        // 通知php添加了新用户, 用于下次登录时给出默认服
                        addNewUserToPHP(req, res, resp, existUid, new_openid);
                    };
                });


            } else {
                msg_str = '没有添加成功 ， 请检查老帐号下是否有角色 或者角色ID是否正确!';
            }
        } else {
            msg_str = '新账号在当前服有角色，添加失败！';
        }

        res.writeHead(200, common.defaultHeaders);
        res.end(JSON.stringify({
            code: 0,
            desc: '',
            data: {
                msg: msg_str,
            }
        }));
        return;
    }


    if (config.NoHack && req.method == 'set_server_time') {
        res.writeHead(200, common.defaultHeaders);

        var timeset = req.time;
        var timenow = common.getTime();

        var file = process.env.HOME + '/.faketimerc';

        var timeadd = 0;
        var rawData = fs.readFileSync(file, 'utf8');
        var timeadd = +rawData || 0;

        var timediff = timeset - timenow + timeadd;
        var timestr = '+';
        if (timediff > 0) {
            timestr += timediff;
        } else {
            timestr = timediff;
        }

        fs.writeFileSync(file, timestr, 'utf8');

        var worldReq = globalReq = {
            uid: '10000',
            mod: 'gm',
            act: 'settime',
            args: {},
        };
        requestWorldSimple(worldReq, {});
        requestGlobal(globalReq, {});

        res.end(JSON.stringify({
            code: 0,
            desc: '',
            data: {
                time: timeset,
            }
        }));
        return;
    }

    if (req.uid != 10000 && !existUids) {
        res.writeHead(200, common.defaultHeaders);
        res.end('invalid openid or operation');
        return;
    }

    if (existUids && existUids.length > 1 && !req.uid) {
        res.writeHead(200, common.defaultHeaders);
        res.end(JSON.stringify({
            uids: existUids,
        }));
        return;
    }

    // GM mod=gm,act=gm,method
    // 封号
    if (req.method == 'block') {
        gBlocks[openid] = 1;
        gDBPlat.update({ _id: openid }, { $set: { 'block': 1 } }, function (err, doc) {
            res.writeHead(200, common.defaultHeaders);
            res.end(err ? '失败' : '成功');
        });
        return;
    }

    // 解封
    if (req.method == 'unblock') {
        if (gBlocks[openid]) {
            delete gBlocks[openid];
            gDBPlat.update({ _id: openid }, { $unset: { 'block': 1 } }, function (err, doc) {
                res.writeHead(200, common.defaultHeaders);
                res.end(err ? '失败' : '成功');
            });
        } else {
            res.writeHead(200, common.defaultHeaders);
            res.end('成功');
        }
        return;
    }

    // 热更代码
    if (req.method == 'reload') {
        for (var sid in config.Games) {
            var server = config.Games[sid];
            var path = "/" + '?mod=gm&act=reload&uid=10000&args=' + encodeURI(JSON.stringify({}));
            httpGet(server[0], server[1], path, function (data) {
                res.writeHead(200, common.defaultHeaders);
                res.end(data);
            }, null, true);
        }
        return;
    }

    // 战斗校验, CDKey
    req.client_ip = req.ip;
    if (req.method == 'open_verify' || req.method == 'close_verify' || req.method == 'open_cdkey' || req.method == 'close_cdkey') {
        for (var sid in config.Games) {
            var server = config.Games[sid];
            var path = "/" + '?mod=gm&act=gm&uid=10000&args=' + encodeURI(JSON.stringify(req));
            httpGet(server[0], server[1], path, function (data) {
                res.writeHead(200, common.defaultHeaders);
                res.end(data);
            }, null, true);
        }
        return;
    }

    // 操作玩家数据的GM指令
    var act = 'gm';
    if (req.method == 'pay') {
        act = 'pay';
    }
    else if (req.method == 'pay_direct_access') {
        act = req.method;
    }

    // 操作玩家数据的GM指令
    var uid = req.uid && req.uid != 'null' ? req.uid : existUids[0];
    var server = getGameServer(uid, true);
    var path = util.format('/?mod=gm&act=%s&uid=%d&args=%s', act, uid, encodeURI(JSON.stringify(req)));
    httpGet(server[0], server[1], path, function (data) {
        if (req.download) {
            var header = clone(common.downloadHeaders);
            header['Content-Disposition'] = 'attachment;filename=' + req.download;
            res.writeHead(200, header);
        } else {
            res.writeHead(200, common.defaultHeaders);
        }
        res.end(data);
        LOG(util.format('GM: %d %s %j', uid, act, req));
    }, null, true);
};

logic.pay = function (req, res) {
    var RESPONSE = (function () {
        var private = {
            OK: { code: 0, desc: 'ok' },
            INVALID: { code: 1, desc: 'invalid request' },
            VARIFY_FAILED: { code: 2, desc: 'varify failed' },
            DOUBLE_PAY: { code: 3, desc: 'double pay' },
            USER_NOT_EXIST: { code: 4, desc: 'user not exist' },
            INTERNAL_ERROR: { code: 5, desc: 'internal error' },
            PAY_ERROR: { code: 6, desc: 'pay error' },
        };

        return {
            get: function (name) { return private[name]; }
        };
    })();

    var startIndex = req.ip.lastIndexOf(':')
    var client_ip = req.ip;
    if (startIndex > 0) {
        client_ip = req.ip.substr(startIndex + 1, req.ip.length);
    }
    if (!common.isLocalAddr(client_ip)) {
        DEBUG('not local address, ip = ' + client_ip);
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    if (!req.openid || !req.billno || !req.amt || !req.charge_id) {

        DEBUG('param invalid');
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    var openid = req.openid;
    var billno = req.billno;
    var cash = req.cash;
    var amt = req.amt;
    var charge_id = req.charge_id;
    var gift_code = req.gift_code;

    var existUids = gUsers[openid];
    if (!existUids) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        DEBUG('existUids is null');
        return;
    }

    var existUid = 0;
    var sid = +req.billno.split('-')[0];
    for (var i = 0, len = existUids.length; i < len; i++) {
        if (Math.floor(existUids[i] / 1000000) == sid) {
            existUid = existUids[i];
        }
    }

    if (!existUid) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        DEBUG('existUid is null, openid = ' + openid);
        return;
    }

    // 新建支付记录, 支付state 0:完成 1:新支付 2:confirm失败
    var record = {
        _id: billno,
        openid: openid,
        uid: existUid,
        cash: cash,
        time: (new Date()).format('yyyy-MM-dd hh:mm:ss'),
        ts: Date.getStamp(),
        amt: req.amt,
        state: 1
    };

    gDBPay.find({ _id: billno }, { _id: 1 }).limit(1).next(function (err, doc1) {
        if (doc1) {
            res.writeHead(200, common.htmlHeaders);
            res.end(util.format('%j', RESPONSE.get('DOUBLE_PAY')));
            DEBUG('double pay billno = ' + billno);
            return;
        }

        gDBPay.insertOne(record, function (err, result) {
            if (err || result.length < 1) {
                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', RESPONSE.get('INTERNAL_ERROR')));
                DEBUG('insert pay record error ');
                return;
            }

            // 请求game数据
            var server = getGameServer(existUid, true);
            var path = util.format('/?mod=gm&act=pay&uid=%d&args=%j', existUid, {
                key: config.GMAuth,
                cash: cash,
                amt: req.amt,
                charge_id: req.charge_id,
                gift_code: gift_code,
                order: billno,
            });

            httpGet(server[0], server[1], path, function (data) {
                var resp = RESPONSE.get('OK');

                var state = 0;
                if (!data || data.code != 0) {
                    state = 2;
                    resp = RESPONSE.get('PAY_ERROR');
                }

                gDBPay.findOneAndUpdate({ _id: billno }, { $set: { 'state': state } });

                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', resp));
            }, true, true);
        });
    });
};

logic.pay_direct_access = function (req, res) {
    var RESPONSE = (function () {
        var private = {
            OK: { code: 0, desc: 'ok' },
            INVALID: { code: 1, desc: 'invalid request' },
            VARIFY_FAILED: { code: 2, desc: 'varify failed' },
            DOUBLE_PAY: { code: 3, desc: 'double pay' },
            USER_NOT_EXIST: { code: 4, desc: 'user not exist' },
            INTERNAL_ERROR: { code: 5, desc: 'internal error' },
            PAY_ERROR: { code: 6, desc: 'pay error' },
        };

        return {
            get: function (name) { return private[name]; }
        };
    })();

    var startIndex = req.ip.lastIndexOf(':')
    var client_ip = req.ip;
    if (startIndex > 0) {
        client_ip = req.ip.substr(startIndex + 1, req.ip.length);
    }
    if (!common.isLocalAddr(client_ip)) {
        DEBUG('not local address, ip = ' + client_ip);
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    req.billno = req.order_id;
    req.amt = (req.total_fee - 0) || 0;
    req.gift_code = req.pay_type;
    if (!req.openid || !req.billno || !req.amt) {
        DEBUG('param invalid');
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    var openid = req.openid;
    var billno = req.billno;
    var cash = req.cash;
    var amt = req.amt;
    var charge_id = req.charge_id;
    var gift_code = req.gift_code;

    var existUids = gUsers[openid];
    if (!existUids) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        DEBUG('existUids is null');
        return;
    }

    var existUid = 0;
    var sid = +req.billno.split('-')[0];
    for (var i = 0, len = existUids.length; i < len; i++) {
        if (Math.floor(existUids[i] / 1000000) == sid) {
            existUid = existUids[i];
        }
    }

    if (!existUid) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        DEBUG('existUid is null, openid = ' + openid);
        return;
    }

    // 新建支付记录, 支付state 0:完成 1:新支付 2:confirm失败
    var record = {
        _id: billno,
        openid: openid,
        uid: existUid,
        cash: cash || 0,
        time: (new Date()).format('yyyy-MM-dd hh:mm:ss'),
        ts: Date.getStamp(),
        amt: req.amt,
        state: 1
    };

    gDBPay.find({ _id: billno }, { _id: 1 }).limit(1).next(function (err, doc1) {
        if (doc1) {
            res.writeHead(200, common.htmlHeaders);
            res.end(util.format('%j', RESPONSE.get('DOUBLE_PAY')));
            DEBUG('double pay billno = ' + billno);
            return;
        }

        gDBPay.insertOne(record, function (err, result) {
            if (err || result.length < 1) {
                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', RESPONSE.get('INTERNAL_ERROR')));
                DEBUG('insert pay record error ');
                return;
            }

            // 请求game数据
            var server = getGameServer(existUid, true);
            var path = util.format('/?mod=gm&act=pay_direct_access&uid=%d&args=%j', existUid, {
                key: config.GMAuth,
                openid: req.openid,
                order_id: req.order_id,
                game_coin: req.game_coin,
                bonus_game_coin: req.bonus_game_coin,
                pay_time: req.pay_time,
                total_fee: req.total_fee,
                currency: req.currency,
                order_type: req.order_type,
                is_sandbox: req.is_sandbox,
            });

            httpGet(server[0], server[1], path, function (data) {
                var resp = RESPONSE.get('OK');

                var state = 0;
                if (!data || data.code != 0) {
                    state = 2;
                    resp = RESPONSE.get('PAY_ERROR');
                }

                gDBPay.findOneAndUpdate({ _id: billno }, { $set: { 'state': state } });

                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', resp));
            }, true, true);
        });
    });
};


logic.gift_list = function (req, res) {
    var RESPONSE = (function () {
        var private = {
            OK: { code: 0, desc: 'ok' },
            INVALID: { code: 1, desc: 'invalid request' },
            VARIFY_FAILED: { code: 2, desc: 'varify failed' },
            DOUBLE_PAY: { code: 3, desc: 'double pay' },
            USER_NOT_EXIST: { code: 4, desc: 'user not exist' },
            INTERNAL_ERROR: { code: 5, desc: 'internal error' },
            PAY_ERROR: { code: 6, desc: 'pay error' },
        };

        return {
            get: function (name) { return private[name]; }
        };
    })();

    var startIndex = req.ip.lastIndexOf(':')
    var client_ip = req.ip;
    if (startIndex > 0) {
        client_ip = req.ip.substr(startIndex + 1, req.ip.length);
    }
    if (!common.isLocalAddr(client_ip)) {
        DEBUG('not local address, ip = ' + client_ip);
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    var openid = req.openid;
    var existUids = gUsers[openid];
    if (!existUids) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        return;
    }

    var found = false;
    var uid = +req.uid;
    for (var i = 0, len = existUids.length; i < len; i++) {
        if (existUids[i] == uid) {
            found = true;
        }
    }
    if (!found) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        return;
    }

    // 请求game数据
    var server = getGameServer(uid, true);
    var path = util.format('/?mod=gm&act=gift_list&uid=%d&args=%j', uid, {});

    httpGet(server[0], server[1], path, function (data) {
        var resp = RESPONSE.get('OK');

        var state = 0;
        if (!data || data.code != 0) {
            state = 2;
            resp = RESPONSE.get('INTERNAL_ERROR');
        }

        resp.list = data.data.list;
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', resp));
    }, true, true);
};

logic.third_pay = function (req, res) {
    var RESPONSE = (function () {
        var private = {
            OK: { code: 0, desc: 'ok' },
            INVALID: { code: 1, desc: 'invalid request' },
            VARIFY_FAILED: { code: 2, desc: 'varify failed' },
            DOUBLE_PAY: { code: 3, desc: 'double pay' },
            USER_NOT_EXIST: { code: 4, desc: 'user not exist' },
            INTERNAL_ERROR: { code: 5, desc: 'internal error' },
            PAY_ERROR: { code: 6, desc: 'pay error' },
        };

        return {
            get: function (name) { return private[name]; }
        };
    })();

    var startIndex = req.ip.lastIndexOf(':')
    var client_ip = req.ip;
    if (startIndex > 0) {
        client_ip = req.ip.substr(startIndex + 1, req.ip.length);
    }
    if (!common.isLocalAddr(client_ip)) {
        DEBUG('not local address, ip = ' + client_ip);
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('INVALID')));
        return;
    }

    var openid = req.openid;
    var existUids = gUsers[openid];
    if (!existUids) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        return;
    }

    var sid = +req.sid;
    var existUid = 0;
    for (var i = 0, len = existUids.length; i < len; i++) {
        if (Math.floor(existUids[i] / 1000000) == sid) {
            existUid = existUids[i];
        }
    }

    if (!existUid) {
        res.writeHead(200, common.htmlHeaders);
        res.end(util.format('%j', RESPONSE.get('USER_NOT_EXIST')));
        DEBUG('existUid is null, openid = ' + openid);
        return;
    }

    // 新建支付记录, 支付state 0:完成 1:新支付 2:confirm失败
    var billno = req.billno;
    var record = {
        _id: billno,
        openid: openid,
        uid: existUid,
        item_id: +req.item_id,
        item_num: +req.item_num,
        amt: +req.amt,
        time: (new Date()).format('yyyy-MM-dd hh:mm:ss'),
        ts: Date.getStamp(),
        state: 1
    };

    gDBPay.find({ _id: billno }, { _id: 1 }).limit(1).next(function (err, doc1) {
        if (doc1) {
            res.writeHead(200, common.htmlHeaders);
            res.end(util.format('%j', RESPONSE.get('DOUBLE_PAY')));
            DEBUG('double pay billno = ' + billno);
            return;
        }

        gDBPay.insertOne(record, function (err, result) {
            if (err || result.length < 1) {
                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', RESPONSE.get('INTERNAL_ERROR')));
                DEBUG('insert pay record error ');
                return;
            }

            // 请求game数据
            var server = getGameServer(existUid, true);
            var path = util.format('/?mod=gm&act=third_pay&uid=%d&args=%j', existUid, {
                key: config.GMAuth,
                item_id: +req.item_id,
                item_num: +req.item_num,
                amt: +req.amt,
                order: billno,
            });

            httpGet(server[0], server[1], path, function (data) {
                var resp = RESPONSE.get('OK');

                var state = 0;
                if (!data || data.code != 0) {
                    state = 2;
                    resp = RESPONSE.get('INTERNAL_ERROR');
                }

                res.writeHead(200, common.htmlHeaders);
                res.end(util.format('%j', resp));
            }, true, true);
        });
    });
};

function onLogIn(req, res, resp, uid, openid) {
    //do{
    //}while(auth.key.indexOf('+') < 0 );
    footprint(openid, uid, '', 'gateway_replyClient');
    var auth = common.genAuth(uid);

    resp.data.auth_key = auth.key;
    resp.data.auth_time = auth.time;
    resp.data.uid = uid;
    resp.data.game_server = getGameServer(uid);
    resp.data.timezone = gTimeZone;
    resp.data.serverId = config.ServerId;

    onReqHandled(res, resp);
}

function getGameServerId(uid) {
    return GameServerIds[uid % GameServerIds.length];
}

global.getGameServer = function (uid, split) {
    var gameId = getGameServerId(uid);
    var game = config.Games[gameId];
    if (!split) {
        return util.format('http://%s:%s/', game[0], game[1]);
    } else {
        return game;
    }
}
