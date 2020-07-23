// 服战管理器
var ErrorCode = require('./error.js').ErrorCode;
var EventType = require('./error.js').EventType;
var Room = require('./room.js').Room;

// 是否是都城
function isCapitalCity(city_id) {
    if (city_id == 1 || city_id == 26 || city_id == 51) {
        return true;
    }

    return false;
}

// 是否是安全区
function isSafeCity(city_id) {
    if (isCapitalCity(city_id)) {
        return true;
    }

    return false;
}

function CountryWar() {
    // 服战房间列表
    this.rooms = {};

    // 服战基础信息
    this.countryWarInfo = {
        isOpen : false,     // 服战是否开始
        openTime : 0,       // 本次服战开始时间
    };

    // 战报
    this.reports = {
        /*
         uid : [
            [time, type, enemyid, rankdiff, replay]     // type: 0未开始, 1逃跑, 2打赢, 3打输, 4被打赢, 5被打输
         ]
         */
    };

    // 服战开启时间和结束时间
    this.beginTime = 0;
    this.endTime = 0;
    this.fightBeginTime = 0;

    // 上一次结算服务器积分的时间，控制积分计算频率
    this.scoreCalcTime = 0;

    // 上一次重置时间
    this.lastResetTime = 0;
    this.lastTickDay = 0;

    this.dirty = {};

    // 服务器Id与房间id对应表
    this.serverRoomTab = {};
    this.serverCampTable = {};

    this.servers = {                    // 链接到此服World服
        // sid: [ip, port],             // 服务器ID: [地址, 端口]
    };

    // 服务器排队列表
    this.waitQueue = {};

    this.specialStart = false;

    // 补发邮件标志，临时的
    this.sendMailFlag = false;

    // web服务器配置的服务器列表
    this.webServerList = {};
}

CountryWar.create = function (callback) {
    var countryWarData = {
        '_id' : 'countrywar',
        'countryWarInfo' : {},
        'reports': {},
        'scoreCalcTime' : 0,
        'lastResetTime' : 0,
        'serverRoomTab' : {},
        'serverCampTable' : {},
        'servers' : {},
        'sendMailFlag' : false,
    };

    gDBCountryWar.insert(countryWarData, function(err, result) {
        callback && callback();
    });
};


