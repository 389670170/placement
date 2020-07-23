// 部位养成模块
// by gjx

// 普通觉醒
exports.normal_awake = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var heroIndex = req.args.pos;
        // 武将索引
        var heroObj = user.hero_bag.heros[heroIndex];
        if (!heroObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;

        if (!heroObj.part[part_pos].max_awake) {
            resp.code = 1; resp.desc = 'no max awake'; break;
        }

        var cur_level = heroObj.part[part_pos].awake_level;
        var next_level = cur_level + 1;
        if (!gConfPartAwake[part_pos][next_level]) {
            resp.code = 1; resp.desc = 'already max level'; break;
        }

        // 检查金钱、材料是否满足
        var costs = [];
        costs = costs.concat(gConfPartAwake[part_pos][next_level].costNormalAwake);

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        // 扣除材料
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        // 修改觉醒等级
        heroObj.part[part_pos].awake_level += 1;
        player.markDirty(util.format("hero_bag.heros.%d.part.%d.awake_level", heroIndex, part_pos));
        //player.markDirty(util.format("pos.%d.part.%d.awake_level", req.args.pos, part_pos));

        // 刷新角色属性
        //player.markFightForceChanged(req.args.pos);

        player.doGuideTask('part', 1);
        player.doOpenSeven('partAwake', 1);
        player.doOpenHoliday('partAwake', 1);
    } while (false);

    onHandled();
};

// 极限觉醒
exports.max_awake = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 武将索引
        var heroIndex = req.args.pos;
        var heroCosts = req.args.cost_heros;
        var myHeros = user.hero_bag.heros;
        var heroObj = myHeros[heroIndex];
        if (!heroObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;
        if (heroObj.part[part_pos].max_awake) {
            resp.code = 1; resp.desc = 'already max awake'; break;
        }

        var tMaxAwakeNum = gConfLevel[heroObj.level].partAwake;
        var tNowAwakeNum = 0;
        for (var tKey in heroObj.part) {
            if (!heroObj.part[tKey] || !heroObj.part[tKey].max_awake) { continue; }
            tNowAwakeNum++;
        }
        if (tNowAwakeNum >= tMaxAwakeNum) {
            resp.code = 1; resp.desc = 'already max awake'; break;
        }

        // 检查金钱、材料是否满足
        var costs = [];
        var targetHeroConf = gConfHero[heroObj.rid];
        var targetHeroTemplateId = targetHeroConf.awake > 4 ? targetHeroConf.templatedIdUltimate : targetHeroConf.heroTemplateId;
        var tCostMaxAwake = (gConfCombatHeroTemplate[targetHeroTemplateId].camp == 5) ? [2, 5, 1] : gConfPartBase[part_pos].costMaxAwake;
        var starOrId = tCostMaxAwake[1];
        var ownNum = 0;
        var trueCostHeros = [];
        for (var i = 0; i < heroCosts.length; i++) {
            var theHero = myHeros[heroCosts[i]];
            if (!theHero) { continue; }

            switch (tCostMaxAwake[0]) {                                                                   // 消耗角色
                case 1:                                                                                     // 消耗指定角色
                    if (theHero.rid != starOrId) { continue; }
                    trueCostHeros.push(heroCosts[i]);
                    ownNum += 1;
                    break;
                case 2:                                                                                     // 消耗指定星等的任意角色
                    var heroConf = gConfHero[theHero.rid];
                    if (!heroConf) { continue; }

                    var heroTemplateId = heroConf.heroTemplateId;                                               // hero模板id
                    if (theHero.awake > 4) {
                        heroTemplateId = heroConf.templatedIdUltimate;
                    }

                    var starBase = gConfCombatHeroTemplate[heroTemplateId]['starBase'];                         // 模板類型

                    if (starBase + theHero.awake - 1 != starOrId) { continue; }
                    // ERROR('==========+1 IN==STAR===='+starOrId);
                    trueCostHeros.push(heroCosts[i]);
                    ownNum += 1;
                    break;
                case 3:                                                                                     // 消耗5星本体
                    var selfCostId = gConfHero[heroObj.rid]['selfCostId'];
                    //ERROR('==========+1 IN==selfCostId===='+selfCostId+' ?=costrid:'+theHero.rid);
                    if (selfCostId != theHero.rid) { continue; }

                    trueCostHeros.push(heroCosts[i]);
                    ownNum += 1;
                    break;
                default:
                    break;
            }
        }
        if (tCostMaxAwake[2] != ownNum) {
            resp.code = 1;
            resp.desc = 'material not enough';
            break;
        }

        // 扣除材料
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        var heroBack = player.deleteHeros(trueCostHeros);
        resp.data.awards = player.addAwards(heroBack, req.mod, req.act);

        // 修改觉醒等级
        heroObj.part[part_pos].max_awake = true;
        player.markDirty(util.format("hero_bag.heros.%d.part.%d.max_awake", req.args.pos, part_pos));

        // 刷新角色属性 to do by fish
        // player.markFightForceChanged(req.args.pos);
    } while (false);

    onHandled();
};

