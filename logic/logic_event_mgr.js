var event_call = {};

/**
 * 添加侦听
 * @param {string} event        侦听的事件
 * @param {function} call_back  侦听的回调函数
 * @param {boolean} repeatable  是否可以重复侦听
 */
exports.on = function (event, call_back, repeatable) {
    event_call[event] = event_call[event] || [];
    if (event && call_back) {
        if (repeatable || (event_call[event].indexOf(call_back) == -1)) {
            event_call[event].push(call_back);
        }
    }
    return true;
};

exports.emit = function (event, ...args) {
    var tFuncList = event_call[event];
    LOG(" event emit : " + event + "[" + args.toString() + "] call count " + (tFuncList ? tFuncList.length : 0));
    if (!tFuncList || tFuncList.length <= 0) { return; }
    for (var i = 0; i < tFuncList.length; i++) {
        var tFunc = tFuncList[i];
        if (!tFunc) { return; }
        tFunc.apply(this, args);
    }
};

exports.clean_event = function (event, call_back) {
    if (event) {
        if (!event_call[event]) {

        }
        else if (call_back) {
            var tIdx = event_call[event].indexOf(call_back);
            if (tIdx != -1) {
                event_call[event].splice(tIdx, 1);
            }
        }
        else {
            delete event_call[event];
        }
    }
    else {
        event_call = {};
    }
}

exports.init = function () {
    exports.clean_event();
}

/** 初始化优先级 */
exports.init_priority = 1;

exports.EVENT = {
    SPEED_UP: "speed_up",                   // 挂机加速 
    GET_GOBLIN: "get_goblin",               // 捕获哥布林
    DIGGING_BOX: "digging_box",             // 领取龙晶洞穴宝箱 宝箱等级
    MAKE_HERO_UP: "make_hero_up",           // 合成英雄 合成的英雄等级
    ON_PAY: "on_pay",                       // 触发支付操作 cash, chargeId, gift_key, gift_id
    PLAYER_RECRUIT: "player_recruit",       // 用户招募 type 1为普通 2为高级
    GET_MAIL: "get_mail",                   // 用户领取邮件 mail
    ABYSS_PROGRESS: "abyss_progress",       // 深渊世界 通关 progress:关卡数 star:星数 is_first:是否为首通
    ABYSS_GET_BOX: "abyss_get_box",         // 深渊世界 获取宝箱  id:宝箱id
    COST_MIX_CASH: "cost_mix_cash",         // 消耗钻石（任何颜色）  num:数量
}