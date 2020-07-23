// ----------------------------------------------------------------------------
// 签到 2020-04-15
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "online_award";

function get_default_act_data() {
    return {
        'get_idx': 0,                       // 当前奖励ID
        'last_get_time': 0,                 // 最后一次获取时间
    }
}

/**
 * 获取数据
 * @param {*} player 
 */
function get_data(player) {
    if (!player) { return; }
    var user = player.user;

    var tUserActInfo = user.activity[act_name];
    if (!tUserActInfo) {
        user.activity[act_name] = get_default_act_data();
    }
    user.activity[act_name].get_idx = user.activity[act_name].get_idx || 1;
    user.activity[act_name].last_get_time = user.activity[act_name].last_get_time || user.info.create;

    player.markDirty(`activity.${act_name}`);
    tUserActInfo = user.activity[act_name];

    return tUserActInfo;
}

// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
}

/** 服务器启动时 创建用户数据 player.js中会自动调用 */
exports.init_user_data = function (user) {
    if (!user) { return; }
    user.activity = user.activity || {};
    user.activity[act_name] = get_default_act_data();
    user.activity[act_name].get_idx = user.activity[act_name].get_idx || 1;
    user.activity[act_name].last_get_time = user.activity[act_name].last_get_time || user.info.create;
};

/** 登陆时触发 */
exports.reset_by_login = function (player) {
    get_data(player);
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
        // var tUserActInfo = get_data(player);
        // var tTotalCanGetTimes = total_can_get_times(player);
        // if (tTotalCanGetTimes - tUserActInfo.get_count) {
        //     player.addTip(act_name);
        // }
        // else {
        //     player.rmTip(act_name);
        // }
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
        var tUserActInfo = get_data(player);
        var config = gConfOnline[tUserActInfo.get_idx];
        if (!config) {
            resp.code = 1;
            resp.desc = 'config error';
            break;
        }

        var tDiffTime = 10 + common.getTime() - (tUserActInfo.last_get_time);
        if (tDiffTime < (config.interval * 60)) {             // 从最后一次领取开始计算
            // if ((user.info.create + (config.interval * 60)) > common.getTime()) {                // 从创建开始计算
            resp.code = 1;
            resp.desc = `time too sort idx ${tUserActInfo.get_idx} time ${tDiffTime} : ${(config.interval * 60)}`;
            break;
        }

        tUserActInfo.last_get_time = common.getTime();
        var awards = config.award;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        tUserActInfo.get_idx = tUserActInfo.get_idx + 1;
        resp.data.act_info = tUserActInfo;

        player.markDirty(`activity.${act_name}`);
    } while (false);

    onHandled();
};