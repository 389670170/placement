module.exports = function (player, mod, act, args, name, num,update_before,update_later) {
    // var modLogConf = gConfLog[mod];
    // var logConf = null;
    // if (modLogConf) {
    //     logConf = modLogConf[act];
    // }

    var logConf = null;
    var logIndexConf = null;
    var modAct = mod + '_' + act;

    var index = null; // 物品唯一ID
    var way = null; // 获取唯一ID的方式
    var numIndx = null; // 获取数量的请求字段
    var number = 1; // 本次请求交易数量

    //判断该请求数据中是否存在物品ID，存在则需取logindex表中对应ID
    if (gConfLogIndex[modAct]) {
        logIndexConf = gConfLogIndex[modAct];
        way = logIndexConf.way;                     //获取ID方式
        numIndx = logIndexConf.numIndex;
    }
    else {
        numIndx = 'no'; //无数量ID，则该请求对应一次交易，默认为no
        index = 0;  //无物品ID，则该请求对应单一物品，默认ID为0
    }
    // 判断是可选择交易次数的请求则记录次数
    if (numIndx != 'no') {
        number = args[numIndx];
    }

    //方式1 将args中对应字段拼接成唯一ID
    if (way == 1) {
        index = args[logIndexConf.index1].toString() + args[logIndexConf.index2].toString();
        if (logIndexConf.index3) {
            index = index + args[logIndexConf.index3].toString();
        }
    }
    //方式2 将args中对应字段当作唯一ID
    if (way == 2) {
        index = args[logIndexConf.onlyIndex].toString();
    }

    //根据请求与唯一标识获取log表中对应信息
    if (gConfLog[modAct] && gConfLog[modAct][index]) {
        logConf = gConfLog[modAct][index];
    }

    // 特殊处理部分内容
    // 英雄商店
    if (modAct == 'shop_buy' && !gConfLog[modAct][index]) {
        logConf = gConfLog[modAct]['0'];
    }

    //DEBUG('cost log mod = ' + mod + ', act = ' + act + ', name = ' + name + ', num = ' + num);
    // if (logConf) {
        var costName =logConf? logConf.costName1:modAct;

        //DEBUG('costName = ' + costName);
        if (costName) {
            var quantity = args.num ? args.num : 0;
            if (!quantity) {
                quantity = args.count ? args.count : 0;
            }
            args = {
                sid: config.DistId,
                openid: player.user.info.account,
                level: player.user.status.level,
                type: name,
                typeName: gConfGeneralText[gConfUser[name].logName].text,
                costName: costName,
                costValue: num,
                number: number,
                update_before:update_before,
                update_later:update_later,
            };
            LogCollect(player.uid, 'user_cost',args);
            // var phpResp = {};
            // var phpReq = {
            //     uid : player.uid,
            //     act : 'user_cost',
            //     args : {
            //         sid: config.DistId,
            //         openid: player.user.info.account,
            //         level: player.user.status.level,
            //         type: name,
            //         typeName : gConfGeneralText[gConfUser[name].logName].text,
            //         costName: costName,
            //         costValue: Math.abs(num),
            //         number:number,
            //     },
            // };
            // requestPHP(phpReq, phpResp, function () {
            //     DEBUG(phpResp.desc);
            // });
        // }
    }
}
