// 服战系统
var ErrorCode = require('../countrywar/error.js').ErrorCode;

// 判断当前时间是否在服战开启时间内
function isCountryWarOpenTime() {
    var strBegin = gConfCountryWarBase.openTime.value[0].split(':');
    if (strBegin.length != 2) {
        return false;
    }

    var strEnd = gConfCountryWarBase.openTime.value[1].split(':');
    if (strEnd.length != 2) {
        return false;
    }

    var begin = new Date ();
    var end = new Date ();

    var now = new Date();

    var endHour = parseInt(strEnd[0]);
    var endMin = parseInt(strEnd[1]);
    var curHour = now.getHours();
    var curMin = now.getMinutes();

    var todayPass = 0;
    if (curHour > endHour || (curHour == endHour && curMin > endMin)) {
        todayPass = 1;
    }

    var weekDay = Date.getWeekDay() + todayPass;
    if (weekDay > 7)
        weekDay = 1;

    var openDay = weekDay;
    var diffDay = 0;
    for (var i = 0; i < gConfCountryWarBase.openDays.value.length; i++) {
        var find = false;
        for (var j = 0; j < gConfCountryWarBase.openDays.value.length; j++) {
            if (openDay == parseInt(gConfCountryWarBase.openDays.value[j])) {
                find = true;
                break;
            }
        }

        if (find) {
            break;
        } else {
            openDay++;
            diffDay ++;
        }
    }

    begin.setFullYear(begin.getFullYear(), begin.getMonth(), begin.getDate() + diffDay + todayPass);
    begin.setHours (parseInt(strBegin[0]));
    begin.setMinutes (parseInt(strBegin[1]));
    begin.setSeconds(0);

    end.setFullYear(end.getFullYear(), end.getMonth(), end.getDate() + diffDay + todayPass);
    end.setHours (parseInt(strEnd[0]));
    end.setMinutes (parseInt(strEnd[1]));
    end.setSeconds(59);

    var now = new Date ();
    if (now.getTime () - begin.getTime () > 0 && now.getTime () - end.getTime () < 0) {
        return true;
    } else {
        return false;
    }
}

// 检查是否能进入服战
function canEnterCountryWar(player, req, resp) {
    // 检测服战功能是否开启
    if (!isModuleOpen_new(player, 'countrywar')) {
        resp.code = ErrorCode.ERROR_COUNTRY_WAR_NOT_OPEN;
        resp.desc = 'not open';
        return false;
    }

    // 判断玩家等级
    //var needLevel = parseInt(gConfCountryWarBase.joinWarLevelLimit.value);
    //if (player.user.status.level < needLevel) {
    //    resp.code = ErrorCode.ERROR_USER_LEVEL_NOT_ENOUGH;
    //    resp.desc = 'level not enough';
    //    return false;
    //}

    // 判断服务器开启天数
    var curTime = common.getTime();
    var serverOpenTime = gConfGlobalServer.serverStartTime;
    var dayNum = Math.floor((curTime - serverOpenTime) / OneDayTime);
    if (dayNum < parseInt(gConfCountryWarBase.serverOpenDayLimit.value)) {
        resp.code = ErrorCode.ERROR_SERVER_OPEN_DAYS_NOT_ENOUGH;
        resp.desc = 'not country war time';
        return false;
    }


    // 检测服战开启时间
    if (!isCountryWarOpenTime()) {
        resp.code = ErrorCode.ERROR_NOT_COUNTRY_WAR_TIME;
        resp.desc = 'not country war time';
        return false;
    }

    return true;
}

// 获取服战信息
exports.get = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    var fightForce = player.getFightForce();

    var user = player.user;
    var tmpData = mapObject(user, gInitWorldUser);
    var updateData = mapObject(tmpData, gCountryWarUser);
    var serverId = config.ServerId;

    // 向服战服务器请求数据
    var countryWarRequest = {
        uid: req.uid,
        mod: 'countrywar',
        act: 'get',
        args: {
            user : updateData,
            serverId : serverId,
        }
    };

    requestCountryWar(countryWarRequest, resp, function(){
        if (resp.code == 0) {
            var score = resp.data.countrywar.score;
            player.setCountryScore(score);

            var awards = resp.data.awards;
            if (awards && awards.length > 0)
            {
                var curGoods = player.user.status.goods;
                if (curGoods > 0) {
                    var costs = [['user', 'goods', -curGoods]];
                    resp.data.costs = player.addAwards(costs,req.mod,req.act);
                }
                resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }
        }
        onHandled();
    });
};

