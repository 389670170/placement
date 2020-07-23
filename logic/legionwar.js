var ErrorCode = require('../legionwar/error.js').ErrorCode;

// 获取主界面信息
exports.get_main_page_info = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'Call this method after legion.get';
        onHandled();
        return;
    }
    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            player.doDailyTask('legion', 1);
        }
        onHandled();
    });
};

// 获取战斗界面信息
exports.get_battle_page_info = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'Call this method after legion.get';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            resp.data.own_cards = player.user.legionwar.cards;
        }
        onHandled();
    });

};

// 获取城池数据
exports.get_city_info = function (player, req, resp, onHandled) {
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }
    if (isNaN(player.memData.legion_id)) {
        resp.code = 1; resp.desc = 'Call this method after legion.get';
        onHandled();
        return;
    }

    if (!req.args.city) {
        resp.code = 1; resp.desc = 'city MUST be exist';
        onHandled();
        return;
    }

    if (!(req.args.city instanceof Array)) {
        resp.code = 1; resp.desc = 'city MUST be Number or Array';
        onHandled();
        return;
    }

    req.args.hidd_dark = (req.args.lid != player.memData.legion_id);
    requestWorld(req, resp, function () {
        if (resp.code == 0) {

            let reqL = {
                uid: req.uid,
                act: 'get_city_buf_speed',
                mod: 'api',
                args: {
                    lid: player.memData.legion_id,
                }
            }

            let respL = {
                code: 0,
                desc: "",
            }

            requestLegionWar(reqL, respL, function () {
                if (respL.code == 0) {
                    resp.data.speed = respL.data.speed;
                } else {
                    resp.data.speed = 0;
                    resp.code = respL.code;
                    resp.desc = respL.desc + ' get_city_buf_speed failed';
                }

                onHandled();
            });
        } else {
            onHandled();
        }
    });
};

// 城池增驻
exports.upgrade_citybuf = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid) || isNaN(req.args.city)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

exports.cancel_citybuf = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid) || isNaN(req.args.city)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 把玩家驻守到城池
exports.add_city_force = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid) || isNaN(req.args.city)
        || isNaN(req.args.arm) || isNaN(req.args.arm_uid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        onHandled();
    });
};

// 把玩家从城池移除
exports.remove_city_force = function (player, req, resp, onHandled) {
    if (isNaN(req.args.lid) || isNaN(req.args.city) || isNaN(req.args.arm_uid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        onHandled();
    });
};

// 获取 探索任务 信息
exports.get_task_info = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = getSearchTask(player);
    do {
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

            player.markDirty('legionwar.search_task.task_list');
            player.markDirty('legionwar.search_task.fix');
        }

        resp.data.task_msg = search_task;
        resp.data.searched_heroes = get_searched_heroes(player);
    } while (false);

    onHandled();
};

/**
 * 刷新任务
 * @task_id   task_id
 */
exports.refresh_task = function (player, req, resp, onHandled) {
    var user = player.user;
    var searchTask = getSearchTask(player);
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
        if (searchTask.already_star_num >= gConfGlobalNew.legionWarExploreRefreshFreeTimes) {
            cost = parseAwardsConfig(gConfGlobalNew.legionWarExploreRefreshCost);
        }
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }
        searchTask.already_star_num += 1;
        player.markDirty('legionwar.search_task.already_star_num');

        var newTask = createTask(user.status.level);
        newTask[0].idx = task.idx;
        delete searchTask.task_list[taskId];

        searchTask.task_list[newTask[1]] = newTask[0];
        player.markDirty('legionwar.search_task.task_list');

        resp.data.cost = player.addAwards(cost, req.mod, req.act);
        resp.data.task_msg = searchTask;
        resp.data.searched_heroes = get_searched_heroes(player);
    } while (false);

    onHandled();
};

/**
 * 巡逻升星
 * @task_id
 */
exports.up_star = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = getSearchTask(player);
    search_task.task_list = search_task.task_list || {};
    do {
        var taskId = req.args.task_id;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not task'; break;
        }

        if (!task.start_time) {
            resp.code = 1; resp.desc = 'do not start'; break;
        }

        var tLegionwarCardExploreInfo = gConfLegionwarCardExplore[task.type];
        var max = tLegionwarCardExploreInfo.starWeight.length;
        if (task.star >= max) {
            resp.code = 1; resp.desc = 'already max star'; break;
        }

        var limitTime = tLegionwarCardExploreInfo.needTime[task.star - 1] * 60;//  所需时间
        if (common.getTime() - task.start_time >= limitTime) {
            resp.code = 1; resp.desc = 'not up'; break;
        }

        var cost = [];
        if (search_task.already_star_num >= gConfGlobalNew.legionWarExploreRefreshFreeTimes) {
            cost = tLegionwarCardExploreInfo.starAddCost;
            // cost = parseAwardsConfig(gConfGlobalNew.legionWarExploreRefreshCost);
        }

        search_task.already_star_num++;
        task.star += 1;
        player.markDirty('legionwar.search_task.task_list');
        player.markDirty('legionwar.search_task.already_star_num');

        resp.data.cost = player.addAwards(cost, req.mod, req.act);
        resp.data.task_msg = search_task;
        resp.data.searched_heroes = get_searched_heroes(player);
    } while (false);

    onHandled();
};

