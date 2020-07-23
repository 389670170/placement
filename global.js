let path = require('path');
var crypto = require('crypto');
var common = require('./common.js');
var aop = require('node-aop');

global.pubKey = [3, 33];
global.priKey = [3, 15];

// 全局变量
global.OneDayTime = 3600 * 24;
global.OneWeekTime = OneDayTime * 7;

// 布阵位置个数
global.MaxSlot = 9;

// 位置数组
global.SlotArray = [];
for (var i = 1; i <= MaxSlot; i++) {
    SlotArray.push(i);
}

// 上阵武将最大个数(不包括佣兵)
global.MaxPos = 7;

// 小兵装备最大数量
global.SoldierEquipCount = 4;

// 小兵星星数上限
global.SoldierStarCount = 5;

// 部位数量
global.HeroPartCount = 6;

// 国家数量
global.CountryNum = 1;

// 默认的荒地起始id
global.DEFAULT_BARREN_LAND_BEGIN_ID = 900;

// 战斗计算的key
global.BATTLE_FIGHT_KEY = 'RHJhZ29uT2ZLbmlnaHRz';

// 所有战斗属性
global.Attribute = {
    'ATK': 1,                            // 攻击
    'DEF': 2,                            // 物防
    'MDEF': 3,                            // 法防
    'HP': 4,                            // 生命
    'HIT': 5,                            // 命中
    'DODGE': 6,                            // 闪避
    'CRIT': 7,                            // 暴击
    'RESI': 8,                            // 韧性
    'MOVESPEED': 9,                        // 移动速度
    'ATKSPEED': 10,                       // 攻击速度
    'HURTADD': 11,                       // 伤害加成
    'HURTRED': 12,                       // 伤害减免
    'CRITHURT': 13,                       // 暴击伤害
    'IGNDEF': 14,                       // 无视防御几率
    'REBLOOD': 15,                       // 每5秒回血
    'DROPITEM': 16,                       // 掉落道具加成
    'DROPGOLD': 17,                       // 掉落金币加成
    'INITANGRY': 18,                       // 初始怒气
    'ANGRYSPEED': 19,                       // 怒气回复速度
    'CRITPROB': 20,                         // 怒气回复速度
    'RESIPROB': 21,                         // 怒气回复速度
    'DODGEPROB': 22,                        // 怒气回复速度
    'HITPROB': 23,                          // 怒气回复速度
    'MOVESPEEDPERCENT': 24,                 // 怒气回复速度
    'ATKSPEEDPERCENT': 25,                  // 怒气回复速度
    'PVPDMGINCREASE': 26,                  // PVP伤害加成
    'PVPDMGREDUCE': 27,                    // PVP伤害减免
    'SKILLDMGINCREASE': 28,                // 技能伤害加成
    'SKILLDMGREDUCE': 29,                  // 技能伤害减免
};

// 基础属性id与名字对应
global.BaseAttrName = {
    '1': 'attack',
    '2': 'defence',
    '3': 'mdefence',
    '4': 'hp',
};

global.BaseAttrName_rune = {
    '1': 'atk',
    '2': 'def',
    '3': 'magdef',
    '4': 'hp',
};

// 奇遇类型
global.AdventureType = {
    'shop': 1,     // 商人
    'monster': 2,  // 挑战怪人
    'cash': 3,     // 金币、元宝堆
};

// 试炼成就类型
global.TrialAchivementType = {
    'horizontal_line': 1,  // 完成n次横相同
    'vertical_line': 2,    // 完成n次竖相同
    'diagonal_line': 3,    // 完成n次斜相同
    'all_different': 4,    // 完成n次全不同
    'shop_count': 5,       // 完成n次商人奇遇
    'monster_count': 6,    // 完成n次挑战怪人奇遇
    'cash_count': 7,       // 遇见n次金币元宝堆
};

global.TrialExploreMaxCount = 27;   // 探索最大次数

// 探索，前3个是对应的格子，第四个是对应的倍率id，第五个是对应的成就类型
global.TrialExploreCondition = [];
global.TrialExploreCondition[0] = [1, 2, 3, 1, 1];
global.TrialExploreCondition[1] = [4, 5, 6, 1, 1];
global.TrialExploreCondition[2] = [7, 8, 9, 1, 1];
global.TrialExploreCondition[3] = [1, 4, 7, 2, 2];
global.TrialExploreCondition[4] = [2, 5, 8, 2, 2];
global.TrialExploreCondition[5] = [3, 6, 9, 2, 2];
global.TrialExploreCondition[6] = [1, 5, 9, 3, 3];
global.TrialExploreCondition[7] = [3, 5, 7, 3, 3];

// 国战国家任务类型
global.CountryTaskType = {
    'conqueredEnemyCity': 1,   // 占领敌方城池
    'holdCityTime': 2, // 占据城池的时间
    'conqueredCityCount': 3,   // 指定时间内占领的城池数
    'holdCityCount': 4,    // 占领的城池数
    'joinPlayerCount': 5,  // 参加国战的人数
};

// 国战个人任务类型
global.PersonalTaskType = {
    'killCount': 1,    // 击败敌方玩家数量
    'callCount': 2,    // 发布集结令的次数
    'replyCallCount': 3,   // 响应集结令次数
    'conqueredCityCount': 4,   // 夺下敌方城池次数
    'fastReliveCount': 5,  // 快速复活次数
    'buyGoodsCount': 6, // 购买物资次数
};

global.AttributeIds = [];
for (var attr in Attribute) {
    AttributeIds.push(Attribute[attr]);
}

global.ActivityProcess = {
    'CLOSE': 0,
    'NORMAL': 1,
    'DELAY': 2,
};

// 品质
global.Quality = {
    'WHITE': 1,
    'GREEN': 2,
    'BLUE': 3,
    'PURPLE': 4,
    'ORANGE': 5,
    'RED': 6,
    'GOLD': 7,
};

// 商店类型
global.ShopType = {
    'GOD': 1,
    'MYSTERY': 2,
    'ARENA': 3,
    'TOWER': 4,
    'BLACK': 5,
    'ARENARANK': 6,
    'COUNTRY': 7,
    'WORLDWAR': 8,
    'LEGION': 9,
    'MARKET': 10,
    'LEGIONWAR': 11,
    'TOWERGEM': 12,
    'TRIAL': 13,
    'COUNTRYWAR': 14,
    'COUNTRYSALARY': 15, // 俸禄商店
    'COUNTRYPOSITION': 16, // 官职商店
};

// 战斗类型
global.BattleType = {
    'PVE': 1,
    'PVP': 2,
};

// 军团职位
global.LegionDuty = {
    'MASTER': 1,
    'DEPUTY': 2,
    'ADVISER': 3,
    'MEMBER': 4,
};

// 头像框获取类型
global.HeadFrameGetType = {
    'vip_level': 1,    // vip达到
    'fight_force_rank': 2,    // 战力排名
    'arena_rank': 3,    // 竞技场排名
    'country1_rank': 4,    // 皇城争霸魏国排名
    'country2_rank': 5,    // 皇城争霸蜀国排名
    'country3_rank': 6,    // 皇城争霸吴国排名
    'month_card': 7,    // 持有月卡
    'limitless_card': 8,    // 持有终身卡
    'lucky_rank': 9,    // 人品排名
    'mission_progress': 10,    // 关卡进度
    'blood_times': 11,    // 歃血为盟次数
    'arena_win_times': 12,   // 竞技场获胜次数
    'user_level': 13,   // 主公等级

    'anniversary': 14,   // 周年庆
    'mid_autumn_day': 15,   // 中秋节
    'qi_xi': 16,   // 七夕
    'may_day': 17,   // 劳动节
    'children_day': 18,   // 儿童节
    'christmas_day': 19,   // 圣诞节
    'spring_festival': 20,   // 春节
    'valentine_day': 21,   // 情人节
    'week_card': 22,    // 持有周卡
};

