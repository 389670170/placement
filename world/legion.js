function Legion() {
    this.ai = 0;                    // 军团自增ID

    this.kicks = {
        // uid: time                // 被踢但未重新获取军团的记录
        // wish: {},                // 保留被踢玩家许愿数据
    };

    this.legions = {
        /*
        lid: {
            lid: 0,                 // 公会唯一id
            level: 0,               // 军团等级
            xp: 0,                  // 军团经验
            name: '',               // 公会名称
            icon: 0,                // 徽章Id
            notice: '',             // 公告
            type: 0,                // [0: 任何人都可以加入， 1: 申请加入]
            level_limit: 0,         // 加入等级限制
            mark_day: 0,            // 标记日期, 用于七日活跃度刷新

            members: {              // 公会成员, 修改此项后需要修改Legion.join接口
                uid: {
                    duty: 0,        // 1/2/3/4 团长, 副团长, 军师, 成员
                    active: [0, 0, 0, 0, 0, 0, 0],     // 七日活跃度, 对应前七天的活跃度
                    castle_status : 0,      // 城池状态，0，未被占领，1被占领
                    castle_invader : 0,     // 城池的侵略者
                    castle_report : [],     // 城池日志
                    time : 0,               // 加入时间
                }
            },

            applicant_list: {       // 申请人列表
                uid: time           // 申请人: 申请时间戳
            },

            gold_tree : {           // 摇钱树
                outcome : 0,        // 剩余的果实数量
                time : 0,           // 上次结果时间
            },
            mercenary : {           // 佣兵
                uid : {
                    hid : gold      // 派出的武将id :累计金币奖励个数
                },
            },

            copy: {                 // 军团副本
                time: 0,            // 本轮开启时间
                chapter: 1,         // 当前章节
                progress: 1,        // 章节进度
                healths: [],        // 剩余血量
                damage: {           // 伤害记录
                    uid: 0,         // uid: 伤害
                },
            },

            log: [],                // 事件id, 时间, 参数1, 参数2...

            construct_count: 0,     // 每日建设人数
            construct_progress: 0,  // 每日建设进度

            impeachmentInitiatorId : 0,    //弹劾发起人ID
            impeachmentTime : 0,           //弹劾发起时间

            wish_list: {                           // 许愿列表
                uid : {                            // 许愿者
                    id : {                         // 许愿次数
                        name: 0,                   // 许愿者名字
                        fragment : 0,              // 许愿碎片id
                        has_got : 0,               // 已获取数目
                        has_collect : 0,           // 已领取
                    },
                },
            },
            wish_log: {                            // 被赠记录
                uid: [[0,0,0,0,0]],                // 时间,赠送者,赠送id，赠送数目, 是否有新日志
            },

            // 内存数据
            master: 0,
            deputy_count: 0,
            adviser_count: 0,
            member_count: 0,
            lock: 0,
            lock_uid: 0,
            prepare_lock: 0,

            boons: {                // 所有红包
                ai : 1,             // 自增id
                id : [1, uid],      // 红包id : [奖励个数, 发红包的玩家id], 领过后删除
            },

        }*/
    };

    // 内存数据
    this.userLegion = {             // 玩家所在军团
    };

    this.legionName = {
        // name: lid                // 公会名称->公会唯一id
    };

    this.applicantLists = {
        // uid: [lid, lid, lid]     // 申请人唯一id->公会唯一id
    };

    this.updates = {
    };

    this.ranks = new RankTree(// 军团排行
        // 存储对象 [lid, xp]
        function(c1, c2) {
            // 同一军团作为相等, 用于删除
            if (c1[0] == c2[0]) return 0;

            // 不同军团按照经验值排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c1[0] - c2[0];
        }
    );

};

Legion.create = function(callback) {
    var legionData = {
        '_id': 'legion',
        'ai': 0,
        'kicks': {
            'wish': {},
        },
        'legion': {},
    };

    gDBWorld.insert(legionData, function(err, result){
        callback && callback();
    });
};

