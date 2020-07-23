function WorldWar() {
    // 与数据库对应的数据
    this.progress = 'close';        // 跨服战周期内的进度(rank排位赛,support16,8,4,2,1,close)
    this.replayId = 0;              // 战斗回放最新id

    this.count = 0;                 // 当前届数

    this.statistics = {             // 每个服的报名人数统计
        //serverId:count,
    };

    this.round = 0;                 // 决赛期间 当前比赛场次[1-5]
    this.top32 = [                  // 分组后32强玩家的位置
        // uid
    ];
    this.top32Rank = [              // 32强实时排行信息
        // uid
    ];

    this.lastTop32Rank = [];        // 上一届32强的最终排名

    this.lastTop32 = [];            // 上一届的32强玩家

    this.records = [                // 决赛期间 本届战斗记录, 每轮的获胜者位置[0-31]按顺序放入此数组
        // pos;                     // [0-31]
    ];
    this.lastRecords = [];          // 上一届决赛信息

    this.replays = [                // 本届决赛战报回放记录, 与finalRecords数组一一对应
        // [[winpos, replayid], ],  // 每两个玩家的对战记录数组
    ];

    this.lastReplays = [];          // 上一届决赛回放

    this.curPlayers = [];           // 32强决赛期间每轮的所有比赛者 uid

    this.result = [];               // 晋级赛每场的比赛结果
    // -1没有参与
    // 1左边玩家报名且胜利, 2左边玩家报名且失败
    // 3右边玩家报名且胜利, 4右边玩家报名且失败
    // 5均报名左边胜利, 6均报名右边胜利
    // 7均未报名左边胜利, 8均未报名右边胜利

    this.supports = {               // 本阶段支持情况
        // uid: [supporter, ...]    // 被支持者: [支持者, ...]
    };

    this.worship = [0, 0, 0];       // 对前三名的膜拜数量

    this.servers = {};              // 连接到这里的world

    // 内存数据
    this.ranks = [                  // 所有玩家排行及其重要信息,按照数组位置增序排列
        // uid,
    ];

    this.inTick = false;            // 是否在tick函数体内,战斗时不能tick
    this.updateRank = false;        // 是否需要更新排行榜
    this.rankUpdateTime = 0;        // 上一次排行榜更新时间

    this.updates = {};
}

WorldWar.create = function () {
    var worldwarData = {
        _id: 'worldwar',
        progress: 'close',
        count: 0,
        replay_id: 0,
        statistics: {},
        round: 0,
        top32: [],
        top32_rank: [],
        last_top32_rank: [],
        last_top32: [],
        records: [],
        last_records: [],
        replays: [],
        last_replays: [],
        cur_players: [],
        round_result: { 1: [], 2: [], 3: [], 4: [], 5: [] },
        supports: {},
        result: [],
        worship: [0, 0, 0],
        servers: {},
    };

    gDBWorld.insert(worldwarData, function (err, result) { });
};

