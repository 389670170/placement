// ----------------------------------------------------------------------------
// 签到 2020-04-15
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// local
const common = require('../common.js');

const act_name = "help_equip";

function get_default_act_data() {
    return {
        'used_count_dict': {                       // 对应类型援助过的次数

        },
    }
}

/**
 * 获取数据
 * @param {*} player 
 */
function get_data(player) {
    if (!player) { return; }
    let user = player.user;

    let tUserActInfo = user.activity[act_name];
    if (!tUserActInfo || tUserActInfo.open_day != gConfActivities[act_name].startTime) {
        user.activity[act_name] = get_default_act_data();
        user.activity[act_name].open_day = gConfActivities[act_name].startTime;
    }

    player.markDirty(`activity.${act_name}`);
    tUserActInfo = user.activity[act_name];

    return tUserActInfo;
}

/** 获取对应的装备列表 */
function get_equip_conf_dict(player, eid_list) {
    let tResult = [];
    eid_list = eid_list || [];
    let tEquipBag = (player && player.user && player.user.bag) ? player.user.bag.equip : {};
    for (let i = 0; i < eid_list.length; i++) {
        let eid = eid_list[i];
        let tEquipData = tEquipBag[eid];
        if (!tEquipData) { continue; }
        if (tEquipData.hid > 0) { continue; }                        // 装备中的不能替换
        let tEquipConf = gConfEquip[tEquipData.id];
        if (!tEquipConf) { continue; }                          // 目标装备没有对应的配置信息
        tResult.push({ id: tEquipData.id, grade: tEquipData.grade, eid: eid, conf: tEquipConf });
    }

    return tResult;
}

// ----------------------------------------------------------------------------
// export

//-----------------------------------------------------------------------
exports.init = function () {
}

/** 服务器启动时 创建用户数据 player.js中会自动调用 */
exports.init_user_data = function (user) {
    if (!user) { return; }
    user.activity = user.activity || {};
    user.activity[act_name] = get_default_act_data();
};

/** 更新用户数据 upgrade.js中需要添加到upgrades列表中 */
exports.upgrade = function (player) {
    get_data(player);
};

/** 登陆时触发 */
exports.reset_by_login = function (player) {
    get_data(player);
}

/** 循环 每秒一次 */
exports.update = function (now) {
}

/** 每日的重置函数 player.js中会自动调用 */
exports.reset_by_day = function (player, today) {
};

/** 是否有奖励可领取 */
exports.has_reward = function (player) {
    // let user = player.user;
    // do {
    // let tUserActInfo = get_data(player);
    // let tTotalCanGetTimes = total_can_get_times(player);
    // if (tTotalCanGetTimes - tUserActInfo.get_count) {
    //     player.addTip(act_name);
    // }
    // else {
    //     player.rmTip(act_name);
    // }
    // } while (false);
    return false;
}

// ----------------------------------------------------------------------------
// export for request


/**
 * 获取内容
 */
exports.get_info = function (player, req, resp, onHandled) {
    do {
        let tUserActInfo = get_data(player);
        resp.data.act_info = tUserActInfo;
    } while (false);

    onHandled();
};

/**
 * 锻造
 */
exports.help = function (player, req, resp, onHandled) {
    let user = player.user;
    do {
        let tUserActInfo = get_data(player);
        let tID = req.args.id;
        let tEquipList = req.args.eid_list;

        let config = gConfHelpEquip[tID];                           // 没有对应配置
        if (!config) {
            resp.code = 1;
            resp.desc = 'config error';
            break;
        }

        let tEIDConfList = get_equip_conf_dict(player, tEquipList);
        let tCostEquip = config.lossequip;
        let costs = [];
        let tUsedIdxList = [];
        let tCostEquipCount = 0;
        for (let i = 0; i < tCostEquip.length; i++) {
            if (!tCostEquip[i]) { continue; }
            let tID = tCostEquip[i][1];
            let tGrade = tCostEquip[i][2];
            let tEquipCount = tCostEquip[i][3] || 0;
            for (let k = 0; k < tEquipCount; k++) {
                tCostEquipCount = tCostEquipCount + 1;
                for (let j = 0; j < tEIDConfList.length; j++) {
                    if (!tEIDConfList[j]) { continue; }
                    if (tEIDConfList[j].id != tID) { continue; }
                    if (tEIDConfList[j].grade != tGrade) { continue; }
                    if (tUsedIdxList.indexOf(j) != -1) { continue; }
                    tUsedIdxList.push(j);
                    costs.push(['equip', tEIDConfList[j].eid, -1]);
                }
            }
        }

        if (costs.length < tCostEquipCount) {                     // 选中的消耗数量与需求的消耗数量不相同
            resp.code = 1;
            resp.desc = 'select error';
            break;
        }

        costs = costs.concat(config.lossawards1);
        costs = costs.concat(config.lossawards12);

        tUserActInfo.used_count_dict[tID] = (tUserActInfo.used_count_dict[tID] || 0) + 1;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(config.gainequip, req.mod, req.act);
        resp.data.act_info = tUserActInfo;
        player.markDirty(`activity.${act_name}`);
    } while (false);

    onHandled();
};