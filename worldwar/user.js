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
            pos : {},
            skills : {},
            def_info : {},
            fight_force : 0,
            worldwar : {
                count : 0,              // 届
                score : 0,              // 积分
                score_get : 0,          // 获得的积分
                price : 0,              // 身价
                report : [              // 积分赛战报
                    [enemyid, attacker, revenged, replayid, win, scoreadd],
                ],
                max_win : 0,            // 连续挑战胜利最大次数
                cur_win : 0,            // 当前连续挑战胜利次数
                max_rank : 0,           // 历史积分赛最大排名
                rank_1 : 0,             // 积分赛冠军的次数
                sum_fight : 0,          // 累计在决赛的胜利次数
                sum_win : 0,            // 积分赛连续胜利最大次数
                top_rank : 0,           // 历史最大决赛排名
                top_1 : 0,              // 决赛排名冠军的次数
                sup_count : 0,          // 支持成功次数
                rank_score : 0,         // 历史最高积分
                team : {},              // 决赛阵容
                skills : {},            // 决赛技能
                supports: {             // 本轮支持情况
                    progress: [0, 0]    // 被支持者, 支持金币
                },
                reward: {               // 功勋墙领取状态
                    rank_score: {       // 历史最高积分
                        // 1: 0,        // id: 是否领取
                    },
                    max_rank: {},       // 历史积分赛最大排名
                    sum_win: {},        // 积分赛连续胜利最大次数
                    sum_fight: {},      // 累计决赛阶段胜利次数
                    top_rank: {},       // 历史决赛最大排名
                    top_1: {},          // 历史决赛冠军次数
                    sup_count: {},      // 支持成功
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
                this.users[item._id] = item;

                var updated = false;
                if (!item.sky_suit) {
                    item.sky_suit = {
                        weapon_illusion: 0,
                        wing_illusion: 0,
                        mount_illusion: 0,
                    };
                    updated = true;
                }

                if (updated) {
                    this.markDirty(item._id);
                }
            } else {
                callback && callback(true);
            }
        }.bind(this));
    },

    getUser : function(uid) {
        return this.users[uid];
    },

    getUserFightInfo : function(uid, notUseDefPos, useWorldWarTeam) {
        var info                = {};

        var user                = this.getUser(uid);
        if (!user) {
            return null;
        }

        info.uid                = uid;
        info.name               = user.info.un;
        info.headpic            = user.info.headpic;
        info.headframe          = user.info.headframe || 30002;
        info.level              = user.status.level;

        info.pos                = user.pos;

        info.weapon_illusion    = user.sky_suit.weapon_illusion;
        info.wing_illusion      = user.sky_suit.wing_illusion;
        info.mount_illusion     = user.sky_suit.mount_illusion;
        info.custom_king        = user.custom_king;

        // 龙的等级
        info.dragon             = {};

        if (user.dragon) 
        {
            for (var i in user.dragon) 
            {
                info.dragon[i]  = user.dragon[i].level;
            }
        }

        var fightForce          = 0;

        if (user.fight_force) 
        {
            fightForce          = user.fight_force;
        }
        else{
            for (var p in user.pos) {
                fightForce += user.pos[p].fight_force;
            }
        }

        info.fight_force        = fightForce;
        info.skills             = clone(user.skills);

        var defInfo             = user.def_info;

        if (!notUseDefPos && defInfo && defInfo.set) 
        {
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
        } else if (notUseDefPos && useWorldWarTeam) {
            if (user.worldwar.team)
            {
                for (var slot in info.skills) {
                    info.skills[slot].id = user.worldwar.skills[slot];
                }

                var checkSucc       = true;

                for (var hid in user.worldwar.team) 
                {
                    if(!info.pos[hid])
                    {
                        checkSucc   = false;
                    }
                }

                if (checkSucc)
                {
                    for (var hid in user.worldwar.team)
                    {    
                        info.pos[hid].slot = user.worldwar.team[hid];
                    }
                }
            }
        }

        return info;
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

    update : function(uid, updates, server_id) {
        var userInfo = this.users[uid];
        if (!userInfo) {
            updates._id = uid;
            this.users[uid] = updates;
            this.markDirty(uid);
            return;
        }

        var updated = false;
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

        if (server_id && userInfo.server_id != server_id) {
            userInfo.server_id = server_id;
            updated = true;
        }

        if (!userInfo.worldwar.hasOwnProperty('score_get')) {
            userInfo.worldwar.score_get = 0;
            updated = true;
        }

        if (updated) {
            userInfo.fight_force = 0;
            this.markDirty(uid);
        }
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

    clear : function() {
        var removeUids = [];
        for (var uid in this.users) {
            // 删除最近五届都没有再参加过跨服战的玩家数据
            if (this.users[uid].worldwar && this.users[uid].worldwar.count < gWorldWar.count-5) {
                removeUids.push(uid);
            } else {
                this.users[uid].worldwar.score_get = 0;
                this.markDirty(uid);
            }
        }

        gDBUser.remove({_id : {"$in" : removeUids}}, function(err, count){
            if (err) {
                ERROR(err);
            } else {
                for (var i = 0; i < removeUids.length; i++) {
                    delete this.users[removeUids[i]];
                }
            }
        }.bind(this));
    },

    getHonorUser : function(uid) {
        var userInfo = this.getUser(uid);
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
            uid: uid,
            un: userInfo.info.un,
            headpic: maxHid,
            headframe : userInfo.info.headframe,
            promote: maxPromote,
            weapon_illusion: userInfo.sky_suit.weapon_illusion,
            wing_illusion: userInfo.sky_suit.wing_illusion,
            bullet: [], // 所有印象保存在world, 这里始终为空
        };
    },

    addTip : function(uid, type) {
        var req = {
            mod : 'tips',
            act : 'add_tip',
            uid : uid,
            args : {
                type : type,
            },
        };
        //reuestClientWorld(common.getServerId(uid), req, {});
    },
}

