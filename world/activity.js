function Activity() {
    this.openSeven = {                          // 七日活动抢购
        // id: 0,                               // 子任务id: 已购买数量
    };

    this.openHoliday = {                          // 七日活动抢购
        // id: 0,                               // 子任务id: 已购买数量
    };

    this.weekGift = {                           // 周礼包
        goods: [],                             // 周礼包的可购买物品id
        update: 0,                             // 刷新时间
    };

    this.luckyDragon = [
        /*
        {
            uid: 0,                                 // 玩家uid, 上次使用
            cash: 0,                                // 玩家uid, 上次使用
        }
         */
    ];

    this.growFund = 0;                          // 成长基金购买人数

    this.dropsDragon = {                        // 滴滴打龙
        goods: {
            // ids: 0,                          // 商品id: 已领取数目
        },
    };

    this.open_rank = {                          // 开服排行
        ff: 0,                                  // 战力结算时间
        ff_10: 0,                               // 战力结算时间
        ff_15: 0,                               // 战力结算时间
        level: 0,                               // 等级结算时间

        final_ff_rank: null,                    // 活动结束时的战力前51名
        final_ff_10_rank: null,                    // 活动结束时的战力前51名
        final_ff_15_rank: null,                    // 活动结束时的战力前51名
        final_lv_rank: null,                    // 活动结束时的等级前51名

        recharge_rank: null,
        final_recharge_rank: null,

        expense_rank: null,
        final_expense_rank: null,
    };

    this.updates = {};

    this.buy_award = {
        //星期数:{id:购买了的次数}
    };
}

/** 排行活动的结束时间 对应时间会直接发放邮件奖励 */
function getOpenRankOverDate(name) {

    var tActivityInfo = gConfActivitiesRaw[name];
    if (!tActivityInfo) { return 0; }

    var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
    var tConfigDict = gConfAvSchedule[name] || {};
    for (var round in tConfigDict) {
        var conf = tConfigDict[round];
        if (!conf) { continue; }

        if (passedDay >= conf.startDay && passedDay <= (conf.endDay + 1)) {
            return common.getDate(common.getTime(gConfGlobalServer.serverStartDate) + (conf.endDay + 1) * 24 * 60 * 60);
            // return (gConfGlobalServer.serverStartDate + conf.endDay + 1);
        }
    }

    if (tActivityInfo.endTime) {
        return (common.getDate(tActivityInfo.endTime));
    }

    return common.getDate(common.getTime(gConfGlobalServer.serverStartDate) + (gConfActivitiesRaw[name].openDay + gConfActivitiesRaw[name].duration) * 24 * 60 * 60);
}

Activity.create = function (callback) {
    var activityData = {
        '_id': 'activity',
        'open_seven': {},
        'lucky_dragon': [],
        'grow_fund': 0,
        'open_rank': {
            'ff': 0,
            'ff_10': 0,
            'ff_15': 0,
            'level': 0,
        },
        open_holiday: {},
    };

    gDBWorld.insert(activityData, function (err, result) {
        callback && callback();
    });
};

