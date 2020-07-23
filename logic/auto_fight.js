var logicCommon = require('./common.js');
// 挂机
exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    var auto_fight = player.user.auto_fight;
    var search_task = auto_fight.search_task;
    do {
        // 探索任务
        if (isModuleOpen_new(player, 'exploreTask')) {
            if (search_task.fix != 1) {
                search_task.fix = 1;
                var taskList = search_task.task_list;
                for (var taskid in taskList) {
                    var task = taskList[taskid];
                    var heroObj = player.getHero(task.hid);
                    if (heroObj) {
                        task.hero_star = player.getHeroStar(task.hid);
                        task.rid = heroObj.rid;
                    } else if (task.hid > 0) {
                        task.hero_star = 6;
                        task.rid = 6027;
                    }
                }

                player.markDirty('auto_fight.search_task.task_list');
                player.markDirty('auto_fight.search_task.fix');
            }

            resp.data.task_msg = search_task;
            resp.data.searched_heroes = get_searched_heroes(player);
        }

        // 挂机
        if (isModuleOpen_new(player, 'exploreMonster')) {
            player.calcAutoFight();

            var awards = player.concatAutoFightAwards();
            resp.data.auto_fight = {
                bag: awards,
                speed_num: auto_fight.speed_num,
                monster_level: auto_fight.monster_level,
                last_calc_time: auto_fight.last_calc_time,
                last_get_time: auto_fight.last_get_time,
                last_calc_equip_time: auto_fight.last_calc_equip_time,
                last_get_equip_time: auto_fight.last_get_equip_time,
                first_get: auto_fight.first_get || 0,
            };
        }

        // boss
        if (isModuleOpen_new(player, 'exploreBoss')) {
            resp.data.boss = {
                boss_birth: auto_fight.boss.boss_birth,
                boss_kill_count: auto_fight.boss.boss_kill_count
            };
        }

        // 魔法阵
        //player.calcAutoFightMagic();

        //resp.data.magic = user.auto_fight.magic;

    } while (false);

    onHandled();
};

// 打开挂机背包
exports.open_bag = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        player.calcAutoFight();
        var awards = player.concatAutoFightAwards();
        resp.data.bag = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 加速挂机
exports.speed_up_hook = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 判断加速挂机次数
        var speedNum = user.auto_fight.speed_num;// 已经加速的次数
        if (speedNum >= gConfVip[user.status.vip].exploreAccelerateTimes) {
            resp.code = 1; resp.desc = 'speed up num is not'; break;
        }

        if (!gConfBuy[speedNum + 1]) {
            resp.code = 1; resp.desc = 'config error'; break;
        }

        var cost = gConfBuy[speedNum + 1].exploreAccelerate;// 需要消耗的元宝
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }
        var awards = player.calcAutoFight(gConfExploreBase['exploreAccelerateTime'].value);

        user.auto_fight.speed_num += 1;
        player.markDirty('auto_fight.speed_num');

        player.doDailyTask('exploreSpeedUp', 1)
        logic_event_mgr.emit(logic_event_mgr.EVENT.SPEED_UP, player);

        resp.data.cost = player.addAwards(cost, req.mod, req.act);
        resp.data.awards = player.addAwards(awards, req.mod, req.act)
    } while (false);
    onHandled();
};

// 领取奖励
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        player.calcAutoFight();
        var awards = player.concatAutoFightAwards();
        if (!user.auto_fight.first_get) {
            user.auto_fight.first_get = 1;
            player.markDirty('auto_fight.first_get');
            // 首次挂机
            awards = awards.concat(gConfSpecialReward['first_explore_speed'].reward);
        }


        resp.data.last_calc_time = user.auto_fight.last_calc_time;
        resp.data.last_calc_equip_time = user.auto_fight.last_calc_equip_time;

        resp.data.awards = player.addAwards(awards, req.mod, req.act);

        player.clearAutoFightBag();
        resp.data.last_get_time = user.auto_fight.last_get_time;
    } while (false);

    onHandled();
};