exports.login = function(req, res, resp) {
    var tips = {
    /*
        exploit_wall: 0,
        ww_sup: 0,
    */
    };

    // 功勋奖励是否需要领奖
    var user = gUserInfo.getUser(req.uid);
    if (user) {
        worldwar = user.worldwar;
        for (var type in worldwar.reward) {
            var progress = 0;
            for (var id in worldwar.reward[type]) {
                if (id >= progress) {
                    progress = +id;
                }
            }

            if (!gConfExploitWall[type] || !gConfExploitWall[type][progress + 1]) {
                continue;
            }

            var target = gConfExploitWall[type][progress + 1].target;
            if (!target) {
                continue;
            }

            if (type == 'sup_count') {
                if (gWorldWar.supports[req.uid] && target <= gWorldWar.supports[req.uid][1]) {
                    tips['exploit_wall'] = 1;
                    break;
                }
            } else if (type == 'max_win' || type == 'sum_fight' || type == 'rank_1' || type == 'top_1' || type == 'sup_count') {
                if (target <= worldwar[type]) {
                    tips['exploit_wall'] = 1;
                    break;
                }
            } else {
                if (target >= worldwar[type]) {
                    tips['exploit_wall'] = 1;
                    break;
                }
            }
        }

        var segs = gWorldWar.progress.split('_');
        if (segs[0] == 'sup' && !worldwar.supports[segs[1]]) {
            tips['ww_sup'] = 1;
        }
    }

    resp.data.tips = tips;
    resp.data.worldwarstage = gWorldWar.progress;

    onReqHandled(res, resp, 1);
};

exports.get_enemy = function(req, res, resp) {
    var enemyId = +req.args.enemy;
    var userInfo = gUserInfo.getUser(enemyId);
    var info = null;
    if (userInfo) {
        info = {
            un : userInfo.info.un,
            level : userInfo.status.level,
            vip : userInfo.status.vip,
            pos : {},
            headpic : userInfo.info.headpic,
            headframe : userInfo.info.headframe,
            dragon : userInfo.info.dragon,
            weapon_illusion: userInfo.sky_suit.weapon_illusion,
            wing_illusion: userInfo.sky_suit.wing_illusion,
            mount_illusion : userInfo.sky_suit.mount_illusion,
            custom_king : userInfo.custom_king,
            server_id:userInfo.server_id || 1,
        };
        for (var p in userInfo.pos) {
            info.pos[p] = {
                rid : userInfo.pos[p].rid,
                fight_force : userInfo.pos[p].fight_force,
                tier : userInfo.pos[p].tier,
                level : userInfo.pos[p].level,
                awake:userInfo.pos[p].awake,
            };
        }
    }
    resp.data.info = info;
    onReqHandled(res, resp, 1);
};

exports.get_honor_hall = function(req, res, resp) {
    resp.data.pvpInfo = gWorldWar.getHonorTopUser();
    onReqHandled(res, resp, 1);
};

exports.get_honor_user = function(req, res, resp) {
    var tarUser = gWorldWar.getHonorTopUser();
    if (!tarUser) {
        resp.data.replace = null;
        resp.data.info = null;
    } else {
        if (tarUser.uid != req.args.target) {
            resp.data.replace = tarUser;
        }

        var user = gUserInfo.getUser(tarUser.uid)
        var retUser = {
            un: tarUser.un,
            bullet: [],
            pos: {},
        };

        for (var p in user.pos) {
            retUser.pos[p] = {
                rid: user.pos[p].rid,
                level: user.pos[p].level,
                fight_force: user.pos[p].fight_force,
                equip: user.pos[p].equip,
            };
        }
    }

    resp.data.info = user;
    onReqHandled(res, resp, 1);
};

exports.send_bullet = function(req, res, resp) {
    if (req.args.target != gWorldWar.getHonorTopUid()) {
        resp.code = 102; resp.desc = 'not in hall';
    }
    onReqHandled(res, resp, 1);
};

exports.get_title = function(req, res, resp) {
    var uid = req.uid;
    if (uid == gWorldWar.getHonorTopUid) {
        resp.data.title = 'world_war';
    } else {
        resp.data.title = '';
    }

    onReqHandled(res, resp, 1);
}

exports.UserInfo = UserInfo;
