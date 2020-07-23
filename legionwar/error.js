// 错误码
var ErrorCode = {
    ERROR_DB_ERROR                                  : 101,        // 数据库出错
    ERROR_STAGE_NOT_FIT                             : 102,        // 服务器不在合适的阶段
    ERROR_FIRST_ROUND_NOT_YET_START                 : 103,        // 第一轮还没开始
    ERROR_UPGRADE_CITYBUF_MAX                       : 104,        // 已经增筑到最大等级
    ERROR_PLAYER_GARRION_TIME_USE_UP                : 105,        // 驻守次数用光
    ERROR_PLAYER_ALREADY_GARRION_THIS_CITY          : 106,        // 该玩家已经在该城市驻守
    ERROR_CITY_ARM_ALREADY_GASSION                  : 107,        // 该位置已经有人了
    ERROR_PLAYER_NOT_GARRION_THIS_CITY              : 108,        // 玩家没有驻守在这个位置
    ERROR_PLAYER_NOT_IN_OWN_LEGION                  : 109,        // 玩家不属于本军团
    ERROR_ARM_IS_DEAD                               : 110,        // 敌方已经阵亡
    ERROR_ARM_IS_UNDERATTACK                        : 111,        // 敌方正在被攻击
    ERROR_BATTLE_TIMEOUT                            : 112,        // 战斗超时
    ERROR_NOT_THE_ATTACKER                          : 113,        // 不是攻击者
    ERROR_CITY_CAN_NOT_ATTACK                       : 114,        // 城池不能攻击
    ERROR_INVALID_ARGS                              : 115,        // 参数错误
    ERROR_ARM_IS_NOT_DARK                           : 116,        // 目标不是一个暗格
    ERROR_CITY_ALREADY_CAN_ATTACK                   : 117,        // 目标城池已经可以攻击
    ERROR_CITY_IS_ALIVE                             : 118,        // 城池还活着
    ERROR_LEGION_DONT_HAVE_USER                     : 119,        // 该军团没有这个玩家
    ERROR_STAGE_NOT_EQUAL                           : 120,        // 服务器间状态不一致
    ERROR_PLAYER_ALREADY_UPGRADE_THIS_CITY          : 121,        // 该玩家已经在该城市增筑
    ERROR_PLAYER_ALREADY_GOT_LEGIONWAR_SCORE        : 122,        // 该玩家已经领取完个人贡献
    ERROR_PLAYER_NO_BUFF_CITY                       : 123,        // 该玩家没有正在增筑的城池
    ERROR_CARD_USE_MAX                              : 124,        // 卡牌使用达到上限
    ERROR_NO_SUCH_CARD                              : 125,        // 找不到此卡
    ERROR_CARD_NOT_ENOUGH                           : 126,        // 卡牌不足
    ERROR_NEW_MEMBER_CAN_NOT_USE                    : 127,        // 新加入的成员不能使用卡牌
    ERROR_NO_SUCH_LEGION                            : 128,        // 找不到指定军团
    ERROR_IDLE_CANNOT_ENTER_BATTLE                  : 129,        // 休战阶段不能进入战场
    ERROR_ATTACK_NUM_LIMIT                          : 130,        // 攻击次数不足
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
    '121'         : 'Player already upgrade this city',
    '122'         : 'Player already got legionwar score',
    '123'         : 'can not find player',
    '124'         : 'card use count reach max',
    '125'         : 'no such card',
    '126'         : 'card not enough',
    '127'         : 'new member can not use card',
    '128'         : 'no such legion',
    '129'         : 'idle cannot enter battle',
    '130'         : 'No attack num',
};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};

var StageType = {
    INVALID: 0,    // 无效
    PREPARE: 1,    // 准备阶段
    FIGHT: 2,      // 战斗阶段
    IDLE: 3,       // 休战阶段
    NOT_JOIN: 4,   // 未参与，军团等级不足
};

exports.StageType = StageType;