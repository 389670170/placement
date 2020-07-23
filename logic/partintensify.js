// 部位强化
// author ganjiaxi
// Create at 2017/3/6

// 根据经验值获取等级
function getPartLevelByExp(part, exp) {
    var partConf = gConfEquipRefine[part];
    if (!partConf) {
        return 0;
    }

    var maxCount = Object.keys(gConfEquipRefine[part]).length;
    for (var i = maxCount - 1; i >= 0; i--) {
        if (exp >= partConf[i].exp) {
            return i;
        }
    }

    return 0;
}

// 增加部位经验
exports.addPartExp = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroPos = req.args.hero_pos;
        var partPos = req.args.part_pos;
        var itemId = req.args.item_id;
        var itemNum = req.args.item_num;
        if (isNaN(heroPos) || isNaN(partPos) || isNaN(itemId) || isNaN(itemNum)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (partPos < 1 || partPos > 6) {
            resp.code = 1; resp.desc = 'part pos error'; break;
        }

        var roleObj = user.pos[heroPos];
        if (!roleObj) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var curPartLevel = roleObj.part[partPos].level;

        // 检查是否已经到顶级
        if (curPartLevel != 0 && !gConfEquipRefine[partPos][curPartLevel]) {
            resp.code = 1; resp.desc = 'already max level'; break;
        }

        var costs = [['material', itemId, -itemNum]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        var itemConf = gConfItem[itemId];
        if (!itemConf) {
            resp.code = 1; resp.desc = 'item conf not exist'; break;
        }

        if (itemConf.useType != 'partexp') {
            resp.code = 1; resp.desc = 'item use type error'; break;
        }

        var useEffect = itemConf.useEffect * itemNum;
        roleObj.part[partPos].exp += useEffect;
        player.markDirty(util.format('pos.%d.part.%d.exp', heroPos, partPos));

        // 检查是否升级
        var newLevel = getPartLevelByExp(partPos, roleObj.part[partPos].exp);
        if (newLevel > curPartLevel) {
            roleObj.part[partPos].level = newLevel;
            player.markDirty(util.format('pos.%d.part.%d.level', heroPos, partPos));
            player.markFightForceChanged(heroPos);
        }

        resp.data.exp = roleObj.part[partPos].exp;
        resp.data.level = roleObj.part[partPos].level;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

    } while (false);

    onHandled();
};

exports.addPartExp_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroPos = req.args.hero_pos;
        var partPos = req.args.part_pos;
        var item = req.args.item;
        var exp = req.args.exp;
        if (isNaN(heroPos) || isNaN(partPos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (partPos < 1 || partPos > 6) {
            resp.code = 1; resp.desc = 'part pos error'; break;
        }

        var roleObj = user.pos[heroPos];
        if (!roleObj) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 是否到达顶级
        var curPartLevel = roleObj.part[partPos].level;
        if (curPartLevel != 0 && !gConfEquipRefine[partPos][curPartLevel]) {
            resp.code = 1; resp.desc = 'already max level'; break;
        }

        var addExp = 0;
        var allCosts = [];
        for (var costsId in item) {
            if (!gConfItem[costsId]) {
                resp.code = 1; resp.desc = 'invaild args'; break;
            }

            if (gConfItem[costsId].useType != 'partexp') {
                resp.code = 1; resp.desc = 'item use type error'; break;
            }

            var costsNum = item[costsId]
            var costs = ['material', costsId, -costsNum];
            allCosts.push(costs);
            addExp += costsNum * gConfItem[costsId].useEffect;
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        var newExp = roleObj.part[partPos].exp + addExp;
        var newLevel = getPartLevelByExp(partPos, newExp);
        if (newLevel < curPartLevel + 1) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        if (newExp > gConfEquipRefine[partPos][curPartLevel + 1].exp) {
            if (exp != newExp - gConfEquipRefine[partPos][curPartLevel + 1].exp) {
                resp.code = 1; resp.desc = 'exp error'; break;
            }
        }

        roleObj.part[partPos].exp = newExp;
        player.markDirty(util.format('pos.%d.part.%d.exp', heroPos, partPos));
        roleObj.part[partPos].level = newLevel;
        player.markDirty(util.format('pos.%d.part.%d.level', heroPos, partPos));
        player.markFightForceChanged(heroPos);
        resp.data.exp = roleObj.part[partPos].exp;
        resp.data.level = roleObj.part[partPos].level;
        resp.data.costs = player.addAwards(allCosts,req.mod,req.act);
    } while (false);

    onHandled();
};
