// ----------------------------------------------------------------------------
// 龙纹手册
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// local
var common = require('../common.js');

// 获取数据
function get_data(player) {
    var user = player.user;
    if (user.activity.manually && !user.activity.manually.startTime) {
        user.activity.manually.startTime = gConfActivities["manually"].startTime
    }

    if (
        !user.activity.manually                                                     // 没有参与过
        ||
        user.activity.manually.stage != gConfActivities["manually"].stage           // 参与的不是本期
        ||
        user.activity.manually.startTime != gConfActivities["manually"].startTime           // 参与的不是本期
    ) {
        user.activity.manually = {                            // 龙纹手册
            "now_exp": 0,                       // 当前经验值
            "is_unlock": 0,                     // 0-未解锁额外奖励 1-已解锁额外奖励
            "stage": gConfActivities["manually"].stage,
            "startTime": gConfActivities["manually"].startTime,
            "rewards": {                        // 基础奖励信息
                "def_list": [],                 // 已经领取的基础奖励列表
                "ex_list": [],                  // 已经领取的额外奖励列表
            },
            "task_info": {
                "task_info": {},                // 任务进度信息  key-任务ID  value-任务完成次数
                "buy_times": {},                // 购买等级情况 key-购买的等级类型 value-对应购买次数
                "task_cmpt_time": {},           // 任务是第几天完成的
            }
        }
    }

    player.markDirty('activity.manually');

    return user.activity.manually;
}

/** 招募 
 * @param {string} event 操作类型
 * @param {number} type 招募类型 1 普通招募 2 高级招募
 * @param {number} times 招募次数
 */
function player_recruit(player, type, times) {
    times = times || 0;
    for (var i = 0; i < times; i++) {
        on_task_event(player, "player_recruit", type);
    }
}

/**
 * 获得龙晶矿洞宝藏
 * @param {*} player 
 * @param {number} type 宝藏等级    3为终极宝藏
 */
function digging_box(player, type) {
    on_task_event(player, "digging_box", type);
}

/**
 * 合成英雄
 * @param {*} player 
 * @param {number} type 合成英雄星级
 */
function make_hero(player, type) {
    on_task_event(player, "make_hero_up", type);
}

/**
 * 加速挂机
 * @param {*} player 
 */
function speed_up(player) {
    on_task_event(player, "speed_up");
}

/**
 * 捕获哥布林
 * @param {*} player 
 * @param {number} type 哥布林类型
 */
function get_goblin(player, type) {
    on_task_event(player, "get_goblin", type);
}


/**
 * 玩家获取邮件
 * @param {*} player 
 * @param {*} mail 
 */
