// 商店

// 获取商店下次刷新时间
function getShopRefreshTime(id, tabId, last_refresh_time) {
    var shopConf = gConfShopNew[id];
    if (!shopConf) {
        return 0;
    }

    var tabConf = gConfShopTab[tabId];
    if (!tabConf) {
        return 0;
    }

    var hour = (new Date()).getHours(); // 当前时间小时数
    var dayString = common.getDateString();

    var resetTime = 0;
    var resetString = '';

    // 服务器重启重置
    if (tabConf.type == 'serverReset') {
        // 服务器重启重置
        resetTime = gServerStartTime;
    } else if (tabConf.type == 'dayReset') {
        // 每天重置
        var dailyResetHour = gConfGlobalNew.resetHour;
        if (last_refresh_time) {
            var todayString = common.getDateString(+(new Date())/1000);
            var todayResetString = todayString + ' ' + dailyResetHour + ':00:00';
            var todayResetTime = Date.parse(todayResetString) / 1000;
            if (last_refresh_time < todayResetTime) {
                resetTime = todayResetTime;
            } else {
                // 要跨一天
                resetTime += OneDayTime;
            }
        } else {
            if (hour < dailyResetHour) {
                resetString = dayString + ' ' + dailyResetHour + ':00:00';
            } else {
                // 要跨一天
                dayString = common.getDateString(+(new Date())/1000 + OneDayTime);
                resetString = dayString + ' ' + dailyResetHour + ':00:00';
            }

            resetTime = Date.parse(resetString) / 1000;
        }
    } else if (tabConf.type == 'weekReset') {
        // 每周重置
        var thisWeekTime = getWeekResetTime();
        var nextWeekTime = thisWeekTime + OneWeekTime;

        if (last_refresh_time < thisWeekTime) {
            resetTime = thisWeekTime;
        } else {
            resetTime = nextWeekTime;
        }
    } else if (tabConf.type == 'fixedReset') {
        // 指定时间点重置
        var resetHours = tabConf.typeValue;
        var preResetString = '';
        for (var i = 0; i < resetHours.length; i++) {
            var find = false;
            if (hour >= resetHours[i]) {
                preResetString = dayString + ' ' + resetHours[i] + ':00:00';
                continue;
            } else {
                resetString = dayString + ' ' + resetHours[i] + ':00:00';
                var secTime = Date.parse(resetString) / 1000;
                if (secTime > last_refresh_time) {
                    find = true;
                    break;
                } else {
                    preResetString = resetString;
                }
            }
        }

        if (!find) {
            // 需要跨天
            resetString = dayString + ' ' + resetHours[0] + ':00:00';
            resetTime = Date.parse(resetString) / 1000 + OneDayTime;
        } else {
            resetTime = Date.parse(resetString) / 1000;
        }

        var preResetTime = Date.parse(preResetString) / 1000;

        // 如果上次刷新时间比前一次的刷新时间还小，那先设置为前一次的刷新时间
        if (last_refresh_time < preResetTime) {
            resetTime = preResetTime;
        }
    }

    return resetTime;
}

exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shopId = req.args.id;   // 商店id
        var tabId = req.args.tab;
        if (!shopId || !tabId) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (!user.shop_new) {
            user.shop_new = {};
            player.markDirty('shop_new');
        }

        var now = common.getTime();
        var shop = user.shop_new[shopId];
        if (!shop) {
            user.shop_new[shopId] = {};
            player.markDirty(util.format('shop_new.%d', shopId))

            shop = user.shop_new[shopId];
        }

        var tabInfo = shop[tabId];
        if (!tabInfo) {
            user.shop_new[shopId][tabId] = {};
            user.shop_new[shopId][tabId].goods = [];
            user.shop_new[shopId][tabId].manual_refresh_count = 0;
            user.shop_new[shopId][tabId].buy_count = 0;
            user.shop_new[shopId][tabId].refresh_time = 0;
            player.markDirty(util.format('shop_new.%d.%d', shopId, tabId));

            tabInfo = shop[tabId];
        }

        // 自动刷新
        var refreshTime = getShopRefreshTime(shopId, tabId, tabInfo.refresh_time);
        var nextRefreshTime = refreshTime;
        if (!tabInfo.refresh_time || (tabInfo.refresh_time < refreshTime && now >= refreshTime)) {
            player.refreshShopGoods(shopId, tabId);

            nextRefreshTime = getShopRefreshTime(shopId, tabId, refreshTime);
        }

        resp.data.shop = shop[tabId];
        resp.data.shop.next_refresh_time = nextRefreshTime;
    } while (false);

    onHandled();
};

