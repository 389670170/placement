// 村庄争夺、土地争夺
var ErrorCode = require('../landgrabber/error.js').ErrorCode;

exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var crossArgs = {};
        if (player.isNeedSyncToLandGrabber()) {
            var tmpData = mapObject(user, gInitWorldUser);
            var updateData = mapObject(tmpData, gLandGrabberUser);

            crossArgs.user = updateData;
            crossArgs.serverId = config.ServerId;
        }

        var crossReq = {
            uid : req.uid,
            mod : 'landgrabber',
            act : 'get',
            args : crossArgs,
        };

        var crossResp = {
            code : 0,
            data : {},
            desc : '',
        };

        requestLandGrabber(crossReq, crossResp, function() {
            requestWorld(req, resp, function() {
                if (!resp.data.villages) {
                    resp.data.villages = {};
                }

                // 跨服的村庄
                for (var k in crossResp.data.village_list) {
                    resp.data.villages[k] = crossResp.data.villages[k];
                }

                onHandled();
            });
        });

        return;
    } while (false);
}

// 获取村庄列表
exports.village_get_list = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var tmpData = mapObject(user, gInitWorldUser);
        var updateData = mapObject(tmpData, gLandGrabberUser);

        req.args.user = updateData;
        req.args.serverId = config.ServerId;

        requestWorld(req, resp, function() {
            onHandled();
        });
        
        return;
    } while (false);
};

// 获取村庄信息
exports.village_get_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'village id need'; break;
        }

        function callback(player, resp) {

            if (resp.code == 0) {
                // DEBUG('village_info.team_id = ' + resp.data.village_info.team_id + ' , team_id = ' + player.memData.team_id + ' , village_id = ' + player.memData.village_id);
                if (village_id == player.memData.village_id)
                {
                    if (resp.data.village_info.team_id != player.memData.team_id && player.memData.team_id > 0)
                    {
                        player.memData.village_id = 0;
                    }
                }
            }

            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }

        return;
    } while (false);

    onHandled();
};

// 前往抢夺
exports.village_occupy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'territorywar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        // DEBUG('<<<< player.memData.village_id = ' + player.memData.village_id);

        // 当前是否已经有占领村庄了
        if (player.memData.village_id > 0) {
            resp.code = ErrorCode.ERROR_HAS_OCCUPY_VILLAGE; resp.desc = 'already has village'; break;
        }

        // 检查有没有队伍
        if (!player.memData.team_id) {
            resp.code = ErrorCode.ERROR_NO_TEAM; resp.desc = 'no team'; break;
        }

        // 检查资源是否足够
        var costs = parseAwardsConfig(gConfGlobalNew.territoryWarTeamChallengeCost);
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_OCCUPY_VILLAGE_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        // 正在战斗中
        if (player.memData.village_f_ts > 0) {
            resp.code = 1; resp.desc = 'in fight'; break;
        }

        // 时间检测,异步控制
        var now = common.getTime()
        if (player.memData.village_o_ts > 0) {
            if (now - player.memData.village_o_ts < 10) {
                resp.code = ErrorCode.ERROR_OCCUPY_CONFLICT; resp.desc = 'time limited'; break;
            }
        }
        player.memData.village_o_ts = now

        if (isCrossVillage(village_id)) {
            // 向world请求队伍信息
            var worldReq = {
                uid : req.uid,
                mod : 'clan',
                act : 'get_team_and_member',
                args : {},
            }
            var worldResp = {
                code : 0,
                desc : '',
            }
            requestWorld(worldReq, worldResp, function () {
                if (worldResp.code == 0) {
                    var teamData = worldResp.data.team;
                    teamData.server_id = config.ServerId;
                    if (teamData.uid != player.uid) {
                        // 自己不是队长，不能操作
                        player.memData.village_o_ts = 0
                        resp.code = 1; resp.desc = 'not leader'; onHandled(); return;
                    }

                    req.args.team = teamData;

                    // 占领跨服村庄的时候，要把队员数据都带上
                    req.args.memberUser = worldResp.data.memberUser;

                    requestLandGrabber(req, resp, function () {
                        player.memData.village_o_ts = 0

                        if (resp.code == 0) {
                            resp.data.costs = player.addAwards(costs, req.mod, req.act);

                            if (resp.data.village_info) {
                                // 没有占领者，直接占领
                                player.memData.village_id = village_id;
                            } else {
                                player.memData.status = 'prepare_village';

                                player.memData.rand1 = resp.data.rand1;
                                player.memData.rand2 = resp.data.rand2;
                                player.memData.fight_info = resp.data.info;
                                player.memData.fight_enemy = resp.data.enemy;

                                var randPos = common.randRange(1, player.memData.pos_count);
                                resp.data.fight_time = player.memData.fight_time = common.getTime();
                                resp.data.rand_pos = player.memData.rand_pos = randPos;
                            }
                        }

                        onHandled();
                    });

                    return;
                }
                onHandled();
            });

            return;
        } else {
            // 本服村庄
            requestWorld(req, resp, function () {
                player.memData.village_o_ts = 0

                if (resp.code == 0) {
                    resp.data.costs = player.addAwards(costs, req.mod, req.act);

                    if (resp.data.village_info) {
                        // 没有占领者，直接占领
                        player.memData.village_id = village_id;
                    } else {
                        player.memData.status = 'prepare_village';

                        player.memData.rand1 = resp.data.rand1;
                        player.memData.rand2 = resp.data.rand2;
                        player.memData.fight_info = resp.data.info;
                        player.memData.fight_enemy = resp.data.enemy;

                        var randPos = common.randRange(1, player.memData.pos_count);
                        resp.data.fight_time = player.memData.fight_time = common.getTime();
                        resp.data.rand_pos = player.memData.rand_pos = randPos;
                    }
                }

                onHandled();
            });

            return;
        }

        return;
    } while(false);

    onHandled();
};