CountryWar.prototype = {
    // 初始化
    init : function (callback) {
        var _me = this;
        gDBCountryWar.findOne({_id : 'countrywar'}, {}, function(err, doc){
            if( doc ) {
                _me.countryWarInfo = doc.countryWarInfo;
                _me.scoreCalcTime = doc.scoreCalcTime;
                _me.lastResetTime = doc.lastResetTime;
                _me.reports = doc.reports;
                _me.serverRoomTab = doc.serverRoomTab;
                _me.serverCampTable = doc.serverCampTable;
                _me.servers = doc.servers;
                _me.sendMailFlag = doc.sendMailFlag;

                var cursor = gDBRooms.find({});
                cursor.each(function (err, item) {
                    if (err) {
                        callback && callback(false);
                    }

                    if (item) {
                        _me.rooms[item._id] = new Room();
                        _me.rooms[item._id].init(item);
                    } else {
                        _me._init(callback);
                    }
                });
            } else{
                callback && callback(false);
            }
        });
    },

    _init : function (callback) {
        if (!this.countryWarInfo.isOpen) {
            this.countryWarInfo.isOpen = false;
            this.markDirty('countryWarInfo.isOpen');
        }

        if (!this.countryWarInfo.openTime) {
            this.countryWarInfo.openTime = 0;
            this.markDirty('countryWarInfo.openTime');
        }

        if (!this.servers) {
            this.servers = {};
            this.markDirty('servers');
        }

        var weekDay = Date.getWeekDay();
        this.lastTickDay = weekDay;

        this.resetTime();
        this.buildServerRoomTab();
        callback && callback(true);
    },

    initWebServerList : function (serverList) {
        DEBUG(serverList);
        this.webServerList = {};
        for (var sid in serverList) {
            var serverObj = {};
            serverObj.sid = parseInt(sid);
            serverObj.name = serverList[sid]['name'];
            serverObj.merged = serverList[sid]['merged'];
            this.webServerList[serverObj.sid] = serverObj;
        }
    },

    // 构建服务器id与房间id的对应表
    buildServerRoomTab : function () {
        if (!this.serverRoomTab || !this.serverCampTable ||
            Object.keys(this.serverRoomTab).length == 0 ||
            Object.keys(this.serverCampTable).length == 0 ) {

            if (!this.serverRoomTab)
                this.serverRoomTab = {};

            if (!this.serverCampTable)
                this.serverCampTable = {};

            for (var groupId in gConfCountryRoom) {
                for (var i = 1; i <= 3; i++) {
                    var campList = gConfCountryRoom[groupId]['camp' + i];
                    for (var j = 0; j < campList.length; j++) {
                        var serverId = campList[j];
                        if (!this.serverRoomTab[serverId]) {
                            this.serverRoomTab[serverId] = parseInt(groupId);
                        }

                        if (!this.serverCampTable[serverId]) {
                            this.serverCampTable[serverId] = i;
                        }
                    }
                }
            }

            this.markDirty('serverRoomTab');
            this.markDirty('serverCampTable');
        }
    },

    // 根据服务器id获得房间id
    getRoomIdByServerId : function (serverId) {
        if (this.serverRoomTab[serverId])
            return this.serverRoomTab[serverId];

        return 0
    },

    // 根据服务器id获取索引
    getIndexByServerId : function (serverId) {
        if (this.serverCampTable[serverId])
            return this.serverCampTable[serverId];

        return 0;
    },

    resetTime : function () {
        var strBegin = gConfCountryWarBase.openTime.value[0].split(':');
        if (strBegin.length != 2) {
            return ;
        }

        var strEnd = gConfCountryWarBase.openTime.value[1].split(':');
        if (strEnd.length != 2) {
            return;
        }

        var begin = new Date ();
        var end = new Date ();
        var now = new Date();

        var endHour = parseInt(strEnd[0]);
        var endMin = parseInt(strEnd[1]);
        var curHour = now.getHours();
        var curMin = now.getMinutes();

        var todayPass = 0;
        if (curHour > endHour || (curHour == endHour && curMin > endMin)) {
            todayPass = 1;
        }

        var weekDay = Date.getWeekDay() + todayPass;
        if (weekDay > 7)
            weekDay = 1;

        var openDay = weekDay;
        var diffDay = 0;
        for (var i = 0; i < gConfCountryWarBase.openDays.value.length; i++) {
            var find = false;
            for (var j = 0; j < gConfCountryWarBase.openDays.value.length; j++) {
                if (openDay == parseInt(gConfCountryWarBase.openDays.value[j])) {
                    find = true;
                    break;
                }
            }

            if (find) {
                break;
            } else {
                openDay++;
                if (openDay > 7)
                    openDay = 1;
                diffDay ++;
            }
        }

        begin.setFullYear(begin.getFullYear(), begin.getMonth(), begin.getDate() + diffDay + todayPass);
        begin.setHours (parseInt(strBegin[0]));
        begin.setMinutes (parseInt(strBegin[1]));
        begin.setSeconds(0);

        end.setFullYear(end.getFullYear(), end.getMonth(), end.getDate() + diffDay + todayPass);
        end.setHours (parseInt(strEnd[0]));
        end.setMinutes (parseInt(strEnd[1]));
        end.setSeconds(59);

        this.beginTime = Math.floor(begin.getTime()/1000);
        this.endTime = Math.floor(end.getTime()/1000);
        this.fightBeginTime = this.beginTime + parseInt(gConfCountryWarBase.readyTime.value);
    },

    getEndTime : function () {
        return this.endTime;
    },

    // 定时器
    tick : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].tick();
        }

        var curTime = common.getTime();

        if (!this.countryWarInfo.isOpen) {
            // 检查是否到开启时间了
            if (curTime >= this.beginTime && curTime < this.endTime) {
                this.countryWarInfo.isOpen = true;
                this.onStart();

                this.markDirty('countryWarInfo');
            } else if (curTime > this.endTime) {
                this.resetTime();
            }
        } else {
            if (this.lastResetTime < this.beginTime && !this.specialStart) {
                // 上次关服没重置
                this.onStart();
                this.specialStart = true;
            } else {
                this.processCall();
                this.processCountryTask();

                // 检查是否到关闭时间了
                if (curTime < this.beginTime || curTime >= this.endTime) {
                    this.countryWarInfo.isOpen = false;
                    this.countryWarInfo.opentime = 0;
                    this.markDirty('countryWarInfo');

                    this.onEnd();
                }
            }
        }

        var weekDay = Date.getWeekDay();
        if (weekDay != this.lastTickDay) {
            this.lastTickDay = weekDay;
            // 跨天了，重置时间
            this.resetTime();
        }
    },

    markDirty: function(name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    arrangeDirty: function () {
        var arrangedDirty = {};
        for (var item in this.dirty) {
            var needRemove = [];
            var addNew = true;
            var levels = item.split('.');
            for (var eitem in arrangedDirty) {
                var elevels = eitem.split('.');
                if (elevels.length == levels.length) continue;
                var minLen = Math.min(elevels.length, levels.length);

                var isTree = true;
                for (var i = 0; i < minLen; i++) {
                    if (elevels[i] != levels[i]) {
                        isTree = false;
                        break;
                    }
                }

                if (!isTree) continue;

                if (elevels.length < levels.length) {
                    addNew = false;
                    break;
                } else {
                    needRemove.push(eitem);
                }
            }

            needRemove.forEach(function(removeItem) {
                delete arrangedDirty[removeItem];
            });

            if (addNew) {
                arrangedDirty[item] = this.dirty[item];
            }
        }

        this.dirty = arrangedDirty;
    },

    // 数据保存
    save : function (callback) {
        var _me = this;
        var loader = new common.Loader(function () {
            DEBUG('countrywar saved');
            _me.saveCountryWar(callback);

            callback && callback(true);
        });
        loader.addLoad('empty');

        for (var roomId in this.rooms) {
            loader.addLoad(parseInt(roomId));
            this.rooms[roomId].save(function (roomId) {
                DEBUG('roomId = ' + roomId);
                loader.onLoad(roomId);
            });
        }

        loader.onLoad('empty');
    },

    saveCountryWar : function (callback) {
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(true);
            return;
        }

        this.arrangeDirty();
        var updates = {};
        for (var item in this.dirty) {
            var obj = this;
            var args = item.split(".");
            var ok = true;
            for (var i = 0; i < args.length; i++) {
                if (typeof(obj) != 'object') {
                    ok = false;
                    break;
                }
                obj = obj[args[i]];
            }

            if (ok && obj != undefined && obj != NaN && obj != null) {
                updates[item] = obj;
            } else {
                ERROR('INVALID SAVE COUNTRYWAR: ' + item);
            }
        }

        this.dirty = {};
        gDBCountryWar.update({_id: 'countrywar'}, {$set: updates}, function (err, result) {
            if (err) {
                ERROR({updates: updates, err: err});
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });

        DEBUG('countrywar war saved');
    },

    broadcastToAllWorld : function (req, resp, callback) {
        for (var sid in this.servers) {
            this.broadcastToWorld(sid, req, resp, callback);
        }
    },

    broadcastToWorld: function (serverId, req, resp, callback) {
        var serverInfo = gCountryWar.getServerInfo(serverId);
        if (serverInfo) {
            requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, resp, callback);
        }
    },

    // 服战开启回调
    onStart : function () {
        // 重置玩家国战数据
        var weekDay = Date.getWeekDay();
        var weekClear = false;
        if (weekDay == 1) {
            weekClear = true;   // 星期一周重置
            this.resetByDay();
            this.resetByWeek();
        } else {
            // 每日重置
            this.resetByDay();
        }

        // 每个房间回调
        for (var roomId in this.rooms) {
            this.rooms[roomId].onStart();
        }

        gUserInfo.resetCountryWar(weekClear);

        this.lastResetTime = common.getTime();
        this.markDirty('lastResetTime');
    },

    // 服战结束处理
    onEnd : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].onEnd();
        }

        this.resetTime();
    },

    resetByDay : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].resetByDay();
        }
    },

    resetByWeek : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].resetByWeek();
        }

        this.serverRoomTab = {};
        this.serverCampTable = {};

        this.markDirty('serverRoomTab');
        this.markDirty('serverCampTable');

        this._init();
    },

    processCall : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].processCall();
        }
    },

    processCountryTask : function () {
        for (var roomId in this.rooms) {
            this.rooms[roomId].processCountryTask();
        }
    },

    findPlayerCity : function (roomId, uid) {
        if (this.rooms[roomId])
            return this.rooms[roomId].findPlayerCity(uid);

        return 0;
    },

    addReport: function(uid1, uid2, replay, win) {
        var reports1 = this.reports[uid1];
        if (!reports1) {
            reports1 = this.reports[uid1] = [];
        }

        var replayKey = gReplay.addReplay(replay);
        var report1 = [common.getTime(), win, uid2, replayKey];
        reports1.push(report1);
        if (reports1.length > gConfGlobal.arenaReportCount) {
            reports1.shift();
        }

        var report2 = report1.slice();
        report2[1] = win ? 0 : 1;
        report2[2] = uid1;

        var reports2 = this.reports[uid2];
        if (!reports2) {
            reports2 = this.reports[uid2] = [];
        }

        reports2.push(report2);
        if (reports2.length > gConfGlobal.arenaReportCount) {
            reports2.shift();
        }

        this.markDirty(util.format('reports.%d', uid1));
        this.markDirty(util.format('reports.%d', uid2));
    },

    // 获取聊天记录
    getChatLog : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getChatLog();
        }

        return [];
    },

    getShoutLog : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getShoutLog();
        }

        return [];
    },

    insertChatLog : function (roomId, chatInfo) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].insertChatLog(chatInfo);
        }
    },

    chat : function (roomId, chatInfo, camp, wholeRoom) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].chat(chatInfo, camp, wholeRoom);
        }
    },

    updateKillRank : function (roomId, uid, sort) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].updateKillRank(uid, sort);
        }
    },

    refreshPlayerCount : function (roomId) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].refreshPlayerCount();
        }
    },

    onHandleUserAct : function (roomId, uid) {
        if (gUserInfo.onUserAct(uid)) {
            this.refreshPlayerCount(roomId);
        }
    },

    insertMatch : function (roomId, uid, enemy_uid) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].insertMatch(uid, enemy_uid);
        }
    },

    // 取消匹配
    cancelMatch : function (roomId, uid) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].cancelMatch(uid);
        }
    },

    // 是否被别人比配
    isMatched : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].isMatched(uid);
        }

        return false;
    },

    // 同步移动
    syncPlayerMove : function (roomId, uid, from, to) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].syncPlayerMove(uid, from, to);
        }
    },

    getMoveInfo : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getMoveInfo(uid);
        }

        return null;
    },

    removeMoveInfo : function (roomId, uid) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].removeMoveInfo(uid);
        }
    },

    getCities : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCities();
        }

        return null;
    },

    // 获取城池信息
    getCityInfo : function (roomId, city_id, detail) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCityInfo(city_id, detail);
        }

        return null;
    },

    // 玩家离开回调
    onPlayerLeaveCity : function (roomId, uid, city_id, dead) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onPlayerLeaveCity(uid, city_id, dead);
        }
    },

    // 到达城池
    onReachCity : function (roomId, uid, targetCity, resp) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onReachCity(uid, targetCity, resp);
        }
    },

    getCitiesForClient : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCitiesForClient();
        }

        return null;
    },

    // 添加集结令
    addCallOfDuty : function (roomId, country, city_id, caller) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].addCallOfDuty(country, city_id, caller);
        }
    },

    // 获取集结令发布信息
    getCallOfDuty : function (roomId, camp) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCallOfDuty(camp);
        }

        return null;
    },

    // 获取玩家响应过的集结令列表
    getReplyCalls : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getReplyCalls(uid);
        }

        return null;
    },

    // 获取玩家击杀排名
    getPlayerDayRank : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getPlayerDayRank(uid);
        }

        return 0;
    },

    getPlayerWeekRank : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getPlayerWeekRank(uid);
        }

        return 0;
    },

    getDayRankList : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getDayRankList();
        }

        return null;
    },

    getWeekRankList : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getWeekRankList();
        }

        return null;
    },

    // 获得各个国家占领城池数
    getCountryOwnCityCount : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCountryOwnCityCount();
        }

        return null;
    },

    // 增加移动数据
    addPlayerMove : function (roomId, uid, target_city, start_time, reach_time, paths) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].addPlayerMove(uid, target_city, start_time, reach_time, paths);
        }
    },

    // 获取机器人数据
    getRobot : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getRobot(uid);
        }

        return null;
    },

    // 玩家死亡
    onPlayerDeath : function (roomId, uid, killer, city_id) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onPlayerDeath(uid, killer, city_id);
        }
    },

    // 获取对阵表
    getFightTable : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getFightTable();
        }

        return {};
    },

    // 玩家战斗回调
    onPlayerFight : function (roomId, city_id, uid1, uid2, name1, name2, camp1, camp2, serverId1, serverId2, winner) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onPlayerFight(city_id, uid1, uid2, name1, name2, camp1, camp2, serverId1, serverId2, winner);
        }
    },

    // 获取国家任务
    getCountryTask : function (roomId, camp) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCountryTask(camp);
        }

        return {};
    },

    // 获取国家积分
    getCountryScore : function (roomId, index) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCountryScore(index);
        }

        return 0;
    },

    getCampPlayerCount : function (roomId, camp) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCampPlayerCount(camp);
        }

        return 0;
    },

    getServerInfo : function (sid) {
        if (this.servers[sid]) {
            return this.servers[sid];
        }

        return null;
    },

    getServers : function () {
        return this.servers;
    },

    getServerState : function (sid) {
        var curTime = common.getTime();
        if (this.servers[sid]) {
            var days = parseInt(gConfCountryWarBase.serverOpenDayLimit.value);
            var dayTime = days * OneDayTime;
            if (this.servers[sid][2] && curTime >= this.servers[sid][2] + dayTime) {
                return 1;
            }
        }

        return 0;
    },

    // 发布召集令
    sendCall : function (serverId, roomId, uid, targetCity) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].sendCall(uid, serverId, targetCity);
        }

        this.onHandleUserAct(roomId, uid);
    },

    getRoom : function (roomId) {
        return this.rooms[roomId];
    },

    isServerInWaitQueue : function (roomId) {
        if (this.waitQueue[roomId])
            return true;

        return false;
    },

    insertServerIntoWaitQueue : function (roomId, serverId) {
        if (!this.waitQueue[roomId]) {
            this.waitQueue[roomId] = {};
            this.waitQueue[roomId].campCount = 0;
        }

        var index = this.getIndexByServerId(serverId);
        if (!this.waitQueue[roomId][index]) {
            this.waitQueue[roomId][index] = [];
            this.waitQueue[roomId].campCount ++;
        }

        if (this.waitQueue[roomId][index].indexOf(serverId) < 0) {
            this.waitQueue[roomId][index].push(serverId);

            if (this.waitQueue[roomId].campCount >= 3) {
                var newRoom = new Room();
                newRoom.setRoomId(roomId);
                newRoom.setServers(this.waitQueue[roomId]);
                this.rooms[roomId] = newRoom;

                delete this.waitQueue[roomId];
                DEBUG('new room open++++++++++++++++++++++++');
            }
        }
    },

    onPlayerEnterCity : function (roomId, uid, city_id, old_city, dead, call) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onPlayerEnterCity(uid, city_id, old_city, dead, call);
        }
    },

    onPlayerEnterRoom : function (uid, roomId, camp, serverId) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].onPlayerEnterRoom(uid, camp, serverId);
        }
    },

    isCountryTaskFinish : function (roomId, camp, taskType, taskId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].isCountryTaskFinish(camp, taskType, taskId);
        }

        return false;
    },

    getWeekRank : function (roomId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getWeekRank();
        }

        return {};
    },

    addAttackPlayer : function (roomId, city, uid) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].addAttackPlayer(city, uid);
        }
    },

    getCampWeekRank : function (roomId, camp) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCampWeekRank(camp);
        }

        return 0;
    },

    getBeingTime : function () {
        return this.beginTime;
    },

    getEndTime : function () {
        return this.endTime;
    },

    getFightBeginTime : function () {
        return this.fightBeginTime;
    },

    isInCountryWarOpenTime : function () {
        var curTime = common.getTime();
        if (curTime >= this.beginTime && curTime < this.endTime) {
            return true;
        }

        return false;
    },

    roomBroadcast : function (roomId, req, resp, callback) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].broadcastToAllWorld(req, resp, callback);
        }
    },

    serverBroadcast : function (roomId, serverId, req, resp, callback) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].broadcastToWorld(serverId, req, resp, callback);
        }
    },

    addEvent : function (roomId, cityId, event_id, param1, param2, param3, param4, param5, param6) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].addEvent(cityId, event_id, param1, param2, param3, param4, param5, param6);
        }
    },

    getEvents : function (roomId, cityId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getEvents(cityId);
        }

        return [];
    },

    markTaskAwardGot : function (roomId, uid, taskType, taskId) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].markTaskAwardGot(uid, taskType, taskId);
        }
    },

    isTaskAwardGot : function (roomId, uid, taskType, taskId) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].isTaskAwardGot(uid, taskType, taskId);
        }

        return false;
    },

    getTaskGetRecord : function (roomId, uid) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getTaskGetRecord(uid);
        }

        return [];
    },

    getCityCampPlayerList : function (roomId, cityId, camp) {
        if (this.rooms[roomId]) {
            return this.rooms[roomId].getCityCampPlayerList(cityId, camp);
        }

        return [];
    },

    updateKillRank : function (roomId, uid, sort) {
        if (this.rooms[roomId]) {
            this.rooms[roomId].updateKillRank(uid, sort);
        }
    },

    // 是否可以开始战斗了
    isFightTime : function () {
        var curTime = common.getTime();
        if (curTime >= this.fightBeginTime && curTime < this.endTime) {
            return true;
        }

        return false;
    },

    insertRoomServer : function (roomId, serverId) {
        if (this.rooms[roomId]) {
            var camp = this.getIndexByServerId(serverId);
            this.rooms[roomId].addServer(camp, serverId);
        }
    },

    isServerMerged : function (sid) {
        if (!this.webServerList[sid])
            return false;

        if (this.webServerList[sid].merged != 0 && this.webServerList[sid].merged != sid)
            return true;

        return false;
    },
};

