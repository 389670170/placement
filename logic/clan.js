var ErrorCode = require('../common/teamdefine').ErrorCode;

// 创建战队   创建成功只需要返回消耗，战队信息进入主界面请求接口
exports.create = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'team')) {
            resp.code = ErrorCode.ERROR_TEAM_NOT_OPEN; resp.desc = 'not open'; break;
        }

        // 战队名字检测是否合法
        var name = req.args.name.toString().replace(/\s\r\n/g,'');
        var nameLen = 0;
        for (var i = 0,len = name.length;i<len;i++) {
            name.isChineseWord(i) ? (nameLen += 2) : nameLen++;
        }

        // 检查战队名字是否为空
        if (!name || nameLen == 0) {
            resp.code = ErrorCode.ERROR_TEAM_NAME_EMPTY; resp.desc = 'name is empty';break;
        }

        if (nameLen > 12){
            resp.code = ErrorCode.ERROR_TEAM_NAME_TOO_LONE; resp.desc = 'name too long';break;
        }

        var cost = parseAwardsConfig(gConfGlobalNew.teamCreatCost);
        if (!player.checkCosts(cost)){
            resp.code = ErrorCode.ERROR_CREATE_COSTS_NOT_ENOUGH; resp.desc = 'lack of resources'; break;
        }

        //var un = user.info.un;
        //if (!un){
        //    resp.code = ErrorCode.ERROR_NICKNAME_IS_EMPTY; resp.desc = 'un is null';break;
        //}

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                resp.data.costs = player.addAwards(cost);
                updateWssData(req.uid, {team_id : resp.data.teamId});
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 修改战队公告
exports.modify_bulletin = function (player, req, resp, onHandled) {
    do {
        var bulletinName = req.args.bulletinName || '';

        bulletinName && (bulletinName = bulletinName.replace(/\s\r\n/g,''));  // 战队公告
        var nameLen = 0;
        for (var i = 0,len = bulletinName.length;i<len;i++) {
            bulletinName.isChineseWord(i) ? (nameLen += 2) : nameLen++;
        }

        if (!bulletinName || nameLen == 0){
            resp.code = ErrorCode.ERROR_BULLETIN_IS_EMPTY; resp.desc = 'not null'; break;
        }

        if(nameLen > 48){
            resp.code = ErrorCode.ERROR_BULLETIN_TOO_LONE; resp.desc = 'bulletinName too long';break;
        }

        req.args.bulletinName = bulletinName;
        requestWorld(req,resp,onHandled);
        return;
    } while (false);

    onHandled();
};

// 解散战队（队长可操作）
exports.dissolve_team = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp,onHandled());
        //updateWssData(req.uid, {team_id : 0});
    } while (false);
};