// 购买巡逻次数
exports.buy = function (player, req, resp, onHandled) {
    do {
        var searchTask = getSearchTask(player);
        var user = player.user;
        if (searchTask.already_buy >= gConfVip[user.status.vip].legionExploreTaskExtra) {
            resp.desc = 'already_buy not'; resp.code = 1; break;
        }

        searchTask.already_buy++;
        var cost = gConfBuy[searchTask.already_buy].legionExploreTask;
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }

        player.markDirty('legionwar.search_task.already_buy');
        resp.data.already_buy = searchTask.already_buy;
        resp.data.costs = player.addAwards(cost, req.mod, req.act);
    } while (false);

    onHandled();
};

/**
 * 派遣(更换)武将
 * @task_id
 * @hid         武将hid
 */
exports.send_hero = function (player, req, resp, onHandled) {
    var search_task = getSearchTask(player);
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
        player.markDirty(util.format('legionwar.search_task.task_list.%d', taskId));

        resp.data.task = search_task.task_list[taskId];
        resp.data.task_msg = search_task;
        resp.data.searched_heroes = get_searched_heroes(player);
    } while (false);
    onHandled();
};

/**
 * 开始巡逻
 * @task_id     
 */
exports.start_search = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = getSearchTask(player);
    search_task.task_list = search_task.task_list || {};
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
        player.markDirty('legionwar.searched_heroes');

        task.hid = hid; // only mark to get herostar
        task.start_time = common.getTime();

        var maxNum = gConfGlobalNew.legionWarExploreBasicTimes + search_task.already_buy;
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
        player.markDirty('legionwar.search_task.already_num');

        search_task.task_list[taskId] = task;

        player.markDirty('legionwar.search_task.task_list.' + taskId + '');
        resp.data.searched_heroes = searched_heroes;
        resp.data.task_msg = search_task;
        // resp.data.task = search_task.task_list[taskId];
        // resp.data.already_num = search_task.already_num;
    } while (false);

    onHandled();
};

/** 快速领取巡逻奖励 */
exports.get_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    var search_task = getSearchTask(player);
    search_task.task_list = search_task.task_list || {};
    do {
        var taskId = req.args.task_id;
        var task = search_task.task_list[taskId];
        if (!task) {
            resp.code = 1; resp.desc = 'not get task'; break;
        }

        var hid = task.hid;

        var taskConf = gConfLegionwarCardExplore[task.type];
        if (!taskConf) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        // 普通奖励
        var awards = [];
        var detailConf = gConfLegionwarCardExplore[task.type];
        if (!detailConf) {
            ERROR('EROR TASK LEVEL = ' + task.task_level + ' TYPE:' + task.type);
            detailConf = gConfLegionwarCardExplore[task.type];
        }
        awards = awards.concat(detailConf['award' + task.star]);

        var cardId = detailConf.cardId;
        var num = 1;
        user.legionwar.cards[cardId] = isNaN(user.legionwar.cards[cardId]) ? num : user.legionwar.cards[cardId] + num;

        var cost = parseAwardsConfig(gConfGlobalNew.legionWarExploreQuickAchieve);

        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'lack of resources'; break;
        }

        var newTask = createTask(user.status.level);
        newTask[0].idx = task.idx;
        delete search_task.task_list[taskId];

        search_task.task_list[newTask[1]] = newTask[0];
        player.markDirty('legionwar.search_task.task_list');

        resp.data.task = search_task.task_list[newTask[1]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.cost = player.addAwards(cost, req.mod, req.act);
        resp.data.cardId = cardId;
        resp.data.cardNum = num;
        resp.data.task_msg = search_task;
        resp.data.searched_heroes = get_searched_heroes(player);

    } while (false);

    onHandled();
};

