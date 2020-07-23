exports.expand_hero_bag = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var buyCount = user.hero_bag.buy;
        //ERROR(user.hero_bag);
        var buyConf = gConfBuy[buyCount + 1];
        if (!buyConf) {
            resp.code = 1; resp.desc = 'error hid'; break;
        }

        var costs = buyConf.heroNumBuyC;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        user.hero_bag.buy += 1;

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        player.markDirty("hero_bag.buy");
    } while (false);

    onHandled();
};


// 武将升级
exports.level_up = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.hid)) {
            resp.code = 1; resp.desc = 'error hid'; break;
        }

        var heroIndex = +req.args.hid;
        var heroObj = user.hero_bag.heros[heroIndex];
        // 没有卡槽或者卡槽上没有武将
        if (!heroObj || !heroObj.rid) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        var heroConf = gConfHero[heroObj.rid];
        if (!heroConf) {
            resp.code = 1; resp.desc = 'no conf'; break;
        }

        var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
        //gConfCombatHeroTemplate[heroTemplateId]['']     
        if (heroObj.awake > 4) {
            heroTemplateId = heroConf.templatedIdUltimate;
        }

        // 模板類型
        var rebornType = gConfCombatHeroTemplate[heroTemplateId]['rebornType'];
        var maxLevel = Math.max(gConfReborn[rebornType][heroObj.tier]['roleLevelMax'], gConfDestiny[heroObj.awake]['roleLevelMax']);

        // 消耗材料
        var nextLevel = heroObj.level + 1;
        if (nextLevel > maxLevel) {
            resp.code = 1; resp.desc = 'max'; break;
        }

        var costs = gConfLevel[heroObj.level].roleUpGradeCost;
        // 材料不足
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        heroObj.level += 1;

        player.markDirty(util.format("hero_bag.heros.%d.level", heroIndex));

        // todo by fish
        player.markFightForceChanged(heroIndex);
        player.doGuideTask('heroLvUp', 1);
    } while (false);

    onHandled();
};


// 武将升一级
/*
exports.level_upone = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.pos)) {
            resp.code = 1; resp.desc = 'error pos'; break;
        }

        var pos = +req.args.pos;

        var posObj = user.pos[pos];
        // 没有卡槽或者卡槽上没有武将
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'no this pos or hero'; break;
        }

        if (gConfHero[posObj.hid].camp == 5) {
            resp.code = 1; resp.desc = 'protagonist'; break;
        }

        var toLevel = +posObj.level;
        var needXp = +gConfLevel[toLevel].roleExp - posObj.xp;

        // 升级的等级大于君主等级
        if (toLevel > user.status.level) {
            resp.code = 1; resp.desc = 'hero level large than player level'; break;
        }

        var costs = [];
        for (var index = 0, max = gHeroXpItemIds.length; index < max; index++) {
            var id = gHeroXpItemIds[index];
            var needNum = Math.ceil(needXp / +gConfItem[id].useEffect);
            if (needNum <= user.bag['material'][id]) {
                costs.push(['material', id, -needNum]);
                needXp = needXp - gConfItem[id].useEffect * needNum;
                break;
            }

            if (user.bag['material'][id] && user.bag['material'][id] != 0) {
                needXp = needXp - gConfItem[id].useEffect * user.bag['material'][id];
            }

            costs.push(['material', id, -user.bag['material'][id]]);
        }

        //升级物品不足
        if (needXp > 0) {
            resp.code = 1; resp.desc = 'not enough material'; break;
        }


        var toXp = posObj.xp;
        var totalXp = +gConfLevel[toLevel].roleExp - needXp;
        while (true) {
            if (toLevel >= user.status.level) {
                toLevel = user.status.level;
                if (totalXp >= gConfLevel[toLevel].roleExp) {
                    toXp = gConfLevel[toLevel].roleExp - 1;
                } else {
                    toXp = totalXp;
                }
                break;
            }
            if (totalXp - gConfLevel[toLevel].roleExp >= 0) {
                totalXp -= gConfLevel[toLevel].roleExp;
                toLevel++;
            } else {
                toXp = totalXp;
                break;
            }
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        posObj.xp = toXp;
        player.markDirty(util.format("pos.%d.xp", pos));
        if (posObj.level != toLevel) {
            posObj.level = toLevel;
            player.markDirty(util.format("pos.%d.level", pos));
            player.markFightForceChanged(pos);

        }

        player.doGuideTask('heroLvUp', 1);
    } while (false);

    onHandled();
};
byfish**/

// 获取道具消耗列表
var getConsumeItems = function (player, itemIds, consumeExp, retItemList) {
    var isItemEnough = false;
    var lackExp = consumeExp;
    for (var i = 0; i < itemIds.length; i++) {
        var itemID = itemIds[i].itemID;
        var itemNum = player.getMatrialCount(itemID);
        var materialConf = gConfItem[itemID];
        var tmpExp = materialConf.useEffect * itemNum;

        if (tmpExp >= lackExp) {
            var realConsumeItemCount = Math.ceil(lackExp / materialConf.useEffect);
            retItemList.push([itemID, realConsumeItemCount]);
            isItemEnough = true;
            break;
        } else {
            retItemList.push([itemID, itemNum]);
            lackExp = lackExp - tmpExp;
        }
    }

    return isItemEnough;
}

// 获取所消耗道具所能提供的经验值
var getItemsExp = function (itemList) {
    var totalExp = 0;
    for (var i = 0; i < itemList.length; i++) {
        var materialConf = gConfItem[itemList[i][0]];
        totalExp = totalExp + materialConf.useEffect * itemList[i][1];
    }

    return totalExp;
}

/*
exports.level_to = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.pos) || isNaN(req.args.toLevel) || isNaN(req.args.toExp) ) {
            resp.code = 1; resp.desc = 'error mid or num or pos or level'; break;
        }

        var pos = +req.args.pos;
        var posObj = user.pos[pos];
        var level_to = +req.args.toLevel;
        var exp_to = +req.args.toExp;
        // 升级的等级大于君主等级
        if (level_to > user.status.level) {
            level_to = user.status.level;
        }
        // 没有卡槽或者卡槽上没有武将
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'no this pos or hero'; break;
        }

        if (gConfHero[posObj.hid].camp == 5) {
            resp.code = 1; resp.desc = 'protagonist'; break;
        }

        for (var i = 0; i < req.args.arr.length; i++) {
            var itemID = +req.args.arr[i].itemID;
            var itemNum = +req.args.arr[i].itemNum;
            var materialConf = gConfItem[itemID];

            // 没有此材料或者不是用作武将升级
            if (!materialConf || materialConf.useType != 'xp') {
                resp.code = 1; resp.desc = 'mid type error'; break;
            }

            // 材料不足
            var costs = [['material', itemID, -itemNum]];
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'material not enough'; break;
            }
        }

        // 计算升到目标等级所需要的经验值
        var curRoleExp = posObj.xp;
        var totalNeedExp = 0;
        for (var i = posObj.level; i < level_to; i++){
            totalNeedExp = totalNeedExp + gConfLevel[i].roleExp;
        }

        // 减去当前exp
        totalNeedExp = totalNeedExp - curRoleExp;

        var itemList = [];
        var isItemEnough = getConsumeItems(player, req.args.arr, totalNeedExp, itemList);
        if (!isItemEnough) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        var costs = [];
        for (var i = 0; i < itemList.length; i++) {
            costs.push(['material', itemList[i][0], -itemList[i][1]]);
        }

        var toLevel = posObj.level;
        var toXp = posObj.xp;
        var totalXp = getItemsExp(itemList) + curRoleExp;
        while (true) {
            if (toLevel >= user.status.level) {
                toLevel = user.status.level;
                if (totalXp >= gConfLevel[toLevel].roleExp) {
                    toXp = gConfLevel[toLevel].roleExp-1;
                } else {
                    toXp = totalXp;
                }
                break;
            }
            if (totalXp - gConfLevel[toLevel].roleExp >= 0) {
                totalXp -= gConfLevel[toLevel].roleExp;
                toLevel++;
            } else {
                toXp = totalXp;
                break;
            }
        }
        // 服务器计算的升级到的等级与客户端算的不一致
        if (toLevel != level_to) {
            resp.code = 1; resp.desc = 'level not match'; break;
        }
        if (toXp != exp_to) {
            resp.code = 1; resp.desc = 'xp not match'; break;
        }

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        posObj.xp = toXp;
        player.markDirty(util.format("pos.%d.xp", pos));
        if (posObj.level != toLevel) {
            posObj.level = toLevel;
            player.markDirty(util.format("pos.%d.level", pos));
            player.markFightForceChanged(pos);
        }

        player.doGuideTask('heroLvUp', 1);

    } while(false);

    onHandled();
};
by fish*/

// 穿装备 mod fish 1103
exports.wear = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var index = +req.args.hid;
        if (!user.hero_bag.heros[index] || !user.hero_bag.heros[index].rid) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        var eid = +req.args.eid;
        var equip = user.bag.equip[eid];
        if (!equip) {
            resp.code = 1; resp.desc = 'no equip'; break;
        }

        if (equip.hid) {
            resp.code = 1; resp.desc = 'has equip others'; break;
        }

        // 如果已经穿了其他的装备，则先卸下来
        var heroObj = user.hero_bag.heros[index];
        var type = gConfEquip[equip.id].type;
        var oldEid = heroObj.equip[type];
        if (oldEid) {
            // 需要先脱下来
            var oldEquip = user.bag.equip[oldEid];
            if (oldEquip) {
                oldEquip.hid = 0;
                // 老装备脱了
                player.markDirty(util.format('bag.equip.%d.hid', oldEid));
            }
        } else {
            player.memData.equip_num--;
        }

        heroObj.equip[type] = eid;
        equip.hid = index;
        // 新装备穿上


        player.markDirty(util.format('hero_bag.heros.%d.equip.%d', index, type));
        player.markDirty(util.format('bag.equip.%d.hid', eid));

        // update role equip talent
        player.updateRoleEquipTalent(index)
        resp.data.talent = heroObj.talent;

        //player.memData.pos[pos].equip_changed[type] = 1;
        //if (player.memData.updated_worldwar) {
        //    player.memData.pos[pos].uni_equip_changed[type] = 1;
        //}

        // 更新套装属性  todo fish
        //player.getSuits(pos);
        //player.markFightForceChanged(pos);

        //player.doOpenSeven('equipLevel');
        //player.doOpenHoliday('equipLevel');

        player.doOpenSeven('equipNum');
        player.doOpenHoliday('equipNum');
        // todo end
    } while (false);

    onHandled();
};

