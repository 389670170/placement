// 错误码
var ErrorCode = {
    ERROR_NO_TEAM : 201,      // 不是领主

};

exports.ErrorCode = ErrorCode;

// 错误描述
var ErrorSring = {

};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};