
// 检测条件是否完成
function condi_check(player, cond_id) {

    var cond = gConfOutlineCondition[cond_id];
    var data = cond.eventPara[0];

    if (data == 0) {
        return true;
    }

    if (cond.event == "battle") {
        var battle = player.user.battle;
        if (battle.progress > data ) {
            return true;
        }
    } else if (cond.event == "village") {
        if (player.isVillageReleased(data)) {
            return true;
        }
    } else if (cond.event == "treasure") {
        if (player.user.custom_treasure.indexOf(data) >= 0) {
            return true;
        }
    } else if (cond.event == "level") {
        if (player.user.status.level >= data) {
            return true;
        }
    } else if (cond.event == "fight") {
        if (player.user.mark.max_fight_force >= data) {
            return true;
        }
    } else if (cond.event == "nextday") {
        if (player.user.mark.login_days > data) {
            return true;
        }
    } else if (cond.event == "title") {
        var d0 = cond.eventPara[0];   // 要求达到的英雄数量
        var d1 = cond.eventPara[1];   // 达到的等级
        var cnt = stat_hero_title_count(player, d1);
        if (cnt >= d0) {
            return true;
        }
    } else if (cond.event == "dragon") {
        var d0 = cond.eventPara[0];   // 要求达到的龙的数量
        var d1 = cond.eventPara[1];   // 达到的阶数
        var cnt = stat_dragon_count(player, d1);
        if (cnt >= d0) {
            return true;
        }
    } else if (cond.event == "boss") {
        var d0 = cond.eventPara[0];   // 第几个BOSS
        var d1 = cond.eventPara[1];   // 击杀次数
        var cnt = stat_boss_count(player, d0);
        if (cnt >= d1) {
            return true;
        }
    }

    return false;
}


// 完成情况
function get_val(player, cond_id) {

    var cond = gConfOutlineCondition[cond_id];
    var curr = 0;

    if (cond.event == "battle") {
        curr = player.user.battle.progress -1;
    } else if (cond.event == "village") {
        curr = player.user.custom_village.length;
    } else if (cond.event == "treasure") {
        curr = player.user.custom_treasure.length;
    } else if (cond.event == "level") {
        curr = player.user.status.level;
    } else if (cond.event == "fight") {
        curr = player.user.mark.max_fight_force;
    } else if (cond.event == "nextday") {
        curr = player.user.mark.login_days;
    } else if (cond.event == "title") {
        var d1 = cond.eventPara[1];
        curr = stat_hero_title_count(player, d1);
    } else if (cond.event == "dragon") {
        var d1 = cond.eventPara[1];
        curr = stat_dragon_count(player, d1);
    } else if (cond.event == "boss") {
        var d0 = cond.eventPara[0];
        curr = stat_boss_count(player, d0);
    }

    return curr;
}

// 统计达到指定头衔等级的英雄的数量
function stat_hero_title_count(player, d) {
    var cnt = 0;

    for (var pos = 1; pos <= MaxPos; pos++) {
        var posObj = player.user.pos[pos];
        if (!posObj) {
            continue;
        }

        if (posObj.quality >= d) {
            cnt++;
        }
    }

    return cnt;
}

// 统计达到指定阶数的龙的数量
function stat_dragon_count(player, d) {
    var cnt = 0;

    for (let id in player.user.dragon) {
        var dragon = player.user.dragon[id];
        if (dragon && dragon.level >= d) {
            cnt++;
        }
    }

    return cnt;
}

// 统计指定BOSS的挑战次数
function stat_boss_count(player, id) {
    var ret = 0;
    if (player.user.outline_rec.kill_count[id]) {
        ret = player.user.outline_rec.kill_count[id][0];
    }
    return ret;
}