Activity.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'activity' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.openSeven = doc.open_seven;
                this.openHoliday = doc.open_holiday ? doc.open_holiday : this.openHoliday;
                this.luckyDragon = doc.lucky_dragon ? doc.lucky_dragon : this.luckyDragon;
                this.growFund = doc.grow_fund ? doc.grow_fund : this.growFund;
                this.open_rank = doc.open_rank ? doc.open_rank : this.open_rank;
                this.buy_award = doc.buy_award ? doc.buy_award : this.buy_award;
                if (!this.growFund) {
                    this.growFund = gConfGrowFundBought[1].bought;
                    this.addUpdate('grow_fund', this.growFund);
                }

                function getOpenRankDate(name) {
                    return common.getDate(common.getTime(gConfGlobalServer.serverStartDate) + (gConfActivitiesRaw[name].openDay + gConfActivitiesRaw[name].duration) * 86400);
                }
                this.open_rank.ff = getOpenRankDate('open_rank_ff');
                var date = getGameDate();
                if (this.open_rank.ff > date) {
                    this.open_rank.final_ff_rank = null;
                    this.open_rank.final_ff_10_rank = null;
                    this.open_rank.final_ff_15_rank = null;
                    this.addUpdate('open_rank', this.open_rank);
                }
                if (getOpenRankOverDate("open_rank_recharge") > date) {
                    this.open_rank.final_recharge_rank = null;
                    this.addUpdate('open_rank', this.open_rank);
                }
                if (getOpenRankOverDate("open_rank_expense") > date) {
                    this.open_rank.final_expense_rank = null;
                    this.addUpdate('open_rank', this.open_rank);
                }


                this.open_rank.ff_10 = getOpenRankDate('open_rank_ff_10');
                this.open_rank.ff_15 = getOpenRankDate('open_rank_ff_15');
                this.open_rank.level = getOpenRankDate('open_rank_level');

                callback && callback(true);
            } else {
                callback && callback(false);
            }

            // this.resetByDay();               // 重启服务器会判断是否切换日期，发送活动奖励  用于重启时测试
        }.bind(this));
    },

    addUpdate: function (item, obj) {
        this.updates[item] = obj;
    },

    save: function (callback) {
        if (!this.updates || Object.keys(this.updates).length == 0) {
            callback && callback(true); return;
        }

        gDBWorld.update({ _id: 'activity' }, { $set: this.updates }, function (err, result) {
            if (err) {
                ERROR({ updates: this.updates, err: err });
                callback && callback(false);
            } else {
                callback && callback(true);
            }
            this.updates = {};
        }.bind(this));
    },

    resetByDay: function () {

        // ERROR("<<<<<<<<<<<<<<<<<<<<<<<< resetByDay");

        this.addGrowFundBought();
        var date = getGameDate();

        // ERROR("<<<<<<<<<<<<<<<<<<<<<<<< date = " + date);
        // ERROR(this.open_rank);

        if (date == this.open_rank.ff && !this.open_rank_ff) {
            this.addOpenRankMail('open_rank_ff');
        }
        if (date == this.open_rank.ff_10 && !this.open_rank_ff_10) {
            this.addOpenRankMail('open_rank_ff_10');
        }
        if (date == this.open_rank.ff_15 && !this.open_rank_ff_15) {
            this.addOpenRankMail('open_rank_ff_15');
        }
        if (date == this.open_rank.level && !this.open_rank_level) {
            this.addOpenRankMail('open_rank_level');
        }
        if (date == getOpenRankOverDate("open_rank_recharge") && !this.open_rank_recharge) {
            this.addOpenRankMail('open_rank_recharge');
        }
        if (date == getOpenRankOverDate("open_rank_expense") && !this.open_rank_expense) {
            this.addOpenRankMail('open_rank_expense');
        }

        // 如果排行榜活动结束了，记录最终榜的前51名
        if (date >= this.open_rank.ff && (!this.open_rank.final_ff_rank || this.open_rank.final_ff_rank.length <= 0)) {
            this.recordFinalFFRank();
        }

        if (date >= this.open_rank.ff_10 && (!this.open_rank.final_ff_10_rank || this.open_rank.final_ff_10_rank.length <= 0)) {
            this.recordFinalFF10Rank();
        }

        if (date >= this.open_rank.ff_15 && (!this.open_rank.final_ff_15_rank || this.open_rank.final_ff_15_rank.length <= 0)) {
            this.recordFinalFF15Rank();
        }

        if (date >= this.open_rank.level && (!this.open_rank.final_lv_rank || this.open_rank.final_lv_rank.length <= 0)) {
            this.recordFinalLvRank();
        }

        if (date >= getOpenRankOverDate("open_rank_recharge") && (!this.open_rank.final_recharge_rank || this.open_rank.final_recharge_rank.length <= 0)) {
            this.recordFinalRechargeRank();
        }

        if (date >= getOpenRankOverDate("open_rank_expense") && (!this.open_rank.final_expense_rank || this.open_rank.final_expense_rank.length <= 0)) {
            this.recordFinalExpenseRank();
        }

        var day = (new Date()).getDay()
        //DEBUG(`--------------------:day ${day}`)
        if (day == 1) {
            DEBUG("fuckyou,")
            gActivity.buy_award = {};
            gActivity.addUpdate('buy_award', gActivity.buy_award);
        }

        if (this.open_rank) {
            if (this.open_rank.recharge_rank != gConfActivities["open_rank_recharge"].endTime + gConfActivities["open_rank_recharge"].delayDays) {
                this.open_rank.recharge_rank = gConfActivities["open_rank_recharge"].endTime + gConfActivities["open_rank_recharge"].delayDays;
                this.open_rank.final_recharge_rank = null;
            }
            if (this.open_rank.expense_rank != gConfActivities["open_rank_expense"].endTime + gConfActivities["open_rank_expense"].delayDays) {
                this.open_rank.expense_rank = gConfActivities["open_rank_expense"].endTime + gConfActivities["open_rank_expense"].delayDays;
                this.open_rank.final_expense_rank = null;
            }
            this.addUpdate('open_rank', this.open_rank);
        }
    },

    resetByWeek: function () {
    },

    addGrowFundBought: function () {
        var today = common.getDate(common.getTime() - gConfGlobal.resetHour * 3600);
        var openDay = gConfGlobalServer.serverStartDate;
        var alreadyOpen = common.getDateDiff(openDay, today) + 1;
        if (!common.getDateDiff(openDay, today)) {
            return;
        }

        if (gConfGrowFundBought[alreadyOpen]) {
            this.growFund += gConfGrowFundBought[alreadyOpen].bought;
            this.addUpdate('grow_fund', this.growFund);
        }
    },

    addOpenRankMail: function (name) {

        DEBUG("添加排行榜邮件1:" + name);

        var ranks = {};
        var mailId = 0;
        if (name == 'open_rank_ff') {
            var rank = 0;
            mailId = 1007;
            gUserInfo.ranks.each(function (data) {
                ranks[data[0]] = ++rank;
            }.bind(this));
        } else if (name == 'open_rank_ff_10') {
            var rank = 0;
            mailId = 1008;
            gUserInfo.ranks.each(function (data) {
                ranks[data[0]] = ++rank;
            }.bind(this));
        } else if (name == 'open_rank_ff_15') {
            var rank = 0;
            mailId = 1009;
            gUserInfo.ranks.each(function (data) {
                ranks[data[0]] = ++rank;
            }.bind(this));
        } else if (name == 'open_rank_level') {
            var rank = 0;
            mailId = 1006;
            gUserInfo.lvRanks.each(function (data) {
                ranks[data[0]] = ++rank;
            }.bind(this));
        } else if (name == 'open_rank_recharge') {
            var rank = 0;
            mailId = 1014;

            var rank_conf_list = get_av_rank_recharge_config_list();
            var max_rank = rank_conf_list[rank_conf_list.length - 1].rank;

            var item_list = (gUserInfo.recharge_rank && gUserInfo.recharge_rank.item_list) ? gUserInfo.recharge_rank.item_list : [];
            var i = 0;
            var l = 0;
            var j = 0;
            for (j; j < item_list.length; j++) {
                var item = item_list[j];
                for (i; i < rank_conf_list.length; i++) {
                    var t_rank_conf = rank_conf_list[i];
                    var rank_end = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                    var limit_num = rank_conf_list[i].num;
                    if (!item || (item[1] < limit_num)) {
                        for (var k = l; k < rank_end; k++) {
                            l++;
                        }
                        continue;
                    }
                    l++
                    ranks[item[0]] = l > max_rank ? max_rank : l;
                    break;
                }
            }
        } else if (name == 'open_rank_expense') {
            var rank = 0;
            mailId = 1015;

            var rank_conf_list = get_av_rank_expense_config_list();
            var max_rank = rank_conf_list[rank_conf_list.length - 1].rank;

            var item_list = (gUserInfo.expense_rank && gUserInfo.expense_rank.item_list) ? gUserInfo.expense_rank.item_list : [];
            var i = 0;
            var l = 0;
            var j = 0;
            for (j; j < item_list.length; j++) {
                var item = item_list[j];
                for (i; i < rank_conf_list.length; i++) {
                    var t_rank_conf = rank_conf_list[i];
                    var rank_end = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                    var limit_num = rank_conf_list[i].num;
                    if (!item || (item[1] < limit_num)) {
                        for (var k = l; k < rank_end; k++) {
                            l++;
                        }
                        continue;
                    }
                    l++
                    ranks[item[0]] = l > max_rank ? max_rank : l;
                    break;
                }
            }
        }

        if (mailId > 0) {
            var time = common.getTime();
            var mail = {
                awards: name,
                time: time,
                expire: time + gConfMail[mailId].time * OneDayTime,
                attach: {
                    ranks: ranks,
                    huge: 1,
                },
            };

            DEBUG("添加排行榜邮件2:" + name);

            gSysMail.add(mail, true);
        }
    },

    recordFinalFFRank: function () {

        DEBUG("<<<<<<<<<<<<<<< recordFinalFFRank");

        var iter = gUserInfo.ranks.iterator();
        var rank_list = [];
        var item = null;
        while (rank_list.length <= 100 && (item = iter.next()) != null) {
            var uid = item[0];
            var finalRankInfo = {
                'uid': uid,
                'fight_force': item[1] || 0
            };
            rank_list.push(finalRankInfo);
        }
        this.open_rank.final_ff_rank = rank_list;
        this.addUpdate('open_rank', this.open_rank);
    },

    recordFinalFF10Rank: function () {

        DEBUG("<<<<<<<<<<<<<<< recordFinalFF10Rank");

        var iter = gUserInfo.ranks.iterator();
        var rank_list = [];
        var item = null;
        while (rank_list.length <= 100 && (item = iter.next()) != null) {
            var uid = item[0];
            var finalRankInfo = {
                'uid': uid,
                'fight_force': item[1] || 0
            };
            rank_list.push(finalRankInfo);
        }
        this.open_rank.final_ff_10_rank = rank_list;
        this.addUpdate('open_rank', this.open_rank);
    },

    recordFinalFF15Rank: function () {

        DEBUG("<<<<<<<<<<<<<<< recordFinalFF15Rank");

        var iter = gUserInfo.ranks.iterator();
        var rank_list = [];
        var item = null;
        while (rank_list.length <= 100 && (item = iter.next()) != null) {
            var uid = item[0];
            var finalRankInfo = {
                'uid': uid,
                'fight_force': item[1] || 0
            };
            rank_list.push(finalRankInfo);
        }
        this.open_rank.final_ff_15_rank = rank_list;
        this.addUpdate('open_rank', this.open_rank);
    },


    recordFinalLvRank: function () {
        var iter = gUserInfo.lvRanks.iterator();
        var rank_list = [];
        var item = null;
        while (rank_list.length <= 50 && (item = iter.next()) != null) {
            var uid = item[0];
            var user = gUserInfo.getUser(uid);
            var finalRankInfo = {
                'uid': uid,
                'level': user.status.level,
                'exp': user.status.xp
            };
            rank_list.push(finalRankInfo);
        }
        this.open_rank.final_lv_rank = rank_list;
        this.addUpdate('open_rank', this.open_rank);
    },

    recordFinalRechargeRank: function () {
        var t_item_list = gUserInfo.final_recharge_rank || [];
        var item_list = (gUserInfo.recharge_rank && gUserInfo.recharge_rank.item_list) ? gUserInfo.recharge_rank.item_list : [];
        var rank_conf_list = get_av_rank_recharge_config_list();
        var i = 0;
        var j = 0;
        for (j; j < item_list.length; j++) {
            var item = item_list[j];
            for (i; i < rank_conf_list.length; i++) {
                var max_rank = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                var limit_num = rank_conf_list[i].num;
                if (!item || (item[1] < limit_num)) {
                    for (var k = t_item_list.length; k < max_rank; k++) {
                        t_item_list.push(null);
                    }
                    continue;
                }
                var user = gUserInfo.getUser(item[0]);
                t_item_list.push({
                    'uid': item[0],
                    'recharge': item[1],//(user.activity.rank ? user.activity.rank.expense : 0) || 0,
                    'time': item[2],//(user.activity.rank ? user.activity.rank.time : 0) || 0,
                })
                break;
            }
        }
        this.open_rank.final_recharge_rank = t_item_list;
        this.addUpdate('open_rank', this.open_rank);
    },

    recordFinalExpenseRank: function () {
        var t_item_list = gUserInfo.final_expense_rank || [];
        var item_list = (gUserInfo.expense_rank && gUserInfo.expense_rank.item_list) ? gUserInfo.expense_rank.item_list : [];
        var rank_conf_list = get_av_rank_expense_config_list();
        var i = 0;
        var j = 0;
        for (j; j < item_list.length; j++) {
            var item = item_list[j];
            for (i; i < rank_conf_list.length; i++) {
                var max_rank = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                var limit_num = rank_conf_list[i].num;
                if (!item || (item[1] < limit_num)) {
                    for (var k = t_item_list.length; k < max_rank; k++) {
                        t_item_list.push(null);
                    }
                    continue;
                }
                var user = gUserInfo.getUser(item[0]);
                t_item_list.push({
                    'uid': item[0],
                    'expense': item[1],// (user.activity.rank ? user.activity.rank.expense : 0) || 0,
                    'time': item[2],// (user.activity.rank ? user.activity.rank.time : 0) || 0,
                });
                break;
            }
        }
        this.open_rank.final_expense_rank = t_item_list;
        this.addUpdate('open_rank', this.open_rank);
    },
};



