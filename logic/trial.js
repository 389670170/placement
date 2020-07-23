// 秘境矿洞

// 根据参与等级获取试炼配置
function getTrialBaseConf(join_level) {
    var fit_level = 1;
    var pre_key = 1;
    for (var k in gConfLegionTrialBaseConfig) {
        fit_level = pre_key;
        if (k > join_level) {
            break;
        } else if (k == join_level) {
            fit_level = parseInt(k);
        }

        pre_key = parseInt(k);
    }

    var conf = gConfLegionTrialBaseConfig[fit_level];
    return conf;
}

// 进入试炼
exports.enterTrial = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_trial')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var trialData = user.trial;
        if (trialData.join_level == 0) {
            trialData.join_level = user.status.level;
            player.markDirty('trial.join_level');
        }

        resp.data.trial = trialData;
        resp.data.adventure_rand = user.adventure_rand;

    } while (false);

    onHandled();
};

// 随机出一个怪物星级
function random_monster_star(user) {
    var baseConf = getTrialBaseConf(user.trial.join_level);
    var weights = baseConf.crackpotStarWeight;
    var totalWeight = 0;
    for (var i = 0; i < weights.length; i++) {
        totalWeight += weights[i];
    }

    var randWeight = common.randRange(1, totalWeight);
    var tmp = 0;
    var star = -1;
    for (var i = 0; i < weights.length; i++) {
        if (tmp > randWeight) {
            star = i - 1;
            break;
        }
        tmp += weights[i];
    }

    if (star == -1) {
        star = weights.length - 1;
    }

    return star + 1;
}

function explore_once(user, trialData, resp, explore_count) {
    // 随机出一个硬币
    var coin = Math.floor(common.randRange(1, 9));
    var round = Math.ceil((explore_count + 1) / 9);
    if (round == 0) {
        round = 1;
    }
    if (round > 3) {
        round = 3;
    }

    if (!trialData.round[round]) {
        trialData.round[round] = {};
        trialData.round[round].reset_count = 0;
        trialData.round[round].award_got = 0;
        trialData.round[round].coins = {};

        for (var i = 1; i < 9; i++) {
            trialData.round[round].coins[i] = 0;
        }
    }

    var coinIndex = explore_count % 9 + 1;

    trialData.round[round].coins[coinIndex] = coin;

    var award = [];

    var adventure_type = user.adventure_rand[explore_count + 1];
    if (adventure_type > 0) {
        var param1 = 0;
        var param2 = 0;
        var param3 = 0;

        var baseConf = getTrialBaseConf(trialData.join_level);

        if (adventure_type == AdventureType.monster) {
            // 挑战怪人
            var maxFF = user.mark.max_fight_force_no_extra;
            var min = baseConf.crackpotDegree[0] * 100;
            var max = baseConf.crackpotDegree[1] * 100;
            var factor = common.randRange(min, max);
            param1 = Math.floor(maxFF * factor/100);
            param2 = random_monster_star(user);
        } else if (adventure_type == AdventureType.shop) {
            // 商人
            param1 = baseConf.businessmanAwardId;
            var maxIndex = Object.keys(gConfLegionTrialGoods[param1]).length;
            var goodsIndex = Math.floor(common.randRange(1, maxIndex));
            param2 = goodsIndex;
        } else if (adventure_type == AdventureType.cash) {
            param1 = baseConf.goldAward;
            award = param1;
        }

        var adventureObj = {};
        adventureObj.type = adventure_type;
        adventureObj.param1 = param1;
        adventureObj.param2 = param2;
        adventureObj.param3 = param3;
        adventureObj.pass = 0;
        adventureObj.award_got = 0;
        adventureObj.time = common.getTime() + gConfLegionTrialAdventure[adventure_type].duration * 3600;

        var curAdventureCount = Object.keys(trialData.adventure).length;
        if (!curAdventureCount) {
            curAdventureCount = 0;
        }

        curAdventureCount += 1;
        trialData.adventure[curAdventureCount] = adventureObj

        resp.data.adventure[curAdventureCount] = adventureObj;
    }

    var retObj = {}
    retObj.coin = coin;
    retObj.award = award;

    return retObj;
}