exports.village_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'territorywar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status != 'prepare_village') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if ( player.memData.village_f_ts > 0 || player.memData.village_o_ts > 0) {
            resp.code = 1; resp.desc = 'in occupy'; break;
        }

        if (!player.isVillageReleased(village_id)) {
            resp.code = 1; resp.desc = 'village not release'; break;
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        player.memData.village_f_ts = common.getTime()

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };

        function callback(player, resp) {
            var user = player.user;
            if (resp.code == 0) {
                if (star > 0) {
                    player.memData.village_id = village_id;
                }

                player.memData.status = 'idle';
                player.memData.enemy_id = 0;
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {

            // 向world请求队伍信息
            var worldReq = {
                uid: req.uid,
                mod: 'clan',
                act: 'get_team_and_member',
                args: {},
            }
            var worldResp = {
                code: 0,
                desc: '',
            }
            requestWorld(worldReq, worldResp, function () {
                if (worldResp.code == 0) {
                    var teamData = worldResp.data.team;
                    teamData.server_id = config.ServerId;

                    req.args.team = teamData;

                    // 跨服
                    requestLandGrabber(req, resp, function () {
                        player.memData.village_f_ts = 0
                        callback(player, resp);
                    });
                } else {
                    player.memData.village_f_ts = 0
                    onHandled();
                }
            });
        } else {
            requestWorld(req, resp, function () {
                player.memData.village_f_ts = 0
                callback(player, resp);
            });
        }
        return;
    } while (false);

    onHandled();
};

// 放弃领主
exports.village_leave = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (player.memData.village_id != village_id) {
            // DEBUG('memData.village_id = ' + player.memData.village_id + ', leave village_id = ' + village_id);
            resp.code = 1; resp.desc = 'village id not equal'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {
                player.memData.village_id = 0;
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 请求获取村庄的战报列表
exports.village_get_report_list = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 根据队伍查找战报
exports.village_get_report_list_by_team = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!player.memData.team_id) {
            break;
        }

        req.args.team_id = player.memData.team_id;
        req.args.serverId = config.ServerId;
        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        requestWorld(req, resp, function() {
            callback(player, resp);
        });
        return;
    } while(false);

    onHandled();
};

