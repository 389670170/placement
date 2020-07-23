// 领地战逻辑
var ErrorCode = require('../territorywar/error.js').ErrorCode;

// 获取领地战信息
exports.get = function (player, req, resp, onHandled) {
    // 检查能都进度领地战
    if (parseInt(gConfGlobalServer.dfOpen) == 0) {
        resp.code = ErrorCode.ERROR_TERRITORY_NOT_OPEN; resp.desc = 'not open';
        onHandled();
        return;
    }

    // 领地战需要军团2级开启
    if (player.memData.legion_level < parseInt(gConfGlobalNew.legionDfOpenLevel)) {
        resp.code = ErrorCode.ERROR_TERRITORY_NOT_OPEN; resp.desc = 'not open';
        onHandled();
        return;
    }

    // 服务器开启天数限制
    var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
    if (passedDay < (gConfGlobalNew["territorialwarJoinDay"] - 0 + 1)) {
        resp.code = ErrorCode.ERROR_TERRITORY_NOT_OPEN; resp.desc = 'svr open limited';
        onHandled();
        return;
    }

    var getLeagionInfoReq = {
        uid : req.uid,
        mod : 'new_legion',
        act : 'get_legion_leader_info',
        args:{},
    }

    requestWorld(getLeagionInfoReq,resp,function () {
        var leader =  resp.data.leader ;
        get2(player, leader,req, resp, onHandled);
    });

    
};


function get2(player, leader,req, resp, onHandled){

    var user = player.user;
    var tmpData = mapObject(user, gInitWorldUser);
    var updateData = mapObject(tmpData, gTerritoryWarUser);
    var dragon = player.user.dragon;
  
    var buildings = [];

    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get',
        args : {
            lid : player.memData.legion_id,
            lname : player.memData.legion_name,
            legionLevel : player.memData.legion_level,
            legionWarLevel : player.memData.legion_war_level,
            icon : player.memData.legion_icon,
            user : updateData,
            dragon : dragon,
            leader:leader,
            buildings : buildings,
            serverId : config.ServerId,
            gather_record : user.territory_war.gather_record || [],
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            player.openTerritoryWar();

            // 更新玩家耐力
            var userTerritoryInfo = resp.data.territoryWar;
            if (userTerritoryInfo) {
                var stayingPower = userTerritoryInfo.stayingPower;
                var stayingPowerTime = userTerritoryInfo.stayingPowerTime;

                resp.data.staying_power = stayingPower;
                resp.data.staying_power_time = stayingPowerTime;
                player.updateStayingPower(stayingPower, stayingPowerTime);

                var awards = resp.data.awards;
                if (awards) {
                    resp.data.awards = player.addAwards(awards,req.mod,req.act);
                }

                player.getActionPoint(common.getTime());
                resp.data.action_point = user.status.action_point;
                resp.data.action_point_time = user.mark.action_point_time;
            }

            player.memData.transfer_count = resp.data.transfer_count || 0;
        }
        onHandled();
    });

};

// 离开领地战
exports.leave = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'leave',
        args : {},
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 移动
exports.move_to = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'move_to',
        args : req.args,
    }

    var costs = [['user', 'action_point', -gConfTerritoryWarBase.actionCost.value]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_ACTION_POINT_NOT_ENOUGH; resp.desc = 'action point not enough';
        onHandled();
        return;
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
            resp.data.action_point = player.getActionPoint(common.getTime());
            resp.data.action_point_time = player.user.mark.action_point_time;

            var stayingPower = resp.data.staying_power;
            if (stayingPower) {
                player.updateStayingPower(stayingPower, common.getTime());
            }
        }
        onHandled();
    });
};

// 传送（传送到目标军团的领地）
exports.transfer = function (player, req, resp, onHandled) {
    if (parseInt(gConfGlobalServer.dfPvpOpen) == 0) {
        resp.code = ErrorCode.ERROR_TRANSFER_FUNC_NOT_OPEN; resp.desc = 'pvp not open';
        onHandled();
        return;
    }

    
    if(req.args.is_cost_action_point && req.args.is_cost_action_point == 1){
        var costs = parseAwardsConfig(gConfGlobalNew.territorialwarTransferCost);
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_ACTION_POINT_NOT_ENOUGH; resp.desc = 'action point not enough';
            onHandled();
            return;
        }
    }


    var targetLid = req.args.targetLid;   // 目标领地id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'transfer',
        args : {
            target: targetLid,
            sid: config.ServerId,
        },
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            if(req.args.is_cost_action_point && req.args.is_cost_action_point == 1){
                var   cost = parseAwardsConfig(gConfGlobalNew.territorialwarTransferCost);
                resp.data.costs = player.addAwards(cost, req.mod, req.act);
            }
        }
        onHandled();
    });
};

