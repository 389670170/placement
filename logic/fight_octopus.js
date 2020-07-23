/** 章鱼宝藏玩法 **/

const act_name = "octopus";
const item_id = 310005;
const item_num = 7;
// const item_num = 0;

var open_list = null;

function is_module_open(player) {
    var tTimeInfo = get_time_info();
    var tNowTime = common.getTime();
    // console.log(`... start:${tTimeInfo.start_time} ,now:${tNowTime} ,end:${tTimeInfo.end_time}`)
    if (tTimeInfo.start_time > tNowTime || tTimeInfo.end_time < tNowTime) {             // 不在时间阶段内
        return false;
    }

    var itemNum = player.getMatrialCount(item_id);
    return (itemNum >= item_num);
}

function get_time_info() {
    if (!open_list) {
        var tOpenList = gConfGlobalNew["avOctopusOpen"].split("|");
        tOpenList = tOpenList.sort((a, b) => { return a - b });

        for (var i = 0; i < tOpenList.length; i++) {
            open_list = open_list || [];
            open_list.push({
                week: (tOpenList[i] - 0) || 7,
                time: gConfGlobalNew["avOctopusDay"]
            })
        }
    }

    var weekDay = Date.getWeekDay();
    var tNowHour = (new Date()).getHours();
    var tWeekDayOffet = (tNowHour >= gConfGlobal.resetHour) ? 0 : -1;                                                            // 重置时间前 按照前一天来计算 否则按当日来计算
    var tTodayWeekDay = (weekDay + tWeekDayOffet) || 7;
    var start_time = start_time;
    for (var i = 0; i < open_list.length; i++) {
        var tTimeInfo = open_list[i];
        if (!tTimeInfo) { continue; }
        if (tTimeInfo.week < tTodayWeekDay) { continue; }
        var tEndTime = tTimeInfo.week + tTimeInfo.time;
        if (tEndTime > 7) {
            tEndTime = tEndTime - 7;
        }

        if (tWeekDayOffet < 0 && (tEndTime == 1)) {
            var tNewDate = new Date();
            start_time = common.getTime(common.getDate((Date.zeroWeek() / 1000) - (7 * 24 * 60 * 60) - (1 * 24 * 60 * 60) + (tTimeInfo.week * 24 * 60 * 60))) + (gConfGlobal.resetHour * 3600);     // 真实的开始时间
        }
        else {
            start_time = common.getTime(common.getDate((Date.zeroWeek() / 1000) - (1 * 24 * 60 * 60) + (tTimeInfo.week * 24 * 60 * 60))) + (gConfGlobal.resetHour * 3600);     // 真实的开始时间
        }
        return {
            start_time: start_time,
            end_time: start_time + (tTimeInfo.time * 24 * 60 * 60),
            start_week: tTimeInfo.week,
            end_week: tEndTime,
        }
    }

    start_time = gConfActivities[act_name].startTime;
    return {
        start_time: start_time,
        end_time: start_time + (gConfGlobalNew["avOctopusDay"] * 24 * 60 * 60),
        start_week: 0,
        end_week: 0,
    }
}

function get_target_brief_list(target_list, target_id) {
    target_list = target_list || {};
    var target_brief_list = {};
    for (var tKey in target_list) {
        var tTargetInfo = target_list[tKey];
        target_brief_list[tKey] = {
            uid: tTargetInfo.uid,
            vip: tTargetInfo.vip,
            level: tTargetInfo.level,
            fightforce: tTargetInfo.fight_force,
            sid: tTargetInfo.sid,
            name: tTargetInfo.name,
            headframe: tTargetInfo.headframe,
        };
        if (target_id == tKey) {
            return target_brief_list[tKey];
        }
    }
    return target_brief_list;
}

function send_user_info(info) {
    var tActInfo = {};

    tActInfo.start_week = info.start_week;                                      // 开始的星期
    tActInfo.end_week = info.end_week;                                          // 结束的星期
    tActInfo.start_time = info.start_time;                                      // 开始时间
    tActInfo.end_time = info.end_time;                                          // 结束时间
    tActInfo.heroes_state = info.heroes_state;                                  // 英雄状态 血量百分比
    tActInfo.get_reward_ids = info.get_reward_ids;                              // 领奖列表 领取过的代表已经通关的
    tActInfo.embattle = info.embattle;                                          // 布阵

    tActInfo.rank = info.rank;                                                  // 快照中的排名
    tActInfo.target_brief_list = get_target_brief_list(info.target_list);       // 目标简略信息列表
    return tActInfo;
}