// 获取指定城池信息
exports.get_city_info = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 离开服战
exports.leave = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 移动到指定的城池
exports.move_to_city = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 突进（当前城池中防守人数是进攻人数的两倍以上时可以选择突进）
exports.special_move = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 到达
exports.reach_city = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 发布召集令
exports.broadcast_call_of_duty = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    // 检查玩家官职是否满足要求
    user = player.user;
    var userPos = gConfPosition[user.info.position].position;
    if (userPos > parseInt(gConfCountryWarBase.callNeedPosition.value)) {
        resp.code = ErrorCode.ERROR_COUNTRY_POSITION_NOT_ENOUGH;
        resp.desc = 'country position not enough, your position is ' + userPos;
        onHandled();
        return;
    }

    var countryReq = {
        uid : req.uid,
        mod : 'countrywar',
        act : 'get_broadcast_call_count',
        args : {},
    };
    var countryResp = {
        code : 0,
        desc : '',
        data : {},
    };

    // 请求已发布号令的次数
    requestCountryWar(countryReq, countryResp, function(){
        if (countryResp.code == 0) {
            var count = countryResp.data.count;
            if (!count)
                count = 0;

            var costCashArray = gConfCountryWarBase.callConsumeCash.value;
            if (count > costCashArray.length - 1) {
                count = costCashArray.length - 1;
            }

            var cashNum = costCashArray[count];

            var costs = [['user', 'cash', -cashNum]];
            if (!player.checkCosts(costs)) {
                resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH;

                resp.desc = 'money not enough';
                onHandled();
                return;
            }

            req.args.serverId = config.ServerId;
            requestCountryWar(req, resp, function(){
                if (resp.code == 0) {
                    // 消耗集结令
                    resp.data.costs = player.addAwards(costs,req.mod,req.act);

                    if (resp.data.awards)
                        resp.data.awards = player.addAwards(resp.data.awards,req.mod,req.act);
                }
                onHandled();
                return;
            });
        }
    });
};

exports.get_broadcast_call_count = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 响应集结令
exports.respond_call_of_duty = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 匹配对手
exports.match_enemy = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        if (resp.code == 0) {
            if (resp.data) {
                player.memData.status = 'prepare_countrywar';
                player.memData.enemy_uid = resp.data.enemy.uid;
                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;
            } else {
                DEBUG('match_enemy enemy is null');
                resp.data = {};
            }
        }
        onHandled();
    });
};

// 单挑
exports.solo_fight = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        if (resp.code == 0) {
            if (resp.data) {
                player.memData.status = 'prepare_countrywar';
                player.memData.enemy_uid = resp.data.enemy.uid;
                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;
            } else {
                DEBUG('match_enemy enemy is null');
                resp.data = {};
            }
        }
        onHandled();
    });
};

// 死亡回城
exports.death = function (player, req, resp, onHandled) {
    requestCountryWar(req, resp, function(){
        onHandled();
    });
};

// 撤军
exports.back_to_city = function (player, req, resp, onHandled) {
    /*var moneyType = req.args.money_type;
    if (!moneyType) {
        moneyType = 0;
    }

    // 检查集结令是否满足
    var moneyStr = 'goods';
    var moneyNum = parseInt(gConfCountryWarBase.backToCityConsume.value);
    if (moneyType == 1) {
        moneyStr = 'cash';
        moneyNum = parseInt(gConfCountryWarBase.backToCityConsumeCash.value);
    }

    // 检查物资是否满足
    var costs = [['user', moneyStr, -moneyNum]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_GOODS_NOT_ENOUGH;
        if (moneyType == 1) {
            resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH;
        }
        resp.desc = 'material not enough';
        onHandled();
        return;
    }*/

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        if (resp.code == 0) {
            //resp.data.costs = player.addAwards(costs);
        }
        onHandled();
    });
};

// 快速复活
exports.fast_relive = function (player, req, resp, onHandled) {
    // 检测能否进入服战
    if (!canEnterCountryWar(player, req, resp)) {
        onHandled();
        return;
    }

    var moneyType = req.args.money_type;
    if (!moneyType) {
        moneyType = 0;
    }

    // 检查集结令是否满足
    var moneyStr = 'goods';
    var moneyNum = parseInt(gConfCountryWarBase.reliveConsume.value);
    if (moneyType == 1) {
        moneyStr = 'cash';
        moneyNum = parseInt(gConfCountryWarBase.reliveConsumeCash.value);
    }

    var costs = [['user', moneyStr, -moneyNum]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_GOODS_NOT_ENOUGH;
        if (moneyType == 1) {
            resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH;
        }
        resp.desc = 'material not enough';
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function(){
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
        }
        onHandled();
    });
};

// 战斗
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 状态检查
        if(player.memData.status != 'prepare_countrywar') {
            resp.code = 1; resp.desc = 'status error, status is ' + player.memData.status; break;
        }

        // 参数检查
        if (req.args.enemy_uid != player.memData.enemy_uid) {
            resp.code = 1; resp.desc = 'error enemy arm'; break;
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };

        // 请求数据
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'idle';
                player.memData.enemy_id = 0;
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