// 战队更改名字（队长可操作）
exports.modify_name = function (player, req, resp, onHandled) {
    do {
        // 战队名字检测是否合法
        var name = req.args.name.replace(/\s\r\n/g,'');
        var nameLen = 0;
        for (var i = 0,len = name.length;i<len;i++) {
            name.isChineseWord(i) ? (nameLen += 2) : nameLen++;
        }

        if (nameLen > 12){
            resp.code = ErrorCode.ERROR_TEAM_NAME_TOO_LONE; resp.desc = 'name too long';break;
        }

        var cost = parseAwardsConfig(gConfGlobalNew.teamNameChageCost);
        if (!player.checkCosts(cost)){
            resp.code = ErrorCode.ERROR_MODIFY_NAME_COSTS_NOT_ENOUGH; resp.desc = 'lack of resources';break;
        }

        requestWorld(req,resp,function () {
            if(resp.code == 0){
                resp.data.costs = player.addAwards(cost, req.mod, req.act);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 查询战队列表（包括已经申请的战队，已经申请的在最上面）|| 输入战队id查找（如果有战队有id表示查找）
exports.get_team_list = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
    } while (false);
};

// 申请战队（马上加入，满足条件加入，不可加入）
exports.join_team = function (player, req, resp, onHandled) {
    do {
        //var un = player.user.info.un;
        //if (!un){
        //    resp.code = ErrorCode.ERROR_NICKNAME_IS_EMPTY; resp.desc = 'not un';break;
        //}

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                if (resp.data.joinTerm == 2) {
                    // 直接加入
                    updateWssData(req.uid, {team_id : resp.data.teamId});
                }
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 撤销申请加入战队
exports.undo_join = function (player, req, resp, onHandled) {
    do{
        requestWorld(req,resp,onHandled);
    }while (false);
};

// 进入战队界面（成员展示客户端按照时间排序） 检测战队是否解散
exports.get_team = function (player, req, resp, onHandled) {
    var user = player.user;
    // player.doGuideTask('team', 1);
    do {
        requestWorld(req, resp, function () {
            if (resp.data && resp.data.team) {
                player.memData.team_id = resp.data.team.team_id;
                player.memData.team_name = resp.data.team.name;
                player.memData.team_level = resp.data.team.level;
                player.doTask('teamLevel', 1);

                resp.data.clan = user.clan;
                resp.data.clan.team_id = resp.data.team.team_id;
                resp.data.clan.leader = resp.data.team.uid;
                user.clan.can_use_badge = resp.data.team.can_use_badge;
                resp.data.clan.can_use_badge = resp.data.team.can_use_badge;
                resp.data.clan.awardBox = resp.data.team.awardBox;
                resp.data.clan.team_level =  resp.data.team.level;
                resp.data.team_level = resp.data.team.level;
            }

            onHandled();
        });
    } while (false);
};

exports.challenge = function(player, req, resp, onHandled) {
    if (req.uid == req.args.enemy) {
        resp.code = 1; resp.desc = 'fight self';
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            player.memData.rand1 = resp.data.rand1;
            player.memData.enemy_id = +req.args.enemy;
            player.memData.rand2 = resp.data.rand2;
            player.memData.fight_info = resp.data.info;
            player.memData.fight_enemy = resp.data.enemy;

            var randPos = common.randRange(1, player.memData.pos_count);
            var randAttrs = common.randArrayWithNum(AttributeIds, 3);
            resp.data.fight_time = player.memData.fight_time = common.getTime();
            resp.data.rand_pos = player.memData.rand_pos = randPos;
            resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;
        }
        onHandled();
    });
};

// 获取战队成员列表
exports.get_member_list = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
    }  while (false);
};

// 退出队伍（队长不可直接退出）
exports.leave_team = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp, function () {
            if (resp.code == 0) {
                player.memData.team_id = 0;
            }
            onHandled();
        });
    } while (false);
};

// 同意入队，不同意入队（队长可操作）
exports.reply_join = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,function () {
            if (resp.code == 0) {
                updateWssData(+req.args.applyUid, {team_id : resp.data.teamId});
            }
            onHandled();
        });
    } while (false);
};

// 入队申请列表（队长可操作）
exports.get_apply_list = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled)
    } while (false);
};

