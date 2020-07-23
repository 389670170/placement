function sendChatMessage(req, resp, type, content, user, sendUid, onHandled, title, quality, userIndex,
                         legion_id, legion_name, legion_level, team_id, team_name, team_level) {
    var respData = {
        code : 0,
        mod : 'chat',
        act : 'chat',
        data : {},
    };

    respData.data.user = {
        uid : req.uid,
        un : req.uid == 10000 ? gConfGeneralText["text_systemNotice"].text : user.un,
        vip : user.vip,
        level : user.level,
        headpic : user.headpic,
        headframe : user.headframe,
    };

    var now = common.getTime();
    respData.data.voice_url = req.args.voice_url;
    respData.data.voice_time = req.args.voice_time;
    respData.data.content = content;
    respData.data.type = type;
    respData.data.title = title;
    respData.data.quality = quality;
    respData.data.time = now;

    // 由系统经http发过来的聊天信息,且有附件
    if (!req.conn) {
        if (req.args.info) {
            respData.data.info = req.args.info;
        }
        if (req.args.sub_type) {
            respData.data.sub_type = req.args.sub_type;
        }
    }

    // 世界聊天
    if (type == 'world' || type == 'shout') {
        resp.nosend = 1;
        broadcast(respData);

        gChatLog.world.unshift(respData.data);
        if (gChatLog.world.length > gConfGlobal.chatLogCount) {
            gChatLog.world.pop();
        }

        var gameReq = {
            uid : req.uid,
            mod : 'user',
            act : 'add_world_time',
            auth_key : gUsers[req.uid].conn.auth_key,
            auth_time : gUsers[req.uid].conn.auth_time,
            args: {},
        };

        if (type == 'world') {
            requestGame(gameReq, {}, onHandled);
        }
    } else if (type == 'legion') { // 军团聊天
        var lid = user.lid;
        var uids = gChatMember.legion[lid] || [];
        resp.nosend = 1;
        broadcastEx(uids, respData);

        if(!gChatLog.legion[lid]) {
            gChatLog.legion[lid] = [];
        }
        gChatLog.legion[lid].unshift(respData.data);
        if(gChatLog.legion[lid].length > gConfGlobal.chatLogCount) {
            gChatLog.legion[lid].pop();
        }
    } else if(type == 'clan'){
        var teamId = user.team_id;
        var uids = gChatMember.clan[teamId] || [];

        resp.nosend = 1;
        broadcastEx(uids, respData);

        if(!gChatLog.clan[teamId]) {
            gChatLog.clan[teamId] = [];
        }

        gChatLog.clan[teamId] && gChatLog.clan[teamId].unshift(respData.data);
        if(gChatLog.clan[teamId].length > gConfGlobal.chatLogCount) {
            gChatLog.clan[teamId].pop();
        }
    } else if (type == 'country') {// 国家聊天
        var country = user.country;
        var uids = [];
        for (var uid in gUsers) {
            if (gUsers[uid].country == country) {
                uids.push(uid);
            }
        }
        resp.nosend = 1;
        broadcastEx(uids, respData);

        gChatLog.country[country].unshift(respData.data);
        if(gChatLog.country[country].length > gConfGlobal.chatLogCount) {
            gChatLog.country[country].pop();
        }
    } else if (type == 'recruit') { // 招募
        var recruitType = req.args.recruit_type;
        if (recruitType == 'legion') {
            respData.data.legion_id = legion_id;
            respData.data.legion_name = legion_name;
            respData.data.legion_level = legion_level;
        } else if (recruitType == 'team') {
            respData.data.team_id = team_id;
            respData.data.team_name = team_name;
            respData.data.team_level = team_level;
        }

        broadcast(respData);

        gChatLog.recruit.unshift(respData.data);
        if (gChatLog.recruit.length > gConfGlobal.chatLogCount) {
            gChatLog.recruit.pop();
        }

        var gameReq = {
            uid : req.uid,
            mod : 'user',
            act : 'add_world_time',
            auth_key : gUsers[req.uid].conn.auth_key,
            auth_time : gUsers[req.uid].conn.auth_time,
            args: {},
        };

        requestGame(gameReq, {}, onHandled);
    } else if (type == 'private'){ // 私聊
        var uids = [sendUid, req.uid];
        resp.nosend = 1;

        var privateId = 0;
        if (sendUid > req.uid) {
            privateId = req.uid + '_' + sendUid
        } else {
            privateId = sendUid + '_' + req.uid
        }

        if (!gChatLog.private[privateId]) {
            gChatLog.private[privateId] = []
        }

        gChatLog.private[privateId].unshift(respData.data);
        if (gChatLog.private[privateId].length > gConfGlobal.chatLogCount) {
            gChatLog.private[privateId].pop();
        }

        respData.data.userIndex = userIndex;
        broadcastEx(uids, respData);
    }
}

