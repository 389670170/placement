var ErrorCode = require('../common/teamdefine').ErrorCode;

function Clan() {
    this.ai = 0;
    this.teams_num = 0;                     // 统计战队的数量
    this.teams = {
        /*id: {                                   // 战队id
            uid: '',                            // 队长uid
            name: '',                           // 战队名字
            bulletin:'',                        // 战队公告
            join_way: 0 | 1 | 2 ,                // 入队申请方式   0：不可加入   1：直接加入    2：申请加入
            join_term: {                        // 入队的条件
                level: 0,                       // 等级达到指定等级
            },

            member_list: {                      // 成员信息
                uid: {
                    un : 0                     // 成员昵称
                    clan_xp : 0                // 成员战队经验
                    join_time: 0,               // 入队时间
                    offline_time: 0,            // 下线时间
                }
            },
            finish_task : [];   // 队伍已完成的任务

            dissolve_time: 0,                   // 队伍里面的玩家下线，更新该时间，用于判断队伍是否可以自动解散
            apply_list: {                       // 申请加入战队的人员信息列表
                uid:                            // 玩家id    信息返回调用userMsg
                    {
                        time: 0,                // 申请时间
                    }
            },
            can_use_badge: ['徽章id'],          // 已经激活的徽章
            use_badge: 0,                       // 佩戴中的徽章
            impeach:{                           // 弹劾
                uid:0,                          // 弹劾的uid,弹劾成功队长就给这个uid
                time:0,                         // 开始弹劾的时间
            }

            // 战队总战斗力       根据战队成员战斗力计算
            // 战队经验     根据战队成员的经验来计算     成员战队经验    status.team_exp
        }*/
    };

    // 申请列表
    this.applyList = {
        /*uid : [lid,lid]*/
    };

    // 玩家所在的战队
    this.userTeam = {
        /*uid:teamId*/
    };

    this.updates = {};

    // 玩家未领宝箱的数量
    this.task_msg = {                           // 玩家登陆时计算
        /*
            uid : 0,
         */
    };

    // 各个玩家上次加入队伍的时间
    this.userJoinTime = {
        /*
            uid : time,
         */
    };

    this.clan_log = {
          /*teamId:[{
                type:'join||out'
                uid:0
                un:0
                time:0
          }]*/
    };

    this.ranks = new RankTree(//
        // 存储对象 [cid, fightForce]   // id,总战斗力
        function(c1, c2) {
            // 同一个人作为相等, 用于删除
            if (c1[0] == c2[0]) {return 0;}
            // 战斗力
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c1[0] - c2[0];
        },gConfGlobalNew.rankListLimit_Team);

    this.teamsArr = [];//   不存数据库

    this.dirty = {};

    // 等待被踢出的uid
    this.kickOutList = [];
}

Clan.create = function(callback) {
    var clanData = {
        _id : 'clan',
        ai : require('../config').ServerId * 1000000,
        teams : {},
        task_msg : {},
        userJoinTime : {},
    };
    gDBWorld.insert(clanData, function(err, result){callback && callback()});
};