// 一键穿装备  -fish
exports.wear_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroIndex = +req.args.hid;
        var heroObj = user.hero_bag.heros[heroIndex];
        if (!heroObj || !heroObj.rid) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        var eids = req.args.eids;
        if (!util.isArray(eids) || eids.length != 6) {
            resp.code = 1; resp.desc = 'invalid eids'; break;
        }

        var valid = true;
        for (var i = 0; i < HeroPartCount; i++) {
            if (eids[i] && !user.bag.equip[eids[i]]) {
                valid = false;
                break;
            }
        }

        if (!valid) {
            resp.code = 1; resp.desc = 'no equip'; break;
        }

        for (var i = 0; i < HeroPartCount; i++) {
            var eid = +eids[i];
            if (!eid) {
                continue;
            }

            var equip = user.bag.equip[eid];
            var type = gConfEquip[equip.id].type;
            var oldEid = heroObj.equip[type];

            // 脱掉老的，穿上新的
            if (oldEid) {
                var oldEquip = user.bag.equip[oldEid];
                if (oldEquip) {
                    oldEquip.hid = 0;
                }

                player.markDirty(util.format('bag.equip.%d.hid', oldEid));
            } else {
                player.memData.equip_num--;
            }

            heroObj.equip[type] = eid;
            equip.hid = heroIndex;
            player.markDirty(util.format('hero_bag.heros.%d.equip.%d', heroIndex, type));
            player.markDirty(util.format('bag.equip.%d.hid', eid));

            /*
            player.memData.pos[pos].equip_changed[type] = 1;
            if (player.memData.updated_worldwar) {
                player.memData.pos[pos].uni_equip_changed[type] = 1;
            }*/
        }

        player.updateRoleEquipTalent(heroIndex)
        resp.data.talent = heroObj.talent;

        //player.getSuits(pos);

        // player.markFightForceChanged(pos);
        //player.doOpenSeven('equipLevel');
        //player.doOpenSeven('equipStar');
        player.doOpenSeven('equipNum');

        //player.doOpenHoliday('equipLevel');
        //player.doOpenSeven('equipStar');
        player.doOpenHoliday('equipNum');
    } while (false);

    onHandled();
};

// select equip talent 
exports.select_talent = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroIndex = +req.args.hid;
        var level = +req.args.level; // 1-6
        var selectId = +req.args.id;    // 1-2

        var heroObj = user.hero_bag.heros[heroIndex];
        if (!heroObj || !heroObj.rid) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        if (isNaN(selectId) || (selectId != 2 && selectId != 1)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var heroType = gConfHero[heroObj.rid]['soldierId'];
        var talentConf = gConfEquipTalent[heroType][level];
        if (!talentConf) {
            resp.code = 1; resp.desc = 'no lv'; break;
        }

        var talent = heroObj.talent;
        if (talentConf.limit > talent.point) {
            resp.code = 1; resp.desc = 'no point'; break;
        }

        if (talent.tree[level - 1] != 0) {
            resp.code = 1; resp.desc = 'has light'; break;
        }

        talent.tree[level - 1] = +selectId;

        resp.data.talent = talent;
        player.markDirty(util.format('hero_bag.heros.%d.talent.tree', heroIndex));

    } while (false);

    onHandled();
};

exports.reset_talent = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroIndex = +req.args.hid;

        var heroObj = user.hero_bag.heros[heroIndex];
        if (!heroObj || !heroObj.rid) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 材料不足
        var costs = parseAwardsConfig(gConfGlobalNew.equipTalantResetCost);
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        var talent = heroObj.talent;

        talent.tree = [0, 0, 0, 0, 0, 0];

        resp.data.talent = talent;
        player.markDirty(util.format('hero_bag.heros.%d.talent.tree', heroIndex));

    } while (false);

    onHandled();
};

// 比较两个装备的好坏，先比较品质，品级，然后精炼等级，再强化等级
function compareEquip(equipA, equipB) {
    var confA = gConfEquip[equipA.id];
    var confB = gConfEquip[equipB.id];
    if (confA.quality > confB.quality) {
        return true;
    } else if (confA.quality == confB.quality) {
        if (equipA.grade > equipB.grade) {
            return true;
        } else if (equipA.grade == equipB.grade) {
            if (equipA.refine_exp > equipB.refine_exp) {
                return true;
            } else if (equipA.refine_exp == equipB.refine_exp) {
                if (equipA.intensify > equipB.intensify) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

// 根据部位查找最好的装备,找到返回eid，没有返回0
function findBestEquip(player, pos) {
    var user = player.user;
    var bag = user.bag;
    var bestEquip = null;
    var bestEid = null;
    for (var eid in bag.equip) {
        var equipObj = bag.equip[eid];
        if (equipObj) {
            if (equipObj.pos > 0) {
                continue;
            }

            var equipConf = gConfEquip[equipObj.id];
            if (!equipConf) {
                continue;
            }

            if (equipConf.type != pos) {
                continue;
            }

            if (!bestEquip) {
                bestEquip = equipObj;
                bestEid = eid;
            } else {
                if (compareEquip(equipObj, bestEquip)) {
                    bestEquip = equipObj;
                    bestEid = eid;
                }
            }
        }
    }

    return +bestEid;
}

// 一键给所有英雄换装
exports.equip_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var changeEquipArr = {};
        var heros = user.hero_bag.heros;
        var team1 = user.team[1];
        for (var hid in team1) {
            var posObj = heros[hid];
            if (posObj.rid > 0) {
                for (var i = 1; i <= 6; i++) {
                    var existEid = posObj.equip[i];
                    var existEquipObj = user.bag.equip[existEid];
                    var bestEid = findBestEquip(player, i);
                    var bestEquip = user.bag.equip[bestEid];
                    if (existEquipObj && bestEquip) {
                        if (compareEquip(bestEquip, existEquipObj)) {
                            // 有更好的，要替换
                            existEquipObj.hid = 0;
                            player.markDirty(util.format('bag.equip.%d', existEid));

                            posObj.equip[i] = bestEid;
                            player.markDirty(util.format('hero_bag.heros.%d.equip', hid));

                            bestEquip.hid = parseInt(hid);
                            player.markDirty(util.format('bag.equip.%d', bestEid));

                            player.markFightForceChanged(pos);

                            var changeObj = {};
                            changeObj.eid = existEid;
                            changeObj.op = 0;               // 0表示脱下，1表示装备上
                            changeObj.hid = hid;     // 英雄id
                            changeObj.pos = i;              // 部位
                            changeEquipArr[existEid] = changeObj;

                            var changeObj2 = {};
                            changeObj2.eid = bestEid;
                            changeObj2.op = 1;   // 0表示脱下，1表示装备上
                            changeObj2.hid = hid; // 英雄id
                            changeObj2.pos = i;  // 部位
                            changeEquipArr[bestEid] = changeObj2;
                        }
                    } else {
                        if (bestEquip) {
                            // 原来是空的，直接装上
                            posObj.equip[i] = bestEid;
                            player.markDirty(util.format('hero_bag.heros.%d.equip', hid));
                            bestEquip.hid = parseInt(hid);
                            player.markDirty(util.format('bag.equip.%d', bestEid));

                            player.markFightForceChanged(pos);

                            var changeObj = {};
                            changeObj.eid = bestEid;
                            changeObj.op = 1;    // 0表示脱下，1表示装备上
                            changeObj.hid = hid; // 英雄id
                            changeObj.pos = i;   // 部位
                            changeEquipArr[bestEid] = changeObj;
                        }
                    }
                }
            }
        }

        resp.data.change_list = changeEquipArr;
    } while (false);

    onHandled();
};

// 一键卸下所有装备
exports.take_off_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.hid)) {
            resp.code = 1;
            resp.desc = 'no valeid args';
            break;
        }

        var heroIndex = +req.args.hid;
        var heroObj = user.hero_bag.heros[heroIndex];

        if (!heroObj) {
            resp.code = 1;
            resp.desc = 'no hero , hid = ' + heroIndex;
            break;
        }

        for (var i = 1; i <= 6; i++) {
            var eid = heroObj.equip[i];
            var equip = user.bag.equip[eid];

            if (equip) {
                equip.hid = 0;
                player.markDirty(util.format('bag.equip.%d.hid', eid));
                player.memData.equip_num++;
            }

            heroObj.equip[i] = 0;
            player.markDirty(util.format('hero_bag.heros.%d.equip.%d', heroIndex, i));
        }

        player.updateRoleEquipTalent(heroIndex);

        resp.data.talent = heroObj.talent;

    } while (false);

    onHandled();
};

// 卸载装备
exports.take_off = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.hid) || isNaN(req.args.type)) {
            resp.code = 1; resp.desc = 'no valeid args'; break;
        }

        var heroIndex = +req.args.hid;
        var type = +req.args.type;

        var heroObj = user.hero_bag.heros[heroIndex];

        if (!heroObj || !heroObj.equip[type]) {
            resp.code = 1; resp.desc = 'no equip'; break;
        }

        if (player.memData.equip_num >= user.equip_valume) {
            resp.code = 1; resp.desc = 'bag equip is full'; break;
        }

        var eid = heroObj.equip[type];
        var equip = user.bag.equip[eid]
        if (equip) {
            equip.hid = 0;
            player.markDirty(util.format('bag.equip.%d.hid', eid));
        }

        heroObj.equip[type] = 0;
        player.markDirty(util.format('hero_bag.heros.%d.equip.%d', heroIndex, type));
        // 标记装备发生了变化
        //player.memData.pos[pos].equip_changed[type] = 1;
        //if (player.memData.updated_worldwar) {
        //player.memData.pos[pos].uni_equip_changed[type] = 1;
        //}

        player.updateRoleEquipTalent(heroIndex)
        resp.data.talent = heroObj.talent;

        player.memData.equip_num++;
        //player.getSuits(pos);
        //player.markFightForceChanged(pos);
    } while (false);

    onHandled();
};

