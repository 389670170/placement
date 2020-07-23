// 错误码
var ErrorCode = {
    ERROR_INTENSIFY_COST_NOT_ENOUGH: 501,        // 强化材料不足
    ERROR_REFINE_COST_NOT_ENOUGH: 502,        // 精炼材料不足
    ERROR_MAX_INTENSIFY_LEVEL: 503,    // 强化等级已达最高
    ERROR_MAX_REFINE_LEVEL: 504,       // 精炼等级已达最高
};

function equitInfoToWorld(user) {
    var data = {};

    for (var p in user.pos) {
        var posEquip = user.pos[p].equip;
        for (var type in posEquip) {
            var eid = posEquip[type];
            if (eid != 0) {
                if (user.bag.equip[eid]) {

                    if (!data[p]) {
                        data[p] = { 'equip': {} };
                    }
                    data[p].equip[type] = {
                        id: user.bag.equip[eid].id,
                        grade: user.bag.equip[eid].grade,
                        intensify: user.bag.equip[eid].intensify,
                        refine_exp: user.bag.equip[eid].refine_exp,
                    };

                } else {
                    DEBUG('eid not exist, eid = ' + eid);
                }
            }
        }
    }
    var args = {};
    args.data = data;
    var req = {
        mod: 'user',
        act: 'updateEquitInfo',
        uid: user.info.uid,
        args: args,
    };
    requestWorld(req, {}, function () {

    });

}

// 拆解
exports.dismantling = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var sid = req.args.sid;
        var sidOk = 'true';
        var equip = user.bag.equip[sid];

        if (!equip || equip.god || equip.pos || !gConfEquip[equip.id].isAncient) {
            sidOk = false;
            resp.code = 1; resp.desc = 'sid error' + sid;
            break;
        }
        if (!sidOk) {
            break;
        }

        var conf = gConfEquip[equip.id];
        if (conf.dismantlingAward.length == 0) {
            resp.code = 1; resp.desc = 'no dismantling'; break;
        }

        var costs = [['user', 'gold', -gConfEquip[equip.id].dismantlingCost]];
        costs.push(['equip', sid, -1]);
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'gold not enough'; break;
        }

        var awards = conf.dismantlingAward.slice();
        if (equip.gems) {
            for (var slot in equip.gems) {
                awards.push(['gem', equip.gems[slot], 1]);
            }
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 小兵装备合成
exports.merge_dress = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var did = req.args.did;
        var num = Math.floor(req.args.num);
        if (isNaN(did) || isNaN(num) || num < 1) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfSoldierDress[did];
        if (!conf) {
            resp.code = 1; resp.desc = 'no such did'; break;
        }

        if (!conf.mergeNum) {
            resp.code = 1; resp.desc = 'no merge'; break;
        }

        var costs = [
            ['dress', did, -conf.mergeNum * num],
            ['user', 'gold', -conf.mergeGold * num],
        ];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough'; break;
        }

        var awards = timeAwards(conf.mergeAward, num);
        awards = reformAwards(awards);

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 装备强化
exports.intensify = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var eid = +req.args.eid;
        var toLevel = +req.args.to_level;   // 强化到多少级
        var equip = user.bag.equip[eid];
        if (!equip) {
            resp.code = 1; resp.desc = 'no the equip'; break;
        }

        var equipConf = gConfEquip[equip.id];
        if (!equipConf) {
            resp.code = 1; resp.desc = 'no the equip conf'; break;
        }

        var equipBaseConf = gConfEquipBase[equipConf.type][equipConf.quality];
        if (!equipBaseConf) {
            resp.code = 1; resp.desc = 'no the equip base conf'; break;
        }

        // 是否已强化到顶级
        var maxLevel = Object.keys(gConfEquipUpgrade).max();
        if (equip.intensify >= maxLevel) {
            resp.code = ErrorCode.ERROR_MAX_INTENSIFY_LEVEL; resp.desc = 'already max level'; break;
        }

        // 检查目标等级是否超过了最大等级
        if (toLevel > maxLevel) {
            resp.code = ErrorCode.ERROR_MAX_INTENSIFY_LEVEL; resp.desc = 'to level too big'; break;
        }

        // 检查材料是否满足
        var equipQuality = equipConf.quality;
        var curLevel = equip.intensify;
        var nextLevel = curLevel + 1;
        var costs = [];
        var costValid = true;
        for (var level = toLevel; level > curLevel; level--) {
            var nextIntensifyConf = gConfEquipUpgrade[level];
            var levelCosts = nextIntensifyConf['cost' + equipQuality];
            if (!levelCosts) {
                costValid = false;
                break;
            }

            costs = costs.concat(levelCosts);
        }

        if (!costValid) {
            resp.code = 1; resp.desc = 'cost is invalid'; break;
        }

        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_INTENSIFY_COST_NOT_ENOUGH; resp.desc = 'cost is not enough'; break;
        }

        equip.intensify = toLevel;
        player.markDirty(util.format('bag.equip.%d', eid));

        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        var pos = equip.pos;
        if (pos > 0) {
            player.markFightForceChanged(pos);
        }

        player.doDailyTask('equipUpgrade', 1);
        // 引导任务
        player.doGuideTask('equipUpgrade', 1);
        player.doOpenSeven('equipUpgrade', 1);
        player.doOpenHoliday('equipUpgrade', 1);
        //强制同步玩家数据到world服
        equitInfoToWorld(user);
    } while (false);

    onHandled();
};