/*// 挑战之前
exports.before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 验证等级是否符合挑战要求
        var monsterLevel = user.auto_fight.monster_level+1;

        var conf = gConfExploreMonster[monsterLevel];

        if (conf.challengeLimit == "level") {
            if (user.status.level < conf.target) {
                resp.code = 1; resp.desc = 'level not'; break;
            }
        } else if (conf.challengeLimit == "power") {
            if (user.mark.max_fight_force < conf.target) {
                resp.code = 1; resp.desc = 'power not'; break;
            }
        } else if (conf.challengeLimit == "custom") {
            var city = user.battle.city[conf.target];
            if (!city || city[1].star <= 0) {
                resp.code = 1; resp.desc = 'custom not'; break;
            }
        } else {
            resp.code = 2; resp.desc = 'unknown limit'; break;
        }

        resp.data.rand = Math.floor(common.randRange(100000, 999999));
    } while (false);

    onHandled();
};

// 挑战
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {

        var monsterLevel = user.auto_fight.monster_level+1;

        var conf = gConfExploreMonster[monsterLevel];

        if (conf.challengeLimit == "level") {
            if (user.status.level < conf.target) {
                resp.code = 1; resp.desc = 'level not'; break;
            }
        } else if (conf.challengeLimit == "power") {
            if (user.mark.max_fight_force < conf.target) {
                resp.code = 1; resp.desc = 'power not'; break;
            }
        } else if (conf.challengeLimit == "custom") {
            var city = user.battle.city[conf.target];
            if (!city || city[1].star <= 0) {
                resp.code = 1; resp.desc = 'custom not'; break;
            }
        } else {
            resp.code = 2; resp.desc = 'unknown limit'; break;
        }

        var star = req.args.star;
        if (star > 0) {
            // 先计算奖励
            player.upgradeMonsterLevel();// 计算小怪等级
            player.calcAutoFight();
            resp.data.bag = player.addAwards(user.auto_fight.bag, req.mod, req.act);
            resp.data.monster_level = user.auto_fight.monster_level;
        }
    } while (false);

    onHandled();
};*/

// --------- 大本营-boss

/**
 * 挑战boss
 * @type  boss的type
 * @positionId    boss坐标点id
 */
exports.fight_boss = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pathId = req.args.path_id;
        var clickCount = req.args.clickCount;
        if (!pathId || !clickCount) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var auto_fight = user.auto_fight;
        var autoFightServer = user.auto_fight_server;
        var boss_kill_count = auto_fight.boss.boss_kill_count;
        var boss_birth = auto_fight.boss.boss_birth;
        var is_first = 0;
        var fightBossIndex = null; // 需要被删除的boss
        for (var i = 0; i < boss_birth.length; i++) {
            if (boss_birth[i].path_id == pathId) {
                fightBossIndex = i;
                break;
            }
        }

        if (fightBossIndex == null) {
            DEBUG('can not find boss, client path id = ' + pathId);
            for (var i = 0; i < boss_birth.length; i++) {
                DEBUG('i = ' + i + ', pathid = ' + boss_birth[i].path_id);
            }

            resp.data.boss_birth = auto_fight.boss.boss_birth;
            resp.code = 100; resp.desc = 'can not find boss'; break;
        }

        var type = +boss_birth[fightBossIndex].type;

        if (!boss_kill_count[type]) {
            boss_kill_count[type] = 0;
            player.markDirty('auto_fight.boss.boss_kill_count');
        }

        var maxCountClick = gConfExploreBoss[type].maxClickCount;// 总点击次数
        boss_birth[fightBossIndex].click = clickCount;
        player.markDirty('auto_fight.boss.boss_birth');

        if (boss_birth[fightBossIndex].click >= maxCountClick) {// 是否可以获取奖励
            var bossConf = gConfExploreBoss[type];
            var awards = generateDrop(bossConf.lootId); // 必掉奖励
            if (player.hasBossSpecialAward(type)) {
                awards = awards.concat(generateDrop(bossConf.specialLootId, player.user.status.level, 'true'))
            }
            if (autoFightServer.boss_kill_count == 0) {
                // 这是第一只
                is_first = 1;
            }

            boss_kill_count[type] += 1;
            autoFightServer.boss_kill_count += 1;

            player.markDirty('auto_fight.boss.boss_kill_count');
            player.markDirty('auto_fight_server.boss_kill_count');

            // 移除被击杀的boss
            boss_birth.splice(fightBossIndex, 1);
            player.markDirty('auto_fight.boss.boss_birth');

            // 周期到了，要重新生成特殊奖励
            if (autoFightServer.boss_kill_count % bossConf.specialLootFrequency[1] == 0) {
                player.resetBossSpecialAwardByType(type);
                player.generateBossSpecialAwardByType(type);
            }

            player.doDailyTask('exploreBoss', 1);
            player.doGuideTask('exploreBoss', 1);
        }

        resp.data.boss_birth = auto_fight.boss.boss_birth;
        resp.data.boss_kill_count = boss_kill_count[type];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.is_first = is_first;

        logic_event_mgr.emit(logic_event_mgr.EVENT.GET_GOBLIN, player);
    } while (false);
    onHandled();
};

