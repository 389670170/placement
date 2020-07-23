// ----------------------------------------------------------------------------
// 资源补给站
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

var act_day_list = null;

// 获取数据
function get_data(player) {
    var user = player.user;
    if (!user.activity.assets_feed) {                                                     // 没有参与过
        user.activity.assets_feed = {};
    }

    var tPassDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
    for (var tKey in user.activity.assets_feed) {
        tKey = tKey - 0;
        var tActData = gConfAvAssetsFeed[tKey]
        if (!tActData || (tActData.module && !isModuleOpen_new(player, tActData.module))) {                          // 没有达到对应条件
            delete user.activity.assets_feed[tKey];
            continue;
        }

        var tAssetsFeedData = user.activity.assets_feed[tKey]
        if (!tAssetsFeedData) { continue; }

        if (!tAssetsFeedData.buy_day) {
            delete user.activity.assets_feed[tKey];                                             // 这次购买的奖励昨日已经领取完毕 重置掉
            break;
        }

        if (!gConfAvAssetsFeedAward[tAssetsFeedData.get_stage]) {                               // 如果记录的id不在配置表中 代表配置表有修改，需要修订
            tAssetsFeedData.get_stage = get_buy_stage(tAssetsFeedData.last_get_day);
            continue;
        }

        if (tAssetsFeedData.get_times < tActData.day) { continue; }         // 还没有达到最大领取次数
        if (tAssetsFeedData.last_get_day == tPassDay) { continue; }         // 今天达到的最大领取天数


        delete user.activity.assets_feed[tKey];                                             // 这次购买的奖励昨日已经领取完毕 重置掉
    }

    player.markDirty('activity.assets_feed');

    return user.activity.assets_feed;
}

/**
 * 礼包是否有效
 * @param {*} player 
 * @param {*} id        购买的礼包id
 */
function is_valid_gift(player, id) {
    var tActData = gConfAvAssetsFeed[id]
    if (!tActData) { return false; }

    if (tActData.module && !isModuleOpen_new(player, tActData.module)) { return false; }

    return true;
}

/**
 * 获取奖励信息
 * @param {*} player
 * @param {number} id        购买的礼包ID
 * @param {number} start_day 购买的天数id
 */
function get_award_info(player, id, start_day) {
    if (!is_valid_gift(player, id)) { return null; }

    var tArardInfoDict = gConfAvAssetsFeedAward[start_day];
    if (!tArardInfoDict) { return null; }

    var tActData = gConfAvAssetsFeed[id]
    if (!tArardInfoDict[tActData.award]) { return null; }

    return tArardInfoDict[tActData.award];
}

function get_buy_stage(passedDay) {
    passedDay = passedDay || common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;

    if (!act_day_list) {
        act_day_list = [];
        for (var tKey in gConfAvAssetsFeedAward) {
            act_day_list.push(tKey - 0);
        }
        act_day_list = act_day_list.sort((m, n) => { return (m - n) });
    }

    tGiftID = 0
    for (var i = 0; i < act_day_list.length; i++) {
        if (passedDay > act_day_list[i]) { continue; }
        tGiftID = act_day_list[i];
        break;
    }
    return tGiftID;
}

/**
 * 充值事件
 * @param {*} player 
 * @param {number} cash 
 * @param {number} chargeId 
 * @param {number} gift_key 
 * @param {number} gift_id 
 */
