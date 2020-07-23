
function Shipper() {
    this.day = 0;                       // 镖车奖励清除时间, 每日5点清除前一天的未领取
    this.shipper = {
    /*
        uid : {                             // 运镖者uid
            slevel : 0,                     // 镖车等级
            time   : 0,                     // 运镖开始时间
            type   : 0,                     // 运送镖车的品质
            rob    : 0,                     // 已被抢劫次数
            extra  : 0,                     // 是否良辰吉时运送
        },
    */
    };

    this.finished = {
    /*
        uid: {                              // 完成运镖的uid
            time   : 0,                     // 运镖完成时间
            slevel : 0,                     // 镖车等级
            type   : 0,                     // 镖车品质
            rob    : 0,                     // 被抢夺的次数
            extra  : 0,                     // 是否良辰吉时运送
        },
    */
    };

    this.report = {                         // 抢夺记录
        /*uid: [{
            time    : 0,                    // 抢夺时间
            enemy   : 0,                    // 对方UID
            rob     : 0,                    // 是否抢劫方
            success : 0,                    // 己方是否胜利
            slevel  : 0,                    // 镖车等级
            type    : 0,                    // 抢劫镖车类型
            extra   : 0,                    // 是否良辰吉时
        }],*/
    };
}

Shipper.create = function(callback) {
    var shipperData = {
        '_id': 'shipper',
        'day': {},
        'shipper': {},
        'finished': {},
        'report': {},
    };

    gDBWorld.insert(shipperData, function(err, result) {
        callback && callback();
    });
};