function outline_check(player) {

    var info = {
        'guide': {},
        'boss': {},
    };
    var change = 0;

    var outline = player.user.mark.outline;

    // check guide
    var p = outline.guide.progress;

    for (var id in gConfOutlineTheme) {

        var theme = gConfOutlineTheme[id];
        let k1 = theme.id;

        info.guide[k1] = {};

        if (!p[k1]) {
            p[k1] = {};
        }

        for (var i = 0; i < theme.condition.length; i++) {

            let k2 = i + 1;
            let cond = theme.condition[i];

            if (!p[k1][k2]) {
                p[k1][k2] = 0;
                change = 1;
            }

            if (p[k1][k2] == 0) {
                if (condi_check(player, cond)) {
                    p[k1][k2] = 1;
                    change = 1;
                }
            }

            info.guide[k1][k2] = get_val(player, cond);
        }
    }

    // check boss
    var p = outline.boss.progress;

    for (var id in gConfOutlineDayBoss) {

        var boss = gConfOutlineDayBoss[id];
        let k1 = boss.id;

        info.boss[k1] = {};

        if (!p[k1]) {
            p[k1] = {};
            change = 1;
        }

        for (var i = 0; i < boss.condition.length; i++) {
            let k2 = i + 1;

            let cond = boss.condition[i];

            if (!p[k1][k2]) {
                p[k1][k2] = 0;
                change = 1;
            }

            if (p[k1][k2] == 0) {
                if (condi_check(player, cond)) {
                    p[k1][k2] = 1;
                    change = 1;
                }
            }

            info.boss[k1][k2] = get_val(player, cond);
        }
    }

    if( change ){
        player.markDirty('mark.outline');
    }
    
    return info;
}


// 某一轮是否完成
function is_progress_achieve(progress) {

    for (let k in progress) {
        if (progress[k] == 0) {
            return false;
        }
    }

    return true;
}

// 生成随机表
function outline_make_rand(outline_rec) {

    var arr = [];
    var total = 0;

    for (var id in gConfOutlineBeadChange) {
        var change = gConfOutlineBeadChange[id];
        total += change.cycleManner;
    }

    for (var id in gConfOutlineBeadChange) {
        var change = gConfOutlineBeadChange[id];
        for (var j = 0; j < change.cycleManner; j++) {
            arr.push(change.id)
        }
    }

    arr.shuffle();

    outline_rec.rand_other = arr;
}


// ----------------------------------------------------------------------------


// 获取整体信息
exports.get_info = function (player, req, resp, onHandled) {

    // 特殊处理
    if (true) {

        let outline = player.user.mark.outline;
        let progress = outline.guide.progress;

        let keys = Object.keys(progress);
        if (keys.length == 4) {
            let p4 = progress[4];
            progress[2] = p4;
            delete progress[3];
            delete progress[4];
        }

        let got = outline.guide.got;
        keys = Object.keys(got);

        if (keys.length > 2){
            if (got[3]){
                got[2] = 0;
                delete got[3];
            }

            if (got[4]){
                got[2] = 1;
                delete got[4];
            }
        }

        if (got[2] && outline.now_show != 'boss') {
            outline.now_show = 'boss';
        }
    }

    // 检测条件
    var rec = outline_check(player);

    resp.data.info = player.user.mark.outline;
    resp.data.rec = rec;
    resp.data.pass = player.user.outline_rec.boss_pass;

    player.markDirty('mark.outline');

    onHandled();
};

// 领取奖励
/*
    参数: id 关卡ID
*/
exports.get_award = function (player, req, resp, onHandled) {
    var rec = outline_check(player);

    var guide = player.user.mark.outline.guide;
    var id = req.args.id;

    do {

        // 检测参数
        if (!id) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var theme = gConfOutlineTheme[id];
        if (!theme) {
            resp.code = 1; resp.desc = 'not found theme conf'; break;
        }

        // 是否已经领取
        if (guide.got[id] == 1) {
            resp.code = 1; resp.desc = 'got yet'; break;
        }

        // 检测条件是否全部完成
        var progress = guide.progress[id];
        if (!is_progress_achieve(progress)) {
            resp.code = 1; resp.desc = 'not achieve'; break;
        }

        // 设置标记
        guide.got[id] = 1

        if (theme.open) {
            player.user.mark.outline.now_show = theme.open
        }

        // 发放奖励
        if (id != 1) {
        // 被特殊处理了
            resp.data.awards = player.addAwards(theme.award, req.mod, req.act);
        }

        resp.data.info = player.user.mark.outline;
        resp.data.rec = rec;
        resp.data.pass = player.user.outline_rec.boss_pass;

        player.markDirty('mark.outline');

    } while (false);

    onHandled();
};


