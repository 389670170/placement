require('../global.js');
/** 类型列表 */
const TYPE_LIST = [ArenaType.BRONZE, ArenaType.SILVER, ArenaType.GOLD, ArenaType.THIS];

// global.ArenaType = {
//     BRONZE: 1,    // 青铜
//     SILVER: 2,    // 白银
//     GOLD: 3,    // 黄金
//     PLATINUM: 4,    // 铂金
//     DIAMOND: 5,    // 钻石
//     KING: 6,    // 王者
//     THIS: 11,       // 本服
//     CROSS: 12,      // 跨服
// };

exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var type = req.args.type;
        if (!type) {
            type = ArenaType.THIS;
            req.args.type = type;
        }

        // if (!isArenaOpen(type, player)) {
        //     resp.code = 1; resp.desc = 'not open'; break;
        // }

        var user = player.user;
        var tmpData = mapObject(user, gInitWorldUser);

        var updateData = mapObject(tmpData, gArenaServerUser);

        req.args.user = updateData;
        req.args.serverId = config.ServerId;

        function callback(player, resp) {
            var user = player.user;
            if (resp.code == 0) {
                var enemy = resp.data.enemy;
                player.memData.arena_enemy = {};
                for (var uid in enemy) {
                    player.memData.arena_enemy[uid] = 1;
                }

                player.memData.area_top_ten = {};
                for (var uid in resp.data.top_ten) {
                    player.memData.area_top_ten[uid] = 1;
                }

                var arena = user.arena;
                if (!arena.max_rank || resp.data.rank < arena.max_rank) {
                    arena.max_rank = resp.data.rank;
                    player.markDirty('arena.max_rank');
                }

                player.memData.status = 'idle';

                resp.data.max_rank = arena.max_rank || 0;
                resp.data.award_got = arena.award_got;
                resp.data.count = arena.count;
                resp.data.level = user.status.arena_level;
                // 已废弃，驯龙2竞技场没有xp
                // resp.data.xp = user.status.arena_xp;
                resp.data.xp = 0;
                resp.data.challenge_cd = user.arena.challenge_cd;
            }

            onHandled();
        }

        // 本服竞技场
        requestWorld(req, resp, function () {
            callback(player, resp);
        });
        return;
    } while (false);

    onHandled();
};

// 获取玩家当前所在段位和排名
exports.get_rank_type = function (player, req, resp, onHandled) {
    requestWorld(req, resp, function () {
        onHandled();
    });
};

exports.refresh = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status == 'fight_arena') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var type = req.args.type;
        if (!type) {
            type = ArenaType.THIS;
        }

        function callback(player, resp) {
            var enemy = resp.data.enemy;
            player.memData.arena_enemy = {};
            for (var uid in enemy) {
                player.memData.arena_enemy[uid] = 1;
            }
            onHandled();
        }

        requestWorld(req, resp, function () {
            callback(player, resp);
        });

        return;
    } while (false);

    onHandled();
};

exports.challenge = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var type = +req.args.type;
        if (!type) {
            resp.code = 1; resp.desc = 'area type need'; break;
        }

        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status == 'fight_arena') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (!req.args.enemy || isNaN(req.args.enemy)) {
            resp.code = 1; resp.desc = 'no enemy'; break;
        }

        var cost = [['user', 'atoken', -1]];
        if (user.arena.count >= gConfGlobalNew.arenaMaxCount) {
            if (!player.checkCosts(cost)) {
                resp.code = 1; resp.desc = 'has no count'; break;
            }
        }

        if (user.status.level > gConfArenaBase[type].levelLimit) {
            resp.code = 1; resp.desc = 'level too high'; break;
        }

        function callback(player, rep, resp) {
            if (resp.code == 0) {
                player.memData.status = 'prepare_arena';
                player.memData.enemy_id = +req.args.enemy;

                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;

                var randPos = common.randRange(1, player.memData.pos_count);
                var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                resp.data.fight_time = player.memData.fight_time = common.getTime();
                resp.data.rand_pos = player.memData.rand_pos = randPos;
                resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;
            }
            onHandled();
        }

        requestWorld(req, resp, function () {
            callback(player, req, resp);
        });

        return;
    } while (false);

    onHandled();
};

