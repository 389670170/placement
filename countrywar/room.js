var EventType = require('./error.js').EventType;

function Room() {
    // 服战房间id
    this.roomId = 0;
    this.isOpen = false;

    // 房间里的服务器列表
    this.serverList = {
        '1' : [],
        '2' : [],
        '3' : [],
    };

    // 城池占领情况
    this.cities = {
        /*
         '1' : { // 城池id
            'hold_camp' : 1,    // 占领势力
            'hold_time' : 0,    // 占领时间
            'players' : {   // 玩家列表
                '1' : [],
                '2' : [],
                '3' : [],
            },
            'fight_state' : 0,  // 战斗状态
            'robots' : [],  // 机器人
         },
         */
    };

    // 玩家击杀排行榜
    this.personalDayRank = [];
    this.personalWeekRank = [];

    // 服务器排名
    this.campWeekRank = [];

    // 每个服的动态统计数据
    this.serverStatics = {
        /*
         1 : {  //camp
            holdCityCount : 0,                  // 当前占领的城池数
            playerCount : 0,                    // 本服参战人数
            onlineCount : 0,                    // 在线人数
            conqueredCount : 0,                 // 本次服战攻占数量
            conqueredCountWithinDuration: 0,    // 服战开启指定时间段内占领的城池数
            score : {
                day : 0,    // 每日积分
                week : 0,   //　周积分
            }
         },
         */
    };

    // 集结令发布数据
    this.callOfDuty = {
        /*
         '1' {           // 城池id
            caller : 0,     // 集结令发布者
            time : 0,       // 集结令发布时间
            replys : [],    // 响应的玩家id列表
         }
         */
    };

    // 记录每个城池参与过进攻战斗的玩家
    this.attackCityPlayers = {
        /*
         '1' : [],
         */
    };

    // 脏数据
    this.dirty = {};

    // 国家任务
    this.tasks = {
        /*
         '1' : {
            task_type : {
                task_id : 1,
                finish : 0,
                curVal : 0, // 当前任务变量
            },
         }
         */
    };

    // 玩家平均等级
    this.averageLevel = 0;

    // 机器人
    this.ai = 1;
    this.robots = {};

    // 事件列表
    this.events = {};

    // 临时的阵营奖励领取记录
    this.taskAwardGetRecord = {};

    // =================================
    // 以下为内存数据

    // 聊天记录
    this.chatLog = [];
    this.shoutLog = [];

    // 各个玩家的移动队列
    this.moveQueue = {
        /*
         uid : {
         targetCity : 0,
         startTime : 0,
         reachTime : 0,
         path : [],
         }
         */
    };

    // 移动同步
    this.moveSync = {};

    // 玩家匹配表
    this.matchTable = {
        /*
         uid : target_uid,
         */
    };

    // 玩家对阵表
    this.fightTable = {
        /*
         uid : enemy_uid,
         */
    };

    this.scoreCalcTime = 0;
    this.countryRankDirty = true;   // 是否需要刷新阵营排名
}

