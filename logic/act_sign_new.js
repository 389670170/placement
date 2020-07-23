// ----------------------------------------------------------------------------
// 签到 2020-04-15
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "sign_new";

function get_default_act_data() {
    return {
        'get_count': 0,                      // 已经领取过的次数
    }
}

/**
 * 获取数据
 * @param {*} player 
 */
function get_data(player) {
    var user = player.user;

    var tUserActInfo = user.activity[act_name];
    if (!tUserActInfo) {
        user.activity[act_name] = get_default_act_data();
    }

    player.markDirty(`activity.${act_name}`);
    tUserActInfo = user.activity[act_name];

    return tUserActInfo;
}

function total_can_get_times(player) {
    var user = player.user;
    var times = common.getDateDiff(common.getDate(common.getTime() - (gConfGlobalNew.resetHour * 3600)), common.getDate(user.info.create - (gConfGlobalNew.resetHour * 3600))) + 1;
    // var times = (common.getTime() - user.info.create) / (24 * 60 * 60);
    return (times > 0 ? times : 0);
}

// /**
//  * 充值事件
//  * @param {*} player 
//  * @param {number} cash 
//  * @param {number} chargeId 
//  * @param {number} gift_key 
//  * @param {number} gift_id 
//  */
// function on_pay(player, cash, chargeId, gift_key, gift_id, amount) {
//     if (!isActivityStart(player, act_name)) { return; }

//     LOG(`onpay:${act_name} cash:${cash} chargeId:${chargeId}`);
//     var rechargeConf = gConfRecharge[chargeId];
//     cash = amount || cash || (rechargeConf ? rechargeConf.amount : 0);
//     cash = cash - 0;

//     player.markDirty(`activity.${act_name}`);
// }


// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
    // logic_event_mgr.on(logic_event_mgr.EVENT.ON_PAY, on_pay);
}

/** 服务器启动时 创建用户数据 player.js中会自动调用 */
exports.init_user_data = function (user) {
    if (!user) { return; }
    user.activity = user.activity || {};
    user.activity[act_name] = get_default_act_data();
};

/** 登陆时触发 */
exports.reset_by_login = function (player) {
}

/** 每日的重置函数 player.js中会自动调用 */
exports.reset_by_day = function (player, today) {
    exports.has_reward(player);
};

/** 更新用户数据 upgrade.js中需要添加到upgrades列表中 */
exports.upgrade = function (player) {
    get_data(player);
};

/** 是否有奖励可领取 */
exports.has_reward = function (player) {
    var user = player.user;
    do {
        var tUserActInfo = get_data(player);
        var tTotalCanGetTimes = total_can_get_times(player);
        if (tTotalCanGetTimes - tUserActInfo.get_count) {
            player.addTip(act_name);
        }
        else {
            player.rmTip(act_name);
        }
    } while (false);
    return false;
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
        resp.data.act_info = tUserActInfo;
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

        var tTotalCanGetTimes = total_can_get_times(player);
        var tUserActInfo = get_data(player);
        // tUserActInfo.get_count = req.args.test || tUserActInfo.get_count;
        if ((tTotalCanGetTimes - tUserActInfo.get_count) <= 0) {
            resp.code = 1;
            resp.desc = 'cant get';
            break;
        }

        tUserActInfo.get_count = tUserActInfo.get_count - 0 + 1;

        var tRound = (~~(tUserActInfo.get_count / 30)) + ((tUserActInfo.get_count % 30) ? 1 : 0);
        var tID = (tUserActInfo.get_count % 30) || 30;

        var tMaxKey = 1;
        for (var tKey in gConfAVSignNew) {
            tMaxKey = (tMaxKey >= tKey) ? tMaxKey : (tKey - 0);
            if (tMaxKey == tRound) { break; }
        }

        tRound = (tRound > tMaxKey) ? tMaxKey : tRound;

        var config = gConfAVSignNew[tRound][tID];
        if (!config) {
            resp.code = 1;
            resp.desc = 'config error';
            break;
        }

        var awards = config.reward;
        resp.data = player.addAwards(awards, req.mod, req.act);
        resp.data.act_info = tUserActInfo;

        player.markDirty(`activity.${act_name}`);
    } while (false);

    onHandled();
};