exports.village_get_report_list_by_village = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var villageId = req.args.village_id;
        if (!villageId) {
            resp.code = 1; resp.desc = 'villageId invalid'; break;
        }
        req.args.serverId = config.ServerId;
        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        if (isCrossVillage(villageId)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 获取指定战斗的战报列表
exports.get_battle_reports = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while (false);

    onHandled();
};

// 获取玩家地块战报列表
exports.get_reports = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        requestWorld(req, resp, function() {
            callback(player, resp);
        });

        return;
    } while (false);

    onHandled();
};

// 根据村庄获取地块战报列表
exports.get_reports_by_village = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }
        
        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        requestWorld(req, resp, function() {
            callback(player, resp);
        });

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {

        }
        return;
    } while (false);

    onHandled();
};

// 获取具体的战报信息
exports.get_replay = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = req.args.village_id;
        var replayKey = req.args.id;
        if (!village_id || !replayKey) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {

            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 获取自身的地块占领信息
exports.land_get_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = player.memData.village_land[0];
        var land_id = player.memData.village_land[1];

        //if (!land_id || land_id == 0) {
        //    resp.code = 0; resp.desc = 'no occupy land'; break;
        //}

        req.args.village_id = village_id;
        req.args.land_id = land_id;

        function callback(player, resp) {
            if (resp.code == 0) {
                if (!resp.data.land_info) {
                    DEBUG("zcg error-------:")
                    DEBUG(`${player.uid}  ${village_id}  ${land_id}`)
                    onHandled()
                    return
                }

                if(!resp.data.land_info.owner || resp.data.land_info.owner!=player.uid){
                    player.memData.village_land[0] = 0;
                    player.memData.village_land[1] = 0;
                }
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 请求指定村庄的地块列表
exports.land_get_list = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'village id invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {
                // 如果当前占领的是荒地，那就用当前所占领的荒地，如果不是占领的荒地，那就用user.barren_land
                if (!isCrossVillage(village_id)) {
                    var barren = resp.data.barrend_land;
                    if (barren) {
                        resp.data.land_list[parseInt(barren.land_id)] = barren
                    } else {
                        var landInfo = {};
                        if( !player.user.barren_land || player.user.barren_land == 0){
                            player.user.barren_land = 1;
                           player.markDirty('barren_land');
                        }
                        landInfo.land_id = player.user.barren_land;
                        resp.data.land_list[DEFAULT_BARREN_LAND_BEGIN_ID + parseInt(player.user.barren_land)] = landInfo
                    }
                    delete resp.data.barrend_land;
                }
            }
            onHandled();
        }

        if (!user.barren_land) {
            player.randBarrenLand();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 地块战斗
exports.land_occupy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'territorywar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        if (!village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (!player.isVillageReleased(village_id)) {
            resp.code = ErrorCode.ERROR_VILLAGE_NOT_RELEASE; resp.desc = 'village not release'; break;
        }

        if (player.memData.status == 'fight_land') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (isCrossVillage(village_id)) {
            var landConf = gConfPersonalLand[village_id][land_id];
            if (!landConf) {
                resp.code = 1; resp.desc = 'land_id is not exist in villages'; break;
            }
        } else {
            if (land_id > DEFAULT_BARREN_LAND_BEGIN_ID) {
                // 要占领的是荒地，这荒地id必须是今日随机到的荒地
                if (land_id % 100 != user.barren_land) {
                    resp.code = 1; resp.desc = 'barren id error'; break;
                }
            } else {
                var landConf = gConfPersonalLand[village_id][land_id];
                if (!landConf) {
                    resp.code = 1; resp.desc = 'land_id is not exist in villages'; break;
                }
            }
        }

        if (player.memData.village_land[0] && player.memData.village_land[1] && player.memData.village_land[0] > 0 && player.memData.village_land[1] > 0) {
            // DEBUG('logic <<<< village_land[0] = ' + player.memData.village_land[0] + ' , village_land[1] = ' + player.memData.village_land[1]);
            resp.code = ErrorCode.ERROR_HAS_OCCUPY_LAND; resp.desc = 'you has occupy one land'; break;
        }

        // 检查资源是否足够
        var costs = parseAwardsConfig(gConfGlobalNew.territoryWarPersonalChallengeCost);
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_OCCUPY_LAND_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        function callback(player, resp) {
            if(resp.code == 0) {
                resp.data.costs = player.addAwards(costs, req.mod, req.act);

                var enemy = null;
                if (resp.data.battle_info) {
                    enemy = resp.data.battle_info.enemy;
                }

                if (!enemy || enemy == undefined) {
                    if (!user.mark.occupy_land_count) {
                        user.mark.occupy_land_count = 0;
                    }

                    user.mark.occupy_land_count++;
                    player.markDirty('mark.occupy_land_count');

                    // 直接占领
                    player.doDailyTask('territorywar', 1);
                    player.doGuideTask('territorywar', 1);

                    // 更新地块id
                    player.memData.village_land[0] = village_id;
                    player.memData.village_land[1] = land_id;
                } else {
                    player.memData.status = 'prepare_land';
                    player.memData.enemy_id = resp.data.battle_info.enemy_id;

                    player.memData.rand1 = resp.data.battle_info.rand1;
                    player.memData.rand2 = resp.data.battle_info.rand2;
                    player.memData.fight_info = resp.data.battle_info.info;
                    player.memData.fight_enemy = resp.data.battle_info.enemy;

                    var randPos = common.randRange(1, player.memData.pos_count);
                    resp.data.fight_time = player.memData.fight_time = common.getTime();
                    resp.data.rand_pos = player.memData.rand_pos = randPos;
                }
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

exports.land_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'territorywar')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status != 'prepare_land') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        if (!village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (!player.isVillageReleased(village_id)) {
            resp.code = 1; resp.desc = 'village not release'; break;
        }

        if (req.args.enemy != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        var team = req.args.team;
        if (team) {
            var valid = true;
            for (var pos in team) {
                var slot = Math.floor(team[pos]);
                if (!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if (!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }

            var pos = player.memData.fight_info.pos;
            for (var p in team) {
                pos[p].slot = Math.floor(team[p]);
                player.markDirty(util.format('pos.%d.slot', p));
            }
        }

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };

        function callback(player, resp) {
            var user = player.user;
            if (resp.code == 0) {
                if (star > 0) {
                    if (!user.mark.occupy_land_count) {
                        user.mark.occupy_land_count = 0;
                    }

                    user.mark.occupy_land_count++;
                    player.markDirty('mark.occupy_land_count');

                    player.doDailyTask('territorywar', 1);
                    player.doGuideTask('territorywar', 1);

                    // 更新地块id
                    player.memData.village_land[0] = village_id;
                    player.memData.village_land[1] = land_id;
                }

                player.memData.status = 'idle';
                player.memData.enemy_id = 0;
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 地块撤离
exports.land_leave = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = +req.args.village_id;
        var land_id = +req.args.land_id;
        if (!village_id || !land_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                if (awards) {
                    resp.data.awards = player.addAwards(awards, req.mod, req.act);
                }

                player.memData.village_land[0] = 0;
                player.memData.village_land[1] = 0;
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while(false);

    onHandled();
};

// 送花
exports.send_flower = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                if (awards) {
                    resp.data.awards = player.addAwards(awards, req.mod, req.act);
                }
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while (false);

    onHandled();
};

// 送鸡蛋
exports.send_egg = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var village_id = +req.args.village_id;
        if (!village_id) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        function callback(player, resp) {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                if (awards) {
                    resp.data.awards = player.addAwards(awards, req.mod, req.act);
                }
            }
            onHandled();
        }

        if (isCrossVillage(village_id)) {
            // 跨服
            requestLandGrabber(req, resp, function() {
                callback(player, resp);
            });
        } else {
            requestWorld(req, resp, function() {
                callback(player, resp);
            });
        }
        return;
    } while (false);

    onHandled();
};