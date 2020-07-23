
function Country() {
    this.balance = 0;                           // 上次结算时间
    this.country = {                            // 国家
    /*
        '1': {                                  // 国家id
            'position': {
                id: {                           // 官职id, 子节点数量固定
                    uid: 0,                     // uid: 是否正在战斗
                }
            }
            'score': 0,                         // 国战积分
            'victory': 0,                       // 国战胜利次数
            'failure': 0,                       // 国战失败次数
        },
    */
    };

    this.reports = {
    /*
        uid: [
            [time, attack, enemy, success, position]    // 时间, 是否为进攻方, 敌方uid, 是否胜利, 新官职id, 如为0则是官职不变
        ],
    */
    };

    this.robots = {
    /*
    id : {
        un : '',
        headpic : '',
        level : 0,
        pos : {
            1 : {
                hid : 0,
                slot : 0,
                attr : {}
                fight_force : 0,
                soldier_level : 1,
            }
        },
    }
    */
    };

    // 内存数据
    this.userPosition = {                       // 玩家官职对应关系
        /* uid: position */
    };
    this.lowestPosition = 0;                    // 最低阶官阶, 此官阶不限制人数
    this.countryMembers = [0, 0, 0];            // 三国国家的人数

    this.userSalary = {                         // 玩家俸禄对应表
        /*
        uid : day_salary,
        * */
    };
    this.userUpdateTime = {                     // 玩家俸禄结算时间对应表
        /*
         uid : update_time,
         * */
    };
}

Country.create = function(callback) {
    var countryData = {
        '_id': 'country',
        'country': {
            '1': {
                'position': {},
                'score': 0,
                'victory': 0,
                'failure': 0,
            },
            '2': {
                'position': {},
                'score': 0,
                'victory': 0,
                'failure': 0,
            },
            '3': {
                'position': {},
                'score': 0,
                'victory': 0,
                'failure': 0,
            },
        },
        'robots': {
            // uid: nameid,
        },
        'reports': {},
        'balance': 0,
    };

    var allCount = 0;
    for (var id in gConfPosition) {
        allCount += gConfPosition[id].count;
    }

    var maxId = 0;
    for(var i in gConfName) {
        if (+i > maxId) {
            maxId = +i;
        };
    }

    var robotId = 1;
    for (var i = 1; i <= CountryNum; i++) {
        for (var pos in gConfPosition) {
            countryData.country[i].position[pos] = {};

            var count = gConfPosition[pos].count;
            for (var j = 0; j < count; j++) {
                var firstId = common.randRange(1, maxId);
                var secondId = common.randRange(1, maxId);
                var male = common.randArray([0, 1]);
                countryData.robots[robotId] = firstId * 100000 + secondId * 10 + male;
                countryData.country[i].position[pos][robotId++] = 0;
            }
        }
    }

    gDBWorld.insert(countryData, function(err, result) {
        callback && callback();
    });
};

