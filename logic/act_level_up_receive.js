// ----------------------------------------------------------------------------
// 等级礼包
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "level_up";

var act_day_list = null;

// 获取数据
function get_data(player) {
    var user = player.user;
    if (!user.activity.level_up) {                                                     // 没有参与过
        user.activity.level_up = {};
    }

    var tUserActInfo = user.activity.level_up;

    tUserActInfo.target_time = tUserActInfo.target_time || (common.getTime(common.getDate(user.info.create - (gConfGlobalNew.resetHour * 3600))) + gConfGlobalNew.avLevelupReceiveTime * 3600 + gConfGlobalNew.resetHour * 3600);
    if (tUserActInfo.can_get != 2 && (common.getTime() >= tUserActInfo.target_time)) {
        tUserActInfo.can_get = 1;
    }

    tUserActInfo.open_day = getGameDate();//gConfActivities[act_name].startTime

    player.markDirty('activity.level_up');

    return tUserActInfo;
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
    if (!isActivityStart(player, act_name)) { return; }
    var tGiftName = gift_key + "_" + gift_id;
    if (tGiftName != gConfGlobalNew.avLevelupGmRechargeid) { return; }

    var tUserActInfo = get_data(player);
    tUserActInfo.can_get = 2;

    var awards = player.addAwards(parseAwardsConfig(gConfGlobalNew.avLevelupRechargeReceiveaward));
    if (player.memData.payAwards) {
        player.memData.payAwards = player.memData.payAwards.concat(awards.awards);
    } else {
        player.memData.payAwards = awards.awards;
    }

    player.markDirty('activity.level_up');
}


// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
    logic_event_mgr.on(logic_event_mgr.EVENT.ON_PAY, on_pay);
}


// ----------------------------------------------------------------------------
// export for request

/** 获取信息 */
exports.get_info = function (player, req, resp, onHandled) {
    do {
        var data = get_data(player);

        if (!isActivityStart(player, act_name)) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }
        resp.data = data;
    } while (false);

    onHandled();

};

/** 领取 */
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, act_name)) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var tUserActInfo = get_data(player);
        if (tUserActInfo.can_get == 2) {
            resp.code = 1;
            resp.desc = 'already get';
            break;
        }

        var tNowTime = common.getTime();
        if (tNowTime < tUserActInfo.target_time) {
            resp.code = 1;
            resp.desc = 'time error';
            break;
        }

        var tAwardList = parseAwardsConfig(gConfGlobalNew.avLevelupReceiveaward);
        tUserActInfo.can_get = 2;
        player.markDirty('activity.level_up');

        resp.data.act_info = tUserActInfo;
        resp.data.awards = player.addAwards(tAwardList, 'activity', 'get_level_up_award');

    } while (false);

    onHandled();
};


/** 是否有奖励可领取 */
exports.has_reward = function (player) {
    var user = player.user;
    do {
        if (!isActivityStart(player, act_name)) { return false; }
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