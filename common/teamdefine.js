// 错误码
var ErrorCode = {
    ERROR_ARGS_INVALID                              : 1,          // 参数错误
    ERROR_TEAM_NAME_EMPTY                           : 302,          // 队伍名称为空
    ERROR_TEAM_NAME_EXIST                           : 303,          // 队伍名称已经存在
    ERROR_ALREADY_HAS_TEAM                          : 304,          // 玩家已经有队伍了
    ERROR_NOT_TEAM_LEADER                           : 305,          // 不是队长
    ERROR_TEAM_NOT_EXIST                            : 306,          // 队伍不存在
    ERROR_APPLY_LIST_FULL                           : 307,          // 申请列表已满
    ERROR_NOT_APPLY_YET                             : 308,          // 还未申请
    ERROR_LEADER_CAN_NOT_LEAVE                      : 309,          // 队长不能离开队伍
    ERROR_NOT_TEAM_MEMBER                           : 310,          // 不是该队伍成员
    ERROR_BADGE_CAN_NOT_USE                         : 311,         // 徽章未激活
    ERROR_ALREADY_TEAM_LEADER                       : 312,         // 已经是队长了
    ERROR_CAN_NOT_KICK_SELF                         : 313,         // 不能踢出自己
    ERROR_CAN_NOT_IMPEACH_SELF                      : 314,         // 不能弹劾自己
    ERROR_IMPEACH_CONDITION_NOT_ENOUGH              : 315,         // 弹劾条件不满足
    ERROR_MEMBER_LIST_FULL                          : 316,         // 成员列表已满
    ERROR_DAILY_TASK_FULL                           : 317,         // 今日任务数已满
    ERROR_TEAM_NOT_OPEN                             : 318,         // 小队系统未开启
    ERROR_TEAM_NAME_TOO_LONE                        : 319,         // 队伍名字太长
    ERROR_CREATE_COSTS_NOT_ENOUGH                   : 320,         // 创建队伍所需资源不足
    ERROR_NICKNAME_IS_EMPTY                         : 321,         // 昵称不能为空
    ERROR_BULLETIN_IS_EMPTY                         : 322,         // 公告内容不能为空
    ERROR_BULLETIN_TOO_LONE                         : 323,         // 公告内容太长
    ERROR_MODIFY_NAME_COSTS_NOT_ENOUGH              : 324,         // 修改队伍名称所需资源不足
    ERROR_ALREADY_GOT_AWARD                         : 325,         // 已经领取奖励
    ERROR_LAST_JOIN_TIME_TOO_NEAR                   : 326,         // 距离上次加入队伍时间不足12小时
    ERROR_DAILY_TASK_REACH_MAX                      : 327,         // 今日任务已达上限
    ERROR_TASK_ALREADY_ACTIVE                       : 328,         // 该任务已激活
    ERROR_NO_TASK_NEED_RESET                        : 329,         // 没有需要刷新的任务
    ERROR_TASK_RESET_COST_NOT_ENOUGH                : 330,         // 刷新任务所需不足
    ERROR_DAILY_AWARD_COUNT_MAX                     : 331,         // 今日领取的宝箱数已达上限
    ERROR_NO_AWARD_CAN_GET                          : 332,         // 没有可领取的宝箱
    ERROR_HAS_JOIN_OTHER_TEAM                       : 333,         // 已经加入其它队伍
};
exports.ErrorCode = ErrorCode;