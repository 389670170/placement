function UserInfo(){
    this.users = {
        /*
         uid : {
            info : {
                un : '',
                headpic : 0,
                headframe : 0,
            },
            status : {
                level : 1,
                vip : 0,
            },
            pos : {},
            skills : {},
            def_info : {},
            sky_suit:  {
                weapon_illusion: 0,
                wing_illusion: 0,
                mount_illusion: 0,
            },
            custom_king : {},
            custom_village : [],
            fight_force : 0,
            server_id : 0,

            // 小队领地相关数据
            team_zone : {
                team_id : 0,    // 玩家队伍id
                leave : 0,      // 是否离开

                pos : {
                    zone_id : 0,    // 玩家所在领地id
                    cell_id : 0,    // 玩家所在格子id
                }
            },
         }
         */
    };

    this.updates = {};
}

UserInfo.prototype = {
    init : function(callback) {
        var cursor = gDBUser.find();
        cursor.each(function(err, item){
            if (err) {
                callback && callback(false);
            }

            if (item) {
                if (!item.sky_suit) {
                    item.sky_suit = {
                        weapon_illusion: 0,
                        wing_illusion: 0,
                        mount_illusion: 0,
                    };
                }
                this.users[item._id] = item;
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    getUser : function(uid) {
        return this.users[uid];
    },

    getUserFightInfo : function(uid, notUseDefPos, useZoneTeam) {
        var info = {};
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        info.uid = uid;
        info.un = user.info.un;
        info.country = user.info.country;
        info.server = user.info.sid;
        info.level = user.status.level;

        info.pos = {};
        info.weapon_illusion = user.sky_suit.weapon_illusion;
        info.wing_illusion = user.sky_suit.wing_illusion;
        info.mount_illusion = user.sky_suit.mount_illusion;
        info.custom_king = user.custom_king;

        // 龙的等级
        info.dragon = {};
        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i] = user.dragon[i].level;
            }
        }
        
        var fightForce = 0;
        for (var p in user.pos) {
            if (user.pos[p].hid) {
                info.pos[p] = {};
                info.pos[p].hid = user.pos[p].hid;
                info.pos[p].slot = user.pos[p].slot;
                info.pos[p].destiny = user.pos[p].destiny.level;
                info.pos[p].talent = user.pos[p].talent;
                info.pos[p].quality = user.pos[p].quality;
                info.pos[p].attr = clone(user.pos[p].attr);
                info.pos[p].fight_force = user.pos[p].fight_force;
                info.pos[p].soldier_level = user.pos[p].soldier.level;
                info.pos[p].soldier_star = user.pos[p].soldier.star;
                info.pos[p].promote = user.pos[p].promote;

                fightForce += user.pos[p].fight_force;
            }
        }

        var defInfo = user.def_info;
        if (!notUseDefPos && defInfo.set) {
            info.skills = clone(user.skills);
            for (var slot in defInfo.skills) {
                if (!info.skills[slot]) {
                    info.skills[slot] = {};
                }
                info.skills[slot].id = defInfo.skills[slot];
            }
            for (var pos in defInfo.team) {
                if (!info.pos[pos]) {
                    info.pos[pos] = {};
                }
                info.pos[pos].slot = defInfo.team[pos];
            }
        } else if (notUseDefPos && useZoneTeam) {
            if (!user.team_zone.def_info) {
                user.team_zone.def_info = clone(user.def_info);
            }

            info.skills = clone(user.skills);
            for (var slot in info.skills) {
                info.skills[slot].id = user.team_zone.def_info.skills[slot];
                if (!info.skills[slot].id) {
                    info.skills[slot].id = 0;
                }
            }

            var slots = SlotArray.slice();
            var poses = SlotArray.slice();
            for (var pos in user.team_zone.def_info.team) {
                var slot = user.team_zone.def_info.team[pos];
                info.pos[pos].slot = slot;

                slots.remove(+slot);
                poses.remove(+pos);
            }

            for (var i = 0, len = poses.length - 2; i < len; i++) {
                var pos = poses[i];
                if (!info.pos[pos] || !info.pos[pos].slot) {
                    continue;
                }

                var slot = slots[0];
                info.pos[pos].slot = slot;
                slots.remove(slot);
            }
        }
        else {
            info.skills = user.skills;
        }

        user.fight_force = fightForce;
        return info;
    },

    setTeam : function (uid, team, skills) {
        var userInfo = this.getUser(uid);
        userInfo.team_zone.def_info.team = team;
        userInfo.team_zone.def_info.skills = skills;
        this.markDirty(uid);
    },

    getUserFightForce : function(uid) {
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        if (user.fight_force) {
            return user.fight_force;
        }
        var fightForce = 0;
        for (var p in user.pos) {
            fightForce += user.pos[p].fight_force;
        }
        user.fight_force = fightForce;
        return fightForce;
    },

    initUserData : function (uid, teamId) {
        if (!this.users[uid])
            return;

        this.users[uid].team_zone = {};

        // 初始化玩家进入领地的初始位置
        this.users[uid].team_zone.pos = {};
        this.users[uid].team_zone.pos.zone_id = 0;
        this.users[uid].team_zone.pos.cell_id = 48;

        this.users[uid].team_zone.team_id = teamId;
        this.users[uid].team_zone.leave = 0;

        if (this.users[uid].def_info)
            this.users[uid].team_zone.def_info = this.users[uid].def_info;
        else
            this.users[uid].team_zone.def_info = {};
    },

    update : function(uid, updates, teamId, serverId) {
        var userInfo = this.users[uid];

        var updated = false;
        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;

            if (!this.users[uid].team_zone) {
                this.initUserData(uid, teamId);
            }
            this.markDirty(uid);

            userInfo = this.users[uid];
        } else {
            for (var item in updates) {
                var segs = item.split('.');
                var tmpObj = userInfo;
                var len = segs.length;
                for (var i = 0; i < len-1; i++) {
                    tmpObj = tmpObj[segs[i]];
                }
                if (updates[item] == null) {
                    if (tmpObj.hasOwnProperty(segs[len-1])) {
                        delete tmpObj[segs[len-1]];
                    }
                } else {
                    tmpObj[segs[len-1]] = updates[item];
                }
                updated = true;
            }
        }

        if (updated) {
            userInfo.fight_force = 0;
        }

        if (!this.users[uid].team_zone) {
            this.initUserData(uid, teamId);
        }

        if (!this.users[uid].team_zone.def_info) {
            if (this.users[uid].def_info)
                this.users[uid].team_zone.def_info = this.users[uid].def_info;
            else
                this.users[uid].team_zone.def_info = {};
        }

        // 计算战斗力最大的武将id
        var maxHeroFF = 0;
        var maxHero = 0;
        for (var p in userInfo.pos) {
            if (userInfo.pos[p].fight_force > maxHeroFF) {
                maxHeroFF = userInfo.pos[p].fight_force;
                maxHero = userInfo.pos[p].hid;
            }
        }

        if (!userInfo.info) {
            userInfo.info = {};
        }

        userInfo.info.model = maxHero;
        userInfo.info.sid = serverId;
        userInfo.team_zone.team_id = teamId;

        this.markDirty(uid);
    },

    save : function(callback) {
        var loader = new common.Loader(callback);
        loader.addLoad('empty');

        for (var uid in this.updates) {
            loader.addLoad(1);
            gDBUser.save(this.users[uid], function(err, result) {
                if (err) {
                    ERROR('save error uid ' + this.users[uid]._id);
                    ERROR(err);
                }
                loader.onLoad(1);
            }.bind(this));
        }
        this.updates = {};
        loader.onLoad('empty');
    },

    markDirty : function(uid) {
        this.updates[uid] = 1;
    },

    clear : function () {
        gDBUser.remove({}, function () {

        });
        this.updates = {};
    },

    // 重置跨服村庄争夺数据
    resetTeamZoneUser : function (week) {
        if (week) {
            this.onResetByWeek();
        } else {
            for (var uid in this.users) {
                var userInfo = this.users[uid];
                if (!userInfo.team_zone)
                    continue;

                this.markDirty(uid);
            }
        }
    },

    // 清理数据
    clear : function () {
        gDBUser.remove({}, function () {

        });

        this.updates = {};
    },

    resetByDay : function () {

    },

    // 设置位置
    setPos : function (uid, zoneId, cellId) {
        if (!this.users[uid])
            return;

        this.users[uid].team_zone.pos.zone_id = parseInt(zoneId);
        this.users[uid].team_zone.pos.cell_id = parseInt(cellId);
        this.markDirty(uid);

        //gTeamZone.onPlayerVisitCell(this.users[uid].team_zone.team_id, teamId, cellId);
    },

    // 移动
    moveTo : function (uid, cellId) {
        if (!this.users[uid])
            return;

        this.setPos(uid, this.users[uid].team_zone.pos.zone_id, cellId);

        // 广播给本领地所有在线玩家
        gTeamZone.broadcastPlayerPosition(uid, this.users[uid].team_zone.pos.zone_id, cellId, false);
    },
}

exports.login = function (req, res, resp) {
    onReqHandled(res, resp, 1);
};

exports.UserInfo = UserInfo;