Legion.prototype = {
    init: function (callback) {
        // 读取军团数据
        gDBWorld.find({_id: 'legion'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.legions = doc.legion;
                this.ai = doc.ai;
                this.kicks = doc.kicks;

                for (var lid in this.legions) {
                    var legion = this.legions[lid];
                    if (Object.keys(legion).length < 14) {
                        LogError('MISSING DATA IN LEGION: ' + lid);
                        continue;
                    }

                    for (var uid in legion.applicant_list) {
                        if (!gUserInfo.users[uid]) {
                            delete legion.applicant_list;
                            this.markDirty(lid, 'applicant_list');
                        }
                    }

                    // 初始化内存数据
                    legion.member_count = 0;
                    legion.deputy_count = 0;
                    legion.adviser_count = 0;
                    legion.boons = {
                        ai : 1,
                    };

                    // 初始化 公会名称->公会唯一id 映射表
                    this.legionName[legion.name] = +lid;

                    // 初始化 申请人唯一id->公会唯一id 映射表
                    var applicantLists = legion.applicant_list;

                    for (var uid in applicantLists ) {
                        this.getApplicantList(uid).push(+lid);
                    }

                    var members = legion.members;
                    for (var uid in members) {
                        this.userLegion[uid] = +lid;
                        legion.member_count++;

                        var member = members[uid];
                        if (member.duty == LegionDuty.MASTER) {
                            legion.master = +uid;
                        } else if (member.duty == LegionDuty.DEPUTY) {
                            legion.deputy_count++;
                        } else if (member.duty == LegionDuty.ADVISER) {
                            legion.adviser_count++;
                        }
                    }

                    if (!legion.master) {
                        for (var uid in members) {
                            legion.master = +uid;
                            members[uid].duty = LegionDuty.MASTER;
                        }
                        this.markDirty(lid, 'members');
                    }

                    this.ranks.insert([+lid, legion.xp]);
                }

                if (!this.kicks.wish) {
                    this.kicks.wish = {};
                }

                // 超过加入军团时间限制的不记录
                var now = common.getTime();
                for (var uid in doc.kicks) {
                    if (uid != 'wish') {
                        var leaveTime = now - doc.kicks[uid];
                        if (leaveTime >= gConfLegion.joinTimeLimit) {
                            delete this.kicks[uid];
                        }
                    }
                }
                this.updates['kicks'] = this.kicks;

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    create: function (leaderId, name, icon) {
        this.ai += 1;
        var lid = config.ServerId + this.ai*10000;
        var now = common.getTime();
        var legion = {
            'lid': lid,
            'level': 1,
            'xp': 0,
            'name': name,
            'icon': icon,
            'notice': '',
            'type': 0,
            'level_limit': gConfLegion.legionOpenLevel,
            'mark_day': 0,
            'members': {},
            'applicant_list': {},
            'gold_tree': {
                'outcome': 0,
                'time': 0,
            },
            'mercenary': {},
            'copy': {
                'time': 0,
                'chapter': 1,
                'progress': 1,
                'healths': [],
                'damage': {},
            },
            'log': [],
            'construct_count': 0,
            'construct_progress': 0,
            'impeachmentInitiatorId': 0,
            'impeachmentTime': 0,
            'wish_log': {},
            'wish_list': {},
        };

        legion.mark_day = getGameDate();

        this.legions[legion.lid] = legion;
        this.legionName[legion.name] = lid;
        this.updateCopy(lid);

        this.join(lid, leaderId);
        legion.members[leaderId].duty = 1;

        this.updates['ai'] = this.ai;
        for (var attr in legion) {
            this.markDirty(lid, attr);
        }

        // 初始化内存数据
        legion.deputy_count = 0,
        legion.adviser_count = 0,
        legion.member_count = 1,
        legion.boons = {ai : 1};

        this.addLog(lid, 'create', gUserInfo.getUser(leaderId).info.un);

        this.ranks.insert([lid, legion.xp]);

        if (this.kicks.wish[leaderId]) {
            var wish = gLegion.kicks.wish[leaderId];
        } else {
            var wish = {};
        }

        // 移动玩家许愿数据到新军团
        var retainWish = this.kicks.wish[leaderId];
        if (retainWish && (legion.level >= gConfLegion.leigionWishOpenLevel)) {
            for (var id in retainWish) {
                var fid = retainWish[id].fragment;
                var own = id;
                var hgot = retainWish[id].has_got;
                var hcollect = retainWish[id].has_collect;
                var write = 1;
                this.initWishList(leaderId, fid, own, write, hgot, hcollect, lid);
            }
        }

        return {
          'lid': legion.lid,
          'name': legion.name,
          'level': legion.level,
            'icon': legion.icon,
          'gold_tree': legion.gold_tree,
          'wish' : wish,
        };
    },

    // 重置军团城池数据
    resetByDay : function() {
        for (var lid in this.legions) {
            for (var uid in this.legions[lid].members) {
                this.legions[lid].members[uid].castle_status = 0;
                this.legions[lid].members[uid].castle_invader = 0;
                this.legions[lid].members[uid].castle_report = [];
                this.markDirty(lid, 'members');
            }
        }
    },

    // 重置军团许愿数据
    resetByWeek : function() {
        var retainWish = this.kicks.wish;
        if (retainWish) {
            this.sendKicksWishMail();
        }

        this.sendListWishMail();
    },

    dismiss: function(lid) {
        // 先进行写入同步
        this.save(function() {
            var legion = this.legions[lid];
            this.ranks.removeById(lid);
            delete this.legions[lid];
            delete this.legionName[legion.name];

            var updates = {};
            updates['legion.' + lid] = 1;
            gDBWorld.update({'_id': 'legion'}, {'$unset': updates}, function(err, result) {
                if (err) {
                    ERROR(util.format('dismiss legion: %j',legion));
                }
            });
        }.bind(this));

        // 通知领地战军团解散
        var TerritoryWarReq = {
            uid : 1,
            mod : 'api',
            act : 'on_legion_dismiss',
            args : {
                lid : lid,
            }
        }

        requestTerritoryWar(TerritoryWarReq, {}, function() {

        });
    },

    search: function (search) {
        var retLegions = {};
        for (var lid in this.legions) {
            var legion = this.legions[lid];
            if (legion.name.indexOf(search) != -1 || legion.lid == search) {
                retLegions[lid] = {
                    'level': legion.level,
                    'name': legion.name,
                    'xp': legion.xp,
                    'notice': legion.notice,
                    'icon': legion.icon,
                    'type': legion.type,
                    'level_limit': legion.level_limit,
                    'members_count': legion.member_count,
                    'master': gUserInfo.getUser(legion.master).info.un,
                };
            }
        }

        return retLegions;
    },

    join: function (lid, uid) {
        // 加入前清空申请列表
        var appList = this.getApplicantList(uid);
        while (appList.length) {
            this.revokeRequest(appList[0], uid);
        }

        var legion = this.get(lid);
        if (!legion) {
            return null;
        }

        // 移动玩家许愿数据到新军团
        var retainWish = this.kicks.wish[uid];
        if (retainWish && (legion.level >= gConfLegion.leigionWishOpenLevel)) {
            for (var id in retainWish) {
                var fid = retainWish[id].fragment;
                var own = id;
                var hgot = retainWish[id].has_got;
                var hcollect = retainWish[id].has_collect;
                var write = 1;
                this.initWishList(uid, fid, own, write, hgot, hcollect, lid);
            }

            delete this.kicks.wish[uid];
            this.updates['kicks'] = this.kicks;
        }

        legion.members[uid] = {
            'duty': 4,
            'active': [0, 0, 0, 0, 0, 0, 0],
            'time' : Date.getStamp(),       // 加入时间
        };

        this.userLegion[uid] = +lid;

        if (legion.hasOwnProperty('member_count')) {
            legion.member_count++;
            this.addLog(lid, 'newMember', gUserInfo.getUser(uid).info.un);
        }

        this.markDirty(lid, 'members');
        return legion.members[uid];
    },

    approve: function (lid, uid) {
        this.userLegion[uid] = +lid;
        var member = clone(this.join(lid, uid));
        var user = gUserInfo.getUser(uid);
        member.un = user.info.un;
        member.headpic = user.info.headpic;
        member.headframe = user.info.headframe;
        member.level = user.status.level;
        member.vip = user.status.vip;
        member.quality = gConfHero[user.pos[1].hid].quality;
        member.login_time = user.mark.login_time;
        member.fight_force = gUserInfo.getUserFightForce(uid);

        return member;
    },

    kick: function(lid, uid) {
        var legion = this.legions[lid];
        var members = legion.members;
        var duty = members[uid].duty;
        if (duty == LegionDuty.DEPUTY) {
            legion.deputy_count--;
        } else if (duty == LegionDuty.ADVISER) {
            legion.adviser_count--;
        }
        legion.member_count--;

        delete members[uid];
        this.markDirty(lid, 'members');

        var iconConf = gConfLegionIcon[legion.icon];
        if (iconConf.condition == 'vip_level') {
            if (gUserInfo.getUser(uid).status.vip >= iconConf.value) {
                var valid = false;
                for (var mid in legion.members) {
                    if (gUserInfo.getUser(mid).status.vip >= iconConf.value) {
                        valid = true;
                        break;
                    }
                }

                if (!valid) {
                    legion.icon = 1;
                    this.markDirty(lid, 'icon');
                }
            }
        }

        var wishList = legion.wish_list[uid];
        if (wishList) {
            for (var id in wishList) {
                this.kicks.wish[uid] = {};
                this.kicks.wish[uid][id] =  {
                    'fragment' : wishList[id].fragment,
                    'has_got' : wishList[id].has_got,
                    'has_collect' : wishList[id].has_collect,
                };
            }
            this.updates['kicks'] = this.kicks;

            delete legion.wish_list[uid];
            this.markDirty(lid, 'wish_list');
        }

        this.kicks[uid] = common.getTime();
        this.updates['kicks'] = this.kicks;

        if (uid == legion.impeachmentInitiatorId) {
            legion.impeachmentInitiatorId = 0;
            legion.impeachmentTime = 0;
            this.markDirty(lid, 'impeachmentInitiatorId');
            this.markDirty(lid, 'impeachmentTime');
        }

        // 通知领地战军团成员退出
        var TerritoryWarReq = {
            uid : 1,
            mod : 'api',
            act : 'on_player_leave_legion',
            args : {
                uid : uid,
                lid : lid,
            }
        }

        requestTerritoryWar(TerritoryWarReq, {}, function() {

        });
    },

    // 弹劾
    impeachment: function(lid, uid){
        var legion = this.legions[lid];
        legion.impeachmentInitiatorId = uid;
        legion.impeachmentTime = common.getTime();
        this.markDirty(lid, 'impeachmentInitiatorId');
        this.markDirty(lid, 'impeachmentTime');
    },

    // 获取弹劾人
    getImpeachmentInitiatorId : function (lid) {
        var legion = this.legions[lid];
        return legion.impeachmentInitiatorId;
    },

    getLeaveTime: function(uid) {
        var leaveTime = this.kicks[uid];
        if (leaveTime) {
            delete this.kicks[uid];
            this.updates['kicks'] = this.kicks;
        }

        return leaveTime;
    },

    appoint: function(lid, uid, duty) {
        var legion = this.legions[lid];
        var member = legion.members[uid];
        var oldDuty = member.duty;

        if (oldDuty == duty) {
            return;
        }

        if (oldDuty == LegionDuty.DEPUTY) {
            legion.deputy_count--;
        } else if (oldDuty == LegionDuty.ADVISER) {
            legion.adviser_count--;
        }

        member.duty = duty;
        this.addLog(lid, 'liftDuty', gUserInfo.getUser(uid).info.un, oldDuty);
        this.addLog(lid, 'appoint', gUserInfo.getUser(uid).info.un, duty);
        gLegion.markDirty(lid, 'members');

        if (duty == LegionDuty.MASTER) {
            legion.master = uid;
        } else if (duty == LegionDuty.DEPUTY) {
            legion.deputy_count++;
            //this.addLog(lid, 'newDeputy', gUserInfo.getUser(uid).info.un);
        } else if (duty == LegionDuty.ADVISER) {
            legion.adviser_count++;
        }
    },

    setNotice: function(lid, notice) {
        var legion = this.get(lid);
        legion.notice = notice;
        this.markDirty(lid, 'notice');
    },

    setting: function (lid, icon, type, levelLimit) {
        var legion = this.get(lid);
        legion.icon = icon;
        legion.type = type;
        legion.level_limit = levelLimit;

        this.markDirty(lid, 'icon');
        this.markDirty(lid, 'type');
        this.markDirty(lid, 'level_limit');
    },

    addXp: function (lid, xp) {
        var legion = this.get(lid);
        if (!legion) {
            return false;
        }

        legion.xp += xp;

        var level = 1;
        while (gConfLegionLevel[level + 1]) {
            if (legion.xp < gConfLegionLevel[level].xp) {
                break;
            }
            level++;
        }

        // 级数发生变化
        if (legion.level < +level) {
            legion.level = +level;
            this.addLog(lid, 'upgrade', level);

            this.markDirty(lid, 'level');
        }

        // 通知领地战服务器军团等级变化
        var TerritoryWarReq = {
            uid : 1,
            mod : 'territorywar',
            act : 'api',
            args : {
                lid : lid,
                level : legion.level,
                legionWarLevel : gLegionWar.getLegionPersist(lid).level,
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
        return {'level':legion.level, 'xp':legion.xp};
    },

    get: function (lid) {
        if (this.legions[lid]) {
            return this.legions[lid];
        }
        return null;
    },

    enumationLegions: function(callback) {
        for (var lid in this.legions) {
            if (!this.legions.hasOwnProperty(lid)) {
                continue;
            }

            if (callback(this.legions[lid]) === false) {
                break;
            }
        }
    },

    checkPrivilege: function(lid, uid, duty) {
        var legion = this.legions[lid];
        var userDuty = legion.members[uid].duty;
        return userDuty <= duty;
    },

    checkUserPrivilege: function(uid, duty) {
        var legion = this.get(this.userLegion[uid]);
        if (legion) {
            var userDuty = legion.members[uid].duty;
            return userDuty <= duty;
        }
        return false;
    },

    joinBeforeTime: function(lid, uid, time) {
        if (lid != this.userLegion[uid]) {
            return false;
        }

        var legion = this.get(lid);
        if (legion) {
            var userJoinTime = legion.members[uid].time || 0;
            return userJoinTime < time;
        }

        return false;
    },

    getUserLegionId: function(uid) {
        if (this.userLegion.hasOwnProperty(uid)) {
            return this.userLegion[uid];
        }
        return -1;
    },

    getDuty: function(lid, uid) {
        var legion = this.legions[lid];
        return legion.members[uid].duty;
    },

    addLog: function(lid, type, args1, args2, args3) {
        var legion = this.legions[lid];
        var log = [gConfLegionLog[type].id, common.getTime()];

        if (args1 != undefined) {
            log.push(args1);
        }

        if (args2 != undefined) {
            log.push(args2);
        }

        if (args3 != undefined) {
            log.push(args3);
        }

        legion.log.push(log);
        while (legion.log.length > gConfLegion.legionLogLimit) {
            legion.log.shift();
        }
        this.markDirty(lid, 'log');
    },

    markDirty: function(lid, attr) {
        if (attr == 'member_count') {
            throw new Error(-1, "invalid attr");
        }

        var legion = this.legions[lid];
        if (!legion) return;

        this.updates[util.format('legion.%d.%s', lid, attr)] = legion[attr];
    },

    save: function(callback) {
        var updates = this.updates;
        this.updates = {};
        if (Object.keys(updates).length) {
            gDBWorld.update({'_id': 'legion'}, {'$set': updates}, function(err, result){
                if (err) {
                    ERROR(util.format('SAVE LEGION: %j %j', updates, err));
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            }.bind(this));
        } else {
            callback && callback(true);
        }
    },

    resetLegionByDay: function(lid) {
        var legion = this.get(lid);
        var today = getGameDate();

        // 每日军团成员七日活跃刷新
        var dayDiff = common.getDateDiff(today, legion.mark_day);
        dayDiff = dayDiff > gConfLegion.activeDayLimit ? gConfLegion.activeDayLimit : dayDiff;

        var zeroActive = [];
        for (var i = 0; i < dayDiff; i++) {
            zeroActive.push(0);
        }

        var members = legion.members;
        for (var uid in members) {
            var member = members[uid];
            member.active.splice(0, dayDiff);
            member.active.combine(zeroActive);
        }
        this.markDirty(lid, 'members');

        legion.mark_day = today;
        this.markDirty(lid, 'mark_day');
        legion.construct_count = 0;
        legion.construct_progress = 0;
        this.markDirty(lid, 'construct_count');
        this.markDirty(lid, 'construct_progress');
    },

    initWishList: function(uid, fid, own, write, hgot, hcollect, legion_id) {
        var lid = gLegion.userLegion[uid];
        if (write) {
            lid = legion_id;
        }

        var legion = gLegion.get(lid);
        var wish = legion.wish
        var wishList = legion.wish_list;
        if (!wishList[uid]) {
            wishList[uid] = {};
            this.markDirty(lid, 'wish_list');
        }

        if (!write) {
            var ownTimes = own + 1;
            wishList[uid][ownTimes] = {
                'name' : gUserInfo.getUser(uid).info.un,
                'fragment' : fid,
                'has_got' : 0,
                'has_collect' : 0,
            };
            this.markDirty(lid, 'wish_list');
        }

        if (write) {
            var ownTimes = own;
            wishList[uid][ownTimes] = {
                'name' : gUserInfo.getUser(uid).info.un,
                'fragment' : fid,
                'has_got' : hgot,
                'has_collect' : hcollect,
            };
            this.markDirty(lid, 'wish_list');
        }
    },

    sendKicksWishMail: function() {
         var now = common.getTime();
         var retainWish = this.kicks.wish;
         for (var uid in retainWish) {
             var awards = [];
             var count = 0;
             var num = 0;
             var textId = 0;
             for (var id in retainWish[uid]) {
                 var fid = retainWish[uid][id].fragment;
                 var fidQuality = gConfHero[fid].quality;
                 var targetNum = gConfLegionWishConf[fidQuality].wishFragmentMax;
                 var hasGot = retainWish[uid][id].has_got;
                 var hasCollect = retainWish[uid][id].has_collect;
                 var canGet = hasGot - hasCollect;
                 if (canGet) {
                     awards.push(['fragment', fid, canGet]);
                 }

                 if (!count && hasGot != targetNum) {
                     count = 1;
                     var award = gConfLegionWishAchievementKey['mail'].award;
                     for (var id = 0; id <= award.length; id++) {
                         awards.push(award[id]);
                     }
                 }

                 if (canGet) {
                     num = 1;
                 }
             }

             if (num && !count) {
                 textId = 62;
             }

             if (!num && count) {
                 textId = 63;
             }

             if (num && count) {
                 textId = 64;
             }

             if (awards.length) {
                 var mail = {
                     from : 5,
                     title : 61,
                     content : [textId],
                     awards : awards,
                     time : now,
                     expire : now+gConfGlobal.awardMailExpireDay*3600*24,
                 };

                 gMail.add(uid, mail);
             }

             delete this.kicks.wish[uid];
             this.updates['kicks'] = this.kicks;
         }
    },

    // bug,在老军团许愿,到新军团领取,重置有邮件
    sendListWishMail: function() {
        var now = common.getTime();
        for (var lid in this.legions) {
            var wishList = this.legions[lid].wish_list;
            for (var uid in wishList) {
                var awards = [];
                var count = 0;
                var num = 0;
                var textId = 0;
                for (var id in wishList[uid]) {
                    var fid = wishList[uid][id].fragment;
                    var fidQuality = gConfHero[fid].quality;
                    var targetNum = gConfLegionWishConf[fidQuality].wishFragmentMax;
                    var hasGot = wishList[uid][id].has_got;
                    var hasCollect = wishList[uid][id].has_collect;
                    var canGet = hasGot - hasCollect;
                    if (canGet) {
                        awards.push(['fragment', fid, canGet]);
                    }

                    if (!count && hasGot != targetNum) {
                        count = 1;
                        var award = gConfLegionWishAchievementKey['mail'].award;
                        for (var id = 0; id <= award.length; id++) {
                            awards.push(award[id]);
                        }
                    }

                    if (canGet) {
                        num = 1;
                    }
                }

                if (num && !count) {
                    textId = 62;
                }

                if (!num && count) {
                    textId = 63;
                }

                if (num && count) {
                    textId = 64;
                }

                if (awards.length) {
                    var mail = {
                        from : 5,
                        title : 61,
                        content : [textId],
                        awards : awards,
                        time : now,
                        expire : now+gConfGlobal.awardMailExpireDay*3600*24,
                    };

                    gMail.add(uid, mail);
                }

                delete this.legions[lid].wish_list[uid];
                this.markDirty(lid, 'wish_list');
            }
        }
    },

    makeGetLegion: function(lid, uid, own, give) {
        this.resetGoldTree(lid);

        var legion = this.get(lid);
        if (legion.mark_day != getGameDate()) {
            this.resetLegionByDay(lid);
        }

        if (this.kicks.wish[uid]) {
            var wish = gLegion.kicks.wish[uid];
        } else {
            var wish = {};
        }

        return {
            'lid': legion.lid,
            'name': legion.name,
            'level': legion.level,
            'gold_tree': legion.gold_tree,
            'icon' : legion.icon,
            'construct_progress': legion.construct_progress,
            'give' : give,
            'own' : own,
            'wish' : wish,
        };
    },

    makeRetLegion: function(lid) {
        var legion = this.get(lid);
        var retLegion = {
            'lid': legion.lid,
            'level': legion.level,
            'xp': legion.xp,
            'name': legion.name,
            'icon': legion.icon,
            'notice': legion.notice,
            'type': legion.type,
            'level_limit': legion.level_limit,
            'lid': legion.lid,
            'members': this.makeRetMembers(lid),
            'impeachmentTime':  legion.impeachmentTime,
            'impeachmentInitiatorId': legion.impeachmentInitiatorId,
        };
        return retLegion;
    },

    makeRetMembers: function(lid) {
        var legion = this.get(lid);
        var members = {};
        for (var uid in legion.members) {
            var user = gUserInfo.getUser(uid);
            var member = legion.members[uid];
            var heroCombatConf = getHeroCombatConf(user.pos[1].hid);
            members[uid] = {
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe' : user.info.headframe,
                'level': user.status.level,
                'vip': user.status.vip,
                'login_time': user.mark.login_time,
                'active_time': user.mark.active_time,
                'fight_force': user.fight_force,
                'duty': member.duty,
                'active': member.active,
                'quality': heroCombatConf.quality,
                'model': user.info.model,
                'join_time': legion.members[uid].time,
            };
        }

        return members;
    },

    makeRetAppList: function (lid) {
        var legion = this.get(lid);

        applicant_list
        return applicantList;
    },

    revokeRequest : function(lid, uid) {
        var appList = this.getApplicantList(uid);
        if (appList.indexOf(lid) == -1) {
            if (Object.keys(this.legions[lid].members).indexOf(uid) != -1) {
                return false;
            } else {
                return true;
            }
        }

        appList.remove(lid);

        var legion = this.get(lid);
        if (legion) {
            delete legion.applicant_list[uid];
        }

        this.markDirty(lid, 'applicant_list');
        return true;
    },

    getApplicantList : function(uid) {
        var retAppList = this.applicantLists[uid];

        if (!retAppList) {
            retAppList = this.applicantLists[uid] = [];
        }

        return retAppList;
    },

    resetGoldTree : function(lid) {
        var legion = this.get(lid);
        var goldTree = legion.gold_tree;
        var lastTime = goldTree.time;
        var now = common.getTime();
        var interval = 3600*gConfLegion.goldTreeResetInterval;
        var resetTime = Math.floor(now/interval)*interval;
        if (lastTime < resetTime) {
            goldTree.outcome = gConfLegionLevel[legion.level].goldOutcome;
            goldTree.time = now;

            this.markDirty(lid, 'gold_tree');
        }
    },

    updateCopy: function(lid) {
        var legion = this.get(lid);
        var copy = legion.copy;

        var now = common.getTime();
        if (copy.time < getWeekResetTime()) {
            copy.time = now;
            copy.chapter = 1;
            copy.progress = 1;
            copy.damage = {};
            copy.healths = [];

            var formationConf = gConfFormation[gConfLegionCopy[1].formation1];
            for (var i = 1; i <= 9; i++) {
                var monsterId = formationConf['pos' + i];
                if (monsterId) {
                    copy.healths.push(100);
                }
            }

            this.markDirty(lid, 'copy');
        }
    },

    getHonorTopUid: function() {
        var topLegion = this.get(Object.keys(gLegion.legions).sort(function(l1, l2) {
            var legion1 = gLegion.legions[l1];
            var legion2 = gLegion.legions[l2];

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

    getHonorTopUser: function() {
        var uid = this.getHonorTopUid();
        if (uid) {
            return gUserInfo.getHonorUser(uid);
        } else {
            return null;
        }
    },

    getBuildingTotalLevel : function (user) {
        if (!user.legion.city) {
            return 0;
        }

        var totalLevel = 0;
        for (var id in user.legion.city.buildings) {
            totalLevel += parseInt(user.legion.city.buildings[id].level);
        }

        return totalLevel;
    },

    getCityLevel : function (totalLevel) {
        var mainCityLevel = 1;
        for (var city_level in gConfLegionCityMain) {
            if (totalLevel >= parseInt(gConfLegionCityMain[city_level].condition)){
                mainCityLevel = parseInt(city_level) + 1;
            }
        }

        return mainCityLevel;
    },

    getCastleData : function(lid) {
        var legion = this.get(lid);
        if(!legion) {
            return null;
        }

        var castleData = {
            lid : lid,
            level : legion.level,
            name : legion.name,
            members : {},
        };
        for(var uid in legion.members) {
            var userInfo = gUserInfo.getUser(uid);
            var memberData = legion.members[uid];
            var totalLevel = this.getBuildingTotalLevel(userInfo);
            var cityLevel = this.getCityLevel(totalLevel);
            castleData.members[uid] = {
                duty : memberData.duty,
                un : userInfo.info.un,
                level : userInfo.status.level,
                fight_force : gUserInfo.getUserFightForce(uid),
                castle_level : cityLevel,
                build_progress : totalLevel,
            };
            var invader = memberData.castle_invader;
            if(invader) {
                invaderInfo = gUserInfo.getUser(invader);
                castleData.members[uid].castle_invader = {
                    un : invaderInfo.info.un,
                    fight_force : guserInfo.getUserFightForce(invader),
                    level : invaderInfo.status.level,
                };
            }
        }
        return castleData;
    },
};

exports.get = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (lid) {
            var legion = gLegion.get(lid);
            if (legion.master == uid && legion.impeachmentTime) {
                legion.impeachmentInitiatorId = 0;
                legion.impeachmentTime = 0;
                gLegion.markDirty(legion.lid,'impeachmentTime');
                gLegion.markDirty(legion.lid,'impeachmentInitiatorId');
            }

            // 弹劾时间计算
            if (legion.impeachmentTime && legion.members[legion.master]) {
                var timeLimit = gConfLegion['legionHeadNotOnlineTimeLimit']*3600;
                var masterActive = gUserInfo.getUser(legion.master).mark.active_time;
                if (legion.impeachmentTime + timeLimit < common.getTime()) {
                    var everMasterId = legion.master;
                    legion.members[legion.master].duty = LegionDuty.MEMBER;
                    legion.master = legion.impeachmentInitiatorId;
                    legion.members[legion.master].duty  = LegionDuty.MASTER;
                    gLegion.markDirty(legion.lid, 'members');
                    gLegion.addLog(legion.lid, 'impeachmentsuccess',
                            gUserInfo.getUser(legion.master).info.un,
                            gUserInfo.getUser(everMasterId).info.un);

                    legion.impeachmentInitiatorId = 0;
                    legion.impeachmentTime = 0;
                    gLegion.markDirty(lid, 'impeachmentTime');
                    gLegion.markDirty(lid, 'impeachmentInitiatorId');
                }
            } else if (legion.impeachmentTime) {
                legion.impeachmentInitiatorId = 0;
                legion.impeachmentTime = 0;
                gLegion.markDirty(lid, 'impeachmentTime');
                gLegion.markDirty(lid, 'impeachmentInitiatorId');
            }

            var own = req.args.own;
            var give = req.args.give;
            resp.data.mercenary = legion.mercenary[uid];
            resp.data.legion = gLegion.makeGetLegion(lid, uid, own, give);
            resp.data.legionWarLevel = gLegionWar.getLegionPersist(lid).level;    // 军团战段位
        } else {
            var leaveTime = gLegion.getLeaveTime(uid);
            if (leaveTime) {
                resp.data.leave_time = leaveTime;
            }

            resp.data.applicant_list = gLegion.getApplicantList(uid);

            var legions = {};
            var lids = Object.keys(gLegion.legions).shuffle();

            var len = lids.length;
            var limit = gConfLegion.legionListLimit;
            for (var i = 0; i < limit && i < len; i++) {
                var legion = gLegion.legions[lids[i]];
                legions[legion.lid] = {
                    'level': legion.level,
                    'name': legion.name,
                    'xp': legion.xp,
                    'notice': legion.notice,
                    'icon': legion.icon,
                    'type': legion.type,
                    'level_limit': legion.level_limit,
                    'members_count': Object.keys(legion.members).length,
                };

                legions[legion.lid].master = gUserInfo.getUser(legion.master).info.un;
            }
            resp.data.legions = legions;
        }

    } while(false);

    onReqHandled(res, resp, 1);
};

exports.get_hall = function(req, res, resp) {
    do {
        var uid = req.uid;
        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        resp.data.legion = gLegion.makeRetLegion(legion.lid);

        var duty = legion.members[uid].duty;
        if (duty != LegionDuty.MEMBER) { // 团长, 副团长和军师均可可以通过申请
            resp.data.legion.applicant_list = gLegion.makeRetAppList(legion.lid);;
        }

        var rank = 1;
        for (var lid in gLegion.legions) {
            if (gLegion.legions[lid].xp > legion.xp) {
                rank++;
            }
        }
        resp.data.legion.rank = rank;
        resp.data.legion.leader = gUserInfo.getUser(legion.master).info.un;

    } while(false);

    onReqHandled(res, resp, 1);
};

exports.create = function(req, res, resp) {
    do {
        var uid = req.uid;
        var name = req.args.name;
        var icon = Math.round(req.args.icon);

        if (gLegion.legionName.hasOwnProperty(name)) {
            resp.code = 101; resp.desc = 'name already exist'; break;
        }

        if (gLegion.userLegion[uid]) {
            resp.code = 102; resp.desc = 'in legion'; break;
        }



        resp.data.legion = gLegion.create(req.uid, name, icon);
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.search = function(req, res, resp) {
    do {
        resp.data.legions = gLegion.search(req.args.search);
    } while(false);

    onReqHandled(res, resp, 1);
};

// 弹劾
exports.impeachment = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = req.args.lid;
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        if (common.getTime() - gUserInfo.getUser(legion.master).mark.active_time < gConfLegion.legionHeadLeaveTimeLimit*3600) {
            resp.code = 1; resp.desc = 'master leavetime limit'; break;
        }

        if (gLegion.getImpeachmentInitiatorId(lid) != 0) {
            // 已经有人在弹劾了
            resp.code = 1; resp.desc = 'somebody is impeachment'; break;
        }

        gLegion.impeachment(lid, uid);
        resp.data.impeachmentTime = legion.impeachmentTime;
        resp.data.impeachmentInitiatorId = legion.impeachmentInitiatorId;
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.join = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = req.args.lid;
        var userLevel = req.args.level;

        var userAppList = gLegion.getApplicantList(uid);

        if (userAppList.length > gConfLegion.memberApplicantLimit) {
            resp.code = 1; resp.desc = 'cannot apply more'; break;
        }

        if (userAppList.indexOf(lid) != -1){
            resp.code = 112; resp.desc = 'already in applicant list'; break;
        }

        if (gLegion.userLegion[uid]) {
            resp.code = 102; resp.desc = 'in legion'; break;
        }

        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var memberCount = legion.member_count;
        var maxCount = gConfLegionLevel[legion.level].memberMax;
        if (memberCount >= maxCount) {
            resp.code = 105; resp.desc = 'member full'; break;
        }

        if (userLevel < legion.level_limit) {
            resp.code = 106; resp.desc = 'level limit'; break;
        }

        if (gLegion.kicks.wish[uid]) {
            var wish = gLegion.kicks.wish[uid];
        } else {
            var wish = {};
        }

        if (legion.type == 0) {
            // 不需要审批加入
            gLegion.join(lid, uid);
            gLegion.resetGoldTree(lid);
            resp.data.legion = {
                'lid' : legion.lid,
                'name' : legion.name,
                'icon' : legion.icon,
                'level' : legion.level,
                'type' : legion.type,
                'duty' : legion.members[uid].duty,
                'gold_tree' : legion.gold_tree,
                'wish' : wish,
                'war_level': gLegionWar.getLegionPersist(lid).level,
            };
        } else if (legion.type == 1) {
            var appListCount = Object.keys(legion.applicant_list).length;
            if (appListCount >= gConfLegion.legionApplicantLimit) {
                resp.code = 105; resp.desc = 'member full'; break;
            }

            legion.applicant_list[uid] = common.getTime();
            gLegion.markDirty(lid, 'applicant_list');
            userAppList.push(lid);
        } else if (legion.type == 2) {
            resp.code = 117; resp.desc = 'level limit'; break;
        }

        resp.data.applicant_list = userAppList;
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.approve = function(req, res, resp) {
    do{
        var tarUid = req.args.uid;
        var uid = req.uid;

        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var duty = legion.members[uid].duty;
        if (duty == LegionDuty.MEMBER) { // 团长, 副团长和军师均可可以通过申请
            resp.code = 107; resp.desc = 'member'; break;
        }

        if (!legion.applicant_list[tarUid]) {
            if (legion.members[tarUid]) {
                resp.code = 108; resp.desc = 'already in'; break;
            } else if (gLegion.userLegion[tarUid]){
                resp.code = 109; resp.desc = 'already in other legion'; break;
            } else {
                resp.code = 118; resp.desc = 'not apply'; break;
            }
        }

        var memberCount = legion.member_count;
        var maxCount = gConfLegionLevel[legion.level].memberMax;
        if (memberCount >= maxCount) {
            resp.code = 105; resp.desc = 'member full'; break;
        }

        pushToUser(tarUid, 'self', {
            mod: 'legion',
            act: 'approve',
            lid: legion.lid
        });
        resp.data.member = {};
        resp.data.member[tarUid] = gLegion.approve(legion.lid, tarUid);
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.reject = function (req, res, resp) {
    do{
        var uid = req.uid;
        var tarUid = req.args.uid;

        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        var duty = legion.members[uid].duty;
        if (duty == LegionDuty.MEMBER) { // 团长, 副团长和军师均可可以通过申请
            resp.code = 107; resp.desc = 'no manager'; break;
        }

        if (!legion.applicant_list[tarUid]) {
            if (legion.members[tarUid]) {
                resp.code = 108; resp.desc = 'already in'; break;
            } else {
                resp.code = 109; resp.desc = 'not apply'; break;
            }
        }

        gLegion.revokeRequest(legion.lid, tarUid);
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.revoke_request = function (req, res, resp) {
    do {
        var uid = req.uid;
        var lid = req.args.lid;

        if (!gLegion.get(lid)) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        if (!gLegion.revokeRequest(lid, uid) ){
            resp.code = 102; resp.desc = 'already in legion'; break;
        }

        resp.data.applicant_list = gLegion.getApplicantList(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.exit = function (req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        // 佣兵奖励
        if (legion.mercenary[uid]) {
            var hireGold = 0;
            for (var hid in legion.mercenary[uid]) {
                hireGold += legion.mercenary[uid][hid];
            }

            delete legion.mercenary[uid];
            gLegion.markDirty(lid, 'mercenary');

            var timeGold = req.args.time_gold;
            var gold = timeGold+hireGold;
            if (gold) {
                var now = common.getTime();
                var mail = {
                    from : 5,
                    title : 12,
                    content : [13, legion.name],
                    awards : [['user', 'gold', gold]],
                    time : now,
                    expire : now+gConfGlobal.awardMailExpireDay*3600*24,
                };

                gMail.add(uid, mail);
            }
        }

        // 当退出公会的是会长
        var duty = legion.members[uid].duty;
        if (duty == LegionDuty.MASTER) {
            if (legion.member_count > 1) { // 当公会中不止有自己一个人的时候
                resp.code = 1; resp.desc = 'not only one'; break;
            } else {
                gLegion.dismiss(lid); // 解散军团
                delete gLegion.userLegion[uid];
            }
        } else if (uid == legion.impeachmentInitiatorId) {     //弹劾的人不能退出
               resp.code = 1; resp.desc = 'impeachmentInitiator cant exit'; break;
        } else if (legion.members[uid].time + gConfLegion['legionExitTimeLimit'] > common.getTime()){
               resp.code = 1; resp.desc = 'exit time limit'; break;
        } else {
            gLegion.kick(lid, uid);
            delete legion.members[uid];
            delete gLegion.userLegion[uid];
            gLegion.markDirty(lid, 'members')
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 踢人
exports.kick = function (req, res, resp) {
    do {
        var uid = req.uid;
        var tarUid = req.args.uid;

        if( tarUid == uid ) {
            resp.code = 1; resp.desc = 'kick self'; break;
        }

        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        if (gLegion.userLegion[uid] != gLegion.userLegion[tarUid]) {
            resp.code = 103; resp.desc = 'not member'; break;
        }

        var duty = legion.members[uid].duty;
        var member = legion.members[tarUid];
        var tarDuty = member.duty;
        if (duty >= tarDuty || duty > LegionDuty.DEPUTY) {
            resp.code = 107; resp.desc = 'permission denied'; break;
        }

        if (member.active.splice(gConfLegion.activeDayLimit - 2).sum()) {
            if (legion.xp < gConfLegion.legionKickPlayerCostDonateValue) {
                resp.code = 1; resp.desc = 'permission denied'; break;
            }

            legion.xp -= gConfLegion.legionKickPlayerCostDonateValue;
            gLegion.markDirty(lid, 'construct_progress');
        }

        gLegion.kick(lid, tarUid);
        delete gLegion.userLegion[tarUid];
        updateWssData(tarUid, {lid : 0});
        pushToUser(tarUid, 'self', {
            mod: 'legion',
            act: 'kick',
        });

        // 踢出邮件
        var now = common.getTime();
        var mail = {
            from : 5,
            title : 55,
            content : [56],
            awards : [],
            time : now,
            expire : now+gConfGlobal.awardMailExpireDay*3600*24,
        };
        gMail.add(tarUid, mail);

        if (legion.mercenary[tarUid]) {
            var hireGold = 0;
            var timeGold = 0;
            var userInfo = gUserInfo.getUser(tarUid);
            var mInfo = userInfo.legion.mercenary;

            for (var hid in legion.mercenary[tarUid]) {
                hireGold += legion.mercenary[tarUid][hid];
                var level = 0;
                for (var p in userInfo.pos) {
                    if (userInfo.pos[p].hid == hid) {
                        level = userInfo.pos[p].level; break;
                    }
                }

                if (!level || !mInfo[hid]) {
                    ERROR('mercenary error, not in pos ' + hid + ', may not sync');
                    continue;
                }
                timeGold += getMercenaryTimeGold(now, mInfo[hid], hid, level);
            }

            delete legion.mercenary[tarUid];
            gLegion.markDirty(lid, 'mercenary');

            var gold = timeGold+hireGold;
            if (gold) {
                var mail = {
                    from : 5,
                    title : 12,
                    content : [13, legion.name],
                    awards : [['user', 'gold', gold]],
                    time : now,
                    expire : now+gConfGlobal.awardMailExpireDay*3600*24,
                };

                gMail.add(tarUid, mail);
            }
        }

        resp.data.icon = legion.icon;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 任命
exports.appoint = function (req, res, resp) {
    do {
        var uid = req.uid;
        var tarUid = req.args.uid;
        var tarDuty = req.args.duty;

        if( uid == tarUid ) {
            resp.code = 1; resp.desc = 'set self'; break;
        }

        var validDuty = false;
        for (var duty in LegionDuty) {
            if (tarDuty == LegionDuty[duty]) {
                validDuty = true; break;
            }
        }

        if (!validDuty) {
            resp.code = 1; resp.desc = 'invalid duty'; break;
        }

        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        if( gLegion.userLegion[uid] != gLegion.userLegion[tarUid] ) {
            resp.code = 103; resp.desc = 'not in one legion'; break;
        }

        var self = legion.members[uid];
        var duty = self.duty;
        if (duty != LegionDuty.MASTER && duty != LegionDuty.DEPUTY) {
            resp.code = 107; resp.desc = 'not master or deputy'; break;
        }

        if (tarDuty == LegionDuty.DEPUTY && duty != LegionDuty.MASTER) {
            resp.code = 107; resp.desc = 'permission denied'; break;
        }

        if (duty > tarDuty) {
            resp.code = 107; resp.desc = 'permission denied'; break;
        }

        if (tarDuty == LegionDuty.DEPUTY && legion.deputy_count >= gConfLegion.deputyLimit) {
            resp.code = 110; resp.desc = 'deputy full'; break;
        }

        if (tarDuty == LegionDuty.ADVISER && legion.adviser_count >= gConfLegion.adviserLimit) {
            resp.code = 110; resp.desc = 'adviser full'; break;
        }

        if (tarDuty == LegionDuty.MASTER) {
            // 转让
            if (duty != LegionDuty.MASTER) {
                resp.code = 107; resp.desc = 'not master'; break;
            }

            self.duty = LegionDuty.MEMBER;
            gLegion.addLog(lid, 'newMaster', gUserInfo.getUser(uid).info.un,
                    gUserInfo.getUser(tarUid).info.un);
        }

        gLegion.appoint(lid, tarUid, tarDuty);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 军团设置
exports.setting = function (req, res, resp) {
    do {
        var uid = req.uid;

        var icon = Math.round(req.args.icon);
        var type = Math.round(req.args.type);
        var levelLimit = Math.round(req.args.level_limit);

        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var duty = legion.members[uid].duty;
        if (duty != LegionDuty.MASTER) {
            resp.code = 107; resp.desc = 'not master'; break;
        }

        var iconConf = gConfLegionIcon[icon];
        if (iconConf.condition == 'vip_level') {
            var valid = false;
            var vip = iconConf.value;
            for (var uid in legion.members) {
                if (gUserInfo.getUser(uid).status.vip >= vip) {
                    valid = true;
                    break;
                }
            }

            if (!valid) {
                resp.code = 119; resp.desc = 'vip limit'; break;
            }
        }

        gLegion.setting(legion.lid, icon, type, levelLimit);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 军团公告设置
exports.set_notice = function (req, res, resp) {
    do {
        var uid = req.uid;

        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var duty = legion.members[uid].duty;
        if (duty != LegionDuty.MASTER) {
            resp.code = 107; resp.desc = 'not master'; break;
        }

        gLegion.addLog(legion.lid, 'setNotice', gUserInfo.getUser(req.uid).info.un);
        gLegion.setNotice(legion.lid, req.args.notice);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_log = function(req, res, resp) {
    do {
        var uid = req.uid;

        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        resp.data.log = legion.log;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.invite = function(req, res, resp) {
    do {
        var uid = req.uid;
        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var duty = legion.members[uid].duty;
        if (duty != LegionDuty.MASTER && duty != LegionDuty.DEPUTY) {
            resp.code = 107; resp.desc = 'not master or deputy'; break;
        }

        var memberCount = legion.member_count;
        var maxCount = gConfLegionLevel[legion.level].memberMax;
        if (memberCount >= maxCount) {
            resp.code = 105; resp.desc = 'member full'; break;
        }

        resp.data.content = util.format(gConfLocalText[54].text, legion.level, legion.name, legion.level_limit);
        resp.data.info = {
            lid : legion.lid,
            type : legion.type,
            level_limit : legion.level_limit,
        };
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.rank_list = function(req, res, resp) {
    var lids = Object.keys(gLegion.legions).sort(function(l1, l2) {
        var legion1 = gLegion.legions[l1];
        var legion2 = gLegion.legions[l2];

        if (legion1.xp > legion2.xp) {
            return -1;
        }

        if (legion1.xp < legion2.xp) {
            return 1;
        }

        return l2 - l1;
    }).slice(0, gConfGlobal.legionRankListLimit);

    var selfLid = gLegion.userLegion[req.uid];
    var retList = [];
    for (var i = 0, len = lids.length; i < len; i++) {
        var legion = gLegion.legions[lids[i]];
        retList.push({
            'lid': legion.lid,
            'name': legion.name,
            'level': legion.level,
            'icon': legion.icon,
            'count' : Object.keys(legion.members).length,
        });

        if (lids[i] == selfLid) {
            resp.data.self = {
                'lid': legion.lid,
                'name': legion.name,
                'level': legion.level,
                'icon': legion.icon,
                'count' : Object.keys(legion.members).length,
                'rank': i + 1,
            };
        }
    }

    resp.data.list = retList;
    onReqHandled(res, resp, 1);
};

exports.rank_list = function(req, res, resp) {
    var retList = [];
    var iter = gLegion.ranks.iterator();
    var item = null;
    var selfLid = gLegion.userLegion[req.uid];

    var rankCnt = gConfGlobal.legionRankListLimit;
    while (retList.length != rankCnt && (item = iter.next()) != null) {
        var lid = item[0];
        var legion = gLegion.get(lid);
        retList.push({
            'lid': lid,
            'name': legion.name,
            'level': legion.level,
            'icon': legion.icon,
            'count': legion.member_count,
        });

        if (lid == selfLid) {
            resp.data.self = {
                'lid': legion.lid,
                'name': legion.name,
                'level': legion.level,
                'icon': legion.icon,
                'count' : legion.member_count,
                'rank': retList.length,
            };
        }
    }

    resp.data.list = retList;
    onReqHandled(res, resp, 1);
};

exports.update_active = function(req, res, resp) {
    var uid = req.uid;
    var lid = gLegion.userLegion[uid];

    if (lid) {
        var ids = req.args.ids;
        var active = 0;
        for (var i = 0, len = ids.length; i < len; i++) {
            active += gConfDailyTask[ids[i]].active;
        }
        gLegion.addXp(lid, active);

        var legion = gLegion.get(lid);
        if (legion.mark_day != getGameDate()) {
            gLegion.resetLegionByDay(lid);
        }
        legion.members[uid].active[gConfLegion.activeDayLimit - 1] += active;
        gLegion.markDirty(lid, 'members');
    }

    onReqHandled(res, resp, 1);
};

exports.gm_change_legion = function(req, res, resp) {
    var lid = gLegion.userLegion[req.uid];
    if (!lid) {
        resp.code = 1; resp.desc = 'no legion';
    } else {
        var legion = gLegion.get(lid);
        var toLevel = req.args.level;
        if (toLevel != legion.level) {
            var levelConf = gConfLegionLevel[toLevel - 1];
            if (levelConf) {
                legion.xp = 0;
                legion.level = 0;
                gLegion.addXp(lid, levelConf.xp);
            }
        }

        legion.name = req.args.name;
        legion.type = +req.args.type;
        legion.limit = +req.args.limit;
        legion.construct_progress = +req.args.construct;
        legion.notice = req.args.notice;
        gLegion.markDirty(lid, 'name');
        gLegion.markDirty(lid, 'type');
        gLegion.markDirty(lid, 'limit');
        gLegion.markDirty(lid, 'notice');
    }

    onReqHandled(res, resp, 1);
};

exports.use_boon = function(req, res, resp) {
    do {
        var uid = req.uid;
        var legion = gLegion.get(gLegion.userLegion[uid]);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionBoonOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var ai = legion.boons.ai;
        legion.boons[ai] = [req.args.count, uid];
        legion.boons.ai++;

        // 添加聊天信息
        addUserChatMsg(uid, 'legion', "", {boon: {id: ai, un: gUserInfo.getUser(uid).info.un}, self_use : 0, used : 0});
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.grab_boon = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionBoonOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var boonId = +req.args.id;

        if(!legion.boons[boonId]) {
            resp.code = 116; resp.desc = 'has grabed'; break;
        }
        if(legion.boons[boonId][1] == uid) {
            resp.code = 1; resp.desc = 'cannot grab yourself'; break;
        }

        resp.data.count = legion.boons[boonId][0];
        delete legion.boons[boonId];

        // 删除聊天记录
        //delUserChatMsg(uid, 'legion', null, {boonId: boonId});
        // 标记已被领取
        markChatMsg(uid, 'legion', {attach : 'boon', id : boonId, lid : lid});
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_gold_tree = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionGoldTreeOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        gLegion.resetGoldTree(lid);

        resp.data.time = legion.gold_tree.time;
        resp.data.outcome = legion.gold_tree.outcome;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.shake_tree = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionGoldTreeOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        gLegion.resetGoldTree(lid);

        if(legion.gold_tree.outcome <= 0) {
            resp.code = 101; resp.desc = 'no outcome'; break;
        }

        legion.gold_tree.outcome--;
        resp.data.level = legion.level;
        gLegion.markDirty(lid, 'gold_tree');
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.mercenary = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionMercenaryOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var userMercenary = req.args.mercenary;
        for (var hid in legion.mercenary[uid]) {
            if (!userMercenary[hid]) {
                delete legion.mercenary[uid][hid];
            }
        }

        resp.data.mercenaries = legion.mercenary[uid];
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.send_mercenary = function(req, res, resp) {
    do {
        var uid = req.uid;
        var hid = req.args.hid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionMercenaryOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var mercenary = legion.mercenary[uid];
        if (!mercenary) {
            mercenary = {};
            legion.mercenary[uid] = mercenary;
            gLegion.markDirty(lid, 'mercenary');
        }

        if (hid in mercenary) {
            ERROR('not equal to game');
            resp.code = 1; resp.desc = 'has send'; break;
        }

        mercenary[hid] = 0;
        gLegion.markDirty(lid, 'mercenary');
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.recall_mercenary = function(req, res, resp) {
    do {
        var uid = req.uid;
        var hid = req.args.hid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (legion.level < gConfLegion.legionMercenaryOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var mercenary = legion.mercenary[uid];
        if(!mercenary || !(hid in mercenary)) {
            ERROR('no mercenary but game is');

        }
        resp.data.hire_gold = mercenary[hid];
        delete mercenary[hid];
        gLegion.markDirty(lid, 'mercenary');
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_mercenaries = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        var noLevel = req.args.no_level;
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        if (!noLevel && legion.level < gConfLegion.legionMercenaryOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var mercenaries = [];
        var userInfo = gUserInfo.getUser(uid);
        var userLevel = userInfo.status.level;
        for (var owner in legion.mercenary) {
            var uerInfo = gUserInfo.getUser(uid);
            var userLevel = userInfo.status.level;
            if (owner == uid || (gUserInfo.getUser(owner).status.level - userLevel >= gConfLegion.legionmercenaryopenlevellimit)) {
                continue;
            }

            var mercenary = legion.mercenary[owner];
            var ownerInfo = gUserInfo.getUser(owner);
            var posObj = ownerInfo.pos;
            for (var pos in posObj) {
                var hid = posObj[pos].hid;
                if (hid && (hid in mercenary)) {
                    mercenaries.push({
                        owner : owner,
                        name : ownerInfo.info.un,
                        hid : hid,
                        level : posObj[pos].level,
                        talent : posObj[pos].talent,
                        fight_force : gUserInfo.getHeroFightForceNoFate(owner, pos),
                        promote : posObj[pos].promote || [],
                    });
                }
            }
        }

        resp.data.mercenaries = mercenaries;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.hire_mercenary = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'no legion'; break;
        }

        var noLevel = req.args.no_level;
        if (!noLevel && legion.level < gConfLegion.legionTrialOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var mercenary = legion.mercenary;

        var owners = req.args.owners;
        var hids = req.args.hids;

        var mercenaries = [];
        var levels = [];
        for(var i = 0; i < owners.length; i++) {
            var owner = owners[i];
            var hid = hids[i];

            if(!(owner in mercenary) || !(hid in mercenary[owner])) {
                resp.code = 1; resp.desc = 'no this hero'; break;
            }

            var ownerInfo = gUserInfo.getUser(owner);
            for(var pos in ownerInfo.pos) {
                var posObj = ownerInfo.pos[pos];
                if(hid == posObj.hid) {
                    var attrNoFate = {};
                    for(var att in posObj.attr) {
                        attrNoFate[att] = posObj.attr[att];
                        if(att in posObj.fate_attr) {
                            attrNoFate[att] -= posObj.fate_attr[att];
                        }
                    }

                    var attr = posObj.attr;
                    mercenaries.push({
                        hid : hid,
                        slot : 0,
                        talent : posObj.talent,
                        destiny : posObj.destiny.level,
                        attr : attrNoFate,
                        fight_force : calcFightForce(attrNoFate, gConfAttPrCoEff[posObj.level]),
                        soldier_level : posObj.soldier.level,
                        promote : posObj.promote || [],
                    });
                    levels.push(posObj.level);

                    break;
                }
            }
        }
        if(resp.code == 0) {
            resp.data.mercenaries = mercenaries;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.trial_fight = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        var legion = gLegion.get(lid);
        if (!legion) {
            resp.code = 1; resp.desc = 'has kicked'; break;
        }

        var mercenary = legion.mercenary;

        var owners = req.args.owners;
        var hids = req.args.hids;

        for(var i = 0; i < owners.length; i++) {
            var owner = owners[i];
            var hid = hids[i];

            var ownerInfo = gUserInfo.getUser(owner);
            for(var pos in ownerInfo.pos) {
                var posObj = ownerInfo.pos[pos];
                if(hid == posObj.hid) {
                    // 如果此玩家没退团，且没召回此武将，才给奖励
                    if(mercenary[owner] && (hid in mercenary[owner])) {
                        mercenary[owner][hid] += gConfLevel[posObj.level].mercenaryHireGold;
                        gLegion.markDirty(lid, 'mercenary');
                    }
                    break;
                }
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 挑战结束
exports.trial_adventure_fight = exports.trial_fight;

exports.get_copy = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 1; resp.desc = 'not in legion'; break;
        }

        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.legionCopyOpenLevel) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        gLegion.updateCopy(lid);

        var copy = gLegion.get(lid).copy;
        resp.data.chapter = copy.chapter;
        resp.data.progress = copy.progress;
        resp.data.healths = copy.healths;
        resp.data.damage = copy.damage[uid];
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_enemy = function(req, res, resp) {
    do {
        var lid = gLegion.userLegion[req.uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        gLegion.updateCopy(lid);
        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.legionCopyOpenLevel) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (!gConfLegionCopy[gLegion.get(lid).copy.chapter]) {
            resp.code = 1; resp.desc = 'all pass'; break;
        }

        var copy = legion.copy;
        if (req.args.chapter != copy.chapter || req.args.progress != copy.progress) {
            resp.code = 111; resp.desc = 'already pass'; break;
        }

        var enemy = gUserInfo.getUserFightInfo(req.uid);
        var promote = {};
        for (var id in enemy.pos) {
            promote[id] = enemy.pos[id].promote;
        }

        resp.data.promote = promote;
        resp.data.healths = copy.healths;
        resp.data.chapter = copy.chapter;
        resp.data.progress = copy.progress;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.before_fight = function(req, res, resp) {
    do {
        var lid = gLegion.userLegion[req.uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        gLegion.updateCopy(lid);
        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.legionCopyOpenLevel) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (!gConfLegionCopy[gLegion.get(lid).copy.chapter]) {
            resp.code = 1; resp.desc = 'all pass'; break;
        }

        var copy = legion.copy;
        if (req.args.chapter != copy.chapter || req.args.progress != copy.progress) {
            resp.code = 111; resp.desc = 'already pass';
        }

        resp.data.healths = legion.copy.healths;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        gLegion.updateCopy(lid);
        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.legionCopyOpenLevel) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var copy = legion.copy;
        var damage = req.args.damage;
        if (req.args.chapter == copy.chapter && req.args.progress == copy.progress) {
            var formation = gConfLegionCopy[copy.chapter]['formation' + copy.progress];
            var formationConf = gConfFormation[formation];
            var idx = 0;
            var isPass = true;
            var pos = req.args.pos;
            var posNum = 0;
            if (pos) {
                posNum = pos.length || 0;
            }
            var posIndex = 0;
            for (var i = 1; i <= 9; i++) {
                var monsterConf = gConfMonster[formationConf['pos' + i]];
                if (monsterConf) {
                    var posDamage = 0;
                    if (posNum && i == pos[posIndex]) {
                        posNum--;
                        posDamage = damage[posIndex];
                        posIndex++;
                    }
                    if (copy.healths[idx]) {
                        if (posDamage) {
                            var baseHp = monsterConf.baseHp;
                            var hp = copy.healths[idx] / 100 * baseHp - posDamage;
                            if (hp <= 0) {
                                hp = 0;
                            } else {
                                isPass = false;
                            }

                            copy.healths[idx] = (+(hp/baseHp).toFixed(4)) * 100 || 0;
                        } else {
                            isPass = false;
                        }
                    }

                    idx++;
                }
            }

            if (isPass) {
                gLegion.addLog(lid, 'passCopy', copy.chapter, copy.progress, gUserInfo.getUser(req.uid).info.un);

                if (!gConfLegionCopy[copy.chapter]['formation' + (copy.progress + 1)]) {
                    gSysMail.addLegionCopyAwardMail(lid);

                    copy.chapter++;
                    copy.progress = 1;
                } else {
                    copy.progress++;
                }

                var chapterConf = gConfLegionCopy[copy.chapter];
                if (chapterConf) {
                    var formationConf = gConfFormation[chapterConf['formation' + copy.progress]];
                    copy.healths = [];
                    for (var i = 1; i <= 9; i++) {
                        var monsterId = formationConf['pos' + i];
                        if (monsterId) {
                            copy.healths.push(100);
                        }
                    }
                }

                resp.data.pass = 1;
            }
        } else {
            resp.data.pass = 1;
        }

        // 更新伤害记录
        if (!copy.damage[uid]) {
            copy.damage[uid] = 0;
        }
        for (var i = 0, len = damage.length; i < len; i++) {
            copy.damage[uid] += damage[i];
        }

        gLegion.markDirty(lid, 'copy');

        if (req.args.autofight) {
            resp.data.copy = {
                chapter: copy.chapter,
                progress: copy.progress,
                healths: copy.healths,
                damage: copy.damage[uid],
            };
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_damage_reward = function(req, res, resp) {
    do {
        var lid = gLegion.userLegion[req.uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion'; break;
        }

        var copy = gLegion.get(lid).copy;
        if (req.args.damage > copy.damage[req.uid]) {
            resp.code = 1; resp.desc = 'not enough'; break;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_castle = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var lid = req.args.lid;
        if(!lid) {
            lid = gLegion.userLegion[uid];
            if(!lid) {
                resp.code = 1; resp.desc = 'not in legion'; break;
            }
        }
        resp.data.castle = gLegion.getCastleData(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取可侵略的城池列表
exports.get_legion_list = function(req, res, resp) {
    var user = player.user;
    var uid = +req.uid;
    do {
        var legionId = gLegion.userLegion[uid];
        var legionLevel = gLegion.get(legionId).level;
        var weights = {};
        for(var lid in gLegion.legions) {
            if(lid == legionId) {
                continue;
            }

            weights[lid] = 100 - Math.abs(gLegion.get(lid).level-legionLevel);
        }
        var lids = common.randArrayWithNum(weights, gConfGlobal.invadeLegionCount);
        var legions = [];
        for(var i = 0, len = lids.length; i < len; i++) {
            var legion = gLegion.get(lids[i]);
            legions.push({
                lid : lids[i],
                name : legion.name,
                level : legion.level,
                count : legion.member_count,
            });
        }
        resp.data.legions = legions;
    }while(false);

    onReqHandled(res, resp, 1);
};

exports.invade_castle = function(req, res, resp) {
    do {
        var lid = req.args.lid;
        var enemy = req.args.enemy;
        var legion = gLegion.get(lid);
        if(!legion) {
            resp.code = 113; resp.desc = 'no this legion'; break;
        }
        if(!legion.members[enemy]) {
            resp.code = 114; resp.desc = 'no this user'; break;
        }
        if(lid == gLegion.userLegion[req.uid]) {
            resp.code = 1; resp.desc = 'same legion'; break;
        }

        if(legion.members[enemy].castle_status == 1) {
            resp.code = 115; resp.desc = 'has invaded'; break;
        }

        resp.data.info = gUserInfo.getUserFightInfo();
    } while (false);

    onReqHandled(res, resp, 1);
};

// 开始战斗
exports.castle_before_fight = function(req, res, resp) {
    do {
        var enemy = +req.args.enemy;
        var lid = +req.args.lid;
        var type = req.args.type;
        var legion = gLegion.get(lid);
        if(!legion) {
            resp.code = 113; resp.desc = 'no this legion'; break;
        }

        if(!legion.members[enemy]) {
            resp.code = 114; resp.desc = 'no this user'; break;
        }

        if(legion.members[enemy].castle_status == 1 && type == 'invade') {
            resp.code = 115; resp.desc = 'has invaded'; break;
        }

        if(legion.members[enemy].castle_status == 0 && type == 'rescue') {
            resp.code = 115; resp.desc = 'has rescued'; break;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.castle_fight = function(req, res, resp) {
    do {
        var star = +req.args.star;
        var type = req.args.type;
        var enemy = +req.args.enemy;
        var lid = +req.args.lid;

        var legion = gLegion.get(lid);
        if(!legion) {
            resp.code = 113; resp.desc = 'no this legion'; break;
        }

        if(!legion.members[enemy]) {
            resp.code = 114; resp.desc = 'no this user'; break;
        }

        if(star > 0) {
            if(type == 'invade') {
                legion.members[enemy].castle_status = 1;
                legion.members[enemy].castle_invader = +req.uid;
            }else {
                legion.members[enemy].castle_status = 0;
                legion.members[enemy].castle_invader = 0;
            }
            gLegion.markDirty(lid, 'members');
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_construct = function(req, res, resp) {
    var lid = gLegion.userLegion[req.uid];
    if (!lid) {
        resp.code = 1; resp.desc = 'no legion'; onReqHandled(res, resp, 1); return;
    }

    var legion = gLegion.get(lid);
    resp.data.progress = legion.construct_progress;
    resp.data.all_count = legion.construct_count;
    resp.data.member_count = legion.member_count;

    onReqHandled(res, resp, 1);
};

exports.build_construct = function(req, res, resp) {
    var lid = gLegion.userLegion[req.uid];
    if (!lid) {
        resp.code = 1; resp.desc = 'no legion'; onReqHandled(res, resp, 1); return;
    }

    var legion = gLegion.get(lid);
    if (req.args.new) {
        legion.construct_count++;
        gLegion.markDirty(lid, 'construct_count');
    }

    legion.construct_progress += req.args.add_progress;
    gLegion.markDirty(lid, 'construct_progress');

    gLegion.addXp(lid, req.args.add_xp);
    gLegion.addLog(lid, 'construct', gUserInfo.getUser(req.uid).info.un, req.args.type);

    onReqHandled(res, resp, 1);
};

exports.gm_promote = function(req, res, resp) {
    var uid = req.uid;
    var lid = gLegion.userLegion[uid];
    if (lid) {
        var legion = gLegion.get(lid);
        var duty = legion.members[uid].duty;
        var oldMaster = legion.master;
        legion.master = uid;
        legion.members[oldMaster].duty = duty;
        legion.members[uid].duty = LegionDuty.MASTER;
        gLegion.markDirty(lid, 'members');
    }

    onReqHandled(res, resp, 1);
};

exports.get_wish_list = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.leigionWishOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var log = 0;
        var wishLog = legion.wish_log[uid];
        if (wishLog) {
            for (var id = 0; id < wishLog.length; id++) {
                if (wishLog[id][4]) {
                    log = 1;
                    break;
                }
            }
        }

        resp.data.wish_log = log;
        resp.data.own_wish = legion.wish_list;
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.wish = function(req, res, resp) {
    do {
        var uid = req.uid;
        var fragmentId = req.args.id;
        var own = req.args.own;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        var legion = gLegion.get(lid);
        if (legion.level < gConfLegion.leigionWishOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        gLegion.initWishList(uid, fragmentId, own);
        resp.data.wish = legion.wish_list[uid];
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.wish_give = function(req, res, resp) {
    do {
        var uid = req.uid;
        var givenUid = req.args.ruid;
        var givenWishTimes = req.args.times;
        var givenFragmentId = req.args.id;
        var onceGiveNum = req.args.onceGiveNum;
        var lid = gLegion.userLegion[uid];
        var givenLid = gLegion.userLegion[givenUid];
        if (!lid || !givenLid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        if (lid != givenLid) {
            resp.code = 1; resp.desc = 'lid or givenLid error';  break;
        }

        var legion = gLegion.get(lid);
        var givenLegion = gLegion.get(givenLid);
        if (legion.level < gConfLegion.leigionWishOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        if (givenLegion.level < gConfLegion.leigionWishOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        var wishList = legion.wish_list;
        var givenProgress = wishList[givenUid];
        var givenTimes = givenProgress[givenWishTimes];
        if (!givenProgress) {
            resp.code = 101; resp.desc = 'args ruid error'; break;
        }

        if (!givenTimes) {
            resp.code = 102; resp.desc = 'args times error'; break;
        }

        if (givenFragmentId != givenTimes.fragment) {
            resp.code = 103; resp.desc = 'args id error'; break;
        }

        var hasGot = givenTimes.has_got;
        var hasCollect = givenTimes.has_collect;
        var confGiven = gConfHero[givenFragmentId];
        if (!confGiven) {
            resp.code = 103; resp.desc = 'args id error'; break;
        }

        var givenHeroQuality = confGiven.quality;
        var givenWishTarget = gConfLegionWishConf[givenHeroQuality].wishFragmentMax;
        if (hasGot + onceGiveNum > givenWishTarget) {
            resp.code = 105; resp.desc = 'given num is max'; break;
        }

        var givenHasGot = 0;
        givenHasGot  = hasGot + onceGiveNum;
        wishList[givenUid][givenWishTimes].has_got = givenHasGot;
        gLegion.markDirty(lid, 'wish_list');

        if (!legion.wish_log[givenUid]) {
            legion.wish_log[givenUid] = [];
            gLegion.markDirty(lid, 'wish_log');
        }

        var now = common.getTime();
        var log = [];
        log[0] = now;
        log[1] = gUserInfo.getUser(uid).info.un;
        log[2] = givenFragmentId;
        log[3] = onceGiveNum;
        log[4] = 1;
        legion.wish_log[givenUid].push(log);
        gLegion.markDirty(lid, 'wish_log');

        if (givenHasGot > hasCollect) {
            gTips.addTip(givenUid, 'legion_wish');
        }

        resp.data.awards = gConfLegionWishConf[givenHeroQuality].award;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_wish_fragment = function(req, res, resp) {
    do {
        var uid = req.uid;
        var wishTimes = req.args.times;
        var fragmentId = req.args.id;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        var legion = gLegion.get(lid);
        var wishList = legion.wish_list;
        if (!wishList[uid]) {
            resp.code = 1; resp.desc = 'no wish';  break;
        }

        if (!wishList[uid][wishTimes]) {
            resp.code = 102; resp.desc = 'args times error';  break;
        }

        if (wishList[uid][wishTimes].fragment != fragmentId) {
            resp.code = 103; resp.desc = 'args id error';  break;
        }

        var canGet = wishList[uid][wishTimes].has_got - wishList[uid][wishTimes].has_collect;
        wishList[uid][wishTimes].has_collect = wishList[uid][wishTimes].has_got;
        gLegion.markDirty(lid, 'wish_list');

        resp.data.can_get = canGet;
        resp.data.has_got = wishList[uid][wishTimes].has_got;
        resp.data.has_collect = wishList[uid][wishTimes].has_collect;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_wish_awards_message = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        var legion = gLegion.get(lid);
        var wishList = legion.wish_list[uid];
        var achievementWish = 0;
        if (wishList) {
            for (var id in wishList) {
                var fid = wishList[id].fragment;
                var fidQuality = gConfHero[fid].quality;
                var targetNum = gConfLegionWishConf[fidQuality].wishFragmentMax;
                if (wishList[id].has_got == targetNum) {
                    achievementWish += 1;
                }
            }
        }

        resp.data.achievement_wish = achievementWish;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_wish_log = function(req, res, resp) {
    do {
        var uid = req.uid;
        var lid = gLegion.userLegion[uid];
        if (!lid) {
            resp.code = 104; resp.desc = 'no legion';  break;
        }

        var legion = gLegion.get(lid);
        if (!legion.wish_log[uid]) {
            legion.wish_log[uid] = [];
            gLegion.markDirty(lid, 'wish_log');
        }

        var wishLog = legion.wish_log[uid];
        if (wishLog) {
            for (var id = 0; id < wishLog.length; id++) {
                if (wishLog[id][4]) {
                    wishLog[id][4] = 0;
                }
            }
        }
        gLegion.markDirty(lid, 'wish_log');

        resp.data.wish_log = wishLog;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.Legion = Legion;
