var MineLevel = {
    '5' : 1,
    '4' : 5,
    '3' : 13,
    '2' : 23,
    '1' : 33,
};

function Mine() {
    this.mine = {
        /*
        level_id: {                                 // 等级/10
            mine_zone_id : {                        // 矿区id
                mine_id : {                         // 矿井id
                    owner : 0,                      // 占领的玩家id
                    time : 0,                       // 占领时间
                    gold : 0,                       // 此矿金币数
                },
                count : 0,                          // 此矿区人数
                user : {                            // 玩家信息
                    uid : [duration, mine_id, ext], // 已占领时间, 占领的矿id, 是否加成
                },
                report : [                          // 战报
                    [time, attacker, enemy, gold]
                ],
            },
            ai : 0,                                 // 最大的矿区id
            total : 0,                              // 总人数
        }
        */
    };

    this.dirty = {};            // 脏数据
}

Mine.create = function(callback) {
    var mineData = {
        '_id': 'mine',
        'mine': {},
    };

    gDBWorld.insert(mineData, function(err, result) {
        callback && callback();
    });
};

Mine.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'mine'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.mine = doc.mine;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function (callback) {
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(true);
            return;
        }

        this.arrangeDirty();
        var updates = {};
        for (var item in this.dirty) {
            var obj = this;
            var args = item.split(".");
            var ok = true;
            for (var i = 0; i < args.length; i++) {
                if (typeof(obj) != 'object') {
                    ok = false;
                    break;
                }
                obj = obj[args[i]];
            }

            if (ok && obj != undefined && obj != NaN && obj != null) {
                updates[item] = obj;
            } else {
                ERROR('INVALID SAVE MINE: ' + item);
            }
        }

        this.dirty = {};
        gDBWorld.update({_id: 'mine'}, {$set: updates}, function (err, result) {
            if (err) {
                ERROR({updates: updates, err: err});
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });

        DEBUG('mine saved');
    },

    markDirty : function(name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    arrangeDirty: function () {
        var arrangedDirty = {};
        for (var item in this.dirty) {
            var needRemove = [];
            var addNew = true;
            var levels = item.split('.');
            for (var eitem in arrangedDirty) {
                var elevels = eitem.split('.');
                if (elevels.length == levels.length) continue;
                var minLen = Math.min(elevels.length, levels.length);

                var isTree = true;
                for (var i = 0; i < minLen; i++) {
                    if (elevels[i] != levels[i]) {
                        isTree = false;
                        break;
                    }
                }

                if (!isTree) continue;

                if (elevels.length < levels.length) {
                    addNew = false;
                    break;
                } else {
                    needRemove.push(eitem);
                }
            }

            needRemove.forEach(function(removeItem) {
                delete arrangedDirty[removeItem];
            });

            if (addNew) {
                arrangedDirty[item] = this.dirty[item];
            }
        }

        this.dirty = arrangedDirty;
    },

    // 重置所有金矿
    resetByDay : function() {
        var now = common.getTime();
        for (var levelId in gMine.mine) {
            var levelMine = gMine.mine[levelId];
            for (var zoneId = 1; zoneId <= levelMine.ai; zoneId++) {
                var zone = levelMine[zoneId];
                for (var mineId = 1; mineId <= 33; mineId++) {
                    this.updateOwner(now, zone, mineId, levelId, zoneId);
                    var mine = zone[mineId];
                    if (mine.owner) {
                        var duration = gMine.getDuration(now, zone, mine.owner);
                        var gold = this.getOutput(levelId, mineId, duration-zone.user[mine.owner][0], mine.gold, zone.user[mine.owner][2]);
                        this.addAwardMail(now, 'timeout', mine.owner, gold);
                    }
                }
            }
        }

        this.mine = {};
        this.dirty = {};
        this.markDirty('mine');
    },

    createMineZone : function(levelId) {
        if (!this.mine[levelId]) {
            this.mine[levelId] = {'ai' : 0, 'total' : 0};
        }

        var levelMine = this.mine[levelId];
        var initMineCount = gConfGoldMine[levelId].initMineCount;
        var ai = levelMine.ai;

        for (var i = ai + 1; i <= ai + initMineCount; i++) {
            var zone = {'count' : 0, 'user': {}, 'report' : []};
            for (var id = 1; id <= 33; id++) {
                zone[id] = {
                    'owner' : 0,
                    'time' :0,
                    'gold' : 0,
                };
            }
            levelMine[i] = zone;
        }
        levelMine.ai += initMineCount;

        this.markDirty(util.format('mine.%d', levelId));
    },

    // 重置金矿
    resetMine : function(now, zone, levelId, zoneId, mineId) {
        var mine = zone[mineId];

        if (mine.owner) {
            zone.user[mine.owner][0] = this.getDuration(now, zone, mine.owner);
            zone.user[mine.owner][1] = 0;
            this.markDirty(util.format('mine.%d.%d.user.%d', levelId, zoneId, mine.owner));
        }

        mine.owner = 0;
        mine.time = 0;
        mine.gold = 0;

        this.markDirty(util.format('mine.%d.%d.%d', levelId, zoneId, mineId));
    },

    // 成功占领矿
    occupyMine : function(now, zone, mineId, uid, levelId, zoneId) {
        // 重置原来占领的金矿
        if (zone.user[uid][1]) {
            var oldMineId = zone.user[uid][1];
            var oldMine = zone[oldMineId];
            var gold = this.getOutput(levelId, oldMineId, now-oldMine.time, oldMine.gold, zone.user[uid][2]);
            this.addAwardMail(now, 'leave', uid, gold);

            this.resetMine(now, zone, levelId, zoneId, zone.user[uid][1]);
        }

        var mine = zone[mineId];

        mine.owner = uid;
        mine.time = now;
        mine.gold = 0;
        zone.user[uid][1] = mineId;

        this.markDirty(util.format('mine.%d.%d.user.%d', levelId, zoneId, uid));
        this.markDirty(util.format('mine.%d.%d.%d', levelId, zoneId, mineId));
    },

    // 获取实际已经占领的时间
    getDuration : function(now, zone, uid) {
        var mineId = zone.user[uid][1];
        if (!mineId) {
            return zone.user[uid][0];
        }

        var mine = zone[mineId];
        var time = mine.time;
        var duration = zone.user[uid][0];
        duration += now-time;
        if (duration > gConfGlobal.mineKeepMaxTime*60) {
            duration = gConfGlobal.mineKeepMaxTime*60;
        }

        return duration;
    },

    // 更新矿主信息，在每个请求开始处调用
    updateOwner : function(now, zone, mineId, levelId, zoneId) {
        if (!mineId) {
            return;
        }

        var mine = zone[mineId];
        if (!mine.owner) {
            return;
        }

        var duration = this.getDuration(now, zone, mine.owner);
        // 总占领时间已经超时, 更新owner
        if (duration >= gConfGlobal.mineKeepMaxTime*60) {
            var gold = this.getOutput(levelId, mineId, duration-zone.user[mine.owner][0], mine.gold, zone.user[mine.owner][2]);
            this.addAwardMail(now, 'timeout', mine.owner, gold);
            // 重置此金矿
            this.resetMine(now, zone, levelId, zoneId, mineId);
        }
    },

    // 检验矿是否可占领，占领和战斗之前调用
    checkMine : function(now, zone, mineId, uid) {
        var duration = this.getDuration(now, zone, uid);

        // 当日占领时长已用完
        if (duration >= gConfGlobal.mineKeepMaxTime*60) {
            return 105;
        }

        var mine = zone[mineId];

        // 此矿没人可以打
        if (!mine.owner) {
            return 0;
        }

        // 自己不能打自己
        if (uid == mine.owner) {
            return 1;
        }

        if (zone.user[uid][1]) {
            var myMineId = zone.user[uid][1];
            var myMine = zone[myMineId];

            // 在自己矿的保护cd时间之内不可打
            if (now-myMine.time < gConfGlobal.mineSafeTime*60) {
                return 106;
            }

            // 在自己矿的保护cd时间之内不可打
            var myDuration = this.getDuration(now, zone, uid);
            var myTimeToEnd = gConfGlobal.mineKeepMaxTime*60-myDuration;
            if (myTimeToEnd > 0 && myTimeToEnd < gConfGlobal.mineSafeTime*60) {
                return 107;
            }
        }

        // 在此矿的保护cd时间之内不可打
        if (now-mine.time < gConfGlobal.mineSafeTime*60) {
            return 103;
        }

        // 距离当日占领时长还剩最后几分钟的时候不可打
        var enemyDuration = this.getDuration(now, zone, mine.owner);
        var timeToEnd = gConfGlobal.mineKeepMaxTime*60-enemyDuration;
        if (timeToEnd > 0 && timeToEnd < gConfGlobal.mineSafeTime*60) {
            return 104;
        }

        return 0;
    },

    getMineInfo : function(now, zone, mine) {
        if (!mine.owner) {
            return;
        }
        var userInfo = gUserInfo.getUser(mine.owner);
        return {
            'uid' : mine.owner,
            'time' : mine.time,
            'name' : userInfo.info.un,
            'main_role' : userInfo.pos[1].hid,
            'headpic' : userInfo.info.headpic,
            'headframe' : userInfo.info.headframe,
            'gold' : mine.gold,
            'duration' : zone.user[mine.owner][0],
            'ext' : +!!zone.user[mine.owner][2],
        };
    },

    getOutput : function(levelId, mineId, duration, extra, ext) {
        var mineLevel = this.getMineLevel(mineId);
        var mineConf = gConfGoldMine[levelId];
        var totalGold = mineConf['level'+mineLevel];
        var gold = Math.ceil(totalGold/3600*duration);

        var hour = Math.floor(duration/3600);
        for (var i = 1; i <= hour; i++) {
            if (mineConf['hour'+i]) {
                gold += Math.floor(totalGold*mineConf['hour'+i]);
            }
        }
        if (ext) {
            gold *= (1+ext);
        }

        return Math.floor(gold+extra);
    },

    getMineLevel : function(mineId) {
        var mineLevel = 0;
        for (var i = 5; i >= 1; i--) {
            if (MineLevel[i] >= mineId) {
                mineLevel = i; break;
            }
        }

        return mineLevel;
    },

    insertReport : function(zone, report, levelId, zoneId, mineId) {
        var zoneReport = zone.report;
        if (zoneReport.length >= 50) {
            zoneReport.shift();
        }
        zoneReport.push(report);

        this.markDirty(util.format('mine.%d.%d.%d.report', levelId, zoneId, mineId));
    },

    // 发放奖励邮件
    addAwardMail : function(now, type, uid, gold, enemyId) {
        var content = null;
        if (type == 'occupied') {
            var enemy = gUserInfo.getUser(enemyId);
            content = [2, enemy.info.un, gold];     // 第1行，参数值
        } else if (type == 'leave') {
            content = [3, gold];
        } else if (type == 'timeout') {
            content = [4, gold];
        } else {
            return;
        }
        var mail = {
            from : 2,
            title : 1,
            content : content,
            awards : [['user', 'gold', gold]],
            time : now,
            expire : now+gConfGlobal.awardMailExpireDay*3600*24,
        };

        gMail.add(uid, mail);
    },
};