// 一键强化
exports.intensify_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        if (!pos) {
            resp.code = 1; resp.desc = 'pos needed'; break;
        }

        // 判断是否开启一键强化
        if (!isModuleOpen_new(player, 'oneKeyEquipUpgrade')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var posObj = user.pos[pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        // 最高强化等级
        var maxLevel = Object.keys(gConfEquipUpgrade).max();

        var equipArr = {};
        for (var k in posObj.equip) {
            var eid = posObj.equip[k];
            if (eid > 0) {
                var equipObj = clone(user.bag.equip[eid]);
                if (equipObj && equipObj.intensify < maxLevel) {
                    equipObj.eid = eid;
                    equipArr[k] = equipObj;
                }
            }
        }

        // 没有需要强化的装备
        if (Object.keys(equipArr).length == 0) {
            resp.code = ErrorCode.ERROR_MAX_INTENSIFY_LEVEL; resp.desc = 'all max level'; break;
        }

        var confError = false;      // 配置错误
        var allMaxLevel = false;    // 是否所有装备都到顶级了
        var goldLack = false;       // 是否金币不足
        var costs = [];

        while (!allMaxLevel && !goldLack) {
            // 找强化等级最低的那个装备
            var min = 999;
            var minIndex = 0;
            for (var k in equipArr) {
                if (equipArr[k].intensify < min) {
                    min = equipArr[k].intensify;
                    minIndex = parseInt(k);
                }
            }

            if (min >= maxLevel) {
                allMaxLevel = true;
                break;
            }

            var toLevel = min + 1;
            var conf = gConfEquipUpgrade[toLevel];

            // 判断君主等级限制
            if (conf.limit > user.status.level) {
                allMaxLevel = true;
                break;
            }

            var equipConf = gConfEquip[equipArr[minIndex].id];
            if (!equipConf) {
                confError = true;
                break;
            }

            var equipQuality = equipConf.quality;
            var levelCosts = conf['cost' + equipQuality];
            if (!levelCosts) {
                confError = true;
                break;
            }

            var preCosts = clone(costs);
            preCosts = preCosts.concat(levelCosts);
            preCosts = reformAwards(preCosts);
            if (!player.checkCosts(preCosts)) {
                goldLack = true;
                break;
            }

            equipArr[minIndex].intensify += 1;
            costs = costs.concat(levelCosts);
            costs = reformAwards(costs);
        }

        if (confError) {
            resp.code = 1; resp.desc = 'conf error'; break;
        }

        if (allMaxLevel && costs.length == 0) {
            resp.code = ErrorCode.ERROR_MAX_INTENSIFY_LEVEL; resp.desc = 'all max level'; break;
        }

        if (goldLack && costs.length == 0) {
            resp.code = ErrorCode.ERROR_INTENSIFY_COST_NOT_ENOUGH; resp.desc = 'gold not enough'; break;
        }

        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_INTENSIFY_COST_NOT_ENOUGH; resp.desc = 'gold not enough'; break;
        }

        resp.data.equip = {};
        for (var k in equipArr) {
            var eid = equipArr[k].eid;
            user.bag.equip[eid].intensify = equipArr[k].intensify;
            player.markDirty(util.format('bag.equip.%d.intensify', eid));
            resp.data.equip[eid] = equipArr[k].intensify;
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        player.doDailyTask('equipUpgrade', 1);
        player.doGuideTask('equipUpgrade', 1);
        player.doOpenSeven('equipUpgrade', 1);
        player.doOpenHoliday('equipUpgrade', 1);
        equitInfoToWorld(user);

        if (pos > 0) {
            player.markFightForceChanged(pos);
        }
    } while (false);

    onHandled();
};

