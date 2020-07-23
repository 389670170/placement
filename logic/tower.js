/** 勇者之塔玩法 **/

exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var awards = [];
        var curFloor = user.tower.cur_floor;
        var maxFloor = user.tower.top_floor;    // 历史最高层
        var oldFloor = curFloor;
        if (user.tower.sweep_start_time > 0) {
            // 正在扫荡
            var ret = calcFloor(player, user.tower.cur_floor + 1, user.tower.sweep_start_time, maxFloor);// [当前层数，当前时间]
            if (ret.floor == maxFloor) {
                // 扫荡到历史最高层，才需要停止扫荡并发奖
                curFloor = ret.floor;
                awards = ret.awards;
                user.tower.sweep_start_time = 0;
                user.tower.cur_floor = curFloor;

                player.markDirty('tower.cur_floor');
                player.markDirty('tower.sweep_start_time');
            }
        }

        requestWorld(req, resp, function () {
            var rank = resp.data.rank;
            resp.data = user.tower;
            resp.data.old_floor = oldFloor;
            resp.data.rank = rank;
            resp.data.awards = player.addAwards(awards, req.mod, req.act);
            onHandled();
            return;
        });

        return;
    } while (false);

    onHandled();
};

exports.before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'tower')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var tower = user.tower;
        var floor = tower.cur_floor;

        if (floor == gMaxFloorInTower) {
            resp.code = 1; resp.desc = 'to reset'; break;
        }

        var team = req.args.team;
        if (team) {
            if (!player.syncTeam(1, team)) {
                resp.code = 1; resp.desc = 'args error'; break;
            }
        }

        var rand = Math.floor(common.randRange(100000, 999999));
        var rand_enc = tower_encrypt(rand.toString(), pubKey);
        DEBUG(`before_fight: ${rand}, ${rand_enc}`);

        player.memData.rand_origin = rand;
        player.memData.rand = rand_enc;
        player.memData.fight_time = common.getTime();
        player.memData.status = 'fight';

        resp.data.rand = rand_enc;
    } while (false);

    onHandled();
};

/**
 * 根据战斗结果  发送奖励   排行榜
 */
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var star = req.args.star;
        var time = req.args.time;
        var sign = req.args.sign;
        if (!isModuleOpen_new(player, 'tower')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status != 'fight') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        // checking
        var ff = +req.args.ff;

        if (isNaN(ff) || ff > player.getFightForce() * 1.1 || !player.check_attrs(req.args.attrs)) {
            DEBUG(`FightForce checking: ${ff}, ${player.getFightForce() * 1.1}`)
            // resp.code = 999; resp.desc = "invalid_fight_force"; break;
        }

        if (isNaN(star) || !time || !sign) {
            resp.code = 1; resp.desc = "invalid star"; break;
        }

        if (!player.checkFightforce(+req.args.ff, +req.args.levels)) {
            resp.code = 9; resp.desc = "invalid fight"; break;
        }

        // 即将挑战的层数
        var nextFloor = user.tower.cur_floor + 1;

        // 是否已经通关
        if (nextFloor > gMaxFloorInTower) {
            resp.code = 1;
            resp.desc = "already max floor";
            break;
        }

        // 等级判断
        if (user.status.level < gConfTower[nextFloor].level) {
            resp.code = 1;
            resp.desc = "not level enough";
            break;
        }

        var rand_origin = player.memData.rand_origin;
        var dec_sign = tower_decrypt(sign, priKey);

        // 验证战斗
        var serverSign = getBattleFightSign('tower', req.uid, time, star, rand_origin);

        DEBUG(`tower fight: ${dec_sign} ${serverSign} ${sign}`)

        if (serverSign != dec_sign) {
            resp.code = 999; resp.desc = "sign not match"; break;
        }

        var tower = user.tower;
        var floor = tower.cur_floor;
        var awards = [];
        if (star > 0) {
            tower.cur_floor = nextFloor;
            player.markDirty('tower.cur_floor');

            // 历史最高改变
            if (tower.cur_floor > tower.top_floor) {
                tower.top_floor = tower.cur_floor;
                tower.top_time = common.getTime();
                player.markDirty('tower.top_floor');
                player.markDirty('tower.top_time');

                // 开服七天乐任务
                player.doOpenSeven('towerTier')
                player.doOpenHoliday('towerTier')
                // 实时更新排行榜
                req.args.top_floor = tower.top_floor;
                req.args.new_time = common.getTime();
                req.args.max_floor = gMaxFloorInTower;
                requestWorld(req, resp);
            }

            var conf = gConfTower[tower.cur_floor];
            awards.push(conf.award[0]);
            awards.push(conf.award[1]);

            if (conf.box) {
                var runeAwards = player.getRuneDropAward();
                awards = awards.concat(runeAwards);
            }

            resp.data.awards = player.addAwards(awards, req.mod, req.act);
        }
    } while (false);

    onHandled();
};