/** 巡逻结束 */
exports.finish = function (player, req, resp, onHandled) {
    var user = player.user;
    var searchTask = getSearchTask(player);
    searchTask.task_list = searchTask.task_list || {};
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

        var taskConf = gConfLegionwarCardExplore[task.type];
        if (!taskConf) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var limitTime = gConfLegionwarCardExplore[task.type].needTime[task.star - 1] * 60;//  所需时间
        if (common.getTime() - task.start_time < limitTime) {
            resp.code = 1; resp.desc = 'not finish'; break;
        }

        var detailConf = gConfLegionwarCardExplore[task.type];
        if (!detailConf) {
            ERROR('EROR TASK LEVEL = ' + task.task_level + ' TYPE:' + task.type);
            detailConf = gConfLegionwarCardExplore[task.type];
        }
        var awards = detailConf['award' + task.star];
        var cardId = detailConf.cardId;
        var num = 1;
        user.legionwar.cards[cardId] = isNaN(user.legionwar.cards[cardId]) ? num : user.legionwar.cards[cardId] + num;

        var newTask = createTask(user.status.level);
        newTask[0].idx = task.idx;
        delete searchTask.task_list[taskId];
        searchTask.task_list[newTask[1]] = newTask[0];
        player.markDirty('legionwar.search_task.task_list');

        resp.data.task = searchTask.task_list[newTask[1]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.cardId = cardId;
        resp.data.cardNum = num;
        resp.data.task_msg = searchTask;
        resp.data.searched_heroes = get_searched_heroes(player);

        player.doDailyTask('exploreTask', 1);
    } while (false);

    onHandled();
};

function get_searched_heroes(player) {
    if (!player) { return {}; }
    var user = player.user;

    var passDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
    if (user.legionwar.last_search_day != passDay) {
        user.legionwar.searched_heroes = {};
        user.legionwar.last_search_day = passDay;
        player.markDirty('legionwar.last_search_day');
        player.markDirty('legionwar.searched_heroes');
    }
    user.legionwar.searched_heroes = user.legionwar.searched_heroes || {};
    return user.legionwar.searched_heroes;
}

// 初始化任务
function getSearchTask(player) {
    var user = player.user;
    if (user.legionwar.search_task && user.legionwar.search_task.task_list) {
        user.legionwar.search_task.first_come = user.legionwar.search_task.first_come || 1;
        user.legionwar.search_task.already_num = user.legionwar.search_task.already_num || 0;
        user.legionwar.search_task.already_buy = user.legionwar.search_task.already_buy || 0;
        user.legionwar.search_task.already_star_num = user.legionwar.search_task.already_star_num || 0;
        return user.legionwar.search_task;
    }

    user.legionwar.search_task = {
        'already_num': 0,                        // 已经探索次数
        'first_come': 1,                        // 是否是第一次进入
        'already_buy': 0,                         // 已经购买的次数
        'already_star_num': 0,                    // 已经升星的次数
        //'speed_task_num' : 0,                   // 马上完成任务次数
        'task_list': {}
    };
    var search_task = user.legionwar.search_task;
    var task_list = search_task.task_list;
    if (search_task.first_come) {               // 首次进入 刷两个任务
        search_task.first_come = 0;
        // 随机出来的任务
        var task1 = createTask(user.status.level);
        var task2 = createTask(user.status.level);
        task1[0].idx = 1;
        task_list[task1[1]] = task1[0];
        task2[0].idx = 2;
        task_list[task2[1]] = task2[0];

        search_task.task_list = task_list;
    } else {
        var index = 0;
        for (var i in task_list) {
            index += 1;
        }

        if (index < 2) {
            var task = createTask(user.status.level);
            task.idx = 2
            task_list[task[1]] = task[0];
        }
    }
    player.markDirty('legionwar.search_task');

    return user.legionwar.search_task;
};


var idx = 0;
/**
 * 生成随机任务
 * @param level
 * @returns {[null,null]}   [任务信息，任务id]
 */
function createTask(level) {
    idx = idx + 1;
    var openTask = [];// 可以开启的任务
    var sumTaskWeight = 0;// 可开启任务随机权重总和
    var task = ''; // 随机出来的任务
    for (var i in gConfLegionwarCardExplore) {
        var data = gConfLegionwarCardExplore[i];
        // if (data.openLevel <= level) {
        sumTaskWeight += data.taskWeight;
        openTask.push(data)
        // }
    }
    var odds = common.randRange(1, sumTaskWeight);
    var num = 0;
    for (var i = 0, len = openTask.length; i < len; i++) {
        num += openTask[i].taskWeight;
        if (odds <= num) {
            task = openTask[i];
            break;
        }
    }
    var star = randomStar(task);// 随机星级

    var taskLevel = findTaskLevel(task.type, level);
    var taskId = common.getTime() + "" + idx + "" + task.type;

    return [{
        task_id: taskId,
        type: task.type,
        star: star,
        start_time: 0,
        hid: 0,
        reset_num: 0,
        task_level: taskLevel,
    }, taskId]
};