// 客户端登陆时需要的数据
global.gClientLoginData = {
    '_id': 1,
    'info': 1,
    'status': 1,
    'mark': 1,
    'skills': 1,
    'pos': 1,
    'bag': 1,
    'cardGetRecord': 1,
    'equipGetRecord': 1,
    'keyGetRecord': 1,
    'runeGetRecord': 1,
    'mail': 1,
    'battle': 1,
    'princess': 1,
    'tavern': 1,
    'equip_valume': 1,
    'dragongem_valume': 1,
    'altar': 1,
    'altar_lv': 1,
    'sign': 1,
    'payment': 1,
    'task': 1,
    'guide_task': 1,
    'activity': 1,
    'tower': 1,
    'trial': 1,
    'country': 1,
    'arena': 1,
    'worldwar': 1,
    'war_college': 1,
    'dragon': 1,
    'territory_war': 1,
    'conspiracy': 1,
    'promote_wheel': 1,
    'wish': 1,
    'resback': 1,
    'sky_suit': 1,
    'cave': 1,
    'custom_king': 1,
    'custom_treasure': 1,
    'custom_village': [],
    'clan': 1,
    'rune_use': 1,
    'custom_weal': 1,

    //====add by fish new versionb
    'hero_bag': 1,
    'team': 1,
};

// 当前所在时区
global.gTimeZone = (new Date()).getTimezoneOffset() / -60;

// 初始玩家在世界服里的数据
global.gInitWorldUser = {
    'info': {
        'un': '',
        'headpic': 1,
        'headframe': 30002,
        'dragon': 1,
        'country': 0,
        'position': 0,
        'create': 0,
    },
    'status': {
        'level': 1,
        'xp': 0,
        'vip': 0,
        'arena_level': 1,
        'staying_power': 100,
        'team_exp': 1,
    },
    'mark': {
        'login_time': 0,
        'active_time': 0,
    },
    'pos': {},// hid:teampos
    'guard': {
        'field_sync': {},
    },
    'tower': {
        'top_floor': 0,
        'top_time': 0,
    },
    'country': {
        'update_time': 0,
        'day_salary': 0,
    },
    'skills': {},
    'def_info': {},
    'sky_suit': {
        'weapon_illusion': 0,
        'wing_illusion': 0,
        'mount_illusion': 0,
    },
    'payment': {
        'long_card': 0,
        'month_card': 0,
        'week_card': 0
    },
    'custom_king': {}, // you gai dong o 
    'custom_treasure': [],
    'custom_village': [],
    'new_legion': {
        'join_time': 0,
    },
    'dragon': {},
    'cardGetRecord': {},
    'clan': {},
};

/*
for(var i = 1; i <= MaxPos; i++) {
    gInitWorldUser.pos[i] = {
        'rid' : 0, // rid
        'level' : 1,
        'awake' : 0,
        'tier' : 0,
        'talent' : {},
        //'quality' : 1,
        'slot' : i,
        //'fate_attr' : {},
        'fight_force' : 0,
        'part': {},
        'equip':{},
        'attr' : {},
        //'promote': [],
    };
}*/

// 玩家在跨服中的数据，为世界服的子集
// 如果不是子集, 需要修改Player.markDirty
global.gWorldWarUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        'index': 1,
    },
    'dragon': {},
};

global.gTerritoryWarUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        'index': 1,
    },
    'dragon': {},
};

// 同步到小队领地服务器的数据
global.gTeamZoneUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        //'chapter' : 1,
        'index': 1,
    },
    'dragon': {},
};

// 同步到跨服竞技场的数据
global.gArenaServerUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        //'chapter' : 1,
        'index': 1,
    },
    'dragon': {},
};

// 玩家在国战中数据，为世界服的子集
global.gCountryWarUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        'index': 1,
    },
    'dragon': {},
};

// 玩家在跨服村庄争夺战中的数据，为世界服的子集
global.gLandGrabberUser = {
    'info': {},
    'status': {},
    'pos': {},
    'skills': {},
    'def_info': {},
    'sky_suit': {},
    'custom_king': {
        'chapter': 1,
        'index': 1,
    },
    'custom_village': [],
    'dragon': {},
};

// 跨服支持的阶段与数组index之间的映射
global.gSupportMap = {
    '16': 0,
    '8': 1,
    '4': 2,
    '2': 3,
    '1': 4,
};

// 资源类型定义
global.TerriToryWarResourceType = {
    ELEMENT: 1,    // 资源
    CREATURE: 2,   // 怪物
    MINE: 3,   // 矿产
    BOSS: 4,
};

// 领地矿的类型
global.TerriToryWarMineType = {
    MINE_TYPE_1: 1,    // 龙晶石堆
    MINE_TYPE_2: 2,    // 龙栖木堆
    MINE_TYPE_3: 3,    // 龙玄锭堆
    MINE_TYPE_4: 4,    // 龙岗岩堆
    MINE_TYPE_5: 5,    // 龙泉泪堆
};

// 领地战成就类型
global.TerritoryAchievementType = {
    ACHIEVEMENT_TYPE_1: 101,   // 【军团】累计访问%s个石碑
    ACHIEVEMENT_TYPE_2: 102,   // 【个人】累计获取%s片龙鳞
    ACHIEVEMENT_TYPE_3: 103,   // 【个人】累计损耗玩家%s点耐力
    ACHIEVEMENT_TYPE_4: 201,   // 累计拾取龙晶石堆%s个
    ACHIEVEMENT_TYPE_5: 202,   // 累计拾取龙栖木堆%s个
    ACHIEVEMENT_TYPE_6: 203,   // 累计拾取龙玄锭堆%s个
    ACHIEVEMENT_TYPE_7: 204,   // 累计拾取龙岗岩堆%s个
    ACHIEVEMENT_TYPE_8: 205,   // 累计拾取龙泉泪堆%s个
    ACHIEVEMENT_TYPE_9: 301,   // 击溃%s个傀儡
};

// 领地战event类型
global.TerritoryWarEventType = {
    EVENT_TYPE_1: 1,
    EVENT_TYPE_2: 2,
    EVENT_TYPE_3: 3,
    EVENT_TYPE_4: 4,
    EVENT_TYPE_5: 5,
    EVENT_TYPE_6: 6,
    EVENT_TYPE_7: 7,
};

// 竞技场类型
global.ArenaType = {
    BRONZE: 1,    // 青铜
    SILVER: 2,    // 白银
    GOLD: 3,    // 黄金
    PLATINUM: 4,    // 铂金
    DIAMOND: 5,    // 钻石
    KING: 6,    // 王者
    THIS: 11,       // 本服
    CROSS: 12,      // 跨服
};
global.ArenaTypeMax = Object.keys(ArenaType).length;

global.cloneHeroInitAttr = function () {
    var initAttr = {};
    for (var attr in Attribute) {
        initAttr[Attribute[attr]] = 0;
    }
    return clone(initAttr);
}

function initWorldUserGuard(argument) {
    for (var id in gConfGuardField) {
        gInitWorldUser.guard.field[id] = {
            'type': 0,
            'time': 0,
            'status': 0,
        };
    }
}

// 根据配表得出一次掉落
global.generateDrop = function (id, level, useSeed) {
    var dropConf = gConfDrop[id];
    if (!dropConf) {
        return [];
    }

    var awards = [];
    if (dropConf.fixed) {
        awards = awards.concat(dropConf.fixed);
    }

    var type = dropConf.type;
    var randNum = dropConf.randNum;

    var maxIndex = 20;
    for (var i = 1; i <= maxIndex; i++) {
        if (!dropConf['weight' + i]) {
            maxIndex = i - 1; break;
        }
    }

    if (type == 0) {
        // 按百分比
        var count = 0;
        for (var i = 1; i <= maxIndex; i++) {
            if (common.randRange(0, 10000, useSeed) <= dropConf['weight' + i]) {
                awards.push(dropConf['award' + i][0]);
                count++;
            }
        }
        for (var i = 0; i < count - randNum; i++) {
            var rmId = common.randRange(0, awards.length - 1, useSeed);
            awards.splice(rmId, 1);
        }
    } else {
        // 按权重
        var weights = {};
        for (var i = 1; i <= maxIndex; i++) {
            if (dropConf['award' + i]) {
                weights[i] = dropConf['weight' + i];
            } else {
                break;
            }
        }

        for (var i = 0; i < randNum; i++) {
            var randIndex = common.wRand(weights, useSeed);
            if (!randIndex) {
                break; // 配置错误导致奖励个数比配置少
            }
            weights[randIndex] = 0;
            awards.push(dropConf['award' + randIndex][0]);
        }
    }

    for (var i = 0; i < awards.length; i++) {
        var award = awards[i];
        if (award) {
            if (award[0] == 'equip' && award.length > 4) {
                var eid = generateEquip(award, level);
                awards[i] = ['equip', eid, +award[3], 1];
            }
        } else {
            DEBUG('award is undefined, id = ' + id + ', level = ' + level);
        }
    }

    return awards;
};