exports.get = function(req, res, resp) {
    do {
        var now = common.getTime();

        var level = req.args.level;
        var levelId = req.args.level_id;
        var zoneId = req.args.zone_id;

        var levelMine = gMine.mine[levelId];
        var newLevelId = Math.floor(level/10);
        if (!newLevelId) {
            resp.code = 1; resp.desc = 'invalid level'; break;
        }

        var newMine = false;
        var duration = 0;
        // 没有进过矿，需要进新矿
        if (!levelMine) {
            newMine = true;
            levelId = newLevelId;
        } else if (levelId != newLevelId && zoneId){
            // 进过矿，等级变化，且当前没占领任何一个矿，需要进新矿
            var zone = levelMine[zoneId];
            var mineId = zone.user[req.uid][1];
            // 已占矿的情况要更新矿的状态
            if (mineId) {
                gMine.updateOwner(now, zone, mineId, levelId, zoneId);
            }

            if (!zone.user[req.uid][1]) {
                duration = zone.user[req.uid][0];
                delete zone.user[req.uid];
                zone.count--;
                levelMine.total--;
                levelId = newLevelId;
                newMine = true;

                gMine.markDirty(util.format('mine.%d.%d.user', levelId, zoneId));
            }
        }

        // 玩家进入新矿
        if (newMine) {
            // 创建新等级区
            if (!gMine.mine[levelId]) {
                gMine.createMineZone(levelId);
            }

            levelMine = gMine.mine[levelId];
            var mineUserMaxCount = gConfGoldMine[levelId].mineUserMaxCount;
            var total = levelMine.total;

            // 当前所有矿人已经满了, 则创建新矿区
            if (total >= levelMine.ai*mineUserMaxCount) {
                gMine.createMineZone(levelId);
            }

            // 在未满的矿区中随机分配一个矿区
            var randArr = [];
            for (var i = 1; i <= levelMine.ai; i++) {
                if (levelMine[i] && levelMine[i].count < mineUserMaxCount) {
                    randArr.push(i);
                }
            }
            zoneId = common.randArray(randArr);

            levelMine.total++;
            levelMine[zoneId].count++;
            levelMine[zoneId].user[req.uid] = [duration, 0];

            gMine.markDirty(util.format('mine.%d', levelId));
        }

        var zone = levelMine[zoneId];
        if (!zone || !zone.user[req.uid]) {
            resp.code = 1; resp.desc = 'data error'; break;
        }

        var mineInfo = {};
        for (var i = 1; i <= 33; i++) {
            gMine.updateOwner(now, zone, i, levelId, zoneId);
            var mine = zone[i];
            if (mine.owner) {
                mineInfo[i] = gMine.getMineInfo(now, zone, mine);
            }
        }

        // 解锁玉玺加成
        if (req.args.ext && !zone.user[req.uid][2]) {
            zone.user[req.uid][2] = req.args.ext;
            gMine.markDirty(util.format('mine.%d.%d.user.%d', levelId, zoneId, req.uid));
        }

        resp.data.mines = mineInfo;
        resp.data.level_id = levelId;
        resp.data.zone_id = zoneId;
        resp.data.count = zone.count;
        resp.data.mine_id = zone.user[req.uid][1];
        resp.data.duration = zone.user[req.uid][0];

        if (resp.data.mine_id) {
            resp.data.status = 'occupy_mine';
        } else {
            resp.data.status = 'idle';
        }

    }while(false);

    onReqHandled(res, resp, 1);
};