// 回城（回到自己军团的领地，指定的关隘）
exports.go_back = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 传送id
    var transferId = req.args.transferId;
    if (isNaN(cellId)) {
        resp.code = 1; resp.desc ='cell id is null';
        onHandled();
        return;
    }

    var transferConf = gConfTerritoryWarTransfer[transferId];
    if (!transferConf) {
        resp.code = 1; resp.desc ='transfer conf not found';
        onHandled();
        return;
    }

    var cost = [];
    // 检查回城是否有消耗
    DEBUG('player.memData.transfer_count = ' + player.memData.transfer_count)
    if (transferConf.cost > 0 && player.memData.transfer_count - gConfTerritoryWarBase.transmitTimes.value >= 0) {
        cost = [['user', 'mixcash', -gConfTerritoryWarBase.transmitCost.value]];
        if (!player.checkCosts(cost)) {
            resp.code = 1; resp.desc ='cost not enough';
            onHandled();
            return;
        }
    }

    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'go_back',
        args : {
            cellId : cellId,
            transferId : transferId,
        },
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var stayingPower = resp.data.staying_power;
            if (stayingPower) {
                player.updateStayingPower(stayingPower, common.getTime());
            }

            if (cost.length > 0) {
                resp.data.costs = player.addAwards(cost, req.mod, req.act);
            }

            player.memData.transfer_count = resp.data.transfer_count;
        }
        onHandled();
    });
};

// 采集资源
exports.gather = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    if (isNaN(cellId)) {
        resp.code = 1; resp.desc = 'cell id is null';
        onHandled();
        return;
    }

    var user = player.user;
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'gather',
        args : {
            cellId : cellId,
            join_level : user.territory_war.level,
            gather_record : user.territory_war.gather_record || [],
            serverId : config.ServerId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var awards = resp.data.awards;
            resp.data.awards = player.addAwards(awards,req.mod,req.act);

            if (resp.data.once_element_id) {
                if (!user.territory_war.gather_record) {
                    user.territory_war.gather_record = [];
                    player.markDirty('territory_war.gather_record');
                }

                if (user.territory_war.gather_record.indexOf(resp.data.once_element_id) < 0) {
                    user.territory_war.gather_record.push(resp.data.once_element_id);
                    player.markDirty('territory_war.gather_record');
                }
            }
        }
        onHandled();
    });
};

// 占领矿点
exports.occupy_mine = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'occupy_mine',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 掠夺
exports.rob_mine = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'rob_mine',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var awards = resp.data.awards;
            resp.data.awards = player.addAwards(awards,req.mod,req.act);
        }
        onHandled();
    });
};

// 获取矿信息
exports.get_mine_Info = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_mine_Info',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 攻击怪物
exports.attack_monster = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'attack_monster',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 战斗开始
exports.before_fight_monster = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'before_fight_monster',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            player.memData.rand = resp.data.rand;
            player.memData.fight_time = common.getTime();
            player.memData.fight_lid = resp.data.fight_lid;
        }
        onHandled();
    });
};

// 战斗结束
exports.fight_monster = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var star = req.args.star;
    var stayingPower = req.args.stayingPower;   // 胜利方剩余耐力
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'fight_monster',
        args : {
            cellId : cellId,
            star : star,
            stayingPower : stayingPower,
            fight_lid : player.memData.fight_lid,
        }
    }

    var user = player.user;

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            resp.data.awards = player.addAwards(resp.data.awards,req.mod,req.act)

            if (star > 0) {
                var creatureIndex = resp.data.creatureIndex;
                player.insertSecKillMonster(creatureIndex);
            }
        }
        onHandled();
    });
};