WorldWar.prototype = {
    init: function (callback) {
        gDBWorld.findOne({ _id: 'worldwar' }, {}, function (err, doc) {
            if (doc) {
                this.progress = doc.progress;
                this.replayId = doc.replay_id;
                this.count = doc.count;
                this.statistics = doc.statistics;
                this.round = doc.round;
                this.top32 = doc.top32;
                this.top32Rank = doc.top32_rank;
                this.lastTop32Rank = doc.last_top32_rank;
                this.lastTop32 = doc.last_top32;
                this.records = doc.records;
                this.lastRecords = doc.last_records;
                this.replays = doc.replays;
                this.lastReplays = doc.last_replays;
                this.curPlayers = doc.cur_players;
                this.supports = doc.supports;
                this.result = doc.result ? doc.result : [];
                this.worship = doc.worship;
                this.servers = doc.servers ? doc.servers : {};

                if (!this.worship) {
                    this.worship = [0, 0, 0];
                }

                this._init(callback);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    _init: function (callback) {
        // 初始化排名
        for (var uid in gUserInfo.users) {
            if (this.isRegisted(uid)) {
                this.ranks.push(+uid);
            }
        }

        var progress = this.getProgress().progress;

        if (this.ranks.length == 0) {
            callback && callback(true);
            return;
        }

        this.updateRank = true;
        this.sortRank();

        // 决赛阶段
        if (progress != 'rank') {
            // 读取32强玩家数据
            if (this.top32.length < 32) {
                callback && callback(true);
                return;
            }
        }

        callback && callback(true);
    },

    sortRank: function () {
        if (!this.updateRank) {
            return;
        }
        this.ranks.sort(this.sortFunc);
        this.updateRank = false;
    },

    sortFunc: function (a, b) {
        var aUserInfo = gUserInfo.getUser(a);
        var bUserInfo = gUserInfo.getUser(b);

        if (!aUserInfo || !bUserInfo) {
            DEBUG(`Error没有取到玩家: ${a}  ${b}`);
            return 1;
        }

        var aScore = aUserInfo.worldwar.score;
        var bScore = bUserInfo.worldwar.score;
        if (aScore > bScore) {
            return -1;
        } else if (aScore < bScore) {
            return 1;
        } else {
            var aFightForce = gUserInfo.getUserFightForce(a);
            var bFightForce = gUserInfo.getUserFightForce(b);
            return bFightForce - aFightForce;
        }
    },


    addUpdate: function (key, value) {
        this.updates[key] = value;
    },

    save: function (callback) {
        if (Object.keys(this.updates).length == 0) {
            callback && callback(true);
            return;
        }

        var updates = this.updates;
        gDBWorld.update({ _id: 'worldwar' }, { $set: updates }, function (err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });

        this.updates = {};
    },

    saveWorldwar: function (callback) {
        var worldwar = {
            _id: 'worldwar',
            progress: this.progress,
            replay_id: this.replayId,
            count: this.count,
            statistics: this.statistics,
            round: this.round,
            top32: this.top32,
            top32_rank: this.top32Rank,
            last_top32_rank: this.lastTop32Rank,
            last_top32: this.lastTop32,
            records: this.records,
            last_records: this.lastRecords,
            replays: this.replays,
            last_replays: this.lastReplays,
            cur_players: this.curPlayers,
            supports: this.supports,
            result: this.result,
            worship: this.worship,
            servers: this.servers,
        };

        gDBWorld.save(worldwar, function (err, result) {
            if (err) {
                ERROR(err);
            }
            callback && callback();
        });
    },

    saveReplay: function (replay) {
        // 保存战斗回放信息
        this.replayId += 1;
        gDBReplay.save({ _id: this.replayId, replay: JSON.stringify(replay) }, function (err, result) { });

        return this.replayId;
    },

    removeReplays: function (replayIds) {
        // 删除已经过期的战斗回放信息
        if (!replayIds) {
            gDBReplay.remove({}, function (err, result) { });
        } else if (replayIds.length > 0) {
            gDBReplay.remove({ _id: { "$in": replayIds } }, function (err, result) { });
        }
    },

    switchRank: function () {
        if (this.progress != 'rank') {
            // 清理五届未参加的账号信息
            gUserInfo.clear();

            this.onOpen();
            this.progress = 'rank';
            this.count++;
            // 生成机器人
            this.generateRobots();

            this.addUpdate('progress', this.progress);
            this.addUpdate('count', this.count);
        }

        // 五分钟更新一次排行榜
        var timestamp = common.getTime();
        if (timestamp - this.rankUpdateTime > gConfGlobalNew.worldwarRefreshRankTime) {
            this.sortRank();
            this.rankUpdateTime = timestamp;
        }
    },

    finishRank: function (progress) {
        this.progress = progress;

        // 排名赛结束时立即更新排名
        this.sortRank();

        // 排名赛积分奖励发放
        this.addRankAwardMails();

        // 排位赛结束后人数仍然不足则比赛不开
        if (this.ranks.length < 32) {
            this.progress = 'close';
            this.onOpen();
            return;
        }

        // 更新每个玩家的历史最大积分赛排名
        for (var i = 0, len = this.ranks.length; i < len; i++) {
            var uid = this.ranks[i];
            var worldwar = gUserInfo.getUser(uid).worldwar;
            if (worldwar) {
                worldwar.max_rank = 32;
                gUserInfo.markDirty(uid);
                this.addExploitWallTip(uid, 'max_rank');
            }
        }

        // 获取top32
        for (var i = 0; i < 32; i++) {
            // 前32强中不能有机器人
            // if (isDroid(this.ranks[i])) {
            //     this.progress = 'close';
            //     break;
            // }
            this.top32Rank.push(this.ranks[i]);
        }

        if (this.progress == 'close') {
            this.onOpen();
            return;
        }

        // 随机排序
        this.curPlayers = this.top32Rank.slice().shuffle();

        // 保存随机排序后32强的位置
        this.top32 = this.curPlayers.slice();

        // 保存改变
        this.addUpdate('cur_players', this.curPlayers);
        this.addUpdate('top32', this.top32);
        this.addUpdate('top32_rank', this.top32Rank);
        this.addUpdate('progress', this.progress);
        this.save();
    },

    switchProgress: function (progress) {
        this.progress = progress;

        // 当前为支持阶段, 不做事
        var segs = this.progress.split('_');
        if (segs.length == 2 && segs[0] == 'sup') {
            if (segs[1] != 16) {
                // 非第一轮, 进行结算
                this.onAllRoundOver(segs[1] * 4);
            }

            // 进入支持阶段的时候，排名统一设置成当前轮数，比如16强就把钱32名的排名都设置为16强
            if (segs[1] == 16) {
                for (var i = 0; i < 32; i++) {
                    var uid = this.ranks[i];
                    var worldWar = gUserInfo.getUser(uid).worldwar;
                    if (worldWar) {
                        worldWar.max_rank = 32;
                        gUserInfo.markDirty(uid);
                    }
                }
            } else if (segs[1] == 8) {
                for (var i = 0; i < 16; i++) {
                    var uid = this.ranks[i];
                    var worldWar = gUserInfo.getUser(uid).worldwar;
                    if (worldWar) {
                        worldWar.max_rank = 16;
                        gUserInfo.markDirty(uid);
                    }
                }
            } else if (segs[1] == 4) {
                for (var i = 0; i < 8; i++) {
                    var uid = this.ranks[i];
                    var worldWar = gUserInfo.getUser(uid).worldwar;
                    if (worldWar) {
                        worldWar.max_rank = 8;
                        gUserInfo.markDirty(uid);
                    }
                }
            } else if (segs[1] == 2) {
                for (var i = 0; i < 4; i++) {
                    var uid = this.ranks[i];
                    var worldWar = gUserInfo.getUser(uid).worldwar;
                    if (worldWar) {
                        worldWar.max_rank = 4;
                        gUserInfo.markDirty(uid);
                    }
                }
            } else if (segs[1] == 1) {
                for (var i = 0; i < 2; i++) {
                    var uid = this.ranks[i];
                    var worldWar = gUserInfo.getUser(uid).worldwar;
                    if (worldWar) {
                        worldWar.max_rank = 2;
                        gUserInfo.markDirty(uid);
                    }
                }
            }

            this.addUpdate('progress', this.progress);
            this.round = 0;
            this.addUpdate('round', this.round);
            return;
        }

        // 将records相应位置初始化为-1
        for (var i = 0; i < +this.progress; i++) {
            this.records[32 - this.progress * 2 + i] = -1;
            this.result[32 - this.progress * 2 + i] = -1;
        }

        if (this.progress == 'close') {
            this.onAllRoundOver(2);
            this.switchOver();
        }
    },

    switchRound: function (round) {
        // 比赛正常结束
        this.round = round;
        this.saveWorldwar();
    },

    calcBattleScore: function (playerScore, enemyScore, succ) {
        // 计算战斗积分
        var P = succ ? 1 : 0;
        var D = playerScore - enemyScore;
        var PD = 1 / (1 + Math.pow(10, -D / gConfGlobalNew.worldwarScoreDiff));
        var result = gConfGlobalNew.worldwarWaveRatio * (P - PD);

        return result >= 0 ? Math.max(Math.floor(result), 1) : Math.min(Math.floor(result), -1);
    },

    // 5轮结束或决赛结束时的回调
    onAllRoundOver: function (len) {
        for (var i = 0; i < 31; i++) {
            if (this.records[i] != -1) {
                continue;
            }

            var rs = this.result[i];
            var winUid = 0;
            if (rs != -1) { // 已有结果
                this.records[i] = Math.floor(rs / 10) % 100;
                winUid = this.top32[this.records[i]];
            } else { // 没有结果的按照战斗力来
                var offset = i;
                if (i < 16) {
                } else if (i < 24) {
                    offset -= 16;
                } else if (i < 28) {
                    offset -= 24;
                } else if (i < 30) {
                    offset -= 28
                } else {
                    offset -= 30;
                }
                var uid1 = this.curPlayers[offset * 2];
                var uid2 = this.curPlayers[offset * 2 + 1];
                var ff1 = gUserInfo.getUserFightForce(uid1);
                var ff2 = gUserInfo.getUserFightForce(uid2);

                var lose = 0;
                if (ff1 >= ff2) {
                    winUid = uid1;
                    lose = this.top32.indexOf(uid2);
                } else {
                    winUid = uid2;
                    lose = this.top32.indexOf(uid1);
                }
                this.records[i] = this.top32.indexOf(winUid);
                this.replays[i] = [{ 'win': this.records[i], 'lose': lose, 'rid': 0 }];
            }

            var winUser = gUserInfo.getUser(winUid);
            if (winUser) {
                gUserInfo.getUser(winUid).worldwar.sum_fight++;
                this.addExploitWallTip(winUid, 'sum_fight');
            }
        }
        var nextPlayers = [];
        var pos = 32 - len;
        for (var i = 0; i < len / 2; i++) {
            nextPlayers.push(this.top32[this.records[pos + i]]);
        }

        var failers = [];
        for (var i = 0; i < len; i++) {
            if (nextPlayers.indexOf(this.curPlayers[i]) < 0) {
                failers.push(this.curPlayers[i]);
            }
        }

        // 失败者按照积分排序
        failers.sort(this.sortFunc);
        this.top32Rank = nextPlayers.concat(failers).concat(this.top32Rank.slice(len, 32));

        this.curPlayers = nextPlayers;

        // 发支持的奖励邮件, 更新玩家支持信息
        for (var i = 0; i < len / 2; i++) {
            var supporters = this.supports[this.top32Rank[i]];
            if (!supporters) {
                continue;
            }

            for (var j = 0, len1 = supporters.length; j < len1; j++) {
                var supporter = gUserInfo.getUser(supporters[j]);
                supporter.worldwar.sup_count++;
            }
        }
        this.supports = {};
    },

    switchOver: function () {
        // 发决赛奖励
        var realRank = this.ranks.slice();
        for (var i = 0; i < 32; i++) {
            realRank[i] = this.top32Rank[i];
        }
        var worldReq = {
            mod: 'mail',
            act: 'add_playoff_award_mails',
            uid: 1,
            args: {
                ranks: realRank,
            },
        };
        var worldResp = {};
        for (var sid in this.servers) {
            var sInfo = this.servers[sid];
            LOG('BEGIN ADD PLAYOFF AWARD MAILS');
            requestClientWorldByIpAndPort(sid, sInfo[0], sInfo[1], worldReq, worldResp, function (sid) {
                if (worldResp.code == 0) {
                    LOG(sid + ' ADD PLAYOFF AWARD MAILS');
                } else {
                    LOG(sid + ' ADD PLAYOFF AWARD MAILS FAIL');
                }
            });
        }

        // 更新历史最大决赛排名
        for (var i = 0; i < 32; i++) {
            var curUid = this.top32Rank[i];
            var worldwar = gUserInfo.getUser(curUid).worldwar;
            if (!worldwar.top_rank || worldwar.top_rank > i + 1) {
                worldwar.top_rank = i + 1;
                this.addExploitWallTip(curUid, 'top_rank');
            }
            if (i == 0) {
                if (!worldwar.top_1) {
                    worldwar.top_1 = 1;
                }
                else {
                    worldwar.top_1 += 1;
                }
                this.addExploitWallTip(curUid, 'top_1');
            }
            gUserInfo.markDirty(curUid);
        }

        // 清理膜拜数据
        this.worship = [0, 0, 0];

        this.saveWorldwar();
    },

    tick: function () {
        if (this.inTick) return;

        do {
            this.inTick = true;
            var progress = this.getProgress();

            if (progress.progress == 'rank') {
                this.switchRank();
            }

            // 决赛前的初始化
            if (this.progress == 'rank' && progress.progress != 'rank') {
                this.finishRank(progress.progress);
            }

            // 决赛已经结束
            if (this.progress == 'close') break;

            // 当前进度没有变化
            if (progress.progress == this.progress && progress.round == this.round) break;

            // 新的一轮
            if (progress.progress != this.progress) {
                this.switchProgress(progress.progress);
            }

            // 新的回合
            if (progress.round != this.round) {
                this.switchRound(progress.round);
            }
        } while (false);

        this.save();
        this.inTick = false;
    },

    getProgress: function () {
        // 根据时间获取战斗进度
        //progress 取值范围:rank排位赛,support4,16,8,4,support16,..2,1,close
        //return {'progress': '1', 'round': 5};
        //return {'progress': 'rank', 'round': 0};

        var nowDate = new Date();
        var nowDay = nowDate.getDay();
        if (nowDay == 0) {
            nowDay = 7;
        }

        var nowHour = nowDate.getHours() + nowDate.getMinutes() / 60;
        var formatTime = nowDay * 100 + nowHour;

        var progress = 'rank';
        var round = 0;
        var stage = gWorldWarProgressStages.length;
        if (formatTime < gWorldWarProgressStages[0].time || formatTime >= gWorldWarProgressStages[stage - 1].time) {
            progress = 'close';
        } else {
            for (var i = 1, len = gWorldWarProgressStages.length; i < len; i++) {
                if (formatTime < gWorldWarProgressStages[i].time) {
                    progress = gWorldWarProgressStages[i - 1].progress;
                    round = gWorldWarProgressStages[i - 1].round;
                    break;
                }
            }
        }

        return { 'progress': progress, 'round': round };
    },

    register: function (uid, user, score) {
        // 已满，无法报名
        var serverId = common.getServerId(uid);
        if (gWorldWar.statistics[serverId] &&
            gWorldWar.statistics[serverId] >= gConfGlobal.worldwarPlayerLimit) {
            return 0;
        }

        var count = this.statistics[serverId] ? this.statistics[serverId] + 1 : 1;
        this.statistics[serverId] = count;
        this.addUpdate('statistics.' + serverId, count);

        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            user._id = uid;
            gUserInfo.users[uid] = user;
            userInfo = user;
        }

        if (!userInfo.worldwar) {
            userInfo.worldwar = {
                count: this.count,
                score: score,
                get_score: 0,
                price: 0,
                report: [],
                max_win: 0,
                cur_win: 0,
                max_rank: 0,
                rank_1: 0,
                sum_fight: 0,
                sum_win: 0,
                top_rank: 0,
                top_1: 0,
                sup_count: 0,
                rank_score: 0,
                skills: {
                    '1': 0,
                    '2': 0,
                    '3': 0,
                    '4': 0,
                    '5': 0,
                },
                team: {},
                supports: {},
                reward: {
                    rank_score: {},
                    max_rank: {},
                    sum_win: {},
                    sum_fight: {},
                    top_rank: {},
                    top_1: {},
                    sup_count: {},
                },
            };
        } else {
            userInfo.worldwar.count = this.count;
            userInfo.worldwar.score = score;
            userInfo.worldwar.price = 0;
            userInfo.worldwar.report = [];
            userInfo.worldwar.cur_win = 0;
            userInfo.worldwar.supports = {};

            if (!userInfo.worldwar.team) {
                userInfo.worldwar.team = {};
                userInfo.worldwar.skills = {
                    '1': 0,
                    '2': 0,
                    '3': 0,
                    '4': 0,
                    '5': 0,
                };
            }

            if (!userInfo.worldwar.reward) {
                userInfo.worldwar.rank_score = 0;
                userInfo.worldwar.sum_win = 0;
                userInfo.worldwar.reward = {
                    rank_score: {},
                    max_rank: {},
                    sum_win: {},
                    sum_fight: {},
                    top_rank: {},
                    top_1: {},
                    sup_count: {},
                };
            }
        }

        for (var key in gConfExploitWall) {
            if (userInfo.worldwar.count % gConfExploitWall[key][1].cycle == 0) {
                userInfo.worldwar[key] = 0;
                userInfo.worldwar.reward[key] = {};
            }
        }
        gUserInfo.markDirty(uid);

        if (score != 0) {
            this.ranks.push(uid);
            this.updateRank = true;
            return this.ranks.length;
        }

        return 0;
    },

    isRegisted: function (uid) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo || !userInfo.worldwar || userInfo.worldwar.count != this.count) {
            return false;
        }
        return true;
    },

    getExploitWallResetTime: function (key) {
        var cycle = gConfExploitWall[key][1].cycle;
        var weekNum = cycle - this.count % cycle;
        return getWeekResetTime() + weekNum * OneWeekTime;
    },

    getResetTime: function () {
        var timeArr = {};
        for (var key in gConfExploitWall) {
            timeArr[key] = this.getExploitWallResetTime(key);
        }

        return timeArr;
    },

    getReplay: function (replayId, callback) {
        // 获取战报回放信息
        gDBReplay.findOne({ _id: replayId }, {}, function (err, doc) {
            if (doc) {
                var battleReport = doc.replay;
                callback && callback(battleReport);
            } else {
                callback && callback(null);
            }
        }.bind(this));
    },

    getRank: function (uid) {
        // 获取玩家排名
        return this.ranks.indexOf(uid) + 1;
    },

    generateRobots: function () {
        // 增加32机器人
        var maxId = 0;
        for (var i in gConfName) {
            if (+i > maxId) maxId = +i;
        }

        for (var id = 1; id <= 32; id++) {
            // 随机名字
            var firstNameId = common.randRange(1, maxId);
            var secondNameId = common.randRange(1, maxId);
            var male = common.randArray([0, 1]);
            male = male ? 'female' : 'male';
            var name = gConfName[firstNameId].first + gConfName[secondNameId][male];

            // 生成机器人
            var fightForce = gConfGlobalNew.worldwarRobotPower;
            var posObj = generateRobot(6, gConfGlobalNew.worldwarRobotLevel, fightForce);

            var realFightFoce = 0;
            for (var p in posObj) {
                realFightFoce += posObj[p].fight_force;
            }

            var score = 0;

            var stages = Object.keys(gConfWorldWarScore);
            stages.sort(function (a, b) { return (+a) - (+b) });

            for (var i = 0, len = stages.length; i < len; i++) {
                var scoreConf = gConfWorldWarScore[stages[i]];
                if (realFightFoce <= scoreConf.fightForce) {
                    break;
                }
                else {
                    score = scoreConf.score;
                }
            }

            if (score == 0) {
                score = gConfWorldWarScore[stages[0]].score;
            }

            // DEBUG("realFightFoce  = " + realFightFoce + ", name = " + name + ", score = " + score);

            // 等级
            var level = Math.ceil(realFightFoce / 2000 + 10);
            level = level > gMaxUserLevel ? gMaxUserLevel : level;
            var robot = {
                info: {
                    un: name,
                    headpic: common.randArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
                    headframe: 30003,
                },
                status: {
                    level: level,
                    vip: 0,
                },
                sky_suit: {
                    weapon_illusion: 0,
                    wing_illusion: 0,
                    mount_illusion: 0,
                },
                custom_king: {
                    //chapter : 0,
                    index: 1,
                },
                pos: posObj,
                promote: 0,
                server_id: 1,
            };
            this.register(id, robot, score);
        }
    },

    onOpen: function (close) {
        // 上届非正常关闭的情况不记录上届信息
        if (!close) {
            this.lastTop32 = this.top32;
            this.lastTop32Rank = this.top32Rank;
            this.lastRecords = this.records;
            this.lastReplays = this.replays;
        }
        this.statistics = {};
        this.round = 0;
        this.top32 = [];
        this.top32Rank = [];
        this.replays = [];
        this.records = [];
        this.replays = [];
        this.curPlayers = [];
        this.supports = {};

        this.saveWorldwar();

        this.ranks = [];
        this.updateRank = false;
        this.rankUpdateTime = 0;

        // 删除比赛回放
        this.removeReplays();
    },

    getUserWorldWarInfo: function (uid) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            DEBUG("can not find user id = " + uid);
            return null;
        }

        var maxFightforce = 0;
        var maxHid = userInfo.pos[1].rid;
        var maxPromote = userInfo.pos[1].promote;
        var maxPos = 0;
        for (var p in userInfo.pos) {
            if (userInfo.pos[p].fight_force > maxFightforce) {
                maxFightforce = userInfo.pos[p].fight_force;
                maxHid = userInfo.pos[p].rid;
                maxPromote = userInfo.pos[p].promote;
                maxPos = p;
            }
        }

        return {
            sid: userInfo.server_id || 1,
            uid: +uid,
            max_hid: maxHid,
            name: userInfo.info.un,
            headpic: +userInfo.info.headpic,
            headframe: userInfo.info.headframe,
            promote: maxPromote,
            score: userInfo.worldwar.score,
            fight_force: gUserInfo.getUserFightForce(uid),
            main_role: +userInfo.pos[1].rid,
            vip: userInfo.status.vip,
            level: userInfo.status.level,
            promote: maxPromote,
            weapon_illusion: userInfo.sky_suit.weapon_illusion,
            wing_illusion: userInfo.sky_suit.wing_illusion,
            mount_illusion: userInfo.sky_suit.mount_illusion,
            custom_king: userInfo.custom_king,
        };
    },

    addRankAwardMails: function () {
        var worldReq = {
            mod: 'mail',
            act: 'add_worldwar_award_mails',
            uid: 1,
            args: {
                ranks: this.ranks,
            },
        };
        var worldResp = {};
        this.broadcastToAllWorld(worldReq, worldResp, function (sid) {
            LOG('ADD_WORLDWAR_AWARD_MAIL');
            if (worldResp.code == 0) {
                LOG(sid + ' ADD_WORLDWAR_AWARD_MAIL');
            } else {
                LOG(sid + ' ADD_WORLDWAR_AWARD_MAIL FAIL');
            }
        });
    },

    getLastTop32Rank: function () {
        if (this.count <= 1 || this.lastTop32.length <= 0
            || this.lastRecords.length <= 0) {
            return [];
        }
        var ranks = [];
        for (var i = 0, len = this.lastTop32.length; i < len; i++) {
            var index = this.lastRecords[32 - i - 1];
            ranks.push(this.lastTop32[index]);
        }
    },

    getHonorTopUid: function () {
        return this.lastTop32Rank[0];
    },

    getHonorTopUser: function () {
        var uid = this.getHonorTopUid();
        if (!uid) {
            return null;
        }

        return gUserInfo.getHonorUser(uid);
    },

    addExploitWallTip: function (uid, type) {
        if (!gConfExploitWall[type]) {
            return;
        }

        for (var i = 1; i < 100; i++) {
            var targetConf = gConfExploitWall[type][i];
            if (!targetConf) {
                break;
            }

            // TODO 红点提示优化
            var target = targetConf.target;
            var score = gUserInfo.getUser(uid).worldwar[type];
            if (target == score) {
                gUserInfo.addTip(uid, 'exploit_wall');
                break;
            }
        }
    },

    // 膜拜
    updateWorship: function (rank) {
        if (rank < 0 || rank > 2) {
            return 1;
        }

        if (this.progress == 'close') {
            if (this.top32.length < 32) {
                return 1;
            }

            if (!this.top32[rank]) {
                return 1;
            }
        } else {
            if (this.lastTop32.length < 32) {
                return 1;
            }

            if (!this.lastTop32[rank]) {
                return 1;
            }
        }

        this.worship[rank] += 1;
        this.addUpdate('worship', this.worship);

        return 0;
    },

    getServerInfo: function (sid) {
        if (this.servers[sid]) {
            return this.servers[sid];
        }

        return null;
    },

    broadcastToWorld: function (serverId, req, resp, callback) {
        var serverInfo = this.getServerInfo(serverId);
        if (serverInfo) {
            requestClientWorldByIpAndPort(serverId, serverInfo[0], serverInfo[1], req, resp, callback);
        }
    },

    // 广播到所有服务器
    broadcastToAllWorld: function (req, resp, callback) {
        for (var sid in this.servers) {
            this.broadcastToWorld(sid, req, resp, callback);
        }
    },
};