global.generateDropWithCount = function (id, count, level, useSeed) {
    var dropConf = gConfDrop[id];
    if (!dropConf) {
        return [];
    }

    var awards = [];
    if (dropConf.fixed) {
        awards = timeAwards(dropConf.fixed, count);
    }

    var type = dropConf.type;
    var randNum = dropConf.randNum;

    var maxIndex = 20;
    for (var i = 1; i <= maxIndex; i++) {
        if (!dropConf['weight' + i]) {
            maxIndex = i - 1; break;
        }
    }

    if (type == 0) {
        // 按百分比
        for (var n = 0; n < count; n++) {
            var count = 0;
            for (var i = 1; i <= maxIndex; i++) {
                if (common.randRange(0, 10000, useSeed) <= dropConf['weight' + i]) {
                    awards.push(dropConf['award' + i][0]);
                    count++;
                }
            }
            for (var i = 0; i < count - randNum; i++) {
                var rmId = common.randRange(0, awards.length - 1, useSeed);
                awards.splice(rmId, 1);
            }
        }
    } else {
        // 按权重
        var weights = {};
        for (var i = 1; i <= maxIndex; i++) {
            if (dropConf['award' + i]) {
                weights[i] = dropConf['weight' + i];
            } else {
                break;
            }
        }

        for (var n = 0; n < count; n++) {
            var randWeights = clone(weights);
            for (var i = 0; i < randNum; i++) {
                var randIndex = common.wRand(randWeights, useSeed);
                if (!randIndex) {
                    break; // 配置错误导致奖励个数比配置少
                }
                randWeights[randIndex] = 0;
                awards.push(dropConf['award' + randIndex][0]);
            }
        }
    }

    awards = reformAwards(awards);
    for (var i = 0; i < awards.length; i++) {
        var award = awards[i];
        if (award) {
            if (award[0] == 'equip' && award.length > 4) {
                var eid = generateEquip(award, level);
                awards[i] = ['equip', eid, +award[3], 1];
            }
        } else {
            DEBUG('award is undefined, id = ' + id + ', level = ' + level);
        }
    }

    return awards;
};

global.isActivityStart_no_player = function (activity, time) {
    do {
        var now = time ? time : common.getTime();
        var activityConf = gConfActivities[activity];
        if (!activityConf) {
            return ActivityProcess.CLOSE;
        }

        if (activityConf.openDay) {
            var resetTime = gConfGlobalNew.resetHour * 3600;
            var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
            if (passedDay < activityConf.openDay) {
                return ActivityProcess.CLOSE;
            }

            if (activityConf.endTime && gConfGlobalServer.serverStartTime > activityConf.endTime) {
                return ActivityProcess.CLOSE;
            }
        }

        var type = activityConf.type;
        var endTime = 0;
        if (type == 0) { // 开服活动
            var serverOpenDayTime = common.getTime(getGameDate(gConfGlobalServer.serverStartTime)) + gConfGlobalNew.resetHour * 3600;
            endTime = serverOpenDayTime + (activityConf.openDay + activityConf.duration) * 86400;
        } else if (type == 1) { // 限时活动
            if (now < activityConf.startTime) {
                return ActivityProcess.CLOSE;
            }

            endTime = activityConf.endTime;
        }

        if (now > endTime) {
            if (now < endTime + activityConf.delayDays * 86400) {
                return ActivityProcess.DELAY;
            }
            return ActivityProcess.CLOSE;
        }
    } while (false);

    return ActivityProcess.NORMAL;
};

global.getGameDate = function (time) {
    if (time) {
        return common.getDate(time - gConfGlobalNew.resetHour * 3600);
    } else {
        return common.getDate(common.getTime() - gConfGlobalNew.resetHour * 3600);
    }
};

// 登录时候检测是否有新的等级活动未开启
global.inspect_level_activity = function (player) {
    var lv = player.user.status.level

    for (var openLevel in gOpenLevelActivities) {

        if (openLevel == 1 || lv < openLevel) {
            continue
        }

        var activities = gOpenLevelActivities[openLevel];

        for (var i = 0, len = activities.length; i < len; i++) {
            var name = activities[i]

            var act = player.user.activity[name]
            if (!act || act.open_day == 0) {
                player.openActivity(name)
            }
        }
    }
};

global.isActivityStart = function (player, activity, time) {
    do {
        var now = time ? time : common.getTime();
        var activityConf = gConfActivities[activity];
        if (!activityConf) {
            return ActivityProcess.CLOSE;
        }

        if (player.user.status.level < activityConf.openLevel) {
            return ActivityProcess.CLOSE;
        }

        if (activityConf.openLoginDay) {
            var resetTime = gConfGlobalNew.resetHour * 3600;
            var passedDay = 0;
            if (activityConf.startTime) {
                passedDay = common.getDateDiff(getGameDate(activityConf.startTime), getGameDate(player.user.info.create));
            } else {
                passedDay = common.getDateDiff(getGameDate(), getGameDate(player.user.info.create));
            }

            if (passedDay < activityConf.openLoginDay) {
                return ActivityProcess.CLOSE;
            }
        }

        if (activityConf.openDay) {
            var resetTime = gConfGlobalNew.resetHour * 3600;
            var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
            if (passedDay < activityConf.openDay) {
                return ActivityProcess.CLOSE;
            }

            if (activityConf.endTime && gConfGlobalServer.serverStartTime > activityConf.endTime) {
                return ActivityProcess.CLOSE;
            }
        }

        var type = activityConf.type;
        var endTime = 0;
        if (type == 0) { // 开服活动
            var serverOpenDayTime = common.getTime(getGameDate(gConfGlobalServer.serverStartTime)) + gConfGlobalNew.resetHour * 3600;
            endTime = serverOpenDayTime + (activityConf.openDay + activityConf.duration) * 86400;
        } else if (type == 1) { // 限时活动
            if (now < activityConf.startTime) {
                return ActivityProcess.CLOSE;
            }

            endTime = activityConf.endTime;
        } else if (type == 2) { // 等级开启活动
            var openTime = common.getTime(player.user.activity[activity].open_day) + gConfGlobalNew.resetHour * 3600;
            endTime = openTime + (activityConf.openDay + activityConf.duration) * 86400;
        } else if (type == 3) { // 首登活动
            var openTime = common.getTime(getGameDate(player.user.info.create)) + activityConf.openLoginDay * 86400 + gConfGlobalNew.resetHour * 3600;
            endTime = openTime + activityConf.duration * 86400;
        }

        if (now > endTime) {
            if (now < endTime + activityConf.delayDays * 86400) {
                return ActivityProcess.DELAY;
            }
            return ActivityProcess.CLOSE;
        }
    } while (false);

    return ActivityProcess.NORMAL;
};

global.getGameDay = function (time) {
    var day = 0;
    if (time) {
        day = new Date(time * 1000 - gConfGlobalNew.resetHour * 3600 * 1000).getDay();
    } else {
        day = new Date(new Date() - gConfGlobalNew.resetHour * 3600 * 1000).getDay();
    }

    if (day == 0) {
        day = 7;
    }

    return day;
};

global.getActivityOpenDay = function (key) {
    // 获取某个活动当天距离活动开启天数
    var conf = gConfActivities[key];
    if (conf.type == 0) {
        var date1 = getGameDate(gConfGlobalServer.serverStartTime);
        var date2 = getGameDate();
        return common.getDateDiff(date1, date2) - conf.openDay + 1;
    }

    if (conf.type == 1) {
        var date1 = getGameDate(conf.startTime);
        var date2 = getGameDate();
        return common.getDateDiff(date1, date2) + 1;
    }
};

global.getResetTime = function (time) {
    return common.getTime(getGameDate(time)) + gConfGlobalNew.resetHour * 3600;
};

global.getRealResetTime = function (time) {
    return common.getTime(common.getDate(time));
};

global.getWeekResetTime = function (time) {
    var beginOfToday = common.getTime(getGameDate(time));
    var weekDay = (new Date(beginOfToday * 1000)).getDay();
    if (weekDay == 0) {
        weekDay = 7;
    }

    return beginOfToday - (weekDay - 1) * OneDayTime + gConfGlobalNew.resetHour * 3600;
};