// 秒杀怪物
exports.sec_kill_monster = function (player, req, resp, onHandled) {
    var user = player.user;
    var secKill = user.territory_war.secKill;

    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'sec_kill_monster',
        args : {
            cellId : cellId,
            secKill : secKill,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            resp.data.awards = player.addAwards(resp.data.awards,req.mod,req.act);
        }
        onHandled();
    });
};

// 攻击boss
exports.attack_boss = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'attack_boss',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

exports.before_fight_boss = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'before_fight_boss',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            // 检查元宝是否满足
            var challengeCount = resp.data.challengeCount;
            if (challengeCount > 0) {
                var maxCount = Object.keys(gConfTerritoryBossCost).length;
                var costs = [['user', 'mixcash', 0]];
                if (challengeCount > maxCount) {
                    challengeCount = maxCount;
                }
                if (gConfTerritoryBossCost[challengeCount]) {
                    costs = gConfTerritoryBossCost[challengeCount].cost;
                }

                if (!player.checkCosts(costs)) {
                    resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH;
                    resp.desc = 'cash not enough';
                    onHandled();
                    return;
                }
            }

            var rand = resp.data.rand;
            var rand_enc = tower_encrypt(resp.data.rand.toString(), pubKey);

            resp.data.rand = rand_enc;

            player.memData.rand_origin  = rand;
            player.memData.rand         = rand_enc;
            player.memData.fight_time = common.getTime();
            player.memData.fight_lid = resp.data.fight_lid;
        }
        onHandled();
    });
};

exports.fight_boss = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var damage = req.args.damage;
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'fight_boss',
        args : {
            cellId : cellId,
            damage : damage,
            fight_lid : player.memData.fight_lid,
        }
    }

    // checking
    var ff = +req.args.ff;

    // if (isNaN(ff) || ff > player.getFightForce() * 1.1 || !player.check_attrs(req.args.attrs)) {
    //     DEBUG(`FightForce checking: ${ff}, ${player.getFightForce() * 1.1}`)
    //     // resp.code = 999; resp.desc = "invalid_fight_force";
    //     // onHandled();
    //     // return;
    // }

    var user = player.user;

    if (user.status.level && user.status.level > 30)
    {
        if (isNaN(ff) || ff > player.getFightForce() * 1.5) {
            DEBUG(`FightForce checking: ${ff}, ${player.getFightForce()}, ${req.uid}`)
            resp.code = 999; resp.desc = "invalid_fight_force";
            onHandled();
            return;
        }
    } 

    var sign = req.args.sign;
    var time = req.args.time;
    var damage = req.args.damage;

    var rand_origin = player.memData.rand_origin;
    var dec_sign = tower_decrypt(sign, priKey);

    // 验证战斗
    var serverSign = getBattleFightSign('territorywar', req.uid, time, damage, rand_origin);
    DEBUG(`fight: territorywar uid:${req.uid}, time:${time}, damage:${damage}, rand_origin:${rand_origin} ,desc_sign:${dec_sign} ,server_sign:${serverSign} sign:${sign}`)

    // if (serverSign != dec_sign) {
    //     resp.code = 999; resp.desc = "sign not match";
    //     onHandled();
    //     return;
    // }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            player.doDailyTask('territoryBoss', 1);
            var challengeCount = resp.data.challengeCount;
            if (challengeCount > 0) {
                var maxCount = Object.keys(gConfTerritoryBossCost).length;
                var costs = [['user', 'mixcash', 0]];
                if (challengeCount > maxCount) {
                    challengeCount = maxCount;
                }
                if (gConfTerritoryBossCost[challengeCount]) {
                    costs = gConfTerritoryBossCost[challengeCount].cost;
                }

                resp.data.costs = player.addAwards(costs,req.mod,req.act);
            }

            if (resp.data.awards) {
                resp.data.awards = player.addAwards(resp.data.awards,req.mod,req.act);
            }
        }
        onHandled();
    });
};

// 获取格子里面的玩家列表
exports.get_cell_player_list = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_cell_player_list',
        args : {
            cellId : cellId,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 攻击玩家
exports.attack_player = function (player, req, resp, onHandled) {
    var cellId = req.args.cellId;   // 格子id
    var targetUid = req.args.targetUid;
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'attack_player',
        args : {
            cellId : cellId,
            targetUid : targetUid,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            player.memData.status = 'prepare_territorywar';
            player.memData.enemy_uid = resp.data.enemy.uid;
            player.memData.rand1 = resp.data.rand1;
            player.memData.rand2 = resp.data.rand2;
            player.memData.fight_info = resp.data.info;
            player.memData.fight_enemy = resp.data.enemy;
        }
        onHandled();
    });
};