/**
 * 兑换奖励
 * @type 需要兑换boss奖励的type值
 */
exports.convert_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = +req.args.type;// 兑换奖励的类型
        if (!gConfExploreBoss[type]) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var need = gConfExploreBoss[type].awardNeed;

        var killCount = user.auto_fight.boss.boss_kill_count[type];
        if (killCount == undefined) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        if (killCount < need) {
            resp.code = 1; resp.desc = 'kill_boss num not enough'; break;
        }

        user.auto_fight.boss.boss_kill_count[type] -= need;
        player.markDirty(util.format('auto_fight.boss.boss_kill_count.%d', type));

        var awards = generateDrop(gConfExploreBoss[type].awardId, user.status.level);

        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

//------------------- end

// 大本营-搜寻任务

/**
 * 刷新任务
 * @task_id   task_id
 */
exports.refresh_task = function (player, req, resp, onHandled) {
    var user = player.user;
    var searchTask = user.auto_fight.search_task;
    do {
        var taskId = req.args.task_id;
        var task = searchTask.task_list[taskId];// 任务
        if (!task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }
        if (task.start_time) {// 任务开始不能刷新
            resp.code = 1; resp.desc = 'not refresh'; break;
        }

        var cost = [];
        // 基础次数用完
        if (searchTask.already_star_num >= gConfExploreBase.taskRefreshFreeTimes.value) {
            cost.push(['user', 'mixcash', -gConfLevel[user.status.level].exploreTask])
        }
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }
        searchTask.already_star_num += 1;
        player.markDirty('auto_fight.search_task.already_star_num');

        var newTask = logicCommon.createTask(user.status.level);
        delete searchTask.task_list[taskId];

        searchTask.task_list[newTask[1]] = newTask[0];
        player.markDirty('auto_fight.search_task.task_list');

        resp.data.task = searchTask.task_list[newTask[1]];
        resp.data.already_num = searchTask.already_star_num;
        resp.data.cost = player.addAwards(cost, req.mod, req.act);
    } while (false);

    onHandled();
};

/**
 * 派遣(更换)武将
 * @task_id
 * @hid         武将hid
 */
exports.send_hero = function (player, req, resp, onHandled) {
    var search_task = player.user.auto_fight.search_task;
    do {
        var taskId = req.args.task_id;
        var hid = req.args.hid;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }

        if (!hid) {
            resp.code = 1; resp.desc = 'not hid'; break;
        }

        task.hid = hid;
        search_task.task_list[taskId] = task;
        player.markDirty(util.format('auto_fight.search_task.task_list.%d', taskId));

        resp.data.task = search_task.task_list[taskId];
    } while (false);
    onHandled();
};

