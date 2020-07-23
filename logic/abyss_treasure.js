/** 深渊世界 **/

/** 小关卡最大数量 */
const MAX_LITTLE_PROGRESS = 5;
/** 难度的最大区域数量 */
var diff_max_regin = null;


/** 深渊世界玩家信息 */
function get_abyss_treasure_info(player) {
    var user = player.user;
    if (!user.abyss_treasure) {
        user.abyss_treasure = {};
    }
    if (!user.abyss_treasure.progress) {
        user.abyss_treasure.progress = {};
    }
    if (!user.abyss_treasure.reward_box) {
        user.abyss_treasure.reward_box = {};
    }
    return user.abyss_treasure;
};

/**
 * 是否为深渊旋涡关卡
 * @param {number} progress 关卡id
 * @returns boolean true 代表是深渊旋涡
 */
function is_special_progress(progress) {
    return ((progress % 100100) == 0)
};

/**
 * 是否为有效关卡
 * @param {*} player 
 * @param {number} progress 
 */
function is_valid_progress(player, progress) {
    var abyss_treasure_info = get_abyss_treasure_info(player);
    if (!diff_max_regin) {
        diff_max_regin = diff_max_regin || {};
        for (var tKey in gConfAbyssTreasureCustom) {
            var diff = ~~(tKey / 100000);
            var tRegion = ~~((tKey % 100000) / 100);
            diff_max_regin[diff] = gConfAbyssTreasureCustom[diff] > tRegion ? gConfAbyssTreasureCustom[diff] : tRegion;
        }
    }

    if (abyss_treasure_info.progress[progress] == 3) {                                       // 已经三星通关
        return false;
    }

    if (is_special_progress(progress) && abyss_treasure_info.progress[progress]) {           // 旋涡关卡 已经通关
        return false
    }

    var user = player.user;
    if (gConfAbyssTreasureCustom[progress] && gConfAbyssTreasureCustom[progress].challengeLimit == "level" && gConfAbyssTreasureCustom[progress].target > user.status.level) {
        return false;
    }

    var diff = ~~(progress / 100000);                                   // 难度
    var region = ~~((progress % 100000) / 100);                         // 区域
    var little_progress = ~~(progress % 100);                           // 小关卡
    // if (100101 == progress) {                                         // 第一关 只要功能开启就可以打

    if (region == 1 && little_progress == 1) {
        if (diff == 1) {                                                                    // 第一关 只要功能开启就可以打
            return isModuleOpen_new(player, 'abyssTreasure');
        }
        else {                                                                              // 某个难度的第一关
            var tProgress = (diff - 1) * 100000 + (diff_max_regin[(diff - 1)] || 1) * 100 + MAX_LITTLE_PROGRESS;
            return abyss_treasure_info.progress[tProgress]
        }
    }
    else if (little_progress == 0) {
        var tTotalStar = 0;
        for (var i = 0; i < MAX_LITTLE_PROGRESS; i++) {
            tTotalStar += abyss_treasure_info.progress[(diff * 100000) + (region * 100) + i + 1];
        }

        return (tTotalStar == (MAX_LITTLE_PROGRESS * 3));                                    // 旋涡关卡 直接判断上一个关卡是否全3星
    }
    else if (little_progress == 1) {
        return abyss_treasure_info.progress[(diff * 100000) + ((region - 1) * 100) + MAX_LITTLE_PROGRESS];              // 一般关卡 判断上一区域的最后一关是否通关
    }
    else {
        return (abyss_treasure_info.progress[(diff * 100000) + (region * 100) + (little_progress - 1)] > 0);            // 不是旋涡关卡 直接判断上一个关卡是否已经通过
    }
    return false;
};

/** 获取信息 */
exports.get_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var abyss_treasure_info = get_abyss_treasure_info(player);

        resp.data.progress = abyss_treasure_info.progress;
        resp.data.reward_box = abyss_treasure_info.reward_box;
        player.markDirty('abyss_treasure');
    } while (false);

    onHandled();
};

/** 战斗前准备 */
exports.before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'abyssTreasure')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        var progress = req.args.progress;
        var type = req.args.type;
        var team = req.args.team;
        var desc = null;

        var abyss_treasure_info = get_abyss_treasure_info(player);

        if (!is_valid_progress(player, progress)) {
            resp.code = 1;
            resp.desc = 'error progress';
            break;
        }

        if (team) {
            if (!player.syncTeam(1, team)) {
                resp.code = 1;
                resp.desc = 'args error';
                break;
            }
        }

        var rand = Math.floor(common.randRange(100000, 999999));
        var rand_enc = tower_encrypt(rand.toString(), pubKey);

        player.memData.rand_origin = rand;
        player.memData.rand = rand_enc;
        player.memData.fight_time = common.getTime();

        resp.data.rand = rand_enc;
    } while (false);

    onHandled();
};