// 攻击玩家结果
exports.fight_player = function (player, req, resp, onHandled) {
    var star = req.args.star;
    var power = req.args.power;
    var selfConsumePower = req.args.selfConsumePower;   // 自身消耗的耐力值
    var enemyConsumePower = req.args.enemyConsumePower; // 地方消耗的耐力值
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'fight_player',
        args : {
            enemy : req.args.enemy,
            star : star,
            power : power, // 胜利方的剩余耐力
            selfConsumePower : selfConsumePower,
            enemyConsumePower : enemyConsumePower,
            replay : {
                rand1: player.memData.rand1,
                rand2: player.memData.rand2,
                info: player.memData.fight_info,
                enemy: player.memData.fight_enemy,
            }
        }
    }

    var costs = [['user', 'staying_power', -selfConsumePower]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_STAYING_POWER_NOT_ENOUGH; resp.desc = 'staying power not enough';
        onHandled();
        return;
    }

    var team = req.args.team;
    if (team) {
        var valid = true;
        for (var pos in team) {
            var slot = Math.floor(team[pos]);
            if (!player.user.pos[pos] || slot < 1 || slot > MaxSlot) {
                valid = false; break;
            }
        }
        if (!valid) {
            resp.code = 1; resp.data = 'invalid team'; onHandled(); return;
        }

        var pos = player.memData.fight_info.pos;
        for (var p in team) {
            pos[p].slot = Math.floor(team[p]);
            player.markDirty(util.format('pos.%d.slot', p));
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            // 更新自身耐力
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
            var selfStayingPower = resp.data.selfStayingPower;
            var curPower = player.getStayingPower();
            if (curPower != selfStayingPower) {
                player.updateStayingPower(selfStayingPower, common.getTime());
            }
        }
        onHandled();
    });
};

// 获取排行榜
exports.get_rank = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_rank',
        args : {},
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取战报
exports.get_reports = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_reports',
        args : {},
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

exports.get_replay = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_replay',
        args : req.args,
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 领取成就奖励
exports.get_achievement_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    var achievementType = req.args.achievementType;
    var achievementId = req.args.achievementId;
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_achievement_awards',
        args : {
            achievementType : achievementType,
            achievementId : achievementId,
            level : user.territory_war.level,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var awards = resp.data.awards;
            resp.data.awards = player.addAwards(awards,req.mod,req.act);
        }
        onHandled();
    });
};

// 挑战傀儡
exports.challenge = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'challenge',
        args : req.args,
    }
    var costs = [['material', 310001, -1]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_MATERIAL_NOT_ENOUGH; resp.desc = 'material not enough';
        onHandled();
        return;
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var level = player.user.status.level;
            var conf = gConfTerritoryWarPuppet[level];

            var posObj = generateRobot(4, level, conf.fightForce);

            resp.data.enemy = {
                un: 'regular',
                level: 1,
                pos: posObj,
            };
        }
        onHandled();
    });
};

exports.challenge_before_fight = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'challenge_before_fight',
        args : req.args,
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            player.memData.rand = resp.data.rand;
            player.memData.fight_time = common.getTime();
            resp.data.rand = resp.data.rand;
        }
        onHandled();
    });
};

exports.challenge_fight = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'challenge_fight',
        args : req.args,
    }

    var killCount = +req.args.killCount;

    var costs = [['material', 310001, -1]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_MATERIAL_NOT_ENOUGH; resp.desc = 'material not enough';
        onHandled();
        return;
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);

            var level = player.user.status.level;
            var conf = gConfTerritoryWarPuppet[level];
            var awards = clone(conf.drop);
            for (var i = 0; i < awards.length; i++) {
                awards[i][2] = awards[i][2] * killCount;
            }

            resp.data.awards = player.addAwards(awards,req.mod,req.act);
        }
        onHandled();
    });
};