/**
 * 升星
 * @task_id
 */
exports.up_star = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = user.auto_fight.search_task;
    do {
        var taskId = req.args.task_id;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }

        if (!task.start_time) {
            resp.code = 1; resp.desc = 'do not start'; break;
        }

        var max = gConfExploreTaskBasic[task.type].starWeight.length;
        if (task.star >= max) {
            resp.code = 1; resp.desc = 'already max star'; break;
        }

        var limitTime = gConfExploreTaskBasic[task.type].needTime[task.star - 1] * 60;//  所需时间
        if (common.getTime() - task.start_time >= limitTime) {
            resp.code = 1; resp.desc = 'not up'; break;
        }

        var cost = [];
        if (search_task.already_star_num >= gConfExploreBase.taskRefreshFreeTimes.value) {
            cost = gConfExploreTaskBasic[task.type].starAddCost;
        }

        search_task.already_star_num++;
        task.star += 1;
        search_task.task_list[taskId] = task;
        player.markDirty('auto_fight.search_task.task_list.' + taskId + '');
        player.markDirty('auto_fight.search_task.already_star_num');

        resp.data.task = search_task.task_list[taskId];
        resp.data.already_star_num = search_task.already_star_num;
        resp.data.cost = player.addAwards(cost, req.mod, req.act);
    } while (false);

    onHandled();
};

// 购买次数
exports.buy = function (player, req, resp, onHandled) {
    do {
        var searchTask = player.user.auto_fight.search_task;
        var user = player.user;
        if (searchTask.already_buy >= gConfVip[user.status.vip].exploreTaskExtra) {
            resp.desc = 'already_buy not'; resp.code = 1; break;
        }

        searchTask.already_buy++;
        var cost = gConfBuy[searchTask.already_buy].exploreTask;
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }

        player.markDirty('auto_fight.search_task.already_buy');
        resp.data.already_buy = searchTask.already_buy;
        resp.data.costs = player.addAwards(cost, req.mod, req.act);
    } while (false);

    onHandled();
};

function get_searched_heroes(player) {
    if (!player) { return {}; }
    var user = player.user;

    var passDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
    if (user.auto_fight.last_search_day != passDay) {
        user.auto_fight.searched_heroes = {};
        user.auto_fight.last_search_day = passDay;
        player.markDirty('auto_fight.last_search_day');
        player.markDirty('auto_fight.searched_heroes');
    }
    user.auto_fight.searched_heroes = user.auto_fight.searched_heroes || {};
    return user.auto_fight.searched_heroes;
}

/**
 * 开始搜寻
 * @task_id     
 */
exports.start_search = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = user.auto_fight.search_task;
    var searched_heroes = get_searched_heroes(player);

    do {
        var taskId = req.args.task_id;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }

        var hid = req.args.hid;
        if (!hid) {
            resp.code = 1; resp.desc = 'not hid'; break;
        }

        if (searched_heroes[hid]) {
            resp.code = 1; resp.desc = 'has searched'; break;
        }

        searched_heroes[hid] = true;
        player.markDirty('auto_fight.searched_heroes');

        task.hid = hid; // only mark to get herostar
        task.start_time = common.getTime();

        var maxNum = gConfExploreBase.taskBasicTimes.value + search_task.already_buy;
        if (search_task.already_num >= maxNum) {
            resp.code = 1; resp.desc = 'num is not'; break;
        }

        var heroMsg = player.getHero(hid);// 武将

        var heroConf = getHeroCombatConf(heroMsg.rid);
        if (heroConf) {
            task.quality = heroConf.quality;
        }

        task.rid = heroMsg.rid;
        task.hero_star = player.getHeroStar(hid);

        search_task.already_num += 1;
        player.markDirty('auto_fight.search_task.already_num');

        search_task.task_list[taskId] = task;

        player.markDirty('auto_fight.search_task.task_list.' + taskId + '');
        resp.data.searched_heroes = searched_heroes;
        resp.data.task = search_task.task_list[taskId];
        resp.data.already_num = search_task.already_num;
    } while (false);

    onHandled();
};