exports.get = function (req, res, resp) {
    do {
        var uid = +req.uid;
        var user = req.args.user;
        var rank = 0;
        var progress = gWorldWar.progress;
        var score = +req.args.score;
        score = score > 0 ? score : 1;
        var serverId = +req.args.server_id;

        // 还没报名
        if (!gWorldWar.isRegisted(uid)) {
            if (!user.info || !user.status || !user.pos) {
                resp.code = 1; resp.desc = 'time not sync'; break;
            }
            rank = gWorldWar.register(uid, user, progress == 'rank' ? score : 0);
        }

        if (!rank) {
            rank = gWorldWar.getRank(uid);
        }

        // 用户更新数据
        if ((progress == 'rank' && rank) ||
            (progress != 'close' && gWorldWar.top32.indexOf(uid) >= 0)) {

            gUserInfo.update(uid, user, serverId);
        }

        var serverId = common.getServerId(uid);
        resp.data.server_id = serverId;
        resp.data.rank = rank;
        resp.data.count = gWorldWar.count;
        resp.data.last_top32 = [];

        var userWorldWar = gUserInfo.getUser(uid).worldwar;
        resp.data.supports = userWorldWar.supports;
        if (rank > 0) {
            resp.data.score = userWorldWar.score;
        }
        for (var i = 0, len = gWorldWar.lastTop32.length; i < len; i++) {
            var uid = gWorldWar.lastTop32[i];
            resp.data.last_top32.push(gWorldWar.getUserWorldWarInfo(uid));
        }
        resp.data.last_records = gWorldWar.lastRecords;
        resp.data.last_replays = gWorldWar.lastReplays;

        if (progress == 'rank' && req.args.matched) {
            resp.data.enemy = gWorldWar.getUserWorldWarInfo(req.args.matched);
        }

        if (progress != 'rank') {
            resp.data.top32 = [];
            for (var i = 0, len = gWorldWar.top32.length; i < len; i++) {
                var uid = gWorldWar.top32[i];
                resp.data.top32.push(gWorldWar.getUserWorldWarInfo(uid));
            }
            resp.data.replays = gWorldWar.replays;
            resp.data.records = gWorldWar.records;
        }

        resp.data.top32_rank = gWorldWar.top32Rank;

        var top3 = [];
        if (progress == 'close') {
            if (gWorldWar.top32Rank.length >= 3) {
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.top32Rank[0]));
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.top32Rank[1]));
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.top32Rank[2]));
            }
            if (gWorldWar.top32.length == 0) {
                progress = 'stop';
            }
        } else {
            if (gWorldWar.lastTop32Rank.length >= 3) {
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.lastTop32Rank[0]));
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.lastTop32Rank[1]));
                top3.push(gWorldWar.getUserWorldWarInfo(gWorldWar.lastTop32Rank[2]));
            }
        }

        resp.data.progress = progress;
        resp.data.top3 = top3;
        resp.data.result = gWorldWar.result;
        resp.data.worship = gWorldWar.worship;

        var pIdx = [16, 8, 4, 2, 1].indexOf(+gWorldWar.progress);
        if (pIdx != -1 && gWorldWar.round == 2) {
            for (var i = 0, len = gWorldWar.curPlayers.length; i < len; i += 2) {
                // 计算存储record的位置pos
                var fightUid = gWorldWar.curPlayers[i];
                var offset = gWorldWar.top32.indexOf(fightUid);
                for (var j = 0; j <= pIdx; j++) {
                    offset = Math.floor(offset / 2);
                }
                var recordPos = [0, 16, 24, 28, 30][pIdx] + offset;
                if (gWorldWar.result[recordPos] % 10 != -1) {
                    continue;
                }

                // 若是自己的战斗, 总是作为攻击方
                var enemyId = gWorldWar.curPlayers[i + 1];
                var replay = {
                    info: gUserInfo.getUserFightInfo(fightUid, true, true),
                    enemy: gUserInfo.getUserFightInfo(enemyId, true, true),
                    rand1: common.randRange(0, 99999),
                    rand2: common.randRange(0, 99999),
                };
                resp.data.fight_info = replay;
                resp.data.pos = recordPos;
                break;
            }
        }
    } while (false);

    onReqHandled(res, resp, 1);
}

