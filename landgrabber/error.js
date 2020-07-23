// 错误码
var ErrorCode = {
    ERROR_NOT_VILLAGE_OWNER : 201,      // 不是领主
    ERROR_IN_PROTECT_TIME : 202,        // 在保护时间内
    ERROR_HAS_OCCUPY_LAND : 203,        // 已经占了一块地了
    ERROR_LAND_REMAIN_TIME_ZERO : 204,       // 地块剩余时间为0
    ERROR_NO_TEAM : 205,                // 没有队伍
    ERROR_HAS_OCCUPY_VILLAGE : 206,     // 已经占领了一个村庄了
    ERROR_OCCUPY_VILLAGE_COST_NOT_ENOUGH : 207, //  占领村庄资源不足
    ERROR_VILLAGE_NOT_RELEASE : 208,    // 村庄还未解救
    ERROR_OCCUPY_LAND_COST_NOT_ENOUGH : 209,    // 占地凭证不足
    ERROR_OCCUPY_CONFLICT : 210,    // 当前占领操作冲突
};

exports.ErrorCode = ErrorCode;

// 错误描述
var ErrorSring = {

};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};