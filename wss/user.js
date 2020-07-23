function getConnInfo(conn) {
    var info = {};
    if(!conn) {
        return info;
    }
    var items = ['remoteAddress', 'closeReasonCode', 'closeDescription',
                 'connected', 'state', 'closeTimeout', 'conn_id', '_time'];
    for(var i = 0; i < items.length; i++) {
        info[items[i]] = conn[items[i]];
    }
    return info;
}

// handshake客户端由ws发起, 验证玩家是否登陆，并获取玩家信息
exports.handshake = function(req, resp, onHandled) {
    var uid = +req.uid;

    if (!req.args.auth_key || !req.args.auth_time || !req.args.openid) {
        resp.code = 4;
        resp.desc = "no auth_key or auth_time or openid";

        if (gUsers[uid]) {
            delete gUsers[uid];
        }
        onHandled('close');
        return;
    }

    var conn = req.conn;
    var gameReq = {
        uid : req.uid,
        mod : 'user',
        act : 'handshake',
        auth_key : req.args.auth_key,
        auth_time : req.args.auth_time,
        args: {},
    };

    var state = null;
    var gameResp = {};
    requestGame(gameReq, gameResp, function() {
        state = 'close';
        if (conn.connected) {
            if (gameResp.code != 0) {
                resp.code = gameResp.code;
                resp.desc = gameResp.desc;
                if (gUsers[uid]) {
                    var lid = gUsers[uid].lid;
                    var team_id = gUsers[uid].team_id;
                    if (lid) {
                        gChatMember.legion[lid].remove(uid);
                    }
                    if (team_id) {
                        gChatMember.clan[team_id].remove(uid);
                    }

                    delete gUsers[uid];
                }
            } else {
                // 校验登录成功，如果有之前同一个用户，则断掉并删除, 重新保存玩家数据
                var userInfo = gUsers[uid];
                if (userInfo && userInfo.conn && userInfo.conn != conn) {
                    userInfo.conn.close();
                }

                var user = gameResp.data.user;
                var lid = user.lid;
                var team_id = user.team_id;
                gUsers[uid] = user;

                if (lid){
                    !gChatMember.legion[lid] && (gChatMember.legion[lid] = []);
                    if (gChatMember.legion[lid].indexOf(uid) < 0) {
                        gChatMember.legion[lid].push(uid);
                    }
                }
                if (team_id) {
                    !gChatMember.clan[team_id] && (gChatMember.clan[team_id] = []);
                    if (gChatMember.clan[team_id].indexOf(uid) < 0) {
                        gChatMember.clan[team_id].push(uid);
                    }
                }

                state = 'new';
            }
        }

        onHandled(state);
    });
};


// update由Game Server发起http请求，resp为http的响应, 没有ws响应
exports.update = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        if (req.conn) {
            resp.code = 1; resp.desc = 'not support for ws'; break;
        }

        var user = gUsers[uid];
        if (!user) {
            break;
        }

        var args = req.args;
        for (var attr in user) {
            if (attr == 'conn') continue;
            user[attr] = args[attr] || user[attr];
            // if user change team id or lid
            if(attr == 'team_id'){
                var team_id = args[attr];
                !gChatMember.clan[team_id] && (gChatMember.clan[team_id] = []);

                if (gChatMember.clan[team_id].indexOf(uid) < 0) {
                    gChatMember.clan[team_id].push(uid);
                }
            }
            if ( attr == 'lid' ){
                var lid = args[attr];
                !gChatMember.legion[lid] && (gChatMember.legion[lid] = []);
                if (gChatMember.legion[lid].indexOf(uid) < 0) {
                    gChatMember.legion[lid].push(uid);
                }
            }
        }
    } while(false);

    onHandled();
};

exports.close = function(req, resp, onHandled) {
    do {
        if (req.conn) {
            resp.code = 1; resp.desc = 'not support for ws'; break;
        }

        var uids = req.args.uids;
        if (!uids) {
            resp.code = 1; resp.desc = ''; break;
        }

        for (var i = 0; i < uids.length; i++) {
            var uid = uids[i];
            if (gUsers[uid] && gUsers[uid].conn && gUsers[uid].conn['state'] == 'open') {
                gUsers[uid].conn.close();
            }
        }

    } while(false);

    onHandled();
};

// set_flag由客户端ws发起,设置当前玩家的标记
exports.set_flag = function(req, resp, onHandled) {
    do {
        var flags = req.args.flags;
        for (var flag in flags) {
            if (flags[flag]) {
                gUsers[req.uid].flags[flag] = 1;
            } else {
                delete gUsers[req.uid].flags[flag];
            }
        }
    } while(false);

    onHandled();
};

// 获取当前在线玩家个数，debug用
exports.active_user = function(req, resp, onHandled) {
    do {
        var count = Object.keys(gUsers).length;
        resp.data.count = count;
        resp.nosend = 1;
    } while(false);

    onHandled();
};

exports.error = function(req, resp, onHandled) {
    onHandled();
};

exports.trick = function(req, resp, onHandled) {
    TRICK(req.uid);
    onHandled();
};

exports.wss_debug = function(req, resp, onHandled) {
    do {
        if (req.conn) {
            resp.code = 1; resp.desc = 'not support for ws'; break;
        }

        var allUser = {};
        for (var id in gUsers) {
            allUser[id] = {};
            for (item in gUsers[id]) {
                if (item == 'conn') {
                    allUser[id].conn = getConnInfo(gUsers[id][item]);
                } else {
                    allUser[id][item] = gUsers[id][item];
                }
            }
        }

        var allConnTime = {};
        for (var id in gConnTimes) {
            if (id == 'ai') {
                allConnTime.ai = gConnTimes.ai;
            } else {
                allConnTime[id].time = gConnTimes[id][0];
                allConnTime[id].conn = getConnInfo(gConnTimes[id][1]);
            }
        }

        // 返回所有gUser数据和gConnTimes数据
        if (Object.keys(req.args).length == 0) {
            resp.data.all_user = allUser;
            resp.data.all_conn_time = allConnTime;
            break;
        }

        // 所有gUser数据
        if (req.args.all_user) {
            resp.data.all_user = allUser;
        }

        // 指定uid的玩家数据
        if (req.args.uid) {
            resp.data.user = allUser[req.args.uid];
        }

        // 所有gConntimes数据
        if (req.args.conn_time) {
            resp.data.conn_time = allConnTime;
        }

        // 所有聊天记录
        if (req.args.chat_log) {
            if (req.args.chat_log == 'all') {
                resp.data.chat_log = gChatLog;
            } else if (req.args.chat_log == 'world') {
                resp.data.chat_log = gChatLog.world;
            } else if (req.args.chat_log == 'legion') {
                resp.data.chat_log = gChatLog.legion;
            } else if (req.args.chat_log == 'recruit') {
                resp.data.chat_log = gChatLog.recruit;
            } else if (req.args.chat_log == 'black') {
                resp.data.black = gChatLog.black;
            }
        }

        resp.data.conn_times = gConnTimes;
    } while(false);

    onHandled();
};