exports.get_fight_info = function (req, res, resp) {
    var pIdx = [16, 8, 4, 2, 1].indexOf(+gWorldWar.progress);
    if (pIdx != -1 && gWorldWar.round == 2) {
        for (var i = 0, len = gWorldWar.curPlayers.length; i < len; i += 2) {
            // 计算存储record的位置pos
            var fightUid = gWorldWar.curPlayers[i];
            var offset = gWorldWar.top32.indexOf(fightUid);
            for (var j = 0; j <= pIdx; j++) {
                offset = Math.floor(offset / 2);
            }
            var recordPos = [0, 16, 24, 28, 30][pIdx] + offset;
            if (gWorldWar.result[recordPos] % 10 != -1) {
                continue;
            }

            // 若是自己的战斗, 总是作为攻击方
            var enemyId = gWorldWar.curPlayers[i + 1];
            var replay = {
                info: gUserInfo.getUserFightInfo(fightUid, true, true),
                enemy: gUserInfo.getUserFightInfo(enemyId, true, true),
                rand1: common.randRange(0, 99999),
                rand2: common.randRange(0, 99999),
            };

            if (replay.info && replay.enemy) {
                resp.data.fight_info = replay;
                resp.data.pos = recordPos;
            }
            break;
        }
    }

    onReqHandled(res, resp, 1);
}

