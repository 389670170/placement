function calcMainByType(player, type) {
    var user = player.user;
    var task = player.user.task;
    var id = gConfTask[type];
    var old_value = task.main[id];
    task.main[id] = 0;

    var reward = task.main_reward;
    var old_condition = gConfTask[id][(reward[id] ? reward[id] : 0)].condition;
    var curProgress = (reward[id] ? reward[id] : 0) + 1;

    var conf = gConfTask[id][curProgress];
    if (!conf) return;
    var condition = conf.condition;

    switch (type) {
        case 'roleQuality':
            if (condition <= old_condition) {
                task.main[id] = old_value;
            }
            //task.main[id] = player.calcRoleQuality(condition);
            break;
        case 'roleReborn':
            task.main[id] = player.calcRoleReborn(condition);
            break;
        case 'soldierLevel':
            task.main[id] = player.calcSoldierLevel(condition);
            break;
        case 'equipGod':
            task.main[id] = player.calcEquipGod(condition);
            break;
    }
    player.markDirty('task.main.' + id);
}

exports.get = function (player, req, resp, onHandled) {
    // 刷新每日粮饷
    var user = player.user;
    var task = user.task;
    var noon = gConfGlobalNew.dailyFoodNoon.split('-');
    var evening = gConfGlobalNew.dailyFoodEvening.split('-');
    var hour = new Date().getHours();
    var today = common.getDate();
    //var foodType = gConfDailyTask['food'];

    var newMark = 0;
    if (hour >= noon[0] && hour < noon[1]) {
        newMark = today * 10 + 1;
    } else if (hour >= evening[0] && hour < evening[1]) {
        newMark = today * 10 + 2;
    }

    /*
    if (task.daily[foodType] != newMark) {
        task.daily[foodType] = newMark;
        task.daily_reward[foodType] = 0;
        player.markDirty('task.daily.' + foodType);
        player.markDirty('task.daily_reward.' + foodType);
    }*/

    var alreadyLockAwards = player.updateNobility();
    if (alreadyLockAwards) {
        resp.data.already_lock_awards = player.addAwards(alreadyLockAwards, req.mod, req.act);
    }

    player.rmTip('daily_task');
    player.rmTip('main_task');

    resp.data.task = user.task;

    onHandled();
};

// 单项每日任务奖励
exports.daily_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var ids = req.args.ids;
        if (!util.isArray(ids) || ids.length == 0) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var valid = true;
        var dailyTask = user.task.daily;
        for (var i = 0, len = ids.length; i < len; i++) {
            var id = ids[i];
            if (!gConfDailyTask[id]) {
                LOG(1);
                valid = false;
                break;
            }

            if (!dailyTask[id] || dailyTask[id] < gConfDailyTask[id].target) {
                LOG(2);
                valid = false;
                break;
            }

            if (player.user.task.daily_reward[id]) {
                LOG(3);
                valid = false;
                break;
            }
        }

        if (!valid) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var awards = [];
        for (var i = 0, len = ids.length; i < len; i++) {
            var id = ids[i];
            player.user.task.daily_reward[id] = 1;
            player.markDirty('task.daily_reward.' + id);

            user.task.active += gConfDailyTask[id].active;
            player.markDirty('task.active');
            var event = gConfDailyTask[id].event;
            if (event == 'weekCard' || event == 'monthCard' || event == 'longCard') {
                var award = gConfDailyTask[id].award;  // 基础奖励

                var giftCash = award[0][2];
                user.payment.gift_cash += giftCash;
                player.markDirty('payment.gift_cash');

                var logConf = gConfPlayLog['activity'][event];
                if (logConf) {
                    player.recordPlay(logConf.logName, logConf.logType);
                }

                if (event == 'monthCard') {
                    // vip额外奖励
                    var vipExtraAward = gConfVip[user.status.vip].monthCard;
                    if (vipExtraAward.length > 0) {
                        award = award.concat(vipExtraAward);
                    }
                }
                awards = awards.concat(award);
            } else {
                var award = clone(gConfDailyTask[id].award);

                awards = awards.concat(award);
                player.doGuideTask('task', 1);
            }
        }

        //requestWorldByModAndAct({uid: req.uid}, 'new_legion', 'update_active', {'ids': ids});

        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.active = user.task.active;

        var alreadyLockAwards = player.updateNobility();
        if (alreadyLockAwards) {
            resp.data.already_lock_awards = player.addAwards(alreadyLockAwards, req.mod, req.act);
        }

        user.online_stat.daily_task_count++;
        player.markDirty('online_stat.daily_task_count');

        if (user.online_stat.daily_task_count == 5) {
            var args = {
                openid: player.user.info.account,
                sid: config.DistId,
                device_id: player.user.info.device_id,
                platform: player.user.info.platform,
            }
            LogCollect(player.uid, 'daily_task_count', args);
        }

    } while (false);

    onHandled();
};