// 镶嵌宝石
exports.embed_gem = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 需要的参数：武将索引、部位索引、宝石索引、宝石id
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos) ||
            isNaN(req.args.gem_pos) || isNaN(req.args.gem_id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 武将索引
        var posObj = user.hero_bag.heros[req.args.pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;
        if (!posObj.part[part_pos]) {
            resp.code = 1; resp.desc = 'part error'; break;
        }

        // 宝石索引
        var gem_index = req.args.gem_pos;

        // 检查宝石槽位是否已开启
        var awakeLevel = posObj.part[part_pos].awake_level;
        var needLevel = gConfGlobalNew['partEmbedLimit' + gem_index];
        if (awakeLevel < needLevel) {
            resp.code = 1; resp.desc = 'slot not open'; break;
        }

        var gem_id = req.args.gem_id;
        var tSelectGemInfo = gConfGem[gem_id];
        if (!tSelectGemInfo) {
            resp.code = 1; resp.desc = 'gem error'; break;
        }

        var tIdx = gem_index - 1;
        tIdx = (tIdx < 0) ? 0 : tIdx;
        var tCanUseGemType = gConfPartBase[part_pos].embedGemType[tIdx];
        switch (tCanUseGemType) {
            case 0:
                for (var tKey in posObj.part[part_pos].gems) {
                    if (tKey == tIdx) { continue; }                                         // 是目标位置不用检查是否重复
                    var tPosNowGemInfo = posObj.part[part_pos].gems[tKey];
                    if (!tPosNowGemInfo) { continue; }
                    if (gConfPartBase[part_pos].embedGemType[tKey] != 0) { continue; }      // 检查的位置需要的是限定类型不需要检测
                    if (tSelectGemInfo.type != tPosNowGemInfo.type) { continue; }           // 检查的位置当前类型和选择的类型不同

                    resp.code = 1;
                    resp.desc = 'repeat gem type ';
                    break;
                }
                break;
            default:
                if (tCanUseGemType != tSelectGemInfo.type) {
                    resp.code = 1;
                    resp.desc = 'error gem type ';
                    break;
                }
                break;
        }
        if (resp.code) {                                                                    // 有错 后续不镶嵌
            break;
        }

        // 检查原有位置上是否已经有宝石
        var costs = [];
        if (posObj.part[part_pos].gems[gem_index] != 0) {
            // 先卸下原来的宝石
            costs.push(['gem', posObj.part[part_pos].gems[gem_index], 1]);
            posObj.part[part_pos].gems[gem_index] = 0;
        }

        posObj.part[part_pos].gems[gem_index] = gem_id;                                     // 装上新宝石

        costs.push(['gem', gem_id, -1]);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        player.markDirty(util.format("hero_bag.heros.%d.part.%d.gems.%d", req.args.pos, part_pos, gem_index));

        player.doGuideTask('partgem', 1);
        player.doOpenSeven('gemLevel', 1);
        player.doOpenHoliday('gemLevel', 1);
        // 刷新属性
        //player.markFightForceChanged(req.args.pos);
    } while (false);

    onHandled();
};

// 一键镶嵌
exports.embed_all_gem = function (player, req, resp, onHandled) {

};