// 注册服务器
exports.register_server = function (req, res, resp) {
    do {
        var serverId = req.args.sid;
        if ((!serverId || isNaN(serverId)) && serverId != 0) {
            resp.code = 1; resp.desc = 'server id needed'; break;
        }

        gCountryWar.servers[serverId] = [req.args.ip, req.args.port, req.args.openTime];
        gCountryWar.markDirty(util.format('servers.%d', serverId));

        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var room = gCountryWar.getRoom(roomId);
        if (!room) {
            gCountryWar.insertServerIntoWaitQueue(roomId, serverId);
            DEBUG('register server id = ' + serverId + ', ip = ' + req.args.ip + ', port = ' + req.args.port);
        } else {
            gCountryWar.insertRoomServer(roomId, serverId);
        }
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取国战数据
exports.get = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var user = req.args.user;

        if (user.info.country == 0) {
            resp.code = 1; resp.desc = 'player country is 0'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        if (!roomId || isNaN(roomId)) {
            resp.code = 1; resp.desc = 'roomId not found'; break;
        }

        var room = gCountryWar.getRoom(roomId);
        if (!room) {
            // 房间还没开
            resp.code = ErrorCode.ERROR_ROOM_NOT_OPEN; resp.desc = 'roomId not open'; break;
        }

        if (!room.isRoomOpen()) {
            // 房间还没开
            resp.code = ErrorCode.ERROR_ROOM_NOT_OPEN; resp.desc = 'roomId is not open'; break;
        }

        var camp = gCountryWar.getIndexByServerId(serverId);

        // 用户更新数据
        var awards = gUserInfo.update(uid, user, roomId, camp, serverId);
        gCountryWar.onPlayerEnterRoom(uid, roomId, camp, serverId);
        gCountryWar.refreshPlayerCount(roomId);

        resp.data.countrywar    = gUserInfo.getPlayerCountryWarInfo(uid);
        resp.data.rank          = gCountryWar.getPlayerDayRank(roomId, uid);
        resp.data.cities        = gCountryWar.getCitiesForClient(roomId);
        resp.data.countryCities = gCountryWar.getCountryOwnCityCount(roomId);
        resp.data.callOfDuty    = gCountryWar.getCallOfDuty(roomId, camp);
        resp.data.replyedCalls  = gCountryWar.getReplyCalls(roomId, uid);    // 响应过的集结令列表
        resp.data.move          = gCountryWar.getMoveInfo(roomId, uid);
        resp.data.chatLog       = gCountryWar.getChatLog(roomId);
        resp.data.shoutLog      = gCountryWar.getShoutLog(roomId);
        resp.data.count         = gUserInfo.getBroadcastCallCount(uid);
        resp.data.awards        = awards;

        var tips = {};
        if (gUserInfo.hasCountryTaskAwards(uid, serverId))
            tips['campTaskAwards'] = 1;

        if (gUserInfo.hasPersonalTaskAwards(uid))
            tips['personalTaskAwards'] = 1;
        resp.data.tips = tips;

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取国战开启时间
exports.get_open_time = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var serverList = gConfCountryRoom[roomId];

        var roomServers = {};
        if (serverList) {
            for (var i = 1; i <= 3; i++) {
                roomServers[i] = [];

                for (var j = 0; j < serverList['camp' + i].length; j++) {
                    var serverObj = {};
                    serverObj.serverId = serverList['camp' + i][j];
                    serverObj.status = gCountryWar.getServerState(serverObj.serverId);

                    if (gCountryWar.getServerInfo(serverObj.serverId) && !gCountryWar.isServerMerged(serverObj.serverId)) {
                        roomServers[i].push(serverObj);
                    }
                }
            }
        }

        resp.data.roomServers = roomServers;
        resp.data.beginTime = gCountryWar.getBeingTime();
        resp.data.endTime = gCountryWar.getEndTime();
        resp.data.curTime = common.getTime();

        var tips = {};
        if (gUserInfo.hasCountryTaskAwards(uid, serverId))
            tips['campTaskAwards'] = 1;

        if (gUserInfo.hasPersonalTaskAwards(uid))
            tips['personalTaskAwards'] = 1;

        resp.data.tips = tips;

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取指定城池信息
exports.get_city_info = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        var targetCity = +req.args.target_city;
        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        resp.data.cityInfo = gCountryWar.getCityInfo(roomId, targetCity, true);

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 离开国战
exports.leave = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.onPlayerLeave(uid);

        // 取消匹配
        gCountryWar.cancelMatch(roomId, uid);
        gCountryWar.refreshPlayerCount(roomId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 离线
exports.offline = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.onPlayerLeave(uid);

        // 取消匹配
        gCountryWar.cancelMatch(roomId, uid);
        gCountryWar.refreshPlayerCount(roomId);

        DEBUG('player ' + uid + ' offline');
    } while (false);

    onReqHandled(res, resp, 1);
};

// 前往指定城池
exports.move_to_city = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCity= req.args.target_city;   // 目标城池id
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        // 是否已死亡
        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        // 检查目标城池是否可达
        if (!gUserInfo.canReachTargetCity(uid, targetCity)) {
            resp.code = ErrorCode.ERROR_CAN_NOT_REACH; resp.desc = 'can not reach target city'; break;
        }

        // 检测能否进入
        if (!gUserInfo.canEnterTargetCity(uid, targetCity)) {
            resp.code = ErrorCode.ERROR_CAN_NOT_ENTER; resp.desc = 'can not enter target city'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var targetCityInfo = gCountryWar.getCityInfo(roomId, targetCity);
        if (targetCityInfo && targetCityInfo.hold_camp != userInfo.countryWar.camp && !gCountryWar.isFightTime()){
            // 准备阶段不能进入地方城池
            resp.code = ErrorCode.ERROR_READY_TIME; resp.desc = 'ready time can not enter enemy city'; break;
        }

        var curCity = gUserInfo.getPlayerLocationCity(uid);

        // 计算达到目标城池的时间
        var path = gUserInfo.getShortestPath(uid, +curCity, targetCity);
        if (path.length == 0) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_PATH; resp.desc = 'path empty'; break;
        }

        var curTime = common.getTime();
        var reachTime = curTime + gUserInfo.getPathTime(path);

        // 是否在国战结束之前能到达
        if (reachTime > gCountryWar.getEndTime()) {
            resp.code = ErrorCode.ERROR_MOVE_TIME_NOT_ENOUGH; resp.desc = 'left time not enough'; break;
        }

        // 检查当前城池是否处于交战状态，处于交战状态的城池不能直接离开
        var cityInfo = gCountryWar.getCityInfo(roomId, curCity);
        if (cityInfo.fight_state) {
            resp.code = ErrorCode.ERROR_CITY_IN_FIGHT; resp.desc = 'cur city in fight'; break;
        }

        gCountryWar.addPlayerMove(roomId, uid, targetCity, curTime, reachTime, path);

        var nextPathCity = path[1];
        gCountryWar.syncPlayerMove(roomId, uid, curCity, nextPathCity);

        resp.data.path = path;
        resp.data.time = reachTime;
        resp.data.startTime = curTime;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 突进（当前城池中防守人数是进攻人数的两倍以上时可以选择突进）
exports.special_move = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCity = +req.args.target_city;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        if (!gUserInfo.canEnterTargetCity(uid, targetCity)) {
            resp.code = ErrorCode.ERROR_CAN_NOT_ENTER; resp.desc = 'can not enter target city'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        // 检查是否满足突进条件
        var cities = gCountryWar.getCities(roomId);
        if (!cities) {
            resp.code = resp.code = ErrorCode.ERROR_IN_PROTECT_TIME; resp.desc = 'cities not found'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        var userCity = userInfo.countryWar.city;
        var cityInfo = cities[userCity];

        var defenseCount = 0;
        var attackCount = 0;
        for (var i = 1; i <= 3; i++) {
            if (i == cityInfo.hold_camp) {
                defenseCount += cityInfo.players[i].length;
            } else {
                attackCount += cityInfo.players[i].length;
            }
        }
        if (attackCount < defenseCount * 2) {
            resp.code = ErrorCode.ERROR_CAN_NOT_SPECIAL_MOVE; resp.desc = 'attackCount not enough'; break;
        }

        // 检查突进目标城池与当前城池是否相邻
        var isNeighbor = false;
        var cityConf = gConfCountryWarCity[userCity];
        var neighborCities = cityConf.adjoin;
        for (var i = 0; i < neighborCities.length; i++) {
            if (targetCity == neighborCities[i]) {
                isNeighbor = true;
                break;
            }
        }

        if (!isNeighbor) {
            resp.code = ErrorCode.ERROR_TARGET_CITY_IS_NOT_NEIGHBOR; resp.desc = 'not neighbor city'; break;
        }

        var path = [userCity, targetCity];
        var curTime = common.getTime();
        var reachTime = curTime + parseInt(gConfCountryWarBase.pathTime.value);

        // 离开城池
        //gCountryWar.onPlayerLeaveCity(roomId, uid, userCity);
        resp.data.path = path;
        resp.data.time = reachTime;
        resp.data.startTime = curTime;

        gCountryWar.addPlayerMove(roomId, uid, targetCity, curTime, reachTime, path);
        gCountryWar.syncPlayerMove(roomId, uid, userCity, targetCity);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 到达
exports.reach_city = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var target_city = +req.args.target_city;
        if (isNaN(target_city)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = 1; resp.desc = 'user not exist'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var moveInfo = gCountryWar.getMoveInfo(roomId, uid);
        if (!gUserInfo.canEnterTargetCity(uid, target_city)) {
            if (moveInfo && moveInfo.path.length >= 2) {
                var preCity = moveInfo.path[0];
                for (var i = 1; i < moveInfo.path.length; i++) {
                    if (moveInfo.path[i] == target_city) {
                        break;
                    } else {
                        preCity = moveInfo.path[i];
                    }
                }
                var path = [target_city, preCity];
                var curTime = common.getTime();
                var reachTime = curTime + parseInt(gConfCountryWarBase.pathTime.value);
                gUserInfo.setTargetCityAndTime(target_city, reachTime);
                gCountryWar.addPlayerMove(roomId, uid, preCity, curTime, reachTime, path);
                resp.data.path = path;
                resp.data.time = reachTime;
                resp.data.startTime = curTime;
                resp.code = ErrorCode.ERROR_CAN_NOT_ENTER;
                resp.desc = 'can not enter target city, return to last city';
                break;
            }
        }

        if (moveInfo) {
            // 检查是否到达目标点了
            var pathLength = moveInfo.path.length;
            var lastCity = moveInfo.path[pathLength - 1];
            if (target_city == lastCity) {
                // 到达终点了
            } else {
                // 还要继续走
                var nextCity = 0;
                for (var i = 1; i < moveInfo.path.length; i++) {
                    if (moveInfo.path[i] == target_city) {
                        nextCity = moveInfo.path[i + 1]
                        break;
                    }
                }

                gCountryWar.syncPlayerMove(roomId, uid, target_city, nextCity);
            }
        }

        gCountryWar.onReachCity(roomId, uid, target_city, resp);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 发布召集令
exports.broadcast_call_of_duty = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCity = +req.args.target_city;
        if (isNaN(targetCity)) {
            resp.code = ErrorCode.ERROR_CITY_NOT_EXIST; resp.desc = 'args target_city invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (!gCountryWar.isFightTime()){
            // 准备阶段不能发布号令
            resp.code = ErrorCode.ERROR_READY_TIME; resp.desc = 'ready time can not broadcast calls'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        // 检查玩家官职
        var needPosition = parseInt(gConfCountryWarBase.callNeedPosition.value);
        if (userInfo.info.position > needPosition) {
            resp.code = ErrorCode.ERROR_COUNTRY_POSITION_NOT_ENOUGH; resp.desc = 'position not enough'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var camp = gCountryWar.getIndexByServerId(serverId);

        // 检查目标城池内有没有己方玩家
        var cityInfo = gCountryWar.getCityInfo(roomId, targetCity, true);
        if (cityInfo.players[camp].length == 0) {
            resp.code = ErrorCode.ERROR_NO_SELF_SIDE_PLAYER; resp.desc = 'self side player count is 0'; break;
        }

        // 判断集结令数量是否达到上限
        var callOfDuty = gCountryWar.getCallOfDuty(roomId, camp);
        var curCallCount = Object.keys(callOfDuty).length;
        if (curCallCount >= parseInt(gConfCountryWarBase.callNumLimit.value)) {
            resp.code = ErrorCode.ERROR_CALL_COUNT_MAX; resp.desc = 'max count'; break;
        }

        // 检查目标城池是否已经有集结令
        if (callOfDuty[targetCity] && callOfDuty[targetCity].time + parseInt(gConfCountryWarBase.callKeepTime.value) > common.getTime()) {
            resp.code = ErrorCode.ERROR_TARGET_CITY_EXIST_CALL; resp.desc = 'exist one'; break;
        }

        gCountryWar.sendCall(serverId, roomId, uid, targetCity);
        resp.data.awards = [['user', 'country_score', parseInt(gConfCountryWarBase.callScoreAward.value)]];
        resp.data.count = gUserInfo.getBroadcastCallCount(uid);
        resp.data.callList = gCountryWar.getCallOfDuty(roomId, camp);

        gCountryWar.addEvent(roomId, targetCity, EventType.EVENT_BROADCAST_CALL, serverId, userInfo.info.un, camp, targetCity);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_broadcast_call_count = function (req, res, resp) {
    do {
        var uid = +req.uid;

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        resp.data.count = gUserInfo.getBroadcastCallCount(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 响应集结令
exports.respond_call_of_duty = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCity = +req.args.target_city;
        if (isNaN(targetCity)) {
            resp.code = ErrorCode.ERROR_CITY_NOT_EXIST; resp.desc = 'args target_city invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (!gCountryWar.isFightTime()){
            // 准备阶段不能发布号令
            resp.code = ErrorCode.ERROR_READY_TIME; resp.desc = 'ready time can not reply calls'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var oldCity = userInfo.countryWar.city;
        //var curCityInfo = gCountryWar.getCityInfo(roomId, oldCity)
        //if (curCityInfo.fight_state == 1) {
        //    resp.code = ErrorCode.ERROR_CITY_IS_IN_FIGHT; resp.desc = 'fight state'; break;
        //}

        var camp = gCountryWar.getIndexByServerId(serverId);

        // 集结令是否存在
        var calls = gCountryWar.getCallOfDuty(roomId, camp);
        if (!calls[targetCity]) {
            resp.code = ErrorCode.ERROR_CALL_NOT_EXIST; resp.desc = 'call not exist'; break;
        }

        // 检查是否已经失效
        if (calls[targetCity].time > common.getTime() + parseInt(gConfCountryWarBase.callKeepTime.value)) {
            resp.code = ErrorCode.ERROR_CALL_OUT_OF_TIME; resp.desc = 'call time out'; break;
        }

        // 检查是否已经响应过此集结令
        //if (calls[targetCity].replys.indexOf(uid) >= 0) {
        //    resp.code = ErrorCode.ERROR_ALREADY_REPLY_CALL; resp.desc = 'already reply this call'; break;
        //}

        gUserInfo.onReplyCallOfDuty(uid);
        calls[targetCity].replys.push(uid);

        gCountryWar.onPlayerEnterCity(roomId, uid, targetCity, oldCity, false, true);
        gCountryWar.removeMoveInfo(roomId, uid);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 随机匹配对手
exports.match_enemy = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCountry = req.args.target;
        if (isNaN(targetCountry)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (!gCountryWar.isFightTime()){
            // 准备阶段不能匹配敌人
            resp.code = ErrorCode.ERROR_READY_TIME; resp.desc = 'ready time can not match enemy'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        if (gUserInfo.isPlayerInCoolTime(uid)) {
            resp.code = ErrorCode.ERROR_IS_IN_COOL_TIME; resp.desc = 'in cool time'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var userCity = userInfo.countryWar.city;

        // 取消之前的匹配
        gCountryWar.cancelMatch(roomId, uid);

        var idlePlayers = [];

        var cityInfo = gCountryWar.getCityInfo(roomId, userCity);
        var targetCountryPlayerCount = cityInfo.players[targetCountry].length;
        for (var i = 0; i < targetCountryPlayerCount; i++) {
            var playerId = cityInfo.players[targetCountry][i].uid;
            if (!gCountryWar.isMatched(roomId, playerId)) {
                idlePlayers.push(playerId);
            }
        }

        var count = idlePlayers.length;
        if (count == 0) {
            if (targetCountryPlayerCount > 0) {
                LOG('not match but target country player not empty, city is ' + userCity);

                for (var i = 0; i < targetCountryPlayerCount; i++) {
                    var playerId = cityInfo.players[targetCountry][i].uid;
                    var isMatched = gCountryWar.isMatched(roomId, playerId);
                    LOG('uid = ' + playerId + ', isMatched = ' + isMatched);
                }
            }
            resp.code = ErrorCode.ERROR_NO_MATCH_PLAYER; resp.desc = 'no idle player'; break;
        }

        var index = common.randRange(0, count - 1);
        var enemy_uid = idlePlayers[index];

        var enemy = {};
        if (isDroid(enemy_uid)) {
            enemy = gCountryWar.getRobot(roomId, enemy_uid);
        } else {
            enemy = gUserInfo.getUserFightInfo(enemy_uid, true, true, userInfo.countryWar.city);
        }

        if (!enemy) {
            resp.code = ErrorCode.ERROR_NO_MATCH_PLAYER; resp.desc = 'match_enemy no enemy data'; break;
        }

        gCountryWar.insertMatch(roomId, uid, enemy_uid);

        var replay = {
            info: gUserInfo.getUserFightInfo(uid, false, false, userInfo.countryWar.city),
            enemy: enemy,
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        };

        resp.data = replay;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 单挑，匹配杀人数最高的
exports.solo_fight = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var targetCountry = req.args.target;
        if (isNaN(targetCountry)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        if (gUserInfo.isPlayerInCoolTime(uid)) {
            resp.code = ErrorCode.ERROR_IS_IN_COOL_TIME; resp.desc = 'in cool time'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var userCity = userInfo.countryWar.city;

        var idlePlayers = [];
        var cityInfo = gCountryWar.getCities(roomId)[userCity];

        for (var i = 0; i < cityInfo.players[targetCountry].length; i++) {
            var playerId = cityInfo.players[targetCountry][i];
            if (!gCountryWar.isMatched(roomId, playerId)) {
                idlePlayers.push(playerId);
            }
        }

        var count = idlePlayers.length;
        if (count == 0) {
            resp.code = ErrorCode.ERROR_NO_MATCH_PLAYER; resp.desc = 'no idle player'; break;
        }

        // 选择杀人数最高的
        var maxKillCount = -1;
        var index = -1;
        for (var i = 0; i < count; i++) {
            var enemyInfo = null;
            var killCount = 0;
            if (isDroid(idlePlayers[i])) {
                enemyInfo = gCountryWar.getRobot(roomId, idlePlayers[i]);
                killCount = 0;
            } else {
                enemyInfo = gUserInfo.getUser(idlePlayers[i]);
                killCount = enemyInfo.countryWar.killCount;
            }

            if (killCount > maxKillCount) {
                maxKillCount = killCount;
                index = i;
            }
        }

        var enemy = {};
        var enemy_uid = idlePlayers[index];
        if (isDroid(enemy_uid)) {
            enemy = gCountryWar.getRobot(roomId, enemy_uid);
        } else {
            enemy = gUserInfo.getUserFightInfo(enemy_uid, true, true);
        }

        if (!enemy) {
            resp.code = ErrorCode.ERROR_NO_MATCH_PLAYER; resp.desc = 'solo_fight no enemy data'; break;
        }

        var replay = {
            info: gUserInfo.getUserFightInfo(uid, false, false),
            enemy: enemy,
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        }

        gCountryWar.insertMatch(roomId, uid, enemy_uid);

        resp.data = replay;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 死亡回城
exports.death = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        var userCity = userInfo.countryWar.city;
        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var capitalCity = gUserInfo.getCapitalCityId(camp);
        gCountryWar.onPlayerEnterCity(roomId, uid, capitalCity, userCity);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 撤军回城
exports.back_to_city = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var userCity = userInfo.countryWar.city;

        var capitalCity = gUserInfo.getCapitalCityId(camp);
        gCountryWar.onPlayerEnterCity(roomId, uid, capitalCity, userCity);
        gCountryWar.onHandleUserAct(roomId, uid);

        resp.data.continuousKill = userInfo.countryWar.continuousKill;
        resp.data.highestKillCount = userInfo.countryWar.highestKillCount;
        resp.data.scoreSinceLastDeath = userInfo.countryWar.scoreSinceLastDeath;

        gUserInfo.clearPlayerContinuousKill(uid);
        gCountryWar.addEvent(roomId, userCity, EventType.EVENT_BACK_TO_CITY, serverId, userInfo.info.un, userInfo.countryWar.camp);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 快速复活
exports.fast_relive = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        if (userInfo.countryWar.deathTime == 0 ||
            (userInfo.countryWar.deathTime + parseInt(gConfCountryWarBase.reliveTime.value) < common.getTime())) {
            // 没有死，或者已经自动复活了
            resp.code = 1; resp.desc = 'not dead'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.fastRelive(uid);
        resp.data.deathTime = 0;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 战斗
exports.fight = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var serverId = req.args.serverId;
        var enemy_uid = +req.args.enemy_uid;
        var star = req.args.star;
        if (isNaN(enemy_uid) || isNaN(star) || isNaN(serverId)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not found'; break;
        }

        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var enemyInfo = null;
        if (isDroid(enemy_uid)) {
            enemyInfo = gCountryWar.getRobot(roomId, enemy_uid);
        } else {
            enemyInfo = gUserInfo.getUser(enemy_uid);
        }

        if (!enemyInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'enemy user not found'; break;
        }

        if (gUserInfo.isPlayerDead(uid)) {
            resp.code = ErrorCode.ERROR_YOU_ARE_DEAD; resp.desc = 'you are dead'; break;
        }

        var city_id = +userInfo.countryWar.city;
        var cityInfo = gCountryWar.getCityInfo(roomId, city_id);

        var deadInfo = null;
        var winnerUser = null;
        var win = 0;
        var winner_uid = enemy_uid;
        var deadUid = 0;
        if (star > 0) {
            win = 1;
            winner_uid = uid;
            deadUid = enemy_uid;
            winnerUser = userInfo;
            deadInfo = enemyInfo;
        } else {
            deadUid = uid;
            winnerUser = enemyInfo;
            deadInfo = userInfo;
        }

        // 敌方信息
        var enemyName = '';
        var enemyCamp = 0;
        var enemyServerId = 0;
        if (isDroid(enemy_uid)) {
            enemyName = enemyInfo.un;
            enemyCamp = enemyInfo.country;
            enemyServerId = 0;
        } else {
            enemyName = enemyInfo.info.un;
            enemyCamp = enemyInfo.countryWar.camp;
            enemyServerId = enemyInfo.countryWar.serverId;
        }

        // 胜利者信息
        var winnerName = '';
        var winnerCamp = 0;
        var winnerServerId = 0;
        if (isDroid(winner_uid)) {
            winnerName = winnerUser.un;
            winnerCamp = winnerUser.country;
        } else {
            winnerName = winnerUser.info.un;
            winnerCamp = winnerUser.countryWar.camp;
            winnerServerId = winnerUser.countryWar.serverId;
        }

        // 失败方信息
        var deadName = '';
        var deadCamp = 0;
        var deadServerId = 0;
        var deadScoreSinceLastDeath = 0;
        var deadContinuousKill = 0;
        var deadHighestKillCount = 0
        if (isDroid(deadUid)) {
            deadName = deadInfo.un;
            deadCamp = deadInfo.country;
        } else {
            deadName = deadInfo.info.un;
            deadCamp = deadInfo.countryWar.camp;
            deadServerId = deadInfo.countryWar.serverId;
            deadScoreSinceLastDeath = deadInfo.countryWar.scoreSinceLastDeath;
            deadContinuousKill = deadInfo.countryWar.continuousKill;
            deadHighestKillCount = deadInfo.countryWar.highestKillCount;
        }

        var winnerPos = req.args.winner_pos;
        if (winnerUser && !isDroid(winner_uid)) {
            // 更新英雄血量和小兵信息
            gUserInfo.updateHeroHpAndSoldierNum(winner_uid, winnerPos);
        }

        gCountryWar.addAttackPlayer(roomId, city_id, uid);

        var curTime = common.getTime();
        var coolTime = curTime + parseInt(gConfCountryWarBase.battleDiffTime.value);

        var Score = gUserInfo.onKillPlayer(winner_uid, deadUid, deadCamp);
        deadScoreSinceLastDeath += Score[1];

        var deadBattleInfo = {};    // 死亡一方的出征信息
        deadBattleInfo.continuousKill = deadContinuousKill;
        deadBattleInfo.highestKillCount = deadHighestKillCount;
        deadBattleInfo.scoreSinceLastDeath = deadScoreSinceLastDeath;
        deadBattleInfo.cityId = city_id;
        deadBattleInfo.deathTime = curTime;
        deadBattleInfo.killer = {};
        deadBattleInfo.killer.uid = winner_uid;
        deadBattleInfo.killer.un = winnerName;
        deadBattleInfo.killer.country = winnerCamp;
        deadBattleInfo.killer.server = winnerServerId;

        var eventId = common.randRange(1, 3);

        if (!isDroid(enemy_uid))
            gCountryWar.addEvent(roomId, city_id, eventId, winnerServerId, winnerName, winnerCamp, deadServerId, deadName, deadCamp);

        gCountryWar.onPlayerDeath(roomId, deadUid, winner_uid, city_id);
        gUserInfo.clearPlayerContinuousScore(deadUid);

        resp.data = {};
        resp.data.deadBattleInfo = deadBattleInfo;
        resp.data.coolTime = coolTime;

        var enemyScore = 0;
        if (win){
            resp.data.score = Score[0];
            enemyScore = Score[1];
        }
        else{
            resp.data.score = Score[1];
            enemyScore = Score[0];
        }

        gUserInfo.setPlayerCoolTime(uid, coolTime);
        //gUserInfo.setPlayerCoolTime(enemy_uid, coolTime);

        // 移除对阵记录
        var fightTable = gCountryWar.getFightTable(roomId);
        delete fightTable[uid];
        delete fightTable[enemy_uid];

        // 通知目标玩家（机器人就不通知了）
        if (!isDroid(enemy_uid)) {
            var worldReq = {
                mod : 'countrywar',
                act : 'fight',
                uid : enemy_uid,
                args : {
                    winner_uid : winner_uid,
                    winner_pos : winnerPos,
                    deadBattleInfo : deadBattleInfo,
                    coolTime : coolTime,
                    score : enemyScore,
                },
            };

            var WorldResp = {};
            resp.code = 0;
            gCountryWar.serverBroadcast(roomId, enemyServerId, worldReq, WorldResp, function() {
                if (WorldResp.code == 0) {
                    DEBUG('fight request a client over fight');
                } else {
                    DEBUG('fight request a client error, desc = ' + WorldResp.desc);
                }
            });
        }

        gCountryWar.onPlayerFight(roomId, city_id, uid, enemy_uid, userInfo.info.un, enemyName
            , userInfo.countryWar.camp, enemyCamp, userInfo.countryWar.serverId, enemyServerId, winner_uid);

        // 记录战报
        // gCountryWar.addReport(uid, enemy_uid, req.args.replay, win);

        gCountryWar.cancelMatch(roomId, uid);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 领取任务奖励
exports.get_personal_task_award = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var taskId = +req.args.taskId;
        if (isNaN(taskId)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not exist'; break;
        }

        if (gUserInfo.isPersonalTaskAwardGot(uid, taskId)) {
            resp.code = ErrorCode.ERROR_HAS_GOT_TASK_AWARD; resp.desc = 'has got'; break;
        }

        if (!gUserInfo.isTaskFinish(uid, taskId)) {
            resp.code = ErrorCode.ERROR_TASK_NOT_FINISH; resp.desc = 'task not finish'; break;
        }

        var taskData = gConfCountryWarTaskPersonal[taskId];
        if (!taskData) {
            resp.code = ErrorCode.ERROR_TASK_CONFIG_ERROR; resp.desc = 'task data not found'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.setPersonalTaskAwardGot(uid, taskId);
        resp.data.awards = taskData.award;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 领取国家任务奖励
exports.get_country_task_award = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var task_type = +req.args.taskType;
        var task_id = +req.args.taskId;
        if (isNaN(task_type) || isNaN(task_id)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var userInfo = gUserInfo.getUser(uid);
        if (userInfo) {
            if (gUserInfo.isCountryTaskAwardGot(uid, task_type, task_id)) {
                resp.code = ErrorCode.ERROR_HAS_GOT_TASK_AWARD; resp.desc = 'has got'; break;
            }
        } else {
            if (gCountryWar.isTaskAwardGot(roomId, uid, task_type, task_id)) {
                resp.code = ErrorCode.ERROR_HAS_GOT_TASK_AWARD; resp.desc = 'has got'; break;
            }
        }

        if (!gCountryWar.isCountryTaskFinish(roomId, camp, task_type, task_id)) {
            resp.code = ErrorCode.ERROR_TASK_NOT_FINISH; resp.desc = 'task not finish'; break;
        }

        var taskData = gConfCountryWarTask[task_type][task_id];
        if (!taskData) {
            resp.code = ErrorCode.ERROR_TASK_CONFIG_ERROR; resp.desc = 'task data not found'; break;
        }

        if (userInfo) {
            gUserInfo.setCountryTaskAwardGot(uid, task_type, task_id);
        } else {
            gCountryWar.markTaskAwardGot(roomId, uid, task_type, task_id);
        }

        resp.data.awards = taskData.award;

        gCountryWar.onHandleUserAct(roomId, uid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取国家任务列表
exports.get_country_task = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        resp.data.tasks = gCountryWar.getCountryTask(roomId, camp);
        resp.data.record = gCountryWar.getTaskGetRecord(roomId, uid);

        if (userInfo)
            resp.data.selfInfo = userInfo.countryWar;
        else
            resp.data.selfInfo = {};

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取排行榜信息
exports.get_rank_list = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var dayRank = gCountryWar.getDayRankList(roomId);
        var weekRank = gCountryWar.getWeekRankList(roomId);

        var dayRankPlayerList = [];
        // 取前100个角色信息
        if (dayRank) {
            for (var i = 0; i < dayRank.length && i < 100; i++) {
                var user = gUserInfo.getUser(dayRank[i]);
                if (user) {
                    var userObj = {};
                    userObj.uid = user._id;
                    userObj.un = user.info.un;
                    userObj.headpic = user.info.headpic;
                    userObj.headframe = user.info.headframe;
                    userObj.level = user.status.level;
                    userObj.vip = user.status.vip;
                    userObj.fight_force = gUserInfo.getUserFightForce(dayRank[i]);
                    userObj.kill_count = gUserInfo.getKillCount(dayRank[i]);
                    userObj.main_role = user.pos[1].hid;
                    userObj.score = user.countryWar.score;
                    userObj.weekScore = user.countryWar.weekScore
                    userObj.server = common.getServerId(userObj.uid);
                    dayRankPlayerList.push(userObj);
                } else {
                    LOG('user is null when get day rank list, uid = ' + dayRank[i]);
                }
            }
        }

        var weekRankPlayerList = [];
        if (weekRank) {
            for (var i = 0; i < weekRank.length && i < 100; i++) {
                var user = gUserInfo.getUser(weekRank[i]);
                if (user) {
                    var userObj = {};
                    userObj.uid = user._id;
                    userObj.un = user.info.un;
                    userObj.headpic = user.info.headpic;
                    userObj.headframe = user.info.headframe;
                    userObj.level = user.status.level;
                    userObj.vip = user.status.vip;
                    userObj.fight_force = gUserInfo.getUserFightForce(weekRank[i]);
                    userObj.kill_count = gUserInfo.getKillCount(weekRank[i]);
                    userObj.main_role = user.pos[1].hid;
                    userObj.score = user.countryWar.score;
                    userObj.weekScore = user.countryWar.weekScore
                    userObj.server = common.getServerId(userObj.uid);
                    weekRankPlayerList.push(userObj);
                } else {
                    LOG('user is null when get week rank list, uid = ' + weekRank[i]);
                }
            }
        }

        resp.data.dayRankList = dayRankPlayerList;  // 日排名玩家列表
        resp.data.weekRankList = weekRankPlayerList;    // 周排名玩家列表
        resp.data.campRankList = gCountryWar.getWeekRank(roomId);   // 阵营周排名
        resp.data.camp = camp;

        if (userInfo) {
            resp.data.selfInfo = userInfo.countryWar.taskInfo;
            resp.data.score = userInfo.countryWar.score;
            resp.data.weekScore = userInfo.countryWar.weekScore;

            resp.data.dayRank = gCountryWar.getPlayerDayRank(roomId, uid);  // 日排名中自己的排名
            resp.data.weekRank = gCountryWar.getPlayerWeekRank(roomId, uid);    // 周排名中自己的排名
        } else {
            resp.data.selfInfo = {};
            resp.data.score = 0;
            resp.data.weekScore = 0;
            resp.data.dayRank = 0;  // 日排名中自己的排名
            resp.data.weekRank = 0;    // 周排名中自己的排名
        }

        gCountryWar.onHandleUserAct(roomId, uid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取国家排行榜信息
exports.get_country_rank_list = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        resp.data.rankList = gCountryWar.getWeekRank(roomId);
        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获得集结令列表
/*
 callList = {
 cityid : {
 caller : 0,         // 发布者id
 time : 0,           // 集结令发布时间
 attackCountry : 0,  // 进攻国家
 attackCount : 0,    // 进攻方数量
 defenseCountry : 0, // 防守国家
 defenseCount : 0,   // 防守方数量
 }
 }
 */
exports.get_call_list = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'can not find user'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var curTime = common.getTime();
        var cities = gCountryWar.getCities(roomId);
        var callList = gCountryWar.getCallOfDuty(roomId, camp);
        var retCallList = {};
        for (var cityId in callList) {
            if (curTime >= callList[cityId].time + parseInt(gConfCountryWarBase.callKeepTime.value)) {
                continue;
            }

            var callInfo = {};
            callInfo.caller = callList[cityId].caller;
            callInfo.serverId = callList[cityId].serverId;

            var callerInfo = gUserInfo.getUser(callInfo.caller);
            if (callerInfo) {
                callInfo.callerName = callerInfo.info.un;
            }

            callInfo.time = callList[cityId].time;

            var cityInfo = cities[cityId];
            callInfo.playerCount = {};
            for (var i = 1; i <= 3; i++) {
                callInfo.playerCount[i] = cityInfo.players[i].length;
            }

            callInfo.npcCount = 0;
            for (var i = 0; i < cityInfo.players[cityInfo.hold_camp].length; i++) {
                if (isDroid(cityInfo.players[cityInfo.hold_camp][i])) {
                    callInfo.npcCount += 1;
                }
            }
            callInfo.defenseCountry = cityInfo.hold_camp;
            retCallList[cityId] = callInfo;
        }

        resp.data.callList = retCallList;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取个人积分，国家积分
exports.get_score = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        gCountryWar.onHandleUserAct(roomId, uid);

        // 个人积分
        resp.data.personal = {};
        resp.data.personal.day = userInfo.countryWar.score;
        resp.data.personal.week = userInfo.countryWar.weekScore;

        // 每日
        resp.data.day = {};
        resp.data.day.kill = userInfo.countryWar.dayKillCount;
        resp.data.day.dead = userInfo.countryWar.deathCount;

        // 每周
        resp.data.week = {};
        resp.data.week.kill = userInfo.countryWar.weekKillCount;
        resp.data.week.dead = userInfo.countryWar.weekDeathCount;

        // 国家积分
        resp.data.country = {};
        for (var i = 1; i <= 3; i++) {
            resp.data.country[i] = {};
            resp.data.country[i].score = gCountryWar.getCountryScore(roomId, i);    // 积分
            resp.data.country[i].count = gCountryWar.getCampPlayerCount(roomId, i); // 在线人数
        }

        // 本势力的排名t
        resp.data.campRank = gCountryWar.getCampWeekRank(roomId, camp);
        resp.data.weekRank = gCountryWar.getPlayerWeekRank(roomId, uid);
        resp.data.dayRank = gCountryWar.getPlayerDayRank(roomId, uid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取城池战斗信息
exports.get_city_battle_info = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var targetCity = req.args.target_city;
        if (isNaN(targetCity)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var cityInfo = gCountryWar.getCityInfo(roomId, targetCity, true);
        if (!cityInfo) {
            resp.code = ErrorCode.ERROR_CITY_NOT_EXIST; resp.desc = 'can not find city info'; break;
        }

        gCountryWar.onHandleUserAct(roomId, uid);

        resp.data.players = {};
        for (var i = 1; i <= 3; i++) {
            resp.data.players[i] = [];
            for (var j = 0; j < cityInfo.players[i].length; j++) {
                var playerId = cityInfo.players[i][j].uid;
                var playerInfo = gUserInfo.getUser(playerId);
                if (!playerInfo)
                {
                    playerInfo = gCountryWar.getRobot(roomId, playerId);
                    if (!playerInfo)
                        continue;
                }

                // 获取战力最高的英雄id
                var maxFightForce = 0;
                var maxFightForceHid = 0;
                for (var p in playerInfo.pos) {
                    if (playerInfo.pos[p].fight_force > maxFightForce) {
                        maxFightForce = playerInfo.pos[p].fight_force;
                        maxFightForceHid = playerInfo.pos[p].hid;
                    }
                }
                var playerObj = {};
                playerObj.uid = playerId;
                playerObj.hid = maxFightForceHid;

                if (isDroid(playerId)) {
                    playerObj.un = playerInfo.un;
                    playerObj.fight_force = playerInfo.fight_force;
                } else {
                    playerObj.un = playerInfo.info.un;
                    playerObj.fight_force = gUserInfo.getUserFightForce(playerId);
                }
                resp.data.players[i].push(playerObj);
            }
        }

        resp.data.countrywar = userInfo.countryWar;
        resp.data.replyedCalls = gCountryWar.getReplyCalls(roomId, uid);    // 响应过的集结令列表
    } while (false);

    onReqHandled(res, resp, 1);
};

// 设置防守阵型
exports.set_team = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var team = req.args.team;
        var skills = req.args.skills;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.setTeam(uid, team, skills);
        gCountryWar.onHandleUserAct(roomId, uid);

    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取阵型
exports.get_team = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        resp.data.team = userInfo.countryWar.def_info.team;
        resp.data.skills = userInfo.countryWar.def_info.skills;

        gCountryWar.onHandleUserAct(roomId, uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 增加积分
exports.add_score = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        var score = req.args.score;
        gUserInfo.addScore(uid, score);

        if (score > 0)
            gCountryWar.updateKillRank(roomId, uid, true);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 聊天
exports.chat = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var content = req.args.content;
        if (content == null) {
            resp.code = 1; resp.desc = 'no content'; break;
        }

        if (content && content.length > gConfGlobal.chatContentMaxLength) {
            resp.code = 1; resp.desc = 'content too long'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var chatInfo = {};
        chatInfo.user = {
            uid : uid,
            un : userInfo.info.un,
            headpic : userInfo.info.headpic,
            headframe : userInfo.info.headframe,
            vip : userInfo.status.vip,
            level : userInfo.status.level,
            camp : camp,
            country : userInfo.info.country,
            position : userInfo.info.position,
            serverId : userInfo.countryWar.serverId,
        };

        chatInfo.content = content;
        chatInfo.voice_url = req.args.voice_url;
        chatInfo.voice_time = req.args.voice_time;
        chatInfo.time = common.getTime();

        gCountryWar.chat(roomId, chatInfo, camp);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.shout = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var content = req.args.content;
        if (content == null) {
            resp.code = 1; resp.desc = 'no content'; break;
        }

        if (content && content.length > gConfGlobal.chatContentMaxLength) {
            resp.code = 1; resp.desc = 'content too long'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        var camp = gCountryWar.getIndexByServerId(serverId);

        var chatInfo = {};
        chatInfo.user = {
            uid : uid,
            un : userInfo.info.un,
            headpic : userInfo.info.headpic,
            headframe : userInfo.info.headframe,
            vip : userInfo.status.vip,
            level : userInfo.status.level,
            camp : camp,
            country : userInfo.info.country,
            position : userInfo.info.position,
            serverId : userInfo.countryWar.serverId,
        };

        chatInfo.content = content;
        chatInfo.voice_url = req.args.voice_url;
        chatInfo.voice_time = req.args.voice_time;
        chatInfo.time = common.getTime();

        gCountryWar.chat(roomId, chatInfo, camp, true);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取聊天记录
exports.get_chat_log = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        resp.data.chatLog = gCountryWar.getChatLog(roomId);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_shout_log = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);
        resp.data.chatLog = gCountryWar.getShoutLog(roomId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 移除战斗冷却
exports.clear_fight_cool_time = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        gUserInfo.setPlayerCoolTime(uid, 0);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取事件列表
exports.get_events = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var cityId = req.args.city_id;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        resp.data.events = gCountryWar.getEvents(roomId, cityId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 获取指定城池指定阵营的玩家列表
exports.get_city_camp_players = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var city = req.args.city_id;
        var camp = req.args.camp;
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = ErrorCode.ERROR_CAN_NOT_FIND_USER; resp.desc = 'user not fount!'; break;
        }

        var serverId = req.args.serverId;
        var roomId = gCountryWar.getRoomIdByServerId(serverId);

        resp.data.players = gCountryWar.getCityCampPlayerList(roomId, city, camp);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.CountryWar = CountryWar