// 探索1次
exports.explore = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 检查今日次数是否已达上限
        var trialData = user.trial;
        if (trialData.explore_count >= TrialExploreMaxCount) {
            resp.code = 1; resp.desc = 'has explore max count'; break;
        }

        resp.data.adventure = {};

        var awards = [];

        // 随机出一个硬币
        var ret = explore_once(user, trialData, resp, trialData.explore_count);
        resp.data.coin = ret.coin;
        trialData.explore_count += 1;
        awards = awards.concat(ret.award);

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        player.markDirty("trial");

    } while (false);

    onHandled();
};

// 一键探索
exports.explore_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var trialData = user.trial;
        if (trialData.explore_count >= TrialExploreMaxCount) {
            resp.code = 1; resp.desc = 'has explore max count'; break;
        }

        resp.data.adventure = {};
        resp.data.coins = {};

        var awards = [];
        var awardObj = {};
        awardObj.awards = awards;

        for (var i = 0; i < TrialExploreMaxCount; i++) {
            if (i < trialData.explore_count) {
                continue;
            }

            var ret = explore_once(user, trialData, resp, i);
            awards = awards.concat(ret.award);

            resp.data.coins[i + 1] = ret.coin;
        }

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        trialData.explore_count = TrialExploreMaxCount;

        player.markDirty("trial");
    } while (false);

    onHandled();
};

// 一键探索
exports.explore_round = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var trialData = user.trial;
        if (trialData.explore_count >= TrialExploreMaxCount) {
            resp.code = 1; resp.desc = 'has explore max count'; break;
        }

        resp.data.adventure = {};
        resp.data.coins = [];

        var awards = [];
        var awardObj = {};
        awardObj.awards = awards;

        var round = Math.ceil((trialData.explore_count + 1)/9);
        var roundMax = round * 9;

        for (var i = 0; i < TrialExploreMaxCount; i++) {
            if (i < trialData.explore_count) {
                continue;
            }

            if (i >= roundMax) {
                continue;
            }

            var ret = explore_once(user, trialData, resp, i);
            awards = awards.concat(ret.award);

            resp.data.coins.push(ret.coin);
        }

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        trialData.explore_count = round * 9;;

        player.markDirty("trial");
    } while (false);

    onHandled();
};

// 重置硬币
exports.reset_explore_coin = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var round = req.args.round;
        var index = req.args.index;
        if (isNaN(round) || isNaN(index)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var trialData = user.trial;

        var oldCoin = trialData.round[round].coins[index];
        if (oldCoin < 1 || oldCoin > 9) {
            resp.code = 1; resp.desc = 'can not reset'; break;
        }

        if (trialData.round[round].award_got > 0) {
            resp.code = 1; resp.desc = 'award has got, can not reset'; break;
        }

        var maxCount = Object.keys(gConfBuy).length;
        var times = trialData.round[round].reset_count + 1;
        if (times >= maxCount) {
            times = maxCount;
        }

        var costs = gConfBuy[times].trialCoinReset;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cash not enough'; break;
        }

        var coin_pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        coin_pool.remove(oldCoin);

        var newIndex = common.randRange(0, coin_pool.length - 1);
        var newCoin = coin_pool[newIndex];

        trialData.round[round].coins[index] = newCoin;
        trialData.round[round].reset_count += 1
        resp.data.new_coin = newCoin;

        // 扣除元宝
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

        player.markDirty('trial.round');

    } while (false);

    onHandled();
};

// 获取奖励倍数
function getAwardFactor(round, trialData) {
    // 计算奖励倍数
    var factor = 1; // 基础倍数为1

    // 检查成就是否达成
    for (var i = 0; i < TrialExploreCondition.length; i++) {
        var reach = true;
        var firstCoin = 0;
        for (var j = 0; j < 3; j++) {
            var index = TrialExploreCondition[i][j];

            if (firstCoin == 0) {
                firstCoin = trialData.round[round].coins[index];
            }

            if (firstCoin == 0 || trialData.round[round].coins[index] != firstCoin) {
                reach = false;
                break;
            }
        }

        if (reach) {
            var addFactor = gConfLegionTrialCoinIncreaseType[TrialExploreCondition[i][3]].awardIncrease;
            if (!addFactor || addFactor < 0) {
                addFactor = 0;
            }
            factor += addFactor;
        }
    }

    // 检查是否全部不一样
    var allDiff = true;
    var existArr = [];
    for (var i = 1; i <= 9; i++) {
        if (existArr.indexOf(trialData.round[round].coins[i]) >= 0) {
            allDiff = false;
            break;
        }
        existArr.push(trialData.round[round].coins[i]);
    }

    if (allDiff) {
        var addFactor = gConfLegionTrialCoinIncreaseType[4].awardIncrease;
        if (!addFactor || addFactor < 0) {
            addFactor = 0;
        }
        factor += addFactor;
    }

    return factor;
}

