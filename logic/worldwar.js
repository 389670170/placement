exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var openTime = gConfGlobalServer.worldWarOpenTime;
        if (!openTime || common.getTime() < openTime) {
            resp.code = 1; resp.desc = 'worldwar is not open'; break;
        }

        if (!isModuleOpen_new(player, 'worldwar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var fightForce = player.getFightForce();
        var worldwar = user.worldwar;
        var updateData = {};

        // 如果本周还没进入过跨服战，或者此玩家已经注册，
        // 并且当前内存数据没有同步到worldwar服过
        if (true || !worldwar.sign_up || (!player.memData.updated_worldwar && worldwar.registed)) {
            var tmpData = mapObject(user, gInitWorldUser);
            updateData = mapObject(tmpData, gWorldWarUser);
            /*
            for (var p in user.pos) {
                updateData.pos[p].equip = {};
                for (var type in user.pos[p].equip) {
                    var eid = user.pos[p].equip[type];
                    if (eid) {
                        if (user.bag.equip[eid]) {
                            updateData.pos[p].equip[type] = {
                                id : user.bag.equip[eid].id,
                                god : user.bag.equip[eid].god,
                                god_id : user.bag.equip[eid].god_id,
                            };
                        }
                    }
                }
            }*/

            player.memData.updated_worldwar = 1;
        } else if (worldwar.registed) {
            updateData = player.mapWorldWarDirty(updateData);
            /*
            for (var pos in player.memData.pos) {
                for (var type in player.memData.pos[pos].uni_equip_changed) {
                    var eid = player.user.pos[pos].equip[type];
                    if (eid) {
                        var equip = player.user.bag.equip[eid];
                        updateData['pos.'+pos+'.equip.'+type] = {
                            id : equip.id,
                            god : equip.god,
                        };
                    } else {
                        updateData['pos.'+pos+'.equip.'+type] = null;
                    }
                }
                player.memData.pos[pos].uni_equip_changed = {};
            }
           */ 
        }

        var score = 0;
        var stages = Object.keys(gConfWorldWarScore);
        stages.sort(function(a, b){return (+a)-(+b)});
        // 玩家本周未进过跨服战
        if (!worldwar.sign_up) {
            for (var i = 0, len = stages.length; i < len; i++) {
                var scoreConf = gConfWorldWarScore[stages[i]];
                if (fightForce <= scoreConf.fightForce) {
                    break;
                }
                else
                {
                    score = scoreConf.score;
                }
            }
        }

        if (score == 0) {
            score = gConfWorldWarScore[stages[0]].score;
        }

        var matched = worldwar.matched;
        if (worldwar.fighted) {
            matched = 0;
        }

        var worldWarRequest = {
            uid: req.uid,
            mod: 'worldwar',
            act: 'get',
            args: {
                user : updateData,
                score: score,
                matched : matched,
                server_id : config.ServerId,
            }
        };

        requestWorldWar(worldWarRequest, resp, function(){
            if (resp.code == 0) {
                var count = +resp.data.count;
                var progress = resp.data.progress;
                if (!worldwar.sign_up) {
                    worldwar.sign_up = 1;
                    player.markDirty('worldwar.sign_up');
                }
                if (!worldwar.registed && resp.data.rank) {
                    worldwar.registed = 1;
                    player.markDirty('worldwar.registed');
                    if(progress == 'rank' && worldwar.matched) {
                        player.memData.enemy_id = worldwar.matched;
                    }
                }
                resp.data.worldwar = worldwar;

                var fightInfo = resp.data.fight_info;
                if (fightInfo) {
                    player.memData.status = 'prepare_ww_third';
                    player.memData.rand1 = fightInfo.rand1;
                    player.memData.rand2 = fightInfo.rand2;
                    player.memData.fight_info = fightInfo.info;
                    player.memData.fight_enemy = fightInfo.enemy;
                    player.memData.ww_record_third_pos = resp.data.pos;

                    var randPos = common.randRange(1, player.memData.pos_count);
                    var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                    fightInfo.fight_time = player.memData.fight_time = common.getTime();
                    fightInfo.rand_pos = player.memData.rand_pos = randPos;
                    fightInfo.rank_attrs = player.memData.rand_attrs = randAttrs;
                }

                player.doDailyTask('hegemony', 1);
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.get_rank_list = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.get_score_rank_list = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.match_enemy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'worldwar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var worldwar = user.worldwar;

        requestWorldWar(req, resp, function(){
            if(resp.code == 0) {
                worldwar.match++;
                worldwar.matched = 0;
                if (resp.data.enemy) {
                    worldwar.matched = resp.data.enemy.uid;
                }

                worldwar.fighted = 0;
                player.markDirty('worldwar.match');
                player.markDirty('worldwar.matched');
                player.markDirty('worldwar.fighted');

                player.memData.enemy_id = worldwar.matched;
            }
            onHandled();
        });

        return;
    }while(false);

    onHandled();
};

exports.challenge = function(player, req, resp, onHandled) {
    var user = player.user;
    var isCash = req.args.cash ? 1 : 0;
    var worldwar = user.worldwar;
    do {
        if (isNaN(req.args.enemy) || !req.args.enemy) {
            resp.code = 1; resp.desc = "no enemy"; break;
        }

        if (!isCash && worldwar.battle >= +gConfGlobalNew['worldwarBattleLimitPerDay']) {
            resp.code = 1; resp.desc = "reach battle limit"; break;
        }

        if (isCash && worldwar.battle < +gConfGlobalNew['worldwarBattleLimitPerDay']) {
            resp.code = 1; resp.desc = "free now"; break;
        }

        if (isCash) {
            var costs = parseAwardsConfig(gConfGlobalNew['worldwarBuyBattle']);
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'not enough cash'; break;
            }
        }

        if (!req.args.revenge) {
            if (user.worldwar.matched != req.args.enemy) {
                resp.code = 1; resp.desc = "enemy not matched"; break;
            }

            if (user.worldwar.fighted) {
                resp.code = 1; resp.desc = "has fighted"; break;
            }
        }

        requestWorldWar(req, resp, function(){
            if (resp.code == 0) {
                if (!req.args.revenge) {
                    player.memData.status = 'prepare_ww_match';
                } else {
                    player.memData.status = 'prepare_ww_revenge';
                }
                player.memData.use_cash = isCash;
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
        });

        return;
    } while(false);

    onHandled();
};

// 挑战结束
exports.fight = function(player, req, resp, onHandled) {
    var user = player.user;
    var worldwar = user.worldwar;
    do {
        if (player.memData.status != 'prepare_ww_match' && player.memData.status != 'prepare_ww_revenge') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (!req.args.enemy || isNaN(req.args.enemy)) {
            resp.code = 1; resp.desc = 'no enemy'; break;
        }

        if (req.args.enemy != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        if (req.args.revenge) {
            if(isNaN(req.args.rindex) || req.args.rindex < 0) {
                resp.code = 1; resp.desc = 'no rindex'; break;
            }
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        // TODO 验证战斗
        //var report = parseFightReport(report, this.memData.rand);
        //if(!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if(!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        var costs = [];
        if (player.memData.use_cash) {
            costs = parseAwardsConfig(gConfGlobalNew['worldwarBuyBattle']);
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'not enough cash'; break;
            }
        }

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

        req.args.star = star;
        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };
        requestWorldWar(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'idle';
                player.memData.enemy_id = 0;
                worldwar.matched = 0;
                worldwar.fighted = 1;
                worldwar.battle++;
                player.markDirty('worldwar.fighted');
                player.markDirty('worldwar.battle');
                player.markDirty('worldwar.matched');

                resp.data.costs = player.addAwards(costs, req.mod,req.act);
                player.memData.use_cash = 0;

                var id = star > 0 ? 2 : 1;
                resp.data.awards = player.addAwards(generateDrop(gConfWorldWarBattle[id].dropId, user.status.level),req.mod,req.act);
            }
            onHandled();
        });

        return;
    } while(false);

    onHandled();
};

exports.get_replay_list = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.get_replay = function(player, req, resp, onHandled) {
    if( isNaN(req.args.id) || !req.args.id) {
        resp.code = 1; resp.desc = 'no id'; onHandled(); return;
    }

    requestWorldWar(req, resp, function(){
        onHandled();
    });
};

exports.get_report = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.support = function(player, req, resp, onHandled) {
    var user = player.user;
    var worldwar = user.worldwar;
    var supportUid = req.args.id;

    do {
        if (!isModuleOpen_new(player, 'worldwar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (isNaN(supportUid) || !supportUid) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var worldWarRequest = {
            uid: req.uid,
            mod: 'worldwar',
            act: 'support',
            args: {
                id: supportUid,
                gold : gConfLevel[user.status.level].goldAward,
            }
        };
        requestWorldWar(worldWarRequest, resp, function () {
            if (resp.code == 0) {
                var awards = parseAwardsConfig(gConfGlobalNew.worldwarSupportAward);
                resp.data.awards = player.addAwards(awards, req.mod, req.act);
            }

            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.exploit_wall = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.get_exploit_award = function(player, req, resp, onHandled) {
    var user = player.user;
    var worldwar = user.worldwar;

    do {
        if (!isModuleOpen_new(player, 'worldwar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (!req.args.type || !req.args.target) {
            resp.code = 1; resp.desc = 'args error'; break;
        }
        var type = req.args.type;
        var target = +req.args.target;
        if (!gConfExploitWall[type] || !gConfExploitWall[type][target]) {
            resp.code = 1; resp.desc = 'type or target error'; break;
        }

        requestWorldWar(req, resp, function(){
            if (resp.code == 0) {
                resp.data.awards = player.addAwards(gConfExploitWall[type][target].awards,req.mod,req.act);
            }

            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.price_rank = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.get_records = function(player, req, resp, onHandled) {
    requestWorldWar(req, resp, onHandled);
};

exports.get_team = function(player, req, resp, onHandled) {
    var user = player.user;

    req.args.pve_team = user.team[1];

    requestWorldWar(req, resp, onHandled);
};

exports.set_team = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        var skills = req.args.skills;
        if (!team || !skills) {
            resp.code = 1; resp.desc = 'no team or no skills'; break;
        }

        var valid = true;
        for (var pos in team) {
            var slot = Math.floor(team[pos]);
            if (!user.hero_bag.heros[pos] || slot < 1 || slot > MaxSlot) {
                valid = false; break;
            }
        }
        if (!valid) {
            resp.code = 1; resp.data = 'invalid team'; break;
        }

        if (!util.isArray(skills)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var length = skills.length;
        if (length <= 0 || length > gConfGlobal.maxPlayerSkill) {
            resp.code = 1; resp.desc = 'length error'; break;
        }

        var ok = true;
        var test = [];
        var dragon = user.dragon;
        for (var i = 0; i < length; i++) {
            var skill = skills[i];
            skill = Math.floor(+skill);
            if (!skill) continue;

            if (!dragon[skill]) {
                ok = false; break;
            }
            if (test.indexOf(skill) >= 0) {
                ok = false; break;
            }
            if (i > gConfLevel[user.status.level].skillNum) {
                ok = false; break;
            }

            test.push(skill);
        }

        if (!ok) {
            resp.code = 1; resp.desc = 'skills error'; break;
        }

        req.args.skills = test;

        requestWorldWar(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

exports.prepare = function(player, req, resp, onHandled) {
    do {
        requestWorldWar(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'prepare_ww_final';
                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;
                player.memData.ww_record_pos = resp.data.pos;

                var randPos = common.randRange(1, player.memData.pos_count);
                var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                resp.data.fight_time = player.memData.fight_time = common.getTime();
                resp.data.rand_pos = player.memData.rand_pos = randPos;
                resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.prepare_fight = function(player, req, resp, onHandled) {
    do {
        var star = req.args.star;
        if ([0, 1, 2, 3].indexOf(star) == -1) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        if (player.memData.status != 'prepare_ww_final' && player.memData.status != 'prepare_ww_third') {
            resp.code = 1; resp.desc = "star error"; break;
        }

        // TODO 战斗校验

        if (player.memData.status == 'prepare_ww_final') {
            req.args.pos = player.memData.ww_record_pos;
        } else {
            req.args.pos = player.memData.ww_record_third_pos;
        }
        req.args.status = player.memData.status;
        req.args.replay = {
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
        };
        requestWorldWar(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'idle';
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.worship = function (player, req, resp, onHandled) {
    var worldwar = player.user.worldwar;

    if (!worldwar.hasOwnProperty('worship')) {
        worldwar.worship = 0;
        player.markDirty('worldwar.worship');
    }

    do {
        requestWorldWar(req, resp, function() {
            if (resp.code == 0) {
                var awards = parseAwardsConfig(gConfGlobalNew.worldwarWorshipAward);
                resp.data.awards = player.addAwards(awards, req.mod, req.act);

                worldwar.worship = 1;
                player.markDirty('worldwar.worship');
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};