function on_get_mail(player, mail) {
    if (common.getTime() < gConfActivities["manually"].startTime) {
        return;                                         // 不是这一期活动期间发送的邮件
    }

    var event = null;
    var event_value = null;
    var value_type = null;

    switch (mail.content[0]) {
        case 15:
            event = "king";
            event_value = mail.content[1];
            value_type = 0;
            // on_task_event(player, "king", mail.content[1]);
            break;
        case 4:
            switch (mail.content[1]) {
                case 4:                   // 紫金
                    event = "arena_top_1";
                    event_value = mail.content[2];
                    value_type = -1;
                    // on_task_event(player, "arena_top_1", mail.content[2], -1);
                    break;
                case 5:                   // 钻石
                    event = "arena_top_2";
                    event_value = mail.content[2];
                    value_type = -1;
                    // on_task_event(player, "arena_top_2", mail.content[2], -1);
                    break;
                case 6:                   // 王者
                    event = "arena_top_3";
                    event_value = mail.content[2];
                    value_type = -1;
                    // on_task_event(player, "arena_top_3", mail.content[2], -1);
                    break;
                case ArenaType.THIS:                   // 王者
                    event = "arena_top_11";
                    event_value = mail.content[2];
                    value_type = -1;
                    // on_task_event(player, "arena_top_3", mail.content[2], -1);
                    break;
                case ArenaType.CROSS:                   // 王者
                    event = "arena_top_12";
                    event_value = mail.content[2];
                    value_type = -1;
                    // on_task_event(player, "arena_top_3", mail.content[2], -1);
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }

    if (!event) { return; }
    var data = get_data(player);
    data.task_info.task_cmpt_time = data.task_info.task_cmpt_time || {};
    if (typeof (data.task_info.task_cmpt_time[event]) == "number") {
        data.task_info.task_cmpt_time[event] = [];
    }
    data.task_info.task_cmpt_time[event] = data.task_info.task_cmpt_time[event] || [];
    var tCmptDayList = data.task_info.task_cmpt_time[event] || [];
    var passedDay = common.getDateDiff(getGameDate(mail.time), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
    if (tCmptDayList.indexOf(passedDay) != -1) { return; }

    on_task_event(player, event, event_value, value_type);
    data.task_info.task_cmpt_time[event].push(passedDay)
    player.markDirty("activity.manually.task_info.task_cmpt_time");
}

// 充值事件
function on_pay(player, cash, chargeId, gift_key, gift_id) {
    if (!isActivityStart(player, 'manually')) { return; }

    if (gift_key != "dragonmanual") { return; }

    switch (chargeId) {
        case gConfGlobalNew.avmanuallyRechargeId:
            var data = get_data(player);
            data.is_unlock = 1;
            player.markDirty(util.format('activity.manually.is_unlock'));
            break;
        default:
            break;
    }

}


// ----------------------------------------------------------------------------
// export


/**
 * 判断是否获取任务经验
 * @param {string} event 事件类型
 * @param {string} value 事件参数
 * @param {number} compar_mod 对比方式 0或者无值为相等 >0为value大于要求值 <0为value小于要求值
 */
on_task_event = function (player, event, value, compar_mod) {
    var user = player.user;
    compar_mod = compar_mod || 0;
    value = value || 0;
    var data = get_data(player)
    do {
        if (!isActivityStart(player, 'manually')) {
            break;
        }
        for (var tKey in gConfAvmanuallyTask) {
            var tTaskInfo = gConfAvmanuallyTask[tKey];
            if (tTaskInfo.event != event) { continue; }
            if (
                (compar_mod == 0 && value == tTaskInfo.eventVal)
                ||
                (compar_mod > 0 && value > tTaskInfo.eventVal)
                ||
                (compar_mod < 0 && value < tTaskInfo.eventVal)
            ) {
                data.task_info.task_info[tTaskInfo.id] = data.task_info.task_info[tTaskInfo.id] || 0;
                data.task_info.task_info[tTaskInfo.id]++;
                player.markDirty('activity.manually.task_info.task_info');

                data.now_exp = data.now_exp || 0;
                data.now_exp = data.now_exp + tTaskInfo.manualTaskexp;
                player.markDirty('activity.manually.now_exp');
            }
        }
    } while (false);
}


//-----------------------------------------------------------------------
exports.init = function () {
    logic_event_mgr.on(logic_event_mgr.EVENT.PLAYER_RECRUIT, player_recruit);
    logic_event_mgr.on(logic_event_mgr.EVENT.DIGGING_BOX, digging_box);
    logic_event_mgr.on(logic_event_mgr.EVENT.MAKE_HERO_UP, make_hero);
    logic_event_mgr.on(logic_event_mgr.EVENT.SPEED_UP, speed_up);
    logic_event_mgr.on(logic_event_mgr.EVENT.GET_GOBLIN, get_goblin);
    logic_event_mgr.on(logic_event_mgr.EVENT.GET_MAIL, on_get_mail);

    logic_event_mgr.on(logic_event_mgr.EVENT.ON_PAY, on_pay);
}


// ----------------------------------------------------------------------------
// export for request

/** 获取龙纹手册信息 */
exports.get_manually_info = function (player, req, resp, onHandled) {
    do {
        if (!isActivityStart(player, 'manually')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }
        var data = get_data(player);
        resp.data = data;
    } while (false);

    onHandled();

};


/** 领取龙纹手册奖励 */
exports.get_manually_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'manually')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var id = req.args.id;
        var conf = gConfAvmanuallyAward[id];
        if (!conf) {
            resp.code = 1;
            resp.desc = 'invalid id';
            break;
        }

        var tPlayerManuallyInfo = user.activity.manually;
        if (tPlayerManuallyInfo.rewards.def_list.indexOf(id) != -1 && tPlayerManuallyInfo.rewards.ex_list.indexOf(id) != -1) {  // 普通奖励和额外奖励都领取了
            resp.code = 1;
            resp.desc = 'already rewarded';
            break;
        }

        if (!tPlayerManuallyInfo.is_unlock && tPlayerManuallyInfo.rewards.def_list.indexOf(id) != -1) {                 // 普通奖励已经领取了但是没有开启额外奖励
            resp.code = 1;
            resp.desc = 'already rewarded';
            break;
        }

        if (conf.limitLevel > ~~(user.activity.manually.now_exp / gConfGlobalNew.avmanuallyGradeExp)) {
            resp.code = 1;
            resp.desc = 'level is not enough';
            break;
        }

        var tAwards = [];
        if (tPlayerManuallyInfo.rewards.def_list.indexOf(id) == -1) {
            tPlayerManuallyInfo.rewards.def_list.push(id);
            player.markDirty('activity.manually.rewards.def_list');
            tAwards = tAwards.concat(conf.baserewards);
        }

        if (tPlayerManuallyInfo.is_unlock && tPlayerManuallyInfo.rewards.ex_list.indexOf(id) == -1) {
            tPlayerManuallyInfo.rewards.ex_list.push(id);
            player.markDirty('activity.manually.rewards.ex_list');
            tAwards = tAwards.concat(conf.addrewards);
        }

        if (tAwards.length > 0) {
            resp.data.def_list = tPlayerManuallyInfo.rewards.def_list;
            resp.data.ex_list = tPlayerManuallyInfo.rewards.ex_list;
            resp.data.awards = player.addAwards(tAwards, 'activity', 'get_manually_reward');
        }

    } while (false);

    onHandled();
};

