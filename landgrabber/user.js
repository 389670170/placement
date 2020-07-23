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

            // 村庄争夺相关数据
            land_grabber : {

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

    getUserFightInfo : function(uid, notUseDefPos, useLandGrabberTeam) {
        var info = {};
        var user = this.getUser(uid);
        if (!user) {
            return null;
        }

        info.uid        = uid;
        info.name       = user.info.un;
        info.headpic    = user.info.headpic;
        info.headframe  = user.info.headframe || 30002;
        info.country    = user.info.country;
        info.server     = user.info.sid;
        info.level      = user.status.level;
        info.vip        = user.status.vip;

        info.pos                = user.pos;
        info.weapon_illusion    = user.sky_suit.weapon_illusion;
        info.wing_illusion      = user.sky_suit.wing_illusion;
        info.mount_illusion     = user.sky_suit.mount_illusion;
        info.custom_king        = user.custom_king;

        // 龙的等级
        info.dragon             = {};
        if (user.dragon) {
            for (var i in user.dragon) {
                info.dragon[i]  = user.dragon[i].level;
            }
        }

        var fightForce          = 0;

        if (user.fight_force) 
        {
            fightForce          = user.fight_force;
        }
        else
        {
            for (var p in user.pos) {
                fightForce += user.pos[p].fight_force;
            }
        }

        info.fight_force        = fightForce;
        info.skills             = clone(user.skills);

        var defInfo             = user.def_info;

        if (!notUseDefPos && defInfo.set) {
            
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
        } else if (notUseDefPos && useLandGrabberTeam) {
            // 村庄就没有防守阵型   
        }

        return info;
    },

    setTeam : function (uid, team, skills) {
        var userInfo = this.getUser(uid);
        userInfo.land_grabber.def_info.team = team;
        userInfo.land_grabber.def_info.skills = skills;
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

    initUserData : function (uid) {
        if (!this.users[uid])
            return;

        this.users[uid].land_grabber = {};

        if (this.users[uid].def_info)
            this.users[uid].land_grabber.def_info = this.users[uid].def_info;
        else
            this.users[uid].land_grabber.def_info = {};
    },

    update : function(uid, updates, serverId) {
        var userInfo = this.users[uid];

        var updated = false;
        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;

            if (!this.users[uid].land_grabber) {
                this.initUserData(uid);
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

        var fightForce = 0;
        for (var p in userInfo.pos) {
            if (userInfo.pos[p].rid) {
                fightForce += userInfo.pos[p].fight_force;
            }
        }

        if (updated) {
            userInfo.fight_force = 0;
        }

        if (!this.users[uid].land_grabber) {
            this.initUserData(uid);
        }

        if (!this.users[uid].land_grabber.def_info) {
            if (this.users[uid].def_info)
                this.users[uid].land_grabber.def_info = this.users[uid].def_info;
            else
                this.users[uid].land_grabber.def_info = {};
        }

        // 计算战斗力最大的武将id
        var maxHeroFF = 0;
        var maxHero = 0;
        for (var p in userInfo.pos) {
            if (userInfo.pos[p].fight_force > maxHeroFF) {
                maxHeroFF = userInfo.pos[p].fight_force;
                maxHero = userInfo.pos[p].rid;
            }
        }

        if (!userInfo.info) {
            userInfo.info = {};
        }

        userInfo.info.model = maxHero;
        if (serverId) {
            userInfo.info.sid = serverId;
        }

        userInfo.fight_force = fightForce;

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

    // 重置跨服村庄争夺数据
    resetLandGrabberUser : function (week) {
        if (week) {
            this.onResetByWeek();
        } else {
            for (var uid in this.users) {
                var userInfo = this.users[uid];
                if (!userInfo.land_grabber)
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
}

exports.login = function (req, res, resp) {
    var team_id = req.args.team_id;
    resp.data.village_id = gLandGrabber.getVillageByTeam(team_id);
    resp.data.village_land = gLandGrabber.getLandByUid(req.uid);
    onReqHandled(res, resp, 1);
};

exports.get_enemy = function (req, res, resp) {
    var enemyId = +req.args.enemy;
    var info = null;
    
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
            var awake = userInfo.pos[p].awake;
            var level = userInfo.pos[p].level;
            var tier  = userInfo.pos[p].tier;
            
            var equip = userInfo.pos[p].equip;
            if (isDroid(enemyId)) {
                awake = 0;
                level = Math.floor(userInfo.pos[p].fight_force / 500);
                equip = {};
            }
            info.pos[p] = {
                rid: userInfo.pos[p].rid,
                fight_force: userInfo.pos[p].fight_force,
                awake: awake,
                tier: tier,
                level: level,
                equip: equip,
                promote: {},// bu yong
            };
        }
    }

    resp.data.info = info;
    onReqHandled(res, resp, 1);
};

exports.UserInfo = UserInfo;