function on_pay(player, cash, chargeId, gift_key, gift_id) {
    if (!isActivityStart(player, 'assets_feed')) { return; }
    var tGiftName = gift_key + "_" + gift_id;
    var tGiftInfo = null;
    for (var tKey in gConfAvAssetsFeed) {
        tKey = tKey - 0;
        if (gConfAvAssetsFeed[tKey].rechargeid != tGiftName) { continue; }
        tGiftInfo = gConfAvAssetsFeed[tKey]
        break;
    }

    if (!tGiftInfo) { return; }


    var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
    var tGiftID = get_buy_stage(passedDay);

    if (!tGiftID) {
        Error("error gift id " + passedDay);
        return;
    }

    if (tGiftInfo.module && tGiftInfo.module && !isModuleOpen_new(player, tGiftInfo.module)) { return false; }

    var tUserActInfo = get_data(player);
    tUserActInfo[tGiftInfo.id] = tUserActInfo[tGiftInfo.id] || {};
    tUserActInfo[tGiftInfo.id].get_stage = tGiftID;
    tUserActInfo[tGiftInfo.id].buy_day = passedDay;
    tUserActInfo[tGiftInfo.id].get_times = 0;
    tUserActInfo[tGiftInfo.id].last_get_day = 0;

    var awards = player.addAwards(tGiftInfo.buyaward);
    if (player.memData.payAwards) {
        player.memData.payAwards = player.memData.payAwards.concat(awards.awards);
    } else {
        player.memData.payAwards = awards.awards;
    }

    player.markDirty('activity.assets_feed');
}


// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
    logic_event_mgr.on(logic_event_mgr.EVENT.ON_PAY, on_pay);
}


// ----------------------------------------------------------------------------
// export for request

/** 获取资源补给站信息 */
exports.get_info = function (player, req, resp, onHandled) {
    do {
        if (!isActivityStart(player, 'assets_feed')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }
        var data = get_data(player);
        resp.data = data;
    } while (false);

    onHandled();

};

/** 领取资源补给 */
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'assets_feed')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var id = req.args.id;
        var tUserActInfo = get_data(player);
        if (!tUserActInfo[id]) {
            resp.code = 1;
            resp.desc = 'invalid id';
            break;
        }

        var tUserStage = tUserActInfo[id].get_stage;
        var tAwardInfo = get_award_info(player, id, tUserStage);
        if (!is_valid_gift(player, id) || !tAwardInfo) {
            resp.code = 1;
            resp.desc = 'invalid id';
            break;
        }

        var tActData = gConfAvAssetsFeed[id];
        if (tUserActInfo[id].get_times >= tActData.day) {                      // 超过最大领取天数
            resp.code = 1;
            resp.desc = 'error get';

            tUserActInfo[id].get_stage = 0;
            tUserActInfo[id].buy_day = 0;
            tUserActInfo[id].get_times = 0;
            tUserActInfo[id].last_get_day = 0;
            resp.data.get_info = tUserActInfo;
            break;
        }

        var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
        if (passedDay < (tUserActInfo[id].get_times + tUserActInfo[id].buy_day)) {       // 服务端购买后经过的天数不比领取次数多 代表今天已经领取过了应该领取的数量
            resp.code = 1;
            resp.desc = 'already get';
            break;
        }

        tUserActInfo[id].get_times++;
        tUserActInfo[id].last_get_day = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
        player.markDirty('activity.assets_feed');

        resp.data.get_info = tUserActInfo;
        resp.data.awards = player.addAwards(tAwardInfo, 'activity', 'get_assets_feed_award');

    } while (false);

    onHandled();
};


/** 是否有奖励可领取 */
exports.has_reward = function (player) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'assets_feed')) { return false; }
        var tUserActInfo = get_data(player);
        for (var tKey in tUserActInfo) {
            var tActGiftData = tUserActInfo[tKey]
            if (!tActGiftData) { continue; }
            if (!!tActGiftData.get_stage) { continue; }

            var tActData = gConfAvAssetsFeed[tKey]
            if (!tActData) { continue; }

            if (tActGiftData.get_times >= tActData.day) { continue; }

            var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
            if (tActGiftData.buy_day > passedDay) { continue; }                                                 // 错误的数据 购买天数比今天还晚

            if (tActGiftData.buy_day == passedDay && tActGiftData.get_times == 1) { continue; }                 // 今天买的 并且领取过

            return true;
        }
    } while (false);
}