// 装备精炼
exports.refine = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var eid = +req.args.eid;
        var item = req.args.item;
        var equip = user.bag.equip[eid];
        if (!equip) {
            resp.code = 1; resp.desc = 'no the equip'; break;
        }

        var equipConf = gConfEquip[equip.id];
        if (!equipConf) {
            resp.code = 1; resp.desc = 'no the equip conf'; break;
        }

        var equipBaseConf = gConfEquipBase[equipConf.type][equipConf.quality];
        if (!equipBaseConf) {
            resp.code = 1; resp.desc = 'no the equip base conf'; break;
        }

        // 是否已精炼到顶级
        var refineConf = gConfEquipRefine[equipConf.quality];
        if (!refineConf) {
            resp.code = 1; resp.desc = 'no the refine conf'; break;
        }

        // 根据当前经验找到当前等级
        var curLevel = getRefineLevelByExp(equipConf.quality, equip.refine_exp)[0];
        var maxLevel = Object.keys(refineConf).max();
        if (curLevel >= maxLevel) {
            resp.code = ErrorCode.ERROR_MAX_REFINE_LEVEL; resp.desc = 'already max level'; break;
        }

        // 计算要增加的经验值
        var addExp = 0;
        var allCosts = [];
        var connfigValid = true;    // 配置是否正确
        for (var costsId in item) {
            if (!gConfItem[costsId]) {
                resp.code = 1; resp.desc = 'invaild args'; connfigValid = false; break;
            }

            if (gConfItem[costsId].useType != 'partexp') {
                resp.code = 1; resp.desc = 'item use type error'; connfigValid = false; break;
            }

            var costsNum = item[costsId]
            var costs = ['material', costsId, -costsNum];
            allCosts.push(costs);
            addExp += costsNum * gConfItem[costsId].useEffect;
        }

        if (!connfigValid) {
            break;
        }

        // 检查材料是否满足
        if (!player.checkCosts(allCosts)) {
            resp.code = ErrorCode.ERROR_REFINE_COST_NOT_ENOUGH; resp.desc = 'material not enough'; break;
        }

        if (addExp == 0) {
            resp.code = 1; resp.desc = 'no material is consumed'; break;
        }

        var newExp = equip.refine_exp + addExp;
        var newLevel = getRefineLevelByExp(equipConf.quality, newExp)[0];

        equip.refine_exp = newExp;
        player.markDirty(util.format('bag.equip.%d', eid));

        resp.data.costs = player.addAwards(allCosts, req.mod, req.act);
        resp.data.new_exp = newExp;
        resp.data.new_level = newLevel;

        var pos = equip.pos;
        if (pos > 0) {
            player.markFightForceChanged(pos);
        }

        player.doGuideTask('equipRefine', 1);
        player.doOpenSeven('equiprefine', 1);
        player.doOpenHoliday('equiprefine', 1);
        equitInfoToWorld(user);
    } while (false);

    onHandled();
};