Clan.prototype = {
    init: function (callback) {
        gDBWorld.find({_id: 'clan'}).limit(1).next(function (err, doc) {
            if (doc) {
                this.ai = doc.ai;
                this.teams = doc.teams;
                var _this = this;
                for(var i in doc.teams){
                    var teamId = parseInt(i);
                    var team = doc.teams[teamId];
                    _this.teams_num ++;
                    _this.teamsArr.push(teamId);
                    var calcTeamFight = _this.calcTeamFight(teamId);

                    // 初始化排行榜
                    _this.ranks.insert([+i, calcTeamFight.fightCount]);

                    // 初始化玩家所在军团列表
                    var maxJoinTime = 0;
                    var maxJoinTimeUid = 0;
                    var memberCount = 0;
                    for(var uid in team.member_list){
                        this.userTeam[parseInt(uid)] = teamId;

                        memberCount ++;
                        if (team.member_list[uid].join_time > maxJoinTime) {
                            maxJoinTime = team.member_list[uid].join_time;
                            maxJoinTimeUid = +uid;
                        }
                    }

                    if (memberCount > 5 && maxJoinTimeUid > 0) {
                        this.kickOutList.push(maxJoinTimeUid);
                    }

                    // 初始化申请列表
                    for(var uid in team.apply_list){
                        var applyId = parseInt(uid);
                        !this.applyList[applyId] && (this.applyList[applyId] = []);
                        this.applyList[applyId].push(teamId);
                    }

                    this.calcTeamLevel(teamId);

                    if (!team.finish_task) {
                        team.finish_task = [0,0,0,0,0,0,0];
                        this.markDirty(util.format('teams.%d', teamId));
                    }

                    // 处理重复徽章
                    var tmpBadge = [];
                    var diff = false;
                    for (var k = 0; k < team.can_use_badge.length; k++) {
                        if (tmpBadge.indexOf(team.can_use_badge[k]) < 0) {
                            tmpBadge.push(team.can_use_badge[k]);
                        } else {
                            diff = true;
                        }
                    }
                    if (diff) {
                        team.can_use_badge = tmpBadge;
                        this.markDirty(util.format('teams.%d.can_use_badge', teamId));
                    }
                }
                this.task_msg = doc.task_msg;

                this.userJoinTime = doc.userJoinTime;
                if (!this.userJoinTime) {
                    this.userJoinTime = {};
                    this.markDirty('userJoinTime');
                }

                // 处理队伍数据
                this.handleKickOutList();

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    // 临时处理，处理有六个人的队伍
    handleKickOutList : function () {
        if (this.kickOutList.length == 0) {
            return;
        }

        DEBUG('handleKickoutList begin ==========');
        DEBUG(this.kickOutList);
        for (var i = 0; i < this.kickOutList.length; i++) {
            this.kickOut(this.kickOutList[i]);
        }

        this.kickOutList= [];
        DEBUG('handleKickoutList end ==========');
    },

    insertEvent:function (teamId, uid, time, type) {
        var user = gUserInfo.getUser(uid);
        var json = {
            type : type,
            un : user.info.un,
            uid : uid,
            time : time
        };

        !this.clan_log[teamId] && (this.clan_log[teamId] = []);
        this.clan_log[teamId].unshift(json);
        if (this.clan_log[teamId].length > gConfGlobalNew.teamEventNumLimit){
            this.clan_log[teamId].pop();
        }
    },

    // 获取玩家上次加入队伍时间
    getLastJoinTime : function (uid) {
        if (this.userJoinTime[uid]) {
            return this.userJoinTime[uid];
        }

        return 0;
    },

    setLastJoinTime : function (uid) {
        this.userJoinTime[uid] = common.getTime();
        this.markDirty('userJoinTime.' + uid);
    },

    // 获取战队信息
    getTeamMsg:function (uid) {
        var teamId = this.userTeam[uid];
        return this.getTeamData(teamId);
    },

    getTeamIdByUid : function (uid) {
        return this.userTeam[uid];
    },

    getTeamData : function (team_id) {
        var teamData = this.teams[team_id];
        if (teamData) {
            var TeamFight = this.calcTeamFight(team_id);
            teamData.team_id = +team_id;
            teamData.fightCount = TeamFight.fightCount;
        }

        return teamData;
    },

    // 撤销申请 || 拒绝加入
    undoApply:function (uid, teamId) {
        if (this.applyList[uid]) {
            this.applyList[uid] = this.applyList[uid].remove(teamId);
            delete this.teams[teamId].apply_list[uid];
            this.markDirty('teams.' + teamId + '.apply_list');
        }
    },

    // 添加成员
    addMember:function (teamId, uid, direct) {
        if (!this.teams[teamId]) {
            return false;
        }

        var teamData = this.teams[teamId];
        if (teamData.member_list[uid]) {
            // 已经存在了
            return false;
        }

        if (Object.keys(teamData.member_list).length >= 5) {
            return false;
        }

        var user = gUserInfo.getUser(uid);
        if (!user) {
            return false;
        }

        var json = {
            un : user.info.un,
            clan_xp : user.status.team_exp,
            join_time : common.getTime(),
            offline_time : 0,
        };

        this.setLastJoinTime(uid, common.getTime());
        this.teams[teamId].member_list[uid] = json;
        this.markDirty('teams.' + teamId + '.member_list');

        // 刷新徽章
        this.refreshBadges(teamId);

        // 加入日志
        this.insertEvent(teamId,uid, json.join_time, 'join');

        // 更新排行榜
        this.update_ranks(teamId);

        // 直接加入更新下线时间
        if (direct) {
            this.dissolve_time = common.getTime()
        }

        // 推送消息
        gClan.msgToTeam(teamId, uid, 'join');

        var applyList = this.applyList[uid];
        if (applyList && applyList.length) {
            for (var i = 0,len = applyList.length;i<len;i++) {
                var team = this.teams[applyList[i]];
                if (!team) {
                    continue;
                }

                delete team.apply_list[uid];
                this.markDirty('teams.' + applyList[i] + '.apply_list');
            }

            //this.applyList = applyList.remove(uid);
            delete  this.applyList[uid];
        }

        this.userTeam[uid] = teamId;

        gLandGrabber.onTeamMemberJoin(teamId, uid);

        var user = gUserInfo.getUser(uid);

        var tmpData = mapObject(user, gInitWorldUser);
        var updateData = mapObject(tmpData, gLandGrabberUser);

        var landGrabberReq = {
            uid : 1,
            mod : 'landgrabber',
            act : 'village_member_join',
            args : {
                team_id : teamId,
                member_id : uid,
                member_data : updateData,
            },
        }

        requestLandGrabber(landGrabberReq, {}, function () {
            DEBUG('send team member join notify to landgrabber suss');
        });
    },

    // 踢出战队 || 退出战队
    kickOut:function (uid) {
        var teamId = this.userTeam[uid];
        if (!teamId) {
            return;
        }

        var teamData = this.teams[teamId];
        if (!teamData) {
            return;
        }

        if (!teamData.member_list[uid]) {
            return;
        }

        if (gLandGrabber) {
            gLandGrabber.onTeamMemberLeave(teamId, uid);
        }

        var landGrabberReq = {
            uid : 1,
            mod : 'landgrabber',
            act : 'village_member_leave',
            args : {
                team_id : teamId,
                member_id : uid,
            },
        }

        requestLandGrabber(landGrabberReq, {}, function () {
            DEBUG('send team member leave notify to landgrabber suss');
        });

        var memberList = teamData.member_list;
        delete memberList[uid];
        this.markDirty('teams.' + teamId + '.member_list');

        delete this.userTeam[uid];

        // 刷新徽章
        this.refreshBadges(teamId);

        gClan.update_ranks(teamId);
        gClan.insertEvent(teamId, uid, common.getTime(), 'kick');
        gClan.msgToTeam(teamId, uid, 'kick');
    },

    // 检查徽章激活
    checkAndRefreshBadges: function (uid, condition_type) {
        var teamId = gClan.userTeam[uid];
        if (!teamId) return;

        var teamData = this.teams[teamId];
        if (!teamData) return;

        var old_badges = clone(teamData.can_use_badge);
        this.refreshBadges(teamId);
        var new_badges = teamData.can_use_badge;

        var changed = false;
        if (old_badges.length == new_badges.length) {
            for (var i = 0; i < old_badges.length; i++) {
                var isExist = false;
                for (var j = 0; j < new_badges.length; j++) {
                    if (old_badges[i] == new_badges[j]) {
                        isExist = true;
                        break;
                    }
                }
                if (!isExist) {
                    changed = true;
                    break;
                }
            }
        } else {
            changed = true;
        }

        if (changed) {
            // 有改变则推送消息给客户端刷新战力
            var uids = [];
            for (var i in teamData.member_list) {
                uids.push(+i);
            }
            var args = {
                mod : 'clan',
                act : 'badge_change',
                can_use_badge: new_badges
            };
            pushToGroupUser(uids, 'self', args);
        }
    },

    // 刷新已激活徽章
    refreshBadges : function (teamId) {
        var teamData = this.teams[teamId];
        if (!teamData) {
            return;
        }

        var memberList = teamData.member_list;
        var memberCount = Object.keys(memberList).length;
        if (memberCount < 5) {
            // 队伍人数不足，移除除1之外的徽章
            teamData.can_use_badge = [1];
        } else {
            //teamData.can_use_badge = [1];

            // 根据激活条件检查徽章激活情况
            for (var k in gConfTeamEmblem) {
                var badgeInfo = gConfTeamEmblem[k];
                var conditionValue = badgeInfo.conditionValue[0];

                var enough = true;
                for (var memberUid in memberList) {
                    var member = gUserInfo.getUser(memberUid);
                    if (member)
                    {
                        if (badgeInfo.condition == 'weekCard') {
                            if (member.payment.week_card == 0) {
                                enough = false;
                                break;
                            }
                        } else if (badgeInfo.condition == 'monthCard') {
                            if (member.payment.month_card == 0) {
                                enough = false;
                                break;
                            }
                        } else if (badgeInfo.condition == 'longCard') {
                            if (member.payment.long_card == 0) {
                                enough = false;
                                break;
                            }
                        } else if (badgeInfo.condition == 'vip') {
                            if (member.status.vip < conditionValue) {
                                enough = false;
                                break;
                            }
                        }
                    }
                }

                if (enough) {
                    if (teamData.can_use_badge.indexOf(parseInt(k)) < 0) {
                        teamData.can_use_badge.push(parseInt(k));
                    }
                }
            }
        }

        this.markDirty('teams.' + teamId + '.can_use_badge');
    },

    // 获取满足要求的战队  （排除不可加入 || 已经申请的战队 || 已经加入的）
    getTeamList:function (teamId, uid) {
        var teams = this.teams;
        var teamsArr = [];
        for (var i in teams) {
            var tid = parseInt(i);
            if (teamId == tid) {
                continue;
            } else if (teams[tid].join_way == 0) {
                continue;
            }

            teamsArr.push(tid);
        }

        return teamsArr.diff(this.applyList[uid]);
    },

    markDirty: function(name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    markDelete : function (name) {
        this.dirty[name] = 1;
    },

    update_ranks:function (teamId) {
        var calcTeamFight = this.calcTeamFight(teamId);
        this.ranks.update([teamId,calcTeamFight.fightCount])
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

    // 保存
    save: function (callback) {
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(true);
            return;
        }

        this.arrangeDirty();
        var updates = {$set: {}, $unset: {}};
        for (var item in this.dirty) {
            var remove = this.dirty[item];
            if (remove) {
                updates['$unset'][item] = 1;
            } else {
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
                    updates['$set'][item] = obj;
                } else {
                    ERROR('INVALID SAVE CLAN: ' + item);
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
            gDBWorld.update({_id: 'clan'}, updates, function (err, result) {
                if (err) {
                    ERROR({updates: updates, err: err});
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            });
        }
    },

    /**
     * 小队发消息    推送给小队所有成员
     * @param id  小队id
     * @param un  哪个成员加入队伍
     */
    msgToTeam:function (teamId, uid, type) {
        var user = gUserInfo.getUser(uid);
        if (!user) {
            return;
        }

        var team = this.teams[teamId];
        if (!team) {
            return;
        }

        var member_list = team.member_list;
        var uids = [];
        for (var i in member_list) {
            uids.push(+i);
        }

        var badge = team.can_use_badge;
        // 被踢的玩家也要收到这个消息
        if (uids.indexOf(uid) < 0) {
            uids.push(uid);
            badge = [];
        }

        var args = {
            mod : 'clan',
            act : 'member_change',
            uid : uid,
            un : user.info.un,
            clan_xp : user.status.team_exp,
            type : type,
            can_use_badge: badge
        };

        pushToGroupUser(uids, 'self', args);
    },

    /**
     * 检测战队名字是否已经存在
     * @param name  需要检测的用户名
     * return true：存在   false：不存在
     */
    isName:function (name) {
        var teams = this.teams;
        var flag = false;
        for (var i in teams) {
            var tid = parseInt(i);
            if (teams[tid] && (teams[tid].name == name)) {
                flag = true;
                break;
            }
        }
        return flag;
    },

    /**
     * 判断是否是队长
     * @param teamId        战队id
     * @param uid           队长id
     * @returns {boolean}   true:是队长    false：不是队长
     */
    isLeader:function (teamId, uid) {
        var team = this.teams[teamId];
        if (!team) {
            return false;
        }

        if (team.uid == uid) {
            return true;
        }

        return false;
    },

    // 计算战队等级
    calcTeamLevel:function (teamId) {
        var team = this.teams[teamId];
        var memberList = team.member_list;
        var clanXpCount = 0; // 战队总经验
        var clanLevel = 1;  // 战队等级
        for (var i in memberList){
            clanXpCount += memberList[+i].clan_xp;
        }

        var maxLv = Object.keys(gConfTeamBase).length;
        for (var i= 1; i <= maxLv; i++) {
            clanLevel = i;
            var reqExp = gConfTeamBase[i].exp;
            if (clanXpCount >= reqExp) {
                clanXpCount -= reqExp;
            } else {
                break;
            }
        }
        var upExp = clanXpCount;
        if (upExp > gConfTeamBase[maxLv].exp) {
            upExp = gConfTeamBase[maxLv].exp;
        }
        return [clanLevel,upExp];
    },

    /**
     * 计算战队战斗力 && 战队人数  && 战队当前经验
     * @param teamId
     * @returns {{fightCount: number, memberNum: number, clanXp: number}}
     */
    calcTeamFight:function (teamId) {
        var team = this.teams[teamId];

        var fightCount = 0; // 战队总战斗力
        var memberNum = 0; // 战队人数
        var clanXp = 0;// 战队当前经验

        if (team) {
            var memberList = team.member_list;
            for (var i in memberList) {
                var memberUid = parseInt(i);
                var user = gUserInfo.getUser(memberUid);
                if (user) {
                    memberNum++;
                    clanXp += memberList[memberUid].clan_xp;
                    var fightForce = 0;
                    for (var p in user.pos) {
                        fightForce += user.pos[p].fight_force;
                    }
                    fightCount += fightForce;
                }
            }
        }

        return {
            fightCount: fightCount,
            memberNum: memberNum,
            clanXp:clanXp
        };
    },

    // 查询战队列表返回数据拼接
    teamMsg:function (teamId, needMember) {
        var team = this.teams[teamId];
        if (team) {
            var TeamFight = this.calcTeamFight(teamId);
            var json = {
                uid: team.uid,
                leader_name : this.getUerName(team.uid),
                name: team.name,
                bulletin:team.bulletin,
                level: this.calcTeamLevel(teamId)[0],
                fightCount: TeamFight.fightCount,
                memberNum: TeamFight.memberNum,
                join_way: team.join_way,
                join_term: team.join_term,
                badge : team.use_badge,
                rank:this.ranks.rankById(teamId)
            };

            if (needMember) {
                var memberList = team.member_list;
                var memberListJson = {};
                for(var mid in memberList){
                    memberListJson[mid] = gClan.userMsg(+mid, teamId);
                }

                json.member_list = memberListJson;
            }
            return json;
        }
        else {
            return false;
        }
    },

    getQuality : function (custom_king) {
        var quality = 2;    // 一开始是绿色
        if (custom_king && custom_king.chapter > 0 && custom_king.index > 0) {
            //quality = gConfCustomKing[custom_king.chapter][custom_king.index].quality;
        }

        return quality;
    },

    // 成员信息拼接
    userMsg:function (uid, teamId, type) {
        var getUser = gUserInfo.getUser(uid);
        var team = this.teams[teamId];
        var memberList = team.member_list;
        var joinTime = 0;
        type == 'apply' ? (joinTime = team.apply_list[uid].time) : (joinTime = memberList[uid].join_time);
        var json = {
            hid : getUser.pos[1].hid,
            un : getUser.info.un,
            vip: getUser.status.vip,
            headpic : getUser.info.headpic,
            headframe: getUser.info.headframe || 30002,
            quality : this.getQuality(getUser.custom_king),
            clan_xp : memberList[uid] ? memberList[uid].clan_xp : getUser.status.clan_xp,
            level:getUser.status.level,
            join_time : joinTime,
            fight_force :gUserInfo.getUserFightForce(uid),
            custom_king:getUser.custom_king,
            weapon_illusion: getUser.sky_suit.weapon_illusion,
            wing_illusion: getUser.sky_suit.wing_illusion,
            mount_illusion: getUser.sky_suit.mount_illusion,
            promote : getUser.pos[1].promote,
            active_time: getUser.mark.active_time
        };
        if(team && type!='apply'){ // 排除申请列表
            json.clan_xp = memberList[uid].clan_xp;
            json.task = getUser.clan.task || 0;
            json.offline_time = memberList[uid].offline_time;
        }
        return json;
    },

    // 获取队长名字
    getUerName : function (uid) {
        var leaderUser = gUserInfo.getUser(uid);
        if (leaderUser)
            return leaderUser.info.un;
        else
            return '';
    },

    // 检测徽章是否激活
    detect_badge:function (teamId) {
        var memberNum = this.calcTeamFight(teamId).memberNum;
        var canUseBadge = [];
        var team = this.teams[teamId];
        var memberList = team.member_list;
        var level = this.calcTeamLevel(teamId)[0];
        var maxIndex = gConfTeamBase[level].maxMember;
        if(memberNum >= maxIndex) {
            for (var i in gConfTeamEmblem) {
                var teamEmblem = gConfTeamEmblem[i];
                var condition = teamEmblem.condition;// 激活条件
                var termNum = 0;// 满足条件的人数
                if (condition == 'create') {
                    canUseBadge.push(+i);
                    continue;
                }
                for (var j in memberList) {
                    var memberUid = parseInt(j);
                    var user = gUserInfo.getUser(memberUid);
                    if (user) {
                        var type = -1;
                        condition == 'level' && (type = user.status.level);
                        condition == 'vip' && (type = user.status.vip);
                        condition == 'weekCard' && (type = user.payment.week_card);
                        condition == 'monthCard' && (type = user.payment.month_card);
                        condition == 'longCard' && (type = user.payment.long_card);
                        if (type >= teamEmblem.conditionValue[0]) {
                            termNum++;
                            if (termNum >= maxIndex) {
                                canUseBadge.push(+i);
                                break;
                            }
                        }
                    }
                }
            }
        }else{
            canUseBadge = team.can_use_badge;
        }
        return canUseBadge;
    },

    // 计算对应玩家任务数量集合
    calcTask : function (team, teamId) {
        // 计算当前玩家 ‘球’集齐的状态
        if (!team) {
            return;
        }

        var memberList = team.member_list;
        var boxNum = this.calcAwardBox(teamId, team.finish_task);
        if (boxNum > 0) {
            for (var uid in memberList) {
                if (!this.task_msg[uid]) {
                    this.task_msg[uid] = 0;
                }

                this.task_msg[uid] ++;
                this.markDirty(util.format('task_msg.%d', uid));
            }
        }
    },

    // 根据小队已完成的任务列表，计算出新产生的宝箱数量
    calcAwardBox:function (teamId, finish_task) {
        var box = 0;
        var min = 999;  // 最小的完成次数
        for (var i = 0; i < finish_task.length; i++) {
            if (finish_task[i] < min) {
                min = finish_task[i];
            }
        }

        if (min > 0) {
            // 说明有产出新宝箱
            box = min;

            // 遍历任务列表，每个都减去箱子数量
            for (var i = 0; i < finish_task.length; i++) {
                finish_task[i] -= min;
            }

            this.markDelete(util.format('teams.%d.finish_task', teamId));
        }

        return box;
    },

    // 每日重置任务 和领取奖励次数
    resetByDay:function () {
        var teams = this.teams;
        for(var tid in teams){
            var team = teams[+tid];
            var memberList = team.member_list;
            for(var uid in memberList){
                memberList[uid].task = 0;
                memberList[uid].get_task_award = 0;
            }
        }

        this.tidy_team_member()
    },

    // 获取玩家的申请列表
    getUserApplyList : function (uid) {
        return this.applyList[uid];
    },

    // 增加成员战队经验
    addMemberTeamExp : function (teamId, uid, exp) {
        var team = this.getTeamData(teamId);
        if (!team) {
            return false;
        }

        if (!team.member_list[uid]) {
            return false;
        }

        team.member_list[uid].clan_xp += exp;
        this.markDirty(util.format('teams.%d.member_list.%d', teamId, uid));
    },

    // 检测小队离线时间，自动解散
    update : function() {
       this.auto_dissolve_team();
    },

    auto_dissolve_team : function() {
        do {
            var teams = gClan.teams;
            var MaxDissolveTime = gConfGlobalNew.teamAutoBreakTime * 24 * 60 * 60;
            for(var i in teams){
                var tid = parseInt(i);
                if (teams[tid].dissolve_time != 0 && (common.getTime() - teams[tid].dissolve_time) > MaxDissolveTime){
                    var team = teams[tid];
                    var teamName = team.name;
                    var leaveTime = common.getTime() - teams[tid].dissolve_time;

                    // 发送推送消息通知队伍解散
                    var uids = [];
                    for (var i in team.member_list) {
                        uids.push(+i);
                    }
                    var args = {
                        mod : 'clan',
                        act : 'dissolve_team',
                    };
                    pushToGroupUser(uids, 'self', args);

                    // 发送队伍解散邮件
                    var time = common.getTime();
                    var mail = {
                        awards : [],
                        time : time,
                        expire : time + gConfMail[47].time * OneDayTime,
                        content : [47, leaveTime, teamName],
                        attach : {

                        },
                    }

                    for(var uid in team.member_list){
                        gMail.add(+uid, mail);
                        delete gClan.userTeam[+uid]
                    }

                    this.notify_land_grabber(tid);
                    delete teams[tid];
                } else if(!teams[tid].uid) {
                    for(var uid in teams[tid].member_list){
                        delete gClan.userTeam[+uid]
                    }
                    this.notify_land_grabber(tid);
                    delete teams[tid];
                }
            }
            gClan.markDirty('teams');
        } while (false);
    },

    // 通知村庄争夺服务器有队伍解散
    notify_land_grabber : function(teamId) {
        var landgrabberReq = {
            uid : 1,
            mod : 'landgrabber',
            act : 'village_team_dismiss',
            args : {
                team_id : teamId,
            },
        }

        requestLandGrabber(landgrabberReq, {}, function () {
            DEBUG('send team dismiss notify to landgrabber suss 1');
        });

        // 通知本服的村庄争夺系统
        gLandGrabber.onTeamDismiss(teamId);
    },

    tidy_team_member: function() {
       for (var tid in this.teams) {
            var member_list = [];
            var team = this.teams[tid];
            for (var uid in team.member_list) {
                member_list.push(uid)
            }

            var landGrabberReq = {
                uid : 1,
                mod : 'landgrabber',
                act : 'village_member_check',
                args : {
                    team_id : tid,
                    member_list : member_list,
                },
            }

            requestLandGrabber(landGrabberReq, {}, function () {
                DEBUG('send team member tidy to landgrabber suss');
            });
        }
    },

};

// 获取战队信息
exports.get_team = function (req,res,resp) {
    var uid = +req.uid;
    do {
        var teamId = gClan.userTeam[uid];
        var team = gClan.getTeamMsg(uid);
        if(!team){
            resp.code = 101;resp.desc ='not team';break;
        }
        var memberList = team.member_list;
        var memberListJson = {};
        for(var mid in memberList){
            memberListJson[mid] = gClan.userMsg(+mid, teamId);
        }

        var impeachUid = team.impeach.uid,
            impeachTime = team.impeach.time;// 发起弹劾的时间
        if (impeachUid && impeachTime){
             var captainTime = gConfGlobalNew.teamCaptainImpeachTime * 60 * 60;
            // var captainTime = 120;
             if (common.getTime() - impeachTime > captainTime){// 弹劾成功
                team.uid = impeachUid;
                team.impeach = {uid:0, time:0};
                gClan.markDirty('teams.' + teamId + '.impeach');
                gClan.markDirty('teams.' + teamId + '.uid');

                // 村庄争夺
                gLandGrabber.onTeamLeaderChange(teamId, impeachUid);
                // 通知跨服服务器
                var landGrabberReq = {
                    uid : 1,
                    mod : 'landgrabber',
                    act : 'village_team_leader_change',
                    args : {
                        team_id : teamId,
                        new_leader : impeachUid,
                    },
                }
                requestLandGrabber(landGrabberReq, {}, function () {
                    DEBUG('send team leader change notify to landgrabber suss');
                });

             }else{
                 if (uid == team.uid){// 弹劾失败 队长登录弹劾失败
                     team.impeach = {uid:0, time:0};
                     gClan.markDirty('teams.' + teamId + '.impeach');
                 }
             }
        }

        var jsonOnly = {};
        var calcLevel = gClan.calcTeamLevel(teamId);
        var teamMsg = gClan.teamMsg(teamId);
        var boxNum = gClan.task_msg[uid] | 0;

        jsonOnly = {
            team_id:teamId,
            uid: team.uid,
            name: team.name,
            bulletin:team.bulletin,
            level: calcLevel[0],
            clan_xp: calcLevel[1],
            member_list: memberListJson,
            use_badge: team.use_badge,
            can_use_badge : team.can_use_badge,
            rank:gClan.ranks.rankById(teamId),
            join_way : team.join_way,
            join_term : team.join_term,
            fight_force : teamMsg.fightCount,
            awardBox : boxNum,
            impeachTime : team.impeach.time,
        };

        resp.data.team = jsonOnly;
    } while (false);
    onReqHandled(res, resp, 1);
};

// 获取队伍信息和成员信息
exports.get_team_and_member = function (req, res, resp) {
    var uid = req.uid;
    do {
        var teamId = gClan.userTeam[uid];
        var team = gClan.getTeamMsg(uid);
        if(!team){
            resp.code = 101;resp.desc ='not team';break;
        }

        var memberUserInfoList = {};
        var memberList = team.member_list;
        var memberListJson = {};
        for(var memberUid in memberList){
            memberListJson[memberUid] = gClan.userMsg(+memberUid, teamId);

            if (memberUid != uid) {
                var userInfo = gUserInfo.getUser(memberUid);
                var updateData = mapObject(userInfo, gLandGrabberUser);
                memberUserInfoList[memberUid] = updateData;
            }
        }

        var jsonOnly = {};
        var calcLevel = gClan.calcTeamLevel(teamId);
        var teamMsg = gClan.teamMsg(teamId);
        var taskMsg = gClan.task_msg[req.uid] || { award_box:0,task_json:{}};

        jsonOnly = {
            team_id:teamId,
            uid: team.uid,
            name: team.name,
            bulletin:team.bulletin,
            level: calcLevel[0],
            clan_xp: calcLevel[1],
            member_list: memberListJson,
            use_badge: team.use_badge,
            can_use_badge : team.can_use_badge,
            rank:gClan.ranks.rankById(teamId),
            join_way : team.join_way,
            join_term : team.join_term,
            fight_force : teamMsg.fightCount,
            awardBox : taskMsg.award_box,
        };

        resp.data.team = jsonOnly;
        resp.data.memberUser = memberUserInfoList;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 创建队伍
exports.create = function (req,res,resp) {
    do {
        var uid = +req.uid;
        var name = req.args.name;
        var teams = gClan.teams;

        // 检测战队名字是否已经存在
        if (gClan.isName(name)) {
            resp.code = ErrorCode.ERROR_TEAM_NAME_EXIST; resp.desc = 'name is exist';break;
        }
        var oldTeamId = gClan.userTeam[req.uid];
        if (oldTeamId){
            if(!gClan.teams[oldTeamId]){
               delete gClan.userTeam[+req.uid];
            }else{
                resp.code = ErrorCode.ERROR_ALREADY_HAS_TEAM; resp.desc = 'teams exits';break;
            }
        }

        var curTime = common.getTime();
        if (gClan.getLastJoinTime(uid) + gConfGlobalNew.teamJoinTimeLimit * 3600 > curTime) {
            resp.code = ErrorCode.ERROR_LAST_JOIN_TIME_TOO_NEAR; resp.desc = 'time limit'; break;
        }

        // 生成战队id
        var id = gClan.ai;
        id += 1;

        teams[id] = {
            uid: uid,
            name: name,
            bulletin:'',
            join_way: 1,
            join_term: {level: 0,},
            member_list: {},
            dissolve_time: 0,
            apply_list: {},
            can_use_badge: [1],
            use_badge: 1,
            impeach: {uid: 0, time: 0},
            finish_task : [0,0,0,0,0,0,0],
        };

        gClan.ai = id;
        gClan.teams[id] = teams[id];
        gClan.teams_num++;
        gClan.teamsArr.push(id);
        gClan.markDirty('ai');
        gClan.markDirty('teams.' + id + '');

        var calcTeamFight = gClan.calcTeamFight(id);
        gClan.ranks.insert([+id, calcTeamFight.fightCount]);

        gClan.addMember(id, uid);
        gClan.task_msg[uid] = 0;
        resp.data.teamId = id;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 修改战队公告
exports.modify_bulletin = function (req,res,resp) {
    do {
        var bulletinName = req.args.bulletinName;
        var teamId = gClan.userTeam[req.uid];

        if (!gClan.isLeader(teamId,req.uid)){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader';break;
        }

        var team = gClan.teams[teamId];
        team.bulletin = bulletinName;
        gClan.markDirty('teams.'+teamId+'.bulletin');
    } while (false);

    onReqHandled(res,resp,1);
};

// 解散队伍
exports.dissolve_team = function (req,res,resp){
    var uid = +req.uid;
    do {
        var teamId = gClan.userTeam[uid];
        var team = gClan.teams[teamId];
        if (!team) {
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'team not exist'; break;
        }

        if (!gClan.isLeader(teamId, uid)) {
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader'; break;
        }

        var leaderUser = gUserInfo.getUser(uid);
        var teamName = team.name;

        // 发送推送消息通知队伍解散
        var uids = [];
        for (var i in team.member_list) {
            uids.push(+i);
        }
        var args = {
            mod : 'clan',
            act : 'dissolve_team',
        };
        pushToGroupUser(uids, 'self', args);

        // 发送队伍解散邮件
        var time = common.getTime();
        var mail = {
            awards : [],
            time : time,
            expire : time + gConfMail[46].time * OneDayTime,
            content : [46, leaderUser.info.un, teamName],
            attach : {

            },
        }

        // 通知村庄争夺服务器有队伍解散
        var landgrabberReq = {
            uid : req.uid,
            mod : 'landgrabber',
            act : 'village_team_dismiss',
            args : {
                team_id : teamId,
            },
        }

        requestLandGrabber(landgrabberReq, {}, function () {
            DEBUG('send team dismiss notify to landgrabber suss');
        });

        // 通知本服的村庄争夺系统
        gLandGrabber.onTeamDismiss(teamId);

        for(var uid in team.member_list){
            gMail.add(+uid, mail);
            delete gClan.userTeam[+uid]
        }

        delete gClan.teams[teamId];
        gClan.ranks.removeById(teamId);

        gClan.teams_num--;
        gClan.teams_num <= 0 && (gClan.teams_num = 0);
        gClan.teamsArr = gClan.teamsArr.remove(teamId);

        gClan.markDirty('teams');
    } while (false);

    onReqHandled(res, resp, 1);
};

// 修改战队名字
exports.modify_name = function (req,res,resp) {
    do{
        var name = req.args.name;
        var teamId = gClan.userTeam[req.uid];

        if (gClan.isName(name)){
            resp.code = ErrorCode.ERROR_TEAM_NAME_EXIST; resp.desc = 'name exits';break;
        }

        if (!gClan.isLeader(teamId,req.uid)){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader';break;
        }

        gClan.teams[teamId].name = name;
        gClan.markDirty('teams.' + teamId + '.name')

    }while (false);


    onReqHandled(res, resp, 1);
};

// 查询战队列表
exports.get_team_list = function (req,res,resp) {
    do {
        var teamId = +req.args.teamId;
        if (teamId) {// 根据战队id查找
            if (!gClan.teams[teamId]) {
                resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team'; break;
            }

            var jsonOnly = {};
            var apply_list = gClan.teams[teamId].apply_list || {};
            jsonOnly[teamId] = gClan.teamMsg(teamId);
            if (apply_list[req.uid]) {// 如果查询的时候已经申请的队伍，join_way=3,(前端要求)
                jsonOnly[teamId].join_way = 3;
            }

            resp.data.team = jsonOnly;
        } else {
            var teamArr = gClan.getTeamList(gClan.userTeam[req.uid],req.uid);
            var len = teamArr.length;
            var limit = 10; // 一次查询多少个战队

            // 已经申请的战队
            var jsonApply = {};
            var applyList = gClan.applyList[req.uid];
            if (applyList) {
                applyList.forEach(function (val) {
                    gClan.teamMsg(val) && (jsonApply[val] = gClan.teamMsg(val));
                });
            }

            var ranksArr = Object.keys(gClan.ranks.idMap);
            // 排除已经选好的
            Array.prototype.noName = function (arr) {
                if(!arr || arr.length == 0) return this;
                return this.filter(function (a) {
                    return arr.indexOf(a) <= -1
                })
            };

            function ss(from,to,arr,num,delArr) {
                var cur = ranksArr.slice(from - 1,to);
                delArr && (cur = cur.noName(delArr));
                for(var i = 0;i < num;i++){
                    var curArr = cur.noName(arr);
                    var rg = common.randRange(0, curArr.length - 1);
                    curArr[rg] && arr.push(curArr[rg]);
                }
                return arr;
            }

            var teamListArr = [];

            if (len - (applyList && applyList.length || 0) >= limit){
                var top1 = ss(1,len > 3 ? 3 : len,teamListArr,1,[]);
                var top2 = ss(1,len > 20 ? 20 : len,top1,3,[]);
                var top3 = ss(1,len,top2,limit - 4,[]);
                teamListArr = top3;
            }else {
                teamListArr = teamArr;
            }

            var jsonLotsOf = {};
            teamListArr.forEach(function (teamId) {
                var teamInfo = gClan.teamMsg(teamId);
                if (teamInfo) {
                    jsonLotsOf[teamId] = teamInfo;
                }
            });

            resp.data.teams = jsonLotsOf;
            resp.data.applyTeams = jsonApply;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 申请加入战队
exports.join_team = function (req,res,resp) {
    do {
        var teamId = +req.args.teamId;

        if (!gClan.teams[teamId]){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }
        var oldTeamId = gClan.userTeam[req.uid];
        if (oldTeamId){
            if(!gClan.teams[oldTeamId]){
               delete gClan.userTeam[+req.uid];
            }else{
                resp.code = ErrorCode.ERROR_ALREADY_HAS_TEAM; resp.desc='already join team'; break;
            }
        }

        if (gClan.applyList[req.uid] && gClan.applyList[req.uid].length >= gConfGlobalNew.teamApplyLimit){
            resp.code = ErrorCode.ERROR_APPLY_LIST_FULL; resp.desc = 'join team capped';break;
        }

        // 判断玩家距离上次加入队伍时间
        if (gClan.getLastJoinTime(req.uid) + gConfGlobalNew.teamJoinTimeLimit * 3600 > common.getTime()) {
            resp.code = ErrorCode.ERROR_LAST_JOIN_TIME_TOO_NEAR; resp.desc = 'time limit'; break;
        }

        var team = gClan.teams[teamId];
        var uid = +req.uid;

        var applyList = team.applyList;
        var applyCount = 0;
        for (var i in applyList){
            applyCount++;
        }

        if (applyCount >= gConfGlobalNew.teamApplyMax){
            resp.code = ErrorCode.ERROR_APPLY_LIST_FULL; resp.desc='team apply count'; break;
        }

        var level = gClan.calcTeamLevel(teamId)[0];
        if (Object.keys(team.member_list).length >= gConfTeamBase[level].maxMember) {
            resp.code = ErrorCode.ERROR_MEMBER_LIST_FULL; resp.desc = 'team full'; break;
        }

        var join_way = team.join_way;// 申请方式
        var user = gUserInfo.getUser(uid);

        if(join_way == 0 || user.status.level < team.join_term.level){// 不可加入
            resp.code = 106;resp.desc='not join';break;
        }else if(join_way == 1){// 直接加入
            gClan.addMember(teamId, uid, true);
            resp.data.teamId = teamId;
            resp.data.joinTerm = 2;
        }else if(join_way == 2){// 申请加入  需要判断join_term是否满足
            team.apply_list[uid] = {
                time:common.getTime()
            };
            !gClan.applyList[uid] && (gClan.applyList[uid] = []);
            gClan.applyList[uid].push(teamId);
            gClan.markDirty('teams.'+teamId+'.apply_list.'+uid+'');
            pushToUser(team.uid, 'self', {
                mod : 'clan',
                act : 'clan',
                un : user.info.un,
                clan_xp : user.status.team_exp,
                type : 'apply',
            });// 申请成功推送给队长
            resp.data.joinTerm = 1;
        }else{
            resp.code = 106;resp.desc='do not join';break;
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 撤销申请加入战队
exports.undo_join = function (req,res,resp) {
    do {
        var teamId = +req.args.teamId;
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        // 没有申请
        if (!gClan.applyList[req.uid] || gClan.applyList[req.uid].indexOf(teamId) <= -1){
            resp.code = ErrorCode.ERROR_NOT_APPLY_YET; resp.desc = 'not apply'; break;
        }

        gClan.undoApply(req.uid,teamId);

        var json = {};
        json[teamId] = team;
        resp.data.team = json;
    }while (false);

    onReqHandled(res,resp,1);
};

// 退出战队
exports.leave_team = function (req,res,resp) {
    do {
        var team = gClan.getTeamMsg(req.uid);
        if (!gClan){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        var memberList = team.member_list;

        if (req.uid == team.uid) {
            resp.code = ErrorCode.ERROR_LEADER_CAN_NOT_LEAVE; resp.desc='leader do sign out team'; break;
        }

        if (!memberList[req.uid]){
            resp.code = ErrorCode.ERROR_NOT_TEAM_MEMBER; resp.desc='do not member'; break;
        }

        gClan.kickOut(req.uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取申请列表
exports.get_apply_list = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var uid = req.uid;
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team';break;
        }

        if (team.uid != uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader'; break;
        }

        var applyList = team.apply_list;
        var json = {};

        for (var i in applyList){
            json[+i] = gClan.userMsg(+i, teamId, 'apply');
        }

        resp.data.applyList = json;
    } while (false);

    onReqHandled(res, resp, 1)
};

// 获取已经激活的徽章
exports.get_can_use_badge = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        var canUseBadge = [];
        if (team) {
            canUseBadge = team.can_use_badge;
        }
        resp.data.can_use_badge = canUseBadge;

    } while (false);

    onReqHandled(res, resp, 1);
};

// 佩戴战队徽章
exports.use_badge = function (req,res,resp) {
    do {
        var badgeId = req.args.id;
        var teamId = gClan.userTeam[req.uid];
        var uid = req.uid;
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team';break;
        }

        if (team.uid != uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader';break;
        }

        var canUseBadge = team.can_use_badge;
        var flag = 0;// 判断是否激活了徽章
        for (var i = 0, len = canUseBadge.length; i < len; i++){
            if (canUseBadge[i] == badgeId){
                flag = 1;
                break;
            }
        }

        if (!flag){
            resp.code = ErrorCode.ERROR_BADGE_CAN_NOT_USE; resp.desc = 'can not use badge'; break;
        }

        team.use_badge = badgeId;

        gClan.markDirty('teams.'+teamId+'.use_badge');

    } while (false);

    onReqHandled(res,resp,1)
};

// 获取入队条件
exports.get_join_term = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        if (!gClan.isLeader(teamId, req.uid)){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc='not leader'; break;
        }

        var team = gClan.teams[teamId];
        resp.data.joinWay = team.join_way;
        resp.data.joinTerm = team.join_term;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 修改申请入队条件
exports.modify_join_term = function (req,res,resp) {
    do {
        var joinWay = req.args.joinWay;
        var joinTerm = req.args.joinTerm;
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if(!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team'; break;
        }

        if(team.uid != req.uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'do not leader'; break;
        }

        team.join_way = +joinWay;
        gClan.markDirty('teams.'+teamId+'.join_way');

        if (joinTerm && joinTerm.level){
            team.join_term.level = joinTerm.level;
            gClan.markDirty('teams.'+teamId+'.join_term');
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 任命队长
exports.nominate_leader = function (req,res,resp) {
    do {
        var nominateUid = +req.args.nominateUid;// 任命队长uid
        var uid = +req.uid;
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if (!team) {
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST;
            resp.desc = 'not team';
            break;
        }

        if (team.uid != uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader'; break;
        }

        if (uid == nominateUid){
            resp.code = ErrorCode.ERROR_ALREADY_TEAM_LEADER; resp.desc = 'already leader'; break;
        }

        var memberList = team.member_list;
        var flag = false;
        for (var uid in memberList){
            if (+uid == nominateUid){
                flag = true;break;
            }
        }

        if (!flag){
            resp.code = ErrorCode.ERROR_NOT_TEAM_MEMBER; resp.desc = 'not member'; break;
        }

        team.uid = nominateUid;
        gClan.markDirty('teams.'+teamId+'.uid');
        gClan.msgToTeam(teamId, nominateUid, 'change_leader');

        // 村庄争夺
        gLandGrabber.onTeamLeaderChange(teamId, nominateUid);

        // 通知跨服服务器
        var landGrabberReq = {
            uid : 1,
            mod : 'landgrabber',
            act : 'village_team_leader_change',
            args : {
                team_id : teamId,
                new_leader : nominateUid,
            },
        }

        requestLandGrabber(landGrabberReq, {}, function () {
            DEBUG('send team leader change notify to landgrabber suss');
        });
    } while (false);

    onReqHandled(res, resp, 1);
};

// 踢出队伍
exports.kicked_out = function (req,res,resp) {
    do {
        var kickedUid = req.args.kickedUid;// 踢出队伍的玩家id
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team'; break;
        }

        if (team.uid != req.uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc = 'not leader'; break;
        }

        if (kickedUid == req.uid){
            resp.code = ErrorCode.ERROR_CAN_NOT_KICK_SELF; resp.desc = 'leader not kick'; break;
        }

        var memberList = team.member_list;
        var flag = false;
        for(var i in memberList){
            if(kickedUid == +i){
                flag = true;break;
            }
        }
        if(!flag){
            resp.code = ErrorCode.ERROR_NOT_TEAM_MEMBER; resp.desc = 'not member'; break;
        }

        gClan.kickOut(kickedUid);
    } while (false);

    onReqHandled(res,resp,1);
};

// 玩家下线，记录时间, logic=>user=>offline调用的
exports.offline = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        try {
            var member = team.member_list[req.uid];
            var time = common.getTime();
            member.offline_time = time;
            team.dissolve_time = time;
            gClan.markDirty('teams.' + teamId + '.dissolve_time');
            gClan.markDirty('teams.' + teamId + '.member_list.' + req.uid + '');
        } catch (e){
            break;
        }
    } while (false);
    onReqHandled(res, resp, 1);
};

// 弹劾
exports.impeach = function (req,res,resp) {
    do {
        var leaderUid = req.args.leaderUid;
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        var uid = req.uid;
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team'; break;
        }

        if (leaderUid != team.uid) {
            resp.code = ErrorCode.ERROR_CAN_NOT_IMPEACH_SELF; resp.desc = 'leader not kick'; break;
        }
        //已经存在弹劾
        if (team.impeach.uid && team.impeach.time){
            resp.code = ErrorCode.ERROR_IMPEACH_CONDITION_NOT_ENOUGH; resp.desc = 'do not impeach'; break;
        }
        var member = team.member_list[leaderUid];
        var impeachTiam = common.getTime();
        var CaptainTime = gConfGlobalNew.teamCaptainImpeachLimit * 60 * 60;
        // var CaptainTime = 120;

        // 不满足弹劾条件
        if (impeachTiam - member.offline_time < CaptainTime|| member.offline_time == 0){
            resp.code = ErrorCode.ERROR_IMPEACH_CONDITION_NOT_ENOUGH; resp.desc = 'do not impeach'; break;
        }

        team.impeach = {
            uid : uid,
            time: impeachTiam
        };
        resp.data.impeachTime = impeachTiam;
        gClan.markDirty('teams.' + teamId + '.impeach');
    } while (false);
    onReqHandled(res,resp,1);
};

// 是否同意加入队伍
exports.reply_join = function (req,res,resp) {
    do {
        var isJoin = req.args.isJoin;
        var applyUid = +req.args.applyUid;       // 申请人uid
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.getTeamMsg(req.uid);

        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        if(team.uid != req.uid){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc='not leader'; break;
        }

        var applyList = team.apply_list;
        if (!applyList[applyUid]){
            resp.code = ErrorCode.ERROR_HAS_JOIN_OTHER_TEAM; resp.desc='not applicant'; break;
        }

        if (gClan.userTeam[applyUid]){
            resp.code = ErrorCode.ERROR_ALREADY_HAS_TEAM; resp.desc = 'already has team';break;
        }

        // 判断玩家距离上次加入队伍时间
        if (isJoin == 1 && gClan.getLastJoinTime(applyUid) + gConfGlobalNew.teamJoinTimeLimit * 3600 > common.getTime()) {
            resp.code = ErrorCode.ERROR_LAST_JOIN_TIME_TOO_NEAR; resp.desc = 'time limit'; break;
        }

        delete applyList[applyUid];
        gClan.markDirty('teams.' + teamId + '.apply_list');

        if (isJoin == 1) {
            // 同意加入战队
            var level = gClan.calcTeamLevel(teamId)[0];
            var memberNum = gClan.calcTeamFight(teamId).memberNum;
            if (memberNum >= gConfTeamBase[level].maxMember){
                resp.code = ErrorCode.ERROR_MEMBER_LIST_FULL; resp.desc='member is full'; break;
            }

            gClan.addMember(teamId, applyUid);
            resp.data.teamId = teamId;
            resp.data.newMember = gClan.userMsg(applyUid, teamId);
        } else{
            // 拒绝加入
            gClan.undoApply(applyUid,teamId);
        }

    } while (false);

    onReqHandled(res, resp, 1)
};

// 判断战队成员离线时间，是否自动解散
exports.auto_dissolve_team = function (req,res,resp) {
    gClan.auto_dissolve_team();
    /* 
    do {
        var teams = gClan.teams;
        var MaxDissolveTime = gConfGlobalNew.teamAutoBreakTime * 24 * 60 * 60;
        for(var i in teams){
            var tid = parseInt(i);
            if (teams[tid].dissolve_time != 0 && (common.getTime() - teams[tid].dissolve_time) > MaxDissolveTime){
                var team = teams[tid];
                var teamName = team.name;
                var leaveTime = common.getTime() - teams[tid].dissolve_time;

                // 发送推送消息通知队伍解散
                var uids = [];
                for (var i in team.member_list) {
                    uids.push(+i);
                }
                var args = {
                    mod : 'clan',
                    act : 'dissolve_team',
                };
                pushToGroupUser(uids, 'self', args);

                // 发送队伍解散邮件
                var time = common.getTime();
                var mail = {
                    awards : [],
                    time : time,
                    expire : time + gConfMail[47].time * OneDayTime,
                    content : [47, leaveTime, teamName],
                    attach : {

                    },
                }

                for(var uid in team.member_list){
                    gMail.add(+uid, mail);
                    delete gClan.userTeam[+uid]
                }

                delete teams[tid];
            } else if(!teams[tid].uid) {
                for(var uid in teams[tid].member_list){
                    delete gClan.userTeam[+uid]
                }
                delete teams[tid];
            }
        }
        gClan.markDirty('teams');
    } while (false);
    */
    onReqHandled(res,resp,1);
};

// 清空申请列表
exports.clear_apply = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if(!gClan.isLeader(teamId,req.uid)){
            resp.code = ErrorCode.ERROR_NOT_TEAM_LEADER; resp.desc='not leader'; break;
        }
        team.apply_list = {};
        gClan.markDirty('teams.'+teamId+'.apply_list');
    } while (false);

    onReqHandled(res,resp,1);
};

// 获取战队成员列表
exports.get_member_list = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        var memberList = team.member_list;
        var TeamFight = gClan.calcTeamFight(teamId);
        var json = {
            teamId: teamId,
            uid : team.uid,
            use_badge: team.use_badge,
            name : team.name,
            member_num:TeamFight.memberNum,
            fight_force:TeamFight.fightCount,
            member_list :{}
        };

        var leader = {};
        leader[team.uid] = gClan.userMsg(team.uid,teamId);
        for(var i in memberList){
            var memberUid = parseInt(i);
            if (team.uid != memberUid){
                gClan.userMsg(memberUid, teamId) && (json.member_list[memberUid] = gClan.userMsg(memberUid,teamId));
            }
        }
        resp.data.team = json;
        resp.data.leader = leader;
    } while (false);

    onReqHandled(res, resp, 1)
};

// 获取每日奖励 返回战队等级
exports.get_daily_awards = function (req,res,resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if (!team) {
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team';break;
        }

        var level = gClan.calcTeamLevel(teamId)[0];
        resp.data.awards = gConfTeamBase[level].award;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取战队排行榜
exports.get_ranks = function (req,res,resp) {
    do {
        var rankList = [];
        gClan.ranks.each(function (data) {

            if (rankList.length >= gConfGlobalNew.rankListLimit_team) return false;

            var team = gClan.teamMsg(data[0]);
            if(!team){
                return false;
            }
            team.id = parseInt(data[0]);
            team.un = team.name;
            delete team.name;
            delete team.memberNum;
            delete team.join_way;
            delete team.join_term;

            if (rankList.length == 0) {
                // 排名第一的队伍，需要发队长信息
                var leaderUser = gUserInfo.getUser(team.uid);
                if (leaderUser) {
                    team.leader = {};
                    team.leader.name = leaderUser.info.un;
                    team.leader.main_role = leaderUser.info.model;
                    team.leader.headpic = leaderUser.info.headpic;
                    team.leader.headframe = leaderUser.info.headframe;
                    team.leader.fight_force = leaderUser.fight_force;
                    team.leader.weapon_illusion = leaderUser.sky_suit.weapon_illusion;
                    team.leader.wing_illusion = leaderUser.sky_suit.wing_illusion;
                    team.leader.mount_illusion = leaderUser.sky_suit.mount_illusion;
                    team.leader.custom_king = leaderUser.custom_king;
                }
            }
            rankList.push(team);
        });

        var teamId = gClan.userTeam[req.uid];
        var ownTeamMsg = gClan.teamMsg(teamId);
        if (ownTeamMsg) {
            ownTeamMsg.id = parseInt(teamId);
            ownTeamMsg.un = ownTeamMsg.name;
            delete ownTeamMsg.name;
            delete ownTeamMsg.memberNum;
            delete ownTeamMsg.join_way;
            delete ownTeamMsg.join_term;

            resp.data.self = ownTeamMsg;
        }
        resp.data.rank_list = rankList;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 进入战队任务界面获取信息
exports.get_task = function (req,res,resp) {
    var uid = +req.uid;
    do {
        var teamId = gClan.userTeam[uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'no team'; break;
        }

        if (typeof gClan.task_msg[uid] == 'object') {
            gClan.task_msg[uid] = 0;
            gClan.markDirty(util.format('task_msg.%d', uid));
        }
        var taskMsg = gClan.task_msg[uid] || 0;

        resp.data.taskJson = team.finish_task;
        resp.data.awardBox = taskMsg;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 激活任务 直接领取奖励
exports.active_task = function (req,res,resp) {
    var uid = +req.uid;
    do {
        var taskArr = req.args.taskArr;//[1,4412154545]
        var teamId = gClan.userTeam[uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc = 'not team'; break;
        }

        // 计算任务集合
        var taskId = taskArr[0];

        if (!team.finish_task[taskId - 1]) {
            team.finish_task[taskId - 1] = 0;
        }

        team.finish_task[taskId - 1] ++;
        gClan.markDirty(util.format('teams.%d.finish_task', teamId));

        var getUser = gUserInfo.getUser(uid);
        getUser.clan.task++;

        // 重新计算任务宝箱
        gClan.calcTask(team, teamId);

        // 需要推送的uid
        var syncUids = [];
        for (var muid in team.member_list) {
            if (muid != uid) {
                syncUids.push(muid);
            }
        }

        // 同步给其他队伍成员
        for (var i = 0; i < syncUids.length; i++) {
            var args = {
                mod : 'clan',
                act : 'active_task',
                taskJson : team.finish_task,
                awardBox : gClan.task_msg[syncUids[i]] | 0,
            };

            pushToUser(syncUids[i], 'self', args);
        }

        var teamLevel = gClan.calcTeamLevel(teamId)[0];
        var awards = gConfTeamBase[teamLevel].teamTaskAward;
        var addExp = 0;
        for (var i = 0; i < awards.length; i++) {
            if (awards[i][1] == 'team_exp') {
                gClan.addMemberTeamExp(teamId, uid, parseInt(awards[i][2]));
                addExp += parseInt(awards[i][2]);
            }
        }

        resp.data.taskJson = team.finish_task;
        resp.data.awardBox = gClan.task_msg[uid] || 0;
        resp.data.awards = awards;
        resp.data.addExp = addExp;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 领取宝箱
exports.get_awards_box = function (req,res,resp) {
    var uid = +req.uid;
    do {
        var teamId = gClan.userTeam[uid];

        // 判断有没有可领的宝箱
        var boxNum = gClan.task_msg[uid] || 0;
        if (boxNum <= 0){
            resp.code = ErrorCode.ERROR_NO_AWARD_CAN_GET; resp.desc = 'award_box is not num';break;
        }

        gClan.task_msg[uid] --;
        gClan.markDirty(util.format('task_msg.%d', uid));

        // 计算宝箱奖励
        var oldLevel = gClan.calcTeamLevel(teamId)[0];
        var awards = gConfTeamBase[oldLevel].teamTaskBoxAward;
        var addExp = 0;
        for (var i = 0; i < awards.length; i++) {
            if (awards[i][1] == 'team_exp') {
                gClan.addMemberTeamExp(teamId, uid, parseInt(awards[i][2]));
                addExp += parseInt(awards[i][2]);
            }
        }

        var newLevel = gClan.calcTeamLevel(teamId)[0];

        resp.data.awards = awards;
        resp.data.level = newLevel;
        resp.data.addExp = addExp;
        resp.data.awardBox = gClan.task_msg[uid] | 0;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.challenge = function(req, res, resp) {
    var uid = req.uid;
    do {
        var enemyId = req.args.enemy;

        var teamId = gClan.userTeam[uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        var memberList = team.member_list;
        if (!memberList[enemyId]) {
            resp.code = ErrorCode.ERROR_NOT_TEAM_MEMBER; resp.desc = 'not member'; break;
        }

        var enemy = gUserInfo.getUserFightInfo(enemyId);

        var replay = {
            enemy: enemy,
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        }

        resp.data = replay;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 返回日志
exports.get_clan_log = function (req,res,resp) {
    do{
        var teamId = gClan.userTeam[req.uid];
        resp.data.clan_log = gClan.clan_log[teamId];
    } while (false);

    onReqHandled(res,resp,1);
};

// 获取队长id
exports.get_leader_id = function (req, res, resp) {
    do {
        var teamId = gClan.userTeam[req.uid];
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team';break;
        }

        resp.data.leader = team.uid;
        resp.data.title = gUserInfo.getTitle(req.uid);
    } while (false);

    onReqHandled(res, resp, 1)
};

// 获取小队信息
exports.get_team_info = function (req, res, resp) {
    do {
        var teamId = +req.args.team_id;
        var team = gClan.teams[teamId];
        if (!team){
            resp.code = ErrorCode.ERROR_TEAM_NOT_EXIST; resp.desc='not team'; break;
        }

        resp.data = gClan.teamMsg(teamId, true);
    } while (false);

    onReqHandled(res, resp, 1)
};

// 清除村庄争夺功能中跨服地块上冗余的队伍玩家
exports.tidy_team_member = function (req, res, resp) {

    do {

        var teamId = gClan.userTeam[req.uid]
        if (!teamId) {
            break
        }

        var team = gClan.teams[teamId]
        if (!team) {
            break
        }

        var member_list = [];

        for (var uid in team.member_list) {
            member_list.push(uid)
        }

        var landGrabberReq = {
            uid : 1,
            mod : 'landgrabber',
            act : 'village_member_check',
            args : {
                team_id : teamId,
                member_list : member_list,
            },
        }

        requestLandGrabber(landGrabberReq, {}, function () {
            DEBUG('send team member tidy to landgrabber suss');
        });

    } while(false);

    onReqHandled(res, resp, 1)
};

exports.Clan = Clan;