// 领取探索奖励
exports.get_explore_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var round = req.args.round;
        if (isNaN(round) || round < 1 || round > 3) {
            resp.code = 1; resp.desc = 'args round needed'; break;
        }

        var trialData = user.trial;

        // 检查这轮的奖励是否已经领取
        if (trialData.round[round].award_got > 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查这轮是否都已经开启
        var allOpen = true;
        for (var i = 1; i < 9; i++) {
            if (trialData.round[round].coins[i] == 0) {
                allOpen = false;
                break;
            }
        }

        if (allOpen == false) {
            resp.code = 1; resp.desc = 'coins not all open'; break;
        }

        // 计算奖励倍数
        var factor = getAwardFactor(round, trialData);

        var baseConf = getTrialBaseConf(trialData.join_level);
        var coinCount = Math.floor(baseConf.coinBaseAward * factor);

        trialData.daily_score += coinCount;
        trialData.week_score += coinCount;

        var awards = [['user', 'trial_coin', coinCount]];

        player.doDailyTask('uncharted', 1);

        trialData.round[round].award_got = 1;
        player.markDirty('trial');

        resp.data.daily_score = trialData.daily_score;
        resp.data.week_score = trialData.week_score;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);

    } while (false);

    onHandled();
};

// 领取成就奖励
exports.get_achievement_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index) || isNaN(index)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var trialData = user.trial;
        var baseConf = getTrialBaseConf(trialData.join_level);
        if (!baseConf) {
            resp.code = 1; resp.desc = 'config error'; break;
        }

        var achievementId = baseConf.achievementId;

        if (!gConfLegionTrialAchievement[achievementId] ||
            !gConfLegionTrialAchievement[achievementId][index]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 检查是否已领取
        if (trialData.achievement.indexOf(index) >= 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查成就是否已达成
        var needNum = gConfLegionTrialAchievement[achievementId][index].needIntegral;
        var hasNum = trialData.week_score;
        if (hasNum < needNum) {
            resp.code = 1; resp.desc = 'not reach'; break;
        }

        // 发奖
        var awards = gConfLegionTrialAchievement[achievementId][index].award;

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        trialData.achievement.push(index);

        player.markDirty('trial.achievement');
    } while (false);

    onHandled();
};

// 领取每日宝箱
exports.get_daily_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var trialData = user.trial;
        var baseConf = getTrialBaseConf(trialData.join_level);
        if (!baseConf) {
            resp.code = 1; resp.desc = 'config error'; break;
        }

        var needScore = baseConf.dayAwardNeedIntegral;
        if (trialData.daily_score < needScore) {
            resp.code = 1; resp.desc = 'score not enough'; break;
        }

        var dropId = baseConf.dayAwardLootId;
        var dropAwards = generateDrop(dropId);
        resp.data.awards = player.addAwards(dropAwards,req.mod,req.act);
        trialData.daily_award_got = 1;
        player.markDirty('trial.daily_award_got');

        player.doDailyTask('uncharted', 1)
    } while (false);

    onHandled();
};

// 开始陪玩
exports.start_challenge_monster = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var trialData = user.trial;
        if (trialData.adventure[index].pass > 0) {
            resp.code = 1; resp.desc = 'has pass'; break;
        }

        var robotFF = trialData.adventure[index].param1;

        // 生成阵容数据
        var fightInfo = generateRobot(2, user.status.level, robotFF, user.mark.max_fight_force);

        // 设定小兵等级
        var mPos = 1;
        for (var pos in user.pos) {
            if (!user.pos.hasOwnProperty(pos)) {
                continue;
            }

            fightInfo[mPos].soldier_level = user.pos[pos].soldier.level;
            mPos += 1;
        }

        resp.data.trial_robot = fightInfo;
    } while (false);

    onHandled();
};