exports.get_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = user.auto_fight.search_task;
    do {
        var taskId = req.args.task_id;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not get task'; break;
        }

        var hid = task.hid;

        var taskConf = gConfExploreTaskBasic[task.type];
        if (!taskConf) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        // 普通奖励
        var awards = [];

        var detailConf = gConfExploreTaskDetail[task.type][task.task_level];
        if (!detailConf) {
            ERROR('EROR TASK LEVEL = ' + task.task_level + ' TYPE:' + task.type);
            detailConf = gConfExploreTaskDetail[task.type][1];
        }

        awards = awards.concat(detailConf['award' + task.star]);

        var spAwards = [];
        //var heroStar = player.getHeroStar(hid);
        var heroStar = task.hero_star;
        if (heroStar >= 6) {
            spAwards = clone(taskConf['award3']);
        } else if (heroStar >= 4) {
            spAwards = clone(taskConf['award2']);
        } else {
            spAwards = clone(taskConf['award1']);
        }

        var taskStar = task.star;
        var num = +(taskConf['normalAward'][taskStar - 1]);
        if (!num || num < 0) {
            resp.code = 1; resp.desc = 'star error'; break;
        }

        spAwards[0][2] = num;
        awards = awards.concat(spAwards);

        var cost = [['user', 'mixcash', -gConfExploreBase.taskQuickAchieve.value]];

        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }

        var newTask = logicCommon.createTask(user.status.level);
        delete search_task.task_list[taskId];

        search_task.task_list[newTask[1]] = newTask[0];
        player.markDirty('auto_fight.search_task.task_list');

        resp.data.task = search_task.task_list[newTask[1]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.cost = player.addAwards(cost, req.mod, req.act);

        player.doDailyTask('exploreTask', 1);
    } while (false);

    onHandled();
};

exports.finish = function (player, req, resp, onHandled) {
    var user = player.user;
    var searchTask = user.auto_fight.search_task;
    do {
        var taskId = req.args.task_id;
        var task = searchTask.task_list[taskId];// 任务
        if (!taskId || !task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }

        var hid = task.hid;
        if (!hid) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var taskConf = gConfExploreTaskBasic[task.type];
        if (!taskConf) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var limitTime = gConfExploreTaskBasic[task.type].needTime[task.star - 1] * 60;//  所需时间
        if (common.getTime() - task.start_time < limitTime) {
            resp.code = 1; resp.desc = 'not finish'; break;
        }

        var detailConf = gConfExploreTaskDetail[task.type][task.task_level];
        if (!detailConf) {
            detailConf = gConfExploreTaskDetail[task.type][1];
        }

        // 普通奖励
        var awards = clone(detailConf['award' + task.star]);

        var spAwards = [];
        //var heroStar = player.getHeroStar(hid);
        var heroStar = task.hero_star
        if (heroStar >= 6) {
            spAwards = clone(taskConf['award3']);
        } else if (heroStar >= 4) {
            spAwards = clone(taskConf['award2']);
        } else {
            spAwards = clone(taskConf['award1']);
        }

        var taskStar = task.star;
        var num = +(taskConf['normalAward'][taskStar - 1]);
        if (!num || num < 0) {
            resp.code = 1; resp.desc = 'star error'; break;
        }

        spAwards[0][2] = num;
        awards = awards.concat(spAwards);

        var newTask = logicCommon.createTask(user.status.level);
        delete searchTask.task_list[taskId];
        searchTask.task_list[newTask[1]] = newTask[0];
        player.markDirty('auto_fight.search_task.task_list');

        resp.data.task = searchTask.task_list[newTask[1]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);

        player.doDailyTask('exploreTask', 1);
    } while (false);

    onHandled();
};

