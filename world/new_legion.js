var ErrorCode = require('../common/legiondefine.js').ErrorCode;

function NewLegion() {
    this.ai = 0;
    this.legions = {
        /*
        lid:{
            lid:0,                      // 唯一id
            name:'',                    // 名字
            xp:0,                       // 经验
            level:0,                    // 等级
            icon:[0,0],                 // 旗帜面，旗帜花纹
            notice:'',                  // 公告
            build:0,                    // 建设度
            join_way: 0|1|2,            // 申请方式   0：不可加入   1：直接加入    2：申请加入
            join_term:{                 // 加入军团条件
                level:0                 // 等级
            },

            logs:[[id,time,arg1,arg2]],                    // 日志
            member_list:{               // 成员信息
                uid:{
                    uid:0,              // 成员uid
                    duty:leader|deputy|elite|normal,       // 职位   1/2/3/4 团长, 副团长, 精英, 成员
                    join_time:0         // 入队时间
                    contribution : 0      // 贡献
                }
            },
            apply_list:{                // 申请列表
                // 玩家uid:申请时间
            },
            impeach:{                   // 弹劾
                uid:0,                  // 发起弹劾玩家id
                time:0                  // 发起弹劾的时间
            },
            bonfire_time:[0,0]          // 篝火活动 [时,分]    时：配置表id   分：固定id  每天5点计算  重启服务器计算
            next_fire_time : [0, 0],    // 明日篝火时间

            // 军团boss
            boss : {
                id : 0,     // boss id
                level : 0,  // boss等级
                hp : 0,     // boss当前生命值
                daily_kill_count : 0, // 每日击杀数量
                inspire_val : 0,    // 鼓舞加的值

                // 伤害列表
                damage_rank : {
                    uid : damage,
                },

                last_kill_Level: 0, // 上一次击杀的boss等级
                first_kill_award_level : 0, // 首杀奖励等级，0表示没有
            }
        }
        */
    };

    // 加入篝火人员信息
    this.bonfireMemberList = {
        /* lid:{
         uid:time,
         uid:time
         }*/
    };

    // 篝火数据
    this.bonfireData = {
        /*
        lid : {
            open_time:0,                // 开启时间     时间戳
            level:1,                    // 等级
            level_time:[],              // 升级时间
            xp:0,                       // 经验
            red_gift: {                 // 1-5：等级红包      6：木材红包     7：火焰红包
                operate1: 0,
                operate2: 0,
                level1: 0,
                level2: 0,
                level3: 0,
                level4: 0,
                level5: 0
            },

            join_list : {
                uid : time,
            },
        }
         */
    };

    // 每日贡献
    this.dailyContribution = {
        /*
        uid : [0, 0, 0],
         */
    };

    // 玩家所在军团   内存数据
    this.userLegion = {
        // uid:lid
    };

    // 申请军团记录    内存数据
    this.applyList = {
        // uid : [lid,lid]      申请人，申请的军团lid
    };

    // 固定篝火开启时间  分钟数
    this.ConfBonfireMTime = ['00', '10', '20', '30', '40', '50'];

    this.dirty = {};

    this.ranks = new RankTree(// 军团排行
        // 存储对象 [lid, xp]
        function (c1, c2) {
            // 同一军团作为相等, 用于删除
            if (c1[0] == c2[0]) return 0;

            // 不同军团按照经验值排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c1[0] - c2[0];
        }, gConfGlobalNew.rankListLimit_legion);

    // boss伤害排行
    this.bossDamageRank = new RankTree(
        function (c1, c2) {
            // 同一军团作为相等, 用于删除
            if (c1[0] == c2[0]) return 0;

            if (c1[2] && c2[2]) {
                if (c1[2] > c2[2]) return -1;
                if (c1[2] < c2[2]) return 1;
            }

            // 不同军团按照经验值排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c2[0] - c1[0];
        }, gConfGlobalNew.rankListLimit_legion
    );

    // mvp数据
    this.bossMvpList = {
        /*
        lid : {
            uid : 0,
            damage : 0,
        }
         */
    };

    // 军团战斗力，临时数据
    this.legionFightForce = {};

    // 记录上次结算时间, 避免重复结算
    this.last_calc_time = {};
}

NewLegion.create = function (callback) {
    var newLegionData = {
        _id: 'new_legion',
        ai: require('../config').ServerId * 1000000,
        legions: {},
        bonfireData: {},
        dailyContribution: {},
    };
    gDBWorld.insert(newLegionData, function (err, result) { callback && callback() });
};