global.getWeekIndex = function () {
    var time = new Date();
    var firstDay = new Date(time.getFullYear(), 0, 1);
    var dayOfWeek = firstDay.getDay();
    var spendDay = 1;
    if (dayOfWeek != 0) {
        spendDay = 7 - dayOfWeek + 1;
    }
    firstDay = new Date(time.getFullYear(), 0, 1 + spendDay);
    var d = Math.ceil((time.valueOf() - firstDay.valueOf()) / 86400000);
    var result = Math.ceil(d / 7);
    return result + 1;
};


global.getGameWeekDay = function () {
    var beginOfToday = common.getTime(getGameDate());
    var weekDay = (new Date(beginOfToday * 1000)).getDay();
    if (weekDay == 0) {
        weekDay = 7;
    }

    return weekDay;
};

global.getMonthResetTime = function () {
    var beginOfToday = common.getTime(getGameDate());
    var monthDay = (new Date(beginOfToday * 1000)).getDate();
    return beginOfToday - (monthDay - 1) * OneDayTime + gConfGlobalNew.resetHour * 3600;
};

global.calcFightForce = function (attrs, confExtraFF, log) {
    var fightForce = 0;
    for (var attr in attrs) {
        if (+attrs[attr] > 0) {
            if (log) {
                DEBUG("=========attr:" + attr + "=" + attrs[attr] + "*" + gConfAttribute[attr].factor + "*" + confExtraFF[gConfAttribute[attr].aPrKey] + '=' + (+attrs[attr]) * gConfAttribute[attr].factor * confExtraFF[gConfAttribute[attr].aPrKey]);
            }

            fightForce += (+attrs[attr]) * gConfAttribute[attr].factor * confExtraFF[gConfAttribute[attr].aPrKey];
        }
    }

    return Math.floor(fightForce);
};

global.calcFightForceNew = function (roleObj, starLv, combatConf) {
    var attrs = roleObj.attr;
    var roleLevel = roleObj.level;
    var awakeLevel = roleObj.awake;
    var tier = roleObj.tier;

    var fightForce = 0
    var attrPConf = gConfAttPrCoEff[roleLevel];

    //ERROR('----------------------');
    for (var attr in attrs) {
        var attrValue = +attrs[attr];
        var key = gConfAttribute[attr]['aPrKey'];
        var factor = gConfAttribute[attr]['factor'];
        var aprC = attrPConf[key];

        fightForce = fightForce + (attrValue * factor * aprC)
    }

    getSkillAddFightForce = function (awakeLevel, roleLevel, starLv) {
        var destinyConf = gConfDestiny[awakeLevel];
        var attrPConf = gConfAttPrCoEff[roleLevel];

        var factor = 0
        if (starLv >= 1 && starLv <= 5) {
            factor = destinyConf['virtualPower1'];
        } else if (starLv > 5 && starLv <= 9) {
            factor = destinyConf['virtualPower6'];
        } else {
            //ERROR('=======STAR:'+starLv+'  AWAKE:'+awakeLevel);
            factor = destinyConf['virtualPower10'];
        }

        return factor * attrPConf['sPrC'];
    }


    //获取特殊天赋加的战力
    getSpecialInnateAddFightForce = function (combatConf, tier) {
        var addPower = 0;
        var innateGroupId = combatConf['innateGroup'];
        var innateGroupCfg = gConfInnateGroup[innateGroupId];

        //已激活天赋条数
        var baseStarLv = combatConf['starBase'];
        var maxNum = Math.min(+gConfGlobalNew['innateNum' + baseStarLv], tier);

        for (var i = 1; i <= maxNum; i++) {
            var innateId = innateGroupCfg['level' + i];
            var targetType = gConfInnate[innateId]['target'];

            if (targetType == 0) {
                if (innateId == 1001) {
                    addPower = addPower + (+gConfGlobalNew['innateSpecialPower1']);
                } else if (innateId == 1002) {
                    addPower = addPower + (+gConfGlobalNew['innateSpecialPower2']);
                }
            }
        }

        return addPower;
    }

    var skillPower = getSkillAddFightForce(awakeLevel, roleLevel, starLv);
    var speInnatePower = getSpecialInnateAddFightForce(combatConf, tier);

    //ERROR('roleObj.rid = ' + roleObj.rid);
    //ERROR('fightForce = ' + fightForce);
    //ERROR('skillPower = ' + skillPower);
    //ERROR('speInnatePower = ' + speInnatePower);

    return Math.floor(fightForce + skillPower + speInnatePower);
};

global.calcFightForceNoExtra = function (attrs, confExtraFF) {
    var fightForce = 0;
    for (var attr in attrs) {
        if (+attrs[attr] && gConfAttribute[attr].influenceRobot) {
            fightForce += (+attrs[attr]) * gConfAttribute[attr].factor
                * confExtraFF[gConfAttribute[attr].aPrKey];
        }
    }

    return Math.floor(fightForce);
};

global.getLoginData = function (user) {
    var data = {};
    for (var id in user) {
        if (id in gClientLoginData) {
            data[id] = user[id];
            if (id == 'battle') {
                data[id] = minCity(user[id]);
            }
        }
    }

    return data;
}

// 压缩村庄的返回参数
global.minCity = function (battle) {
    var progress = battle.progress;
    var json = {
        progress: battle.progress,
        type: battle.type,
        //city:[]
    };
    return json
};

global.reformAwards = function (awards) {
    var result = [];
    var awardStrs = [];

    var realAwards = [];

    if (awards.awards) {
        realAwards = awards.awards;
    }
    else {
        realAwards = awards;
    }

    for (var i = 0, max = realAwards.length; i < max; i++) {
        var award = realAwards[i];
        if (award[0] == 'equip' || award[0] == 'group') {
            result.push(award.slice());
            continue;
        }
        var awardStr = award.slice(0, award.length - 1).join(".");
        var index = awardStrs.indexOf(awardStr);
        if (index < 0) {
            awardStrs.unshift(awardStr);
            result.unshift(award.slice());
            continue;
        }
        var num = +award[award.length - 1];
        result[index][award.length - 1] += num;
    }
    return result;
};

// 将origin的所有属性值映射到mirro结构中，返回一个新对象, 注意，结果中的对象属性引用原来的对象
global.mapObject = function (origin, mirror) {
    var result = {};
    var emptyObj = true;
    for (var id in mirror) {
        emptyObj = false;
        if (!(id in origin)) {
            continue;
        }
        if (typeof (mirror[id]) != 'object' || (mirror[id] instanceof Array)) {
            result[id] = origin[id];
        } else {
            result[id] = mapObject(origin[id], mirror[id]);
        }
    }
    // 如果mirror是空对象，则映射整个对象
    if (emptyObj) {
        for (var id in origin) {
            result[id] = origin[id];
        }
    }
    return result;
}

// 获取邮件和公告的唯一标识
global.getMailUniCode = function (mail) {
    var obj = {};
    obj.type = mail.type;
    obj.title = mail.title;
    obj.content = mail.content;
    obj.awards = mail.awards;
    obj.expire = mail.expire;

    return common.md5(JSON.stringify(obj)).substr(0, 13);
};

// 获取佣兵的时间金币奖励
global.getMercenaryTimeGold = function (now, mInfo, hid, level) {
    var oneDay = 24 * 3600;
    var duration = now - mInfo.send_time;

    if (duration > oneDay) {
        duration = oneDay;
    }
    if (mInfo.upgrade_time) {
        duration -= mInfo.upgrade_time - mInfo.send_time;
    }
    var timeGold = mInfo.time_gold;
    if (duration > 0) {
        var awardCount = Math.floor(duration / gConfGlobal.mercenaryTimeGoldInterval / 60);
        timeGold += awardCount * gConfLevel[level].mercenaryTimeGold;
    }
    return timeGold;
};

global.getRunTime = function (obj, func) {
    var startTime = 0;
    var endTime = 0;
    aop.before(obj, func, function () {
        startTime = +(new Date());
    });

    aop.after(obj, func, function () {
        endTime = +(new Date());
        if (endTime - startTime > 5) {
            DEBUG('uid : ' + obj.user._id + ' ' + func + ' use ' + (endTime - startTime) + ' ms');
        }
    });
};