Country.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'country'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.country = doc.country;
                this.reports = doc.reports;
                this.balance = doc.balance;

                for (var cid in this.country) {
                    var country = this.country[cid];
                    var position = country.position;

                    for (var pos in position) {
                        for (var uid in position[pos]) {
                            this.userPosition[uid] = +pos;

                            if (!isDroid(uid)) {
                                this.countryMembers[cid] += 1;
                            }
                        }
                    }
                }

                for (var id in gConfPosition) {
                    if (id > this.lowestPosition) {
                        this.lowestPosition = +id;
                    }
                }

                this.robotNameIds = doc.robots;

                gUserInfo.getCountrySalaryList(this.userSalary, this.userUpdateTime);

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    getRobot : function (id, pos) {
        if (this.robots[id]) {
            return this.robots[id];
        } else {
            var positionConf = gConfPosition[pos];
            var robotFightForce = common.randRange(positionConf.powerMin, positionConf.powerMax);

            // 生成机器人
            var level = positionConf.robotLv;
            var posObj = generateRobot(5, level, robotFightForce);

            var realFightForce = 0;
            var maxHeroFF = 0;
            var maxHero = 0;
            for (var pos in posObj) {
                var ff = posObj[pos].fight_force;
                realFightForce += ff;
                if(ff > maxHeroFF) {
                    maxHeroFF = ff;
                    maxHero = +posObj[pos].rid;
                }
            }

            var index = id;
            var nameId = this.robotNameIds[id];
            if (!nameId) {
                var maxId = Object.keys(gConfName).max();
                var firstId = common.randRange(1, maxId);
                var secondId = common.randRange(1, maxId);
                var male = common.randArray([0, 1]);
                nameId = firstId * 100000 + secondId * 10 + male;
            }


            var firstId = Math.floor(nameId/100000);
            var secondId = Math.floor((nameId%100000)/10);
            var male = nameId%10 ? 'female' : 'male';
            var name = gConfName[firstId].first + gConfName[secondId][male];
            var level = Math.round(realFightForce/15000+18+0.5);
            level = level > gMaxUserLevel ? gMaxUserLevel : level;

            this.robots[id] = {
                un: name,
                headpic : common.randArray([1,2,3,4,5,6,7,8,9,10]),
                headframe : 30002,
                level: level,
                pos: posObj,
                max_hero : maxHero,
                fight_force: realFightForce,
            };

            return this.robots[id];
        }
    },

    save: function(callback) {
        var updates = {
            '$set' : {
                'country': this.country,
                'reports': this.reports,
                'balance': this.balance,
            },
        };

        gDBWorld.update({'_id': 'country'}, updates, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    checkChallenge: function(cid, uid, enemy) {
        var position = this.country[cid].position;
        var enemyPos = this.userPosition[enemy];
        if (!enemyPos) {
            return 101;
        }

        if (!position[enemyPos].hasOwnProperty(enemy)) {
            return 102;
        }

        var userPos = this.userPosition[uid];
        if (gConfPosition[userPos].position - gConfPosition[enemyPos].position > 1) {
            return 103;
        }

        return 0;
    },

    addReport: function(uid, enemy, success, userPos, enemyPos, replay) {
        var userReport = this.reports[uid];
        if (!userReport) {
            userReport = this.reports[uid] = [];
        }
        var enemyReport = this.reports[enemy];
        var isPlayer = true;
        if (!enemyReport) {
            if (isDroid(enemy)) {
                isPlayer = false;
            } else {
                enemyReport = this.reports[enemy] = [];
            }
        }

        var now = common.getTime();
        var replayKey = gReplay.addReplay(replay);
        var diff = 0;
        if (success) {
            if (userPos > enemyPos) {
                diff = userPos - enemyPos;

                userReport.push([now, 1, enemy, 1, enemyPos, userPos, diff, replayKey]);
                isPlayer && enemyReport.push([now, 0, uid, 0, userPos, enemyPos, -diff, replayKey]);
            } else {
                userReport.push([now, 1, enemy, 1, userPos, enemyPos, diff, replayKey]);
                isPlayer && enemyReport.push([now, 0, uid, 0, enemyPos, userPos, diff, replayKey]);
            }
        } else {
            userReport.push([now, 1, enemy, 0, userPos, enemyPos, diff, replayKey]);
            isPlayer && enemyReport.push([now, 0, uid, 1, enemyPos, userPos, diff, replayKey]);
        }

        if (userReport.length > gConfGlobalNew.countryReportCount) {
            userReport.shift();
        }
        if (isPlayer && enemyReport.length > gConfGlobalNew.countryReportCount) {
            enemyReport.shift();
        }
    },

    getBalanceTime: function() {
        var dateStr = common.getDateString();
        var hour = Math.floor(gConfGlobalNew.countryBalanceTime);
        var mins = Math.floor((gConfGlobalNew.countryBalanceTime%1)*60);

        return Date.parse(dateStr + " " + hour + ":"+mins +":00")/1000;
    },

    getHonorTopUid: function(country) {
        try {
            return Object.keys(gCountry.country[country].position[1])[0];
        }catch (e){
            return 0;
        }
    },

    getHonorTopUser: function(country) {
        var uid = this.getHonorTopUid(country);
        if (isDroid(uid)) {
            var robot = this.getRobot(uid, 1);
            return {
                uid: uid,
                un: robot.un,
                headpic: robot.max_hero,
                headframe : robot.headframe,
                promote: [],
                bullet: gUserInfo.getHonorUserBullet(uid),
            };
        } else {
            return gUserInfo.getHonorUser(uid);
        }
    },

    setCountry: function(country, _uid) {
        if (!country) {
            var countryFF = [0, 0, 0];
            for (var cid in this.country) {
                var sumFF = 0;
                for (var pos in gConfPosition) {
                    if (gConfPosition[pos].position > 3) {
                        continue;
                    }

                    var position = this.country[cid].position[pos];
                    for (var uid in position) {
                        if (isDroid(uid)) {
                            var robot = this.getRobot(uid, pos);
                            sumFF = robot.fight_force;
                        } else {
                            sumFF = gUserInfo.getUserFightForce(uid);
                        }
                    }
                }

                countryFF[+cid - 1] = sumFF;
            }

            var total = countryFF.sum();
            var weights = {
                '1': total - countryFF[0],
                '2': total - countryFF[1],
                '3': total - countryFF[2],
            };

            country = +common.wRand(weights);
        }

        // 分配皇城官职
        this.userPosition[_uid] = this.lowestPosition;
        this.country[country].position[this.lowestPosition][_uid] = 0;
        return country;
    },

    updateSalary : function (uid, day_salary, update_time) {
        this.userSalary[uid] = day_salary;
        this.userUpdateTime[uid] = update_time;
    },

    // 计算一遍所有玩家的俸禄
    calcSalary : function () {
        var timeStr = gConfGlobalNew['countrySalaryTime'];
        var arr = timeStr.split('-');
        var beginHour = parseInt(arr[0]) - 1;
        var endHour = parseInt(arr[1]);

        var curDate = new Date();
        var curTime = common.getTime();
        var curHour = curDate.getHours();
        var curDay = curDate.getDate();

        var now = new Date();
        now.setHours(beginHour);
        now.setMinutes(0);
        now.setSeconds(0);
        var startCalcTime = now.getTime()/1000;

        for (var id in this.userPosition) {
            var uid = parseInt(id);
            if (!isDroid(uid)) {
                var position = this.userPosition[uid];
                var salary = gConfPosition[position].salary;
                var update_time = this.userUpdateTime[uid];
                if (!update_time || update_time < startCalcTime) {
                    update_time = startCalcTime;
                    this.userSalary[uid] = 0;
                    this.userUpdateTime[uid] = update_time;
                }

                if (!this.userSalary[uid]) {
                    this.userSalary[uid] = 0;
                }

                var lastDate = new Date(update_time * 1000);
                var lastCalcHour = lastDate.getHours();
                var lastCalcDay = lastDate.getDate();

                // 如果上次计算的日期跟现在不是同一天，那今天的开始计算时间就从头开始
                if (lastCalcDay != curDay) {
                    lastCalcHour = beginHour;
                }

                if (curHour != lastCalcHour) {
                    // 跨点了才需要重新计算
                    if ( (curHour >= beginHour && curHour < endHour) ||
                        (lastCalcHour < endHour && curHour >= endHour)) {
                        var calcEndHour = curHour;
                        if (calcEndHour > endHour) {
                            calcEndHour = endHour;
                        }

                        var diffHour = calcEndHour - lastCalcHour;
                        if (diffHour > 0) {
                            this.userSalary[uid] += (salary * diffHour);
                            this.userUpdateTime[uid] = curTime;
                        }
                    }
                }
            }
        }
    },
};

exports.set_country = function(req, res, resp) {
    var country = req.args.country;

    // 更新太守数量
    var cid = gCountry.setCountry(req.args.country, req.uid);
    if (gBattle.userCity[req.uid]) {
        gBattle.lord_count[cid - 1]++;
    }

    resp.data.country = cid;
    resp.data.position = gCountry.lowestPosition;
    onReqHandled(res, resp, 1);
};

exports.get = function(req, res, resp) {
    resp.data.position = gCountry.userPosition[req.uid];
    if (req.args.country) {
        var position = gCountry.country[req.args.country].position;
        var list = [];
        for (var pos in position) {
            if (gConfPosition[pos].position > 2) {
                break;
            }

            for (var uid in position[pos]) {
                if (isDroid(uid)) {
                    var user = gCountry.robots[uid];
                    var promote = [];
                    list.push([user.un, user.level, user.fight_force, +user.pos[1].rid, +uid, promote, 0, 0]);
                } else {
                    var user = gUserInfo.getUser(uid);
                    var ff = gUserInfo.getUserFightForce(uid);
                    list.push([user.info.un, user.status.level, ff, +user.info.model, +uid, user.info.promote,
                        user.sky_suit.weapon_illusion, user.sky_suit.wing_illusion]);
                }
            }
        }

        resp.data.list = list;
        resp.data.lord = gBattle.lastLord[req.args.country - 1];
        resp.data.city = 0;
    }

    onReqHandled(res, resp, 1);
};

exports.get_city = function(req, res, resp) {
    resp.data.position = gCountry.userPosition[req.uid];

    if (!resp.data.position) {
        // 数据丢失异常, 重新进入国家
        gCountry.setCountry(req.args.country, req.uid);
        resp.data.position = gCountry.lowestPosition;
    }
    var tKingData = gCountry.country[req.args.country].position[1];
    var tKingUserInfo = null;
    for (var uid in tKingData) {
        var pos = 1
        if (isDroid(uid)) {
            var robot = gCountry.getRobot(uid, pos);

            tKingUserInfo = {};
            tKingUserInfo.uid = +uid;
            tKingUserInfo.un = robot.un;
            tKingUserInfo.headpic = robot.headpic;
            tKingUserInfo.headframe = robot.headframe;
            tKingUserInfo.level = robot.level;
            tKingUserInfo.fight_force = robot.fight_force;
            tKingUserInfo.pos = Number(pos);
            tKingUserInfo.max_force_hid = robot.max_hero;
        }
        else {
            var user = gUserInfo.getUser(uid);
            if (user.pos[1]) {
                var heroCombatConf = getHeroCombatConf(user.pos[1].rid);
            }
            tKingUserInfo = {
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'model': user.info.model,
                'level': user.status.level,
                'fight_force': gUserInfo.getUserFightForce(uid),
                'quality': heroCombatConf ? heroCombatConf.quality : 2,
                'promote': user.info.promote,
                'weapon_illusion': user.sky_suit.weapon_illusion,
                'wing_illusion': user.sky_suit.wing_illusion,
                'mount_illusion': user.sky_suit.mount_illusion,
                'custom_king': user.custom_king,
            };
        }
        break;
    }
    resp.data.king_info = tKingUserInfo;

    onReqHandled(res, resp, 1);
};

exports.get_position = function(req, res, resp) {
    do {
        var country = req.args.country;
        var position = req.args.position;
        var pos = gCountry.country[country].position[position];
        if (!pos) {
            resp.code = 1; resp.desc= 'invalid args'; break;
        }

        // 随机4人
        var retList = {};
        var retUids = Object.keys(pos).shuffle();
        for (var i = 0; i < 4; i++) {
            var uid = retUids[i];
            if (uid) {
                var user = null;
                if (isDroid(uid)) {
                    user = gCountry.getRobot(uid, position);

                    retList[uid] = {
                        'un': user.un,
                        'headpic': user.headpic,
                        'headframe' : user.headframe,
                        'model': +user.pos[1].rid,
                        'level': user.level,
                        'fight_force': user.fight_force,
                        'quality': 1,
                        'promote': [],
                        'weapon_illusion': 0,
                        'wing_illusion': 0,
                        'mount_illusion': 0,
                    };
                } else {
                    user = gUserInfo.getUser(uid);
                    var heroCombatConf = getHeroCombatConf(user.pos[1].rid);
                    if (!heroCombatConf) {
                        ERROR("heroCombatConf not fount, hid = " + user.pos[1].rid + ", uid = " + uid);
                    }
                    retList[uid] = {
                        'un': user.info.un,
                        'headpic': user.info.headpic,
                        'headframe' : gUserInfo.getRankHeadFrame(uid),
                        'model': user.info.model,
                        'level': user.status.level,
                        'fight_force': gUserInfo.getUserFightForce(uid),
                        'quality': heroCombatConf ? heroCombatConf.quality : 2,
                        'promote': user.info.promote,
                        'weapon_illusion': user.sky_suit.weapon_illusion,
                        'wing_illusion': user.sky_suit.wing_illusion,
                        'mount_illusion': user.sky_suit.mount_illusion,
                        'custom_king' : user.custom_king,
                    };
                }
            } else {
                break;
            }
        }

        resp.data.list = retList;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.challenge = function(req, res, resp) {
    do {
        var cid = req.args.country;
        var enemyId = req.args.enemy;

        var check = gCountry.checkChallenge(cid, req.uid, enemyId);
        if (check) {
            resp.code = check; resp.desc = 'invalid challenge'; break;
        }

        var enemy = {};
        if (isDroid(enemyId)) {
            var enemyPos = gCountry.userPosition[enemyId];
            var robot = gCountry.getRobot(enemyId, enemyPos);
            enemy = robot;
            enemy.name = robot.un;

            if (enemy.headframe == 0) {
                enemy.headframe = 30002;
            }
        } else {
            enemy = gUserInfo.getUserFightInfo(enemyId);
        }

        var replay = {
            info: gUserInfo.getUserFightInfo(req.uid, true),
            enemy: enemy,
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        }
        resp.data = replay;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.fight = function(req, res, resp) {
    do {
        var uid = req.uid;
        var country = req.args.country;
        var enemyId = req.args.enemy;

        var check = gCountry.checkChallenge(country, req.uid, enemyId);
        if (check) {
            resp.code = check; resp.desc = 'invalid challenge'; break;
        }

        var userPos = gCountry.userPosition[req.uid];
        var enemyPos = gCountry.userPosition[enemyId];
        var position = gCountry.country[country].position;

        var diff = 0;
        if (req.args.star > 0 && userPos > enemyPos) {
            gCountry.userPosition[uid] = enemyPos;
            gCountry.userPosition[enemyId] = userPos;

            delete position[userPos][uid];
            delete position[enemyPos][enemyId];

            position[enemyPos][uid] = 0;
            position[userPos][enemyId] = 0;

            if (enemyPos == 1) {
                var userName = gUserInfo.getUser(uid).info.un;
                if (isDroid(enemyId)) {
                    var robot = gCountry.getRobot(enemyId, enemyPos)
                    var enemyName = robot.un;
                } else {
                    var enemyName = gUserInfo.getUser(enemyId).info.un;
                }

                var array = [];
                array[0] = userName;
                array[1] = enemyName;
                array[2] = gConfLocalText['STR_OFFICE_1'].Text;
                pushSysMsg('updateKing', array);
            }

            resp.data.position = enemyPos;
            resp.data.enemy_position = userPos;
            diff = userPos - enemyPos;
        } else {
            position[userPos][uid] = 0;
            position[enemyPos][enemyId] = 0;

            resp.data.position = userPos;
            resp.data.enemy_position = enemyPos;
        }

        resp.data.diff = diff;

        var sucess = req.args.star > 0 ? 1 : 0;
        gCountry.addReport(uid, enemyId, sucess, userPos, enemyPos, req.args.replay);
        gTips.addTip(enemyId, 'country_report');
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_report = function(req, res, resp) {
    var reports = [];
    var originReports = gCountry.reports[req.uid];

    if (originReports) {
        for (var i = 0, len = originReports.length; i < len; i++) {
            var origin = originReports[i];
            if (isDroid(origin[2])) {
                var robot = gCountry.getRobot(origin[2], origin[5]);
                reports.push({
                    'uid': origin[2],
                    'time': origin[0],
                    'attack': origin[1],
                    'un': robot.un,
                    'headpic': robot.headpic,
                    'headframe' : robot.headframe || 30002,
                    'level': robot.level,
                    'vip': 0,
                    'fight_force': robot.fight_force,
                    'success': origin[3],
                    'position': origin[4],
                    'enemy_pos' : origin[5],
                    'diff' : origin[6],
                    'quality': 1,
                    'replay': origin[7],
                });
            } else {
                var enemy = gUserInfo.getUser(origin[2]);
                var heroCombatConf = getHeroCombatConf(enemy.pos[1].rid);
                if (!heroCombatConf) {
                    ERROR("heroCombatConf not fount, hid = " + enemy.pos[1].rid);
                }
                reports.push({
                    'uid': origin[2],
                    'time': origin[0],
                    'attack': origin[1],
                    'un': enemy.info.un,
                    'headpic': enemy.info.headpic,
                    'headframe' : gUserInfo.getRankHeadFrame(origin[2]),
                    'level': enemy.status.level,
                    'vip': enemy.status.vip,
                    'fight_force': enemy.fight_force,
                    'success': origin[3],
                    'position': origin[4],
                    'enemy_pos' : origin[5],
                    'diff' : origin[6],
                    'quality': getQuality(enemy.custom_king),
                    'replay': origin[7],
                    'custom_king' : enemy.custom_king,
                });
            }
        }
    }

    resp.data.reports = reports;
    onReqHandled(res, resp, 1);
};

exports.rank_list = function(req, res, resp) {
    var position = gCountry.country[req.args.country].position;

    var ranks = [];
    var rank = 0;
    var selfRank = 0;
    for (var pos in position) {
        // 判断是否超出要求的数量
        if (ranks.length >= gConfGlobalNew.rankListLimit_kingMe) break;

        for (var uid in position[pos]) {
            // 判断是否超出要求的数量
            if (ranks.length >= gConfGlobalNew.rankListLimit_kingMe) break;

            if (isDroid(uid)) {
                var robot = gCountry.getRobot(uid, pos);

                var robotInfo = {};
                robotInfo.uid = +uid;
                robotInfo.un = robot.un;
                robotInfo.headpic = robot.headpic;
                robotInfo.headframe = robot.headframe;
                robotInfo.level = robot.level;
                robotInfo.fight_force = robot.fight_force;
                robotInfo.pos = Number(pos);
                robotInfo.max_force_hid = robot.max_hero;

                ranks.push(robotInfo);
                rank++;
            } else {
                var user = gUserInfo.getUser(uid);

                var userInfo = {};

                userInfo.uid = +uid;
                userInfo.un = user.info.un;
                userInfo.headpic = user.info.headpic;
                userInfo.headframe = gUserInfo.getRankHeadFrame(uid);
                userInfo.level = user.status.level;
                userInfo.fight_force = gUserInfo.getUserFightForce(uid);
                userInfo.vip = user.status.vip;
                userInfo.pos = Number(pos);
                userInfo.custom_king = user.custom_king;

                // 国王需要的模型数据
                if (pos == 1) {
                    var maxFightForce = 0;
                    var maxHidPromote = 0;
                    for(var p in user.pos) {
                        if (user.pos[p].fight_force > maxFightForce) {
                            maxFightForce = user.pos[p].fight_force;
                            maxHidPromote = user.pos[p].promote;
                        }
                    }

                    userInfo.max_force_hid = user.info.model;
                    userInfo.promote = maxHidPromote;
                    userInfo.weapon_illusion = 0;
                    userInfo.wing_illusion = 0;
                    userInfo.mount_illusion = 0;

                    if (user.pos[1].rid == user.info.model) {
                        userInfo.weapon_illusion = user.sky_suit.weapon_illusion;
                        userInfo.wing_illusion = user.sky_suit.wing_illusion;
                        userInfo.mount_illusion = user.sky_suit.mount_illusion;
                    }

                    // 第一名需要显示军团名
                    userInfo.legionName = '';
                    var lid = gNewLegion.getUserLegionId(uid);
                    if (lid > 0) {
                        var legion = gNewLegion.get(lid);
                        if (legion) {
                            userInfo.legionName = legion.name;
                        }
                    }
                }
                ranks.push(userInfo);
                rank++;

                if (uid == req.uid) {
                    selfRank = rank;
                }
            }
        }
    }

    var selfUser = gUserInfo.getUser(req.uid);
    var selfInfo = {};
    selfInfo.uid = req.uid;
    selfInfo.un = selfUser.info.un;
    selfInfo.headpic = selfUser.info.headpic;
    selfInfo.headframe = gUserInfo.getRankHeadFrame(req.uid);
    selfInfo.level = selfUser.status.level;
    selfInfo.fight_force = selfUser.fight_force;
    selfInfo.vip = selfUser.status.vip;
    selfInfo.pos = gCountry.userPosition[req.uid];
    selfInfo.rank = selfRank;
    resp.data.self = selfInfo;

    resp.data.rank_list = ranks;
    onReqHandled(res, resp, 1);
};

exports.fix_position = function(req, res, resp) {
    var allRobotIds = Object.keys(gCountry.robots);
    var allCount = 0;
    for (var id in gConfPosition) {
        allCount += gConfPosition[id].count;
    }

    for (var cid in gCountry.country) {
        var country = gCountry.country[cid];
        var position = country.position;
        var robotIds = allRobotIds.slice((cid - 1) * allCount, cid * allCount);

        for (var pos in position) {
            if (pos == 32) {
                continue;
            }

            for (var uid in position[pos]) {
                if (uid == 'undefined') {
                    delete position[pos][uid];
                    continue;
                }

                if (gCountry.userPosition[uid] != +pos) {
                    delete position[pos][uid];
                }
            }

            var count = gConfPosition[pos].count;
            var realCount = Object.keys(position[pos]).length;
            while (realCount > count) {
                for (var uid in position[pos]) {
                    delete position[pos];
                    realCount--;
                    break;
                }
            }

            for (var uid in position[pos]) {
                if (isDroid(uid)) {
                    robotIds.remove(uid);
                }
            }

            while (realCount < count) {
                position[pos][robotIds.shift()] = 0;
                realCount++;
            }
        }

        while (robotIds.length) {
            position[gCountry.lowestPosition][robotIds.shift()] = 0;
        }
    }

    onReqHandled(res, resp, 1);
};

exports.Country = Country;