// 武将换将
exports.exchange = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = Math.floor(req.args.pos);
        var hid = Math.floor(req.args.hid);
        if (isNaN(pos) || isNaN(hid)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (pos == 1) {
            resp.code = 1; resp.desc = 'main role cannot change'; break;
        }

        if (!user.pos[pos] || !user.bag.card[hid]) {
            resp.code = 1; resp.desc = 'no the card'; break;
        }
        var repeat = false;
        var num = 0;
        for (var p in user.pos) {
            if (user.pos[p].hid) {
                if (user.pos[p].hid == hid) {
                    repeat = true; break;
                }
                num++;
            }
        }
        if (repeat) {
            resp.code = 1; resp.desc = 'repeat hid'; break;
        }

        // 互斥检测
        var heroConf = gConfHero[hid];
        if (!heroConf) {
            resp.code = 1; resp.desc = 'invalid hid'; break;
        }

        var mutexId = heroConf.mutexId;
        if (mutexId) {
            var mutex = false;
            for (var p in user.pos) {
                if (p == pos) {
                    continue;
                }
                var phid = user.pos[p].hid;
                if (phid) {
                    if (phid) {
                        var pConf = gConfHero[phid];
                        if (pConf.mutexId && pConf.mutexId == mutexId) {
                            mutex = true; break;
                        }
                    }
                }
            }
            if (mutex) {
                resp.code = 1; resp.desc = 'mutex hid'; break;
            }
        }

        var oriHid = user.pos[pos].hid;
        var level = user.status.level;

        if (!oriHid && num >= gConfLevel[level].heroNum) {
            resp.code = 1; resp.desc = 'full hero'; break;
        }

        // 如果是上阵新武将，那找到第一个空格子，不允许跳着上
        if (!oriHid) {
            var firstEmpty = MaxPos;
            for (var i = 1; i <= MaxPos; i++) {
                if (user.pos[i].hid == 0 && i < firstEmpty) {
                    firstEmpty = i;
                }
            }

            pos = firstEmpty;
        }

        player.calcAutoFight();

        var awards = [];
        var costs = [];
        var promote = user.pos[pos].promote;
        if (oriHid) {
            if (gConfHero[oriHid].camp == 5) {
                resp.code = 1; resp.desc = 'protagonist'; break;
            }

            // 小兵不同，返回小兵装备
            var soldierId = gConfHero[oriHid].soldierId;
            if (soldierId != gConfHero[hid].soldierId) {
                var soldierLevel = user.pos[pos].soldier.level;
                var soldierStar = user.pos[pos].soldier.star;
                var confSoldierLevel = gConfSoldierLevel[soldierId][soldierLevel][soldierStar];
                for (var slot in user.pos[pos].soldier.dress) {
                    if (user.pos[pos].soldier.dress[slot]) {
                        var dressId = confSoldierLevel["equipId" + slot];
                        var dressNum = confSoldierLevel["equipNum" + slot];
                        awards.push(['dress', dressId, dressNum]);
                        user.pos[pos].soldier.dress[slot] = 0;
                        player.markDirty(util.format('pos.%d.soldier.dress.%d', pos, slot));
                    }
                }
            }

            awards.push(["card", oriHid, 1]);

            // 助阵卡牌返还
            for (var fateId in user.pos[pos].assist) {
                for (var i = 0, len = user.pos[pos].assist[fateId].length; i < len; i++) {
                    awards.push(['card', user.pos[pos].assist[fateId][i], 1]);
                }
                delete user.pos[pos].assist[fateId];
            }
            player.markDirty(util.format('pos.%d.assist', pos));

            // 武将品阶材料返还
            var quality = user.pos[pos].quality;
            var costSum = 0;
            for (var i = 1; i < quality; i++) {
                costSum += gConfHeroQuality[i].itemNum;
            }
            awards.push(['material', +gConfGlobalNew.heroQualityCostItem, costSum]);
            user.pos[pos].quality = 1;
            player.markDirty(util.format('pos.%d.quality', pos));

            // 武将升阶材料返回
            var returnCosts = [];
            if (promote.length) {
                var heroCombatConf = getHeroCombatConf(oriHid);
                var professionType = heroCombatConf.professionType;
                var oriQuality = heroCombatConf.quality;
                var oriPromoteType = gConfHeroChangeQuality[oriQuality].id;
                var minId = gConfPromoteType[oriPromoteType][professionType * 100].id;
                var promoteType = promote[0];
                var promoteProgress = promote[1];
                var progress = promoteProgress + professionType * 100;
                if (gConfPromoteType[promoteType] && gConfPromoteType[promoteType][progress]) {
                    var maxId = gConfPromoteType[promoteType][progress].id;
                    var returnCost = [];
                    if (maxId > minId) {
                        var costsId = minId + 1;
                        for (costsId; costsId <= maxId; costsId++) {
                            var promoteCosts = gConfPromote[costsId].cost;
                            for (var i = 0; i < promoteCosts.length; i++) {
                                returnCosts.push(promoteCosts[i].slice());
                            }
                        }
                    }

                    for (var i = 0; i < returnCosts.length; i++) {
                        var cost = returnCosts[i];
                        cost[cost.length - 1] = -cost[cost.length - 1];
                    }
                    awards = awards.concat(returnCosts);
                }
            }

            //升阶信息初始化
            var heroCombatConf = getHeroCombatConf(hid);
            var changeQuality = heroCombatConf.quality;
            if (changeQuality >= gConfGlobal.promoteQualityLimit) {
                var changeType = gConfHeroChangeQuality[changeQuality].id;
                promote[0] = changeType;
                promote[1] = 0;
                player.markDirty(util.format('pos.%d.promote', pos));
            } else {
                user.pos[pos].promote = [];
                player.markDirty(util.format('pos.%d.promote', pos));
            }
        } else {
            // 新武将的阵容位置
            var slots = SlotArray.slice();
            for (var i = 1; i <= MaxPos; i++) {
                if (user.pos[i].hid) {
                    slots.remove(user.pos[i].slot);
                }
            }
            user.pos[pos].slot = slots[0];
            player.markDirty(util.format("pos.%d.slot", pos));

            slots = SlotArray.slice();
            for (var i = 1; i <= MaxPos; i++) {
                var slot = user.def_info.team[i];
                if (slot) {
                    slots.remove(+slot);
                }
            }
            user.def_info.team[pos] = slots[0];
            player.markDirty('def_info.team.' + pos);

            // 初始化武将升阶信息
            var heroCombatConf = getHeroCombatConf(hid);
            var heroQuality = heroCombatConf.quality;
            if (heroQuality >= gConfGlobal.promoteQualityLimit) {
                var promoteType = gConfHeroChangeQuality[heroQuality].id;
                promote[0] = promoteType;
                promote[1] = 0;
                player.markDirty(util.format('pos.%d.promote', pos));
            }

            player.memData.pos_count++;
        }

        costs.push(["card", hid, -1]);
        user.pos[pos].hid = hid;
        player.markDirty(util.format("pos.%d.hid", pos));

        // 突破武将需要返回突破材料
        var talent = user.pos[pos].talent;
        if (talent) {
            var heroCombatConf = getHeroCombatConf(oriHid);
            var type = heroCombatConf.rebornType;
            var rcosts = [];
            while (talent > 0) {
                var rebornCosts = gConfReborn[type][talent].cost;
                for (var i = 0; i < rebornCosts.length; i++) {
                    rcosts.push(rebornCosts[i].slice());
                }
                var cardCost = gConfReborn[type][talent].cardCost;
                if (cardCost) {
                    rcosts.push(['card', oriHid, -cardCost]);
                }

                var fragmentCost = gConfReborn[type][talent].fragmentCost;
                if (fragmentCost) {
                    rcosts.push(['fragment', oriHid, -fragmentCost]);
                }
                talent--;
            }

            for (var i = 0; i < rcosts.length; i++) {
                var cost = rcosts[i];
                cost[cost.length - 1] = -cost[cost.length - 1];
            }
            awards = awards.concat(rcosts);

            user.pos[pos].talent = 0;
            player.markDirty(util.format("pos.%d.talent", pos));

        }
        player.getInnateMap();
        awards = reformAwards(awards);
        resp.data.pos = pos;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(awards, req.mod, req.act);

        player.getFateMap();
        for (var pos in user.pos) {
            if (user.pos[pos].hid) {
                player.markFightForceChanged(pos);
            }
        }
    } while (false);

    if (onHandled) {
        onHandled();
    }
};

// 天命 - juexing
exports.upgrade_awake = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'destiny')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var heroIndex = Math.floor(req.args.hid);
        if (isNaN(heroIndex)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var myHeros = user.hero_bag.heros;
        var heroObj = myHeros[heroIndex];
        if (!heroObj || !heroObj.rid) {
            resp.code = 1; resp.desc = 'error pos'; break;
        }

        var awakeLevel = heroObj.awake;
        if (heroObj.tier != 10) {
            resp.code = 1; resp.desc = 'not max tier'; break;
        }

        if (!gConfDestiny[awakeLevel + 1]) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        ERROR('heroIndex = ' + heroIndex);

        var confDestiny = gConfDestiny[awakeLevel];
        var errorType = 0;
        //{1:[index1,index2,index3],2:[],3:[]}

        var heroCosts = req.args.cost_heros;
        if (typeof (heroCosts) != 'object') {
            resp.code = 1; resp.desc = 'cost args error'; break;
        }

        var errorType = 0;
        var trueCostHeros = [];
        for (var type in heroCosts) {
            var selectHeros = heroCosts[type];
            if (!util.isArray(selectHeros)) {
                errorType = 1;
                break;
            }

            var cosArry = confDestiny['costHero' + type];
            if (heroIndex == 1) {
                cosArry = confDestiny['nanCostHero' + type];
            }

            if (!util.isArray(cosArry) || cosArry.length != 3) {
                continue;
            }

            var conType = cosArry[0];
            var starOrId = cosArry[1];
            var num = cosArry[2];
            var ownNum = 0;
            // ERROR('==========TYPE======'+conType);
            // ERROR('==========STARORID======'+starOrId);
            // ERROR('==========num======'+num);
            for (var i = selectHeros.length - 1; i >= 0; i--) {
                var shid = selectHeros[i];
                var theHero = myHeros[shid];
                if (trueCostHeros.indexOf(shid) >= 0) {
                    errorType = 2000;
                    // ERROR('==========eror index======'+shid);
                    break;
                }

                trueCostHeros.push(shid);

                if (!theHero || !theHero.rid || player.getRoleTeamPos(shid)) {
                    errorType = 2;
                    // ERROR('==========2222');
                    break;
                }

                if (shid == heroIndex) {
                    errorType = 4;
                    ERROR('==========not cost self !!!!!!');
                    break;
                }

                if (conType == 1) {                                                                             // 指定卡牌
                    if (theHero.rid == starOrId) {
                        ownNum += 1;
                        // ERROR('==========+1 IN==RID===='+starOrId);
                    }
                } else if (conType == 2) {                                                                      // 指定星级卡牌
                    var heroConf = gConfHero[theHero.rid];
                    if (!heroConf) {
                        errorType = 3;
                        // ERROR('==========333');
                        break;
                    }

                    var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
                    //gConfCombatHeroTemplate[heroTemplateId]['']  
                    if (theHero.awake > 4) {
                        heroTemplateId = heroConf.templatedIdUltimate;
                    }
                    // 模板類型
                    var starBase = gConfCombatHeroTemplate[heroTemplateId]['starBase'];
                    if (starBase + theHero.awake - 1 == starOrId) {
                        // ERROR('==========+1 IN==STAR===='+starOrId);
                        ownNum += 1;
                    }
                } else if (conType == 3) {                                                                      // 自己
                    var selfCostId = gConfHero[heroObj.rid]['selfCostId'];
                    //ERROR('==========+1 IN==selfCostId===='+selfCostId+' ?=costrid:'+theHero.rid);
                    if (selfCostId == theHero.rid) {
                        ownNum += 1;
                    }
                } else if (conType == 4) {                                                                      // 自己兵种
                    var tTargetHeroConf = gConfHero[heroObj.rid];
                    var heroConf = gConfHero[theHero.rid];
                    if (!heroConf || !tTargetHeroConf) {
                        errorType = 3;
                        break;
                    }

                    var tTargetTemplate = gConfCombatHeroTemplate[heroObj.awake > 4 ? tTargetHeroConf.templatedIdUltimate : tTargetHeroConf.heroTemplateId];
                    var tHeroTemplate = gConfCombatHeroTemplate[theHero.awake > 4 ? heroConf.templatedIdUltimate : heroConf.heroTemplateId];

                    if (tTargetTemplate.legionType != tHeroTemplate.legionType) {
                        errorType = 5;
                        break;
                    }

                    // 模板類型
                    var starBase = tHeroTemplate['starBase'];
                    if (starBase + theHero.awake - 1 == starOrId) {
                        ownNum += 1;
                    }
                }
            }

            if (ownNum != num) {
                errorType = 1000;
                break;
            }
        }

        if (errorType != 0) {
            resp.code = 1; resp.desc = 'eror ' + errorType; break;
        }

        // costs make
        if (!player.checkCosts(confDestiny.cost)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var heroBack = player.deleteHeros(trueCostHeros);

        heroObj.awake = awakeLevel + 1;
        player.markDirty(util.format("hero_bag.heros.%d.awake", heroIndex));

        var star = player.getHeroStar(heroIndex);
        player.doTask('roleQuality', 1, star);
        player.doOpenSeven('roleQuality', 1, star);
        player.doOpenHoliday('roleQuality', 1, star);

        resp.data.awake = heroObj.awake;
        resp.data.costs = player.addAwards(confDestiny.cost, req.mod, req.act);
        resp.data.awards = player.addAwards(heroBack, req.mod, req.act);
    } while (false);

    onHandled();
};