function get_info(player, gen_over_call) {
    if (!player) { return {}; }

    var tCallFunc = (act_info) => {
        if (act_info) {
            player.markDirty(`${act_name}`);
        }
        if (gen_over_call) {
            gen_over_call(act_info);
        }
    }

    var onGetFightForce = function (fight_force) {
        fight_force = fight_force - 0;
        if (fight_force > 0) {
            var tTimeInfo = get_time_info();
            var start_week = tTimeInfo.start_week;
            var end_week = tTimeInfo.end_week;
            var start_time = tTimeInfo.start_time;
            var end_time = tTimeInfo.end_time;

            var user = player.user;
            user[act_name] = user[act_name] || {};
            var tActInfo = user[act_name];

            if (!tActInfo || tActInfo.start_time != start_time || !tActInfo.target_list || !tActInfo.target_list[1]) {
                user[act_name] = {};
                tActInfo = user[act_name];

                tActInfo.stage = gConfActivities[act_name].stage;   // 当前的configID
                tActInfo.start_week = start_week;                   // 开始的星期
                tActInfo.end_week = end_week;                       // 结束的星期
                tActInfo.start_time = start_time;                   // 开始时间
                tActInfo.end_time = end_time;                       // 结束时间
                tActInfo.heroes_state = {};                         // 英雄状态 血量百分比
                tActInfo.get_reward_ids = {};                       // 领奖列表 领取过的代表已经通关的
                tActInfo.embattle = [];                             // 布阵

                tActInfo.rank = 0;                                  // 快照中的排名
                tActInfo.target_list = [];                          // 目标列表
                tActInfo.target_brief_list = [];                    // 目标简略信息列表

                var tRespDate = {};
                requestGlobal(                                      // 通知跨服global获取目标列表
                    {
                        mod: "fight_rank",
                        act: "get_list_by_snapshot",
                        uid: player.uid,
                        args: {
                            snapshot_name: "octopus",
                            snapshot_time: start_time,
                        }
                    },
                    tRespDate,
                    function () {
                        var data = tRespDate.data;
                        if (data) {
                            tActInfo.target_list = data.list;
                            tActInfo.rank = data.rank;
                            tCallFunc(tActInfo);
                        }
                        else {
                            tCallFunc(null);
                        }
                    }
                );
            }
            else {
                tCallFunc(tActInfo);
            }
        }
        else {
            tCallFunc(null);
        }
    }

    if (!player.user.temp || !player.user.temp.max_fight_force) {
        player.getFightForce(true, onGetFightForce);
    }
    else {
        onGetFightForce(player.user.temp.max_fight_force);
    }
}

exports.get_info = function (player, req, resp, onHandled) {
    if (!is_module_open(player)) {
        resp.code = 1;
        resp.desc = 'not open';
        onHandled();
        return;
    }

    var func = (info) => {
        do {
            if (!info) {
                resp.code = 1;
                resp.desc = 'info error';
                break;
            }
            resp.data.octopus = send_user_info(info);
        } while (false);

        onHandled();
    }

    get_info(player, func);
};

exports.get_enemy_info = function (player, req, resp, onHandled) {
    if (!is_module_open(player)) {
        resp.code = 1;
        resp.desc = 'not open';
        onHandled();
        return;
    }

    var func = (info) => {
        do {
            if (!info) {
                resp.code = 1;
                resp.desc = 'info error';
                break;
            }
            // resp.data.enemy_brief_info = get_target_brief_list(info.target_list, req.args.enemy)
            // resp.data.enemy_info = info.target_list[req.args.enemy];
            var tTargetInfo = info.target_list[req.args.enemy];
            if (!tTargetInfo) {
                resp.code = 1;
                resp.desc = 'enemy error';
                break;
            }

            var tTargetData = tTargetInfo.target_data;
            var tTargetInfo = tTargetInfo.target_data;
            tTargetData.server_id = tTargetInfo.sid || 1;
            if (!tTargetInfo.un) {
                tTargetData.fight_force = tTargetInfo.fight;
                tTargetData.headframe = tTargetInfo.info.headframe;
                tTargetData.headpic = tTargetInfo.info.headpic;
                tTargetData.id = tTargetInfo._id;
                tTargetData.level = tTargetInfo.status.level;
                tTargetData.max_hero = tTargetInfo.headframe;
                tTargetData.name = tTargetInfo.info.un;
                tTargetData.un = tTargetInfo.info.un;
                tTargetData.vip = tTargetInfo.status.vip;
            }
            resp.data.info = tTargetData;
        } while (false);

        onHandled();
    }

    get_info(player, func);
}

