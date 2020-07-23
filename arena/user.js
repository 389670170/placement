function UserInfo(){
    this.users = {
        /*
        uid : {
            info : {
                un : '',
                headpic : 0,
            },
            status : {
               level : 1,
               vip : 0,
            },
            pos : {}, --- team
            skills : {},
            def_info : {},
            sky_suit:  {
               weapon_illusion: 0,
               wing_illusion: 0,
            },
            fight_force : 0,

            -- 竞技场相关数据
            arena : {
                // 防守阵型
                def_info : {
                    team : {},
                    skills : {},
                },
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
                if (item.arena) {
                    item.arena.leave = true;
                }
                if (!item.sky_suit) {
                    item.sky_suit = {
                        weapon_illusion: 0,
                        wing_illusion: 0,
                    };
                }
                if (!item.custom_king) {
                    item.custom_king = {
                        index: 0,
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

    getUserFightInfo : function(uid, notUseDefPos, useArenaTeam) {
        var info = {};
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        info.uid        = uid;
        info.name       = user.info.un;
        info.headpic    = user.info.headpic;
        info.headframe  = user.info.headframe;
        info.country    = user.info.country;
        info.server     = user.info.sid;
        info.level      = user.status.level;

        info.pos        = user.pos;

        info.weapon_illusion    = user.sky_suit.weapon_illusion;
        info.wing_illusion      = user.sky_suit.wing_illusion;
        info.mount_illusion     = user.sky_suit.mount_illusion;
        info.custom_king        = user.custom_king;
        info.fight_force        = user.fight_force;
        info.skills             = clone(user.skills);
        
        // 龙的等级
        info.dragon = {};

        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i] = user.dragon[i].level;
            }
        }

        
        var defInfo             = user.def_info;

        if (!notUseDefPos && defInfo && defInfo.set) {
        
            if (defInfo.skills && defInfo.team)
            {
                for (var slot in defInfo.skills) 
                {
                    info.skills[slot].id = defInfo.skills[slot];
                }

                var checkSucc       = true;

                for (var hid in defInfo.team) 
                {
                    if(!info.pos[hid])
                    {
                        checkSucc   = false;
                    }
                }

                if (checkSucc)
                {
                    for (var hid in defInfo.team)
                    {    
                        info.pos[hid].slot = defInfo.team[hid];
                    }
                }
            }

        } else if (notUseDefPos && useArenaTeam) {
            if (!user.arena.def_info) {
                user.arena.def_info = clone(user.def_info);
            }

            var aDefInfo            = user.arena.def_info;

            if (aDefInfo.skills && aDefInfo.team)
            {
                for (var slot in aDefInfo.skills) 
                {
                    info.skills[slot].id = aDefInfo.skills[slot];
                }

                var checkSucc       = true;

                for (var hid in aDefInfo.team) 
                {
                    if(!info.pos[hid])
                    {
                        checkSucc   = false;
                    }
                }

                if (checkSucc)
                {
                    for (var hid in aDefInfo.team)
                    {    
                        info.pos[hid].slot = aDefInfo.team[hid];
                    }
                }
            }
        }
        
        return info;
    },

    setTeam : function (uid, team, skills) {
        var userInfo = this.getUser(uid);
        userInfo.arena.def_info.team = team;
        userInfo.arena.def_info.skills = skills;
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

    initUserArenaData : function (uid) {
        if (!this.users[uid])
            return;

        this.users[uid].arena = {};

        if (this.users[uid].def_info)
            this.users[uid].arena.def_info = this.users[uid].def_info;
        else
            this.users[uid].arena.def_info = {};
    },

    update : function(uid, updates, serverId, legionName) {
        var userInfo = this.users[uid];

        var updated = false;
        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;

            if (!this.users[uid].arena) {
                this.initUserArenaData(uid);
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

        if (!this.users[uid].arena) {
            this.initUserArenaData(uid);
        }

        if (!this.users[uid].arena.def_info) {
            if (this.users[uid].def_info)
                this.users[uid].arena.def_info = this.users[uid].def_info;
            else
                this.users[uid].arena.def_info = {};
        }

        var userPos = updates.pos;
        var pos   = {};
        // 计算战斗力最大的武将id
        var maxHeroFF = 0;
        var maxHero   = 0;
        var maxPos    = 0;

        for (var hindex in userPos) {
            var theHobj = userPos[hindex];
            if( !theHobj ){
                ERROR('===================uid:'+ uid +'heroindex:'+hindex);
                continue;
            }

            pos[hindex] = {
                'rid': theHobj.rid,
                'level': theHobj.level,
                'awake': theHobj.awake,
                'tier':  theHobj.tier,
                'slot':  +theHobj.slot,
                'attr':  theHobj.attr,
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
        for(var p in this.users[uid].pos) {
            fightForce += this.users[uid].pos[p].fight_force;
        }
        this.users[uid].fight_force = fightForce;


        this.users[uid].info.model = maxHero;
        this.users[uid].info.sid   = serverId;
        this.users[uid].info.legionName = legionName;

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

    onResetByWeek : function () {
        // 踢掉所有玩家
        var playerIds = [];
        for (var uid in this.users) {
            if (this.users[uid] && this.users[uid].arena) {
                if (!this.users[uid].arena.leave) {
                    playerIds.push(uid);
                }
            }

            delete this.users[uid];
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'arena',
                act : 'reset_week',
                uid : uid,
                args : {
                    players : playerIds,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            gArena.broadcastToAllWorld(WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('arena onResetByWeek to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('arena onResetByWeek to world failed!' + WorldResp.desc);
                }
            });
        }

        // 清除所有玩家
        this.clear();
    },

    // 重置竞技场数据
    resetArena : function (week) {
        if (week) {
            this.onResetByWeek();
        } else {
            for (var uid in this.users) {
                var userInfo = this.users[uid];
                if (!userInfo.arena)
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

    getRankHeadFrame : function (uid) {
        var user = gUserInfo.getUser(uid);
        if (user) {
            return user.info.headframe;
        }

        return 0;
    },
}

exports.get_enemy = function (req, res, resp) {
    var enemyId = +req.args.enemy;
    var info = null;
    if (isDroid(enemyId)) {
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
                pos: {},
                server_id: 1,
            };
            for (var p in userInfo.pos) {
                info.pos[p] = {
                    rid: userInfo.pos[p].rid,
                    fight_force: userInfo.pos[p].fight_force,
                    tier: userInfo.pos[p].tier,
                    level: userInfo.pos[p].level,
                    awake:userInfo.pos[p].awake,
                };
            }
        }
    } else {
        var userInfo = gUserInfo.getUser(enemyId);
        if (userInfo) {
            info = {
                un: userInfo.info.un,
                level: userInfo.status.level,
                vip: userInfo.status.vip,
                pos: {},
                headpic: userInfo.info.headpic,
                headframe: userInfo.info.headframe,
                dragon: userInfo.info.dragon,
                weapon_illusion: userInfo.sky_suit.weapon_illusion,
                wing_illusion: userInfo.sky_suit.wing_illusion,
                mount_illusion: userInfo.sky_suit.mount_illusion,
                custom_king: userInfo.custom_king,
                server_id: common.getServerId(enemyId),
            };
            for (var p in userInfo.pos) {
                info.pos[p] = {
                    rid: userInfo.pos[p].rid,
                    fight_force: userInfo.pos[p].fight_force,
                    tier: userInfo.pos[p].tier,
                    level: userInfo.pos[p].level,
                    awake:userInfo.pos[p].awake,
                };
            }
        }
    }

    resp.data.info = info;
    onReqHandled(res, resp, 1);
};

exports.UserInfo = UserInfo;
