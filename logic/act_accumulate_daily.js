// ----------------------------------------------------------------------------
// 每日累充
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "accumulate_daily";

/**
 * 获取数据
 * @param {*} player 
 */
function get_data(player) {
    var user = player.user;

    var tUserActInfo = user.activity[act_name] || {};
    var tPassDay = common.getDateDiff(getGameDate(), common.getDate(gConfActivities[act_name].startTime)) + 1;                  // 本期第几天
    if (!tUserActInfo.open_day || tUserActInfo.open_day != gConfActivities[act_name].startTime || user.activity[act_name].pass_day != tPassDay) {
        user.activity[act_name] = get_default_act_data();
        user.activity[act_name].open_day = gConfActivities[act_name].startTime;                    // 活动开启时间
        user.activity[act_name].pass_day = tPassDay;
    }
    user.activity[act_name].paid = user.activity[act_name].paid - 0;

    player.markDirty(`activity.${act_name}`);
    tUserActInfo = user.activity[act_name];

    return tUserActInfo;
}

function get_default_act_data() {
    return {
        'open_day': 0,                      // 活动开启时间
        'pass_day': 0,                      // 本期第几天
        'dayCount': 0,                      // 累计充值次数
        'paid': 0,                          // 已经充值数
        'rewards': {                         // 领奖状态
            // day: 1,                      // 已领取天数: 1
        },
    }
}

/**
 * 充值事件
 * @param {*} player 
 * @param {number} cash 
 * @param {number} chargeId 
 * @param {number} gift_key 
 * @param {number} gift_id 
 */
function on_pay(player, cash, chargeId, gift_key, gift_id, amount) {
    if (!isActivityStart(player, act_name)) { return; }

    LOG(`onpay:${act_name} cash:${cash} chargeId:${chargeId}`);
    var rechargeConf = gConfRecharge[chargeId];
    cash = amount || cash || (rechargeConf ? rechargeConf.amount : 0);
    cash = cash - 0;

    var day_recharge = get_data(player);
    day_recharge.paid = day_recharge.paid - 0;
    day_recharge.paid += cash;
    LOG(`onpay:${act_name} 2:  ${cash}  ${day_recharge.paid}`)

    player.markDirty(`activity.${act_name}`);
}


// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
    logic_event_mgr.on(logic_event_mgr.EVENT.ON_PAY, on_pay);
}


// ----------------------------------------------------------------------------
// export for request



/**
 * 获取内容
 */
exports.get_info = function (player, req, resp, onHandled) {
    do {
        if (!isActivityStart(player, act_name)) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var tUserActInfo = get_data(player);
        player.rmTip(act_name);
        resp.data.accumulate_daily = tUserActInfo;
    } while (false);

    onHandled();
};

/**
 * 领取奖励
 */
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, act_name)) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var id = req.args.id;
        var tActData = get_data(player);
        var config = global.gConfAvAccumulateDaily[id];
        if (!config) {
            resp.code = 1;
            resp.desc = 'invalid id';
            break;
        }

        if (tActData.rewards[id] || tActData.rewards[id] == 1) {
            resp.code = 1;
            resp.desc = 'The award has been claimed';
            break;
        }

        if (tActData.paid < config.rechargeamount) {
            resp.code = 1;
            resp.desc = 'recharge amount to lower';
            break;
        }

        tActData.rewards[id] = 1;
        player.markDirty(`activity.${act_name}`);

        var awards = config.awards;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.accumulate_daily = tActData;
    } while (false);

    onHandled();
};


/** 服务器启动时 创建用户数据 player.js中会自动调用 */
exports.init_user_data = function (user) {
    if (!user) { return; }
    user.activity = user.activity || {};
    user.activity[act_name] = get_default_act_data();
};

exports.reset_by_login = function (player) {
    var tActData = get_data(player);
    if (typeof (tActData.paid) == "string") {
        tActData.paid = 0;
    }
    else {
        tActData.paid = tActData.paid - 0;
    }
    player.markDirty(`activity.${act_name}`);
}

/** 每日的重置函数 player.js中会自动调用 */
exports.reset_by_day = function (player, today) {
    // if (isActivityStart(this, act_name)) {
    // get_data(player);
    // var user = player.user;
    // user.activity[act_name] = get_default_act_data();
    // user.activity[act_name].open_day = gConfActivities[act_name].startTime;                                                                     // 活动开启时间
    // }
};

/** 更新用户数据 upgrade.js中需要添加到upgrades列表中 */
exports.upgrade = function (player) {
    get_data(player);
};

/** 是否有奖励可领取 */
exports.has_reward = function (player) {
    var user = player.user;
    do {
    } while (false);
    return false;
}