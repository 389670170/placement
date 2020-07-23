// 成长之路，又名帝王，各种成长引导，包括巨龙篇，宝物篇，村庄篇，竞技篇，帝王篇

// 根据当前章节获取下一章节
function getNextKingChapter(chapter, id) {
    var ret = {};

    // 是否还有下一章
    if (chapter == 0) {
        ret.conf = gConfCustomKing[1][1];
        ret.chapter = 1;
        ret.index = 1;
    } else if (!gConfCustomKing[chapter + 1]) {
        // 是否还有下一节
        if (!gConfCustomKing[chapter][id + 1]) {
            ret = 0;
        } else {
            ret.conf = gConfCustomKing[chapter][id + 1];
            ret.chapter = chapter;
            ret.index = id + 1;
        }
    } else {
        // 是否没有下一节了
        if (!gConfCustomKing[chapter][id + 1]) {
            ret.conf = gConfCustomKing[chapter + 1][1];
            ret.chapter = chapter + 1;
            ret.index = 1;
        } else {
            ret.conf = gConfCustomKing[chapter][id + 1];
            ret.chapter = chapter;
            ret.index = id + 1;
        }
    }

    return ret;
}

// 主角品阶提升
/*
exports.upgrade_hero = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var king_upgrade = user.custom_king;
        var nextChapter = getNextKingChapter(king_upgrade.chapter, king_upgrade.index);
        if (!nextChapter) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        // 检查升级条件是否满足
        var costs = [];
        for (var i = 1; i <= 4; i++) {
            var need = nextChapter.conf['need' + i];
            costs = costs.concat(need);
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'need not enough'; break;
        }

        var oldQuality = player.getQuality();

        king_upgrade.chapter = nextChapter.chapter;
        king_upgrade.index = nextChapter.index;

        var newQuality = player.getQuality();
        if (newQuality != oldQuality) {
            king_upgrade.upgrade_time[newQuality] = common.getTime();
        }

        player.markDirty('custom_king');
        player.markFightForceChangedAll();
        player.updateHeadFrameStatus('player', player.getQuality());

        // 消耗
        resp.data.costs = player.addAwards(costs);
        resp.data.custom_king = king_upgrade;
    } while (false);

    onHandled();
};
*/

// 村庄战斗
exports.village_before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var villageId = req.args.id;
        if (!villageId) {
            resp.code = 1; resp.decs = 'invalid village id'; break;
        }

        var villageConf = gConfCustomVillage[villageId];
        if (!villageConf) {
            resp.code = 1; resp.decs = 'conf error'; break;
        }

        // 检查关卡条件是否满足
        var limitCityType = villageConf.limitType;
        var limitCityId = villageConf.limitCustom;
        
        if ( !player.ispassbattle(limitCityType,limitCityId) ) {
            resp.code = 1; resp.decs = 'progress not fit'; break;
        }

        // 检查是否已经解救过了
        if (user.custom_village.indexOf(villageId) >= 0) {
            resp.code = 1; resp.decs = 'allready released'; break;
        }

        resp.data.rand = Math.floor(common.randRange(100000, 999999));
    } while (false);

    onHandled();
};

exports.village_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var villageId = req.args.id;
        if (!villageId) {
            resp.code = 1; resp.decs = 'invalid village id'; break;
        }

        var star = req.args.star;
        if (star > 0) {
            var villageConf = gConfCustomVillage[villageId];
            if (!villageConf) {
                resp.code = 1; resp.decs = 'conf error'; break;
            }

            // 检查关卡条件是否满足
            var limitCityType = villageConf.limitType;
            var limitCityId = villageConf.limitCustom;
        
            if ( !player.ispassbattle(limitCityType,limitCityId) ) {
                resp.code = 1; resp.decs = 'progress not fit'; break;
            }

            // 检查是否已经解救过了
            if (user.custom_village.indexOf(villageId) >= 0) {
                resp.code = 1; resp.decs = 'allready released'; break;
            }

            var awards = villageConf.award;
            resp.data.awards = player.addAwards(awards, 'growpath', 'village_fight')

            player.onVillageRelease(villageId);
        }
    } while (false);

    onHandled();
};

// 宝物战斗
exports.treasure_before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var treasureId = req.args.treasure_id;
        if (!treasureId) {
            resp.code = 1; resp.decs = 'invalid village id'; break;
        }

        var treasureIdConf = gConfCustomTreasure[treasureId];
        if (!treasureIdConf) {
            resp.code = 1; resp.decs = 'conf error'; break;
        }

        // 检查玩家等级
        if (user.status.level < treasureIdConf.challengeLimitLevel) {
            resp.code = 1; resp.decs = 'level not enough'; break;
        }

        // 检查是否已经解救过了
        if (user.custom_treasure.indexOf(treasureId) >= 0) {
            resp.code = 1; resp.decs = 'allready released'; break;
        }

        resp.data.rand = Math.floor(common.randRange(100000, 999999));
    } while (false);

    onHandled();
};

exports.treasure_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var formationId = req.args.id;
        var treasureId = req.args.treasure_id;
        if (!formationId || !treasureId) {
            resp.code = 1; resp.decs = 'invalid village id'; break;
        }

        var star = req.args.star;
        if (star > 0) {
            var treasureIdConf = gConfCustomTreasure[treasureId];
            if (!treasureIdConf) {
                resp.code = 1; resp.decs = 'conf error'; break;
            }

            // 检查玩家等级
            if (user.status.level < treasureIdConf.challengeLimitLevel) {
                resp.code = 1; resp.decs = 'level not enough'; break;
            }

            // 检查是否已经解救过了
            if (user.custom_treasure.indexOf(treasureId) >= 0) {
                resp.code = 1; resp.decs = 'allready released'; break;
            }

            player.onTreasureGet(treasureId);
        }
    } while (false);

    onHandled();
};

// 领取帝王之路奖励
/*
exports.get_custom_king_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var boxId = req.args.box_id;
        if (!boxId) {
            resp.code = 1; resp.decs = 'invalid box id'; break;
        }

        var conf = gConfCustomKingWay[boxId];
        if (!conf) {
            resp.code = 1; resp.decs = 'can not find conf, id = ' + boxId; break;
        }

        // 检查玩家是否已领取
        if (user.custom_king.award_get.indexOf(boxId) >= 0) {
            resp.code = 1; resp.decs = 'has got'; break;
        }

        user.custom_king.award_get.push(boxId);
        player.markDirty('custom_king.award_get');

        var awards = conf.award;
        var dropId = 0;
        var itemConf = gConfItem[awards[0][1]];
        if (itemConf && itemConf.useType == 'box') {
            var boxAwards = parseAwardsConfig(itemConf.useEffect);
            if (boxAwards[0][0] == 'drop') {
                dropId = boxAwards[0][1];
            }
        }

        if (dropId > 0) {
            awards = generateDrop(dropId, user.status.level);
        }

        resp.data.awards = player.addAwards(awards, req.mod, req.act);

    } while (false);

    onHandled();
};*/