// 获取战队已经激活的徽章
// 战队人数改变，玩家升级,登录调用该接口
exports.get_can_use_badge = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,function () {
            if (resp.code == 0) {
                var canUseBadge = resp.data.can_use_badge;
                player.user.clan.can_use_badge = canUseBadge;
                player.markDirty('clan.can_use_badge');
                player.markFightForceChangedAll();
            }
            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

// 佩戴徽章（队长可操作）
exports.use_badge = function (player, req, resp, onHandled) {
    do {
        var badgeId = req.args.id;
        if (!badgeId) {
            resp.code = 1; resp.desc = 'not badgeId'; break;
        }

        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

// 获取入队条件
exports.get_join_term = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
        return;
    } while (false);
    onHandled();
};

// 修改申请的入队的条件（队长可操作）
exports.modify_join_term = function (player, req, resp, onHandled) {
    do {
        var joinWay = req.args.joinWay;
        // var joinTerm = req.args.joinTerm;// joinTerm:{level:1}
        if (!joinWay && joinWay !== 0){
            resp.code = 1; resp.desc='not join way';break;
        }

        requestWorld(req,resp,onHandled);
        return;
    } while (false);

    onHandled();
};

// 任命队长（队长可操作）
exports.nominate_leader = function (player, req, resp, onHandled) {
    do {
        // var nominateUid = req.args.nominateUid;
        requestWorld(req,resp,onHandled)
        return;
    } while (false);

    onHandled();
};

// 踢出队伍（队长可操作）
exports.kicked_out = function (player, req, resp, onHandled) {
    do {
        // var kickedUid = req.args.kickedUid;// 踢出队伍的玩家id
        requestWorld(req,resp, function () {
            if (resp.code == 0) {
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 弹劾（满足要求才能弹劾）
exports.impeach = function (player, req, resp, onHandled) {
    do {
        // var leaderUid = req.args.leaderUid;  // 队长id
        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

exports.is_agree = function (player, req, resp, onHandled) {
    onHandled();
};

// 检测弹劾结果
// 进入战队主界面调用
exports.is_impeach = function (player, req, resp, onHandled) {
    do {
        onHandled();
    }  while (false);

    onHandled();
};

// 清空申请列表
exports.clear_apply = function (player, req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
    } while (false);
};

//  领取每日奖励
exports.get_daily_awards = function (player,req, resp, onHandled) {
    do {
        var user = player.user;
        var clan = user.clan;
        if (clan.get_award){
            resp.code = ErrorCode.ERROR_ALREADY_GOT_AWARD; resp.desc = 'already get'; break;
        }

        requestWorld(req,resp,function () {
            if(resp.code == 0){
                player.user.clan.get_award = 1;
                player.markDirty('clan.get_award');
                resp.data.awards = player.addAwards(resp.data.awards);
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

// 获取战队排行榜
exports.get_ranks = function (player,req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
    } while (false);
};

// 进入战队任务界面获取信息
exports.get_task = function (player,req, resp, onHandled) {
    do {
        var user = player.user;
        var clan = user.clan;
        var refreshTask = clan.refresh_task;
        var flag = false;

        // 初始化任务
        var curTime = common.getTime();
        for (var i in refreshTask) {
            var taskBoard = refreshTask[i];
            if (taskBoard.length == 0){
                taskBoard[0] = common.randRange(1,7);
                taskBoard[1] = 0;
            } else {
                if (taskBoard[1] > 0 && (curTime-taskBoard[1] >= gConfGlobalNew.teamTaskRefreshTime)) {
                    refreshTask[i][0] = common.randRange(1,7);
                    refreshTask[i][1] = 0;
                    flag = true;
                }
            }
        }

        requestWorld(req, resp, function () {
            if(resp.code == 0){
                if (flag) {
                    clan.refresh_task = refreshTask;
                    player.markDirty('clan.refresh_task')
                }

                resp.data.refreshTask = refreshTask;
                resp.data.getTaskAward = clan.task_award;   // 今日已经领取的宝箱数
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 检测是否刷新任务
exports.is_refresh_task = function (player,req, resp, onHandled) {
    do {
        var user = player.user;
        var clan = user.clan;
        var posId = req.args.posId; // 栏位id
        var taskArr = clan.refresh_task[posId];

        if (!posId || !taskArr){
            resp.code = 106;resp.desc = 'not posId or taskArr';break;
        }

        if ( !taskArr[1] || common.getTime() - taskArr[1] < gConfGlobalNew.teamTaskRefreshTime){
            resp.code = 106;resp.desc = 'not refresh task';break;
        }

        taskArr = [common.randRange(1, 7), 0];
        clan.refresh_task[posId] = taskArr;
        player.markDirty('clan.refresh_task');
        resp.data.refreshTask = taskArr;

    } while (false);
    onHandled();
};

// 花钱刷新任务
exports.refresh_task = function (player,req, resp, onHandled) {
    do {
        var posId = req.args.posId;
        var clan = player.user.clan;
        var taskArr = clan.refresh_task[posId];

        // 达到当日激活任务上限
        // if (clan.task >= gConfGlobalNew.teamTaskTimeLimit){
        //     resp.code = ErrorCode.ERROR_DAILY_TASK_REACH_MAX; resp.desc = 'Daily limit has been reached';break;
        // }

        if(!taskArr[1]){
            resp.code = 106;resp.desc = 'not refresh task';break;
        }
        var cost = parseAwardsConfig(gConfGlobalNew.teamTaskResetCost);
        if(!player.checkCosts(cost)){
            resp.code = 104;resp.desc = 'lack of resources';break;
        }
        taskArr = [common.randRange(1,7),0];
        clan.refresh_task[posId] = taskArr;
        player.markDirty('clan.refresh_task');
        resp.data.refresh_task = taskArr;
        resp.data.costs = player.addAwards(cost);
    } while(false);
    onHandled();
};

// 重置任务
exports.reset_task = function (player,req, resp, onHandled) {
    do {
        var clan = player.user.clan;

        // 达到当日激活任务上限
        // if (clan.task >= gConfGlobalNew.teamTaskTimeLimit){
        //     resp.code = ErrorCode.ERROR_DAILY_TASK_REACH_MAX; resp.desc = 'Daily limit has been reached';break;
        // }

        var refreshTask = clan.refresh_task;
        var index = 0;
        for(var i in refreshTask){
            var taskArr = refreshTask[i];
            if(!taskArr[1]){
                refreshTask[i] = [common.randRange(1,7),0];
                index ++;
            }
        }

        if (!index){
            resp.code = ErrorCode.ERROR_NO_TASK_NEED_RESET; resp.desc = 'not reset';break;
        }

        var cost = parseAwardsConfig(gConfGlobalNew.teamTaskRefreshCost);
        if (!player.checkCosts(cost)){
            resp.code = ErrorCode.ERROR_TASK_RESET_COST_NOT_ENOUGH; resp.desc = 'lack of resources';break;
        }

        clan.refresh_task = refreshTask;
        player.markDirty('clan.refresh_task');
        resp.data.refresh_task = refreshTask;
        resp.data.costs = player.addAwards(cost)
    } while (false);
    onHandled();
};

// 激活完成任务
exports.active_task = function (player,req, resp, onHandled) {
    do {
        var posId = req.args.posId;
        var user = player.user;
        var clan = user.clan;
        var taskArr = clan.refresh_task[posId];
        if (!taskArr){
            resp.code = 1; resp.desc = 'not task';break;
        }

        // 达到当日激活任务上限
        if (clan.task >= gConfGlobalNew.teamTaskTimeLimit){
            resp.code = ErrorCode.ERROR_DAILY_TASK_REACH_MAX; resp.desc = 'Daily limit has been reached';break;
        }

        if (taskArr[1] > 0) {
            resp.code = ErrorCode.ERROR_TASK_ALREADY_ACTIVE;resp.desc = 'already active';break;
        }

        var taskArgs = clone(taskArr);
        taskArgs[1] = common.getTime();
        req.args.taskArr = taskArgs;
        requestWorld(req,resp,function () {
            if(resp.code == 0){
                clan.task ++ ;
                taskArr[1] = common.getTime();
                player.markDirty('clan.task');
                clan.refresh_task[posId] = taskArr;
                player.markDirty('clan.refresh_task');

                resp.data.refresh_task = clan.refresh_task[posId];
                resp.data.task = clan.task;
                resp.data.awards = player.addAwards(resp.data.awards);

                player.doDailyTask('teamTask', 1);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 领取战队任务宝箱
exports.get_awards_box = function (player,req, resp, onHandled) {
    do {
        var user = player.user;
        var clan = user.clan;

        if (clan.task_award >= gConfGlobalNew.teamTaskAwardLimit){
            resp.code = ErrorCode.ERROR_DAILY_AWARD_COUNT_MAX; resp.desc = 'award_box is capped';break;
        }

        requestWorld(req,resp,function () {
            if(resp.code == 0) {
                clan.task_award ++;
                player.markDirty('clan.task_award');
                resp.data.awards = player.addAwards(resp.data.awards);
                resp.data.getTaskAward = clan.task_award;
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

exports.auto_dissolve_team = function (player,req, resp, onHandled) {
    do{
        requestWorld(req,resp,onHandled);
    } while (false);

};

exports.get_clan_log = function (player,req, resp, onHandled) {
    do {
        requestWorld(req,resp,onHandled);
    } while (false);

};

// 获取小队信息
exports.get_team_info = function (player,req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

// 清除村庄争夺功能中跨服地块上冗余的队伍玩家
exports.tidy_team_member = function (player,req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};