// 挑战结束
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (player.memData.status != 'prepare_arena') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (!req.args.enemy || isNaN(req.args.enemy)) {
            resp.code = 1; resp.desc = 'no enemy'; break;
        }

        if (req.args.enemy != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        var cost = [['user', 'atoken', -1]];
        if (user.arena.count >= gConfGlobalNew.arenaMaxCount) {
            if (!player.checkCosts(cost)) {
                resp.code = 1; resp.desc = 'has no count'; break;
            }
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        var time = req.args.time;
        var clientSign = req.args.sign;
        var enemyuid = req.args.enemy;

        // TODO 验证战斗
        var serverSign = getArenaBattleFightSign('arena', req.uid, time, star, enemyuid);
        //if (serverSign != clientSign) {
        //    resp.code = 999; resp.desc = "sign not match"; break;
        //}

        var type = req.args.type;
        if (!type) {
            type = ArenaType.THIS;
        }

        // TODO 验证战斗
        //var report = parseFightReport(report, this.memData.rand);
        //if(!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if(!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        var team = req.args.team;
        if (team) {
            var valid = true;
            if (!player.syncTeam(1, team)) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }

            // 更新队伍信息
            let fi = player.memData.fight_info;
            for (var p in team) {
                fi.pos[p].slot = Math.floor(team[p]);
            }
        }

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };

        function callback(player, resp) {
            var user = player.user;
            if (resp.code == 0) {
                if (user.arena.count < gConfGlobalNew.arenaMaxCount) {
                    user.arena.count++;
                    player.markDirty('arena.count');
                } else {
                    resp.data.costs = player.addAwards(cost, req.mod, req.act);
                }

                user.arena.challenge_cd = common.getTime() + gConfGlobal.arenaChallengeCD * 60;
                player.markDirty('arena.challenge_cd');
                resp.data.challenge_cd = user.arena.challenge_cd;
                player.doDailyTask('arena', 1);
                player.doOpenHoliday('arena', 1);
                var addPer = 0;

                var xpAdd = 0;
                var awards = [];
                if (star > 0) {
                    // 更新竞技场获胜次数
                    user.arena.win_times += 1;
                    player.markDirty('arena.win_times');
                    player.updateHeadFrameStatus('arena_win_times', user.arena.win_times);

                    var diff = resp.data.diff;
                    var type = resp.data.type;
                    var rank = resp.data.rank;

                    if (diff > 0) {
                        user.arena.max_rank = rank;
                        player.markDirty('arena.max_rank');
                    }

                    // 更新竞技第一名头像框
                    if (rank && rank == 1) {
                        player.updateHeadFrameStatus('arena_rank', rank);
                        resp.data.headframe = user.info.headframe;

                        var enemyRank = resp.data.enemy_rank;
                        gPlayers.get(player.memData.enemy_id, function (enemyPlayer) {
                            enemyPlayer.updateHeadFrameStatus('arena_rank', enemyRank);
                            pushToUser(player.memData.enemy_id, 'self', {
                                'mod': 'user',
                                'act': 'headframe_change',
                                'headframe': enemyPlayer.user.info.headframe,
                            });
                        });
                    }

                    var logConf = gConfPlayLog['pvp']['arena'];
                    player.recordPlay(logConf.logType, logConf.logName);

                    player.doTask('arenaVictory', 1);
                    player.doOpenSeven('arenaVictory');
                    player.doOpenHoliday('arenaVictory');

                } else {

                }

                player.memData.status = 'idle';
                player.memData.enemy_id = 0;

                var atype = resp.data.type;

                // 竞技场单次挑战奖励
                resp.data.awards = player.addAwards(gConfArenaBase[atype].award, req.mod, req.act);

                player.getExchangePointsProgress('arena', 1);

                player.doOpenSeven('arenaRank', 1);
                player.doOpenHoliday('arenaRank', 1);
            }

            onHandled();
        }

        requestWorld(req, resp, function () {
            callback(player, resp);
        });

        return;
    } while (false);

    onHandled();
};

// 排行榜
exports.rank_list = function (player, req, resp, onHandled) {
    req.act = 'total_rank_list';
    requestWorld(req, resp, onHandled);
};

// 获取战报
exports.get_report = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status == 'fight_arena') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (!req.args.uid || isNaN(req.args.uid)) {
            resp.code = 1; resp.desc = 'no uid'; break;
        }

        requestWorld(req, resp, function () {
            var report = [];
            for (var i = 0; i < resp.data.report.length; i++) {
                var v = resp.data.report[i];
                if (!v[6].includes("NaN")) {
                    report.push(v);
                }
            }

            resp.data.report = report;

            onHandled();
        });
        return;

        return;
    } while (false);

    onHandled();
};

exports.get_replay = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = req.args.type;
        if (!type) {
            resp.code = 1; resp.desc = 'no type'; break;
        }

        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

// 领取竞技场成就奖励
exports.get_achievement_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.type || !req.args.level) {
            resp.code = 1; resp.desc = 'no type or level'; break;
        }

        var type = req.args.type;
        var level = req.args.level;

        if (TYPE_LIST.indexOf(type) == -1) {
            resp.code = 1; resp.desc = 'not this arena'; break;                 // 应该是获取跨服竞技场中的数据
        }

        var conf = gConfArenaAchievement[type][level];
        if (!conf) {
            resp.code = 1; resp.desc = 'conf not found'; break;
        }

        var arena = user.arena;

        // 检查奖励是否已领取
        if (!arena.award_got[type]) {
            arena.award_got[type] = [];
            player.markDirty(util.format('arena.award_got.%d', type));
        }

        if (arena.award_got[type].indexOf(level) >= 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查成就是否达成
        var bFinish = false;
        if (arena.max_rank <= conf.count) {
            bFinish = true;
        }

        if (!bFinish) {
            resp.code = 1; resp.desc = 'not finish'; break;
        }

        resp.data.awards = player.addAwards(conf.award, req.mod, req.act);

        arena.award_got[type].push(level);
        player.markDirty(util.format('arena.award_got.%d', type));

        player.doGuideTask('arenaAchievement', 1);
    } while (false);

    onHandled();
};

/** 扫荡 */
exports.sweep = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'arena11')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var type = req.args.type;
        if (!type) {
            type = ArenaType.THIS;
        }

        if (user.arena.count < gConfGlobalNew.arenaMaxCount) {
            user.arena.count++;
            player.markDirty('arena.count');
        } else {
            var cost = [['user', 'atoken', -1]];
            if (!player.checkCosts(cost)) {
                resp.code = 1; resp.desc = 'material not enough'; break;
            }

            resp.data.costs = player.addAwards(cost, req.mod, req.act);
        }

        resp.data.awards = player.addAwards(gConfArenaBase[type].award, req.mod, req.act);

        user.arena.challenge_cd = common.getTime() + gConfGlobal.arenaChallengeCD * 60;
        player.markDirty('arena.challenge_cd');
        resp.data.challenge_cd = user.arena.challenge_cd;
        player.doDailyTask('arena', 1);
        player.doOpenHoliday('arena', 1);
        user.arena.win_times += 1;
        player.markDirty('arena.win_times');
    } while (false);

    onHandled();
};