// 突破 1109 mod by fish
exports.upgrade_tier = function (player, req, resp, onHandled) {
    // max level need upgrade
    var user = player.user;
    do {
        /*
        if (!isModuleOpen_new(player, 'reborn')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }*/

        var heroIndex = Math.floor(req.args.hid);
        if (!user.hero_bag.heros[heroIndex] || !user.hero_bag.heros[heroIndex].rid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        /*
        var upgrade = Math.floor(req.args.upgrade);
        if (!upgrade || upgrade < 1) {
            resp.code = 1; resp.desc = 'upgrade error'; break;
        }

        if (upgrade > 1 && !isModuleOpen_new(player, 'autotupo')) {
            resp.code = 1; resp.desc = 'autotupo is not open'; break;
        }
        */
        var heroObj = user.hero_bag.heros[heroIndex];
        var heroConf = gConfHero[heroObj.rid];
        if (!heroConf) {
            resp.code = 1; resp.desc = 'no conf'; break;
        }
        var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
        //gConfCombatHeroTemplate[heroTemplateId]['']     
        if (heroObj.awake > 4) {
            heroTemplateId = heroConf.templatedIdUltimate;
        }

        // 模板類型
        var rebornType = gConfCombatHeroTemplate[heroTemplateId]['rebornType'];

        // zuida dengji cai neng shengji
        var minLevel = +gConfReborn[rebornType][heroObj.tier]['roleLevelMax'];
        if (minLevel != heroObj.level) {
            resp.code = 1; resp.desc = 'level is not reach'; break;
        }

        var mxTier = +gConfReborn[rebornType][heroObj.tier]['tierMax'];
        if (heroObj.tier + 1 > mxTier) {
            resp.code = 1; resp.desc = 'tier is max'; break;
        }

        // 消耗材料
        var costs = gConfReborn[rebornType][heroObj.tier + 1]['cost'];
        if (!costs) {
            resp.code = 1; resp.desc = 'cost error'; break;
        }

        // 材料不足
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        heroObj.tier += 1;

        player.markDirty(util.format("hero_bag.heros.%d.tier", heroIndex));
        resp.data.tier = heroObj.tier;

        /*
        player.getInnateMap();
        for (var pos in user.pos) {
            if (user.pos[pos].hid) {
                player.markFightForceChanged(pos);
            }
        }
        */
        player.doTask('roleReborn', 1, heroObj.tier, heroObj.tier - 1);
        player.doOpenSeven('roleReborn', 1, heroObj.tier, heroObj.tier - 1);
        player.doOpenHoliday('roleReborn', 1, heroObj.tier, heroObj.tier - 1);

        player.memData.ffchanged = 1;
        player.markFightForceChanged(heroIndex);
        // 引导任务
        player.doGuideTask('reborn', 1);
    } while (false);

    onHandled();
};

// 小兵穿装备
exports.dress_wear = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        var posObj = user.pos[pos];
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var slot = req.args.slot;
        var soldierLevel = posObj.soldier.level;
        var soldierStar = posObj.soldier.star;
        var soldierId = gConfHero[posObj.hid].soldierId;

        var confSoldierLevel = gConfSoldierLevel[soldierId][soldierLevel][soldierStar];
        var equipId = confSoldierLevel['equipId' + slot];
        if (!equipId) {
            resp.code = 1; resp.desc = 'slot error'; break;
        }

        var posLevel = confSoldierLevel['poslevel' + slot];
        if (gConfHero[posObj.hid].camp == 5) {
            if (user.status.level < posLevel) {
                resp.code = 1; resp.desc = 'low level'; break;
            }
        } else if (posObj.level < posLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        if (posObj.soldier.dress[slot]) {
            resp.code = 1; resp.desc = 'has dressed'; break;
        }

        var costs = [['dress', equipId, -confSoldierLevel['equipNum' + slot]]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'dress not enough'; break;
        }

        posObj.soldier.dress[slot] = 1;
        player.markDirty(util.format('pos.%d.soldier.dress.%d', pos, slot));

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        player.markFightForceChanged(pos);
    } while (false);

    onHandled();
};

// 小兵一键穿装备
exports.dress_wear_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        var posObj = user.pos[pos];
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var full = true;
        for (var slot = 1; slot <= SoldierEquipCount; slot++) {
            if (!posObj.soldier.dress[slot]) {
                full = false; break;
            }
        }
        if (full) {
            resp.code = 1; resp.desc = 'dress full'; break;
        }

        var costs = [];
        var confSoldierLevel = gConfSoldierLevel[gConfHero[posObj.hid].soldierId][posObj.soldier.level][posObj.soldier.star];
        for (var slot = 1; slot <= SoldierEquipCount; slot++) {
            if (posObj.soldier.dress[slot]) {
                continue;
            }
            var equipId = confSoldierLevel['equipId' + slot];
            if (!equipId) {
                continue;
            }

            var posLevel = confSoldierLevel['poslevel' + slot];
            if (gConfHero[posObj.hid].camp == 5) {
                if (user.status.level < posLevel) {
                    continue;
                }
            } else if (posObj.level < posLevel) {
                continue;
            }

            var cost = [['dress', equipId, -confSoldierLevel['equipNum' + slot]]];
            if (!player.checkCosts(cost)) {
                continue;
            }

            costs = costs.concat(cost);

            posObj.soldier.dress[slot] = 1;
            player.markDirty(util.format('pos.%d.soldier.dress.%d', pos, slot));
        }

        if (costs.length > 0) {
            player.markFightForceChanged(pos);
            resp.data.costs = player.addAwards(costs, req.mod, req.act);
        }
    } while (false);

    onHandled();
};

// 小兵升阶
exports.upgrade_soldier = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = Math.floor(+req.args.pos);
        if (!user.pos[pos] || !user.pos[pos].hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var posObj = user.pos[pos];
        var soldierLevel = posObj.soldier.level;
        var soldierStar = posObj.soldier.star;
        var soldierId = gConfHero[posObj.hid].soldierId;
        var confSoldierLevel = gConfSoldierLevel[soldierId][soldierLevel][soldierStar];

        if (!gConfSoldierLevel[soldierId][soldierLevel + 1]) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        // 判断是否5星了
        if (posObj.soldier.star < SoldierStarCount) {
            resp.code = 1; resp.desc = 'star not enough'; break;
        }

        var costs = confSoldierLevel.cost;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cost not enough'; break;
        }

        posObj.soldier.level = soldierLevel + 1;
        posObj.soldier.star = 0;

        // 广播小兵升阶信息
        if (soldierLevel + 1 >= 6) {
            var array = [];
            var userName = user.info.un;
            var heroHid = posObj.hid;
            // var heroName = gConfGeneralText[gConfHero[heroHid].heroName].text;
            array[0] = userName;
            array[1] = heroHid;
            array[2] = soldierLevel + 1;
            if (userName == null) {
                array[0] = '';
            }

            pushSysMsg('updateSoldier', array);
        }

        player.markDirty(util.format('pos.%d.soldier', pos));
        player.markFightForceChanged(pos);
        player.doTask('soldierLevel', 1, soldierLevel + 1, soldierLevel);
        player.doOpenSeven('soldierLevel', 1, soldierLevel + 1, soldierLevel);
        player.doOpenHoliday('soldierLevel', 1, soldierLevel + 1, soldierLevel);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 小兵升星
exports.upgrade_soldier_star = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = Math.floor(+req.args.pos);
        if (!user.pos[pos] || !user.pos[pos].hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        // 检测是否已经到最大星级
        var posObj = user.pos[pos];
        if (posObj.soldier.star >= SoldierStarCount) {
            resp.code = 1; resp.desc = 'max star'; break;
        }

        // 检查装备是否穿满
        var soldierId = gConfHero[posObj.hid].soldierId;
        var soldierLevel = posObj.soldier.level;
        var soldierStar = posObj.soldier.star;
        var confSoldierLevel = gConfSoldierLevel[soldierId][soldierLevel][soldierStar];
        var full = true;
        for (var slot = 1; slot <= SoldierEquipCount; slot++) {
            if (!posObj.soldier.dress[slot] && confSoldierLevel['equipId' + slot] > 0) {
                full = false; break;
            }
        }
        if (!full) {
            resp.code = 1; resp.desc = 'dress not full'; break;
        }

        posObj.soldier.star++;
        posObj.soldier.dress = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
        };

        player.markDirty(util.format('pos.%d.soldier', pos));
        player.markFightForceChanged(pos);
    } while (false);

    onHandled();
};

