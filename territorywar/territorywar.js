var LegionWarCom = require('../common/legionwar.js');
var ErrorCode = require('./error.js').ErrorCode;
var EventType = require('./error.js').EventType;

var tickInterval = 60 * 30;
var tickCount = 0;

function TerritoryWar() {
    // 领地列表
    this.territorys = {
        /*
        lid : {
            lid : 0,    // 军团id
            legionName : '', // 军团名称
            level : 0,
            legionWarLevel : 0;
            players : [],   // 玩家列表

            cells : {   // 格子列表，只记录有资源的
                id : {  // 格子id
                    x : 0,
                    y : 0,      // 格子坐标
                    resType : 0,    // 资源类型
                    resId : 0,      // 资源id
                    resParam : 0,   // 资源参数，如怪物耐力
                },
            },
            events : [],  // 事件列表

            // 本军团占领的矿
            mine : {
                1 : {
                    robCount : 0,   // 被掠夺次数
                    holdCells : [], // 占领的矿的格子id
                },
                2 : {
                    robCount : 0,   // 被掠夺次数
                    holdCells : [], // 占领的矿的格子id
                },
                3 : {
                    robCount : 0,   // 被掠夺次数
                    holdCells : [], // 占领的矿的格子id
                },
                4 : {
                    robCount : 0,   // 被掠夺次数
                    holdCells : [], // 占领的矿的格子id
                },
                5 : {
                    robCount : 0,   // 被掠夺次数
                    holdCells : [], // 占领的矿的格子id
                },
            },

            // 本军团访问的石碑列表
            stele : {
                1 : {
                    lid : 0,    // 石碑所在领地id
                    cellId : 0, // 石碑格子
                },
            },

            // 本军团访问的瞭望塔
            watchTower : [],

            // 目标军团
            enemies : [],

            // 本军团访问过的格子
            visitedCells : {
                lid : [],
            },

            // boss
            boss : {
                bossLevel : 0,
                bossIndex : 0,
                bossCellId : 0,
                curOwner : 0,   // 当前归属
                createLevel :０， //　创建BOSS时的军团等级
                damage : {  // 伤害
                    legions : {
                        lid : value,
                    },

                    // 对这个boss造成了伤害的玩家列表
                    damageRank : [{uid = 1, score = 0}, ],
                },
            },

            // 这个领地的服务器id
            servers : [],
        },
        */
    };

    // 连到这个领地战服的服务器列表
    this.servers = {};

    // 击杀排行
    this.killRank = [];

    this.dirty = {};            // 脏数据
    this.tDirty = { /* lid: name*/};           // 军团信息用的

    // 军团领地初始数据，只初始化一次，每个领地都是同样的
    this.initData = null;

    // 战报
    this.reports = {};

    // 领地的临时数据
    this.territorysMemData = {
        /*
        '1' : { // 领地id
            'battle_palyers' : {    // 战斗中的玩家
                'uid' : {
                    'battle_start_time' : 0,    // 战斗开始时间
                    'enemy_uid' : 0,            // 敌人的uid
                },
            },
        },
        */
    };

    // 军团表
    this.legions = {
        /*
        'lid' : {
            name : '',  // 军团名
            icon : '',  // 军团icon
            level : '', // 军团段位
            sid:'',//军团的服务器id
            leader:{} 军团长的信息
        }
         */
    };

    // 匹配等待队列
    this.waitMatchQueue = {
        /*
        boxId : {   // 盒子id
            startTime : 0,
            legions : { // 盒子里的军团
                lid : {
                    lastMatchTime : 0,  // 上一次匹配时间
                    matchCount : 0, // 匹配次数
                    isBase : 0, // 是否是基准军团
                    isRobot : 0,    // 是否是机器人
                    createLid : 0,  // 创建这个机器人的军团id
                }
            },
        },
         */
    };

    this.ai = 1;    // 机器人索引

    // 进入地方领地的格子id，建木树洞周围的一圈都是
    this.invadeCells = [];

    this.balance = 0;                       // 上次结算时间
    this.time = 0;                          // 上次每日更新时间
    this.weekTime = 0;                      // 上次每周更新时间
    this.bossCreateTime = 0;                // 上次刷新boss时间
    this.bossAwardTime = 0;                 // 上次boss发奖时间

    // 每个领地boss平均等级
    this.territoryBossAverageLevel = {};

    this.needResetByWeek = false;

    // 有一次性掉落的个子id
    this.onceElementCells = [];

    // 记录已经发过领地战邮件的军团id
    this.sendMindAwardLids = [];
}

TerritoryWar.create = function(callback){
    var territoryWarData = {
        '_id': 'territorywar',
        'territorys': {},
        'killRank': [],
        'initData' : {},
        'reports' : {},
        'legions' : {},
        'ai' : 0,
        'waitMatchQueue' : {},
        'balance' : 0,
        'time' : 0,
        'weekTime' : 0,
        'bossCreateTime' : 0,
        'bossAwardTime' : 0,
        'territoryBossAverageLevel' : 0,
        'mineAwardTime' : 0,
    };

    gDBWorld.insert(territoryWarData, function(err, result) {
        callback && callback();
    });
};

