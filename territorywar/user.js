require ('../global')

var ErrorCode = require('./error.js').ErrorCode;

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
            sky_suit : {
                weapon_illusion: 0,
                wing_illusion: 0,
            },
            fight_force : 0,

            territoryWar : {
                lid : 0,    // 玩家所在军团id

                pos : {     // 玩家当前所在位置
                    lid : 0,, // 军团领地id
                    cellId : 0,
                }

                stayingPower : 0,  // 耐力
                stayingPowerTime : 0,   // 上一次恢复耐力的时间

                leave : 0,      // 是否离开领地战

                transferCount : 0,  // 今日传送次数

                // 访问的矿堆数量
                visitedMineCount : [],

                dragonScaleCount : 0,   // 龙鳞数量
                consumeEnemyStayingPower : 0,   // 消耗敌方耐力值

                // 遗迹列表
                relic = {
                    id : {  // 遗迹id
                        num : 0,    // 遗迹数量
                        exploreTime : 0,    // 已探索时间
                        endTime : 0,    // 探索结束时间（0表示未开始）
                    },
                }

                killCount : 0,  // 击杀数
                robCount : 0,   // 掠夺次数
                exploreCount : 0,   // 探索次数

                killPuppetTotalCount : 0,    // 傀儡累计击杀数

                // 访问过的资源列表
                visitedResList : {
                    self : {    // 自己领地的
                        cellId : {  // 资源所在格子id
                            param : 100,    // 怪物剩余耐力
                        },
                    },
                    enemy1 : {  // 敌方1领地的

                    },
                    enemy2 : {  // 敌方2领地的

                    },
                },

                // 成就领奖记录
                achievementAwardGetRecord : {
                    101 : [],
                },

                // 访问过的本军团关隘（访问过才能传送）
                visitedCity : [];

                dragon = [],

                // booss挑战
                boss : {
                    self : {
                        challengeCount : 0, // 挑战次数
                    },
                    enemy1 : {},
                    enemy2 : {},
                }
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
                this.users[item._id] = item;
                if (!item.sky_suit) {
                    item.sky_suit = {
                        weapon_illusion: 0,
                        wing_illusion: 0,
                    };
                }

                if (!item.custom_king) {
                    item.custom_king = {
                       // chapter: 0,
                        index: 1,
                    }
                }
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    getUser : function(uid) {
        return this.users[uid];
    },

    // 删除一个玩家
    removeUser : function (uid) {
        var removeIds = [uid];
        gDBUser.remove({_id : {"$in" : removeIds }}, function (err, count) {
            if (err) {
                ERROR(err);
            } else {
                DEBUG('remove user ' + uid);
                delete this.users[uid];
            }
        }.bind(this));
    },

    // 删除指定军团的玩家
    removeLegionMembers : function (lid) {
        var removeIds = [];
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user.territoryWar.lid == lid) {
                removeIds.push(user._id);
            }
        }

        gDBUser.remove({_id : {"$in" : removeIds }}, function (err, count) {
            if (err) {
                ERROR(err);
            } else {
                DEBUG('remove user by lid ' + lid);
                for (var i = 0; i < removeIds.length; i++) {
                    delete this.users[removeIds[i]];
                }
            }
        }.bind(this));
    },

    getUserFightInfo : function(uid, notUseDefPos, useWorldWarTeam) {
        var info = {};
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        // 当玩家处于自己领地的关隘上时，附加城池加成
        var param = [0];
        if (user.territoryWar.pos.lid == user.territoryWar.lid) {
            var cellId = user.territoryWar.pos.cellId;
            if (cellId == parseInt(gConfTerritoryWarBase.jianmenguanPos.value) ||
                cellId == parseInt(gConfTerritoryWarBase.jiayuguanPos.value) ||
                cellId == parseInt(gConfTerritoryWarBase.hulaoguanPos.value) ||
                cellId == parseInt(gConfTerritoryWarBase.initialPos.value)) {
                param = this.getBuildingParam(uid, 'defendLose');
            }
        }

        info.stayingPower       = user.territoryWar.stayingPower;
        info.uid                = uid;
        info.name               = user.info.un;
        info.pos                = user.pos;
        info.weapon_illusion    = user.sky_suit.weapon_illusion;
        info.wing_illusion      = user.sky_suit.wing_illusion;
        info.mount_illusion     = user.sky_suit.mount_illusion;
        info.custom_king        = user.custom_king;
        
        // 龙的等级
        info.dragon             = {};
        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i] = user.dragon[i].level;
            }
        }

        var fightForce          = 0;

        if (user.fight_force) 
        {
            fightForce          = user.fight_force;
        }
        else{
            for (var p in user.pos) {
                fightForce += user.pos[p].fight_force;
            }
        }

        info.fight_force        = fightForce;
        info.skills             = clone(user.skills);

        var defInfo             = user.def_info;

        if (!notUseDefPos && defInfo && defInfo.set) {
            
            if (defInfo.skills && defInfo.team)
            {
                for (var slot in defInfo.skills) 
                {
                    info.skills[slot].id = defInfo.skills[slot];
                }

                var checkSucc       = true;

                for (var hid in defInfo.team) 
                {
                    if(!info.pos[hid])
                    {
                        checkSucc   = false;
                    }
                }

                if (checkSucc)
                {
                    for (var hid in defInfo.team)
                    {    
                        info.pos[hid].slot = defInfo.team[hid];
                    }
                }
            }
        }

        return info;
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

    getEmptyTerritoryWar : function () {
        var territoryWar = {};

        // 记录玩家所在军团
        territoryWar.lid = 0;

        // 玩家位置
        territoryWar.pos = {};
        territoryWar.pos.lid = 0;
        territoryWar.pos.cellId = 0;

        territoryWar.stayingPower = 0;
        territoryWar.stayingPowerTime = common.getTime();

        // 是否离开领地战
        territoryWar.leave = 0;

        // 今日传送次数
        territoryWar.transferCount = 0;

        // 访问矿堆的数量
        territoryWar.visitedMineCount = [];
        for (var i = 0; i < 5; i++) {
            territoryWar.visitedMineCount[i] = 0;
        }

        // 龙鳞数量
        territoryWar.dragonScaleCount = 0;

        // 遗迹列表
        territoryWar.relic = {};

        // 击杀玩家数量
        territoryWar.killCount = 0;

        // 掠夺次数
        territoryWar.robCount = 0;

        // 探索次数
        territoryWar.exploreCount = 0;

        // 击杀傀儡数量
        territoryWar.killPuppetTotalCount = 0;
        territoryWar.challengePuppetCash = 0;

        // 访问过的资源列表
        territoryWar.visitedResList = {};
        territoryWar.visitedResList.self = {};
        territoryWar.visitedResList.enemy1 = {};
        territoryWar.visitedResList.enemy2 = {};

        // 成就领奖记录
        territoryWar.achievementAwardGetRecord = {};

        // 访问过的本军团关隘
        territoryWar.visitedCity = [];

        // 访问过的石碑数
        territoryWar.visitedStoneSteleCount = 0;

        // 累计损耗玩家的耐力值
        territoryWar.consumeEnemyStayingPower = 0;

        territoryWar.dragon = [];

        territoryWar.buildings = {};

        this.initBossInfo(territoryWar);

        return territoryWar;
    },

    initBossInfo : function (territoryWar) {
        if (territoryWar) {
            territoryWar.boss = {};
            territoryWar.boss.self = {};
            territoryWar.boss.self.challengeCount = 0;
            territoryWar.boss.enemy1 = {};
            territoryWar.boss.enemy1.challengeCount = 0;
            territoryWar.boss.enemy2 = {};
            territoryWar.boss.enemy2.challengeCount = 0;
        }
    },

    // 获取boss积分
    getBossScore : function (uid, lid) {
        var user = this.getUser(uid);
        if (!user) {
            return 0;
        }

        if (lid == user.territoryWar.lid) {
            return user.territoryWar.boss.self.score;
        }

        var enemies = gTerritoryWar.getEnemy(user.territoryWar.lid);
        if (enemies.length == 0) {
            return 0;
        }

        var enemyIndex = 0;
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i] == lid) {
                enemyIndex = i + 1;
            }
        }

        if (enemyIndex == 0) {
            return 0;
        }

        return user.territoryWar.boss['enemy' + enemyIndex].score;
    },

    // 获取boss挑战次数
    getBossChallengeCount : function (uid, lid) {
        var user = this.getUser(uid);
        if (!user) {
            return 0;
        }

        if (lid == user.territoryWar.lid) {
            return user.territoryWar.boss.self.challengeCount;
        }

        var enemies = gTerritoryWar.getEnemy(user.territoryWar.lid);
        if (enemies.length == 0) {
            return 0;
        }

        var enemyIndex = 0;
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i] == lid) {
                enemyIndex = i + 1;
            }
        }

        if (enemyIndex == 0) {
            return 0;
        }

        return user.territoryWar.boss['enemy' + enemyIndex].challengeCount;
    },

    updateBossChallengeCount : function (uid, isSelf, enemyIndex) {
        var user = this.getUser(uid);
        if (!user) {
            return;
        }

        if (isSelf) {
            user.territoryWar.boss.self.challengeCount += 1;
        } else {
            user.territoryWar.boss['enemy' + enemyIndex].challengeCount += 1;
        }
    },

    update : function(uid, lid, updates, dragon, buildings) {
        var curTime = common.getTime();
        var awards = null;
        var userInfo = this.users[uid];
        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;

            // 初始化玩家的领地战信息
            if (!this.users[uid].territoryWar) {
                this.users[uid].territoryWar = {};

                // 记录玩家所在军团
                this.users[uid].territoryWar.lid = lid;

                // 玩家位置
                this.users[uid].territoryWar.pos = {};
                this.users[uid].territoryWar.pos.lid = lid;
                this.users[uid].territoryWar.pos.cellId = parseInt(gConfTerritoryWarBase.initialPos.value);

                this.users[uid].territoryWar.stayingPower = updates.status.staying_power;
                this.users[uid].territoryWar.stayingPowerTime = curTime;

                // 是否离开领地战
                this.users[uid].territoryWar.leave = 0;

                // 今日传送次数
                this.users[uid].territoryWar.transferCount = 0;

                // 访问矿堆的数量
                this.users[uid].territoryWar.visitedMineCount = [];
                for (var i = 0; i < 5; i++) {
                    this.users[uid].territoryWar.visitedMineCount[i] = 0;
                }

                // 龙鳞数量
                this.users[uid].territoryWar.dragonScaleCount = 0;

                // 遗迹列表
                this.users[uid].territoryWar.relic = {};

                // 击杀玩家数量
                this.users[uid].territoryWar.killCount = 0;

                // 掠夺次数
                this.users[uid].territoryWar.robCount = 0;

                // 探索次数
                this.users[uid].territoryWar.exploreCount = 0;

                // 击杀傀儡数量
                this.users[uid].territoryWar.killPuppetTotalCount = 0;
                this.users[uid].territoryWar.challengePuppetCash = 0;

                // 访问过的资源列表
                this.users[uid].territoryWar.visitedResList = {};
                this.users[uid].territoryWar.visitedResList.self = {};
                this.users[uid].territoryWar.visitedResList.enemy1 = {};
                this.users[uid].territoryWar.visitedResList.enemy2 = {};

                // 成就领奖记录
                this.users[uid].territoryWar.achievementAwardGetRecord = {};

                // 访问过的本军团关隘
                this.users[uid].territoryWar.visitedCity = [];

                // 访问过的石碑数
                this.users[uid].territoryWar.visitedStoneSteleCount = 0;

                // 累计损耗玩家的耐力值
                this.users[uid].territoryWar.consumeEnemyStayingPower = 0;

                this.users[uid].territoryWar.dragon = [];
                for (var i = 0; i < 13; i++) {
                    this.users[uid].territoryWar.dragon.push(0);
                }

                if (dragon) {
                    for (var id in dragon) {
                        this.users[uid].territoryWar.dragon[id] = dragon[id].level;
                    }
                }

                this.users[uid].territoryWar.buildings = buildings;

                this.initBossInfo(this.users[uid].territoryWar);
            }

            this.markDirty(uid);
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

        var fightForce = 0;
        for (var p in userInfo.pos) {
            if (userInfo.pos[p].hid) {
                fightForce += userInfo.pos[p].fight_force;
            }
        }

        if (updated) {
            userInfo.fight_force = 0;
        }

        for (var i = 0; i < 5; i++) {
            if (this.users[uid].territoryWar.visitedMineCount[i] == null) {
                this.users[uid].territoryWar.visitedMineCount.splice(i,1);
            }
        }


        if (dragon) {
            if (!this.users[uid].territoryWar.dragon) {
                this.users[uid].territoryWar.dragon = [];
                for (var i = 0; i < 13; i++) {
                    this.users[uid].territoryWar.dragon.push(0);
                }
            }

            for (var id in dragon) {
                this.users[uid].territoryWar.dragon[id] = dragon[id].level;
            }
        }

        // 玩家换了军团，导致之前存的军团id不能用了
        if (this.users[uid].territoryWar.lid != lid) {
            this.users[uid].territoryWar.lid = lid;
            this.users[uid].territoryWar.pos.lid = lid;
            this.users[uid].territoryWar.pos.cellId = parseInt(gConfTerritoryWarBase.initialPos.value);
        }

        if (buildings) {
            this.users[uid].territoryWar.buildings = buildings;
        }

        if (!this.users[uid].territoryWar.achievementAwardGetRecord) {
            this.users[uid].territoryWar.achievementAwardGetRecord = {};
        }

        if (!this.users[uid].territoryWar.consumeEnemyStayingPower) {
            this.users[uid].territoryWar.consumeEnemyStayingPower = 0;
        }

        if (!this.users[uid].territoryWar.boss) {
            this.initBossInfo(this.users[uid].territoryWar);
        }

        // 刷新耐力
        this.getStayingPower(uid, curTime);

        this.users[uid].territoryWar.leave = 0;

        // 玩家登陆的时候获取进入领地中的时候处理一下遗迹
        this.processUserRelic(uid, curTime);

        userInfo.fight_force = fightForce;
        this.markDirty(uid);
        return awards;
    },

    clear : function () {
        gDBUser.remove({}, function () {

        });
        this.updates = {};
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
                //LOG('save user finish');
                loader.onLoad(1);
            }.bind(this));
        }
        this.updates = {};
        loader.onLoad('empty');
        INFO('=====user save finish=======');
    },

    tick : function () {
        this.processRelic();
    },

    // 获取玩家耐力
    getStayingPower : function (uid, now) {
        var user = this.getUser(uid);
        if (!user)
        {
            DEBUG('getStayingPower user not found');
            return 0;
        }

        if (!user.territoryWar.stayingPowerTime) {
            user.territoryWar.stayingPowerTime = now;
        }

        var powerMax = parseInt(gConfTerritoryWarBase.enduranceLimit.value);
        if (!user.territoryWar.stayingPower) {
            if (user.status.staying_power)
                user.territoryWar.stayingPower = user.status.staying_power;
            else
            {
                user.territoryWar.stayingPower = powerMax;
                user.territoryWar.stayingPowerTime = now;
            }
        }

        var param = this.getBuildingParam(uid, 'enduranceRecoverRate');
        var powerTime = user.territoryWar.stayingPowerTime;
        var powerInterval = parseInt(gConfTerritoryWarBase.enduranceRecoverInterval.value);
        powerInterval = Math.floor(powerInterval * (1 - param[0]/100));

        if (user.territoryWar.stayingPower >= powerMax) {
            user.territoryWar.stayingPower = powerMax;
            user.territoryWar.stayingPowerTime = now;
            this.markDirty(uid);
            return user.territoryWar.stayingPower;
        }

        if (now - powerTime < powerInterval) {
            return user.territoryWar.stayingPower;
        }

        var gotPower = Math.floor((now - powerTime)/powerInterval);
        if(user.territoryWar.stayingPower + gotPower > powerMax) {
            gotPower = powerMax - user.territoryWar.stayingPower;
            powerTime = now;
        } else {
            powerTime = powerTime + gotPower * powerInterval;
        }

        user.territoryWar.stayingPower += gotPower;
        user.territoryWar.stayingPowerTime = powerTime;
        this.markDirty(uid);

        return user.territoryWar.stayingPower;
    },

    cullStayingPower : function (val) {
        var new_val = val;
        var powerMax = parseInt(gConfTerritoryWarBase.enduranceLimit.value);
        if (new_val > powerMax) {
            new_val = powerMax;
        }

        if (new_val < 0) {
            new_val = 0;
        }

        return new_val;
    },

    // 增加耐力
    addStayingPower : function (uid, add_value) {
        if (!this.users[uid])
            return;

        this.getStayingPower(uid, common.getTime());
        this.users[uid].territoryWar.stayingPower += add_value;
        this.users[uid].territoryWar.stayingPower = this.cullStayingPower(this.users[uid].territoryWar.stayingPower);
        this.markDirty(uid);

        gTerritoryWar.notifyPlayerStayingPowerChange(this.users[uid].territoryWar.pos.lid, uid, this.users[uid].territoryWar.stayingPower);
    },

    // 消耗耐力
    decStayingPower : function (uid, dec_value) {
        if (!this.users[uid])
            return 0;

        this.getStayingPower(uid, common.getTime());
        this.users[uid].territoryWar.stayingPower -= dec_value;
        this.users[uid].territoryWar.stayingPower = this.cullStayingPower(this.users[uid].territoryWar.stayingPower);
        this.markDirty(uid);

        gTerritoryWar.notifyPlayerStayingPowerChange(this.users[uid].territoryWar.pos.lid, uid, this.users[uid].territoryWar.stayingPower);

        return this.users[uid].territoryWar.stayingPower;
    },

    markDirty : function(uid) {
        this.updates[uid] = 1;
    },

    // 玩家离开领地战
    onPlayerLeave : function (uid) {
        if (!this.users[uid])
            return;

        this.users[uid].territoryWar.leave = 1;
        this.markDirty(uid);

        gTerritoryWar.onPlayerLeaveTerritoryWar(uid);
    },

    // 是否在领地战里面
    isPlayerLeave : function (uid) {
        return this.users.territoryWar.leave;
    },

    // 玩家领取成就奖励回调
    onPlayerGetAchievementAward : function (uid, achievementType, achievementId, level) {
        if (!this.users[uid])
            return;

        var achievementInfo = gConfTerritoryWarAchievement[achievementType][achievementId];
        if (!achievementInfo) {
            return null;
        }

        if (!this.users[uid].territoryWar.achievementAwardGetRecord[achievementType]) {
            this.users[uid].territoryWar.achievementAwardGetRecord[achievementType] = [];
        }

        if (this.users[uid].territoryWar.achievementAwardGetRecord[achievementType].indexOf(achievementId) < 0) {
            this.users[uid].territoryWar.achievementAwardGetRecord[achievementType].push(achievementId)
        }

        var awardIndex = 0;
        var levels = gConfTerritoryWarAchievementType[achievementType].level;
        for (var i = levels.length - 1; i >= 0 ; i--) {
            if (level >= levels[i]) {
                awardIndex = i;
                break;
            }
        }

        this.markDirty(uid);

        var awardId = achievementInfo.awardId[awardIndex];
        return gConfTerritoryWarAchievementAwards[awardId].award;
    },

    // 判断指定成就奖励是否已领取
    isAchievementAwardGot : function (uid, achievementType, achievementId) {
        if (!this.users[uid])
            return false;

        if (!this.users[uid].territoryWar.achievementAwardGetRecord[achievementType]) {
            return false;
        }

        if (this.users[uid].territoryWar.achievementAwardGetRecord[achievementType].indexOf(achievementId) < 0) {
            return false;
        }

        return true;
    },

    // 判断成就是否达成
    isAchievementFinish : function (uid, achievementType, achievementId) {
        var achievementInfo = gConfTerritoryWarAchievement[achievementType][achievementId];
        if (!achievementInfo) {
            return false;
        }

        var userInfo = this.getUser(uid);
        if (!userInfo) {
            return false;
        }

        var targetValue = achievementInfo.target;
        switch (achievementType) {
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_1:{// 【军团】累计访问%s个石碑
                var curVal = gTerritoryWar.getVisitSteleCount(userInfo.territoryWar.lid);
                if (curVal < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_2:{// 【个人】累计获取%s片龙鳞
                if (userInfo.territoryWar.dragonScaleCount < targetValue) {
                    return false;
                }

            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_3:{// 【个人】累计损耗玩家%s点耐力
                if (userInfo.territoryWar.consumeEnemyStayingPower < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_4:{// 累计拾取龙晶石堆%s个
                if (userInfo.territoryWar.visitedMineCount[0] < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_5:{// 累计拾取龙栖木堆%s个
                if (userInfo.territoryWar.visitedMineCount[1] < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_6:{// 累计拾取龙玄锭堆%s个
                if (userInfo.territoryWar.visitedMineCount[2] < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_7:{// 累计拾取龙岗岩堆%s个
                if (userInfo.territoryWar.visitedMineCount[3] < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_8:{// 累计拾取龙泉泪堆%s个
                if (userInfo.territoryWar.visitedMineCount[4] < targetValue) {
                    return false;
                }
            } break;
            case TerritoryAchievementType.ACHIEVEMENT_TYPE_9:{// 击溃%s个傀儡
                if (userInfo.territoryWar.killPuppetTotalCount < targetValue) {
                    return false;
                }
            } break;
        }

        return true;
    },

    // 更新玩家消耗对方的耐力值
    updateConsumeEnemyStayingPower : function (uid, value) {
        if (!this.users[uid])
            return;

        this.users[uid].territoryWar.consumeEnemyStayingPower += value;
        if (this.users[uid].territoryWar.consumeEnemyStayingPower < 0) {
            this.users[uid].territoryWar.consumeEnemyStayingPower = 0;
        }
        this.markDirty(uid);
    },

    onPlayerGoBack : function (uid, transferId) {
        if (!this.users[uid])
            return;

        if (gConfTerritoryWarTransfer[transferId].cost)
            this.users[uid].territoryWar.transferCount += 1;
    },

    getPlayerGoBackCount : function (uid) {
        return this.users[uid].territoryWar.transferCount;
    },

    // 击杀玩家回调
    onKillPlayer : function (killer) {
        if (!this.users[killer])
            return;

        this.users[killer].territoryWar.killCount += 1;
        this.markDirty(killer);
    },

    // 获取击杀玩家数
    getKillPlayerCount : function (uid) {
        return this.users[uid].territoryWar.killCount;
    },

    // 判断指定资源是否访问过
    isResVisited : function (uid, lid, cellId) {
        if (!this.users[uid])
            return;

        var myLid = this.users[uid].territoryWar.lid;
        if (lid == myLid) {
            if (this.users[uid].visitedResList.self[cellId]) {
                return true;
            }
        } else {
            var enemies = gTerritoryWar.getEnemy(myLid);
            for (var i = 0; i < enemies.length; i++) {
                if (lid == enemies[i]) {
                    var enemyIndex = i + 1;
                    if (this.users[uid].visitedResList['enemy' + enemyIndex][cellId]) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    // 访问关隘回调
    onVisitCity : function (uid, cellId) {
        if (!this.users[uid])
            return;

        if (this.users[uid].territoryWar.visitedCity.indexOf(cellId) < 0) {
            this.users[uid].territoryWar.visitedCity.push(cellId);
        }
        this.markDirty(uid);
    },

    // 判断关隘是否访问过
    isCityVisited : function (uid, cellId) {
        if (!this.users[uid])
            return false;

        if (cellId == parseInt(gConfTerritoryWarBase.initialPos.value)) {
            return true;
        }

        if (this.users[uid].territoryWar.visitedCity.indexOf(cellId) < 0) {
            return false;
        }

        return true;
    },

    // 更新傀儡击杀数
    updateKillPuppetTotalCount : function (uid, addNum) {
        if (!this.users[uid])
            return;

        this.users[uid].territoryWar.killPuppetTotalCount += addNum;
        this.markDirty(uid);
    },

    // 获取傀儡击杀数
    getKillPuppetTotalCount : function (uid) {
        if (!this.users[uid])
            return 0;

        return this.users[uid].territoryWar.killPuppetTotalCount;
    },

    // 增加遗迹
    addRelic : function (uid, relicId) {
        if (!this.users[uid])
            return;

        if (!this.users[uid].territoryWar.relic[relicId]) {
            this.users[uid].territoryWar.relic[relicId] = {};
            this.users[uid].territoryWar.relic[relicId].num = 1;
            this.users[uid].territoryWar.relic[relicId].endTime = 0;
            this.users[uid].territoryWar.relic[relicId].exploreTime = 0;
        } else {
            this.users[uid].territoryWar.relic[relicId].num += 1;
        }

        this.markDirty(uid);
    },

    // 开始探索遗迹
    startExploreRelic : function (uid, relicId) {
        if (!this.users[uid])
            return 1;

        if (!this.users[uid].territoryWar.relic[relicId]) {
            return ErrorCode.ERROR_CAN_NOT_FIND_RELIC;
        }

        if (this.users[uid].territoryWar.relic[relicId].num <= 0) {
            return ErrorCode.ERROR_RELIC_NUM_NOT_ENOUGH;
        }

        if (this.users[uid].territoryWar.relic[relicId].endTime != 0) {
            return ErrorCode.ERROR_RELIC_IS_ALREADY_STARTED;
        }

        var param = this.getBuildingParam(uid, 'relicExploreTime');
        var remainTime = gConfTerritoryWarRelic[relicId].time * 3600 - this.users[uid].territoryWar.relic[relicId].exploreTime;
        var remainTime = Math.floor(remainTime * (1 + param[0]/100));
        this.users[uid].territoryWar.relic[relicId].endTime = common.getTime() + remainTime;

        return 0;
    },

    // 获取遗迹信息
    getRelicInfo : function (uid, relicId) {
        if (!this.users[uid])
            return {};

        return this.users[uid].territoryWar.relic[relicId];
    },

    // 获取正在探索的遗迹数量
    getExploreCount : function (uid) {
        if (!this.users[uid])
            return 0;

        var relicList = this.users[uid].territoryWar.relic;
        var count = 0;
        for (var rid in relicList) {
            var relicInfo = relicList[rid];
            if (relicInfo.endTime > 0) {
                count += 1;
            }
        }

        return count;
    },

    // 停止探索遗迹
    stopExploreRelic : function (uid, relicId) {
        if (!this.users[uid])
            return 1;

        if (!this.users[uid].territoryWar.relic[relicId]) {
            return 1;
        }

        if (this.users[uid].territoryWar.relic[relicId].endTime == 0) {
            return 1;
        }

        var curTime = common.getTime();
        var endTime = this.users[uid].territoryWar.relic[relicId].endTime;
        var totalTime = gConfTerritoryWarRelic[relicId].time * 3600;
        this.users[uid].territoryWar.relic[relicId].exploreTime = totalTime - (endTime - curTime);
        this.users[uid].territoryWar.relic[relicId].endTime = 0;

        return 0;
    },

    // 加速探索
    speedExploreRelic : function (uid, relicId) {
        if (!this.users[uid])
            return ErrorCode.ERROR_USER_NOT_FOUND;

        if (!this.users[uid].territoryWar.relic[relicId]) {
            return ErrorCode.ERROR_CAN_NOT_FIND_RELIC;
        }

        if (this.users[uid].territoryWar.relic[relicId].num <= 0) {
            return ErrorCode.ERROR_RELIC_NUM_NOT_ENOUGH;
        }

        var curTime = common.getTime();
        var endTime = this.users[uid].territoryWar.relic[relicId].endTime;
        var exploreTime = this.users[uid].territoryWar.relic[relicId].exploreTime;  // 已经探索的时间
        var leftTime = 0;
        if (endTime == 0) {
            leftTime = gConfTerritoryWarRelic[relicId].time * 3600 - exploreTime;
        } else {
            leftTime = endTime - curTime;
        }

        var speedTime = parseInt(gConfTerritoryWarBase.relicAccelerateTime.value) * 3600;
        if (speedTime >= leftTime) {
            leftTime = 0;
        } else {
            leftTime = leftTime - speedTime;
        }

        var totalTime = gConfTerritoryWarRelic[relicId].time * 3600;
        if (leftTime > 0) {
            this.users[uid].territoryWar.relic[relicId].exploreTime = totalTime - leftTime;

            if (this.users[uid].territoryWar.relic[relicId].endTime > 0)
                this.users[uid].territoryWar.relic[relicId].endTime = curTime + leftTime;
        } else {
            // 探索完成
            this.users[uid].territoryWar.relic[relicId].exploreTime = 0;
            this.users[uid].territoryWar.relic[relicId].endTime = 0;
            this.users[uid].territoryWar.relic[relicId].num -= 1;
            this.sendRelicAward(uid, relicId);

            if (!this.users[uid].territoryWar.exploreCount)
                this.users[uid].territoryWar.exploreCount = 0;

            this.users[uid].territoryWar.exploreCount += 1;
            this.markDirty(uid);

            if (this.users[uid].territoryWar.relic[relicId].num == 0) {
                delete this.users[uid].territoryWar.relic[relicId];
            }
        }

        return 0;
    },

    // 处理遗迹探索
    processRelic : function () {
        var curTime = common.getTime();
        for (var uid in this.users) {
            this.processUserRelic(uid, curTime);
        }
    },

    processUserRelic : function (uid, curTime) {
        var user = this.users[uid];
        if (user.territoryWar) {
            for (var relicId in user.territoryWar.relic) {
                var relicObj = user.territoryWar.relic[relicId];
                if (relicObj.endTime > 0) {
                    var leftTime = relicObj.endTime - curTime;
                    // 如果出现剩余时间大于一天的情况，可能是出错了，先特殊处理下，以免卡住
                    if (curTime >= relicObj.endTime || leftTime > OneDayTime) {
                        // 到时间了，发奖励
                        relicObj.num -= 1;
                        relicObj.endTime = 0;
                        relicObj.exploreTime = 0;

                        this.sendRelicAward(uid, relicId);

                        if (!user.territoryWar.exploreCount)
                            user.territoryWar.exploreCount = 0;

                        user.territoryWar.exploreCount += 1;

                        if (relicObj.num <= 0) {
                            delete user.territoryWar.relic[relicId];
                        }

                        this.markDirty(uid);
                    }
                }
            }
        }
    },

    // 根据功能名查找对应的建筑id
    getBuildingIdWithFunction : function (func_name) {
        for (var cityId in gConfLegionCityBase) {
            var cityInfo = gConfLegionCityBase[cityId];
            for (var i = 1; i <= 4; i++) {
                if (cityInfo['buildFunction' + i] == func_name) {
                    return cityInfo['buildId' + i];
                }
            }
        }

        return 0;
    },

    getBuildingParam : function (uid, func_name) {
        if (!this.users[uid])
            return [0];

        var buildingId = this.getBuildingIdWithFunction(func_name);
        var param = [0];
        if (this.users[uid].territoryWar.buildings) {
            if (this.users[uid].territoryWar.buildings[buildingId]) {
                var buildingLevel = this.users[uid].territoryWar.buildings[buildingId].level;
                param = gConfLegionCityConf[buildingId][buildingLevel].value;
            }
        }

        return param;
    },

    // 发送遗迹探索奖励
    sendRelicAward: function (uid, relicId) {
        var relicInfo = gConfTerritoryWarRelic[relicId];
        if (true || !relicId) {
            return;
        }

        var param = this.getBuildingParam(uid, 'relicBaseAward');
        var awards = clone(relicInfo.baseAward);   // 基础奖励
        for (var i = 0; i < awards.length; i++) {
            awards[i][2] = Math.floor(awards[i][2] * (1 + param[0] / 100));
        }

        var userInfo = this.getUser(uid);
        // 获取龙的等级
        var dragonLevel = userInfo.territoryWar.dragon[relicInfo.correlationId];
        if (dragonLevel > 0 && dragonLevel <= 5) {
            for (var i = 1; i <= 5; i++) {
                if (dragonLevel >= i) {
                    awards = awards.concat(relicInfo['advancedAward' + i]);
                }
            }
        }

        var time = common.getTime();
        var mail = {
            content: [28],
            awards: awards,
            time: time,
            expire: time + gConfMail[28].time * OneDayTime,
            attach: {

            },
        }

        var worldReq = {
            mod: 'mail',
            act: 'add_mail',
            uid: uid,
            args: {
                mail: mail,
            }
        };

        var resp = {
            'code': 0,
            'desc': '',
            'data': {},
        };
        var serverId = common.getServerId(uid);
        gTerritoryWar.broadcastToWorld(serverId, worldReq, resp, function () { })
    },

    // 设置位置
    setPos : function (uid, lid, cellId) {
        if (!this.users[uid])
            return;

        this.users[uid].territoryWar.pos.lid = parseInt(lid);
        this.users[uid].territoryWar.pos.cellId = parseInt(cellId);
        this.markDirty(uid);

        gTerritoryWar.onPlayerVisitCell(this.users[uid].territoryWar.lid, lid, cellId);
    },

    // 移动
    moveTo : function (uid, cellId) {
        if (!this.users[uid])
            return;

        this.setPos(uid, this.users[uid].territoryWar.pos.lid, cellId);

        if (this.users[uid].territoryWar.pos.lid == this.users[uid].territoryWar.lid) {
            if (cellId == parseInt(gConfTerritoryWarBase.jianmenguanPos.value) ||
                cellId == parseInt(gConfTerritoryWarBase.jiayuguanPos.value) ||
                cellId == parseInt(gConfTerritoryWarBase.hulaoguanPos.value)) {
                this.onVisitCity(uid, +cellId);
            }
        }

        // 广播给本领地所有在线玩家
        gTerritoryWar.broadcastPlayerPosition(uid, this.users[uid].territoryWar.pos.lid, cellId, false);
    },

    // 采集格子资源
    gather : function (uid, cellId, isSelf, enemyIndex, remainPower) {
        if (!this.users[uid])
            return;

        var power = remainPower;
        if (power == null || power == undefined)
            power = 100;

        if (isSelf) {
            this.users[uid].territoryWar.visitedResList.self[cellId] = {};
            this.users[uid].territoryWar.visitedResList.self[cellId].param = power;
        } else {
            this.users[uid].territoryWar.visitedResList['enemy' + enemyIndex][cellId] = {};
            this.users[uid].territoryWar.visitedResList['enemy' + enemyIndex][cellId].param = power;
        }

        var lid = this.users[uid].territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(lid, cellId);
        if (cellInfo.resType == TerriToryWarResourceType.ELEMENT) {
            if (cellInfo.resId >= 9 && cellInfo.resId <= 13) {
                if (!this.users[uid].territoryWar.visitedMineCount[cellInfo.resId - 9]) {
                    this.users[uid].territoryWar.visitedMineCount[cellInfo.resId - 9] = 1;
                } else {
                    this.users[uid].territoryWar.visitedMineCount[cellInfo.resId - 9] += 1;
                }
            }
            else if (cellInfo.resId == 14) {
                this.users[uid].territoryWar.dragonScaleCount += 1;
            }
        }

        this.markDirty(uid);
    },

    onRobMine : function (uid) {
        if (!this.users[uid])
            return;

        if (!this.users[uid].territoryWar.robCount)
            this.users[uid].territoryWar.robCount = 0;

        this.users[uid].territoryWar.robCount += 1;
    },

    onResetByDay : function () {
        // 清除传送次数
        for (var uid in this.users) {
            if (this.users[uid] && this.users[uid].territoryWar) {
                this.users[uid].territoryWar.transferCount = 0;
                if (this.users[uid].territoryWar.boss) {
                    this.users[uid].territoryWar.boss.self.challengeCount = 0;
                    this.users[uid].territoryWar.boss.enemy1 = {};
                    this.users[uid].territoryWar.boss.enemy1.challengeCount = 0;
                    this.users[uid].territoryWar.boss.enemy2 = {};
                    this.users[uid].territoryWar.boss.enemy2.challengeCount = 0;
                }

                this.markDirty(uid);
            }
        }
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
                mod : 'territorywar',
                act : 'kick_player',
                uid : uid,
                args : {
                    players : playerIds,
                    dismiss : 0,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            gTerritoryWar.broadcastToAllWorld(WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('onResetByWeek to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('onResetByWeek to world failed!' + WorldResp.desc);
                }
            });
        }

        // 清除所有玩家
        this.clear();
    },

    // 判断两个格子是否相邻
    isNeighborCell : function (cell1, cell2) {
        var cellInfo1 = gConfTerritoryWarMapGrid[cell1];
        var cellInfo2 = gConfTerritoryWarMapGrid[cell2];
        if (!cellInfo1 || !cellInfo2) {
            return false;
        }

        if (Math.abs(cellInfo1.pos[0] - cellInfo2.pos[0]) > 1 || Math.abs(cellInfo1.pos[1] - cellInfo2.pos[1]) > 1) {
            return false;
        }

        return true;
    },

    getDragonScaleCount : function (uid) {
        if (!this.users[uid])
            return 0;

        return this.users[uid].territoryWar.dragonScaleCount;
    },

    // 根据军团id获取军团所在服务器id
    getServerIdByLid : function (lid) {
        for (var uid in this.users) {
            if (this.users[uid].territoryWar.lid == lid) {
                return common.getServerId(uid);
            }
        }

        return 0;
    },
}

exports.UserInfo = UserInfo;