global.timeAwards = function (awards, time, flag) {
    var result = [];
    if (!awards) {
        return result;
    }
    for (var i = 0, len = awards.length; i < len; i++) {
        var award = awards[i].slice();
        if (flag && time > 1) {
            result.push(award)
            var extraAward = award.slice();
            extraAward[extraAward.length - 1] =
                Math.floor(extraAward[extraAward.length - 1] * (time - 1));
            extraAward.push(1);
            result.push(extraAward);
        } else {
            award[award.length - 1] = Math.floor(award[award.length - 1] * time);
            result.push(award);
        }
    }
    return result;
};

global.isDroid = function (uid) {
    if (uid <= 1000000) {
        return true;
    }
    return false;
}

global.RobotAttNameMap = {
    18: 'baseMp',           // 基础怒气
    20: 'baseHit',          // 命中率
    21: 'baseDodge',        // 闪避率
    22: 'baseCrit',         // 暴击率
    23: 'baseResi',         // 抗暴率
    11: 'dmgIncrease',      // 伤害加成
    12: 'dmgReduce',        // 伤害减免
    7: 'critDmgIncrease',  // 暴击伤害
    8: 'critDmgReduce',    // 暴击减伤
    28: 'skillDmgIncrease', // 技能伤害加成
    29: 'skillDmgReduce',   // 技能伤害减免
    5: 'ignoreDef',        // 无视护甲
    6: 'ignoreMag',        // 无视技防
    15: 'cureIncrease',     // 治疗加成
    19: 'recoverMp',        // 怒气回复加成
    14: 'repleNegative',    // 负面抗性
};

global.RobotBaseAttrName = {
    '1': 'atk',
    '2': 'def',
    '3': 'mdef',
    '4': 'hp',
};

global.grintCallStack = function () {
    var i = 0;
    var fun = arguments.callee;
    do {
        fun = fun.arguments.callee.caller;
        ERROR('i:' + (++i) + ': ' + fun);
    } while (fun);
};


// id 机器人id，根据id读取robotconf.dat表
// level 机器人等级，根据等级读取robotatt.dat表
global.generateRobot = function (id, level, fightForce, userMaxFightForce) {
    var robotTypeConf = gConfRobotType[id];
    if (!robotTypeConf) {
        return null;
    }

    var robotAttConf = gConfRobotAtt[level];
    if (!robotAttConf) {
        return null;
    }

    // 根据数量和最大品质随机英雄
    // function selectHeroWithNum(num, maxQuality) {
    //     var hidArr = clone(gRobotHeroIds);

    //     // 先把品质超出的剔除
    //     if (maxQuality && maxQuality > 0) {
    //         for (var i = 0; i < hidArr.length; i++) {
    //             var heroConf = getHeroCombatConf(hidArr[i]);
    //             if (heroConf && heroConf.quality > maxQuality) {
    //                 hidArr.remove(hidArr[i]);
    //                 i--;
    //             }
    //         }
    //     }

    //     return common.randArrayWithNum(hidArr, num);
    // };
    function selectHeroWithNum(num, starMin, starMax) {
        var hidArr = clone(gRobotHeroIds);


        // 先把品质超出的剔除
        // if (maxQuality && maxQuality > 0) {

        if (starMin && starMax) {
            for (var i = 0; i < hidArr.length; i++) {
                var heroConf = getHeroCombatConf(hidArr[i]);
                // if (heroConf && heroConf.quality > maxQuality) {
                if (heroConf && (heroConf.starBase > starMax || heroConf.starBase < starMin)) {
                    hidArr.remove(hidArr[i]);
                    i--;
                }
            }
        }

        return randArrayWithNum(hidArr, num);// return common.randArrayWithNum(hidArr, num);
    };

    function randArrayWithNum(arr, num) {
        var myarr = clone(arr);
        if (num >= myarr.length) {
            return myarr;
        }
        var randValues = [];
        var tMutexIdList = [];
        var tMaxTimes = 0;
        for (var i = 0, max = Math.min(myarr.length, num); i < max; i) {
            if (tMaxTimes++ > 100) { break; }

            var value = common.randArray(myarr);
            var tHeroBaseInfo = getHeroBaseConf(value);
            if (!tHeroBaseInfo) {
                continue;
            }

            if (tMutexIdList.indexOf(tHeroBaseInfo.mutexId) != -1) {
                continue;
            }

            tMutexIdList.push(tHeroBaseInfo.mutexId);
            randValues.push(value);
            myarr.remove(value);
            ++i;
        }

        return randValues;
    }

    function selectHeroPosWithNum(num) {
        var slotArr = clone(SlotArray);
        if (num < 6) {
            // 英雄数量小于6的时候只在前两排堆积
            slotArr.splice(6, 3);
        }

        return common.randArrayWithNum(slotArr, num);
    };

    var heroCount = robotAttConf.heroNun;

    var posObj = {};
    // 随机产生武将
    // var hids = selectHeroWithNum(heroCount, robotAttConf.qualityMax);
    var hids = selectHeroWithNum(heroCount - 1, robotAttConf.starMin, robotAttConf.starMax);
    hids.push(robotAttConf.mainId);

    // 随机产生武将的站位
    var slots = selectHeroPosWithNum(heroCount);

    // 随机每个英雄的权重，根据权重分配战斗力
    var totalffWeight = 0;
    var weightFightForceArr = [];   // 每个英雄战斗力权重
    for (var i = 0; i < heroCount; i++) {
        var wht = common.randRange(20, 20);
        totalffWeight += wht;
        weightFightForceArr.push(wht);
    }

    var maxff = 0;
    for (var i = 0; i < heroCount; i++) {
        var heroff = fightForce * weightFightForceArr[i] / totalffWeight;

        var attrs = {};
        for (var attrName in Attribute) {
            var attrId = Attribute[attrName];
            attrs[attrId] = 0;

            var attName = RobotAttNameMap[attrId];
            if (attName && robotAttConf[attName]) {
                attrs[attrId] = Math.floor(robotAttConf[attName] * robotTypeConf.additional / 10000);
            }
        }

        var leftff = heroff - calcFightForce(attrs, gConfAttPrCoEff[1]);

        var rid = hids[i];
        var combatConf = getHeroCombatConf(rid);
        var confDestiny = gConfDestiny[robotAttConf.skillLevel];
        var skillff = 0;
        if (confDestiny) {
            var confExtaFF = gConfAttPrCoEff[level];
            var tDestinyValue = 0;
            for (var j = (combatConf.starBase + robotAttConf.skillLevel); j >= 0; j--) {
                tDestinyValue = confDestiny['virtualPower' + j];
                if (tDestinyValue) { break; }
            }

            skillff = Math.floor(tDestinyValue * confExtaFF.sPrC);  //skillff = Math.floor(confDestiny['virtualPower' + combatConf.quality] * confExtaFF.sPrC);
        }

        leftff -= skillff;
        if (leftff < 0) {
            DEBUG('id = ' + id + ', level = ' + level + ', fightforce = ' + fightForce + ', skillff = ' + skillff);
            if (userMaxFightForce) {
                leftff = Math.floor(userMaxFightForce / 2);
            } else {
                leftff = 10000;
            }
        }

        // 攻击速度，移动速度,基础怒气
        attrs[9] = combatConf.baseSpeed;
        attrs[10] = combatConf.attackSpeed;

        var weights = {};
        for (var j = 1; j <= 4; j++) {
            weights[j] = robotTypeConf[RobotBaseAttrName[j]];
        }
        var totalWeight = 0;
        for (var attr in weights) {
            totalWeight += weights[attr];
        }

        for (var attr in weights) {
            var attff = leftff * weights[attr] / totalWeight;
            if (gConfAttribute[attr].factor) {
                attrs[attr] = Math.floor(robotTypeConf.diff * attff / (gConfAttribute[attr].factor * gConfAttPrCoEff[1]['aPrC' + attr]));
                if (!attrs[attr]) {
                    if (attrs[attr] != 0) { // by fish FAQ
                        attrs[attr] = 1000;
                    }


                }
            }
        }

        heroff = calcFightForce(attrs, gConfAttPrCoEff[1]) + (skillff || 1000);// by fish FAQ
        posObj[i + 1] = {
            rid: parseInt(hids[i]),
            slot: slots[i],
            level: level,
            tier: robotAttConf.talentLevel,
            awake: robotAttConf.skillLevel,
            attr: attrs,
            fight_force: Math.floor(heroff * 1.1),
            //soldier_level : robotAttConf.soldierLevel,
            //soldier_star : 0,
        };
    }

    return posObj;
};