exports.get_rank_list = function (req, res, resp) {
    var uid = req.uid;
    var rankList = [];
    if (req.args.last) {
        if (gWorldWar.count > 1) {
            for (var i = 0, len = gWorldWar.lastTop32Rank.length; i < len; i++) {
                var uid = gWorldWar.lastTop32Rank[i];
                rankList.push(gWorldWar.getUserWorldWarInfo(uid));
            }
        }
    } else {
        gWorldWar.sortRank();
        var rankCnt = gConfGlobalNew.rankListLimit_worldwar;
        var len = gWorldWar.ranks.length > rankCnt ? rankCnt : gWorldWar.ranks.length;
        for (var i = 0; i < len; i++) {
            rankList.push(gWorldWar.getUserWorldWarInfo(gWorldWar.ranks[i]));
        }

        if (gWorldWar.isRegisted(uid)) {
            resp.data.score = gUserInfo.getUser(uid).worldwar.score;
            resp.data.rank = gWorldWar.getRank(uid);
        } else {
            resp.data.score = 0;
            resp.data.rank = 0;
        }
    }
    resp.data.rank_list = rankList;
    resp.data.count = gWorldWar.count;
    onReqHandled(res, resp, 1);
}

exports.get_score_rank_list = function (req, res, resp) {
    var uid = req.uid;
    var rankList = [];

    var sep = 3;
    var ids = [];
    var len = Object.keys(gConfWorldWarGlory).length;
    for (var i = 1; i <= len; i++) {
        if (i < len - 1) {
            ids.push(gConfWorldWarGlory[i + 1].rank - 1);
        }

        if (i > 3 && gConfWorldWarGlory[i].rank - gConfWorldWarGlory[i - 1].rank == 1) {
            if (i > sep) {
                sep = i + 1;
            }
        }
    }

    for (var i = 0; i < ids.length; i++) {
        if (i < sep) {
            if (gUserInfo.getUser(gWorldWar.ranks[ids[i] - 1])) {
                rankList.push(gWorldWar.getUserWorldWarInfo(gWorldWar.ranks[ids[i] - 1]))
            }
        } else {
            if (ids[i] < gWorldWar.ranks.length) {
                rankList.push(gUserInfo.getUser(gWorldWar.ranks[ids[i] - 1]).worldwar.score);
            } else if (ids[i] == gWorldWar.ranks.length) {
                rankList.push(gUserInfo.getUser(gWorldWar.ranks[ids[i] - 1]).worldwar.score);
                break
            } else {
                rankList.push(0);
                break;
            }
        }
    }

    resp.data.rank_list = rankList;
    resp.data.rank = gWorldWar.getRank(uid);

    onReqHandled(res, resp, 1);
}

