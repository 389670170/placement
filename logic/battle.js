var FightType = {
    'NORMAL': 1,                // 普通
    'ELITE': 2,                 // 精英
    'HARD': 3,                 // 噩梦
};

/**
 * 占领、战斗之前、战斗之后、自动战斗时调用
 * @param player
 * @param cid       城池ID
 * @param type      FightType
 * @param time      当日挑战次数
 * @param ff
 * @param levels
 * @returns {*}
 */
function checkBeforeFight(player, cid, type, time, ff, levels) {
    var typeOk = false;
    for (var t in FightType) {
        if (FightType[t] == type) {
            typeOk = true;
            break;
        }
    }

    if (!typeOk) {
        return 'type error';
    }

    var user = player.user;
    var cityConf = gConfCustom[cid];
    var battle = user.battle;
    var city = battle.city[cid];

    if (!cityConf) {
        return 'invalid city id';
    }

    // 是否开启功能
    if (type == FightType['NORMAL']) {
        if (cid > battle.progress + 1 || cid > battle.max_progress) {
            return 'no reach the city';
        }

        if (!city[FightType.NORMAL].star) {
            if (user.status.level < cityConf.level) {
                return 'not enough level';
            }
        }
    }
    else { // 精英，噩梦
        if (type == FightType['ELITE']) {
            if (!isModuleOpen_new(player, 'elite')) {
                return 'not open';
            }
            if (cid > 1) {
                if (battle.city[cid - 1][FightType['ELITE']] == 0) {
                    return 'no reach the city';
                }
            }
        }
        else if (type == FightType['HARD']) {
            if (!isModuleOpen_new(player, 'hard')) {
                return 'not open';
            }
            if (cid > 1) {
                if (battle.city[cid - 1][FightType['hard']] == 0) {
                    return 'no reach the city';
                }
            }
        }
        if (cid > battle.progress) {
            return 'no reach the city';
        }
    }

    if (type == FightType['NORMAL'] || type == FightType['ELITE'] || type == FightType['HARD']) {
        var key = '';
        if (type == FightType['NORMAL']) key = 'customNormalCost';
        if (type == FightType['ELITE']) key = 'customEliteCost';
        if (type == FightType['HARD']) key = 'customHardCost';
        if (isNaN(time) || time < 1 || time > 10) {
            return "invalid time";
        }

        if (!player.checkFightforce(ff, levels)) {
            return 9;
        }

        if (city[type].star > 0) {
            var costs = parseAwardsConfig(gConfGlobalNew[key]);
            if (!player.checkCosts(costs)) {
                return 101;
            }
        }

        var cityInfo = city[type];

        if (cityConf['limit'][type - 1] == 0) {
            if (cityInfo.time > 0) {
                return 'reach the limit time 111';
            }
        } else if (cityInfo.time + time > cityConf['limit'][type - 1]) {
            DEBUG('cityInfo.time = ' + cityInfo.time + ', time = ' + time);
            return 'reach the limit time 222';
        }
    }

    // if (cityConf['drop' + type]) {
    //     if (gConfDrop[cityConf['drop' + type]].isEquip) {
    //         if (player.memData.equip_num >= user.equip_valume) {
    //             return 5;
    //         }
    //     }
    // }

    return null;
}

// battle内所有战斗之前都调用
exports.before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var progress = req.args.progress;
        var type = req.args.type;
        var team = req.args.team;

        var desc = null;

        if (user.battle.type != type || user.battle.progress != progress) {
            resp.code = 1; resp.desc = desc; break;
        }

        if (team) {
            if (!player.syncTeam(1, team)) {
                resp.code = 1; resp.desc = 'args error'; break;
            }
        }

        var rand = Math.floor(common.randRange(100000, 999999));
        var rand_enc = tower_encrypt(rand.toString(), pubKey);

        player.memData.rand_origin = rand;
        player.memData.rand = rand_enc;
        player.memData.fight_time = common.getTime();

        resp.data.rand = rand_enc;
    } while (false);

    onHandled();
};

exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var progress = req.args.progress;
        var type = req.args.type;
        var success = req.args.success; // 0/1
        var time = req.args.time;
        var sign = req.args.sign;
        //var ff = +req.args.ff;

        if (isNaN(success)) {
            resp.code = 1; resp.desc = "invalid star"; break;
        }

        if (user.battle.progress != progress) {
            resp.code = 1; resp.desc = "invalid waigua"; break;
        }

        if (!time || !sign) {
            resp.code = 1;
            resp.desc = "invalid id";
            break;
        }

        // var desc = null;
        // if (desc = checkBeforeFight(player, cityId, type, 1, +req.args.ff, +req.args.levels)) {
        //     if (desc == 5 && star > 0) {
        //         resp.code = desc; resp.desc = 'equip full'; break;
        //     } else if (desc == 9 && star > 0) {
        //         resp.code = desc; resp.desc = 'invalid fight'; break;
        //     } else {
        //         resp.code = 1; resp.desc = desc; break;
        //     }
        // }

        // checking
        // if (type == FightType['NORMAL']) {
        //     var ff = +req.args.ff;

        //     // player.markFightForceChangedAll();

        //     //if (isNaN(ff) || ff > player.getFightForce() * 1.1 || !player.check_attrs(req.args.attrs)) {
        //     //DEBUG(`FightForce checking: ${ff}, ${player.getFightForce() * 1.1}`)
        //     // old resp.code = 999; resp.desc = "invalid_fight_force"; break;
        //     //}
        // }

        var ff = +req.args.ff;

        if (user.status.level && user.status.level > 30)
        {
            if (isNaN(ff) || ff > player.getFightForce() * 1.5) {
                DEBUG(`FightForce checking: ${ff}, ${player.getFightForce()}, ${req.uid}`)
                resp.code = 999; resp.desc = "invalid_fight_force"; 
                break;
            }
        }

        var rand_origin = player.memData.rand_origin;
        var dec_sign = tower_decrypt(sign, priKey);

        // 验证战斗
        var serverSign = getBattleFightSign('battle', req.uid, time, success, rand_origin);
        DEBUG(`battle fight: ${dec_sign} ${serverSign} ${sign}`)
        // if (serverSign != dec_sign) {
        //     resp.code = 999;
        //     resp.desc = "sign not match";
        //     break;
        // }

        // TODO 验证战斗
        //var report = parseFightReport(req.args.report, this.memData.rand);
        //if (!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if (!report.id || report.id != cityId ||
        //      !report.type || report.type != type ||
        //      !report.star !! report.star != star) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if (!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        var battle = user.battle;
        var cityConf = gConfCustomSet[type][progress + 1];
        var awardConf = gConfCustomSet[type][progress];

        if (awardConf.challengeLimit == 'level' && user.status.level < awardConf.target) {
            resp.code = 1; resp.desc = "levle limit"; break;
        }

        var costs = [];

        if (success <= 0) {
            if (!player.user.misc.city_failed_times) {
                player.user.misc.city_failed_times = 0;
            }

            if (player.user.misc.city_failed_times > 0) {
                player.user.misc.city_failed_times++;
            }

            player.user.misc.city_failed_times++;
            player.markDirty('misc.city_failed_times');
        }

        // 计算消耗
        if (success > 0) {
            player.doDailyTask('battleFight', 1);
            player.doOpenHoliday('battleFight', 1);

            if (cityConf && +cityConf.guideIndex) {
                player.user.mark.guide = 1;
                player.markDirty('mark.guide');
            }
            else {
                player.user.mark.guide = 0;
                player.markDirty('mark.guide');
            }

            // 检查是否有龙获取
            var dragonId = 0;
            for (var id in gConfCustomDragon) {
                var dragConf = gConfCustomDragon[id];
                if (dragConf.limitCustom == progress && dragConf.limitType == type) {
                    dragonId = parseInt(id);
                    break;
                }
            }

            if (dragonId > 0) {
                if (!user.dragon[dragonId]) {
                    user.dragon[dragonId] = {
                        level: 1,
                        slot: {
                            1: 0,
                            2: 0,
                            3: 0,
                            4: 0,
                            5: 0,
                        },
                    };
                    player.markDirty('dragon.' + dragonId);

                    // 通知客户端新获取的龙id
                    resp.data.dragon = dragonId;
                }

                player.markFightForceChangedAll();

                // 检查法老是否解锁，27关解锁法老，不想每次都去遍历了，法老解锁的关卡如果改了，记得修改这里
                for (var elementId in gConfCustomElement) {
                    var elementConf = gConfCustomElement[elementId];
                    if (elementConf) {
                        var customType = elementConf.customType;
                        var customId = elementConf.customId;
                        if (customType == type && customId == progress && elementConf.type == 'glaceman') {
                            user.mark.map_hero_id = parseInt(elementConf.award[0][1]);
                            user.mark.map_hero_timer = common.getTime() + 600;
                            player.markDirty('mark.map_hero_id');
                            player.markDirty('mark.map_hero_timer');
                            break;
                        }
                    }
                }
            }

            // befor progress ++ 
            var typeArr = { 1: 'battle', 2: 'elite', 3: 'hard', 4: 'nightmare', 5: 'hell' };
            player.doTask(typeArr[+type], type * 1000 + user.battle.progress);
            player.doOpenSeven(typeArr[+type], type * 1000 + user.battle.progress);
            player.doOpenHoliday(typeArr[+type], type * 1000 + user.battle.progress);

            player.recordPlay('battle_type' + type, 'progress' + progress, success > 0 ? 1 : 0);

            // 在线奖励通知
            if (type == 1) {
                outline_sync_to_client(player);
            }

            user.battle.progress += 1;
            if (user.battle.progress > 150 && user.battle.type < 5) {
                user.battle.progress = 1;
                user.battle.type += 1;
                player.markDirty('battle.type');
            }

            player.markDirty('battle.progress');
            
            player.onCustomFightWin(progress);

            var old = user.custom_king.index;
            if (player.updateCustomKing() != old) {
                resp.data.custom_king = user.custom_king;
                player.updateHeadFrameStatus('player', player.getQuality());
            }

            player.addCustomWealCash(+awardConf.customWeal);
            var awards = awardConf['first'];
            resp.data.awards = player.addAwards(awards, req.mod, req.act);

            if (progress == 3) {                                            // 第三关奖励英雄直接上阵
                for (var tKey in resp.data.awards.heros) {
                    var tAddPos = player.addToTeam(1, tKey);
                    resp.data.on_team = {};
                    if (!tAddPos) { continue; }
                    resp.data.on_team[tKey] = tAddPos - 0;
                }
            }
        }

        resp.data.type = user.battle.type;
        resp.data.progress = user.battle.progress;

        //resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