// 检测条件
exports.boss_fight_check = function (player, req, resp, onHandled) {
    var rec = outline_check(player);

    var outline = player.user.mark.outline;
    var id = req.args.id;

    var pass = 0;

    do {

        // 检测参数
        if (!id) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var dayboss = gConfOutlineDayBoss[id];
        if (!dayboss) {
            resp.code = 1; resp.desc = 'not found dayboss conf'; break;
        }

        if (req.args.pass) {
            pass = 1;
        }

        if (outline.now_show == "guide") {
            resp.code = 1; resp.desc = 'not boss stage'; break;
        }

        let boss = outline.boss;

        // 检测条件是否全部完成
        var progress = boss.progress[id];
        if (!is_progress_achieve(progress)) {
            resp.code = 1; resp.desc = 'not achieve'; break;
        }

        // 今日次数是否还有剩余
        var vip = player.user.status.vip;
        if (boss.fight >= gConfVip[vip].dragonBossDayLimit) {
            resp.code = 1; resp.desc = 'fight times exceed'; break;
        }

    } while (false);

    onHandled();
}


// 战斗(具体数据客户端自己搞)
exports.boss_fight = function (player, req, resp, onHandled) {
    var rec = outline_check(player);

    var outline = player.user.mark.outline;
    var id = req.args.id;

    do {

        // 检测参数
        if (!id) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var dayboss = gConfOutlineDayBoss[id];
        if (!dayboss) {
            resp.code = 1; resp.desc = 'not found dayboss conf'; break;
        }

        if (outline.now_show == "guide") {
            resp.code = 1; resp.desc = 'not boss stage'; break;
        }

        let boss = outline.boss;

        // 检测条件是否全部完成
        var progress = boss.progress[id];
        if (!is_progress_achieve(progress)) {
            resp.code = 1; resp.desc = 'not achieve'; break;
        }

        // 今日次数是否还有剩余
        var vip = player.user.status.vip;
        if (boss.fight_num >= gConfVip[vip].dragonBossDayLimit) {
            resp.code = 1; resp.desc = 'fight times exceed'; break;
        }

        var outline_rec = player.user.outline_rec;
        outline_rec.boss_pass[id] = 1;

        boss.fight_num++;

        var cycle = dayboss.specialAwardCycle;

        var kc = outline_rec.kill_count;
        if (!kc[id]) {
            kc[id] = [0, 1];       // 1 击杀次数 2几率随机值
            kc[id][1] = common.randRange(1, cycle-1);
        }

        kc[id][0]++;

        var special = false;

        if (kc[id][0] % cycle == kc[id][1]) {
            special = true;
        }

        if (kc[id][0] % cycle == 0) {
            // 更换随机值
            kc[id][1] = common.randRange(1, cycle-1);
        }

        // add reward
        var total_awards = player.addAwards(dayboss.award, req.mod, req.act);

        if (special) {
            let special_awards = player.addAwards(dayboss.specialAward, req.mod, req.act);
            for (var i = 0; i < special_awards.length; i++) {
                total_awards.push(special_awards[i]);
            }
        }

        resp.data.awards = total_awards;
        resp.data.info = player.user.mark.outline;
        resp.data.rec = rec;
        resp.data.pass = player.user.outline_rec.boss_pass;

        player.markDirty('mark.outline');
        player.markDirty('outline_rec');

    } while (false);

    onHandled();
}


// 兑换龙珠
exports.exchange_bead = function (player, req, resp, onHandled) {
    do {

        // 检测道具够不够
        var costs = parseAwardsConfig(gConfGlobalNew.dragonBeadChangeNeed);

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cost not enough'; break;
        }

        var id = 0;

        var outline_rec = player.user.outline_rec;

        var list = gConfGlobalNew.dragonBeadLootSpecialList.toString().split('|');

        if (outline_rec.exchg_first < list.length) {

            id = list[outline_rec.exchg_first];
            outline_rec.exchg_first++;

        } else {

            if (outline_rec.rand_other.length == 0 ||
                outline_rec.exchg_other >= outline_rec.rand_other.length) {
                outline_rec.exchg_other = 0;
                outline_make_rand(outline_rec);
            }

            id = outline_rec.rand_other[outline_rec.exchg_other];
            outline_rec.exchg_other++;
        }

        if (id == 0) {
            var keys = Object.keys(gConfOutlineBeadChange);
            var idx  = common.randRange(0, keys.length-1);
            id = keys[idx];
        }

        var conf = gConfOutlineBeadChange[id];

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(conf.award, req.mod, req.act);

        player.markDirty('outline_rec');

    } while (false);

    onHandled();
}


// ----------------------------------------------------------------------------
// 非请求类的导出接口

// 同步到客户端
// 有两个事件未条用该接口(boss  nextday)
global.outline_sync_to_client = function (player) {

    var rec = outline_check(player);

    pushToUser(player.uid, 'self', {
        mod : 'user',
        act : 'outline_refresh',
        info : player.user.mark.outline,
        rec : rec,
    });
}
