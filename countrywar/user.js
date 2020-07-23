function UserInfo(){
    this.users = {
        /*
         uid : {
         info : {
         un : '',
         headpic : 0,
         },
         status : {
         level : 1,
         vip : 0,
         },
         pos : {},
         skills : {},
         def_info : {},
         sky_suit:  {
            weapon_illusion: 0,
            wing_illusion: 0,
         },
         fight_force : 0,

        -- 服战相关数据
         countryWar : {
            roomId : 0, // 房间id
            camp : 0,   // 势力，1-蓝，2-绿，3-红
            serverId : 0,
            city : 1,   // 所在城池id
            taskInfo : { // 任务变量
                1 : {
                    killCount : 0,  // 击杀魏国玩家数
                    conqueredCity : 0,  // 攻陷魏国城池数
                }
                2 : {},
                3 : {},
            },

            continuousKill : 0,   // 连杀数
            continuousKillWithoutRobot : 0, // 非包含机器人连杀数
            deathTime : 0,    // 死亡时间
            coolTime : 0,   // 战斗冷却
            targetCity : 0, // 目标城池id
            reachTime : 0,  // 到达目标城池的时间
            score : 0,  // 个人积分
            weekScore : 0,  // 周积分
            addScoreTime : 0,   // 加积分的时间
            scoreSinceLastDeath : 0,    // 上次死亡后的积分
            highestKillCount : 0,   // 最高连斩数

            deathCount : 0, // 死亡次数
            weekDeathCount : 0, // 周死亡次数

            dayKillCount : 0, // 每日击杀数
            weekKillCount : 0,  // 周击杀次数

            callCount : 0,  // 发布集结令次数
            replyCallCount : 0, // 响应集结令次数
            fastReliveCount : 0,    // 快速复活次数
            buyGoodsCount : 0,  // 购买物资次数

            pos : { // 英雄信息
                '1' : {
                    'hp' : 100,     // 英雄血量，百分比
                    'soldierNum' : 12,  // 小兵数量
                },
            },

            // 任务奖励领取记录
            personalTaskAwardGot : [],
            countryTaskAwardGot : [],

            // 防守阵型
            def_info : {
                team : {},
                skills : {},
            },
         },
         }
         */
    };

    this.updates = {};
}

