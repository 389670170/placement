var LegionWarCom = require('../common/legionwar.js');
var StageType = require('../legionwar/error.js').StageType;
var ErrorCode = require('../legionwar/error.js').ErrorCode;

function LegionWar() {
    this.stage = 0;                         // 当前阶段
    this.roundBegin = 0;                    // 本轮战斗开始时间
    this.stageEnd = 0;                      // 阶段结束时间

    this.persist = {
        'legion': {/*
            lid: {
                joinNum: 0,                     // 参战场次
                winNum: 0,                      // 胜利场次
                score: 0,                       // 军团战积分
                level: 0,                       // 当前段位
                lastRound: {                    // 上轮数据
                    rank: 0,                    // 上次排名
                    score: 0,                   // 上次积分
                },
            },
        */},

        'user': {/*
            uid: {
                fightNum: 0,                    // 挑战次数
                fightNumAwardMark: {},          // 挑战次数领奖标志
            },
        */},

        'ranklist': {/*
            rank: [],
            legions: {},
        */},
    };

    this.runtime = {
        'legion': {/*
            lid: {
                cards: {},                      // 妙计卡
            },
        */},

        'user': {/*
            uid: {
                card_use: {cardId : num},       // 使用过的卡牌卡牌， id：数量
                cardEffects : [],               // 当前玩家拥有的卡牌效果
                attackNum: +gConfLegion.legionWarAttackNum,// 攻击次数
                cityAwardMark: {},              // 城池奖励标记，是否已经领取城池奖励
            },
        */},

        'joined': {/*
            lid: 1,                             // 记录参加军团战的军团
        */},
    };

    this.ranks = {};                            // 段位人数

    this.dirty = {};
}

LegionWar.create = function(callback){
    var legionWarData = {
        '_id'       : 'legionwar',
        'stage'     : 0,
        'roundBegin': 0,
        'stageEnd'  : 0,
        'persist'   : { 'legion': {}, 'user': {}, 'ranklist': {} },
        'runtime'   : { 'legion': {}, 'user': {}, 'joined': {} },
        'ranks'     : {},
    };

    gDBWorld.insert(legionWarData, function(err, result) {
        callback && callback();
    });
};