// 占领
exports.occupy = function(req, res, resp) {
    do {
        var levelId = +req.args.level_id;
        var zoneId = +req.args.zone_id;
        var mineId = +req.args.id;
        var robCount = +req.args.rob_count;
        var gold = +req.args.gold;
        var now = common.getTime();

        var zone = gMine.mine[levelId][zoneId];
        var mine = zone[mineId];

        gMine.updateOwner(now, zone, mineId, levelId, zoneId);
        gMine.updateOwner(now, zone, zone.user[req.uid][1], levelId, zoneId);

        var checked = gMine.checkMine(now, zone, mineId, req.uid);
        if (checked) {
            resp.code = checked; resp.desc = 'yourself or safe or has no time'; break;
        }

        if (mine.owner) {
            var allGold = gMine.getOutput(levelId, mineId, now-mine.time, mine.gold, zone.user[mine.owner][2]);
            var mineLevel = gMine.getMineLevel(mineId);
            if (gold <= allGold*gConfGlobal['mineDeposit'+mineLevel]/100) {
                resp.code = 1; resp.desc = 'no enough gold'; break;
            }

            var replay = {
                rand1: common.randRange(0, 99999),
                rand2: common.randRange(0, 99999),
                info: gUserInfo.getUserFightInfo(req.uid),
                enemy: gUserInfo.getUserFightInfo(mine.owner),
            };
            resp.data = replay;
            // 战斗准备的状态
            resp.data.status = 'prepare_mine';
        } else {
            gMine.occupyMine(now, zone, mineId, req.uid, levelId, zoneId);

            // 占领矿的状态
            resp.data.status = 'occupy_mine';
            resp.data.mine = gMine.getMineInfo(now, zone, mine);

            pushToUser(req.uid, null, {
                mod: 'mine',
                act: 'occupy',
                status: 0,
                info: resp.data.mine,
            }, 'mine_'+levelId+'_'+zoneId);
        }
    }while(false);

    onReqHandled(res, resp, 1);
};