// 卸下宝石
exports.takeoff_gem = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 需要的参数：武将索引、部位索引、宝石索引
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos) || isNaN(req.args.gem_pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 武将索引
        var posObj = user.hero_bag.heros[req.args.pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;
        if (!posObj.part[part_pos]) {
            resp.code = 1; resp.desc = 'part error'; break;
        }

        // 宝石索引
        var gem_index = req.args.gem_pos;
        if (!posObj.part[part_pos].gems[gem_index]) {
            resp.code = 1; resp.desc = 'gem index error'; break;
        }

        // 检查指定位置上是否有宝石
        if (posObj.part[part_pos].gems[gem_index] == 0) {
            resp.code = 1; resp.desc = 'no gem at index'; break;
        }

        // 卸下
        var costs = [];
        costs.push(['gem', posObj.part[part_pos].gems[gem_index], 1]);
        posObj.part[part_pos].gems[gem_index] = 0;

        player.markDirty(util.format("hero_bag.heros.%d.part.%d.gems.%d", req.args.pos, part_pos, gem_index));
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        // 刷新属性
        player.markFightForceChanged(req.args.pos);
    } while (false);

    onHandled();
};

// 一键卸下
exports.takeoff_all_gems = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 需要的参数：武将索引、部位索引
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 武将索引
        var posObj = user.hero_bag.heros[req.args.pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;
        if (!posObj.part[part_pos]) {
            resp.code = 1; resp.desc = 'part error'; break;
        }

        var costs = [];
        for (var i = 1; i <= 4; i++) {
            if (posObj.part[part_pos].gems[i] != 0) {
                costs.push(['gem', posObj.part[part_pos].gems[i], 1]);
                posObj.part[part_pos].gems[i] = 0;
                player.markDirty(util.format("hero_bag.heros.%d.part.%d.gems.%d", req.args.pos, part_pos, i));
            }
        }

        if (costs.length > 0) {
            resp.data.costs = player.addAwards(costs, req.mod, req.act);

            // 刷新属性
            player.markFightForceChanged(req.args.pos);
        }
    } while (false);

    onHandled();
};

// 宝石升级
exports.upgrade_gem = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 需要的参数：武将索引、部位索引、宝石索引
        if (isNaN(req.args.pos) || isNaN(req.args.part_pos) || isNaN(req.args.gem_pos)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        // 武将索引
        var posObj = user.hero_bag.heros[req.args.pos];
        if (!posObj) {
            resp.code = 1; resp.desc = 'no hero'; break;
        }

        // 部位索引
        var part_pos = req.args.part_pos;
        if (!posObj.part[part_pos]) {
            resp.code = 1; resp.desc = 'part error'; break;
        }

        // 检查指定位置是否有宝石
        var gem_pos = req.args.gem_pos;
        if (posObj.part[part_pos].gems[gem_pos] == 0) {
            resp.code = 1; resp.desc = 'no gem'; break;
        }

        // 检查宝石是否已经到顶级
        var gem_id = posObj.part[part_pos].gems[gem_pos];
        var nextGemId = gem_id + 1;
        var confGem = gConfGem[gem_id];
        var nextGemConf = gConfGem[nextGemId];
        if (!nextGemConf) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var costs = [];
        // 检查金币够不够
        //costs = costs.concat(gConfGem[gem_id].cost);
        //if (!player.checkCosts(costs)) {
        //    resp.code = 1; resp.desc = 'gold not enough'; break;
        //}

        // 检查升级材料够不够
        var curLevel = gem_id % 100;
        var gemType = parseInt(gem_id / 100);

        var needNum = 3;
        var factor = 3;

        var canUpgrade = false;
        for (var i = curLevel; i >= 1; i--) {
            var hasNum = player.getGemNumByTypeAndLevel(gemType, i);
            var consumeId = gemType * 100 + i;

            if (i == curLevel) {
                needNum -= 1;   // 除去部位上面本身这一颗
            }

            if (hasNum >= needNum) {
                costs.push(["gem", consumeId, -needNum]);
                canUpgrade = true;
                break;
            } else {
                if (hasNum > 0) {
                    costs.push(["gem", consumeId, -hasNum]);
                }

                needNum = (needNum - hasNum) * factor
            }
        }

        if (!canUpgrade) {
            resp.code = 1; resp.desc = 'gem not enough'; break;
        }

        // 满足升级条件，可以升级了
        posObj.part[part_pos].gems[gem_pos] = nextGemId;
        player.markDirty(util.format("hero_bag.heros.%d.part.%d.gems.%d", req.args.pos, part_pos, gem_pos));
        resp.data.costs = player.addAwards(costs, req.mod, req.act);

        // 刷新属性
        //player.markFightForceChanged(req.args.pos);

        player.doGuideTask('partgem', 1);
        player.doOpenSeven('gemLevel', 1);
        player.doOpenHoliday('gemLevel', 1);
    } while (false);

    onHandled();
};