function UserInfo() {
    this.lastRank = {                       // 昨天用户的战斗力排名
        /* uid: rank*/
    };
    this.lastLvRank = {                       // 昨天用户的战斗力排名
        /* uid: rank*/
    };
    this.bullet = {                         // 印象弹幕
        // uid: []                          // uid: [弹幕]
    };

    this.time = 0;                          // 上次每日更新时间
    this.weekTime = 0;                     // 上次每周更新时间

    this.taptapDailyAwardTime = 0;  // taptap每日奖励发放时间
    this.taptapDailyAwardTime_am = 0;  // taptap每日奖励发放时间

    this.legionBossNoticeTime = 0;
    this.territoryBossNoticeTime = 0;

    this.passDayTime = 0;   // 上一次跨天时间

    // 内存信息
    this.users = {};                        // 所有用户的world信息
    this.ranks = new RankTree(              // 战斗力排名
        // 存储对象 [uid, fightForce]
        function (c1, c2) {
            // 同一个人作为相等, 用于删除
            if (c1[0] == c2[0]) return 0;

            // 不同人战斗力排先后, 战斗力相等uid排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c1[0] < c2[0] ? -1 : 1;
        }
    );

    this.lvRanks = new RankTree(              // 等级排行榜
        // 存储对象 [uid, lv, xp]
        function (c1, c2) {
            // 同一个人作为相等, 用于删除
            if (c1[0] == c2[0]) return 0;

            // 不同人经验排先后, 经验相等uid排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            if (c1[2] > c2[2]) return -1;
            if (c1[2] < c2[2]) return 1;
            return c1[0] < c2[0] ? -1 : 1;
        }
    );

    this.recharge_time = 0;
    this.recharge_rank = new RankList(              // 充值排行
        function (c1, c2) {
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            if (c1[2] < c2[2]) return -1;
            if (c1[2] > c2[2]) return 1;
            return c1[0] < c2[0] ? -1 : 1;
        }
    );

    this.expense_time = 0;
    this.expense_rank = new RankList(              // 消费排行
        // 存储对象 [uid, expense]
        function (c1, c2) {
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            if (c1[2] < c2[2]) return -1;
            if (c1[2] > c2[2]) return 1;
            return c1[0] < c2[0] ? -1 : 1;
        }
    );

    this.userName = {
        //name : uid                         // 玩家名字->玩家id
    };

    this.vipCount = [];

    this.updates = {                        // 待更新数据
    };
}

UserInfo.create = function (callback) {
    var userInfoData = {
        '_id': 'user',
        'last_rank': {},
        'last_lv_rank': {},
        'time': 0,
        'week_time': 0,
        'bullet': {},
        'taptapDailyAwardTime': 0,
        'taptapDailyAwardTime_am': 0,
        'legionBossNoticeTime': 0,
        'territoryBossNoticeTime': 0,
        'passDayTime': 0,
    };

    gDBWorld.insert(userInfoData, function (err, result) {
        callback && callback();
    });
};