// 一键精炼
exports.refine_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        if (!pos) {
            resp.code = 1; resp.desc = 'pos needed'; break;
        }

        // 判断是否开启一键强化
        if (!isModuleOpen_new(player, 'oneKeyEquipRefine')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var posObj = user.pos[pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var equipArr = {};
        for (var k in posObj.equip) {
            var eid = posObj.equip[k];

            if (eid > 0) {
                var equipObj = clone(user.bag.equip[eid]);
                if (equipObj) {
                    equipObj.eid = eid;

                    var equipConf = gConfEquip[equipObj.id];
                    var refineConf = gConfEquipRefine[equipConf.quality];
                    var maxLevel = Object.keys(refineConf).max();

                    var curLevel = getRefineLevelByExp(equipConf.quality, equipObj.refine_exp)[0];
                    if (curLevel < maxLevel) {
                        equipArr[k] = equipObj;
                    }
                }
            }
        }

        // 没有需要精炼的装备
        if (Object.keys(equipArr).length == 0) {
            resp.code = ErrorCode.ERROR_MAX_REFINE_LEVEL; resp.desc = 'all max level'; break;
        }

        var confError = false;      // 配置错误
        var allMaxLevel = false;    // 是否所有装备都到顶级了
        var itemLack = false;       // 是否道具不足
        var costs = [];
        var costNum = {};           // 每种道具消耗的数量
        var hasNum = {};            // 每种道具拥有的数量
        for (var i = 0; i < gEquipRefineItemsLowToHigh.length; i++) {
            costNum[gEquipRefineItemsLowToHigh[i].id] = 0;
            hasNum[gEquipRefineItemsLowToHigh[i].id] = player.getMaterialCount(gEquipRefineItemsLowToHigh[i].id);
        }

        while (!allMaxLevel && !itemLack) {
            // 找精炼等级最低的那个装备
            var min = 999;
            var minIndex = 0;
            for (var k in equipArr) {
                var equipConf = gConfEquip[equipArr[k].id];
                var curLevel = getRefineLevelByExp(equipConf.quality, equipArr[k].refine_exp)[0];
                if (curLevel < min) {
                    min = curLevel;
                    minIndex = parseInt(k);
                }
            }

            var equipConf = gConfEquip[equipArr[minIndex].id];
            var refineConf = gConfEquipRefine[equipConf.quality];
            var maxLevel = Object.keys(refineConf).max();

            if (min >= maxLevel) {
                allMaxLevel = true;
                break;
            }

            var toLevel = min + 1;
            var conf = refineConf[toLevel];
            // remainExp代表上次升完级还剩下多少经验
            var remainExp = getRefineLevelByExp(equipConf.quality, equipArr[minIndex].refine_exp)[1];
            var needExp = conf.refineExp - remainExp;   // 升一级所需经验
            var addExp = 0; // 实际增加的经验

            var cost = [];
            for (var i = 0; i < gEquipRefineItemsLowToHigh.length; i++) {
                if (needExp > 0) {
                    var id = gEquipRefineItemsLowToHigh[i].id;
                    var cnt = Math.ceil(needExp / gEquipRefineItemsLowToHigh[i].exp);

                    var realCostNum = cnt;
                    if (hasNum[id] - costNum[id] < cnt) {
                        realCostNum = hasNum[id] - costNum[id];
                    }

                    if (realCostNum > 0) {
                        cost.push(['material', gEquipRefineItemsLowToHigh[i].id, -realCostNum]);
                        needExp = needExp - realCostNum * gEquipRefineItemsLowToHigh[i].exp;
                        addExp += realCostNum * gEquipRefineItemsLowToHigh[i].exp;

                        costNum[id] += realCostNum;
                    }
                }
            }

            if (needExp > 0) {
                // 不够升这一级
                itemLack = true;
                break;
            }

            var preCosts = clone(costs);
            preCosts = preCosts.concat(cost)
            preCosts = reformAwards(preCosts);
            if (!player.checkCosts(costs)) {
                itemLack = true;
                break;
            }

            equipArr[minIndex].refine_exp += addExp;
            costs = costs.concat(cost);
            costs = reformAwards(costs);
        }

        if (confError) {
            resp.code = 1; resp.desc = 'conf error'; break;
        }

        if (allMaxLevel && costs.length == 0) {
            resp.code = ErrorCode.ERROR_MAX_REFINE_LEVEL; resp.desc = 'all max level'; break;
        }

        if (itemLack && costs.length == 0) {
            resp.code = ErrorCode.ERROR_REFINE_COST_NOT_ENOUGH; resp.desc = 'item not enough'; break;
        }

        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_REFINE_COST_NOT_ENOUGH; resp.desc = 'item not enough'; break;
        }

        resp.data.equip = {};
        for (var k in equipArr) {
            var eid = equipArr[k].eid;
            user.bag.equip[eid].refine_exp = equipArr[k].refine_exp;
            player.markDirty(util.format('bag.equip.%d.refine_exp', eid));
            resp.data.equip[eid] = equipArr[k].refine_exp;
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        player.doGuideTask('equipRefine', 1);
        player.doOpenSeven('equiprefine', 1);
        player.doOpenHoliday('equiprefine', 1);
        equitInfoToWorld(user);
        if (pos > 0) {
            player.markFightForceChanged(pos);
        }
    } while (false);

    onHandled();
};

