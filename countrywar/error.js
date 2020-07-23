// 错误码
var ErrorCode = {
    ERROR_CAN_NOT_REACH                             : 201,          // 不能到达指定城池
    ERROR_CAN_NOT_ENTER                             : 202,          // 不能进入指定城池
    ERROR_IN_PROTECT_TIME                           : 203,          // 城池在保护时间
    ERROR_CAN_NOT_SPECIAL_MOVE                      : 204,          // 不满足突进条件
    ERROR_NO_MATCH_PLAYER                           : 205,          // 没有匹配到玩家
    ERROR_NO_SELF_SIDE_PLAYER                       : 206,          // 没有己方玩家
    ERROR_CAN_NOT_FIND_USER                         : 207,          // 找不到玩家
    ERROR_ALREADY_REPLY_CALL                        : 208,          // 已经响应过的集结令
    ERROR_CALL_NOT_EXIST                            : 209,          // 集结令不存在
    ERROR_CITY_NOT_EXIST                            : 210,          // 目标城池不存在
    ERROR_CALL_OUT_OF_TIME                          : 211,          // 集结令过时
    ERROR_YOU_ARE_DEAD                              : 212,          // 您的角色已死亡
    ERROR_TARGET_CITY_EXIST_CALL                    : 213,          // 目标城池已经有集结令了
    ERROR_TARGET_CITY_IS_NOT_NEIGHBOR               : 214,          // 目标城池与所在城池不相邻
    ERROR_CAN_NOT_FIND_PATH                         : 215,          // 找不到到达路径
    ERROR_MOVE_TIME_NOT_ENOUGH                      : 216,          // 此轮国战结束之前到达不了目标城池，时间不够
    ERROR_HAS_GOT_TASK_AWARD                        : 217,          // 已经领取过任务奖励
    ERROR_TASK_NOT_FINISH                           : 218,          // 任务还没完成
    ERROR_TASK_CONFIG_ERROR                         : 219,          // 任务配置出错，找不到任务数据
    ERROR_IS_IN_COOL_TIME                           : 220,          // 正在冷却中
    ERROR_GOODS_NOT_ENOUGH                          : 221,          // 物资不足
    ERROR_CALL_ITEM_NOT_ENOUGH                      : 222,          // 集结令不足
    ERROR_COUNTRY_WAR_NOT_OPEN                      : 223,          // 国战未开启
    ERROR_NOT_COUNTRY_WAR_TIME                      : 224,          // 不是国战时间
    ERROR_COUNTRY_POSITION_NOT_ENOUGH               : 225,          // 官职不满足要求
    ERROR_CASH_NOT_ENOUGH                           : 226,          // 元宝不足，无法发布召集令
    ERROR_CITY_IN_FIGHT                             : 227,          // 当前城池处于战斗状态
    ERROR_CALL_COUNT_MAX                            : 228,          // 集结令数量已达上限
    ERROR_CITY_IS_IN_FIGHT                          : 229,          // 城池处于战斗状态
    ERROR_SERVER_OPEN_DAYS_NOT_ENOUGH               : 230,          // 服务器开服天数不满足
    ERROR_ROOM_NOT_OPEN                             : 231,          // 房间还没开启
    ERROR_USER_LEVEL_NOT_ENOUGH                     : 232,          // 玩家等级不足
    ERROR_READY_TIME                                : 233,          // 准备阶段
};
exports.ErrorCode = ErrorCode;

// 错误描述
var ErrorSring = {
    '201'         : 'can not reach target city',
    '202'         : 'can not enter target city',
    '203'         : 'city in protect time',
};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};

// 事件类型
var EventType = {
    EVENT_KILL_PLAYER_1         : 1,    // **击败了**
    EVENT_KILL_PLAYER_2         : 2,    // **击败了**
    EVENT_KILL_PLAYER_3         : 3,    // **击败了**
    EVENT_BACK_TO_CITY          : 4,    // 撤军
    EVENT_BROADCAST_CALL        : 5,    // 发布号令
    EVENT_OCCUPY_CITY           : 6,    // 占领城池
    EVENT_BEAT_BACK_ENEMY       : 7,    // 击退敌方阵营
};
exports.EventType = EventType;