global.randomPosObj = function (confRobot, heroCount, fightForce, soldierLevel, soldierStar, maxQuality) {
    if (!soldierStar) {
        soldierStar = 0;
    }

    if (!maxQuality) {
        maxQuality = 7
    }

    var robotHeroIds = clone(gRobotHeroIds);
    if (maxQuality && maxQuality > 0) {
        for (var i = 0; i < robotHeroIds.length; i++) {
            var heroConf = getHeroCombatConf(robotHeroIds[i]);
            if (heroConf && heroConf.quality > maxQuality) {
                robotHeroIds.remove(robotHeroIds[i]);
                i--;
            }
        }
    }

    var posObj = {};
    // 随机产生武将
    var hids = common.randArrayWithNum(robotHeroIds, heroCount);
    // 随机产生武将的站位
    var slots = common.randArrayWithNum(SlotArray, heroCount);

    // 随机每个英雄的权重，根据权重分配战斗力
    var totalffWeight = 0;
    var weightArr = [];
    for (var i = 0; i < heroCount; i++) {
        var wht = common.randRange(5, 15);
        totalffWeight += wht;
        weightArr.push(wht);
    }

    var maxff = 0;
    for (var i = 0; i < heroCount; i++) {
        var heroff = fightForce * weightArr[i] / totalffWeight;
        var attrs = {};
        var weights = {};
        for (var attrName in Attribute) {
            var attr = Attribute[attrName];
            var confAttr = confRobot[attr];
            if (confAttr) {
                if (confAttr.initWeight) {
                    if (confAttr.maxWeight) {
                        weights[attr] = common.randRange(confAttr.initWeight, confAttr.maxWeight);
                    } else {
                        weights[attr] = confAttr.initWeight;
                    }
                    attrs[attr] = 0;
                } else {
                    if (confAttr.maxValue) {
                        attrs[attr] = common.randRange(confAttr.initValue, confAttr.maxValue);
                    } else {
                        attrs[attr] = confAttr.initValue;
                    }
                }
            }
        }

        var leftff = heroff - calcFightForce(attrs, gConfAttPrCoEff[1], 1);

        var totalWeight = 0;
        for (var attr in weights) {
            totalWeight += weights[attr];
        }
        for (var attr in weights) {
            var attff = leftff * weights[attr] / totalWeight;
            if (gConfAttribute[attr].factor) {
                attrs[attr] = Math.floor(attff / (gConfAttribute[attr].factor * gConfAttPrCoEff[1]['aPrC' + attr]));
            }
        }

        heroff = calcFightForce(attrs, gConfAttPrCoEff[1], 1);
        posObj[i + 1] = {
            hid: hids[i],
            slot: slots[i],
            level: 1,
            talent: 1,
            destiny: 1,
            attr: attrs,
            fight_force: heroff,
            soldier_level: soldierLevel,
            soldier_star: soldierStar,
        };
    }

    return posObj;
};

/*
// 压缩排名，conf必须为以id为索引，并且有rank列的配置
// 压缩的方式为，某区段的所有玩家uid连续的部分，且连续个数大于2的
// 存储为[beginUid, endUid]的格式, 当区段比较大时，这种情况会很多
global.compressRanks = function(ranks, conf) {
    var result = {};
    for(var id in conf) {
        result[id] = [];
    }
    var rankStages = Object.keys(conf);
    rankStages.sort(function(a, b){return (+a)-(+b);});
    for(var uid in ranks) {
        uid = +uid;
        var stage = 0;
        var rank = ranks[uid];
        for(var i = 0, len = rankStages.length ; i < len; i++) {
            if(rank < +rankStages[i]) {
                stage = rankStages[i-1];
                break;
            }
        }
        // 不在所有区段内的用户，直接丢弃
        if(!stage) {
            continue;
        }
        result[stage].push(uid);
    }

    var compUids = function(uids, compedUids, beginId, endId) {
        if(endId == beginId) {
            compedUids.push(uids[beginId]);
        }else if(endId == beginId+1) {
            compedUids.push(uids[beginId]);
            compedUids.push(uids[endId]);
        }else {
            compedUids.push([uids[beginId], uids[endId]]);
        }
    };

    for(var stage in result) {
        var uids = result[stage];
        if(uids.length <= 2) {
            continue;
        }
        uids.sort();
        var compedUids = [];
        var beginId = 0;
        var endId = 0;
        for(var i = 1, len = uids.length; i < len; i++) {
            if(uids[i] == uids[i-1]+1) {
                endId = i;
            }else {
                compUids(uids, compedUids, beginId, endId);
                beginId = i;
                endId = i;
            }
        }
        compUids(uids, compedUids, beginId, endId);
        result[stage] = compedUids;
    }
    return result;
};

global.getRankFromCompRanks = function(uid, ranks) {
    for(var id in ranks) {
        var uids = ranks[id];
        if(uids.length == 0) {
            continue;
        }
        var minUid = uids[0];
        if(typeof minUid == 'object') {
            minUid = uids[0][0];
        }
        var maxUid = uids[uids.length-1];
        if(typeof maxUid == 'object') {
            maxUid = uids[uids.length-1][1];
        }
        if(uid < minUid || uid > maxUid) {
            continue;
        }
        return id;
    }
    return null;
}
*/

global.getCashCost = function (costs) {
    var cashCost = 0;
    for (var i = 0, len = costs.length; i < len; i++) {
        if (costs[i][1] == 'cash' && costs[i][2] < 0) {
            cashCost -= costs[i][2];
        }
    }
    return cashCost;
};

global.isModuleOpen = function (player, name) {
    var conf = gConfModuleOpen[name];
    if (!conf) {
        return false;
    }

    if (player.user.battle.progress < conf.cityId) {
        return false;
    }

    if (player.user.status.level < conf.level) {
        return false;
    }

    return true;
};

global.isModuleOpen_new = function (player, name) {
    var conf = gConfModuleOpen_new[name];
    if (!conf) {
        return false;
    }


    var type = conf.cityType;
    var progress = conf.cityId

    if (type > 0 && progress > 0) {
        var tarValue = type * 10000 + progress;
        var myValue = player.user.battle.type * 10000 + player.user.battle.progress;

        if (tarValue >= myValue) {
            return false;
        }
    }

    if (player.user.status.level < conf.level) {
        return false;
    }

    return true;
};

global.isModuleOpen_level = function (level, name) {
    var conf = gConfModuleOpen_new[name];
    if (!conf) {
        return false;
    }

    if (level < conf.level) {
        return false;
    }

    return true;
};

global.isModulePrivilegeOpen = function (player, name) {
    var privilege = player.user.task.privilege;
    var tavernHotPrivilegeId = gConfNobiltyTitleKey[name].id;
    if (!privilege[tavernHotPrivilegeId]) {
        return false;
    }

    return true;
};

global.isModuleOpenByWorld = function (user, name) {
    var conf = gConfModuleOpen_new[name];

    if (!conf) {
        return false;
    }
    if (user.status.level < conf.level)
        return false;
    return true;
}

global.generateEquip = function (equipArr, level) {
    if (equipArr.length != 7) {
        ERROR('sth equip error');
        ERROR(equipArr);
        return 0;
    }

    level = Math.floor(level / 10) * 10;
    var nextLevel = level + 10;
    if (level == 0) {
        level = 1;
    }
    if (level > gMaxUserLevel - 10) {
        nextLevel = level;
    }
    var selectedEquips = [];
    var levelEquipConf = gConfEquipClassified[equipArr[2] == 0 ? level : nextLevel];
    if (!levelEquipConf) {
        return [];
    }

    var equipConf = levelEquipConf[equipArr[1]];
    for (var id in equipConf) {
        if (equipConf[id].isAncient == equipArr[4] && equipConf[id].type == equipArr[5]) {
            selectedEquips.push(id);
        }
    }

    return common.randArray(selectedEquips);
};

// 获取英雄基础数据
global.getHeroBaseConf = function (id) {
    return gConfHero[id];
};