exports.buy_manually_lv = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'manually')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var id = req.args.id;
        var conf = gConfAvmanuallyLevel[id];
        if (!player.checkCosts(conf.item)) {
            resp.code = 1;
            resp.desc = 'cash not enough';
            break;
        }

        var data = get_data(player);
        data.now_exp = (data.now_exp || 0) + (conf.manualLevel * gConfGlobalNew.avmanuallyGradeExp);
        data.buy_times = data.buy_times || {};
        data.buy_times[id] = data.buy_times[id] || 0;
        data.buy_times[id]++;

        resp.data.costs = player.addAwards(conf.item, 'activity', 'buy_manually_lv');
        resp.data.now_exp = data.now_exp;
        resp.data.buy_times = data.buy_times;

        player.markDirty('activity.manually');
    } while (false);

    onHandled();
}


/** 是否有奖励未领取 */
exports.has_manually_reward = function (player) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'manually')) { return false; }

        var tManuallyLv = ~~(user.activity.manually.now_exp % gConfGlobalNew.avmanuallyGradeExp);
        var tPlayerManuallyInfo = user.activity.manually;
        for (var tKey in gConfAvmanuallyAward) {
            if (!gConfAvmanuallyAward[tKey]) { continue; }
            if (tManuallyLv < tKey) { continue; }
            if (tPlayerManuallyInfo.is_unlock && tPlayerManuallyInfo.rewards.ex_list.indexOf(id) == -1) { return true; }
            if (tPlayerManuallyInfo.rewards.def_list.indexOf(id) == -1) { return true; }
        }

    } while (false);
}