// 分解一件装备，返回消耗和奖励
function decomposeOneEquip(user, eid) {
    var equip = user.bag.equip[eid];
    if (!equip) {
        return null;
    }

    // 穿在身上的不能分解
    if (equip.hid > 0) {
        return null;
    }

    var equipConf = gConfEquip[equip.id];
    if (!equipConf) {
        return null;
    }

    var equipBaseConf = gConfEquipBase[equipConf.type][equipConf.quality];
    if (!equipBaseConf) {
        return null;
    }

    var costs = [['equip', eid, -1]];

    // 基础返还
    var awards = clone(equipBaseConf['disassembleAward' + equip.grade]);

    return [costs, awards];
}

// 根据所选品质从背包筛选要分解的装备
function findDecomposeEquipsByQuality(user, qualities) {
    var bag = user.bag;
    var eids = [];
    for (var eid in bag.equip) {
        var equip = bag.equip[eid];
        if (equip.pos) {
            continue;
        }

        var equipConf = gConfEquip[equip.id];
        if (!equipConf) {
            continue;
        }

        var equipBaseConf = gConfEquipBase[equipConf.type][equipConf.quality];
        if (!equipBaseConf) {
            continue;
        }

        if ((qualities & (1 << (equipConf.quality - 1))) == 0) {
            continue;
        }

        eids.push(eid);
    }

    return eids;
}

// 装备分解
exports.decompose = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var eid = +req.args.eid;
        var equip = user.bag.equip[eid];
        if (!equip) {
            resp.code = 1; resp.desc = 'no the equip'; break;
        }

        // 穿在身上的不能分解
        if (equip.hid > 0) {
            resp.code = 1; resp.desc = 'can not decompose hero equip'; break;
        }

        var equipConf = gConfEquip[equip.id];
        if (!equipConf) {
            resp.code = 1; resp.desc = 'no the equip conf'; break;
        }

        var equipBaseConf = gConfEquipBase[equipConf.type][equipConf.quality];
        if (!equipBaseConf) {
            resp.code = 1; resp.desc = 'no the equip base conf'; break;
        }

        var ret = decomposeOneEquip(user, eid);

        resp.data.costs = player.addAwards(ret.costs, req.mod, req.act);
        resp.data.awards = player.addAwards(ret.awards, req.mod, req.act);

    } while (false);

    onHandled();
};