// 获取英雄战斗数据
global.getHeroCombatConf = function (id, awake) {
    var heroConf = gConfHero[id];
    if (!heroConf) {
        ERROR('=======getHeroCombatConf null==rid========' + id);
        return null;
    }

    var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
    if (awake && awake >= 4) {
        heroTemplateId = heroConf.templatedIdUltimate;
    }
    /*
    var heroBaseConf = null;
    if (custom_king && custom_king.chapter > 0 && custom_king.index > 0) {
        var templateId = gConfCustomKing[custom_king.chapter][custom_king.index].changeTemplate;
        return gConfCombatHeroTemplate[templateId];
    } else {
        heroBaseConf = getHeroBaseConf(id);
    }

    if (heroBaseConf) {
        return gConfCombatHeroTemplate[heroBaseConf.heroTemplateId];
    }
    return null;
    */
    return gConfCombatHeroTemplate[heroTemplateId];
};

// 判断是不是跨服竞技场
global.isCrossArena = function (type) {
    if (type > ArenaType.GOLD)
        return true;

    return false;
};

// 判断一个竞技场类型是否合法
global.isValidArenaType = function (type) {
    if (!type || isNaN(type)) {
        return false;
    }

    if (type < ArenaType.BRONZE || type > ArenaType.KING) {
        return false;
    }

    return true;
};

// 是不是跨服村庄
global.isCrossVillage = function (village_id) {
    if (village_id && village_id >= 6) {
        return true;
    }

    return false;
};

global.randomAward = function (itemGroupConf, totalOdds) {
    // 随机出一个奖励
    var awardIndex = 1;
    var randOdd = common.randRange(0, totalOdds);
    var groupLength = Object.keys(itemGroupConf).length;

    var offset = 0;
    for (var j = 1; j <= groupLength; j++) {
        offset += itemGroupConf[j].weight;
        if (randOdd < offset) {
            awardIndex = j;
            break;
        }
    }

    if (!itemGroupConf[awardIndex]) {
        DEBUG('awardIndex = ' + awardIndex);
        DEBUG(itemGroupConf);
    }

    var award = itemGroupConf[awardIndex].award[0];
    var awardType = award[0];
    var awardId = award[1];
    var awardNum = 0;

    // 再算一遍数量
    if (awardType == 'equip') {
        if (award.length == 5) {
            awardNum = Math.floor(+award[award.length - 2]);
        } else {
            awardNum = Math.floor(+award[award.length - 1]);
        }
    } else {
        awardNum = Math.floor(+award[2]);
    }

    var retAward = {};
    retAward.award = award;
    retAward.awardType = awardType;
    retAward.awardId = awardId;
    retAward.awardNum = awardNum;

    return retAward;
};

// 解析一次道具组奖励
global.parseGroupAwards = function (award, player) {
    var awards = [];
    if (award[0] != 'group') {
        return awards;
    }

    var groupAwardMod = award[2];   // 奖励模式
    var groupAwardNum = Math.floor(+award[3]);
    var groupId = parseInt(award[1]);

    var tGroupItemWeightInfo = getGroupItemWeightInfo(gConfItemGroupConfig[groupId], player);
    var itemGroupConf = tGroupItemWeightInfo.itemGroupConf;
    var totalOdds = tGroupItemWeightInfo.totalOdds;

    // var itemGroupConf = gConfItemGroupConfig[groupId];
    if (!itemGroupConf || itemGroupConf.length == 0) {
        return awards;
    }

    // var totalOdds = 0;
    // var groupLength = Object.keys(itemGroupConf).length;
    // for (var j = 1; j <= groupLength; j++) {
    //     totalOdds += itemGroupConf[j].weight;
    // }

    if (groupAwardMod == 0) {
        // 随机多次
        for (var j = 0; j < groupAwardNum; j++) {
            var retAward = randomAward(itemGroupConf, totalOdds);
            award = retAward.award;
            awards.push(retAward.award);
        }
    } else if (groupAwardMod == 1) {
        // 随机1次
        var retAward = randomAward(itemGroupConf, totalOdds);
        award = retAward.award;
        award[2] *= groupAwardNum;
        awards.push(award);
    }

    return awards;
};

exports.getGroupItemWeightInfo = getGroupItemWeightInfo = function (itemGroupConf, player) {
    if (!itemGroupConf) {
        return { itemGroupConf: itemGroupConf, totalOdds: 0 };
    }

    var tNewItemGroupConf = {};
    var tTotalOdds = 0;
    var i = 1;

    for (var tKey in itemGroupConf) {
        var tGroupItemConf = itemGroupConf[tKey];
        if (!tGroupItemConf) { continue; }

        var closeType = tGroupItemConf.closeType;
        var closeValue = String(tGroupItemConf.closeValue).split(',');
        var openType = tGroupItemConf.openType;
        var openValue = String(tGroupItemConf.openValue).split(',');

        if (!player) {
            tNewItemGroupConf[i] = tGroupItemConf;
            tTotalOdds = tTotalOdds + tGroupItemConf.weight;
            i++;
            break;
        }

        if (!player.condtionSelect(closeType, closeValue) && player.condtionSelect(openType, openValue)) {
            tNewItemGroupConf[i] = tGroupItemConf;
            tTotalOdds = tTotalOdds + tGroupItemConf.weight;
            i++;
        }
    }
    return { itemGroupConf: tNewItemGroupConf, totalOdds: tTotalOdds };
}

// 解析奖励/消耗配置
global.parseAwardsConfig = function (str) {
    var awards = [];

    var awardStrArr = str.split(',');
    for (var i = 0; i < awardStrArr.length; i++) {
        var arr = awardStrArr[i].split(':');
        var arr2 = arr[0].split('.');

        var award = [];
        if (arr2.length == 2) {
            award[0] = arr2[0];
            award[1] = arr2[1];
            award[2] = +arr[1];
        } else if (arr2.length == 3) {
            award[0] = arr2[0];
            award[1] = arr2[1];
            award[2] = arr2[2];
            award[3] = +arr[1];
        }

        awards.push(award);
    }

    return awards;
};

// 解析奖励/消耗配置
global.parseAwardsConfigByCount = function (str, count) {
    var awards = [];
    if (!count) {
        return awards;
    }

    var awardStrArr = str.split(',');
    for (var i = 0; i < awardStrArr.length; i++) {
        var arr = awardStrArr[i].split(':');
        var arr2 = arr[0].split('.');

        var award = [];
        if (arr2.length == 2) {
            award[0] = arr2[0];
            award[1] = arr2[1];
            award[2] = +arr[1] * count;
        } else if (arr2.length == 3) {
            award[0] = arr2[0];
            award[1] = arr2[1];
            award[2] = arr2[2];
            award[3] = +arr[1] * count;
        }

        awards.push(award);
    }

    return awards;
};

// 提供一个区间数据，和一个参数，判断这个参数落在哪个区间
// key 关键字
// 示例：
// var index = getLocationRegion(gConfCustomCaveAward, 91, 'level');
// var conf = gConfCustomCaveAward[index];
global.getLocationRegion = function (regions, val, key) {
    var curIndex = null;
    for (var i in regions) {
        if (!curIndex) {
            curIndex = parseInt(i);
        }

        if (regions[i][key] > val) {
            break;
        }

        curIndex = parseInt(i);
    }

    return curIndex;
};

// 拷贝一封系统邮件
global.cloneSystemMail = function (mail) {
    var retMail = {};

    retMail.type = mail.type;
    retMail.from = mail.from;
    retMail.title = mail.title;
    retMail.awards = mail.awards;
    retMail.time = mail.time;
    retMail.expire = mail.expire;

    return retMail;
};

// 计算转换率   魔法阵
global.calcMagicRate = function (vip_level, long_card, month_card, week_card) {
    var rate = 0;
    for (var id in gConfexploreMagiConvert) {
        var data = gConfexploreMagiConvert[id];
        if (data.condition == 'vip' && vip_level >= data.value) {
            rate += data.ConvertRatio;
        } else if (data.condition == 'weekCard' && week_card) {
            rate += data.ConvertRatio;
        } else if (data.condition == 'monthCard' && month_card) {
            rate += data.ConvertRatio;
        } else if (data.condition == 'longCard' && long_card) {
            rate += data.ConvertRatio;
        }
    }

    return gConfExploreBase.magicCircleConvertRatio.value + rate;
};

// 额外的提升率
global.calcMagicRateExtra = function (k, magic) {
    var rate = 0;
    var extra = magic.extra;

    if (magic.msg[k]) {
        var lv = extra[k];
        if (lv) {
            var conf = gConfExploreMagicAwardUp[k][lv];
            if (conf) {
                rate = conf.ConvertRatio;
            }
        }
    }

    return rate;
}


