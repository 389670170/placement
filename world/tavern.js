function Tavern() {
    // 热点招募相关
    this.nextUpdate = 0;                    // 下次更新时间
    this.day = 0;                           // 当前刷新日期
    this.limitHot = 0;                      // 当前热点武将
    this.dayHots = [0, 0, 0];               // 今日热点id

    // 名人招募相关
    this.luckList = [
        /*
        {
            uid: 0,                         // 玩家id
            card: 0,                        // 抽到橙卡次数
            time: 0,                        // 十连抽次数
        }
        */
    ];
}

Tavern.create = function(callback) {
    var tavern = {
        '_id': 'tavern',
        'next_update': 0,
        'day': 0,
        'limit_hot': 0,
        'day_hots': [0, 0, 0],
        'luck_list': [],
    };

    gDBWorld.insert(tavern, function(err, result) {
        callback && callback();
    });
};

Tavern.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'tavern'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.nextUpdate = doc.next_update,
                this.day = doc.day;
                this.limitHot = doc.limit_hot;
                this.dayHots = doc.day_hots;
                this.luckList = doc.luck_list ? doc.luck_list : this.luckList;

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function(callback) {
        var tavern = {
            _id: 'tavern',
            next_update: this.nextUpdate,
            day: this.day,
            limit_hot: this.limitHot,
            day_hots: this.dayHots,
            luck_list: this.luckList,
        };

        gDBWorld.save(tavern, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    checkUpdate: function() {
        var updated = false;
        var today = getGameDate();
        if (this.day != today) {
            this.day = today;

            var weights = {};
            this.dayHots = [0, 0, 0];
            for (var id in gConfTavernHot) {
                if (gConfTavernHot[id].type != 2) {
                    continue;
                }

                weights[id] = gConfTavernHot[id].hotWeight;
            }

            for (var i = 0; i < gConfGlobal.tavernDayHotCount; i++) {
                var id = +common.wRand(weights);
                this.dayHots[i] = id;
                delete weights[id];
            }

            updated = true;
        }

        var now = common.getTime();
        if (now >= this.nextUpdate) {
            var timeOfToday = common.getTime(getGameDate());
            this.nextUpdate = timeOfToday + gConfGlobalNew.resetHour*3600 + gConfGlobalNew.tavernLimitHotDay*86400;

            var maxRound = 20;
            while (maxRound--) {
                this.limitHot++;

                if (gConfTavernHot[this.limitHot].type != 1) {
                    this.limitHot = 1;
                }

                if (gConfTavernHot[this.limitHot].hotRound == 1) {
                    break;
                }
            }

            updated = true;
        }

        if (updated) {
            this.save();
        }
    },

    getLuckInfo: function(uid) {
        // 查找uid对应的luck信息，供自我更新使用
        for (var i = 0, len = this.luckList.length; i < len; i++) {
            if (this.luckList[i].uid == uid) {
                return this.luckList[i];
            }
        }

        return null;
    },

    updateLuckList: function(newAddUid) {
        var forceUpdate = false;
        var oldTop = 0;
        if (this.luckList[0])
            oldTop = this.luckList[0].uid;

        if (newAddUid != 0 && oldTop == newAddUid) {
            forceUpdate = true;
        }

        this.luckList.sort(function(c1, c2) {
            // 不同人按照 card * value / time 排序
            var luck1 = c1.card * gConfGlobal.tavernLuckScore / c1.time;
            var luck2 = c2.card * gConfGlobal.tavernLuckScore / c2.time;
            if (luck1 > luck2) return -1;
            if (luck1 < luck2) return 1;
            return c1.uid < c2.uid ? -1 : 1;
        });

        while (this.luckList.length > 200) {
            this.luckList.pop();
        }

        var newTop = 0;
        if (this.luckList[0])
            newTop = this.luckList[0].uid;

        // 人品帝改变
        if (newTop != oldTop || forceUpdate) {
            var uids = [newTop];
            if (newTop != oldTop)
                uids.push(oldTop);

            pushToGroupUser(uids, 'self', {
                'mod' : 'user',
                'act' : 'lucky_top_change',
                'top' : newTop,
            });
        }
    },

    getHonorTopUid: function() {
        var top = this.luckList[0];
        if (top) {
            return top.uid;
        } else {
            return 0;
        }
    },

    getHonorTopUser: function() {
        var uid = this.getHonorTopUid();
        if (uid) {
            return gUserInfo.getHonorUser(uid);
        } else {
            return null;
        }
    },
};

exports.get = function(req, res, resp) {
    var count = 0;
    for (var i = gConfGlobal.tavernLuckVIP; i < gUserInfo.vipCount.length; i++) {
        count += gUserInfo.vipCount[i];
    }
    resp.data.luck = count > 0 ? 1 : 0;
    onReqHandled(res, resp, 1);
};

exports.get_luck_list = function(req, res, resp) {
    var luck_list = [];

    var rank = 0;
    var luck = 0;
    for (var i = 0, len = gTavern.luckList.length; i < len; i++) {
        var luckInfo = gTavern.luckList[i];
        var userInfo = gUserInfo.getUser(luckInfo.uid);

        if (luck_list.length < 50) {
            var heroConf = gConfHero[userInfo.pos[1].hid];
            if (!heroConf) {
                ERROR(util.format('missing %d from %d', userInfo.pos[1].hid, luckInfo.uid));
            }

            var heroCombatConf = getHeroCombatConf(userInfo.pos[1].hid);
            luck_list.push({
                uid: luckInfo.uid,
                un: userInfo.info.un,
                headpic: userInfo.info.headpic,
                headframe : gUserInfo.getRankHeadFrame(luckInfo.uid),
                quality: heroCombatConf ? heroCombatConf.quality : 3,
                vip: userInfo.status.vip,
                level: userInfo.status.level,
                luck: Math.floor(luckInfo.card*gConfGlobal.tavernLuckScore/luckInfo.time),
            });
        }

        if (luckInfo.uid == req.uid) {
            rank = i + 1;
            luck = Math.floor(luckInfo.card*gConfGlobal.tavernLuckScore/luckInfo.time);
        }
    }

    resp.data.luck = luck;
    resp.data.rank = rank;
    resp.data.luck_list = luck_list;

    onReqHandled(res, resp, 1);
};

exports.ten_tavern = function(req, res, resp) {
    var uid = req.args.uid;
    var luckInfo = gTavern.getLuckInfo(uid);
    var newAddUid = 0;
    if (!luckInfo) {
        gTavern.luckList.push({
            uid: req.uid,
            card: req.args.count,
            time: 1,
        });
        newAddUid = uid;
    } else {
        luckInfo.card += req.args.count;
        luckInfo.time++;
    }

    gTavern.updateLuckList(newAddUid);

    onReqHandled(res, resp, 1);
};

exports.Tavern = Tavern;
