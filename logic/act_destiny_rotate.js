// ----------------------------------------------------------------------------
// 命运之轮 2020-04-16
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "destiny_rotate";
const special_id = 'material.300008';

function get_default_act_data() {
    return {
        'small_stage': 0,                   // 小转盘轮数
        'small_got': {},                    // 小转盘中领取过的
        'large_stage': 0,                   // 大转盘轮数
        'large_got': {},                    // 大转盘中领取过的
    }
}

/**
 * 获取数据
 * @param {*} player 
 */
function get_data(player) {
    var user = player.user;

    var tUserActInfo = user.activity[act_name];
    if (!tUserActInfo || tUserActInfo.open_day != gConfActivities[act_name].startTime) {
        user.activity[act_name] = get_default_act_data();
        user.activity[act_name].open_day = gConfActivities[act_name].startTime;
    }
    user.activity[act_name].large_stage = user.activity[act_name].large_stage || 1;
    user.activity[act_name].small_stage = user.activity[act_name].small_stage || 1;

    player.markDirty(`activity.${act_name}`);
    tUserActInfo = user.activity[act_name];

    return tUserActInfo;
}

function get_rotate_result(conf, has_got, special_item) {

    var weight = 0;
    var filtered = [];
    var tItemNum = 0;
    for (var tKey in conf) {
        var tItemInfo = conf[tKey];
        if (!tItemInfo) { continue; }
        if (has_got[tKey]) { continue; }

        filtered.push([tKey, tItemInfo.weight]);
        weight = weight + (tItemInfo.weight - 0);
        tItemNum++;
    }

    var tConfKey = 0;
    if (tItemNum != 1) {
        var rand = common.randRange(0, weight - 1);
        for (var m = filtered.length - 1; m >= 0; m--) {
            weight -= filtered[m][1];
            if (rand < weight) { continue; }
            tConfKey = filtered[m][0];
            break;
        }
    }
    else {
        tConfKey = filtered[0][0];
    }

    var tIsGetAll = false;
    var item_id_list = [];
    var tIsSpecilaItem = false;
    for (var i = 0; i < conf[tConfKey].awards.length; i++) {
        if (!special_item) { continue; }
        if (conf[tConfKey].awards[i][0] != special_item[0][0] || conf[tConfKey].awards[i][1] != special_item[0][1]) { continue; }
        tIsSpecilaItem = true;
        break;
    }

    if (tIsSpecilaItem) {                           // 抽到特殊道具 所有物品都自动获取
        for (var tKey in conf) {
            var tItemInfo = conf[tKey];
            if (!tItemInfo) { continue; }
            if (has_got[tKey]) { continue; }

            for (var i = 0; i < conf[tKey].awards.length; i++) {
                if (special_item && conf[tKey].awards[i][0] == special_item[0][0] && conf[tKey].awards[i][1] == special_item[0][1]) { continue; }
                item_id_list.push(conf[tKey].awards[i]);
            }
        }

        tIsGetAll = true;                               // 所有道具领取完毕 清空
    }
    else {
        if (tItemNum == 1) {
            tIsGetAll = true;                            // 所有道具领取完毕 清空
        }
        else {
            has_got[tConfKey] = true;
        }

        for (var i = 0; i < conf[tConfKey].awards.length; i++) {
            if (special_item && conf[tConfKey].awards[i][0] == special_item[0][0] && conf[tConfKey].awards[i][1] == special_item[0][1]) { continue; }
            item_id_list.push(conf[tConfKey].awards[i]);
        }
    }

    return {
        is_get_all: tIsGetAll,                                  // 是否获取完毕
        item_id_list: item_id_list,                             // 获得的奖励id
        has_special: tIsSpecilaItem,                            // 是否获取特殊道具
        get_idx: tConfKey,                                      // 抽到的sort
    }
}