exports.match_enemy = function (req, res, resp) {
    var uid = req.uid;
    do {
        if (gWorldWar.progress != 'rank') {
            resp.code = 100; resp.desc = 'not rank progress'; break;
        }

        if (!gWorldWar.isRegisted(uid)) {
            resp.code = 1; resp.desc = 'not registered'; break;
        }

        var beginRatio = 0.9;
        var endRatio = 1.1;
        var score = gUserInfo.getUser(uid).worldwar.score;
        var playerIndex = gWorldWar.getRank(uid) - 1;
        var beginIndex = playerIndex;
        var endIndex = beginIndex;
        var targetIndex = null;

        while (beginIndex > 0 || gWorldWar.ranks[endIndex]) {
            var beginUser = gUserInfo.getUser(gWorldWar.ranks[beginIndex]);
            while (beginIndex >= 0 && beginUser.worldwar.score <= score * endRatio) {
                beginIndex--;
            }
            beginIndex++;

            var endUser = gUserInfo.getUser(gWorldWar.ranks[endIndex]);
            while (gWorldWar.ranks[endIndex] && endUser.worldwar.score >= score * beginRatio) {
                endIndex++;
            }

            if (endIndex - beginIndex >= gConfGlobalNew['worldwarMatchRange']) {
                targetIndex = parseInt(Math.random() * (endIndex - beginIndex)) + beginIndex; break;
            } else {
                if (beginRatio > 0) {
                    beginRatio -= 0.1;
                    beginRatio = beginRatio < 0 ? 0 : beginRatio;
                }

                endRatio += 0.1;
            }
        }

        if (!targetIndex) {
            targetIndex = parseInt(Math.random() * (gWorldWar.ranks.length));
        }

        // 匹配到自己时，先匹配排名比自己高的,如果没有，再匹配低的
        if (targetIndex == playerIndex) {
            if (gWorldWar.ranks[targetIndex - 1]) {
                targetIndex--;
            } else {
                targetIndex++;
            }
        }

        resp.data.enemy = gWorldWar.getUserWorldWarInfo(gWorldWar.ranks[targetIndex]);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.challenge = function (req, res, resp) {
    // 排位赛挑战
    var uid = req.uid;
    var enemy = +req.args.enemy;
    var worldwar = gUserInfo.getUser(uid).worldwar;

    do {
        if (gWorldWar.progress != 'rank') {
            resp.code = 100; resp.desc = 'not rank progress'; break;
        }

        var nowDate = new Date();
        var nowDay = nowDate.getDay();
        if (nowDay == 0) {
            nowDay = 7;
        }

        var nowHour = nowDate.getHours() + nowDate.getMinutes() / 60;
        var formatTime = nowDay * 100 + nowHour;

        // DEBUG("formatTime = " + formatTime);
        // DEBUG("gWorldWarProgressStages[0].time = " + gWorldWarProgressStages[0].time);
        // DEBUG("gWorldWarProgressStages[1].time = " + gWorldWarProgressStages[1].time);

        if (formatTime < gWorldWarProgressStages[0].realopentime || formatTime >= gWorldWarProgressStages[1].time) {
            resp.code = 1; resp.desc = 'not rank time'; break;
        }

        if (!gWorldWar.isRegisted(uid)) {
            resp.code = 1; resp.desc = 'not registered'; break;
        }

        // 战斗记录中的复仇
        if (req.args.revenge) {
            var rindex = +req.args.rindex;
            var reports = worldwar.report;
            if (!reports) {
                resp.code = 1; resp.desc = 'no reports'; break;
            }

            if (!reports[rindex] || reports[rindex][0] != enemy) {
                resp.code = 1; resp.desc = 'enemy not in revenge'; break;
            }

            if (reports[rindex][2]) {
                resp.code = 1; resp.desc = 'cannot revenged'; break;
            }
        }

        var replay = {
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
            info: gUserInfo.getUserFightInfo(uid, true),
            enemy: gUserInfo.getUserFightInfo(enemy),
        };
        resp.data = replay;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight = function (req, res, resp) {
    // 排位赛挑战
    var uid = req.uid;
    var enemy = +req.args.enemy;
    var worldwar = gUserInfo.getUser(uid).worldwar;
    do {
        var star = req.args.star;

        // 战斗记录中的复仇
        if (req.args.revenge) {
            var rindex = +req.args.rindex;
            var reports = worldwar.report;
            if (!reports) {
                resp.code = 1; resp.desc = 'no reports'; break;
            }

            if (!reports[rindex] || reports[rindex][0] != enemy) {
                resp.code = 1; resp.desc = 'enemy not in revenge'; break;
            }

            if (reports[rindex][2]) {
                resp.code = 1; resp.desc = 'cannot revenged'; break;
            }

            reports[rindex][2] = 1;
        }

        // 计算战斗获得积分
        var playerScore = worldwar.score;
        var enemyWorldwar = gUserInfo.getUser(enemy).worldwar;
        var enemyScore = enemyWorldwar.score;

        var playerScoreAdd = gWorldWar.calcBattleScore(playerScore, enemyScore, star > 0);
        var enemyScoreAdd = gWorldWar.calcBattleScore(enemyScore, playerScore, star <= 0);

        if (playerScoreAdd > 0) {
            worldwar.get_score += playerScoreAdd;
            gUserInfo.markDirty(uid);
        }

        if (enemyScoreAdd > 0) {
            enemyWorldwar.get_score += enemyScoreAdd;
            gUserInfo.markDirty(enemy);
        }

        var player_score_change = playerScoreAdd;
        var enemy_score_change = enemyScoreAdd;

        worldwar.score += playerScoreAdd;
        enemyWorldwar.score += enemyScoreAdd;

        worldwar.score = worldwar.score < 1 ? 1 : worldwar.score;
        enemyWorldwar.score = enemyWorldwar.score < 1 ? 1 : enemyWorldwar.score;
        gUserInfo.markDirty(uid);
        gUserInfo.markDirty(enemy);

        playerScoreAdd = worldwar.score - playerScore;
        enemyScoreAdd = enemyWorldwar.score - enemyScore;

        if (worldwar.score > worldwar.rank_score) {
            worldwar.rank_score = worldwar.score;
            gWorldWar.addExploitWallTip(uid, 'rank_score');
        }

        resp.data.score_add = playerScoreAdd;
        resp.data.player_score = worldwar.score;
        resp.data.enemy_score = enemyWorldwar.score;
        resp.data.player_score_change = player_score_change;
        resp.data.enemy_score_change = enemy_score_change;

        // 保存战斗记录
        var replayId = gWorldWar.saveReplay(req.args.replay);

        var playerReports = worldwar.report;

        var revenged = 0;
        if (req.args.revenge || star <= 0) {
            revenged = 1;
        }

        if (playerReports.length >= 10) {
            var replayRemoved = playerReports.pop();
            gWorldWar.removeReplays([replayRemoved]);
        }

        playerReports.unshift([enemy, 1, 1, replayId, star > 0, playerScoreAdd, enemyScoreAdd, worldwar.score, enemyWorldwar.score]);

        if (!isDroid(enemy)) {
            var enemyReports = enemyWorldwar.report;
            if (enemyReports.length >= 10) {
                var replayRemoved = enemyReports.pop();
                gWorldWar.removeReplays([replayRemoved]);
            }
            enemyReports.unshift([uid, 0, revenged, replayId, star <= 0, enemyScoreAdd, playerScoreAdd, enemyWorldwar.score, worldwar.score]);
            gUserInfo.addTip(enemy, 'ww_report');
        }

        gWorldWar.updateRank = true;

        // 更新连续胜利次数
        if (star > 0) {
            worldwar.cur_win++;
            worldwar.sum_win++;
            gWorldWar.addExploitWallTip(uid, 'sum_win');
            if (worldwar.cur_win > worldwar.max_win) {
                worldwar.max_win = worldwar.cur_win;
                gWorldWar.addExploitWallTip(uid, 'max_win');
            }
        } else {
            worldwar.cur_win = 0;
        }

        gUserInfo.markDirty(uid);
        gUserInfo.markDirty(enemy);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_replay_list = function (req, res, resp) {
    var uid = +req.uid;
    do {
        if (!gWorldWar.isRegisted(uid)) {
            resp.data.replays = [];
            break;
        }

        var reports = gUserInfo.getUser(uid).worldwar.report;
        var replays = [];
        var progress = gWorldWar.progress;
        for (var i = 0, len = reports.length; i < len; i++) {
            var report = reports[i];
            var enemyInfo = gUserInfo.getUser(report[0]);
            replays.push({
                enemy_id: report[0],
                name: enemyInfo.info.un,
                fight_force: gUserInfo.getUserFightForce(report[0]),
                level: enemyInfo.status.level,
                vip: enemyInfo.status.vip || 0,
                headpic: enemyInfo.info.headpic,
                headframe: (enemyInfo.info.headframe ? enemyInfo.info.headframe : 0),
                attacker: report[1],
                revenged: progress == 'rank' ? report[2] : 1,
                replay_id: report[3],
                win: report[4],
                score_add: report[5],
                score_enemy_add: report[6] || 0,
                score_player: report[7] || 0,
                score_enemy: report[8] || 0,
                quality: gConfHero[enemyInfo.pos[1].rid].quality,
                sid: enemyInfo.server_id || 1,
                custom_king: enemyInfo.custom_king,
            });
        }

        resp.data.replays = replays;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_replay = function (req, res, resp) {
    var uid = +req.uid;
    do {
        gWorldWar.getReplay(req.args.id, function (battleReport) {
            if (!battleReport) {
                resp.code = 1; resp.desc = 'id error';
                onReqHandled(res, resp, 1);
                return;
            }
            resp.data.report = JSON.parse(battleReport);
            onReqHandled(res, resp, 1);
        });

        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_report = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var report = [];
        for (var i = 30; i >= 0; i--) {
            var replays = gWorldWar.lastReplays[i];
            var replay = replays ? replays[0] : 0;
            if (!replay) {
                report.push([]);
            } else if (replay.rid) {
                var winUid = gWorldWar.lastTop32[replay.win];
                var loseUid = gWorldWar.lastTop32[replay.lose];
                report.push([
                    gUserInfo.getUser(winUid).info.un,
                    gUserInfo.getUser(loseUid).info.un,
                    replay.rid
                ]);
            } else {
                report.push([]);
            }
        }

        resp.data.report = report;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.support = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var supportUid = req.args.id;
        var progress = gWorldWar.progress;
        var segs = progress.split('_');
        if (segs.length != 2 || segs[0] != 'sup') {
            resp.code = 100; resp.desc = 'not in support time'; break;
        }
        var supProgress = +segs[1];

        var valid = false;
        for (var i = 0; i < supProgress * 2; i++) {
            if (supportUid == gWorldWar.top32Rank[i]) {
                valid = true; break;
            }
        }

        if (!valid) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var user = gUserInfo.getUser(uid);
        if (user.worldwar.supports[supProgress]) {
            resp.code = 1; resp.desc = 'has supported'; break;
        }

        user.worldwar.supports[supProgress] = [supportUid, req.args.gold];
        gUserInfo.markDirty(uid);

        gUserInfo.getUser(supportUid).worldwar.price += req.args.gold;
        gUserInfo.markDirty(supportUid);

        if (!gWorldWar.supports[supportUid]) {
            gWorldWar.supports[supportUid] = [uid];
        } else {
            gWorldWar.supports[supportUid].push(uid)
        }
        gWorldWar.addUpdate('supports', gWorldWar.supports);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.exploit_wall = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.data.exploit = {
                sum_win: 0,
                max_win: 0,
                cur_win: 0,
                get_score: 0,
                rank_1: 0,
                sum_fight: 0,
                top_rank: 0,
                top_1: 0,
                sup_count: 0,
                rank_score: 0,
            };
            break;
        }

        var worldwar = userInfo.worldwar;
        resp.data.exploit = {
            sum_win: worldwar.sum_win,
            max_win: worldwar.max_win,
            cur_win: worldwar.cur_win,
            get_score: worldwar.get_score,
            rank_1: worldwar.rank_1,
            sum_fight: worldwar.sum_fight,
            top_rank: worldwar.top_rank,
            top_1: worldwar.top_1,
            sup_count: worldwar.sup_count,
            rank_score: worldwar.rank_score,
        };
        resp.data.reward = worldwar.reward;
        resp.data.reset_time = gWorldWar.getResetTime();
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_exploit_award = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            resp.code = 1; resp.desc = 'has cleared'; break;
        }

        var type = req.args.type;
        var target = gConfExploitWall[type][req.args.target].target;
        if (!target) {
            resp.code = 1; resp.desc = 'type or target error'; break;
        }

        if (userInfo.worldwar.reward[type][req.args.target]) {
            resp.code = 1; resp.desc = 'already reward'; break;
        }

        if (type == 'sup_count' || type == 'max_win' || type == 'sum_fight' || type == 'rank_1' || type == 'top_1') {
            if (userInfo.worldwar[type] < target) {
                resp.code = 1; resp.desc = 'not reach'; break;
            }
        } else if (type == 'get_score') {
            if (!userInfo.worldwar.get_score || userInfo.worldwar.get_score < target) {
                resp.code = 1; resp.desc = 'not reach'; break;
            }
        } else if (type == 'top_rank') {
            if (!userInfo.worldwar.top_rank || userInfo.worldwar.top_rank > target) {
                resp.code = 1; resp.desc = 'not reach'; break;
            }
        }

        userInfo.worldwar.reward[type][req.args.target] = 1;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.price_rank = function (req, res, resp) {
    do {
        var list = [];
        var top32 = null;
        if (gWorldWar.progress == 'rank') {
            top32 = gWorldWar.lastTop32;
        } else {
            top32 = gWorldWar.top32;
        }
        for (var i = 0, len = top32.length; i < len; i++) {
            var uid = top32[i];
            var userInfo = gUserInfo.getUser(uid);
            list.push({
                name: userInfo.info.un,
                uid: uid,
                headframe: userInfo.info.headframe,
                sid: userInfo.server_id || 1,
                price: userInfo.worldwar.price,
                fight_force: userInfo.fight_force,
                custom_king: userInfo.custom_king,
                level: userInfo.status.level,
                vip: userInfo.status.vip,
            });
        }
        resp.data.list = list;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_records = function (req, res, resp) {
    var uid = +req.uid;
    do {
        if (gWorldWar.progress == 'rank') {
            resp.code = 1; resp.desc = 'error time'; break;
        }

        resp.data.replays = gWorldWar.replays;
        resp.data.records = gWorldWar.records;
        resp.data.progress = gWorldWar.progress;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_team = function (req, res, resp) {
    var uid = +req.uid;
    do {

        DEBUG("progress = " + gWorldWar.progress + " , round = " + gWorldWar.round);

        // 阶段检查
        if (['16', '8', '4', '2', '1'].indexOf(gWorldWar.progress) == -1 || gWorldWar.round != 1) {
            resp.code = 100; resp.desc = 'invalid progress'; break;
        }

        var info = gUserInfo.getUser(uid);
        var warTeam = info.worldwar.team;
        var team1 = req.args.pve_team;

        var newTeam = {};
        var usedSiteMap = {};

        for (var hid in warTeam) {
            if(team1[hid])
            {
                var siteId = warTeam[hid]
                newTeam[hid] = siteId;
                usedSiteMap[siteId] = true;
            }
        }

        for (var hid in team1)
        {
            if (!newTeam[hid])
            {
                for (var i = 1; i <= 9; i++)
                {
                    if (!usedSiteMap[i])
                    {
                        newTeam[hid] = i;
                        usedSiteMap[i] = true;
                        break
                    }
                }
            }
        }

        gUserInfo.getUser(uid).worldwar.team = newTeam;
        gUserInfo.markDirty(uid);


        // 总是补全没设定位置的武将
        // var slots = SlotArray.slice();
        // for (var pos in team) {
        //     slots.remove(team[pos]);
        // }
        // for (var pos in info.pos) {
        //     if (info.pos[pos].rid && !team[pos]) {
        //         team[pos] = slots[0];
        //         slots.shift();
        //     }
        // }
        
        resp.data.team = newTeam;
        resp.data.skills = info.worldwar.skills;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.set_team = function (req, res, resp) {
    var uid = +req.uid;
    do {
        // 阶段检查
        if (['16', '8', '4', '2', '1'].indexOf(gWorldWar.progress) == -1 || gWorldWar.round != 1) {
            resp.code = 100; resp.desc = 'invalid progress'; break;
        }

        gUserInfo.getUser(uid).worldwar.team = req.args.team;
        gUserInfo.getUser(uid).worldwar.skills = req.args.skills;

        // var worldWarSkills = gUserInfo.getUser(uid).worldwar.skills;
        // var skills = req.args.skills;
        // for (var i = 0, len = skills.length; i < len; i++) {
        //     worldWarSkills[i + 1] = skills[i];
        // }
        gUserInfo.markDirty(uid);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.prepare = function (req, res, resp) {
    var uid = +req.uid;
    do {
        // 阶段检查
        var progress = +gWorldWar.progress;
        var pIdx = [16, 8, 4, 2, 1].indexOf(progress);
        if (pIdx == -1 || gWorldWar.round != 2) {
            resp.code = 100; resp.desc = 'invalid progress'; break;
        }

        // 是否已淘汰
        var pos1 = gWorldWar.top32.indexOf(uid);
        var rank = gWorldWar.top32Rank.indexOf(uid) + 1;
        if (!rank || rank > progress * 2) {
            resp.code = 1; resp.desc = 'already out'; break;
        }

        // 计算存储record的位置pos
        var offset = pos1;
        for (var i = 0; i <= pIdx; i++) {
            offset = Math.floor(offset / 2);
        }
        var recordPos = [0, 16, 24, 28, 30][pIdx] + offset;

        // 是否已报名
        if (gWorldWar.curPlayers.indexOf(uid) % 2) {
            if ([3, 4, 5, 6].indexOf(gWorldWar.result[recordPos] % 10) != -1) {
                resp.code = 102; resp.desc = 'already signed'; break;
            }
        } else {
            if ([1, 2, 5, 6].indexOf(gWorldWar.result[recordPos] % 10) != -1) {
                resp.code = 102; resp.desc = 'already signed'; break;
            }
        }

        var curPos1 = gWorldWar.curPlayers.indexOf(uid);
        var enemyId = 0;
        if (curPos1 % 2) {
            enemyId = gWorldWar.curPlayers[curPos1 - 1];
        } else {
            enemyId = gWorldWar.curPlayers[curPos1 + 1];
        }

        var replay = {
            info: gUserInfo.getUserFightInfo(uid, true, true),
            enemy: gUserInfo.getUserFightInfo(enemyId, true, true),
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        };
        resp.data = replay;
        resp.data.pos = recordPos;
    } while (false);

    onReqHandled(res, resp, 1);
};

// 晋级赛战斗
exports.prepare_fight = function (req, res, resp) {
    var uid = req.uid;
    do {
        // 阶段检查
        var progress = +gWorldWar.progress;
        if ([16, 8, 4, 2, 1].indexOf(progress) == -1 || gWorldWar.round != 2) {
            resp.code = 100; resp.desc = 'invalid progress'; break;
        }

        var replay = req.args.replay;
        var fightUid = replay.info.uid;
        var enemyId = replay.enemy.uid;
        var pos = gWorldWar.top32.indexOf(fightUid);

        var failerRank = 32;
        var winnerRank = progress;
        if (progress == 16) {

        } else if (progress == 8) {
            pos = gWorldWar.records.indexOf(pos);

            failerRank = 16;
            winnerRank = 8;
        } else if (progress == 4) {
            pos = gWorldWar.records.indexOf(pos, 16) - 16;

            failerRank = 8;
            winnerRank = 4;
        } else if (progress == 2) {
            pos = gWorldWar.records.indexOf(pos, 24) - 24;

            failerRank = 4;
            winnerRank = 2;
        } else if (progress == 1) {
            pos = gWorldWar.records.indexOf(pos, 28) - 28;

            failerRank = 2;
            winnerRank = 1;
        }
        var pos1 = gWorldWar.top32.indexOf(fightUid);
        var pos2 = gWorldWar.top32.indexOf(enemyId);
        var recordPos = req.args.pos;

        var rs = gWorldWar.result[recordPos];
        var winPos = 0;
        var losePos = 0;
        if (req.args.star > 0) {
            winPos = pos1;
            losePos = pos2;
            if (req.args.status == 'prepare_ww_final') {
                rs = (pos % 2 ? 3 : 1) + pos1 * 10;
            } else {
                rs = (pos % 2 ? 8 : 7) + pos1 * 10;
            }

            resp.data.player_rank = winnerRank;
            resp.data.enemy_rank = failerRank;
        } else {
            winPos = pos2;
            losePos = pos1;
            if (req.args.status == 'prepare_ww_final') {
                rs = (pos % 2 ? 4 : 2) + pos2 * 10;
            } else {
                rs = (pos % 2 ? 7 : 8) + pos2 * 10;
            }

            resp.data.player_rank = failerRank;
            resp.data.enemy_rank = winnerRank;
        }

        if (req.uid != fightUid) {
            // 其他人帮助战斗
            if (gWorldWar.result[recordPos] != -1) {
                resp.code = 101; resp.desc = 'already prepared'; break;
            }
        } else if (gWorldWar.result[recordPos] != -1) {
            // 自己的战斗且已有战报
            if (pos % 2) {
                if ([3, 4, 5, 6].indexOf(gWorldWar.result[recordPos]) != -1) {
                    resp.code = 102; resp.desc = 'already prepared'; break;
                }
            } else {
                if ([1, 2, 5, 6].indexOf(gWorldWar.result[recordPos]) != -1) {
                    resp.code = 102; resp.desc = 'already prepared'; break;
                }
            }
        }

        gWorldWar.result[recordPos] = rs;
        gWorldWar.addUpdate('result', gWorldWar.result);

        var replayId = gWorldWar.saveReplay(replay);
        gWorldWar.replays[recordPos] = [{ 'win': winPos, 'lose': losePos, 'rid': replayId, 'win_rank': winnerRank, 'failer_rank': failerRank }];
        gWorldWar.addUpdate('replays', gWorldWar.replays);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.worship = function (req, res, resp) {
    do {
        var rank = req.args.rank;
        if (!rank) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        resp.code = gWorldWar.updateWorship(rank - 1);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 注册服务器
exports.register_server = function (req, res, resp) {
    do {
        var serverId = req.args.sid;
        if ((!serverId || isNaN(serverId)) && serverId != 0) {
            resp.code = 1; resp.desc = 'server id needed'; break;
        }

        gWorldWar.servers[serverId] = [req.args.ip, req.args.port, req.args.openTime];
        gWorldWar.addUpdate('servers', gWorldWar.servers);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.WorldWar = WorldWar;