// 占领结束
exports.fight = function(req, res, resp) {
    do {
        var levelId = +req.args.level_id;
        var zoneId = +req.args.zone_id;
        var mineId = +req.args.id;
        var robCount = +req.args.rob_count;

        var zone = gMine.mine[levelId][zoneId];
        var mine = zone[mineId];
        var owner = mine.owner;
        if (owner != req.args.replay.enemy.uid) {
            resp.code = 101; resp.desc = 'mine changed'; break;
        }

        var now = common.getTime();
        gMine.updateOwner(now, zone, mineId, levelId, zoneId);
        gMine.updateOwner(now, zone, zone.user[req.uid][1], levelId, zoneId);

        // 占领成功
        var replayKey = gReplay.addReplay(req.args.replay);
        if (req.args.star > 0) {
            var allGold = gMine.getOutput(levelId, mineId, now-mine.time, mine.gold, zone.user[owner][2]);
            var mineLevel = gMine.getMineLevel(mineId);
            var deposit = Math.ceil(allGold*gConfGlobal['mineDeposit'+mineLevel]/100);
            allGold -= deposit;

            // 给原主人发送邮件奖励
            gMine.addAwardMail(now, 'occupied', owner, allGold, req.uid);

            // 设置原主人的占领时间
            zone.user[owner][0] += now-mine.time;
            zone.user[owner][1] = 0;
            mine.owner = 0;

            // 新主人占领矿
            gMine.occupyMine(now, zone, mineId, req.uid, levelId, zoneId);

            // 抢夺
            if (robCount < gConfGlobal.mineRobMaxCount) {
                gMine.insertReport(zone, [now, mineId, req.uid, owner, deposit, 1, replayKey], levelId, zoneId, mineId);
                // 矿额外的金币数剩为两倍的押金
                mine.gold = 2*deposit;
            } else {
                // 驱赶
                gMine.insertReport(zone, [now, mineId, req.uid, owner, 0, 1, replayKey], levelId, zoneId, mineId);
            }
            resp.data.status = 'occupy_mine';

            pushToUser(req.uid, null, {
                mod: 'mine',
                act: 'occupy',
                info: gMine.getMineInfo(now, zone, mine),
            }, 'mine_'+levelId+'_'+zoneId);
            gTips.addTip(owner, 'mine_report');

            gMine.markDirty(util.format('mine.%d.%d.user.%d', levelId, zoneId, owner));
            gMine.markDirty(util.format('mine.%d.%d.%d', levelId, zoneId, mineId));
        } else {
            // 占领失败
            if (zone.user[req.uid][1]) {
                resp.data.status = 'occupy_mine';
            } else {
                resp.data.status = 'idle';
            }
            gMine.insertReport(zone, [now, mineId, req.uid, owner, -deposit, 0, replayKey], levelId, zoneId, mineId);
        }
        resp.data.mine = gMine.getMineInfo(now, zone, mine);
    } while(false);

    onReqHandled(res, resp, 1);
};