exports.refresh = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shopId = req.args.id;   // 商店id
        var tabId = req.args.tab;
        if (!shopId || !tabId) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var shopConf = gConfShopNew[shopId];
        if (!shopConf) {
            resp.code = 1; resp.desc = 'shop id error'; break;
        }

        var tabConf = gConfShopTab[tabId];
        if (!tabConf) {
            resp.code = 1; resp.desc = 'tab index error'; break;
        }



        // 是否可以手动重置
        if (tabConf.autonomicReset == 0) {
            resp.code = 1; resp.desc = 'can not refresh by manual'; break;
        }

        // 是否超过手动刷新次数，resetLimit为0表示没有上限
        var refreshCount = user.shop_new[shopId][tabId].manual_refresh_count;

        var freeResetTime = 0;// 免费重置次数上限
        if(typeof tabConf.freeResetTime == 'number'){
            freeResetTime = tabConf.freeResetTime;
        } else {
            var val = tabConf.freeResetTime.split('.')[1];
            freeResetTime = gConfVip[user.status.vip][val];
        }

        // 英雄商店
        if (tabId == 201)
        {
            var tequanAdd = player.getPrivilegeVal('godShopRefresh');
            freeResetTime += tequanAdd;
        }

        var limitCount = 0; // 手动重置次数上限(总次数)
        if(typeof +tabConf.resetLimit == 'number'){
            limitCount = tabConf.resetLimit;
        }else{
            var key = tabConf.resetLimit.split('.')[1];
            limitCount = gConfVip[user.status.vip][key];
        }

        var costs = [];
        // 大于免费的 需要消耗
        if(refreshCount >= freeResetTime){
            // 检查消耗是否足够
            costs = tabConf.resetCost1;
            if (!player.checkCosts(costs)) {
                costs = tabConf.resetCost2;
                if (!player.checkCosts(costs)) {
                    resp.code = 1; resp.desc = 'cost not enough'; break;
                }
            }
        }

        if (refreshCount >= limitCount && (limitCount != 0)) {
            resp.code = 1; resp.desc = 'reset count max'; break;
        }

        player.refreshShopGoods(shopId, tabId);
        user.shop_new[shopId][tabId].manual_refresh_count++;
        player.markDirty(util.format('shop_new.%d.%d.manual_refresh_count', shopId, tabId));

        var shop = user.shop_new[shopId][tabId];
        var refreshTime = getShopRefreshTime(shopId, tabId, shop.refresh_time);

        if (shopId == 2 && tabId == 201) {
            player.doOpenSeven('heroShopRefresh', 1);
            player.doOpenHoliday('heroShopRefresh', 1);
        }


        //var shop = user.shop_new[shopId][tabId];
        resp.data.shop = shop;
        resp.data.shop.next_refresh_time = refreshTime;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.buy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shopId = req.args.id;   // 商店id
        var tabId = req.args.tab;
        var goodsIndex = req.args.goods_index;    // 商品id
        var buyCount = +req.args.buy_count; // 购买次数
        if (!shopId || !tabId || !goodsIndex) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        goodsIndex -= 1;

        if (!buyCount) {
            buyCount = 1;   // 如果没传这个参数，默认为1
        }
        if (buyCount < 1) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var shopConf = gConfShopNew[shopId];
        if (!shopConf) {
            resp.code = 1; resp.desc = 'shop id error'; break;
        }

        var tabConf = gConfShopTab[tabId];
        if (!tabConf) {
            resp.code = 1; resp.desc = 'tab index error'; break;
        }

        // 检查是否开启
        if (tabConf.openCondition && tabConf.openCondition != undefined && !isModuleOpen_new(player, tabConf.openCondition)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (!user.shop_new[shopId] || !user.shop_new[shopId][tabId]) {
            resp.code = 1; resp.desc = 'shopId or tabId error'; break;
        }

        var shopTab = user.shop_new[shopId][tabId];

        if (!shopTab.goods[goodsIndex]) {
            resp.code = 1; resp.desc = 'goods_index error'; break;
        }

        var groupId = shopTab.goods[goodsIndex].groupId;
        var goodsId = shopTab.goods[goodsIndex].goodsId;
        var groupConf = gConfShopGoods[groupId];
        if (!groupConf) {
            resp.code = 1; resp.desc = 'group not exist'; break;
        }

        var goodsConf = groupConf[goodsId];
        if (!goodsConf) {
            resp.code = 1; resp.desc = 'goods not exist'; break;
        }

        // 判断是否达到上限
        if (goodsConf.timesLimit != 0) {
            var timesLimit = goodsConf.timesLimit;
            var upNum = 0;
            if (typeof timesLimit == 'number') {
                upNum = timesLimit;
            } else {
                var arr = timesLimit.split('.');
                if (arr[0] == 'vip') {
                    upNum = gConfVip[user.status.vip][arr[1]];
                } else {
                    upNum = gConfLevel[user.status.level][arr[1]];
                }
            }
            if (shopTab.goods[goodsIndex].buy + buyCount > +upNum) {
                resp.code = 1; resp.desc = 'buy times max'; break;
            }
        }

        // 可见条件
        if (goodsConf.showLimit != 0)
        {
            var arr = goodsConf.showLimit.split('.');
            var limitType = arr[0];
            var limitValue = arr[1];

            var isMatch = false;

            if (limitType == 'vip') {
                isMatch = user.status.vip >= limitValue;
            }
            else if (limitType == 'level') {
                isMatch = user.status.level >= limitValue;
            }
            else if (limitType == 'tower') {
                isMatch = user.tower.top_floor >= limitValue;
            }
            else if (limitType == 'gameday') {
                // 开服天数
                var openDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
                openDay++;

                isMatch = openDay >= limitValue;
            }
            else {
                isMatch = true;
            }

            if (!isMatch)
            {
                 resp.code = 1; resp.desc = 'showLimit not enough'; break;
            }
        }

        // 检查购买条件
        if (goodsConf.buyLimitType != '' && goodsConf.buyLimitType != 0) {
            var userVal = 0;
            var buyLimitValue = goodsConf.buyLimitValue;

            if (goodsConf.buyLimitType == 'level') {
                userVal = user.status.level;
            } else if(goodsConf.buyLimitType == 'position') {
                userVal = user.info.position;
            } else if(goodsConf.buyLimitType == 'vip') {
                userVal = user.status.vip;
            } else if (goodsConf.buyLimitType == 'team') {
                // 战队等级
                userVal = player.memData.team_level;
            } else if (goodsConf.buyLimitType == 'task') {
                // 任务等级（爵位）
                userVal = user.task.nobility[0];
            } else if (goodsConf.buyLimitType == 'legion') {
                // 军团等级
                userVal = player.memData.legion_level;
            } else if (goodsConf.buyLimitType == 'tower') {
                // 军团等级
                userVal = user.tower.top_floor;
            } else if (goodsConf.buyLimitType == 'gameday'){
                // 开服天数
                var curTime = common.getTime();
                var serverOpenTime = gConfGlobalServer.serverStartTime;
                userVal = Math.floor((curTime - serverOpenTime) / OneDayTime) + 1;
            }

            if (goodsConf.buyLimitType == 'position') {
                if (userVal > buyLimitValue[0]){
                    resp.code = 1; resp.desc = 'condition not enough'; break;
                }
            } else {
                if (userVal < buyLimitValue[0]){
                    resp.code = 1; resp.desc = 'condition not enough'; break;
                }
            }
        }

        var costs = [];
        if (goodsConf.buyCost) {
            //costs = gConfBuy[buyCount][goodsConf.buyCost]
            var hasBuyCount = shopTab.goods[goodsIndex].buy;
            for (var i = 0; i < buyCount; i++) {
                var buyTime = hasBuyCount + i + 1;
                var tempCosts = clone(gConfBuy[buyTime][goodsConf.buyCost]);
                if (tempCosts) {
                    for (var j = 0; j < tempCosts.length; j++) {
                        if (costs.length > 0) {
                            var sameIndex = -1;
                            for (var k = 0; k < costs.length; k++) {
                                if (costs[k][0] == tempCosts[j][0] &&
                                    costs[k][1] == tempCosts[j][1]) {
                                    sameIndex = k;
                                    break;
                                }
                            }
                            if (sameIndex >= 0) {
                                costs[sameIndex][2] += tempCosts[j][2];
                            } else {
                                costs.push(tempCosts[j]);
                            }
                        } else {
                            costs.push(tempCosts[j]);
                        }
                    }
                }
            }
        }else {
            costs = clone(goodsConf.cost)
            for (var i = 0; i < costs.length; i++) {
                costs[i][2] = costs[i][2] * buyCount;
            }
        }

        // for (var i = 0; i < costs.length; i++) {
        //     costs[i][2] = costs[i][2] * buyCount;
        // }
        DEBUG('costs = ' + costs);
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cost not enough'; break;
        }

        shopTab.buy_count += buyCount;
        shopTab.goods[goodsIndex].buy += buyCount;
        player.markDirty(util.format('shop_new.%d.%d', shopId, tabId));

        var awards = clone(goodsConf.get);
        for (var i = 0; i < awards.length; i++) {
            if (awards[i][0] == 'equip' || awards[i][0] == 'group' || awards[i][0] == 'skywing' || awards[i][0] == 'skyweapon' || awards[i][0] == 'skymount') {
                awards[i][3] = awards[i][3] * buyCount;
            } else {
                awards[i][2] = awards[i][2] * buyCount;
            }
        }
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

        if (tabId == 101) {
            player.doDailyTask('shopBuy', buyCount);
        } else if (shopId == 2 && tabId == 201) {
            player.doOpenSeven('heroShopBuy', 1);
            player.doOpenHoliday('heroShopBuy', 1);
        }
    } while (false);

    onHandled();
};