NewLegion.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'new_legion' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.ai = doc.ai;
                this.legions = doc.legions;
                this.bonfireData = doc.bonfireData;
                this.dailyContribution = doc.dailyContribution;

                if (!this.legions) {
                    this.legions = {};
                    this.markDirty('legions');
                }

                if (!this.bonfireData) {
                    this.bonfireData = {};
                    this.markDirty('bonfireData');
                }

                if (!this.dailyContribution) {
                    this.dailyContribution = {};
                    this.markDirty('dailyContribution');
                }

                if (!this.bossMvpList) {
                    this.bossMvpList = {};
                }

                var legions = this.legions;
                for (var lid in legions) {
                    var nLid = parseInt(lid);
                    var legion = legions[nLid];

                    var del = {};
                    var memberList = legion.member_list;
                    for (var uid in memberList) {
                        uid = +uid;
                        // 初始化玩家所在军团    uid : lid

                        if (this.userLegion[uid]) {
                            del[uid] = true;
                            continue
                        }

                        this.userLegion[uid] = lid;
                    }

                    for (var uid in del) {
                        delete memberList[uid];
                    }

                    var applyList = legion.apply_list;
                    for (var uid in applyList) {
                        uid = +uid;
                        // 初始化申请军团记录    uid:[lid,lid]
                        if (!this.applyList[uid]) {
                            this.applyList[uid] = [];
                        }

                        this.applyList[uid].push(nLid);
                    }

                    // 初始化篝火
                    this.initBonfire(lid);

                    // 初始化排名
                    this.ranks.insert([lid, this.calcFightForce(lid)]);

                    if (!legion.boss) {
                        legion.boss = {};
                        legion.boss.id = 0;
                        legion.boss.level = 1;
                        legion.boss.hp = 10000;
                        legion.boss.daily_kill_count = 0;
                        legion.boss.inspire_val = 0;
                        legion.boss.last_kill_Level = 0;
                        legion.boss.damage_rank = {};
                        this.markDirty(util.format('legions.%d.boss', lid));
                    } else {
                        this.bossMvpList[lid] = {};
                        var totalDamage = 0;
                        for (var uid in legion.boss.damage_rank) {
                            totalDamage += legion.boss.damage_rank[uid];

                            if (!this.bossMvpList[lid].uid) {
                                this.bossMvpList[lid].uid = uid;
                                this.bossMvpList[lid].damage = legion.boss.damage_rank[uid];
                            } else {
                                if (this.bossMvpList[lid].damage < legion.boss.damage_rank[uid]) {
                                    this.bossMvpList[lid].uid = uid;
                                    this.bossMvpList[lid].damage = legion.boss.damage_rank[uid];
                                }
                            }
                        }

                        if (totalDamage > 0) {
                            this.bossDamageRank.insert([lid, totalDamage, legion.boss.level]);
                        }
                    }

                    // 计算下军团等级，以防出错
                    this.calcLevel(lid);

                    if (legion.level >= parseInt(gConfGlobalNew.legionBossOpenLimit)) {
                        if (!legion.boss.id) {
                            this.resetBoss(lid);
                        } else {
                            // 军团boss开启了才初始化
                            this.initBossTimer(lid);
                        }
                    }
                }

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    // 初始化篝火
    initBonfire: function (lid, reset) {
        var legion = this.get(lid);
        if (!legion) {
            return
        }

        if (!legion.bonfire_time) {
            legion.bonfire_time = [gConfGlobalNew.legionBonfire_openTimeDefault, 1];
            this.markDirty(util.format('legions.%d.bonfire_time', lid));
        }

        if (!legion.next_fire_time) {
            legion.next_fire_time = [gConfGlobalNew.legionBonfire_openTimeDefault, 1];
            this.markDirty(util.format('legions.%d.next_fire_time', lid));
        }

        var hIndex = legion.bonfire_time[0];
        var mIndex = legion.bonfire_time[1];

        var hTime = gConfGlobalNew.legionBonfire_openTime.split('|')[hIndex - 1];
        var mTime = this.ConfBonfireMTime[mIndex - 1];
        var bonfireTime = hTime + ':' + mTime;

        var startTime = gNewLegion.formatTime(bonfireTime);
        if (!this.bonfireData[lid] || reset) {
            this.bonfireData[lid] = {};
            this.bonfireData[lid].open_time = startTime;
            this.bonfireData[lid].level_time = [];
            this.bonfireData[lid].level_time.push(startTime);
            this.bonfireData[lid].level = 0;
            this.bonfireData[lid].xp = 0;
            this.bonfireData[lid].red_gift = {};
            this.bonfireData[lid].red_gift.operate1 = 0;
            this.bonfireData[lid].red_gift.operate2 = 0;
            this.bonfireData[lid].red_gift.level1 = 0;
            this.bonfireData[lid].red_gift.level2 = 0;
            this.bonfireData[lid].red_gift.level3 = 0;
            this.bonfireData[lid].red_gift.level4 = 0;
            this.bonfireData[lid].red_gift.level5 = 0;
            this.bonfireData[lid].join_list = {};
        }

        this.markDirty(util.format('bonfireData.%d', lid));

        var curTime = common.getTime();
        var timeToStart = startTime - curTime;
        if (timeToStart > 0) {
            // 还没开始，加一个开始定时器
            var _me = this;
            setTimeout(function () {
                _me.onBonfireStart(lid);
            }, timeToStart * 1000);
        } else {
            // 已经开始了，设置一个结束的定时器
            var totalTime = gConfGlobalNew.legionBonfire_totalTime * 60; // 活动开启多久
            var endTime = startTime + totalTime;
            var timeToEnd = endTime - curTime;
            if (timeToEnd > 0) {
                var _me = this;
                setTimeout(function () {
                    _me.onBonfireEnd(lid);
                }, timeToEnd * 1000);
            }
        }
    },

    // 添加日常贡献
    addDailyContribution: function (uid, type, value) {
        if (!this.dailyContribution[uid]) {
            this.dailyContribution[uid] = [0, 0, 0];
            this.markDirty(util.format('dailyContribution.%d', uid));
        }

        if (value != 0) {
            this.dailyContribution[uid][type] += value;
            this.markDirty(util.format('dailyContribution.%d', uid));
        }
    },

    onBonfireStart: function (lid) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return;
        }

        var totalTime = gConfGlobalNew.legionBonfire_totalTime * 60; // 活动开启多久
        var startTime = bonfireData.open_time;  // 活动开启时间
        var endTime = startTime + totalTime;    // 结束时间
        var curTime = common.getTime();
        var timeToEnd = endTime - curTime;

        // 设置一个结束定时器
        if (timeToEnd > 0) {
            var _me = this;
            setTimeout(function () {
                _me.onBonfireEnd(lid);
            }, timeToEnd * 1000);
        }
    },

    onBonfireEnd: function (lid) {
        // 结算篝火奖励
        this.calcBonfireAwards(lid);
    },

    getLegionBonfireData: function (lid) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return null;
        }

        return bonfireData;
    },

    getBonfireInfo: function (lid, uid) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return {};
        }

        var isJoin = 0;
        if (bonfireData.join_list[uid]) {
            isJoin = 1;
        }

        var bonfireMsg = {
            xp: bonfireData.xp,
            red_gift: bonfireData.red_gift,
            is_join: isJoin
        };

        return bonfireMsg;
    },

    joinBonfire: function (lid, uid) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return;
        }

        // 当前军团加入篝火的人员信息
        if (!bonfireData.join_list) {
            bonfireData.join_list = {};
            this.markDirty(util.format('bonfireData.%d.join_list', lid));
        }

        bonfireData.join_list[uid] = common.getTime();
        this.markDirty(util.format('bonfireData.%d.join_list.%d', lid, uid));

        gNewLegion.pushToBonFire(lid, gUserInfo.getUser(uid), 2, 'join');
    },

    // 判断玩家是否加入篝火
    isUserJoinBonfire: function (uid) {
        var lid = this.getUserLegionId(uid);
        if (lid == -1) {
            return false;
        }

        if (!this.bonfireData[lid]) {
            return false;
        }

        if (!this.bonfireData[lid].join_list[uid]) {
            return false;
        }

        return true;
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
                    ERROR('INVALID SAVE LEGION: ' + item);
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
            gDBWorld.update({ _id: 'new_legion' }, updates, function (err, result) {
                if (err) {
                    ERROR({ updates: updates, err: err });
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            });
        }
        DEBUG('legion save end');
    },

    /**
     * 军团奖励操作   user.legion_exp:-100
     * @param lid
     * @param arr
     * @param account   取基础经验的百分比
     */
    markAwards: function (uid, lid, arr) {
        for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i][0] == 'user') {
                var type = arr[i][1];
                var num = +arr[i][2];
                switch (type) {
                    case 'legion_exp':      // 军团经验
                        if (!this.legions[lid].xp || this.legions[lid].xp < 0) {
                            this.legions[lid].xp = 0;
                        }

                        var legion_exp = num;
                        this.legions[lid].xp += legion_exp;

                        if (this.legions[lid].xp < 0) {
                            this.legions[lid].xp = 0;
                        }

                        this.markDirty(util.format('legions.%d.xp', lid));

                        // 增加成员贡献度
                        this.legions[lid].member_list[uid].contribution += parseInt(legion_exp * gConfGlobalNew.legionContributeConversionRate);
                        this.markDirty(util.format('legions.%d.member_list.%d', lid, uid));

                        this.calcLevel(lid);
                        break;
                    case 'legion_build':    // 建设度
                        this.legions[lid].build += num;
                        this.markDirty(util.format('legions.%d.build', lid));
                        this.addDailyContribution(uid, 0, num);
                        break;
                    case 'legion_bonfire':  // 篝火经验
                        this.bonfireData[lid].xp += num;
                        this.markDirty(util.format('bonfireData.%d.xp', lid));
                        this.bonfireTimeSplit(lid);
                        this.addDailyContribution(uid, 1, num);
                        break;
                }
            }
        }
    },

    get: function (lid) {
        if (this.legions[lid]) {
            return this.legions[lid];
        }
        return null;
    },

    resetBonfireData: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.bonfire_time = legion.next_fire_time;
        this.markDirty(util.format('legions.%d.bonfire_time', lid));

        // 重置篝火数据
        this.initBonfire(lid, true);
    },

    // 重置军团数据
    resetByDay: function () {
        var legions = this.legions;
        for (var lid in legions) {
            this.resetBonfireData(lid);

            // 重置军团建设度
            legions[lid].build = 0;
            this.markDirty(util.format('legions.%d.build', lid));

            if (legions[lid].level >= gConfGlobalNew.legionBossOpenLimit) {
                this.resetBoss(lid);
            }
        }

        // 清理每日贡献度
        this.dailyContribution = {};
        this.markDirty('dailyContribution');
    },

    // 重置军团
    resetByWeek: function () {
        /*var retainWish = this.kicks.wish;
        if (retainWish) {
            this.sendKicksWishMail();
        }

        this.sendListWishMail();*/
    },

    onBossEnd: function (lid) {
        // 发送boss奖励邮件
        this.calcBossAwards(lid);
        // mvp 日志
        var bossMvp = this.bossMvpList[lid];
        if (bossMvp && bossMvp.damage) {
            var mvpUid = bossMvp.uid;
            var mvpDamage = bossMvp.damage;
            this.addLog(lid, 14, gUserInfo.getUser(mvpUid).info.un, 2, mvpDamage);
        }
    },

    // 根据排名获取
    getBossRankAwards: function (rank) {
        var preRank = 1;
        var curRank = 1;

        var level = null;

        for (var i = 2; i <= Object.keys(gConfLegionBossRank).length; i++) {
            curRank = gConfLegionBossRank[i].rank;

            if (rank >= preRank && rank < curRank) {
                level = i - 1;
                break;
            }
        }

        if (level == null) {
            level = Object.keys(gConfLegionBossRank).max();
        }

        var awards = gConfLegionBossRank[level].award;
        return awards;
    },

    // 结算军团boss奖励
    calcBossAwards: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        var time = common.getTime();

        var joinUids = [];
        for (var i in legion.boss.damage_rank) {
            joinUids.push(parseInt(i));
        }

        // 参与奖
        var awards_join = gConfLegionBoss[legion.boss.level].award_join;
        if (awards_join && joinUids.length > 0) {
            var mail = {
                awards: 'legion_boss_join',
                time: time,
                expire: time + gConfMail[51].time * OneDayTime,
                content: [51],
                attach: {
                    lid: lid,
                    uids: joinUids,
                    awards: awards_join,
                },
            }

            gSysMail.add(mail, true);
        }

        // 首杀奖
        if (legion.boss.first_kill_award_level > 0) {
            var awards_first = gConfLegionBoss[legion.boss.first_kill_award_level].award_firstkill;
            if (awards_first) {
                var bossLevel = legion.boss.level;
                if (!bossLevel) {
                    bossLevel = 1;
                }
                var mail = {
                    awards: 'legion_boss_first_kill',
                    time: time,
                    expire: time + gConfMail[52].time * OneDayTime,
                    content: [52, bossLevel],
                    attach: {
                        lid: lid,
                        uids: joinUids,
                        awards: awards_first,
                    },
                }

                gSysMail.add(mail, true);
            }

            legion.boss.first_kill_award_level = 0;
            this.markDirty(util.format('legions.%d.boss.first_kill_award_level', lid));
        }

        // 排行奖励
        var bossRank = this.bossDamageRank.rankById(lid)
        if (bossRank) {
            var awards_rank = this.getBossRankAwards(bossRank);
            if (awards_rank) {
                var mail = {
                    awards: 'legion_boss_rank',
                    time: time,
                    expire: time + gConfMail[53].time * OneDayTime,
                    content: [53],
                    attach: {
                        lid: lid,
                        uids: joinUids,
                        rank: bossRank,
                        awards: awards_rank,
                    },
                }

                gSysMail.add(mail, true);
            }
        }
    },

    // 初始化boss定时器
    initBossTimer: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        var curTime = common.getTime();
        var bossTime = getLegionBossTime();
        var awardTime = bossTime[1] + gConfGlobalNew.legionBossAwardTime * 60;
        if (curTime < awardTime) {
            var remainTime = awardTime - curTime;
            var _me = this;
            setTimeout(function () {
                _me.onBossEnd(lid);
            }, remainTime * 1000);
        }
    },

    // 刷新军团boss
    resetBoss: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        if (legion.boss.level < Object.keys(gConfLegionBoss).max() && legion.boss.daily_kill_count > 0) {
            // boss可以升级
            legion.boss.level++;
        }

        if (legion.boss.level == 0) {
            legion.boss.level = 1;
        }

        legion.boss.daily_kill_count = 0;
        legion.boss.inspire_val = 0;
        legion.boss.hp = 10000;
        legion.boss.damage_rank = {};

        // 随机一个boss
        var formations = gConfLegionBoss[legion.boss.level].formation;
        var randBoss = common.randRange(0, formations.length - 1);
        var bossFormation = formations[randBoss] + legion.boss.level;
        legion.boss.id = bossFormation;

        this.markDirty(util.format('legions.%d.boss', lid));

        this.initBossTimer(lid);
    },

    updateRanks: function (uid) {
        var lid = this.userLegion[uid];
        if (lid && lid > 0) {
            this.ranks.update([lid, this.calcFightForce(lid)]);
        }
    },

    // 添加日志
    // @id  日志类型id
    addLog: function (lid, id, arg1, arg2, arg3) {
        var legion = this.legions[lid];
        if (!legion) {
            return;
        }

        var log = [id, common.getTime(), arg1 || null, arg2 || null, arg3 || null];
        legion.logs.unshift(log);

        if (legion.logs.length > gConfGlobalNew.legionLogLimit) {
            legion.logs.pop();
        }

        this.markDirty(util.format('legions.%d.logs', lid));
    },

    // 创建军团
    createLegion: function (name, icons, uid) {
        this.ai++;
        this.markDirty('ai');

        var lid = this.ai;
        var newLegionData = {
            lid: lid,
            name: name,
            xp: 0,
            level: 1,
            icon: icons,
            notice: '',
            build: 0,
            join_way: 1,
            join_term: {
                level: 0
            },
            member_list: {},
            apply_list: {},
            logs: [],
            impeach: {
                uid: 0,
                time: 0
            },
            bonfire_time: [gConfGlobalNew.legionBonfire_openTimeDefault, 1],
            next_fire_time: [gConfGlobalNew.legionBonfire_openTimeDefault, 1],
            boss: {
                id: 0,     // boss id
                level: 1,  // boss等级
                hp: 0,     // boss当前生命值(万分比)
                daily_kill_count: 0, // 每日击杀数量
                inspire_val: 0,    // 鼓舞加的值

                // 伤害列表
                damage_rank: {
                },

                last_kill_Level: 0, // 上一次击杀的boss等级
                first_kill_award_level: 0, // 首杀奖励等级，0表示没有
            }
        };

        this.legions[lid] = newLegionData;
        this.markDirty(util.format('legions.%d', lid));

        // 将玩家从申请列表中移除
        var applyList = this.applyList[uid];
        if (applyList && applyList.length > 0) {
            for (var i = 0, len = applyList.length; i < len; i++) {
                var applyLid = applyList[i];

                var legion = this.get(applyLid);
                if (legion) {
                    delete legion.apply_list[uid];
                    this.markDelete(util.format('legions.%d.apply_list', applyLid));
                }
            }
        }

        // 初始化篝火
        this.initBonfire(lid);

        // 初始化军团boss
        if (gConfGlobalNew.legionBossOpenLimit == 1) {
            this.resetBoss(lid);
        }

        // 添加成员
        var member = this.createMember(uid, lid, 'leader', 1);

        // 初始化排名
        this.ranks.insert([lid, this.calcFightForce(lid)]);

        // 日志
        this.addLog(lid, 1, gUserInfo.getUser(uid).info.un);

        return member
    },

    // 创建队员   创建军团的时候type为1   其他情况没有type
    createMember: function (uid, lid, duty, type) {
        var memberList = this.legions[lid].member_list;
        memberList[uid] = {
            uid: +uid,
            duty: duty,
            join_time: common.getTime(),
            contribution: 0
        };

        this.markDirty(util.format('legions.%d.member_list.%d', lid, uid));

        this.ranks.update([lid, this.calcFightForce(lid)]);

        // 内存数据   uid:lid
        this.userLegion[+uid] = lid;

        // 推送给所有人
        gNewLegion.pushToLegion(lid, gUserInfo.getUser(uid));

        if (!type) {
            this.addLog(lid, 3, gUserInfo.getUser(uid).info.un);

            // 推送给玩家军团信息
            var legion = this.get(lid);
            if (legion) {
                pushToUser(uid, 'self', {
                    mod: 'new_legion',
                    act: 'get',
                    legion: this.getLegionDetailInfo(lid),
                })
            }
        }

        return memberList[uid];
    },

    // 检测军团名字是否存在
    isNameExist: function (name) {
        var legions = this.legions;
        var exist = false;
        for (var i in legions) {
            var lid = parseInt(i);
            if (legions[lid].name == name) {
                exist = true;
                break;
            }
        }
        return exist;
    },

    getUserLegionId: function (uid) {
        if (this.userLegion.hasOwnProperty(uid)) {
            return this.userLegion[uid];
        }
        return -1;
    },

    // 获取玩家所在军团
    getUserLegion: function (uid) {
        var legion = null;
        try {
            var lid = this.userLegion[uid];
            legion = this.legions[lid];
        } catch (e) {

        }
        return legion;
    },

    // 获取玩家职位
    getDuty: function (uid) {
        var legion = this.getUserLegion(uid);
        if (legion) {
            var member = legion.member_list[uid];
            return member.duty;
        }

        return null;
    },

    // 离开军团  退出||踢出
    leaveLegion: function (uid, kicker) {
        var legion = this.getUserLegion(uid);
        if (!legion) {
            if (kicker) {
                legion = this.getUserLegion(kicker);
                if (!legion) {
                    return false;
                }
            }
        }

        var lid = legion.lid;
        if (legion.impeach.uid == uid) {
            legion.impeach.uid = 0;
            legion.impeach.time = 0;
            this.markDirty(util.format('legions.%d.impeach', lid));
        }

        delete legion.member_list[uid];
        this.markDelete(util.format('legions.%d.member_list.%d', lid, uid));

        delete this.userLegion[uid];

        var user = gUserInfo.getUser(uid);
        if (user) {
            gNewLegion.addLog(lid, 7, user.info.un);
        }

        gLegionWar.leaveLegion(lid, uid);
        return true;
    },

    // 解散军团
    dissolve: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        var memberList = legion.member_list;
        for (var i in memberList) {
            var uid = parseInt(i);
            delete this.userLegion[uid];
        }

        delete this.legions[lid];
        this.markDelete(util.format('legions.%d', lid));
    },

    // 获取军团人数
    getMemberCount: function (lid) {
        var legion = this.get(lid);
        if (legion) {
            var memberList = legion.member_list || {};
            return Object.keys(memberList).length;
        }

        return 0;
    },

    // 计算军团战斗力
    calcFightForce: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return 0;
        }

        var memberList = legion.member_list;
        var countFightForce = 0;
        for (var uid in memberList) {
            uid = +uid;
            var fightForce = 0;
            var user = gUserInfo.getUser(uid);
            if (user) {
                for (var p in user.pos) {
                    fightForce += user.pos[p].fight_force;
                }
            }

            countFightForce += fightForce;
        }

        this.legionFightForce[lid] = countFightForce;
        return countFightForce;
    },

    // 返回军团概要信息
    getLegionInfo: function (lid, needMember) {
        var legion = this.get(lid);
        if (!legion) {
            return null;
        }

        var legionMsg = {
            lid: legion.lid,
            name: legion.name,
            level: legion.level,
            icon: legion.icon,
            join_way: legion.join_way,
            join_term: legion.join_term,
            cur_member: this.getMemberCount(lid),
            rank: this.ranks.rankById(lid),
            fight_force: this.calcFightForce(lid),
            leader_name: this.getLeaderName(lid),
        };

        if (needMember) {
            legionMsg.member_list = this.getMainMembers(lid);
        }

        return legionMsg;
    },

    // 判断是否有人申请加入
    hasApplyPlayer: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        if (legion.apply_list && Object.keys(legion.apply_list).length > 0) {
            return true;
        }

        return false;
    },

    // 返回军团详细信息
    getLegionDetailInfo: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return null;
        }

        var legionMsg = {
            lid: legion.lid,
            name: legion.name,
            xp: legion.xp,
            level: legion.level,
            icon: legion.icon,
            notice: legion.notice,
            join_way: legion.join_way,
            join_term: legion.join_term,
            member_list: this.getLegionMemberList(lid),
            bonfire_open_time: legion.bonfire_time,
            bonfire_next_time: legion.next_fire_time,
            rank: gNewLegion.ranks.rankById(legion.lid),
            impeach: legion.impeach,
        };

        return legionMsg;
    },

    // 获取主要成员信息，军团长，副军团长
    getMainMembers: function (lid) {
        var memberList = {};
        var legion = this.get(lid);
        if (legion) {
            for (var uid in legion.member_list) {
                if (legion.member_list[uid].duty == 'leader' || legion.member_list[uid].duty == 'deputy') {
                    memberList[uid] = clone(legion.member_list[uid]);
                    var memberUser = gUserInfo.getUser(uid);
                    if (memberUser) {
                        memberList[uid].vip = memberUser.status.vip;
                        memberList[uid].un = memberUser.info.un;
                        memberList[uid].level = memberUser.status.level;
                        memberList[uid].headpic = memberUser.info.headpic;
                        memberList[uid].headframe = memberUser.info.headframe;
                        memberList[uid].custom_king = memberUser.custom_king;
                    }
                }
            }
        }

        return memberList;
    },

    getLegionMemberList: function (lid) {
        var memberList = {};
        var legion = this.get(lid);
        if (legion) {
            for (var uid in legion.member_list) {
                memberList[uid] = clone(legion.member_list[uid]);
                var memberUser = gUserInfo.getUser(uid);
                if (memberUser) {
                    var fightForce = gUserInfo.getUserFightForce(uid);
                    memberList[uid].uid = uid;
                    memberList[uid].vip = memberUser.status.vip;
                    memberList[uid].un = memberUser.info.un;
                    memberList[uid].level = memberUser.status.level;
                    memberList[uid].headpic = memberUser.info.headpic;
                    memberList[uid].headframe = memberUser.info.headframe;
                    memberList[uid].custom_king = memberUser.custom_king
                    memberList[uid].quality = gUserInfo.getUserQuality(uid);
                    memberList[uid].fight_force = fightForce;
                    memberList[uid].active_time = memberUser.mark.active_time;
                }
            }
        }

        return memberList;
    },

    getLeaderName: function (lid) {
        var leaderName = '';
        var legion = this.get(lid);
        if (legion) {
            for (var uid in legion.member_list) {
                if (legion.member_list[uid].duty == 'leader') {
                    var user = gUserInfo.getUser(uid);
                    if (user) {
                        leaderName = user.info.un;
                    }
                }
            }
        }

        return leaderName;
    },

    /**
     * 返回军团列表
     * @param lid       不需要显示的lid
     * @param uid       排除已经申请的队伍
     * @returns {*}
     */
    getLegionsList: function (lid, uid) {
        var legions = this.legions;
        var legionArr = [];
        for (var i in legions) {
            var key = parseInt(i);
            if (lid == key) {
                continue;
            }

            if (legions[key].join_way == 0) {
                continue;// 不可加入的军团
            }

            legionArr.push(key);
        }

        return legionArr.diff(this.applyList[uid]);
    },

    // 撤销申请 || 拒绝申请
    undoApply: function (uid, lid) {
        if (this.applyList && this.applyList[uid]) {
            this.applyList[uid].remove(lid);
        }

        var legion = this.get(lid);
        if (legion) {
            delete legion.apply_list[uid];
            this.markDelete(util.format('legions.%d.apply_list', lid));
        }
    },

    /**
     * 军团推送消息
     * @param type  推送给该权限的人  ||  该军团所有人
     */
    pushToLegion: function (lid, user, type) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        var memberList = legion.member_list;
        var uids = [];
        var applyType = '';
        if (type) {
            applyType = 'apply';
            for (var uid in memberList) {
                uid = +uid;
                if (gConfLegionJurisDiction[memberList[uid].duty][type]) {
                    uids.push(uid);
                }
            }
        } else {
            applyType = 'join';
            uids = Object.keys(memberList);
        }

        // type  :  join  ||   apply
        pushToGroupUser(uids, 'self', {
            mod: 'new_legion',
            act: 'join',
            un: user.info.un,
            type: applyType
        })
    },

    /**
     * 篝火活动
     * @param lid
     * @param user
     * @param type
     *   1、XXX抢到了XXXX
         2、XXX来到了篝火派对
         3、XXX离开了篝火派对
         4、XXX在加火时向大家发放了1个XXX
         5、在大家的努力下，篝火等级得到了提升
         6、一大波篝火红包来袭
         7、红包已经被抢走了
     */
    pushToBonFire: function (lid, user, type, arg2) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        if (!this.bonfireData[lid]) {
            return;
        }

        var bonfireData = this.bonfireData[lid];

        var uids = [];
        for (var joinId in bonfireData.join_list) {
            uids.push(parseInt(joinId));
        }

        pushToGroupUser(uids, 'self', {
            mod: 'new_legion',
            act: 'bonfire',
            xp: bonfireData.xp,
            red_gift: bonfireData.red_gift,
            msg: {
                type: type,
                arg1: user ? user.info.un : '',
                arg2: arg2
            }
        });
    },

    // 计算军团等级
    calcLevel: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return 0;
        }

        var level = legion.level;
        var exp = legion.xp;
        var maxLegionLv = Object.keys(gConfLegionLevel).length;
        for (var i = level; i <= maxLegionLv; i++) {
            var legionLvConf = gConfLegionLevel[i];
            if (!legionLvConf) continue;
            if (exp >= legionLvConf.xp) {
                if (i < maxLegionLv) {
                    level = i + 1;
                    exp -= legionLvConf.xp;
                } else {
                    level = maxLegionLv;
                    exp = legionLvConf.xp;
                }
            } else {
                break;
            }
        }


        if (level != legion.level || exp != legion.xp) {
            if (level != legion.level) {
                if (legion.boss.id == 0 && level >= gConfGlobalNew.legionBossOpenLimit) {
                    this.resetBoss(lid);
                }

                this.addLog(lid, 2, level);
            }
            legion.level = level;
            legion.xp = exp;
            this.markDirty(util.format('legions.%d.level', lid));
            this.markDirty(util.format('legions.%d.xp', lid));
        }

        return level

        // var level = 0, exp = 0;
        // for (var i in gConfLegionLevel) {
        //     exp += gConfLegionLevel[i].xp;
        //     if (exp > legion.xp) {
        //         level = +i;
        //         break;
        //     } else if (exp == legion.xp) {
        //         level = +i + 1;
        //         break;
        //     }
        // }
        //
        // if (legion.level != level) {
        //     legion.level = level;
        //     this.markDirty('legions.%d.level', lid);
        //     this.addLog(lid, 2, level);
        //
        //     if (legion.boss.id == 0 && level >= gConfGlobalNew.legionBossOpenLimit) {
        //         this.resetBoss(lid);
        //     }
        // }
        //
        // return level;
    },

    // 计算篝火等级
    calcBonfireLevel: function (lid) {
        if (!this.bonfireData[lid]) {
            return 0;
        }

        var bonfireData = this.bonfireData[lid];
        ;
        var level = 0;
        var maxLevel = Object.keys(gConfLegioBonfire).length;
        for (var i = 1; i <= maxLevel; i++) {
            if (bonfireData.xp >= gConfLegioBonfire[i].exp) {
                level = i;
            } else {
                break;
            }
        }

        return level;
    },

    // 检测升级，记录升级时间
    bonfireTimeSplit: function (lid) {
        if (!this.bonfireData[lid]) {
            return;
        }

        var bonfireData = this.bonfireData[lid];

        var oldLevel = bonfireData.level;
        var newLevel = this.calcBonfireLevel(lid);
        if (oldLevel != newLevel) {
            // 升级
            var curTime = common.getTime();
            bonfireData.level_time.push(curTime);
            bonfireData.level = newLevel;
            bonfireData.red_gift['level' + newLevel] = gConfLegioBonfire[newLevel].redPaperNum;
            this.markDirty(util.format('bonfireData.%d', lid));

            this.pushToBonFire(lid, null, 6, 'level' + newLevel);
        }
    },

    // 判断职位是否达到上限
    verifyDuty: function (lid, uid, duty) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        var memberList = legion.member_list;
        var dutyNum = 0;
        for (var i in memberList) {
            memberList[i].duty == duty && (dutyNum++)
        }

        if (duty == 'deputy') {
            if (dutyNum >= gConfLegionLevel[legion.level].deputyNum) return false;
        } else if (duty == 'elite') {
            if (dutyNum >= gConfLegionLevel[legion.level].eliteNum) return false;
        }
        return true;
    },

    // duty是否合法
    isDuty: function (duty) {
        if (duty == 'deputy' || duty == 'elite' || duty == 'normal' || duty == 'leader') {
            return true;
        } else {
            return false;
        }
    },

    // 判断可以操作哪些下级
    operaDuty: function (uid, otherDuty) {
        var legion = this.getUserLegion(uid);
        if (!legion) {
            return false;
        }

        var duty = legion.member_list[uid].duty;
        if (!gConfLegionJurisDiction[duty].controlduty) {
            return false;
        }

        return gConfLegionJurisDiction[duty].controlduty.indexOf(otherDuty) > -1 ? true : false;
    },

    // 获取军团建设度
    getBuild: function (uid) {
        var legion = this.getUserLegion(uid);
        if (legion) {
            return legion.build;
        }

        return 0;
    },

    // 处理篝火开启时间
    // @bonfire_time    时:分
    formatTime: function (bonfire_time) {
        var bonfireTime = bonfire_time + ':00';
        var dateFormat = new Date().stdFormatedString().split(' ')[0] + ' ' + bonfireTime;
        return parseInt(new Date(dateFormat) / 1000);
    },

    // 结算篝火奖励
    calcBonfireAwards: function (lid) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return;
        }

        // 避免重复结算的问题
        var now = common.getTime();
        var last = this.last_calc_time[lid];

        if (last && now - last < 180) {
            DEBUG(`calcBonfireAwards repeated ! ${now}`);
            return;
        }

        this.last_calc_time[lid] = now;

        var awardList = {};
        var bonfireMember = bonfireData.join_list;
        for (var uid in bonfireMember) {
            uid = +uid;
            var awards = this.calcMemberAwards(lid, bonfireMember[uid]);
            awardList[uid] = awards;
        }

        // 发军团篝火邮件
        var time = common.getTime();
        for (var uid in bonfireMember) {
            if (awardList[uid].length > 0) {
                var mail = {
                    awards: awardList[uid],
                    time: time,
                    expire: time + gConfMail[20].time * OneDayTime,
                    content: [20],
                    attach: {

                    },
                }

                gMail.add(+uid, mail);
            }
        }
    },

    /**
     * 计算每一个成员篝火活动的经验
     * @param  lid
     * @param joinTime      玩家加入篝火活动的时间
     */
    calcMemberAwards: function (lid, joinTime) {
        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return;
        }

        var totalTime = gConfGlobalNew.legionBonfire_totalTime * 60; // 活动开启多久
        var limitTime = gConfGlobalNew.legionBonfire_expInterval;// 多少秒结算一次经验

        var startTime = bonfireData.open_time;  // 活动开启时间
        var endTime = startTime + totalTime;    // 结束时间

        if (joinTime > startTime) {  // 加入时间 > 活动开启时间   中途加入
            totalTime = endTime - joinTime;
        }

        var bonfireLevel = {};
        var levelTimeArr = bonfireData.level_time;
        levelTimeArr.push(endTime);

        // 统计每个等级对应加经验的次数
        var levelCount = levelTimeArr.length;
        var calcCount = Math.floor(totalTime / limitTime);
        for (var i = 0; i < calcCount; i++) {
            startTime += limitTime;
            for (var j = 0; j < levelCount; j++) {
                if (startTime <= levelTimeArr[j]) {
                    if (!bonfireLevel[j - 1]) {
                        bonfireLevel[j - 1] = 0;
                    }
                    bonfireLevel[j - 1] += 1;
                    break;
                }
            }
        }

        var awards = [];
        // 配置文件
        var confLegionLevel = gConfLegionLevel[this.calcLevel(lid)];
        if (confLegionLevel) {
            for (var lv in bonfireLevel) {
                var index = 0;
                while (index < +bonfireLevel[lv]) {
                    index++;
                    awards = awards.concat(confLegionLevel['bonfireAward' + lv]);
                }
            }
        }

        awards = reformAwards(awards);
        return awards;
    },

    // 获取玩家的申请列表
    getUserApplyList: function (uid) {
        return this.applyList[uid];
    },

    getHonorTopUid: function () {
        var topLegion = this.get(Object.keys(gNewLegion.legions).sort(function (l1, l2) {
            var legion1 = gNewLegion.legions[l1];
            var legion2 = gNewLegion.legions[l2];

            if (legion1.xp > legion2.xp) {
                return -1;
            }

            if (legion1.xp < legion2.xp) {
                return 1;
            }

            return l2 - l1;
        })[0]);

        if (topLegion) {
            return topLegion.master;
        } else {
            return 0;
        }
    },

    getHonorTopUser: function () {
        var uid = this.getHonorTopUid();
        if (uid) {
            return gUserInfo.getHonorUser(uid);
        } else {
            return null;
        }
    },

    // ==============================
    // 军团战的接口
    joinBeforeTime: function (lid, uid, time) {
        if (lid != this.userLegion[uid]) {
            return false;
        }

        var legion = this.get(lid);
        if (legion) {
            var userJoinTime = legion.member_list[uid].join_time || 0;
            return userJoinTime < time;
        }

        return false;
    },

    checkUserPrivilege: function (uid, duty) {
        var legion = this.get(this.userLegion[uid]);
        if (legion) {
            var userDuty = this.convertDutyToNo(legion.member_list[uid].duty);
            return userDuty <= duty;
        }
        return false;
    },

    enumationLegions: function (callback) {
        for (var lid in this.legions) {
            if (!this.legions.hasOwnProperty(lid)) {
                continue;
            }

            if (callback(this.legions[lid]) === false) {
                break;
            }
        }
    },

    // 增加军团经验
    addXp: function (lid, xp) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        legion.xp += xp;

        if (legion.xp < 0) {
            legion.xp = 0;
        }

        this.calcLevel(lid);

        // 通知领地战服务器军团等级变化
        var TerritoryWarReq = {
            uid: 1,
            mod: 'territorywar',
            act: 'api',
            args: {
                lid: lid,
                level: legion.level,
                legionWarLevel: gLegionWar.getLegionPersist(lid).level,
            },
        }

        requestTerritoryWar(TerritoryWarReq, {}, function () {

        });

        // 不能低于0
        if (legion.xp < 0) {
            legion.xp = 0;
        }

        this.markDirty(lid, 'xp');
        this.ranks.update([+lid, legion.xp]);
        return { 'level': legion.level, 'xp': legion.xp };
    },

    // 判断篝火是否开启
    isBonfireOpen: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        var curTime = common.getTime();
        var startTimeArr = legion.bonfire_time;
        if (!startTimeArr) {
            legion.bonfire_time = [gConfGlobalNew.legionBonfire_openTimeDefault, 1];
            this.markDirty(util.format('legions.%d.bonfire_time', lid));
            startTimeArr = legion.bonfire_time;
        }

        var hour = startTimeArr[0];
        var min = startTimeArr[1];

        var todayString = common.getDateString(+(new Date()) / 1000);
        var todayOpenString = todayString + ' ' + hour + ':' + min + ':00';
        var todayOpenTime = Date.parse(todayOpenString) / 1000;

        if (curTime >= todayOpenTime && curTime < todayOpenTime + gConfGlobalNew.legionBonfire_totalTime * 60) {
            return true;
        }

        return false
    },

    // 设置军团名称
    setLegionName: function (lid, newName) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.name = newName;
        this.markDirty(util.format('legions.%d.name', lid));
    },

    // 设置军团公告
    setLegionNotice: function (lid, newNotice, uid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.notice = newNotice;
        this.markDirty(util.format('legions.%d.notice', lid));

        var user = gUserInfo.getUser(uid);
        if (user) {
            this.addLog(lid, 9, user.info.un);
        }
    },

    // 设置军团加入条件
    setLegionJoinLimit: function (lid, joinWay, termLevel) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.join_way = joinWay;
        legion.join_term.level = termLevel;
        this.markDirty(util.format('legions.%d.join_way', lid));
        this.markDirty(util.format('legions.%d.join_term', lid));
    },

    // 清空军团的申请列表
    clearLegionApplyList: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        for (var uid in legion.apply_list) {
            this.undoApply(+uid, lid);
        }
    },

    // 设置军团旗帜
    setLegionIcon: function (lid, icons) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.icon = icons;
        this.markDirty(util.format('legions.%d.icon', lid));
    },

    // 设置明天篝火开启时间
    setBonfireNextOpenTime: function (lid, hIndex, mIndex) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        legion.next_fire_time = [hIndex, mIndex];
        this.markDirty(util.format('legions.%d.next_fire_time', lid));
    },

    // 添柴、加火
    addBonfireMaterial: function (lid, uid, type, special) {
        var legion = this.get(lid);
        if (!legion) {
            return 0;
        }

        var bonfireData = this.bonfireData[lid];
        if (!bonfireData) {
            return 0;
        }

        // 是否有特殊奖励
        if (special > -1) {
            bonfireData.red_gift['operate' + type] += 1;
            this.pushToBonFire(lid, gUserInfo.getUser(uid), 4, 'operate' + type);
        }

        var awards = gConfLegionLevel[legion.level]['bonfireOperateAward' + type];
        this.markAwards(uid, lid, awards);
        this.calcBonfireLevel(lid);

        // 日志
        if (type == 2 && special > -1) {
            this.addLog(lid, 13, gUserInfo.getUser(uid).info.un);
        }

        return bonfireData.xp;
    },

    // 增加鼓舞伤害值
    addInspireVal: function (lid, addVal) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        if (!legion.boss) {
            return;
        }

        if (addVal) {
            legion.boss.inspire_val += addVal;
            this.markDirty(util.format('legions.%d.boss.inspire_val', lid));
        }
    },

    // 更新boss伤害值，返回是否最后一击
    updateBossHp: function (uid, lid, damage) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        var lastShot = false;    // 是否是最后一击

        if (legion.boss.hp > damage) {
            legion.boss.hp -= damage;
        } else {
            // 击杀
            legion.boss.hp = 10000 - (damage - legion.boss.hp);
            if (legion.boss.hp <= 0) {
                legion.boss.hp = 10000;
            }

            legion.boss.daily_kill_count += 1;
            this.markDirty(util.format('legions.%d.boss.daily_kill_count', lid));
            lastShot = true;

            if (legion.boss.last_kill_Level != legion.boss.level) {
                legion.boss.last_kill_Level = legion.boss.level;
                this.markDirty(util.format('legions.%d.boss.last_kill_Level', lid));

                legion.boss.first_kill_award_level = legion.boss.level;
                this.markDirty(util.format('legions.%d.boss.first_kill_award_level', lid));

                // boss首杀日志
                this.addLog(lid, 14, gUserInfo.getUser(uid).info.un, 1, legion.boss.level);
            }
        }

        // 更新伤害排名
        if (!legion.boss.damage_rank[uid]) {
            legion.boss.damage_rank[uid] = damage;
        } else {
            legion.boss.damage_rank[uid] += damage;
        }

        // 刷新mvp列表
        if (this.bossMvpList[lid]) {
            if (this.bossMvpList[lid].uid) {
                if (this.bossMvpList[lid].damage < legion.boss.damage_rank[uid]) {
                    this.bossMvpList[lid].uid = uid;
                    this.bossMvpList[lid].damage = legion.boss.damage_rank[uid];
                }
            } else {
                this.bossMvpList[lid].uid = uid;
                this.bossMvpList[lid].damage = legion.boss.damage_rank[uid];
            }
        } else {
            this.bossMvpList[lid] = {};
            this.bossMvpList[lid].uid = uid;
            this.bossMvpList[lid].damage = legion.boss.damage_rank[uid];
        }

        this.updateBossDamageRank(lid);

        this.markDirty(util.format('legions.%d.boss.hp', lid));
        this.markDirty(util.format('legions.%d.boss.damage_rank.%d', lid, uid));

        return lastShot;
    },

    getBossMvp: function (lid) {
        if (this.bossMvpList[lid] && this.bossMvpList[lid].uid) {
            return this.bossMvpList[lid];
        }

        return 0;
    },

    updateBossDamageRank: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return;
        }

        var totalDamage = 0;
        for (var uid in legion.boss.damage_rank) {
            totalDamage += legion.boss.damage_rank[uid];
        }

        if (totalDamage > 0) {
            this.bossDamageRank.update([lid, totalDamage, legion.boss.level]);
        }
    },

    // 获取boss伤害排行榜
    getBossDamageRankList: function () {
        var rankList = [];

        var _me = this;
        this.bossDamageRank.each(function (data) {
            var lid = data[0];
            var damage = data[1];
            var legion = _me.get(lid);
            if (legion) {
                var info = {};
                info.lid = lid;
                info.name = legion.name;
                info.icon = legion.icon;

                info.boss = {};
                info.boss.level = legion.boss.level;
                info.boss.damage = damage;
                info.boss.inspire_val = legion.boss.inspire_val;

                info.boss_mvp = {};
                info.boss_mvp.uid = _me.getBossMvp(lid).uid;
                var mvpUser = gUserInfo.getUser(info.boss_mvp.uid);
                if (mvpUser) {
                    info.boss_mvp.un = mvpUser.info.un;
                    info.boss_mvp.headpic = mvpUser.info.headpic;
                    info.boss_mvp.headframe = mvpUser.info.headframe;
                    info.boss_mvp.vip = mvpUser.status.vip;
                    info.boss_mvp.custom_king = mvpUser.custom_king;
                }

                rankList.push(info);
            }
        });

        return rankList;
    },

    // 获取本军团boss伤害排名
    getLegionBossDamageRank: function (lid) {
        var legion = this.get(lid);
        if (!legion) {
            return [];
        }

        var rank_list = [];
        var damageRank = legion.boss.damage_rank;
        for (var uid in damageRank) {
            var memberUid = parseInt(uid);
            if (memberUid) {
                var user = gUserInfo.getUser(memberUid);
                if (user) {
                    var info = {};
                    info.uid = uid;
                    info.un = user.info.un;
                    info.damage = damageRank[uid];
                    info.fightForce = user.fight_force;

                    rank_list.push(info);
                }
            }
        }

        rank_list.sort(function (a, b) {
            return b.damage - a.damage;
        });

        return rank_list;
    },

    // 将string型的职务转成数字编号
    convertDutyToNo: function (duty) {
        var dutyNo = 4;
        if (duty == 'leader') {
            dutyNo = 1;
        } else if (duty == 'deputy') {
            dutyNo = 2;
        } else if (duty == 'elite') {
            dutyNo = 3;
        } else {
            dutyNo = 4;
        }
        return dutyNo;
    },

    getLeaderUid: function (lid) {
        var leaderUid = null;
        var legion = this.get(lid);
        if (legion) {
            for (var uid in legion.member_list) {
                if (legion.member_list[uid].duty == 'leader') {
                    leaderUid = uid;
                    break;
                }
            }

            // set new leader when no leader
            if (!leaderUid) {
                for (var uid in legion.member_list) {
                    legion.member_list[uid].duty = 'leader'
                    leaderUid = uid;
                    break;
                }
            }
        }

        return leaderUid;
    },

    // 获取领地boss信息，遍历军团列表
    notifyTerritoryBoss: function () {
        var legions = this.legions;
        var existLids = [];
        for (var lid in legions) {
            existLids.push(+lid);
        }

        var territoryReq = {
            uid: 1,
            mod: 'api',
            act: 'get_boss_info',
            args: {
                lids: existLids,
            }
        }
        var territoryResp = {
            code: 0,
            desc: '',
            data: {}
        };

        requestTerritoryWar(territoryReq, territoryResp, function () {
            var list = territoryResp.data.list;
            var endTime = getTerritoryBossEndTime();
            for (var lid in list) {
                var bossInfo = list[lid];
                if (bossInfo && bossInfo.hasOwnProperty('level')) {
                    // 给每个成员推送
                    var memberList = legions[+lid].member_list;
                    DEBUG(memberList);
                    for (var uid in memberList) {
                        pushToUser(+uid, 'self', {
                            mod: 'user',
                            act: 'territory_boss',
                            id: 2,
                            boss_info: bossInfo,
                            end_time: endTime,
                        });
                    }
                }
            }
        })
    },
};