Room.prototype = {
    // 初始化
    init : function(item) {
        if (item) {
            this.roomId = item.roomId;
            this.isOpen = item.isOpen;
            this.serverList = item.serverList;
            this.cities = item.cities;
            this.personalDayRank = item.personalDayRank;
            this.personalWeekRank = item.personalWeekRank;
            this.campWeekRank = item.campWeekRank;
            this.serverStatics = item.serverStatics;
            this.callOfDuty = item.callOfDuty;
            this.attackCityPlayers = item.attackCityPlayers;
            this.tasks = item.tasks;
            this.averageLevel = item.averageLevel;
            this.ai = item.ai;
            this.robots = item.robots;
            this.events = item.events;
            this.taskAwardGetRecord = item.taskAwardGetRecord;

            this._init();
        }
    },

    setRoomId : function (roomId) {
        this.roomId = roomId;

        this._init();
        this.markAllDirty();
    },

    setServers : function (servers) {
        if (!servers)
            return;

        for (var i = 1; i <= 3; i++) {
            if (!this.serverList[i]) {
                this.serverList[i] = [];
            }

            if (servers[i]) {
                for (var j = 0; j < servers[i].length; j++) {
                    if (this.serverList[i].indexOf(servers[i][j]) < 0) {
                        this.serverList[i].push(servers[i][j]);
                    }
                }
            }
        }

        this.markDirty('serverList');
    },

    addServer : function (camp, serverId) {
        if (!this.serverList[camp])
            return;

        for (var i = 0; i < this.serverList[camp].length; i++) {
            if (this.serverList[camp][i] == serverId) {
                return;
            }
        }

        this.serverList[camp].push(serverId);
        this.markDirty('serverList');
    },

    markAllDirty : function () {
        this.markDirty('roomId');
        this.markDirty('isOpen');
        this.markDirty('serverList');
        this.markDirty('cities');
        this.markDirty('personalDayRank');
        this.markDirty('personalWeekRank');
        this.markDirty('campWeekRank');
        this.markDirty('serverStatics');
        this.markDirty('callOfDuty');
        this.markDirty('attackCityPlayers');
        this.markDirty('tasks');
        this.markDirty('averageLevel');
        this.markDirty('ai');
        this.markDirty('robots');
        this.markDirty('events');
        this.markDirty('taskAwardGetRecord');
    },

    _init : function() {
        if (!this.averageLevel) {
            this.averageLevel = 0;
            this.markDirty('averageLevel');
        }

        if (!this.scoreCalcTime) {
            this.scoreCalcTime = common.getTime();
            this.markDirty('scoreCalcTime');
        }

        if (!this.isOpen) {
            this.isOpen = false;
            this.markDirty('isOpen');

            this.processOpenState();
        }

        if (!this.events) {
            this.events = {};
            this.markDirty('events');
        }

        if (!this.taskAwardGetRecord) {
            this.taskAwardGetRecord = {};
            this.markDirty('taskAwardGetRecord');
        }

        if (!this.serverStatics) {
            this.serverStatics = {};

            for (var i = 1; i <= 3; i++) {
                this.serverStatics[i].score = {};
                this.serverStatics[i].score.day = 0;
                this.serverStatics[i].score.week = 0;

                this.serverStatics[i].holdCityCount = 0;
                this.serverStatics[i].playerCount = 0;
                this.serverStatics[i].onlineCount = 0;
                this.serverStatics[i].conqueredCount = 0;
                this.serverStatics[i].conqueredCountWithinDuration = 0;
            }

            this.markDirty('serverStatics');
        } else {
            for (var i = 1; i <= 3; i++) {
                if (!this.serverStatics[i]) {
                    this.serverStatics[i] = {};
                    this.markDirty(util.format('serverStatics.%d', i));
                }

                if (!this.serverStatics[i].score) {
                    this.serverStatics[i].score = {};
                    this.serverStatics[i].score.day = 0;
                    this.serverStatics[i].score.week = 0;

                    this.markDirty(util.format('serverStatics.%d.score', i));
                }

                if (!this.serverStatics[i].holdCityCount) {
                    this.serverStatics[i].holdCityCount = 0;
                    this.markDirty(util.format('serverStatics.%d.holdCityCount', i));
                }

                if (!this.serverStatics[i].playerCount) {
                    this.serverStatics[i].playerCount = 0;
                    this.markDirty(util.format('serverStatics.%d.playerCount', i));
                }

                if (!this.serverStatics[i].onlineCount) {
                    this.serverStatics[i].onlineCount = 0;
                    this.markDirty(util.format('serverStatics.%d.onlineCount', i));
                }

                if (!this.serverStatics[i].conqueredCount) {
                    this.serverStatics[i].conqueredCount = 0;
                    this.markDirty(util.format('serverStatics.%d.conqueredCount', i));
                }

                if (!this.serverStatics[i].conqueredCountWithinDuration) {
                    this.serverStatics[i].conqueredCountWithinDuration = 0;
                    this.markDirty(util.format('serverStatics.%d.conqueredCountWithinDuration', i));
                }
            }
        }

        if (!(!this.cities || Object.keys(this.cities).length == 0)) {
        } else {
            this.cities = {};
            // 初始化城池数据
            var cityCount = Object.keys(gConfCountryWarCity).length;
            for (var i = 0; i < cityCount; i++) {
                var cityData = gConfCountryWarCity[i + 1];

                this.cities[cityData.id] = {};
                this.cities[cityData.id].hold_camp = cityData.group;
                this.cities[cityData.id].hold_time = common.getTime();
                this.cities[cityData.id].players = {};
                this.cities[cityData.id].robots = [];
                for (var j = 1; j <= 3; j++) {
                    this.cities[cityData.id].players[j] = [];
                }
                this.cities[cityData.id].fight_state = 0;
            }

            this.markDirty('cities');
        }

        // 清理城池占领数，避免重复计算
        for (var i = 1; i <= 3; i++) {
            this.serverStatics[i].holdCityCount = 0;
        }

        // 初始化国家所占城池数
        for (var cityId in this.cities) {
            var cityInfo = this.cities[cityId];
            var holdCamp = cityInfo.hold_camp;
            if (holdCamp < 1 || holdCamp > 3) {
                LOG('holdCountry error, city id is ' + cityId);
                continue;
            }

            if (!this.serverStatics[holdCamp]) {
                this.serverStatics[holdCamp] = {};
                this.serverStatics[holdCamp].holdCityCount = 0;
            }

            this.serverStatics[holdCamp].holdCityCount ++;
            this.markDirty('serverStatics');

            for (var i = 1; i <= 3; i++) {
                for (var j = 0; j < cityInfo.players[i].length; j++ ) {
                    var playerId = cityInfo.players[i][j];
                    if (!isDroid(playerId)) {
                        // 检测玩家身上记的城池id是否跟当前城池一致
                        var user = gUserInfo.getUser(playerId);
                        if (user) {
                            if (user.countryWar.city != parseInt(cityId)) {
                                cityInfo.players[i].splice(j, 1);
                                this.markDirty(util.format('cities.%d.players.%d', parseInt(cityId), i));
                                j--;
                            }
                        }
                    }
                }
            }

            this.refreshCityFightState(parseInt(cityId));
        }

        this.updateCountryRank();

        // 初始化集结令
        if (!this.callOfDuty || Object.keys(this.callOfDuty).length == 0) {
            this.callOfDuty = {};
            for (var i = 1; i <= 3; i++) {
                this.callOfDuty[i] = {};
            }

            this.markDirty('callOfDuty');
        }

        this.processWeedRank();

        // 初始化国家任务
        this.initCountryTask();
        this.generateRobots();
    },

    sendTempMail : function () {
        // 临时处理下发奖
        this.personalDayRank = this.personalWeekRank;
        // 发送每日个人排名奖励
        // this.sendPersonalRankMail();
    },

    // 处理房间的开启状态
    processOpenState : function () {
        if (this.isOpen)
            return;

        var count = 0;
        var curTime = common.getTime();
        var days = parseInt(gConfCountryWarBase.serverOpenDayLimit.value);
        var dayTime = days * OneDayTime;
        if (this.serverList) {
            for (var i = 1; i <= 3; i++) {
                if (this.serverList[i]) {
                    for (var j = 0; j < this.serverList[i].length; j++) {
                        var serverInfo = gCountryWar.getServerInfo(this.serverList[i][j]);
                        if (serverInfo && serverInfo[2] && curTime >= serverInfo[2] + dayTime) {
                            count += 1;
                            break;
                        }
                    }
                }
            }
        }

        // 3个阵营中都有至少一个服务器满足了开服天数
        if (count >= 3) {
            this.isOpen = true;
            this.markDirty('isOpen');
        }
    },

    isRoomOpen : function () {
        return this.isOpen;
    },

    // 判断指定服务器是否在这个房间里
    isServerInThisRoom : function (serverId) {
        var serverList = this.rooms[roomId].serverList;
        for (var i = 1; i <= 3; i++) {
            if (serverList[i] && serverList[i].indexOf(serverId) >= 0) {
                return true;
            }
        }

        return false;
    },

    // 生成机器人数据
    generateRobots : function() {
        if (Object.keys(this.robots).length > 0) {
            return;
        }

        var maxId = 0;
        for (var i in gConfName) {
            if(+i > maxId) maxId = +i;
        }

        var robotLevel = this.averageLevel;
        if (robotLevel == 0) {
            robotLevel = parseInt(gConfCountryWarBase.guardDefaultLevel.value);
        }

        var robotFightForce = gConfCountryWarGuard[robotLevel].fightPower;

        for (var cityId in this.cities) {
            var cityInfo = this.cities[cityId];

            var holdCountry = cityInfo.hold_camp;
            if (!cityInfo.players) {
                cityInfo.players = {};
                for (var i = 1; i <= 3; i++) {
                    cityInfo.players[i] = [];
                }
            }
            if (cityInfo.players[holdCountry].length > 0) {
                // 把里面机器人都去掉，重新生成
                for (var i = 0; i < cityInfo.players[holdCountry].length; i++) {
                    var uid = cityInfo.players[holdCountry][i];
                    if (isDroid(uid)) {
                        cityInfo.players[holdCountry].splice(i--, 1);
                    }
                }
            }

            var armyNum = gConfCountryWarCity[cityId].armyNum;
            var armyForce = Math.floor(robotFightForce * (1 + gConfCountryWarCity[cityId].armyFightforce));
            for (var i = 1; i <= armyNum; i++) {
                var posObj = {};
                // 随机名字
                var firstNameId = common.randRange(1, maxId);
                var secondNameId = common.randRange(1, maxId);
                var male = common.randArray([0, 1]);
                male = male ? 'female' : 'male';
                var name = gConfName[firstNameId].first + gConfName[secondNameId][male];

                var posObj = randomPosObj(
                    gConfRobot,
                    MaxPos,
                    armyForce,
                    3
                );

                //var realFightFoce = 0;
                //for(var p in posObj) {
                //    realFightFoce += posObj[p].fight_force;
                //}

                // 等级
                //var level = Math.ceil(realFightFoce/2000+10);
                //level = level > gMaxUserLevel ? gMaxUserLevel : level;
                var robot = {
                    uid : this.ai,
                    un : name,
                    headpic : common.randArray([1,2,3,4,5,6,7,8,9,10]),
                    level : robotLevel,
                    pos : posObj,
                    max_hero : MaxPos,
                    country : holdCountry,
                    server : 1,
                    fight_force : armyForce,
                };

                this.robots[this.ai] = robot;
                cityInfo.players[holdCountry].push(this.ai);

                if (!cityInfo.robots) {
                    cityInfo.robots = [];
                }
                if (cityInfo.robots.indexOf(this.ai) < 0) {
                    cityInfo.robots.push(this.ai);
                }
                this.ai++;

                if (this.ai >= 10000) {
                    LOG('robot too much');
                    break;
                }
            }
        }

        this.markDirty('cities');
        this.markDirty('robots');
        this.markDirty('ai');
    },

    // 获取机器人数据
    getRobot : function (uid) {
        return this.robots[uid];
    },

    // 清理国战数据
    clearData : function () {
        if (this.serverStatics) {
            for (var i = 1; i <= 3; i++) {
                if (this.serverStatics[i]) {
                    this.serverStatics[i].score.day = 0;
                    this.serverStatics[i].score.week = 0;
                    this.serverStatics[i].holdCityCount = 25;
                    this.serverStatics[i].playerCount = 0;
                    this.serverStatics[i].onlineCount = 0;
                    this.serverStatics[i].conqueredCount = 0;
                    this.serverStatics[i].conqueredCountWithinDuration = 0;
                }
            }
        }

        this.cities = {};
        this.personalDayRank = [];
        this.personalWeekRank = [];
        this.callOfDuty = {};
        this.attackCityPlayers = {};
        this.tasks = {};
        this.taskAwardGetRecord = {};
        this.dirty = {};
        this.ai = 1;
        this.robots = {};
        this.events = {};
        this.isOpen = false;
        this._init();

        this.markDirty('cities');
        this.markDirty('personalDayRank');
        this.markDirty('personalWeekRank');
        this.markDirty('callOfDuty');
        this.markDirty('attackCityPlayers');
        this.markDirty('tasks');
        this.markDirty('ai');
        this.markDirty('robots');
        this.markDirty('taskAwardGetRecord');
        this.markDirty('events');
        this.markDirty('isOpen');

        gUserInfo.resetCountryWar(true);
    },

    // 每日重置
    resetByDay : function () {
        LOG('================= reset by day =======================');
        // 清理任务数据
        this.cities = {};
        this.personalDayRank = [];
        this.callOfDuty = {};
        this.matchTable = {};
        this.fightTable = {};
        this.attackCityPlayers = {};
        this.tasks = {};
        this.taskAwardGetRecord = {};
        this.events = {};
        this.ai = 1;
        this.robots = {};
        this._init();

        // 清理在线人数
        if (this.serverStatics) {
            for (var i = 1; i <= 3; i++) {
                if (this.serverStatics[i]) {
                    this.serverStatics[i].score.day = 0;
                    this.serverStatics[i].holdCityCount = 25;
                    this.serverStatics[i].playerCount = 0;
                    this.serverStatics[i].onlineCount = 0;
                    this.serverStatics[i].conqueredCount = 0;
                    this.serverStatics[i].conqueredCountWithinDuration = 0;
                }
            }
        }

        this.markDirty('cities');
        this.markDirty('personalDayRank');
        this.markDirty('callOfDuty');
        this.markDirty('attackCityPlayers');
        this.markDirty('tasks');
        this.markDirty('scoreCalcTime');
        this.markDirty('ai');
        this.markDirty('robots');
        this.markDirty('taskAwardGetRecord');
        this.markDirty('events');

        gUserInfo.resetCountryWar(false);
    },

    // 每周重置
    resetByWeek : function () {
        LOG('================= reset by week =======================');
        this.clearData();

        this.serverList = {
            '1' : [],
            '2' : [],
            '3' : [],
        };

        // 重新分配服务器到房间
        var servers = gCountryWar.getServers();
        for (var sid in servers) {
            var roomId = gCountryWar.getRoomIdByServerId(parseInt(sid));
            if (roomId == this.roomId) {
                var camp = gCountryWar.getIndexByServerId(parseInt(sid));
                this.addServer(camp, parseInt(sid));
            }
        }

        this.markDirty('serverList');
    },

    // 刷新参战人数
    refreshPlayerCount : function () {
        var online_players = {};
        var all_players = {};
        for (var i = 1; i <= 3; i++) {
            online_players[i] = 0;
            all_players[i] = 0;
        }

        gUserInfo.getUserCount(this.roomId, online_players, all_players);

        for (var i = 1; i <= 3; i++) {
            this.serverStatics[i].onlineCount = online_players[i];
            this.serverStatics[i].playerCount = all_players[i];
        }
    },

    onHandleUserAct : function (uid) {
        if (gUserInfo.onUserAct(uid)) {
            this.refreshPlayerCount();
        }
    },

    // 查找玩家所在城池
    findPlayerCity : function (uid) {
        for (var cityId in this.cities) {
            var cityInfo = this.cities[cityId];

            for (var i = 1; i <= 3; i++) {
                for (var j = 0; j < cityInfo.players[i].length; j++) {
                    if (cityInfo.players[i][j] == uid) {
                        return cityId;
                    }
                }
            }
        }

        return 0;
    },

    resetTime : function () {
        var strBegin = gConfGlobalServer.countryWarBeginTime.split (":");
        if (strBegin.length != 2) {
            return ;
        }

        var strEnd = gConfGlobalServer.countryWarEndTime.split (":");
        if (strEnd.length != 2) {
            return;
        }

        var begin = new Date ();
        var end = new Date ();

        begin.setHours (strBegin[0]);
        begin.setMinutes (strBegin[1]);
        begin.setSeconds(0);
        end.setHours (strEnd[0]);
        end.setMinutes (strEnd[1]);
        end.setSeconds(0);

        this.beginTime = Math.floor(begin.getTime()/1000);
        this.endTime = Math.floor(end.getTime()/1000);
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

    save: function (callback) {
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(this.roomId);
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
                ERROR('INVALID SAVE ROOMS: ' + item);
            }
        }

        var roomId = +this.roomId;

        this.dirty = {};
        gDBRooms.update({_id: roomId}, {$set: updates}, {upsert : true}, function (err, result) {
            if (err) {
                ERROR({updates: updates, err: err});
                callback && callback(roomId);
            } else {
                callback && callback(roomId);
            }
        });

        DEBUG('room war saved, room id = ' + roomId);
    },

    tick : function() {
        this.processCall();
        this.processCountryTask();
        this.processOpenState();

        if (!gCountryWar.isFightTime()) {
            this.scoreCalcTime = common.getTime();
            this.markDirty('scoreCalcTime');
        }
    },

    // 国战开启回调
    onStart : function () {
        // 重置玩家国战数据
        var openDays = gConfCountryWarBase.openDays;
        var firstDay = parseInt(openDays.value[0]);

        var weekDay = Date.getWeekDay();
        var weekClear = false;
        if (weekDay == firstDay) {
            weekClear = true;   // 星期一周重置
            this.resetByDay();
            this.resetByWeek();
        } else {
            // 每日重置
            this.resetByDay();
        }

        gUserInfo.resetCountryWar(weekClear);

        this.lastResetTime = common.getTime();
        this.markDirty('lastResetTime');

        this.scoreCalcTime = common.getTime();
        this.markDirty('scoreCalcTime');
    },

    processWeedRank : function () {
        // 处理下周排行榜中的null字段
        for (var i = 0; i < this.personalWeekRank.length; i++) {
            if (this.personalWeekRank[i] == null) {
                this.personalWeekRank.splice(i, 1);
                i--;
                this.markDirty('personalWeekRank');
            }
        }
    },

    // 国战结束处理
    onEnd : function () {
        // 积分结算
        this.calcCountryScore();
        this.updateCountryRank();

        this.processWeedRank();

        // 发送每日个人排名奖励
        // this.sendPersonalRankMail();

        // 检测是否是周日
        var openDays = gConfCountryWarBase.openDays;
        var daysCount = Object.keys(openDays.value).length;
        var lastDay = parseInt(openDays.value[daysCount - 1]);
        var weekDay = Date.getWeekDay();
        if (weekDay == lastDay) {
            // 发放每周排名奖励
            this.sendWeekRankMail();
        }

        // 取积分榜玩家平均等级
        var totalLevel = 0;
        var playerCount = 0;
        for (var i = 0; i < this.personalDayRank.length; i++) {
            var user = gUserInfo.getUser(this.personalDayRank[i]);
            if (user) {
                totalLevel += user.status.level;
                playerCount += 1;
            }
        }

        if (!this.averageLevel)
            this.averageLevel = 0;

        if (playerCount != 0)
            this.averageLevel = Math.floor(totalLevel/playerCount);

        this.markDirty('averageLevel');
    },

    // 初始化国家任务
    initCountryTask : function () {
        if (!this.tasks) {
            this.tasks = {};
        }

        if (Object.keys(this.tasks).length > 0) {
            return;
        }

        for (var j = 1; j <= 3; j++){
            this.tasks[j] = {};
            var taskTypeCount = Object.keys(gConfCountryWarTask).length;
            for (var i = 1; i <= taskTypeCount; i++) {
                var taskArr = [];
                var taskIdCount = Object.keys(gConfCountryWarTask[i]).length;
                for (var k = 1; k <= taskIdCount; k++) {
                    var taskData = gConfCountryWarTask[i][k];
                    if (taskData.countryType == j || taskData.countryType == 0) {
                        taskArr.push(taskData);
                    }
                }

                var taskId = taskArr[0].id;
                if (taskArr.length > 1) {
                    // 随机
                    var index = common.randRange(0, taskArr.length - 1);
                    taskId = taskArr[index].id;
                }

                var taskObj = {};
                taskObj.taskId = taskId;
                taskObj.finish = 0;
                taskObj.curVal = 0;
                this.tasks[j][i] = taskObj;
            }
        }

        this.markDirty('tasks');
    },

    // 处理任务
    processCountryTask : function () {
        for (var i = 1; i <= 3; i++) {
            for (var taskType in this.tasks[i]) {
                var taskObj = this.tasks[i][taskType];
                if (!taskObj.finish) {
                    var taskData = gConfCountryWarTask[taskType][taskObj.taskId];
                    if (taskData) {
                        var needSave = false;
                        var oldVal = taskObj.curVal;

                        var targetValue1 = taskData.condition1;
                        var targetValue2 = taskData.condition2;
                        var eventType = taskData.event;
                        if (eventType == 'conqueredEnemyCity') {
                            // 占领敌方城池
                            var cityInfo = this.cities[targetValue1];
                            if (cityInfo.hold_camp == i) {
                                taskObj.curVal = 1;
                                taskObj.finish = 1;
                                needSave = true;
                            } else {
                                taskObj.curVal = 0;
                            }
                        } else if (eventType == 'holdCityTime') {
                            // 占据城池的时间
                            var cityInfo = this.cities[targetValue1];
                            if (cityInfo.hold_camp == i) {
                                if (cityInfo.hold_time + targetValue2 * 60 < common.getTime()) {
                                    taskObj.curVal = Math.floor((common.getTime() - cityInfo.hold_time)/60);
                                    taskObj.finish = 1;
                                    needSave = true;
                                } else {
                                    taskObj.curVal = Math.floor((common.getTime() - cityInfo.hold_time)/60);
                                    if (taskObj.curVal != oldVal) {
                                        needSave = true;
                                    }
                                }
                            }
                        } else if (eventType == 'conqueredCityCount') {
                            // 指定时间内占领的城池数
                            if (this.serverStatics[i].conqueredCountWithinDuration >= targetValue2) {
                                taskObj.curVal = this.serverStatics[i].conqueredCountWithinDuration;
                                taskObj.finish = 1;
                                needSave = true;
                            } else {
                                taskObj.curVal = this.serverStatics[i].conqueredCountWithinDuration;
                                if (taskObj.curVal != oldVal) {
                                    needSave = true;
                                }
                            }
                        } else if (eventType == 'holdCityCount') {
                            // 占领的城池数
                            if (this.serverStatics[i].holdCityCount >= targetValue1) {
                                taskObj.curVal = this.serverStatics[i].holdCityCount;
                                taskObj.finish = 1;
                                needSave = true;
                            } else {
                                taskObj.curVal = this.serverStatics[i].holdCityCount;
                                if (taskObj.curVal != oldVal) {
                                    needSave = true;
                                }
                            }
                        } else if (eventType == 'joinPlayerCount') {
                            // 参加国战的人数
                            if (this.serverStatics[i].playerCount >= targetValue1) {
                                taskObj.curVal = this.serverStatics[i].playerCount;
                                taskObj.finish = 1;
                                needSave = true;
                            } else {
                                taskObj.curVal = this.serverStatics[i].playerCount;
                                if (taskObj.curVal != oldVal) {
                                    needSave = true;
                                }
                            }
                        }

                        if (needSave) {
                            this.markDirty('tasks');
                        }
                    }
                }
            }
        }
    },

    // 获取国家任务
    getCountryTask : function (camp) {
        return this.tasks[camp];
    },

    // 判断国家任务是否已完成
    isCountryTaskFinish : function (camp, taskType, taskId) {
        if (!this.tasks[camp]) {
            return false;
        }

        if (!this.tasks[camp][taskType]) {
            return false;
        }

        if (this.tasks[camp][taskType].taskId != taskId) {
            return false;
        }

        return this.tasks[camp][taskType].finish;
    },

    // 对击杀排名
    sortFunc : function(a, b) {
        var aUserInfo = gUserInfo.getUser(a);
        var bUserInfo = gUserInfo.getUser(b);
        if (!aUserInfo || !bUserInfo) {
            return -1;
        }

        var aScore = aUserInfo.countryWar.score;
        var bScore = bUserInfo.countryWar.score;

        if (aScore > bScore) {
            return -1;
        } else if(aScore < bScore){
            return 1;
        } else {
            return aUserInfo.countryWar.addScoreTime - bUserInfo.countryWar.addScoreTime;
        }
    },

    sortWeekFunc : function(a, b) {
        var aUserInfo = gUserInfo.getUser(a);
        var bUserInfo = gUserInfo.getUser(b);
        if (!aUserInfo || !bUserInfo) {
            return -1;
        }

        var aScore = aUserInfo.countryWar.weekScore;
        var bScore = bUserInfo.countryWar.weekScore;

        if (aScore > bScore) {
            return -1;
        } else if(aScore < bScore){
            return 1;
        } else {
            return aUserInfo.countryWar.addScoreTime - bUserInfo.countryWar.addScoreTime;
        }
    },

    // 获取城池数据
    getCities : function () {
        return this.cities;
    },

    getCitiesForClient : function () {
        var cityList = {};
        for (var cityId in this.cities) {
            var cityObj = this.getCityInfo(cityId, false);
            cityList[cityId] = cityObj;
        }

        return cityList;
    },

    // 根据服务器id获取所在的索引
    getIndexByServerId : function (serverId) {
        for (var i = 1; i <= 3; i++) {
            if (this.serverList[i].indexOf(serverId) >= 0) {
                return i;
            }
        }

        return -1;
    },

    sendCall : function (uid, serverId, targetCity) {
        var camp = this.getIndexByServerId(serverId);
        if (camp <= 0) {
            return;
        }

        this.addCallOfDuty(camp, targetCity, uid, serverId);

        var playerIds = gUserInfo.getCampPlayers(this.roomId, camp);
        if (playerIds.length > 0) {
            var worldReq = {
                mod : 'countrywar',
                act : 'broadcast_call_of_duty',
                uid : 1,
                args : {
                    players : playerIds,
                    city : targetCity,
                    uid : uid,
                    serverId : serverId,
                    time : common.getTime(),
                },
            };

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastToAllWorld(worldReq, WorldResp, function() {
                if (WorldResp.code == 0) {
                    DEBUG('broadcast_call_of_duty request a client over');
                } else {
                    DEBUG('broadcast_call_of_duty request a client error, desc = ' + WorldResp.desc);
                }
            });
        }
    },

    // 添加集结令
    addCallOfDuty : function (camp, city_id, caller, serverId) {
        if (!this.callOfDuty[camp]) {
            this.callOfDuty[camp] = {};
        }

        this.callOfDuty[camp][city_id] = {};
        this.callOfDuty[camp][city_id].caller = caller;
        this.callOfDuty[camp][city_id].serverId = serverId;
        this.callOfDuty[camp][city_id].time = common.getTime();
        this.callOfDuty[camp][city_id].replys = [];
        this.markDirty(util.format('callOfDuty.%d', camp));

        gUserInfo.onBroadcastCallOfDuty(caller);
    },

    // 获取集结令发布信息
    getCallOfDuty : function (camp) {
        return this.callOfDuty[camp];
    },

    // 获取玩家响应过的集结令列表
    getReplyCalls : function (uid) {
        var replyCalls = [];
        var userInfo = gUserInfo.getUser(uid);
        if (userInfo) {
            var camp = userInfo.countryWar.camp;
            var calls = this.callOfDuty[camp];
            if (calls) {
                for (var cityId in calls) {
                    var callInfo = calls[cityId];
                    if (callInfo.replys.indexOf(uid) >= 0) {
                        replyCalls.push(cityId);
                    }
                }
            }
        }

        return replyCalls;
    },

    // 获得各个国家占领城池数
    getCountryOwnCityCount : function () {
        return this.serverStatics;
    },

    // 获取匹配表
    getMatchTable : function () {
        return this.matchTable;
    },

    // 取消匹配
    cancelMatch : function (uid) {
        if (this.matchTable[uid]) {
            delete this.matchTable[uid];
        }
    },

    insertMatch : function (uid, enemy_uid) {
        if (!this.matchTable[uid]) {
            this.matchTable[uid] = {};
        }

        this.matchTable[uid].enemy_uid = enemy_uid;
        this.matchTable[uid].time = common.getTime();
    },

    // 是否有自己的匹配
    isInMatch : function (uid) {
        if (this.matchTable[uid])
            return true;

        return false;
    },

    // 是否被别人比配
    isMatched : function (uid) {
        var curTime = common.getTime();
        for (var uid in this.matchTable) {
            if (this.matchTable[uid].enemy_uid == uid) {
                if (curTime < this.matchTable[uid].time) {
                    return true;
                } else {
                    delete this.matchTable[uid];
                    break;
                }
            }
        }

        return false;
    },

    // 取消移动
    cancelMove : function (uid) {
        if (this.moveQueue[uid]) {
            delete this.moveQueue[uid];
        }
    },

    // 获取对阵表
    getFightTable : function () {
        return this.fightTable;
    },

    // 获取国家占领城池数
    getCountryHoldCityCount : function (camp) {
        if (this.serverStatics[camp]) {
            return this.serverStatics[camp];
        }

        return 0;
    },

    // 获取进攻过指定城池的玩家列表
    getAttackPlayers : function (city_id) {
        return this.attackCityPlayers[city_id];
    },

    clearAttackPlayers : function (city_id) {
        this.attackCityPlayers[city_id] = [];
        this.markDirty(util.format('attackCityPlayers.%d', city_id));
    },

    addAttackPlayer : function (city, uid) {
        if (!this.attackCityPlayers) {
            this.attackCityPlayers = {};
        }

        if (!this.attackCityPlayers[city]) {
            this.attackCityPlayers[city] = [];
        }

        this.attackCityPlayers[city].push(uid);
        this.markDirty(util.format('attackCityPlayers.%d', city));
    },

    refreshCityFightState : function (city_id) {
        // 通知战斗状态改变
        var stateChange = this.updateCityInFightState(city_id);
        if (stateChange) {
            // 通知城池占领情况
            // 获取所有在国战里面的玩家
            var playerIds = gUserInfo.getRoomPlayers(this.roomId);
            if (playerIds.length > 0) {
                var worldReq = {
                    mod : 'countrywar',
                    act : 'city_fight_state_change',
                    uid : 1,
                    args : {
                        players : playerIds,
                        city : city_id,
                        cityInfo : this.getCityInfo(city_id, false),
                    },
                };

                var Worldresp = {};
                Worldresp.code = 0;
                this.broadcastToAllWorld(worldReq, Worldresp, function() {
                    if (Worldresp.code == 0) {
                        DEBUG('city_fight_state_change request a client over');
                    } else {
                        DEBUG('city_fight_state_change request a client error, desc = ' + Worldresp.desc);
                    }
                });
            }
        }

        return stateChange;
    },

    // 玩家进入回调
    onPlayerEnterCity : function (uid, city_id, old_city, dead, call) {
        if (!this.cities[city_id]) {
            LOG('city id error, city id is ' + city_id);
            return;
        }

        var replyCall = call;
        if (!replyCall)
            replyCall = false;

        // 从老的城池中移除
        if (city_id != old_city) {
            this.onPlayerLeaveCity(uid, old_city, dead);
        }

        var userInfo = gUserInfo.getUser(uid);
        var userCamp = userInfo.countryWar.camp;
        var cityInfo = this.cities[city_id];

        var update = false;
        if (this.cities[city_id].players[userCamp].indexOf(uid) < 0) {
            this.cities[city_id].players[userCamp].push(uid);
            update = true;
        }

        if (update) {
            this.markDirty(util.format('cities.%d.players', city_id));
            this.markDirty(util.format('serverStatics.%d', userCamp));

            gUserInfo.onEnterCity(uid, city_id);

            // 获取本城池玩家列表
            var playerIds = [];
            var playerCount = 0;
            for (var i = 1; i <= 3; i++) {
                for (var j = 0; j < cityInfo.players[i].length; j++) {
                    if (!isDroid(cityInfo.players[i][j])) {
                        playerIds.push(cityInfo.players[i][j]);
                    }

                    playerCount += cityInfo.players[i].length;
                }
            }

            if (playerIds.length > 0) {
                var worldReq = {
                    mod : 'countrywar',
                    act : 'city_player_change',
                    uid : 1,
                    args : {
                        players : playerIds,
                        city : city_id,
                        uid : uid,
                        un : userInfo.info.un,
                        enter : 1,
                        hid : userInfo.pos[1].hid,
                        fight_force : gUserInfo.getUserFightForce(uid),
                        country : userInfo.countryWar.camp,
                        call : replyCall,    // 是否是响应号令进来的
                        serverId : userInfo.countryWar.serverId,
                        weapon_illusion: userInfo.sky_suit.weapon_illusion,
                        wing_illusion: userInfo.sky_suit.wing_illusion,
                    },
                };

                // 通知到所有世界服
                this.broadcastToAllWorld(worldReq, {}, function() {
                    DEBUG('city_player_change request a client over');
                });
            }

            if (playerCount == 1 && cityInfo.hold_camp != userInfo.countryWar.camp) {
                // 检查下每个国家剩余玩家数，如果只剩一个国家的玩家，并且城池所属国家不是这个国家，那么要改变归属
                this.checkCityOwner(city_id);
            }
        }

        this.refreshCityFightState(city_id);

        // 在战斗中的城池，要通知人员改变
        if (update && this.isCityInFightState(city_id)) {
            // 获取本城池玩家列表
            this.notifyCityPlayerChange(city_id, uid, 1);
        }
    },

    notifyCityPlayerChange : function (city_id, uid, enter) {
        // 获取本城池玩家列表
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo)
            return;

        var playerIds = gUserInfo.getRoomPlayersExceptCity(this.roomId, city_id);
        if (playerIds.length > 0) {
            var worldReq = {
                mod : 'countrywar',
                act : 'city_player_change',
                uid : 1,
                args : {
                    players : playerIds,
                    city : city_id,
                    uid : uid,
                    un : userInfo.info.un,  // 玩家名字
                    enter : enter,
                    hid : userInfo.pos[1].hid,
                    fight_force : gUserInfo.getUserFightForce(uid),
                    country : userInfo.countryWar.camp,
                    call : false,   // 是否是响应号令进来的
                    serverId : userInfo.countryWar.serverId,    // 服务器id
                },
            };

            // 通知到所有世界服
            this.broadcastToAllWorld(worldReq, {}, function() {
                DEBUG('city_player_change request a client over');
            });
        }
    },

    isCityInFightState : function (cityId) {
        var cityInfo = this.getCityInfo(cityId);
        if (cityInfo) {
            return cityInfo.fight_state;
        }

        return 0;
    },

    // 玩家离开回调
    onPlayerLeaveCity : function (uid, city_id, dead) {
        if (!this.cities[city_id]) {
            LOG('city id error, city id is ' + city_id);
            return;
        }

        var userInfo = gUserInfo.getUser(uid);
        var userCamp = 0;
        if (isDroid(uid)) {
            userCamp = this.cities[city_id].hold_camp;
        } else {
            if (userInfo)
                userCamp = userInfo.countryWar.camp;
        }

        if (userCamp == 0) {
            ERROR('onPlayerLeaveCity country error, country = ' + userCamp);
        }

        var update = false;
        if (this.cities[city_id].players[userCamp].indexOf(uid) >= 0) {
            this.cities[city_id].players[userCamp].remove(uid);
            update = true;
        }

        // 取消匹配
        this.cancelMatch(uid);

        if (update) {
            this.markDirty(util.format('cities.%d', city_id));
            gUserInfo.onLeaveCity(uid);

            {
                var playerIds = [];

                if (this.isCityInFightState(city_id)) {
                    playerIds = gUserInfo.getRoomPlayers(this.roomId);
                } else {
                    // 获取本城池玩家列表
                    var cityInfo = this.cities[city_id];
                    for (var i = 1; i <= 3; i++) {
                        for (var j = 0; j < cityInfo.players[i].length; j++) {
                            if (!isDroid(cityInfo.players[i][j]))
                                playerIds.push(cityInfo.players[i][j]);
                        }
                    }
                }

                if (playerIds.length > 0) {
                    if (isDroid(uid)) {
                        userInfo = this.getRobot(uid);
                        if (userInfo) {
                            var worldReq = {
                                mod : 'countrywar',
                                act : 'city_player_change',
                                uid : 1,
                                args : {
                                    players : playerIds,
                                    city : city_id,
                                    uid : uid,
                                    un : userInfo.un,
                                    enter : 0,
                                    hid : userInfo.pos[1].hid,
                                    fight_force : userInfo.fight_force,
                                    country : userInfo.country,
                                    call : false,
                                    serverId : 0,
                                },
                            };

                            // 通知到所有世界服
                            this.broadcastToAllWorld(worldReq, {}, function() {
                                DEBUG('city_player_change request a client over');
                            });
                        }
                    } else {
                        var worldReq = {
                            mod : 'countrywar',
                            act : 'city_player_change',
                            uid : 1,
                            args : {
                                players : playerIds,
                                city : city_id,
                                uid : uid,
                                un : userInfo.info.un,
                                enter : 0,
                                hid : userInfo.pos[1].hid,
                                fight_force : gUserInfo.getUserFightForce(uid),
                                country : userInfo.countryWar.camp,
                                call : false,
                                serverId : userInfo.countryWar.serverId,
                            },
                        };

                        // 通知到所有世界服
                        this.broadcastToAllWorld(worldReq, {}, function() {
                            DEBUG('city_player_change request a client over');
                        });
                    }
                }
            }

            this.checkCityOwner(city_id);
        }

        // 在战斗中的城池，要通知人员改变
        if (update && this.isCityInFightState(city_id)) {
            // 获取本城池玩家列表
            this.notifyCityPlayerChange(city_id, uid, 0);
        }
    },

    checkCityOwner : function (city_id) {
        // 玩家离开时，检查下每个国家剩余玩家数，如果只剩一个国家的玩家，并且城池所属国家不是这个国家，那么要改变归属
        var leftCamp = 0;
        var leftCampCount = 0;
        for (var i = 1; i <= 3; i++) {
            if (this.cities[city_id].players[i].length > 0) {
                leftCamp = i;
                leftCampCount += 1;
            }
        }

        var ownerChange = false;
        var oldHoldCamp = this.cities[city_id].hold_camp;
        if (leftCamp > 0 && leftCampCount == 1 && oldHoldCamp != leftCamp) {
            this.onCityOwnerChanged(city_id, leftCamp);
            ownerChange = true;

            LOG('change city owner in onPlayerLeaveCity(), old country is ' + oldHoldCamp + ', new country is ' + leftCamp);

            // 更新参与过进攻玩家的信息
            var attackPlayers = this.getAttackPlayers(city_id);
            if (attackPlayers) {
                for (var i = 0; i < attackPlayers.length; i++) {
                    var attackInfo = gUserInfo.getUser(attackPlayers[i]);
                    if (attackInfo && attackInfo.countryWar.camp == leftCamp) {
                        gUserInfo.onCityCaptured(attackPlayers[i], city_id, oldHoldCamp);
                    }
                }

                this.clearAttackPlayers();
            }
        }

        this.refreshCityFightState(city_id);
        if (ownerChange) {
            // 通知城池占领情况
            // 获取所有在国战里面的玩家
            var playerIds = gUserInfo.getRoomPlayers(this.roomId);
            if (playerIds.length > 0) {
                var worldReq = {
                    mod : 'countrywar',
                    act : 'city_owner_change',
                    uid : 1,
                    args : {
                        players : playerIds,
                        city : city_id,
                        cityInfo : this.getCityInfo(city_id, false),
                    },
                };

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastToAllWorld(worldReq, WorldResp, function() {
                    if (WorldResp.code == 0) {
                        DEBUG('city_owner_change request a client over ');
                    } else {
                        DEBUG('city_owner_change request a client error, desc = ' + WorldResp.desc);
                    }
                });
            }
        }
    },

    // 玩家战斗回调
    onPlayerFight : function (city_id, uid1, uid2, name1, name2, camp1, camp2, serverId1, serverId2, winner) {
        var cityInfo = this.getCityInfo(city_id, true);
        if (!cityInfo){
            return;
        }

        // 获取本城池玩家列表
        var playerIds = [];
        for (var i = 1; i <= 3; i++) {
            for (var j = 0; j < cityInfo.players[i].length; j++) {
                if (!isDroid(cityInfo.players[i][j].uid))
                    playerIds.push(cityInfo.players[i][j].uid);
            }
        }

        if (playerIds.length > 0) {
            var worldReq = {
                mod : 'countrywar',
                act : 'on_player_fight',
                uid : 1,
                args : {
                    players : playerIds,
                    city : city_id, // 城池id
                    uid1 : uid1,    // 玩家1 uid
                    uid2 : uid2,    // 玩家2 uid
                    name1 : name1,  // 玩家1 名字
                    name2 : name2,  // 玩家2 名字
                    camp1 : camp1,
                    camp2 : camp2,
                    serverId1 : serverId1,
                    serverId2 : serverId2,
                    winner : winner,    // 胜利方uid
                },
            };

            // 通知到所有世界服
            this.broadcastToAllWorld(worldReq, {}, function() {
                DEBUG('on_player_fight request a client over');
            });
        }
    },

    // 城池被占领回调
    onCityOwnerChanged : function (city_id, hold_country) {
        if (!this.cities[city_id]) {
            LOG('city id error, city id is ' + city_id);
            return;
        }

        var oldCountry = this.cities[city_id].hold_camp;
        if (oldCountry == hold_country) {
            return;
        }

        // 改变归属之前先结算下积分
        this.calcCountryScore();

        this.serverStatics[oldCountry].holdCityCount -= 1;

        var curTime = common.getTime();
        this.cities[city_id].hold_camp = hold_country;
        this.cities[city_id].hold_time = curTime;

        this.addEvent(city_id, EventType.EVENT_OCCUPY_CITY, hold_country);

        if (!this.serverStatics[hold_country].holdCityCount) {
            this.serverStatics[hold_country].holdCityCount = 0;
        }

        this.serverStatics[hold_country].holdCityCount += 1;

        // 更新国家占领信息
        if (!this.serverStatics[hold_country].conqueredCount) {
            this.serverStatics[hold_country].conqueredCount = 0;
        }

        this.serverStatics[hold_country].conqueredCount += 1;   // 本次国战攻占数量

        if (!this.serverStatics[hold_country].conqueredCountWithinDuration) {
            this.serverStatics[hold_country].conqueredCountWithinDuration = 0;
        }

        var countryWarBeginTime = gCountryWar.getFightBeginTime();
        if (curTime - countryWarBeginTime < parseInt(gConfCountryWarBase.countTime.value)) {
            this.serverStatics[hold_country].conqueredCountWithinDuration += 1; // 国战开启指定时间段内占领的城池数
        }

        // 检查是否有剩余机器人
        for (var i = 1; i <= 3; i++) {
            for (var j = 0; j < this.cities[city_id].players[i].length; j++) {
                if (isDroid(this.cities[city_id].players[i][j])) {
                    LOG('error! robot id = ' + this.cities[city_id].players[i][j] + ' is still in country ' + i);
                    this.cities[city_id].players[i].splice(j, 1);
                    j--;
                }
            }
        }

        // 恢复防守机器人
        if (!this.cities[city_id].robots) {
            this.cities[city_id].robots = [];
        }

        for (var i = 0; i < this.cities[city_id].robots.length; i++) {
            var robotUid = this.cities[city_id].robots[i];
            this.cities[city_id].players[hold_country].push(robotUid);

            // 修改机器人国家
            this.robots[robotUid].country = hold_country;
            this.markDirty(util.format('robots.%d', robotUid));
        }

        this.markDirty(util.format('cities.%d', city_id));
        this.markDirty(util.format('serverStatics.%d', hold_country));

        // 更新国家排名
        this.updateCountryRank();
    },

    updateCountryRank : function () {
        if (this.countryRankDirty == false)
            return;

        this.campWeekRank = [];
        for (var camp in this.serverStatics) {
            var serverInfo = this.serverStatics[camp];
            serverInfo.country = parseInt(camp);
            this.campWeekRank.push(serverInfo);
        }

        function sortServerFunc(a, b) {
            if (a.score.week < b.score.week) {
                return 1;
            } else if (a.score.week > b.score.week) {
                return -1;
            }

            return a.country - b.country;
        }

        this.campWeekRank.sort(sortServerFunc);
        this.countryRankDirty = false;
    },

    getWeekRank : function () {
        this.updateCountryRank();

        return this.campWeekRank;
    },

    getCampWeekRank : function (camp) {
        this.updateCountryRank();
        for (var i = 0; i < this.campWeekRank.length; i++) {
            if (this.campWeekRank[i].country == camp) {
                return i + 1;
            }
        }

        return 0;
    },

    // 获取玩家击杀排名
    getPlayerDayRank : function (uid) {
        return this.personalDayRank.indexOf(uid) + 1;
    },

    getDayRankList : function () {
        return this.personalDayRank;
    },

    getPlayerWeekRank : function (uid) {
        return this.personalWeekRank.indexOf(uid) + 1;
    },

    getWeekRankList : function () {
        return this.personalWeekRank;
    },

    // 判断指定玩家是否在指定城池中
    isPlayerInCity : function (uid, city_id) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo)
            return false;

        var userCamp = userInfo.countryWar.camp;
        var cityInfo = this.cities[city_id];

        if (cityInfo.players[userCamp].indexOf(uid) >= 0) {
            return true;
        }

        return false;
    },

    // 玩家死亡
    onPlayerDeath : function (uid, killer, city_id) {
        if (isDroid(uid)) {
            this.onPlayerLeaveCity(uid, city_id, true);
        }
        else {
            gUserInfo.onPlayerDeath(uid);
            var userInfo = gUserInfo.getUser(uid);
            if (userInfo) {
                var userCamp = userInfo.countryWar.camp;
                var capitalCity = gUserInfo.getCapitalCityId(userCamp);

                this.onPlayerEnterCity(uid, capitalCity, city_id, true);
            }
        }

        if (!isDroid(uid))
            this.updateKillRank(uid, true);

        if (!isDroid(killer))
            this.updateKillRank(killer, true);
    },

    updateKillRank : function (uid, sort) {
        if (uid != null && !isDroid(uid)) {
            // 更新击杀排名
            if (this.personalDayRank.indexOf(uid) < 0) {
                this.personalDayRank.push(uid);
            }

            if (this.personalWeekRank.indexOf(uid) < 0) {
                this.personalWeekRank.push(uid);
            }

            if (sort)
                this.personalDayRank.sort(this.sortFunc);

            if (sort)
                this.personalWeekRank.sort(this.sortWeekFunc);

            this.markDirty('personalDayRank');
            this.markDirty('personalWeekRank');
        }
    },

    // 增加移动数据
    addPlayerMove : function (uid, target_city, start_time, reach_time, paths) {
        this.moveQueue[uid] = {};
        this.moveQueue[uid].targetCity = target_city;
        this.moveQueue[uid].startTime = start_time;
        this.moveQueue[uid].reachTime = reach_time;
        this.moveQueue[uid].path = paths;
    },

    // 处理移动队列
    processMoveQueue : function () {
        var curTime = common.getTime();
        for (var uid in this.moveQueue) {
            uid = parseInt(uid);
            var moveObj = this.moveQueue[uid];
            var userInfo = gUserInfo.getUser(uid);

            // 检查是否到达目标点了
            var curCity = userInfo.countryWar.city;
            var pathLength = moveObj.path.length;
            var lastCity = moveObj.path[pathLength - 1];
            if (curCity == lastCity) {
                // 到达终点了
            } else {
                // 还要继续走
                var nextCity = 0;
                for (var i = 1; i < moveObj.path.length; i++) {
                    if (moveObj.path[i] == curCity) {
                        nextCity = moveObj.path[i + 1]
                        break;
                    }
                }

                var nextCityInfo = this.getCityInfo(nextCity);
                if (nextCityInfo) {
                    if (nextCityInfo.fight_state == 1) {
                        // 中间有城池处于战斗状态要停下来
                        delete this.moveQueue[uid];
                        continue;
                    }
                }
            }

            if (moveObj && curTime >= moveObj.reachTime && userInfo.countryWar.leave) {
                // 时间到了
                this.onPlayerEnterCity(uid, moveObj.targetCity, userInfo.countryWar.city);
                delete this.moveQueue[uid];
            }
        }
    },

    // 计算国家积分
    calcCountryScore : function () {
        // 还没开始，不计算
        if (!gCountryWar.isFightTime()) {
            return;
        }

        var curTime = common.getTime();
        if (this.scoreCalcTime + parseInt(gConfCountryWarBase.cityScoreTime.value) > curTime) {
            return;
        }

        var timeDiff = curTime - this.scoreCalcTime;
        if (timeDiff < 0)
            timeDiff = 0;

        var count = Math.floor(timeDiff/parseInt(gConfCountryWarBase.cityScoreTime.value));
        for (var cityId in this.cities) {
            var score = parseInt(gConfCountryWarCity[cityId].cityScore) * count;
            if (score > 0) {
                this.serverStatics[this.cities[cityId].hold_camp].score.day += score;
                this.serverStatics[this.cities[cityId].hold_camp].score.week += score;
                this.countryRankDirty = true;
            }
        }

        this.scoreCalcTime += (count * parseInt(gConfCountryWarBase.cityScoreTime.value));
        this.markDirty('scoreCalcTime');

        for (var i = 1; i <= 3; i++) {
            if (!this.serverStatics[i].playerCount) {
                this.serverStatics[i].playerCount = 0;
            }
        }

        this.markDirty('countryWarInfo');
    },

    // 获取国家积分
    getCountryScore : function (index) {
        this.calcCountryScore();

        return this.serverStatics[index].score;
    },

    getCampPlayerCount : function (camp) {
        return this.serverStatics[camp].onlineCount;
    },

    // 到达城池
    onReachCity : function (uid, targetCity, resp) {
        var moveObj = this.moveQueue[uid];
        if (!moveObj) {
            resp.code = 1; resp.desc = 'can not find move info'; return;
        }

        // 检测目标城池是否在路径中
        if (moveObj.path.indexOf(targetCity) < 0) {
            resp.code = 1; resp.desc = 'target city not in the path'; return;
        }

        // 检查当前时间是否已经能够到目标城池
        var index = moveObj.path.indexOf(targetCity);
        var reachTime = moveObj.startTime + index * parseInt(gConfCountryWarBase.pathTime.value);
        var curTime = common.getTime();
        if (reachTime > curTime + 8) {
            resp.code = 1; resp.desc = 'time not enough'; return;
        }

        var userInfo = gUserInfo.getUser(uid);
        var oldCity = userInfo.countryWar.city;
        this.onPlayerEnterCity(uid, targetCity, oldCity);

        // 取消移动
        if (this.moveQueue[uid] && this.moveQueue[uid].targetCity == targetCity) {
            this.cancelMove(uid);
        }
    },

    getMoveInfo : function (uid) {
        return this.moveQueue[uid];
    },

    removeMoveInfo : function (uid) {
        if (this.moveQueue[uid]) {
            delete this.moveQueue[uid];
        }
    },

    // 获取城池信息
    getCityInfo : function (city_id, detail) {
        var cityInfo = {};
        cityInfo.hold_camp = this.cities[city_id].hold_camp;
        cityInfo.fight_state = this.cities[city_id].fight_state;

        cityInfo.players = {};
        for (var i = 1; i <= 3; i++) {
            cityInfo.players[i] = [];
            for (var j = 0; j < this.cities[city_id].players[i].length; j++) {
                var playerObj = {};
                playerObj.uid = this.cities[city_id].players[i][j];
                cityInfo.players[i].push(playerObj)
            }
        }

        if (detail) {
            cityInfo.importantPlayers = {}; // 重要官员

            var needPosition = parseInt(gConfCountryWarBase.callNeedPosition.value);
            for (var i = 1; i <= 3; i++) {
                for (var j = 0; j < cityInfo.players[i].length; j++) {
                    var user = gUserInfo.getUser(cityInfo.players[i][j].uid);
                    if (user && user.info.position > 0 && user.info.position <= needPosition) {
                        var playerInfo = {};
                        playerInfo.uid = cityInfo.players[i][j];
                        playerInfo.un = user.info.un;
                        playerInfo.headpic = user.info.headpic;
                        playerInfo.headframe = user.info.headframe;
                        playerInfo.country = user.countryWar.camp;
                        playerInfo.position = user.info.position;
                        playerInfo.level = user.status.level;
                        playerInfo.main_role = user.pos[1].hid;

                        cityInfo.importantPlayers[playerInfo.uid] = playerInfo;
                    }
                }
            }
        }

        return cityInfo;
    },

    // 检查城池是否在战斗中（只要有不同国家的玩家存在，就算是在战斗中）
    updateCityInFightState : function (city_id) {
        var change = false;
        var cityInfo = this.cities[city_id];
        var isFight = 0;

        var leftCountryCount = 0;
        for (var i = 1; i <= 3; i++) {
            if (cityInfo.players[i].length > 0) {
                leftCountryCount += 1;
            }
        }

        if (leftCountryCount > 1) {
            isFight = 1;
        }

        var oldState = this.cities[city_id].fight_state;
        this.cities[city_id].fight_state = isFight;

        if (oldState != isFight) {
            change = true;
        }

        return change;
    },

    // 判断国家任务是否完成
    isTaskFinish : function (task_type, task_id) {
        switch (task_type) {
            case CountryTaskType.conqueredEnemyCity : {
                // 占领敌方城池
            } break;
            case CountryTaskType.holdCityTime : {
                // 占据城池的时间
            } break;
            case CountryTaskType.conqueredCityCount : {
                // 指定时间内占领的城池数
            } break;
            case CountryTaskType.holdCityCount : {
                // 占领的城池数
            } break;
            case CountryTaskType.joinPlayerCount : {
                // 参加国战的人数
            } break;
        }
    },

    // 处理集结令过期
    processCall : function () {
        var curTime = common.getTime();
        for (var i = 1; i <= 3; i++) {
            for (var cityId in this.callOfDuty[i]) {
                if (curTime > this.callOfDuty[i][cityId].time + parseInt(gConfCountryWarBase.callKeepTime.value)) {
                    // 已经到时间了
                    delete this.callOfDuty[i][cityId];
                    this.markDirty(util.format('callOfDuty.%d', i));
                }
            }
        }
    },

    // 城池是否在保护时间内
    isCityInProtectTime : function (city_id) {
        return false;
    },

    // 发送个人排行榜奖励
    sendPersonalRankMail : function () {
        var time = common.getTime();
        var ranks = this.getDayRankList();
        var mail = {
            awards : 'countrywar_personal_day',
            time : time,
            expire : time + gConfMail[31].time * OneDayTime,
            attach : {
                ranks : ranks,
                huge : 1,
            },
        };

        var worldReq = {
            mod : 'mail',
            act : 'add_sys_mail',
            uid : 1,
            args : {
                mail : mail,
            },
        };

        // 通知到所有世界服
        this.broadcastToAllWorld(worldReq, {}, function() {
            DEBUG('sendPersonalRankMail request a client over');
        });
    },

    // 发送周奖励邮件
    sendWeekRankMail : function () {
        var time = common.getTime();
        var ranks = this.getWeekRankList(); // 玩家排名
        var campRanks = this.getWeekRank(); // 阵营排名

        var playerRanks = {};
        for (var i = 0; i < ranks.length; i++) {
            var uid = ranks[i];
            var playerObj = {};
            playerObj.rank = i + 1;
            playerObj.camp = 0;
            var user = gUserInfo.getUser(uid);
            if (user)
                playerObj.camp = user.countryWar.camp;

            playerRanks[uid] = playerObj;
        }

        var campRank = [];
        for (var i = 0; i < campRanks.length; i++) {
            campRank.push(campRanks[i].country);
        }

        var mail = {
            awards : 'countrywar_personal_week',
            time : time,
            expire : time + gConfMail[32].time * OneDayTime,
            attach : {
                ranks : playerRanks,
                campRanks : campRank,
                huge : 1,
            },
        };

        var worldReq = {
            mod : 'mail',
            act : 'add_sys_mail',
            uid : 1,
            args : {
                mail : mail,
            },
        };

        // 通知到所有世界服
        this.broadcastToAllWorld(worldReq, {}, function() {
            DEBUG('sendWeekRankMail request a client over');
        });
    },

    broadcastToAllWorld : function (req, resp, callback) {
        for (var i = 1; i <= 3; i++) {
            for (var j = 0; j < this.serverList[i].length; j++) {
                var sid = this.serverList[i][j];
                this.broadcastToWorld(sid, req, resp, callback);
            }
        }
    },

    broadcastToWorld : function (serverId, req, resp, callback) {
        var serverInfo = gCountryWar.getServerInfo(serverId);
        if (serverInfo) {
            requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, resp, callback);
        }
    },

    // 获取国家总积分
    getCountryTotalScore : function () {
        var totalScore = 0;

        for (var i = 1; i <= 3; i++) {
            totalScore += this.serverStatics[i].score.week;
        }

        return totalScore;
    },

    // 获取国家积分列表
    getCountryScoreList : function () {
        var scoreList = {};
        for (var i = 1; i <= 3; i++) {
            var scoreObj = {}
            scoreObj.score = this.serverStatics.score[i].week;
            scoreList[i] = scoreObj;
        }

        return scoreList;
    },

    // 同步移动
    syncPlayerMove : function (uid, from, to) {
        var curTime = common.getTime();
        var key = from + '_' + to;
        if (!this.moveSync[key] || (this.moveSync[key] && this.moveSync[key].deleteTime < curTime)) {
            // 过期了
            this.moveSync[key] = {}
            this.moveSync[key].from = from;
            this.moveSync[key].to = to;
            this.moveSync[key].deleteTime = curTime + parseInt(gConfCountryWarBase.pathTime.value);

            var playerIds = gUserInfo.getRoomPlayers(this.roomId);
            if (playerIds.length > 0) {
                var userInfo = gUserInfo.getUser(uid);

                var worldReq = {
                    mod : 'countrywar',
                    act : 'sync_move',
                    uid : 1,
                    args : {
                        players : playerIds,
                        uid : uid,
                        un : userInfo.info.un,
                        hid : userInfo.pos[1].hid,
                        country : userInfo.countryWar.camp,
                        serverId : userInfo.countryWar.serverId,
                        weapon_illusion: userInfo.sky_suit.weapon_illusion,
                        wing_illusion: userInfo.sky_suit.wing_illusion,
                        from : from,
                        to : to,
                    },
                };

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastToAllWorld(worldReq, WorldResp, function() {
                    if (WorldResp.code == 0) {
                        DEBUG('sync_move request a client over ');
                    } else {
                        DEBUG('sync_move request a client error, desc = ' + WorldResp.desc);
                    }
                });
            }
        }
    },

    insertChatLog : function (chatInfo) {
        this.chatLog.unshift(chatInfo);
        if(this.chatLog.length > parseInt(gConfCountryWarBase.chatLogCountMax.value)) {
            this.chatLog.pop();
        }
    },

    getChatLog : function () {
        return this.chatLog;
    },

    insertShoutLog : function (chatInfo) {
        this.shoutLog.unshift(chatInfo);
        if(this.shoutLog.length > parseInt(gConfCountryWarBase.chatLogCountMax.value)) {
            this.shoutLog.pop();
        }
    },

    getShoutLog : function () {
        return this.shoutLog;
    },

    chat : function (chatInfo, camp, wholeRoom) {
        // 广播给在线玩家
        var onlinePlayerList = [];
        var act = 'chat';
        if (wholeRoom) {
            onlinePlayerList = gUserInfo.getRoomPlayers(this.roomId);
            act = 'shout';
        } else {
            onlinePlayerList = gUserInfo.getCampPlayers(this.roomId, camp);
        }

        if (onlinePlayerList.length > 0) {
            var worldReq = {
                mod : 'countrywar',
                act : act,
                uid : 1,
                args : {
                    players : onlinePlayerList,
                    info : chatInfo,
                },
            };

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastToAllWorld(worldReq, WorldResp, function() {
                if (WorldResp.code == 0) {
                    DEBUG('chat request a client over ');
                } else {
                    DEBUG('chat request a client error, desc = ' + WorldResp.desc);
                }
            });
        }

        // 记录聊天
        if (wholeRoom)
            this.insertShoutLog(chatInfo);
        else
            this.insertChatLog(chatInfo);
    },

    onPlayerEnterRoom : function (uid, camp, serverId) {
        if (!this.serverList[camp])
            return;

        if (this.serverList[camp].indexOf(serverId) < 0) {
            this.serverList[camp].push(serverId);
            this.markDirty('serverList');
        }

        // 处理一下在外面领取的阵营任务奖励
        if (this.taskAwardGetRecord && this.taskAwardGetRecord[uid]) {
            for (var i = 0; i < this.taskAwardGetRecord[uid].length; i++) {
                var taskObj = this.taskAwardGetRecord[uid][i];
                if (taskObj) {
                    gUserInfo.setCountryTaskAwardGot(uid, taskObj.taskType, taskObj.taskId)
                }
            }

            delete this.taskAwardGetRecord[uid];
            this.markDirty('taskAwardGetRecord');
        }
    },

    getEvents : function (cityId) {
        if (this.events[cityId])
            return this.events[cityId];
        return [];
    },

    // 添加事件
    addEvent : function (cityId, event_id, param1, param2, param3, param4, param5, param6) {

        if (!this.events) {
            this.events = {};
            this.markDirty('events');
        }

        if (!this.events[cityId]) {
            this.events[cityId] = [];
            this.markDirty(util.format('events.%d', cityId));
        }

        var eventObj = {};
        eventObj.time = common.getTime();
        eventObj.id = event_id;
        eventObj.param = [];

        if (param1)
            eventObj.param.push(param1);

        if (param2)
            eventObj.param.push(param2);

        if (param3)
            eventObj.param.push(param3);

        if (param4)
            eventObj.param.push(param4);

        if (param5)
            eventObj.param.push(param5);

        if (param6)
            eventObj.param.push(param6);

        var maxCount = 50;//parseInt(gConfTerritoryWarBase.eventRecordNum.value);
        if (this.events[cityId].length >= maxCount) {
            this.events[cityId].shift();
        }

        this.events[cityId].push(eventObj);
        this.markDirty(util.format('events.%d', cityId));
    },

    markTaskAwardGot : function (uid, taskType, taskId) {
        if (!this.taskAwardGetRecord){
            this.taskAwardGetRecord = {};
        }

        if (!this.taskAwardGetRecord[uid]) {
            this.taskAwardGetRecord[uid] = [];
        }

        for (var i = 0; i < this.taskAwardGetRecord[uid].length; i++) {
            var taskObj = this.taskAwardGetRecord[uid][i];
            if (taskObj && taskObj.taskType == taskType && taskObj.taskId == taskId) {
                return;
            }
        }

        var taskObj = {};
        taskObj.taskType = taskType;
        taskObj.taskId = taskId;
        this.taskAwardGetRecord[uid].push(taskObj);
        this.markDirty(util.format('taskAwardGetRecord.%d', uid));
    },

    isTaskAwardGot : function (uid, taskType, taskId) {
        if (!this.taskAwardGetRecord){
            return false;
        }

        if (!this.taskAwardGetRecord[uid]) {
            return false;
        }

        for (var i = 0; i < this.taskAwardGetRecord[uid].length; i++) {
            var taskObj = this.taskAwardGetRecord[uid][i];
            if (taskObj && taskObj.taskType == taskType && taskObj.taskId == taskId) {
                return true;
            }
        }

        return false;
    },

    getTaskGetRecord : function (uid) {
        if (!this.taskAwardGetRecord){
            return [];
        }

        if (!this.taskAwardGetRecord[uid]) {
            return [];
        }

        return this.taskAwardGetRecord[uid];
    },


    sortPlayers : function (a, b) {
        if ( (isDroid(a.uid) && isDroid(b.uid)) ||
            (!isDroid(a.uid) && !isDroid(b.uid))) {
            return a.position - b.position;
        } else if (!isDroid(a.uid) && isDroid(b.uid)) {
            return -1;
        }  else if (isDroid(a.uid) && !isDroid(b.uid)) {
            return 1;
        } else {
            return 1;
        }
    },

    // 获取指定城池指定阵营的玩家列表
    getCityCampPlayerList : function (cityId, camp) {
        var players = [];
        if (!this.cities[cityId])
            return players;

        for (var i = 0; i < this.cities[cityId].players[camp].length; i++) {
            var uid = this.cities[cityId].players[camp][i];
            var user = gUserInfo.getUser(uid);
            if (user) {
                var playerObj = {};
                playerObj.uid = uid;
                playerObj.un = user.info.un;
                playerObj.camp = camp;
                playerObj.serverId = user.countryWar.serverId;
                playerObj.fight_force = user.fight_force;
                playerObj.country = user.info.country;
                playerObj.position = user.info.position;
                playerObj.level = user.status.level;

                var positionInfo = gConfPosition[user.info.position];
                playerObj.score = parseInt(positionInfo.gloryRatio);

                players.push(playerObj);
            } else {
                var robot = this.getRobot(uid);
                if (robot) {
                    var playerObj = {};
                    playerObj.uid = uid;
                    playerObj.un = robot.un;
                    playerObj.camp = camp;
                    playerObj.serverId = 0;
                    playerObj.country = robot.country;
                    playerObj.fight_force = robot.fight_force;
                    playerObj.position = 32;
                    playerObj.level = robot.level;

                    var positionInfo = gConfPosition[32];
                    playerObj.score = parseInt(positionInfo.gloryRatio);

                    players.push(playerObj);
                }
            }
        }

        //players.sort(this.sortPlayers);

        return players;
    },
}

exports.Room = Room;