/**
 * 重置
 */
exports.reset_num = function (player, req, resp, onHandled) {
    var user = player.user;

    do {
        var tower = user.tower;

        // 判断是否还是重置次数
        var allResetNum = gConfVip[user.status.vip].towerAgainTimes;
        if (tower.reset_num >= allResetNum) {// 可以重置
            resp.code = 1; resp.desc = 'max count'; break;
        }

        // 检查元宝是否满足
        var resetNum = tower.reset_num + 1;
        var cost = gConfBuy[resetNum].towerReset;
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc = 'cash not enough'; break;
        }

        tower.reset_num++;
        tower.cur_floor = 0;
        tower.sweep_start_time = 0;

        player.markDirty('tower.reset_num');
        player.markDirty('tower.cur_floor');
        player.markDirty('tower.sweep_start_time');

        resp.data.reset_num = tower.reset_num;
        resp.data.costs = player.addAwards(cost, req.mod, req.act);

        player.doDailyTask('tower', 1);
    } while (false);

    onHandled();
};

/**
 * 扫荡
 */
exports.sweep = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'tower')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.tower.sweep_start_time > 0) {
            resp.code = 1;
            resp.desc = 'current sweep';
            break;
        }

        var tower = user.tower;
        var floor = tower.cur_floor;

        if (floor >= user.tower.top_floor) {
            resp.code = 1; resp.desc = 'to reset'; break;
        }

        tower.sweep_start_time = common.getTime();

        player.markDirty('tower.sweep_start_time');
        resp.data.sweep_start_time = tower.sweep_start_time;
    } while (false);

    onHandled();
};

// 马上完成扫荡
exports.sweep_complete = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var tower = user.tower;
        var old_floor = tower.cur_floor;
        if (tower.cur_floor >= tower.top_floor) {
            resp.code = 1; resp.desc = 'reach top floor'; break;
        }

        var ret = calcFloor(player, tower.cur_floor + 1, 0, tower.top_floor);
        tower.cur_floor = ret.floor;
        tower.sweep_start_time = 0;
        player.markDirty('tower.cur_floor');
        player.markDirty('tower.sweep_start_time');

        resp.data.awards = reformAwards(player.addAwards(ret.awards, req.mod, req.act));
        resp.data.cur_floor = tower.cur_floor;
        resp.data.old_floor = old_floor;
    } while (false);

    onHandled();
};

/**
 * 停止扫荡||扫荡完成并发送奖励
 */
exports.stop_sweep = function (player, req, resp, onHandled) {
    var user = player.user,
        tower = user.tower,
        old_floor = tower.cur_floor;
    do {
        if (tower.sweep_start_time == 0) {
            resp.desc = 'current sweep';
            break;
        }
        var curTime = common.getTime(),
            sweepRaidsTime = tower.sweep_start_time;// 扫荡开始时间
        var passTime = curTime - sweepRaidsTime;

        if (passTime < 0) {
            resp.desc = 'not stop sweep';
            break;
        }

        var ret = calcFloor(player, tower.cur_floor + 1, sweepRaidsTime, tower.top_floor);
        tower.cur_floor = ret.floor;
        tower.sweep_start_time = 0;
        player.markDirty('tower.cur_floor');

        resp.data.awards = reformAwards(player.addAwards(ret.awards, req.mod, req.act));
        resp.data.cur_floor = ret.floor;
        resp.data.old_floor = old_floor;
    } while (false);

    onHandled();
};

/**
 * 获取奖励
 */
