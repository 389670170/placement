// 领地战逻辑
// 玩家位置改变
exports.player_position_change = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var lid = req.args.lid;
    var cellId = req.args.cellId;
    var set = req.args.set;

    DEBUG('player_position_change ' + uid);

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'player_position_change',
                uid : uid,
                lid : lid,
                cellId : cellId,
                set : set,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 玩家进入领地通知
exports.player_enter = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var lid = req.args.lid;
    var un = req.args.un;
    var dragon = req.args.dragon;
    var stayingPower = req.args.stayingPower;
    var pos = req.args.pos;
    var weapon_illusion  = req.args.weapon_illusion;
    var wing_illusion  = req.args.wing_illusion;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'player_enter',
                uid : uid,
                un : un,
                lid : lid,
                dragon : dragon,
                stayingPower : stayingPower,
                weapon_illusion : weapon_illusion,
                wing_illusion : wing_illusion,
                pos : pos,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 玩家离开领地通知
exports.player_leave = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var pos = req.args.pos;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'player_leave',
                uid : uid,
                pos : pos,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 通知战斗结果
exports.fight_player = function (req, res, resp) {
    var uid = req.uid;
    var win = req.args.win; // 赢了还是输了
    var costs = req.args.costs; // 消耗的耐力值
    var staying_power = req.args.staying_power;
    var dead = req.args.dead;

    var user = gUserInfo.getUser(uid);
    if (user) {
        pushToUser(uid, 'self', {
            mod : 'territorywar',
            act : 'fight_player',
            win : win,
            costs : costs,
            staying_power : staying_power,
            dead : dead,
        });
    }

    onReqHandled(res, resp, 1);
};

// 领地战重置
exports.reset_by_week = function (req, res, resp) {
    // 将本服务器所有军团的段位发送给领地战服务器
    var legionList = {};
    for (var lid in gNewLegion.legions) {
        var legion = gNewLegion.legions[lid];
        var legionInfo = {};
        legionInfo.lid = parseInt(lid);
        legionInfo.name = legion.name;
        legionInfo.icon = legion.icon;
        legionInfo.level = legion.level;
        legionInfo.legionWarLevel = gLegionWar.getLegionPersist(lid).level;

        legionList[lid] = legionInfo;
    }

    resp.data.legionList = legionList;

    onReqHandled(res, resp, 1);
};

// 军团开启传送门
exports.open_transfer_gate = function (req, res, resp) {
    var lid = req.args.lid;

    var legion = gNewLegion.legions[lid];
    if (legion) {
        var legionInfo = {};
        legionInfo.name = legion.name;
        legionInfo.icon = legion.icon;
        legionInfo.level = legion.level;
        legionInfo.legionWarLevel = gLegionWar.getLegionPersist(lid).level;

        resp.data.legionInfo = legionInfo;
    } else {
        resp.code = 1;
        resp.desc = 'not find legion';
    }

    onReqHandled(res, resp, 1);
};

// 石碑访问
exports.visit_stele = function (req, res, resp) {
    var players = req.args.players;
    var lid = req.args.lid;
    var cellId = req.args.cellId;
    var stele = req.args.stele;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'visit_stele',
                lid : lid,
                cellId : cellId,
                stele : stele,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 瞭望塔访问
exports.visit_tower = function (req, res, resp) {
    var players = req.args.players;
    var lid = req.args.lid;
    var cellId = req.args.cellId;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'visit_tower',
                lid : lid,
                cellId : cellId,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 占领矿通知
exports.occupy_mine  = function (req, res, resp) {
    var players = req.args.players;
    var lid = req.args.lid;
    var cellId = req.args.cellId;
    var resId = req.args.resId;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'occupy_mine',
                lid : lid,
                cellId : cellId,
                resId : resId,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 军团成员访问格子
exports.legion_member_visit_cell = function (req, res, resp) {
    var players = req.args.players;
    var lid = req.args.lid;
    var cellId = req.args.cellId;

    DEBUG('legion_member_visit_cell ' + lid + ', cell ' + cellId);

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'legion_member_visit_cell',
                lid : lid,
                cellId : cellId,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 怪物死亡通知
exports.monster_dead = function (req, res, resp) {
    var players = req.args.players;
    var lid = req.args.lid;
    var cellId = req.args.cellId;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'monster_dead',
                lid : lid,
                cellId : cellId,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 被踢出领地战
exports.kick_player = function (req, res, resp) {
    var players = req.args.players;
    var dismiss = req.args.dismiss;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'kick_player',
                dismiss : dismiss,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 战斗状态改变
exports.fight_state_change = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var state = req.args.state;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'fight_state_change',
                uid : uid,
                state : state,
            });
        }
    }

    onReqHandled(res, resp, 1);
};
;
// boss出生
exports.boss_birth = function (req, res, resp) {
    var players = req.args.players;
    var boss = req.args.boss;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'boss_birth',
                boss : boss,
            });
        }
    }

    onReqHandled(res, resp, 1);
}

// 玩家血量改变
exports.player_hp_change = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var stayingPower = req.args.staying_power;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'player_hp_change',
                uid : uid,
                stayingPower : stayingPower,
            });
        }
    }

    onReqHandled(res, resp, 1);
};

// 共享怪物血量改变
exports.monster_hp_change = function (req, res, resp) {
    var players = req.args.players;
    var cellId = req.args.cellId;
    var stayingPower = req.args.staying_power;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'territorywar',
                act : 'monster_hp_change',
                cellId : cellId,
                stayingPower : stayingPower,
            });
        }
    }

    onReqHandled(res, resp, 1);
};
