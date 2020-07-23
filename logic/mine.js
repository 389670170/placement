exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'goldmine')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var mine = user.mine;

        req.args.level = user.status.level;
        req.args.level_id = mine.level_id;
        req.args.zone_id = mine.zone_id;
        var jadeId = gConfJadeSeal.mine[0];
        var addPer = gConfJadeSeal.mine[1];
        if (user.jade_seal[jadeId]) {
            req.args.ext = addPer;
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var levelId = resp.data.level_id;
                var zoneId = resp.data.zone_id;

                if (levelId != mine.level_id) {
                    mine.level_id = levelId;
                    player.markDirty('mine.level_id');
                }

                if (zoneId != mine.zone_id) {
                    mine.zone_id = zoneId;
                    player.markDirty('mine.zone_id');
                }

                resp.data.rob_count = mine.count;
                if (resp.data.mine_id) {
                    if (player.memData.deposit) {
                        resp.data.deposit = player.memData.deposit;
                        player.memData.deposit = 0;
                    }
                    player.memData.status = 'occupy_mine';
                } else {
                    player.memData.status = 'idle';
                }
            }
            onHandled();
        });

        return;
    } while(false);

    onHandled();
};

exports.occupy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'goldmine')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var mineId = req.args.id;
        if (!mineId || isNaN(mineId)) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        mineId = Math.floor(+mineId);
        if (mineId < 1 || mineId > 33) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (player.memData.status == 'fight_mine') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var mine = user.mine;
        req.args.level_id = mine.level_id;
        req.args.zone_id = mine.zone_id;
        req.args.rob_count = mine.count;
        req.args.gold = user.status.gold;

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = resp.data.status;
                player.memData.mine_id = mineId;

                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;

                var randPos = common.randRange(1, player.memData.pos_count);
                var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                resp.data.fight_time = player.memData.fight_time = common.getTime();
                resp.data.rand_pos = player.memData.rand_pos = randPos;
                resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;

                mine.occupy_count++;
                player.markDirty('mine.occupy_count');

                if (resp.data.status == 'occupy_mine') {
                    var logConf = gConfPlayLog['mine']['occupy'];
                    player.recordPlay(logConf.logType, logConf.logName);
                    player.doDailyTask('mine', 1);
                }
            }
            onHandled();
        });
        return;
    }while(false);

    onHandled();
};

exports.fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var mineId = req.args.id;
        if (!mineId || isNaN(mineId)) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        mineId = Math.floor(+mineId);

        var star = req.args.star;
        if ([0, 1, 2, 3].indexOf(star) == -1) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        if (mineId < 1 || mineId > 33 || mineId != player.memData.mine_id) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (player.memData.status != 'prepare_mine') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        // TODO 验证战斗
        //var report = parseFightReport(report, this.memData.rand);
        //if(!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if(!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        var mine = user.mine;
        req.args.level_id = mine.level_id;
        req.args.zone_id = mine.zone_id;
        req.args.rob_count = mine.count;

        var team = req.args.team;
        if (team) {
            var valid = true;
            for (var pos in team) {
                var slot = Math.floor(team[pos]);
                if (!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if (!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }

            var pos = player.memData.fight_info.pos;
            for (var p in team) {
                pos[p].slot = Math.floor(team[p]);
                player.markDirty(util.format('pos.%d.slot', p));
            }
        }

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = resp.data.status;
                player.memData.mine_id = 0;
                if (star > 0) {
                    user.mine.count++;
                    player.markDirty('mine.count');
                    var logConf = gConfPlayLog['mine']['rob'];
                    player.recordPlay(logConf.logType, logConf.logName);
                    player.doTask('mineRob', 1);
                    player.doOpenSeven('mineRob', 1);
                    player.doOpenHoliday('mineRob', 1);
                    player.doDailyTask('mine', 1);
                } else {
                    resp.data.costs = player.addAwards([['user', 'gold', -resp.data.deposit]],req.mod,req.act);
                }
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.leave = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var mineId = req.args.id;
        if (!mineId || isNaN(mineId)) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        mineId = Math.floor(+mineId);

        if (mineId < 1 || mineId > 33 ) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (player.memData.status != 'occupy_mine') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var mine = user.mine;

        req.args.level_id = mine.level_id;
        req.args.zone_id = mine.zone_id;
        requestWorld (req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = resp.data.status;
                player.memData.mine_id = 0;
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_report = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.time)) {
            resp.code = 1; resp.desc = 'no time'; break;
        }

        if (!player.memData.status) {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var mine = user.mine;

        req.args.level_id = mine.level_id;
        req.args.zone_id = mine.zone_id;
        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};