// 武将进阶
exports.promote = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'promote')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var pos = Math.floor(+req.args.pos);
        if (isNaN(pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var hid = user.pos[pos].hid;
        var heroConf = gConfHero[hid];
        var professionType = heroConf.professionType;
        if (pos == 1 || !user.pos[pos] || !hid || !heroConf || !professionType) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var heroQuality = heroConf.quality;
        if (heroQuality < gConfGlobal.promoteQualityLimit) {
            resp.code = 1; resp.desc = 'quality not reach'; break;
        }

        var heroPromote = user.pos[pos].promote;
        if (heroPromote.length == 0) {
            resp.code = 1; resp.desc = 'can not promote'; break;
        }

        var promoteType = heroPromote[0];
        var promoteNum = heroPromote[1];
        var progress = promoteNum + professionType * 100;
        var progressConf = gConfPromoteProgress;
        var progressId = gConfPromoteType[promoteType][progress].id;
        if (!gConfPromote[progressId + 1]) {
            resp.code = 1; resp.desc = 'reached the highest promote'; break;
        }

        if (!progressConf[progress + 1]) {
            var costsProgress = professionType * 100;
            var costs = gConfPromoteType[promoteType + 1][costsProgress].cost;
        } else {
            var costsProgress = progress + 1;
            var costs = gConfPromoteType[promoteType][costsProgress].cost;
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        if (!progressConf[progress + 1]) {
            heroPromote[0] = parseInt(promoteType) + 1;
            heroPromote[1] = 0;
            player.markDirty(util.format('pos.%d.promote', pos));

            // 封将广播
            if (heroPromote[0] == gConfHeroChangeKey['red'].id || heroPromote[0] == gConfHeroChangeKey['gold'].id) {
                var array = [];
                var userName = user.info.un;
                var heroHid = user.pos[pos].hid;
                // var heroName = gConfGeneralText[gConfHero[heroHid].heroName].text
                array[0] = userName;
                array[1] = heroHid;
                if (userName == null) {
                    array[0] = '';
                }

                if (heroPromote[0] == gConfHeroChangeKey['red'].id) {
                    pushSysMsg('updatePromoteRed', array);
                } else {
                    pushSysMsg('updatePromoteGold', array);
                }
            }
        } else {
            var promotedProgress = heroPromote[1] + 1;
            heroPromote[1] = promotedProgress;
            player.markDirty(util.format('pos.%d.promote', pos));
        }


        player.markFightForceChanged(pos);
        resp.data.promote = heroPromote;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

/** 卡片重生 */
exports.reborn = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (typeof (req.args.hids) == "number") {
            req.args.hids = [req.args.hids];
        }
        var tSelectHeroIDList = req.args.hids || [];
        var tPlayerHeros = user.hero_bag.heros;

        for (var i = 0; i < tSelectHeroIDList.length; i++) {
            var tSelectHeroID = tSelectHeroIDList[i];
            var theHero = tPlayerHeros[tSelectHeroID];
            if (theHero && (theHero.awake == 1)) { continue; }
            resp.code = 1;
            resp.desc = ` select hero error ${tSelectHeroID}`;
            break;
        }
        if (resp.code == 1) { break; }

        resp.data.heros = {};
        var tAwardList = [];
        for (var i = 0; i < tSelectHeroIDList.length; i++) {
            var tSelectHeroID = tSelectHeroIDList[i];
            var theHero = tPlayerHeros[tSelectHeroID];
            if (!theHero) {
                resp.code = 1;
                resp.desc = ` select hero error ${tSelectHeroID}`;
                break;
            }

            var tResetHeroAward = player.resetHeros(tSelectHeroID);
            tAwardList = tAwardList.concat(tResetHeroAward);
            resp.data.heros[tSelectHeroID] = tPlayerHeros[tSelectHeroID];
        }
        resp.data.awards = player.addAwards(tAwardList, req.mod, req.act);
    } while (false)
    onHandled();
}

// 卡牌分解  --现在还需要嘛
exports.resolve_hero = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var selectHeros = req.args.hids;
        var trueCostHeros = [];
        if (!util.isArray(selectHeros) || selectHeros.indexOf(1) >= 0) {
            resp.code = 1; resp.desc = 'args error'; break;
        }
        var myHeros = user.hero_bag.heros;
        var errorType = 0;
        for (var i = selectHeros.length - 1; i >= 0; i--) {
            var shid = selectHeros[i];
            var theHero = myHeros[shid];
            if (trueCostHeros.indexOf(shid) >= 0) {
                errorType = 10;
                break;
            }

            if (!theHero || !theHero.rid || player.getRoleTeamPos(shid)) {
                errorType = 2;
                break;
            }
            trueCostHeros.push(shid);
        }
        if (errorType > 0) {
            resp.code = 1; resp.desc = 'args error' + errorType; break;
        }

        var heroBack = player.deleteHeros(trueCostHeros, true);
        resp.data.awards = player.addAwards(heroBack, req.mod, req.act);
        resp.data.clear_equips = [];
        resp.data.hids = trueCostHeros;

    } while (false);

    onHandled();
};

// 根据品质获取卡牌id和数量
function getCardByQuality(user, quality) {
    var ret = {};
    for (var cid in user.bag.card) {
        var heroCombatConf = getHeroCombatConf(cid);
        var result = (quality & (1 << (heroCombatConf.quality - 1)));
        if (result == 0) {
            continue;
        }
        if (cid == 10000) {
            continue;
        }
        var num = user.bag.card[cid];
        ret[cid] = num;
    }

    return ret;
}

exports.get_train = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'train')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        resp.data.train = user.train;
    } while (false);

    onHandled();
};

exports.buy_train_slot = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'train')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var slot = +req.args.slot;
        if (!user.train[slot]) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (user.train[slot][2]) {
            resp.code = 1; resp.desc = 'bought'; break;
        }

        var costs = [['user', 'cash', -gConfGlobal.trainSlotOpenCost4]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'gold not enough'; break;
        }

        user.train[slot][2] = 1;
        player.markDirty('train.' + slot);

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.train = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'train')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var pos = +req.args.pos;
        var slot = +req.args.slot;
        if (!user.pos[pos] || !user.train[slot]) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var openLevel = gConfTraining[slot].level;
        var openVip = gConfTraining[slot].vip;

        if (!user.train[slot][2]) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.status.level < openLevel && user.status.vip < openVip) {
            resp.code = 1; resp.desc = 'user level or vip not reach'; break;
        }

        var repeat = false;
        var now = common.getTime();
        for (var trainId in user.train) {
            if (pos == user.train[trainId][0] && user.train[trainId][1] > now) {
                repeat = true; break;
            }
        }
        if (repeat) {
            resp.code = 1; resp.desc = 'repeat'; break;
        }

        var posObj = user.pos[pos];
        if (!posObj.hid) {
            resp.code = 1; resp.desc = 'no hero at pos'; break;
        }

        if (user.train[slot][1] > now) {
            resp.code = 1; resp.desc = 'slot is colding'; break;
        }

        var gainXp = gConfLevel[user.status.level].trainExp;

        player.addHeroXp(pos, gainXp);

        user.train[slot][0] = pos;
        user.train[slot][1] = now + (+gConfTraining[slot].cd * 60);
        player.markDirty('train.' + slot);

        player.doDailyTask('trainRole', 1);

        resp.data.cold_time = user.train[slot][1];
        resp.data.xp = posObj.xp;
        resp.data.level = posObj.level;

    } while (false);

    onHandled();
};