/**
 * 根据战斗结果  发送奖励
 */
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var star = (req.args.star - 0) || 0;
        var time = req.args.time;
        var sign = req.args.sign;
        var progress = req.args.progress;
        if (!isModuleOpen_new(player, 'abyssTreasure')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        if (!is_valid_progress(player, progress)) {
            resp.code = 1;
            resp.desc = "error progress";
            break;
        }

        if (isNaN(star) || !time || !sign || star > 3) {
            resp.code = 1;
            resp.desc = "invalid star";
            break;
        }

        var ff = +req.args.ff;

        if (isNaN(ff) || ff > player.getFightForce() * 1.5) {
            DEBUG(`FightForce checking: ${ff}, ${player.getFightForce()}, ${req.uid}`)
            resp.code = 999; resp.desc = "invalid_fight_force";
            break;
        }

        // 验证战斗
        var dec_sign = tower_decrypt(sign, priKey);
        var serverSign = getBattleFightSign('abyss_treasure', req.uid, time, star, player.memData.rand_origin);
        DEBUG(`abyss_treasure fight: ${dec_sign} ${serverSign} ${sign}`)
        if (serverSign != dec_sign) {
            resp.code = 999;
            resp.desc = "sign not match";
            break;
        }

        var abyss_treasure_info = get_abyss_treasure_info(player);
        if (star <= 0 && !abyss_treasure_info.progress[progress]) {
            abyss_treasure_info.progress[progress] = star;
            resp.data.progress = abyss_treasure_info.progress;
            player.markDirty("abyss_treasure");
            break;
        }

        if (is_special_progress(progress)) {
            star = 3;
        }

        if (abyss_treasure_info.progress[progress]) {                // 之前通关过
            abyss_treasure_info.progress[progress] = (abyss_treasure_info.progress[progress] > star) ? abyss_treasure_info.progress[progress] : star;
            player.markDirty("abyss_treasure");
            resp.data.progress = abyss_treasure_info.progress;
            logic_event_mgr.emit(logic_event_mgr.EVENT.ABYSS_PROGRESS, progress, star, false);
            break;                                          // 不需要发送奖励
        }

        abyss_treasure_info.progress[progress] = (abyss_treasure_info.progress[progress] > star) ? abyss_treasure_info.progress[progress] : star;
        player.markDirty("abyss_treasure");
        resp.data.awards = player.addAwards(gConfAbyssTreasureCustom[progress].award, req.mod, req.act);
        logic_event_mgr.emit(logic_event_mgr.EVENT.ABYSS_PROGRESS, progress, star, true);
    } while (false);

    onHandled();
};

/**
 * 重置
 */
exports.reset_num = function (player, req, resp, onHandled) {
    return;
};

/**
 * 扫荡
 */
exports.sweep = function (player, req, resp, onHandled) {
    return;
};

// 马上完成扫荡
exports.sweep_complete = function (player, req, resp, onHandled) {
    return;
};

/**
 * 停止扫荡||扫荡完成并发送奖励
 */
exports.stop_sweep = function (player, req, resp, onHandled) {
    return;
};

/**
 * 获取奖励
 */
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        if (!isModuleOpen_new(player, 'abyssTreasure')) {
            resp.code = 1;
            resp.desc = 'not open';
            break;
        }

        if (!id) {
            resp.desc = 'not id';
            break;
        }

        var effort = gConfAbyssTreasureBox[id];
        if (!effort || !effort.lootId) {        // 奖励不存在
            resp.desc = 'not effort';
            break;
        }

        var abyss_treasure_info = get_abyss_treasure_info(player);
        if (abyss_treasure_info.reward_box[id]) {        // 已经领取
            resp.desc = 'already get';
            break;
        }

        var start_progress = (id * 100) + 1;
        var tTotalStarCount = 0;
        for (var i = start_progress; i < (start_progress + MAX_LITTLE_PROGRESS); i++) {
            tTotalStarCount = tTotalStarCount + abyss_treasure_info.progress[i];
        }
        if (tTotalStarCount < (MAX_LITTLE_PROGRESS * 2)) {                 // 星数不足 无法领取
            resp.desc = 'cant get';
            break;
        }

        abyss_treasure_info.reward_box[id] = 1;
        player.markDirty('abyss_treasure.reward_box');
        resp.data.reward_box = abyss_treasure_info.reward_box;

        var tBoxAward = generateDrop(effort.lootId, user.status.level);
        resp.data.awards = player.addAwards(tBoxAward, req.mod, req.act);

        logic_event_mgr.emit(logic_event_mgr.EVENT.ABYSS_GET_BOX, id);
    } while (false);

    onHandled();
};