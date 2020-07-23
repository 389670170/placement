exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shop = user.shop[ShopType.MARKET];
        var today = common.getDate(common.getTime() - gConfGlobal.resetHour*3600);
        if (shop.day != today) {
            shop.day = today;
            shop.goods = {};
            player.markDirty('shop.' + ShopType.MARKET);
        }

        resp.data.shop = shop.goods;
    } while (false);

    onHandled();
};

exports.buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        var itemConf = gConfMarket[id];
        if (!itemConf) {
            resp.code = 1; resp.desc = "invalid id"; break;
        }

        var num = Math.floor(req.args.num);
        if (isNaN(num) || num < 1) {
            resp.code = 1; resp.desc = "invalid num"; break;
        }

        var shop = user.shop[ShopType.MARKET];
        var today = common.getDate(common.getTime() - gConfGlobal.resetHour*3600);
        if (shop.day != today) {
            resp.code = 1; resp.desc = "not refresh"; break;
        }

        var userLevel = user.status.level;
        if (userLevel < itemConf.lowLevel || userLevel > itemConf.highLevel) {
            resp.code = 1; resp.desc = "not match level"; break;
        }

        var buyLimit = itemConf['vip' + user.status.vip];
        var buyCount = shop.goods[id] ? shop.goods[id] : 0;
        if (buyLimit && buyCount >= buyLimit) {
            resp.code = 1; resp.desc = "buy limit"; break;
        }

        var cashCost = 0;
        if (!buyLimit) {
            cashCost = itemConf.originPrice * num;
        } else {
            var curStage = 1;
            for (var i = buyCount+1; i <= buyCount+num; i++) {
                var curCost = itemConf['price'+curStage];
                for (var j = curStage; j <= gConfGlobal.marketPriceCount; j++) {
                    if (!itemConf['time'+j]) {
                        break;
                    }

                    if (i >= itemConf['time'+j]) {
                        curCost = itemConf['price' + j];
                        curStage = j;
                    } else {
                        break;
                    }
                }
                cashCost += curCost;
            }
        }

        var costs = [['user', 'cash', -cashCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "not enough cash"; break;
        }

        shop.goods[id] = buyCount + num;
        player.markDirty(util.format('shop.%d.goods.%d', ShopType.MARKET, id));

        player.doDailyTask('shopBuy', num);
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(timeAwards(itemConf.award, num),req.mod,req.act);
    } while (false);

    onHandled();
};