exports.get_openseven = function (req, res, resp) {
    do {
        resp.data.left = gActivity.openSeven;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_openseven_reward = function (req, res, resp) {
    do {
        var id = req.args.id;
        if (!gConfOpenSevenReward[id]) {
            resp.code = 101; resp.desc = 'id error'; break;
        }

        var limit = gConfOpenSevenReward[id].target;
        var left = gActivity.openSeven[id];
        if (left && limit > 0 && left >= limit) {
            resp.code = 101; resp.desc = 'sell out'; break;
        }

        if (!left) {
            gActivity.openSeven[id] = 1;
        } else {
            gActivity.openSeven[id] += 1;
        }

        gActivity.addUpdate('open_seven', gActivity.openSeven);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_buy_award = function (req, res, resp) {
    do {
        resp.data.left = gActivity.buy_award;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.buy_award = function (req, res, resp) {
    do {
        var id = req.args.id;
        var curWeekDay = req.args.curWeekDay;
        if (!gConfBuyAward[curWeekDay] || !gConfBuyAward[curWeekDay][id]) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }
        var conf = gConfBuyAward[curWeekDay][id];
        var buy_award = gActivity.buy_award;
        if (buy_award[curWeekDay] && buy_award[curWeekDay][id] && buy_award[curWeekDay][id] >= conf.num) {
            resp.code = 101; resp.desc = 'buy over'; break;
        }

        if (!buy_award[curWeekDay]) {
            gActivity.buy_award[curWeekDay] = {};
            gActivity.addUpdate('buy_award', gActivity.buy_award);
        }

        if (gActivity.buy_award[curWeekDay][id]) {
            gActivity.buy_award[curWeekDay][id] += 1;
        } else {
            gActivity.buy_award[curWeekDay][id] = 1;
        }


        gActivity.addUpdate('buy_award', gActivity.buy_award);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_openholiday = function (req, res, resp) {
    do {
        resp.data.left = gActivity.openHoliday;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_openholiday_reward = function (req, res, resp) {
    do {
        var id = req.args.id;
        if (!gConfOpenHolidayReward[id]) {
            resp.code = 101; resp.desc = 'id error'; break;
        }

        var limit = gConfOpenHolidayReward[id].target;
        var left = gActivity.openHoliday[id];
        if (left && limit > 0 && left >= limit) {
            resp.code = 101; resp.desc = 'sell out'; break;
        }

        if (!left) {
            gActivity.openHoliday[id] = 1;
        } else {
            gActivity.openHoliday[id] += 1;
        }

        gActivity.addUpdate('open_holiday', gActivity.openHoliday);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_lucky_dragon = function (req, res, resp) {
    var history = [];
    for (var i = 0, len = gActivity.luckyDragon.length; i < len; i++) {
        var info = gActivity.luckyDragon[i];
        history.push({
            un: gUserInfo.getUser(info.uid).info.un,
            cash: info.cash,
        });
    }

    resp.data.history = history;
    onReqHandled(res, resp, 1);
};

exports.click_lucky_dragon = function (req, res, resp) {
    gActivity.luckyDragon.push({
        uid: req.uid,
        cash: req.args.add_cash,
    });

    while (gActivity.luckyDragon.length > 7) {
        gActivity.luckyDragon.shift();
    }
    gActivity.addUpdate('lucky_dragon', gActivity.luckyDragon);

    var history = [];
    for (var i = 0, len = gActivity.luckyDragon.length; i < len; i++) {
        var info = gActivity.luckyDragon[i];
        history.push({
            un: gUserInfo.getUser(info.uid).info.un,
            cash: info.cash,
        });
    }
    resp.data.history = history;

    onReqHandled(res, resp, 1);
};

exports.get_grow_fund = function (req, res, resp) {
    resp.data.count = gActivity.growFund;
    onReqHandled(res, resp, 1);
};

exports.get_grow_fund_award = function (req, res, resp) {
    resp.data.count = gActivity.growFund;
    onReqHandled(res, resp, 1);
};

exports.buy_grow_fund = function (req, res, resp) {
    gActivity.growFund += 1;
    gActivity.addUpdate('grow_fund', gActivity.growFund);
    onReqHandled(res, resp, 1);
};

exports.get_drops_dragon_award = function (req, res, resp) {
    resp.data.get_count = gActivity.dropsDragon;
    onReqHandled(res, resp, 1);
};

exports.get_drops_dragon_award_aux = function (req, res, resp) {
    onReqHandled(res, resp, 1);
};

// // -- 原来的排行榜活动（废弃）
// exports.get_open_rank = function(req, res, resp) {
//     resp.data.ff_rank = gUserInfo.ranks.rankById(req.uid);
//     resp.data.ff_top = gUserInfo.getFightForceTopUser(gActivity.open_rank.ff_top);
//
//     resp.data.arena_rank = gArena.users[req.uid] || 0;
//     resp.data.arena_top = gArena.getTopUser(gActivity.open_rank.arena_top);
//
//     resp.data.level_rank = gUserInfo.lvRanks.rankById(req.uid);
//     resp.data.level_top = gUserInfo.getLevelTopUser(gActivity.open_rank.level_top);
//
//     onReqHandled(res, resp, 1);
// };

exports.get_av_rank_level = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;
    var avRankConf = gConfAvRankLevel;

    var finalLvRank = gActivity.open_rank.final_lv_rank;

    if (!finalLvRank || finalLvRank.length <= 0) {
        var iter = gUserInfo.lvRanks.iterator();
        var ranksTooShort = false;
        var last_rank_end = 0;
        for (var i in avRankConf) {
            // 排行榜数据不够多
            if (ranksTooShort) break;

            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var offset = 0;
            if (rank_end > 0) {
                offset = rank_end - last_rank_end;
            } else {
                offset = rank_begin - last_rank_end;
            }

            var item = null;
            for (var j = 0; j < offset; j++) {
                var tempItem = iter.next()
                // 拍行榜人数不够按最后取到的来顶
                if (tempItem != null) {
                    item = tempItem;
                } else {
                    ranksTooShort = true;
                    break;
                }
            }

            if (!item) break;

            var uid = item[0];
            var user = gUserInfo.getUser(uid);

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
            last_rank_end = rank_end;
        }
        self_rank = gUserInfo.lvRanks.rankById(req.uid);
    } else {
        // 活动已经结束并且最终数据已经被记录,取最终记录的数据
        for (var i in avRankConf) {
            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var refRank = rank_end > 0 ? rank_end : rank_begin;
            var finalRankInfo = finalLvRank[refRank - 1];
            if (!finalRankInfo) {
                break;
            }

            var uid = finalRankInfo.uid;
            var user = gUserInfo.getUser(uid);
            var level = finalRankInfo.level;
            var exp = finalRankInfo.exp;

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': level,
                'max_force_hid': user.pos[1].rid,
                'vip': user.status.vip,
                'xp': exp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
        }

        for (var i = 0; i < finalLvRank.length; i++) {
            if (finalLvRank[i].uid == req.uid) {
                self_rank = i + 1;
                break;
            }
        }
    }

    resp.data.rank = self_rank != 0 ? self_rank : 51;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};

exports.get_av_rank_fight_force = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;

    var avRankConf = gConfAvRankFightForce;
    var finalFFRank = gActivity.open_rank.final_ff_rank;
    if (!finalFFRank || finalFFRank.length <= 0) {

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force 11111");

        // 活动还在进行中，取最新的排行榜数据
        var iter = gUserInfo.ranks.iterator();

        var ranksTooShort = false;
        var last_rank_end = 0;
        for (var i in avRankConf) {
            // 排行榜数据不够多
            if (ranksTooShort) break;

            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var offset = 0;
            if (rank_end > 0) {
                offset = rank_end - last_rank_end;
            } else {
                offset = rank_begin - last_rank_end;
            }

            var item = null;
            for (var j = 0; j < offset; j++) {
                var tempItem = iter.next()
                // 拍行榜人数不够按最后取到的来顶
                if (tempItem != null) {
                    item = tempItem;
                } else {
                    ranksTooShort = true;
                    break;
                }
            }

            if (!item) break;

            var uid = item[0];
            var user = gUserInfo.getUser(uid);

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': item[1] || 0,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
            last_rank_end = rank_end;
        }

        self_rank = gUserInfo.ranks.rankById(req.uid);
    } else {
        // 活动已经结束并且最终数据已经被记录,取最终记录的数据

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force 22222");

        for (var i in avRankConf) {
            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var refRank = rank_end > 0 ? rank_end : rank_begin;
            var finalRankInfo = finalFFRank[refRank - 1];
            if (!finalRankInfo) {
                break;
            }

            var uid = finalRankInfo.uid;
            var user = gUserInfo.getUser(uid);
            var fightForce = finalRankInfo.fight_force;

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': fightForce,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
        }

        for (var i = 0; i < finalFFRank.length; i++) {
            if (finalFFRank[i].uid == req.uid) {
                self_rank = i + 1;
                break;
            }
        }
    }

    resp.data.rank = self_rank != 0 ? self_rank : 101;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};

exports.get_av_rank_fight_force_10 = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;

    var avRankConf = gConfAvRankFightForce10;
    var finalFFRank = gActivity.open_rank.final_ff_10_rank;
    if (!finalFFRank || finalFFRank.length <= 0) {

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force_10 11111");

        // 活动还在进行中，取最新的排行榜数据
        var iter = gUserInfo.ranks.iterator();

        var ranksTooShort = false;
        var last_rank_end = 0;
        for (var i in avRankConf) {
            // 排行榜数据不够多
            if (ranksTooShort) break;

            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var offset = 0;
            if (rank_end > 0) {
                offset = rank_end - last_rank_end;
            } else {
                offset = rank_begin - last_rank_end;
            }

            var item = null;
            for (var j = 0; j < offset; j++) {
                var tempItem = iter.next()
                // 拍行榜人数不够按最后取到的来顶
                if (tempItem != null) {
                    item = tempItem;
                } else {
                    ranksTooShort = true;
                    break;
                }
            }

            if (!item) break;

            var uid = item[0];
            var user = gUserInfo.getUser(uid);

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': item[1] || 0,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
            last_rank_end = rank_end;
        }

        self_rank = gUserInfo.ranks.rankById(req.uid);
    } else {
        // 活动已经结束并且最终数据已经被记录,取最终记录的数据

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force_10 222222");

        for (var i in avRankConf) {
            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var refRank = rank_end > 0 ? rank_end : rank_begin;
            var finalRankInfo = finalFFRank[refRank - 1];
            if (!finalRankInfo) {
                break;
            }

            var uid = finalRankInfo.uid;
            var user = gUserInfo.getUser(uid);
            var fightForce = finalRankInfo.fight_force;

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': fightForce,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
        }

        for (var i = 0; i < finalFFRank.length; i++) {
            if (finalFFRank[i].uid == req.uid) {
                self_rank = i + 1;
                break;
            }
        }
    }

    resp.data.rank = self_rank != 0 ? self_rank : 101;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};

exports.get_av_rank_fight_force_15 = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;

    var avRankConf = gConfAvRankFightForce15;
    var finalFFRank = gActivity.open_rank.final_ff_15_rank;
    if (!finalFFRank || finalFFRank.length <= 0) {

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force_15 11111");

        // 活动还在进行中，取最新的排行榜数据
        var iter = gUserInfo.ranks.iterator();

        var ranksTooShort = false;
        var last_rank_end = 0;
        for (var i in avRankConf) {
            // 排行榜数据不够多
            if (ranksTooShort) break;

            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var offset = 0;
            if (rank_end > 0) {
                offset = rank_end - last_rank_end;
            } else {
                offset = rank_begin - last_rank_end;
            }

            var item = null;
            for (var j = 0; j < offset; j++) {
                var tempItem = iter.next()
                // 拍行榜人数不够按最后取到的来顶
                if (tempItem != null) {
                    item = tempItem;
                } else {
                    ranksTooShort = true;
                    break;
                }
            }

            if (!item) break;

            var uid = item[0];
            var user = gUserInfo.getUser(uid);

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': item[1] || 0,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
            last_rank_end = rank_end;
        }

        self_rank = gUserInfo.ranks.rankById(req.uid);
    } else {
        // 活动已经结束并且最终数据已经被记录,取最终记录的数据

        DEBUG("<<<<<<<<<<<<<<<<<<<<<<<< get_av_rank_fight_force_15 22222");

        for (var i in avRankConf) {
            var sortId = Number(i);
            var rank_begin = avRankConf[sortId].rank;
            var rank_end = -1;
            if (avRankConf[sortId + 1]) {
                rank_end = avRankConf[sortId + 1].rank - 1;
            }

            var refRank = rank_end > 0 ? rank_end : rank_begin;
            var finalRankInfo = finalFFRank[refRank - 1];
            if (!finalRankInfo) {
                break;
            }

            var uid = finalRankInfo.uid;
            var user = gUserInfo.getUser(uid);
            var fightForce = finalRankInfo.fight_force;

            var refUser = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'max_force_hid': user.pos[1].rid,
                'fight_force': fightForce,
                'vip': user.status.vip,
                'xp': user.status.xp,
                'custom_king': user.custom_king
            };

            if (rank_list.length == 0) {
                refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                refUser.wing_illusion = user.sky_suit.wing_illusion;
                refUser.mount_illusion = user.sky_suit.mount_illusion;
            }

            rank_list.push(refUser);
        }

        for (var i = 0; i < finalFFRank.length; i++) {
            if (finalFFRank[i].uid == req.uid) {
                self_rank = i + 1;
                break;
            }
        }
    }

    resp.data.rank = self_rank != 0 ? self_rank : 101;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};


function get_av_rank_recharge_config_list() {
    var avRankConf = gConfAvRankRecharge;
    var rank_conf_list = [];
    for (var tKey in avRankConf) {
        rank_conf_list.push(avRankConf[tKey]);
    }
    rank_conf_list = rank_conf_list.sort(function (a, b) { return a.rank - b.rank });
    return rank_conf_list;
}
exports.get_av_rank_recharge_ranks = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;
    var finalRank = gActivity.open_rank.final_recharge_rank;

    var rank_conf_list = get_av_rank_recharge_config_list()
    rank_list.length = rank_conf_list.length;

    if (!finalRank || finalRank.length <= 0) {                          // 活动还在进行中，取最新的排行榜数据
        if (req.args.rank_recharge) {
            gUserInfo.updatePlayerRank("activity.rank.recharge", req.uid, req.args.rank_recharge);
        }

        var item_list = (gUserInfo.recharge_rank && gUserInfo.recharge_rank.item_list) ? gUserInfo.recharge_rank.item_list : [];
        var item = null;
        var j = 0;
        var i = 0;
        var temp_rank_for_uid = [];
        var tDict = {};
        for (j; j < item_list.length; j++) {
            item = item_list[j];
            for (i; i < rank_conf_list.length; i++) {
                var max_rank = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                var limit_num = rank_conf_list[i].num;
                if (!item || (item[1] < limit_num)) {
                    for (var k = temp_rank_for_uid.length; k < max_rank; k++) {
                        temp_rank_for_uid.push(null);
                    }
                    continue;
                }
                temp_rank_for_uid.push(item[0]);
                tDict[item[0]] = item[1];
                if (req.uid == item[0]) {
                    self_rank = (temp_rank_for_uid.length);
                }
                break;
            }
        }
        for (var i = 0; i < rank_conf_list.length; i++) {
            var uid = null;
            var tMinRank = (rank_conf_list[i]) ? (rank_conf_list[i].rank - 1) : 0;
            var tMaxRank = (rank_conf_list[i + 1]) ? (rank_conf_list[i + 1].rank - 1) : temp_rank_for_uid.length;
            for (var j = (tMaxRank - 1); j >= tMinRank; j--) {
                uid = temp_rank_for_uid[j];
                if (!uid) { continue; }
                break;
            }
            if (!uid) {
                rank_list[i] = null;
            }
            else {
                var user = gUserInfo.getUser(uid);

                var refUser = {
                    'uid': uid,
                    'un': user.info.un,
                    'headpic': user.info.headpic,
                    'headframe': gUserInfo.getRankHeadFrame(uid),
                    'level': user.status.level,
                    'max_force_hid': user.pos[1].rid,
                    'recharge': tDict[uid] || 0,
                    'vip': user.status.vip,
                    'xp': user.status.xp,
                    'custom_king': user.custom_king
                };

                if (rank_list.length == 0) {
                    refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                    refUser.wing_illusion = user.sky_suit.wing_illusion;
                    refUser.mount_illusion = user.sky_suit.mount_illusion;
                }

                rank_list[i] = refUser;
            }
        }
    } else {            // 活动已经结束并且最终数据已经被记录,取最终记录的数据
        for (var i = 0; i < finalRank.length; i++) {
            var finalRankInfo = finalRank[i];
            if (!finalRankInfo) {
                rank_list[i] = null;
            }
            else {
                var uid = finalRankInfo.uid;
                var user = gUserInfo.getUser(uid);
                if (!user) {
                    rank_list[i] = null;
                }
                else {
                    var fightForce = finalRankInfo.recharge;

                    var refUser = {
                        'uid': uid,
                        'un': user.info.un,
                        'headpic': user.info.headpic,
                        'headframe': gUserInfo.getRankHeadFrame(uid),
                        'level': user.status.level,
                        'max_force_hid': user.pos[1].rid,
                        'recharge': fightForce,
                        'vip': user.status.vip,
                        'xp': user.status.xp,
                        'custom_king': user.custom_king
                    };

                    if (rank_list.length == 0) {
                        refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                        refUser.wing_illusion = user.sky_suit.wing_illusion;
                        refUser.mount_illusion = user.sky_suit.mount_illusion;
                    }

                    rank_list[i] = refUser;
                }
            }
        }

        self_rank = 0;
        if (gUserInfo.recharge_rank.item_dict[req.uid] && (gUserInfo.recharge_rank.item_dict[req.uid][1] >= rank_conf_list[rank_conf_list.length - 1].num)) {
            self_rank = rank_conf_list[rank_conf_list.length - 1].rank;
        }
        for (var i = 0; i < finalRank.length; i++) {
            var tFinalInfo = finalRank[i];
            if (!tFinalInfo) { continue; }
            if (tFinalInfo.uid != req.uid) { continue; }
            self_rank = i + 1;
            break;
        }
    }

    resp.data.rank = self_rank;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};

function get_av_rank_expense_config_list() {
    var avRankConf = gConfAvRankExpense;
    var rank_conf_list = [];
    for (var tKey in avRankConf) {
        rank_conf_list.push(avRankConf[tKey]);
    }
    rank_conf_list = rank_conf_list.sort(function (a, b) { return a.rank - b.rank });
    return rank_conf_list;
}

exports.get_av_rank_expense_ranks = function (req, res, resp) {
    var rank_list = [];
    var self_rank = 0;

    var finalRank = gActivity.open_rank.final_expense_rank;

    var rank_conf_list = get_av_rank_expense_config_list();
    rank_list.length = rank_conf_list.length;

    if (!finalRank || finalRank.length <= 0) {          // 活动还在进行中，取最新的排行榜数据
        if (req.args.rank_expense) {
            gUserInfo.updatePlayerRank("activity.rank.expense", req.uid, req.args.rank_expense);
        }

        var item_list = (gUserInfo.expense_rank && gUserInfo.expense_rank.item_list) ? gUserInfo.expense_rank.item_list : [];
        var item = null;
        var j = 0;
        var i = 0;
        var temp_rank_for_uid = [];
        var tDict = {};
        for (j; j < item_list.length; j++) {
            item = item_list[j];
            for (i; i < rank_conf_list.length; i++) {
                var max_rank = rank_conf_list[i + 1] ? rank_conf_list[i + 1].rank - 1 : rank_conf_list[rank_conf_list.length - 1].rank - 1;
                var limit_num = rank_conf_list[i].num;
                if (!item || (item[1] < limit_num)) {
                    for (var k = temp_rank_for_uid.length; k < max_rank; k++) {
                        temp_rank_for_uid.push(null);
                    }
                    continue;
                }
                temp_rank_for_uid.push(item[0]);
                tDict[item[0]] = item[1];
                if (req.uid == item[0]) {
                    self_rank = (temp_rank_for_uid.length);
                }
                break;
            }
        }
        for (var i = 0; i < rank_conf_list.length; i++) {
            var uid = null;
            var tMinRank = (rank_conf_list[i]) ? (rank_conf_list[i].rank - 1) : 0;
            var tMaxRank = (rank_conf_list[i + 1]) ? (rank_conf_list[i + 1].rank - 1) : temp_rank_for_uid.length;
            for (var j = (tMaxRank - 1); j >= tMinRank; j--) {
                uid = temp_rank_for_uid[j];
                if (!uid) { continue; }
                break;
            }
            if (!uid) {
                rank_list[i] = null;
            }
            else {
                var user = gUserInfo.getUser(uid);

                var refUser = {
                    'uid': uid,
                    'un': user.info.un,
                    'headpic': user.info.headpic,
                    'headframe': gUserInfo.getRankHeadFrame(uid),
                    'level': user.status.level,
                    'max_force_hid': user.pos[1].rid,
                    'expense': tDict[uid] || 0,
                    'vip': user.status.vip,
                    'xp': user.status.xp,
                    'custom_king': user.custom_king
                };

                if (rank_list.length == 0) {
                    refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                    refUser.wing_illusion = user.sky_suit.wing_illusion;
                    refUser.mount_illusion = user.sky_suit.mount_illusion;
                }

                rank_list[i] = refUser;
            }
        }
    } else {        // 活动已经结束并且最终数据已经被记录,取最终记录的数据
        self_rank = rank_conf_list[rank_conf_list.length - 1].rank;
        for (var i = 0; i < finalRank.length; i++) {
            var finalRankInfo = finalRank[i];
            if (!finalRankInfo) {
                rank_list[i] = null;
            }
            else {
                var uid = finalRankInfo.uid;
                var user = gUserInfo.getUser(uid);
                if (!user) {
                    rank_list[i] = null;
                }
                else {
                    var fightForce = finalRankInfo.expense;

                    var refUser = {
                        'uid': uid,
                        'un': user.info.un,
                        'headpic': user.info.headpic,
                        'headframe': gUserInfo.getRankHeadFrame(uid),
                        'level': user.status.level,
                        'max_force_hid': user.pos[1].rid,
                        'expense': fightForce,
                        'vip': user.status.vip,
                        'xp': user.status.xp,
                        'custom_king': user.custom_king
                    };

                    if (rank_list.length == 0) {
                        refUser.weapon_illusion = user.sky_suit.weapon_illusion;
                        refUser.wing_illusion = user.sky_suit.wing_illusion;
                        refUser.mount_illusion = user.sky_suit.mount_illusion;
                    }

                    rank_list[i] = refUser;
                }
            }
        }

        var self_rank = 0;
        if (gUserInfo.expense_rank.item_dict[req.uid] && gUserInfo.expense_rank.item_dict[req.uid][1] >= rank_conf_list[rank_conf_list.length - 1].num) {
            self_rank = rank_conf_list[rank_conf_list.length - 1].rank;
        }
        for (var i = 0; i < finalRank.length; i++) {
            var tFinalInfo = finalRank[i];
            if (!tFinalInfo) { continue; }
            if (tFinalInfo.uid != req.uid) { continue; }
            self_rank = i + 1;
            break;
        }
    }

    resp.data.rank = self_rank;
    resp.data.rank_list = rank_list;

    onReqHandled(res, resp, 1);
};

exports.reset_open_rank = function (req, res, resp) {
    gActivity.open_rank.final_ff_rank = null;
    gActivity.open_rank.final_ff_10_rank = null;
    gActivity.open_rank.final_ff_15_rank = null;
    gActivity.open_rank.final_lv_rank = null;
    gActivity.open_rank.final_recharge_rank = null;
    gActivity.open_rank.final_expense_rank = null;
    gActivity.addUpdate('open_rank', gActivity.open_rank);
    onReqHandled(res, resp, 1);
};

exports.Activity = Activity;
