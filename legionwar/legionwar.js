var LegionWarCom = require('../common/legionwar.js');
var ErrorCode = require('./error.js').ErrorCode;
var StageType = require('./error.js').StageType;
var Storage = require('./storage.js');
var Robot = require('./robot.js').Robot;

var BATTLE_TIME = 60 + 20;

function LegionWar() {
    this.round = 1;                         // 当前轮
    this.stage = 0;                         // 当前阶段
    this.step = 0;                          // 用于防止阶段切换过程中某些逻辑的重复执行

    this.legion = {                         // 军团数据
    /*
        lid: {
            lid: lid,
            enemy: enmey.lid,               // 敌方军团LID
            garrison: {                      // 驻守数据
                uid: 0,                     // uid: 已驻守次数
            },
            aliveCity: 0,                   // 存活的城池数量
            loseTime: 0,                    // 失败时间
            score: 0,                       // 当前分数
            members: {                      // 成员战斗信息
                uid: {
                    city_buff_speed: 0,     // 城池增筑速度
                }
            },
            cities: {
                cid: {
                    buffLevel: 0,           // 增驻等级
                    buffXp: 0,              // 增驻经验
                    buff_members: [],       // 参与增筑的成员
                    buff_members_time: {},  // 参与增筑成员的计算时间
                    last_buff_calculate_time: 0,        // 上次城池增筑核查时间戳
                    canAttack: (cityIdx == 14 || cityIdx == 15 || cityIdx == 16),
                    aliveArm: 0,            // 存活守城人数量
                    reports: [],            // 战报
                    canJump: false,         // 是否可以使用卡片跳到该城池
                    through: false,         // 是否被强袭
                    arms: {
                        1: {                // 守军
                            type: 0,        // 是否暗格
                            uid:  0,        // 玩家uid
                            alive: true,    // 是否存活
                            power: 0,       // 耐力值
                        }
                    },
                },
            }
        },
    */
    };

    // 注册到本军团战服务器的世界服
    this.servers = {};

    this.battle = {             // 战场数据
    };

    this.ranks = {              // 排名数据
    };

    this.accumulate_award = {               // 军团战累积产出
        /*
         uid: {
            legionwar_score: 0                     // 军团战个人积分
         }
         */
    };

    // 上一次同步军团数据的时间
    this.lastSyncTime = 0;

    this.dirty = {};            // 脏数据

    // 当前阶段的起始时间
    this.roundBeginTime = 0;

    // 调用update的次数，主要是为了方便准备阶段起服
    this.updateCount = 0;
}

LegionWar.create = function(callback) {
    var legionWarData = {
        '_id': 'legionwar',
        'round': 1,
        'stage': 0,
        'step': 0,
        'legion': {},
        'battle': {},
        'ranks': {},
        'accumulate_award': {},
        'servers' : {},
        'lastSyncTime' : 0,
    };

    gDBWorld.insert(legionWarData, function(err, result) {
        callback && callback();
    });
};