exports.challenge = function (player, req, resp, onHandled) {
    if (!is_module_open(player)) {
        resp.code = 1;
        resp.desc = 'not open';
        onHandled();
        return;
    }

    var func = (info) => {
        do {
            if (!info) {
                resp.code = 1;
                resp.desc = 'info error';
                break;
            }

            var rand = Math.floor(common.randRange(100000, 999999));
            var rand_enc = tower_encrypt(rand.toString(), pubKey);
            DEBUG(`before_fight: ${rand}, ${rand_enc}`);

            player.memData.status = `prepare_${act_name}`;
            player.memData.enemy_id = +req.args.enemy;
            player.memData.fight_start_time = info.start_time;

            player.memData.rand_origin = rand;
            player.memData.rand = rand_enc;
            player.memData.rand1 = common.randRange(0, 99999);
            player.memData.rand2 = common.randRange(0, 99999);
            var tEnemyInfo = info.target_list[req.args.enemy] || {};
            player.memData.enemy = tEnemyInfo.target_data;

            var randPos = common.randRange(1, player.memData.pos_count);
            var randAttrs = common.randArrayWithNum(AttributeIds, 3);
            resp.data.fight_time = player.memData.fight_time = common.getTime();
            resp.data.rand = rand_enc;

            // 用途不明 好像之前用于校验，目前暂时保留
            var randPos = common.randRange(1, player.memData.pos_count);
            var randAttrs = common.randArrayWithNum(AttributeIds, 3);
            resp.data.rand_pos = player.memData.rand_pos = randPos;
            resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;
            resp.data.enemy = tEnemyInfo.target_data;
        } while (false);

        onHandled();
    }

    get_info(player, func);
}

/**
 * 根据战斗结果  发送奖励
 */
exports.fight = function (player, req, resp, onHandled) {
    if (!is_module_open(player)) {
        resp.code = 1;
        resp.desc = 'not open';
        onHandled();
        return;
    }

    var func = (info) => {
        var tActInfo = info;
        var user = player.user;
        do {
            if (!info) {
                resp.code = 1;
                resp.desc = 'info error';
                break;
            }

            var star = req.args.star;
            var time = req.args.time;
            var sign = req.args.sign;
            var target = req.args.enemy;
            var heroes_state = req.args.heroes_state;

            if (player.memData.status != 'prepare_octopus') {
                resp.code = 1;
                resp.desc = 'status error';
                break;
            }

            // checking
            var ff = +req.args.ff;

            if (isNaN(ff) || ff > player.getFightForce() * 1.1 || !player.check_attrs(req.args.attrs)) {
                DEBUG(`FightForce checking: ${ff}, ${player.getFightForce() * 1.1}`)
                // resp.code = 999; resp.desc = "invalid_fight_force"; break;
            }

            if (isNaN(star) || !time || !sign) {
                resp.code = 1;
                resp.desc = "invalid star";
                break;
            }

            if (!player.checkFightforce(+req.args.ff, +req.args.levels)) {
                resp.code = 999;
                resp.desc = "invalid fight octopus";
                break;
            }

            if (tActInfo.get_reward_ids[target]) {
                resp.code = 1;
                resp.desc = "invalid target";
                break;
            }

            if (player.memData.fight_start_time && info.start_time && player.memData.fight_start_time != info.start_time) {                                       // 上一个周期的一局  保留奖励，标记当前周期信息
                resp.data.awards = player.addAwards(gConfOctopusAward[target].award, req.mod, req.act);
                resp.data.octopus = send_user_info(tActInfo);
                player.memData.fight_start_time = NaN;
                player.markDirty(`${act_name}`);
                break;
            }

            var rand_origin = player.memData.rand_origin;
            var dec_sign = tower_decrypt(sign, priKey);


            var serverSign = getBattleFightSign(act_name, req.uid, time, star, rand_origin);            // 验证战斗
            DEBUG(`${act_name} fight octopus: ${dec_sign} ${serverSign} ${sign}`)
            if (serverSign != dec_sign) {
                resp.code = 999;
                resp.desc = "sign not match";
                break;
            }

            if (star == 0) {  // 战斗失败
                resp.data.octopus = send_user_info(tActInfo);
                break;
            }
            else {
                switch (gConfOctopus[target].isRecover) {
                    case 1:                                                         // 重置 参战者状态
                        for (var tKey in heroes_state) {
                            delete tActInfo.heroes_state[tKey];
                        }
                        break;
                    case 2:                                                         // 重置所有状态
                        tActInfo.heroes_state = {};
                        break;
                    default:                                                        // 记录当前状态
                        for (var tKey in heroes_state) {
                            tActInfo.heroes_state[tKey] = heroes_state[tKey];
                        }
                        break;
                }

                resp.data.awards = player.addAwards(gConfOctopusAward[target].award, req.mod, req.act);
                tActInfo.get_reward_ids[target] = true;
                resp.data.octopus = send_user_info(tActInfo);

                player.markDirty(`${act_name}`);
            }
        } while (false);

        onHandled();
    }

    get_info(player, func);
};