// 撤出
exports.leave = function(req, res, resp) {
    do {
        var levelId = +req.args.level_id;
        var zoneId = +req.args.zone_id;
        var mineId = +req.args.id;

        var zone = gMine.mine[levelId][zoneId];
        var mine = zone[mineId];

        var now = common.getTime();
        gMine.updateOwner(now, zone, mineId, levelId, zoneId);

        if (mine.owner != req.uid) {
            resp.data.mine = gMine.getMineInfo(now, zone, mine);
        } else {
            // 在自己矿的保护cd时间之内不可打
            if (now-mine.time < gConfGlobal.mineSafeTime*60) {
                return 106;
            }

            // 在自己矿的保护cd时间之内不可打
            var duration = gMine.getDuration(now, zone, req.uid);
            var timeToEnd = gConfGlobal.mineKeepMaxTime*60-duration;
            if (timeToEnd > 0 && timeToEnd < gConfGlobal.mineSafeTime*60) {
                return 107;
            }

            var gold = gMine.getOutput(levelId, mineId, now-mine.time, mine.gold, zone.user[req.uid][2]);
            gMine.addAwardMail(now, 'leave', req.uid, gold);
            pushToUser(req.uid, null, {
                mod: 'mine',
                act: 'leave',
                id: mineId,
            }, 'mine_'+levelId+'_'+zoneId);

            gMine.resetMine(now, zone, levelId, zoneId, mineId);
        }

        resp.data.status = 'idle';
        resp.data.duration = zone.user[req.uid][0];
    } while (false);

    onReqHandled(res, resp, 1);
}

// 获取战报
exports.get_report = function(req, res, resp) {
    do {
        var time = +req.args.time;
        var levelId = +req.args.level_id;
        var zoneId = +req.args.zone_id;

        var zone = gMine.mine[levelId][zoneId];

        var report = [];
        for (var i = 0, len = zone.report.length; i < len; i++) {
            if (zone.report[i][0] > time) {
                var attacker = zone.report[i][1];
                var enemy = zone.report[i][2];
                report.push([
                    zone.report[i][0],
                    gMine.getMineLevel(zone.report[i][1]),
                    zone.report[i][2],
                    gUserInfo.getUser(zone.report[i][2]).info.un,
                    zone.report[i][3],
                    gUserInfo.getUser(zone.report[i][3]).info.un,
                    zone.report[i][4],
                    zone.report[i][5],
                    zone.report[i][6],
                ]);
            }
        }

        resp.data.report = report;
    } while (false);

    onReqHandled(res, resp, 1);
}

// 重置已占领时间， for gm
exports.reset_mine_duration = function(req, res, resp) {
    do {
        var uid = req.uid;
        var levelId = +req.args.level_id;
        var zoneId = +req.args.zone_id;
        if (!levelId || !zoneId) {
            resp.code = 1; resp.desc = 'has not in mine'; break;
        }

        var zone = gMine.mine[levelId][zoneId];
        if (!zone.user[uid]) {
            resp.code = 1; resp.desc = 'not in mine'; break;
        }
        zone.user[uid][0] = 0;

        gMine.markDirty(util.format('mine.%d.%d.user.%d', levelId, zoneId, uid));
    } while (false);

    onReqHandled(res, resp, 1);
}

exports.Mine = Mine;