// 领取个人任务奖励
exports.get_personal_task_award = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 领取国家任务奖励
exports.get_country_task_award = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取国家任务列表
exports.get_country_task = function (player, req, resp, onHandled) {
    do {
        // 检测服战功能是否开启
        if (!isModuleOpen_new(player, 'countrywar')) {
            resp.code = ErrorCode.ERROR_COUNTRY_WAR_NOT_OPEN;
            resp.desc = 'not open';
            onHandled();
            return;
        }

        // 判断服务器开启天数
        var curTime = common.getTime();
        var serverOpenTime = gConfGlobalServer.serverStartTime;
        var dayNum = Math.floor((curTime - serverOpenTime) / OneDayTime);
        if (dayNum < parseInt(gConfCountryWarBase.serverOpenDayLimit.value)) {
            resp.code = ErrorCode.ERROR_SERVER_OPEN_DAYS_NOT_ENOUGH;
            resp.desc = 'not country war time';
            onHandled();
            return;
        }

        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取个人排行榜信息
exports.get_rank_list = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取国家排行榜信息
exports.get_country_rank_list = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获得集结令列表
exports.get_call_list = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 领取排行榜奖励
exports.get_rank_award = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 设置防守阵型
exports.set_team = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        var skills = req.args.skills;
        if (!team || !skills) {
            resp.code = 1; resp.desc = 'no team or no skills'; break;
        }

        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取阵型
exports.get_team = function(player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, onHandled);
};

// 获取个人积分，国家积分
exports.get_score = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取城池战斗信息
exports.get_city_battle_info = function (player, req, resp, onHandled) {
    do {
        req.args.serverId = config.ServerId;
        requestCountryWar(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 获取商店信息
exports.shop_get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var shopType = ShopType.COUNTRYWAR;
        var count = 99;
        var countryWarShop = user.shop[shopType];
        if (!countryWarShop) {
            countryWarShop = {};
            countryWarShop.refresh = 0;
            countryWarShop.goods = {};
        }

        // 自动刷新
        var today = common.getDate();
        var goodsCount = Object.keys(countryWarShop.goods).length;
        if (countryWarShop.refresh != today || goodsCount == 0) {
            player.refreshShop(shopType, count);
            countryWarShop.refresh = today;
            player.markDirty(util.format('shop.%d.refresh', shopType));
        }

        resp.data.shop = countryWarShop;
    } while (false);

    onHandled();
};

// 刷新商店
exports.shop_refresh = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var cashCost = parseInt(gConfGlobal.countryWarShopRefreshCost);
        var costs = [['user', 'cash', -cashCost]];

        var shopType = ShopType.COUNTRYWAR;
        var count = 6;
        var now = common.getTime();
        var countryWarShop = user.shop[shopType];
        if (!countryWarShop) {
            countryWarShop = {};
            countryWarShop.refresh = 0;
            countryWarShop.goods = {};
        }

        // 刷新
        var today = common.getDate();
        player.refreshShop(shopType, count);
        countryWarShop.refresh = today;
        player.markDirty(util.format('shop.%d.refresh', shopType));

        resp.data.shop = countryWarShop;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

// 兑换
exports.shop_buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var id = Math.floor(+req.args.id);
        var shopType = ShopType.COUNTRYWAR;
        var countryWarShop = user.shop[shopType];

        if (!countryWarShop.goods[id]) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        var good = countryWarShop.goods[id];
        if (good[1]) {
            resp.code = 1; resp.desc = 'has bought'; break;
        }

        var costId = good[0];
        var costs = gConfShop[id]['cost'+costId]
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var awards = gConfShop[id].get;
        if (awards[0][0] == 'equip') {
            if (player.memData.equip_num >= user.equip_valume) {
                resp.code = 1; resp.desc = 'equip full'; break;
            }
            awards = [['equip', good[2], good[3], 1]];
        }

        //good[1] = 1;
        //player.markDirty(util.format('shop.%d.goods.%d', shopType, id));
        player.doDailyTask('shopBuy', 1);

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
    } while (false);

    onHandled();
};

// 获取国战开启时间
exports.get_open_time = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 聊天
exports.chat = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 喊话
exports.shout = function (player, req, resp, onHandled) {
    var costs = [['material', gConfGlobal.shoutCostId, -1]];
    if (!player.checkCosts(costs)) {
        resp.code = 1;
        resp.desc = 'material not enough';
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
        }
        onHandled();
    });
};

// 获取聊天记录
exports.get_chat_log = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

exports.get_shout_log = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 移除战斗冷却
exports.clear_fight_cool_time = function (player, req, resp, onHandled) {
    var cashNum = parseInt(gConfCountryWarBase.battleDiffTimeCash.value);
    var costs = [['user', 'cash', -cashNum]];

    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH;
        resp.desc = 'money not enough';
        onHandled();
        return;
    }

    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
        }
        onHandled();
    });
};

exports.get_city_camp_players = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

exports.get_events = function (player, req, resp, onHandled) {
    req.args.serverId = config.ServerId;
    requestCountryWar(req, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};