exports.train_accelerate = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'train')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.status.vip < gConfGlobal.trainSpeedVipLimit) {
            resp.code = 1; resp.desc = 'vip limit'; break;
        }

        if (!gConfTraining[req.args.slot]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var slot = +req.args.slot;
        var endTime = user.train[slot][1];
        var now = common.getTime();
        if (endTime <= now) {
            resp.code = 1; resp.desc = 'has cold'; break;
        }

        var hours = Math.ceil((endTime - now) / 3600);
        var cashCost = gConfTraining[slot].need * hours;
        var costs = [['user', 'cash', -cashCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        user.train[slot][0] = 0;
        user.train[slot][1] = 0;
        player.markDirty('train.' + slot);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.train_accelerate_all = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'train')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.status.vip < gConfGlobal.trainSpeedVipLimit) {
            resp.code = 1; resp.desc = 'vip limit'; break;
        }

        var now = common.getTime();
        var cashCost = 0;
        for (var slot in user.train) {
            var endTime = user.train[slot][1];
            if (endTime > now) {
                var hours = Math.ceil((endTime - now) / 3600);
                cashCost += gConfTraining[slot].need * hours;
            }
        }

        if (!cashCost) {
            resp.code = 1; resp.desc = 'no need accelerate'; break;
        }

        var costs = [['user', 'cash', -cashCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        for (var slot in user.train) {
            if (user.train[slot][1] > now) {
                user.train[slot][0] = 0;
                user.train[slot][1] = 0;
                player.markDirty('train.' + slot);
            }
        }
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.assist = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        var posObj = user.pos[pos];
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var cid = +req.args.cid;
        var costs = [['card', cid, -1]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'no the card'; break;
        }

        var inSlot = false;
        for (var p in user.pos) {
            if (user.pos[p].hid == cid) {
                inSlot = true;
                break;
            }
        }
        if (inSlot) {
            resp.code = 1; resp.desc = 'is on'; break;
        }

        var fid = +req.args.fid;
        var heroCombatConf = getHeroCombatConf(posObj.hid);
        if (heroCombatConf.fateGroup.indexOf(fid) == -1) {
            resp.code = 1; resp.desc = 'no the fate'; break;
        }

        var confFate = gConfFate[fid];
        var valid = false;
        for (var i = 1; i <= 5; i++) {
            if (confFate['hid' + i] == cid) {
                valid = true;
                break;
            }
        }
        if (!valid) {
            resp.code = 1; resp.desc = 'cid not in fate'; break;
        }

        if (!posObj.assist[fid]) {
            posObj.assist[fid] = [];
        }
        if (posObj.assist[fid].indexOf(cid) >= 0) {
            resp.code = 1; resp.desc = 'has assisted'; break;
        }

        posObj.assist[fid].push(cid);
        player.markDirty(util.format('pos.%d.assist.%d', pos, fid));
        player.getAssistFateMap(pos, fid);

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.unassist = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.pos[req.args.pos] || !req.args.cid || !req.args.fid) {
            resp.code = 1; resp.desc = 'args error'; break;
        }
        var pos = req.args.pos;
        var cid = +req.args.cid;
        var fid = +req.args.fid;
        var posObj = user.pos[pos];
        if (!posObj.hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        if (!posObj.assist[fid] || !posObj.assist[fid].indexOf(cid) < 0) {
            resp.code = 1; resp.desc = 'no such assist'; break;
        }

        posObj.assist[fid].remove(cid);
        if (posObj.assist[fid].length > 0) {
            player.markDirty(util.format('pos.%d.assist.%d', pos, fid));
        } else {
            player.markDelete(util.format('pos.%d.assist.%d', pos, fid));
        }

        player.getFateMap();
        player.markFightForceChanged(pos);
        resp.data.awards = player.addAwards([['card', cid, 1]], req.mod, req.act);
    } while (false);

    onHandled();
};

// 武将升品质
exports.upgrade_heroquality = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;
        var posObj = user.pos[pos];
        if (!posObj || !posObj.hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        var upgrade = Math.floor(req.args.upgrade);
        if (!upgrade || upgrade < 1) {
            resp.code = 1; resp.desc = 'upgrade error'; break;
        }

        if (upgrade > 1 && !isModuleOpen_new(player, 'autoupgrade')) {
            resp.code = 1; resp.desc = 'autoupgrade is not open'; break;
        }

        var qualityLevel = posObj.quality || 1; // 品质等级
        if (!gConfHeroQuality[qualityLevel + upgrade]) {
            resp.code = 1; resp.desc = 'over max upgrade'; break;
        }

        // 武将等级不满足
        var qualityConf = gConfHeroQuality[qualityLevel + upgrade - 1];
        if (pos == 1) {
            if (user.status.level < qualityConf.conditionHeroLevel) {
                resp.code = 1; resp.desc = 'hero level not fit'; break;
            }
        } else {
            if (posObj.level < qualityConf.conditionHeroLevel) {
                resp.code = 1; resp.desc = 'hero level not fit'; break;
            }
        }
        // 突破等级不满足
        if (posObj.talent < qualityConf.conditionHeroTalent) {
            resp.code = 1; resp.desc = 'hero talent not fit'; break;
        }
        // 小兵等级不满足
        if (posObj.soldier.level < qualityConf.conditionHeroSoldier) {
            resp.code = 1; resp.desc = 'hero soldier not fit'; break;
        }

        // 检查资源是否足够
        var matId = +gConfGlobalNew.heroQualityCostItem;
        var matNum = 0;
        var materialConf = gConfItem[matId];
        if (!materialConf) {
            resp.code = 1; resp.desc = 'mid type error'; break;
        }

        for (var i = 0; i < upgrade; i++) {
            matNum += gConfHeroQuality[qualityLevel + i].itemNum;
        }
        var costs = [['material', matId, -matNum]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        // 提升武将品质
        posObj.quality = qualityLevel + upgrade;
        player.markDirty(util.format('pos.%d.quality', pos));
        player.markFightForceChanged(pos);

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.quality = posObj.quality;

        // 在线奖励通知
        outline_sync_to_client(player);

    } while (false);

    onHandled();
};

exports.conspiracy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {

        if (!req.args.fateType || !req.args.heroIds) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (!isModuleOpen_new(player, 'fateAdvanced')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var fateType = req.args.fateType;
        var heroIds = req.args.heroIds;

        var conspiracy = user.conspiracy;
        var fateLevel = 1;
        if (conspiracy[fateType]) {
            fateLevel = conspiracy[fateType] + 1;
        }

        if (!gConfFateadvancedconf[fateType][fateLevel] || !gConfFateadvancedtype[fateType]) {
            resp.code = 1; resp.desc = 'no such type or level'; break;
        }

        var costCardNum = 4;
        if (heroIds.length < costCardNum) {
            resp.code = 1; resp.desc = 'herocard num error'; break;
        }

        var heroneedIds = gConfFateadvancedtype[fateType].fateHeroId;
        var heroCheck = true;
        var costs = [];
        for (var i = 0; i < costCardNum; i++) {
            if (heroneedIds.indexOf(heroIds[i]) < 0) {
                heroCheck = false;
            }
            costs.push(['card', heroIds[i], -1]);
        }

        if (!heroCheck) {
            resp.code = 1; resp.desc = 'herocard error'; break;
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough card'; break;
        }

        conspiracy[fateType] = fateLevel;
        player.markDirty('conspiracy');
        // player.doOpenSeven('fateadvanced', 1, fateLevel, fateLevel - 1);

        for (var pos in player.user.pos) {
            if (player.user.pos[pos].hid) {
                player.markFightForceChanged(pos);
            }
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 圣武 || 圣翼 || 圣骑进阶
exports.upgrade_sky = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var sky_type = req.args.sky_type; //   升级类型  weapon || wing || mount   , 圣武 || 圣翼 || 圣骑
        var num = Math.floor(+req.args.num);
        var type = Math.floor(+req.args.type);

        if (sky_type != 'weapon' && sky_type != 'wing' && sky_type != 'mount') {
            resp.code = 100; resp.desc = 'sky_type error'; break;
        }

        if (isNaN(num) || isNaN(type)) {
            resp.code = 100; resp.desc = 'args error'; break;
        }

        if (!isModuleOpen_new(player, 'sky' + sky_type)) {
            resp.code = 101; resp.desc = 'not open'; break;
        }

        // 能量值是否清空
        player.cleanSkyEnergy(sky_type);

        var skySuit = user.sky_suit;
        var curLevel = skySuit[sky_type + '_level'];    // 当前等级
        var curEnegy = skySuit[sky_type + '_energy'];   // 当前已经积攒的能量值

        var nextLevel = curLevel + 1;
        var toEnergy = curEnegy;

        var gConfSkyType = player.keyFindConf(sky_type);
        if (!gConfSkyType[nextLevel]) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var costs = [];
        var confWeap = gConfSkyType[curLevel];
        var upgrade = false;

        DEBUG('cur toEnergy = ' + toEnergy + ', target = ' + skySuit[sky_type + '_energy_target']);
        var i = 0;
        for (; i < num; i++) {
            costs = costs.concat(confWeap['cost' + type]);
            toEnergy += confWeap.getEnergy;

            if (toEnergy >= skySuit[sky_type + '_energy_target']) {
                upgrade = true;
                break;
            }
        }

        if (!upgrade) {
            // 修正错误
            if (toEnergy >= gConfSkyType[curLevel].energyMax) {
                upgrade = true;
            }
        }

        if (upgrade) {
            toEnergy = 0;

            if (i != num - 1) {
                //resp.code = 1; resp.desc = 'num error '; break;
                DEBUG('i != num - 1, i = ' + i);
            }
        }

        costs = reformAwards(costs);
        if (!player.checkCosts(costs)) {
            resp.code = 102; resp.desc = 'something not enough'; break;
        }

        DEBUG('after toEnergy = ' + toEnergy + ', upgrade = ' + upgrade + ', toLevel = ' + nextLevel);

        skySuit[sky_type + '_energy'] = toEnergy;
        player.markDirty('sky_suit.' + sky_type + '_energy');

        if (upgrade) {
            skySuit[sky_type + '_level'] = nextLevel;
            player.markDirty('sky_suit.' + sky_type + '_level');
            skySuit[sky_type + '_energy_target'] = common.seededRandom(gConfSkyType[nextLevel].energyMin, gConfSkyType[nextLevel].energyMax);
            player.markDirty('sky_suit.' + sky_type + '_energy_target');

            player.doOpenSeven(sky_type, 1, nextLevel, curLevel);
            player.doOpenHoliday(sky_type, 1, nextLevel, curLevel);
            skySuit[sky_type + '_energy_clean_time'] = 0;
            player.markDirty('sky_suit.' + sky_type + '_energy_clean_time');

            player.updateSkyCollect(sky_type);
            //player.calcSkyUnlockSkill(sky_type);

        } else {
            // 是否开始清空能量值
            if (confWeap.clean && !skySuit[sky_type + '_energy_clean_time']) {
                skySuit[sky_type + '_energy_clean_time'] = common.getTime() + confWeap.cleanTime * 3600;
                player.markDirty('sky_suit.' + sky_type + '_energy_clean_time');
            }
        }

        for (var pos in user.pos) {
            if (user.pos[pos].hid) {
                player.markFightForceChanged(pos);
            }
        }

        resp.data[sky_type + '_energy'] = skySuit[sky_type + '_energy'];
        resp.data[sky_type + '_level'] = skySuit[sky_type + '_level'];
        resp.data[sky_type + '_energy_target'] = skySuit[sky_type + '_energy_target'];
        resp.data[sky_type + '_energy_clean_time'] = skySuit[sky_type + '_energy_clean_time'];
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        if (sky_type == 'weapon') {
            player.doOpenSeven('weapon');
            player.doOpenHoliday('weapon');
        } else if (sky_type == 'wing') {
            player.doOpenSeven('wing');
            player.doOpenHoliday('wing');
        }

    } while (false);

    onHandled();
};

// 人皇技能升级 || 升级到最大
exports.upgrade_sky_skill = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var skill = Math.floor(+req.args.skill);    // 技能
        var skillType = Math.floor(+req.args.type); // 1 || 2 || 3 类型 ： （圣武 || 圣翼 || 圣骑）技能
        var max = +req.args.max || null;     // 是否升到最大

        if (isNaN(skill) || isNaN(skillType)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var sky_type = player.valFindKey(skillType);

        var skySuit = user.sky_suit;

        if (!isModuleOpen_new(player, 'sky' + sky_type)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var skyLevel = skySuit[sky_type + '_level'];
        var skySkillLevels = skySuit[sky_type + '_skills'];

        if (!skyLevel || !skySkillLevels) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (!skySkillLevels.hasOwnProperty(skill)) {
            resp.code = 1; resp.desc = 'skill error'; break;
        }

        var levelLimit = gConfSkySkill[skillType][skill].levelLimit * skyLevel;
        if (skySkillLevels[skill] >= levelLimit) {
            resp.code = 1; resp.desc = 'large than sky level'; break;
        }

        var skillLevel = skySkillLevels[skill];
        var index = skillType * 100 + skill;
        var costs = [];
        if (max) { // 升到最大
            var bookCost = 0;
            var userBook = user.status.sky_book;
            var destLevel = skillLevel;
            for (; destLevel < levelLimit; destLevel++) {
                var curCost = gConfSkySkillUp[index][destLevel].cost;
                if (!curCost.length) continue;
                bookCost += (-curCost[0][2]);
                if (bookCost > userBook) {
                    bookCost -= (-curCost[0][2]);
                    break;
                }
            }

            skySuit[sky_type + '_skills'][skill] = destLevel;
            costs = [['user', 'sky_book', -bookCost]];
        } else {
            costs = gConfSkySkillUp[index][skillLevel].cost;
            skySuit[sky_type + '_skills'][skill]++;
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        player.markDirty('sky_suit.' + sky_type + '_skills.' + skill);
        player.markFightForceChangedAll();

        resp.data.sky_skill = skySkillLevels;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 人皇幻化界面、已经激活的装备、收集数、当前穿戴
exports.get_sky_illusion = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var skyObj = {};
        var skySuit = user.sky_suit;

        // 幻化装备是否到期
        player.cleanSkyIllusionEquip();
        var arr = ['weapon', 'mount', 'wing'];
        for (var i = 0, len = arr.length; i < len; i++) {
            skyObj[arr[i] + '_illusion_unlock'] = player.updateSkyCollect(arr[i], 'unlock');
            skyObj[arr[i] + '_illusion_equip_time'] = skySuit[arr[i] + '_illusion_equip_time'];
            skyObj[arr[i] + '_collect'] = skySuit[arr[i] + '_collect'];
            skyObj[arr[i] + '_illusion'] = skySuit[arr[i] + '_illusion'];
        }

        resp.data.sky_suit = skyObj;
    } while (false);

    onHandled();
};

// 人皇幻化界面、已经激活的装备、收集数、当前穿戴
exports.get_sky_suit = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 幻化装备是否到期
        player.cleanSkyIllusionEquip();
        var skySuit = user.sky_suit;
        resp.data.sky_suit = skySuit;
    } while (false);

    onHandled();
};

// 人皇幻化
exports.illusion_sky = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = Math.floor(req.args.type);
        var id = Math.floor(req.args.id);
        if (isNaN(type) || isNaN(id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (type != 1 && type != 2 && type != 3) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var sky_type = player.valFindKey(type);

        var skySuit = user.sky_suit;
        var unlockEquip = {};

        // 幻化装备是否到期
        player.cleanSkyIllusionEquip();

        unlockEquip = player.updateSkyCollect(sky_type, 'unlock');
        if (!unlockEquip[id]) {
            resp.code = 1; resp.desc = 'lock'; break;
        }
        skySuit[sky_type + '_illusion'] = id;
        player.markDirty('sky_suit.' + sky_type + '_illusion');
    } while (false);

    onHandled();
};

// 取消人皇幻化
exports.cancel_illusion_sky = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = Math.floor(req.args.type);
        var id = Math.floor(req.args.id);
        if (isNaN(type) || isNaN(id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }
        if (type != 1 && type != 2 && type != 3) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var sky_type = player.valFindKey(type);

        var skySuit = user.sky_suit;
        if (id == 0) {
            resp.code = 1; resp.desc = 'already restore'; break;
        }

        // 幻化装备是否到期
        player.cleanSkyIllusionEquip();

        if (skySuit[sky_type + '_illusion'] != id) {
            resp.code = 1; resp.desc = 'not currently wearing '; break;
        }

        skySuit[sky_type + '_illusion'] = 0;
        player.markDirty('sky_suit.' + sky_type + '_illusion');
    } while (false);

    onHandled();
};