LegionWar.prototype = {
    init: function (callback) {
        var _me = this;
        async.series([function (cb) { // 加载机器人
            Storage.loadRobot(function(err){
                cb(err);
            });
        }, function(cb) { // 加载军团战数据
            gDBWorld.find({'_id': 'legionwar'}).limit(1).next(function (err, doc) {
                if (doc) {
                    _me.round = doc.round;
                    _me.stage = doc.stage;
                    _me.step = doc.step;
                    _me.legion = doc.legion;
                    _me.battle = doc.battle;
                    _me.ranks = doc.ranks;
                    _me.accumulate_award = doc.accumulate_award;
                    _me.servers = doc.servers;
                    _me.lastSyncTime = doc.lastSyncTime;

                    _me.roundBeginTime = LegionWarCom.genStageBeginTime(StageType.PREPARE);
                    _me.updateCount = 0;

                    _me.updateBattle();

                    cb();
                } else {
                    cb('Load failed');
                }
            });
        }], function(err){
            callback && callback((err) ? false : true);
        });
    },

    setLastSyncTime : function (time) {
        this.lastSyncTime = time;
        this.markDirty('lastSyncTime');
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

    // 获取服务器信息
    getServerInfo : function (sid) {
        if (this.servers[sid]) {
            return this.servers[sid];
        }

        return null;
    },

    // 广播到指定服务器
    broadcastToWorld : function (serverId, req, resp, callback) {
        var serverInfo = this.getServerInfo(serverId);
        if (serverInfo) {
            requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, resp, callback);
        }
    },

    // 广播到所有服务器
    broadcastToAllWorld : function (req, resp, callback, callback2) {
        var respCount = Object.keys(this.servers).length;
        function onResp() {
            respCount -= 1;
            if (respCount <= 0) {
                callback2 && callback2();
            }
        }

        for (var sid in this.servers) {
            this.broadcastToWorld(sid, req, resp, function () {
                callback();
                onResp();
            });
        }
    },

    update: function() {
        this.updateCount++;
        if (this.updateCount > 2) {
            // 阶段检查已经切换
            var stageInfo = LegionWarCom.getSchedule();
            this.switchStage(stageInfo.type, stageInfo.id);

            if (stageInfo.type == StageType.PREPARE) {
                this.roundBeginTime = stageInfo.stageBegin;
            }

            if (this.updateCount > 3) {
                if (this.stage == StageType.PREPARE && this.lastSyncTime < this.roundBeginTime) {
                    // 重新拉取军团数据
                    this.reEnterPrepareStage();
                }
            }
        }
    },

    // 检查战斗超时
    updateBattle: function() {
        var timeouts = [];

        for (var key in this.battle) {
            if (!this.battle.hasOwnProperty(key)) {
                continue;
            }

            if (this.battle[key]) {
                if ((Date.getStamp() - this.battle[key].time) >= BATTLE_TIME) {
                    // 该战斗超时
                    timeouts.push(key);
                }
            } else {
                // 无效数据
                timeouts.push(key);
            }
        }

        var _me = this;
        timeouts.forEach(function(key){
            delete _me.battle[key];
        });

        if (timeouts.length) {
            _me.markDirty('battle');
        }
    },

    // 重新进入准备阶段
    // 要求重新拉取军团数据的时候，本服必须处于开启状态
    reEnterPrepareStage: function (cb) {
        DEBUG('reEnterPrepareStage ===================');
        // 切入准备时间
        var _me = this;
        async.series([
            function (cb2) { // 清除上轮数据
                if (_me.step != 1) {
                    _me.legion = {};
                    _me.markDirty('legion', true, function (suss) {
                        if (suss) {
                            _me.step = 1;
                            _me.markDirty('step');

                            cb2();
                        }
                        else cb2('CLEAR LEGION FAILED');
                    });
                } else {
                    cb2();
                }
            },
            function (cb2) { // 准备军团数据
                if (_me.step == 1) {
                    Storage.prepareLegionData(function (err) {
                        if (!err) {
                            _me.step = 2;
                            _me.markDirty('step');
                        }
                        cb2(err);
                    });
                } else {
                    cb2();
                }
            },
            function (cb2) { // 准备本轮数据
                if (_me.step == 2) {
                    _me.buildRoundData(function (err) {
                        if (!err) {
                            _me.step = 3;
                            _me.markDirty('step');
                        }
                        cb2(err);
                    });
                } else {
                    cb2();
                }
            }],
            function (err) {
                cb && cb(err);
            }
        );
    },

    switchStage: function(curStage, curId) {
        if (this.stage == curStage || curStage == -1) {
            return;
        }

        switch (this.stage) {
            case StageType.INVALID:
                curStage = StageType.IDLE;
                break;
            case StageType.PREPARE:
                if (curStage != StageType.FIGHT) {
                    curStage = StageType.PREPARE;
                }
                break;
            case StageType.FIGHT:
                if (curStage != StageType.IDLE) {
                    curStage = StageType.FIGHT;
                }
                break;
            case StageType.IDLE:
                if (curStage != StageType.PREPARE && curStage != StageType.NOT_JOIN) {
                    curStage = StageType.IDLE;
                }
                break;
            default:
                if (curStage != StageType.PREPARE) {
                    curStage = StageType.NOT_JOIN;
                }
        }

        if (this.stage == curStage) {
            return;
        }

        LOG('TRY SWITCH TO STAGE ' + curStage);

        var _me = this;
        async.series([
            function (cb) { // 切出当前阶段
                if (_me.stage == StageType.FIGHT) {
                    // 切出战斗阶段
                    if (_me.step != 1) {
                        _me.round += 1;
                        _me.markDirty('round');

                        _me.step = 1;
                        _me.markDirty('step');
                    }
                    cb();
                } else {
                    cb();
                }
            },
            function (cb) { // 切入新阶段
                if (curStage == StageType.PREPARE) {
                    // 切入准备时间
                    async.series([
                        function (cb2) { // 清除上轮数据
                            if (_me.step != 1) {
                                _me.legion = {};
                                _me.markDirty('legion', true, function (suss) {
                                    if (suss) {
                                        _me.step = 1;
                                        _me.markDirty('step');

                                        cb2();
                                    }
                                    else cb2('CLEAR LEGION FAILED');
                                });
                            } else {
                                cb2();
                            }
                        },
                        function (cb2) { // 准备军团数据
                            if (_me.step == 1) {
                                Storage.prepareLegionData(function (err) {
                                    if (!err) {
                                        _me.step = 2;
                                        _me.markDirty('step');
                                    }
                                    cb2(err);
                                });
                            } else {
                                cb2();
                            }
                        },
                        function (cb2) { // 准备本轮数据
                            if (_me.step == 2) {
                                _me.buildRoundData(function (err) {
                                    if (!err) {
                                        _me.step = 3;
                                        _me.markDirty('step');
                                    }
                                    cb2(err);
                                });
                            } else {
                                cb2();
                            }
                        }],
                        function (err) {
                            cb(err);
                        });
                } else if (curStage == StageType.FIGHT) {
                    // 切入战斗时间
                    _me.endUpgradeCitiesBeforWar();
                    _me.checkRoundData(function (err) {
                       cb(err);
                    });
                } else if (curStage == StageType.IDLE) {
                    // 切入休息时间
                    async.series([
                        function (cb2) { // 生成本轮的结果
                            if (_me.step == 1 || _me.step == 0) {
                                _me.buildRoundResult(function(err) {
                                    if (!err) {
                                        LOG('ROUND RESULT BUILD');

                                        _me.step = 2;
                                        _me.markDirty('step');
                                    }
                                    cb2(err);
                                });
                            } else {
                                cb2();
                            }
                        }, function (cb2) { // 其他处理
                            if (_me.step == 2) {
                                // 删除之前的报名数据，准备接收新一轮的报名数据
                                Storage.cleanServerRegData(function (err) {
                                    if (!err) {
                                        LOG('OLD REGISTER DATA CLEARED');

                                        _me.step = 3;
                                        _me.markDirty('step');
                                    }
                                    cb2(err);
                                });
                            } else {
                                cb2();
                            }
                        }],
                        function (err) {
                            cb(err);
                        });
                } else {
                    cb();
                }
            }],
            function(err) {
                if (err) {
                    ERROR(err);
                } else {
                    _me.stage = curStage;
                    _me.markDirty('stage');

                    _me.step = 999;
                    _me.markDirty('step');

                    _me.stageStartTime = LegionWarCom.genStageBeginTime(_me.stage);
                    LOG('SWITCHED TO STAGE ' + curStage);

                    if (curStage == StageType.IDLE) {
                        _me.notifyRoundResultToAllWorld();
                    }
                }
            });
    },

    buildRoundData: function(callback) {
        var _me = this;
        Storage.getLegionMatchInfo(function(err, legions){
            if (err) {
                callback(err);
            } else {
                LOG(legions.length + ' LEGION JOINED CURRENT ROUND');

                if (legions.length > 0) {
                    // 排序
                    legions.sort(function(legionA, legionB){
                        return (_me.round == 1) ? (legionB.fight_force - legionA.fight_force)
                            : (legionB.score - legionA.score);
                    });

                    async.series([function(cb){
                        if ((legions.length % 2) != 0) {
                            legions.push({lid: Robot.defConf.lid});
                            // 初始化机器人军团
                            var enemyLid = legions[legions.length - 2].lid;
                            Storage.getLegion(enemyLid, function(err, res){
                                if (!err) {
                                    Robot.init({}, res);
                                    Storage.saveRobot(function(err){
                                        cb(err);
                                    });
                                } else {
                                    cb(err);
                                }
                            });
                        } else {
                            cb();
                        }
                    }], function(err){
                        if (!err) {
                            for (var idx = 0; idx < legions.length; idx += 2) {
                                var legionA = legions[idx];
                                var legionB = legions[idx + 1];

                                _me.buildLegion(legionA, legionB);
                                _me.buildLegion(legionB, legionA);
                            }
                        }
                        callback(err);
                    });
                } else {
                    callback();
                }
            }
        });
    },

    buildLegion: function(origin, enmey) {
        var lid = origin.lid;

        // 军团数据
        this.legion[lid] = {
            lid: lid,
            enemy: enmey.lid,
            garrison: {},
            aliveCity: 0,
            loseTime: 0,
            score: 0,
            members: {}
        };

        // 成员数据
        for (var uid in origin.members) {
            var member = {};
            member.city_buff_speed = gConfGlobalNew.legionWarBuildVelocity;
            this.legion[lid].members[uid] = member;
        }

        // 城池数据
        var legionCities = {};
        for (var cityIdx = 1; cityIdx <= 16; ++cityIdx) {
            var cityConf = gConfLegionWarCity[cityIdx];

            // 城市数据
            var city = {
                buffLevel: 0,
                buffXp: 0,
                buff_members: [],
                buff_members_time: {},
                last_buff_calculate_time: 0,
                canAttack: (cityIdx == 14 || cityIdx == 15 || cityIdx == 16),
                aliveArm: 0,
                reports: [],
                canJump: false,
            };

            // 初始化城池驻守位置
            var arms = {};
            var armNum = +cityConf.arm;
            var darkArm = +cityConf.darkArm;
            var idxArr = [];
            for (var armIdx = 1; armIdx <= armNum; ++armIdx) {
                arms[armIdx] = {
                    type: 0,
                    uid:  0,
                    alive: true,
                    power: 0,
                };
                idxArr.push(armIdx);
            }

            // 随机暗格位置
            while (darkArm > 0 && idxArr.length > 0) {
                var idx = Math.floor(Math.random() * idxArr.length);
                arms[idxArr[idx]].type = 1;
                idxArr.splice(idx, 1);
                darkArm -= 1;
            }

            city['arms'] = arms;
            legionCities[cityIdx] = city;
        }

        this.legion[lid].cities = legionCities;
        this.markDirty('legion.' + lid);
    },

    checkRoundData: function(callback) {
        var _me = this;

        async.each(this.legion, function(legion, ecb){
            // 检查每个军团的数据
            _me.checkRoundLegion(legion, function(err){
                ecb(err);
            });
        }, function(err){
            callback(err);
        });
    },

    checkRoundLegion: function(legion, callback){
        var _me = this;

        async.series([function(cb){
            _me.autoAssignCityForce(legion.lid, cb);
        }, function(cb) {
            // 计算开局直接挂掉的城池积分
            var enemyScore = 0;

            // 检查数据
            for (var cid in legion.cities) {
                if (!legion.cities.hasOwnProperty(cid)) {
                    continue;
                }

                var city = legion.cities[cid];
                if (city.aliveArm > 0) {
                    legion.aliveCity += 1;
                } else {
                    enemyScore += gConfLegionWarCity[+cid].score;
                }

                // 检查驻守部队
                for (var armPos in city.arms) {
                    if (!city.arms.hasOwnProperty(armPos)) {
                        continue;
                    }

                    if (city.arms[armPos].uid == 0) {
                        city.arms[armPos].alive = false;
                    }
                }
            }

            // 检查城池可攻击性
            checkCityAttackable(legion, 14);
            checkCityAttackable(legion, 15);
            checkCityAttackable(legion, 16);

            // 检查城池可跳过性
            checkCityCanJumpable(legion, 14);
            checkCityCanJumpable(legion, 15);
            checkCityCanJumpable(legion, 16);

            // 把积分给敌方军团加上
            if (enemyScore > 0) {
                _me.legion[legion.enemy].score = enemyScore;
                _me.markDirty('legion.' + legion.enemy)
            }

            // 不会出现这种情况
            if (legion.aliveCity == 0) {
                legion.loseTime = Date.getStamp();
            }

            // 强制保存数据
            _me.markDirty('legion.' + legion.lid, true, function(){
                cb();
            });

        }], function(err){
            callback(err);
        });
    },

    autoAssignCityForce: function(lid, callback) {
        this.getLegion(lid, function(err, res){
            if (err) callback(err);
            else {
                var legionConf = res.conf;
                var legionRuntime = res.runtime;

                var members = Object.keys(legionConf.members);
                var legionGarrion = clone(legionRuntime.garrison);
                var dispatchNum = +(gConfGlobalNew.legionWarDispatchNum);

                members.forEach(function(uid){
                    uid = +uid;

                    if (legionGarrion.hasOwnProperty(uid)) {
                        if (legionGarrion[uid] == dispatchNum) {
                            delete legionGarrion[uid];
                        } else {
                            legionGarrion[uid] = dispatchNum - legionGarrion[uid];
                        }
                    } else {
                        legionGarrion[uid] = dispatchNum;
                    }
                });

                assignCityForce(legionRuntime, 14, legionGarrion);
                assignCityForce(legionRuntime, 15, legionGarrion);
                assignCityForce(legionRuntime, 16, legionGarrion);

                callback();
            }
        });
    },

    buildRoundResult: function (callback) {
        var _me = this;
        var round = this.round - 1; // round在切出战斗阶段时已经加1

        var roundResult = {
            _id: round,
            time: Date.getStamp(),
            info: {/*
                lid: {
                    sid: 0,         // 所属服ID
                    lid: 0,         // 军团ID
                    name: '',       // 军团名
                    icon: 0,        // 军团图标
                    score: 0,       // 军团积分
                    curScore: 0,    // 本次军团战积分
                    enemy: 0,       // 敌方军团ID
                    win: 0,         // 是否胜利
                },
            */},
        };

        var info = roundResult.info;
        var lids = Object.keys(this.legion);

        async.series([function (cb) { // 准备数据
            async.each(lids, function (lid, ecb) {
                lid = +lid;

                _me.getLegion(lid, function (err, res) {
                    if (err) ecb(err);
                    else {
                        var legionConf = res.conf;
                        var legionRuntime = res.runtime;

                        var legionResult = {
                            sid: legionConf.sid,
                            lid: legionConf.lid,
                            name: legionConf.name,
                            icon: legionConf.icon,
                            level: legionConf.level,
                            score: legionConf.score,
                            curScore: legionRuntime.score,
                            enemy: legionRuntime.enemy,
                        };

                        var enemyLid = legionRuntime.enemy;
                        if (info.hasOwnProperty(enemyLid)) {
                            legionResult.win = !(info[enemyLid].win);
                            info[lid] = legionResult;

                            ecb();
                        } else {
                            _me.getLegion(enemyLid, function (err, eres) {
                                if (err) ecb(err);
                                else {
                                    var enemyLegionRumtime = eres.runtime;
                                    var enemyLegionConf = eres.conf;

                                    var win = false;
                                    if (legionRuntime.score > enemyLegionRumtime.score) {
                                        // 积分高获胜
                                        win = true;
                                    } else if (legionRuntime.score == enemyLegionRumtime.score) {
                                        // 积分相等战力低军团获胜
                                        win = (legionConf.fight_force > enemyLegionConf.fight_force) ? true : false;
                                    }

                                    legionResult.win = win;
                                    info[lid] = legionResult;
                                    ecb();
                                }
                            });
                        }
                    }
                });
            }, function (err) {
                cb(err);
            });
        }, function (cb) { // 更新排行榜
            Storage.getRankList(function (err, ranklist) {
                if (err) cb(err);
                else {
                    var rankLegions = ranklist.legions;
                    var oldRank = clone(ranklist.rank);
                    var newRank = [];

                    var ranks = _me.ranks;

                    for (var lid in info) {
                        if (!info.hasOwnProperty(lid)) {
                            continue;
                        }
                        lid = +lid;

                        var legionInf = info[lid];

                        var oldRank = -1;
                        var oldScore = 0;

                        if (rankLegions.hasOwnProperty(lid)) {
                            oldRank = LegionWarCom.findLegionIndex(oldRank, 'lid', legionInf.lid);
                            oldScore = rankLegions[lid].score;
                        }
                        if (oldRank != -1) {
                            oldRank += 1;
                        }

                        var rankLegion = rankLegions[lid] || {};
                        rankLegion.lid = lid;
                        rankLegion.sid = legionInf.sid;
                        rankLegion.name = legionInf.name;
                        rankLegion.icon = legionInf.icon;
                        rankLegion.level = legionInf.level;
                        if (legionInf.win) {
                            rankLegion.score = (rankLegion.score || 0) + (+gConfGlobalNew.legionWarWinScore);
                        } else {
                            rankLegion.score = Math.max(0, (rankLegion.score || 0) - (+gConfGlobalNew.legionWarLoseScore));
                        }
                        legionInf.score = rankLegion.score;
                        rankLegion.oldRank = oldRank;
                        rankLegion.oldScore = oldScore;

                        // 更新各段位人数
                        var oldRank2 = LegionWarCom.getRank(oldScore);
                        var newRank2 = LegionWarCom.getRank(rankLegion.score);

                        if (ranks[oldRank2] && ranks[oldRank2].hasOwnProperty(lid)) {
                            delete ranks[oldRank2][lid];
                        }
                        ranks[newRank2] = ranks[newRank2] || {};
                        ranks[newRank2][lid] = 1;

                        // 更新排行榜
                        var insPos = LegionWarCom.findInsertPos(newRank, 'score', rankLegion.score, lid);
                        newRank.splice(insPos, 0, { score: rankLegion.score, lid: lid });
                        rankLegions[lid] = rankLegion;
                    }
                    _me.markDirty('ranks');

                    ranklist.rank = newRank;

                    Storage.saveRankList(ranklist, function (err) {
                        cb(err);
                    });
                }
            });
        }, function (cb) { // 保存数据
            Storage.saveRoundResult(roundResult, function (err) {
                cb(err);
            });
        }], function (err) {
            callback(err);
        });
    },

    getLegion: function(lid, callback) {
        var _me = this;
        Storage.getLegion(lid, function(err, conf){
            if (err) callback(err);
            else {
                if (!_me.legion.hasOwnProperty(lid)) {
                    callback(ErrorCode.ERROR_NO_SUCH_LEGION, 'NO SUCH LEGION');
                } else {
                    callback(null, {
                        conf: conf,
                        runtime: _me.legion[lid]
                    });
                }
            }
        });
    },

    getBattle: function(lid, cid, arm) {
        var key = lid + '-' + cid + '-' + arm;
        return this.battle[key];
    },

    addBattleUpdate: function(lid, cid, arm, battle) {
        var key = lid + '-' + cid + '-' + arm;
        if (battle) {
            this.battle[key] = battle;
            this.markDirty('battle.' + key);
        } else {
            this.markDirty('battle.' + key);
        }
    },

    delBattle: function(lid, cid, arm) {
        var key = lid + '-' + cid + '-' + arm;
        this.battle[key] = null;
        this.markDirty('battle.' + key);
    },
    buildLegionMainPageInfo: function(legionData, rank) {
        var retObj = {
            sid: legionData.conf.sid,                                // 服务器ID
            lid: legionData.conf.lid,                                // 军团ID
            name: legionData.conf.name,                              // 军团名字
            icon: legionData.conf.icon,                              // 军团图标
            level: legionData.conf.level,                            // 军团等级
            score: legionData.conf.score,
            curScore: legionData.runtime.score,                      // 当前积分
            winNum: legionData.conf.win_num,
            joinNum: legionData.conf.join_num,
        };
        if (rank) {
            retObj.curRank = rank;                                   // 当前排名
        }
        return retObj;
    },
    getLegionBasicInfo: function(lid, needGarrion, callback) {
        this.getLegion(lid, function(err, res){
            if (err) callback(err);
            else {
                var info = {};

                info.sid = res.conf.sid;                    // 服务器ID
                info.lid = res.conf.lid;                    // 军团ID
                info.name = res.conf.name;                  // 军团名字
                info.icon = res.conf.icon;                  // 军团图标

                // 只返回城市基本数据
                var cities = clone(res.runtime.cities);
                for (var cid in cities) {
                    delete cities[cid].arms;
                    delete cities[cid].reports;
                }

                info.cities = cities;                       // 城池数据
                info.score = res.runtime.score;             // 积分
                if (needGarrion) {
                    info.garrison = res.runtime.garrison;     // 驻守数据
                }
                callback(null, info);
            }
        });
    },

    registerServer: function(args, callback) {
        var serverId = args.sid;
        if ((!serverId || isNaN(serverId)) && serverId != 0) {
            callback(ErrorCode.ERROR_INVALID_ARGS);
            return;
        }

        this.servers[serverId] = [args.ip, args.port, args.openTime];
        this.markDirty(util.format('servers.%d', serverId));
        callback();
    },

    getMainPageInfo: function(lid, joined, callback) {
        if (this.round == 1 && (this.stage != 1 && this.stage != 2)) {
            // 第一轮还没开始，没有军团匹配数据
            callback(null, {
                code: ErrorCode.ERROR_FIRST_ROUND_NOT_YET_START,
            });
        } else {
            if (this.stage == StageType.NOT_JOIN) {
                // 休战时间
                callback(null, {
                    code: ErrorCode.ERROR_STAGE_NOT_FIT,
                });
            } else {
                var _me = this;

                if (!joined) {
                    callback(null, {
                        code: 0,
                        data: {
                            round: _me.round,
                        }
                    });
                    return;
                }

                var ownData = null;
                var enemyData = null;
                var myRank = -1;
                var enemyRank = -1;
                async.series([function(cb){ // 取我方数据
                    _me.getLegion(lid, function(err, res){
                        ownData = res;
                        cb(err);
                    });
                }, function(cb){ // 取敌方军团数据
                    _me.getLegion(ownData.runtime.enemy, function(err, res){
                        enemyData = res;
                        cb(err);
                    });
                }, function(cb){
                    Storage.getRankList(function(err, ranklist){
                        if (err) {
                            cb(err);
                        } else {
                            // 排行榜数据
                            var rankLegions = ranklist.legions;
                            var rank = ranklist.rank;

                            if (rankLegions.hasOwnProperty(lid)) {
                                myRank = LegionWarCom.findLegionIndex(rank, 'lid', lid) + 1;
                            }
                            if (rankLegions.hasOwnProperty(enemyData.conf.lid)) {
                                enemyRank = LegionWarCom.findLegionIndex(rank, 'lid', enemyData.conf.lid) + 1;
                            }
                            cb();
                        }
                    });
                }], function(err){
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, {
                            code : 0,
                            data: {
                                stage : _me.stage,
                                round : _me.round,
                                curScore : ownData.runtime.score,
                                curRank : myRank,
                                enemyLegion : _me.buildLegionMainPageInfo(enemyData, enemyRank)
                            }
                        });
                    }
                });
            }
        }
    },

    getBattlePageInfo: function(uid, lid, needGarrion, callback) {
        if (this.stage == StageType.IDLE) {
            callback(ErrorCode.ERROR_IDLE_CANNOT_ENTER_BATTLE);
			return;
        }

        // 只有在准备时间才会需要这个数据(军团长/副军团长调整玩家驻守位置)
        if (this.stage != StageType.PREPARE) {
            needGarrion = false;
        }

        var _me = this, ownData = null, enmeyData = null;
        async.series([function (cb) { // 取本军团数据
            if (_me.stage == StageType.PREPARE) {
                // 准备阶段获取城池数据前先刷新结算增筑相关数据
                _me.updateLegionCitiesBuff(lid, false);
            }
            _me.getLegionBasicInfo(lid, needGarrion, function(err, data){
                ownData = data;
                cb(err);
            });
        }, function (cb) { // 取敌方军团数据
            var legionWar = _me.legion[lid];
            _me.getLegionBasicInfo(legionWar.enemy, false, function(err, data) {
                enmeyData = data;
                // 准备阶段不需要敌方军团的城市数据
                if (_me.stage == StageType.PREPARE) {
                    delete  enmeyData.cities;
                }
                cb(err);
            });
        }], function (err) {
            var personalScore = 0;
            if (_me.accumulate_award[uid]) {
                personalScore = _me.accumulate_award[uid].legionwar_score;
            }
            var buffingCity = _me.getUserBuffingCity(uid, lid);
            callback(err, {
                buffing_city: buffingCity,
                personal_score: personalScore,
                own: ownData,
                enemy: enmeyData
            });
        });
    },

    getCityInfo: function(uid, lid, city, hiddDark, callback) {
        var _me = this;
        _me.updateLegionCitiesBuff(lid, false);
        _me.getLegion(lid, function(err, res){
            if (err) {
                callback(err);
            } else {
                var rtnUsers = {};
                var buffUsers = {};

                var selCity = res.runtime.cities[city];
                if (selCity) {
                    var legionData = res.conf;

                    for (var armPos in selCity.arms) {
                        // 返回有人驻守
                        if (+selCity.arms[armPos].uid != 0) {
                            //garrionUids.push(+selCity.arms[armPos].uid);
                            var uid = +selCity.arms[armPos].uid;
                            var user = legionData.members[uid];
                            if (user) {
                                rtnUsers[+user.uid] = {
                                    un:             user.un,
                                    headpic:        user.headpic,
                                    headframe :     user.headframe,
                                    level:          user.level,
                                    fight_force:    user.fight_force,
                                    model:          user.model,
                                    quality:        user.quality,
                                    promote:        user.promote || [],
                                    weapon_illusion:user.weapon_illusion || 0,
                                    wing_illusion:  user.wing_illusion || 0,
                                    mount_illusion: user.mount_illusion || 0,
                                    custom_king:    user.custom_king,
                                };
                            }
                        }
                    }

                    for (var i = 0; i < selCity.buff_members.length; i++){
                        var uid = selCity.buff_members[i];
                        if (legionData.members[uid]) {
                            var city_buff_speed = 0;
                            if (res.runtime.members[uid]) {
                                city_buff_speed = res.runtime.members[+uid].city_buff_speed;
                            }
                            var user = legionData.members[uid];
                            buffUsers[uid] = {
                                un:             user.un,
                                headpic:        user.headpic,
                                headframe :     user.headframe,
                                level:          user.level,
                                fight_force:    user.fight_force,
                                model:          user.model,
                                quality:        user.quality,
                                promote:        user.promote || [],
                                weapon_illusion:user.weapon_illusion || 0,
                                wing_illusion:  user.wing_illusion || 0,
                                custom_king:    user.custom_king,
                                city_buff_speed: city_buff_speed
                            };
                        }
                    }
                }

                var data = {};
                data.city = selCity;
                data.city_users = rtnUsers;
                data.city_buff_users = buffUsers;
                data.curCity = _me.getUserBuffingCity(uid, lid);

                callback(null, data);
            }
        });
    },

    getCityInfoMulti: function(uid, lid, citys, hiddDark, callback) {
        var _me = this;
        _me.updateLegionCitiesBuff(lid, false);
        _me.getLegion(lid, function(err, res){
            if (err) {
                callback(err);
            } else {
                var retdata = [];

                for(let m = 0; m < citys.length; m++) {
                    var city = citys[m];

                    var rtnUsers = {};
                    var buffUsers = {};

                    var selCity = res.runtime.cities[city];
                    if (selCity) {
                        var legionData = res.conf;

                        for (var armPos in selCity.arms) {
                            // 返回有人驻守
                            if (+selCity.arms[armPos].uid != 0) {
                                //garrionUids.push(+selCity.arms[armPos].uid);
                                var uid = +selCity.arms[armPos].uid;
                                var user = legionData.members[uid];
                                if (user) {
                                    rtnUsers[+user.uid] = {
                                        un:             user.un,
                                        headpic:        user.headpic,
                                        headframe :     user.headframe,
                                        level:          user.level,
                                        fight_force:    user.fight_force,
                                        model:          user.model,
                                        quality:        user.quality,
                                        promote:        user.promote || [],
                                        weapon_illusion:user.weapon_illusion || 0,
                                        wing_illusion:  user.wing_illusion || 0,
                                        mount_illusion: user.mount_illusion || 0,
                                        custom_king:    user.custom_king,
                                    };
                                }
                            }
                        }

                        for (var i = 0; i < selCity.buff_members.length; i++){
                            var uid = selCity.buff_members[i];
                            if (legionData.members[uid]) {
                                var city_buff_speed = 0;
                                if (res.runtime.members[uid]) {
                                    city_buff_speed = res.runtime.members[+uid].city_buff_speed;
                                }
                                var user = legionData.members[uid];
                                buffUsers[uid] = {
                                    un:             user.un,
                                    headpic:        user.headpic,
                                    headframe :     user.headframe,
                                    level:          user.level,
                                    fight_force:    user.fight_force,
                                    model:          user.model,
                                    quality:        user.quality,
                                    promote:        user.promote || [],
                                    weapon_illusion:user.weapon_illusion || 0,
                                    wing_illusion:  user.wing_illusion || 0,
                                    custom_king:    user.custom_king,
                                    city_buff_speed: city_buff_speed
                                };
                            }
                        }

                        var data = {};
                        data.cityId = city;
                        data.city = selCity;
                        data.city_users = rtnUsers;
                        data.city_buff_users = buffUsers;
                        data.curCity = _me.getUserBuffingCity(uid, lid);

                        retdata.push(data);
                    }
                }

                callback(null, retdata);
            }
        });
    },

    // 获取玩家正在增筑的城池
    getUserBuffingCity: function (uid, lid) {
        var buffingCity = -1;
        var legion = this.legion[lid];
        if (!legion) {
            return buffingCity
        }

        for (var i in legion.cities) {
            var legionCity = legion.cities[i];
            if (legionCity.buff_members.indexOf(uid) >= 0) {
                buffingCity = Number(i);
                break;
            }
        }
        return buffingCity;
    },

    // 按筑城经验发放军团战个人积分
    addLegionWarScoreByCityBuff: function (uid, buffExp) {
        var score = Math.floor(buffExp * gConfGlobalNew.legionWarScoreAwardRatio);
        if (!score) {
            score = 0;
            return false;
        }

        if (!this.accumulate_award[uid]) {
            this.accumulate_award[uid] = {}
            this.accumulate_award[uid].legionwar_score = 0;
        }
        this.accumulate_award[uid].legionwar_score += score;
        this.markDirty(util.format('accumulate_award.%d', uid));
        return true;
    },

    // 领取累积的个人军团战积分
    getAccumulateLegionwar: function (uid, callback) {
        if (!this.accumulate_award[uid]) {
            this.accumulate_award[uid] = {};
            this.accumulate_award[uid].legionwar_score = 0;
            this.markDirty(util.format('accumulate_award.%d', uid));
        }
        if (this.accumulate_award[uid].legionwar_score <= 0) {
            callback(ErrorCode.ERROR_PLAYER_ALREADY_GOT_LEGIONWAR_SCORE);
            return;
        }
        var data = {};
        var awards = parseAwardsConfig(gConfGlobalNew.legionWarBuildAward);
        awards[0][2] = this.accumulate_award[uid].legionwar_score;
        data.award = awards;
        this.accumulate_award[uid].legionwar_score = 0;
        this.markDirty(util.format('accumulate_award.%d', uid));
        callback(0, data);
    },

    // 开战前结束所有城池增筑
    endUpgradeCitiesBeforWar: function () {
        for (var lid in this.legion) {
            this.updateLegionCitiesBuff(lid, true);
            for (var cid in this.legion[lid].cities) {
                var city = this.legion[lid].cities[cid]
                city.buff_members = [];
                this.markDirty('legion.' + lid);
            }
        }

        for (var uid in this.accumulate_award) {
            if (this.accumulate_award[uid].legionwar_score <= 0) {
                continue;
            }

            var awards = parseAwardsConfig(gConfGlobalNew.legionWarBuildAward);
            awards[0][2] = this.accumulate_award[uid].legionwar_score;

            var serverId = common.getServerId(uid)
            var serverInfo = this.getServerInfo(serverId);
            if (serverInfo) {
                var req = {
                    uid: uid,
                    mod: 'mail',
                    act: 'add_upgrade_city_award_mail',
                    args: {
                        awards: awards,
                    },
                };
                requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, {});
            }
        }

        this.accumulate_award = {};
        this.markDirty('accumulate_award');
    },

    // 结算军团所有城池增筑相关数据
    updateLegionCitiesBuff: function (lid, force) {
        var legion = this.legion[lid];
        for (var cityId in legion.cities) {
            this.calculateCityBuff(lid, cityId, force);
        }
    },

    // 结算军团城池加筑相关数据
    calculateCityBuff: function (lid, city, force) {
        var cityConf = gConfLegionWarCity[city];
        var legion = this.legion[lid];
        var legionCity = legion.cities[city];

        var now = common.getTime();
        var intervalTime = now - legionCity.last_buff_calculate_time;

        if (!force) {
            // 距离上次计算没过10分钟或没有增筑
            if (intervalTime < 300 || legionCity.last_buff_calculate_time == 0) {
                return
            }
        } else {
            // 强制计算刚计算过
            if (intervalTime <= 5) {
                return
            }
        }

        // 增驻已满
        if (legionCity.buffLevel >= cityConf.maxBufLevel) {
            return;
        }

        // 无人增筑
        if (legionCity.buff_members.length == 0) {
            return;
        }

        var userSpeed = {};
        var totalSpeed = 0;
        for (var i = 0; i < legionCity.buff_members.length; i++) {
            var buffUid = legionCity.buff_members[i];
            if (legion.members[buffUid]) {
                var buffSpeed = legion.members[buffUid].city_buff_speed;
                userSpeed[buffUid] = {
                    speed: buffSpeed,
                    last_time: legionCity.buff_members_time[buffUid],
                }
                totalSpeed += buffSpeed;
            } else {
                ERROR('not found buffUid = ' + buffUid);
            }
        }

        var buffMaxNeedExp = 0;
        for (var i = legionCity.buffLevel; i < cityConf.maxBufLevel; i++) {
            buffMaxNeedExp += cityConf['buf' + (legionCity.buffLevel + 1) + 'Xp'];
        }
        buffMaxNeedExp -= legionCity.buffXp;

        var buffMaxNeedTime = Math.ceil(buffMaxNeedExp / totalSpeed * 60);

        DEBUG("<<< intervalTime = " + intervalTime + " , buffMaxNeedTime = " + buffMaxNeedTime + ", legionCity.last_buff_calculate_time = " + legionCity.last_buff_calculate_time);

        if (intervalTime < buffMaxNeedTime) {
            var totalExp = Math.floor(totalSpeed * intervalTime / 60);
            if (totalExp > 0) {
                var realIntervalTime = Math.floor(60 * totalExp / totalSpeed)
                legionCity.last_buff_calculate_time += realIntervalTime;
                this.markDirty(util.format('legion.%d.cities.%d.last_buff_calculate_time', lid, city));
                this.addCityBufExp(lid, city, totalExp);
            }
        } else {
            legionCity.last_buff_calculate_time += buffMaxNeedTime;
            legionCity.buff_members = [];
            legionCity.buffLevel = cityConf.maxBufLevel;
            legionCity.buffXp = 0;
        }
        // 结算筑城奖励
        for (var i in userSpeed) {
            var exp = Math.floor(userSpeed[i].speed * (legionCity.last_buff_calculate_time-userSpeed[i].last_time) / 60);
            if (this.addLegionWarScoreByCityBuff(+i, exp)) {
                LOG(i);
                LOG(exp);
                LOG(this.accumulate_award[i]);
                legionCity.buff_members_time[i] = legionCity.last_buff_calculate_time;
            }
        }
        this.markDirty(util.format('legion.%d.cities.%d', lid, city));
    },

    // 增加城池增筑经验
    addCityBufExp: function (lid, city, exp) {
        var cityConf = gConfLegionWarCity[city];
        var legion = this.legion[lid];
        var legionCity = legion.cities[city];
        if (legionCity.buffLevel >= cityConf.maxBufLevel) {
            return;
        }
        legionCity.buffXp += exp;
        var nextLevelXp = cityConf['buf' + (legionCity.buffLevel + 1) + 'Xp'];
        while (legionCity.buffXp >= nextLevelXp) {
            legionCity.buffXp -= nextLevelXp;
            legionCity.buffLevel++;
            if (legionCity.buffLevel < cityConf.maxBufLevel) {
                nextLevelXp = cityConf['buf' + (legionCity.buffLevel + 1) + 'Xp'];
            } else {
                legionCity.buff_members = [];
                legionCity.buffLevel = cityConf.maxBufLevel;
                legionCity.buffXp = 0;
                break;
            }
        }
        this.markDirty(util.format('legion.%d.cities.%d', lid, city));
    },

    // FIXME: 需要重写增筑功能
    upgradeCityBuff: function(lid, city, uid, callback) {
        // 只有第一阶段才能增筑
        if (this.stage != StageType.PREPARE) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var legion = this.legion[lid];
        var cityConf = gConfLegionWarCity[city];
        var legionCity = legion.cities[city];

        // 增驻已满
        if (legionCity.buffLevel >= cityConf.maxBufLevel) {
            callback(ErrorCode.ERROR_UPGRADE_CITYBUF_MAX);
            return;
        }

        var buffingCity = this.getUserBuffingCity(uid, lid);
        if (city == buffingCity) {
            callback(ErrorCode.ERROR_PLAYER_ALREADY_UPGRADE_THIS_CITY);
            return;
        }

        if (buffingCity > 0) {
            // 已经在筑其他城了则先结算再退出增筑
            this.calculateCityBuff(lid, buffingCity, true);
            legion.cities[buffingCity].buff_members.remove(uid);
        }

        // 结算一次打算去增筑的城池
        if (legionCity.buff_members.length == 0) {
            legionCity.last_buff_calculate_time = common.getTime();
        } else {
            this.calculateCityBuff(lid, city, true);
        }

        // 把该玩家添加到增筑队伍
        legionCity.buff_members.push(uid);
        legionCity.buff_members_time[uid] = common.getTime();
        legionCity.last_buff_calculate_time = common.getTime();
        this.markDirty(util.format('legion.%d.cities.%d', lid, city));

        DEBUG("<<<< lid = " + lid + " , city = " + city + " , buffLevel = " + legionCity.buffLevel + " , buffXp = " + legionCity.buffXp);

        var data = {};
        data.buffLevel = legionCity.buffLevel;
        data.buffXp = legionCity.buffXp;
        callback(0, data);
    },

    // 取消增筑
    cancelCityBuf : function (lid, uid, callback) {
        var buffingCity = this.getUserBuffingCity(uid, lid);
        if (buffingCity == -1) {
            callback(ErrorCode.ERROR_PLAYER_NO_BUFF_CITY);
            return;
        }

        var legion = this.legion[lid];
        var legionCity = legion.cities[buffingCity];

        var index = legionCity.buff_members.indexOf(uid);
        if (index < 0) {
            callback(ErrorCode.ERROR_PLAYER_NO_BUFF_CITY);
            return;
        }

        // 离开之前先结算一次
        this.calculateCityBuff(lid, buffingCity, true);

        legionCity.buff_members.splice(index, 1);
        if (legionCity.buff_members.length == 0) {
            legionCity.last_buff_calculate_time = 0;
        }
        this.markDirty(util.format('legion.%d.cities.%d', lid, buffingCity));

        var data = {};
        data.buffLevel = legionCity.buffLevel;
        data.buffXp = legionCity.buffXp;
        callback(0, data);
    },

    addCityForce: function (lid, city, arm, uid, callback) {
        // 只有第一阶段才能驻守玩家
        if (this.stage != StageType.PREPARE) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var _me =  this;
        this.getLegion(lid, function(err, res){
            if (err) callback(err);
            else {

                // 判断要放上去的人是不是本军团的玩家
                if (!res.conf.members.hasOwnProperty(uid)) {
                    callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION);
                    return;
                }

                var legion = res.runtime;

                var legionGarrion = legion.garrison;
                if (legionGarrion.hasOwnProperty(uid)) {
                    var garrionNum = legionGarrion[uid];
                    // 该玩家驻守次数已经用尽
                    if (garrionNum >= +(gConfGlobalNew.legionWarDispatchNum)) {
                        callback(ErrorCode.ERROR_PLAYER_GARRION_TIME_USE_UP);
                        return;
                    }
                }

                var legionCity = legion.cities[city];

                var alreadyGarrionThisCity = false;
                for (var armPos in legionCity.arms) {
                    if (!legionCity.arms.hasOwnProperty(armPos)) {
                        continue;
                    }

                    if (legionCity.arms[armPos].uid == uid) {
                        alreadyGarrionThisCity = true;
                        break;
                    }
                }
                // 该玩家已经在本城池驻守
                if (alreadyGarrionThisCity) {
                    callback(ErrorCode.ERROR_PLAYER_ALREADY_GARRION_THIS_CITY);
                    return;
                }


                var legionArm = legionCity.arms[arm];
                // 已经被驻守
                if (legionArm.uid != 0) {
                    callback(ErrorCode.ERROR_CITY_ARM_ALREADY_GASSION);
                    return;
                }

                //// 驻守玩家到本城池本防御位置
                legionArm.uid = uid;
                legionArm.power = 100;
                legionCity.aliveArm += 1;
                _me.markDirty(util.format('legion.%d.cities.%d', lid, city));

                // 更新玩家驻守次数
                legionGarrion[uid] = (isNaN(legionGarrion[uid])) ? 1 : (legionGarrion[uid] + 1);
                legion.garrison = legionGarrion;
                _me.markDirty(util.format('legion.%d.garrison', lid));

                callback();
            }
        });
    },

    removeCityForce: function (lid, city, uid, callback) {
        // 只有第一阶段才能驻守玩家
        if (this.stage != StageType.PREPARE) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var _me = this;
        this.getLegion(lid, function(err, res){
            // 判断要撤下的人是不是本军团的玩家
            if (!res.conf.members.hasOwnProperty(uid)) {
                callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION);
                return;
            }

            var legion = res.runtime;
            var legionGarrion = legion.garrison;

            var legionCity = legion.cities[city];

            var playerRemoved = false;
            for (var armPos in legionCity.arms) {
                if (!legionCity.arms.hasOwnProperty(armPos)) {
                    continue;
                }

                if (legionCity.arms[armPos].uid == uid) {
                    legionCity.arms[armPos].uid = 0;
                    legionCity.aliveArm -= 1;
                    _me.markDirty(util.format('legion.%d.cities.%d', lid, city));

                    playerRemoved = true;
                    break;
                }
            }
            if (!playerRemoved) {
                callback(ErrorCode.ERROR_PLAYER_NOT_GARRION_THIS_CITY);
                return;
            }

            // 更新玩家驻守次数
            legionGarrion[uid] = (legionGarrion[uid] - 1);
            _me.markDirty(util.format('legion.%d.garrison', lid));

            callback();
        });
    },

    useCard: function(lid, cardId, target, uid, callback){
        // 检查使用阶段
        var cardConf = gConfLegionWarCityCard[cardId];
        if (cardConf['useTime'] != this.stage) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var _me = this;

        if (cardConf['key'] == 'build') {
            // 增加城池增筑经验
            var targetCid = target.city;
            if (isNaN(targetCid)) {
                callback(ErrorCode.ERROR_INVALID_ARGS);
                return;
            }

            var cityConf = gConfLegionWarCity[targetCid];
            var legion = _me.legion[lid];
            var legionCity = legion.cities[targetCid];
            if (legionCity.buffLevel >= cityConf.maxBufLevel) {
                callback(ErrorCode.ERROR_UPGRADE_CITYBUF_MAX);
                return;
            }
            var exp = cardConf['parameter'];
            _me.addCityBufExp(lid, targetCid, exp);
            _me.addLegionWarScoreByCityBuff(uid, exp);
            _me.calculateCityBuff(lid, targetCid, true);

            _me.getCityInfo(uid, lid, targetCid, 0, callback);
        } else if (cardConf['key'] == 'expedite') {
            // 固定增加城池增筑速度
            var legion = _me.legion[lid];
            var buffingCity = _me.getUserBuffingCity(uid, lid);
            if (buffingCity > 0) {
                _me.calculateCityBuff(lid, buffingCity, true);
            }
            legion.members[uid].city_buff_speed += (cardConf['parameter']/60);
            _me.markDirty('legion.' + lid + '.members.' + uid);

            _me.getCityInfo(uid, lid, buffingCity, 0, callback);
        } else if (cardConf['key'] == 'fact') {
            // 探明一个暗格
            var targetCid = target.city;
            if (isNaN(targetCid)) {
                callback(ErrorCode.ERROR_INVALID_ARGS);
                return;
            }

            _me.getLegion(lid, function(err, res){
                if (err) callback(err);
                else {
                    var enemyLid = res.runtime.enemy;

                    _me.getLegion(enemyLid, function(err, eres){
                        if (err) callback(err);
                        else {
                            var targetCity = eres.runtime.cities[targetCid];

                            // 查找暗格
                            var darkSlots = [];
                            for (var index in targetCity.arms) {
                                if (targetCity.arms[index].type == 1 && targetCity.arms[index].uid > 0) {
                                    darkSlots.push(index);
                                }
                            }

                            if (darkSlots.length == 0) {
                                callback(ErrorCode.ERROR_ARM_IS_DEAD);
                                return;
                            }

                            // 随机一个暗格
                            var randIndex = common.randRange(0, darkSlots.length - 1);
                            var targetArmPos = darkSlots[randIndex];

                            var targetArm = targetCity.arms[targetArmPos];

                            // 检查目标是否存活
                            if (!targetArm.alive) {
                                callback(ErrorCode.ERROR_ARM_IS_DEAD);
                                return;
                            }

                            // 检查目标是否暗格
                            if (targetArm.type != 1) {
                                callback(ErrorCode.ERROR_ARM_IS_NOT_DARK);
                                return;
                            }

                            Storage.getLegionUsers(enemyLid, [targetArm.uid], function(err, users){
                                if (err) callback(err);
                                else {
                                    if (users.length == 0) {
                                        callback(ErrorCode.ERROR_LEGION_DONT_HAVE_USER);
                                    } else {

                                        // 修改目标暗格为已探测状态
                                        targetArm.type = 2;
                                        // 保存修改
                                        _me.markDirty('legion.' + enemyLid + '.cities.' + targetCid);

                                        callback(null, {
                                            index : targetArmPos,
                                            arm: {
                                                un:             users[0].un,
                                                headpic:        users[0].headpic,
                                                headframe:      users[0].headframe,
                                                level:          users[0].level,
                                                fight_force:    users[0].fight_force,
                                                model:          users[0].model,
                                                quality:        users[0].quality,
                                                promote:        users[0].promote,
                                                weapon_illusion:users[0].weapon_illusion || 0,
                                                wing_illusion:  users[0].wing_illusion || 0,
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            });
        } else if (cardConf['key'] == 'through') {
            // 使一个无法达到的城池可攻击
            var targetCid = target.city;
            if (isNaN(targetCid)) {
                callback(ErrorCode.ERROR_INVALID_ARGS);
                return;
            }

            _me.getLegion(lid, function(err, res){
                if (err) callback(err);
                else {
                    var enemyLid = res.runtime.enemy;

                    _me.getLegion(enemyLid, function(err, eres){
                        if (err) callback(err);
                        else {
                            var targetCity = eres.runtime.cities[targetCid];

                            // 检查目标城池是否可攻击
                            if (targetCity.canAttack) {
                                callback(ErrorCode.ERROR_CITY_ALREADY_CAN_ATTACK);
                            }

                            // 修改目标城池可攻击
                            targetCity.canAttack = true;
                            targetCity.through = true;

                            // 检查这个节点的城池连接图
                            var nodeMap = {};
                            checkCityAttackable(eres.runtime, targetCid, true, nodeMap);

                            // 可跳过节点图
                            var jumpMap = {};
                            // checkCityCanJumpable(eres.runtime, targetCid, true, jumpMap);

                            // 保存修改
                            _me.markDirty('legion.' + enemyLid + '.cities.' + targetCid);

                            callback(null, { cityMap : nodeMap, jumpMap: jumpMap });
                        }
                    });
                }
            });
        } else {
            callback(ErrorCode.ERROR_INVALID_ARGS);
        }
    },

    attackArm: function (lid, city, arm, attacker, cardId, callback) {
        var _me = this;

        if (this.stage != StageType.FIGHT) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        _me.getLegion(lid, function (err, res) {
            if (err) callback(err);
            else {
                var enemyLid = res.runtime.enemy;
                _me.getLegion(enemyLid, function (err, eres) {
                    if (err) callback(err);
                    else {
                        var battle = _me.getBattle(enemyLid, city, arm);
                        if (battle) {
                            callback(ErrorCode.ERROR_ARM_IS_UNDERATTACK);
                            return;
                        }

                        var targetCity = eres.runtime.cities[city];
                        var targetArm = targetCity.arms[arm];

                        if (!targetCity.canAttack) {
                            callback(ErrorCode.ERROR_CITY_CAN_NOT_ATTACK);
                            return;
                        }

                        if (!targetArm.alive) {
                            callback(ErrorCode.ERROR_ARM_IS_DEAD);
                            return;
                        }

                        // 使暗格可见
                        if (targetArm.type == 1) {
                            targetArm.type = 2;
                        }
                        _me.markDirty('legion.' + enemyLid + '.cities.' + city);

                        _me.addBattleUpdate(enemyLid, city, arm, {
                            lid: enemyLid,
                            cid: city,
                            arm: arm,
                            attacker: attacker,
                            time: Date.getStamp()
                        });

                        var attackerInfo = clone(res.conf.members[attacker]);
                        var enemyInfo = clone(eres.conf.members[targetArm.uid]);

                        // 卡牌效果
                        if (cardId && cardId > 0) {
                            var cardConf = gConfLegionWarCityCard[cardId];
                            if (cardConf) {
                                if (cardConf.key == 'defense') {
                                    // 提升伤害减免
                                    for (var hid in attackerInfo.fight_info.pos) {
                                        if (hid && hid > 0) {
                                            attackerInfo.fight_info.pos[hid].attr[12] += cardConf.parameter;
                                        }
                                    }
                                } else if (cardConf.key == 'damage') {
                                    // 提升伤害加成
                                    for (var hid in attackerInfo.fight_info.pos) {
                                        if (hid && hid > 0) {
                                            attackerInfo.fight_info.pos[hid].attr[11] += cardConf.parameter;
                                        }
                                    }
                                }
                            }
                        }

                        // 城池效果
                        var attrs = gConfLegionWarCity[city]['atts' + targetCity.buffLevel];
                        var values = gConfLegionWarCity[city]['value' + targetCity.buffLevel];
                        var enemyPos = enemyInfo.fight_info.pos;
                        for (var i = 0, len = attrs.length; i < len; i++) {
                            for (var hid in enemyPos)
                                if (attrs[i] >= Attribute.ATK && attrs[i] <= Attribute.HP) {
                                    enemyPos[hid].attr[attrs[i]] = Math.floor(enemyPos[hid].attr[attrs[i]] * (1 + values[i]/100));
                                } else {
                                    enemyPos[hid].attr[attrs[i]] += values[i];
                                }
                        }


                        // 返回敌方玩家数据
                        callback(null, {
                            rand1: common.randRange(0, 99999),
                            rand2: common.randRange(0, 99999),
                            info: attackerInfo,
                            enemy: enemyInfo,
                            power: targetArm.power,
                        });
                    }
                });
            }
        });
    },

    fight: function(lid, city, arm, attacker, star, power, callback) {
        var _me = this;

        if (this.stage != StageType.FIGHT) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var report = {};
        _me.getLegion(lid, function(err, res){
            if (err) callback(err);
            else {
                var attackerLegion = res.runtime;
                var enemyLid = attackerLegion.enemy;

                // 检查是否有战斗数据
                var battle = _me.getBattle(enemyLid, city, arm);
                if (!battle) {
                    callback(ErrorCode.ERROR_BATTLE_TIMEOUT);
                    return;
                }

                // 检查是否攻击者
                if (battle.attacker != attacker) {
                    callback(ErrorCode.ERROR_NOT_THE_ATTACKER);
                    return;
                }

                // 删除战斗数据
                _me.delBattle(enemyLid, city, arm);

                // 攻击方名字
                var atkInfo = res.conf.members[attacker];
                report.attacker             = atkInfo.un;
                report.attacker_headpic     = atkInfo.headpic
                report.attacker_headframe   = atkInfo.headframe
                report.attacker_custom_king = atkInfo.custom_king;

                // 更新驻军数据
                _me.getLegion(enemyLid, function(err, eres){
                    if (err) callback(err);
                    else {
                        var targetLegion = eres.runtime;
                        var targetCity = targetLegion.cities[city];
                        var targetArm = targetCity.arms[arm];

                        // 防守方名字
                        var enemy = eres.conf.members[targetArm.uid]
                        report.defender = enemy.un;
                        report.defender_headpic = enemy.headpic
                        report.defender_headframe = enemy.headframe
                        report.defender_custom_king = enemy.custom_king;
                        // 战斗胜利与否
                        report.win = star > 0 || targetArm.power < power;
                        report.time = Date.getStamp();
                        // report.power = report.win ? 100 : power;
                        report.power = 0; //攻击方power,没有意义。。
                        targetCity.reports = targetCity.reports || [];
                        targetCity.reports.push(report);

                        var attackable = null;
                        var jumpable = null;
                        if (report.win) {
                            // 更新城池数据
                            targetArm.alive = false;
                            targetArm.power = 0;
                            targetCity.aliveArm -= 1;

                            if (targetCity.aliveArm == 0) {
                                // 更新军团数据
                                targetLegion.aliveCity -= 1;

                                // 给敌方加积分
                                attackerLegion.score += gConfLegionWarCity[city].score;
                                _me.markDirty('legion.' + lid + '.score');

                                if (targetLegion.aliveCity <= 0) {
                                    // 城池被攻破
                                    targetLegion.loseTime = Date.getStamp();
                                    _me.markDirty('legion.' + enemyLid + '.loseTime');
                                }
                                _me.markDirty('legion.' + enemyLid + '.aliveCity');
                            } else if (targetCity.aliveArm == 1) {
                                // 计算城池可攻击性
                                attackable = {};
                                jumpable = {};
                                markNextCitiesAttackable(targetLegion, city, attackable);
                                checkCityCanJumpable(targetLegion, city, true, jumpable);
                            }
                        } else {
                            targetArm.power -= power;
                        }

                        report.enemyPower = targetArm.power;

                        _me.markDirty('legion.' + enemyLid + '.cities.' + city);

                        if (attackable && jumpable) {
                            callback(null, { attackable: attackable, jumpable: jumpable });
                        } else {
                            callback(null, {});
                        }
                    }
                });
            }
        });
    },

    getCityAward: function(lid, cid, callback) {
        var _me = this;

        _me.getLegion(lid, function(err, res){
            if (err) callback(err);
            else {
                var enemyLid = res.runtime.enemy;

                _me.getLegion(enemyLid, function(err, eres){
                    if (err) callback(err);
                    else {
                        var targetCity = eres.runtime.cities[cid];

                        // 判断城池是否已经挂了
                        if (targetCity.aliveArm > 0) {
                            callback(ErrorCode.ERROR_CITY_IS_ALIVE);
                            return;
                        }

                        callback();
                    }
                });
            }
        });
    },

    // 通知所有世界服来取本轮结果
    notifyRoundResultToAllWorld : function () {
        var worldReq = {
            uid : 1,
            mod : 'legionwar',
            act : 'handle_round_result',
            args : {}
        }
        var worldResp = {};
        this.broadcastToAllWorld(worldReq, worldResp, function () {
            DEBUG('notifyRoundResultToAllWorld finish');
        });
    },

    getRoundResult: function(lids, callback) {
        if (this.stage != StageType.IDLE) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var round = this.round - 1;
        Storage.getRoundResult(round, function(err, res){
            if (err) callback(err);
            else {
                var info = res.info;

                var infos = [];
                lids.forEach(function(lid){
                    infos.push(info[lid] || {
                            lid: lid,
                            win: false,
                            score: 0,
                        }
                    );
                });

                callback(null, infos);
            }
        });
    },

    getHistory: function(lid, callback) {
        Storage.getRoundHistory(function(err, histories){
            if (err) callback(err);
            else {
                var infos = [];
                histories.forEach(function(history){
                    if (history.info.hasOwnProperty(lid)) {
                        var rHistory = {
                            time: history.time,         // 这轮结束时间
                            own: history.info[lid],     // 这轮本方数据
                        };
                        rHistory.round = history._id;
                        rHistory.enemy = history.info[rHistory.own.enemy];  // 这轮敌方数据
                        infos.push(rHistory);
                    }
                });
                callback(null, infos);
            }
        });
    },

    getWorldRankList: function(lid, callback) {
        Storage.getRankList(function(err, ranklist){
            if (err) callback(err);
            else {
                // 返回的排行榜长度
                var LIST_SIZE = 20;

                // 排行榜数据
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
                        lid: rankInfo.lid,                                  // 军团id
                        sid: rankInfo.sid,                                  // 服务器编号
                        name: rankInfo.name,                                // 军团名字
                        icon: rankInfo.icon,                                // 军团图标
                        score: rankInfo.score,                              // 军团当前积分
                        level: rankInfo.level                               // 军团等级
                    });
                }

                // 构建自己军团的数据
                var myRank = -1;
                var myInfo = {};
                if (rankLegions.hasOwnProperty(lid)) {
                    myRank = LegionWarCom.findLegionIndex(rank, 'lid', lid) + 1;
                    var rankLegion = rankLegions[lid];

                    myInfo = {
                        sid: rankLegion.sid,                        // 服务器编号
                        lid: rankLegion.lid,                        // 军团id
                        name: rankLegion.name,                      // 军团名字
                        icon: rankLegion.icon,                      // 军团图标
                        rank: myRank,                               // 当前排名
                        score: rankLegion.score,                    // 当前积分
                        lastRank: rankLegion.lastRound,             // 上次排名
                        lastScore: rankLegion.lastScore,            // 上次积分
                        level:rankLegion.level
                    };
                } else {
                    myInfo = {
                        curRank: myRank                             // 当前排名
                    };
                }

                callback(null, {
                    self: myInfo,
                    rank_list: rankInfos
                });
            }
        });
    },

    getRankInfo: function(lid, callback) {
        var ranks = {};
        for (var id in this.ranks) {
            if (!this.ranks.hasOwnProperty(id)) {
                continue;
            }

            ranks[id] = Object.keys(this.ranks[id]).length;
        }

        callback(null, {
            global: ranks
        });
    },

    checkTips: function(lid, uid, callback) {
        if (this.stage == StageType.PREPARE) {
            // 准备时间
            var tips = [];

            this.getLegion(lid, function(err, res){
                if (err) callback(err);
                else {
                    var legionConf = res.conf;
                    var legionRuntime = res.runtime;

                    // 检查是否还能上阵
                    for (var uid in legionConf.members) {
                        if (!legionConf.members.hasOwnProperty(uid)) {
                            continue;
                        }

                        if (legionRuntime.garrison[uid] != +(gConfGlobalNew.legionWarDispatchNum)) {
                            tips.push('legionwar_canaddforce');
                            break;
                        }
                    }

                    callback(null, tips);
                }
            });

        } else if (this.stage == StageType.FIGHT || this.stage == StageType.IDLE) {
            // 战斗时间 或者 休息时间
            this.getLegion(lid, function(err, res){
                if (err) callback(err);
                else {
                    var legionConf = res.conf;
                    var legionRuntime = res.runtime;

                    // 检查已经攻破的城池
                    var deadCities = [];
                    for (var cid in legionRuntime.cities) {
                        if (!legionRuntime.cities.hasOwnProperty(cid)) {
                            continue;
                        }
                        cid = +cid;

                        if (legionRuntime.cities[cid].aliveArm == 0) {
                            deadCities.push(cid);
                        }
                    }

                    callback(null, {
                        awardCity: deadCities
                    });
                }
            });

        } else {
            callback(null, {});
        }
    },

    getCityBufSpeed : function (lid, uid, callback) {
        var legion = this.legion[lid];
        if (!legion) {
            callback(ErrorCode.ERROR_INVALID_ARGS);
            return;
        }

        var member = legion.members[uid];
        if (!member) {
            callback(ErrorCode.ERROR_PLAYER_NOT_IN_OWN_LEGION);
            return;
        }

        var data = {
            speed : member.city_buff_speed,
        };
        callback(0, data);
    },

    getEnemy: function (lid, enemy, callback) {
        var _me = this;
        _me.getLegion(lid, function(err, res) {
            if (err) callback(err);
            else {
                var enemyInfo = res.conf.members[enemy];
                if (!enemyInfo) {
                    callback(ERROR_LEGION_DONT_HAVE_USER);
                    return;
                }

                var info = {
                    un: enemyInfo.un,
                    level: enemyInfo.level,
                    vip: enemyInfo.vip,
                    pos: {},
                    headpic: enemyInfo.headpic,
                    headframe: enemyInfo.headframe,
                    dragon: enemyInfo.model,
                    weapon_illusion: enemyInfo.weapon_illusion,
                    mount_illusion: enemyInfo.wing_illusion,
                    custom_king: enemyInfo.custom_king,
                    server_id: common.getServerId(enemy),
                };
                for (var p in enemyInfo.fight_info.pos) {
                    info.pos[p] = {
                        rid: enemyInfo.fight_info.pos[p].rid,
                        fight_force: enemyInfo.fight_info.pos[p].fight_force,
                        tier: enemyInfo.fight_info.pos[p].tier,
                        level: enemyInfo.fight_info.pos[p].level,
                        awake:enemyInfo.fight_info.pos[p].awake,
                    };
                }
                callback(null, {info: info});
            }
        });
    },

    leaveLegion: function (lid, uid, callback) {
        if (this.stage != StageType.PREPARE) {
            callback(ErrorCode.ERROR_STAGE_NOT_FIT);
            return;
        }

        var buffingCity = this.getUserBuffingCity(uid, lid);
        if (buffingCity == -1) {
            callback(ErrorCode.ERROR_PLAYER_NO_BUFF_CITY);
            return;
        }

        var legion = this.legion[lid];
        var legionCity = legion.cities[buffingCity];

        var index = legionCity.buff_members.indexOf(uid);
        if (index < 0) {
            callback(ErrorCode.ERROR_PLAYER_NO_BUFF_CITY);
            return;
        }

        // 结算发奖
        var _me = this;
        this.calculateCityBuff(lid, buffingCity, true);
        this.getAccumulateLegionwar(uid, function (err, data) {
            if (err) return;

            var serverId = common.getServerId(uid)
            var serverInfo = _me.getServerInfo(serverId);
            if (serverInfo) {
                var req = {
                    uid: uid,
                    mod: 'mail',
                    act: 'add_upgrade_city_award_mail',
                    args: {
                        awards: data.award,
                    },
                };
                requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, {});
            }
        });

        legionCity.buff_members.splice(index, 1);
        if (legionCity.buff_members.length == 0) {
            legionCity.last_buff_calculate_time = 0;
        }
        this.markDirty(util.format('legion.%d.cities.%d', lid, buffingCity));
    },
};

exports.LegionWar = LegionWar;

function markNextCitiesAttackable(legion, city, attackable) {
    var cities = legion.cities;

    var parents = CITY_PATHS[city].out;
    for (var idx in parents) {
        if (!parents.hasOwnProperty(idx)) {
            continue;
        }

        var parentCity = cities[parents[idx]];
        if (!parentCity.canAttack) {
            parentCity.canAttack = true;
            gLegionWar.markDirty('legion.' + legion.lid + '.cities.' + city);
            attackable[parents[idx]] = 1;

            if (parentCity.aliveArm <= 1) {
                // 该城已经可以通过，继续往下标记
                markNextCitiesAttackable(legion, parents[idx], attackable);
            }
        }
    }
}

// 检查城池可攻击状态
function checkCityAttackable(legion, cid, mark, map) {
    var cities = legion.cities;
    var city = cities[cid];

    if (!city.canAttack) {
        return;
    }

    if (city.aliveArm <= 1) {
        // 当前城池连接的下一级节点城池可以攻击

        var parents = CITY_PATHS[cid].out;
        for (var idx in parents) {
            if (!parents.hasOwnProperty(idx)) {
                continue;
            }

            // 标记城池可攻击
            var parentCid = parents[idx];
            var parentCity = cities[parentCid];
            if (!parentCity.canAttack) {
                parentCity.canAttack = true;
                if (mark) {
                    gLegionWar.markDirty('legion.' + legion.lid + '.cities.' + parentCid);
                }

                if (map) {
                    map[parentCid] = 1;
                }

                // 检查这个城池的下级节点
                checkCityAttackable(legion, parentCid, mark, map);
            }
        }
    }
}

function checkCityCanJumpable(legion, cid, mark, map) {
    var cities = legion.cities;
    var city = cities[cid];

    // 标记这个城池为可跳跃攻击的城池
    city.canJump = true;
    if (mark) {
        gLegionWar.markDirty('legion.' + legion.lid + '.cities.' + cid);
    }
    if (map) {
        map[cid] = 1;
    }

    // 计算检查后续节点
    if (city.canAttack) {
        var parents = CITY_PATHS[cid].out;
        for (var idx in parents) {
            if (!parents.hasOwnProperty(idx)) {
                continue;
            }

            var parentCid = parents[idx];
            var parentCity = cities[parentCid];
            if (!parentCity.canJump) {
                checkCityCanJumpable(legion, parentCid, mark, map);
            }
        }
    }
}

function assignCityForce(legion, cid, garrison) {
    if (Object.isEmpty(garrison)) {
        return;
    }

    var legionGarrion = legion.garrison;
    var cities = legion.cities;
    var city = cities[cid];

    // 向这个城池上人
    var needArm = Object.keys(city.arms).length - city.aliveArm;
    if (needArm > 0) {
        // 准备要上的人
        var armUids = [];
        for (var uid in garrison) {
            if (!garrison.hasOwnProperty(uid)) {
                continue;
            }

            armUids.push(+uid);

            needArm -= 1;
            if (needArm <= 0) {
                break;
            }
        }

        // 上人
        if (armUids.length > 0) {
            var arms = city.arms;
            for (var pos in arms) {
                if (!arms.hasOwnProperty(pos)) {
                    continue;
                }

                if (armUids.length <= 0) {
                    break;
                }

                var arm = arms[pos];
                if (arm.uid != 0) {
                    continue;
                }

                // 把这个人放上去
                arm.uid = armUids.pop();
                arm.power = 100;
                city.aliveArm += 1;
                legionGarrion[arm.uid] = (isNaN(legionGarrion[arm.uid])) ? 1 : (legionGarrion[arm.uid] + 1);
                legion.garrison = legionGarrion;

                // 修改可用玩家数据
                garrison[arm.uid] -= 1;
                if (garrison[arm.uid] <= 0) {
                    delete garrison[arm.uid];
                }
            }
        }
    } else {
        return;
    }

    // 向父节点上人
    var parents = CITY_PATHS[cid].out;
    for (var idx in parents) {
        if (!parents.hasOwnProperty(idx)) {
            continue;
        }

        var parentCid = parents[idx];
        assignCityForce(legion, parentCid, garrison);
    }
}

/**
 * 城池连接图
 */
var CITY_PATHS = {
    1: { in: [2,3,5], out: [] },
    2: { in: [4], out: [1] },
    3: { in: [6], out: [1] },
    4: { in: [7,9], out: [2,7] },
    5: { in: [7,8,10], out: [1,7,8] },
    6: { in: [8,11], out: [3,8] },
    7: { in: [4,5], out: [4,5] },
    8: { in: [5,6], out: [5,6] },
    9: { in: [12,14], out: [4,12] },
    10: { in: [12,13], out: [5] },
    11: { in: [16,13], out: [6,13] },
    12: { in: [9,13,14,15], out: [9,10,13] },
    13: { in: [11,12,15,16], out: [10,11,12] },
    14: { in: [], out: [9,12] },
    15: { in: [], out: [12,13] },
    16: { in: [], out: [11,13] }
};