// 创建军团
exports.create = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var name = req.args.name;
        var icons = req.args.icons;
        if (gNewLegion.isNameExist(name)) {
            resp.code = ErrorCode.ERROR_LEGION_NAME_EXIST; resp.desc = 'name is exits'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (legion) {
            resp.code = ErrorCode.ERROR_LEGION_ALREADY_EXIST; resp.desc = 'legion is exits'; break;
        }

        gNewLegion.createLegion(name, icons, uid);

        resp.data.legionMsg = gNewLegion.getLegionInfo(gNewLegion.getUserLegionId(uid));
    } while (false);

    onReqHandled(res, resp, 1);
};

// 进入主界面获取军团信息
exports.get = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.data.legionMsg = ""; break;
        }

        var impeachUid = legion.impeach.uid;
        var impeachTime = legion.impeach.time;// 发起弹劾的时间

        if (impeachUid && impeachTime) {
            var captainImpeachTime = gConfGlobalNew.legionCaptainImpeachTime * 3600;
            var lid = gNewLegion.userLegion[impeachUid];

            // 弹劾成功
            if (common.getTime() > impeachTime + captainImpeachTime) {
                var memberList = legion.member_list;
                var oldLeader = '';  // 以前的团长
                for (var i in memberList) {
                    if (memberList[i].duty == 'leader') {
                        oldLeader = i;
                        memberList[i].duty = 'normal';
                        break;
                    }
                }

                memberList[impeachUid].duty = 'leader';
                legion.impeach = { uid: 0, time: 0 };
                gNewLegion.markDirty('legions.' + lid + '.member_list');
                gNewLegion.markDirty('legions.' + lid + '.impeach');

                gNewLegion.addLog(lid, 13, gUserInfo.getUser(impeachUid).info.un, gUserInfo.getUser(oldLeader).info.un);
            }
            else {
                if (gNewLegion.getDuty(req.uid) == 'leader') { // 队长登录弹劾失败
                    legion.impeach = { uid: 0, time: 0 };
                    gNewLegion.markDirty('legions.' + lid + '.impeach');
                    DEBUG("legion leader online !!!, impeach failed");
                }
            }
        }

        var lid = legion.lid;

        resp.data.join_time = legion.member_list[uid].join_time;
        resp.data.bonfireMsg = gNewLegion.getBonfireInfo(lid, uid);
        resp.data.legionMsg = gNewLegion.getLegionDetailInfo(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 修改军团名
exports.modify_name = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var name = req.args.name;
        if (gNewLegion.isNameExist(name)) {
            resp.code = ErrorCode.ERROR_LEGION_NAME_EXIST; resp.desc = 'name is exits'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break
        }

        var duty = gNewLegion.getDuty(uid);
        if (!gConfLegionJurisDiction[duty].changeName) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        var lid = legion.lid;
        gNewLegion.setLegionName(lid, name);

        resp.data.legionMsg = gNewLegion.getLegionInfo(gNewLegion.userLegion[uid]);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 修改公告
exports.modify_notice = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var notice = req.args.notice;
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var duty = gNewLegion.getDuty(uid);
        if (!gConfLegionJurisDiction[duty].changeNotice) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        var lid = legion.lid;
        gNewLegion.setLegionNotice(lid, notice, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 退出军团
exports.logout = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var duty = gNewLegion.getDuty(uid);
        if (!gConfLegionJurisDiction[duty].leaveLegion) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break;
        }

        // 判断加入军团是否超过保护时间
        var member = legion.member_list[uid];
        var limitTime = parseInt(gConfGlobalNew.legionLeaveTimeLimit) * 3600;
        var curTime = common.getTime();
        if (member && curTime < member.join_time + limitTime) {
            resp.code = ErrorCode.ERROR_LEAVE_TIME_LIMIT; resp.desc = 'leave protect time'; break;
        }

        gNewLegion.leaveLegion(uid);
        resp.data.legionMsg = {};
    } while (false);

    onReqHandled(res, resp, 1);
};