// 人皇购买限时道具
exports.illusion_sky_buy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = Math.floor(req.args.type);
        var id = Math.floor(req.args.id);
        if (isNaN(type) || isNaN(id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (type != 1 && type != 2 && type != 3) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var sky_type = player.valFindKey(type);

        var skySuit = user.sky_suit;
        var costs = 0;
        var unlockEquip = {};
        var now = common.getTime();

        // 幻化装备是否到期
        player.cleanSkyIllusionEquip();

        if (!isModuleOpen_new(player, 'sky' + sky_type)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (skySuit[sky_type + '_illusion_equip_time'][id]) {
            resp.code = 1; resp.desc = 'not expired'; break;
        }

        costs = [['user', 'cash', -gConfSkyChange[type][id].value]];


        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough costs'; break;
        }

        if (!skySuit[sky_type + '_illusion_equip_time'][id]) {
            skySuit[sky_type + '_illusion_equip_time'][id] = now + gConfSkyChange[type][id].baseLifeTime * 24 * 3600;
            player.markDirty('sky_suit.' + sky_type + '_illusion_equip_time' + id);
        }

        resp.data[sky_type + '_illusion_equip_time'] = skySuit[sky_type + '_illusion_equip_time']
        resp.data.unlock_equip = player.updateSkyCollect(sky_type, 'unlock');
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 人皇圣武 || 圣翼 || 圣骑觉醒
exports.awaken_sky = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = Math.floor(+req.args.type);  // 1 || 2 || 3  ,圣武 || 圣翼 || 圣骑
        var useType = Math.floor(+req.args.utype);
        if (type != 1 && type != 2 && type != 3) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var sky_type = player.valFindKey(type);

        if (!isModuleOpen_new(player, 'sky' + sky_type)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (isNaN(useType)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var skySuit = user.sky_suit;

        if (useType == 1) {
            if (skySuit[sky_type + '_gas'] >= gConfSkyGasAwaken[type][skySuit[sky_type + '_level']].num) {
                resp.code = 1; resp.desc = 'use is limited'; break;
            }

            var costs = [['material', gConfGlobalNew.skyGasCostId, -1]];
        } else if (useType == 2) {
            if (skySuit[sky_type + '_blood'] >= gConfSkyBloodAwaken[type][skySuit[sky_type + '_level']].num) {
                resp.code = 1; resp.desc = 'use is limited'; break;
            }

            var costs = [['material', gConfGlobalNew.skyBloodCostId, -1]];
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough costs'; break;
        }

        if (useType == 1) {
            skySuit[sky_type + '_gas']++;
            player.markDirty('sky_suit.' + sky_type + '_gas');
        } else {
            skySuit[sky_type + '_blood']++;
            player.markDirty('sky_suit.' + sky_type + '_blood');
        }

        for (var pos in user.pos) {
            if (user.pos[pos].hid) {
                player.markFightForceChanged(pos);
            }
        }

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 激活圣物技能
exports.active_sky_skill = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = +req.args.type;  // 1 || 2 || 3  ,圣武 || 圣翼 || 圣骑
        var index = +req.args.index;
        if (type != 1 && type != 2 && type != 3) {
            resp.code = 1;
            resp.desc = 'args error';
            break;
        }

        var sky_type = player.valFindKey(type);

        if (!isModuleOpen_new(player, 'sky' + sky_type)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var skySuit = user.sky_suit;
        var skyLevel = skySuit[sky_type + '_level'];

        DEBUG('sky_type = ' + sky_type + ', index = ' + index);
        if (skyLevel < gConfSkySkill[type][index].unlock) {
            resp.code = 1; resp.desc = 'sky level not enough'; break;
        }

        if (!skySuit[sky_type + '_skills'][index]) {
            skySuit[sky_type + '_skills'][index] = 1;
            player.markDirty('sky_suit.' + sky_type + '_skills.' + index);
        }

        player.markFightForceChangedAll();

    } while (false);

    onHandled();
};

// 兑换英雄卡片
exports.exchange_card = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var heroIndex = req.args.hid;   // 源卡牌id
        var myHeros = user.hero_bag.heros;         // 兑换的数量
        var destCardId = req.args.dest; // 目标卡牌id

        var theHero = myHeros[heroIndex];
        if (!theHero || player.getRoleTeamPos(heroIndex)) {
            resp.code = 1; resp.desc = 'in team'; break;
        }

        var heroConf = gConfHero[theHero.rid];
        if (!heroConf) {
            resp.code = 1; resp.desc = 'in team'; break;
        }

        var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
        if (theHero.awake > 4) {
            heroTemplateId = heroConf.templatedIdUltimate;
        }
        // 模板類型
        var starBase = gConfCombatHeroTemplate[heroTemplateId]['starBase'];
        var star = starBase + theHero.awake - 1;
        if (star != 4 && star != 5) {
            resp.code = 1; resp.desc = 'star error'; break;
        }

        var randomSets = gConfHeroPermute[star];
        var weights = {};
        for (var id in randomSets) {
            if (randomSets[id].weight && theHero.rid != randomSets[id].Award[0][1]) {
                var limit = randomSets[id].limit.split('.');
                if (limit[0] == 'gameday') {
                    // 开服天数检测
                    var days = +limit[1];
                    var open = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
                    if (open + 1 >= days) {
                        weights[id] = randomSets[id].weight;
                    }
                }
            }
        }

        //ERROR(weights);
        var getCid = +common.wRand(weights);
        //ERROR('============'+getCid);

        var getRid = randomSets[getCid].Award[0][1];
        var destConf = gConfHero[getRid];
        if (!destConf) {
            resp.code = 1; resp.desc = 'hero conf not found'; break;
        }

        var remainMixCash = user.status.bindcash + user.status.cash;
        var remainWand = user.status.wand;

        var needMixCash = 0;
        var needWand = 0;

        var otherCosts = parseAwardsConfig(gConfGlobalNew['permuteHeroExpend' + star]);
        for (var i = 0; i < otherCosts.length; i++) {
            if (otherCosts[i][1] == 'wand') {
                needWand = Math.abs(parseInt(otherCosts[i][2]));
            } else if (otherCosts[i][1] == 'mixcash') {
                needMixCash = Math.abs(parseInt(otherCosts[i][2]));
            }
        }

        var costEnough = true;
        var resCosts = [];
        if (needWand > 0 && remainWand >= needWand) {
            resCosts.push(['user', 'wand', -needWand]);
        } else if (needMixCash > 0 && remainMixCash >= needMixCash) {
            resCosts.push(['user', 'mixcash', -needMixCash]);
        }

        // 检查其他货币资源消耗
        if (!player.checkCosts(resCosts)) {
            resp.code = 1; resp.desc = 'cost not enough'; break;
        }

        theHero.rid = +getRid;
        player.markDirty(util.format("hero_bag.heros.%d.rid", heroIndex));

        resp.data.costs = player.addAwards(resCosts, req.mod, req.act);
        resp.data.new_rid = +getRid;
    } while (false);

    onHandled();
};


// 英雄卡片合成 fish
exports.hero_evolution = function (player, req, resp, onHandled) {
    var user = player.user;
    var id = +req.args.id;          // 合成的序号
    var mHid = +req.args.main_hid;    // zhu

    // 额外所需要的卡片
    // 獲取主英雄，消耗英雄
    do {
        // 模塊是否開啓
        if (!isModuleOpen_new(player, 'evolution')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var conf = gConfHeroEvolution[id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var myHeros = user.hero_bag.heros;
        if (!myHeros[mHid] || myHeros[mHid].rid != conf['mainHero']) {
            resp.code = 1; resp.desc = 'main id'; break;
        }

        var heroCosts = req.args.cost_heros;
        if (typeof (heroCosts) != 'object') {
            resp.code = 1; resp.desc = 'cost args error'; break;
        }

        var errorType = 0;
        var trueCostHeros = [];
        for (var type in heroCosts) {
            var selectHeros = heroCosts[type];
            if (!util.isArray(selectHeros)) {
                errorType = 1;
                break;
            }

            var cosArry = conf['cost' + type];
            if (!util.isArray(cosArry) || cosArry.length != 3) {
                continue;
            }

            var conType = cosArry[0];
            var starOrId = cosArry[1];
            var num = cosArry[2];
            var ownNum = 0;
            //ERROR('==========TYPE======'+type);
            //ERROR('==========STARORID======'+starOrId);
            //ERROR('==========num======'+num);
            for (var i = selectHeros.length - 1; i >= 0; i--) {
                var shid = selectHeros[i];
                var theHero = myHeros[shid];
                if (trueCostHeros.indexOf(shid) >= 0) {
                    errorType = 2000;
                    break;
                }

                trueCostHeros.push(shid);

                if (!theHero || !theHero.rid || player.getRoleTeamPos(shid)) {
                    errorType = 2;
                    //ERROR('==========2222');
                    break;
                }

                if (conType == 1) {
                    if (theHero.rid == starOrId) {
                        ownNum += 1;
                        //ERROR('==========+1 IN==RID===='+starOrId);
                    }
                } else if (conType == 2) {
                    var heroConf = gConfHero[theHero.rid];
                    if (!heroConf) {
                        errorType = 3;
                        //ERROR('==========333');
                        break;
                    }

                    var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
                    //gConfCombatHeroTemplate[heroTemplateId]['']  
                    if (theHero.awake > 4) {
                        heroTemplateId = heroConf.templatedIdUltimate;
                    }
                    // 模板類型
                    var starBase = gConfCombatHeroTemplate[heroTemplateId]['starBase'];
                    if (starBase + theHero.awake - 1 == starOrId) {
                        //ERROR('==========+1 IN==STAR===='+starOrId);
                        ownNum += 1;
                    }
                } else if (conType == 3) {
                    var mainRid = myHeros[mHid].rid;
                    var selfCostId = gConfHero[mainRid]['selfCostId'];

                    if (selfCostId == theHero.rid) {
                        ownNum += 1;
                    }
                } else if (conType == 4) {
                    var heroObj = myHeros[mHid];
                    var tTargetHeroConf = gConfHero[heroObj.rid];
                    var heroConf = gConfHero[theHero.rid];
                    if (!heroConf || !tTargetHeroConf) {
                        errorType = 3;
                        break;
                    }

                    var tTargetTemplate = gConfCombatHeroTemplate[heroObj.awake > 4 ? tTargetHeroConf.templatedIdUltimate : tTargetHeroConf.heroTemplateId];
                    var tHeroTemplate = gConfCombatHeroTemplate[theHero.awake > 4 ? heroConf.templatedIdUltimate : heroConf.heroTemplateId];

                    if (tTargetTemplate.legionType != tHeroTemplate.legionType) {
                        errorType = 5;
                        break;
                    }

                    // 模板類型
                    var starBase = tHeroTemplate['starBase'];
                    if (starBase + theHero.awake - 1 == starOrId) {
                        ownNum += 1;
                    }
                }
            }

            if (ownNum != num) {
                errorType = 1000;
                break;
            }
        }

        if (errorType != 0) {
            resp.code = 1; resp.desc = 'eror ' + errorType; break;
        }

        // 条件检测
        var limit = conf.Limit.split('.');
        if (limit[0] == 'gameday') {
            // 开服天数检测
            var days = +limit[1];
            var open = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
            if (open + 1 < days) {
                resp.code = 105; resp.desc = 'invalid open day'; break;
            }
        } else {
            resp.code = 106; resp.desc = 'invalid limit condition'; break;
        }

        // 检查所需消耗的数量
        var mergeRid = +conf['goal'][0][1];
        if (!gConfHero[mergeRid]) {
            resp.code = 1; resp.desc = 'goal error'; break;
        }

        var heroBack = player.deleteHeros(trueCostHeros);
        myHeros[mHid].rid = mergeRid;
        player.markDirty(util.format("hero_bag.heros.%d.rid", mHid));

        var star = player.getHeroStar(mHid);
        player.doTask('roleQuality', 1, star);
        player.doOpenSeven('roleQuality', 1, star);
        player.doOpenHoliday('roleQuality', 1, star);

        resp.data.awards = player.addAwards(heroBack, req.mod, req.act);
        resp.data.heros = myHeros[mHid];

        logic_event_mgr.emit(logic_event_mgr.EVENT.MAKE_HERO_UP, player, star);
    } while (false);

    onHandled();
};


// 使用符文
exports.use_rune = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;   // 英雄槽位
        var slotIndex = req.args.index; // 符文镶嵌格索引
        var rid = req.args.rid;         // 符文实例id
        if (!pos || !slotIndex || !rid) {
            resp.code = 1; resp.desc = 'param error'; break;
        }

        if (slotIndex < 1 || slotIndex > 4) {
            resp.code = 1; resp.desc = 'index error'; break;
        }

        var heroObj = user.hero_bag.heros[pos];
        if (!heroObj) {
            resp.code = 1; resp.desc = 'hero error'; break;
        }

        var index = slotIndex - 1;
        var oldRid = heroObj['rune_use'][index];
        if (oldRid > 0) {
            player.changeRune(oldRid, 0);
        }

        heroObj['rune_use'][index] = rid;
        player.markDirty('hero_bag.heros.' + pos + '.rune_use');
        player.changeRune(rid, pos);

        //player.memData.pos[pos].rune_changed[index] = 1;

        // 标记这一类武将战斗力改变
        player.markFightForceChanged(pos);
    } while (false);

    onHandled();
};

// 卸下符文
exports.unequip_rune = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var pos = req.args.pos;   // 英雄槽位
        var slotIndex = req.args.index; // 符文镶嵌格索引
        if (!pos || !slotIndex) {
            resp.code = 1; resp.desc = 'param error'; break;
        }

        if (slotIndex < 1 || slotIndex > 4) {
            resp.code = 1; resp.desc = 'index error'; break;
        }

        var heroObj = user.hero_bag.heros[pos];
        if (!heroObj) {
            resp.code = 1; resp.desc = 'hero error'; break;
        }

        var index = slotIndex - 1;
        var rid = heroObj['rune_use'][index];
        player.changeRune(rid, 0);

        heroObj['rune_use'][index] = 0;
        player.markDirty('hero_bag.heros.' + pos + '.rune_use');

        // player.memData.pos[pos].rune_changed[slotIndex - 1] = 1;

        // 标记这一类武将战斗力改变
        player.markFightForceChanged(pos);
    } while (false);

    onHandled();
};