// 开启密匣
exports.open_box = function (player, req, resp, onHandled) {
    do {
        if (isNaN(req.args.boxType)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        // 开高级密匣，检查元宝是否足够
        var costs = [];
        if (req.args.boxType == 1) {
            costs.push(['user', 'mixcash', -parseInt(gConfTerritoryWarBase.advancedBoxCost.value)]);
            costs.push(['material', 310003, -1]);
        } else {
            costs.push(['material', 310002, -1]);
        }

        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH; resp.desc = 'cash not enough'; break;
        }

        var playerLevel = player.user.status.level;
        if (!playerLevel)
            playerLevel = 1;

        var preLevel = 1;
        var dropLevel = preLevel;
        for (var level in gConfTerritoryWarBoxDrop) {
            if (playerLevel < level) {
                dropLevel = preLevel;
                break;
            }

            preLevel = level;
        }

        var dropData = gConfTerritoryWarBoxDrop[dropLevel];
        if (!dropData) {
            resp.code = 1; resp.desc = 'drop data not found, drop level is ' + dropLevel; break;
        }

        var dropId = dropData.boxLootId;
        if (req.args.boxType == 1)
            dropId = dropData.advancedBoxLootId;

        var awards = generateDrop(dropId);

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
    } while (false);

    onHandled();
};

// 探索遗迹
exports.start_explore = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'start_explore',
        args : req.args,
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 停止探索
exports.stop_explore = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'stop_explore',
        args : req.args,
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 加速探索
exports.speed_explore = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'speed_explore',
        args : req.args,
    }

    var param = player.getBuildingParam('relicAccelerateCost');
    var consumeValue = parseInt(gConfTerritoryWarBase.relicAccelerateCost.value);
    consumeValue = Math.floor(consumeValue * (1 + param[0]/100));

    var costs = [['user', 'mixcash', -consumeValue]];
    if (!player.checkCosts(costs)) {
        resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH; resp.desc = 'cash not enough';
        onHandled();
        return;
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            resp.data.costs = player.addAwards(costs,req.mod,req.act);
        }
        onHandled();
    });
};

// 获取本军团事件列表
exports.get_events = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_events',
        args : {
            lid : player.memData.legion_id,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取敌方信息
exports.get_enemy = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_enemy',
        args : req.args,
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 购买体力
exports.buy_action_point = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var buyCount = user.territory_war.buy_action_count;
        var canBuyCount = gConfVip[user.status.vip].actionBuy;
        if (buyCount >= canBuyCount) {
            resp.code = ErrorCode.ERROR_BUY_ACTION_COUNT_NOT_ENOUGH; resp.desc = 'buy count max'; break;
        }

        var costs = gConfBuy[buyCount + 1].legionMannorActionBuy;
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_CASH_NOT_ENOUGH; resp.desc = 'cash not enough'; break;
        }

        var awards = [['user', 'action_point', +gConfTerritoryWarBase.actionBuyAward.value]];
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);

        player.onBuyActionPoint();
    } while (false);

    onHandled();
};

// 获取玩家领地战信息
exports.get_player_territory_war_info = function (player, req, resp, onHandled) {
    var user = player.user;
    var target_uid = req.args.target_uid;

    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_player_territory_war_info',
        args : {
            target_uid : target_uid,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 取消战斗
exports.cancel_fight = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'cancel_fight',
        args : {

        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取关隘状态
exports.get_city_state = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_city_state',
        args : {

        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取boss排行榜
exports.get_boss_rank = function (player, req, resp, onHandled) {
    var lid = req.args.lid;
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_boss_rank',
        args : {
            lid : lid,
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取boss信息
exports.get_boss_info = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_boss_info',
        args : {

        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取boss列表
exports.get_boss_list = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_boss_list',
        args : {

        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {

        }
        onHandled();
    });
};

// 获取领地boss信息
exports.get_territory_boss_info = function (player, req, resp, onHandled) {
    var TerritoryWarReq = {
        uid : req.uid,
        mod : 'api',
        act : 'get_boss_notice_info',
        args : {
            lids : [player.memData.legion_id]
        }
    }

    requestTerritoryWar(TerritoryWarReq, resp, function() {
        if (resp.code == 0) {
            var list = resp.data.list;
            if (list) {
                var info = list[player.memData.legion_id];
                resp.data.info = info;
                delete resp.data.list;
            }
        }
        onHandled();
    });
};
