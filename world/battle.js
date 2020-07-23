function Battle() {
    this.city = {
    /*
        city_id: {
            owner: 0,                   // 太守的UID, 0代表没有太守
            double: 0,                  // 今日双倍活动标识
            time: 0,                    // 占领时的时间
            lock : 0,                   // 城池被打的时间
            last_uid : 0,               // 最近一次打过此城池的uid，用于判断是否战斗超时
            visit: 0,                   // 城池被访问时最近生成奖励的时间
            awards : [],                // 太守已经获得的奖励
        }
    */
    };
    this.lastLord = [0, 0, 0];         // 昨日太守结算数量

    this.selfLord = {
    /*
        uid: {
            owner: 0,                   // 太守的UID, 0代表没有太守
            double: 0,                  // 今日双倍活动标识
            time: 0,                    // 占领时的时间
            lock : 0,                   // 城池被打的时间
            last_uid : 0,               // 最近一次打过此城池的uid，用于判断是否战斗超时
            visit: 0,                   // 城池被访问时最近生成奖励的时间
            awards : [],                // 太守已经获得的奖励
        },
    */
    };

    this.balance = 0;                   // 上次结算时间

    // 内存数据
    this.updates = {};                  // 待更新数据
    this.deletes = {};                  // 待删除的单人太守
    this.userCity = {
        // uid: cid                     // 玩家id: 城池id
    };

    this.lord_count = [0, 0, 0];        // 记录三个国家的太守数
}

Battle.create = function(callback) {
    var battleData = {
        '_id': 'battle',
        'city': {},
        'last_lord': [0, 0, 0],
        'self_lord': {},
        'balance': 0,
    };

    var city = battleData.city;
    for (var id in gConfCity) {
        city[id] = {
            'owner': 0,
            'time': 0,
            'lock' : 0,
            'last_uid' : 0,
            'visit' : 0,
            'awards' : [],
        };
    }

    gDBWorld.insert(battleData, function(err, result) {
        callback && callback();
    });

}