// 领取陪玩奖励
exports.get_monster_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var trialData = user.trial;

        if (!trialData.adventure[index]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (trialData.adventure[index].type != AdventureType.monster) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 检查是否已领取
        if (trialData.adventure[index].award_got > 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查是否已通关
        if (trialData.adventure[index].pass == 0) {
            resp.code = 1; resp.desc = 'not pass'; break;
        }

        // 检查是否已过时
        if (common.getTime() > trialData.adventure[index].time) {
            resp.code = 1; resp.desc = 'time over'; break;
        }

        var baseConf = getTrialBaseConf(trialData.join_level);
        var star = trialData.adventure[index].param2;

        // 积分奖励
        var scoreAward = baseConf.crackpotAwardIntegral[star-1];

        // 星级奖励
        var awards = [];
        awards = awards.concat(baseConf['crackpotAward' + star]);
        awards.push(['user', 'trial_coin', scoreAward]);

        trialData.daily_score += scoreAward;
        trialData.week_score += scoreAward;

        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.daily_score = trialData.daily_score;
        resp.data.week_score = trialData.week_score;

        trialData.adventure[index].award_got = 1;
        player.markDirty('trial');
    } while (false);

    onHandled();
};

// 购买商人物品
exports.buy_shop_item = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var trialData = user.trial;

        if (!trialData.adventure[index]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (trialData.adventure[index].type != AdventureType.shop) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 检查是否已领取
        if (trialData.adventure[index].award_got > 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查是否已过时
        if (common.getTime() > trialData.adventure[index].time) {
            resp.code = 1; resp.desc = 'time over'; break;
        }

        var conf = gConfLegionTrialGoods[trialData.adventure[index].param1][trialData.adventure[index].param2];
        if (!conf) {
            resp.code = 1; resp.desc = 'config err'; break;
        }

        var awards = conf.award;
        var costs = conf.cost;

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

        trialData.adventure[index].award_got = 1;

        player.markDirty('trial');
    } while (false);

    onHandled();
};

exports.trial_adventure_before_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1; resp.desc = 'index need'; break;
        }

        var team = req.args.team;
        if (team) {
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

        var rand = Math.floor(common.randRange(100000, 999999));
        player.memData.rand = rand;
        player.memData.fight_time = common.getTime();
        resp.data.rand = rand;
        player.memData.status = 'fight_trial';
    } while(false);

    onHandled();
};

// 挑战结束
exports.trial_adventure_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1;resp.desc = "index error";break;
        }

        if (!req.args.autofight && player.memData.status != 'fight_trial') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var star = req.args.star;
        if (isNaN(star) || star > 3 || star < 0) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        star = Math.floor(+star);

        // 更新奇遇
        if (star > 0) {
            user.trial.adventure[index].pass = 1;
        }

        player.memData.status = 'idle';

        var curTime = common.getTime();
        var battleTime = curTime - player.memData.fight_time;
        if(req.args.autofight)
            battleTime = 0;
        user.trial.adventure[index].time += battleTime;
        player.markDirty('trial');
    } while(false);

    onHandled();
};

// 重置怪人挑战星级
exports.reset_monster_star = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = req.args.index;
        if (isNaN(index)) {
            resp.code = 1; resp.desc = 'index need'; break;
        }

        var trialData = user.trial;

        if (!trialData.adventure[index]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (trialData.adventure[index].type != AdventureType.monster) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 检查是否已领取
        if (trialData.adventure[index].award_got > 0) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        // 检查是否已通关
        if (trialData.adventure[index].pass == 1) {
            resp.code = 1; resp.desc = 'not pass'; break;
        }

        // 检查是否已过时
        if (common.getTime() > trialData.adventure[index].time) {
            resp.code = 1; resp.desc = 'time over'; break;
        }

        var times = trialData.adventure[index].param3 + 1;
        var costs = gConfBuy[times].trialCrackpotReset;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cash not enough'; break;
        }

        var newStar = random_monster_star(user);
        trialData.adventure[index].param2 = newStar;
        trialData.adventure[index].param3 += 1;
        player.markDirty(util.format('trial.adventure.%d', index));

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.new_star = newStar;
    } while (false);

    onHandled();
};