// 随机初始星级
function randomStar(task) {
    var starWeight = 0;
    var star = 0;
    for (var i = 0, len = task.starWeight.length; i < len; i++) {
        starWeight += task.starWeight[i];
    }

    var odds = common.randRange(1, starWeight);
    var num = 0;

    for (var i = 0, len = task.starWeight.length; i < len; i++) {
        num += task.starWeight[i];
        if (odds <= num) {
            star = i;
            break;
        }
    }

    return star + 1;
};

function findTaskLevel(type, level) {
    var conf = gConfLegionwarCardExplore[type];
    if (!conf) {
        return 0;
    }

    var preKey = 0;
    // for (var k in conf) {
    //     var key = parseInt(k);
    //     if (level < key && level >= preKey) {
    //         return preKey;
    //     }

    //     preKey = key;
    // }

    return preKey;
};

// 购买魔法卡
exports.buy_card = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.card) || !req.args.type) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }
        var cardId = req.args.card;
        var cardConf = gConfLegionWarCityCard[cardId];
        if (!cardConf) {
            resp.code = 1; resp.desc = 'No such card'; break;
        }

        var num = req.args.num; // 购买数量
        if (!num || num < 1) {
            resp.code = 1; resp.desc = 'invalid num'; break;
        }
        var costType = req.args.type;
        var costs = [];
        if (costType == 'legionwar') {
            costs = clone(cardConf['legionUserCost']);
        } else if (costType == 'mixcash') {
            costs = clone(cardConf['mixCashCost']);
        } else {
            resp.code = 1; resp.desc = 'unknow cost type'; break;
        }

        if (costs.length > 0) {
            for (var i = 0; i < costs.length; i++) {
                costs[i][2] *= num;
            }
        }

        if (costs.length > 0) {
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'cost not enough'; break;
            }
        } else {
            resp.code = 1; resp.desc = 'cost type err'; break;
        }

        user.legionwar.cards[cardId] = isNaN(user.legionwar.cards[cardId]) ? num : user.legionwar.cards[cardId] + num;
        player.markDirty('legionwar.cards');
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

    } while (false);

    onHandled();
};

// 使用魔法卡
exports.use_card = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.card) || !req.args.hasOwnProperty('target')) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        req.args.lid = player.memData.legion_id;
        if (isNaN(req.args.lid)) {
            resp.code = 1; resp.desc = 'has not legion'; break;
        }

        var cardId = req.args.card;
        var cardConf = gConfLegionWarCityCard[cardId];
        if (!cardConf) {
            resp.code = ErrorCode.ERROR_NO_SUCH_CARD; resp.desc = 'No such card'; break;
        }

        var cardCount = user.legionwar.cards[cardId] || 0;
        if (cardCount <= 0) {
            resp.code = ErrorCode.ERROR_CARD_NOT_ENOUGH; resp.desc = 'Card not enough'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                user.legionwar.cards[cardId]--;
                player.markDirty('legionwar.cards');
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 攻击敌方玩家
exports.attack_arm = function (player, req, resp, onHandled) {
    var user = player.user;
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.city) || isNaN(req.args.arm)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    var cardId = req.args.card;
    if (cardId && cardId > 0) {
        var cardConf = gConfLegionWarCityCard[cardId];
        if (!cardConf) {
            resp.code = 1; resp.desc = 'No such card';
            onHandled();
            return;
        }

        var cardCount = user.legionwar.cards[cardId] || 0;
        if (cardCount <= 0) {
            resp.code = 1; resp.desc = 'Card not enough';
            onHandled();
            return;
        }
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            player.memData.status = 'prepare_legionwar';
            player.memData.rand1 = resp.data.rand1;
            player.memData.rand2 = resp.data.rand2;
            player.memData.fight_info = resp.data.info;
            player.memData.fight_enemy = resp.data.enemy;

            player.memData.legionwar_enemy_city = req.args.city;
            player.memData.legionwar_enemy_arm = req.args.arm;

            var randPos = common.randRange(1, player.memData.pos_count);
            var randAttrs = common.randArrayWithNum(AttributeIds, 3);
            resp.data.fight_time = player.memData.fight_time = common.getTime();
            resp.data.rand_pos = player.memData.rand_pos = randPos;
            resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;

            if (cardId && cardId > 0) {
                user.legionwar.cards[cardId]--;
                player.markDirty('legionwar.cards');
            }
        }
        onHandled();
    });
};

