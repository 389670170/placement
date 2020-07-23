// 玩家自己的邮件, 以及部分附件过大的公共邮件
function Mail() {
    this.mail = {
        /*
         uid : {                             // 玩家独立邮件
             id : {
                 from : 0,                   // 发件人，0表示系统
                 title : 0,                  // 标题
                 content : '',               // 内容
                 awards : [],                // 附件
                 time : 0,                   // 发送时间
                 expire : 0,                 // 过期时间
             },
         },
         */
    };

    this.users = {                          // 玩家信息
        //uid : [minid, maxid, count]       // 最小邮件id，最大邮件id，邮件个数
    },
        this.updates = {};                      // 更新
    this.saveCount = 0;                     // 保存计数
    this.sysMail = {                        // attach内容比较大的公共邮件, 放在这里防止sys_mail过大而无法添加新邮件
        /*
        mail_id : {
            from : 0,
            title : 0,
            awards : '',
            time : 0,
            expire : 0,
            attach : {},                    // 附件
        },

        */
    };
}

Mail.prototype = {
    init: function (callback) {
        var cursor = gDBMail.find();
        var now = common.getTime();

        cursor.each(function (err, item) {
            if (err) {
                callback && callback(false);
            }

            if (item) {
                // 公共邮件
                var uid = item._id;
                if (uid < 1000000) {
                    this.sysMail[uid] = item.mail;
                    return;
                }

                // 私人邮件
                var minId = 0;
                var maxId = 0;
                var count = 0;

                this.mail[uid] = {};
                for (var id in item.mail) {
                    var mail = item.mail[id];
                    if (!mail) continue;

                    if (now >= mail.expire) {
                        this.markDelete(uid, id);
                        continue;
                    }

                    this.mail[uid][id] = mail;
                    if (!minId) {
                        minId = +id;
                    } else {
                        minId = (+id < minId ? +id : minId);
                    }
                    maxId = (+id > maxId ? +id : maxId);
                    count++;
                }
                this.users[uid] = [minId, maxId, count];
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    markNew: function (uid, id) {
        if (!this.updates[uid]) {
            this.updates[uid] = {};
        }
        this.updates[uid][id] = 0;
        this.saveCount++;
    },

    markDelete: function (uid, id) {
        if (id) {
            if (!this.updates[uid]) {
                this.updates[uid] = {};
            }
            this.updates[uid][id] = 1;
        } else {
            this.updates[uid] = 1;
        }
        this.saveCount++;
    },

    save: function (force, callback) {
        if (!force && this.saveCount < 10) {
            callback && callback(true);
            return;
        }

        if (this.saveCount <= 0) {
            callback && callback(true);
            return;
        }

        var loader = new common.Loader(callback);
        loader.addLoad('empty');
        for (var uid in this.updates) {
            var updates = { $set: {}, $unset: {} };
            var removes = [];
            // 公共邮件
            if (uid < 1000000) {
                if (this.updates[uid]) {
                    removes.push(+uid);
                }
            } else {
                for (var id in this.updates[uid]) {
                    if (this.updates[uid][id]) {
                        updates['$unset']['mail.' + id] = 1;
                    } else {
                        updates['$set']['mail.' + id] = this.mail[uid][id];
                    }
                }
            }

            if (removes.length > 0) {
                loader.addLoad(1);
                gDBMail.remove({ _id: { '$in': removes } }, function (err, result) {
                    loader.onLoad(1);
                });
            }

            var toUpdate = 2;
            if (Object.keys(updates['$set']).length == 0) {
                delete updates['$set'];
                toUpdate--;
            }

            if (Object.keys(updates['$unset']).length == 0) {
                delete updates['$unset'];
                toUpdate--;
            }

            if (toUpdate) {
                loader.addLoad(1);
                gDBMail.update({ _id: +uid }, updates, function (err, result) {
                    if (err) {
                        ERROR(util.format('mail SAVE %d %j %j', this, updates, err));
                    }
                    loader.onLoad(1);
                }.bind(uid));
            }
        }
        loader.onLoad('empty');
        this.updates = {};
        this.saveCount = 0;
    },

    getMails: function (uid, startId) {
        var mails = this.mail[uid];
        if (!mails) {
            return {};
        }

        var now = common.getTime();
        var result = {};
        for (var id in mails) {
            var mail = mails[id];
            if (mail) {
                if (now >= mail.expire) {
                    this.markDelete(uid, id);
                    delete this.mail[uid][id];
                    continue;
                }
                if (!startId || (startId && id > startId)) {
                    result[id] = mail;
                }
            }
        }

        return result;
    },

    getMinId: function (uid) {
        var mails = this.mail[uid];
        if (!mails) {
            return 0;
        }
        var minId = 0;
        for (var id in mails) {
            if (!minId) {
                minId = id;
            } else {
                minId = (id < minId ? id : minId);
            }
        }
        return minId;
    },

    add: function (uid, mail) {
        // 添加公共邮件
        if (uid < 1000000) {
            this.sysMail[++gSysMail.sys_mail.ai] = mail;
            if (!gSysMail.updates['$set']) { gSysMail.updates['$set'] = {}; }
            gSysMail.updates['$set']['sys_mail.ai'] = gSysMail.sys_mail.ai;
            gDBMail.save({ _id: gSysMail.sys_mail.ai, mail: mail }, function (err, result) {
                if (err) {
                    ERROR(err);
                }
            });
        } else {
            if (!this.mail[uid]) {
                this.mail[uid] = {};
                this.users[uid] = [1, 0, 0];

                gDBMail.insert({ _id: +uid, mail: {} }, function (err, result) {
                    if (err) {
                        ERROR(util.format('mail ADD %d %j', uid, err));
                    }
                });
            }

            var id = ++this.users[uid][1];
            this.mail[uid][id] = mail;
            this.users[uid][2]++;
            this.markNew(uid, id);

            // 删除多的邮件
            if (this.users[uid][2] > gConfGlobal.mailMaxCount) {
                this.del(uid, this.users[uid][0]);
            }

            // 发邮件通知
            pushToUser(uid, 'self', {
                mod: 'mail',
                act: 'new'
            });
        }
    },

    del: function (uid, id) {
        if (uid < 1000000) {
            delete this.sysMail[uid];
            this.markDelete(uid);
        } else {
            if (!this.mail[uid] || !this.mail[uid][id]) {
                return;
            }
            delete this.mail[uid][id];
            this.markDelete(uid, id);
            this.users[uid][2]--;
            // 重置最小值
            if (id == this.users[uid][0]) {
                this.users[uid][0] = this.getMinId(uid);
            }
        }
    },

    get: function (uid, ids) {
        if (uid > 10000) {
            if (ids) {
                return this.getMails(uid, ids[0]);
            } else {
                return this.getMails(uid);
            }
        }

        return {};
    },
};

// 系统全服邮件及公告
function SysMail() {
    this.sys_mail = {
        /*
        id : {
            type : 0,                       // 0系统邮件，1系统公告
            title : '',                     // 标题
            content : '',                   // 内容
            awards : [],                    // 附件
            time : 0,                       // 发送时间
            expire : 0,                     // 过时时间
            attach : {},                    // 附件, 玩家根据条件获取对应奖励
        },
        */
        'ai': 0,                           // 自增值
    };

    this.updates = {};                      // 标记更新的邮件
}

SysMail.create = function (callback) {
    var sysMailData = {
        '_id': 'sys_mail',
        'sys_mail': {
            ai: 0,
        },
    };

    gDBWorld.insert(sysMailData, function (err, result) {
        callback && callback();
    });
};

SysMail.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'sys_mail' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.sys_mail = doc.sys_mail;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function (callback) {
        if (Object.isEmpty(this.updates)) {
            callback && callback(true);
            return;
        }

        var updates = this.updates;
        gDBWorld.update({ _id: 'sys_mail' }, updates, function (err, result) {
            if (err) {
                ERROR('SYSMAIL SAVE FAIL:');
                ERROR({ updates: updates, err: err });
                callback && callback(false);
            } else {
                INFO('SYSMAIL SAVE:');
                INFO(updates);
                callback && callback(true);
            }
        });

        this.updates = {};
    },

    // startId为起始id, options为额外信息
    getMails: function (uid, options, startId) {
        var now = common.getTime();
        var mails = {};
        var allSysMails = {};
        for (var id in gMail.sysMail) {
            if (!startId || id > startId) {
                if (options.excepts && options.excepts[id] == 2) {
                    continue;
                }
                if (options.create_time > gMail.sysMail[id].time) {
                    continue;
                }
                allSysMails[id] = gMail.sysMail[id];
            }
        }
        for (var id in this.sys_mail) {
            if (isNaN(id) || (startId && id <= startId)) {
                continue;
            }
            if (options.excepts && options.excepts[id] == 2) {
                continue;
            }
            if (options.create_time > this.sys_mail[id].time) {
                continue;
            }
            if (!allSysMails[id]) {
                allSysMails[id] = this.sys_mail[id];
            }
        }

        for (var id in allSysMails) {
            var mail = allSysMails[id];
            if (now >= mail.expire) {
                if (mail.attach && mail.attach.huge) {
                    gMail.markDelete(id);
                } else {
                    delete this.sys_mail[id];
                    this.markDelete(id);
                }
            } else {
                if (typeof mail.awards == 'string') {
                    var info = this.getSysMailExtr(uid, mail, options);
                    if (!info) {
                        continue;
                    }
                    var realMail = cloneSystemMail(mail);
                    realMail.content = info.content;
                    realMail.awards = info.awards;
                    mails[id] = realMail;
                } else {
                    mails[id] = mail;
                }
            }
        }
        return mails;
    },

    // 获取不同类型邮件的广播列表
    getSysMailBroadcastUid: function (mail) {
        var uids = [];

        if (mail.awards == 'arena_rank') {                   // 竞技场排名奖励
            var ranks = mail.attach.ranks;
            for (var uid in ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'country') {                // 皇城每日结算奖励
            var position = mail.attach.position;
            for (var uid in position) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'limit_group') {            // 限时团购每日结算奖励
            var buyers = mail.attach.buyer;
            for (var uid in buyers) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'territory_war' || mail.awards == 'territory_boss_owner') {    // 领地战每日奖励
            var lid = parseInt(mail.attach.lid);
            var legion = gNewLegion.get(lid);
            if (legion) {
                var memberList = legion.member_list;
                for (var uid in memberList) {
                    if (memberList[uid].join_time < mail.time) {    // 加入军团时间必须是早于邮件发送时间
                        uids.push(+uid);
                    }
                }
            }
        } else if (mail.awards == 'territory_boss_rank') {  // 领地战boss排名奖励
            var mail_lids = mail.attach.lids;
            for (var lid in mail_lids) {
                var legion = gNewLegion.get(lid);
                if (legion) {
                    var memberList = legion.member_list;
                    for (var uid in memberList) {
                        if (memberList[uid].join_time < mail.time) {    // 加入军团时间必须是早于邮件发送时间
                            uids.push(+uid);
                        }
                    }
                }
            }
        } else if (mail.awards == 'open_rank_ff') {     // 战力排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'open_rank_ff_10') {     // 战力排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'open_rank_ff_15') {     // 战力排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'open_rank_level') {  // 等级排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'open_rank_recharge') {  // 充值排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'open_rank_expense') {  // 消费排行奖励邮件
            for (var uid in mail.attach.ranks) {
                uids.push(+uid);
            }
        } else if (mail.awards == 'legion_boss_join') { // 军团boss参与奖
            uids = mail.attach.uids;
        } else if (mail.awards == 'legion_boss_first_kill') {   // 军团boss首杀奖励
            uids = mail.attach.uids;
        } else if (mail.awards == 'legion_boss_rank') { // 军团boss排名奖励
            uids = mail.attach.uids;
        } else if (mail.awards == 'ww_rank') { // 军团boss排名奖励
            uids = mail.attach.ranks.slice();
        } else if (mail.awards == 'ww_playoff') { // 军团boss排名奖励
            uids = mail.attach.ranks.slice();
        } else if (mail.awards == 'winner_daily_award') {   // 每日福利邮件
            uids = null;
        } else if (mail.type == 'all_user') {   // 全服补偿
            uids = null;
        }

        return uids;
    },

    getSysMailExtr: function (uid, mail, options) {
        // 奖励根据玩家的数据动态生成
        if (mail.awards == 'arena_rank') {                   // 竞技场排名奖励
            var ranks = mail.attach.ranks;
            var rank = ranks[uid];
            if (!rank) {
                return null;
            }

            var arenaType = rank.type;
            var arenaRank = rank.rank;

            function getArenaAwards(type, rank) {
                var fitIndex = null;
                if ((arenaType >= 1 && arenaType <= 6) || arenaType == ArenaType.THIS || arenaType == ArenaType.CROSS) {
                    var max = Object.keys(gConfArenaRank[arenaType]).max();
                    for (var i = 1; i < max; i++) {
                        if (arenaRank >= gConfArenaRank[arenaType][i].rank && arenaRank < gConfArenaRank[arenaType][i + 1].rank) {
                            fitIndex = i;
                            break;
                        }
                    }
                }

                if (fitIndex == null) {
                    fitIndex = max;
                }

                var award = [];
                if (arenaType && fitIndex) {
                    award = gConfArenaRank[arenaType][fitIndex].award;
                }
                return award;
            }

            var awards = getArenaAwards(arenaType, arenaRank);
            return { content: [4, arenaType, arenaRank], awards: awards }
        } else if (mail.awards == 'ww_rank') {                // 跨服战积分赛奖励
            var ranks = mail.attach.ranks;
            var rank = ranks.indexOf(uid) + 1;
            if (rank <= 0) {
                return null;
            }

            var stages = Object.keys(gConfWorldWarGlory);
            stages.sort(function (a, b) { return (+b) - (+a); });
            for (var i = 0, len = stages.length; i < len; i++) {
                if (rank >= +stages[i]) {
                    return { content: [12, rank], awards: gConfWorldWarGlory[stages[i]].awards }
                }
            }

            return null;
        } else if (mail.awards == 'ww_sup') {                 // 跨服战支持奖励
            var supports = mail.attach.supports;
            if (supports && supports[uid]) {
                return {
                    content: [11, mail.attach.progress],
                    awards: [['user', 'token', supports[uid]]],
                };
            }

            return null;
        } else if (mail.awards == 'ww_playoff') {             // 跨服战决赛奖励
            var ranks = mail.attach.ranks || mail.attach.top32;
            var rank = ranks.indexOf(uid) + 1;
            if (rank <= 0) {
                return null;
            }

            var stages = Object.keys(gConfWorldWarReward);
            stages.sort(function (a, b) { return (+b) - (+a) });
            for (var i = 0, len = stages.length; i < len; i++) {
                if (rank >= stages[i]) {
                    return { content: [13, rank], awards: gConfWorldWarReward[stages[i]].awards };
                }
            }

            return null;
        } else if (mail.awards == 'legion_copy') {            // 军团副本章节通关奖励
            var members = mail.attach.members;
            var chapter = mail.attach.chapter;
            if (members.indexOf(uid) == -1) {
                return null;
            }

            return { content: [14, chapter], awards: gConfLegionCopy[chapter].reward };
        } else if (mail.awards == 'country') {                // 皇城每日结算奖励
            var position = mail.attach.position;
            var salaryList = mail.attach.salary;
            var pos = position[uid];
            if (!pos) {
                return null;
            }

            var posConf = gConfPosition[pos];
            if (!posConf)
                return null;

            if (salaryList) {
                var salary = salaryList[uid];
                if (salary) {
                    var awards = clone(posConf.reward);
                    awards.push(['user', 'salary', salary]);

                    return { content: [15, pos], awards: awards };
                } else {
                    return null;
                }
            } else {
                return { content: [15, pos], awards: posConf.reward };
            }
        } else if (mail.awards == 'limit_group') {            // 限时团购每日结算奖励
            var buyers = mail.attach.buyer;
            var buyer = buyers[uid];
            if (!buyer) {
                return null;
            }

            var retCash = 0;
            var goods = mail.attach.goods;
            for (var id in goods) {
                if (!buyer[id]) {
                    continue;
                }

                var cnt = goods[id];
                var conf = gConfAvLimitGroup[id];
                if (conf) {
                    for (var i = 5; i >= 1; i--) {
                        var price = conf['price' + i];
                        if (price && cnt >= conf['require' + i]) {
                            retCash += (conf.oriPrice - price) * buyer[id];
                            break;
                        }
                    }
                }
            }

            if (!retCash) {
                return null;
            }

            retCash = Math.floor(retCash);
            return {
                content: [1004, retCash],
                awards: [['user', 'cash', retCash]],
            };
        } else if (mail.awards == 'lord') {                // 皇城每日结算奖励
            if (!options.country) {
                return null;
            }

            var position = mail.attach.position;
            var pos = position[uid];
            if (!pos) {
                return null;
            }

            var countryPos = mail.attach.country[options.country].position[pos]
            if (!countryPos.hasOwnProperty(uid)) {
                return null;
            }

            var rank = mail.attach.ranks[options.country - 1];
            var awards = gConfLordCountrySalary[rank].awards;
            return { content: [9, rank], awards: awards };
        } else if (mail.awards == 'lucky_wheel') {            // 幸运转盘每日结算奖励
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var award = null;
            var ranks = Object.keys(gConfAvLuckyWheelRank).sort(function (a, b) { return a - b; });
            for (var i = 0, len = ranks.length; i < len; i++) {
                if (rank <= ranks[i]) {
                    award = gConfAvLuckyWheelRank[ranks[i]].award;
                    break;
                }
            }

            if (!award) {
                return null;
            }

            return {
                content: [1003, rank],
                awards: award,
            };
        } else if (mail.awards == 'promote_wheel') {
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var award = null;
            var ranks = Object.keys(gConfPromoteRankRed).sort(function (a, b) { return a - b; });
            for (var i = 0, len = ranks.length; i < len; i++) {
                if (rank <= ranks[i]) {
                    award = gConfPromoteRankRed[ranks[i]].award;
                    break;
                }
            }

            if (!award) {
                return null;
            }

            return {
                content: [1009, rank],
                awards: award,
            };
        } else if (mail.awards == 'territory_war') {    // 领地战每日奖励
            var lid = gNewLegion.userLegion[uid];
            if (parseInt(mail.attach.lid) == lid) {
                // 检查玩家加入军团的时间是否晚于邮件发送时间
                var legion = gNewLegion.get(lid);
                if (legion.member_list[uid].join_time > mail.time) {
                    return null;
                }

                var params = mail.attach.params;
                awards = [];
                for (var mineId in params) {
                    var param1 = params[mineId].param1; // 掠夺的系数
                    var param2 = params[mineId].param2; // 石碑加成系数
                    var param3 = this.getBuildingParam(uid, 'mineAward'); // 城池升级加成

                    var award = clone(gConfTerritoryWarMapMine[mineId].award1);
                    for (var i = 0; i < award.length; i++) {
                        award[i][2] = Math.floor(award[i][2] * ((1 - param1 / 100) * (1 + param3[0] / 100) + param2 / 100));
                    }
                    awards = awards.concat(award);
                }

                return {
                    content: [26],
                    awards: awards,
                };
            }
            else {
                return null;
            }
        } else if (mail.awards == 'territory_boss_owner') { // 领地战boss归属奖励
            var lid = gNewLegion.userLegion[uid];
            if (parseInt(mail.attach.lid) == lid) {
                // 检查玩家加入军团的时间是否晚于邮件发送时间
                var legion = gNewLegion.get(lid);
                if (legion.member_list[uid].join_time > mail.time) {
                    return null;
                }

                var legionLevel = mail.attach.legionLevel;
                if (!legionLevel) {
                    var legion = gNewLegion.legions[lid];
                    if (legion) {
                        legionLevel = legion.level;
                    } else {
                        legionLevel = 10;
                    }
                }
                var award = gConfTerritoryBossLegionConf[legionLevel].award;

                return {
                    content: [29, rank],
                    awards: award,
                };
            }
        } else if (mail.awards == 'territory_boss_rank') {  // 领地战boss排名奖励
            var lid = gNewLegion.userLegion[uid];
            var mail_lids = mail.attach.lids;
            if (mail_lids && mail_lids.indexOf(parseInt(lid)) >= 0) {
                // 检查玩家加入军团的时间是否晚于邮件发送时间
                var legion = gNewLegion.get(lid);
                if (legion.member_list[uid].join_time > mail.time) {
                    DEBUG('join time bigger than mail time, uid = ' + uid);
                    return null;
                }

                var rank = mail.attach.rank.indexOf(uid) + 1;
                if (rank <= 0) {
                    DEBUG('rank < 0, uid =  ' + uid);
                    return null;
                }

                var award = null;
                var rankMaxCount = Object.keys(gConfTerritoryBossSelfAward).length;
                for (var i = 0; i < rankMaxCount; i++) {
                    var min = gConfTerritoryBossSelfAward[i + 1].rank[0];
                    var max = gConfTerritoryBossSelfAward[i + 1].rank[1];
                    if (!max && max != 0) {
                        max = min;
                    }
                    if (i + 1 == rankMaxCount) {
                        max = 99999;
                    }

                    if (rank >= min && rank <= max) {
                        award = gConfTerritoryBossSelfAward[i + 1].award;
                        break;
                    }
                }

                return {
                    content: [30, rank],
                    awards: award,
                };
            }
        } else if (mail.awards == 'countrywar_personal_day') {
            return null;// 先暂时屏蔽
            // 国战每日个人奖励
            var user = gUserInfo.getUser(uid);
            if (!user) {
                return null;
            }

            var rank = null;
            for (var i = 0; i < mail.attach.ranks.length; i++) {
                if (mail.attach.ranks[i] == uid) {
                    rank = i + 1;
                    break;
                }
            }

            if (!rank)
                return null;

            var awardIndex = 1;
            for (var i = 1; i <= Object.keys(gConfCountryWarPersonalRank).length; i++) {
                if (gConfCountryWarPersonalRank[i.toString()].rank > rank) {
                    break;
                } else {
                    awardIndex = i;
                }
            }

            var awards = gConfCountryWarPersonalRank[awardIndex].awards;
            if (!awards)
                return null;

            return {
                content: [31, rank],
                awards: awards,
            }
        } else if (mail.awards == 'countrywar_personal_week') {
            return null;
            // 国战每周个人奖励
            var user = gUserInfo.getUser(uid);
            if (!user) {
                return null;
            }

            if (!mail.attach.ranks[uid])
                return null;

            var rank = mail.attach.ranks[uid].rank;
            var camp = mail.attach.ranks[uid].camp;

            var campRank = null;
            for (var i = 0; i < mail.attach.campRanks.length; i++) {
                if (mail.attach.campRanks[i] == camp) {
                    campRank = i + 1;
                    break;
                }
            }

            if (!campRank)
                return null;


            var awardIndex = 1;
            var campAwardList = gConfCountryWarCountryRank[campRank];
            for (var i = 1; i <= Object.keys(campAwardList).length; i++) {
                if (campAwardList[i].rank > rank) {
                    break;
                } else {
                    awardIndex = i;
                }
            }

            var awards = gConfCountryWarCountryRank[campRank][awardIndex].awards;
            if (!awards)
                return null;

            return {
                content: [32, rank],
                awards: awards,
            }
        } else if (mail.awards == 'open_rank_ff') {
            //var avConf = gConfAvRank['fight_force'];
            var avConf = gConfAvRankFightForce;
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1007, rank], awards: avConf[fitRank].award };

        } else if (mail.awards == 'open_rank_ff_10') {
            //var avConf = gConfAvRank['fight_force'];
            var avConf = gConfAvRankFightForce10;
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1008, rank], awards: avConf[fitRank].award };

        } else if (mail.awards == 'open_rank_ff_15') {
            //var avConf = gConfAvRank['fight_force'];
            var avConf = gConfAvRankFightForce15;
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1009, rank], awards: avConf[fitRank].award };

            // } else if (mail.awards == 'open_rank_arena') {
            //     var avConf = gConfAvRank['arena'];
            //     var rank = mail.attach.ranks[uid];
            //     if (!rank) {
            //         return null;
            //     }
            //
            //     var range = Object.keys(avConf).sort(function(a, b) { return (+b) - (+a)});
            //     for (var i = 0, len = range.length; i < len; i++) {
            //         if (rank >= +range[i]) {
            //             return {content : [1005, rank], awards: avConf[range[i]].award};
            //         }
            //     }
            //
            //     return null;
        } else if (mail.awards == 'open_rank_recharge') {
            var avConf = gConfAvRankRecharge;
            var rank = mail.attach.ranks[uid];
            if (!rank) { return null; }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1014, rank], awards: avConf[fitRank].award };
            return null;
        } else if (mail.awards == 'open_rank_expense') {
            var avConf = gConfAvRankExpense;
            var rank = mail.attach.ranks[uid];
            if (!rank) { return null; }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1015, rank], awards: avConf[fitRank].award };
            return null;
        } else if (mail.awards == 'open_rank_level') {
            //var avConf = gConfAvRank['level'];
            var avConf = gConfAvRankLevel;
            var rank = mail.attach.ranks[uid];
            if (!rank) {
                return null;
            }

            var fitRank = null;
            for (var i = 1; i < Object.keys(avConf).length; i++) {
                if (rank >= avConf[i].rank && rank < avConf[i + 1].rank) {
                    fitRank = i;
                    break;
                }
            }

            if (fitRank == null) {
                fitRank = Object.keys(avConf).max();
            }

            return { content: [1006, rank], awards: avConf[fitRank].award };
        } else if (mail.awards == 'legion_boss_join') {
            // 军团boss参与奖励
            var selfLid = gNewLegion.userLegion[uid];
            var lid = mail.attach.lid;
            if (selfLid != lid) {
                return null;
            }

            var uids = mail.attach.uids;
            if (!uids) {
                return null;
            }

            if (uids.indexOf(uid) < 0) {
                return null;
            }

            return { content: [51], awards: mail.attach.awards };
        } else if (mail.awards == 'legion_boss_first_kill') {
            // 军团boss首杀奖励
            var selfLid = gNewLegion.userLegion[uid];
            var lid = mail.attach.lid;
            if (selfLid != lid) {
                return null;
            }

            var uids = mail.attach.uids;
            if (!uids) {
                return null;
            }

            if (uids.indexOf(uid) < 0) {
                return null;
            }

            return { content: [52, mail.content[1]], awards: mail.attach.awards };
        } else if (mail.awards == 'legion_boss_rank') {
            // 军团boss排名奖励
            var selfLid = gNewLegion.userLegion[uid];
            if (!selfLid) {
                return null;
            }

            var lid = mail.attach.lid;
            if (parseInt(selfLid) != parseInt(lid)) {
                return null;
            }

            var uids = mail.attach.uids;
            if (!uids) {
                return null;
            }

            if (uids.indexOf(uid) < 0) {
                return null;
            }

            return { content: [53, mail.attach.rank], awards: mail.attach.awards };
        } else if (mail.awards == 'winner_daily_award') {
            // 检查创建角色时间，今天创建的就不能收
            // var user = gUserInfo.getUser(uid);
            // var createDate = getGameDate(user.info.create);
            // var mailDate = getGameDate(mail.time);
            // if (mailDate > createDate) {
            //     var dailyAwards = [['user', 'bindcash', 3000], ['user', 'vip_xp', 3000]];
            //     return {content : [1011], awards : dailyAwards};
            // }
            return null;
        } else {
            return null;
        }
    },

    getBuildingParam: function (uid, func_name) {
        //var userInfo = gUserInfo.getUser(uid);
        //var buildingId = this.getBuildingIdWithFunction(func_name);
        var param = [0];
        // if (userInfo.legion.city.buildings) {
        //     if (userInfo.legion.city.buildings[buildingId]) {
        //         var buildingLevel = userInfo.legion.city.buildings[buildingId].level;
        //         param = gConfLegionCityConf[buildingId][buildingLevel].value;
        //     }
        // }

        return param;
    },

    getMinMailId: function () {
        var minId = this.sys_mail.ai;
        for (var id in this.sys_mail) {
            if (id < minId) {
                minId = id;
            }
        }
        for (var id in gMail.sysMail) {
            if (id < minId) {
                minId = id;
            }
        }
        return minId;
    },

    markNew: function (id) {
        if (!this.updates['$set']) {
            this.updates['$set'] = {};
        }

        this.updates['$set']['sys_mail.ai'] = this.sys_mail.ai;
        this.updates['$set']['sys_mail.' + id] = this.sys_mail[id];

        if (this.updates['$unset']) {
            delete this.updates['$unset']['sys_mail.' + id];
        }
    },

    markDelete: function (id) {
        if (!this.updates['$unset']) {
            this.updates['$unset'] = {};
        }

        this.updates['$unset']['sys_mail.' + id] = 1;

        if (this.updates['$set']) {
            delete this.updates['$set']['sys_mail.' + id];
        }
    },

    // huge表示这个邮件是否太大，单独作为一条记录存在mail表中，不存在sys_mail里
    add: function (mail, noNotice) {
        if (!mail.attach || !mail.attach.huge) {
            this.sys_mail[++this.sys_mail.ai] = mail;
            this.markNew(this.sys_mail.ai)
        } else {
            gMail.add(1, mail);
        }

        // 重置ai,基本不可能
        if (this.sys_mail.ai > 999990) {
            this.sys_mail.ai = 0;
            this.updates['$set']['sys_mail.ai'] = this.sys_mail.ai;
        }

        if (!noNotice) {
            var uids = this.getSysMailBroadcastUid(mail);
            if (uids) {
                if (uids.length > 0) {
                    pushToGroupUser(uids, 'self', {
                        mod: 'mail',
                        act: 'new'
                    });
                }
            } else {
                pushToUser(1, 'all', {
                    mod: 'mail',
                    act: 'new'
                });
            }
        }
    },

    del: function (unicode) {
        for (var id in this.sys_mail) {
            if (getMailUniCode(this.sys_mail[id]) == unicode) {
                delete this.sys_mail[id];
                this.markDelete(id);
            }
        }
    },

    addArenaAwardMail: function () {
        var time = common.getTime();
        var date = common.getDate();

        var ranks = {};
        var levels = {};
        for (var uid in gArena.users) {
            // 机器人
            if (isDroid(uid)) {
                continue;
            }

            if (!gArena.users[uid].type || !gArena.users[uid].rank) {
                continue;
            }

            ranks[uid] = gArena.users[uid];
            levels[uid] = gUserInfo.getUser(uid).status.arena_level;
        }

        if (Object.keys(ranks).length > 0) {
            var mail = {
                awards: 'arena_rank',
                time: time,
                expire: time + gConfMail[4].time * OneDayTime,
                attach: {
                    ranks: ranks,
                    levels: levels,
                    huge: 1,
                },
            };

            this.add(mail, true);
        }

        gArena.updateBalanceTime(time);
    },

    addBossScoreAwardMail: function () {
        var time = common.getTime();
        var date = common.getDate();

        var ranks = {};
        var levels = {};
        for (var uid in gFriend.users) {
            // 机器人
            if (isDroid(uid)) {
                continue;
            }
            ranks[uid] = gFriend.getBossScoreRank(uid);
        }

        var mail = {
            type: 0,
            from: 9,
            title: 46,
            awards: 'boss_rank',
            time: time,
            expire: time + gConfGlobalNew.awardMailExpireDay * 3600 * 24,
            attach: {
                ranks: ranks,
                huge: 1,
            },
        };

        this.add(mail, true);
    },

    addWorldwarAwardMail: function (ranks) {
        if (gConfMail[12]) {
            var time = common.getTime();
            var mail = {
                awards: 'ww_rank',
                time: time,
                expire: time + gConfMail[12].time * OneDayTime,
                attach: {
                    ranks: ranks,
                    huge: 1,
                },
            };

            this.add(mail, false);
        }
    },

    // 军团篝火
    addBonfireAwardMail: function (uids) {
        var time = common.getTime();
        var mail = {
            awards: 'ww_bonfire',
            time: time,
            expire: time + gConfMail[20].time * OneDayTime,
            content: [20],
            attach: {
                uids: uids,
            },
        }

        this.add(mail, false);
    },

    addSupAwardMail: function (progress, supports) {
        var time = common.getTime();
        var mail = {
            awards: 'ww_sup',
            time: time,
            expire: time + gConfMail[11].time,
            attach: {
                progress: progress,
                supports: supports,
            },
        };

        this.add(mail, false);
    },

    addPlayoffAwardMail: function (ranks) {
        var time = common.getTime();
        var mail = {
            awards: 'ww_playoff',
            time: time,
            expire: time + gConfMail[13].time * OneDayTime,
            attach: {
                ranks: ranks
            },
        };

        this.add(mail, false);
    },

    addLegionCopyAwardMail: function (lid) {
        var time = common.getTime();
        var date = common.getDate();

        var memberArr = [];
        var legion = gNewLegion.get(lid);
        var members = legion.member_list;
        for (var uid in members) {
            memberArr.push(+uid);
        }

        var mail = {
            awards: 'legion_copy',
            time: time,
            expire: time + gConfMail[14].time * OneDayTime,
            attach: {
                members: memberArr,
                chapter: legion.copy.chapter,
            },
        };

        this.add(mail, true);
    },

    addCountryAwardMail: function () {
        var time = common.getTime();
        var date = common.getDate();

        gCountry.calcSalary();
        var position = clone(gCountry.userPosition);

        // 剔除等级不足的玩家
        for (var uid in position) {
            var user = gUserInfo.getUser(uid);
            if (user) {
                if (!isModuleOpen_level(user.status.level, 'kingMe')) {
                    // 不满足等级条件
                    delete position[uid];
                }
            }
        }

        if (Object.keys(position).length > 0) {
            var salary = clone(gCountry.userSalary);
            var mail = {
                awards: 'country',
                time: time,
                expire: time + gConfMail[15].time * OneDayTime,
                attach: {
                    position: position,
                    salary: salary,
                    huge: 1,
                },
            };

            this.add(mail, true);
        }

        gCountry.balance = time;
    },

    addLimitGroupAwardMail: function (goods, buyer) {
        var time = common.getTime();
        var mail = {
            awards: 'limit_group',
            time: time,
            expire: time + gConfMail[1004].time * OneDayTime,
            attach: {
                goods: goods,
                buyer: buyer,
                huge: 1,
            },
        };

        this.add(mail, true);
    },

    addLordAwardMail: function () {
        var time = common.getTime();
        var date = common.getDate();

        var position = clone(gCountry.userPosition);
        var country = clone(gCountry.country);
        var lordCount = gBattle.lord_count.slice();

        var ranks = [];
        for (var i = 0; i < 3; i++) {
            var cnt = lordCount[i];
            var rank = 1;
            for (var j = 0; j < 3; j++) {
                if (cnt < lordCount[j]) {
                    rank++;
                }
            }
            ranks.push(rank);
        }

        var mail = {
            awards: 'lord',
            time: time,
            expire: time + gConfMail[9].time * OneDayTime,
            attach: {
                position: position,
                country: country,
                ranks: ranks,
                huge: 1,
            },
        };

        this.add(mail, true);
        gBattle.balance = time;
        gBattle.lastLord = lordCount;
        gBattle.updates['balance'] = gBattle.balance;
        gBattle.updates['last_lord'] = gBattle.lastLord;
    },

    addLuckyWheelAwardMail: function (ranks) {
        var attachRanks = {};
        for (var i = 0, len = ranks.length; i < len; i++) {
            attachRanks[ranks[i][0]] = i + 1;
        }

        var time = common.getTime();
        var mail = {
            awards: 'lucky_wheel',
            time: time,
            expire: time + gConfMail[1003].time * OneDayTime,
            attach: {
                ranks: attachRanks,
                huge: 1,
            },
        };

        this.add(mail, true);
    },

    addPromoteWheelAwardMail: function (ranks) {
        var attachRanks = {};
        for (var i = 0, len = ranks.length; i < len; i++) {
            attachRanks[ranks[i][0]] = i + 1;
        }

        var time = common.getTime();
        var mail = {
            awards: 'promote_wheel',
            time: time,
            expire: time + gConfMail[1009].time * OneDayTime,
            attach: {
                ranks: attachRanks,
                huge: 1,
            },
        };

        this.add(mail, true);
    },

    // 发放taptap删掉测试每日奖励，每日17点
    addTaptapDailyAward: function (am) {
        var time = common.getTime();
        var mail = {
            awards: 'winner_daily_award',
            time: time,
            expire: time + gConfMail[1011].time * OneDayTime,
            attach: {
                huge: 1,
            },
        };

        this.add(mail, true);

        gUserInfo.updateTaptapDailyAwardTime(time, am);
    },

    get: function (uid, ids, options) {
        if (ids) {
            return this.getMails(uid, options, ids[1]);
        } else {
            return this.getMails(uid, options);
        }
    },
};