Shipper.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'shipper'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.day = doc.day;
                this.shipper = doc.shipper;
                this.finished = doc.finished;
                this.report = doc.report;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function(callback) {
        var shipperData = {
            _id: 'shipper',
            day: this.day,
            shipper: this.shipper,
            finished: this.finished,
            report: this.report,
        };

        gDBWorld.save(shipperData, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    delivery: function(uid, level, type, extra) {
        var shipper = {
            slevel : level,
            time   : common.getTime(),
            type   : type,
            rob    : 0,
            extra  : extra,
        };

        this.shipper[uid] = shipper;

        var retShipper = clone(shipper);
        var user = gUserInfo.getUser(uid);
        retShipper.un = user.info.un;
        retShipper.level = user.status.level;
        retShipper.fight_force = gUserInfo.getUserFightForce(uid);
        return retShipper;
    },

    getRandomShipper: function(selfUid) {
        var allShipperUids = Object.keys(gShipper.shipper).shuffle();
        allShipperUids.remove(selfUid);

        var shipperCntMax = 9;
        if (this.shipper[selfUid]) {
            allShipperUids.unshift(selfUid);
            shipperCntMax = 10;
        }

        var shippers = {};
        for (var i = 0, len = allShipperUids.length; i < shipperCntMax && i < len; i++) {
            var uid = allShipperUids[i];
            var shipper = shippers[uid] = clone(gShipper.shipper[uid]);

            var user = gUserInfo.getUser(uid);
            shipper.un = user.info.un;
            shipper.level = user.status.level;
            shipper.fight_force = gUserInfo.getUserFightForce(uid);
            var legion = gNewLegion.get(gNewLegion.userLegion[uid]);
            if (legion) {
                shipper.legion = legion.name;
            }
        }

        return shippers;
    },

    update: function(uid) {
        var now = common.getTime();
        if (uid) {
            var shipper = this.shipper[uid];
            if (!shipper) return;

            if (now - shipper.time >= gConfGlobal.shipperDeliveryTime * 60) {
                this.finished[uid] = {
                    'time': shipper.time + gConfGlobal.shipperDeliveryTime * 60,
                    'slevel': shipper.slevel,
                    'type': shipper.type,
                    'rob': shipper.rob,
                    'extra': shipper.extra,
                };

                delete this.shipper[uid];
            }
            return;
        }

        for (var uid in this.shipper) {
            var shipper = this.shipper[uid];
            if (now - shipper.time >= gConfGlobal.shipperDeliveryTime * 60) {
                this.finished[uid] = {
                    'time': shipper.time + gConfGlobal.shipperDeliveryTime * 60,
                    'slevel': shipper.slevel,
                    'type': shipper.type,
                    'rob': shipper.rob,
                    'extra': shipper.extra,
                };

                delete this.shipper[uid];
            }
        }

        var today = getGameDate();
        var todayTime = common.getTime(today) + gConfGlobal.resetHour*3600;
        var yestodayTime = todayTime - 86400;

        if (this.day != today) {
            this.day = today;
            this.report = {};

            for (var uid in this.finished) {
                if (this.finished[uid].time < yestodayTime) {
                    delete this.finished[uid];
                }
            }
        }
    },

    insertReport: function(uid, report) {
        if (!this.report[uid])
            this.report[uid] = [];

        this.report[uid].push(report);
    },
};

exports.get = function(req, res, resp) {
    gShipper.update();
    var finished = gShipper.finished[req.uid];
    if (finished) {
        resp.data.finished = finished;
        delete gShipper.finished[req.uid];
    }
    resp.data.shippers = gShipper.getRandomShipper(req.uid);
    onReqHandled(res, resp, 1);
};

exports.get_reward = function(req, res, resp) {
    gShipper.update(req.uid);
    var finished = gShipper.finished[req.uid];
    if (finished) {
        resp.data.finished = finished;
        delete gShipper.finished[req.uid];
    }
    onReqHandled(res, resp, 1);
};

exports.delivery = function(req, res, resp) {
    do {
        if (gShipper.shipper[req.uid]) {
            resp.code = 1; resp.desc = 'shipper already done'; break;
        }

        var newShipper = gShipper.delivery(req.uid, req.args.slevel, req.args.type, req.args.extra);

        resp.data.shipper = newShipper;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.delivery_immediate = function(req, res, resp) {
    do {
        var shipper = gShipper.shipper[req.uid];
        if (!shipper) {
            resp.code = 1; resp.desc = 'shipper not exists'; break;
        }

        delete gShipper.shipper[req.uid];
        resp.data.finished = {
            'time': common.getTime(),
            'slevel': shipper.slevel,
            'type': shipper.type,
            'rob': shipper.rob,
            'extra': shipper.extra,
        };
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.rob = function(req, res, resp) {
    do {
        var tarUid = req.args.target;
        gShipper.update(tarUid);
        var tarShipper = gShipper.shipper[tarUid];
        if (!tarShipper) {
            resp.code = 101; resp.desc = 'shipper not exists'; break;
        }

        if (tarShipper.rob >= gConfGlobal.shipperRobProtect) {
            resp.code = 102; resp.desc = 'shipper protect'; break;
        }

        var replay = {
            info: gUserInfo.getUserFightInfo(req.uid, true),
            enemy: gUserInfo.getUserFightInfo(tarUid),
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        }
        resp.data = replay;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight = function(req, res, resp) {
    do {
        var tarUid = req.args.target;
        gShipper.update(tarUid);
        var tarShipper = gShipper.shipper[tarUid];
        if (!tarShipper) {
            resp.code = 101; resp.desc = 'shipper not exists'; break;
        }

        if (tarShipper.rob >= gConfGlobal.shipperRobProtect) {
            resp.code = 102; resp.desc = 'shipper protect'; break;
        }

        var now = common.getTime();
        var replayKey = gReplay.addReplay(req.args.replay);
        if (req.args.star > 0) {
            tarShipper.rob++;
            resp.data.type = tarShipper.type;
            resp.data.slevel = tarShipper.slevel;
            resp.data.extra = tarShipper.extra;

            gShipper.insertReport(req.uid, {
                'time'    : now,
                'enemy'   : tarUid,
                'rob'     : 1,
                'success' : 1,
                'slevel'  : tarShipper.slevel,
                'type'    : tarShipper.type,
                'extra'   : tarShipper.extra,
                'replay'  : replayKey,
            });
            gShipper.insertReport(tarUid, {
                'time'    : now,
                'enemy'   : req.uid,
                'rob'     : 0,
                'success' : 0,
                'slevel'  : tarShipper.slevel,
                'type'    : tarShipper.type,
                'extra'   : tarShipper.extra,
                'replay'  : replayKey,
            });
        } else {
            gShipper.insertReport(req.uid, {
                'time'    : now,
                'enemy'   : tarUid,
                'rob'     : 1,
                'success' : 0,
                'slevel'  : tarShipper.slevel,
                'type'    : tarShipper.type,
                'extra'   : tarShipper.extra,
                'replay'  : replayKey,
            });
            gShipper.insertReport(tarUid, {
                'time'    : now,
                'enemy'   : req.uid,
                'rob'     : 0,
                'success' : 1,
                'slevel'  : tarShipper.slevel,
                'type'    : tarShipper.type,
                'extra'   : tarShipper.extra,
                'replay'  : replayKey,
            });
        }
        gTips.addTip(tarUid, 'shipper_report');
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_report = function(req, res, resp) {
    var report = clone(gShipper.report[req.uid]);
    if (!report) report = [];

    for (var i = 0, len = report.length; i < len; i++) {
        var enemyUid = report[i].enemy;
        var enemy = gUserInfo.getUser(enemyUid);
        report[i].un = enemy.info.un;
        report[i].headpic = enemy.info.headpic;
        report[i].headframe = enemy.info.headframe;
        report[i].level = enemy.status.level;
        report[i].fight_force = gUserInfo.getUserFightForce(enemyUid);
    }

    resp.data.report = report;
    onReqHandled(res, resp, 1);
};

exports.Shipper = Shipper;