UserInfo.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'user' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.lastRank = doc.last_rank;
                this.lastLvRank = doc.lastLvRank || {};
                this.bullet = doc.bullet;
                this.time = doc.time ? doc.time : 0;
                this.weekTime = doc.week_time ? doc.week_time : 0;
                this.taptapDailyAwardTime = doc.taptapDailyAwardTime;
                this.taptapDailyAwardTime_am = doc.taptapDailyAwardTime_am;
                this.expense_time = doc.expense_time || 0;
                this.recharge_time = doc.recharge_time || 0;
                this.legionBossNoticeTime = doc.legionBossNoticeTime;
                this.territoryBossNoticeTime = doc.territoryBossNoticeTime;
                this.passDayTime = doc.passDayTime;

                if (!this.taptapDailyAwardTime) {
                    this.taptapDailyAwardTime = 0;
                    this.updates['taptapDailyAwardTime'] = this.taptapDailyAwardTime;
                }

                if (!this.taptapDailyAwardTime_am) {
                    this.taptapDailyAwardTime_am = 0;
                    this.updates['taptapDailyAwardTime_am'] = this.taptapDailyAwardTime_am;
                }

                if (!this.legionBossNoticeTime) {
                    this.legionBossNoticeTime = 0;
                    this.updates['legionBossNoticeTime'] = this.legionBossNoticeTime;
                }

                if (!this.territoryBossNoticeTime) {
                    this.territoryBossNoticeTime = 0;
                    this.updates['territoryBossNoticeTime'] = this.territoryBossNoticeTime;
                }

                if (!this.passDayTime) {
                    this.passDayTime = common.getTime();
                    this.updates['passDayTime'] = this.passDayTime;
                }

                for (var level in gConfVip) {
                    this.vipCount[level] = 0;
                }

                this._init(callback);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    _init: function (callback) {
        var cursor = gDBUser.find({}, {
            '_id': 1,
            'info': 1,
            'status': 1,
            'mark.login_time': 1,
            'mark.active_time': 1,
            'activity.rank': 1,
            //'pos': 1,
            'hero_bag': 1,
            'team': 1,
            'tower': 1,
            'guard.field_sync': 1,
            'bag.equip': 1,
            'bag.rune': 1,
            'hook_vol': 1,
            'country.update_time': 1,
            'country.day_salary': 1,
            'skills': 1,
            'def_info': 1,
            'sky_suit': 1,
            'payment': 1,
            'clan': 1,
            'new_legion': 1,
            'custom_king': 1,
            'custom_treasure': 1,
            'custom_village': 1,
            'dragon': 1,
            'rune_use': 1,
            'cardGetRecord': 1,
        });

        var now = common.getTime();
        cursor.each(function (err, item) {
            if (err) {
                callback && callback(false);
            }

            if (item) {
                var uid = item._id;
                if (isNaN(uid)) {
                    return;
                }

                //=====================fix==================
                var newPos = {};
                var oldPos = {};
                var defNewTeam = item.team[1];
                var defTeam = item.def_info.team;
                for (var hid in defNewTeam) {
                    var pos = defNewTeam[hid];
                    newPos[pos] = hid;
                }

                for (var hid in defTeam) {
                    var pos = defTeam[hid];
                    oldPos[pos] = hid;
                }

                var oldLength = Object.keys(oldPos).length;
                var newLength = Object.keys(newPos).length;
                if (oldLength != newLength) {
                    item.def_info.team = defNewTeam;//defNewTeam;
                }
                //=======================================

                this.users[uid] = {
                    'hero_bag': clone(item.hero_bag),
                    'team': item.team,
                    'info': {
                        'un': item.info.un,
                        'headpic': item.info.headpic,
                        'headframe': item.info.headframe ? item.info.headframe : 0,
                        'dragon': item.info.dragon,
                        'country': item.info.country,
                        'position': item.info.position,
                        'create': item.info.create,
                    },
                    'status': {
                        'level': item.status.level,
                        'xp': item.status.xp,
                        'vip': item.status.vip,
                        'arena_level': item.status.arena_level,
                        'food': item.status.food,
                        'team_exp': item.status.team_exp,
                    },
                    'mark': {
                        'login_time': item.mark.login_time,
                        'active_time': item.mark.active_time || 0,
                    },
                    'activity': {
                        'rank': (item.activity && item.activity.rank && item.activity.rank) ? item.activity.rank : {},
                    },
                    'tower': {
                        'top_floor': item.tower.top_floor || 0,
                        'top_time': item.tower.top_time || 0,
                    },
                    'country': {
                        'update_time': item.country.update_time,
                        'day_salary': item.country.day_salary,
                    },
                    'hook_vol': item.hook_vol,
                    'skills': item.skills,
                    'def_info': item.def_info,
                    'sky_suit': {
                        'weapon_illusion': item.sky_suit ? item.sky_suit.weapon_illusion : 0,
                        'wing_illusion': item.sky_suit ? item.sky_suit.wing_illusion : 0,
                        'mount_illusion': item.sky_suit ? item.sky_suit.mount_illusion : 0,
                    },
                    'payment': {
                        'week_card': item.payment ? item.payment.week_card : 0,
                        'month_card': item.payment ? item.payment.month_card : 0,
                        'long_card': item.payment ? item.payment.long_card : 0,
                    },
                    'clan': item.clan,
                    'new_legion': {
                        'join_time': item.new_legion ? item.new_legion.join_time : 0
                    },
                    'custom_king': item.custom_king,
                    'custom_treasure': item.custom_treasure,
                    'custom_village': item.custom_village,
                    'dragon': item.dragon,
                    'cardGetRecord': item.cardGetRecord,
                };

                this.userName[item.info.un] = uid;
                var maxHero = 0;
                var maxHeroFF = 0;
                var maxPromote = 0;
                var maxPos = 0;
                var pos = {};
                var team1 = item.team[1];
                for (var hindex in team1) {
                    var p = team1[hindex];
                    var theHobj = item.hero_bag.heros[hindex];
                    if (!theHobj) {
                        ERROR('===================uid:' + uid + 'heroindex:' + hindex);
                        continue;
                    }

                    pos[hindex] = {
                        'rid': theHobj.rid,
                        'level': theHobj.level,
                        'awake': theHobj.awake,
                        'tier': theHobj.tier,
                        'slot': +p,
                        'attr': theHobj.attr,
                        'fight_force': theHobj.fight_force,
                    };

                    if (theHobj.fight_force > maxHeroFF) {
                        maxHeroFF = theHobj.fight_force;
                        maxHero = theHobj.rid;
                        maxPos = p;
                    }

                }

                this.users[uid].info.model = maxHero; //todo 
                this.users[uid].pos = clone(pos);
                this.users[uid].maxPos = maxPos;

                var fightForce = 0;
                for (var p in this.users[uid].pos) {
                    fightForce += this.users[uid].pos[p].fight_force;
                }

                this.users[uid].fight_force = fightForce;
                this.ranks.insert([+uid, fightForce]);
                this.lvRanks.insert([+uid, item.status.level, item.status.xp]);
                var tActInfo = null;
                tActInfo = ((item.activity && item.activity.rank) && item.activity.rank.recharge) ? item.activity.rank.recharge : {};
                if (!tActInfo.stage || tActInfo.stage == gConfActivities["open_rank_recharge"].startTime) {
                    this.recharge_rank.update(uid, [uid, (tActInfo.value || 0), (tActInfo.time || 99999999999)], false);
                }
                tActInfo = (item.activity && item.activity.rank) && item.activity.rank.expense ? item.activity.rank.expense : {};
                if (!tActInfo.stage || tActInfo.stage == gConfActivities["open_rank_expense"].startTime) {
                    this.expense_rank.update(uid, [uid, (tActInfo.value || 0), (tActInfo.time || 99999999999)], false);
                }
                this.vipCount[item.status.vip]++;
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    getUser: function (uid) {
        var user = this.users[uid];
        if (!user) {
            user = clone(gInitWorldUser);
            for (var pos in user.team) {
                user.team_info[pos].equip = {};
                user.team_info[pos].rune = {};
            }
        }

        user.info.un = user.info.un || 'anonymous';
        user.status.clan_exp = user.status.clan_exp || 0;
        return user;
    },

    updateUser: function (item) {
        if (item) {
            var uid = item._id;
            if (isNaN(uid)) {
                return;
            }

            this.users[uid] = {
                'hero_bag': clone(item.hero_bag),
                'team': clone(item.team),
                'info': {
                    'un': item.info.un,
                    'headpic': item.info.headpic,
                    'headframe': item.info.headframe ? item.info.headframe : 0,
                    'dragon': item.info.dragon,
                    'country': item.info.country,
                    'position': item.info.position,
                    'create': item.info.create,
                },
                'status': {
                    'level': item.status.level,
                    'xp': item.status.xp,
                    'vip': item.status.vip,
                    'arena_level': item.status.arena_level,
                    'food': item.status.food,
                    'team_exp': item.status.team_exp,
                },
                'mark': {
                    'login_time': item.mark.login_time,
                    'active_time': item.mark.active_time || 0,
                },
                'activity': {
                    'rank': (item.activity && item.activity.rank && item.activity.rank) ? item.activity.rank : {},
                },
                'tower': {
                    'top_floor': item.tower.top_floor || 0,
                    'top_time': item.tower.top_time || 0,
                },
                'country': {
                    'update_time': item.country.update_time,
                    'day_salary': item.country.day_salary,
                },
                'hook_vol': item.hook_vol,
                'skills': item.skills,
                'def_info': item.def_info,
                'sky_suit': {
                    'weapon_illusion': item.sky_suit ? item.sky_suit.weapon_illusion : 0,
                    'wing_illusion': item.sky_suit ? item.sky_suit.wing_illusion : 0,
                    'mount_illusion': item.sky_suit ? item.sky_suit.mount_illusion : 0,
                },
                'payment': {
                    'week_card': item.payment ? item.payment.week_card : 0,
                    'month_card': item.payment ? item.payment.month_card : 0,
                    'long_card': item.payment ? item.payment.long_card : 0,
                },
                'clan': item.clan,
                'new_legion': {
                    'join_time': item.new_legion ? item.new_legion.join_time : 0
                },
                'custom_king': item.custom_king,
                'custom_treasure': item.custom_treasure,
                'custom_village': item.custom_village,
                'dragon': item.dragon,
                'cardGetRecord': item.cardGetRecord,
            };

            this.userName[item.info.un] = uid;
            var maxHero = 0;
            var maxHeroFF = 0;
            var maxPromote = 0;
            var maxPos = 0;
            var pos = {};
            var team1 = item.team[1];
            ERROR("AUDATE ALL USER==============");
            ERROR(team1);

            for (var hindex in team1) {
                var p = team1[hindex];
                var theHobj = clone(item.hero_bag.heros[hindex]);
                if (!theHobj) {
                    ERROR('===================uid:' + uid + 'heroindex:' + hindex);
                    continue;
                }

                pos[hindex] = {
                    'rid': theHobj.rid,
                    'level': theHobj.level,
                    'awake': theHobj.awake,
                    'tier': theHobj.tier,
                    'slot': +p,
                    'attr': theHobj.attr,
                    'fight_force': theHobj.fight_force,
                };

                if (theHobj.fight_force > maxHeroFF) {
                    maxHeroFF = theHobj.fight_force;
                    maxHero = theHobj.rid;
                    maxPos = p;
                }
            }

            this.users[uid].info.model = maxHero; //todo 
            this.users[uid].pos = clone(pos);
            this.users[uid].maxPos = maxPos;

            var fightForce = 0;
            for (var p in this.users[uid].pos) {
                fightForce += this.users[uid].pos[p].fight_force;
            }
            this.users[uid].fight_force = fightForce;
        }
    },

    getTapTapDailyTime_morning: function () {
        var dateStr = common.getDateString();
        var hour = 10;
        var mins = 0;

        return Date.parse(dateStr + " " + hour + ":" + mins + ":00") / 1000;
    },

    getTapTapDailyTime: function () {
        var dateStr = common.getDateString();
        var hour = 18;
        var mins = 0;

        return Date.parse(dateStr + " " + hour + ":" + mins + ":00") / 1000;
    },

    updateTaptapDailyAwardTime: function (time, am) {
        if (am) {
            this.taptapDailyAwardTime_am = time;
            this.updates['taptapDailyAwardTime_am'] = this.taptapDailyAwardTime_am;
        } else {
            this.taptapDailyAwardTime = time;
            this.updates['taptapDailyAwardTime'] = this.taptapDailyAwardTime;
        }

        this.save();
    },

    // 通知军团boss开启
    sendLegionBossNotice: function (time, endTime) {
        for (var id in this.users) {
            var uid = parseInt(id);
            var user = this.users[uid];
            if (user) {
                var lid = gNewLegion.getUserLegionId(uid);
                var legion = gNewLegion.get(lid);
                if (legion) {
                    var bossId = legion.boss.id;
                    if (bossId > 0) {
                        pushToUser(uid, 'self', {
                            mod: 'user',
                            act: 'legion_boss',
                            id: 1,
                            boss_id: bossId,
                            end_time: endTime
                        });
                    }
                }
            }
        }

        this.legionBossNoticeTime = time;
        this.updates['legionBossNoticeTime'] = this.legionBossNoticeTime;
    },

    // 通知领地boss开启
    sendTerritoryBossNotice: function (time) {
        gNewLegion.notifyTerritoryBoss();

        this.territoryBossNoticeTime = time;
        this.updates['territoryBossNoticeTime'] = this.territoryBossNoticeTime;
    },

    getUserQuality: function (uid) {
        var quality = 2;    // 一开始是绿色
        var user = this.getUser(uid);
        if (user) {
            if (user.custom_king.index > 0) {
                //quality = gConfCustomKing[user.custom_king.chapter][user.custom_king.index].quality;
            }
        }

        return quality;
    },

    isUserExist: function (uid) {
        if (this.users[uid])
            return true;

        return false;
    },

    updatePassDayTime: function (time) {
        DEBUG('updatePassDayTime time = ' + time);

        var phpReq = {
            uid: 1,
            act: 'pass_day',
            args: {
                sid: config.ServerId,
            },
        };

        var phpResp = {
            code: 0,
            desc: '',
        };

        requestPHP(phpReq, phpResp, function () {
            DEBUG(`updatePassDayTime request back: ${phpResp.code} ${phpResp.desc}`);
        });

        this.passDayTime = time;
        this.updates['passDayTime'] = this.passDayTime;
    },

    getUserFightInfo: function (uid, notUseDefPos) {
        var info = {};
        var user = this.getUser(uid);
        if (!user) {
            ERROR('====word======getUserFightInfo nononononono uid' + uid);
        }

        info.uid = uid;
        info.name = user.info.un;
        info.headpic = user.info.headpic;
        info.headframe = user.info.headframe;
        info.vip = user.status.vip;
        info.level = user.status.level;
        info.pos = clone(user.pos);
        //ERROR('====world======getUserFightInfo pos uid'+uid);
        //ERROR(info.pos);
        info.weapon_illusion = user.sky_suit.weapon_illusion;
        info.wing_illusion = user.sky_suit.wing_illusion;
        info.mount_illusion = user.sky_suit.mount_illusion;
        info.custom_king = user.custom_king;
        info.fight_force = user.fight_force;

        // 龙的等级
        info.dragon = {};
        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i] = user.dragon[i].level;
            }
        }

        var defInfo = user.def_info;
        if (!notUseDefPos && defInfo.set) {
            info.skills = clone(user.skills);
            for (var slot in defInfo.skills) {
                info.skills[slot].id = defInfo.skills[slot];
            }

            for (var hid in info.pos) {
                if (defInfo.team[hid]) {
                    info.pos[hid].slot = defInfo.team[hid];
                } else {
                    DEBUG(` defInfo.team`);
                    DEBUG(defInfo);
                }
            }
            /*
            for (var hid in defInfo.team) {
                if (info.pos[hid]) {
                    info.pos[hid].slot = defInfo.team[pos];
                } else {
                    DEBUG(` defInfo.team`);
                    DEBUG(defInfo);
                }
            }
            */
        } else {
            info.skills = user.skills;
        }

        return info;
    },

    getUserFightForce: function (uid) {
        return this.getUser(uid).fight_force;
    },

    getMaxFightForceHid: function (uid) {
        var user = this.getUser(uid);
        var maxff = 0;
        var maxhid = 0;
        for (var p in user.pos) {
            if (user.pos[p].fight_force > maxff) {
                maxff = user.pos[p].fight_force;
                maxhid = user.pos[p].rid;
            }
        }

        return maxhid;
    },

    getHeroFightForceNoFate: function (uid, pos) {
        var user = this.getUser(uid);
        var posObj = user.pos[pos];
        if (!posObj.rid) {
            return 0;
        }

        var fightForce = posObj.fight_force;
        //var fateFightForce = calcFightForce(posObj, gConfAttPrCoEff[posObj.level]);
        return fightForce - 0;
    },

    update: function (uid, updates) {
        var allUser = updates['allUser'];
        if (allUser) {
            //ERROR('======alluser======UPDATE:');
            //this.updateUser(allUser);
        }

        //ERROR('=====world/user======UPDATE');
        var userInfo = this.users[uid];
        if (!userInfo) {
            this.users[uid] = clone(gInitWorldUser);
            userInfo = this.users[uid];
        }

        //ERROR('======WORLD======UPDATE:');
        //if( updates.pos ){
        //ERROR(updates.pos);
        //}
        var updated = false;
        for (var item in updates) {
            //if(item == 'allUser'){
            //continue;
            //}
            var segs = item.split('.');
            var tmpObj = userInfo;
            var len = segs.length;
            for (var i = 0; i < len - 1; i++) {
                tmpObj = tmpObj[segs[i]];
            }

            if (updates[item] == null) {
                if (tmpObj.hasOwnProperty(segs[len - 1])) {
                    delete tmpObj[segs[len - 1]];
                }
                updated = true;
            } else {
                // 取出之前的equip, 防止equip被刷掉
                var equips = {};
                var runes = {};
                /*
                if (segs[0] == 'pos') {
                    if (len == 1) {
                        for(var p in userInfo.pos) {
                            equips[p] = userInfo.pos[p].equip;
                            runes[p] = userInfo.pos[p].rune;
                        }
                    } else if(len == 2) {
                        equips[segs[1]] = userInfo.pos[segs[1]].equip;
                        runes[segs[1]] = userInfo.pos[segs[1]].rune;
                    }
                }
                */

                if (!tmpObj) {
                    DEBUG(`----------------fucked: ${uid}, ${item}, ${len}`)
                    DEBUG(segs)
                    DEBUG(tmpObj)
                    DEBUG(updates)
                    DEBUG(`----------------fucked:end`)
                }

                tmpObj[segs[len - 1]] = updates[item];
                /*
                for (var p in equips) {
                    userInfo.pos[p].equip = equips[p];
                }

                for (var p in runes) {
                    //userInfo.pos[p].rune = runes[p];
                }
                */
                //

                if (segs[0] == 'status' && (segs[1] == 'level' || segs[1] == 'xp' || !segs[1])) {
                    this.lvRanks.update([+uid, userInfo.status.level, userInfo.status.xp]);
                    updated = true;
                }
                if (segs[0] == 'pos') {
                    updated = true;
                }
            }
        }

        if (updated) {
            var oldFightForce = userInfo.fight_force;
            var fightForce = 0;
            var maxHero = 0;
            var maxHeroFF = 0;
            var maxHeroPromote = [];
            for (var p in userInfo.pos) {
                var pos = userInfo.pos[p];
                fightForce += pos.fight_force;
                if (pos.fight_force > maxHeroFF) {
                    maxHeroFF = pos.fight_force;
                    maxHero = pos.rid;
                    maxHeroPromote = pos.promote;
                }
            }
            userInfo.info.promote = maxHeroPromote;
            userInfo.info.model = maxHero;
            userInfo.fight_force = fightForce;
            if (oldFightForce != fightForce) {
                var oldTop = this.getHonorTopUid();
                this.ranks.update([uid, fightForce]);
                // 更新战队排行榜数据
                var teamId = gClan.getTeamIdByUid(uid);
                if (teamId) {
                    gClan.update_ranks(teamId);
                }

                // 更新军团排行榜
                gNewLegion.updateRanks(uid);

                var newTop = this.getHonorTopUid();
                if (newTop != oldTop) {
                    // 战力第一改变了
                    var uids = [newTop, oldTop];
                    pushToGroupUser(uids, 'self', {
                        'mod': 'user',
                        'act': 'fight_force_top_change',
                        'top': newTop,
                    });
                }
            }
        }
    },

    resetByDay: function () {
        this.time = common.getTime();
        this.lastRank = {};
        var iter = this.ranks.iterator();
        var rank = 0;
        while ((item = iter.next()) != null) {
            this.lastRank[item[0]] = ++rank;
        }

        this.lastLvRank = {};
        iter = this.lvRanks.iterator();
        rank = 0;
        while ((item = iter.next()) != null) {
            this.lastLvRank[item[0]] = ++rank;
        }

        this.updates['time'] = this.time;
        this.updates['last_rank'] = this.lastRank;
        this.updates['last_lv_rank'] = this.lastLvRank;

        var tNowTime = common.getTime();
        this.lastRechargeRanks = {};
        var tRechargeStartTime = gConfActivities["open_rank_recharge"].startTime;
        var tRechargeEndTime = gConfActivities["open_rank_recharge"].endTime + (24 * 60 * 60 * gConfActivities["open_rank_recharge"].delayDays);
        // if (!this.recharge_time || (this.recharge_time > tNowTime) || (this.recharge_time == tRechargeEndTime)) {
        // this.recharge_time = this.recharge_time || tRechargeStartTime;
        // console.log(`----->>>>>> 1  ${!this.recharge_time} ${this.recharge_time < tNowTime} ${tNowTime == tRechargeStartTime}`)
        if ((this.recharge_time && this.recharge_time < tNowTime) || tNowTime == tRechargeStartTime) {
            this.recharge_time = tRechargeEndTime;
            this.recharge_rank = new RankList(              // 充值排行
                function (c1, c2) {
                    if (c1[1] > c2[1]) return -1;
                    if (c1[1] < c2[1]) return 1;
                    if (c1[2] < c2[2]) return -1;
                    if (c1[2] > c2[2]) return 1;
                    return c1[0] < c2[0] ? -1 : 1;
                }
            );
        }
        else {
            this.recharge_time = tRechargeEndTime;
            this.recharge_rank.sort();
            for (var i = 0; i < this.recharge_rank.item_list.length; i++) {
                iter = this.recharge_rank.item_list[i];
                this.lastRechargeRanks[iter[0]] = i;
            }
        }
        this.updates['recharge_time'] = this.recharge_time;
        this.updates['last_recharge_rank'] = this.lastRechargeRanks;

        this.lastExpenseRanks = {};
        var tExpenseStartTime = gConfActivities["open_rank_expense"].startTime;
        var tExpenseEndTime = gConfActivities["open_rank_expense"].endTime + (24 * 60 * 60 * gConfActivities["open_rank_expense"].delayDays);
        // console.log(`----->>>>>> 2  ${!this.expense_time} ${this.expense_time < tNowTime} ${tNowTime == tExpenseStartTime}`)
        // if (!this.expense_time || (this.expense_time > tNowTime) || (this.expense_time == tExpenseEndTime)) {
        if ((this.expense_time && this.expense_time < tNowTime) || tNowTime == tExpenseStartTime) {
            this.expense_time = tExpenseEndTime;
            this.expense_rank = new RankList(              // 消费排行
                // 存储对象 [uid, expense]
                function (c1, c2) {
                    if (c1[1] > c2[1]) return -1;
                    if (c1[1] < c2[1]) return 1;
                    if (c1[2] < c2[2]) return -1;
                    if (c1[2] > c2[2]) return 1;
                    return c1[0] < c2[0] ? -1 : 1;
                }
            );
        }
        else {
            this.expense_time = tExpenseEndTime;
            this.expense_rank.sort();
            for (var i = 0; i < this.expense_rank.item_list.length; i++) {
                iter = this.expense_rank.item_list[i];
                this.lastExpenseRanks[iter[0]] = i;
            }
        }
        this.updates['expense_time'] = this.expense_time;
        this.updates['last_expense_rank'] = this.lastExpenseRanks;

        this.save();
    },

    resetByWeek: function () {
        this.weekTime = common.getTime();
        this.updates['week_time'] = this.weekTime;
        this.save();
    },

    save: function (callback) {
        if (Object.keys(this.updates).length) {
            gDBWorld.update({ _id: 'user' }, { '$set': this.updates }, function (err, result) {
                if (err) {
                    ERROR('SAVE USER ERROR: %j %j', this.updates, err);
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            }.bind(this));

            this.updates = {};
        } else {
            callback && callback(true);
        }
    },

    getFightForceTopUser: function (oldData) {
        var uid = 0;
        if (oldData) {
            uid = oldData[0];
        } else {
            uid = this.getHonorTopUid();
        }

        var user = this.getUser(uid);
        return {
            uid: uid,
            un: user.info.un,
            vip: user.status.vip,
            model: user.info.model,
            promote: user.info.promote,
            weapon_illusion: user.sky_suit.weapon_illusion,
            wing_illusion: user.sky_suit.wing_illusion,
            mount_illusion: user.mount_illusion,
            custom_king: user.custom_king,
            fight_force: oldData ? oldData[1] : user.fight_force,
        };
    },

    getLevelTopUser: function (oldData) {
        var uid = 0;
        if (oldData) {
            uid = oldData[0];
        } else {
            uid = this.getHonorTopUid();
        }

        var user = this.getUser(uid);
        return {
            uid: uid,
            un: user.info.un,
            vip: user.status.vip,
            model: user.info.model,
            promote: user.info.promote,
            weapon_illusion: user.sky_suit.weapon_illusion,
            wing_illusion: user.sky_suit.wing_illusion,
            mount_illusion: user.sky_suit.mount_illusion,
            custom_king: user.custom_king,
            fight_force: user.fight_force,
            level: oldData ? oldData[1] : user.status.level,
            xp: user.status.xp,
        };
    },

    getTopUser: function (uid) {
        var user = this.getUser(uid);
        return {
            uid: uid,
            vip: user.status.vip,
            un: user.info.un,
            model: user.info.model,
            promote: user.info.promote,
            weapon_illusion: user.sky_suit.weapon_illusion,
            wing_illusion: user.sky_suit.wing_illusion,
            mount_illusion: user.sky_suit.mount_illusion,
            custom_king: user.custom_king,
            fight_force: user.fight_force,
        };
    },

    getHonorUser: function (uid) {
        var user = this.getUser(uid);
        return {
            uid: uid,
            un: user.info.un,
            headpic: user.info.model,
            promote: user.info.promote,
            weapon_illusion: user.sky_suit.weapon_illusion,
            wing_illusion: user.sky_suit.wing_illusion,
            mount_illusion: user.sky_suit.mount_illusion,
            custom_king: user.custom_king,
            bullet: this.getHonorUserBullet(uid),
        };
    },

    getHonorUserBullet: function (uid) {
        var originBullet = this.bullet[uid];
        if (!originBullet) {
            return [];
        }

        return common.randArrayWithNum(originBullet, gConfGlobal.honorUserBulletCount);
    },

    getLevelTopUid: function () {
        if (this.lvRanks.iterator() == null)
            return 0;

        if (this.lvRanks.iterator().next() == null)
            return 0;

        return this.lvRanks.iterator().next()[0];
    },

    getLevelTopUser: function () {
        return this.getHonorUser(this.getLevelTopUid());
    },

    getHonorTopUid: function () {
        if (this.ranks.iterator() == null)
            return 0;

        if (this.ranks.iterator().next() == null)
            return 0;

        return this.ranks.iterator().next()[0];
    },

    getHonorTopUser: function () {
        return this.getHonorUser(this.getHonorTopUid());
    },


    getHonorTopBullet: function () {
        return this.getHonorUserBullet(this.getHonorTopUid());
    },

    sendBullet: function (uid, bullet) {
        var userBullet = gUserInfo.bullet[uid];
        if (!userBullet) {
            userBullet = gUserInfo.bullet[uid] = [];
        }

        userBullet.push(bullet);
        if (userBullet.length > gConfGlobal.honorBulletMaxCount) {
            userBullet.splice(gConfGlobal.honorBulletMaxCount - 1);
        }

        gUserInfo.updates['bullet.' + uid] = userBullet;

        // 刷新显示的印象
        var newBullet = gUserInfo.getHonorUserBullet(uid);
        if (newBullet.indexOf(bullet) == -1) {
            newBullet.splice(gConfGlobal.honorUserBulletCount - 2);
            newBullet.push(bullet);
        }
        return newBullet;
    },

    getRankHeadFrame: function (uid) {
        var user = gUserInfo.getUser(uid);
        if (user) {
            var headframe = user.info.headframe;
            if (headframe == 4) {
                if (uid != this.getHonorTopUid()) {
                    headframe = 0;
                }
            }

            return headframe;
        }

        return 0;
    },

    getCountrySalaryList: function (salaryList, timeList) {
        for (var id in this.users) {
            var uid = parseInt(id);
            var user = this.users[uid];
            if (!salaryList[uid]) {
                salaryList[uid] = user.country.day_salary;
            }

            if (!timeList[uid]) {
                timeList[uid] = user.country.update_time;
            }
        }
    },

    getTitle: function (uid) {
        var retTitle = '';
        if (uid == this.getHonorTopUid()) {
            retTitle = 'fight_force';
        } else if (uid == gArena.getHonorTopUid()) {
            retTitle = 'arena';
        } else if (uid == gCountry.getHonorTopUid(1)) {
            retTitle = 'country1';
        } else if (uid == gCountry.getHonorTopUid(2)) {
            retTitle = 'country3';
        } else if (uid == gCountry.getHonorTopUid(3)) {
            retTitle = 'country2';
        } else if (uid == gNewLegion.getHonorTopUid()) {
            retTitle = 'legion';
        } else if (uid == gTower.getHonorTopUid()) {
            retTitle = 'tower';
        } else if (uid == gTavern.getHonorTopUid()) {
            retTitle = 'tavern';
        }

        return retTitle;
    },

    setNewLegionJoinTime: function (uid, joinTime) {
        var user = this.user[uid];
        if (user) {
            if (!user['new_legion']) {
                user['new_legion'] = {}
            }
            user['new_legion']['join_time'] = joinTime
        }
    },

    /** 更新玩家的排行 指定字段 */
    updatePlayerRank: function (type, uid, data) {
        switch (type) {
            case "activity.rank.recharge":
                this.recharge_rank.update(uid, [uid, data.value || 0, data.time || 0]);
                break;
            case "activity.rank.expense":
                this.expense_rank.update(uid, [uid, data.value || 0, data.time || 0]);
                break;
            default:
                this.recharge_rank.update(uid, [uid, data.recharge.value || 0, data.time || 0]);
                this.expense_rank.update(uid, [uid, data.expense.value || 0, data.time || 0]);
                break;
        }

        this.save();
    }
};

function RankList(sort_func) {
    this.sort_func = sort_func;
    this.item_dict = {};
    this.item_list = [];
}
RankList.prototype = {
    update: function (uid, data, is_waite) {
        if (this.item_dict[uid]) {
            this.item_list.splice(this.item_list.indexOf(this.item_dict[uid]), 1, data);
        }
        else {
            this.item_list.push(data);
        }
        this.item_dict[uid] = data;
        if (is_waite) { return; }
        this.sort();
    },

    sort: function () {
        this.item_list = this.item_list.sort(this.sort_func);
    },

    get_rank: function (uid) {
        return this.item_list.indexOf(this.item_dict[uid]);
    },
}

exports.login = function (req, res, resp) {
    var uid = req.uid;
    do {
        resp.data.mail = gMail.getMails(uid);
        resp.data.sys_mail = gSysMail.getMails(uid, req.args.options);
        resp.data.min_mail_id = gSysMail.getMinMailId();

        resp.data.growFund = gActivity.growFund;

        var lid = gNewLegion.userLegion[uid];
        if (lid) {
            var legion = gNewLegion.getLegionInfo(lid)
            resp.data.legionMsg = legion;
            resp.data.lid = lid;
            resp.data.lname = legion.name;
            resp.data.llevel = legion.level;
            resp.data.lduty = gNewLegion.getDuty(uid);
            resp.data.lboneFireOpen = gNewLegion.isBonfireOpen(lid);
            resp.data.legionHasApply = gNewLegion.hasApplyPlayer(lid);  // 是否有人申请
        } else {
            resp.data.lid = 0;
        }

        // 战队
        var team_id = gClan.userTeam[uid];
        var team = gClan.getTeamMsg(uid);
        if (team_id && team) {
            // 检测战队
            gClan.calcTask(team, uid, team_id); // 战队任务
            resp.data.can_use_badge = team.can_use_badge;
            resp.data.team_name = team.name;
            resp.data.team_id = team_id;
            resp.data.team_level = gClan.calcTeamLevel(team_id)[0];
            resp.data.team_leader = team.uid; // 队长id

            var taskMsg = gClan.task_msg[uid] || { award_box: 0, task_json: {} };
            resp.data.awardBox = taskMsg.awardBox || 0;

            // 是否有人申请加入战队
            if (team.uid == uid) {
                // 自己是队长
                if (Object.keys(team.apply_list).length > 0) {
                    resp.data.has_join_apply = 1;
                }
            }
        }

        resp.data.position = gCountry.userPosition[req.uid];

        var levelId = req.args.mine_level;
        var mineId = 0;
        if (levelId && gMine.mine[levelId] && gMine.mine[levelId][req.args.mine_zone]) {
            var mineZone = gMine.mine[levelId][req.args.mine_zone];
            if (mineZone.user[req.uid]) {
                mineId = mineZone.user[req.uid][1];
                gMine.updateOwner(common.getTime(), mineZone, mineId, req.args.mine_level);
                mineId = mineZone.user[req.uid][1];

                resp.data.mine_duration = gMine.getDuration(common.getTime(), mineZone, req.uid);
            }
        }

        resp.data.mine_id = mineId;
        resp.data.grow_fund_count = gActivity.growFund;
        resp.data.arena_top_uid = gArena.getHonorTopUid();  // 竞技榜第一名
        resp.data.fight_force_top_uid = gUserInfo.getHonorTopUid(); // 战力榜第一名
        resp.data.tavern_top_uid = gTavern.getHonorTopUid();    // 人品第一名

        // 当前竞技场段位和排名
        var arenaTypeAndRank = gArena.getUserArenaTypeAndRank(uid);
        resp.data.arena_cur_type = arenaTypeAndRank[0];
        resp.data.arena_cur_rank = arenaTypeAndRank[1];

        //检查是否有好友离线消息
        gFriend.checkNewMessage(uid);
        gFriend.updateFigthBossToCli(uid, resp);

        //太守时间
        resp.data.citytime = gBattle.getCityTime(uid);

        //军团阶段
        resp.data.legionwarstage = gLegionWar.stage;
        var userRuntime = gLegionWar.getUserRuntime(uid);
        resp.data.legionwar_attackNum = userRuntime.attackNum;
        // resp.data.legionwar_addCityBufNum = userRuntime.addCityBufNum;

        function landGrabber_callback(landGrabberResp) {
            if (landGrabberResp.code == 0) {
                resp.data.village_id = landGrabberResp.data.village_id;
                resp.data.village_land = landGrabberResp.data.village_land;

                if (resp.data.village_id == 0) {
                    resp.data.village_id = gLandGrabber.getVillageByTeam(team_id);
                }

                if (resp.data.village_land[0] == 0) {
                    resp.data.village_land = gLandGrabber.getLandByUid(req.uid);
                }
            }

            onReqHandled(res, resp, 1);
        }

        function worldWar_callback(tips, worldWarResp) {
            if (worldWarResp.code == 0) {
                var wwTips = worldWarResp.data.tips;
                for (var tip in wwTips) {
                    tips[tip] = wwTips[tip];
                }
                resp.data.worldwarstage = worldWarResp.data.worldwarstage;
            }

            resp.data.tips = tips;

            resp.data.village_id = gLandGrabber.getVillageByTeam(team_id);
            resp.data.village_land = gLandGrabber.getLandByUid(req.uid);

            var notFind = false;
            if (resp.data.village_id == 0 || resp.data.village_land[0] == 0 && resp.data.village_land[1] == 0) {
                notFind = true;
            }

            if (notFind) {
                // 本服没找到，去跨服找
                req.args.team_id = team_id;
                var landGrabberResp = {};
                requestLandGrabber(req, landGrabberResp, function () {
                    landGrabber_callback(landGrabberResp);
                });
            } else {
                // 本服就找到了
                onReqHandled(res, resp, 1);
            }
        }

        function checkTips_callback() {
            var tips = gTips.getTips(uid);
            if (common.getTime() >= gConfGlobalServer.worldWarOpenTime && isModuleOpenByWorld(gUserInfo.users[uid], 'worldwar')) {
                var worldWarResp = {};
                requestWorldWar(req, worldWarResp, function () {
                    worldWar_callback(tips, worldWarResp);
                });
                return;
            } else {
                resp.data.tips = tips;

                resp.data.village_id = gLandGrabber.getVillageByTeam(team_id);
                resp.data.village_land = gLandGrabber.getLandByUid(req.uid);

                var notFind = false;
                if (resp.data.village_id == 0 || resp.data.village_land[0] == 0 && resp.data.village_land[1] == 0) {
                    notFind = true;
                }

                if (notFind) {
                    // 本服没找到，去跨服找
                    req.args.team_id = team_id;
                    var landGrabberResp = {};
                    requestLandGrabber(req, landGrabberResp, function () {
                        landGrabber_callback(landGrabberResp);
                    });
                } else {
                    // 本服就找到了
                    onReqHandled(res, resp, 1);
                }
            }
        }

        // 检查军团战TIPS
        gLegionWar.checkTips(uid, function () {
            checkTips_callback();
        });
        return;
    } while (false);

    onReqHandled(res, resp, 1);
};

//登录前获取world所需信息
exports.getWorldInfo = function (req, res, resp) {
    var uid = +req.uid;
    var jadeLastCount = 0;

    resp.data.jadeLastCount = jadeLastCount;

    onReqHandled(res, resp, 1);
}
// 空着即可，因为此请求前已经调用了更新
exports.update = function (req, res, resp) {
    onReqHandled(res, resp, 1);
};

exports.set_name = function (req, res, resp) {
    do {
        var name = req.args.name;
        var users = gUserInfo.users;
        var repeat = false;
        for (var uid in users) {
            // 重名
            if (name == users[uid].info.un) {
                repeat = true;
                resp.code = 101; resp.desc = 'repeat name'; break;
            }
        }
        if (!repeat) {
            if (gUserInfo.userName[users[req.uid].info.un])
                delete gUserInfo.userName[users[req.uid].info.un];
            users[req.uid].info.un = name;
            gUserInfo.userName[name] = req.uid;
        }

    } while (false);

    onReqHandled(res, resp, 1);
};

exports.rank_list = function (req, res, resp) {
    var rankList = [];
    var iter = gUserInfo.ranks.iterator();
    var item = null;

    var rankCnt = gConfGlobalNew.rankListLimit_fight;
    while (rankList.length != rankCnt && (item = iter.next()) != null) {
        var uid = item[0];
        var user = gUserInfo.getUser(uid);
        if (user) {
            var legionName = '';
            var legionIcon = [1, 1];
            var lid = gNewLegion.getUserLegionId(uid);
            if (lid > 0) {
                var legion = gNewLegion.get(lid);
                if (legion) {
                    legionName = legion.name;
                    legionIcon = legion.icon;
                }
            }
            var rank = {
                'uid': uid,
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe': gUserInfo.getRankHeadFrame(uid),
                'level': user.status.level,
                'fight_force': item[1] || 0,
                'main_role': user.pos[1].rid,
                'vip': user.status.vip,
                'legion_name': legionName,
                'legion_icon': legionIcon,
                'custom_king': user.custom_king,
            };

            if (rankList.length == 0) {
                var maxFightForce = 0;
                var maxHidPromote = 0;
                for (var p in user.pos) {
                    if (user.pos[p].fight_force > maxFightForce) {
                        maxFightForce = user.pos[p].fight_force;
                        maxHidPromote = user.pos[p].promote;
                    }
                }

                rank.max_force_hid = user.info.model;
                rank.promote = maxHidPromote;
                rank.weapon_illusion = 0;
                rank.wing_illusion = 0;
                rank.mount_illusion = 0;

                //FQA fish
                if (user.pos[1].rid == user.info.model) {
                    rank.weapon_illusion = user.sky_suit.weapon_illusion;
                    rank.wing_illusion = user.sky_suit.wing_illusion;
                    rank.mount_illusion = user.sky_suit.mount_illusion;
                }
            }

            rankList.push(rank);
        }
    }

    var ownUser = gUserInfo.getUser(req.uid);
    var ownRank = gUserInfo.ranks.idMap[req.uid];

    var ownLegionName = '';
    var ownLegionIcon = 0;
    var ownLid = gNewLegion.getUserLegionId(req.uid);
    if (ownLid > 0) {
        var ownLegion = gNewLegion.get(ownLid);
        if (ownLegion) {
            ownLegionName = ownLegion.name;
            ownLegionIcon = ownLegion.icon;
        }
    }

    resp.data.self = {
        'uid': req.uid,
        'un': ownUser.info.un,
        'headpic': ownUser.info.headpic,
        'headframe': gUserInfo.getRankHeadFrame(req.uid),
        'level': ownUser.status.level,
        'fight_force': ownRank[1] || 0,
        'main_role': ownUser.pos[1].rid,
        'vip': ownUser.status.vip,
        'legion_name': ownLegionName,
        'legion_icon': ownLegionIcon,
        'custom_king': ownUser.custom_king,
        'rank': gUserInfo.ranks.rankById(req.uid),
        'last_rank': gUserInfo.lastRank[req.uid] || 0
    }
    //var lastRank = gUserInfo.lastRank[req.uid];
    //resp.data.rank = gUserInfo.ranks.rankById(req.uid);
    //resp.data.last_rank = lastRank ? lastRank : 0;
    resp.data.rank_list = rankList;

    onReqHandled(res, resp, 1);
};

exports.level_rank_list = function (req, res, resp) {
    var rankList = [];
    var iter = gUserInfo.lvRanks.iterator();
    var item = null;

    var rankCnt = gConfGlobalNew.rankListLimit_level;
    while (rankList.length != rankCnt && (item = iter.next()) != null) {
        var uid = item[0];
        var user = gUserInfo.getUser(uid);
        var rank = {
            'uid': uid,
            'un': user.info.un,
            'headpic': user.info.headpic,
            'headframe': gUserInfo.getRankHeadFrame(uid),
            'level': user.status.level,
            'main_role': user.pos[1].rid,
            'vip': user.status.vip,
            'xp': user.status.xp,
            'custom_king': user.custom_king,
        };

        if (rankList.length == 0) {
            // 第一名需要显示军团名
            rank.legionName = '';
            var lid = gNewLegion.getUserLegionId(uid);
            if (lid > 0) {
                var legion = gNewLegion.get(lid);
                if (legion) {
                    rank.legionName = legion.name;
                }
            }
        }

        if (rankList.length == 0) {
            var maxFightForce = 0;
            var maxFightForceHid = 0;
            var maxHidPromote = 0;
            for (var p in user.pos) {
                if (user.pos[p].fight_force > maxFightForce) {
                    maxFightForce = user.pos[p].fight_force;
                    maxFightForceHid = user.pos[p].rid;
                    maxHidPromote = user.pos[p].promote;
                }
            }

            rank.max_force_hid = maxFightForceHid;
            rank.promote = maxHidPromote;
            rank.weapon_illusion = 0;
            rank.wing_illusion = 0;
            rank.mount_illusion = 0;
            rank.custom_king = {};

            if (user.pos[1].rid == maxFightForceHid) {
                rank.weapon_illusion = user.sky_suit.weapon_illusion;
                rank.wing_illusion = user.sky_suit.wing_illusion;
                rank.mount_illusion = user.sky_suit.mount_illusion;
                rank.custom_king = user.custom_king;
            }

            // 第一名需要显示军团名
            rank.legionName = '';
            var lid = gNewLegion.getUserLegionId(uid);
            if (lid > 0) {
                var legion = gNewLegion.get(lid);
                if (legion) {
                    rank.legionName = legion.name;
                }
            }
        }

        rankList.push(rank);
    }

    var ownUser = gUserInfo.getUser(req.uid);
    var ownRank = gUserInfo.lvRanks.idMap[req.uid];

    resp.data.self = {
        'uid': req.uid,
        'un': ownUser.info.un,
        'headpic': ownUser.info.headpic,
        'headframe': gUserInfo.getRankHeadFrame(req.uid),
        'level': ownUser.status.level,
        'main_role': ownUser.pos[1].rid,
        'vip': ownUser.status.vip,
        'xp': ownUser.status.xp,
        'custom_king': ownUser.custom_king,
        'rank': gUserInfo.lvRanks.rankById(req.uid),
        'last_rank': gUserInfo.lastRank[req.uid] || 0
    }

    // var lastRank = gUserInfo.lastLvRank[req.uid];
    // resp.data.rank = gUserInfo.lvRanks.rankById(req.uid);
    // resp.data.last_rank = lastRank ? lastRank : 0;
    resp.data.rank_list = rankList;

    onReqHandled(res, resp, 1);
};

exports.test_sys_mail = function (req, res, resp) {
    //gDBMail.save({_id: 'test', ranks: {}});
    var update = {};
    for (var uid = 1000001; uid < 1000002; uid++) {
        var key = 'ranks.' + uid;
        update[key] = 10000;
    }
    gDBMail.update({ _id: 'test' }, { $set: update });
    onReqHandled(res, resp, 1);
};

exports.get_enemy = function (req, res, resp) {
    var enemyId = +req.args.enemy;
    var info = null;
    if (isDroid(enemyId)) {
        if (req.args.state == 'arena') {
            var userInfo = gArena.getRobot(enemyId);
            if (userInfo) {
                info = {
                    un: userInfo.un,
                    headpic: userInfo.headpic,
                    headframe: userInfo.headframe,
                    level: userInfo.level,
                    weapon_illusion: 0,
                    wing_illusion: 0,
                    mount_illusion: 0,
                    custom_king: {},
                    custom_treasure: [],
                    pos: {},
                    server_id: config.ServerId,
                    team_name: '',
                    legion_name: '',
                    cardGetRecord: {},
                };
                for (var p in userInfo.pos) {
                    info.pos[p] = {
                        rid: userInfo.pos[p].rid,
                        fight_force: userInfo.pos[p].fight_force,
                        tier: userInfo.pos[p].tier,
                        level: userInfo.pos[p].level,
                        awake: userInfo.pos[p].awake,
                    };
                }
            }
        } else if (req.args.state == 'country') {
            var userInfo = gCountry.robots[enemyId];
            if (userInfo) {
                info = {
                    un: userInfo.un,
                    level: userInfo.level,
                    headpic: userInfo.headpic,
                    headframe: userInfo.headframe,
                    weapon_illusion: 0,
                    wing_illusion: 0,
                    mount_illusion: 0,
                    custom_king: {},
                    custom_treasure: [],
                    pos: {},
                    server_id: config.ServerId,
                    team_name: '',
                    legion_name: '',
                    cardGetRecord: {},
                };
                for (var p in userInfo.pos) {
                    info.pos[p] = {
                        rid: userInfo.pos[p].rid,
                        fight_force: userInfo.pos[p].fight_force,
                        tier: userInfo.pos[p].tier,
                        level: userInfo.pos[p].level,
                        awake: userInfo.pos[p].awake,
                    };
                }
            }
        }

        if (info) {
            info.notrealuser = true;
        }
    } else {
        var userInfo = gUserInfo.getUser(enemyId);
        info = {
            un: userInfo.info.un,
            dragon: userInfo.info.dragon,
            headpic: userInfo.info.headpic,
            headframe: userInfo.info.headframe,
            level: userInfo.status.level,
            vip: userInfo.status.vip,
            weapon_illusion: userInfo.sky_suit.weapon_illusion,
            wing_illusion: userInfo.sky_suit.wing_illusion,
            mount_illusion: userInfo.sky_suit.mount_illusion,
            custom_king: userInfo.custom_king,
            custom_treasure: userInfo.custom_treasure,
            headframe: gUserInfo.getRankHeadFrame(enemyId),
            pos: {},
            cardGetRecord: userInfo.cardGetRecord,
        };
        for (var p in userInfo.pos) {
            info.pos[p] = {
                rid: userInfo.pos[p].rid,
                fight_force: userInfo.pos[p].fight_force,
                tier: userInfo.pos[p].tier,
                level: userInfo.pos[p].level,
                awake: userInfo.pos[p].awake,
            };
            /*
            info.pos[p] = {

                rid: userInfo.pos[p].rid,
                fight_force: userInfo.pos[p].fight_force,
                talent: userInfo.pos[p].talent,
                destiny : userInfo.pos[p].destiny,
                level: userInfo.pos[p].level,
                equip: userInfo.pos[p].equip,
                rune: userInfo.pos[p].rune,
                part: userInfo.pos[p].part,
                promote: userInfo.pos[p].promote,
                soldier : {
                    level : userInfo.pos[p].soldier.level,
                    star : userInfo.pos[p].soldier.star,
                },
            };*/
        }
        if (info.pos[1]) {
            info.pos[1].weapon_illusion = userInfo.sky_suit.weapon_illusion;
            info.pos[1].wing_illusion = userInfo.sky_suit.wing_illusion;
            info.pos[1].mount_illusion = userInfo.sky_suit.mount_illusion;
        } else {
            ERROR('-----NO POS 1:enemyId:' + enemyId);
        }

        var lid = gNewLegion.userLegion[enemyId];
        info.legion_name = lid ? gNewLegion.legions[lid].name : "";
        info.country = userInfo.info.country;
        info.legion_icon = lid ? gNewLegion.legions[lid].icon : "";
        info.userPos = gCountry.userPosition[enemyId];
        info.server_id = config.ServerId;

        var teamInfo = gClan.getTeamMsg(enemyId);
        if (teamInfo) {
            info.team_name = teamInfo.name;
        } else {
            info.team_name = '';
        }

        var arenaRank = 0;
        if (enemyId in gArena.users) {
            arenaRank = gArena.users[enemyId];
        }
        info.arenaRank = arenaRank;
        info.towerRank = gTower.ranks.rankById(enemyId);
    }

    resp.data.info = info;
    resp.data.isFriend = gFriend.checkFriend(req.uid, enemyId);
    onReqHandled(res, resp, 1);
};

exports.get_honor_hall = function (req, res, resp) {
    // 战斗力，擂台，重楼，魏蜀吴，PVP，军团
    var retList = {};
    retList['fight_force'] = gUserInfo.getHonorTopUser();
    retList['level'] = gUserInfo.getLevelTopUser();
    var gArenaGetHonorTopUser = gArena.getHonorTopUser();
    if (gArenaGetHonorTopUser != null && isDroid(gArenaGetHonorTopUser.uid)) {
        gArenaGetHonorTopUser = null;
    }
    retList['arena'] = gArenaGetHonorTopUser;//有可能返回机器人
    retList['tower'] = gTower.getHonorTopUser();

    var gCountryGetHonorTopUser = gCountry.getHonorTopUser(1);
    if (gCountryGetHonorTopUser != null && isDroid(gCountryGetHonorTopUser.uid)) {
        gCountryGetHonorTopUser = null;
    }
    retList['country'] = gCountryGetHonorTopUser;//有可能返回机器人
    retList['legion'] = gNewLegion.getHonorTopUser();
    //retList['tavern'] = gTavern.getHonorTopUser();

    resp.data.honor_list = retList;

    var randNames = []
    var uids = [];
    for (var i = 1; i <= 10; i++) {
        var uid = common.randRange(1, 3000);
        if (uids.indexOf(uid) < 0) {
            uids.push(uid);
            if (isDroid(uid)) {
                var robot = gArena.getRobot(uid);
                randNames.push(robot ? robot.un : "");
            } else {
                randNames.push(gUserInfo.getUser([uid]).info.un);
            }
        }
    }
    resp.data.names = randNames;

    onReqHandled(res, resp, 1);
};

exports.get_honor_user = function (req, res, resp) {
    do {
        var type = req.args.type;
        var target = req.args.target;
        var tarUser = null;
        switch (type) {
            case 'fight_force': tarUser = gUserInfo.getHonorTopUser(); break;
            case 'arena': tarUser = gArena.getHonorTopUser(); break;
            case 'tower': tarUser = gTower.getHonorTopUser(); break;
            case 'country1': tarUser = gCountry.getHonorTopUser(1); break;
            case 'country2': tarUser = gCountry.getHonorTopUser(2); break;
            case 'country3': tarUser = gCountry.getHonorTopUser(3); break;
            case 'legion': tarUser = gNewLegion.getHonorTopUser(); break;
            case 'tavern': tarUser = gTavern.getHonorTopUser(); break;
            default: break;
        }
        if (!tarUser) {
            resp.code = 1; resp.desc = 'invalid type'; break;
        }

        if (target != tarUser.uid) {
            resp.data.replace = tarUser;
        }

        var tarUid = tarUser.uid;
        var retUser = null;
        if (isDroid(tarUid)) {
            var user = null;
            if (type == 'arena') {
                user = gArena.getRobot(tarUid);
            } else if (type.indexOf('country') != -1) {
                user = gCountry.robots[tarUid];
            }

            retUser = {
                un: tarUser.un,
                bullet: gUserInfo.getHonorUserBullet(tarUid),
                pos: {},
            };

            for (var p in user.pos) {
                retUser.pos[p] = {
                    rid: user.pos[p].rid,
                    level: 1,
                    fight_force: user.pos[p].fight_force,
                    equip: {},
                    promote: [],
                };
            }
        } else {
            var user = gUserInfo.getUser(tarUid);
            retUser = {
                un: tarUser.un,
                weapon_illusion: tarUser.weapon_illusion,
                wing_illusion: tarUser.wing_illusion,
                mount_illusion: tarUser.mount_illusion,
                cunsom_king: tarUser.custom_king,
                bullet: gUserInfo.getHonorUserBullet(tarUid),
                pos: {},
            };

            for (var p in user.pos) {
                retUser.pos[p] = {
                    rid: user.pos[p].rid,
                    level: user.pos[p].level,
                    fight_force: user.pos[p].fight_force,
                    equip: user.pos[p].equip,
                    promote: user.pos[p].promote,
                };
            }
        }

        resp.data.info = retUser;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.send_bullet = function (req, res, resp) {
    var target = req.args.target;
    var type = req.args.type;

    // 非殿堂上的不能发布印象
    var valid = false;
    if (type == 'fight_force') {
        valid = target == gUserInfo.getHonorTopUid();
    } else if (type == 'arena') {
        valid = target == gArena.getHonorTopUid();
    } else if (type == 'tower') {
        valid = target == gTower.getHonorTopUid();
    } else if (type == 'country1' || type == 'country2' || type == 'country3') {
        valid = target == Object.keys(gCountry.country[type[type.length - 1]].position[1])[0];
    } else if (type == 'legion') {
        var topLegion = gNewLegion.get(Object.keys(gNewLegion.legions).sort(function (l1, l2) {
            var legion1 = gNewLegion.legions[l1];
            var legion2 = gNewLegion.legions[l2];

            if (legion1.xp > legion2.xp) {
                return -1;
            }

            if (legion1.xp < legion2.xp) {
                return 1;
            }

            return l2 - l1;
        })[0]);
        valid = target == topLegion.master;
    } else if (type == 'pvp') {
        valid = 'true';
    }

    if (!valid) {
        resp.code = 102; resp.desc = 'not in hall';
    } else {
        resp.data.bullet = gUserInfo.sendBullet(target, req.args.bullet);
    }

    onReqHandled(res, resp, 1);
};

exports.get_main_city = function (req, res, resp) {
    // 检查军团战TIPS
    gLegionWar.checkTips(req.uid, function () {
        var tips = gTips.getTips(req.uid);
        resp.data.tips = tips;
        onReqHandled(res, resp, 1);
    });
};

exports.get_honor_bullet = function (req, res, resp) {
    resp.data.bullet = gUserInfo.getHonorUserBullet(req.args.target);
    onReqHandled(res, resp, 1);
};

exports.get_tips = function (req, res, resp) {
    resp.data.tips = gTips.getTips(req.uid);
    onReqHandled(res, resp, 1);
};

exports.update_user_rank_recharge = function (req, res, resp) {
    gUserInfo.updatePlayerRank("activity.rank.recharge", req.uid, req.args.data)
}

exports.update_user_rank_expense = function (req, res, resp) {
    gUserInfo.updatePlayerRank("activity.rank.expense", req.uid, req.args.data)
}

exports.update_vip = function (req, res, resp) {
    var oldLevel = req.args.old_vip;
    var newLevel = req.args.new_vip;
    gUserInfo.vipCount[oldLevel]--;
    gUserInfo.vipCount[newLevel]++;

    // vip变化需要刷新小队徽章
    // ps:月卡周卡充值也会影响vip，一起处理
    gClan.checkAndRefreshBadges(req.uid, 'vip');

    // VIP达到名人要求
    if (newLevel >= gConfGlobal.tavernLuckVIP) {
        var maxVip = Object.keys(gConfTavernLuck).max();
        if (newLevel > maxVip) {
            newLevel = maxVip;
        }

        var oldOriginLuck = 0;
        var cards = 0;
        var oldConf = gConfTavernLuck[oldLevel];
        if (oldConf) {
            cards = oldConf.num;
        }
        if (cards) {
            oldOriginLuck = cards * gConfGlobal.tavernLuckScore;
        }

        cards = gConfTavernLuck[newLevel].num;
        var newOriginLuck = cards * gConfGlobal.tavernLuckScore;

        var diffLuck = newOriginLuck - oldOriginLuck;

        var luckInfo = gTavern.getLuckInfo(req.uid);
        if (!luckInfo) {
            // 直接插入新的luck
            gTavern.luckList.push({
                uid: req.uid,
                card: cards,
                time: 1,
            });
        } else {
            // 增加对应的luck
            luckInfo.card = (luckInfo.card * gConfGlobal.tavernLuckScore / luckInfo.time + diffLuck) * luckInfo.time / gConfGlobal.tavernLuckScore;
        }

        gTavern.updateLuckList();
    }

    onReqHandled(res, resp, 1);
};

exports.debug_world_user = function (req, res, resp) {
    resp.data.user = gUserInfo.getUser(req.uid);
    onReqHandled(res, resp, 1);
};

exports.reset_world = function (req, res, resp) {
    gMine.mine = {};
    gMine.dirty = {};
    gMine.markDirty('mine');
    gMine.save();

    gFriend.resetByDay();
    onReqHandled(res, resp, 1);
};

exports.get_title = function (req, res, resp) {
    resp.data.title = gUserInfo.getTitle(req.uid);
    onReqHandled(res, resp, 1);
};

exports.get_fight_force_top = function (req, res, resp) {
    resp.data.top = gUserInfo.getHonorTopUid();
    onReqHandled(res, resp, 1);
};

exports.get_lucky_top = function (req, res, resp) {
    resp.data.top = gTavern.getHonorTopUid();
    onReqHandled(res, resp, 1);
};

// 更新皇城俸禄
exports.update_salary = function (req, res, resp) {
    var uid = req.uid;
    var day_salary = req.args.day_salary;
    var update_time = req.args.update_time;

    DEBUG('update_salary uid = ' + uid + ', day_salary = ' + day_salary + ', update_time = ' + update_time);
    gCountry.updateSalary(uid, day_salary, update_time);
    onReqHandled(res, resp, 1);
};

// 获取玩家申请的军团列表和小队列表
exports.get_apply_list = function (req, res, resp) {
    resp.data.legion_apply_list = gNewLegion.getUserApplyList(+req.uid);
    resp.data.team_apply_list = gClan.getUserApplyList(+req.uid);
    onReqHandled(res, resp, 1);
};


//
exports.updateEquitInfo = function (req, res, resp) {
    var user = gUserInfo.getUser(req.uid);
    var pos = req.args.data;
    for (var p in pos) {
        var equips = pos[p].equip;
        for (type in equips) {
            var equip = equips[type];
            user.pos[p].equip[type] = {
                id: equip.id,
                grade: equip.grade,
                intensify: equip.intensify,
                refine_exp: equip.refine_exp,
            };
        }
    }
    onReqHandled(res, resp, 1);
};

exports.UserInfo = UserInfo;


