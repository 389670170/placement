
// 发布召集令
exports.broadcast_call_of_duty = function (req, res, resp) {
    do {
        if(!req.args.players || !util.isArray(req.args.players)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var players = req.args.players;
        var targetCity = req.args.city;
        var time = req.args.time;   // 发布集结令的时间
        var caller = req.args.uid;
        var serverId = req.args.serverId;

        // 广播给本服在线玩家
        for (var i = 0; i < players.length; i++) {
            var user = gUserInfo.getUser(players[i]);
            if (user) {
                pushToUser(players[i], 'self', {
                    mod : 'countrywar',
                    act : 'call_of_duty',
                    city : targetCity,
                    time : time,
                    caller : caller,
                    serverId : serverId,
                });
            }
        }

    } while(false);

    onReqHandled(res, resp, 1);
};

// 战斗结束通知
exports.fight = function (req, res, resp) {
    do {
        var uid = req.uid;
        var winner_uid = req.args.winner_uid;
        var pos = req.args.winner_pos;
        var deadBattleInfo = req.args.deadBattleInfo;
        var coolTime = req.args.coolTime;
        var score = req.args.score;

        var user = gUserInfo.getUser(uid);
        if (user) {
            pushToUser(uid, 'self', {
                mod : 'countrywar',
                act : 'fight',
                winner_uid : winner_uid,
                winner_pos : pos,
                deadBattleInfo : deadBattleInfo,
                coolTime : coolTime,
                score : score,
            });
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 城池占领
exports.city_owner_change = function (req, res, resp) {
    var players = req.args.players;
    var city = req.args.city;
    var cityInfo = req.args.cityInfo;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'city_owner_change',
                city : city,
                cityInfo : cityInfo,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 城池战斗状态改变
exports.city_fight_state_change = function (req, res, resp) {
    var players = req.args.players;
    var city = req.args.city;
    var cityInfo = req.args.cityInfo;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'city_fight_state_change',
                city : city,
                cityInfo : cityInfo,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 城池人员变动
exports.city_player_change = function(req, res, resp){
    var players = req.args.players;
    var city = req.args.city;
    var uid = req.args.uid;
    var enter = req.args.enter;
    var hid = req.args.hid;
    var fight_force = req.args.fight_force;
    var country = req.args.country;
    var call = req.args.call;
    var un = req.args.un;
    var serverId = req.args.serverId;
    var weapon_illusion  = req.args.weapon_illusion;
    var wing_illusion  = req.args.wing_illusion;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'city_player_change',
                city : city,
                uid : uid,
                un : un,
                enter : enter,  // 1表示进入，0表示离开
                hid : hid,
                fight_force : fight_force,
                country : country,
                call : call,
                serverId : serverId,
                weapon_illusion : weapon_illusion,
                wing_illusion : wing_illusion,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 连斩通知
exports.continuous_kill = function (req, res, resp) {
    var players = req.args.players;
    var killer = req.args.uid;
    var killerName = req.args.un;
    var killCount = req.args.killCount;
    var country = req.args.country;
    var serverId = req.args.serverId;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'continuous_kill',
                uid : killer,
                un : killerName,
                killCount : killCount,
                country : country,
                serverId : serverId,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 击杀玩家
exports.kill_player = function (req, res, resp) {
    var players = req.args.players;
    var city = req.args.city;
    var killer = req.args.uid;
    var killerName = req.args.un;
    var dead = req.args.dead;
    var deadName = req.args.deadName;
    var deadCountry = req.args.deadCountry;
    var deadPosition = req.args.deadPosition;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'continuous_kill',
                city : city,
                uid : killer,
                un : killerName,
                dead : dead,
                deadName : deadName,
                deadCountry : deadCountry,
                deadPosition : deadPosition,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

exports.on_player_fight = function (req, res, resp) {
    var players = req.args.players;
    var city = req.args.city;
    var uid1 = req.args.uid1;
    var uid2 = req.args.uid2;
    var name1 = req.args.name1;
    var name2 = req.args.name2;
    var camp1 = req.args.camp1;
    var camp2 = req.args.camp2;
    var serverId1 = req.args.serverId1;
    var serverId2 = req.args.serverId2;
    var winner = req.args.winner;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'on_player_fight',
                city : city,
                uid1 : uid1,
                uid2 : uid2,
                name1 : name1,
                name2 : name2,
                camp1 : camp1,
                camp2 : camp2,
                serverId1 : serverId1,
                serverId2 : serverId2,
                winner : winner,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

exports.sync_move = function (req, res, resp) {
    var players = req.args.players;
    var from = req.args.from;
    var to = req.args.to;
    var uid = req.args.uid;
    var un = req.args.un;
    var hid = req.args.hid;
    var country = req.args.country;
    var serverId = req.args.serverId;
    var weapon_illusion  = req.args.weapon_illusion;
    var wing_illusion  = req.args.wing_illusion;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'sync_move',
                uid : uid,          // 玩家uid
                un : un,            // 玩家名
                hid : hid,          // 主公hid
                country : country,  // 国家
                serverId : serverId,
                weapon_illusion : weapon_illusion,
                wing_illusion : wing_illusion,
                from : from,        // 从哪来
                to : to,            // 到哪去
            });
        }
    }

    onReqHandled(res, resp, 1);
};

exports.chat = function (req, res, resp) {
    var players = req.args.players;
    var chatInfo = req.args.info;

    var chatUser = chatInfo.user;
    var content = chatInfo.content;
    var voice_url = chatInfo.voice_url;
    var voice_time = chatInfo.voice_time;
    var time = chatInfo.time;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'chat',
                user : chatUser,
                content : content,
                voice_url : voice_url,
                voice_time : voice_time,
                time : time,
            });
        }
    }

    onReqHandled(res, resp, 1);
};


exports.shout = function (req, res, resp) {
    var players = req.args.players;
    var chatInfo = req.args.info;

    var chatUser = chatInfo.user;
    var content = chatInfo.content;
    var voice_url = chatInfo.voice_url;
    var voice_time = chatInfo.voice_time;
    var time = chatInfo.time;

    // 广播给本服在线玩家
    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'shout',
                user : chatUser,
                content : content,
                voice_url : voice_url,
                voice_time : voice_time,
                time : time,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 被踢出服战
exports.kick_player = function (req, res, resp) {
    var players = req.args.players;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'countrywar',
                act : 'kick_player',
            });
        }
    }

    onReqHandled(res, resp, 1);
};