// 战斗结束
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 状态检查
        if (player.memData.status != 'prepare_legionwar') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var power = Math.floor(req.args.power);
        if (isNaN(power)) {
            resp.code = 1; resp.desc = 'in valid power'; break;
        }

        // 参数检查
        req.args.lid = player.memData.legion_id;
        if (req.args.city != player.memData.legionwar_enemy_city) {
            resp.code = 1; resp.desc = 'error enemy city'; break;
        }
        if (req.args.arm != player.memData.legionwar_enemy_arm) {
            resp.code = 1; resp.desc = 'error enemy arm'; break;
        }

        // 请求数据
        req.args.power = power;
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                var atkAward = [];
                if (+req.args.star > 0) {
                    atkAward = gConfLegionWarCity[+req.args.city].award1;
                } else {
                    atkAward = gConfLegionWarCity[+req.args.city].award2;
                }
                resp.data.awards = player.addAwards(atkAward, req.mod, req.act);
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

// 获取玩家参战奖励数据
exports.get_user_fightnum_info = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 领取玩家参战奖励
exports.get_user_fightnum_award = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid) || isNaN(req.args.attackCount)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    var awardConf = gConfLegionWarAttackAward[req.args.attackCount];
    if (!awardConf) {
        resp.code = 1; resp.desc = 'no such conf';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            // 发奖
            resp.data.awards = player.addAwards(awardConf.award, req.mod, req.act);
        }
        onHandled();
    });
};

// 领取城池奖励
exports.get_city_award = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.city)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            var cityConf = gConfLegionWarCity[+req.args.city];

            // 城池奖励
            resp.data.awards = player.addAwards(cityConf.award, req.mod, req.act);
        }
        onHandled();
    });
};

// 获取历史战绩
exports.get_history = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 获取本服排行榜
exports.get_server_ranklist = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 获取全服排行榜
exports.get_world_ranklist = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 获取段位数据
exports.get_rank_info = function (player, req, resp, onHandled) {
    req.args.lid = player.memData.legion_id;
    if (isNaN(req.args.lid)) {
        resp.code = 1; resp.desc = 'invalid args';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// 军团战商店
exports.shop_get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shopType = ShopType.LEGIONWAR;
        var count = gConfGlobal.legionWarShopSellCount;
        var now = common.getTime();
        var legionWarShop = user.shop[shopType];

        // 自动刷新
        var today = common.getDate();
        if (legionWarShop.refresh != today) {
            player.refreshShop(shopType, count);
            legionWarShop.refresh = today;
            player.markDirty(util.format('shop.%d.refresh', shopType));
        }

        resp.data.shop = legionWarShop;

    } while (false);

    onHandled();
};

exports.shop_buy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var id = Math.floor(+req.args.id);
        var type = req.args.type;

        var shopType = ShopType.LEGIONWAR;
        var legionWarShop = user.shop[shopType];

        if (!legionWarShop.goods[id]) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        var good = legionWarShop.goods[id];
        if (good[1]) {
            resp.code = 1; resp.desc = 'has bought'; break;
        }

        var costId = good[0];
        var costs = gConfShop[id]['cost' + costId];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var awards = gConfShop[id].get;
        if (awards[0][0] == 'equip') {
            awards = [['equip', good[2], good[3], 1]];
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        good[1] = 1;
        player.markDirty(util.format('shop.%d.goods.%d', shopType, id));

        player.doDailyTask('shopBuy', 1);
    } while (false);

    onHandled();
};

exports.shop_refresh = function (player, req, resp, onHandled) {
    var user = player.user;
    do {

        var costs = [['user', 'cash', -gConfGlobal.legionWarShopRefreshCashCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough'; break;
        }

        var shopType = ShopType.LEGIONWAR;
        var legionWarShop = user.shop[shopType];

        player.refreshShop(shopType, gConfGlobal.legionWarShopSellCount);
        resp.data.shop = legionWarShop;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.get_accumulate_legion_war = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        req.mod = 'api';

        requestLegionWar(req, resp, function () {
            if (resp.code == 0) {
                // TODO: 统一字段名
                player.addAwards(resp.data.award);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取自身当前增筑速度
exports.get_city_buf_speed = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        req.mod = 'api';
        req.args.lid = player.memData.legion_id;

        requestLegionWar(req, resp, function () {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 立即计算城池的增筑值
exports.update_city_buf = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        req.mod = 'api';
        req.args.lid = player.memData.legion_id;

        requestLegionWar(req, resp, function () {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};