// 升级符文
exports.upgrade_rune = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var rid = req.args.rid;         // 符文实例id
        if (!rid) {
            resp.code = 1; resp.desc = 'param error'; break;
        }

        var runeObj = user.bag.rune[rid];
        if (!runeObj) {
            resp.code = 1; resp.desc = 'rune not exist'; break;
        }

        var curLevel = runeObj.level;
        var toLevel = curLevel + 1;

        // 是否到顶级
        if (curLevel >= Object.keys(gConfRuneUpgradeConf).max()) {
            resp.code = 1; resp.desc = 'already max level'; break;
        }

        // 不能超过最高等级
        if (toLevel > Object.keys(gConfRuneUpgradeConf).max()) {
            toLevel = Object.keys(gConfRuneUpgradeConf).max();
        }

        var runeConf = gConfRuneConf[runeObj.id];
        if (!runeConf) {
            resp.code = 1; resp.desc = 'rid is error'; break;
        }
        var runeQuality = runeConf.quality;

        // 检查材料是否满足
        var costs = gConfRuneUpgradeConf[toLevel]['cost' + runeQuality];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'consume not enough'; break;
        }

        runeObj.level = +toLevel;
        player.markDirty('bag.rune.' + rid);

        if (runeObj.hid) {
            player.markFightForceChanged(runeObj.hid);
        }

        // 查找符文是装在哪个英雄身上
        /*
        for (var i = 1; i <= 7; i++) {
            for (var j = 0; j < 4; j++) {
                if (user.rune_use[i][j] == rid) {
                    player.memData.pos[i].rune_changed[j] = 1;
                }
            }
        }
        player.markFightForceChangedAll();
        */

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.curLevel = runeObj.level;
    } while (false);

    onHandled();
};

// 根据所选品质从背包筛选要分解的装备
function findDecomposeRunesByQuality(user, qualities, essence) {
    var bag = user.bag;
    var rids = [];

    //var usingRunes = getUsingRunes(user);
    for (var rid in bag.rune) {
        var rune = bag.rune[rid];
        if (rune.hid > 0) {
            continue;
        }

        var runeConf = gConfRuneConf[rune.id];
        if (!runeConf) {
            continue;
        }

        if (runeConf.isInlay == 0) {
            // 是否要分解符文精华
            if (!essence) {
                continue;
            }
        } else {
            if ((qualities & (1 << (runeConf.quality - 1))) == 0) {
                continue;
            }
        }

        rids.push(rid);
    }

    return rids;
}

// 分解一个符文，返回消耗和奖励
function decomposeOneRune(user, rid) {
    var rune = user.bag.rune[rid];
    if (!rune) {
        return null;
    }

    var runeConf = gConfRuneConf[rune.id];
    if (!runeConf) {
        return null;
    }

    var costs = [['rune', rid, -1]];

    // 基础返还
    var awards = clone(runeConf.disassembleAward);

    var runeQuality = runeConf.quality;
    var curLevel = rune.level;

    // 升级返还
    var consumeExp = 0;
    for (var i = 1; i <= curLevel; i++) {
        consumeExp += Math.abs(gConfRuneUpgradeConf[i]['cost' + runeQuality][0][2]);
    }

    if (consumeExp > 0) {
        awards.push(['user', 'rune_exp', consumeExp]);
    }

    return [costs, awards];
}


// 分解符文 fish
exports.decompose_rune = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var rids = req.args.rids;   // 指定要分解的符文id列表
        var qualities = req.args.quality; // 分解品质，用位表示
        var essence = req.args.essence; // 是否分解符文精华
        if (qualities == NaN || qualities == undefined) {
            resp.code = 1; resp.desc = 'quality is needed'; break;
        }

        if (!rids) {
            rids = [];
        }

        if (!(util.isArray(rids))) {
            rids = [];
        }

        var findRids = findDecomposeRunesByQuality(user, qualities, essence);
        for (var i = 0; i < findRids.length; i++) {
            var exist = false;
            for (var j = 0; j < rids.length; j++) {
                if (findRids[i] == rids[j]) {
                    exist = true;
                }
            }

            if (exist == false) {
                rids.push(findRids[i]);
            }
        }

        var totalCosts = [];
        var totalAwards = [];

        for (var i = 0; i < rids.length; i++) {
            var ret = decomposeOneRune(user, rids[i]);
            if (ret) {
                totalCosts = totalCosts.concat(ret[0]);
                totalAwards = totalAwards.concat(ret[1]);
            }
        }

        totalCosts = reformAwards(totalCosts);
        totalAwards = reformAwards(totalAwards);

        resp.data.costs = player.addAwards(totalCosts, req.mod, req.act);
        resp.data.awards = player.addAwards(totalAwards, req.mod, req.act);
    } while (false);

    onHandled();
};