// 活跃度奖励
exports.active_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var active = req.args.active;
        var conf = gConfDailyTaskReward[active];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var task = user.task;
        if (active <= task.daily_active) {
            resp.code = 1; resp.desc = 'already got'; break;
        }

        var userActive = 0;
        var dailyTask = task.daily;
        for (var id in dailyTask) {
            var taskConf = gConfDailyTask[id];
            if (dailyTask[id] >= taskConf.target) {
                userActive += taskConf.active;
            }
        }

        if (userActive < active) {
            resp.code = 1; resp.desc = 'not achieved'; break;
        }

        task.daily_active = +active;
        player.markDirty('task.daily_active');
        resp.data.awards = player.addAwards(conf.award, req.mod, req.act);
    } while (false);

    onHandled();
};

// 主线任务奖励
exports.mainline_reward = function (player, req, resp, onHandled) {
    var user = player.user;

    do {
        var id = req.args.id;
        var conf = gConfTask[id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var task = user.task;
        var mainTask = task.main;
        var reward = task.main_reward;
        var curProgress = (reward[id] ? reward[id] : 0) + 1;

        if (!conf[curProgress]) {
            resp.code = 1; resp.desc = 'not Achieved1'; break;
        }

        if (conf[curProgress].event == 'fightPower') {
            if (!mainTask[id] || mainTask[id] < conf[curProgress].target * 10000) {
                resp.code = 1; resp.desc = 'not Achieved2'; break;
            }
        } else if (conf[curProgress].event == 'battle' || conf[curProgress].event == 'elite' || conf[curProgress].event == 'hard' || conf[curProgress].event == 'nightmare' || conf[curProgress].event == 'hell') {
            var typeArr = { 'battle': 1, 'elite': 2, 'hard': 3, 'nightmare': 4, 'hell': 5 };
            var tarType = typeArr[conf[curProgress].event];
            var battleType = user.battle.type;
            var battleProgress = user.battle.progress - 1;

            if (battleType < tarType) {
                resp.code = 1; resp.desc = 'battleType not Achieved'; break;
            }
            else if (battleType == tarType) {
                var taskBattleProgress = tarType * 1000 + battleProgress;

                // DEBUG("taskBattleProgress = " + taskBattleProgress);

                if (taskBattleProgress < conf[curProgress].target) {
                    resp.code = 1; resp.desc = 'battleProgress not Achieved'; break;
                }
            }
            else {

            }

        } else {
            if (!mainTask[id] || mainTask[id] < conf[curProgress].target) {
                resp.code = 1; resp.desc = 'not Achieved3'; break;
            }
        }

        if (reward[id]) {
            reward[id]++;
        } else {
            reward[id] = 1;
        }
        player.markDirty('task.main_reward.' + id);
        resp.data.awards = player.addAwards(conf[curProgress].award, req.mod, req.act);

        var type = conf[curProgress].event;
        if (type == 'roleReborn' || type == 'equipGod' || type == 'soldierLevel') {
            calcMainByType(player, type);
            resp.data.progress = mainTask[id];
        }
        else if (type == 'roleQuality') {
            calcMainByType(player, type);
            resp.data.progress = mainTask[id];
        }

        // 刷新成就属性
        for (var pos in user.pos) {
            player.markFightForceChanged(pos);
        }
    } while (false);

    onHandled();
};

// 地图成就任务奖励
exports.world_situation_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        //console.log(util.format("%j", gConfWorldSituation));
        var id = req.args.id;
        var conf = gConfWorldSituation[id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (user.battle.progress < conf.target || !user.battle.progress) {
            resp.code = 1; resp.desc = 'not arrive'; break;
        }

        var task = user.task;
        var reward = task.world_reward;
        if (reward[id]) {
            resp.code = 1; resp.desc = 'has got'; break;
        }

        reward[id] = 1;
        player.markDirty('task.world_reward.' + id);

        resp.data.awards = player.addAwards(conf.award, req.mod, req.act);
    } while (false);

    onHandled();
};

// 获取引导任务数据
exports.get_guide_task = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        resp.data.guide_task = user.guide_task;
    } while (false);

    onHandled();
};

// 领取引导任务奖励
exports.get_guide_task_award = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = +req.args.id;
        if (!id) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var taskConf = gConfGuideTask[id];
        if (!taskConf) {
            resp.code = 1; resp.desc = 'can not find task'; break;
        }

        var guide_task = user.guide_task;
        if (!guide_task[id]) {
            resp.code = 1; resp.desc = 'not finish'; break;
        }

        if (taskConf.event == 'villageOpen' || taskConf.event == 'king_treasure') {
            if (guide_task[id][0] != taskConf.condition[0]) {
                resp.code = 1; resp.desc = 'task not finish'; break;
            }
        } else {
            if (guide_task[id][0] < taskConf.condition[0]) {
                resp.code = 1; resp.desc = 'task not finish'; break;
            }
        }

        // 奖励是否已领取
        if (guide_task[id] && guide_task[id][1] > 0) {
            resp.code = 1; resp.desc = 'has got award'; break;
        }

        resp.data.awards = player.addAwards(taskConf.award, req.mod, req.act);
        guide_task[id][1] = 1;
        player.markDirty(util.format('guide_task.%d', id));
    } while (false);

    onHandled();
};

// 更新引导任务变量
exports.update_guide_task_progress = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var event = req.args.event;
        if (!event) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        player.doGuideTask(event, 1);
        resp.data.guide_task = user.guide_task;
    } while (false);

    onHandled();
};