// 大本营   魔法阵法
exports.magic = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        player.calcAutoFightMagic();
        resp.data.magic = user.auto_fight.magic;
    } while (false);

    onHandled();
};

exports.get_awards_magic = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        var magic = user.auto_fight.magic;
        if (Object.keys(magic.bag).length <= 0) {
            resp.code = 1; resp.desc = 'not award'; break;
        }

        var awards = [];

        var curTime = common.getTime();
        var magicRate = calcMagicRate(user.status.vip, user.payment.long_card, user.payment.month_card, user.payment.week_card);
        for (var i in magic.msg) {
            var confData = gConfExploreMagic[i];
            if (player.isVillageReleased(confData.villageId)) {
                var extra = calcMagicRateExtra(i, magic);
                var magicMsg = magic.msg[i];
                var awardTimeLimit = 86400 / (confData.base * (magicRate + extra));
                var residue = (curTime - magicMsg.last_time) % awardTimeLimit;// 余数
                magicMsg.start_time = magicMsg.last_time = curTime - residue;
                magicMsg.max = 0;
                magicMsg.cur_num = 0;
            }
        }

        for (var id in magic.bag) {
            magic.bag[id].forEach(function (val) {
                awards.push(val);
            })
        }
        magic.bag = {};

        if (awards.length) {
            awards = reformAwards(awards);
        }
        player.markDirty('auto_fight.magic');

        resp.data.magic = user.auto_fight.magic;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 拉去信息
exports.magic_extra_get = function (player, req, resp, onHandled) {

    var magic = player.user.auto_fight.magic;
    var extra = magic.extra;

    for (var i in magic.msg) {
        if (!extra[i]) {
            extra[i] = 0;
            player.markDirty('auto_fight.magic');
        }
    }

    resp.data.info = seri_extra(extra);
    onHandled();
}

// 战前检测
exports.magic_extra_fight_before = function (player, req, resp, onHandled) {

    var magic = player.user.auto_fight.magic;
    var extra = magic.extra;

    do {

        var type = +req.args.type;

        if (isNaN(type)) {
            resp.code = 1; resp.desc = 'invalid type'; break;
        }

        if (!extra[type]) {
            extra[type] = 0;
        }

        var lv = extra[type];

        if (!gConfExploreMagicAwardUp[type]) {
            resp.code = 1; resp.desc = 'invalid type 2'; break;
        }

        var conf = gConfExploreMagicAwardUp[type][lv + 1];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid lv'; break;
        }

        // 战斗力是否足够
        if (player.user.status.level < conf.lvLimit) {
            resp.code = 1; resp.desc = 'invalid firght force'; break;
        }

    } while (false);

    onHandled();
}

// 战斗
exports.magic_extra_fight = function (player, req, resp, onHandled) {

    var magic = player.user.auto_fight.magic;
    var extra = magic.extra;

    do {

        var type = +req.args.type;
        var pass = +req.args.pass;

        if (isNaN(type)) {
            resp.code = 1; resp.desc = 'invalid type'; break;
        }

        if (!extra[type]) {
            extra[type] = 0;
        }

        var lv = extra[type];

        if (!gConfExploreMagicAwardUp[type]) {
            resp.code = 1; resp.desc = 'invalid type 2'; break;
        }

        var conf = gConfExploreMagicAwardUp[type][lv + 1];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid lv'; break;
        }

        // 战斗力是否足够
        if (player.user.status.level < conf.lvLimit) {
            resp.code = 1; resp.desc = 'invalid lv2'; break;
        }

        if (pass > 0) {
            extra[type]++;
        }

        player.markDirty('auto_fight.magic');

        //player.calcAutoFightMagic();

    } while (false);

    resp.data.info = seri_extra(extra);
    onHandled();
}

function seri_extra(extra) {
    var arr = [0, 0, 0]
    for (var i in extra) {
        arr[i - 1] = extra[i]
    }

    return arr;
}