// chat服务由客户端发起,少数情况由服务端发起
exports.chat = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        var type = req.args.type;
        var sendUid = +req.args.senduid;
        var content = req.args.content;
        var userIndex = req.args.userIndex;
        if (!type || (content == null && !req.args.info)) {
            resp.code = 1; resp.desc = 'no type or content'; break;
        }

        if (type != 'world' && type != 'shout' && type != 'recruit' && type != 'legion'
            && type != 'clan' && type != 'country' && type != 'private') {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        if (content && content.length > gConfGlobal.chatContentMaxLength) {
            resp.code = 1; resp.desc = 'content too long'; break;
        }

        var user = gUsers[req.uid];
        if (!user) {
            resp.code = 1; resp.desc = 'not online'; break;
        }

        if (!req.args.voice_url ^ !req.args.voice_time) {
            resp.code = 1; resp.desc = 'voice args error'; break;
        }

        if (type != 'clan') {
            if (user.level < gConfGlobalNew.chatLevelLimit) {
                resp.code = 1; resp.desc = 'level not reached'; break;
            }
        }

        if (type == 'legion') {
            var lid = user.lid;
            if (!lid) {
                resp.code = 1; resp.desc = 'no legion'; break;
            }
        } else if (type == 'clan') {
            var teamId = user.team_id;
            if (!teamId) {
                resp.code = 1; resp.desc = 'no team'; break;
            }
        } else if (type == 'country') {
            var country = user.country;
            if (country != 1 && country != 2 && country != 3) {
                resp.code = 1; resp.desc = 'no country'; break;
            }
        } else if (type == 'private') {
            if (!sendUid){
                resp.code = 1; resp.desc = 'not senduid'; break;
            } else if(sendUid == req.uid){
                resp.code = 2; resp.desc = 'not our'; break;
            }
        }

        var now = common.getTime();

        // 判断是否禁言
        if (req.conn || req.args.type == 'shout') {
            if (!isDroid(req.uid) && gChatLog.black[req.uid]) {
                if (now - gChatLog.black[uid] >= gConfGlobal.banChatDuration*3600) {
                    delete gChatLog.black[uid];
                } else {
                    resp.code = 101; resp.desc = 'ban chat'; break;
                }
            }
        }

         


        if (type == 'shout' || type == 'recruit') {
            var title = req.args.title;
            var quality = req.args.quality;
            var legion_id = req.args.legion_id;
            var legion_name = req.args.legion_name;
            var legion_level = req.args.legion_level;
            var team_id = req.args.team_id;
            var team_name = req.args.team_name;
            var team_level = req.args.team_level;
            CheckDayWorldChatCountSendMsg(req, resp, type, content, user, sendUid, onHandled, title, quality, userIndex,legion_id, legion_name, legion_level, team_id, team_name, team_level);
        } else {
            var gameReq = {
                uid : req.uid,
                mod : 'user',
                act : 'get_title',
                auth_key : gUsers[req.uid].conn.auth_key,
                auth_time : gUsers[req.uid].conn.auth_time,
                args: {},
            };
            var gameResp = {};
            gameResp.code = 0;
            gameResp.desc = '';
            gameResp.data = {};
            requestGame(gameReq, gameResp, function() {
                do {
                    var title = gameResp.data.title;
                    if (!title) {
                        title = '';
                    }

                    if (type == 'world') {
                        var worldChatMaxTime = gConfLevel[user.level].worldChatCount;
                        if (gameResp.data.day_world_chat_count > worldChatMaxTime) {
                            resp.code = 1; resp.desc = 'world chat time is max'; break;
                        }
                    }

                    sendChatMessage(req, resp, type, content, user, sendUid, onHandled, title, gameResp.data.quality, userIndex);
                } while (false);

                onHandled();
            });

            return;
        }

    } while(false);

    onHandled();
};

