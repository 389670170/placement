var ErrorCode = require('../teamzone/error.js').ErrorCode;

// 玩家位置改变
exports.player_position_change = function (req, res, resp) {
    var players = req.args.players;
    var uid = req.args.uid;
    var zoneId = req.args.zone_id;
    var cellId = req.args.cell_id;
    var set = req.args.set;

    DEBUG('player_position_change ' + uid);

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'teamzone',
                act : 'player_position_change',
                uid : uid,
                zone_id : zoneId,
                cell_id : cellId,
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
    var zoneId = req.args.zone_id;
    var un = req.args.un;
    var pos = req.args.pos;
    var weapon_illusion  = req.args.weapon_illusion;
    var wing_illusion  = req.args.wing_illusion;
    var custom_king = req.args.custom_king;

    for (var i = 0; i < players.length; i++) {
        var user = gUserInfo.getUser(players[i]);
        if (user) {
            pushToUser(players[i], 'self', {
                mod : 'teamzone',
                act : 'player_enter',
                uid : uid,
                un : un,
                zone_id : zoneId,
                weapon_illusion : weapon_illusion,
                wing_illusion : wing_illusion,
                custom_king : custom_king,
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
                mod : 'teamzone',
                act : 'player_leave',
                uid : uid,
                pos : pos,
            });
        }
    }

    onReqHandled(res, resp, 1);
};