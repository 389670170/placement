var ErrorCode = require('../landgrabber/error.js').ErrorCode;
var fs = require('fs');
var config = require('../config.js');

function LandGrabber() {
    // 村庄占领数据
    this.villages = {
        /*
         village_id: {
            team_id: 0,                 // 占领小队id，0表示无小队占领
            time: 0,                    // 占领时的时间
            remain_res : 0,             // 剩余资源量
            calc_time : 0,              // 结算时间
         }
         */
    };

    // 第一村庄
    this.village1st = {
        /*
        team_id : {
            team_id: 0,
            time: 0,
            remain_res : 0,             // 剩余资源量
            calc_time : 0,              // 结算时间
        }
        */
    };

    // 战队数据
    this.teams = {
        /*
         team_id: {
            flowers: 0,                 // 收到的鲜花数
            eggs : 0,                   // 收到的鸡蛋数
            buff_list : {               // buff列表
                100001 : 0,
                100002 : 0,             // buff id ：生效起始时间
            },

            leader_uid : 0,             // 队长uid
            badge : 0,                  // 战队徽章
            server_id : 0,              // 服务器id
            member_list : {
                uid : {
                    storage : 0,        // 存储量
                }
            },
         }
         */
    };

    // 地块占领数据
    this.lands = {
        /*
        village_id : {
            land_id: {
                owner: 0,                   // 占领者id，0表示无人占领
                time: 0,                    // 占领时的时间
                calc_time : 0,              // 上一次结算时间
                awards : [],                // 已经获得的奖励
            },
        },
         */
    };

    // 玩家荒地对应表
    this.barren_land = {
        /*
        uid : {
            land_id : 0,                // 荒地id
            time: 0,                    // 占领时的时间
            calc_time : 0,              // 上一次结算时间
            awards : [],                // 已经获得的奖励
        }
         */
    },

        // 村庄战报
        this.village_reports = {
            /*
             key : {
                    time : 0,
                          //       team_1 : 0,
            //     team_1_name
            //    team_1_badge
            //     team_1_server_id
            //    team_1_fight_force
            //         team_2 : 0,
            //     team_2_name
            //    team_2_badge
            //     team_2_server_id
            //    team_2_fight_force
                    win_team : 0,
                    detail : [
                        [time, uid_1, uid_2, win_uid, win_count, replay],     // 时间，参战方1，参战方2，胜利方，战报key
                        [time, uid_1, uid_2, win_uid, win_count, replay],     // 时间，参战方1，参战方2，胜利方，战报key
                    ]
                },
             */
        };

    // 地块战报
    this.land_reports = {
        /*
         uid : [
            [time, enemy_id, win_uid, replay]     // 时间，敌方id，胜利or失败，战报key
         ]
         */
    };

    // 玩家每日已占领地块时间
    this.dailyLandHoldTime = {
        /*
        uid : 0,
         */
    };

    // 玩家昨日未用完占领时间
    this.notUseTime = {
        /*
         uid : 0,
         */
    };

    this.balance = 0;                           // 上次结算时间
    this.dirty = {};

    this.teamMapToVillage = {}; // 队伍与村庄对应表
}

LandGrabber.create = function (callback) {
    var landData = {
        '_id': 'land_grabber',
        'villages': {},
        'village1st': {},
        'lands': {},
        'barren_land': {},
        'teams': {},
        'village_reports': {},
        'land_reports': {},
        'balance': 0,
        'dailyLandHoldTime': {},
        'notUseTime': {},
    };

    gDBWorld.insert(landData, function (err, result) {
        callback && callback();
    });
}