TerritoryWar.prototype = {
    init: function (callback) {
        var _me = this;

        gDBWorld.find({'_id': 'territorywar'}).limit(1).next(function (err, doc) {
            if (doc) {
                _me.killRank = doc.killRank;
                _me.initData = doc.initData;
                _me.reports = doc.reports;
                _me.legions = doc.legions;
                _me.ai = doc.ai;
                _me.waitMatchQueue = doc.waitMatchQueue;
                _me.balance = doc.balance;
                _me.time = doc.time;
                _me.weekTime = doc.weekTime;
                _me.bossCreateTime = doc.bossCreateTime;
                _me.bossAwardTime = doc.bossAwardTime;
                _me.territoryBossAverageLevel = doc.territoryBossAverageLevel;
                _me.servers = doc.servers;
                _me.mineAwardTime = doc.mineAwardTime;

                for (var lid in doc.territorys) {
                    _me.territorys[lid] = doc.territorys[lid];
                    _me.markTDirty(lid, '');
                }

                if (!Object.isEmpty(_me.tDirty)) {
                    gDBWorld.update({_id: 'territorywar'}, {$unset: {territorys: 1}});
                }

                var cursor = gDBTerritory.find({});
                cursor.each(function(err, item) {
                    if (err) {
                        callback && callback(false);
                    }

                    if (item) {
                        _me.territorys[item._id] = item;
                    } else {
                        _me._init(callback);
                    }
                });
            } else {
                callback && callback(false);
            }
        });
    },

    _init : function (callback) {
        if (Object.keys(this.territorys).length == 0) {
            LOG('============================ territorys length is 0 in _init, time = ' + common.getTime());
        }

        if (this.balance == 0 || this.time == 0 || this.weekTime == 0) {
            this.balance = common.getTime();                       // 上次结算时间
            this.time = common.getTime();                        // 上次每日更新时间
            this.weekTime = common.getTime();                     // 上次每周更新时间

            this.markDirty('balance');
            this.markDirty('time');
            this.markDirty('weekTime');
        }

        if (!this.servers) {
            this.servers = {};
            this.markDirty('servers');
        }

        if (!this.bossCreateTime) {
            this.bossCreateTime = common.getTime();
            this.markDirty('bossCreateTime');
        }

        if (!this.bossAwardTime) {
            this.bossAwardTime = common.getTime();
            this.markDirty('bossAwardTime');
        }

        if (!this.territoryBossAverageLevel) {
            this.territoryBossAverageLevel = {};
            this.markDirty('territoryBossAverageLevel');
        }

        if (!this.mineAwardTime) {
            this.mineAwardTime = 0;
            this.markDirty('mineAwardTime');
        }

        this.onceElementCells = [];
        this.sendMindAwardLids = [];

        if (!this.initData || Object.keys(this.initData).length == 0) {
            // 构建初始数据
            this.buildInitData();
        }

        this.initWaitMatchQueue();
        this.initOnceElement();

        if (!this.ai) {
            this.ai = 1;
            this.markDirty('ai');
        }

        if (!this.waitMatchQueue) {
            this.waitMatchQueue = {};
        }

        if (!this.legions) {
            this.legions = {};
        }

        for (var lid in this.territorys) {
            var legionInfo = this.getLegionInfo(parseInt(lid));
            if (legionInfo) {
                if (this.territorys[lid].level == undefined) {
                    this.territorys[lid].level = legionInfo.level;
                    this.markTDirty(lid, 'level');
                }

                if (this.territorys[lid].legionWarLevel == undefined) {
                    this.territorys[lid].legionWarLevel = legionInfo.legionWarLevel;
                    this.markTDirty(lid, 'legionWarLevel');
                }

                if (!this.territorys[lid].legionName) {
                    this.territorys[lid].legionName = legionInfo.name;
                    this.markTDirty(lid, 'legionName');
                }
            } else {
                if (this.territorys[lid].level == undefined) {
                    this.territorys[lid].level = 1;
                    this.markTDirty(lid, 'level');
                }

                if (this.territorys[lid].legionWarLevel == undefined) {
                    this.territorys[lid].legionWarLevel = 0;
                    this.markTDirty(lid, 'legionWarLevel');
                }

                if (!this.territorys[lid].legionName) {
                    this.territorys[lid].legionName = '服霸';
                    this.markTDirty(lid, 'legionName');
                }
            }

            if (!this.territorys[lid].lid) {
                this.territorys[lid].lid = parseInt(lid);
                this.markTDirty(lid, 'lid');
            }

            if (!this.territorys[lid].icon) {
                this.territorys[lid].icon = [1, 1];
                this.markTDirty(lid, 'icon');
            }

            if (this.territorys[lid].isRobot == undefined) {
                this.territorys[lid].isRobot = false;
                this.markTDirty(lid, 'isRobot');
            }

            if (!this.territorys[lid].enemies) {
                this.territorys[lid].enemies = [];
                this.markTDirty(lid, 'enemies');
            }

            if (!this.territorys[lid].visitedCells) {
                this.territorys[lid].visitedCells = {};
                this.territorys[lid].visitedCells[lid] = [];
                this.territorys[lid].visitedCells[lid].push(parseInt(gConfTerritoryWarBase.initialPos.value));
                this.markTDirty(lid, 'visitedCells');
            }

            if (!util.isArray(this.territorys[lid].events)) {
                this.territorys[lid].events = [];
                this.markTDirty(lid, 'events');
            }

            if (!this.territorys[lid].mine) {
                this.territorys[lid].mine = {};
                for (var i = 1; i <= 5; i++) {
                    this.territorys[lid].mine[i] = {};
                    this.territorys[lid].mine[i].robCount = 0;   // 被掠夺次数
                    this.territorys[lid].mine[i].holdCells = []; // 占领的矿的格子id
                }
                this.markTDirty(lid, 'mine');
            }

            if (!this.territorys[lid].watchTower) {
                this.territorys[lid].watchTower = [];
                this.markTDirty(lid, 'watchTower');
            }

            if (!this.territorys[lid].boss) {
                this.territorys[lid].boss = {};
                this.territorys[lid].boss.bossLevel = 0;
                this.territorys[lid].boss.bossIndex = 0;
                this.territorys[lid].boss.bossCellId = 0;
                this.territorys[lid].boss.curOwner = 0;
                this.territorys[lid].boss.damage = {};
                this.territorys[lid].boss.damage.legions = {};
                this.territorys[lid].boss.damage.damageRank = [];
                this.markTDirty(lid, util.format('boss'));
            }

            if (!this.territorys[lid].stele) {
                this.territorys[lid].stele = {};
                this.markTDirty(lid, 'stele');
            }

            if (!this.territorys[lid].players) {
                this.territorys[lid].players = [];
                this.markTDirty(lid, 'players');
            }

            if (!this.territorys[lid].servers) {
                this.territorys[lid].servers = [];
                this.markTDirty(lid, 'servers');
            } else {
                var tmpServers = [];
                for (var k = 0; k < this.territorys[lid].servers.length; k++) {
                    var sid = this.territorys[lid].servers[k];
                    if (tmpServers.indexOf(sid) < 0) {
                        tmpServers.push(sid);
                    }
                }

                this.territorys[lid].servers = tmpServers;
                this.markTDirty(lid, 'servers');
            }

            if (this.territorys[lid].enemies.length == 0 && !this.isInWaitMatchQueue(lid) &&
                Object.keys(this.territorys[lid].stele).length >= parseInt(gConfTerritoryWarBase.invadeLimit.value)) {

                if (this.territorys[lid].isRobot) {
                    // 没有敌人也没有等待匹配的机器人
                    continue;
                } else {
                    // 没有敌人并且没有在等待队列，加入到等待匹配队列
                    // 问老魏
                    this.requestLegionInfo(lid);

                    // var boxId = 0;
                    // if (this.territorys[lid].level <= 3) {
                    //     boxId = 0;
                    // } else {
                    //     boxId = this.territorys[lid].legionWarLevel;
                    // }

                    // this.insertWaitMatchLegion(boxId, lid, true, false, 0);
                }
            }
        }

        if (Object.keys(this.legions).length == 0) {
            this.notifyWorldServerTerritoryWarReset();
        }

        this.initInvadeCells();
        callback && callback(true);
    },

    // 注册服务器
    registerServer : function (sid, ip, port, openTime) {
        if (this.servers[sid]) {
            // if (this.servers[sid][0] != ip) {
                this.servers[sid] = [ip, port, openTime];
                this.markDirty(util.format('servers.%d', sid));
            // }
        } else {
            this.servers[sid] = [ip, port, openTime];
            this.markDirty(util.format('servers.%d', sid));
        }
    },

    // 初始化入侵点
    initInvadeCells : function () {
        if (!this.invadeCells) {
            this.invadeCells = [];
        }

        var invadePos = +gConfTerritoryWarBase.invadePos.value;
        var cellData = gConfTerritoryWarMapGrid[invadePos];

        var posX = cellData.pos[0];
        var posY = cellData.pos[1];

        var posArr = [];
        posArr.push([posX, posY - 1]);
        posArr.push([posX, posY + 1]);
        posArr.push([posX - 1, posY]);
        posArr.push([posX + 1, posY]);
        posArr.push([posX + 1, posY - 1]);
        posArr.push([posX - 1, posY + 1]);

        for (var cellId in gConfTerritoryWarMapGrid) {
            var pos = gConfTerritoryWarMapGrid[cellId].pos;
            for (var i = 0; i < posArr.length; i++) {
                if (pos[0] == posArr[i][0] && pos[1] == posArr[i][1]) {
                    this.invadeCells.push(cellId);
                }
            }
        }
    },

    insertServer : function (lid, sid) {
        if (!this.territorys[lid])
            return;

        if (!this.territorys[lid].servers) {
            this.territorys[lid].servers = [];
            this.markTDirty(lid, 'servers');
        }

        if (this.territorys[lid].servers.indexOf(sid) >= 0)
            return;

        this.territorys[lid].servers.push(sid);
        this.markTDirty(lid, 'servers');
    },

    getInvadeCells : function () {
        return this.invadeCells;
    },

    initWaitMatchQueue : function () {
        if (!this.waitMatchQueue) {
            this.waitMatchQueue = {};
        }

        for (var id in gConfLegionWarRank) {
            if (!this.waitMatchQueue[id]) {
                this.waitMatchQueue[id] = {};
                this.waitMatchQueue[id].legions = {};   // 公会列表
                this.waitMatchQueue[id].startTime = 0;  // 开始计时
            }
        }

        // 1~3级的军团都放0里面
        if (!this.waitMatchQueue[0]) {
            this.waitMatchQueue[0] = {}
            this.waitMatchQueue[0].legions = {};   // 公会列表
            this.waitMatchQueue[0].startTime = 0;  // 开始计时
        }

        this.markDirty('waitMatchQueue');
    },

    // 检查一个军团有没有在等待匹配
    isInWaitMatchQueue : function (lid) {
        for (var boxId in this.waitMatchQueue) {
            if (this.waitMatchQueue[boxId].legions[lid]) {
                return true;
            }
        }

        return false;
    },

    processWaitMatchQueue : function () {
        var curTime = common.getTime();
        for (var boxId in this.waitMatchQueue) {
            boxId = parseInt(boxId);

            if (boxId > 0 && boxId < 1000) {
                for (var legionId in this.waitMatchQueue[boxId].legions) {
                    legionId = parseInt(legionId);
                    var matchObj = this.waitMatchQueue[boxId].legions[legionId];
                    if (matchObj && matchObj.isBase && matchObj.lastMatchTime + 4*3600 <= curTime) {
                        var range = 0;
                        if (matchObj.count == 0) {
                            range = 1;
                        } else if (matchObj.count == 1) {
                            range = 2;
                        } else if (matchObj.count == 2) {
                            range = 3;
                        }

                        var matched = false;
                        if (range > 0) {
                            for (var index = boxId + range; index >= boxId - range && index > 0; index--) {
                                if (index > 0 && index != boxId) {
                                    // 丢一个到附近的盒子里
                                    matched = this.insertWaitMatchLegion(index, legionId, false, false, 0);
                                    if (matched)
                                        break;
                                }
                            }
                        }

                        if ((range == 0 || range >= 3) && !matched) {
                            // 添加一个机器人
                            var robotId = this.createRobot();
                            matched = this.insertWaitMatchLegion(boxId, robotId, false, true, legionId);
                            LOG('============ insert a robot legion, id = ' + robotId);
                        }

                        if (matched) {
                            // 已经匹配走了
                            LOG('============== matched box = ' + boxId);
                            continue;
                        }

                        // 匹配次数加1
                        matchObj = this.waitMatchQueue[boxId].legions[legionId];    // 再取一次，有可能不在了
                        if (matchObj) {
                            matchObj.count += 1;
                            matchObj.lastMatchTime += 4 * 3600;
                            LOG('======== processWaitMatchQueue box = ' + boxId + ', count = ' + matchObj.count + ', matchTime = ' + matchObj.lastMatchTime);
                        }

                        this.markDirty(util.format('waitMatchQueue.%d', boxId));
                    }
                }
            } else if (boxId == 0 || boxId >= 1000){
                for (var legionId in this.waitMatchQueue[boxId].legions) {
                    var matchObj = this.waitMatchQueue[boxId].legions[legionId];
                    if (matchObj && matchObj.isBase) {

                        if (matchObj.count == 0) {
                            if (curTime >= matchObj.lastMatchTime + 12 * 3600) {
                                // 添加一个机器人
                                var robotId = this.createRobot();
                                this.insertWaitMatchLegion(boxId, robotId, false, true, legionId);
                                matchObj.count += 1;
                                this.markDirty(util.format('waitMatchQueue.%d', boxId));
                            }
                        } else if (matchObj.count == 1) {
                            if (curTime >= matchObj.lastMatchTime + 18 * 3600) {
                                // 添加一个机器人
                                var robotId = this.createRobot();
                                this.insertWaitMatchLegion(boxId, robotId, false, true, legionId);
                                matchObj.count += 1;
                                this.markDirty(util.format('waitMatchQueue.%d', boxId));
                            }
                        }
                     }
                }
            }
        }
    },

    processFightState : function () {
        var curTime = common.getTime()
        for (var lid in this.territorysMemData) {
            var legionPlayers = this.territorysMemData[lid];
            for (var uid in legionPlayers.battle_palyers) {
                if (curTime > legionPlayers.battle_palyers[uid].battle_start_time + gConfTerritoryWarBase.combatLockTime.value) {
                    delete legionPlayers.battle_palyers[uid]
                    this.onFightStateChange(uid, lid);
                }
            }
        }
    },

    getNewLegionName : function () {
        var max = Object.keys(gConfLegionName).length;
        var index = common.randRange(1, max);
        return gConfLegionName[index].name;
    },

    // 创建一个机器人
    createRobot : function (lid) {
        var legionId = lid;
        if (!legionId) {
            legionId = this.ai++
        }

        var territoryData = clone(this.initData);
        territoryData.lid = legionId;
        territoryData.legionName = this.getNewLegionName();
        territoryData.level = 1;
        territoryData.legionWarLevel = 0;
        territoryData.isRobot = true;

        var legionInfo = {};
        legionInfo.lid = legionId;
        legionInfo.name = territoryData.legionName;
        legionInfo.icon = [1, 1];
        legionInfo.level = 1;
        legionInfo.legionWarLevel = 0;
        this.updateLegionInfo(legionId, legionInfo);

        this.territorys[legionId] = territoryData;
        this.markTDirty(legionId, '');
        this.markDirty('ai');

        this.createBoss(legionId);

        return legionId;
    },

    removeLegionFromWaitMatchQueue : function (lid) {
        lid = parseInt(lid);
        for (var boxId in this.waitMatchQueue) {
            boxId = parseInt(boxId);
            if (this.waitMatchQueue[boxId].legions[lid]) {
                if (this.waitMatchQueue[boxId].legions[lid].isBase) {
                    // 检查有没有他创建的机器人，要一起移除
                    for (var legionId in this.waitMatchQueue[boxId].legions) {
                        legionId = parseInt(legionId);
                        if (this.waitMatchQueue[boxId].legions[legionId].isRobot &&
                            this.waitMatchQueue[boxId].legions[legionId].createLid == lid) {
                            delete this.waitMatchQueue[boxId].legions[legionId];
                        }
                    }
                }

                delete this.waitMatchQueue[boxId].legions[lid];

                if (Object.keys(this.waitMatchQueue[boxId].legions).length == 0) {
                    this.waitMatchQueue[boxId].startTime = 0;
                }

                this.markDirty(util.format('waitMatchQueue.%d', boxId));
            }
        }
    },

    clearDBTerritorys : function() {
        if (this.needResetByWeek) {
            // 清理数据库
            gDBTerritory.remove({}, function () {

            });

            this.needResetByWeek = false;
        }
    },

    saveTerritory: function (callback) {
        if (Object.keys(this.tDirty).length == 0) {
            this.clearDBTerritorys();
            callback && callback(true);
            return;
        }

        var suss = true;
        var loader = new common.Loader(function () {
            DEBUG('territory saved');
            gTerritoryWar.clearDBTerritorys();

            callback && callback(suss);
        });
        loader.addLoad('empty');

        this.arrangeTDirty();
        var updates = {};
        for (var lid in this.tDirty) {
            for (var item in this.tDirty[lid]) {
                var obj = this.territorys[lid];
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
                    if (!updates[lid])
                        updates[lid] = {};

                    updates[lid][item] = obj;
                } else {
                    ERROR('INVALID SAVE TERRITORYWAR: ' + item);
                }
            }

            loader.addLoad(lid);
            gDBTerritory.update({_id: +lid}, {$set: updates[lid]}, {upsert : true}, function (err, result) {
                if (err) {
                    ERROR({updates: updates[this], err: err});
                    suss = false;
                    loader.onLoad(this.toString());
                } else {
                    loader.onLoad(this.toString());
                }
            }.bind(lid));
        }

        loader.onLoad('empty');
        this.tDirty = {};
    },

    save: function (callback) {
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
                ERROR('INVALID SAVE TERRITORYWAR: ' + item);
            }
        }

        var _me = this;
        this.dirty = {};
        gDBWorld.update({_id: 'territorywar'}, {$set: updates}, function (err, result) {
            if (err) {
                ERROR({updates: updates, err: err});
                callback && callback(false);
            } else {

                _me.saveTerritory(callback)
            }
        });
    },

    tick : function () {
        this.processWaitMatchQueue();
        this.processFightState();
        gUserInfo.tick();
    },

    tickFunc : function () {
        // 每日晚9点定时发奖励邮件
        var now = common.getTime();
        var balanceTime = this.getBalanceTime();
        if (this.balance < balanceTime && now + tickInterval > balanceTime) {
            var timeout = balanceTime - now;
            if (timeout < 0) {
                timeout = 0;
            }
            setTimeout(function(){
                gTerritoryWar.calcMineAwards();
            }, timeout * 1000);
        }

        // 每日boss刷新
        var birthTime = this.getBossCreateTime();
        if (this.bossCreateTime < birthTime && now + tickInterval > birthTime) {
            var timeout = birthTime - now;
            if (timeout < 0) {
                timeout = 0;
            }
            setTimeout(function(){
                gTerritoryWar.createAllBoss();
            }, timeout * 1000);
        }

        // 每日boss奖励
        var bossAwardTime = this.getBossSendAwardTime();
        if (this.bossAwardTime < bossAwardTime && now + tickInterval > bossAwardTime) {
            var timeout = bossAwardTime - now;
            if (timeout < 0) {
                timeout = 0;
            }
            setTimeout(function(){
                gTerritoryWar.calcBossAwards();
            }, timeout * 1000);
        }

        //LOG(new Error().stack);
        var todayTime = getResetTime();
        var nextDayTime = todayTime + 86400;
        if (this.time < todayTime || (this.time < nextDayTime && now + tickInterval > nextDayTime)) {
            var resetWeek = false;
            var thisWeekTime = getWeekResetTime();
            var nextWeekTime = thisWeekTime + 86400*7;
            if (this.weekTime < thisWeekTime || (this.weekTime < nextWeekTime && now + tickInterval > nextWeekTime)) {
                resetWeek = true;
            }

            var timeout = 0;
            if (this.time >= todayTime) {
                timeout = (nextDayTime - now) * 1000;
            }

            if (timeout < 0) {
                timeout = 0;
            }

            setTimeout(function() {
                // 每日重置
                gTerritoryWar.resetByDay();

                // 每周重置
                if (resetWeek) {
                    gTerritoryWar.resetByWeek();
                }
            }, timeout);
        }
    },

    // 获取当日结算时间
    getBalanceTime : function() {
        var dateStr = common.getDateString();
        var hour = Math.floor(gConfGlobal.arenaBalanceTime);
        var mins = Math.floor((gConfGlobal.arenaBalanceTime%1)*60);

        return Date.parse(dateStr + " " + hour + ":"+mins +":00")/1000;
    },

    // 添加战报
    addReport: function(uid1, uid2, replay, win, consume1, consume2, legionName1, legionName2, legionIcon1, legionIcon2) {
        var reports1 = this.reports[uid1];
        if (!reports1) {
            reports1 = this.reports[uid1] = [];
        }

        var replayKey = gReplay.addReplay(replay);
        var report1 = [common.getTime(), win, uid2, consume1, legionName2, legionIcon2, replayKey];
        reports1.push(report1);
        if (reports1.length > gConfGlobal.arenaReportCount) {
            reports1.shift();
        }

        var report2 = report1.slice();
        report2[1] = win ? 0 : 1;
        report2[2] = uid1;
        report2[3] = consume2;
        report2[4] = legionName1;
        report2[5] = legionIcon1;

        var reports2 = this.reports[uid2];
        if (!reports2) {
            reports2 = this.reports[uid2] = [];
        }

        reports2.push(report2);
        if (reports2.length > gConfGlobal.arenaReportCount) {
            reports2.shift();
        }

        this.markDirty('reports.' + uid1);
        this.markDirty('reports.' + uid2);
    },

    markDirty: function(name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    markTDirty: function(lid, name, force, callback) {
        if (!this.tDirty[lid])
            this.tDirty[lid] = {};

        if (name != '') {
            this.tDirty[lid][name] = 0;
        } else {
            for (var item in this.territorys[lid]) {
                this.markTDirty(lid, item);
            }
        }

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

    arrangeTDirty: function () {
        var arrangedDirty = {};
        for (var lid in this.tDirty) {
            for (var item in this.tDirty[lid]) {
                var needRemove = [];
                var addNew = true;
                var levels = item.split('.');
                for (var eitem in arrangedDirty[lid]) {
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
                    delete arrangedDirty[lid][removeItem];
                });

                if (addNew) {
                    if (!arrangedDirty[lid])
                        arrangedDirty[lid] = {};

                    arrangedDirty[lid][item] = this.tDirty[item];
                }
            }
        }

        this.tDirty = arrangedDirty;
    },

    initOnceElement : function () {
        this.onceElementCells = [];
        var cellCount = Object.keys(gConfTerritoryWarMapGrid).length;
        for (var i = 1; i <= cellCount; i++) {
            if (gConfTerritoryWarMapGrid[i].onceElement.length > 0) {
                // 有一次性掉落
                this.onceElementCells.push(i);
            }
        }
    },

    // 构建领地初始化数据
    buildInitData : function () {
        this.initData = {};
        this.initData.lid = 0;
        this.initData.legionName = '';
        this.initData.players = [];
        this.initData.cells = {};
        this.initData.events = [];
        this.initData.mine = {};
        for (var i = 1; i <= 5; i++) {
            this.initData.mine[i] = {};
            this.initData.mine[i].robCount = 0;   // 被掠夺次数
            this.initData.mine[i].holdCells = []; // 占领的矿的格子id
        }
        this.initData.stele = {};
        this.initData.watchTower = [];
        this.initData.enemies = [];
        this.initData.visitedCells = {};
        this.initData.isRobot = false;  // 是否是机器人

        this.initData.boss = {};
        this.initData.boss.bossLevel = 0;
        this.initData.boss.bossIndex = 0;
        this.initData.boss.bossCellId = 0;
        this.initData.boss.curOwner = 0;
        this.initData.boss.damage = {};
        this.initData.boss.damage.legions = {};
        this.initData.boss.damage.damageRank = [];

        // 初始化格子上的资源
        var emptyCell = [];
        var cellCount = Object.keys(gConfTerritoryWarMapGrid).length;
        for (var i = 1; i <= cellCount; i++) {
            if (gConfTerritoryWarMapGrid[i].immobilizationElement != '') {
                this.initData.cells[i] = {};
                this.initData.cells[i].x = gConfTerritoryWarMapGrid[i].pos[0];
                this.initData.cells[i].y = gConfTerritoryWarMapGrid[i].pos[1];

                var elementInfo = gConfTerritoryWarMapGrid[i].immobilizationElement.split('.');
                if (elementInfo[0] == 'element') {
                    this.initData.cells[i].resType = TerriToryWarResourceType.ELEMENT;
                } else if (elementInfo[0] == 'mine') {
                    this.initData.cells[i].resType = TerriToryWarResourceType.MINE;
                } else if (elementInfo[0] == 'creature') {
                    this.initData.cells[i].resType = TerriToryWarResourceType.CREATURE;
                }

                this.initData.cells[i].resId = parseInt(elementInfo[1]);
                this.initData.cells[i].resParam = 100;
            } else {
                if (parseInt(gConfTerritoryWarMapGrid[i].isRandomElement) != 0) {
                    emptyCell.push(i);
                }
            }
        }

        // 初始化随机内容
        for (var i in gConfTerritoryWarMapElement) {
            if (gConfTerritoryWarMapElement[i].randomNum > 0) {
                for (var j = 0; j < gConfTerritoryWarMapElement[i].randomNum; j++) {
                    var index = common.randRange(0, emptyCell.length - 1);
                    var cellId = emptyCell[index];

                    if (!gConfTerritoryWarMapGrid[cellId]) {
                        DEBUG('cell is null id is ' + cellId);
                        var a = 0;
                    }
                    this.initData.cells[cellId] = {};
                    this.initData.cells[cellId].x = gConfTerritoryWarMapGrid[cellId].pos[0];
                    this.initData.cells[cellId].y = gConfTerritoryWarMapGrid[cellId].pos[1];
                    this.initData.cells[cellId].resType = TerriToryWarResourceType.ELEMENT;
                    this.initData.cells[cellId].resId = i;
                    this.initData.cells[cellId].resParam = 0;

                    emptyCell.splice(index, 1);
                }
            }
        }

        this.markDirty('initData');
    },

    createAllBoss : function () {
        for (var lid in this.territorys) {
            this.createBoss(lid);
        }

        this.bossCreateTime = common.getTime();
        this.markDirty('bossCreateTime');
    },

    // 生成boss
    createBoss : function (lid) {
        if (!this.territorys[lid]) {
            return;
        }

        if (!this.territorys[lid].boss) {
            this.territorys[lid].boss = {};
            this.territorys[lid].boss.bossLevel = 0;
            this.territorys[lid].boss.bossIndex = 0;
            this.territorys[lid].boss.bossCellId = 0;
            this.territorys[lid].boss.curOwner = 0;
            this.territorys[lid].boss.damage = {};
            this.territorys[lid].boss.damage.legions = {};
            this.territorys[lid].boss.damage.damageRank = [];
            this.markTDirty(lid, 'boss');
        }

        if (this.territorys[lid].boss.bossLevel != 0) {
            return;
        }

        var curTime = common.getTime();
        var beginTime = this.getBossCreateTime();
        var endTime = this.getBossEndTime();
        if (curTime < beginTime || curTime >= endTime) {
            return;
        }

        var legionInfo = this.getLegionInfo(lid);
        if (!legionInfo)
            return;

        var legionLevel = legionInfo.level;
        if (!legionLevel) {
            legionLevel = 1;
        }

        var maxBossLevel = gConfTerritoryBossLegionConf[legionLevel].levelMax;
        var minBossLevel = gConfTerritoryBossLegionConf[legionLevel].levelMin;
        var bossLevel = minBossLevel;
        if (this.territoryBossAverageLevel[lid] > 0) {
            bossLevel = Math.max(Math.min(maxBossLevel, this.territoryBossAverageLevel[lid]), minBossLevel);
        }

        var bossForceConf = gConfTerritoryBossForce[bossLevel];
        var bossIndex = common.randRange(0, bossForceConf.battleId.length - 1);

        var bossPosArr = gConfTerritoryWarBase.bossPos.value;
        var randPos = common.randRange(0, bossPosArr.length - 1);
        var bossCellId = bossPosArr[randPos];

        // temp fix
        if(!this.territorys[lid].cells) {
            this.territorys[lid].cells = {}
        }

        this.territorys[lid].cells[bossCellId] = {};
        this.territorys[lid].cells[bossCellId].resId = bossLevel;
        this.territorys[lid].cells[bossCellId].resType = TerriToryWarResourceType.BOSS;
        this.territorys[lid].cells[bossCellId].resParam = bossIndex;
        this.territorys[lid].cells[bossCellId].x = gConfTerritoryWarMapGrid[bossCellId].pos[0];
        this.territorys[lid].cells[bossCellId].y = gConfTerritoryWarMapGrid[bossCellId].pos[1];

        this.territorys[lid].boss.bossLevel = bossLevel;
        this.territorys[lid].boss.bossIndex = bossIndex;
        this.territorys[lid].boss.bossCellId = bossCellId;
        this.territorys[lid].boss.createLevel = legionLevel;    // 记下创建boss时的军团等级

        this.markTDirty(lid, 'cells');
        this.markTDirty(lid, 'boss');

        // 通知在线玩家刷新
        this.notifyBossBirth(lid);
    },

    // 通知boss出生
    notifyBossBirth : function (lid) {
        var bossCellId = this.territorys[lid].boss.bossCellId;
        var bossInfo = this.territorys[lid].cells[bossCellId]

        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var user = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == lid) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        var bossData = {};
        bossData.bossLevel = bossInfo.resId;
        bossData.bossIndex = bossInfo.resParam;
        bossData.bossCellId = bossCellId;

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'boss_birth',
                uid : 1,
                args : {
                    players : playerIds,
                    uid : 1,
                    boss : bossData,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('boss_birth to world finish!');
                } else {
                    DEBUG('boss_birth to world failed!');
                }
            });
        }
    },

    // 插入一个等待匹配的军团
    insertWaitMatchLegion : function (boxId, lid, isBase, isRobot, createLid) {
        boxId = parseInt(boxId);
        lid = parseInt(lid);
        if (!this.territorys[lid]) {
            return false;
        }

        if (this.territorys[lid] && this.territorys[lid].enemies.length > 0) {
            return false;
        }

        if (this.waitMatchQueue[boxId] && this.waitMatchQueue[boxId].legions[lid]) {
            return false;
        }

        var matchObj = {};
        matchObj.lastMatchTime = common.getTime();
        matchObj.count = 0;
        matchObj.isBase = isBase;
        matchObj.isRobot = isRobot;
        matchObj.createLid = createLid;

        if (!this.waitMatchQueue[boxId]) {
            this.waitMatchQueue[boxId] = {};
            this.waitMatchQueue[boxId].legions = {};
            this.waitMatchQueue[boxId].startTime = 0;
        }
        this.waitMatchQueue[boxId].legions[lid] = matchObj;
        this.markDirty(util.format('waitMatchQueue.%d', boxId));

        var curCount = Object.keys(this.waitMatchQueue[boxId].legions).length;
        if (curCount == 1) {
            this.waitMatchQueue[boxId].startTime = common.getTime();
        } else if (curCount >= parseInt(gConfTerritoryWarBase.legionNumLimit.value)) {
            // 盒子满了，将这个盒子里的军团放在一组
            var removeIds = [];
            for (var legionId in this.waitMatchQueue[boxId].legions) {
                var territory = this.territorys[legionId];
                if (territory) {
                    for (var subLid in this.waitMatchQueue[boxId].legions) {
                        if (subLid != legionId) {
                            var enemyLid = parseInt(subLid)
                            if (territory.enemies.indexOf(enemyLid) < 0 &&
                                territory.enemies.length < parseInt(gConfTerritoryWarBase.legionNumLimit.value) - 1){
                                territory.enemies.push(enemyLid);
                            }

                            if (removeIds.indexOf(subLid) < 0) {
                                removeIds.push(subLid);
                            }
                        }
                    }

                    this.markTDirty(legionId, 'enemies', true);

                    // 事件处理
                    this.addEvent(legionId, EventType.EVENT_MATCH_ENEMY);
                }
            }

            // 清空盒子
            for (var legionId in this.waitMatchQueue[boxId].legions) {
                delete this.waitMatchQueue[boxId].legions[legionId];
            }
            this.waitMatchQueue[boxId].startTime = 0;
            this.markDirty(util.format('waitMatchQueue.%d', boxId));

            // 将这几个军团id从所有的盒子里移除
            for (var i = 0; i< removeIds.length; i++) {
                this.removeLegionFromWaitMatchQueue(removeIds[i]);
            }

            return true;
        }

        return false;
    },

    // 初始化军团领地数据
    initLegionTerritory : function (lid, name, legionLevel, legionWarLevel, legionIcon) {
        var territoryData = clone(this.initData);
        territoryData.lid = lid;
        territoryData.legionName = name;
        territoryData.level = legionLevel;
        territoryData.legionWarLevel = legionWarLevel;
        territoryData.icon = legionIcon;
        this.territorys[lid] = territoryData;

        this.markTDirty(lid, '');

        var boxId = 0;
        if (legionLevel <= 3) {
            // 小于3级的都放一个盒子
            boxId = 0;
        } else {
            boxId = legionWarLevel;
        }
    },

    // 判断格子能不能走
    canWalk : function (lid, cellId) {
        if (!gConfTerritoryWarMapGrid[cellId]) {
            return false;
        }

        return true;
    },

    getTerritory : function (lid) {
        return this.territorys[lid];
    },

    // 玩家获取领地数据
    getTerritoryData : function (uid, lid, lname, legionLevel, legionWarLevel, legionIcon, serverId, gatherRecord,leader) {
        var data = {};

        var userInfo = gUserInfo.getUser(uid);
        var curLid = userInfo.territoryWar.pos.lid; // 玩家当前所在领地id

        // 更新军团信息
        if (!this.legions[lid]) {
            var legionInfo = {};
            legionInfo.lid = lid;
            legionInfo.name = lname;
            legionInfo.icon = legionIcon;
            legionInfo.level = (legionLevel > 0 ? legionLevel : 1);
            legionInfo.legionWarLevel = legionWarLevel;
            legionInfo.sid = serverId; 
            legionInfo.leader = leader;
            this.updateLegionInfo(lid, legionInfo);
        } else {
            this.updateLegionNameAndIcon(lid, lname, legionIcon, legionLevel,serverId,leader);
        }

        var legionData = this.getLegionInfo(lid);

        if (curLid == lid) {
            // 进的是自己的领地
            if (!this.territorys[lid]) {
                this.initLegionTerritory(lid, legionData.name, legionData.level, legionData.legionWarLevel, legionData.icon);
            }
        } else {
            // 进的是别人的领地
            if (!this.territorys[curLid]) {
                var legionInfo = this.getLegionInfo(curLid);
                if (legionInfo) {
                    this.initLegionTerritory(curLid, legionInfo.name, legionInfo.level, legionInfo.legionWarLevel, legionInfo.icon);
                }
            }

            if (!this.territorys[curLid]){
                // 踢回自己的领地
                var transferData = gConfTerritoryWarTransfer[1];
                var cellId = parseInt(gConfTerritoryWarBase[transferData.target].value);

                gTerritoryWar.onPlayerEnter(uid, lid, cellId, serverId);
                return data;
            } else {
                if (this.territorys[curLid].enemies.indexOf(lid) < 0) {
                    // 当前所在领地不是敌人领地中的任何一个，踢回自己领地，bug了
                    var transferData = gConfTerritoryWarTransfer[1];
                    var cellId = parseInt(gConfTerritoryWarBase[transferData.target].value);

                    gTerritoryWar.onPlayerEnter(uid, lid, cellId, serverId);
                    return data;
                }
            }
        }

        var enemies = this.getEnemy(lid);
        if (enemies.length == 0 && !this.isInWaitMatchQueue(lid) &&
            legionLevel >= parseInt(gConfTerritoryWarBase.portalOpenLevel.value)) {
            // 当前没有敌人，也没有在匹配队列，但是军团等级已经到传送门开启等级了，肯定是哪里出错了
            this.updateLegionLevel(lid, legionLevel, legionWarLevel, serverId);

            LOG('error! legion level enough, but not has enemy and not in match table');
        }

        if (this.territorys[lid]) {
            if (this.territorys[lid].legionWarLevel == undefined) {
                this.territorys[lid].legionWarLevel = legionData.legionWarLevel;
            }

            if (this.territorys[lid].level == undefined) {
                this.territorys[lid].level = legionData.level;
            }

            if (!this.territorys[lid].legionName) {
                this.territorys[lid].legionName = legionData.name;
            }

            if (!this.territorys[lid].icon) {
                this.territorys[lid].icon = legionData.icon;
            }
        }

        if (this.territorys[curLid]){
            if (this.territorys[curLid].players.indexOf(uid) < 0) {
                var transferData = gConfTerritoryWarTransfer[1];
                var cellId = parseInt(gConfTerritoryWarBase[transferData.target].value);

                gTerritoryWar.onPlayerEnter(uid, lid, cellId, serverId);
            }

            this.createBoss(curLid);

            // 玩家列表，需要玩家id，军团id，玩家名，坐标
            var playerList = {};
            for (var i = 0; i < this.territorys[curLid].players.length; i++) {
                var playerInfo = {};

                var user = gUserInfo.getUser(this.territorys[curLid].players[i]);
                if (user) {
                    if (user.territoryWar.pos.lid == curLid) {
                        playerInfo.uid = this.territorys[curLid].players[i];
                        playerInfo.un = user.info.un;
                        playerInfo.dragon = user.info.dragon;
                        playerInfo.lid = user.territoryWar.lid;
                        playerInfo.pos = user.territoryWar.pos;
                        playerInfo.state = this.isPlayerInFight(playerInfo.uid, playerInfo.pos.lid);
                        playerInfo.stayingPower = user.territoryWar.stayingPower;
                        playerInfo.weapon_illusion = user.sky_suit.weapon_illusion;
                        playerInfo.wing_illusion = user.sky_suit.wing_illusion;
                        playerInfo.mount_illusion = user.sky_suit.mount_illusion;
                        playerInfo.custom_king = user.custom_king;
                        playerList[playerInfo.uid] = playerInfo;
                    } else {
                        // 殘留了，清除掉
                        this.territorys[curLid].players.splice(i, 1);
                        i--;
                    }
                }
            }

            data.territoryWar = userInfo.territoryWar;  // 玩家自身的领地战信息
            data.territoryData = this.territorys[curLid];  // 领地数据
            data.playerList = playerList;               // 领地玩家信息
            data.enemies = this.getEnemy(lid);
            data.stele = this.territorys[lid].stele;    // 自己军团访问的石碑
            data.visitedCells = this.territorys[lid].visitedCells;  // 自己军团访问的格子
            data.onceElementData = this.getOnceElementData(curLid, gatherRecord);   // 一次性元素数据
        }

        return data;
    },

    getOnceElementData : function (lid, gatherRecord) {
        var data = {};
        for (var cellId in this.territorys[lid].cells) {
            if (this.onceElementCells.indexOf(parseInt(cellId)) >= 0) {
                var gridConf = gConfTerritoryWarMapGrid[cellId];
                var onceElementId = parseInt(gridConf.onceElement[0]);
                if (gatherRecord && gatherRecord.indexOf(onceElementId) < 0) {
                    // 替换成一次性掉落
                    var elementInfo = gridConf.onceElement[1].split('.');
                    data[cellId] = parseInt(elementInfo[1]);
                }
            }
        }
        return data;
    },

    hasOnceElement : function (cellId) {
        return this.onceElementCells.indexOf(cellId) >= 0;
    },

    // 玩家获取领地数据
    onPlayerGetData : function (uid, lid) {
        // 检查领地是否有敌人
        if (this.territorys[lid].enemies.length < 2) {

        }
    },

    // 获得敌对军团列表
    getEnemy : function (lid) {
        return this.territorys[lid].enemies;
    },

    // 在领地范围内广播
    broadcastInTerritory : function (lid, req, resp, callback) {
        if (!this.territorys[lid]) {
            return;
        }

        var servers = this.territorys[lid].servers;
        if (servers) {
            for (var i = 0; i < servers.length; i++) {
                this.broadcastToWorld(servers[i], req, resp, callback);
            }
        }
    },

    getServerInfo : function (sid) {
        if (this.servers[sid]) {
            return this.servers[sid];
        }

        return null;
    },

    broadcastToWorld : function (serverId, req, resp, callback) {
        var serverInfo = this.getServerInfo(serverId);
        if (serverInfo) {
            requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, resp, callback);
        }
    },

    // 广播到所有服务器
    broadcastToAllWorld : function (req, resp, callback) {
        for (var sid in this.servers) {
            this.broadcastToWorld(sid, req, resp, callback);
        }
    },

    // 广播玩家位置改变
    // set是否直接设置过去，set为true就没有过程
    broadcastPlayerPosition : function (uid, lid, cellId, set) {
        if (!this.territorys[lid]) {
            return;
        }

        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var userInfo = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (userInfo && !userInfo.territoryWar.leave && userInfo.territoryWar.pos.lid == lid) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'player_position_change',
                uid : 1,
                args : {
                    players : playerIds,
                    uid : uid,
                    lid : lid,
                    cellId : cellId,
                    set : set,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('broadcastPlayerPosition to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('broadcastPlayerPosition to world failed!' + WorldResp.desc);
                }
            });
        }
    },

    // 玩家进入领地
    onPlayerEnter : function (uid, lid, cellId, sid) {
        var userInfo = gUserInfo.getUser(uid);
        var oldLid = userInfo.territoryWar.pos.lid;
        if (oldLid != lid) {
            var oldTerritory = this.territorys[oldLid];
            if (oldTerritory) {
                oldTerritory.players.remove(uid);
                this.markTDirty(oldLid, 'players');

                var playerIds = [];
                for (var i = 0; i < oldTerritory.players.length; i++) {
                    var user = gUserInfo.getUser(oldTerritory.players[i]);
                    if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == oldLid) {
                        playerIds.push(oldTerritory.players[i]);
                    }
                }

                if (playerIds.length > 0) {
                    var WorldReq = {
                        mod : 'territorywar',
                        act : 'player_leave',
                        uid : 1,
                        args : {
                            players : playerIds,
                            uid : uid,
                            pos : {
                                lid : lid,
                                cellId : cellId,
                            },
                        }
                    }

                    var WorldResp = {};
                    WorldResp.code = 0;
                    this.broadcastInTerritory(oldLid, WorldReq, WorldResp, function () {
                        if (WorldResp.code == 0) {
                            DEBUG('player_leave to world finish!');
                        } else {
                            DEBUG('player_leave to world failed!');
                        }
                    });
                }
            }
        }

        gUserInfo.setPos(uid, lid, cellId);
        if (sid) {
            this.insertServer(lid, sid);
        }

        var newTerritory = this.territorys[lid];
        if (newTerritory) {
            if (newTerritory.players.indexOf(uid) < 0) {
                newTerritory.players.push(uid);
                this.markTDirty(lid, 'players');
            }

            var playerIds = [];
            for (var i = 0; i < newTerritory.players.length; i++) {
                var user = gUserInfo.getUser(newTerritory.players[i]);
                if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == lid) {
                    playerIds.push(newTerritory.players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'territorywar',
                    act : 'player_enter',
                    uid : 1,
                    args : {
                        players : playerIds,
                        uid : uid,
                        un : userInfo.info.un,
                        lid : userInfo.territoryWar.lid,
                        dragon : userInfo.info.dragon,
                        stayingPower : (userInfo.territoryWar.stayingPower ? userInfo.territoryWar.stayingPower : 100),
                        weapon_illusion : userInfo.sky_suit.weapon_illusion,
                        wing_illusion : userInfo.sky_suit.wing_illusion,
                        mount_illusion : userInfo.sky_suit.mount_illusion,
                        custom_king : userInfo.custom_king,
                        pos : {
                            lid : lid,
                            cellId : cellId,
                        },
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('player_enter to world finish!' + WorldResp.desc);
                    } else {
                        DEBUG('player_enter to world failed!' + WorldResp.desc);
                    }
                });
            }
        }
    },

    // 获取击杀排行榜
    getRankList : function () {
        var rankList = [];
        for (var i = 0; i < this.killRank.length && i < 100; i++) {
            var userInfo = gUserInfo.getUser(this.killRank[i]);
            if (userInfo) {
                var rankObj = {};
                rankObj.uid = this.killRank[i];
                rankObj.un = userInfo.info.un;
                rankObj.headpic = userInfo.info.headpic;
                rankObj.headframe = userInfo.info.headframe;
                rankObj.vip = userInfo.status.vip;
                rankObj.level = userInfo.status.level;
                rankObj.killCount = userInfo.territoryWar.killCount;
                rankObj.main_role = userInfo.pos[1].hid;
                rankObj.serverId = common.getServerId(rankObj.uid);

                rankList.push(rankObj);
            }
        }

        return rankList;
    },

    getPlayerRank : function (uid) {
        if (this.killRank.indexOf(uid) >= 0)
            return this.killRank.indexOf(uid) + 1;
        return 0;
    },

    // 获取战报
    getReports : function (uid) {
        var result = [];
        if (this.reports[uid]) {
            var reports = this.reports[uid];
            var result = [];
            for (var i = 0, len = reports.length; i < len; i++) {
                var report = reports[i].slice();
                var enemyId = report[2];
                var name = "";
                var headpic = "";
                var headframe = 0;
                var level = 0;
                var quality = 0;
                var vip = 0;
                var fightForce = 0;

                var user = gUserInfo.getUser(enemyId);
                if (user) {
                    name = user.info.un;
                    headpic = user.info.headpic;
                    headframe = user.info.headframe;
                    quality = gConfHero[user.pos[1].hid].quality;
                    level = user.status.level;
                    vip = user.status.vip;
                    fightForce = gUserInfo.getUserFightForce(enemyId);

                    report.push(name, headpic, level, quality, vip, fightForce, headframe);
                    result.push(report);
                }
            }
        }
        return result
    },

    // 获取指定格子的信息
    getCellInfo : function (lid, cellId) {
        if (!this.territorys[lid]) {
            return null;
        }

        if (this.territorys[lid].cells[cellId])
            return this.territorys[lid].cells[cellId];
        else
            return null;
    },

    // 获取格子里的玩家信息列表
    getCellPlayerList : function (selfLid, lid, cellId) {
        var playerList = {};
        if (!this.territorys[lid])
            return playerList;

        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var user = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (user && user.territoryWar.pos.lid == lid && user.territoryWar.pos.cellId == cellId &&
                user.territoryWar.lid != selfLid) {
                var playerInfo = {};
                playerInfo.uid = this.territorys[lid].players[i];
                playerInfo.un = user.info.un;
                playerInfo.dragon = user.info.dragon;
                playerInfo.headpic = user.info.headpic;
                playerInfo.headframe = user.info.headframe;
                playerInfo.level = user.status.level;
                playerInfo.lid = user.territoryWar.lid;
                playerInfo.legionName = this.territorys[playerInfo.lid].legionName;
                playerInfo.legionIcon = this.legions[playerInfo.lid].icon;
                playerInfo.sid = this.legions[playerInfo.lid].sid;
                playerInfo.pos = user.territoryWar.pos;
                playerInfo.fightForce = gUserInfo.getUserFightForce(playerInfo.uid);
                playerInfo.killCount = user.territoryWar.killCount;
                playerInfo.stayingPower = gUserInfo.getStayingPower(playerInfo.uid, common.getTime());
                playerInfo.rank = this.getPlayerRank(playerInfo.uid);
                playerInfo.fightState = this.isPlayerInFight(playerInfo.uid, lid);
                playerInfo.vip = user.status.vip;
                playerInfo.weapon_illusion = user.sky_suit.weapon_illusion;
                playerInfo.wing_illusion = user.sky_suit.wing_illusion;
                playerInfo.mount_illusion = user.sky_suit.mount_illusion;
                playerInfo.custom_king = user.custom_king;

                playerList[playerInfo.uid] = playerInfo;
            }
        }

        return playerList;
    },

    isSteleVisited : function (uid, lid, visit_lid, visit_cellId) {
        if (!this.territorys[lid])
            return false;

        for (var id in this.territorys[lid].stele) {
            var steleInfo = this.territorys[lid].stele[id];
            if (steleInfo && steleInfo.lid == visit_lid && steleInfo.cellId == visit_cellId) {
                return true;
            }
        }

        return false;
    },

    requestLegionInfo : function (lid) {
        var worldReq = {
            mod : 'territorywar',
            act : 'open_transfer_gate',
            uid : 1,
            args : {
                lid : lid,
            },
        };

        var worldResp = {};
        worldResp.code = 0;
        worldResp.desc = '';
        worldResp.data = {};

        for (var sid in this.servers) {
            this.broadcastToWorld(sid, worldReq, worldResp, function() {
                if (worldResp.code == 0) {
                    var legionInfo = worldResp.data.legionInfo;
                    var localLegionInfo = gTerritoryWar.getLegionInfo(lid);
                    if (legionInfo.level < parseInt(gConfTerritoryWarBase.portalOpenLevel.value))
                        return;

                    gTerritoryWar.updateLegionWarLevel(lid, legionInfo.legionWarLevel);
                    // conf.sid conf.lid, conf.isBase, conf.isRobot, conf.createLid
                    this.doMatch ({
                        sid: localLegionInfo.sid,
                        lid: lid,
                        isBase: true,
                        isRobot: false,
                        createLid: 0
                    })

                    // var boxId = 0;
                    // if (legionInfo.level <= 3) {
                    //     boxId = 0;
                    // } else {
                    //     boxId = legionInfo.legionWarLevel;
                    // }
                    // gTerritoryWar.insertWaitMatchLegion(boxId, lid, true, false, 0);
                }
            }.bind(this));
        }
    },

    // 访问石碑
    onPlayerVisitStoneStele : function (uid, lid, visit_lid, visit_cellId) {
        if (!this.territorys[lid])
            return;

        if (this.isSteleVisited(uid, lid, visit_lid, visit_cellId)) {
            return;
        }

        var curCount = Object.keys(this.territorys[lid].stele).length;
        var steleObj = {};
        steleObj.cellId = visit_cellId;
        steleObj.lid = visit_lid;

        var nextId = curCount + 1;
        this.territorys[lid].stele[nextId] = steleObj;
        this.markTDirty(lid, 'stele');

        if (lid == visit_lid) {
            // 访问的是自己领地的石碑，如果刚好3个，就将本军团加入到匹配列表
            if (Object.keys(this.territorys[lid].stele).length >= parseInt(gConfTerritoryWarBase.invadeLimit.value)) {
                // 改为去world取军团段位信息
                this.requestLegionInfo(lid);

                // 事件处理
                this.addEvent(lid, EventType.EVENT_TRANSFER_OPEN);
            }
        }

        // 事件处理
        var userInfo = gUserInfo.getUser(uid);
        if (userInfo) {
            if (lid == visit_lid) {
                this.addEvent(lid, EventType.EVENT_VISIT_OUR_STELE, userInfo.info.un);
            } else {
                var legionInfo = this.getLegionInfo(visit_lid);
                if (legionInfo)
                    this.addEvent(lid, EventType.EVENT_VISIT_OTHER_STELE, userInfo.info.un, legionInfo.name);
            }
        }

        var legionMembers = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var user = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (user && !user.territoryWar.leave && user.territoryWar.lid == lid && userInfo._id != uid) {
                legionMembers.push(this.territorys[lid].players[i]);
            }
        }

        // 通知军团成员石碑数改变
        for (var i = 0; i < this.territorys[lid].enemies.length; i++) {
            var emenyLid = this.territorys[lid].enemies[i];
            for (var j = 0; j < this.territorys[emenyLid].players.length; j++) {
                var user = gUserInfo.getUser(this.territorys[emenyLid].players[j]);
                if (user && !user.territoryWar.leave && user.territoryWar.lid == lid && userInfo._id != uid) {
                    legionMembers.push(this.territorys[emenyLid].players[j]);
                }
            }
        }

        if (legionMembers.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'visit_stele',
                uid : 1,
                args : {
                    players : legionMembers,
                    lid : visit_lid,
                    cellId : visit_cellId,
                    stele : this.territorys[lid].stele,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('visit_stele to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('visit_stele to world failed!' + WorldResp.desc);
                }
            });
        }
    },

    // 获取访问的石碑数
    getVisitSteleCount : function (lid) {
        if (!this.territorys[lid])
            return 0;

        return Object.keys(this.territorys[lid].stele).length;
    },

    // 访问瞭望塔
    onPlayerVisitWatchTower : function (uid, lid, visit_lid, visit_cellId) {
        if (!this.territorys[lid])
            return;

        if (!this.territorys[lid].watchTower)
            return;

        if (this.territorys[lid].watchTower.indexOf(visit_cellId) < 0) {
            this.territorys[lid].watchTower.push(visit_cellId);

            this.onPlayerVisitCell(lid, visit_lid, visit_cellId);

            // 将瞭望塔开启的格子加入已访问
            var openCells = gConfTerritoryWarBase.watchTowerSpecialOpen.value;
            for (var i = 0; i < openCells.length; i++) {
                this.onPlayerVisitCell(lid, visit_lid, parseInt(openCells[i]));
            }

            this.markTDirty(lid, 'watchTower');

            var legionMembers = [];
            for (var i = 0; i < this.territorys[visit_lid].players.length; i++) {
                var user = gUserInfo.getUser(this.territorys[visit_lid].players[i]);
                if (user && !user.territoryWar.leave && user.territoryWar.lid == lid
                && user._id != uid) {
                    legionMembers.push(this.territorys[visit_lid].players[i]);
                }
            }

            if (legionMembers.length > 0) {
                var WorldReq = {
                    mod : 'territorywar',
                    act : 'visit_tower',
                    uid : 1,
                    args : {
                        players : legionMembers,
                        lid : visit_lid,
                        cellId : visit_cellId,
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastToAllWorld(WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('visit_tower to world finish!' + WorldResp.desc);
                    } else {
                        DEBUG('visit_tower to world failed!' + WorldResp.desc);
                    }
                });
            }

            // 事件处理
            var userInfo = gUserInfo.getUser(uid);
            if (userInfo) {
                var resId = this.territorys[visit_lid].cells[visit_cellId].resId;
                var towerName = gConfTerritoryWarMapElement[resId].name;
                this.addEvent(lid, EventType.EVENT_ACTIVE_WATCH_TOWER, userInfo.info.un, towerName);
            }
        }
    },

    // 占领矿
    onMineOccupy : function (uid, lid, cellId) {
        var resId = this.territorys[lid].cells[cellId].resId;
        if (!this.territorys[lid].mine[resId]) {
            this.territorys[lid].mine[resId] = {};
            this.territorys[lid].mine[resId].robCount = 0;
            this.territorys[lid].mine[resId].holdCells = [];
        }

        if (this.territorys[lid].mine[resId].holdCells.indexOf(cellId) < 0) {
            this.territorys[lid].mine[resId].holdCells.push(cellId);
            this.markTDirty(lid, 'mine');

            // 通知本领地所有人
            var playerIds = [];
            for (var i = 0; i < this.territorys[lid].players.length; i++) {
                var user = gUserInfo.getUser(this.territorys[lid].players[i]);
                if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == lid
                && user._id != uid) {
                    playerIds.push(this.territorys[lid].players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'territorywar',
                    act : 'occupy_mine',
                    uid : 1,
                    args : {
                        players : playerIds,
                        lid : lid,
                        cellId : cellId,
                        resId : resId,
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('occupy_mine to world finish!' + WorldResp.desc);
                    } else {
                        DEBUG('occupy_mine to world failed!' + WorldResp.desc);
                    }
                });
            }
        }
    },

    // 检查矿是否已占领
    isMineOccupy : function (lid, cellId) {
        if (!this.territorys[lid])
            return false;

        if (!this.territorys[lid].cells[cellId])
            return false;

        var resId = this.territorys[lid].cells[cellId].resId;
        if (!this.territorys[lid].mine[resId]) {
            this.territorys[lid].mine[resId] = {};
            this.territorys[lid].mine[resId].robCount = 0;
            this.territorys[lid].mine[resId].holdCells = [];
        }

        if (this.territorys[lid].mine[resId].holdCells.indexOf(cellId) < 0) {
            return false;
        }

        return true;
    },

    // 掠夺矿
    onMineRob : function (lid, cellId) {
        var resId = this.territorys[lid].cells[cellId].resId;
        this.territorys[lid].mine[resId].robCount += 1;
        this.markTDirty(lid, 'mine');
    },

    sortFunc : function (a, b) {
        var aUserInfo = gUserInfo.getUser(a);
        var bUserInfo = gUserInfo.getUser(b);
        if (!aUserInfo || !bUserInfo) {
            return -1;
        }

        var aKillCount = aUserInfo.territoryWar.killCount;
        var bKillCount = bUserInfo.territoryWar.killCount;

        if (aKillCount > bKillCount) {
            return -1;
        } else if (aKillCount < bKillCount) {
            return 1;
        } else {
            var aFightForce = gUserInfo.getUserFightForce(a);
            var bFightForce = gUserInfo.getUserFightForce(b);
            return bFightForce - aFightForce;
        }
    },

    // 玩家被击败
    onPlayerDeath : function (uid, killer) {
        var userInfo = gUserInfo.getUser(uid);

        // 耐力回满
        var powerMax = parseInt(gConfTerritoryWarBase.enduranceLimit.value);
        gUserInfo.addStayingPower(uid, powerMax);

        if (userInfo.territoryWar.lid == userInfo.territoryWar.pos.lid) {
            // 在自己领地被杀死
            gUserInfo.setPos(uid, userInfo.territoryWar.lid, parseInt(gConfTerritoryWarBase.initialPos.value));
            this.broadcastPlayerPosition(uid, userInfo.territoryWar.lid, parseInt(gConfTerritoryWarBase.initialPos.value), true);
        } else {
            // 将玩家传送到出生地
            gTerritoryWar.onPlayerEnter(uid, userInfo.territoryWar.lid, parseInt(gConfTerritoryWarBase.initialPos.value));
        }

        if (killer) {
            gUserInfo.onKillPlayer(killer);
            if (this.killRank.indexOf(killer) < 0) {
                this.killRank.push(killer);
            } else {
                this.killRank.sort(this.sortFunc);
            }

            this.markDirty('killRank');
        }
    },

    onPlayerLeaveTerritoryWar : function (uid) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo)
            return;
    },

    onKillMonster : function (killer) {
        if (this.killRank.indexOf == undefined) {
            this.killRank = [];
        }
        gUserInfo.onKillPlayer(killer);
        if (this.killRank.indexOf(killer) < 0) {
            this.killRank.push(killer);
        } else {
            this.killRank.sort(this.sortFunc);
        }
    },

    // 通知战斗结果给战斗的另一方
    notifyFightResult : function (uid, win, consume_power, remain_power, dead) {
        var userInfo = gUserInfo.getUser(uid);
        if (userInfo && !userInfo.territoryWar.leave) {
            // 玩家在领地战，推送给玩家
            var costs = [['user', 'staying_power', -consume_power]];
            var WorldReq = {
                mod : 'territorywar',
                act : 'fight_player',
                uid : uid,
                args : {
                    win : win,
                    costs : costs,
                    staying_power : remain_power,
                    dead : dead,
                }
            }

            var serverId = common.getServerId(uid);
            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastToWorld(serverId, WorldReq, WorldResp, function (finish) {
                if (WorldResp.code == 0) {
                    DEBUG('player_dead to world finish!');
                } else {
                    DEBUG('player_dead to world failed!');
                }
            });
        }
    },

    notifyPlayerStayingPowerChange : function (lid, uid, remain_staying_power) {
        // 通知本领地所有人，玩家血量改变
        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var user = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == lid) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'player_hp_change',
                uid : uid,
                args : {
                    players : playerIds,
                    uid : uid,
                    staying_power : remain_staying_power,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('player_hp_change to world finish!');
                } else {
                    DEBUG('player_hp_change to world failed!');
                }
            });
        }
    },

    // 玩家战斗开始
    onPlayerPrepareFight : function (uid, lid, enemy_uid) {
        var stateChange = false;
        if (!this.territorysMemData[lid]) {
            this.territorysMemData[lid] = {};
            this.territorysMemData[lid].battle_palyers = {};
        }

        if (!this.territorysMemData[lid].battle_palyers[uid]) {
            stateChange = true;
        }

        this.territorysMemData[lid].battle_palyers[uid] = {};
        this.territorysMemData[lid].battle_palyers[uid].battle_start_time = common.getTime();
        this.territorysMemData[lid].battle_palyers[uid].enemy_uid = enemy_uid;

        if (stateChange) {
            this.onFightStateChange(uid, lid);
        }
    },

    // 玩家战斗结束
    onPlayerEndFight : function (uid, lid) {
        var stateChange = false;
        if (this.territorysMemData[lid] && this.territorysMemData[lid].battle_palyers) {
            delete this.territorysMemData[lid].battle_palyers[uid];
            stateChange = true;
        }

        if (stateChange) {
            this.onFightStateChange(uid, lid);
        }
    },

    isPlayerInFight : function (uid, lid) {
        if (!this.territorysMemData[lid])
            return false;

        if (!this.territorysMemData[lid].battle_palyers[uid])
            return false;

        return true;
    },

    // 战斗状态改变
    onFightStateChange : function (uid, lid) {
        if (!this.territorys[lid])
            return;

        // 通知本领地所有玩家
        var state = this.isPlayerInFight(uid, lid);

        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var userInfo = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (userInfo && !userInfo.territoryWar.leave) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'fight_state_change',
                uid : 1,
                args : {
                    players : playerIds,
                    uid : uid,
                    state : state,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('onFightStateChange to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('onFightStateChange to world failed!' + WorldResp.desc);
                }
            });
        }
    },

    getFightEnemyUid : function (uid, lid) {
        if (!this.territorysMemData[lid])
            return 0;

        if (!this.territorysMemData[lid].battle_palyers[uid])
            return 0;

        return this.territorysMemData[lid].battle_palyers[uid].enemy_uid;
    },

    // 更新公共怪的剩余耐力值
    updateShareMonsterStayingPower : function (lid, cellId, remainPower) {
        if (!this.territorys[lid]) {
            return;
        }

        if (!this.territorys[lid].cells[cellId]) {
            return;
        }

        if (this.territorys[lid].cells[cellId].resParam <= 0) {
            return; // 耐力值已经等于0了
        }

        this.territorys[lid].cells[cellId].resParam = remainPower;
        this.markTDirty(lid, 'cells');

        if (remainPower > 0) {
            // 通知给本领地所有玩家怪物血量改变
            var playerIds = [];
            for (var i = 0; i < this.territorys[lid].players.length; i++) {
                var user = gUserInfo.getUser(this.territorys[lid].players[i]);
                if (user && !user.territoryWar.leave && user.territoryWar.pos.lid == lid) {
                    playerIds.push(this.territorys[lid].players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'territorywar',
                    act : 'monster_hp_change',
                    uid : 1,
                    args : {
                        players : playerIds,
                        cellId : cellId,
                        staying_power : remainPower,
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastToAllWorld( WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('monster_hp_change to world finish!');
                    } else {
                        DEBUG('monster_hp_change to world failed!');
                    }
                });
            }
        }
    },

    getEvents : function (lid) {
        return this.territorys[lid].events;
    },

    // 添加事件
    addEvent : function (lid, event_id, param1, param2, param3) {
        if (!this.territorys[lid])
            return;

        if (!this.territorys[lid].events) {
            this.territorys[lid].events = [];
        }

        if (!util.isArray(this.territorys[lid].events)) {
            this.territorys[lid].events = [];
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

        var maxCount = parseInt(gConfTerritoryWarBase.eventRecordNum.value);
        if (this.territorys[lid].events.length >= maxCount) {
            this.territorys[lid].events.shift();
        }

        this.territorys[lid].events.push(eventObj);
        this.markTDirty(lid, 'events');
    },

    // 获取矿信息
    getMineInfo : function (lid, cellId) {
        if (!this.territorys[lid]) {
            return {};
        }

        if (Object.keys(this.territorys[lid].mine).length == 0) {
            for (var i = 1; i <= 5; i++) {
                this.initData.mine[i] = {};
                this.initData.mine[i].robCount = 0;   // 被掠夺次数
                this.initData.mine[i].holdCells = []; // 占领的矿的格子id
            }
        }

        var cellInfo = this.getCellInfo(lid, cellId);
        if (!cellInfo) {
            return {}
        }

        var resType = cellInfo.resType;
        if (resType != TerriToryWarResourceType.MINE) {
            return {};
        }

        var mineInfo = {};
        mineInfo.hold = 0;
        mineInfo.robCount = 0;
        if (this.territorys[lid].mine[cellInfo.resId]) {
            mineInfo.robCount = this.territorys[lid].mine[cellInfo.resId].robCount;

            if (this.territorys[lid].mine[cellInfo.resId].holdCells.indexOf(cellId) >= 0)
                mineInfo.hold = 1;
        }

        return mineInfo;
    },

    // 结算矿点收益
    calcMineAwards : function () {
        DEBUG('===== begin calcMineAwards ==========');
        if (this.mineAwardTime && this.mineAwardTime != 0 && this.mineAwardTime == getGameDate()) {
            // 今天已经发过了
            DEBUG('today has send mine award mail');
            return;
        }

        for (var lid in this.territorys) {
            var uLid = parseInt(lid);

            if (this.sendMindAwardLids.indexOf(uLid) >= 0) {
                DEBUG('mine award has send today, lid = ' + uLid);
                continue;
            }

            var territory = this.territorys[uLid];
            var params = {};
            for (var mineId in territory.mine) {
                if (territory.mine[mineId].holdCells.length == 0)
                    continue;

                params[mineId] = {}

                // 掠夺损失
                var param = territory.mine[mineId].robCount * parseInt(gConfTerritoryWarBase.pillageLose.value);
                if (param > 100) {
                    param = 100;
                }

                params[mineId].param1 = param;

                // 石碑加成
                var visitCount = 0;
                for (var id in territory.stele) {
                    if (territory.stele[id].lid == uLid) {
                        visitCount += 1;
                    }
                }

                if (visitCount > 3) {
                    visitCount = 3;
                }

                var param2 = 0;
                if (visitCount > 0) {
                    param2 = parseInt(gConfTerritoryWarBase.stoneTabletIncrease.value[visitCount - 1]);
                }

                params[mineId].param2 = param2;
            }

            if (Object.keys(params).length > 0 && gConfMail[26]) {
                var time = common.getTime();
                var mail = {
                    awards : 'territory_war',
                    time : time,
                    expire : time + gConfMail[26].time * OneDayTime,
                    attach : {
                        lid : uLid,
                        params : params,
                    },
                }

                var worldReq = {
                    mod : 'mail',
                    act : 'add_sys_mail',
                    uid : 1,
                    args : {
                        mail : mail,
                    }
                };

                var serverId = gUserInfo.getServerIdByLid(uLid);

                DEBUG('begin send mine award mail, lid = ' + uLid);
                this.broadcastToWorld(serverId, worldReq, {}, function() {
                    DEBUG('request a client over, lid = ' + uLid);
                });

                this.sendMindAwardLids.push(uLid);
            }
        }

        this.balance = common.getTime();
        this.markDirty('balance');

        this.mineAwardTime = getGameDate();
        this.markDirty('mineAwardTime');

        DEBUG('===== end calcMineAwards ==========');
    },

    // 结算boss奖励
    calcBossAwards : function () {
        this.bossAwardTime = common.getTime();
        this.markDirty('bossAwardTime');

        for (var lid in this.territorys) {
            var territory = this.territorys[lid];
            var legionLevel = this.territorys[lid].boss.createLevel;
            if (!legionLevel) {
                legionLevel = 1;
            }

            if (territory.boss.curOwner != 0 && gConfMail[29]) {
                // 发归属奖励
                var time = common.getTime();
                var mail = {
                    awards : 'territory_boss_owner',
                    time : time,
                    expire : time + gConfMail[29].time  * OneDayTime,
                    attach : {
                        lid : territory.boss.curOwner,
                        legionLevel : legionLevel,
                    },
                }

                var worldReq = {
                    mod : 'mail',
                    act : 'add_sys_mail',
                    uid : 1,
                    args : {
                        mail : mail,
                    }
                };

                var serverId = gUserInfo.getServerIdByLid(territory.boss.curOwner);
                this.broadcastToWorld(serverId, worldReq, {}, function () {

                });
            }

            if (territory.boss.damage.damageRank.length > 0 && gConfMail[30]) {
                var rank = [];
                var lids = [];
                for (var i = 0; i < territory.boss.damage.damageRank.length; i++) {
                    rank.push(territory.boss.damage.damageRank[i].uid);
                }

                var serverIds = [];
                for (var lid in territory.boss.damage.legions) {
                    var lid = parseInt(lid);
                    if (lids.indexOf(lid) < 0) {
                        lids.push(lid);

                        var serverId = gUserInfo.getServerIdByLid(lid);
                        if (serverIds.indexOf(serverId) < 0)
                            serverIds.push(serverId);
                    }
                }

                // 发排名奖励
                var time = common.getTime();
                var mail = {
                    awards : 'territory_boss_rank',
                    time : time,
                    expire : time + gConfMail[30].time * OneDayTime,
                    attach : {
                        lids : lids,
                        rank : rank,
                    },
                }

                var worldReq = {
                    mod : 'mail',
                    act : 'add_sys_mail',
                    uid : 1,
                    args : {
                        mail : mail,
                    }
                };

                for (var i = 0; i < serverIds.length; i++) {
                    this.broadcastToWorld(serverIds[i], worldReq, {}, function () {

                    });
                }
            }

            // 统计玩家平均等级
            var totalLevel = 0;
            var playerCount = 0;
            for (var i = 0; i < territory.boss.damage.damageRank.length; i++) {
                var user = gUserInfo.getUser(territory.boss.damage.damageRank[i]);
                if (user) {
                    totalLevel += user.status.level;
                    playerCount += 1;
                }
            }

            if (playerCount != 0) {
                this.territoryBossAverageLevel[lid] = Math.floor(totalLevel/playerCount);
                this.markDirty(util.format('territoryBossAverageLevel.%d', lid));
            }
        }
    },

    // 获取上一次日结算时间
    getLastBalanceTime : function () {
        return this.balance;
    },

// 日计算
    resetByDay : function () {
        LOG('=================== reset by day');
        this.time = common.getTime();
        this.markDirty('time');
        gUserInfo.onResetByDay();

        this.sendMindAwardLids = [];

        // 清理boss
        for (var lid in this.territorys) {
            var territory = this.territorys[lid];
            if(!territory || !territory.boss){
                continue;
            }
            delete territory.cells[territory.boss.bossCellId];
            this.markTDirty(lid, 'cells');

            territory.boss.bossLevel = 0;
            territory.boss.bossIndex = 0;
            territory.boss.bossCellId = 0;
            territory.boss.curOwner = 0;
            territory.boss.damage.legions = {};
            territory.boss.damage.damageRank = [];
            this.markTDirty(lid, 'boss');
        }
    },

    // 周结算
    resetByWeek : function () {
        LOG('=================== reset by week');
        this.weekTime = common.getTime();
        this.markDirty('weekTime');
        gUserInfo.onResetByWeek();

        this.clearTerritoryWar();
        // 通知所有世界服务器领地战重置了
        this.notifyWorldServerTerritoryWarReset();
    },

    // 清理领地战数据
    clearTerritoryWar : function () {
        LOG('================= clearTerritoryWar, time = ' + common.getTime());
        this.territorys = {};
        this.killRank.splice(0, this.killRank.length);
        this.dirty = {};
        this.initData = {};
        this.buildInitData();
        this.territorysMemData = {};
        this.legions = {};
        this.waitMatchQueue = {};
        this.initInvadeCells();
        this.legions = {};

        this.ai = 1;    // 机器人索引

        this.needResetByWeek = true;

        this.markDirty('killRank');
        this.markDirty('initData');
        this.markDirty('reports');
        this.markDirty('ai');
        this.markDirty('waitMatchQueue');
        this.markDirty('legions');
        this.markDirty('balance');
        this.markDirty('time');
        this.markDirty('weekTime');
    },

    updateLegionInfo : function (lid, legionInfo) {
        if (legionInfo.level <= 0) {
            legionInfo.level = 1;
        }
        this.legions[lid] = legionInfo;
        this.markDirty(util.format('legions.%d', lid));
    },

    updateLegionWarLevel : function (lid, legionWarLevel) {
        if (this.legions[lid]) {
            if (this.legions[lid].legionWarLevel != legionWarLevel) {
                this.legions[lid].legionWarLevel = legionWarLevel;
                this.markDirty(util.format('legions.%d', lid));
            }
        }
    },

    updateLegionLevel : function (lid, level, legionWarLevel, serverId) {
        if (this.legions[lid]) {
            if (this.legions[lid].level != level) {
                this.legions[lid].level = level;
                this.markDirty(util.format('legions.%d', lid));
            }

            if (this.legions[lid].legionWarLevel != legionWarLevel) {
                this.legions[lid].legionWarLevel = legionWarLevel;
                this.markDirty(util.format('legions.%d', lid));
            }

            var transferGateOpen = false;
            if (level >= parseInt(gConfTerritoryWarBase.portalOpenLevel.value) &&
                Object.keys(this.territorys[lid].stele).length >= parseInt(gConfTerritoryWarBase.invadeLimit.value)) {
                transferGateOpen = true;
            }

            // 传送门已开启的情况下，如果还没有敌人且没有在匹配队列，那么加入匹配队列
            if (transferGateOpen) {
                var enemies = gTerritoryWar.getEnemy(lid);
                if (enemies.length == 0 && !this.isInWaitMatchQueue(lid)) {

                    this.doMatch ({
                        sid: serverId,
                        lid: lid,
                        isBase: true,
                        isRobot: false,
                        createLid: 0
                    })
                    // var boxId = 0;
                    // if (level <= 3) {
                    //     boxId = 0;
                    // } else {
                    //     boxId = legionWarLevel;
                    // }
                    // this.insertWaitMatchLegion(boxId, lid, true, false, 0);
                }
            }
        }
    },

    updateLegionNameAndIcon : function (lid, legionName, legionIcon, level,serverid,leader) {
        if (this.legions[lid]) {
            if (this.legions[lid].level != level) {
                this.legions[lid].level = level;
                this.markDirty(util.format('legions.%d', lid));
            }

            if (legionName && legionName != '' && this.legions[lid].name != legionName) {
                this.legions[lid].name = legionName;
                this.markDirty(util.format('legions.%d', lid));
            }

            if (legionIcon && this.legions[lid].icon != legionIcon) {
                this.legions[lid].icon = legionIcon;
                this.markDirty(util.format('legions.%d', lid));
            }


            this.legions[lid].sid = serverid;

            this.legions[lid].leader = leader;
        }
    },

    getLegionInfo : function (lid) {
        if (!this.legions[lid]) {
            if (!this.territorys[lid]) {
                return null;
            }
            this.legions[lid] = {
                name: this.territorys[lid].legionName,
                lid: lid,
                icon: [1, 1],
                level: this.territorys[lid].level,
                legionWarLevel: this.territorys[lid].legionWarLevel,
            };
            this.markDirty(util.format('legions.%d', lid));
        }

        return this.legions[lid];
    },

    // 通知世界服务器
    notifyWorldServerTerritoryWarReset : function () {
        var worldReq = {
            mod : 'territorywar',
            act : 'reset_by_week',
            uid : 1,
            args : {},
        };

        var worldResp = {};
        worldResp.code = 0;
        worldResp.desc = '';
        worldResp.data = {};

        this.broadcastToAllWorld(worldReq, worldResp, function() {
            if (worldResp.code == 0) {
                var legionList = worldResp.data.legionList;
                for (var lid in legionList) {
                    gTerritoryWar.updateLegionInfo(lid, legionList[lid]);
                }
            }
        });
    },

    // 检查指定格子是否有敌对玩家
    hasEnemyPlayer : function (lid, cellId, myLid) {
        var cellInfo = this.getCellInfo(lid, cellId);
        if (!cellInfo)
            return false;

        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var playerInfo = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (playerInfo && playerInfo.territoryWar.pos.cellId == cellId && playerInfo.territoryWar.lid != myLid) {
                return true;
            }
        }

        return false;
    },

    // 玩家访问格子
    onPlayerVisitCell : function (lid, visit_lid, visit_cellId) {
        if (!this.territorys[lid])
            return;

        if (!this.territorys[lid].visitedCells) {
            this.territorys[lid].visitedCells = {};
        }

        if (!this.territorys[lid].visitedCells[visit_lid]) {
            this.territorys[lid].visitedCells[visit_lid] = [];
        }

        if (this.territorys[lid].visitedCells[visit_lid].indexOf(visit_cellId) < 0) {
            this.territorys[lid].visitedCells[visit_lid].push(visit_cellId);
            this.markTDirty(lid, 'visitedCells');

            // 通知给本领地的军团成员
            var playerIds = [];
            for (var i = 0; i < this.territorys[lid].players.length; i++) {
                var userInfo = gUserInfo.getUser(this.territorys[lid].players[i]);
                if (userInfo && !userInfo.territoryWar.leave && userInfo.territoryWar.lid == lid) {
                    playerIds.push(this.territorys[lid].players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'territorywar',
                    act : 'legion_member_visit_cell',
                    uid : 1,
                    args : {
                        players : playerIds,
                        lid : visit_lid,
                        cellId : visit_cellId,
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('legion_member_visit_cell to world finish!' + WorldResp.desc);
                    } else {
                        DEBUG('legion_member_visit_cell to world failed!' + WorldResp.desc);
                    }
                });
            }
        }
    },

    // 通知公共怪物已死亡
    notifyShareMonsterDead : function (lid, cellId) {
        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var userInfo = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (userInfo && !userInfo.territoryWar.leave && userInfo.territoryWar.pos.lid == lid) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'monster_dead',
                uid : 1,
                args : {
                    players : playerIds,
                    lid : lid,
                    cellId : cellId,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastToAllWorld(WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('monster_dead to world finish!');
                } else {
                    DEBUG('monster_dead to world failed!');
                }
            });
        }
    },

    // 玩家离开军团
    onPlayerLeaveLegion : function (lid, uid) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            return;
        }

        var curLid = userInfo.territoryWar.pos.lid;
        var cellId = userInfo.territoryWar.pos.cellId;

        if (!this.territorys[curLid]) {
            return;
        }

        var playerIds = [];

        // 将玩家从领地上移除
        var playerIndex = -1;
        for (var i = 0; i < this.territorys[curLid].players.length; i++) {
            if (this.territorys[curLid].players[i] == uid) {
                playerIndex = i;
            } else {
                var user = gUserInfo.getUser(this.territorys[curLid].players[i]);
                if (user && !user.territoryWar.leave) {
                    playerIds.push(this.territorys[curLid].players[i]);
                }
            }
        }

        // 给自己发kick_player消息，其他人发player_leave消息
        if (playerIndex >= 0) {
            this.territorys[curLid].players.splice(playerIndex, 1);

            var kickPlayerIds = [uid];
            var WorldReq = {
                mod : 'territorywar',
                act : 'kick_player',
                uid : 1,
                args : {
                    players : kickPlayerIds,
                    dismiss : 1,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            var serverID = common.getServerId(uid);
            this.broadcastToWorld(serverID, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('onPlayerLeaveLegion kick_player to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('onPlayerLeaveLegion kick_player to world failed!' + WorldResp.desc);
                }
            });
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'player_leave',
                uid : 1,
                args : {
                    players : playerIds,
                    uid : uid,
                    pos : {
                        lid : curLid,
                        cellId : cellId,
                    },
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInTerritory(lid, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('player_leave to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('player_leave to world failed!' + WorldResp.desc);
                }
            });
        }

        // 清除boss积分
        if (this.territorys[lid] && this.territorys[lid].boss) {
            for (var i = 0; i < this.territorys[lid].boss.damage.damageRank.length; i++) {
                if (this.territorys[lid].boss.damage.damageRank[i].uid == uid) {
                    this.territorys[lid].boss.damage.damageRank.splice(i, 1);
                    break;
                }
            }
        }
    },

    // 军团解散
    onLegionDismiss : function (lid) {
        if (!this.territorys[lid]) {
            return;
        }

        // 将领地里的玩家都踢出去
        var playerIds = [];
        for (var i = 0; i < this.territorys[lid].players.length; i++) {
            var user = gUserInfo.getUser(this.territorys[lid].players[i]);
            if (user && !user.territoryWar.leave && user.territoryWar.lid == lid) {
                playerIds.push(this.territorys[lid].players[i]);
            }
        }

        for (var i = 0; i < this.territorys[lid].enemies.length; i++) {
            var enemyTerritory = this.territorys[this.territorys[lid].enemies[i]];
            for (var j = 0; j < enemyTerritory.players.length; j++) {
                var user = gUserInfo.getUser(enemyTerritory.players[j]);
                if (user && !user.territoryWar.leave && user.territoryWar.lid == lid) {
                    playerIds.push(enemyTerritory.players[j]);
                }
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'territorywar',
                act : 'kick_player',
                uid : 1,
                args : {
                    players : playerIds,
                    dismiss : 1,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastToAllWorld(WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('kick_player to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('kick_player to world failed!' + WorldResp.desc);
                }
            });
        }

        // 将玩家从boss排名中移除
        if (this.territorys[lid]) {
            for (var i = 0; i < this.territorys[lid].boss.damage.damageRank.length; i++) {
                var user = gUserInfo.getUser(this.territorys[lid].boss.damage.damageRank[i].uid);
                if (user) {
                    this.territorys[lid].boss.damage.damageRank.splice(i, 1);
                    i--;
                }
            }
        }
    },

    // 更新boss伤害值
    updateBossDamage : function (uid, lid, damage, target_lid) {
        if (!this.territorys[lid] || damage == 0)
            return;

        if (!this.territorys[lid].boss.damage.legions[target_lid]) {
            this.territorys[lid].boss.damage.legions[target_lid] = damage;
        } else {
            this.territorys[lid].boss.damage.legions[target_lid] += damage;
        }

        // 更新归属
        var maxLegion = 0;
        var maxLegionDamage = 0;
        for (var lid1 in this.territorys[lid].boss.damage.legions) {
            if (this.territorys[lid].boss.damage.legions[lid1] > maxLegionDamage) {
                maxLegionDamage = this.territorys[lid].boss.damage.legions[lid1];
                maxLegion = parseInt(lid1);
            }
        }

        this.territorys[lid].boss.curOwner = parseInt(maxLegion);

        var exist = false;
        var index = 0;
        for (var i = 0; i < this.territorys[lid].boss.damage.damageRank.length; i++) {
            if (this.territorys[lid].boss.damage.damageRank[i].uid == uid) {
                exist = true;
                index = i;
                break;
            }
        }

        if (!exist) {
            var newRankObj = {};
            newRankObj.uid = uid;
            newRankObj.damage = damage;
            this.territorys[lid].boss.damage.damageRank.push(newRankObj);
        } else {
            this.territorys[lid].boss.damage.damageRank[index].damage += damage;
        }

        this.territorys[lid].boss.damage.damageRank.sort(this.sortDamageFunc);
        this.markTDirty(lid, 'boss');
    },

    sortDamageFunc : function (a, b) {
        if (a.damage > b.damage) {
            return -1;
        } else if (a.damage < b.damage) {
            return 1;
        } else {
            return 1;
        }
    },

    getBossRank : function (lid) {
        var key = lid.toString();
        if (this.territorys[key]) {
            return this.territorys[key].boss;
        }

        return null;
    },

    // 获取boss刷新时间
    getBossCreateTime : function () {
        var strBeginTime = gConfTerritoryWarBase.bossActivityTime.value[0];

        var strBegin = strBeginTime.split(":");
        var begin = new Date();
        begin.setHours(strBegin[0]);
        begin.setMinutes((strBegin[1]));
        begin.setSeconds(0);

        return Math.floor(begin.getTime()/1000);
    },

    getBossEndTime : function () {
        var strEndTime = gConfTerritoryWarBase.bossActivityTime.value[1];

        var strEnd = strEndTime.split(":");
        var end = new Date();
        end.setHours(strEnd[0]);
        end.setMinutes((strEnd[1]));
        end.setSeconds(0);

        return Math.floor(end.getTime()/1000);
    },

    // 获取boss发奖时间
    getBossSendAwardTime : function () {
        var strAwardTime = gConfTerritoryWarBase.bossAwardTime.value[0].split(":");
        var awardTime = new Date();

        awardTime.setHours(strAwardTime[0]);
        awardTime.setMinutes((strAwardTime[1]));
        awardTime.setSeconds(0);

        return Math.floor(awardTime.getTime()/1000);
    },

    getBossInfo : function (lids) {
        var list = {};
        if (lids) {
            for (var i = 0; i < lids.length; i++) {
                var lid = lids[i];

                if (!this.territorys[lid]) {
                    continue;
                }

                var info = {};
                if (this.territorys[lid].boss) {
                    info.level = this.territorys[lid].boss.bossLevel;
                    info.index = this.territorys[lid].boss.bossIndex;
                }

                info.begin_time = getTerritoryWarBossTime();
                info.end_time = getTerritoryBossEndTime();

                list[lid] = info;
            }
        }

        return list;
    },
    doMatch : function (conf) {
        if (!conf.sid || !conf.lid || !this.servers[conf.sid]) {
            return false;
        }
        // 开服时间
        var otime = this.servers[conf.sid][2];
        var nowtime = common.getTime();

        // 7-30 天去 0
        var boxid = 0;
        // 七天内 去服务器盒子
        if (nowtime - otime < 7 * 24 * 60 * 60) {
            boxid = conf.sid + 1000;
        }
        // 30天以上 正常
        if (nowtime - otime > 30 * 24 * 60 * 60) {
            boxid = this.territorys[conf.lid].legionWarLevel;
        }

        this.insertWaitMatchLegion(boxid, conf.lid, conf.isBase, conf.isRobot, conf.createLid);
    }
};

exports.TerritoryWar = TerritoryWar;