function CheckDayWorldChatCountSendMsg(req, resp, type, content, user, sendUid, onHandled, title, quality, userIndex,
    legion_id, legion_name, legion_level, team_id, team_name, team_level){

    var dayWorldChatCountReq = {
        uid : req.uid,
        mod : 'user',
        act : 'get_world_chat_count',
        auth_key : gUsers[req.uid].conn.auth_key,
        auth_time : gUsers[req.uid].conn.auth_time,
        args: {},
    };
    var dayWorldChatCountReqResp = {};
    dayWorldChatCountReqResp.code = 0;
    dayWorldChatCountReqResp.desc = '';
    dayWorldChatCountReqResp.data = {};
     requestGame(dayWorldChatCountReq, dayWorldChatCountReqResp, function() {
        do {
            if(dayWorldChatCountReqResp.data.dayWorldChatCount < dayWorldChatCountReqResp.data.dayWorldChatMaxTime){
                sendChatMessage(req, resp, type, content, user, sendUid, onHandled, title, quality, userIndex,
                    legion_id, legion_name, legion_level, team_id, team_name, team_level);
            }
        } while (false);
    
        onHandled();
    });

}



exports.notice = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        var content = req.args.content;
        if (content == null) {
            resp.code = 1; resp.desc = 'no content'; break;
        }

        var respData = {
            code : 0,
            mod : 'chat',
            act : 'chat',
            data : {},
        };
        respData.data.user = {
            uid : 10000,
            un : gConfGeneralText["text_systemNotice"].text,
            vip : 0,
            level : 0,
            headpic : 1,
            headframe : 999,
        };

        respData.data.voice_url = req.args.voice_url;
        respData.data.voice_time = req.args.voice_time;
        respData.data.content = content;
        respData.data.type = 'shout';
        respData.data.title = '';
        var now = common.getTime();
        respData.data.time = now;

        broadcast(respData);

        gChatLog.world.unshift(respData.data);
        if (gChatLog.world.length > gConfGlobal.chatLogCount) {
            gChatLog.world.pop();
        }
    } while(false);

    onHandled();
};

exports.push_sys_msg = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        if (!req.args.type_id) {
            resp.code = 1; resp.desc = 'no type'; break;
        }

        var respData = {
            code : 0,
            mod : 'chat',
            act : 'system',
            data : {},
        }

        respData.data.sub_type = req.args.type_id;
        respData.data.str_array = req.args.array;
        broadcast(respData);
    } while (false);

    onHandled();
};

exports.del_msg = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        if (req.conn) {
            resp.code = 1; resp.desc = 'not for ws'; break;
        }

        if (!req.args.type) {
            resp.code = 1; resp.desc = 'no type'; break;
        }

        var type = req.args.type;
        var chatLog = gChatLog[type];
        if (!chatLog) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var content = req.args.content;
        var info = req.args.info;

        for (var i = 0, len = chatLog.length; i < len; i++) {
            if(chatLog[i].content == content) {
                chatLog.splice(i, 1);
                i--; len--;
                continue;
            }

            if(!info || typeof(info) != 'object' || !chatLog[i].info) {
                continue;
            }
            var equal = true;
            for(var key in info) {
                if(info[key] != chatLog[i].info[key]) {
                    equal = false; break;
                }
            }
            if(equal) {
                chatLog.splice(i, 1);
                i--; len--;
            }
        }
    } while(false);

    onHandled();
};