LegionWar.prototype = {
    init: function (callback) {
        gDBWorld.find({'_id': 'legionwar'}).limit(1).next(function (err, doc) {
            if (doc) {
                this.stage = doc.stage;
                this.roundBegin = doc.roundBegin;
                this.stageEnd = doc.stageEnd;
                this.persist = doc.persist;
                this.runtime = doc.runtime;
                this.ranks = doc.ranks;

                if (!this.runtime.user) {
                    this.runtime.user = {};
                    this.markDirty('runtime.user');
                }

                // 本阶段结束时间。已超时, 重新计算阶段结束时间
                if (common.getTime() > this.stageEnd) {
                    this.stageEnd = LegionWarCom.genStageEndTime(this.stage);
                    this.markDirty('stageEnd');
                }

                // 本轮军团战开始时间
                this.roundBegin = LegionWarCom.genStageBeginTime(StageType.PREPARE, true);
                this.markDirty('roundBegin');

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
                ERROR('INVALID SAVE LEGIONWAR: ' + item);
            }
        }

        this.dirty = {};
        gDBWorld.update({_id: 'legionwar'}, {$set: updates}, function (err, result) {
            if (err) {
                ERROR({updates: updates, err: err});
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    markDirty: function(name, force, callback) {
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

    update: function() {
        var stageInfo = LegionWarCom.getSchedule();
        if (this.stage != stageInfo.type) {
            this.stage = stageInfo.type;
            this.markDirty('stage');

            this.stageEnd = LegionWarCom.genStageEndTime(this.stage);
            this.markDirty('stageEnd');

            this.roundBegin = LegionWarCom.genStageBeginTime(StageType.PREPARE, true);;
            this.markDirty('roundBegin');
        }
    },

    getLegionPersist: function (lid) {
        if (!this.persist.legion.hasOwnProperty(lid)) {
            // 创建新的军团持久数据
            this.persist.legion[lid] = {
                joinNum: 0,
                winNum: 0,
                score: 0,
                level: 0,

                lastRound: {
                    rank: 0,
                    score: 0,
                },
            };
            this.markDirty('persist.legion.' + lid);
        }
        return this.persist.legion[lid];
    },

    getLegionRuntime: function(lid) {
        if (!this.runtime.legion.hasOwnProperty(lid)) {
            // 创建新的军团运行时数据
            this.runtime.legion[lid] = {
                cards: {},
            };
            this.markDirty('runtime.legion.' + lid);
        }
        return this.runtime.legion[lid];
    },

    getRankListPersist: function() {
        var doSave = false;
        if (!this.persist.ranklist.hasOwnProperty('rank')) {
            this.persist.ranklist.rank = [];
            doSave = true;
        }
        if (!this.persist.ranklist.hasOwnProperty('legions')) {
            this.persist.ranklist.legions = {};
            doSave = true;
        }
        if (doSave) {
            this.markDirty('persist.ranklist');
        }
        return this.persist.ranklist;
    },

    getUserPersist: function(uid) {
        if (!this.persist.user.hasOwnProperty(uid)) {
            // 创建新的玩家持久数据
            this.persist.user[uid] = {
                fightNum: 0,
                fightNumAwardMark: {},
            };
            this.markDirty('persist.user.' + uid);
        }
        return this.persist.user[uid];
    },

    getUserRuntime: function(uid) {
        if (!this.runtime.user.hasOwnProperty(uid)) {
            // 创建新的玩家运行时数据
            this.runtime.user[uid] = {
                card_use : {},
                cardEffects: [],
                attackNum: +gConfLegion.legionWarAttackNum,
                cityAwardMark: {},
            };
            this.markDirty('runtime.user.' + uid);
        }
        return this.runtime.user[uid];
    },

    // 清理上一次的数据
    cleanRuntimeData : function (cb) {
        var _me = this;

        async.series([function (cb2) {// 清除军团运行时数据
            DEBUG('clear runtime legion');
            _me.runtime.legion = {};
            _me.markDirty('runtime.legion', true, function () {
                cb2();
            });
        }, function (cb2) { // 清除玩家运行时数据
            DEBUG('clear runtime user');
            _me.runtime.user = {};
            _me.markDirty('runtime.user', true, function () {
                cb2();
            });
        }], function (err) {
            cb(err);
        });
    },

    // 获取符合条件的军团列表
    getMatchConditionLegions : function () {
        DEBUG('getMatchConditionLegions===========');
        // 最小参战等级
        var minJoinLevel = +gConfGlobalNew.legionWarMinJoinLevel;
        // 最少参战人数
        var minJoinMembers = +gConfGlobalNew.legionWarMinJoinMembers;
        //服务器开发天数
        var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
        // 准备注册数据
        var legionList = [];
        gNewLegion.enumationLegions(function(legion){
            // 过滤不能参战的军团
            if (legion.level < minJoinLevel || Object.keys(legion.member_list).length < minJoinMembers || passedDay < gConfGlobalNew.legionWarJoinDay) {
                return;
            }

            var legionFightForce = 0;
            var members = {};
            for (var uid in legion.member_list) {
                var userFightInfo = gUserInfo.getUserFightInfo(+uid);
                var userInfo = gUserInfo.getUser(+uid);
                if(!userInfo.pos[1]){
                    continue;
                }

                var heroCombatConf = getHeroCombatConf(userInfo.pos[1].rid);
                members[uid] = {
                    uid: uid,
                    un: userInfo.info.un,
                    headpic: userInfo.info.headpic,
                    headframe : userInfo.info.headframe,
                    level: userInfo.status.level,
                    vip: userInfo.status.vip,
                    fight_force: userInfo.fight_force,
                    fight_info: userFightInfo,
                    model: userInfo.info.model,
                    quality: heroCombatConf.quality,
                    promote: userInfo.info.promote,
                    weapon_illusion: userInfo.sky_suit.weapon_illusion,
                    wing_illusion: userInfo.sky_suit.wing_illusion,
                    mount_illusion: userInfo.sky_suit.mount_illusion,
                    custom_king: userInfo.custom_king,
                };
                legionFightForce += userInfo.fight_force;
            }

            var legionPersist = this.getLegionPersist(legion.lid);
            var legionRegData = {
                sid: config.ServerId,
                lid: legion.lid,
                name: legion.name,
                icon: legion.icon,
                level: legion.level,
                score: legionPersist.score || 0,
                members: members,
                win_num: legionPersist.winNum,
                join_num: legionPersist.joinNum,
                fight_force: legionFightForce,
            };
            legionList.push(legionRegData);

            this.runtime.joined[legion.lid] = 1;
        }.bind(this));

        this.markDirty('runtime.joined');

        this.roundBegin = LegionWarCom.genStageBeginTime(StageType.PREPARE, true);
        this.markDirty('roundBegin');

        DEBUG(legionList);
        return legionList;
    },

    registerServer: function(callback) {
        // 最小参战等级
        var minJoinLevel = +gConfGlobalNew.legionWarMinJoinLevel;
        // 最少参战人数
        var minJoinMembers = +gConfGlobalNew.legionWarMinJoinMembers;
        //服务器开发天数
        var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
        // 准备注册数据
        var regLegions = [];
        gNewLegion.enumationLegions(function(legion){
            // 过滤不能参战的军团
            if (legion.level < minJoinLevel || legion.member_count < minJoinMembers || passedDay < gConfGlobalNew.legionWarJoinDay) {
                return;
            }

            var legionFightForce = 0;
            var members = {};
            for (var uid in legion.member_list) {
                var userFightInfo = gUserInfo.getUserFightInfo(+uid);
                var userInfo = gUserInfo.getUser(+uid);
                if(!userInfo.pos[1]){
                    continue;
                }
                var heroCombatConf = getHeroCombatConf(userInfo.pos[1].rid);
                members[uid] = {
                    uid: uid,
                    un: userInfo.info.un,
                    headpic: userInfo.info.headpic,
                    headframe : userInfo.info.headframe,
                    level: userInfo.status.level,
                    vip: userInfo.status.vip,
                    fight_force: userInfo.fight_force,
                    fight_info: userFightInfo,
                    model: userInfo.info.model,
                    quality: heroCombatConf.quality,
                    promote: userInfo.info.promote,
                    weapon_illusion: userInfo.sky_suit.weapon_illusion,
                    wing_illusion: userInfo.sky_suit.wing_illusion,
                };
                legionFightForce += userInfo.fight_force;
            }

            var legionPersist = this.getLegionPersist(legion.lid);
            var legionRegData = {
                sid: config.ServerId,
                lid: legion.lid,
                name: legion.name,
                icon: legion.icon,
                level: legion.level,
                score: legionPersist.score || 0,
                members: members,
                win_num: legionPersisit.winNum,
                join_num: legionPersisit.joinNum,
                fight_force: legionFightForce,
            };
            regLegions.push(legionRegData);

            this.runtime.joined[legion.lid] = 1;
        }.bind(this));
        this.markDirty('runtime.joined');

        if (regLegions.length > 0) {
            // 向军团战服务器注册
            sysCallCloudApi('register_server', {
                sid: config.ServerId,
                legions: regLegions
            }, function(resp) {
                callback(resp.code == 0);
            }.bind(this));
        } else {
            callback(true);
        }
    },

    isLegionJoinWar: function(lid) {
        return this.runtime.joined.hasOwnProperty(lid);
    },

    queryAndHandleRoundResult: function(callback) {
        var _me = this;
        var lids = Object.keys(this.runtime.joined); // 参加了本轮的军团编号

        //ERROR('=====FISH====queryAndHandleRoundResult');

        // 向云服查询数据
        sysCallCloudApi('get_round_result', {
            lids: lids,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                // 排行榜数据
                var ranklist = _me.getRankListPersist();
                var oldRank = clone(ranklist.rank);
                var rankLegions = ranklist.legions;
                var newRank = [];

                async.each(wResp.data, function(legionResult, ecb) {
                    _me.handleLegionResult(legionResult, oldRank, rankLegions, newRank, function(err) {
                        ecb(err);
                    });
                }, function(err){
                    if (!err) {
                        // 保存新段位人数
                        _me.markDirty('ranks');

                        // 保存新排行榜
                        ranklist.rank = newRank;
                        _me.markDirty('persist.ranklist');
                        LOG('LEGION WAR RANKLIST UPADATE');
                    }
                    callback(err);
                });
            }
        });
    },

    handleLegionResult: function(legionResult, oldRank, rankLegions, newRank, callback) {
        var legion = gNewLegion.get(legionResult.lid);
        if (!legion) {
            // 不处理其他服的军团
            return;
        }

        var legionPersisit = this.getLegionPersist(legionResult.lid);

        // 更新数据
        legionPersisit.joinNum += 1;

        // 更新排行榜数据
        if (rankLegions.hasOwnProperty(legionResult.lid)) {
            legionPersisit.lastRound.rank = LegionWarCom.findLegionIndex(oldRank, 'lid', legionResult.lid);
            legionPersisit.lastRound.score = legionPersisit.score;
        }
        rankLegions[legionResult.lid] = legionResult;

        var oldScore2 = legionPersisit.score;

        // 更新段位积分
        if (legionResult.win) {
            legionPersisit.score += +gConfGlobalNew.legionWarWinScore;
            legionPersisit.winNum += 1;
        } else {
            legionPersisit.score = Math.max(0, legionPersisit.score - (+gConfGlobalNew.legionWarLoseScore));
        }

        // 更新各段位人数
        var ranks = this.ranks;
        var oldRank2 = LegionWarCom.getRank(oldScore2);
        var newRank2 = LegionWarCom.getRank(legionPersisit.score);
        LOG(util.format('lid: %d', legionResult.lid));
        LOG(util.format('oldRank2: %d', oldRank2));
        LOG(util.format('newRank2: %d', newRank2));
        if (ranks[oldRank2] && ranks[oldRank2].hasOwnProperty(legionResult.lid)) {
            delete ranks[oldRank2][legionResult.lid];
        }
        ranks[newRank2] = ranks[newRank2] || {};
        ranks[newRank2][legionResult.lid] = 1;

        // 更新排行榜
        var insPos = LegionWarCom.findInsertPos(newRank, 'score', legionPersisit.score, legionResult.lid);
        newRank.splice(insPos, 0, {score: legionPersisit.score, lid: legionResult.lid});

        // 检查是否需要更新段位
        var newLevel = legionPersisit.level;
        var checkLevel = (legionPersisit.level == 0)
            || (legionPersisit.score > gConfLegionWarRank[legionPersisit.level].maxScore);
        if (checkLevel) {
            var nextLevel = legionPersisit.level + 1;
            for (;;) {
                var nextConf = gConfLegionWarRank[nextLevel];
                if (!nextConf) {
                    break;
                }

                newLevel = nextLevel;
                if (legionPersisit.score >= nextConf.minScore && legionPersisit.score <= nextConf.maxScore) {
                    break;
                }

                nextLevel += 1;
            }

            if (newLevel != legionPersisit.level) {
                // 发送段位升级奖励
                // for (var awardLevel = legionPersisit.level + 1; awardLevel <= newLevel; ++awardLevel) {
                //     var awards = gConfLegionWarRank[awardLevel].award;
                //     this.sendLegionResultAward(legionResult.lid, awards, [34, legion.name]);
                // }

                LOG('fish==LEGION ' + legionResult.lid + ' UPGRADE FROM ' + legionPersisit.level + ' TO ' + newLevel);

                // 段位更新
                legionPersisit.level = newLevel;
            }
        }

        this.markDirty('persist.legion.' + legionResult.lid,true);

        // 发送军团战结算奖励
        var rankConf = gConfLegionWarRank[newLevel];
        var awards = rankConf.award;
        if (legionResult.win) {
            awards = awards.concat(rankConf.winAward);
        }
        this.sendLegionResultAward(legionResult.lid, awards, legionResult.win);

        callback();
    },

    sendLegionResultAward: function(lid, awards, win) {
        var legion = gNewLegion.get(lid);
        if (!legion) {
            // 军团已解散或合服删除
            ERROR("no such legion: " + lid);
            return;
        }

        var members = legion.member_list;
        DEBUG("legionwar result award cnt: " + DEBUG(Object.keys(members).length));

        // 给这个军团的成员发送奖励邮件
        var now = common.getTime();
        for (var uid in members) {
            var mail = {
                content : win ? [32] : [33],
                awards : awards,
                time : now,
                expire : now + gConfGlobal.awardMailExpireDay * 3600 * 24,
            };
            gMail.add(+uid, mail);
        }
    },

    getMainPageInfo: function(lid, uid, callback) {
        // 返回当前阶段
        var retObj = { stageEnd: this.stageEnd };

        // 返回该军团是否报名参加了本轮军团战
        var joined = false;
        if (this.runtime.joined.hasOwnProperty(lid)) {
            joined = true;
        }

        retObj.joined = joined;

        var legionData = gNewLegion.get(lid);
        var legionPersist = this.getLegionPersist(lid);

        var _me = this;
        var code = 0;
        var addonInfo = null;

        async.series([function(cb){
            sysCallCloudApi('get_main_page_info', {lid:lid, joined:joined}, function(resp){
                if (resp.code != 0) {
                    code = resp.code;
                    cb(resp.desc);
                } else {
                    code = resp.data.code;
                    addonInfo = resp.data.data;
                    cb(code != 0);
                }
            });
        }], function(err) {
            if (err) {
                var data = {};
                data.stage = _me.stage;
                data.stageEnd = _me.stageEnd;
                if (_me.stage == StageType.PREPARE) {
                    data.stageEnd = LegionWarCom.genStageEndTime(StageType.IDLE, true)
                }
                callback(code, err, data);
            } else {
                retObj.ownLegion = {
                    sid: config.ServerId,
                    lid: lid,
                    name: legionData.name,
                    icon: legionData.icon,
                    level: legionData.level,
                    joinNum: legionPersist.joinNum,
                    winNum: legionPersist.winNum,
                    score: legionPersist.score,
                    memberCount: legionData.member_count,
                };

                if (retObj.joined) {
                    retObj.ownLegion.curScore = addonInfo.curScore;
                    retObj.ownLegion.curRank = addonInfo.curRank;
                    retObj.enemyLegion = addonInfo.enemyLegion;

                    retObj.user = _me.getUserRuntime(uid);
                } else {
                    retObj.ownLegion.curRank = -1;
                    if (_me.stage == StageType.PREPARE) {
                        retObj.stageEnd = LegionWarCom.genStageEndTime(StageType.IDLE, true)
                    }
                }

                retObj.stage = addonInfo.stage;
                // this.stage = addonInfo.stage;
                // this.markDirty('stage');

                // // 已超时, 重新计算阶段结束时间
                // if (common.getTime() > this.stageEnd) {
                //     this.stageEnd = LegionWarCom.genStageEndTime(this.stage);
                //     this.markDirty('stageEnd');

                //     retObj.stageEnd = this.stageEnd;
                // }

                retObj.round = addonInfo.round;
                retObj.newUser = gNewLegion.joinBeforeTime(lid, uid, _me.roundBegin) ? false : true;

                callback(code, null, retObj);
            }
        });
    },

    getBattlePageInfo: function(lid, uid, callback) {
        var info = {};
        var userRuntime = this.getUserRuntime(uid);
        var legionRuntime = this.getLegionRuntime(lid);

        info.user = {
            attackNum: userRuntime.attackNum,
            duty: gNewLegion.getDuty(uid),
            cityAwardMark: userRuntime.cityAwardMark,
        };

        info.legion = {
            cards: legionRuntime.cards,
        };

        var needGarrion = gNewLegion.checkUserPrivilege(uid, 2);

        sysCallCloudApi('get_battle_page_info', {
            uid: uid,
            lid: lid,
            garrison: needGarrion
        }, function(resp){
            if (resp.code != 0) {
                callback(resp.desc);
            } else {
                info.buffing_city = resp.data.buffing_city;
                info.personal_score = resp.data.personal_score;
                info.ownLegion = resp.data.own;
                info.enemyLegion = resp.data.enemy;
                info.cardUse = userRuntime.card_use;
                callback(null, info);
            }
        });
    },

    getCityInfo: function(lid, city, hiddDark, callback) {
        if (!(city >= 1 && city <= 16)) {
            callback('CITY ARG INVALID');
            return;
        }

        sysCallCloudApi('get_city_info', {
            lid: lid,
            city: city,
            hidd_dark: hiddDark
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    // 多个city
    getCityInfoMulti: function(lid, city, hiddDark, callback) {
        sysCallCloudApi('get_city_info_multi', {
            lid: lid,
            city: city,
            hidd_dark: hiddDark,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    // 城池增筑
    upgradeCityBuf: function(lid, uid, city, callback) {
        if (lid != gNewLegion.userLegion[uid]) {
            callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION, "not in legion");
            return;
        }

        if (!this.isLegionJoinWar(lid)) {
            callback('Legion not join war');
            return;
        }

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback('New member can not do this');
            return;
        }

        sysCallCloudApi('upgrade_citybuf', {
            lid: lid,
            city: city,
            uid: uid
        }, function(wResp) {
            if (wResp.code != 0) {
                callback(wResp.code, wResp.desc);
            } else {
                callback(null, {
                    citybuf: wResp.data.citybuf
                });
            }
        });
    },

    cancelCityBuf: function(lid, uid, callback) {
        if (!this.isLegionJoinWar(lid)) {
            callback('Legion not join war');
            return;
        }

        if (lid != gNewLegion.userLegion[uid]) {
            callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION, "not in legion");
            return;
        }

        sysCallCloudApi('cancel_citybuf', {
            lid: lid,
            uid: uid
        }, function(wResp) {
            if (wResp.code != 0) {
                callback(wResp.desc, wResp.code);
            } else {
                callback(null, {
                    citybuf: wResp.data.citybuf
                });
            }
        });
    },

    addCityForce: function(lid, uid, city, arm, arm_uid, callback) {
        if (!gNewLegion.checkUserPrivilege(uid, 2)) {
            callback('No privilege');
            return;
        }

        // if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
        //     callback('New member can not do this');
        //     return;
        // }

        sysCallCloudApi('add_city_force', {
            lid: lid,
            city: city,
            arm: arm,
            arm_uid: arm_uid
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.code, wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    removeCityForce: function(lid, uid, city, arm_uid, callback) {
        if (!gNewLegion.checkUserPrivilege(uid, 2)) {
            callback('No privilege');
            return;
        }

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback('New member can not do this');
            return;
        }

        sysCallCloudApi('remove_city_force', {
            lid: lid,
            city: city,
            arm_uid: arm_uid
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    useCard: function(lid, uid, cardId, target, callback) {
        if (lid != gNewLegion.userLegion[uid]) {
            callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION, "not in legion");
            return;
        }

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback(ErrorCode.ERROR_NEW_MEMBER_CAN_NOT_USE, 'New member can not do this');
            return;
        }

        var cardConf = gConfLegionWarCityCard[cardId];
        if (cardConf['useTime'] != this.stage) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT, 'Stage not fit');
            return;
        }

        // 检查使用上限
        var userRuntime = this.getUserRuntime(uid);
        var usedCount = userRuntime.card_use[cardId] || 0;
        if (cardConf['useNumLimit'] && usedCount >= cardConf['useNumLimit']) {
            callback(ErrorCode.ERROR_CARD_USE_MAX, 'use count limit');
            return;
        }

        if (!userRuntime.card_use[cardId]) {
            userRuntime.card_use[cardId] = 0;
            this.markDirty(util.format('runtime.user.%d.card_use.%d', uid, cardId));
        }

        // 用卡
        if (cardConf['key'] == 'attack') {
            // 增加攻击次数
            userRuntime.attackNum += cardConf['parameter'];
            userRuntime.card_use[cardId] = usedCount + 1;
            this.markDirty('runtime.user.' + uid);

            var data = {};
            data.attack_num = userRuntime.attackNum;
            data.count = userRuntime.card_use[cardId];
            callback(null, data);
        } else {
            var _me = this;
            sysCallCloudApi('use_card', {
                lid: lid,
                card: cardId,
                target: target,
                uid: uid,
            }, function (wResp) {
                if (wResp.code != 0) {
                    callback(wResp.code, wResp.desc);
                } else {
                    // 卡片被使用，更新卡片数据
                    userRuntime.card_use[cardId] = usedCount + 1;
                    _me.markDirty('runtime.user.' + uid);
                    callback(null, wResp.data);
                }
            });
        }
    },

    attackArm: function(lid, uid, city, arm, cardId, callback) {
        var userRuntime = this.getUserRuntime(uid);
        if (userRuntime.attackNum <= 0) {
            callback(ErrorCode.ERROR_ATTACK_NUM_LIMIT, 'No attack num');
            return;
        }

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback('New member can not do this');
            return;
        }

        if (cardId && cardId > 0) {
            // 检查是否有卡牌
            var cardConf = gConfLegionWarCityCard[cardId];
            if (cardConf['useTime'] != this.stage) {
                callback('Stage not fit');
                return;
            }

            // 检查使用上限
            var userRuntime = this.getUserRuntime(uid);
            var usedCount = userRuntime.card_use[cardId] || 0;
            if (cardConf['useNumLimit'] && usedCount >= cardConf['useNumLimit']) {
                callback(ErrorCode.ERROR_CARD_USE_MAX, 'use count limit');
                return;
            }

            if (!userRuntime.card_use[cardId]) {
                userRuntime.card_use[cardId] = 0;
                this.markDirty(util.format('runtime.user.%d.card_use.%d', uid, cardId));
            }
        }

        var _me = this;
        sysCallCloudApi('attack_arm', {
            lid: lid,
            city: city,
            arm: arm,
            uid: uid,
            card : cardId,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.code, wResp.desc);
            } else {
                if (cardId && cardId > 0) {
                    var usedCount = userRuntime.card_use[cardId];
                    userRuntime.card_use[cardId] = usedCount + 1;
                }

                userRuntime.attackNum -= 1;
                _me.markDirty('runtime.user.' + uid);

                // 统计挑战次数
                var userPersist = _me.getUserPersist(uid);
                userPersist.fightNum += 1;
                _me.markDirty('persist.user.' + uid);

                wResp.data.cardEffects = userRuntime.cardEffects;
                callback(null, wResp.data);
            }
        });
    },

    fight: function(lid, uid, city, arm, star, power, callback) {
        var _me = this;

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback('New member can not do this');
            return;
        }

        sysCallCloudApi('fight', {
            lid: lid,
            city: city,
            arm: arm,
            uid: uid,
            star: star,
            power: power,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.code, wResp.desc);
            } else {
                var userRuntime = _me.getUserRuntime(uid);

                // 更新玩家BUF，战斗完后清空buff
                if (userRuntime.cardEffects.length > 0) {
                    userRuntime.cardEffects = [];
                }
                _me.markDirty('runtime.user.' + uid);

                callback(null, wResp.data);
            }
        });
    },

    getUserFightNumInfo: function(lid, uid, callback) {
        var userPersist = this.getUserPersist(uid);
        callback(null, {
            fightNum: userPersist.fightNum,
            fightNumAwardMark: userPersist.fightNumAwardMark,
        });
    },

    getUserFightNumAward: function(lid, uid, atknum, callback) {
        var userPersist = this.getUserPersist(uid);
        if (userPersist.fightNum < atknum) {
            callback('Attack num not fit');
            return;
        }

        if (userPersist.fightNumAwardMark.hasOwnProperty(atknum)) {
            callback('Already got');
            return;
        }

        userPersist.fightNumAwardMark[atknum] = 1;
        this.markDirty('persist.user.' + uid);
        callback(null, {});
    },

    getCityAward: function(lid, uid, city, callback) {
        var userRuntime = this.getUserRuntime(uid);
        if (userRuntime.cityAwardMark.hasOwnProperty(city)) {
            callback('Already got');
            return;
        }

        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback('New member can not do this');
            return;
        }

        var _me = this;
        sysCallCloudApi('get_city_award', {
            lid: lid,
            city: city,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                userRuntime.cityAwardMark[city] = 1;
                _me.markDirty('runtime.user.' + uid);
                callback(null, {});
            }
        });
    },

    getHistory: function(lid, uid, callback) {
        sysCallCloudApi('get_history', {
            lid: lid,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    getServerRankList: function(lid, callback) {
        // 返回的排行榜长度
        var LIST_SIZE = 20;

        // 排行榜数据
        var ranklist = this.getRankListPersist();
        var rankLegions = ranklist.legions;
        var rank = ranklist.rank;

        // 构建返回的排行榜数据
        var rankInfos = [];
        for (var idx = 0; idx < LIST_SIZE; ++idx) {
            if (idx >= rank.length) {
                break;
            }

            var rankInfo = rankLegions[rank[idx].lid];
            rankInfos.push({
                lid: rankInfo.lid,
                level: rankInfo.level,
                name: rankInfo.name,
                icon: rankInfo.icon,
                score: this.getLegionPersist(rankInfo.lid).score,
                rank: LegionWarCom.findLegionIndex(rank, 'lid', rankInfo.lid) + 1,
            });
        }

        // 构建自己军团的数据
        var myRank = -1;
        var myInfo = {};
        if (rankLegions.hasOwnProperty(lid)) {
            myRank = LegionWarCom.findLegionIndex(rank, 'lid', lid) + 1;

            var legionPerisit = this.getLegionPersist(lid);
            var legionInfo = gNewLegion.get(lid);
            myInfo = {
                lid: legionInfo.lid,
                level: legionInfo.level,
                name: legionInfo.name,
                icon: legionInfo.icon,
                rank: myRank,
                score: legionPerisit.score,
                lastRank: legionPerisit.lastRound.rank,
                lastScore: legionPerisit.lastRound.score,
            };
        } else {
            myInfo = {
                curRank: myRank,
            };
        }

        callback(null, {
            self: myInfo,
            rank_list: rankInfos
        });
    },

    getWorldRankList: function(lid, callback) {
        sysCallCloudApi('get_world_ranklist', {
            lid: lid,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                callback(null, wResp.data);
            }
        });
    },

    getRankInfo: function(lid, callback){
        var _me = this;
        sysCallCloudApi('get_rank_info', {
            lid: lid,
        }, function(wResp){
            if (wResp.code != 0) {
                callback(wResp.desc);
            } else {
                var ranks = {};
                for (var id in _me.ranks) {
                    if (!_me.ranks.hasOwnProperty(id)) {
                        continue;
                    }

                    ranks[id] = Object.keys(_me.ranks[id]).length;
                }

                wResp.data.local = ranks;
                callback(null, wResp.data);
            }
        });
    },

    checkTips: function(uid, callback) {
        var userPersist = this.getUserPersist(uid);
        var userRuntime = this.getUserRuntime(uid);
        var lid = gNewLegion.getUserLegionId(uid);

        // 新加入军团的玩家没有tips
        if (!gNewLegion.joinBeforeTime(lid, uid, this.roundBegin)) {
            callback();
            return;
        }

        var fightNum = userPersist.fightNum;
        var fightNumAwardMark = userPersist.fightNumAwardMark;
        for (var fightN = 1; fightN <= fightNum; ++fightN) {
            if (!gConfLegionWarAttackAward[fightN]) {
                continue;
            }

            if (!fightNumAwardMark.hasOwnProperty(fightN)) {
                gTips.addTip(uid, 'legionwar_fightnum');
                break;
            }
        }

        if (this.stage == StageType.PREPARE) {
            if (gNewLegion.checkUserPrivilege(uid, 2)) {
                sysCallCloudApi('check_tips', {
                    lid: lid,
                    uid: uid,
                }, function(wResp){
                    if (wResp.code == 0) {
                        for (var tipName in wResp.data) {
                            gTips.addTip(uid, tipName);
                        }
                    }
                    callback();
                });
            } else {
                callback();
            }
        } else if (this.stage == StageType.FIGHT || this.stage == StageType.IDLE) {
            if (this.stage == StageType.FIGHT) {
                if (userRuntime.attackNum > 0) {
                    gTips.addTip(uid, 'legionwar_attacknum');
                }
            }

            sysCallCloudApi('check_tips', {
                lid: lid,
                uid: uid,
            }, function(wResp){
                if (wResp.code == 0) {
                    var canAwardCity = wResp.data.awardCity;
                    if (canAwardCity) {
                        for (var idx = 0; idx < canAwardCity.length; ++idx) {
                            if (!userRuntime.cityAwardMark.hasOwnProperty(canAwardCity[idx])) {
                                gTips.addTip(uid, 'legionwar_cityaward');
                                break;
                            }
                        }
                    }
                }
                callback();
            });
        } else {
            callback();
        }
    },

    leaveLegion: function (lid, uid) {
        if (this.stage != StageType.PREPARE) {
            return;
        }

        sysCallCloudApi('leave_legion', {
            lid: lid,
            uid: uid,
        });
    },
};

function sysCallCloudApi(name, args, callback) {
    var resp = { code: 0, desc: '', data: null };
    args.stage = gLegionWar.stage;
    requestLegionWar({
        'mod': 'api',
        'act': name,
        'uid': 10000,
        'args': args
    }, resp, function() {
        callback && callback(resp);
    });
}

function callCloudApi(name, req, args, callback) {
    requestLegionWarByModAndAct(req, 'api', name, args, callback);
}

exports.get_main_page_info = function(req, res, resp) {
    var lid = req.args.lid;
    var uid = req.uid;
    gLegionWar.getMainPageInfo(lid, uid, function(code, err, data) {
        resp.code = code;
        if (err) {
            resp.desc = err;
            resp.data = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_battle_page_info = function(req, res, resp) {
    var lid = req.args.lid;
    var uid = req.uid;
    gLegionWar.getBattlePageInfo(lid, uid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_city_info = function(req, res, resp) {
    var lid = +req.args.lid;
    var city = req.args.city;
    var hidd_dark = req.args.hidd_dark;

    gLegionWar.getCityInfoMulti(lid, city, hidd_dark, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.upgrade_citybuf = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    gLegionWar.upgradeCityBuf(lid, req.uid, city, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.cancel_citybuf = function(req, res, resp) {
    var lid = req.args.lid;
    gLegionWar.cancelCityBuf(lid, req.uid, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.add_city_force = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    var arm = req.args.arm;
    var arm_uid = req.args.arm_uid;
    gLegionWar.addCityForce(lid, req.uid, city, arm, arm_uid, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.remove_city_force = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    var arm_uid = req.args.arm_uid;
    gLegionWar.removeCityForce(lid, req.uid, city, arm_uid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// exports.buy_card = function(req, res, resp) {
//     var lid = req.args.lid;
//     var cardId = req.args.card;
//     gLegionWar.buyCard(lid, req.uid, cardId, function(err, data, code){
//         if (err) {
//             resp.code = code || 1;
//             resp.desc = err;
//         } else {
//             resp.data = data;
//         }
//         onReqHandled(res, resp, 1);
//     });
// };

exports.use_card = function(req, res, resp) {
    var lid = req.args.lid;
    var cardId = req.args.card;
    var target = req.args.target;
    gLegionWar.useCard(lid, req.uid, cardId, target, function(err, data) {
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};


exports.attack_arm = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    var arm = req.args.arm;
    var cardId = req.args.card;
    gLegionWar.attackArm(lid, req.uid, city, arm, cardId, function(err, data) {
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.fight = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    var arm = req.args.arm;
    var star = req.args.star;
    var power = req.args.power;
    gLegionWar.fight(lid, req.uid, city, arm, star, power, function(err, data) {
        if (err) {
            resp.code = err;
            resp.desc = data;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_user_fightnum_info = function(req, res, resp) {
    var lid = req.args.lid;
    gLegionWar.getUserFightNumInfo(lid, req.uid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_user_fightnum_award = function(req, res, resp) {
    var lid = req.args.lid;
    var attackCount = req.args.attackCount;
    gLegionWar.getUserFightNumAward(lid, req.uid, attackCount, function(err, data) {
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_city_award = function(req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    gLegionWar.getCityAward(lid, req.uid, city, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_history = function(req, res, resp) {
    var lid = req.args.lid;
    gLegionWar.getHistory(lid, req.uid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_server_ranklist = function(req, res, resp){
    var lid = req.args.lid;
    gLegionWar.getServerRankList(lid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_world_ranklist = function(req, res, resp){
    var lid = req.args.lid;
    gLegionWar.getWorldRankList(lid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_rank_info = function(req, res, resp){
    var lid = req.args.lid;
    gLegionWar.getRankInfo(lid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// 获取符合要求的军团
exports.get_match_condition_legions = function (req, res, resp) {
    gLegionWar.cleanRuntimeData(function () {
        resp.data.legion_list = gLegionWar.getMatchConditionLegions();
        onReqHandled(res, resp, 1);
    });
};

exports.handle_round_result = function (req, res, resp) {
    gLegionWar.queryAndHandleRoundResult(function () {
        ERROR('==============FISH====handle_round_result====legionwar result!!');
    });

    onReqHandled(res, resp, 1);
};

exports.LegionWar = LegionWar;