UserInfo.prototype = {
    init : function(callback) {
        var cursor = gDBUser.find();
        cursor.each(function(err, item){
            if (err) {
                callback && callback(false);
            }

            if (item) {
                if (item.countryWar) {
                    item.countryWar.leave = true;
                }
                if (!item.sky_suit) {
                    item.sky_suit = {
                        weapon_illusion: 0,
                        wing_illusion: 0,
                    };
                }
                this.users[item._id] = item;
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    getUser : function(uid) {
        return this.users[uid];
    },

    getUserCount : function (roomId, online_players, all_players) {
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user && user.countryWar) {
                if (!user.countryWar.leave || !this.isCapitalCity(user.countryWar.city)) {
                    online_players[user.countryWar.camp] += 1;
                }

                all_players[user.countryWar.camp] += 1;
            }
        }
    },

    getUserFightInfo : function(uid, notUseDefPos, useCountryWarTeam, cityId) {
        var cityInfo = gConfCountryWarCity[cityId];
        var info = {};

        var needAddAttr = false;
        var user = this.getUser(uid);
        if (cityInfo && user.countryWar.camp == cityInfo.group) {
            // 需要加成
            needAddAttr = true;
        }

        info.uid = uid;
        info.un = user.info.un;
        info.country = user.info.country;
        info.server = common.getServerId(uid);
        info.level = user.status.level;
        info.camp = user.countryWar.camp;
        info.pos = {};
        info.weapon_illusion = user.sky_suit.weapon_illusion;
        info.wing_illusion = user.sky_suit.wing_illusion;
        info.mount_illusion = user.sky_suit.mount_illusion;
        info.custom_king = user.custom_king;

        // 龙的等级
        info.dragon = {};
        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i] = user.dragon[i].level;
            }
        }

        var fightForce = 0;
        for (var p in user.pos) {
            if (user.pos[p].hid) {
                info.pos[p] = {};
                info.pos[p].hid = user.pos[p].hid;
                info.pos[p].slot = user.pos[p].slot;
                info.pos[p].destiny = user.pos[p].destiny.level;
                info.pos[p].talent = user.pos[p].talent;
                info.pos[p].quality = user.pos[p].quality;
                info.pos[p].attr = clone(user.pos[p].attr);
                if (needAddAttr) {
                    for (var i = 0; i < cityInfo.atts.length; i++) {
                        info.pos[p].attr[cityInfo.atts[i]] += cityInfo.value[i];
                    }
                }

                info.pos[p].fight_force = user.pos[p].fight_force;
                info.pos[p].soldier_level = user.pos[p].soldier.level;
                info.pos[p].soldier_star = user.pos[p].soldier.star;

                if (user.countryWar.pos[p]) {
                    info.pos[p].hp = user.countryWar.pos[p].hp;
                    info.pos[p].soldierNum = user.countryWar.pos[p].soldierNum;
                } else {
                    var a = 0;
                }

                info.pos[p].promote = user.pos[p].promote;

                fightForce += user.pos[p].fight_force;
            }
        }

        var defInfo = user.def_info;
        if (!notUseDefPos && defInfo.set) {
            info.skills = clone(user.skills);
            for (var slot in defInfo.skills) {
                if (!info.skills[slot]) {
                    info.skills[slot] = {};
                }
                info.skills[slot].id = defInfo.skills[slot];
            }
            for (var pos in defInfo.team) {
                if (!info.pos[pos]) {
                    info.pos[pos] = {};
                }
                info.pos[pos].slot = defInfo.team[pos];
            }
        } else if (notUseDefPos && useCountryWarTeam) {
            if (!user.countryWar.def_info) {
                user.countryWar.def_info = clone(user.def_info);
            }

            info.skills = clone(user.skills);
            for (var slot in info.skills) {
                info.skills[slot].id = user.countryWar.def_info.skills[slot];
                if (!info.skills[slot].id) {
                    info.skills[slot].id = 0;
                }
            }

            var slots = SlotArray.slice();
            var poses = SlotArray.slice();
            for (var pos in user.countryWar.def_info.team) {
                var slot = user.countryWar.def_info.team[pos];
                info.pos[pos].slot = slot;

                slots.remove(+slot);
                poses.remove(+pos);
            }

            for (var i = 0, len = poses.length - 2; i < len; i++) {
                var pos = poses[i];
                if (!info.pos[pos] || !info.pos[pos].slot) {
                    continue;
                }

                var slot = slots[0];
                info.pos[pos].slot = slot;
                slots.remove(slot);
            }
        }
        else {
            info.skills = user.skills;
        }

        user.fight_force = fightForce;
        return info;
    },

    setTeam : function (uid, team, skills) {
        var userInfo = this.getUser(uid);
        userInfo.countryWar.def_info.team = team;
        userInfo.countryWar.def_info.skills = skills;
        this.markDirty(uid);
    },

    getUserFightForce : function(uid) {
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        if (user.fight_force) {
            return user.fight_force;
        }
        var fightForce = 0;
        for (var p in user.pos) {
            fightForce += user.pos[p].fight_force;
        }
        user.fight_force = fightForce;
        return fightForce;
    },

    initUserCountryWarData : function (uid, roomId, camp, serverId, initCity) {
        if (!this.users[uid])
            return;

        this.users[uid].countryWar = {};
        this.users[uid].countryWar.roomId = roomId;
        this.users[uid].countryWar.camp = camp;
        this.users[uid].countryWar.serverId = serverId;
        this.users[uid].countryWar.city = initCity;   // 所在城池id
        this.users[uid].countryWar.init = false;

        this.users[uid].countryWar.taskInfo = {}; // 任务变量
        for (var i = 1; i <= 3; i++) {
            this.users[uid].countryWar.taskInfo[i] = {};
            this.users[uid].countryWar.taskInfo[i].killCount = 0;  // 击杀玩家数
            this.users[uid].countryWar.taskInfo[i].conqueredCity = 0;  // 占领城池数
        }

        this.users[uid].countryWar.continuousKill = 0;   // 连杀数
        this.users[uid].countryWar.continuousKillWithoutRobot = 0;
        this.users[uid].countryWar.deathCount = 0;       // 死亡次数
        this.users[uid].countryWar.deathTime = 0;        // 死亡时间
        this.users[uid].countryWar.coolTime = 0;         // 战斗冷却
        this.users[uid].countryWar.targetCity = 0;       // 目标城池id
        this.users[uid].countryWar.reachTime = 0;        // 到达目标城池的时间
        this.users[uid].countryWar.leave = false;        // 是否离开
        this.users[uid].countryWar.score = 0;            // 个人积分
        this.users[uid].countryWar.weekScore = 0;        // 个人周积分
        this.users[uid].countryWar.addScoreTime = 0;        // 个人周积分
        this.users[uid].countryWar.scoreSinceLastDeath = 0;
        this.users[uid].countryWar.highestKillCount = 0;
        this.users[uid].countryWar.callCount = 0;        // 发布集结令次数
        this.users[uid].countryWar.replyCallCount = 0;   // 响应集结令次数
        this.users[uid].countryWar.fastReliveCount = 0;   // 快速复活次数
        this.users[uid].countryWar.buyGoodsCount = 0;    // 购买物资次数

        this.users[uid].countryWar.weekDeathCount = 0; // 周死亡次数
        this.users[uid].countryWar.dayKillCount = 0; // 每日击杀数
        this.users[uid].countryWar.weekKillCount = 0;  // 周击杀次数

        this.users[uid].countryWar.pos = {};
        for (var slot in this.users[uid].pos) {
            var hid = this.users[uid].pos[slot].hid;
            if (gConfHero[hid]) {
                var legionType = gConfHero[hid].legionType;
                var soldierLevel = this.users[uid].pos[slot].soldier.level;
                var soldierStar = this.users[uid].pos[slot].soldier.star;
                var soldierNum = gConfSoldierLevel[legionType][soldierLevel][soldierStar].num;

                this.users[uid].countryWar.pos[slot] = {};
                this.users[uid].countryWar.pos[slot].hp = 100;
                this.users[uid].countryWar.pos[slot].soldierNum = soldierNum;
            } else {
                var a = 0;
            }
        }

        this.users[uid].countryWar.personalTaskAwardGot = [];
        this.users[uid].countryWar.countryTaskAwardGot = [];

        if (this.users[uid].def_info)
            this.users[uid].countryWar.def_info = this.users[uid].def_info;
        else
            this.users[uid].countryWar.def_info = {};
    },

    update : function(uid, updates, roomId, camp, serverId) {
        var awards = [];
        var userInfo = this.users[uid];

        var initCity = +gCountryWar.findPlayerCity(uid);
        if (initCity == 0) {
            initCity = +this.getCapitalCityId(camp);
        }

        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;

            if (!this.users[uid].countryWar) {
                this.initUserCountryWarData(uid, roomId, camp, serverId, initCity);
            }
            this.markDirty(uid);

            gCountryWar.onPlayerEnterCity(uid, initCity);

            awards = [['user', 'goods', parseInt(gConfCountryWarBase.baseGoods.value)]];
            this.users[uid].countryWar.init = true;
            return awards;
        }

        var updated = false;
        for (var item in updates) {
            var segs = item.split('.');
            var tmpObj = userInfo;
            var len = segs.length;
            for (var i = 0; i < len-1; i++) {
                tmpObj = tmpObj[segs[i]];
            }
            if (updates[item] == null) {
                if (tmpObj.hasOwnProperty(segs[len-1])) {
                    delete tmpObj[segs[len-1]];
                }
            } else {
                tmpObj[segs[len-1]] = updates[item];
            }
            updated = true;
        }
        if (updated) {
            userInfo.fight_force = 0;
        }

        if (!this.users[uid].countryWar) {
            this.initUserCountryWarData(uid, roomId, camp, serverId, initCity);
        }

        if (!this.users[uid].countryWar.pos) {
            this.users[uid].countryWar.pos = {};
        }

        for (var slot in this.users[uid].pos) {
            if (!this.users[uid].countryWar.pos[slot]) {
                var hid = this.users[uid].pos[slot].hid;
                if (gConfHero[hid]) {
                    var legionType = gConfHero[hid].legionType;
                    var soldierLevel = this.users[uid].pos[slot].soldier.level;
                    var soldierStar = this.users[uid].pos[slot].soldier.star;
                    var soldierNum = gConfSoldierLevel[legionType][soldierLevel][soldierStar].num;

                    this.users[uid].countryWar.pos[slot] = {};
                    this.users[uid].countryWar.pos[slot].hp = 100;
                    this.users[uid].countryWar.pos[slot].soldierNum = soldierNum;
                }
            }
        }

        if (!this.users[uid].countryWar.def_info) {
            if (this.users[uid].def_info)
                this.users[uid].countryWar.def_info = this.users[uid].def_info;
            else
                this.users[uid].countryWar.def_info = {};
        }

        this.users[uid].countryWar.leave = false;

        if (this.users[uid].countryWar.roomId != roomId)
            this.users[uid].countryWar.roomId = roomId;

        if (this.users[uid].countryWar.camp != camp)
            this.users[uid].countryWar.camp = camp;

        if (this.users[uid].countryWar.serverId != serverId)
            this.users[uid].countryWar.serverId = serverId;

        if (!this.users[uid].countryWar.weekDeathCount) {
            this.users[uid].countryWar.weekDeathCount = 0;
        }

        if (!this.users[uid].countryWar.city) {
            this.users[uid].countryWar.city = initCity;
        }

        if (!this.users[uid].countryWar.addScoreTime) {
            this.users[uid].countryWar.addScoreTime = common.getTime();
        }

        if (!this.users[uid].countryWar.continuousKillWithoutRobot)
            this.users[uid].countryWar.continuousKillWithoutRobot = 0;

        if (!this.users[uid].countryWar.init) {
            awards = [['user', 'goods', parseInt(gConfCountryWarBase.baseGoods.value)]];
            this.users[uid].countryWar.init = true;
        }

        this.markDirty(uid);

        return awards;
    },

    save : function(callback) {
        var loader = new common.Loader(callback);
        loader.addLoad('empty');

        for (var uid in this.updates) {
            loader.addLoad(1);
            gDBUser.save(this.users[uid], function(err, result) {
                if (err) {
                    ERROR('save error uid ' + this.users[uid]._id);
                    ERROR(err);
                }
                loader.onLoad(1);
            }.bind(this));
        }
        this.updates = {};
        loader.onLoad('empty');
    },

    markDirty : function(uid) {
        this.updates[uid] = 1;
    },

    getKillCount : function (uid) {
        var count = 0;
        for (var i = 1; i <= 3; i++) {
            count += this.users[uid].countryWar.taskInfo[i].killCount;
        }
        return count;
    },

    // 击杀玩家
    onKillPlayer : function (killer_uid, dead_uid, dead_country) {
        var score = [0,0];
        if (this.users[killer_uid]) {
            if (!this.users[killer_uid].countryWar.taskInfo) {
                this.users[killer_uid].countryWar.taskInfo = {};
                for (var i = 1; i <= 3; i++) {
                    this.users[killer_uid].countryWar.taskInfo[i] = {};
                    this.users[killer_uid].countryWar.taskInfo[i].killCount = 0;
                    this.users[killer_uid].countryWar.taskInfo[i].conqueredCity = 0;
                }
            }

            if (!this.users[killer_uid].countryWar.taskInfo[dead_country]) {
                this.users[killer_uid].countryWar.taskInfo[dead_country] = {};
                this.users[killer_uid].countryWar.taskInfo[dead_country].killCount = 0;
                this.users[killer_uid].countryWar.taskInfo[dead_country].conqueredCity = 0;
            }

            this.users[killer_uid].countryWar.taskInfo[dead_country].killCount += 1;
            this.users[killer_uid].countryWar.continuousKill += 1;

            if (!isDroid(dead_uid))
                this.users[killer_uid].countryWar.continuousKillWithoutRobot += 1;

            if (!this.users[killer_uid].countryWar.dayKillCount)
                this.users[killer_uid].countryWar.dayKillCount = 0;
            this.users[killer_uid].countryWar.dayKillCount += 1;

            if (!this.users[killer_uid].countryWar.weekKillCount)
                this.users[killer_uid].countryWar.weekKillCount = 0;
            this.users[killer_uid].countryWar.weekKillCount += 1;

            this.markDirty(killer_uid);

            if (this.users[killer_uid].countryWar.continuousKill > this.users[killer_uid].countryWar.highestKillCount) {
                this.users[killer_uid].countryWar.highestKillCount = this.users[killer_uid].countryWar.continuousKill;
            }

            if (this.users[killer_uid].countryWar.continuousKill >= 8) {
                // 连杀数达到8，需要广播
                var playerIds = gUserInfo.getRoomPlayers(this.users[killer_uid].countryWar.roomId);
                if (playerIds.length > 0) {
                    var worldReq = {
                        mod : 'countrywar',
                        act : 'continuous_kill',
                        uid : 1,
                        args : {
                            players : playerIds,
                            uid : killer_uid,
                            country : this.users[killer_uid].countryWar.camp,
                            un : this.users[killer_uid].info.un,
                            killCount : this.users[killer_uid].countryWar.continuousKill,
                            serverId : this.users[killer_uid].countryWar.serverId,
                        },
                    };

                    var resp = {};
                    resp.code = 0;
                    gCountryWar.roomBroadcast(this.users[killer_uid].countryWar.roomId, worldReq, resp, function() {
                        if (resp.code == 0) {
                            DEBUG('request a client over continuous_kill');
                        } else {
                            DEBUG('request a client error, desc = ' + resp.desc);
                        }
                    });
                }
            }

            // 计算击杀者的积分
            var positionInfo = null;
            if (this.users[dead_uid]) {
                positionInfo = gConfPosition[this.users[dead_uid].info.position];
            } else {
                // 机器人按最低官职算
                positionInfo = gConfPosition[32];
            }

            if (positionInfo) {
                score[0] = parseInt(positionInfo.gloryRatio);
            }

            // 计算连杀附加的积分
            if (!isDroid(dead_uid)) {
                var continuousKillCount = this.users[killer_uid].countryWar.continuousKillWithoutRobot;
                if (continuousKillCount > Object.keys(gConfCountryWarKillScore).length) {
                    continuousKillCount = Object.keys(gConfCountryWarKillScore).length;
                }
                score[0] += gConfCountryWarKillScore[continuousKillCount].additionalGlory;
            }

            this.users[killer_uid].countryWar.score += score[0];
            this.users[killer_uid].countryWar.weekScore += score[0];
            this.users[killer_uid].countryWar.addScoreTime = common.getTime();

            if (!this.users[killer_uid].countryWar.scoreSinceLastDeath) {
                this.users[killer_uid].countryWar.scoreSinceLastDeath = 0;
            }
            this.users[killer_uid].countryWar.scoreSinceLastDeath += score[0];
        }

        if (this.users[dead_uid]) {
            this.users[dead_uid].countryWar.continuousKill = 0;
            this.users[dead_uid].countryWar.continuousKillWithoutRobot = 0;
            this.users[dead_uid].countryWar.deathCount += 1;

            if (!this.users[dead_uid].countryWar.weekDeathCount)
                this.users[dead_uid].countryWar.weekDeathCount = 0;
            this.users[dead_uid].countryWar.weekDeathCount += 1;
            this.users[dead_uid].countryWar.deathTime = common.getTime();

            score[1] = gConfCountryWarBase.minimumGlory.value;
            this.users[dead_uid].countryWar.score += score[1];
            this.users[dead_uid].countryWar.weekScore += score[1];
            this.users[dead_uid].countryWar.addScoreTime = common.getTime();

            if (!this.users[dead_uid].countryWar.scoreSinceLastDeath) {
                this.users[dead_uid].countryWar.scoreSinceLastDeath = 0;
            }
            this.users[dead_uid].countryWar.scoreSinceLastDeath += score[1];

            this.markDirty(dead_uid);

            var positionInfo = gConfPosition[this.users[dead_uid].info.position];
            if (positionInfo && positionInfo.pisition <= parseInt(gConfCountryWarBase.callNeedPosition.value)) {
                // 击杀的是官阶一品及以上
                var playerids = gUserInfo.getRoomPlayers(this.users[dead_uid].countrywar.roomId);
                if (playerids.length > 0) {
                    var worldReq = {
                        mod : 'countrywar',
                        act : 'kill_player',
                        uid : 1,
                        args : {
                            players : playerids,
                            city : this.users[dead_uid].countryWar.city,
                            uid : killer_uid,
                            un : this.users[killer_uid].info.un,
                            dead : dead_uid,
                            deadName : this.users[dead_uid].info.un,
                            deadCountry : this.users[dead_uid].countryWar.camp,
                            deadPosition : this.users[dead_uid].info.position,
                        },
                    };

                    var resp = {};
                    resp.code = 0;
                    gCountryWar.roomBroadcast(this.users[killer_uid].countryWar.roomId, worldReq, resp, function() {
                        if (resp.code == 0) {
                            DEBUG('request a client over kill_player');
                        } else {
                            DEBUG('request a client error, desc = ' + resp.desc);
                        }
                    });
                }
            }
        }

        return score;
    },

    addScore : function (uid, score) {
        if (!this.users[uid]) {
            return;
        }

        this.users[uid].countryWar.score += score;
        this.users[uid].countryWar.weekScore += score;
        this.users[uid].countryWar.addScoreTime = common.getTime();
        this.markDirty(uid);

        gCountryWar.updateKillRank(this.users[uid].countryWar.roomId, uid, gCountryWar.isInCountryWarOpenTime());
    },

    // 进入城池
    onEnterCity : function (uid, city_id) {
        if (!this.users[uid]) {
            return;
        }

        if (this.users[uid].countryWar.city == city_id) {
            return;
        }

        this.users[uid].countryWar.city = city_id;

        this.markDirty(uid);
    },

    // 离开城池
    onLeaveCity : function (uid) {
        if (!this.users[uid]) {
            return;
        }

        var initCity = this.getCapitalCityId(this.users[uid].countryWar.camp);
        this.users[uid].countryWar.city = initCity;
        this.markDirty(uid);
    },

    // 获取玩家国战数据
    getPlayerCountryWarInfo : function (uid) {
        return this.users[uid].countryWar;
    },

    // 获取玩家移动的目标城池id
    getPlayerTargetCity : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.targetCity;
        }

        return 0;
    },

    // 根据玩家所在国家获取都城id
    getCapitalCityId : function (country) {
        var cityId = 1;
        if (country == 1) {
            cityId = 1;
        } else if (country == 2) {
            cityId = 26;
        } else if (country == 3) {
            cityId = 51;
        }

        return cityId;
    },

    // 获取玩家所在城池
    getPlayerLocationCity : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.city;
        } else {
            var userInfo = this.getUser(uid);
            var userCountry = userInfo.countryWar.camp;    // 玩家所在国家
            return this.getCapitalCityId(userCountry);
        }
    },

    // 获取玩家击杀数
    getPlayerKillCount : function (uid, country) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.taskInfo[country].killCount;
        }

        return 0;
    },

    // 获取玩家连续击杀数
    getPlayerContinuousKill : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.continuousKill;
        }

        return 0;
    },

    // 清空连续击杀数
    clearPlayerContinuousKill : function (uid) {
        if (this.users[uid]) {
            this.users[uid].countryWar.continuousKill = 0;
            this.users[uid].countryWar.continuousKillWithoutRobot = 0;
            this.users[uid].countryWar.scoreSinceLastDeath = 0

            // 恢复血量
            for (var slot in this.users[uid].pos) {
                var hid = this.users[uid].pos[slot].hid;
                if (gConfHero[hid]) {
                    var legionType = gConfHero[hid].legionType;
                    var soldierLevel = this.users[uid].pos[slot].soldier.level;
                    var soldierStar = this.users[uid].pos[slot].soldier.star;
                    var soldierNum = gConfSoldierLevel[legionType][soldierLevel][soldierStar].num;

                    this.users[uid].countryWar.pos[slot] = {};
                    this.users[uid].countryWar.pos[slot].hp = 100;
                    this.users[uid].countryWar.pos[slot].soldierNum = soldierNum;
                }
            }

            this.markDirty(uid);
        }
    },

    clearPlayerContinuousScore : function (uid) {
        if (this.users[uid]) {
            this.users[uid].countryWar.scoreSinceLastDeath = 0
            this.markDirty(uid);
        }
    },

    // 获取玩家死亡次数
    getPlayerDeathCount : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.deathCount;
        }

        return 0;
    },

    // 获取玩家死亡时间
    getPlayerDeathTime : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.deathTime;
        }

        return 0;
    },

    // 判断玩家是否死亡
    isPlayerDead : function (uid) {
        if (!this.users[uid])
            return false;

        if (this.users[uid].countryWar.deathTime + parseInt(gConfCountryWarBase.reliveTime.value) > common.getTime())
            return true;

        return false;
    },

    // 获取玩家战斗冷却时间
    getPlayerCoolTime : function (uid) {
        if (this.users[uid]) {
            return this.users[uid].countryWar.coolTime;
        }

        return 0;
    },

    // 设置战斗冷却时间
    setPlayerCoolTime : function (uid, time) {
        if (!this.users[uid])
            return;

        this.users[uid].countryWar.coolTime = time;
        this.markDirty(uid);
    },

    // 是否在战斗冷却中
    isPlayerInCoolTime : function (uid) {
        if (!this.users[uid])
            return false;

        if (this.users[uid].countryWar.coolTime > common.getTime())
            return true;

        return false;
    },

    // 查找两座城池之间的最短路径
    getShortestPath : function (uid, start_city, end_city) {
        var pathCities = [];

        var userInfo = this.getUser(uid);
        var userCountry = userInfo.countryWar.camp;
        var cities = gCountryWar.getCities(userInfo.countryWar.roomId);

        var visited = [];   // 已经访问过的节点
        var visitQueue = [];    // 访问队列
        var nodeParent = {};    // 存储各个节点的父节点

        // 先把起始节点放入队列
        visitQueue.unshift(start_city);
        visited.push(start_city);
        nodeParent[start_city] = 0;

        var startCityInfo = cities[start_city];

        var find = false;
        while (visitQueue.length > 0) {
            var top = visitQueue.pop();

            if (!gConfCountryWarCity[top]) {
                var a = 0;
            }

            // 将top节点未访问过的相邻节点放入队列
            var neighbors = gConfCountryWarCity[top].adjoin;
            for (var i = 0; i < neighbors.length; i++) {
                var cityInfo = cities[neighbors[i]];
                if (neighbors[i] == end_city) {
                    if (top == start_city && startCityInfo.hold_camp != userCountry
                        && cityInfo.hold_camp != userCountry) {
                        // 去除起点城池不是玩家所在国家，终点城池也不是玩家所在国家，但是起点和终点相连的情况
                    } else {
                        // 找到了
                        find = true;
                        break;
                    }
                }

                if (visited.indexOf(neighbors[i]) < 0 &&
                    cityInfo.hold_camp == userCountry) {
                    visitQueue.unshift(neighbors[i]);
                    visited.push(neighbors[i]);
                    nodeParent[neighbors[i]] = top;
                }
            }

            if (find) {
                pathCities.push(end_city);
                var parent = top;
                pathCities.unshift(parent);
                while (parent != 0) {
                    parent = nodeParent[parent];

                    if (parent != 0) {
                        pathCities.unshift(parent);
                    }
                }
                break;
            }
        }

        return pathCities;
    },

    // 根据路径计算所需要的时间
    getPathTime : function (path) {
        return (path.length - 1) * parseInt(gConfCountryWarBase.pathTime.value); // 暂时先定每两座城池之间需要2秒
    },

    onPlayerDeath : function (uid) {
        if (!this.users[uid])
            return;

        // 恢复血量
        for (var slot in this.users[uid].pos) {
            var hid = this.users[uid].pos[slot].hid;
            if (gConfHero[hid]) {
                var legionType = gConfHero[hid].legionType;
                var soldierLevel = this.users[uid].pos[slot].soldier.level;
                var soldierStar = this.users[uid].pos[slot].soldier.star;
                var soldierNum = gConfSoldierLevel[legionType][soldierLevel][soldierStar].num;

                this.users[uid].countryWar.pos[slot] = {};
                this.users[uid].countryWar.pos[slot].hp = 100;
                this.users[uid].countryWar.pos[slot].soldierNum = soldierNum;
            }
        }
    },

    // 是否是都城
    isCapitalCity : function(city_id) {
        if (city_id == 1 || city_id == 26 || city_id == 51) {
            return true;
        }

        return false;
    },

    // 判断目标城池是否可达
    canReachTargetCity : function (uid, target_city) {
        var userInfo = this.getUser(uid);
        var userCountry = userInfo.countryWar.camp;
        var cities = gCountryWar.getCities(userInfo.countryWar.roomId);

        var targetCityInfo = cities[target_city];
        if (targetCityInfo.hold_camp == userCountry) {
            return true;
        } else {
            var neighborCities = gConfCountryWarCity[target_city].adjoin;

            for (var i = 0; i < neighborCities.length; i++) {
                // 检查目标城池周围有没有己方阵营占领的城池
                var cityId = neighborCities[i];
                if (cities[cityId].hold_camp == userCountry) {
                    return true;
                }
            }
        }

        return false;
    },

    // 判断目标城池是否可进入
    canEnterTargetCity : function (uid, target_city) {
        var userInfo = this.getUser(uid);
        if (!userInfo)
            return false;

        var userCountry = userInfo.countryWar.camp;
        var cityInfo = gCountryWar.getCityInfo(userInfo.countryWar.roomId, target_city, true);
        if (!cityInfo)
            return false;

        // 敌方都城不能
        var selfCapitalCity = this.getCapitalCityId(userCountry);
        if (this.isCapitalCity(target_city) && target_city != selfCapitalCity) {
            return false;
        }

        return true;
    },

    // 获取玩家到达目标城池的时间
    getPlayerReachTime : function (uid, target_city) {
        if (target_city) {
            if (this.users[uid].countryWar.city == target_city) {
                return 0;   // 已经在目标城池了
            }

            if (!this.canReachTargetCity(uid, target_city)) {
                return 9999999;
            }

            var startCity = this.getPlayerLocationCity(uid);
            var path = this.getShortestPath(+startCity, target_city);
            return this.getPathTime(path);
        }

        if (this.users[uid]) {
            return this.users[uid].countryWar.reachTime;
        }

        return 0;
    },

    // 设置目标城池和到达时间
    setTargetCityAndTime : function (uid, target_city, move_time) {
        if (!this.users[uid]) {
            return;
        }

        this.users[uid].countryWar.targetCity = target_city;
        this.users[uid].countryWar.reachTime = common.getTime() + move_time;
        this.markDirty(uid);
    },

    // 离开国战
    onPlayerLeave : function (uid) {
        if (!this.users[uid]) {
            return;
        }
        this.users[uid].countryWar.leave = true;
        this.markDirty(uid);
    },

    // 玩家做操作的时候默认为在国战里面，以免因为长连接断开导致在线人数统计出问题
    onUserAct : function (uid) {
        if (!this.users[uid]) {
            return false;
        }

        if (this.users[uid].countryWar.leave == true) {
            this.users[uid].countryWar.leave = false;
            return true;
        }

        return false;
    },

    // 获取指定国家所有在线的玩家
    getAllPlayers : function (camp) {
        var players = [];
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (!userInfo.countryWar.leave && userInfo.countryWar.camp == camp) {
                players.push(uid);
            }
        }

        return players;
    },

    // 获取所有在国战里面的玩家
    getAllPlayersInCountryWar : function () {
        var players = [];
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (!userInfo.countryWar.leave) {
                players.push(uid);
            }
        }

        return players;
    },

    getCampPlayers : function (roomId, camp) {
        var players = [];
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (!userInfo.countryWar.leave && userInfo.countryWar.roomId == roomId && userInfo.countryWar.camp == camp) {
                players.push(uid);
            }
        }

        return players;
    },

    getRoomPlayers : function (roomId) {
        var players = [];
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (userInfo && userInfo.countryWar && !userInfo.countryWar.leave && userInfo.countryWar.roomId == roomId) {
                players.push(uid);
            }
        }

        return players;
    },

    getRoomPlayersExceptCity : function (roomId, cityId) {
        var players = [];
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (userInfo && userInfo.countryWar && !userInfo.countryWar.leave &&
                userInfo.countryWar.roomId == roomId && userInfo.countryWar.city != cityId) {
                players.push(uid);
            }
        }

        return players;
    },

    // 快速复活
    fastRelive : function (uid) {
        if (!this.users[uid]) {
            return;
        }
        this.users[uid].countryWar.deathTime = 0;
        this.users[uid].countryWar.fastReliveCount += 1;
        this.markDirty(uid);
    },

    // 更新英雄血量和小兵数
    updateHeroHpAndSoldierNum : function (uid, pos) {
        if (!this.users[uid]) {
            return;
        }

        for (var slot in pos) {
            if (!this.users[uid].countryWar.pos[slot]) {
                this.users[uid].countryWar.pos[slot] = {};
            }
            this.users[uid].countryWar.pos[slot].hp = pos[slot].hp;
            this.users[uid].countryWar.pos[slot].soldierNum = pos[slot].soldierNum;
        }

        this.markDirty(uid);
    },

    // 发布集结令
    onBroadcastCallOfDuty : function (uid) {
        this.users[uid].countryWar.callCount += 1;
        this.markDirty(uid);
    },

    getBroadcastCallCount : function (uid) {
        if (this.users[uid])
            return this.users[uid].countryWar.callCount;

        return 0;
    },

    // 响应集结令
    onReplyCallOfDuty : function (uid) {
        this.users[uid].countryWar.replyCallCount += 1;
        this.markDirty(uid);
    },

    // 城池被攻陷回调
    onCityCaptured : function (uid, city_id, old_country) {
        this.users[uid].countryWar.taskInfo[old_country].conqueredCity += 1;
        this.markDirty(uid);
    },

    clear : function () {
        gDBUser.remove({}, function () {

        });
        this.updates = {};
    },

    onResetByWeek : function () {
        // 踢掉所有玩家
        var playerIds = [];
        for (var uid in this.users) {
            if (this.users[uid] && this.users[uid].territoryWar) {
                if (!this.users[uid].territoryWar.leave) {
                    playerIds.push(uid);
                }
            }

            delete this.users[uid];
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'countrywar',
                act : 'kick_player',
                uid : uid,
                args : {
                    players : playerIds,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            gCountryWar.broadcastToAllWorld(WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('countrywar onResetByWeek to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('countrywar onResetByWeek to world failed!' + WorldResp.desc);
                }
            });
        }

        // 清除所有玩家
        this.clear();
    },

    // 重置玩家国战数据
    resetCountryWar : function (week) {
        if (week) {
            this.onResetByWeek();
        } else {
            for (var uid in this.users) {
                var userInfo = this.users[uid];
                if (!userInfo.countryWar)
                    continue;

                // 回到都城
                userInfo.countryWar.city = 0;
                userInfo.countryWar.init = false;

                if (!userInfo.countryWar.taskInfo) {
                    userInfo.countryWar.taskInfo = {};
                    for (var i = 1; i <= 3; i++) {
                        userInfo.countryWar.taskInfo[i] = {};
                    }
                }
                for (var i = 1; i <= 3; i++) {
                    userInfo.countryWar.taskInfo[i].killCount = 0;
                    userInfo.countryWar.taskInfo[i].conqueredCity = 0;
                }
                userInfo.countryWar.continuousKill = 0;
                userInfo.countryWar.continuousKillWithoutRobot = 0;
                userInfo.countryWar.highestKillCount = 0;
                userInfo.countryWar.deathCount = 0;
                userInfo.countryWar.deathTime = 0;
                userInfo.countryWar.coolTime = 0;
                userInfo.countryWar.targetCity = 0;
                userInfo.countryWar.reachTime = 0;
                userInfo.countryWar.score = 0;
                userInfo.countryWar.dayKillCount = 0;

                userInfo.countryWar.callCount = 0;
                userInfo.countryWar.replyCallCount = 0;
                userInfo.countryWar.fastReliveCount = 0;
                userInfo.countryWar.buyGoodsCount = 0;
                userInfo.countryWar.pos = {};

                for (var slot in userInfo.countryWar.pos) {
                    userInfo.countryWar.pos[slot].hp = 100;

                    var hid = userInfo.pos[slot].hid;
                    var legionType = gConfHero[hid].legionType;
                    var soldierLevel = userInfo.pos[slot].soldier.level;
                    var soldierStar = this.users[uid].pos[slot].soldier.star;
                    var soldierNum = gConfSoldierLevel[legionType][soldierLevel][soldierStar].num;

                    userInfo.countryWar.pos[slot].soldierNum = soldierNum;
                }

                userInfo.countryWar.personalTaskAwardGot = [];
                userInfo.countryWar.countryTaskAwardGot = [];

                this.markDirty(uid);
            }
        }
    },

    // 判断个人任务是否完成
    isTaskFinish : function (uid, task_id) {
        if (!this.users[uid]) {
            return false;
        }

        var taskData = gConfCountryWarTaskPersonal[task_id];
        if (!taskData) {
            return false;
        }

        var userCountry = this.users[uid].countryWar.camp;
        var targetCountry = taskData.countryType;
        if (userCountry == targetCountry) {
            return false;
        }

        var targetValue = taskData.condition;
        var eventType = taskData.event;
        if (eventType == 'killCount') {// 击败敌方玩家数量
            if (this.users[uid].countryWar.taskInfo[targetCountry].killCount >= targetValue) {
                return true;
            }
        } else if (eventType == 'callCount') {// 发布集结令的次数
            if (this.users[uid].countryWar.callCount >= targetValue) {
                return true;
            }
        } else if (eventType == 'replyCallCount') {// 响应集结令次数
            if (this.users[uid].countryWar.replyCallCount >= targetValue) {
                return true;
            }
        } else if (eventType == 'conqueredCityCount') {// 夺下敌方城池次数
            if (this.users[uid].countryWar.taskInfo[targetCountry].conqueredCity >= targetValue) {
                return true;
            }
        } else if (eventType == 'fastReliveCount') {// 快速复活次数
            if (this.users[uid].countryWar.fastReliveCount >= targetValue) {
                return true;
            }
        } else if (eventType == 'buyGoodsCount') {// 购买物资次数
            if (this.users[uid].countryWar.buyGoodsCount >= targetValue) {
                return true;
            }
        }

        return false;
    },

    // 判断国家任务是否完成
    isCountryTaskFinish : function (serverId, task_type, task_id) {
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);
        return gCountryWar.isCountryTaskFinish(roomId, camp, task_type, task_id);
    },

    // 判断个人任务奖励是否已领取
    isPersonalTaskAwardGot : function (uid, task_id) {
        if (this.users[uid].countryWar.personalTaskAwardGot.indexOf(task_id) < 0) {
            return false;
        }

        return true;
    },

    // 设置个人任务奖励领取
    setPersonalTaskAwardGot : function (uid, task_id) {
        this.users[uid].countryWar.personalTaskAwardGot.push(task_id);
        this.markDirty(uid);
    },

    // 判断国家任务奖励是否已领取
    isCountryTaskAwardGot : function (uid, task_type, task_id) {
        if (!this.users[uid])
            return false;

        if (this.users[uid].countryWar.countryTaskAwardGot.indexOf(task_type) < 0) {
            return false;
        }

        return true;
    },

    // 判断是否有可领取的任务奖励
    hasPersonalTaskAwards : function (uid) {
        if (!this.users[uid])
            return false;

        for (var id in gConfCountryWarTaskPersonal) {
            var taskInfo = gConfCountryWarTaskPersonal[id];
            if (taskInfo) {
                if (this.isTaskFinish(uid, parseInt(id)) && !this.isPersonalTaskAwardGot(uid, parseInt(id))) {
                    return true;
                }
            }
        }

        return false;
    },

    hasCountryTaskAwards : function (uid, serverId) {
        for (var type in gConfCountryWarTask) {
            var taskList = gConfCountryWarTask[type];
            if (taskList) {
                for (var index in taskList) {
                    var taskInfo = taskList[index];
                    if (taskInfo) {
                        if (this.isCountryTaskFinish(serverId, parseInt(type), parseInt(index)) &&
                            !this.isCountryTaskAwardGot(uid, parseInt(type), parseInt(index))) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    },

    // 设置国家任务奖励领取
    setCountryTaskAwardGot : function (uid, task_type, task_id) {
        this.users[uid].countryWar.countryTaskAwardGot.push(task_type);
        this.markDirty(uid);
    },

    getPlayerCount : function (scoreList) {
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (!userInfo.countryWar.leave) {
                scoreList[userInfo.countryWar.camp].playerCount += 1;
            }
        }
    },

    // 清理数据
    clear : function () {
        gDBUser.remove({}, function () {

        });

        this.updates = {};
    },

    // 计算玩家本周积分总和
    getTotalScore : function () {
        var retScore = 0;
        for (var uid in this.users) {
            var user = this.users[uid];
            retScore += user.countryWar.weekScore;
        }

        return retScore;
    },

    // 获取玩家积分列表
    getPlayerScoreList : function () {
        var scoreList = {};
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user.countryWar.weekScore > 0) {
                var scoreObj = {};
                scoreObj.uid = uid;
                scoreObj.score = user.countryWar.weekScore;
                scoreList[uid] = scoreObj;
            }
        }

        return scoreList;
    },
}

exports.login = function(req, res, resp) {
    var tips = {
        /*
         personalTaskAwards: 0,
         campTaskAwards: 0,
         */
    };

    var uid = +req.uid;
    var serverId = req.args.serverId;

    if (gUserInfo.hasPersonalTaskAwards(uid))
        tips['personalTaskAwards'] = 1;

    if (gUserInfo.hasCountryTaskAwards(uid, serverId))
        tips['campTaskAwards'] = 1;

    resp.data.tips = tips;

    onReqHandled(res, resp, 1);
};

exports.UserInfo = UserInfo;