LandGrabber.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'land_grabber' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.villages = doc.villages;
                this.lands = doc.lands;
                this.barren_land = doc.barren_land;
                this.teams = doc.teams;
                this.village_reports = doc.village_reports;
                this.land_reports = doc.land_reports;
                this.balance = doc.balance;
                this.dailyLandHoldTime = doc.dailyLandHoldTime;
                this.notUseTime = doc.notUseTime;

                // 第一村庄
                if (doc.village1st) {
                    this.village1st = doc.village1st;
                } else {
                    if (!this.village1st) {
                        this.village1st = {};   
                    }
                    this.markDirty('village1st');
                }

                if (this.villages[1]) {
                    DEBUG(`原村庄的队伍: ${this.villages[1].team_id}`);
                    this.villages[1].team_id = 0;
                }

                // 构建队伍与村庄对应表
                for (var k in this.villages) {
                    if (+k == 1) {
                        continue;
                    }
                    if (this.villages[k].team_id > 0) {
                        var teamData = gClan.getTeamData(this.villages[k].team_id);
                        if (teamData && this.teams[this.villages[k].team_id]) {
                            this.teamMapToVillage[this.villages[k].team_id] = parseInt(k);
                        } else {
                            this.villages[k].team_id = 0;
                            this.villages[k].time = 0;
                            this.villages[k].remain_res = gConfTeamLand[k].resourceReserve[0][2];
                            this.markDirty(util.format('villages.%d', k));
                        }
                    }
                }

                // 第一村庄 映射表
                for (let team_id in this.village1st) {
                    var teamData = gClan.getTeamData(team_id);
                    if (teamData && this.teams[team_id]) {
                        this.teamMapToVillage[team_id] = 1;
                    }
                }

                if (!this.barren_land) {
                    this.barren_land = {};
                    this.markDirty('barren_land');
                }

                if (!this.dailyLandHoldTime) {
                    this.dailyLandHoldTime = {};
                    this.markDirty('dailyLandHoldTime');
                }

                if (!this.notUseTime) {
                    this.notUseTime = {};
                    this.markDirty('notUseTime');
                }

                this._init();
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    _init: function () {
        for (var k in gConfTeamLand) {
            if (!this.villages[k]) {
                this.villages[k] = {};
                this.villages[k].team_id = 0;
                this.villages[k].time = 0;
                this.villages[k].remain_res = gConfTeamLand[k].resourceReserve[0][2];
                this.villages[k].calc_time = 0;
                this.markDirty(util.format('villages.%d', k));
            }
        }
    },

    tickFunc: function () {
        this.tickVillage();
        this.tickLand();
    },

    tickVillage: function () {
        for (var k in this.villages) {
            var villageId = parseInt(k);

            // 第一村庄
            if (villageId == 1) {
                for (var team_id in this.village1st) {
                    var resEmpty = this.calcVillageAward1st(team_id);
                    if (resEmpty) {
                        // 资源耗尽， 给队伍成员，发奖励邮件
                        var awardsArr = {};
                        this.calcVillageAward1st(team_id, awardsArr, true);

                        var teamInfo = this.teams[team_id];
                        if (!teamInfo) {
                            continue;
                        }

                        for (var k in teamInfo.member_list) {
                            var memberUid = parseInt(k);
                            if (awardsArr[memberUid] > 0) {
                                var awards = clone(gConfTeamLand[villageId].resourceReserve);
                                awards[0][2] = Math.floor(awardsArr[memberUid]);
                                var time = common.getTime();
                                var mail = {
                                    awards: awards,
                                    time: time,
                                    expire: time + gConfMail[42].time * OneDayTime,
                                    content: [42, villageId],
                                    attach: {},
                                }

                                gMail.add(memberUid, mail);

                                // 发完清空已获得奖励
                                teamInfo.member_list[memberUid].storage = 0;
                                this.markDirty(util.format('teams.%d.member_list.%d', team_id, memberUid));
                            }
                        }
                    }
                }

                continue;
            }

            var resEmpty = this.calcVillageAward(villageId);
            if (resEmpty) {
                // 资源耗尽， 给队伍成员，发奖励邮件
                var awardsArr = {};
                this.calcVillageAward(villageId, awardsArr, true);

                var teamId = this.villages[k].team_id;
                var teamInfo = this.teams[teamId];
                for (var k in teamInfo.member_list) {
                    var memberUid = parseInt(k);
                    if (awardsArr[memberUid] > 0) {
                        var awards = clone(gConfTeamLand[villageId].resourceReserve);
                        awards[0][2] = Math.floor(awardsArr[memberUid]);
                        var time = common.getTime();
                        var mail = {
                            awards: awards,
                            time: time,
                            expire: time + gConfMail[42].time * OneDayTime,
                            content: [42, villageId],
                            attach: {

                            },
                        }

                        gMail.add(memberUid, mail);

                        // 发完清空已获得奖励
                        teamInfo.member_list[memberUid].storage = 0;
                        this.markDirty(util.format('teams.%d.member_list.%d', teamId, memberUid));
                    }
                }
            }
        }
    },

    // 是否土地争夺奖励双倍
    isLandAwardDouble: function () {
        if (isActivityStart_no_player('todaydouble')) {
            var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
            if (doubleConf) {
                if (doubleConf.gateway1 == 'landgrabber') {
                    return true;
                }
            }
        }

        return false;
    },

    tickLand: function () {
        for (var k in this.lands) {
            var villageId = parseInt(k);
            for (var k1 in this.lands[villageId]) {
                var landId = parseInt(k1);
                var timeOver = this.calcLandAwards(villageId, landId);
                if (timeOver) {
                    var awards = this.lands[villageId][landId].awards;
                    var owner = this.lands[villageId][landId].owner;

                    // 占领时间耗尽，发邮件，清除玩家
                    var time = common.getTime();
                    var mail = {
                        awards: awards,
                        time: time,
                        expire: time + gConfMail[40].time * OneDayTime,
                        content: [40, villageId, landId],
                        attach: {

                        },
                    }

                    gMail.add(owner, mail);

                    delete this.lands[villageId][landId];
                    this.markDirty(util.format('lands.%d', villageId));
                }
            }
        }

        for (var k in this.barren_land) {
            var uid = parseInt(k);
            var timeOver = this.calcBarrenLandAwards(uid);
            if (timeOver) {
                // 占领时间耗尽，发邮件，清除玩家
                var awards = this.barren_land[uid].awards;
                var landId = this.barren_land[uid].land_id;

                // 占领时间耗尽，发邮件，清除玩家
                var time = common.getTime();
                var mail = {
                    awards: awards,
                    time: time,
                    expire: time + gConfMail[40].time * OneDayTime,
                    content: [40, DEFAULT_BARREN_LAND_BEGIN_ID, landId],
                    attach: {

                    },
                }

                gMail.add(uid, mail);

                // 清除玩家
                delete this.barren_land[uid];
                this.markDelete(util.format('barren_land.%d', uid));
            }
        }
    },

    // 每日重置
    resetByDay: function () {
        var curTime = common.getTime();

        // 重置村庄奖励
        for (var k in this.villages) {
            var villageId = parseInt(k);

            // 第一村庄
            if (villageId == 1) {
                for (var team_id in this.village1st) {
                    var awardsArr = {};
                    if (this.village1st[team_id].remain_res > 0) {
                        this.calcVillageAward1st(team_id, awardsArr, true);
                    }

                    var teamInfo = this.teams[team_id];
                    if (teamInfo) {
                        for (var k1 in teamInfo.member_list) {
                            var memberUid = parseInt(k1);
                            if (awardsArr[memberUid] && awardsArr[memberUid] > 0) {
                                var awards = clone(gConfTeamLand[villageId].resourceReserve);
                                awards[0][2] = Math.floor(awardsArr[memberUid]);
                                var time = common.getTime();
                                var mail = {
                                    awards: awards,
                                    time: time,
                                    expire: time + gConfMail[43].time * OneDayTime,
                                    content: [43, villageId],
                                    attach: {

                                    },
                                }

                                gMail.add(memberUid, mail);

                                // 发完邮件，清掉存储量
                                teamInfo.member_list[memberUid].storage = 0;
                                this.markDirty(util.format('teams.%d.member_list.%d', team_id, memberUid));
                            }
                        }
                    }

                    // 重置产量
                    this.village1st[team_id].remain_res = gConfTeamLand[villageId].resourceReserve[0][2];
                }

                this.markDirty('village1st');
                continue;
            }

            if (this.villages[villageId].team_id > 0) {
                var awardsArr = {};
                if (this.villages[villageId].remain_res > 0) {
                    this.calcVillageAward(villageId, awardsArr, true);
                }

                var teamInfo = this.teams[this.villages[villageId].team_id];
                if (teamInfo) {
                    for (var k1 in teamInfo.member_list) {
                        var memberUid = parseInt(k1);
                        if (awardsArr[memberUid] && awardsArr[memberUid] > 0) {
                            var awards = clone(gConfTeamLand[villageId].resourceReserve);
                            awards[0][2] = Math.floor(awardsArr[memberUid]);
                            var time = common.getTime();
                            var mail = {
                                awards: awards,
                                time: time,
                                expire: time + gConfMail[43].time * OneDayTime,
                                content: [43, villageId],
                                attach: {

                                },
                            }

                            gMail.add(memberUid, mail);

                            // 发完邮件，清掉存储量
                            teamInfo.member_list[memberUid].storage = 0;
                            this.markDirty(util.format('teams.%d.member_list.%d', this.villages[villageId].team_id, memberUid));
                        }
                    }
                }
            }

            // 重置产量
            this.villages[villageId].time = curTime;
            this.villages[villageId].remain_res = gConfTeamLand[villageId].resourceReserve[0][2];
            this.markDirty(util.format('villages.%d', villageId));

            DEBUG('village id = ' + villageId + ' reset by day');
        }

        this.resetTime = curTime;
        this.markDirty('resetTime');

        // 重置地块占领时间
        // for (var k in this.lands) {
        //     var villageId = parseInt(k);
        //     for (var k1 in this.lands[villageId]) {
        //         var landId = parseInt(k1);
        //         if (this.lands[villageId][landId].owner > 0) {
        //             // 计算剩余占领时间
        //             /*var owner = this.lands[villageId][landId].owner;
        //             var startTime = this.lands[villageId][landId].time;
        //             var passTime = curTime - startTime;
        //             var holdTime = this.dailyLandHoldTime[owner] || 0;
        //             var remainTime = gConfGlobalNew.territoryWarPersonalMaxHour * 3600 - holdTime - passTime;
        //             if (remainTime > 0) {
        //                 this.notUseTime[owner] = remainTime;
        //                 this.markDirty(util.format('notUseTime.%d', owner));
        //             }*/
        //
        //             // 清空玩家今日占领时间
        //             this.dailyLandHoldTime[owner] = 0;
        //             this.markDirty(util.format('dailyLandHoldTime.%d', owner));
        //         }
        //     }
        // }
        //
        // // 荒地处理
        // for (var uid in this.barren_land) {
        //     var owner = parseInt(uid);
        //     var startTime = this.barren_land[owner].time;
        //     var passTime = curTime - startTime;
        //     var holdTime = this.dailyLandHoldTime[owner] || 0;
        //
        //     var remainTime = gConfGlobalNew.territoryWarPersonalMaxHour * 3600 - holdTime - passTime;
        //     if (remainTime > 0) {
        //         this.notUseTime[owner] = remainTime;
        //         this.markDirty(util.format('notUseTime.%d', owner));
        //     }
        //
        //     // 清空玩家今日占领时间
        //     this.dailyLandHoldTime[owner] = 0;
        //     this.markDirty(util.format('dailyLandHoldTime.%d', owner));
        // }
        //
        // for (var uid in this.dailyLandHoldTime) {
        //     if (this.dailyLandHoldTime[uid] > 0) {
        //         this.dailyLandHoldTime[uid] = 0;
        //         this.markDirty(util.format('dailyLandHoldTime.%d', uid));
        //     }
        // }
    },

    markDirty: function (name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    markDelete: function (name) {
        this.dirty[name] = 1;
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

            needRemove.forEach(function (removeItem) {
                delete arrangedDirty[removeItem];
            });

            if (addNew) {
                arrangedDirty[item] = this.dirty[item];
            }
        }

        this.dirty = arrangedDirty;
    },

    // 保存
    save: function (callback) {
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(true);
            return;
        }

        this.arrangeDirty();
        var updates = { $set: {}, $unset: {} };
        for (var item in this.dirty) {
            var remove = this.dirty[item];
            if (remove) {
                updates['$unset'][item] = 1;
            } else {
                var obj = this;
                var args = item.split(".");
                var ok = true;
                for (var i = 0; i < args.length; i++) {
                    if (typeof (obj) != 'object') {
                        ok = false;
                        break;
                    }
                    obj = obj[args[i]];
                }

                if (ok && obj != undefined && obj != NaN && obj != null) {
                    updates['$set'][item] = obj;
                } else {
                    ERROR('INVALID SAVE LAND GRABBER: ' + item);
                }
            }
        }

        var toUpdate = 2;

        if (Object.keys(updates['$unset']).length == 0) {
            delete updates['$unset'];
            toUpdate--;
        }

        if (Object.keys(updates['$set']).length == 0) {
            delete updates['$set'];
            toUpdate--;
        }

        if (toUpdate) {
            var _me = this;
            this.dirty = {};
            gDBWorld.update({ _id: 'land_grabber' }, updates, function (err, result) {
                if (err) {
                    ERROR({ updates: updates, err: err });
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            });
        }
    },

    // 添加战报
    addVillageReport: function (village_id, team1, team2, win_team, replay, detail_arr, remainRes) {
        var keyStr = util.format('%d_%d_%d', team1.team_id, team2.team_id, common.getTime());

        var curTime = common.getTime();
        var reportObj = {};
        reportObj.village_id = village_id;

        reportObj.team_1 = team1.team_id;
        reportObj.team_1_name = team1.name;
        reportObj.team_1_badge = team1.use_badge || 0;
        reportObj.team_1_server_id = team1.server_id;
        reportObj.team_1_fight_force = team1.fightCount;

        reportObj.team_2 = team2.team_id;
        reportObj.team_2_name = team2.name;
        reportObj.team_2_badge = team2.use_badge || 0;
        reportObj.team_2_server_id = team2.server_id;
        reportObj.team_2_fight_force = team2.fightCount;

        reportObj.time = curTime;
        reportObj.win_team = win_team;
        reportObj.remain_res = remainRes;
        reportObj.detail = [];

        for (var i = 0; i < detail_arr.length; i++) {
            var replayData = {
                info: replay.info.members[detail_arr[i].army1],
                enemy: replay.enemy.members[detail_arr[i].army2],
                rand1: replay.rand1,
                rand2: replay.rand2,
            }

            var replayKey = gReplay.addReplay(replayData);
            var detailObj = [curTime, detail_arr[i].army1, detail_arr[i].army2, detail_arr[i].winner, detail_arr[i].win_count_1, detail_arr[i].win_count_2, replayKey];

            reportObj.detail.push(detailObj);
        }

        this.village_reports[keyStr] = reportObj;
        this.markDirty(util.format('village_reports.%s', keyStr));
    },

    // 根据队伍id获取战报
    getVillageReportByTeamId: function (teamId,serverId) {
        var reportList = [];
        for (var k in this.village_reports) {
            if (this.village_reports[k].team_1 == teamId || this.village_reports[k].team_2 == teamId) {
                var reportObj = {};
                reportObj.key = k;

                reportObj.team_1 = {};
                reportObj.team_1.team_id = this.village_reports[k].team_1;
                reportObj.team_1.team_name = this.village_reports[k].team_1_name;
                reportObj.team_1.badge = this.village_reports[k].team_1_badge;
                reportObj.team_1.server_id =serverId;
                reportObj.team_1.fight_force = this.village_reports[k].team_1_fight_force;

                reportObj.team_2 = {};
                reportObj.team_2.team_id = this.village_reports[k].team_2;
                reportObj.team_2.team_name = this.village_reports[k].team_2_name;
                reportObj.team_2.badge = this.village_reports[k].team_2_badge;
                reportObj.team_2.server_id = serverId;
                reportObj.team_2.fight_force = this.village_reports[k].team_2_fight_force;

                reportObj.village_id = this.village_reports[k].village_id;
                reportObj.win_team = this.village_reports[k].win_team;
                reportObj.time = this.village_reports[k].time;

                reportList.push(reportObj);
            }
        }

        return reportList;
    },

    // 根据村庄id获取战报列表
    getVillageReportByVillageId: function (village_id,serverId) {
        var reportList = [];
        for (var k in this.village_reports) {
            if(village_id == 1) continue;

            if (this.village_reports[k].village_id == village_id) {
                var reportObj = {};
                reportObj.key = k;

                reportObj.team_1 = {};
                reportObj.team_1.team_id = this.village_reports[k].team_1;
                reportObj.team_1.team_name = this.village_reports[k].team_1_name;
                reportObj.team_1.badge = this.village_reports[k].team_1_badge;
                reportObj.team_1.server_id =serverId;
                reportObj.team_1.fight_force = this.village_reports[k].team_1_fight_force;

                reportObj.team_2 = {};
                reportObj.team_2.team_id = this.village_reports[k].team_2;
                reportObj.team_2.team_name = this.village_reports[k].team_2_name;
                reportObj.team_2.badge = this.village_reports[k].team_2_badge;
                reportObj.team_2.server_id = serverId;
                reportObj.team_2.fight_force = this.village_reports[k].team_2_fight_force;

                reportObj.village_id = this.village_reports[k].village_id;
                reportObj.win_team = this.village_reports[k].win_team;
                reportObj.time = this.village_reports[k].time;

                reportList.push(reportObj);
            }
        }

        return reportList;
    },

    // 获取战报具体信息
    getVillageReportDetail: function (key) {
        var reportObj = this.village_reports[key];
        if (!reportObj) {
            return [];
        }

        var detailList = [];
        for (var i = 0; i < reportObj.detail.length; i++) {
            var detailObj = {};
            detailObj.time = reportObj.detail[i][0];
            detailObj.replaykey = reportObj.detail[i][6];
            detailObj.winner = reportObj.detail[i][3];
            detailObj.remain_res = reportObj.remain_res;

            detailObj.user_1 = {};
            detailObj.user_2 = {};

            detailObj.user_1.uid = reportObj.detail[i][1];
            detailObj.user_2.uid = reportObj.detail[i][2];

            detailObj.user_1.win_count = reportObj.detail[i][4];
            detailObj.user_2.win_count = reportObj.detail[i][5];

            var user1 = gUserInfo.getUser(detailObj.user_1.uid);
            if (user1) {
                detailObj.user_1.name = user1.info.un;
                detailObj.user_1.vip = user1.status.vip;
                detailObj.user_1.level = user1.status.level;
                detailObj.user_1.headpic = user1.info.headpic;
                detailObj.user_1.headframe = user1.info.headframe;
                detailObj.user_1.custom_king = user1.custom_king;
                detailObj.user_1.fight_force = user1.fight_force;
            }

            var user2 = gUserInfo.getUser(detailObj.user_2.uid);
            if (user2) {
                detailObj.user_2.name = user2.info.un;
                detailObj.user_2.vip = user2.status.vip;
                detailObj.user_2.level = user2.status.level;
                detailObj.user_2.headpic = user2.info.headpic;
                detailObj.user_2.headframe = user2.info.headframe;
                detailObj.user_2.custom_king = user2.custom_king;
                detailObj.user_2.fight_force = user2.fight_force;
            }

            detailList.push(detailObj);
        }

        return detailList;
    },

    // 添加地块战报
    addLandReport: function (uid1, uid2, replay, win_uid, village_id, land_id) {
        if (!village_id || !land_id) {
            return;
        }

        if (!this.land_reports[village_id]) {
            this.land_reports[village_id] = {};
            this.markDirty(util.format('land_reports.%d', village_id));
        }

        var reports1 = this.land_reports[village_id][uid1];
        if (!reports1) {
            reports1 = this.land_reports[village_id][uid1] = [];
        }

        var curTime = common.getTime();
        var attacker = uid1;

        var replayKey = gReplay.addReplay(replay);
        var report1 = [curTime, uid2, win_uid, land_id, replayKey, attacker];
        reports1.push(report1);

        if (reports1.length > gConfGlobalNew.arenaReportCount) {
            reports1.shift();
        }

        var reports2 = this.land_reports[village_id][uid2];
        if (!reports2) {
            reports2 = this.land_reports[village_id][uid2] = [];
        }

        var report2 = [curTime, uid1, win_uid, land_id, replayKey, attacker];
        reports2.push(report2);

        if (reports2.length > gConfGlobalNew.arenaReportCount) {
            reports2.shift();
        }

        this.markDirty(util.format('land_reports.%d.%d', village_id, uid1));
        this.markDirty(util.format('land_reports.%d.%d', village_id, uid2));
    },

    // 获取村庄占领队伍
    getVillageOwnerInfo: function (village_id) {
        var info = {};
        if (this.villages[village_id]) {
            info.team_id = this.villages[village_id].team_id;
            if (info.team_id > 0 && this.teams[info.team_id]) {
                // 队伍名字
                info.team_name = this.teams[info.team_id].name;
                info.server_id = config.ServerId;
                info.leader_uid = this.teams[info.team_id].leader_uid;
                info.badge = this.teams[info.team_id].badge || 0;
            }
        }

        return info;
    },

    // 第一村庄的占领信息
    getVillageOwnerInfo1st: function(team_id) {
        let info = {
            team_id: team_id || 0,
        };

        if (info.team_id > 0 && this.teams[info.team_id] && this.village1st[info.team_id]) {
            // 队伍名字
            info.team_name = this.teams[info.team_id].name;
            info.server_id = config.ServerId;
            info.leader_uid = this.teams[info.team_id].leader_uid;
            info.badge = this.teams[info.team_id].badge || 0;
        }

        return info;
    },

    // 获取指定村庄简要信息
    getVillageSimpleInfo: function (village_id) {
        var info = {};

        if (this.villages[village_id]) {
            info = clone(this.villages[village_id]);
            info.remain_res = Math.floor(info.remain_res);

            if (info.team_id > 0) {
                var teamData = gClan.getTeamData(info.team_id);
                if (teamData) {
                    // 队伍名字
                    info.team_name = teamData.name;
                    info.server_id = config.ServerId;
                    info.badge = teamData.use_badge;
                    info.leader_uid = teamData.uid;
                    // 队长名字
                    var leader = gUserInfo.getUser(teamData.uid);
                    if (leader) {
                        info.leader_name = leader.info.un
                        info.hid = leader.info.model;
                        info.sky_suit = leader.sky_suit;
                        info.custom_king = leader.custom_king;
                    }

                    // 队伍战斗力
                    var teamFightForce = 0;
                    var memberList = teamData.member_list;
                    for (var k in memberList) {
                        var memberUid = parseInt(k);
                        var memberUser = gUserInfo.getUser(memberUid);
                        if (memberUser) {
                            teamFightForce += memberUser.fight_force;
                        }
                    }
                    info.fight_force = teamFightForce;
                } else {
                    DEBUG('can not find team, team id = ' + info.team_id);
                }
            }
        }

        return info;
    },

    // 获取指定村庄简要信息 第一村庄
    getVillageSimpleInfo1st: function(team_id = 0) {
        var info;

        let vdata = this.village1st[team_id];
        if (vdata) {
            info = clone(vdata);
        } else {
            info = {
                team_id    :  0,
                time       :  0,
                remain_res :  gConfTeamLand[1].resourceReserve[0][2],
                calc_time  :  0,
            }
        }

        if (info.team_id > 0) {
            var teamData = gClan.getTeamData(info.team_id);
            if (teamData) {
                // 队伍名字
                info.team_name = teamData.name;
                info.server_id = config.ServerId;
                info.badge = teamData.use_badge;
                info.leader_uid = teamData.uid;
                // 队长名字
                var leader = gUserInfo.getUser(teamData.uid);
                if (leader) {
                    info.leader_name = leader.info.un
                    info.hid = leader.info.model;
                    info.sky_suit = leader.sky_suit;
                    info.custom_king = leader.custom_king;
                }

                // 队伍战斗力
                var teamFightForce = 0;
                var memberList = teamData.member_list;
                for (var k in memberList) {
                    var memberUid = parseInt(k);
                    var memberUser = gUserInfo.getUser(memberUid);
                    if (memberUser) {
                        teamFightForce += memberUser.fight_force;
                    }
                }
                info.fight_force = teamFightForce;
            }
        }

        return info;
    },

    // 获取村庄详细信息
    getVillageDetailInfo: function (village_id) {
        var info = {};

        if (this.villages[village_id]) {
            // 每次获取都计算下奖励
            var awardArr = {};
            this.calcVillageAward(village_id, awardArr);

            info = clone(this.villages[village_id]);
            info.remain_res = Math.floor(info.remain_res);

            if (info.team_id > 0 && this.teams[info.team_id]) {
                var teamData = gClan.getTeamData(info.team_id);
                if (teamData) {
                    // 队伍名字
                    info.team_name = teamData.name;
                    info.server_id = config.ServerId;
                    info.badge = teamData.use_badge;

                    info.flowers = this.teams[info.team_id].flowers;
                    info.eggs = this.teams[info.team_id].eggs;
                    info.leader_uid = teamData.uid;

                    // 队长名字
                    var leader = gUserInfo.getUser(info.leader_uid);
                    if (leader) {
                        info.leader_name = leader.info.un
                        info.hid = leader.info.model;
                        info.sky_suit = leader.sky_suit;
                        info.custom_king = leader.custom_king;
                    }

                    // buff
                    info.buff_list = this.teams[info.team_id].buff_list;

                    // 队伍战斗力
                    var teamFightForce = 0;

                    info.member_list = {};
                    var memberList = teamData.member_list;
                    for (var k in memberList) {
                        var memberUid = parseInt(k);
                        var memberUser = gUserInfo.getUser(memberUid);

                        if (!this.teams[info.team_id].member_list[memberUid]) {
                            continue;
                        }

                        if (memberUser) {
                            teamFightForce += memberUser.fight_force;

                            var member = {};
                            member.uid = k;
                            member.un = memberUser.info.un;
                            member.vip = memberUser.status.vip;
                            member.headpic = memberUser.info.headpic;
                            member.headframe = memberUser.info.headframe;
                            member.custom_king = memberUser.custom_king;
                            member.village_open = memberUser.custom_village ? (memberUser.custom_village.indexOf(village_id) >= 0) : false;
                            member.fight_force = memberUser.fight_force;
                            member.start_time = this.teams[info.team_id].member_list[memberUid].start_time || 0;
                            member.storage = Math.floor(this.teams[info.team_id].member_list[memberUid].storage || 0);

                            info.member_list[memberUid] = member;
                        }
                    }
                    this.teams[info.team_id].fight_force = teamFightForce;
                    info.fight_force = teamFightForce;
                } else {
                    DEBUG('can not find team, team id = ' + info.team_id);
                }
            }
        }

        return info;
    },

    // 获取村庄详细信息 第一村庄
    getVillageDetailInfo1st: function (team_id) {
        let village_id = 1;

        let info = {
            team_id    :  0,
            time       :  0,
            remain_res :  gConfTeamLand[1].resourceReserve[0][2],
            calc_time  :  0,
        };

        let vdata = this.village1st[team_id];
        if (vdata) {

            // 每次获取都计算下奖励
            var awardArr = {};
            this.calcVillageAward1st(team_id, awardArr);

            info = clone(vdata);
            info.remain_res = Math.floor(info.remain_res);

            if (info.team_id > 0 && this.teams[info.team_id]) {
                var teamData = gClan.getTeamData(info.team_id);
                if (teamData) {
                    // 队伍名字
                    info.team_name = teamData.name;
                    info.server_id = config.ServerId;
                    info.badge = teamData.use_badge;

                    info.flowers = this.teams[info.team_id].flowers;
                    info.eggs = this.teams[info.team_id].eggs;
                    info.leader_uid = teamData.uid;

                    // 队长名字
                    var leader = gUserInfo.getUser(info.leader_uid);
                    if (leader) {
                        info.leader_name = leader.info.un
                        info.hid = leader.info.model;
                        info.sky_suit = leader.sky_suit;
                        info.custom_king = leader.custom_king;
                    }

                    // buff
                    info.buff_list = this.teams[info.team_id].buff_list;

                    // 队伍战斗力
                    var teamFightForce = 0;

                    info.member_list = {};
                    var memberList = teamData.member_list;
                    for (var k in memberList) {
                        var memberUid = parseInt(k);
                        var memberUser = gUserInfo.getUser(memberUid);

                        if (!this.teams[info.team_id].member_list[memberUid]) {
                            continue;
                        }

                        if (memberUser) {
                            teamFightForce += memberUser.fight_force;

                            var member = {};
                            member.uid = k;
                            member.un = memberUser.info.un;
                            member.vip = memberUser.status.vip;
                            member.headpic = memberUser.info.headpic;
                            member.headframe = memberUser.info.headframe;
                            member.custom_king = memberUser.custom_king;
                            member.village_open = memberUser.custom_village ? (memberUser.custom_village.indexOf(village_id) >= 0) : false;
                            member.fight_force = memberUser.fight_force;
                            member.start_time = this.teams[info.team_id].member_list[memberUid].start_time || 0;
                            member.storage = Math.floor(this.teams[info.team_id].member_list[memberUid].storage || 0);

                            info.member_list[memberUid] = member;
                        }
                    }
                    this.teams[info.team_id].fight_force = teamFightForce;
                    info.fight_force = teamFightForce;
                } else {
                    DEBUG('can not find team, team id 2 = ' + info.team_id);
                }
            }
        }

        return info;
    },

    // 获取村庄剩余奖励
    getVillageRemainRes: function (village_id) {
        if (village_id == 1) {
            return 0;
        }

        if (this.villages[village_id]) {
            return this.villages[village_id].remain_res;
        }

        return 0;
    },

    // 获取地块信息
    getLandInfo: function (village_id, land_id, recalc_award) {
        var info = {};
        if (this.lands[village_id] && this.lands[village_id][land_id]) {
            if (recalc_award) {
                this.calcLandAwards(village_id, land_id);
            }

            info = clone(this.lands[village_id][land_id]);
            info.village_id = village_id;
            info.land_id = land_id;

            var owner = this.lands[village_id][land_id].owner;
            info.owner = owner;
            if (owner > 0) {
                //var holdTime = this.dailyLandHoldTime[owner] || 0;      // 今日已占用时间
                //var notUseTime = this.notUseTime[owner] || 0;   // 昨日未用时间
                var endTime = this.lands[village_id][land_id].time + gConfGlobalNew.territoryWarPersonalMaxHour * 3600;// + notUseTime - holdTime;
                info.end_time = endTime; // 结束时间

                var ownerUser = gUserInfo.getUser(owner);
                if (owner) {
                    info.name = ownerUser.info.un;
                    info.fight_force = ownerUser.fight_force;
                    info.server_id = config.ServerId;
                }
            }
        }

        return info;
    },

    // 根据uid获取荒地信息，没有找到就返回null
    getBarrenLandByUid: function (uid) {
        var info = null;
        if (this.barren_land[uid]) {
            DEBUG('111111111111')
            this.calcBarrenLandAwards(uid);
            info = clone(this.barren_land[uid]);
            if (Object.keys(info).length == 0) {
                DEBUG('232222222')
                return null;
            }

            var user = gUserInfo.getUser(uid);
            if (user) {
                info.owner = uid;
                info.name = user.info.un;
                info.fight_force = user.fight_force;
                info.server_id = config.ServerId;

                //var holdTime = this.dailyLandHoldTime[uid] || 0;      // 今日已占用时间
                //var notUseTime = this.notUseTime[uid] || 0;   // 昨日未用时间
                var endTime = this.barren_land[uid].time + gConfGlobalNew.territoryWarPersonalMaxHour * 3600;// + notUseTime - holdTime;
                info.end_time = endTime; // 结束时间
            }
            info.village_id = 1;
        }

        return info;
    },

    // 获取地块的占领者
    getLandOwner: function (village_id, land_id, uid) {
        var owner = 0;

        if (land_id > DEFAULT_BARREN_LAND_BEGIN_ID) {
            if (uid && this.barren_land[uid].land_id == land_id) {
                owner = uid;
            }
        } else {
            if (this.lands[village_id] && this.lands[village_id][land_id]) {
                owner = this.lands[village_id][land_id].owner;
            }
        }

        return owner;
    },

    // 根据队伍id获取所占领的村庄id
    getVillageByTeam: function (team_id) {
        if (this.teamMapToVillage[team_id]) {
            return this.teamMapToVillage[team_id];
        }

        return 0;
    },

    // 根据玩家id查找所占领的地块
    getLandByUid: function (uid) {
        for (var k in this.lands) {
            for (var id in this.lands[k]) {
                if (this.lands[k][id].owner == uid) {
                    return [parseInt(k), parseInt(id)];
                }
            }
        }

        // 查找荒地
        if (this.barren_land[uid]) {
            return [1, this.barren_land[uid].land_id];
        }

        return [0, 0];
    },

    // 结算地块奖励
    calcLandAwards: function (village_id, land_id) {
        var timeOver = false;   // 占领时间是否耗完

        var lastCalcTime = this.lands[village_id][land_id].calc_time;
        var owner = this.lands[village_id][land_id].owner;
        var landConf = gConfPersonalLand[village_id][land_id];
        var curTime = common.getTime();
        var diffTime = curTime - lastCalcTime;

        // 检查是否超过每日可占领时长了
        var endTime = this.lands[village_id][land_id].time + gConfGlobalNew.territoryWarPersonalMaxHour * 3600;
        if (curTime > endTime) {
            diffTime = endTime - lastCalcTime;
            timeOver = true;
        }

        if (!timeOver && diffTime < gConfGlobalNew.territoryWarPersonalInterval * 60) {
            return false;
        }

        var dropCount = Math.floor(diffTime / (gConfGlobalNew.territoryWarPersonalInterval * 60));

        if (dropCount > 0) {
            var awards = [];
            var user = gUserInfo.getUser(owner);
            if (user) {
                for (var i = 0; i < dropCount; i++) {
                    var dropAward = generateDrop(landConf.lootId, user.status.level);
                    awards = awards.concat(dropAward);
                }

                if (this.isLandAwardDouble()) {
                    awards = timeAwards(awards, 2);
                }
            }

            this.lands[village_id][land_id].awards = this.lands[village_id][land_id].awards.concat(awards);
            this.lands[village_id][land_id].awards = reformAwards(this.lands[village_id][land_id].awards);

            var passTime = dropCount * gConfGlobalNew.territoryWarPersonalInterval * 60;
            this.lands[village_id][land_id].calc_time = this.lands[village_id][land_id].calc_time + passTime;
            this.markDirty(util.format('lands.%d.%d', village_id, land_id));

            // if (!this.dailyLandHoldTime[owner]) {
            //     this.dailyLandHoldTime[owner] = 0;
            // }
            //
            // this.dailyLandHoldTime[owner] += passTime;  // 更新今日已占领时间
            // this.markDirty(util.format('dailyLandHoldTime.%d', owner));
        }

        return timeOver;
    },

    // 结算荒地奖励
    calcBarrenLandAwards: function (uid) {
        var timeOver = false;

        var lastCalcTime = this.barren_land[uid].calc_time;
        var barrenLandId = this.barren_land[uid].land_id % 100;
        var landConf = gConfBarrenLand[barrenLandId];
        var curTime = common.getTime();
        var diffTime = curTime - lastCalcTime;

        // 检查是否超过每日可占领时长了
        //var holdTime = this.dailyLandHoldTime[uid] || 0;      // 今日已占用时间
        //var notUseTime = this.notUseTime[uid] || 0;   // 昨日未用时间
        var endTime = this.barren_land[uid].time + gConfGlobalNew.territoryWarPersonalMaxHour * 3600;// + notUseTime - holdTime;
        if (curTime > endTime) {
            diffTime = endTime - lastCalcTime;
            timeOver = true;
        }

        var dropCount = Math.floor(diffTime / (gConfGlobalNew.territoryWarPersonalInterval * 60));
        if (dropCount > 0) {
            var awards = [];
            var user = gUserInfo.getUser(uid);
            if (user) {
                for (var i = 0; i < dropCount; i++) {
                    var dropAward = generateDrop(landConf.lootId, user.status.level);
                    awards = awards.concat(dropAward);
                }

                if (this.isLandAwardDouble()) {
                    awards = timeAwards(awards, 2);
                }
            }

            var passTime = dropCount * gConfGlobalNew.territoryWarPersonalInterval * 60;
            this.barren_land[uid].awards = this.barren_land[uid].awards.concat(awards);
            this.barren_land[uid].awards = reformAwards(this.barren_land[uid].awards);

            this.barren_land[uid].calc_time = this.barren_land[uid].calc_time + passTime;
            this.markDirty(util.format('barren_land.%d', uid));

            // this.dailyLandHoldTime[uid] += passTime;  // 更新今日已占领时间
            // this.markDirty(util.format('dailyLandHoldTime.%d', uid));
        }

        return timeOver;
    },

    // 占领地块
    occupyLand: function (uid, village_id, land_id) {
        if (!this.lands[village_id]) {
            this.lands[village_id] = {};
            this.markDirty(util.format('lands.%d', village_id));
        }

        if (!this.lands[village_id][land_id]) {
            this.lands[village_id][land_id] = {}
        }

        var oldOwner = this.lands[village_id][land_id].owner;
        if (oldOwner > 0) {
            var user = gUserInfo.getUser(uid);
            if (user) {
                // 之前有占领者，那就需要结算奖励，并发邮件
                this.calcLandAwards(village_id, land_id);
                var awards = this.lands[village_id][land_id].awards;
                var time = common.getTime();
                var occupyTime = time - this.lands[village_id][land_id].time;
                var mail = {
                    awards: awards,
                    time: time,
                    expire: time + gConfMail[41].time * OneDayTime,
                    content: [41, village_id, land_id, user.info.un, occupyTime],
                    attach: {

                    },
                }

                gMail.add(oldOwner, mail);
            }

            // 清空该玩家昨日剩余占领时间
            if (this.notUseTime[oldOwner] > 0) {
                this.notUseTime[oldOwner] = 0;
                this.markDirty(util.format('notUseTime.%d', oldOwner));
            }
        }

        var newOwner = gUserInfo.getUser(uid);
        if (newOwner) {
            this.lands[village_id][land_id].owner = uid;
            this.lands[village_id][land_id].time = common.getTime();
            this.lands[village_id][land_id].calc_time = common.getTime();
            this.lands[village_id][land_id].awards = [];
            this.markDirty(util.format('lands.%d.%d', village_id, land_id));
        }
    },

    // 占领荒地
    occupyBarrenLand: function (uid, land_id) {
        this.barren_land[uid] = {};
        this.barren_land[uid].time = common.getTime();
        this.barren_land[uid].calc_time = common.getTime();
        this.barren_land[uid].awards = [];
        this.barren_land[uid].land_id = land_id;
        this.markDirty(util.format('barren_land.%d', uid));
    },

    // 撤离地块
    leaveLand: function (uid, village_id, land_id) {
        var oldOwner = this.lands[village_id][land_id].owner;
        if (oldOwner != uid) {
            return [];
        }

        // 结算奖励，并发邮件
        this.calcLandAwards(village_id, land_id);
        var awards = this.lands[village_id][land_id].awards;

        this.lands[village_id][land_id] = {};
        this.markDirty(util.format('lands.%d.%d', village_id, land_id));

        // 清空玩家昨日剩余占领时间
        if (this.notUseTime[oldOwner] > 0) {
            this.notUseTime[oldOwner] = 0;
            this.markDirty(util.format('notUseTime.%d', oldOwner));
        }

        return awards;
    },

    // 撤离荒地
    leaveBarrenLand: function (uid) {
        if (!this.barren_land[uid]) {
            return [];
        }

        this.calcBarrenLandAwards(uid);
        var awards = this.barren_land[uid].awards;

        delete this.barren_land[uid];
        this.markDelete(util.format('barren_land.%d', uid))

        // 清空玩家昨日剩余占领时间
        if (this.notUseTime[uid] > 0) {
            this.notUseTime[uid] = 0;
            this.markDirty(util.format('notUseTime.%d', uid));
        }

        return awards;
    },

    // 获取地块战报
    getLandReports: function (uid) {
        var reports = [];
        var user = gUserInfo.getUser(uid);
        if (!user) {
            return reports;
        }

        for (var k in this.land_reports) {
            var villageId = parseInt(k);
            if (this.land_reports[villageId]) {
                var userReportList = this.land_reports[villageId][uid];
                if (userReportList && userReportList.length > 0) {
                    for (var i = 0; i < userReportList.length; i++) {
                        var report = {};
                        report.time = userReportList[i][0];
                        report.winner = userReportList[i][2];
                        report.village_id = villageId;
                        report.land_id = userReportList[i][3];
                        report.replaykey = userReportList[i][4];
                        report.attacker_uid = userReportList[i][5];

                        report.user_1 = {};
                        report.user_1.uid = uid;
                        report.user_1.name = user.info.un;
                        report.user_1.level = user.status.level;
                        report.user_1.vip = user.status.vip;
                        report.user_1.custom_king = user.custom_king;
                        report.user_1.headpic = user.info.headpic;
                        report.user_1.headframe = user.info.headframe;
                        report.user_1.fight_force = user.fight_force;

                        report.user_2 = {};
                        var user2 = gUserInfo.getUser(userReportList[i][1]);
                        if (user2) {
                            report.user_2.uid = userReportList[i][1];
                            report.user_2.name = user2.info.un;
                            report.user_2.level = user2.status.level;
                            report.user_2.vip = user2.status.vip;
                            report.user_2.custom_king = user2.custom_king;
                            report.user_2.headpic = user2.info.headpic;
                            report.user_2.headframe = user2.info.headframe;
                            report.user_2.fight_force = user2.fight_force;
                        }

                        reports.push(report);
                    }
                }
            }
        }

        return reports;
    },

    // 根据村庄id获取地块战报列表
    getLandReportsByVillage: function (village_id) {
        var reports = [];

        if (this.land_reports[village_id]) {
            var villageReportList = this.land_reports[village_id];
            for (var uid in villageReportList) {
                var userReportList = villageReportList[uid];
                if (userReportList && userReportList.length > 0) {
                    for (var i = 0; i < userReportList.length; i++) {
                        var report = {};
                        report.time = userReportList[i][0];
                        report.winner = userReportList[i][2];
                        report.village_id = village_id;
                        report.land_id = userReportList[i][3];
                        report.replaykey = userReportList[i][4];
                        report.attacker_uid = userReportList[i][5];

                        report.user_1 = {};
                        var user1 = gUserInfo.getUser(uid);
                        if (user1) {
                            report.user_1.uid = uid;
                            report.user_1.name = user.info.un;
                            report.user_1.level = user.status.level;
                            report.user_1.vip = user.status.vip;
                            report.user_1.custom_king = user.custom_king;
                            report.user_1.headpic = user.info.headpic;
                            report.user_1.headframe = user.info.headframe;
                            report.user_1.fight_force = user.fight_force;
                        }

                        report.user_2 = {};
                        var user2 = gUserInfo.getUser(userReportList[i][1]);
                        if (user2) {
                            report.user_2.uid = userReportList[i][1];
                            report.user_2.name = user2.info.un;
                            report.user_2.level = user2.status.level;
                            report.user_2.vip = user2.status.vip;
                            report.user_2.custom_king = user2.custom_king;
                            report.user_2.headpic = user2.info.headpic;
                            report.user_2.headframe = user2.info.headframe;
                            report.user_2.fight_force = user2.fight_force;
                        }

                        reports.push(report);
                    }
                }
            }
        }

        return reports;
    },

    // 结算村庄奖励
    calcVillageAward: function (village_id, awards_arr, force) {
        var resEmpty = false;   // 资源是否采光

        if (village_id == 0) {
            return false;
        }

        if (!this.villages[village_id]) {
            return false;
        }

        var holdTeam = this.villages[village_id].team_id;
        if (holdTeam == 0) {
            return false;
        }

        var teamData = this.teams[holdTeam];
        if (!teamData) {
            return false;
        }

        var lastCalcTime = this.villages[village_id].calc_time;
        var villageConf = gConfTeamLand[village_id];
        var curTime = common.getTime();
        var diffTime = curTime - lastCalcTime;
        if (diffTime < gConfGlobalNew.territoryWarTeamInterval * 60 && !force) {
            return false;
        }

        // 小队当前产出速度
        var teamSpeed = 0;
        for (var k in teamData.member_list) {
            var memberUid = parseInt(k);
            var memberUser = gUserInfo.getUser(memberUid);
            if (memberUser.custom_village.indexOf(village_id) >= 0) {
                if (memberUid == teamData.leader_uid) {
                    teamSpeed += villageConf.captain;
                } else {
                    teamSpeed += villageConf.member;
                }
            }
        }

        // 计算按照队伍目前的产出速度，剩余的资源量可以产出多久
        var remainTime = this.villages[village_id].remain_res * 3600 / teamSpeed;
        if (remainTime > diffTime) {
            remainTime = diffTime;
        } else {
            resEmpty = true;
        }

        if (awards_arr) {
            var totalOutput = 0;
            for (var k in teamData.member_list) {
                var memberUid = parseInt(k);
                var memberUser = gUserInfo.getUser(memberUid);
                if (memberUser.custom_village.indexOf(village_id) >= 0) {
                    var output = 0;
                    if (memberUid == teamData.leader_uid) {
                        output = remainTime * villageConf.captain / 3600;
                    } else {
                        output = remainTime * villageConf.member / 3600;
                    }

                    var storage = teamData.member_list[memberUid].storage || 0;
                    awards_arr[memberUid] = output + storage;
                    teamData.member_list[memberUid].storage = awards_arr[memberUid];
                    this.markDirty(util.format('teams.%d', holdTeam));

                    totalOutput += output;
                } else {
                    awards_arr[memberUid] = 0;
                }
            }

            this.villages[village_id].remain_res -= totalOutput;
            if (this.villages[village_id].remain_res < 0) {
                this.villages[village_id].remain_res = 0;
            }

            if (resEmpty) {
                this.villages[village_id].remain_res = 0;
            }

            this.villages[village_id].calc_time = common.getTime();
            this.markDirty(util.format('villages.%d', village_id));
        }

        return resEmpty;
    },

    // 结算村庄奖励 第一村庄
    calcVillageAward1st: function (team_id, awards_arr, force) {
        var resEmpty = false;   // 资源是否采光

        let village_id = 1;

        let vdata = this.village1st[team_id];
        if(!vdata){
            return false;
        }

        var teamData = this.teams[team_id];
        if(!teamData){
            return false;
        }

        var lastCalcTime = vdata.calc_time;
        var villageConf = gConfTeamLand[village_id];
        var curTime = common.getTime();
        var diffTime = curTime - lastCalcTime;
        if (diffTime < gConfGlobalNew.territoryWarTeamInterval * 60 && !force) {
            return false;
        }

        // 小队当前产出速度
        var teamSpeed = 0;
        for (var k in teamData.member_list) {
            var memberUid = parseInt(k);
            var memberUser = gUserInfo.getUser(memberUid);
            if (memberUser.custom_village.indexOf(village_id) >= 0) {
                if (memberUid == teamData.leader_uid) {
                    teamSpeed += villageConf.captain;
                } else {
                    teamSpeed += villageConf.member;
                }
            }
        }

        // 计算按照队伍目前的产出速度，剩余的资源量可以产出多久
        var remainTime = vdata.remain_res * 3600 / teamSpeed;
        if (remainTime > diffTime) {
            remainTime = diffTime;
        } else {
            resEmpty = true;
        }

        if (awards_arr) {
            var totalOutput = 0;
            for (var k in teamData.member_list) {
                var memberUid = parseInt(k);
                var memberUser = gUserInfo.getUser(memberUid);
                if (memberUser.custom_village.indexOf(village_id) >= 0) {
                    var output = 0;
                    if (memberUid == teamData.leader_uid) {
                        output = remainTime * villageConf.captain / 3600;
                    } else {
                        output = remainTime * villageConf.member / 3600;
                    }

                    var storage = teamData.member_list[memberUid].storage || 0;
                    awards_arr[memberUid] = output + storage;
                    teamData.member_list[memberUid].storage = awards_arr[memberUid];
                    this.markDirty(util.format('teams.%d', team_id));

                    totalOutput += output;
                } else {
                    awards_arr[memberUid] = 0;
                }
            }

            vdata.remain_res -= totalOutput;
            if (vdata.remain_res < 0) {
                vdata.remain_res = 0;
            }

            if (resEmpty) {
                vdata.remain_res = 0;
            }

            vdata.calc_time = common.getTime();
            this.markDirty(util.format('village1st.%d', team_id));
        }

        return resEmpty;
    },

    // 占领村庄
    occupyVillage: function (uid, team_data, village_id) {
        var oldTeam = 0;
        if (this.villages[village_id] && this.villages[village_id].team_id > 0) {
            oldTeam = this.villages[village_id].team_id;
        }

        var remainRes = this.villages[village_id].remain_res;
        if (oldTeam > 0) {
            var arrAwards = {};
            this.calcVillageAward(village_id, arrAwards, true);
            remainRes = this.villages[village_id].remain_res;

            // todo : 假如合服后，原来所在的服务器被删掉了，通知不到原来的服务器了，但是新的服务器id没同步过来
            // 给旧的小队发奖励邮件
            var teamInfo = gClan.getTeamData(oldTeam);
            // 这里只能是本服的小队本服的小队
            for (var k in teamInfo.member_list) {
                var memberUid = parseInt(k);
                if (arrAwards[memberUid] > 0) {
                    var awards = clone(gConfTeamLand[village_id].resourceReserve);
                    awards[0][2] = Math.floor(arrAwards[memberUid]);
                    var time = common.getTime();
                    var mail = {
                        awards: awards,
                        time: time,
                        expire: time + gConfMail[45].time * OneDayTime,
                        content: [45, time, village_id],
                        attach: {

                        },
                    }

                    gMail.add(memberUid, mail);
                }
            }

            this.teams[oldTeam] = {};
            this.markDirty(util.format('teams.%d', oldTeam));

            delete this.teamMapToVillage[oldTeam];
            this.markDelete(util.format('teamMapToVillage.%d', oldTeam));
        }

        var curTime = common.getTime();
        var newTeam = team_data.team_id;
        this.villages[village_id] = {};
        this.villages[village_id].team_id = newTeam;
        this.villages[village_id].time = curTime;
        this.villages[village_id].calc_time = curTime;
        this.villages[village_id].remain_res = remainRes;
        this.markDirty(util.format('villages.%d', village_id));

        this.teams[newTeam] = {};
        this.teams[newTeam].flowers = 0;                // 收到的鲜花数
        this.teams[newTeam].eggs = 0;                   // 收到的鸡蛋数
        this.teams[newTeam].buff_list = {};             // buff列表
        this.teams[newTeam].leader_uid = uid;             // 队长uid
        this.teams[newTeam].badge = team_data.use_badge || 0;                  // 战队徽章
        this.teams[newTeam].server_id = config.ServerId;              // 服务器id
        this.teams[newTeam].member_list = {};

        for (var k in team_data.member_list) {
            var memberUid = parseInt(k);
            this.teams[newTeam].member_list[memberUid] = {};
            var memberUser = gUserInfo.getUser(memberUid);
            if (memberUser && memberUser.custom_village && memberUser.custom_village.indexOf(village_id) >= 0) {
                this.teams[newTeam].member_list[memberUid].start_time = curTime;
            } else {
                this.teams[newTeam].member_list[memberUid].start_time = 0;
            }

            this.teams[newTeam].member_list[memberUid].storage = 0;
        }

        this.markDirty(util.format('teams.%d', newTeam));

        this.teamMapToVillage[newTeam] = village_id;
        this.markDirty(util.format('teamMapToVillage.%d', newTeam));
    },

    // 占领村庄 第一村庄
    occupyVillage1st: function (uid, team_data, team_id) {
        let village_id = 1;        
        var curTime = common.getTime();

        this.village1st[team_id] = {
            team_id     : team_id,
            time        : curTime,
            calc_time   : curTime,
            remain_res  : gConfTeamLand[village_id].resourceReserve[0][2],
        }

        this.markDirty(`village1st.${team_id}`);

        this.teams[team_id] = {};
        this.teams[team_id].flowers = 0;                // 收到的鲜花数
        this.teams[team_id].eggs = 0;                   // 收到的鸡蛋数
        this.teams[team_id].buff_list = {};             // buff列表
        this.teams[team_id].leader_uid = uid;             // 队长uid
        this.teams[team_id].badge = team_data.use_badge || 0;                  // 战队徽章
        this.teams[team_id].server_id = config.ServerId;              // 服务器id
        this.teams[team_id].member_list = {};

        for (var k in team_data.member_list) {
            var memberUid = parseInt(k);
            this.teams[team_id].member_list[memberUid] = {};
            var memberUser = gUserInfo.getUser(memberUid);
            if (memberUser && memberUser.custom_village && memberUser.custom_village.indexOf(village_id) >= 0) {
                this.teams[team_id].member_list[memberUid].start_time = curTime;
            } else {
                this.teams[team_id].member_list[memberUid].start_time = 0;
            }

            this.teams[team_id].member_list[memberUid].storage = 0;
        }

        this.markDirty(util.format('teams.%d', team_id));

        this.teamMapToVillage[team_id] = village_id;
        this.markDirty(util.format('teamMapToVillage.%d', team_id));
    },

    // 撤离村庄，放弃领主
    leaveVillage: function (uid, village_id, team_id) {
        if (this.villages[village_id] && this.villages[village_id].team_id) {
            var oldTeam = this.villages[village_id].team_id;
            var teamData = gClan.getTeamData(oldTeam);

            if (!teamData) {
                DEBUG(`leaveVillage  NO team ${uid}, ${village_id}, ${team_id}`)
                return ErrorCode.ERROR_NO_TEAM
            }

            if (team_id) {
                // 如果是解散队伍，就会传队伍id
            } else if (teamData.uid != uid) {
                return ErrorCode.ERROR_NOT_VILLAGE_OWNER;
            }

            // 结算奖励
            var awardArr = {};
            this.calcVillageAward(village_id, awardArr, true);


            // 给队伍成员发奖励邮件
            var time = common.getTime();
            var contentArr = [44, time, village_id];
            if (team_id) {
                var leaderUser = gUserInfo.getUser(teamData.uid);
                contentArr = [46, leaderUser.info.un, teamData.name];
            }
            for (var k in teamData.member_list) {
                var memberUid = parseInt(k);
                if (awardArr[memberUid] > 0) {
                    var awards = clone(gConfTeamLand[village_id].resourceReserve);
                    awards[0][2] = Math.floor(awardArr[memberUid]);

                    var mail = {
                        awards: awards,
                        time: time,
                        expire: time + gConfMail[44].time * OneDayTime,
                        content: contentArr,
                        attach: {

                        },
                    }

                    gMail.add(memberUid, mail);
                }
            }

            // 清理记录
            this.villages[village_id].team_id = 0;
            this.villages[village_id].time = 0;
            this.markDirty(util.format('villages.%d', village_id));

            delete this.teamMapToVillage[oldTeam];
            this.markDelete(util.format('teamMapToVillage.%d', oldTeam));

            return 0;
        }

        return ErrorCode.ERROR_NOT_VILLAGE_OWNER;
    },

    // 队伍解散、撤离村庄 第一村庄
    // uid == 0 解散队伍
    leaveVillage1st: function (uid, team_id) {
        let village_id = 1;
        var teamData = gClan.getTeamData(team_id);

        if (!teamData) {
            DEBUG(`leaveVillage1st  NO team ${uid}, ${team_id}`);
            return [ErrorCode.ERROR_NO_TEAM, 'no team'];
        }

        // 结算奖励
        var awardArr = {};
        this.calcVillageAward1st(team_id, awardArr, true);

        // 给队伍成员发奖励邮件
        var time = common.getTime();
        var contentArr = [44, time, village_id];
        if (uid == 0) {
            var leaderUser = gUserInfo.getUser(teamData.uid);
            contentArr = [46, leaderUser.info.un, teamData.name];
        }

        for (var k in teamData.member_list) {
            var memberUid = parseInt(k);
            if (awardArr[memberUid] > 0) {
                var awards = clone(gConfTeamLand[village_id].resourceReserve);
                awards[0][2] = Math.floor(awardArr[memberUid]);

                var mail = {
                    awards: awards,
                    time: time,
                    expire: time + gConfMail[44].time * OneDayTime,
                    content: contentArr,
                    attach: {},
                }

                gMail.add(memberUid, mail);
            }
        }

        // 清理记录
        delete this.village1st[team_id];
        this.markDelete(util.format('village1st.%d', team_id));

        delete this.teamMapToVillage[team_id];
        this.markDelete(util.format('teamMapToVillage.%d', team_id));

        return [0, ''];
    },


    // 队伍解散回调
    onTeamDismiss: function (team_id) {
        var village_id = this.getVillageByTeam(team_id);
        if (!village_id) {
            return;
        }

        this.leaveVillage(0, village_id, team_id);
        this.leaveVillage1st(0, team_id);
    },

    // 新成员加入
    onTeamMemberJoin: function (team_id, member_uid) {
        if (!this.teams[team_id]) {
            return;
        }

        var teamData = this.teams[team_id];
        if (!teamData.member_list) {
            DEBUG('onTeamMemberJoin teamData.member_list is null');
            DEBUG(teamData);
            return;
        }
        if (teamData.member_list[member_uid]) {
            // 已经存在
            return;
        }

        var villageId = this.getVillageByTeam(team_id);
        if (!villageId) {
            return;
        }

        teamData.member_list[member_uid] = {};
        teamData.member_list[member_uid].start_time = common.getTime();
        teamData.member_list[member_uid].storage = 0;
        this.markDirty(util.format('teams.%d.member_list.%d', team_id, member_uid));

        var awardsArr = {};
        this.calcVillageAward(villageId, awardsArr, true);

        var awardsArr = {};
        this.calcVillageAward1st(team_id, awardsArr, true);
    },

    // 有队员离开
    onTeamMemberLeave: function (team_id, member_uid) {
        if (!this.teams[team_id]) {
            return;
        }

        var teamData = this.teams[team_id];
        if (!teamData.member_list) {
            DEBUG('world landgrabber onTeamMemberLeave, member list is null, team id is ' + team_id);
            DEBUG(teamData);
            return;
        }

        if (!teamData.member_list[member_uid]) {
            // 不存在
            return;
        }

        var villageId = this.getVillageByTeam(team_id);
        if (!villageId) {
            return;
        }

        // 第一村庄的处理
        var awardsArr = {};
        if (this.calcVillageAward1st(team_id, awardsArr, true) && awardsArr[member_uid] > 0) {
            var awards = clone(gConfTeamLand[1].resourceReserve);
            awards[0][2] = Math.floor(awardsArr[member_uid]);
            var time = common.getTime();
            var mail = {
                awards: awards,
                time: time,
                expire: time + gConfMail[42].time * OneDayTime,
                content: [42, 1],
                attach: {},
            }
            gMail.add(member_uid, mail);
        }

        // 结算个人的奖励
        var awardsArr = {};
        this.calcVillageAward(villageId, awardsArr, true);
        if (awardsArr[member_uid] > 0) {
            var awards = clone(gConfTeamLand[villageId].resourceReserve);
            awards[0][2] = Math.floor(awardsArr[member_uid]);
            var time = common.getTime();
            var mail = {
                awards: awards,
                time: time,
                expire: time + gConfMail[42].time * OneDayTime,
                content: [42, villageId],
                attach: {

                },
            }

            gMail.add(member_uid, mail);
        }

        delete teamData.member_list[member_uid];
        this.markDirty(util.format('teams.%d', team_id));
    },

    // 队员开启村庄系统
    onTeamMemberReleaseVillage: function (team_id, member_id, village_id) {
        if (!this.teams[team_id]) {
            return;
        }

        var occupyVillageId = this.getVillageByTeam(team_id);
        if (occupyVillageId != village_id) {
            return;
        }

        var teamData = this.teams[team_id];
        teamData.member_list[member_id].start_time = common.getTime();
        this.markDirty(util.format('teams.%d', team_id));

        var awardsArr = {};
        this.calcVillageAward(village_id, awardsArr, true);

        // 第一村庄
        var awardsArr = {};
        this.calcVillageAward1st(team_id, awardsArr, true);
    },

    // 队伍队长变更
    onTeamLeaderChange: function (team_id, new_leader) {
        var teamData = this.teams[team_id];
        if (!teamData) {
            return;
        }

        var village_id = this.getVillageByTeam(team_id);
        if (!village_id) {
            return;
        }

        var awardsArr = {};
        this.calcVillageAward(village_id, awardsArr, true);

        // 第一村庄
        var awardsArr = {};
        this.calcVillageAward1st(team_id, awardsArr, true);

        teamData.leader_uid = new_leader;
        this.markDirty(util.format('teams.%d', team_id));
    },

    getLandDailyHoldTime: function (uid) {
        return this.dailyLandHoldTime[uid] || gConfGlobalNew.territoryWarPersonalMaxHour * 3600;
    },

    getLandDailyRemainTime: function (uid) {
        //var notUseTime = this.notUseTime[uid] || 0;   // 昨日未用时间
        //var holdTime = this.dailyLandHoldTime[uid] || 0;
        var remainTime = gConfGlobalNew.territoryWarPersonalMaxHour * 3600;
        return remainTime;
    },

    addFlowers: function (village_id) {

    },

    addEggs: function (village_id) {

    },

}