// 扫荡
exports.auto_fight = function (player, req, resp, onHandled) {
    return;

    var user = player.user;
    do {
        var cityId = req.args.id;
        var type = req.args.type;
        var time = req.args.time;

        var desc = null;
        if (desc = checkBeforeFight(player, cityId, type, time)) {
            if (desc == 5) {
                resp.code = 5; resp.desc = 'equip full'; break;
            } else if (desc == 101) {
                resp.data.food = user.status.food;
                resp.data.food_red = user.status.food_red;
                resp.code = 101; resp.desc = 'no enough food'; break;
            } else {
                resp.code = 1; resp.desc = desc; break;
            }
        }

        var battle = user.battle;
        var city = battle.city[cityId];
        var cityInfo = city[type];

        if (!cityInfo.star) {
            resp.code = 1; resp.desc = "not enough star"; break;
        }

        var awards = [];
        var costs = [];
        cityInfo.time += time;
        player.markDirty(util.format('battle.city.%d.%d.time', cityId, type));

        // 扫荡消耗
        var sweepCost = [];
        var expAward = [];
        if (type == FightType['NORMAL']) {
            expAward = parseAwardsConfig(gConfGlobalNew.customNormalLootExp);
            sweepCost = parseAwardsConfig(gConfGlobalNew['customNormalCost'])[0];
        } else if (type == FightType['ELITE']) {
            expAward = parseAwardsConfig(gConfGlobalNew.customEliteLootExp);
            sweepCost = parseAwardsConfig(gConfGlobalNew['customEliteCost'])[0];
        } else if (type == FightType['HARD']) {
            expAward = parseAwardsConfig(gConfGlobalNew.customHardLootExp);
            sweepCost = parseAwardsConfig(gConfGlobalNew['customHardCost'])[0];
        }

        var cityConf = gConfCustom[cityId];
        for (var i = 0; i < time; i++) {
            var dropAward = generateDrop(cityConf.drop[type - 1], user.status.level);
            if (dropAward.length > 0) {
                dropAward.unshift(expAward[0]);
                var singleAwards = player.addAwards(dropAward, req.mod, req.act);   // 单次掉落
                awards.push(singleAwards);
            } else {
                awards.push({});
            }

            costs.push(sweepCost);
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }

        player.doDailyTask('battleFight', time);
        player.doOpenHoliday('battleFight', time);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = awards;
    } while (false);

    onHandled();
};