exports.mark_msg = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        if(req.conn) {
            resp.code = 1; resp.desc = 'not for ws'; break;
        }

        if(!req.args.type) {
            resp.code = 1; resp.desc = 'no type'; break;
        }

        var type = req.args.type;
        var chatLog = gChatLog[type];
        if(!chatLog) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var info = req.args.info;
        if(!info || typeof(info) != 'object') {
            resp.code = 1; resp.desc = 'no info'; break;
        }

        if(type == 'legion') {
            var lid = info.lid;
            if(!chatLog[lid]) {
                resp.code = 1; resp.desc = 'type error'; break;
            }
            chatLog = chatLog[lid];
        }

        for(var i = 0, len = chatLog.length; i < len; i++) {
            var log = chatLog[i];
            if(log.info && log.info[info.attach]) {
                if(info.attach == 'boon' && info.id == log.info.boon.id) {
                    log.info.used = 1;
                    break;
                }
            }
        }
    } while(false);

    onHandled();
};

exports.get_chat_log = function(req, resp, onHandled) {
    var uid = +req.uid;
    // var otherUid = req.args.otherUid;
    do {
        var lid = gUsers[uid].lid;
        var legionLog = [];
        var teamId = gUsers[uid].team_id;
        var clanLog = [];
        var country = gUsers[uid].country;
        var countryLog = [];
        // var privateId = uid > otherUid ? (otherUid+'_'+uid):(uid+'_'+otherUid);
        var privateLog = {};


        if(lid && gChatLog.legion[lid]) {
            legionLog = gChatLog.legion[lid];
        }

        if(teamId && gChatLog.clan[teamId]) {
            clanLog = gChatLog.clan[teamId];
        }


        for(var i in gChatLog.private){
            if(i.indexOf(req.uid) > -1){
                privateLog[i] = gChatLog.private[i];
            }
        }
        // if(privateId && gChatLog.private[privateId]){
        //    privateLog = gChatLog.private;
        // }

        // if(country) {
        //     countryLog = gChatLog.country[country];
        // }

        var chatLog = {};
        chatLog.world = gChatLog.world;
        chatLog.legion = legionLog;
        chatLog.country = countryLog;
        chatLog.recruit = gChatLog.recruit;
        chatLog.clan = clanLog;
        chatLog.private = privateLog;
        chatLog.mod = req.mod;
        chatLog.act = req.act;
        resp.data.chat_log = chatLog;
    } while(false);

    onHandled();
};

exports.ban_chat = function(req, resp, onHandled) {
    var uid = +req.uid;
    do {
        if (req.conn) {
            resp.code = 1; resp.desc = 'not support for ws'; break;
        }
        var uid = req.args.uid;
        gChatLog.black[uid] = common.getTime();
    } while(false);

    onHandled();
};

exports.friend_chat = function(req, resp, onHandled) {
    var uid = +req.uid;
    var friendId = req.args.friendId;
    do {
        var content = req.args.content;
        if (content == null && !req.args.voice_time) {
            resp.code = 1; resp.desc = 'no content'; break
        }

        if (content && content.length > gConfGlobal.chatContentMaxLength) {
            resp.code = 1; resp.desc = 'content too long'; break;
        }

        var user = gUsers[req.uid];
        if (!user){
            resp.code = 1; resp.desc = 'not online'; break;
        }

        if (!req.args.voice_url ^ !req.args.voice_time) {
            resp.code = 1; resp.desc = 'voice args error'; break;
        }

        var friendOffline = false;
        if (!gUsers[friendId] || !gUsers[friendId].conn) {
            friendOffline = true;
        }

        var data = {};
        data.senduid = uid + '';
        data.receiveuid = friendId;
        data.voice_url = req.args.voice_url;
        data.voice_time = req.args.voice_time;
        data.content = content;
        data.time = common.getTime();

        var worldReq = {
            uid : req.uid,
            mod : 'friend',
            act : req.act,
            args: {
                friendId : req.args.friendId,
                voice_url : req.args.voice_url,
                voice_time : req.args.voice_time,
                content : content,
                friendOffline : friendOffline,
            },
        };

        requestWorldSimple(worldReq, resp, function(){
            resp.data = data;
            if (resp.code == 0 && !friendOffline){
                var respData = {
                    code : 0,
                    mod : 'chat',
                    act : 'friend_chat',
                };

                respData.data = data;

                if (typeof(respData) == 'object') {
                    respData = JSON.stringify(respData);
                }
                if (gUsers[friendId] && gUsers[friendId].conn) {
                    gUsers[friendId].conn.sendUTF(respData);
                }
            }

            onHandled();
        });
        return;
    } while(false);

    onHandled();
};