exports.get = function (req, res, resp) {
    do {
        // 只提取本服服的几个村庄信息
        if (!resp.data.villages) {
            resp.data.villages = {};
        }

        // 本服的村庄
        for (var k in gConfTeamLand) {
            if (k == 1) {
                // 第一村庄
                resp.data.villages[k] = gLandGrabber.getVillageOwnerInfo1st(gClan.getTeamIdByUid(req.uid));
                continue;
            }
            if (!isCrossVillage(k)) {
                resp.data.villages[k] = gLandGrabber.getVillageOwnerInfo(k);
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取村庄列表
exports.village_get_list = function (req, res, resp) {
    do {
        // 向跨服服务器请求数据
        var crossReq = {
            uid: req.uid,
            mod: 'landgrabber',
            act: 'village_get_list',
            args: req.args,
        };

        var crossResp = {
            code: 0,
            data: {},
            desc: '',
        };

        requestLandGrabber(crossReq, crossResp, function () {
            if (!resp.data.villages) {
                resp.data.villages = {};
            }

            // 本服的村庄
            for (var k in gConfTeamLand) {
                if (k == 1) {
                    resp.data.villages[k] = gLandGrabber.getVillageSimpleInfo1st(gClan.getTeamIdByUid(req.uid));
                    continue;
                }

                if (!isCrossVillage(k)) {
                    resp.data.villages[k] = gLandGrabber.getVillageSimpleInfo(k);
                }
            }

            // 跨服的村庄
            for (var k in crossResp.data.villages) {
                resp.data.villages[k] = crossResp.data.villages[k];
            }

            onReqHandled(res, resp, 1);
        });
        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取村庄信息
exports.village_get_info = function (req, res, resp) {
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'village id need'; break;
        }

        if (isCrossVillage(village_id)) {
            resp.code = 1; resp.desc = 'this is local world server'; break;
        }

        if (village_id == 1) {
            resp.data.village_info = gLandGrabber.getVillageDetailInfo1st(gClan.getTeamIdByUid(req.uid));
        } else {
            resp.data.village_info = gLandGrabber.getVillageDetailInfo(village_id);
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 前往抢夺
exports.village_occupy = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var teamData = gClan.getTeamMsg(uid);
        if (!teamData) {
            resp.code = ErrorCode.ERROR_NO_TEAM; resp.desc = 'no team'; break;
        }

        if (teamData.uid != uid) {
            resp.code = 1; resp.desc = 'not leader'; break;
        }

        // 第一村庄
        if (village_id == 1) {
            let team_id = gClan.getTeamIdByUid(uid);

            // 自己是否已经占领
            if (gLandGrabber.village1st[team_id]) {
                resp.code = 2; resp.desc = 'occupy yet'; break;
            }

            // 无人占领 好像捡到宝了
            gLandGrabber.occupyVillage1st(uid, teamData, team_id);
            resp.data.village_info = gLandGrabber.getVillageDetailInfo1st(team_id);

            break;
        }

        // 检查是否已经有队伍占领了
        var ownerInfo = gLandGrabber.getVillageOwnerInfo(village_id);
        if (!ownerInfo.team_id) {
            // 无人占领
            gLandGrabber.occupyVillage(uid, teamData, village_id);
            resp.data.village_info = gLandGrabber.getVillageDetailInfo(village_id);
        } else {
            // 检查是否在保护时间内
            var villageInfo = gLandGrabber.getVillageSimpleInfo(village_id);
            if (common.getTime() < villageInfo.time + gConfGlobalNew.territoryWarTeamDefendTime * 60) {
                resp.data.village_info = gLandGrabber.getVillageDetailInfo(village_id);
                resp.code = ErrorCode.ERROR_IN_PROTECT_TIME; resp.desc = 'protect time'; break;
            } else {
                // 有人占领，返回双方的战斗信息
                var infoArr = {};
                for (var k in teamData.member_list) {
                    infoArr[+k] = gUserInfo.getUserFightInfo(+k, true);
                }

                var enemyTeamData = gClan.getTeamData(ownerInfo.team_id);
                if (enemyTeamData) {
                    var enemyArr = {};
                    for (var k in enemyTeamData.member_list) {
                        enemyArr[+k] = gUserInfo.getUserFightInfo(+k);
                    }
                } else {
                    DEBUG('can not find team, id = ' + ownerInfo.team_id);
                }

                var replay = {
                    info: {
                        team_id: teamData.team_id,
                        team_name: teamData.name,
                        badge: teamData.use_badge,
                        members: infoArr,
                    },
                    enemy: {
                        team_id: enemyTeamData ? enemyTeamData.team_id : ownerInfo.team_id,
                        team_name: enemyTeamData ? enemyTeamData.name : '',
                        badge: enemyTeamData ? enemyTeamData.use_badge : 0,
                        members: enemyArr,
                    },
                    rand1: common.randRange(0, 99999),
                    rand2: common.randRange(0, 99999),
                }

                resp.data = replay;
                resp.data.enemy_id = ownerInfo.team_id;
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.village_fight = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var teamData = gClan.getTeamMsg(uid);
        if (!teamData) {
            resp.code = ErrorCode.ERROR_NO_TEAM; resp.desc = 'no team'; break;
        }

        if (teamData.uid != uid) {
            resp.code = 1; resp.desc = 'not leader'; break;
        }

        if (village_id == 1) {
            resp.code = 1; resp.desc = 'cannot fight yourself'; break;
        }

        var ownerInfo = gLandGrabber.getVillageOwnerInfo(village_id);
        var enemyTeamData = gClan.getTeamData(ownerInfo.team_id);
        if (!enemyTeamData) {
            resp.code = 1; resp.desc = 'not enemy team'; break;
        }

        var star = req.args.star;
        if (star == undefined) {
            resp.code = 1; resp.desc = 'star error'; break;
        }

        var battle_results = req.args.battle_results;

        var win_team = 2;
        if (star > 0) {
            win_team = 1;

            // 胜利，占领
            gLandGrabber.occupyVillage(uid, teamData, village_id);
            resp.data.village_info = gLandGrabber.getVillageDetailInfo(village_id);
        }

        var awardArr = {};
        gLandGrabber.calcVillageAward(village_id, awardArr);
        var remainRes = gLandGrabber.getVillageRemainRes(village_id);

        // todo 添加战报
        gLandGrabber.addVillageReport(village_id, teamData, enemyTeamData, win_team, req.args.replay, battle_results, remainRes);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 放弃领主
exports.village_leave = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (village_id == 1) {
            // 没有保护时间
            let team_id = gClan.getTeamIdByUid(req.uid);
            if (!team_id || !gLandGrabber.village1st[team_id]) {
                resp.code = 2; resp.desc = 'no team'; break;
            }

            let teamData = gClan.getTeamData(team_id);
            if (req.uid != teamData.uid) {
                resp.code = 2; resp.desc = 'not leader'; break;
                return;
            }

            let ret = gLandGrabber.leaveVillage1st(uid, team_id);

            resp.code = ret[0];
            resp.desc = ret[1];

            resp.data.village_info = gLandGrabber.getVillageDetailInfo1st(team_id);

            break;
        }

        // 检查是否在保护时间内
        var villageInfo = gLandGrabber.getVillageSimpleInfo(village_id);
        if (common.getTime() < villageInfo.time + gConfGlobalNew.territoryWarTeamDefendTime * 60) {
            resp.code = ErrorCode.ERROR_IN_PROTECT_TIME; resp.desc = 'protect time'; break;
        }

        resp.code = gLandGrabber.leaveVillage(uid, village_id);
        resp.data.village_info = gLandGrabber.getVillageDetailInfo(village_id);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取自身的地块占领信息
exports.land_get_info = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;

        if (land_id > DEFAULT_BARREN_LAND_BEGIN_ID) {
            // 占领的是荒地
            resp.data.land_info = gLandGrabber.getBarrenLandByUid(uid);
            if (!resp.data.land_info) {
                DEBUG("----------------zcg:debug")
                DEBUG(`${uid} ${village_id}  ${land_id}`)
            }
        } else {
            resp.data.land_info = gLandGrabber.getLandInfo(village_id, land_id, true);
        }

        resp.data.remain_time = gLandGrabber.getLandDailyRemainTime(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 请求指定村庄的地块列表
exports.land_get_list = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'village id need'; break;
        }

        if (isCrossVillage(village_id)) {
            resp.code = 1; resp.desc = 'this is local world server'; break;
        }

        if (!gConfPersonalLand[village_id]) {
            resp.code = 1; resp.desc = 'village not found'; break;
        }

        if (!resp.data.land_list) {
            resp.data.land_list = {};
        }

        for (var k in gConfPersonalLand[village_id]) {
            resp.data.land_list[k] = gLandGrabber.getLandInfo(village_id, k);
        }

        // 检查是否有占领荒地
        resp.data.barrend_land = gLandGrabber.getBarrenLandByUid(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 占领地块
exports.land_occupy = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        if (!village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var barrenLand = gLandGrabber.getBarrenLandByUid(uid);
        if (barrenLand) {
            resp.code = ErrorCode.ERROR_HAS_OCCUPY_LAND; resp.desc = 'you has occupy one land'; break;
        }

        var occupyLand = gLandGrabber.getLandByUid(uid);

        DEBUG('本服 <<<< occupyLand[0] = ' + occupyLand[0] + ' , occupyLand[1] = ' + occupyLand[1]);

        if (occupyLand[0] > 0 && occupyLand[1] > 0) {
            resp.code = ErrorCode.ERROR_HAS_OCCUPY_LAND; resp.desc = 'you has occupy one land'; break;
        }

        // 检查今日占领剩余时间
        var remainTime = gLandGrabber.getLandDailyRemainTime(uid);
        if (remainTime <= 0) {
            resp.code = ErrorCode.ERROR_LAND_REMAIN_TIME_ZERO; resp.desc = 'you has occupy one land'; break;
        }

        if (land_id > DEFAULT_BARREN_LAND_BEGIN_ID) {
            // 要占领的是荒地
            gLandGrabber.occupyBarrenLand(uid, land_id);
            resp.data.land_info = gLandGrabber.getBarrenLandByUid(uid);
        } else {
            var landOwner = gLandGrabber.getLandOwner(village_id, land_id);
            if (!landOwner || landOwner == 0) {
                // 无人占领，直接占领
                gLandGrabber.occupyLand(uid, village_id, land_id);
                resp.data.land_info = gLandGrabber.getLandInfo(village_id, land_id);
            } else {
                // 检查是否在保护时间内，如果是，直接返回地块信息
                var landInfo = gLandGrabber.getLandInfo(village_id, land_id);
                if (common.getTime() < landInfo.time + gConfGlobalNew.territoryWarPersonalDefendTime * 60) {
                    resp.data.land_info = gLandGrabber.getLandInfo(village_id, land_id);
                    resp.code = ErrorCode.ERROR_IN_PROTECT_TIME;
                } else {
                    // 需要战斗
                    var replay = {
                        info: gUserInfo.getUserFightInfo(uid, true),
                        enemy: gUserInfo.getUserFightInfo(landOwner),
                        rand1: common.randRange(0, 99999),
                        rand2: common.randRange(0, 99999),
                    }

                    resp.data.battle_info = replay;
                    resp.data.battle_info.enemy_id = landOwner;
                }
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.land_fight = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        var enemyId = +req.args.enemy;
        var star = req.args.star;
        if (!enemyId || !village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var winUid = 2;
        if (star > 0) {
            winUid = 1;

            // 占领地块，结算奖励
            gLandGrabber.occupyLand(uid, village_id, land_id);
            resp.data.land_info = gLandGrabber.getLandInfo(village_id, land_id);
        }

        // 添加战报
        gLandGrabber.addLandReport(uid, enemyId, req.args.replay, winUid, village_id, land_id);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 地块撤离
exports.land_leave = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        if (!village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var owner = gLandGrabber.getLandOwner(village_id, land_id, uid);
        if (owner != uid) {
            resp.code = 1; resp.desc = 'not owner'; break;
        }

        if (land_id > DEFAULT_BARREN_LAND_BEGIN_ID) {
            resp.data.awards = gLandGrabber.leaveBarrenLand(uid);
        } else {
            resp.data.awards = gLandGrabber.leaveLand(uid, village_id, land_id);
        }

        resp.data.remain_time = gLandGrabber.getLandDailyRemainTime(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 小队解散
exports.village_team_dismiss = function (req, res, resp) {
    var uid = req.uid;
    do {
        var team_id = req.args.team_id;
        if (!team_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        gLandGrabber.onTeamDismiss(team_id);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 成员加入
exports.village_member_join = function (req, res, resp) {
    do {
        var teamId = +req.args.team_id;
        var memberId = +req.args.member_id;
        if (!teamId || !memberId) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        gLandGrabber.onTeamMemberJoin(teamId, memberId);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 成员离开
exports.village_member_leave = function (req, res, resp) {
    do {
        var teamId = +req.args.team_id;
        var memberId = +req.args.member_id;
        if (!teamId || !memberId) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        gLandGrabber.onTeamMemberLeave(teamId, memberId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 成员村庄开启
exports.village_member_open = function (req, res, resp) {
    do {
        var teamId = +req.args.team_id;
        var memberId = +req.args.member_id;
        var villageId = +req.args.village_id;
        if (!teamId || !memberId || !villageId) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        gLandGrabber.onTeamMemberReleaseVillage(teamId, memberId, villageId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取村庄的战报列表
exports.village_get_report_list_by_village = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }
        var serverId = req.args.serverId;
        resp.data.report_list = gLandGrabber.getVillageReportByVillageId(village_id,serverId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 根据队伍id获取战报
exports.village_get_report_list_by_team = function (req, res, resp) {
    var uid = req.uid;
    do {
        var team_id = req.args.team_id;
        if (!team_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }
        var serverId = req.args.serverId;
        // 先请求跨服的战报
        function callback(resp) {
            if (resp.code == 0) {
                if (!resp.data.report_list) {
                    resp.data.report_list = [];
                }

                var reports = gLandGrabber.getVillageReportByTeamId(team_id,serverId);
                if (reports) {
                    resp.data.report_list = resp.data.report_list.concat(reports);
                }
            }
            onReqHandled(res, resp, 1);
        }

        // 先请求跨服战报
        requestLandGrabber(req, resp, function () {
            callback(resp);
        });

        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取指定战斗的战斗列表
exports.get_battle_reports = function (req, res, resp) {
    var uid = req.uid;
    do {
        var keyStr = req.args.key;
        if (!keyStr) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        resp.data.report_list = gLandGrabber.getVillageReportDetail(keyStr);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取玩家地块战报列表
exports.get_reports = function (req, res, resp) {
    var uid = req.uid;
    do {
        function callback(resp) {
            if (resp.code == 0) {
                if (!resp.data.reports) {
                    resp.data.reports = [];
                }

                var reports = gLandGrabber.getLandReports(uid);
                if (reports) {
                    resp.data.reports = resp.data.reports.concat(reports);
                }
            }
            onReqHandled(res, resp, 1);
        }

        // 先请求跨服战报
        requestLandGrabber(req, resp, function () {
            callback(resp);
        });

        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 根据村庄获取地块战报列表
exports.get_reports_by_village = function (req, res, resp) {
    var uid = req.uid;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(resp) {
            if (resp.code == 0) {
                if (!resp.data.reports) {
                    resp.data.reports = [];
                }

                var reports = gLandGrabber.getLandReportsByVillage(village_id);
                if (reports) {
                    resp.data.reports = resp.data.reports.concat(reports);
                }
            }
            onReqHandled(res, resp, 1);
        }

        // 先请求跨服战报
        requestLandGrabber(req, resp, function () {
            callback(resp);
        });

        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取战报信息
exports.get_replay = function (req, res, resp) {
    gReplay.getReplay(req.args.id, function (replay) {
        if (replay) {
            resp.data = replay;
        } else {
            resp.code = 1; resp.desc = 'no such replay';
        }
        onReqHandled(res, resp, 1);
    });
};

// 送花
exports.send_flower = function (req, res, resp) {
    do {
        var villageId = req.args.village_id;
        if (!villageId) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 砸鸡蛋
exports.send_egg = function (req, res, resp) {
    do {
        var villageId = req.args.village_id;
        if (!villageId) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.LandGrabber = LandGrabber;