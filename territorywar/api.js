// 领地战的接口
var ErrorCode = require('./error.js').ErrorCode;
var EventType = require('./error.js').EventType;

// 注册服务器
exports.register_server = function (req, res, resp) {
    do {
        var serverId = req.args.sid;
        if ((!serverId || isNaN(serverId)) && serverId != 0) {
            resp.code = 1; resp.desc = 'server id needed'; break;
        }

        gTerritoryWar.registerServer(req.args.sid, req.args.ip, req.args.port, req.args.openTime);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取领地战信息
exports.get = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var lid = +req.args.lid; // 自己的军团id
        var lname = req.args.lname;
        var legionLevel = req.args.legionLevel;
        var legionWarLevel = req.args.legionWarLevel;
        var legionIcon = req.args.icon;
        var buildings = req.args.buildings;
        var serverId = req.args.serverId;
        var gatherRecord = req.args.gather_record;  // 一次性元素拾取记录
        var leader = req.args.leader;
        if (isNaN(uid) || isNaN(lid)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var user = req.args.user;
        var dragon = req.args.dragon;
        gUserInfo.update(uid, lid, user, dragon, buildings);

        resp.data = gTerritoryWar.getTerritoryData(uid, lid, lname, legionLevel, legionWarLevel, legionIcon, serverId, gatherRecord,leader);
        resp.data.transfer_count = gUserInfo.getPlayerGoBackCount(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 离开领地战
exports.leave = function (req, res, resp) {
    do {
        var uid = +req.uid;
        gUserInfo.onPlayerLeave(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 移动
exports.move_to = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        if (!gTerritoryWar.canWalk(curLid, cellId)) {
            resp.code = ErrorCode.ERROR_EMPTY_CELL; resp.desc = 'empty cell'; break;
        }

        // 检查自身是否在战斗状态
        if (gTerritoryWar.isPlayerInFight(uid, curLid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'fight state'; break;
        }

        // 检查目标格子是否与当前格子相邻
        var curCellId =userInfo.territoryWar.pos.cellId;
        if (!gUserInfo.isNeighborCell(curCellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'element is not in neighbor cell'; break;
        }

        // 检查目标格子是否有敌人
        var playerList = gTerritoryWar.getCellPlayerList(userInfo.territoryWar.lid, curLid, cellId);
        if (Object.keys(playerList).length > 0) {
            resp.code = ErrorCode.ERROR_PATH_HAS_ENEMY; resp.desc = 'target cell has enemy'; break;
        }

        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo != null) {
            // 检查格子是否已经访问过了
            var visitedList = {};
            var isSelf = false;
            var enemyIndex = 0;
            if (curLid == userInfo.territoryWar.lid) {
                // 在自己的领地
                visitedList = userInfo.territoryWar.visitedResList.self;
                isSelf = true;
            } else {
                var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
                enemyIndex = enemies.indexOf(curLid);
                if (enemyIndex < 0) {
                    resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                }

                enemyIndex += 1;
                visitedList = userInfo.territoryWar.visitedResList['enemy' + enemyIndex];
            }

            if (cellInfo.resType == TerriToryWarResourceType.CREATURE) {
                var monsterInfo = gConfTerritoryWarMapMonster[cellInfo.resId];
                if (monsterInfo) {
                    if (monsterInfo.isShare) {
                        if (cellInfo.resParam != 0) {
                            resp.code = ErrorCode.ERROR_CELL_NOT_VISITED; resp.desc = 'cell has not visited'; break;
                        }
                    } else {
                        if (!visitedList[cellId] || visitedList[cellId].param != 0) {
                            resp.code = ErrorCode.ERROR_CELL_NOT_VISITED; resp.desc = 'cell has not visited'; break;
                        }
                    }
                }
            } else {
                if (!visitedList[cellId]) {
                    resp.code = ErrorCode.ERROR_CELL_NOT_VISITED; resp.desc = 'cell has not visited'; break;
                }
            }
        }

        if (curLid == userInfo.territoryWar.lid && parseInt(gConfTerritoryWarBase.initialPos.value) == cellId) {
            gUserInfo.addStayingPower(uid, 100);    // 回满耐力
            resp.data.staying_power = gUserInfo.getStayingPower(uid, common.getTime());
        }

        gUserInfo.moveTo(uid, cellId);
        gTerritoryWar.onPlayerVisitCell(userInfo.territoryWar.lid, curLid, cellId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 传送（传送到目标军团的领地）
exports.transfer = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetLid = +req.args.target;
        var sid = +req.args.sid;
        if (isNaN(targetLid) || isNaN(sid)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
        if (enemies.indexOf(targetLid) < 0) {
            if (enemies.indexOf(targetLid.toString()) < 0) {
                resp.code = ErrorCode.ERROR_TRANSFER_TARGET_ERROR; resp.desc = 'target is not enemy legion'; break;
            }
        }

        //if (gTerritoryWar.getVisitSteleCount(userInfo.territoryWar.lid) < 3) {
        //    resp.code = ErrorCode.ERROR_TRANSFER_NOT_OPEN; resp.desc = 'visit stele count not enough'; break;
        //}

        var cellId = 1;
        var invadeCells = gTerritoryWar.getInvadeCells();
        if (invadeCells) {
            var index = common.randRange(0, invadeCells.length - 1);
            cellId = parseInt(invadeCells[index]);
        }
        gTerritoryWar.onPlayerEnter(uid, targetLid, cellId, sid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 回城（回到自己军团的领地，指定的关隘）
exports.go_back = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var transferId = +req.args.transferId;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        if (!gUserInfo.isCityVisited(uid, cellId)) {
            resp.code = ErrorCode.ERROR_CITY_NOT_VISIT; resp.desc = 'city not visited'; break;
        }

        // 检查目标格子上是否有地方玩家（传送回军团城不判断）
        if (cellId != parseInt(gConfTerritoryWarBase.initialPos.value) && gTerritoryWar.hasEnemyPlayer(userInfo.territoryWar.lid, cellId, userInfo.territoryWar.lid)) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_HAS_ENEMY; resp.desc = 'target cell has enemy player'; break;
        }

        // 检查是否处于战斗状态
        if (gTerritoryWar.isPlayerInFight(uid, curLid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in fight state'; break;
        }

        if (curLid == userInfo.territoryWar.lid) {
            gTerritoryWar.broadcastPlayerPosition(uid, userInfo.territoryWar.lid, cellId, true);
        }

        if (cellId == parseInt(gConfTerritoryWarBase.initialPos.value)) {
            gUserInfo.addStayingPower(uid, 100);    // 耐力回满
            resp.data.staying_power = gUserInfo.getStayingPower(uid, common.getTime());
        }

        gTerritoryWar.onPlayerEnter(uid, userInfo.territoryWar.lid, cellId);
        gUserInfo.onPlayerGoBack(uid, transferId);

        resp.data.transfer_count = gUserInfo.getPlayerGoBackCount(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 采集资源
exports.gather = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var joinLevel = +req.args.join_level;
        var gatherRecord = req.args.gather_record;  // 一次性元素拾取记录
        if (isNaN(cellId) || isNaN(joinLevel)) {
            resp.code = 1; resp.desc = 'args cellId is null'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'empty cell or cellId error'; break;
        }

        if (gTerritoryWar.isPlayerInFight(uid, curLid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in fight state'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'element is not in neighbor cell'; break;
        }

        // 检查目标位置是否有敌对玩家

        // 检查是否已经采集过了
        var visitedList = {};
        var isSelf = false;
        var enemyIndex = 0;
        if (curLid == userInfo.territoryWar.lid) {
            // 在自己的领地
            visitedList = userInfo.territoryWar.visitedResList.self;
            isSelf = true;
        } else {
            var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
            enemyIndex = enemies.indexOf(curLid);
            if (enemyIndex < 0) {
                enemyIndex = enemies.indexOf(curLid.toString());
                if (enemyIndex < 0) {
                    resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                }
            }

            visitedList = userInfo.territoryWar.visitedResList['enemy' + (enemyIndex + 1)];
        }

        enemyIndex += 1;
        if (visitedList[cellId]) {
            resp.code = ErrorCode.ERROR_CELL_HAS_GATHER; resp.desc = 'cell has gathered'; break;
        }

        var resId = cellInfo.resId;
        if (gTerritoryWar.hasOnceElement(cellId)) {
            var gridConf = gConfTerritoryWarMapGrid[cellId];
            var onceElementId = parseInt(gridConf.onceElement[0]);
            if (gatherRecord && gatherRecord.indexOf(onceElementId) < 0) {
                // 替换成一次性掉落
                var elementInfo = gridConf.onceElement[1].split('.');
                resId = parseInt(elementInfo[1]);
                resp.data.once_element_id = onceElementId;
            }
        }

        var eventType = gConfTerritoryWarMapElement[resId].event;
        if (eventType == TerritoryWarEventType.EVENT_TYPE_5) {
            // 检查是否是否已访问
            if (gTerritoryWar.isSteleVisited(uid, userInfo.territoryWar.lid, curLid, cellId)) {
                resp.code = ErrorCode.ERROR_CELL_HAS_GATHER; resp.desc = 'cell has gathered'; break;
            }
        }

        if (eventType != TerritoryWarEventType.EVENT_TYPE_1 && eventType != TerritoryWarEventType.EVENT_TYPE_2
            && eventType != TerritoryWarEventType.EVENT_TYPE_5){
            gUserInfo.gather(uid, cellId, isSelf, enemyIndex);
        }

        var awards = clone(gConfTerritoryWarMapElement[resId].award);
        if (awards && awards[0] && awards[0][0] == 'level') {
            var awardStr = awards[0][1];
            var awardNum = awards[0][2];
            var levelAward = clone(gConfLevel[joinLevel][awardStr]);
            awards = timeAwards(levelAward, awardNum);
        }

        switch (eventType) {
            case TerritoryWarEventType.EVENT_TYPE_1: {
                // 建木神树
            } break;
            case TerritoryWarEventType.EVENT_TYPE_2: {
                // 建木树洞
            } break;
            case TerritoryWarEventType.EVENT_TYPE_3: {
                // 材料堆
                resp.data.visitedMineCount = userInfo.territoryWar.visitedMineCount;
            } break;
            case TerritoryWarEventType.EVENT_TYPE_4: {
                // 圣龙雕像,水井
                for (var i = 0; i < awards.length; i++) {
                    var award = awards[i];
                    var awardType = award[1];
                    if (awardType == 'staying_power') {
                        // 加的是耐力
                        var param = gUserInfo.getBuildingParam(uid, 'enduranceRecover');
                        awards[i][2] = Math.floor(awards[i][2] * (1 + param[0]/100));
                        gUserInfo.addStayingPower(uid, awards[i][2]);
                    } else if (awardType == 'action_point') {
                        var param = gUserInfo.getBuildingParam(uid, 'actionRecover');
                        awards[i][2] = Math.floor(awards[i][2] * (1 + param[0]/100));
                    }
                }
            } break;
            case TerritoryWarEventType.EVENT_TYPE_5: {
                // 石碑
                gTerritoryWar.onPlayerVisitStoneStele(uid, userInfo.territoryWar.lid, curLid, cellId);
            } break;
            case TerritoryWarEventType.EVENT_TYPE_6: {
                // 瞭望塔，只能访问自己领地的
                if (isSelf)
                    gTerritoryWar.onPlayerVisitWatchTower(uid, userInfo.territoryWar.lid, curLid, cellId);
            } break;
            case TerritoryWarEventType.EVENT_TYPE_7: {
                // 神秘遗迹
                var dragon = userInfo.territoryWar.dragon;
                var openedDragId = [];
                for (var i = 0; i < dragon.length; i++) {
                    if (dragon[i] > 0) {
                        openedDragId.push(i);
                    }
                }

                if (openedDragId.length > 0) {
                    var index = common.randRange(0, openedDragId.length - 1);
                    var dragId = openedDragId[index];   // 龙id
                    var relicId = dragId - 1;   // 遗迹id

                    gUserInfo.addRelic(uid, relicId);
                    resp.data.relicId = relicId;
                }
            } break;
        }

        resp.data.awards = awards;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 占领矿点
exports.occupy_mine = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = +req.args.cellId;
        var myLid = userInfo.territoryWar.lid;
        var curLid = userInfo.territoryWar.pos.lid;
        if (myLid != curLid) {
            resp.code = ErrorCode.ERROR_CAN_NOT_OCCUPY_ENEMY_MINE; resp.desc = 'lid error'; break;
        }

        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'empty cell or cellId error'; break;
        }

        if (cellInfo.resType != TerriToryWarResourceType.MINE) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_IS_NOT_MINE; resp.desc = 'cell not mine'; break;
        }

        if (gTerritoryWar.isMineOccupy(curLid, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_MINE_HAS_OCCUPY; resp.desc = 'mine has occupy'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'mine is not in neighbor cell'; break;
        }

        gTerritoryWar.onMineOccupy(uid, curLid, cellId);

        // 事件处理
        var mineName = gConfTerritoryWarMapMine[cellInfo.resId].name;
        gTerritoryWar.addEvent(myLid, EventType.EVENT_OCCUPY_MINE, userInfo.info.un, mineName);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 掠夺
exports.rob_mine = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = +req.args.cellId;
        var myLid = userInfo.territoryWar.lid;
        var curLid = userInfo.territoryWar.pos.lid;
        if (myLid == curLid) {
            resp.code = ErrorCode.ERROR_CAN_NOT_ROB_SELF_MINE; resp.desc = 'lid error'; break;
        }

        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'empty cell or cellId error'; break;
        }

        if (cellInfo.resType != TerriToryWarResourceType.MINE) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_IS_NOT_MINE; resp.desc = 'cell not mine'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'mine is not in neighbor cell'; break;
        }

        // 检查是否已经掠夺过了
        var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
        var enemyIndex = enemies.indexOf(curLid);
        if (enemyIndex < 0) {
            enemyIndex = enemies.indexOf(curLid.toString());
            if (enemyIndex < 0) {
                resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
            }
        }

        enemyIndex += 1;
        var visitedList = userInfo.territoryWar.visitedResList['enemy' + enemyIndex];
        if (visitedList[cellId]) {
            resp.code = ErrorCode.ERROR_TARGET_MINE_HAS_ROB; resp.desc = 'mine has robed'; break;
        }

        gTerritoryWar.onMineRob(curLid, cellId);
        gUserInfo.gather(uid, cellId, false, enemyIndex);

        // 掠夺奖励
        var param = gUserInfo.getBuildingParam(uid, 'minePillageAward');
        var awards = clone(gConfTerritoryWarMapMine[cellInfo.resId].award2);
        for (var i = 0; i < awards.length; i++) {
            awards[i][2] = Math.floor(awards[i][2] * (1 + param[0]/100));
        }

        resp.data.awards = awards;

        // 事件处理
        var mineName = gConfTerritoryWarMapMine[cellInfo.resId].name;
        var roberLegionInfo = gTerritoryWar.getLegionInfo(userInfo.territoryWar.lid);
        if (roberLegionInfo) {
            gTerritoryWar.addEvent(curLid, EventType.EVENT_MINE_WAS_ROBED, mineName, roberLegionInfo.name, userInfo.info.un);
        }

        var targetLegionInfo = gTerritoryWar.getLegionInfo(curLid);
        if (targetLegionInfo) {
            gTerritoryWar.addEvent(userInfo.territoryWar.lid, EventType.EVENT_ROB_MINE, userInfo.info.un, targetLegionInfo.name, mineName);
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取矿信息
exports.get_mine_Info = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellId = +req.args.cellId;

        resp.data.mine = gTerritoryWar.getMineInfo(curLid, cellId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 攻击怪物
exports.attack_monster = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = +req.args.cellId;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'cell id is null'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        if (cellInfo.resType != TerriToryWarResourceType.CREATURE) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_IS_NOT_CREATURE; resp.desc = 'cell res type is not creature'; break;
        }

        var monsterInfo = gConfTerritoryWarMapMonster[cellInfo.resId];
        if (!monsterInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'monster info not found'; break;
        }

        // 检查是个人怪还是公共怪
        var remainPower = 0;
        if (monsterInfo.isShare) {
            if (cellInfo.resParam == 0) {
                resp.code = ErrorCode.ERROR_SHARE_MONSTER_IS_DEAD; resp.desc = 'share monster is dead'; break;
            }
            remainPower = cellInfo.resParam;
        } else {
            // 检查这个格子的怪物是否已经攻击过了
            var visitedList = {};
            var isSelf = false;
            var enemyIndex = 0;
            if (curLid == userInfo.territoryWar.lid) {
                // 在自己的领地
                visitedList = userInfo.territoryWar.visitedResList.self;
                isSelf = true;
            } else {
                var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
                enemyIndex = enemies.indexOf(curLid);
                if (enemyIndex < 0) {
                    enemyIndex = enemies.indexOf(curLid.toString());
                    if (enemyIndex < 0) {
                        resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                    }
                }

                visitedList = userInfo.territoryWar.visitedResList['enemy' + (enemyIndex + 1)];
            }

            if (visitedList[cellId] && visitedList[cellId].param == 0) {
                resp.code = ErrorCode.ERROR_PRIVATE_MONSTER_IS_DEAD; resp.desc = 'monster is dead'; break;
            }

            if (!visitedList[cellId]) {
                visitedList[cellId] = {};
                visitedList[cellId].param = 100;
            }

            remainPower = visitedList[cellId].param;
        }

        resp.data.formationId = monsterInfo.combatId;
        resp.data.stayingPower = remainPower; // 剩余耐力

    } while (false);

    onReqHandled(res, resp, 1);
};

// 战斗开始
exports.before_fight_monster = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'monster is not in neighbor cell'; break;
        }

        var monsterInfo = gConfTerritoryWarMapMonster[cellInfo.resId];
        if (!monsterInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'monster info not found'; break;
        }

        // 检查玩家等级，不能调整高于玩家五级的怪物
        var formationConf = gConfFormation[monsterInfo.combatId];
        var bossId = formationConf['pos' + formationConf.boss];
        var monsterConf = gConfMonster[bossId];
        if (userInfo.status.level + 5 < monsterConf.level) {
            resp.code = ErrorCode.ERROR_USER_LEVEL_NOT_ENOUGH; resp.desc = 'level not enough'; break;
        }

        resp.data.rand = Math.floor(common.randRange(100000, 999999));
        resp.data.fight_lid = curLid;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight_monster = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var star = +req.args.star;
        var stayingPower = +req.args.stayingPower;   // 胜利方剩余耐力
        var fight_lid = +req.args.fight_lid;
        if (isNaN(star) || isNaN(stayingPower)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
            if (fight_lid && enemies.indexOf(fight_lid) >= 0) {
                cellInfo = gTerritoryWar.getCellInfo(fight_lid, cellId);
                if (cellInfo == null) {
                    resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
                } else {
                    curLid = fight_lid;
                }
            }
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        //if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
        //    resp.code = 1; resp.desc = 'monster is not in neighbor cell'; break;
        //}

        var monsterInfo = gConfTerritoryWarMapMonster[cellInfo.resId];
        if (!monsterInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'monster info not found'; break;
        }

        resp.data.formationId = monsterInfo.combatId;
        resp.data.creatureIndex = cellInfo.resId;

        var isSelf = false;
        var enemyIndex = 0;
        if (curLid == userInfo.territoryWar.lid) {
            // 在自己的领地
            isSelf = true;
        } else {
            var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
            enemyIndex = enemies.indexOf(curLid);
            if (enemyIndex < 0) {
                enemyIndex = enemies.indexOf(curLid.toString());
                if (enemyIndex < 0) {
                    resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                }
            }
        }

        enemyIndex += 1;

        if (star == 0) {
            // 自己剩余耐力为0了，传回自己领地
            gTerritoryWar.onPlayerDeath(uid);
        }

        var monsterPower = 0;
        if (star == 0) {
            monsterPower = stayingPower;
        }

        if (monsterInfo.isShare) {
            // 更新公共怪物剩余耐力
            gTerritoryWar.updateShareMonsterStayingPower(curLid, cellId, monsterPower);

            if (monsterPower == 0) {
                // 共享怪物死了，同步给领地上的玩家
                gTerritoryWar.notifyShareMonsterDead(curLid, cellId);
            }
        } else {
            // 更新怪物信息
            gUserInfo.gather(uid, cellId, isSelf, enemyIndex, monsterPower);
        }

        if (star > 0) {
            //gTerritoryWar.onKillMonster(uid);
            resp.data.awards = generateDrop(monsterInfo.lootId, userInfo.status.level);
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 秒杀怪物
exports.sec_kill_monster = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = +req.args.cellId;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'cell id is null'; break;
        }

        var secKill = req.args.secKill;
        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = 1; resp.desc = 'monster is not in neighbor cell'; break;
        }

        var monsterInfo = gConfTerritoryWarMapMonster[cellInfo.resId];
        if (!monsterInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'monster info not found'; break;
        }

        if (secKill.indexOf(cellInfo.resId) < 0) {
            resp.code = ErrorCode.ERROR_NOT_SEC_KILL; ; resp.desc = 'can not kill'; break;
        }

        var formationId = monsterInfo.combatId;;
        if (formationId) {
            // 获取怪物等级
            var formationConf = gConfFormation[formationId];
            if (!formationConf) {
                resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'formation info not found'; break;
            }

            var monsterId = formationConf['pos' + formationConf.boss];
            var monsterConf = gConfMonster[monsterId];
            if (!monsterConf) {
                resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CREATURE_INFO; resp.desc = 'monster info not found'; break;
            }

            var monsterLevel = monsterConf.level;
            if (userInfo.status.level < monsterLevel) {
                resp.code = ErrorCode.ERROR_USER_LEVEL_NOT_ENOUGH; ; resp.desc = 'level not enough'; break;
            }
        }

        var isSelf = false;
        var enemyIndex = 0;
        if (curLid == userInfo.territoryWar.lid) {
            // 在自己的领地
            isSelf = true;
        } else {
            var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
            enemyIndex = enemies.indexOf(curLid);
            if (enemyIndex < 0) {
                enemyIndex = enemies.indexOf(curLid.toString());
                if (enemyIndex < 0) {
                    resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                }
            }
        }

        enemyIndex += 1;

        var monsterPower = 0;
        if (monsterInfo.isShare) {
            // 更新公共怪物剩余耐力
            gTerritoryWar.updateShareMonsterStayingPower(curLid, cellId, monsterPower);

            if (monsterPower == 0) {
                // 共享怪物死了，同步给领地上的玩家
                gTerritoryWar.notifyShareMonsterDead(curLid, cellId);
            }
        } else {
            // 更新怪物信息
            gUserInfo.gather(uid, cellId, isSelf, enemyIndex, monsterPower);
        }

        resp.data.awards = generateDrop(monsterInfo.lootId, userInfo.status.level);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 攻击boss
exports.attack_boss = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = +req.args.cellId;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'cell id is null'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        if (cellInfo.resType != TerriToryWarResourceType.BOSS) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_IS_NOT_CREATURE; resp.desc = 'cell res type is not boss'; break;
        }

        // 检查是否在boss挑战时间内
        var beginTime = gTerritoryWar.getBossCreateTime();
        var endTime = gTerritoryWar.getBossEndTime();
        var curTime = common.getTime();
        if (curTime < beginTime || curTime >= endTime) {
            resp.code = ErrorCode.ERROR_NOT_BOSS_CHALLENGE_TIME; resp.desc = 'not open time'; break;
        }

        // 检查玩家是否在战斗状态
        var isFightState = gTerritoryWar.isPlayerInFight(uid, curLid);
        if (isFightState) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in fight state'; break;
        }

        var bossInfo = gTerritoryWar.getBossRank(curLid);
        if (bossInfo) {
            resp.data.boss = {};
            resp.data.boss.bossId = bossInfo.bossId;
            resp.data.boss.icon = gTerritoryWar.getLegionInfo(curLid).icon;
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

exports.before_fight_boss = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        if (cellInfo.resType != TerriToryWarResourceType.BOSS) {
            resp.code = ErrorCode.ERROR_TARGET_CELL_IS_NOT_CREATURE; resp.desc = 'cell res type is not boss'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'monster is not in neighbor cell'; break;
        }

        // 检查是否在boss挑战时间内
        var beginTime = gTerritoryWar.getBossCreateTime();
        var endTime = gTerritoryWar.getBossEndTime();
        var curTime = common.getTime();
        if (curTime < beginTime || curTime >= endTime) {
            resp.code = ErrorCode.ERROR_NOT_BOSS_CHALLENGE_TIME; resp.desc = 'not open time'; break;
        }

        // 检查玩家是否在战斗状态
        var isFightState = gTerritoryWar.isPlayerInFight(uid, curLid);
        if (isFightState) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in fight state'; break;
        }

        var challengeCount = gUserInfo.getBossChallengeCount(uid, curLid);

        resp.data.challengeCount = challengeCount;
        resp.data.rand = Math.floor(common.randRange(100000, 999999));
        resp.data.fight_lid = curLid;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight_boss = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cellId = +req.args.cellId;
        var damage = +req.args.damage;   // 对怪物造成的伤害
        var fight_lid = +req.args.fight_lid;
        if (isNaN(cellId) || isNaN(damage)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = fight_lid;
        if (!curLid)
            curLid = userInfo.territoryWar.pos.lid;

        var cellInfo = gTerritoryWar.getCellInfo(curLid, cellId);
        if (cellInfo == null) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_CELL_INFO; resp.desc = 'cell info is null'; break;
        }

        // 检查怪物所在格子与玩家所在格子是否相邻
        //if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, cellId)) {
        ///    resp.code = 1; resp.desc = 'monster is not in neighbor cell'; break;
        //}

        var isSelf = false;
        var enemyIndex = 0;
        if (curLid == userInfo.territoryWar.lid) {
            // 在自己的领地
            isSelf = true;
        } else {
            var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
            enemyIndex = enemies.indexOf(curLid);
            if (enemyIndex < 0) {
                enemyIndex = enemies.indexOf(curLid.toString());
                if (enemyIndex < 0) {
                    resp.code = ErrorCode.ERROR_NOT_CONTAIN_THIS_LID; resp.desc = 'enemy not contain cur lid'; break;
                }
            }
        }

        enemyIndex += 1;

        // 更新boss挑战次数
        gUserInfo.updateBossChallengeCount(uid, isSelf, enemyIndex);
        var challengeCount = gUserInfo.getBossChallengeCount(uid, curLid);
        resp.data.challengeCount = challengeCount;

        var bossInfo = gConfTerritoryBossForce[cellInfo.resId];
        if (bossInfo) {
            var scaleCount = gUserInfo.getDragonScaleCount(uid);
            var factor = parseFloat(gConfTerritoryWarBase.bossScoreAdd.value);
            var bossScore = Math.floor(damage/bossInfo.radio * (1 + scaleCount * factor));

            // 更新伤害值
            if (bossScore > 0)
                gTerritoryWar.updateBossDamage(uid, curLid, bossScore, userInfo.territoryWar.lid);

            resp.data.score = bossScore;
        }

        if (bossInfo) {
            resp.data.awards = generateDrop(bossInfo.lootId[cellInfo.resParam], userInfo.status.level);
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取格子里面的玩家列表
exports.get_cell_player_list = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cellId = req.args.cellId;
        var curLid = userInfo.territoryWar.pos.lid;

        resp.data.playerList = gTerritoryWar.getCellPlayerList(userInfo.territoryWar.lid, curLid, cellId);
        if (Object.keys(resp.data.playerList).length == 0) {
            resp.code = ErrorCode.ERROR_EMPTY_CELL;
            resp.desc = 'cell has no player';
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 攻击玩家
exports.attack_player = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var targetUid = +req.args.targetUid;
        var targetInfo = gUserInfo.getUser(targetUid);
        if (!targetInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_TARGET_PLAYER; resp.desc = 'target not found'; break;
        }

        if (targetInfo.territoryWar.lid == userInfo.territoryWar.lid) {
            resp.code = ErrorCode.ERROR_CAN_NOT_ATTACK_LEGION_MEMBER; resp.desc = 'can not attack same legion player'; break;
        }

        // 检查目标所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, targetInfo.territoryWar.pos.cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'target is not in neighbor cell'; break;
        }

        // 检查自己及目标是否在战斗中
        if (gTerritoryWar.isPlayerInFight(uid, userInfo.territoryWar.pos.lid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in battle'; break;
        }

        if (gTerritoryWar.isPlayerInFight(targetUid, targetInfo.territoryWar.pos.lid)){
            resp.code = ErrorCode.ERROR_TARGET_IS_IN_FIGHT_STATE; resp.desc = 'target is in battle'; break;
        }

        var reply = {
            info : gUserInfo.getUserFightInfo(uid, true),
            enemy : gUserInfo.getUserFightInfo(targetUid),
            rand1 : common.randRange(0, 99999),
            rand2 : common.randRange(0, 99999),
        };

        resp.data = reply;
        gTerritoryWar.onPlayerPrepareFight(uid, userInfo.territoryWar.pos.lid, targetUid);
        gTerritoryWar.onPlayerPrepareFight(targetUid, userInfo.territoryWar.pos.lid, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 攻击玩家结果
exports.fight_player = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var enemyUid = +req.args.enemy;
        var enemyInfo = gUserInfo.getUser(enemyUid);
        if (!enemyInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_TARGET_PLAYER; resp.desc = 'enemy not found'; break;
        }

        // 检查目标所在格子与玩家所在格子是否相邻
        if (!gUserInfo.isNeighborCell(userInfo.territoryWar.pos.cellId, enemyInfo.territoryWar.pos.cellId)) {
            resp.code = ErrorCode.ERROR_TARGET_NOT_IN_NEIGHBOR_CELL; resp.desc = 'target is not in neighbor cell'; break;
        }

        var star = +req.args.star;
        var power = +req.args.power; // 胜利方剩余耐力
        if (isNaN(star) || isNaN(power)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var selfConsumePower = +req.args.selfConsumePower;   // 自身消耗的耐力值
        var enemyConsumePower = +req.args.enemyConsumePower; // 敌方消耗的耐力值
        if (isNaN(selfConsumePower) || isNaN(enemyConsumePower)) {
            resp.code = 1; resp.desc = 'consume power args invalid'; break;
        }

        // 事件处理
        if (userInfo.territoryWar.lid == userInfo.territoryWar.pos.lid) {
            // 在己方领地
            if (star > 0) {
                var enemyLegionInfo = gTerritoryWar.getLegionInfo(enemyInfo.territoryWar.lid);
                gTerritoryWar.addEvent(userInfo.territoryWar.lid, EventType.EVENT_DEFEAT_ENEMY_IN_OUR_CITY,
                    userInfo.info.un, enemyLegionInfo.name, enemyInfo.info.un);

                var myLegionInfo = gTerritoryWar.getLegionInfo(userInfo.territoryWar.lid);
                gTerritoryWar.addEvent(enemyInfo.territoryWar.lid, EventType.EVENT_WAS_DEFEAT_BY_IN_OTHER_CITY,
                    enemyInfo.info.un, myLegionInfo.name, userInfo.info.un);
            } else {
                var enemyLegionInfo = gTerritoryWar.getLegionInfo(enemyInfo.territoryWar.lid);
                gTerritoryWar.addEvent(userInfo.territoryWar.lid, EventType.EVENT_WAS_DEFEAT_BY_IN_OUR_CITY,
                    enemyLegionInfo.name, enemyInfo.info.un);
            }
        }

        // 更新消耗对方的耐力值
        gUserInfo.updateConsumeEnemyStayingPower(uid, enemyConsumePower);
        gUserInfo.updateConsumeEnemyStayingPower(enemyUid, selfConsumePower);

        // 更新双方耐力
        var selfPower = gUserInfo.decStayingPower(uid, selfConsumePower);
        var enemyPower = gUserInfo.decStayingPower(enemyUid, enemyConsumePower);

        var winnerUid = 0;
        var fightLid = 0;
        var win = 0;
        if (star > 0) {
            win = 1;
            fightLid = userInfo.territoryWar.pos.lid;
            winnerUid = uid;
        } else {
            fightLid = enemyInfo.territoryWar.pos.lid;
            winnerUid = enemyUid;
        }

        // 结束双方的战斗状态
        gTerritoryWar.onPlayerEndFight(uid, fightLid);
        gTerritoryWar.onPlayerEndFight(enemyUid, fightLid);

        // 将耐力为0的玩家踢回领地
        if (selfPower <= 0) {
            gTerritoryWar.onPlayerDeath(uid, enemyUid);
        }

        var enemyDead = false;
        if (enemyPower <= 0) {
            gTerritoryWar.onPlayerDeath(enemyUid, uid);
            enemyDead = true;
        }

        selfPower = gUserInfo.getStayingPower(uid, common.getTime());
        enemyPower = gUserInfo.getStayingPower(enemyUid, common.getTime());

        var enemyWin = !win;
        gTerritoryWar.notifyFightResult(enemyUid, enemyWin, enemyConsumePower, enemyPower, enemyDead);
        gTerritoryWar.notifyPlayerStayingPowerChange(fightLid, winnerUid, power);

        var selfLegion = gTerritoryWar.getLegionInfo(userInfo.territoryWar.lid);
        var enemyLegion = gTerritoryWar.getLegionInfo(enemyInfo.territoryWar.lid)
        gTerritoryWar.addReport(uid, enemyUid, req.args.replay, win, selfConsumePower,
            enemyConsumePower, selfLegion.name, enemyLegion.name, selfLegion.icon, enemyLegion.icon);

        // 返回双方的耐力值
        resp.data.selfStayingPower = selfPower;
        resp.data.enemyStayingPower = enemyPower;

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取排行榜
exports.get_rank = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        resp.data.rankList = gTerritoryWar.getRankList();
        resp.data.rank = gTerritoryWar.getPlayerRank(uid);
        resp.data.killCount = gUserInfo.getKillPlayerCount(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取战报
exports.get_reports = function (req, res, resp) {
    do {
        var uid = +req.uid;
        resp.data.report = gTerritoryWar.getReports(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_replay = function (req, res, resp) {
    gReplay.getReplay(req.args.id, function(replay){
        if (replay) {
            resp.data = replay;
        } else {
            resp.code = 1; resp.desc = 'no such replay';
        }
        onReqHandled(res, resp, 1);
    });
};

// 领取成就奖励
exports.get_achievement_awards = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var achievementType = +req.args.achievementType;
        var achievementId = +req.args.achievementId;
        var level = req.args.level;
        if (isNaN(achievementType) || isNaN(achievementId)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (gUserInfo.isAchievementAwardGot(uid, achievementType, achievementId)) {
            resp.code = ErrorCode.ERROR_AWARD_HAS_GOT; resp.desc = 'award has got'; break;
        }

        if (!gUserInfo.isAchievementFinish(uid, achievementType, achievementId)) {
            resp.code = ErrorCode.ERROR_ACHIEVEMENT_NOT_FINISH; resp.desc = 'achievement not finish'; break;
        }

        if (!level) {
            level = 1;
        }

        resp.data.awards = gUserInfo.onPlayerGetAchievementAward(uid, achievementType, achievementId, level);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 挑战傀儡
exports.challenge = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        // 检查玩家是否正在战斗
        var curLid = userInfo.territoryWar.pos.lid;
        if (gTerritoryWar.isPlayerInFight(uid, curLid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_IN_FIGHT_STATE; resp.desc = 'you are in fight state'; break;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.challenge_before_fight = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        resp.data.rand = Math.floor(common.randRange(100000, 999999));
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.challenge_fight = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var round = +req.args.round;
        var killCount = +req.args.killCount;
        if (isNaN(round) || isNaN(killCount)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        gUserInfo.updateKillPuppetTotalCount(uid, killCount);
        resp.data.total = gUserInfo.getKillPuppetTotalCount(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 探索遗迹
exports.start_explore = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var relicId = +req.args.relicId;
        if (isNaN(relicId)) {
            resp.code = 1; resp.desc = 'invalid args relicId'; break;
        }

        // 检查是否已经有已经正在探索
        if (gUserInfo.getExploreCount(uid) >= parseInt(gConfVip[userInfo.status.vip].relicNum)) {
            resp.code = ErrorCode.ERROR_HAS_EXPLORE; resp.desc = 'explore count more than 1'; break;
        }

        resp.code = gUserInfo.startExploreRelic(uid, relicId);
        resp.data.relicInfo = gUserInfo.getRelicInfo(uid, relicId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 停止探索
exports.stop_explore = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var relicId = +req.args.relicId;
        if (isNaN(relicId)) {
            resp.code = 1; resp.desc = 'invalid args relicId'; break;
        }

        resp.code = gUserInfo.stopExploreRelic(uid, relicId);
        resp.data.relicInfo = gUserInfo.getRelicInfo(uid, relicId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 加速探索
exports.speed_explore = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var relicId = +req.args.relicId;
        if (isNaN(relicId)) {
            resp.code = 1; resp.desc = 'invalid args relicId'; break;
        }

        resp.code = gUserInfo.speedExploreRelic(uid, relicId);
        resp.data.relicInfo = gUserInfo.getRelicInfo(uid, relicId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取本军团事件列表
exports.get_events = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var lid = userInfo.territoryWar.lid;
        resp.data.events = gTerritoryWar.getEvents(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取敌方信息
exports.get_enemy = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var enemies = gTerritoryWar.getEnemy(userInfo.territoryWar.lid);
        var enemyList = [];
        for (var i = 0; i < enemies.length; i++) {
            var enemy = gTerritoryWar.getLegionInfo(enemies[i]);
            if (enemy) {
                enemy.lid = enemies[i];
                enemyList.push(enemy);
            } else {
                var territory = gTerritoryWar.getTerritory(enemies[i]);
                if (territory) {
                    var legionInfo = {};
                    legionInfo.name = territory.legionName;
                    legionInfo.icon = [1, 1];
                    legionInfo.level = territory.level;
                    legionInfo.legionWarLevel = territory.legionWarLevel;
                    gTerritoryWar.updateLegionInfo(enemies[i], legionInfo);

                    enemy = gTerritoryWar.getLegionInfo(enemies[i]);
                    if (enemy) {
                        enemy.lid = enemies[i];
                        enemyList.push(enemy);
                    }
                } else {
                    LogError('territory get_enemy lid = ' + enemies[i]);

                    gTerritoryWar.createRobot(enemies[i]);
                    enemy = gTerritoryWar.getLegionInfo(enemies[i]);
                    if (enemy) {
                        enemy.lid = enemies[i];
                        enemyList.push(enemy);
                    }
                }
            }
        }

        resp.data.enemies = enemies;
        resp.data.enemyList = enemyList;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.offline = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var enemyUid = gTerritoryWar.getFightEnemyUid(uid, userInfo.territoryWar.pos.lid);
        if (enemyUid != 0) {
            gTerritoryWar.onPlayerEndFight(enemyUid, userInfo.territoryWar.pos.lid);
        }

        gTerritoryWar.onPlayerEndFight(uid, userInfo.territoryWar.pos.lid);
        gUserInfo.onPlayerLeave(uid);
        DEBUG('player ' + uid + 'offline');
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取玩家领地战信息
exports.get_player_territory_war_info = function (req, res, resp) {
    do {
        resp.data = {};
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.data.territoryWar = gUserInfo.getEmptyTerritoryWar();
            resp.data.selfHeadpic = 1;
        } else {
            resp.data.territoryWar = userInfo.territoryWar;
            resp.data.selfHeadpic = userInfo.info.headpic;
            resp.data.selfHeadframe = userInfo.info.headframe;
        }

        var target_uid = req.args.target_uid;
        var targetUserInfo = gUserInfo.getUser(target_uid);
        if (!targetUserInfo) {
            resp.data.targetTerritoryWar = gUserInfo.getEmptyTerritoryWar();
            resp.data.targetHeadpic = 1;
        } else {
            resp.data.targetTerritoryWar = targetUserInfo.territoryWar;
            resp.data.targetHeadpic = targetUserInfo.info.headpic;
            resp.data.targetHeadframe = targetUserInfo.info.headframe;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 取消战斗
exports.cancel_fight = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        // 解除战斗状态
        var enemyUid = gTerritoryWar.getFightEnemyUid(uid, userInfo.territoryWar.pos.lid);
        if (enemyUid != 0) {
            gTerritoryWar.onPlayerEndFight(enemyUid, userInfo.territoryWar.pos.lid);
        }
        gTerritoryWar.onPlayerEndFight(uid, userInfo.territoryWar.pos.lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 玩家离开军团
exports.on_player_leave_legion = function (req, res, resp) {
    do {
        var uid = +req.args.uid;
        var lid = +req.args.lid;

        gTerritoryWar.onPlayerLeaveLegion(lid, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 军团解散
exports.on_legion_dismiss = function (req, res, resp) {
    do {
        var lid = +req.args.lid;

        gTerritoryWar.onLegionDismiss(lid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取关隘状态
exports.get_city_state = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var cities = {};
        for (var id in gConfTerritoryWarTransfer) {
            var cellId = parseInt(gConfTerritoryWarBase[gConfTerritoryWarTransfer[id].target].value);
            var hasEnemy = gTerritoryWar.hasEnemyPlayer(userInfo.territoryWar.lid, cellId, userInfo.territoryWar.lid);
            cities[id] = {};
            cities[id].hasEnemy = hasEnemy;
        }

        resp.data.cities = cities;

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取boss排行榜
exports.get_boss_rank = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var bossLid = req.args.lid;

        var selfScore = 0;
        var selfRank = 0;
        resp.data.self = {};
        var selfLegionInfo = gTerritoryWar.getLegionInfo(userInfo.territoryWar.lid);
        if (selfLegionInfo) {
            resp.data.self.lid = userInfo.territoryWar.lid;
            resp.data.self.legionName = selfLegionInfo.name;
            resp.data.self.legionIcon = selfLegionInfo.icon;
            resp.data.self.legionLevel = selfLegionInfo.level;
            resp.data.self.sid = selfLegionInfo.sid;
            resp.data.self.custom_king = userInfo.custom_king;
        }

        resp.data.boss = {};
        resp.data.boss.legions = {};
        resp.data.boss.players = [];

        var bossInfo = gTerritoryWar.getBossRank(bossLid);
        if (bossInfo) {
            // 军团列表

            var rankLegion = [];
            for (var lid in bossInfo.damage.legions) {
                var legionObj = {};
                legionObj.lid = lid;
                legionObj.score = bossInfo.damage.legions[lid];
                rankLegion.push(legionObj);
            }

            function sortLegionFunc(a, b) {
                var scorea = a.score;
                var scoreb = b.score;

                if (scorea > scoreb) {
                    return -1;
                } else if (scorea < scoreb) {
                    return 1;
                } else {
                    return 1;
                }
            }

            rankLegion.sort(sortLegionFunc);

            for (i = 0; i < rankLegion.length; i++) {
                var lid = rankLegion[i].lid;
                var legionInfo = gTerritoryWar.getLegionInfo(lid);

                resp.data.boss.legions[i] = {};
                resp.data.boss.legions[i].lid = lid;
                resp.data.boss.legions[i].name = legionInfo.name;
                resp.data.boss.legions[i].icon = legionInfo.icon;
                resp.data.boss.legions[i].score = bossInfo.damage.legions[lid];
                resp.data.boss.legions[i].sid = legionInfo.sid;
                resp.data.boss.legions[i].leader = legionInfo.leader;
            }

            // 玩家列表
            for (var i = 0; i < bossInfo.damage.damageRank.length; i++) {
                var user = gUserInfo.getUser(bossInfo.damage.damageRank[i].uid);
                if (user) {
                    var rankObj = {};
                    rankObj.uid = user._id;
                    rankObj.un = user.info.un;
                    rankObj.headpic = user.info.headpic;
                    rankObj.headframe = user.info.headframe;
                    rankObj.level = user.status.level;
                    rankObj.vip = user.status.vip;
                    rankObj.score = bossInfo.damage.damageRank[i].damage;
                    if(!user.pos[1] || !user.pos[1].hid){
                        rankObj.main_role = 10000;//取不到主角ID
                    }else{
                        rankObj.main_role = user.pos[1].hid;
                    }
                    rankObj.fightforce = user.fight_force;
                    rankObj.custom_king = user.custom_king;
                    var userLegion = gTerritoryWar.getLegionInfo(user.territoryWar.lid);
                    if (userLegion) {
                        rankObj.legionName = userLegion.name;
                        rankObj.legionIcon = userLegion.icon;
                        rankObj.sid = userLegion.sid;
                     
                    }

                    if (user._id == uid) {
                        selfScore = rankObj.score;
                        selfRank = i + 1;
                    }

                    resp.data.boss.players.push(rankObj);
                }
            }

            resp.data.self.score = selfScore;
            resp.data.self.rank = selfRank;
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取boss信息
exports.get_boss_info = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var boss = gTerritoryWar.getBossRank(curLid);
        var ownerLid = boss.curOwner;

        var legionInfo = gTerritoryWar.getLegionInfo(ownerLid);
        if (legionInfo) {
            resp.data.legionIcon = legionInfo.icon;
            resp.data.legionName = legionInfo.name;
            resp.data.legionLevel = legionInfo.level;
        }

        resp.data.challengeCount = gUserInfo.getBossChallengeCount(uid, curLid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取boss列表
exports.get_boss_list = function(req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_USER_NOT_FOUND; resp.desc = 'user not found'; break;
        }

        var myLid = userInfo.territoryWar.lid;
        var selfLegionInfo = gTerritoryWar.getLegionInfo(myLid);
        var selfBossInfo = gTerritoryWar.getBossRank(myLid);

        resp.data.self = {};
        if (selfLegionInfo) {
            resp.data.self.lid = myLid;
            resp.data.self.sid = selfLegionInfo.sid;
            resp.data.self.leader = selfLegionInfo.leader;
            resp.data.self.legionName = selfLegionInfo.name;
            resp.data.self.legionIcon = selfLegionInfo.icon;
            resp.data.self.legionLevel = (selfBossInfo.createLevel > 0 ? selfBossInfo.createLevel : 1);
            resp.data.self.bossLevel = selfBossInfo.bossLevel;
            resp.data.self.bossIndex = selfBossInfo.bossIndex;

            resp.data.self.ownerLid = selfBossInfo.curOwner;
            resp.data.self.ownerLegionName = '';
            resp.data.self.ownerLegionLevel = 0;

            if (selfBossInfo.curOwner != 0) {
                var ownerLegionInfo = gTerritoryWar.getLegionInfo(selfBossInfo.curOwner);
                if (ownerLegionInfo) {
                    resp.data.self.ownerLegionName = ownerLegionInfo.name;
                    resp.data.self.ownerLegionLevel = ownerLegionInfo.level;
                }
            }
        }

        resp.data.enemy1 = {};
        resp.data.enemy2 = {};

        var enemies = gTerritoryWar.getEnemy(myLid);
        for (var i = 0; i < enemies.length; i++) {
            var enemyLegionInfo = gTerritoryWar.getLegionInfo(enemies[i]);
            var enemyBossInfo = gTerritoryWar.getBossRank(enemies[i]);
            if (enemyLegionInfo) {
                var index = i + 1;
                resp.data['enemy' + index].lid = enemies[i];
                resp.data['enemy' + index].sid = enemyLegionInfo.sid;
                resp.data['enemy' + index].leader = enemyLegionInfo.leader;
                resp.data['enemy' + index].legionName = enemyLegionInfo.name;
                resp.data['enemy' + index].legionIcon = enemyLegionInfo.icon;
                resp.data['enemy' + index].legionLevel = (enemyBossInfo.createLevel > 0 ? enemyBossInfo.createLevel : 1);
                resp.data['enemy' + index].bossLevel = enemyBossInfo.bossLevel;
                resp.data['enemy' + index].bossIndex = enemyBossInfo.bossIndex;

                resp.data['enemy' + index].ownerLid = enemyBossInfo.curOwner;
                resp.data['enemy' + index].ownerLegionName = '';
                resp.data['enemy' + index].ownerLegionLevel = 0;

                if (enemyBossInfo.curOwner != 0) {
                    var ownerLegionInfo = gTerritoryWar.getLegionInfo(enemyBossInfo.curOwner);
                    if (ownerLegionInfo) {
                        resp.data['enemy' + index].ownerLegionName = ownerLegionInfo.name;
                        resp.data['enemy' + index].ownerLegionLevel = ownerLegionInfo.level;

                    }
                }
            }
        }
    } while(false);

    onReqHandled(res, resp, 1);
};

exports.legion_level_up = function (req, res, resp) {
    do {
        var lid = req.args.lid;
        var level = req.args.level;
        var legionWarLevel = req.args.legionWarLevel;
        var serverId = req.args.serverId;

        gTerritoryWar.updateLegionLevel(lid, level, legionWarLevel, serverId);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_boss_notice_info = function (req, res, resp) {
    do {
        var lids = req.args.lids;
        resp.data.list = gTerritoryWar.getBossInfo(lids);
    } while (false);

    onReqHandled(res, resp, 1);
};