function player_rotate(player, act_info) {
    var tResult = null;

    var tLargeCost = parseAwardsConfig(special_id);
    var tSmallRotate = get_rotate_result(gConfAvDestinyRotateNormal[act_info.small_stage], act_info.small_got, tLargeCost);       // 小转盘
    if (tSmallRotate) {
        if (tSmallRotate.is_get_all) {
            act_info.small_stage++;
            act_info.small_got = {};
        }
        tResult = tResult || {};
        tResult.reward_list = tSmallRotate.item_id_list || [];
        tResult.small_index = tSmallRotate.get_idx;
    }

    var tLargeRotate = null;
    if (tSmallRotate && tSmallRotate.has_special) {
        tLargeRotate = get_rotate_result(gConfAvDestinyRotateHigh[act_info.large_stage], act_info.large_got);                // 大转盘
    }
    if (tLargeRotate) {
        if (tLargeRotate.is_get_all) {
            act_info.large_stage++;
            act_info.small_stage = 1;
            act_info.large_got = {};
        }
        tResult.reward_list = tResult.reward_list.concat(tLargeRotate.item_id_list || []);
        tResult.large_index = tLargeRotate.get_idx;
    }

    return tResult;
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
    player.user = player.user || {};
    player.user.status = player.user.status || {};
    player.user.status.fate_coin = player.user.status.fate_coin || 0;
}

/** 每日触发函数 player.js中会自动调用 */
exports.reset_by_day = function (player, today) {
    exports.has_reward(player);
};

/** 更新用户数据 upgrade.js中需要添加到upgrades列表中 */
exports.upgrade = function (player) {
    player.user = player.user || {};
    player.user.status = player.user.status || {};
    player.user.status.fate_coin = player.user.status.fate_coin || 0;
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
 * 购买货币
 */
exports.buy_token = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var tBuyTimes = req.args.times || 1;
        var cost = parseAwardsConfigByCount(gConfGlobalNew["fatewheelBuyHero_expNumCost"], tBuyTimes);

        if (!player.checkCosts(cost)) {                            // 所需消耗是否足够
            resp.code = 5;
            resp.desc = 'cost not enough';
            break;
        }
        resp.data.costs = player.addAwards(cost, 'act_destiny_rotate', 'buy');

        var tAddItemList = [];
        tAddItemList = tAddItemList.concat(parseAwardsConfigByCount(gConfGlobalNew["fatewheelBuyHero_expNum"], tBuyTimes));
        tAddItemList = tAddItemList.concat(parseAwardsConfigByCount(gConfGlobalNew["fatewheelBuyFortuneCoinNum"], tBuyTimes));

        awards = player.addAwards(tAddItemList);
        if (player.memData.payAwards) {
            player.memData.payAwards = player.memData.payAwards.concat(awards.awards);
        } else {
            player.memData.payAwards = awards.awards;
        }
        resp.data.awards = awards;
    } while (false);

    onHandled();
}

/**
 * 转
 */
exports.rotate = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, act_name)) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var tUserActInfo = get_data(player);
        tUserActInfo.large_stage = tUserActInfo.large_stage || 1;
        tUserActInfo.small_stage = tUserActInfo.small_stage || 1;
        if (!gConfAvDestinyRotateHigh[tUserActInfo.large_stage]) {
            resp.code = 1;
            resp.desc = 'invalid type';
            break;
        }

        var cost = gConfAvDestinyRotateCost[tUserActInfo.small_stage];
        if (!cost) {
            resp.code = 1;
            resp.desc = 'invalid type';
            break;
        }

        if (!player.checkCosts(cost.awards)) {                            // 所需消耗是否足够
            resp.code = 1;
            resp.desc = 'cost not enough';
            break;
        }
        resp.data.costs = player.addAwards(cost.awards, 'act_destiny_rotate', 'rotate');

        var tRotateResult = player_rotate(player, tUserActInfo);
        if (!tRotateResult) {
            resp.code = 1;
            resp.desc = 'rotate error';
            break;
        }

        var awards = tRotateResult.reward_list;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.small_index = tRotateResult.small_index || 0;
        resp.data.large_index = tRotateResult.large_index || 0;
        resp.data.act_info = tUserActInfo;

        player.markDirty(`activity.${act_name}`);
    } while (false);

    onHandled();
};