// 获取邮件
exports.get = function (req, res, resp) {
    resp.data.mail = gMail.get(req.uid, req.args.ids);
    resp.data.sys_mail = gSysMail.get(req.uid, req.args.ids, req.args.options);
    onReqHandled(res, resp, 1);
};

exports.add_mail = function (req, res, resp) {
    do {
        var mail = req.args.mail;
        gMail.add(req.uid, mail);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.add_sys_mail = function (req, res, resp) {
    do {
        var mail = req.args.mail;
        gSysMail.add(mail, true);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.del_sys_mail = function (req, res, resp) {
    do {
        var unicode = req.args.unicode;
        gSysMail.del(unicode);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.read_mail = function (req, res, resp) {
    do {
        var id = req.args.id;
        var sys = req.args.sys;

        if (!sys) {
            var mails = gMail.mail[req.uid];
            if (!mails || !mails[id]) {
                resp.code = 1; resp.desc = 'no this mail'; break;
            }

            var mail = mails[id];
            if (mail.awards && mail.awards.length) {
                resp.data.awards = mail.awards;
            }
            gMail.del(req.uid, id);
        } else {
            var mail = gSysMail.sys_mail[id];
            if (!mail || gMail.sysMail[id]) {
                mail = gMail.sysMail[id];
                if (!mail) {
                    resp.code = 1; resp.desc = 'no this mail'; break;
                }
            }
            var options = req.args.options;
            if (mail.awards && typeof mail.awards != 'string') {
                resp.data.awards = mail.awards;
            } else {
                options.read = 1;
                var result = gSysMail.getSysMailExtr(+req.uid, mail, options);
                if (result && result.awards) {
                    resp.data.awards = result.awards;
                }

                if (result) {
                    resp.data.mails = resp.data.mails || [];
                    resp.data.mails.push(
                        {
                            content: result.content,
                            sys: 1,
                            time: mail.time
                        }
                    )
                }
            }
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 一键领取
exports.read_all_mail = function (req, res, resp) {
    var uid = req.uid;
    do {
        var user = gUserInfo.getUser(uid);

        // 系统邮件
        var sysMail = gSysMail.sys_mail;
        var userSysMail = gMail.sysMail;

        var options = req.args.options;
        var ids = [];
        var tempRewards = [];

        for (var id in userSysMail) {
            if (options.excepts && options.excepts[id] == 2) {
                // 已经读过了
                continue;
            }
            var mail = userSysMail[id];
            if (mail.awards && typeof mail.awards != 'string') {
                if (ids.indexOf(id) < 0) {
                    ids.push(id);
                }

                tempRewards = tempRewards.concat(mail.awards);
            } else {
                var result = gSysMail.getSysMailExtr(+req.uid, userSysMail[id], options);
                if (result && result.awards.length) {
                    for (var i = 0, len = result.awards.length; i < len; i++) {
                        var award = result.awards[i];
                        if (!award) {
                            DEBUG('award is null');
                            continue;
                        }

                        // 判断是否可以领取粮草   粮草达到上限不能领取
                        if (user.status.food >= gConfGlobalNew.foodMax && award[1] == 'food') {
                            DEBUG('food is full');
                            continue;
                        }

                        if (ids.indexOf(id) < 0) {
                            ids.push(id);
                        }

                        tempRewards.push(award);
                    }
                }

                if (result) {
                    resp.data.mails = resp.data.mails || [];
                    resp.data.mails.push(
                        {
                            content: result.content,
                            sys: 1,
                            time: mail.time
                        }
                    )
                }
            }
        }

        for (var id in sysMail) {
            if (ids.indexOf(id) >= 0) {
                continue;
            }

            if (options.excepts && options.excepts[id] == 2) {
                continue;
            }

            var mail = sysMail[id];
            if (mail.awards && typeof mail.awards != 'string') {
                if (ids.indexOf(id) < 0) {
                    ids.push(id);
                }

                tempRewards = tempRewards.concat(mail.awards);
            } else {
                var result = gSysMail.getSysMailExtr(+req.uid, sysMail[id], options);
                if (result && result.awards.length) {
                    for (var i = 0, len = result.awards.length; i < len; i++) {
                        var award = result.awards[i];
                        if (!award) {
                            DEBUG('award is null');
                            continue;
                        }

                        // 判断是否可以领取粮草   粮草达到上限不能领取
                        if (user.status.food >= gConfGlobalNew.foodMax && award[1] == 'food') {
                            DEBUG('food is full');
                            continue;
                        }

                        if (ids.indexOf(id) < 0) {
                            ids.push(id);
                        }

                        tempRewards.push(award);
                    }
                }

                if (result) {
                    resp.data.mails = resp.data.mails || [];
                    resp.data.mails.push(
                        {
                            content: result.content,
                            sys: 1,
                            time: mail.time
                        }
                    )
                }
            }
        }

        var mails = gMail.mail[req.uid];
        for (var id in mails) {
            var mail = mails[id];
            if (mail.awards && mail.awards.length) {
                for (var i = 0, max = mail.awards.length; i < max; i++) {
                    var award = mail.awards[i];
                    if (!award) {
                        continue;
                    }

                    var mailId = mail.content[0];
                    if (!mail.title && !gConfMail[mailId]) {
                        continue;
                    }

                    // 判断是否可以领取粮草   粮草达到上限不能领取
                    if (user.status.food >= gConfGlobalNew.foodMax && award[1] == 'food') {
                        continue;
                    }
                    tempRewards.push(award);

                    gMail.del(req.uid, id);
                }
            }
        }

        // 合并同类型的奖励
        resp.data.ids = ids;
        resp.data.awards = reformAwards(tempRewards);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 添加跨服战支持的奖励邮件
exports.add_sup_award_mails = function (req, res, resp) {
    do {
        if (!req.args.progress || !req.args.supports) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        gSysMail.addSupAwardMail(req.args.progress, req.args.supports);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 添加跨服战积分赛每日的奖励邮件
exports.add_worldwar_award_mails = function (req, res, resp) {
    do {
        if (!req.args.ranks || !util.isArray(req.args.ranks)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var ranks = req.args.ranks;
        gSysMail.addWorldwarAwardMail(ranks);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 添加跨服战决赛的奖励邮件
exports.add_playoff_award_mails = function (req, res, resp) {
    do {
        if (!req.args.ranks) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        gSysMail.addPlayoffAwardMail(req.args.ranks);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.add_limit_group_mails = function (req, res, resp) {
    do {
        var goods = req.args.goods;
        var buyer = req.args.buyer;
        if (!goods || !buyer) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        gSysMail.addLimitGroupAwardMail(goods, buyer);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.add_lucky_wheel_mails = function (req, res, resp) {
    do {
        var ranks = req.args.ranks;
        if (!ranks) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        gSysMail.addLuckyWheelAwardMail(ranks);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.add_promote_wheel_mails = function (req, res, resp) {
    do {
        var ranks = req.args.ranks;
        if (!ranks) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        gSysMail.addPromoteWheelAwardMail(ranks);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.add_upgrade_city_award_mail = function (req, res, resp) {
    do {
        var awards = req.args.awards;
        if (!awards) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var now = common.getTime();
        gMail.add(req.uid, {
            from: 0,
            content: [34],
            awards: awards,
            time: now,
            expire: now + gConfMail[34].time * OneDayTime,
        });
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.Mail = Mail;
exports.SysMail = SysMail;