exports.get_effort = function (player, req, resp, onHandled) {
    var user = player.user;
    var id = req.args.id;
    do {
        if (!id) {
            resp.desc = 'not id'; break;
        }
        var effort = gConfTowerresultaward[id] || 0;
        // 奖励不存在
        if (!effort) {
            resp.desc = 'not effort'; break;
        }
        // 已经领取
        if (user.tower.get_effort.contains(id)) {
            resp.desc = 'already get'; break;
        }

        var awards = [];
        awards.push(effort.award[0]);
        awards.push(effort.award[1]);
        effort.award[2] && awards.push(effort.award[2]);

        user.tower.get_effort.push(id);
        player.markDirty('tower.get_effort');
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};



// 排行榜
exports.rank_list = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        req.args.top_floor = user.tower.top_floor;
        req.args.new_time = common.getTime();
        // req.args.max_floor = gMaxFloorInTower;
        requestWorld(req, resp, function () {
            resp.data.floor = user.tower.top_floor;
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

/**
 * 计算当前扫荡到多少层并返回奖励
 * @start_floor     开始层数
 * @start_time      开始时间
 * @max_floor       最大层数
 * @returns {{}}    floor：当前的层数  awards
 */
function calcFloor(player, start_floor, start_time, max_floor) {
    var ret = {};
    var now_time = common.getTime();
    var passTime = now_time - start_time;   // 逝去的时间
    var awards = [];
    var targetFloor = start_floor;// 开始层数
    do {
        if (passTime <= 0) {
            targetFloor--;
            break;
        }

        for (var i = targetFloor; i <= Object.keys(gConfTower).max(); i++) {
            if (targetFloor > max_floor) break;
            passTime -= gConfTower[i].costTime;
            if (passTime < 0) {
                targetFloor = i - 1;
                break;
            }// 如果小于0当前这一层不算

            targetFloor = i;
            awards.push(gConfTower[i].award[0]);
            awards.push(gConfTower[i].award[1]);
            if (gConfTower[i].box > 0) {
                var runeAwards = player.getRuneDropAward();
                awards = awards.concat(runeAwards);
            }
        }
    } while (false);

    if (targetFloor > max_floor) {
        targetFloor = max_floor;
    }

    ret.floor = targetFloor;
    ret.awards = awards;
    return ret;
}

// 获取正在使用的符文列表
function getUsingRunes(user) {
    var usingRunes = {};
    for (var i = 1; i <= 7; i++) {
        for (var j = 0; j <= 4; j++) {
            if (user.rune_use[i][j] != 0) {
                usingRunes[user.rune_use[i][j]] = 1;
            }
        }
    }
    return usingRunes;
}

// 根据所选品质从背包筛选要分解的装备
function findDecomposeRunesByQuality(user, qualities, essence) {
    var bag = user.bag;
    var rids = [];

    var usingRunes = getUsingRunes(user);
    for (var rid in bag.rune) {
        var rune = bag.rune[rid];
        if (usingRunes[rid]) {
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

// 获取符文使用数据
exports.get_rune = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        resp.data.rune_use = user.rune_use;
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

        user.rune_use[pos][slotIndex - 1] = rid;
        player.markDirty('rune_use.' + pos);

        player.memData.pos[pos].rune_changed[slotIndex - 1] = 1;

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

        user.rune_use[pos][slotIndex - 1] = 0;
        player.markDirty('rune_use.' + pos);

        player.memData.pos[pos].rune_changed[slotIndex - 1] = 1;

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
        var toLevel = req.args.to_level;    // 要升到多少级
        if (!rid) {
            resp.code = 1; resp.desc = 'param error'; break;
        }

        var runeObj = user.bag.rune[rid];
        if (!runeObj) {
            resp.code = 1; resp.desc = 'rune not exist'; break;
        }

        var curLevel = runeObj.level;
        if (!toLevel) {
            toLevel = curLevel + 1;
        }

        // 是否到顶级
        if (runeObj.level >= Object.keys(gConfRuneUpgradeConf).max()) {
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
        var costs = [];
        for (var i = curLevel + 1; i <= toLevel; i++) {
            costs = costs.concat(gConfRuneUpgradeConf[i]['cost' + runeQuality])
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'consume not enough'; break;
        }


        costs = player.addAwards(costs, req.mod, req.act);
        runeObj.level += costs.length;
        // runeObj.level = toLevel;
        player.markDirty('bag.rune.' + rid);

        // 查找符文是装在哪个英雄身上
        for (var i = 1; i <= 7; i++) {
            for (var j = 0; j < 4; j++) {
                if (user.rune_use[i][j] == rid) {
                    player.memData.pos[i].rune_changed[j] = 1;
                }
            }
        }
        player.markFightForceChangedAll();

        resp.data.costs = costs;
        resp.data.curLevel = runeObj.level;
    } while (false);

    onHandled();
};

// 分解符文
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