Battle.prototype = {
    init: function(callback) {
        // 读取地图信息
        gDBWorld.find({_id: 'battle'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.city = doc.city;
                this.lastLord = doc.last_lord || this.lastLord;
                if (!doc.self_lord) {
                    gDBWorld.update({_id :'battle'}, {$set:{'self_lord':{}}}, function(err, result){
                        if (err) {
                            ERROR(util.format('SAVE SELF_LORD: %j',  err));
                            callback && callback(false);
                        } else {
                            this.selfLord = {};
                            this.balance = doc.balance || 0;
                            callback && callback(true);
                        }
                    });
                } else {
                    this.selfLord = doc.self_lord;
                    this.balance = doc.balance || 0;
                    callback && callback(true);
                }
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    onWorldLoaded: function() {
        for (var id in this.city) {
            var country = gUserInfo.getUser(this.city[id].owner).info.country;
            if (country) {
                this.lord_count[country - 1]++;
            }
        }

        for (var id in this.city) {
            this.updateOwner(id);
            var owner = this.city[id].owner;
            if (owner) {
                this.userCity[owner] = +id;
            }
        }

        for (var uid in this.selfLord) {
            var country = gUserInfo.getUser(this.selfLord[uid].owner).info.country;
            if (country) {
                this.lord_count[country - 1]++;
            }
        }

        for (var uid in this.selfLord) {
            this.updateOwner(0, uid);
            if (this.selfLord[uid]) {
                this.userCity[uid] = 0;
            }
        }
    },

    initSelfLord: function(uid) {
        this.selfLord[uid] = {
            'owner': 0,
            'time': 0,
            'lock' : 0,
            'last_uid' : 0,
            'visit' : 0,
            'awards' : [],
        };

        return this.selfLord[uid];
    },

    getOutput: function(id, level, uid) {
        var now = common.getTime();
        var interval = gConfGlobal.lordProductTime * 60;
        if (id == 0) {
            var city = this.selfLord[uid];
        } else {
            var city = this.city[id];
        }

        if (now - city.time > gConfGlobal.lordMaxHour*3600) {
            now = city.time + gConfGlobal.lordMaxHour*3600;
        }

        if (now - city.visit < interval) {
            return city.awards;
        }

        var dropId = city.drop || gConfCity[id].lord;
        var dropCount = Math.floor((now - city.visit) / interval);
        city.visit += dropCount*interval;

        for (var i = 0; i < dropCount; i++) {
            var roundAwards = generateDrop(dropId, level);
            for (var j = 0, len = roundAwards.length; j < len; j++) {
                city.awards.push(roundAwards[j]);
            }
        }

        city.awards = reformAwards(city.awards);
        this.markDirty(id, uid);

        return city.awards;
    },

    markDirty : function(cid, uid) {
        if (cid == 0) {
            delete this.deletes['self_lord.' + uid];
            this.updates['self_lord.' + uid] = this.selfLord[uid];
        }

        this.updates['city.' + cid] = this.city[cid];
    },

    markDelete : function(uid) {
        this.deletes['self_lord.' + uid] = 1;
        delete this.updates['self_lord.' + uid];
    },

    save : function(callback) {
        var updates = this.updates;
        this.updates = {};
        var deletes = this.deletes;
        this.deletes = {};

        var modifiers = {};
        if (!Object.isEmpty(updates)) {
            modifiers['$set'] = updates;
        }
        if (!Object.isEmpty(deletes)) {
            modifiers['$unset'] = deletes;
        }

        if (Object.isEmpty(modifiers)) {
            callback && callback(true);
            return;
        }

        gDBWorld.update({_id :'battle'}, modifiers, function(err, result){
            if (err) {
                ERROR(util.format('SAVE INVITE: %j %j %j', modifiers, err));
                callback && callback(false);
            } else {
                LOG(util.format('SAVE INVITE: %j', modifiers));
                callback && callback(true);
            }
        });
    },

    updateOwner : function(id, uid) {
        var city = null;
        if (id == 0) {
            city = this.selfLord[uid];
        } else {
            city = this.city[id];
        }

        if (!city || !city.owner) {
            return;
        }

        var time = city.time;
        var now = common.getTime();
        // 到时间发奖励
        if (now - time > gConfGlobal.lordMaxHour*3600) {
            var user = gUserInfo.getUser(city.owner);
            var awards = this.getOutput(id, user.status.level, uid);
            if (city.double) {
                awards = timeAwards(awards, 2, true);
            }

            var mail = {
                from : 3,
                title : 9,
                content : [11],
                awards : awards,
                time : now,
                expire : now+gConfGlobal.awardMailExpireDay*3600*24,
            };

            gMail.add(city.owner, mail);

            delete this.userCity[city.owner];

            if (id) {
                city.owner = 0;
                city.time = 0;
                city.visit = 0;
                city.awards = [];
                this.markDirty(id, uid);
            } else {
                delete this.selfLord[uid];
                this.markDelete(uid);
            }

            if (user.info.country && id) {
                this.lord_count[user.info.country - 1]--;
            }
        }

        if (city.lock && now - city.lock >= gConfGlobal.lordFightMaxTime*60) {
            city.lock = 0;
            this.markDirty(id, uid);
        }
    },

    checkLord : function(cid, uid) {
        var city = null;
        if (cid == 0) {
            city = this.selfLord[uid];
        } else {
            city = this.city[cid];
        }

        if (!city) {
            return 0;
        }

        var now = common.getTime();
        if (city.lock) {
            if (now - city.lock <= gConfGlobal.lordFightMaxTime*60) {
                return 101;
            }

            city.lock = 0;
            this.markDirty(cid, uid);
        }

        for (var listUid in this.userCity) {
            if (listUid == uid) {
                return 1;
            }
        }

        return 0;
    },

    getBalanceTime: function() {
        var dateStr = common.getDateString();
        var hour = Math.floor(gConfGlobal.lordCountryBalanceTime);
        var mins = Math.floor((gConfGlobal.lordCountryBalanceTime%1)*60);

        return Date.parse(dateStr + " " + hour + ":"+mins +":00")/1000;
    },

    getCityTime:function(uid) {

        if(!this.userCity.hasOwnProperty(uid))
            return 0;
        var cid= this.userCity[uid];

        if(cid == 0)
            return this.selfLord[uid].time;
        if(this.city[cid])
            return this.city[cid].time;

        return 0;
    },
};

exports.get = function(req, res, resp) {
    var cid = gBattle.userCity[req.uid];
    gBattle.updateOwner(cid, req.uid);
    resp.data.self = cid;
    resp.data.tips = gTips.getTips(req.uid);
    onReqHandled(res, resp, 1);
};

exports.get_lord_count = function(req, res, resp) {
    resp.data.lord_count = gBattle.lord_count;
   onReqHandled(res, resp, 1);
};

exports.get_lord_list = function(req, res, resp) {
    var city = gBattle.city;
    var cityInfos = {};
    for (var id in city) {
        gBattle.updateOwner(id);
        var city = gBattle.city[id];
        if (city.owner) {
            var user = gUserInfo.getUser(city.owner);
            cityInfos[id] = {
                'name': user.info.un,
                'country': user.info.country,
                'fight_force': user.fight_force,
                'time': city.time,
            };

            if (city.owner == req.uid) {
                resp.data.self = +id;
            }
        }
    }

    if (gBattle.selfLord[req.uid]) {
        var city = gBattle.selfLord[req.uid];
        var user = gUserInfo.getUser(city.owner);
        gBattle.updateOwner(0, req.uid);
        cityInfos[0] = {
            'name': user.info.un,
            'country': user.info.country,
            'fight_force': user.fight_force,
            'time': city.time,
        };

        if (city.owner == req.uid) {
            resp.data.self = 0;
        }
    }

    resp.data.lord = cityInfos;
    gBattle.save();
    onReqHandled(res, resp, 1);
};

exports.lord_get = function(req, res, resp) {
    do {
        var cid = Math.floor(+req.args.id);
        gBattle.updateOwner(cid, req.uid);
        resp.data.self = gBattle.userCity[req.uid];

        var city = null;
        if (cid == 0) {
            city = gBattle.selfLord[req.uid];
        } else {
            city = gBattle.city[cid];
        }

        if (!city || !city.owner) {
            resp.data.owner = {}; break;
        }

        var owner = gUserInfo.getUser(city.owner);
        resp.data.owner = {
            'name' : owner.info.un,
            'level' : owner.status.level,
            'hid' : owner.info.model,
            'fight_force' : owner.fight_force,
            'time' : city.time,
            'got' : gBattle.getOutput(cid, null, req.uid),
            'promote' : owner.info.promote,
            'weapon_illusion': owner.sky_suit.weapon_illusion,
            'wing_illusion': owner.sky_suit.wing_illusion,
        };
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.before_fight = function(req, res, resp) {
    do {
        var cid = Math.floor(+req.args.id);
        var checked = 0;
        if (checked = gBattle.checkLord(cid, req.uid)) {
            resp.code = checked; resp.desc = 'locked or occupied'; break;
        }

        gBattle.city[cid].lock = common.getTime();
        gBattle.city[cid].last_uid = req.uid;
        gBattle.markDirty(cid, req.uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.occupy = function(req, res, resp) {
    do {
        // 是否有人占领
        var cid = Math.floor(+req.args.id);
        gBattle.updateOwner(cid, req.uid);

        var playerFightForce = req.args.fight_force;

        var checked = 0;
        if (checked = gBattle.checkLord(cid, req.uid)) {
            resp.code = checked; resp.desc = 'locked or occupied'; break;
        }

        var city = null;
        if (cid == 0) {
            city = gBattle.selfLord[req.uid];
            if (!city) {
                city = gBattle.initSelfLord(req.uid);
            }
        } else {
            city = gBattle.city[cid];
        }

        if (city.owner) {
            if (city.owner == req.uid) {
                resp.code = 1; resp.desc = 'yourself'; break;
            }
            var ownerInfo = gUserInfo.getUserFightInfo(city.owner);
            var enemyFightForce = gUserInfo.getUserFightForce(city.owner);
            if (enemyFightForce*gConfGlobal.fightForceDiffPercent/100 > playerFightForce) {
                resp.code = 1; resp.desc = 'fight force not enough'; break;
            }

            resp.data.info = ownerInfo;
        } else {
            gBattle.userCity[req.uid] = cid;
            city.owner = req.uid;
            city.time = common.getTime();
            city.visit = city.time;
            city.double = req.args.double;
            if (cid == 0) {
                city.drop = req.args.self_lord_drop;
            }
            gBattle.markDirty(cid, req.uid);

            var owner = gUserInfo.getUser(city.owner);
            resp.data.owner = {
                'name' : owner.info.un,
                'level' : owner.status.level,
                'hid' : owner.info.model,
                'fight_force' : owner.fight_force,
                'time' : city.time,
                'got' : gBattle.getOutput(cid, null, req.uid),
                'promote' : owner.info.promote,
            };
            resp.data.owner.time = city.time;

            if (cid) {
                gBattle.lord_count[owner.info.country - 1]++;
            }
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 占领结束
exports.fight = function(req, res, resp) {
    do {
        var cid = Math.floor(+req.args.id);
        var city = gBattle.city[cid];
        if (!city.lock || city.last_uid != req.uid) {
            resp.code = 1; resp.desc = 'fight timeout'; break;
        }

        city.lock = 0;
        // 占领成功
        var date = new Date();
        if (+req.args.star > 0 || (cid == 0 && city.owner)) {
            var awards = gBattle.getOutput(cid, null, req.uid);
            if (city.double) {
                awards = timeAwards(awards, 2, true);
            }
            // 发邮件奖励
            var now = common.getTime();
            var mail = {
                from : 3,
                title : 9,
                content : [10, date.getHours(), date.getMinutes(), gUserInfo.getUser(req.uid).info.un],
                awards : awards,
                time : now,
                expire : now+gConfGlobalNew.awardMailExpireDay*3600*24,
            };

            gMail.add(city.owner, mail);
            gBattle.lord_count[gUserInfo.getUser(city.owner).info.country - 1]--;
            delete gBattle.userCity[city.owner];

            city.owner = req.uid;
            city.time = common.getTime();
            city.visit = city.time;
            city.double = req.args.double;
            city.awards = [];
            if (cid == 0) {
                city.drop = req.args.self_lord_drop;
            }

            gBattle.userCity[req.uid] = cid;
            var owner = gUserInfo.getUser(city.owner);
            gBattle.lord_count[owner.info.country - 1]++;
            resp.data.owner = {
                'name' : owner.info.un,
                'level' : owner.status.level,
                'hid' : owner.info.model,
                'fight_force' : owner.fight_force,
                'time' : city.time,
                'got' : gBattle.getOutput(cid, null, req.uid),
            };
            resp.data.owner.time = city.time;
        }
        gBattle.markDirty(cid, req.uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.leave = function(req, res, resp) {
    do {
        var cid = Math.floor(+req.args.id);
        gBattle.updateOwner(cid, req.uid);

        var city = null;
        if (cid == 0) {
            city = gBattle.selfLord[req.uid];
        } else {
            city = gBattle.city[cid];
        }

        if (city.owner != req.uid) {
            resp.code = 1; resp.desc = 'not lord'; break;
        }

        var now = common.getTime();
        var awards = gBattle.getOutput(cid, null, req.uid);
        if (city.double) {
            awards = timeAwards(awards, 2, true);
        }
        if (awards.length) {
            var mail = {
                from : 3,
                title : 9,
                content : [26],
                awards : awards,
                time : now,
                expire : now+gConfGlobalNew.awardMailExpireDay*3600*24,
            };
            gMail.add(req.uid, mail);
        }

        // 清空太守数据
        if (cid) {
            gBattle.lord_count[gUserInfo.getUser(req.uid).info.country - 1]--;
            city.owner  = 0;
            city.time   = 0;
            city.visit  = 0;
            city.awards = [];
            gBattle.markDirty(cid, req.uid);
        } else {
            gBattle.markDelete(req.uid);
            delete gBattle.selfLord[req.uid];
        }

        delete gBattle.userCity[req.uid];
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.Battle = Battle;
