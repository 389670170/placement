// 错误码
var ErrorCode = {
    ERROR_TRANSFER_COUNT_NOT_ENOUGH     : 201,  // 传送次数不足
    ERROR_TARGET_CELL_HAS_ENEMY         : 202,  // 目标关隘上有敌方玩家
    ERROR_YOU_ARE_IN_FIGHT_STATE        : 203,  // 您处于战斗状态
    ERROR_CITY_NOT_VISIT                : 204,  // 关隘未访问
    ERROR_USER_NOT_FOUND                : 205,  // 未找到玩家信息
    ERROR_EMPTY_CELL                    : 206,  // 空格子
    ERROR_CAN_NOT_FIND_CELL_INFO        : 207,  // 找不到格子信息
    ERROR_TRANSFER_TARGET_ERROR         : 208,  // 传送目标错误，不在敌人列表里
    ERROR_TRANSFER_NOT_OPEN             : 209,  // 传送还没开，访问的石碑还不足3个
    ERROR_TARGET_NOT_IN_NEIGHBOR_CELL   : 210,  // 目标不在相邻格子里
    ERROR_NOT_CONTAIN_THIS_LID          : 211,  // 敌人列表里面没有当前领地
    ERROR_CELL_HAS_GATHER               : 212,  // 格子已经采集过
    ERROR_CAN_NOT_OCCUPY_ENEMY_MINE     : 213,  // 不能占领地方领地的矿
    ERROR_TARGET_CELL_IS_NOT_MINE       : 214,  // 目标格子不是矿
    ERROR_TARGET_MINE_HAS_OCCUPY        : 215,  // 目标矿已经被占领
    ERROR_CAN_NOT_ROB_SELF_MINE         : 216,  // 不能掠夺自己领地的矿
    ERROR_TARGET_MINE_HAS_ROB           : 217,  // 已经掠夺过目标矿
    ERROR_TARGET_CELL_IS_NOT_CREATURE   : 218,  // 目标格子不是怪
    ERROR_CAN_NOT_FIND_CREATURE_INFO    : 219,  // 找不到怪物信息
    ERROR_SHARE_MONSTER_IS_DEAD         : 220,  // 共享怪物已死亡
    ERROR_PRIVATE_MONSTER_IS_DEAD       : 221,  // 个人怪物已死亡
    ERROR_CAN_NOT_FIND_TARGET_PLAYER    : 222,  // 找不大目标玩家
    ERROR_CAN_NOT_ATTACK_LEGION_MEMBER  : 223,  // 不能攻击本军团成员
    ERROR_TARGET_IS_IN_FIGHT_STATE      : 224,  // 目标处于战斗状态
    ERROR_AWARD_HAS_GOT                 : 225,  // 奖励已领取
    ERROR_ACHIEVEMENT_NOT_FINISH        : 226,  // 成就未达成
    ERROR_HAS_EXPLORE                   : 227,  // 已经有已经在探索了，只能同时探索一个
    ERROR_CELL_NOT_VISITED              : 228,  // 格子未访问过
    ERROR_ACTION_POINT_NOT_ENOUGH       : 229,  // 您的体力不足
    ERROR_STAYING_POWER_NOT_ENOUGH      : 230,  // 您的耐力不足
    ERROR_MATERIAL_NOT_ENOUGH           : 231,  // 无尽傀儡数量不足
    ERROR_CASH_NOT_ENOUGH               : 232,  // 元宝不足
    ERROR_BUY_ACTION_COUNT_NOT_ENOUGH   : 233,  // 购买体力次数不足
    ERROR_CAN_NOT_FIND_RELIC            : 234,  // 未获得遗迹
    ERROR_RELIC_NUM_NOT_ENOUGH          : 235,  // 遗迹数量不足
    ERROR_RELIC_IS_ALREADY_STARTED      : 236,  // 遗迹正在探索中
    ERROR_TERRITORY_NOT_OPEN            : 237,  // 领地战未开启
    ERROR_TRANSFER_FUNC_NOT_OPEN        : 238,  // 传送功能未开启
    ERROR_PATH_HAS_ENEMY                : 241,  // 路上有敌人
    ERROR_NOT_BOSS_CHALLENGE_TIME       : 242,  // 不在活动时间段，无法挑战
    ERROR_NOT_SEC_KILL                  : 243,  // 不能碾压
    ERROR_USER_LEVEL_NOT_ENOUGH         : 244,  // 等级不足
    ERROR_LEGION_LEVEL_NOT_ENOUGH       : 245,  //

};
exports.ErrorCode = ErrorCode;

// 错误描述
var ErrorSring = {
    '101'         : 'DB error',
    '102'         : 'Stage not fit',
    '103'         : 'First round not yet start',
    '104'         : 'Upgrade city buffer to max',
    '105'         : 'Player garrion time used up',
    '106'         : 'Player already garrion this city',
    '107'         : 'Arm alreay garrion',
    '108'         : 'Player not garrion this arm',
    '109'         : 'Player not in own legion',
    '110'         : 'Arm is dead',
    '111'         : 'Arm is underattack',
    '112'         : 'Battle timeout',
    '113'         : 'Not the attacker',
    '114'         : 'City can not attack',
    '115'         : 'Invalid args',
    '116'         : 'Target is not dark',
    '117'         : 'Target city already can attack',
    '118'         : 'City is alive',
    '119'         : 'Legion do not have user',
    '120'         : 'Stage not equal',
};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};

// 事件类型
var EventType = {
    EVENT_VISIT_OUR_STELE       : 1,    // 访问自己领地石碑
    EVENT_VISIT_OTHER_STELE     : 2,    // 访问其他领地石碑
    EVENT_MINE_WAS_ROBED        : 3,    // 矿点被掠夺
    EVENT_TRANSFER_OPEN         : 4,    // 传送门开启
    EVENT_MATCH_ENEMY           : 5,    // 匹配到敌人T
    EVENT_ACTIVE_WATCH_TOWER    : 6,    // 激活哨塔
    EVENT_OCCUPY_MINE           : 7,    // 占领矿
    EVENT_DEFEAT_ENEMY_IN_OUR_CITY  : 8,    // 在己方领地击败敌人
    EVENT_WAS_DEFEAT_BY_IN_OTHER_CITY    : 9,    // 在敌方领地被敌人击败
    EVENT_WAS_DEFEAT_BY_IN_OUR_CITY : 10,   // 在我方领地被击败
    EVENT_ROB_MINE  : 11,   // 掠夺矿
};
exports.EventType = EventType;