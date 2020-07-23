// 错误码
var ErrorCode = {


};
exports.ErrorCode = ErrorCode;

// 错误描述
var ErrorSring = {

};

// 查找错误描述
exports.findErrorString = function(code) {
    return ErrorSring[code + ''] || code;
};