// 重置关卡
exports.reset_battle = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var cityId = req.args.id;
        var type = req.args.type;
        var cityInfo = user.battle.city[cityId];

        if (!cityInfo) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var resetKey = '';
        type == FightType.HARD && (resetKey = 'hardReset');
        type == FightType.ELITE && (resetKey = 'eliteReset');
        type == FightType.NORMAL && (resetKey = 'normalReset');

        var vipResetNum = gConfVip[user.status.vip][resetKey];
        var resetNum = cityInfo[type].reset_num;
        if (resetNum >= vipResetNum) {
            resp.code = 1; resp.desc = 'reset num is not'; break;
        }

        var costs = gConfBuy[resetNum + 1][resetKey];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'no enough cash'; break;
        }
        cityInfo[type].time = 0;
        cityInfo[type].reset_num++;
        player.markDirty(util.format('battle.city.%d.%d', cityId, type));

        resp.data.cityInfo = cityInfo[type];
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

    } while (false);

    onHandled();
}

// 点击获取钥匙
exports.get_custom_key = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var elementId = +req.args.id;
        if (!elementId) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var elementConf = gConfCustomElement[elementId];
        if (!elementConf) {
            resp.code = 1; resp.desc = 'can not find element by id'; break;
        }

        var customType = elementConf.customType;
        var customId = elementConf.customId;
        if (!player.ispassbattle(customType, customId)) {
            resp.code = 1; resp.decs = 'progress not fit'; break;
        }

        if (player.hasGetKey(elementConf.typeId)) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        if (elementConf.type == 'glaceman') {
            if (user.mark.map_hero_id == 0 && user.mark.map_hero_timer == 0) {
                // 领取赠送英雄
                user.mark.map_hero_id = parseInt(elementConf.award[0][1]);
                user.mark.map_hero_timer = common.getTime() + 600;
                player.markDirty('mark.map_hero_id');
                player.markDirty('mark.map_hero_timer');
            }

            resp.data.map_hero_id = user.mark.map_hero_id;
            resp.data.map_hero_timer = user.mark.map_hero_timer;
        } else {
            var awards = elementConf.award;
            resp.data.awards = player.addAwards(awards, req.mod, req.act);

            player.onKeyGetCallback(elementConf.typeId, 1);
        }
    } while (false);

    onHandled();
};

// 领取关卡赠送的英雄
exports.get_map_hero = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.mark.map_hero_id) {
            resp.code = 1; resp.desc = 'no hero can get'; break;
        }

        // -1表示已经领取
        if (user.mark.map_hero_id == -1) {
            resp.code = 1; resp.desc = 'already get'; break;
        }

        // 检查是否到了领取时间
        var curTime = common.getTime();
        if (curTime < user.mark.map_hero_timer) {
            resp.code = 1; resp.desc = 'not time'; break;
        }

        // 查找typeid
        var typeId = null;
        for (var id in gConfCustomElement) {
            if (gConfCustomElement[id].type == 'glaceman') {
                typeId = gConfCustomElement[id].typeId;
                break;
            }
        }

        if (typeId) {
            player.onKeyGetCallback(typeId, 1);
        }

        var awards = [['card', user.mark.map_hero_id, 1]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);

        user.mark.map_hero_id = -1;
        player.markDirty('mark.map_hero_id');
    } while (false);

    onHandled();
};

exports.get_princess = function (player, req, resp, onHandled) {
    var user = player.user
    do {
        if (isModuleOpen_new('princess')) {
            resp.code = 1; resp.desc = 'module not open'; break;
        }

        if (!user.princess.time) {
            user.princess.progress = 1;
            user.princess.time = common.getTime() + gConfCustomPrincess[1].timeLimit * 3600;
            player.markDirty('princess');
        }

        resp.data.princess = user.princess;
    } while (false);

    onHandled();
};

exports.get_princess_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isModuleOpen_new('princess')) {
            resp.code = 1; resp.desc = 'not open or got'; break;
        }

        var conf = gConfCustomPrincess[user.princess.progress];
        if (!conf) {
            resp.code = 1; resp.desc = 'already finish'; break;
        }

        if (!player.ispassbattle(conf.limitType, conf.limitCustom)) {
            resp.code = 1; resp.desc = 'not reach'; break;
        }

        if (user.princess.extra && user.princess.extra[5] && user.princess.extra[5] >= 1) {
            resp.code = 1; resp.desc = 'get all'; break;
        }

        var awards = conf.award.slice();
        if (common.getTime() <= user.princess.time) {
            awards.combine(conf.extraAward);
            user.princess.extra[user.princess.progress] = 1;
        }

        user.princess.progress += 1;
        var nextConf = gConfCustomPrincess[user.princess.progress]
        if (nextConf) {
            user.princess.time = common.getTime() + nextConf.timeLimit * 3600;
        } else {
            user.princess.time = 0;
        }
        player.markDirty('princess');

        resp.data.princess = user.princess;
        resp.data.awards = player.addAwards(awards);
    } while (false);

    onHandled();
};