// 解散军团
exports.dissolve = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var duty = gNewLegion.getDuty(uid);
        if (!gConfLegionJurisDiction[duty].breakLegion) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        if (gLegionWar.runtime.joined[legion.lid] && gLegionWar.stage != 3) {
            resp.code = ErrorCode.ERROR_CAN_NOT_DISSOLVE; resp.desc = 'Cannot dissolve during legionwar'; break
        }

        gNewLegion.dissolve(legion.lid);
        resp.data.legionMsg = {};
    } while (false);

    onReqHandled(res, resp, 1);
};

// 申请设置
exports.join_set = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var joinWay = req.args.joinWay;
        var termLevel = req.args.termLevel;
        if (joinWay == null || termLevel == null) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gConfLegionJurisDiction[legion.member_list[req.uid].duty].setApply) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'not manage'; break;
        }

        gNewLegion.setLegionJoinLimit(legion.lid, joinWay, termLevel);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 搜索军团
exports.search = function (req, res, resp) {
    do {
        var lid = +req.args.lid;
        var legion = gNewLegion.legions[lid];
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        resp.data.legion = gNewLegion.getLegionInfo(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团列表
exports.get_legions_list = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = 0;
        var legion = gNewLegion.getUserLegion(uid);
        if (legion) {
            lid = legion.lid;
        }

        // 筛选之后满足条件的军团
        var legionsArr = gNewLegion.getLegionsList(lid, uid);
        var len = legionsArr.length;

        var applyList = gNewLegion.applyList[uid];
        var applyListJson = {};
        if (applyList && applyList.length > 0) {
            for (var j = 0, lenj = applyList.length; j < lenj; j++) {
                var jLid = applyList[j];
                if (jLid) {
                    applyListJson[jLid] = gNewLegion.getLegionInfo(jLid);
                }
            }
        }

        var ranksArr = Object.keys(gNewLegion.ranks.idMap);

        // 排除已经选好的
        Array.prototype.noName = function (arr) {
            if (!arr || arr.length == 0) return this;
            return this.filter(function (a) {
                return arr.indexOf(a) <= -1
            })
        };

        function ss(from, to, arr, num, delArr) {
            var cur = ranksArr.slice(from - 1, to);
            delArr && (cur = cur.noName(delArr));

            for (var i = 0; i < num; i++) {
                var curArr = cur.noName(arr);
                var rg = common.randRange(0, curArr.length - 1);
                curArr[rg] && arr.push(curArr[rg]);
            }

            return arr;
        }

        // 军团列表
        var limit = gConfGlobalNew.legionRefreshLimit;
        var legionsListArr = [];
        var legionsList = {};
        if (len - (applyList && applyList.length || 0) >= limit) {
            var top1 = ss(1, len > 3 ? 3 : len, legionsListArr, 1, applyList);
            var top2 = ss(1, len > 20 ? 20 : len, top1, 3, applyList);
            var top3 = ss(1, len, top2, limit - 4, applyList);
            legionsListArr = top3;
        } else {
            legionsListArr = legionsArr;
        }

        for (var i = 0, length = legionsListArr.length; i < length; i++) {
            var iLid = legionsListArr[i];
            var legiond = gNewLegion.legions[iLid];
            if (!legiond) {
                DEBUG('can not find legion, id = ' + iLid);
                continue;
            }

            if (!legiond.lid || !legiond.name || !legiond.level || !legiond.icon) {
                delete gNewLegion.legions[iLid];
                gNewLegion.markDelete(util.format('legions.%d', iLid));
                continue;
            } else {
                legionsList[iLid] = gNewLegion.getLegionInfo(iLid)
            }
        }

        resp.data.applyList = applyListJson;
        resp.data.legionsList = legionsList;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 加入军团 || 申请
exports.join = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = +req.args.lid;
        var legion = gNewLegion.legions[lid];
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (gNewLegion.userLegion[uid]) {
            resp.code = ErrorCode.ERROR_ALREADY_HAS_LEGION; resp.desc = 'already has legion'; break;
        }

        if (gNewLegion.applyList[uid] && gNewLegion.applyList[uid].contains(lid)) {
            resp.code = ErrorCode.ERROR_ALREADY_APPLY; resp.desc = 'already apply'; break;
        }

        if (gNewLegion.getMemberCount(lid) >= gConfLegionLevel[legion.level].memberMax) {
            resp.code = ErrorCode.ERROR_MEMBER_COUNT_MAX; resp.desc = 'member is max count'; break;
        }

        var user = gUserInfo.getUser(uid);
        var joinWay = legion.join_way;
        if (joinWay == 0) {
            if (user.status.level < legion.join_term.level) {
                resp.code = ErrorCode.ERROR_CAN_NOT_JOIN; resp.desc = 'do not join legion'; break;
            }
        } else if (joinWay == 1) { // 直接加入
            var member = gNewLegion.createMember(uid, lid, 'normal');
            resp.data.legionMsg = gNewLegion.getLegionInfo(gNewLegion.userLegion[uid])
            resp.data.join_time = member.join_time;
        } else if (joinWay == 2) { // 申请
            if (gNewLegion.applyList[uid] && gNewLegion.applyList[uid].length >= gConfGlobalNew.legionApplyLimit) {
                resp.code = ErrorCode.ERROR_APPLY_COUNT_MAX; resp.desc = 'upper limit'; break;
            } else if (legion.apply_list && Object.keys(legion.apply_list).length >= gConfGlobalNew.legionApplyMax) {
                resp.code = ErrorCode.ERROR_APPLY_COUNT_MAX; resp.desc = 'upper limit'; break;
            }

            if (!legion.apply_list) {
                legion.apply_list = {};
                gNewLegion.markDirty(util.format('legions.%d.apply_list', lid));
            }

            legion.apply_list[uid] = common.getTime();
            gNewLegion.markDirty(util.format('legions.%d.apply_list.%d', lid, uid));

            if (!gNewLegion.applyList[uid]) {
                gNewLegion.applyList[uid] = [];
            }

            gNewLegion.applyList[req.uid].push(lid);

            // 推送给有权限的人
            gNewLegion.pushToLegion(lid, user, 'manageApply');
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 撤销申请
exports.undo = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = +req.args.lid;
        var legion = gNewLegion.legions[lid];
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        gNewLegion.undoApply(uid, lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 清空申请
exports.clear_apply = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gConfLegionJurisDiction[gNewLegion.getDuty(uid)].manageApply) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        var lid = legion.lid;
        gNewLegion.clearLegionApplyList(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团申请列表
exports.get_apply_list = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gConfLegionJurisDiction[gNewLegion.getDuty(uid)].manageApply) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        var lid = legion.lid;
        var applyList = legion.apply_list;

        var applyListJson = {};
        for (var uid in applyList) {
            uid = +uid;
            var user = gUserInfo.getUser(uid);
            if (user) {
                applyListJson[uid] = {
                    uid: uid,
                    un: user.info.un,
                    vip: user.status.vip,
                    headpic: user.info.headpic,
                    headframe: user.info.headframe,
                    level: user.status.level,
                    fight_force: gUserInfo.getUserFightForce(uid),
                    custom_king: user.custom_king,
                }
            }
        }

        resp.data.applyList = applyListJson;
        resp.data.curMember = gNewLegion.getMemberCount(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 申请管理操作
exports.set_apply = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var applyUid = +req.args.uid;
        var type = +req.args.type;

        var oldLegion = gNewLegion.getUserLegion(applyUid);
        if (type == 1) {
            if (oldLegion) {
                resp.code = ErrorCode.ERROR_OTHER_ALREADY_HAS_LEGION; resp.desc = 'already join legion'; break;
            }
        }

        var curLegion = gNewLegion.getUserLegion(uid);
        if (!curLegion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var member = curLegion.member_list[uid];
        if (!gConfLegionJurisDiction[member.duty].manageApply) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'not manage'; break;
        }

        var lid = curLegion.lid;
        gNewLegion.undoApply(applyUid, lid);
        if (type == 1) { // 同意加入
            resp.data.member = gNewLegion.createMember(applyUid, lid, 'normal');
            delete gNewLegion.applyList[applyUid];
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团成员
exports.get_member_list = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var memberListJson = {};
        var memberList = legion.member_list;
        var legionFightForce = 0;
        for (var uid in memberList) {
            uid = +uid;
            var user = gUserInfo.getUser(uid);
            if (user) {
                var fight_force = gUserInfo.getUserFightForce(uid);
                legionFightForce += fight_force;
                memberListJson[uid] = {
                    uid: uid,
                    un: user.info.un,
                    headpic: user.info.headpic,
                    headframe: user.info.headframe,
                    quality: gUserInfo.getUserQuality(uid),
                    vip: user.status.vip,
                    level: user.status.level,
                    fight_force: fight_force,
                    duty: memberList[uid].duty,
                    contribution: memberList[uid].contribution,
                    active_time: gUserInfo.getUser(uid).mark.active_time,
                    custom_king: user.custom_king,
                    join_time: memberList[uid].join_time,
                }
            }
        }

        resp.data.memberList = memberListJson;
        resp.data.legionFightForce = legionFightForce;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 职位任免
exports.set_duty = function (req, res, resp) {
    var opUid = +req.uid;
    do {
        var uid = +req.args.uid;
        var duty = req.args.duty;
        if (!uid || duty == null) {
            resp.code = 1; resp.desc = 'args invalid'; break
        }

        var legion = gNewLegion.getUserLegion(opUid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gNewLegion.isDuty(duty)) {
            resp.code = 114;
            resp.desc = 'duty is error';
            break
        }

        if (!gConfLegionJurisDiction[gNewLegion.getDuty(opUid)].operate || !gNewLegion.operaDuty(opUid, duty)) {
            var selfDuty = legion.member_list[opUid].duty;
            if (selfDuty != "leader" || duty != "leader") {
                resp.code = ErrorCode.ERROR_NO_PRIORITY;
                resp.desc = 'Permission denied';
                break
            }
        }

        var lid = legion.lid;
        if (!gNewLegion.verifyDuty(lid, uid, duty)) {
            resp.code = ErrorCode.ERROR_DUTY_COUNT_MAX; resp.desc = 'member is upper'; break
        }

        var member = legion.member_list[uid];
        if (!member) {
            resp.code = ErrorCode.ERROR_MEMBER_NOT_EXIST; resp.desc = 'not member'; break
        }

        // 降职
        if (gNewLegion.operaDuty(uid, duty)) {
            gNewLegion.addLog(lid, 11, gUserInfo.getUser(uid).info.un, member.duty)
        } else {
            if (duty == 'leader') {
                gNewLegion.addLog(lid, 5, gUserInfo.getUser(opUid).info.un, gUserInfo.getUser(uid).info.un)
            } else if (duty == 'deputy') {
                gNewLegion.addLog(lid, 4, gUserInfo.getUser(uid).info.un)
            } else {
                gNewLegion.addLog(lid, 10, gUserInfo.getUser(uid).info.un, duty)
            }
        }

        // 如果自己是队长，且任命目标玩家为队长，那就需要转移队长
        var memberSelf = legion.member_list[opUid];
        var selfDuty = memberSelf.duty;
        if (selfDuty == 'leader' && duty == 'leader') {
            memberSelf.duty = 'normal';
            gNewLegion.markDirty(util.format('legions.%d.member_list.%d', lid, opUid));
        }

        member.duty = duty;
        gNewLegion.markDirty(util.format('legions.%d.member_list.%d', lid, uid));

    } while (false);

    onReqHandled(res, resp, 1);
};

// 弹劾
exports.impeach = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var targetUid = +req.args.uid;
        if (!targetUid) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var memberList = legion.member_list;
        var member = memberList[targetUid];
        if (member.duty != 'leader') {
            resp.code = 115; resp.desc = 'not leader'; break;
        }

        var impeachLimit = gConfGlobalNew.legionCaptainImpeachLimit * 60 * 60;
        if (common.getTime - gUserInfo.getUser(uid).mark.active_time <= impeachLimit) {
            resp.code = ErrorCode.ERROR_CAN_NOT_IMPEACH; resp.desc = 'does not meet the conditions'; break;
        }

        if (!gConfLegionJurisDiction[gNewLegion.getDuty(uid)].impeachment) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break
        }

        if (legion.impeach.time && legion.impeach.uid) {
            resp.code = ErrorCode.ERROR_ALREADY_IMPEACH; resp.desc = 'already impeach'; break;
        }

        var lid = legion.lid;
        legion.impeach.time = common.getTime();
        legion.impeach.uid = req.uid;
        //gNewLegion.markDirty(util.format('legions.%d.impeach', lid));

        resp.data.impeach = legion.impeach;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 踢出军团
exports.kick_out = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var targetUid = +req.args.uid;
        if (!targetUid) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (targetUid == uid) {
            resp.code = ErrorCode.ERROR_CAN_NOT_KICK_SELF; resp.desc = 'can not kick self'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var duty = gNewLegion.getDuty(uid);
        var member = legion.member_list[targetUid];
        if (!member || !duty || !gConfLegionJurisDiction[duty].operate || !gNewLegion.operaDuty(uid, member.duty)) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break;
        }

        var activeTime = 0;
        var targetName = '';
        var targetUser = gUserInfo.getUser(targetUid);
        if (targetUser) {
            activeTime = targetUser.mark.active_time;
            targetName = targetUser.info.un;
        }

        var kickSetOpt = gConfGlobalNew.legionKickSet.split('|');
        var kickTime = kickSetOpt[0] * 3600;
        var costs = parseAwardsConfig(gConfGlobalNew.legionKickBaseCost);

        var lid = legion.lid;
        var histroyExp = member.contribution;
        if (common.time - activeTime > kickTime) {// 扣全额经验
            costs[0][2] = costs[0][2] + histroyExp * (1 + parseInt(kickSetOpt[1]) / 100);
        }

        // 检查军团经验够不够扣
        if (legion.xp < Math.abs(costs[0][2])) {
            resp.code = ErrorCode.ERROR_CAN_NOT_KICK_MEMBER; resp.desc = 'legion exp not enough'; break;
        }

        gNewLegion.markAwards(targetUid, lid, costs);

        resp.data.legionMsg = gNewLegion.getLegionInfo(lid);

        gNewLegion.addLog(lid, 8, targetName);
        gNewLegion.leaveLegion(targetUid, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 更换旗帜
exports.modify_icon = function (req, res, resp) {
    do {
        var icons = req.args.icons;
        var legion = gNewLegion.getUserLegion(req.uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gConfLegionJurisDiction[gNewLegion.getDuty(req.uid)].changeFlag) {
            resp.code = ErrorCode.ERROR_NO_PRIORITY; resp.desc = 'Permission denied'; break;
        }

        var lid = legion.lid;
        gNewLegion.setLegionIcon(lid, icons);

        resp.data.legionMsg = gNewLegion.getLegionInfo(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团建设信息
exports.get_build = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        resp.data.build = gNewLegion.getBuild(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 军团建设
exports.build = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var type = req.args.type;
        if (type == null) {
            resp.code = 1; resp.data = 'args invalid'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'not has legion'; break;
        }

        var awards = gConfLegionBuild[type].award;

        var lid = legion.lid;
        gNewLegion.markAwards(uid, lid, awards);

        var user = gUserInfo.getUser(uid);
        if (user) {
            gNewLegion.addLog(lid, 12, user.info.un, type);
        }

        resp.data.legionMsg = gNewLegion.getLegionInfo(gNewLegion.userLegion[uid])

        resp.data.build = gNewLegion.legions[lid].build;
        resp.data.legion_level = gNewLegion.legions[lid].level;
        resp.data.legion_xp = gNewLegion.legions[lid].xp;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 建设领取宝箱奖励
exports.get_build_awards = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var type = req.args.type;
        if (type == null) {
            resp.code = 1; resp.data = 'args invalid'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        // 判断是否可以领取奖励
        var buildLimit = gConfGlobalNew.legionBuildProgressLimit.split('|');
        if (!buildLimit.factor(legion.build).length) {
            resp.code = ErrorCode.ERROR_CAN_NOT_GET_AWARD; resp.desc = 'not awards'; break;
        }

        var level = legion.level || 1;
        var awards = gConfLegionLevel[level]['buildProgressAward' + type];
        resp.data.awards = awards;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 设置篝火开启时间
exports.set_bonfire_time = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var hTimeId = req.args.hTimeId;
        var mTimeId = req.args.mTimeId;

        if (!hTimeId || !mTimeId || !gConfGlobalNew.legionBonfire_openTime.split('|')[hTimeId - 1] || !gNewLegion.ConfBonfireMTime[mTimeId - 1]) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        var lid = gNewLegion.userLegion[uid];
        gNewLegion.setBonfireNextOpenTime(lid, hTimeId, mTimeId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 加入篝火活动
exports.join_bonfire = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (gNewLegion.isUserJoinBonfire(uid)) {
            resp.code = ErrorCode.ERROR_ALREADY_JOIN_BONFIRE; resp.desc = 'has join bonfire'; break;
        }

        var curTime = common.getTime();

        var openTime = legion.open_time;    // 开始时间
        var totalTime = gConfGlobalNew.legionBonfire_totalTime * 60;
        var readyTime = gConfGlobalNew.legionBonfire_prepareTime * 60;  // 准备时常

        if (curTime < openTime - readyTime) {
            // 未开启
            resp.code = ErrorCode.ERROR_BONFIRE_NOT_OPEN; resp.desc = 'not open'; break;
        }

        if (curTime > openTime + totalTime) {
            // 已结束
            resp.code = ErrorCode.ERROR_BONFIRE_HAS_FINISH; resp.desc = 'already end'; break;
        }

        var lid = legion.lid;
        gNewLegion.joinBonfire(lid, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 添加木材 || 火苗
exports.add_material = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var type = req.args.type;
        var special = req.args.special;//  special > -1 发送红包

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        if (!gNewLegion.isUserJoinBonfire(uid)) {
            resp.code = ErrorCode.ERROR_NOT_JOIN_BONFIRE; resp.desc = 'not join bonfire'; break;
        }

        var lid = legion.lid;
        var bonfireExp = gNewLegion.addBonfireMaterial(lid, uid, type, special);

        // 返回军团等级，计算奖励
        resp.data.level = legion.level;
        resp.data.xp = bonfireExp;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 抢红包
exports.grab_red_awards = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var type = req.args.type;

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var lid = legion.lid;
        var bonfireData = gNewLegion.getLegionBonfireData(lid);
        if (!bonfireData) {
            resp.code = 1; resp.desc = 'bonfire data is not exits'; break;
        }

        var redGift = bonfireData.red_gift;
        if (!redGift[type] || redGift[type] <= 0) {
            gNewLegion.pushToBonFire(lid, gUserInfo.getUser(uid), 7, type);
            resp.code = ErrorCode.ERROR_RED_GIFT_IS_GONE; resp.desc = 'type 7'; break;
        }

        redGift[type] -= 1;
        gNewLegion.markDirty(util.format('bonfireData.%d.red_gift', lid));

        resp.data.red_gift = redGift;
        resp.data.level = legion.level;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团日志
exports.get_logs = function (req, res, resp) {
    do {
        var legion = gNewLegion.getUserLegion(req.uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }
        resp.data.logs = legion.logs;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取贡献记录
exports.get_contribution = function (req, res, resp) {
    do {
        var legion = gNewLegion.getUserLegion(req.uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var dailyContribution = gNewLegion.dailyContribution;
        var memberList = legion.member_list;
        var json = {};
        for (var uid in memberList) {
            uid = +uid;
            var user = gUserInfo.getUser(uid);
            if (user && user.pos[1]) {
                json[uid] = {
                    uid: uid,
                    un: user.info.un,
                    headpic: user.info.headpic,
                    headframe: user.info.headframe,
                    quality: getHeroCombatConf(user.pos[1].rid).quality,
                    vip: user.status.vip,
                    level: user.status.level,
                    fight_force: gUserInfo.getUserFightForce(uid),
                    duty: memberList[uid].duty,
                    build: dailyContribution[uid] ? dailyContribution[uid][0] : 0,
                    bonfire_xp: dailyContribution[uid] ? dailyContribution[uid][1] : 0,
                    drum: dailyContribution[uid] ? dailyContribution[uid][2] : 0,
                    custom_king: user.custom_king,
                }
            }
        }

        resp.data.contributionList = json;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取成员职位
exports.get_member_duty = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        var member = legion.member_list[uid];
        if (!member) {
            resp.code = ErrorCode.ERROR_MEMBER_NOT_EXIST; resp.desc = 'not member'; break
        }

        resp.data.duty = member.duty;
        resp.data.title = gUserInfo.getTitle(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// gm操作
exports.gm_change_legion = function (req, res, resp) {
    do {
        var legion = gNewLegion.getUserLegion(req.uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        } else {
            var lid = legion.lid;
            if (req.args.level) {
                var level = +req.args.level;
                var maxLevel = Object.keys(gConfLegionLevel).length;
                level >= maxLevel && (level = maxLevel);
                var legion_exp = 0;
                for (var i in gConfLegionLevel) {
                    if (i >= level) break;
                    legion_exp += gConfLegionLevel[i].xp
                }

                gNewLegion.markAwards(req.uid, lid, [['user', 'legion_exp', legion_exp]]);
                legion.level = level;
                gNewLegion.markDirty('legions.' + lid + '.level');
            }
            if (req.args.name) {
                legion.name = req.args.name;
                gNewLegion.markDirty('legions.' + lid + '.name');
            }
            if (req.args.type) {
                legion.join_way = +req.args.type;
                gNewLegion.markDirty('legions.' + lid + '.join_way');
            }
            if (req.args.limit) {
                legion.join_term.level = +req.args.limit;
                gNewLegion.markDirty('legions.' + lid + '.join_term.level');
            }
            if (req.args.notice) {
                legion.notice = req.args.notice;
                gNewLegion.markDirty('legions.' + lid + '.notice');
            }
            if (req.args.construct) {
                legion.build = +req.args.construct;
                gNewLegion.markDirty('legions.' + lid + '.build');
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取军团信息
exports.get_legion_info = function (req, res, resp) {
    do {
        var lid = req.args.legion_id;
        var legion = gNewLegion.legions[lid];
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'legion is not exits'; break;
        }

        resp.data = gNewLegion.getLegionInfo(lid, true);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.update_active = function (req, res, resp) {
    var uid = req.uid;
    var lid = gNewLegion.userLegion[uid];

    if (lid) {
        var ids = req.args.ids;
        var active = 0;
        for (var i = 0, len = ids.length; i < len; i++) {
            active += gConfDailyTask[ids[i]].active;
        }
        gNewLegion.addXp(lid, active);

        var legion = gNewLegion.get(lid);
        if (legion.mark_day != getGameDate()) {
            gNewLegion.resetByDay();
        }
        legion.member_list[uid].active[gConfLegion.activeDayLimit - 1] += active;
        gNewLegion.markDirty(lid, 'members');
    }

    onReqHandled(res, resp, 1);
};

// 获取boss信息
exports.boss_get_info = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'has no legion'; break;
        }

        resp.data.boss = clone(legion.boss);

        var bossTime = getLegionBossTime();
        resp.data.boss.start_time = bossTime[0];
        resp.data.boss.end_time = bossTime[1];

        resp.data.boss.damage_rank = gNewLegion.getLegionBossDamageRank(legion.lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 开始挑战boss
exports.boss_challenge = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'has no legion'; break;
        }

        resp.data.boss_id = legion.boss.id;
        resp.data.inspire_val = legion.boss.inspire_val;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.boss_before_fight = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var id = req.args.boss_id;
        if (!id) {
            resp.code = 1; resp.desc = 'boss id need'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'has no legion'; break;
        }

        if (id != legion.boss.id) {
            resp.code = ErrorCode.ERROR_BOSS_ID_NOT_MATCH; resp.desc = 'boss id not match'; break;
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

exports.boss_fight = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var id = req.args.boss_id;
        var damage = +req.args.damage;
        if (!id || damage == undefined || damage == null) {
            resp.code = 1; resp.desc = 'boss id need'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = ErrorCode.ERROR_LEGION_NOT_EXIST; resp.desc = 'has no legion'; break;
        }

        if (id != legion.boss.id) {
            resp.code = ErrorCode.ERROR_BOSS_ID_NOT_MATCH; resp.desc = 'boss id not match'; break;
        }

        var lastShot = gNewLegion.updateBossHp(uid, legion.lid, damage);

        var awards = gConfLegionBoss[legion.boss.level].award_challenge;

        // 最后一击奖励
        if (lastShot) {
            awards = awards.concat(gConfLegionBoss[legion.boss.level].award_lastshot);
        }

        resp.data.awards = awards;
        resp.data.lastShot = lastShot ? 1 : 0;

    } while (false);

    onReqHandled(res, resp, 1);
};

// boss鼓舞
exports.boss_inspire = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var type = req.args.type;   // 鼓舞类型

        if (!gConfLegionBossAakb[type]) {
            resp.code = 1; resp.desc = 'type not exist'; break;
        }

        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = 1; resp.desc = 'has not legion'; break;
        }

        var addVal = gConfLegionBossAakb[type].damage;
        gNewLegion.addInspireVal(legion.lid, addVal);
        gNewLegion.addDailyContribution(uid, 2, addVal);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.boss_get_damage_rank = function (req, res, resp) {
    do {
        resp.data.rank_list = gNewLegion.getBossDamageRankList();
    } while (false);

    onReqHandled(res, resp, 1);
};

// 排行榜
exports.rank_list = function (req, res, resp) {
    var lids = Object.keys(gNewLegion.legions).sort(function (l1, l2) {
        var fightForce1 = gNewLegion.legionFightForce[l1] || 0;
        var fightForce2 = gNewLegion.legionFightForce[l2] || 0;
        return fightForce2 - fightForce1;
    }).slice(0, gConfGlobalNew.rankListLimit_legion);

    var selfLid = gNewLegion.userLegion[req.uid];
    var retList = [];
    for (var i = 0, len = lids.length; i < len; i++) {
        var legion = gNewLegion.legions[lids[i]];

        var legionInfo = {
            'lid': legion.lid,
            'un': legion.name,
            'level': legion.level,
            'icon': legion.icon,
            'count': Object.keys(legion.member_list).length,
            'fight_force': gNewLegion.calcFightForce(legion.lid)
        }

        // 第一名发送团长信息
        if (i == 0) {
            var leaderUid = gNewLegion.getLeaderUid(lids[i]);
            var leaderUser = gUserInfo.getUser(leaderUid);
            var leaderInfo = {};
            leaderInfo.uid = leaderUid;
            leaderInfo.name = leaderUser.info.un;
            leaderInfo.main_role = leaderUser.info.model;
            leaderInfo.headpic = leaderUser.info.headpic;
            leaderInfo.headframe = leaderUser.info.headframe;
            leaderInfo.fight_force = leaderUser.fight_force;
            leaderInfo.weapon_illusion = leaderUser.sky_suit.weapon_illusion;
            leaderInfo.wing_illusion = leaderUser.sky_suit.wing_illusion;
            leaderInfo.mount_illusion = leaderUser.sky_suit.mount_illusion;
            leaderInfo.custom_king = leaderUser.custom_king;

            legionInfo.leader = leaderInfo;
        }
        retList.push(legionInfo);

        if (lids[i] == selfLid) {
            resp.data.self = {
                'lid': legion.lid,
                'name': legion.name,
                'level': legion.level,
                'icon': legion.icon,
                'count': Object.keys(legion.member_list).length,
                'rank': i + 1,
                'leader': gNewLegion.getLeaderName(legion.lid),
                'fight_force': gNewLegion.calcFightForce(legion.lid)
            };
        }
    }

    resp.data.rank_list = retList;
    onReqHandled(res, resp, 1);
};

exports.get_user_legion_info = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = gNewLegion.getUserLegionId(uid);
        resp.data.idx = req.args.idx;
        if (lid > 0) {
            resp.data.legion_data = gNewLegion.get(lid);
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 排行榜
exports.get_legion_leader_info = function (req, res, resp) {

    var uid = +req.uid;
    do {
        var lid = gNewLegion.getUserLegionId(uid);
        if (lid == -1) {
            resp.data.leader = ""; break;
        }
        var leaderUid = gNewLegion.getLeaderUid(lid);
        var leaderUser = gUserInfo.getUser(leaderUid);
        var leaderInfo = {};
        leaderInfo.uid = leaderUid;
        leaderInfo.name = leaderUser.info.un;
        leaderInfo.main_role = leaderUser.info.model;
        leaderInfo.headpic = leaderUser.info.headpic;
        leaderInfo.headframe = leaderUser.info.headframe;
        leaderInfo.fight_force = leaderUser.fight_force;
        leaderInfo.weapon_illusion = leaderUser.sky_suit.weapon_illusion;
        leaderInfo.wing_illusion = leaderUser.sky_suit.wing_illusion;
        leaderInfo.mount_illusion = leaderUser.sky_suit.mount_illusion;
        leaderInfo.custom_king = leaderUser.custom_king;
        leaderInfo.vip = leaderUser.status.vip;
        resp.data.leader = leaderInfo;
    } while (false);

    onReqHandled(res, resp, 1);
};

// -------------------------------- 军团战 --------------------------------------------
exports.get_hall = function (req, res, resp) {
    do {
        var uid = req.uid;
        var legion = gNewLegion.getUserLegion(uid);
        if (!legion) {
            resp.code = 1; resp.desc = 'has not legion'; break;
        }

        //resp.data.legion = gLegion.makeRetLegion(legion.lid);
        var members = {};
        var lostMemberList = [];
        for (var m_uid in legion.member_list) {
            var user = gUserInfo.getUser(m_uid);
            var member = legion.member_list[m_uid];
            if (!user || !user.pos || !user.pos[1]) {
                lostMemberList.push(m_uid);
                continue;
            }
            var heroCombatConf = getHeroCombatConf(user.pos[1].rid);
            members[m_uid] = {
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': user.info.headframe,
                'level': user.status.level,
                'vip': user.status.vip,
                'login_time': user.mark.login_time,
                'active_time': user.mark.active_time,
                'fight_force': user.fight_force,
                'duty': gNewLegion.convertDutyToNo(member.duty),
                'active': member.active || [0, 0, 0, 0, 0, 0, 0],
                'quality': heroCombatConf.quality,
                'model': user.info.model,
                'join_time': member.join_time,
                'custom_king': user.custom_king,
                'quality': gUserInfo.getUserQuality(uid),
            };
        }
        for (var i = 0; i < lostMemberList.length; i++) {
            if (!legion) { continue; }
            legion.member_list = legion.member_list || [];
            if (!legion.member_list.indexOf(lostMemberList[i]) == -1) { continue; }
            legion.member_list.splice(legion.member_list.indexOf(lostMemberList[i]), 1);
        }

        resp.data.legion = {
            'lid': legion.lid,
            'level': legion.level,
            'xp': legion.xp,
            'name': legion.name,
            'icon': legion.icon,
            'notice': legion.notice,
            'type': legion.join_way,
            'level_limit': legion.join_term.level,
            'members': members,
            'impeachmentTime': legion.impeach.time,
            'impeachmentInitiatorId': legion.impeach.uid
        };

        var duty = legion.member_list[uid].duty;
        if (duty != 'normal') { // 团长, 副团长和军师均可可以通过申请
            var applicantList = {};
            for (var m_uid in legion.apply_list) {
                var user = gUserInfo.getUser(m_uid);
                var heroCombatConf = getHeroCombatConf(user.pos[1].rid);
                applicantList[m_uid] = {
                    'un': user.info.un,
                    'headpic': user.info.headpic,
                    'headframe': user.info.headframe,
                    'level': user.status.level,
                    'fight_force': gUserInfo.getUserFightForce(m_uid),
                    'vip': user.status.vip,
                    'quality': heroCombatConf.quality,
                };
            }
            resp.data.legion.applicant_list = applicantList;
        }

        var rank = 1;
        for (var lid in gNewLegion.legions) {
            if (gNewLegion.legions[lid].xp > legion.xp) {
                rank++;
            }
        }
        var leaderUid = gNewLegion.getLeaderUid(legion.lid);
        resp.data.legion.rank = rank;
        //resp.data.legion.leader = gUserInfo.getUser(leaderUid).info.un;
        resp.data.legion.leader = gNewLegion.getLeaderName(legion.lid);

    } while (false);

    onReqHandled(res, resp, 1);
};
// 获取军团boss信息
exports.get_legion_boss_info = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = gNewLegion.getUserLegionId(uid);
        var legion = gNewLegion.get(lid);
        if (legion) {
            var boss = {};
            boss.id = legion.boss.id;
            var bossTime = getLegionBossTime();
            boss.begin_time = bossTime[0];
            boss.end_time = bossTime[1];
            resp.data.info = boss;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};
// ------------------------------------------------------------------------------------

exports.NewLegion = NewLegion;