// 一键分解
exports.decompose_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var eids = req.args.eids;   // 指定要分解的装备id列表
        var qualities = req.args.quality; // 分解品质，用位表示
        if (qualities == NaN || qualities == undefined) {
            resp.code = 1; resp.desc = 'quality is needed'; break;
        }

        if (!Object.keys(eids).length) {
            eids = [];
        }

        var findEids = findDecomposeEquipsByQuality(user, qualities);
        for (var i = 0; i < findEids.length; i++) {
            var exist = false;
            for (var j = 0; j < eids.length; j++) {
                if (findEids[i] == eids[j]) {
                    exist = true;
                }
            }

            if (exist == false) {
                eids.push(findEids[i]);
            }
        }

        var totalCosts = [];
        var totalAwards = [];

        for (var i = 0; i < eids.length; i++) {
            var ret = decomposeOneEquip(user, eids[i]);
            if (ret) {
                totalCosts = totalCosts.concat(ret[0]);
                totalAwards = totalAwards.concat(ret[1]);
            }
        }

        resp.data.costs = player.addAwards(totalCosts, req.mod, req.act);
        resp.data.awards = player.addAwards(totalAwards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 装备改良
exports.improve = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var eid = req.args.eid;
        var costEid = req.args.cost_eid
        if (!eid || !costEid) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var equipObj = user.bag.equip[eid];
        var costEquipObj = user.bag.equip[costEid];
        if (!equipObj || !costEquipObj) {
            resp.code = 1; resp.desc = 'can not find equip obj, eid = ' + eid; break;
        }

        var equipConf = gConfEquip[equipObj.id];
        var costEquipConf = gConfEquip[costEquipObj.id];
        if (!equipConf || !costEquipConf) {
            resp.code = 1; resp.desc = 'no the equip conf'; break;
        }

        // id相同且星级相同
        if (equipObj.id != costEquipObj.id || equipObj.grade != costEquipObj.grade) {
            resp.code = 1; resp.desc = 'no equ grade'; break;
        }

        // 检查是否可以改良
        var equipImproveConf = gConfEquipImprove[equipConf.quality][equipObj.grade];
        if (!equipImproveConf) {
            resp.code = 1; resp.desc = 'no the equip improve conf'; break;
        }

        if (equipImproveConf.isImprove == 0) {
            resp.code = 401; resp.desc = 'no the equip improve conf'; break;
        }

        // 检查消耗
        var cost = equipImproveConf.scroll.concat(equipImproveConf.cost);
        if (!player.checkCosts(cost)) {
            resp.code = 402; resp.desc = 'cost not enough'; break;
        }

        var weights = {};
        for (var i = 1; i <= 6; i++) {
            weights[i] = equipImproveConf['resultWeight' + i];
        }

        // 随机
        var resultGrade = common.wRand(weights);
        equipObj.grade = resultGrade;
        player.markDirty(util.format('bag.equip.%d.grade', eid));

        cost.push(['equip', costEid, -1]);
        resp.data.costs = player.addAwards(cost, req.mod, req.act);
        resp.data.new_grade = parseInt(resultGrade);

        var heroObj = null;
        if (equipObj.hid > 0) {
            player.updateRoleEquipTalent(equipObj.hid);
            // todo fish
            //player.markFightForceChanged(equipObj.pos);

            heroObj = user.hero_bag.heros[equipObj.hid];
        }
        resp.data.talent = heroObj ? heroObj.talent : null;
        //强制同步玩家数据到world服
        // todo fish
        // equitInfoToWorld(user);
        player.doDailyTask('statueImprove');
    } while (false);

    onHandled();
};