// 判断合璧是否开放
function is_open() {
    var openDays = (gConfGlobal.countryJadeOpenDays).split(',');
    var weekDay = Date.getWeekDay();
    if (openDays.indexOf(weekDay+'') == -1) {
        return false;
    }

    var openTime = Date.zeroTime().getStamp() + (gConfGlobal.countryJadeOpenTime * 3600);
    var endTime = openTime + (gConfGlobal.countryJadeOpenKeepTime) * 60;
    var now = Date.getStamp();
    return (now >= openTime && now < endTime);
}

// 获取合璧主界面数据
exports.get_main_page = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 判断玩家是否加入国家
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        onHandled();
    });
};

// 领取玉璧
exports.get_jade = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 判断玩家是否加入国家
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 加入房间
exports.join_room = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 判断玩家是否加入国家
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    // 参数检查
    if (isNaN(req.args.roomId) || isNaN(req.args.roomPos)
        || (req.args.roomPos != 1 && req.args.roomPos != 2)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            player.doDailyTask('together', 1);
        }
        onHandled();
    });
};

// 退出房间
exports.exit_room = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    // 判断玩家是否加入国家
    req.args.country = player.user.info.country;
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    // 参数检查
    if (isNaN(req.args.roomId)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        onHandled();
    });
};

// 喊话
exports.shout = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 判断玩家是否加入国家
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        onHandled();
    });
};

// 获取指定国家的合璧房间数据
exports.get_country_rooms = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    if (isNaN(req.args.country) || isNaN(req.args.offset) || isNaN(req.args.limit)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        onHandled();
    });
};

// 抢劫房间
exports.rob_room = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    // 参数检查
    if (isNaN(req.args.country) || req.args.country == player.user.info.country) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    // 参数检查
    if (isNaN(req.args.roomId) || isNaN(req.args.roomPos)
        || (req.args.roomPos != 1 && req.args.roomPos != 2)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            player.memData.status = 'prepare_country_jade';
        }
        onHandled();
    });
};

// 准备战斗
exports.before_fight = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    var user = player.user;
    do {
        if(player.memData.status != 'prepare_country_jade') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var team = req.args.team;
        if(team) {
            var valid = true;
            for(var pos in team) {
                var slot = Math.floor(team[pos]);
                if(!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if(!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }
            for(var pos in team) {
                user.pos[pos].slot = Math.floor(team[pos]);
                player.markDirty(util.format('pos.%d.slot', pos));
            }
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var rand = Math.floor(common.randRange(100000, 999999));
                player.memData.rand = rand;
                player.memData.fight_time = common.getTime();
                resp.data.rand = rand;
                player.memData.status = 'fight_country_jade';
            }
            onHandled();
        });

        return;
    } while(false);

    onHandled();
};

// 战斗结束
exports.fight = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    var user = player.user;
    do {
        if(player.memData.status != 'fight_country_jade') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (isNaN(req.args.roomId) || isNaN(req.args.country)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var star = req.args.star;

        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }
        star = Math.floor(+star);

        req.args.win = star > 0;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'idle';
            }
            onHandled();
        });

        return;
    } while(false);

    onHandled();
};

// 获取战报
exports.get_reports = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 参数检查
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        onHandled();
    });
};

// 消费切换玉璧的左右边
exports.exchange_jade = function(player, req, resp, onHandled) {
    if (!is_open()) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.country = player.user.info.country;

    // 参数检查
    if (isNaN(req.args.country)) {
        resp.code = 1; resp.desc = 'country not set';
        onHandled();
        return;
    }

    var costs = [['user', 'cash', -gConfGlobal.countryJadeExchangeCost]];
    if (!player.checkCosts(costs)) {

        resp.code = 1; resp.desc = 'something is not enough';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
        }
        onHandled();
    });
};