// 根据经验值获取等级
global.getRefineLevelByExp = function (quality, exp) {
    var refineConf = gConfEquipRefine[quality];
    if (!refineConf) {
        return 0;
    }

    // 根据当前经验找到当前等级
    var curLevel = 0;
    var totalExp = 0;
    var remainExp = exp;
    for (var level in refineConf) {
        totalExp += refineConf[level].refineExp;

        if (totalExp > exp) {
            curLevel = level - 1;
            break;
        } else {
            remainExp = exp - totalExp;
        }
    }

    if (curLevel == 0 && exp >= totalExp) {
        curLevel = Object.keys(refineConf).max();
    }

    return [curLevel, remainExp];
};

// 获取军团boss开始和结束时间
global.getLegionBossTime = function () {
    var bossTimeStr = gConfGlobalNew.legionBossTime;
    var bossTimeArr = bossTimeStr.split('-');

    var beginTimeArr = bossTimeArr[0].split(':');
    var beginTimeHour = beginTimeArr[0];
    var beginTimeMin = beginTimeArr[1] || '00';

    var endTimeArr = bossTimeArr[1].split(':');
    var endTimeHour = endTimeArr[0];
    var endTimeMin = endTimeArr[1] | '00';

    var todayString = common.getDateString(+(new Date()) / 1000);
    var endTimeString = todayString + ' ' + endTimeHour + ':' + endTimeMin + ':00';
    var startTimeString = todayString + ' ' + beginTimeHour + ':' + beginTimeMin + ':00';

    var startTime = Date.parse(startTimeString) / 1000;
    var endTime = Date.parse(endTimeString) / 1000;

    return [startTime, endTime];
};

// 获取boss刷新时间
global.getTerritoryWarBossTime = function () {
    var strBeginTime = gConfTerritoryWarBase.bossActivityTime.value[0];

    var strBegin = strBeginTime.split(":");
    var begin = new Date();
    begin.setHours(strBegin[0]);
    begin.setMinutes((strBegin[1]));
    begin.setSeconds(0);

    return Math.floor(begin.getTime() / 1000);
};

global.getTerritoryBossEndTime = function () {
    var strEndTime = gConfTerritoryWarBase.bossActivityTime.value[1];

    var strEnd = strEndTime.split(":");
    var end = new Date();
    end.setHours(strEnd[0]);
    end.setMinutes((strEnd[1]));
    end.setSeconds(0);

    return Math.floor(end.getTime() / 1000);
},

    // 根据参数生成礼包参数
    global.formatGiftParam = function (mod, id) {
        var giftCode = mod + '_' + id;

        // 有特殊需求在此添加

        return giftCode;
    };

// 随机符文特殊属性
global.randRuneSpecialAtt = function (id, execpt) {
    var conf = gConfRuneSpecialAttConf[id];
    if (!conf) {
        return [];
    }

    var weights = {};
    for (var i = 1; i <= Object.keys(conf).length; i++) {
        if (execpt && execpt.indexOf(i) < 0) {
            weights[i] = conf[i].weight;
        }
    }

    var randSeq = common.wRand(weights);
    var specialConf = conf[randSeq];

    var attWeights = {};
    attWeights[0] = specialConf.weightMax;
    attWeights[1] = specialConf.vWeight1;
    attWeights[2] = specialConf.vWeight2;
    var attrType = common.wRand(attWeights);

    var ret = [];
    ret[0] = specialConf.attId;
    ret[1] = 0;
    ret[2] = parseInt(randSeq);

    if (attrType == 0) {
        ret[1] = specialConf.attMax;
    } else if (attrType == 1) {
        ret[1] = common.randRange(specialConf.vMin1, specialConf.vMax1);
    } else if (attrType == 2) {
        ret[1] = common.randRange(specialConf.vMin2, specialConf.vMax2);
    }

    return ret;
};

// 判断竞技场是否开启
global.isArenaOpen = function (type, player) {
    var user = player.user;
    var arenaConf = gConfArenaBase[type];
    var limitType = arenaConf.limitType;
    var limitCustom = arenaConf.limitCustom;
    var openValue = arenaConf.limitType * 10000 + arenaConf.limitCustom;
    var myValue = user.battle.progress * 10000 + arenaConf.limitCustom;

    if (player.ispassbattle(arenaConf.limitType, arenaConf.limitCustom)) {
        return true;
    }

    return false;
};

// 获取战斗sign
global.getBattleFightSign = function (battleType, uid, time, star, rand) {
    // 战斗类型battleType = 'tower'
    var signStr = star + '|' + rand + '|' + time + '|' + BATTLE_FIGHT_KEY;
    var sign = common.md5(signStr).slice(0, 10);

    // DEBUG('battle sign = ' + sign);

    return sign;
};

// 获取arena战斗sign
global.getArenaBattleFightSign = function (battleType, uid, time, star, enemyuid) {
    // 战斗类型battleType = 'tower'
    var signStr = battleType + '|' + uid + '|' + time + '|' + star + '|' + enemyuid + '|' + BATTLE_FIGHT_KEY;
    var sign = common.md5(signStr).slice(0, 10);

    // DEBUG('battle sign = ' + sign);

    return sign;
};

global.getQuality = function (custom_king) {
    var quality = 2;    // 一开始是绿色
    if (custom_king.index > 0) {
        //quality = gConfCustomKing[custom_king.chapter][custom_king.index].quality;
    }

    return quality;
};

global.tower_encrypt = function (str, key) {

    // encoding
    var enc = ""
    for (var i = 0; i < str.length; i++) {
        if (i + 1 != str.length) {
            enc = enc + str.charCodeAt(i).toString() + ":"
        } else {
            enc = enc + str.charCodeAt(i).toString()
        }
    }

    var arr = enc.split(":")

    var ret = ""
    for (var i = 0; i < arr.length; i++) {
        var sub = arr[i]

        var ss = ""
        for (var j = 0; j < sub.length; j++) {
            var n = parseInt(sub[j])
            var e = (n ** key[0]) % key[1]

            if (j + 1 == sub.length) {
                ss = ss + e.toString()
            } else {
                ss = ss + e.toString() + ";"
            }
        }

        if (i + 1 == arr.length) {
            ret = ret + ss
        } else {
            ret = ret + ss + ":"
        }
    }

    return ret
};


global.tower_decrypt = function (str, key) {
    var arr = str.split(":")

    var ret = ""
    for (var i = 0; i < arr.length; i++) {
        var sub = arr[i].split(";")

        var ss = ""
        for (var j = 0; j < sub.length; j++) {
            var c = sub[j]
            c = parseInt(c)
            c = c ** key[0] % key[1]
            ss = ss + c.toString()
        }

        ret += String.fromCharCode(parseInt(ss))
    }

    return ret
};

// 玩家穿装备
global.hero_wear = function (player, posObj, pos, equip_item) {

    var eid = equip_item[1];
    var equip = equip_item[2];

    // 如果已经穿了其他的装备，则先卸下来
    var type = gConfEquip[equip.id].type;
    var oldEid = posObj.equip[type];
    if (oldEid) {
        // 需要传承
        var oldEquip = user.bag.equip[oldEid];
        if (oldEquip) {
            oldEquip.pos = 0;
            player.markDirty(util.format('bag.equip.%d.pos', oldEid));
        }
    } else {
        player.memData.equip_num--;
    }

    posObj.equip[type] = eid;
    equip.pos = pos;

    player.markDirty(util.format('pos.%d.equip.%d', pos, type));
    player.markDirty(util.format('bag.equip.%d.pos', eid));

    player.memData.pos[pos].equip_changed[type] = 1;
    if (player.memData.updated_worldwar) {
        player.memData.pos[pos].uni_equip_changed[type] = 1;
    }
}

global.player_wear = function (player, pos, equips) {
    var user = player.user;
    var posObj = user.pos[pos];

    for (var i = 0; i < equips.length; i++) {
        var equip = equips[i];
        if (equip[0] == "equip") {
            hero_wear(player, posObj, pos, equip);
        }
    }

    // 更新套装属性
    player.getSuits(pos);
    player.markFightForceChanged(pos);

    player.doOpenSeven('equipLevel');
    player.doOpenHoliday('equipLevel');
    // player.doOpenSeven('equipStar');
    player.doOpenSeven('equipNum');
    player.doOpenHoliday('equipNum');
}

// 获得运行目录
global.get_svr_dir = function () {
    return path.basename(process.cwd());
}
