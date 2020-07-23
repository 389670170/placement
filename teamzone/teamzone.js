// 小队领地
var ErrorCode = require('./error.js').ErrorCode;

function TeamZone() {
    // 领地列表，一个小队一个领地
    this.teamZones = {
        /*
        teamId : {
            name : '',  // 队伍名称
            leader : 0, // 队长uid
            use_badge : 0,  // 佩戴徽章
            fight_force : 0,    // 队伍战斗力

            players : [],   // 在这个领地的玩家列表

            // 这个领地的服务器id
            servers : [],
        }
         */
    };

    // 战报
    this.reports = {};

    // 注册到这个领地服务器的服
    this.servers = {};

    this.dirty = {};            // 脏数据
};

TeamZone.create = function (callback) {
    var teamZoneData = {
        '_id': 'team_zone',
        'teamZones' : {},
        'reports' : {},
        'servers' : {},
    };

    gDBWorld.insert(teamZoneData, function(err, result) {
        callback && callback();
    });
};

TeamZone.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'team_zone'}).limit(1).next(function (err, doc) {
            if (doc) {
                this.teamZones = doc.teamZones;
                this.reports = doc.reports;
                this.servers = doc.servers;

                if (!this.teamZones) {
                    this.teamZones = {};
                    this.markDirty('teamZones');
                }

                if (!this.reports) {
                    this.reports = {};
                    this.markDirty('reports');
                }

                if (!this.servers) {
                    this.servers = {};
                    this.markDirty('servers');
                }

                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    tickFunc : function () {

    },

    resetByDay : function () {

    },

    resetByWeek : function () {

    },

    markDirty: function(name, force, callback) {
        this.dirty[name] = 0;

        if (force) {
            this.save(callback);
        } else {
            callback && callback(true);
        }
    },

    markDelete : function (name) {
        this.dirty[name] = 1;
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

    // 保存
    save: function (callback) {
        DEBUG('team zone save begin');
        if (Object.keys(this.dirty).length == 0) {
            callback && callback(true);
            return;
        }

        this.arrangeDirty();
        var updates = {$set: {}, $unset: {}};
        for (var item in this.dirty) {
            var remove = this.dirty[item];
            if (remove) {
                updates['$unset'][item] = 1;
            } else {
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
                    updates['$set'][item] = obj;
                } else {
                    ERROR('INVALID SAVE TEAM ZONE: ' + item);
                }
            }
        }

        var toUpdate = 2;

        if (Object.keys(updates['$unset']).length == 0) {
            delete updates['$unset'];
            toUpdate--;
        }

        if (Object.keys(updates['$set']).length == 0) {
            delete updates['$set'];
            toUpdate--;
        }

        if (toUpdate) {
            var _me = this;
            this.dirty = {};
            gDBWorld.update({_id: 'team_zone'}, updates, function (err, result) {
                if (err) {
                    ERROR({updates: updates, err: err});
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            });
        }
        DEBUG('team zone save end');
    },

    // 插入这个领地相关的服务器，领地相关服务器取决于进入这个领地的玩家
    insertServer : function (teamId, sid) {
        if (!this.teamZones[teamId])
            return;

        if (!this.teamZones[teamId].servers) {
            this.teamZones[teamId].servers = [];
        }

        if (this.teamZones[teamId].servers.indexOf(sid) >= 0)
            return;

        this.teamZones[teamId].servers.push(sid);
        this.markDirty(util.format('teamZones.%d.servers', teamId));
    },

    // 广播玩家位置改变
    // set是否直接设置过去，set为true就没有过程
    broadcastPlayerPosition : function (uid, zoneId, cellId, set) {
        if (!this.teamZones[zoneId]) {
            return;
        }

        var playerIds = [];
        for (var i = 0; i < this.teamZones[zoneId].players.length; i++) {
            var userInfo = gUserInfo.getUser(this.teamZones[zoneId].players[i]);
            if (userInfo && !userInfo.team_zone.leave && userInfo.team_zone.pos.zone_id == zoneId) {
                playerIds.push(this.teamZones[zoneId].players[i]);
            }
        }

        if (playerIds.length > 0) {
            var WorldReq = {
                mod : 'teamzone',
                act : 'player_position_change',
                uid : 1,
                args : {
                    players : playerIds,
                    uid : uid,
                    zone_id : zoneId,
                    cell_id : cellId,
                    set : set,
                }
            }

            var WorldResp = {};
            WorldResp.code = 0;
            this.broadcastInZone(zoneId, WorldReq, WorldResp, function () {
                if (WorldResp.code == 0) {
                    DEBUG('broadcastPlayerPosition to world finish!' + WorldResp.desc);
                } else {
                    DEBUG('broadcastPlayerPosition to world failed!' + WorldResp.desc);
                }
            });
        }
    },

    // 在领地范围内广播
    broadcastInZone : function (zoneId, req, resp, callback) {
        if (!this.teamZones[zoneId])
            return;

        var servers = this.teamZones[zoneId].servers;
        for (var i = 0; i < servers.length; i++) {
            this.broadcastToWorld(servers[i], req, resp, callback);
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

    // 获取指定格子里的玩家列表
    getCellPlayerList : function (selfTeamId, zoneId, cellId) {
        var playerList = {};
        if (!this.teamZones[zoneId])
            return playerList;

        for (var i = 0; i < this.teamZones[zoneId].players.length; i++) {
            var uid = this.teamZones[zoneId].players[i];
            var user = gUserInfo.getUser(this.teamZones[zoneId].players[i]);
            if (user &&
                user.team_zone.pos.zone_id == zoneId &&
                user.team_zone.pos.cell_id == cellId &&
                user.team_zone.team_id != selfTeamId) {

                var playerInfo = {};
                playerInfo.uid = uid;
                playerInfo.un = user.info.un;
                playerInfo.headpic = user.info.headpic;
                playerInfo.headframe = user.info.headframe;
                playerInfo.level = user.status.level;
                playerInfo.pos = user.team_zone.pos;
                playerInfo.fightForce = gUserInfo.getUserFightForce(uid);
                playerInfo.vip = user.status.vip;
                playerInfo.weapon_illusion = user.sky_suit.weapon_illusion;
                playerInfo.wing_illusion = user.sky_suit.wing_illusion;

                playerList[uid] = playerInfo;
            }
        }

        return playerList;
    },

    // 玩家进入领地回调
    onPlayerEnterZone : function (uid, zone_id, cell_id) {
        var userInfo = gUserInfo.getUser(uid);
        if (!userInfo) {
            return;
        }

        var oldZoneId = userInfo.team_zone.pos.zone_id;
        if (oldZoneId == zone_id) {
            DEBUG('repeat enter zone uid = ' + uid + ', zone id = ' + zone_id);
            //return;
        }

        if (oldZoneId != 0 && oldZoneId != zone_id) {
            var oldCellId = userInfo.team_zone.pos.cell_id;
            this.onPlayerLeaveZone(uid, oldZoneId, oldCellId);
        }

        var sid = userInfo.info.sid;
        if (sid) {
            this.insertServer(zone_id, sid);
        }

        var newZone = this.teamZones[zone_id];
        if (newZone) {
            if (newZone.players.indexOf(uid) < 0) {
                newZone.players.push(uid);
                this.markDirty(util.format('teamZones.%d.players', zone_id));
                gUserInfo.setPos(uid, zone_id, cell_id);
            }

            var playerIds = [];
            for (var i = 0; i < newZone.players.length; i++) {
                var user = gUserInfo.getUser(newZone.players[i]);
                if (user && !user.team_zone.leave && user.team_zone.pos.zone_id == zone_id) {
                    playerIds.push(newZone.players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'teamzone',
                    act : 'player_enter',
                    uid : 1,
                    args : {
                        players : playerIds,
                        uid : uid,
                        un : userInfo.info.un,
                        team_id : userInfo.team_zone.team_id,
                        weapon_illusion : userInfo.sky_suit.weapon_illusion,
                        wing_illusion : userInfo.sky_suit.wing_illusion,
                        custom_king : userInfo.custom_king,
                        pos : {
                            zone_id : zone_id,
                            cell_id : cell_id,
                        },
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastInZone(zone_id, WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('player_enter to world finish!' + WorldResp.desc);
                    } else {
                        DEBUG('player_enter to world failed!' + WorldResp.desc);
                    }
                });
            }
        }
    },

    // 玩家离开领地回调
    onPlayerLeaveZone : function (uid, zone_id, cell_id) {
        var oldZone = this.teamZones[zone_id];
        if (oldZone) {
            oldZone.players.remove(uid);
            this.markDirty(util.format('teamZones.%d.players', zone_id));

            var playerIds = [];
            for (var i = 0; i < oldZone.players.length; i++) {
                var user = gUserInfo.getUser(oldZone.players[i]);
                if (user && !user.team_zone.leave && user.team_zone.pos.zone_id == zone_id) {
                    playerIds.push(oldZone.players[i]);
                }
            }

            if (playerIds.length > 0) {
                var WorldReq = {
                    mod : 'teamzone',
                    act : 'player_leave',
                    uid : 1,
                    args : {
                        players : playerIds,
                        uid : uid,
                        pos : {
                            zone_id : zone_id,
                            cell_id : cell_id,
                        },
                    }
                }

                var WorldResp = {};
                WorldResp.code = 0;
                this.broadcastInZone(zone_id, WorldReq, WorldResp, function () {
                    if (WorldResp.code == 0) {
                        DEBUG('player_leave to world finish!');
                    } else {
                        DEBUG('player_leave to world failed!');
                    }
                });
            }
        }
    },

    // 玩家离开队伍回调
    onPlayerLeaveTeam : function (uid) {
        var user = gUserInfo.getUser(uid);
        if (!user) {
            return;
        }

        if (!user.team_zone) {
            return;
        }

        var zoneId = user.team_zone.pos.zone_id;
        var cellId = user.team_zone.pos.cell_id;
        this.onPlayerLeaveZone(uid, zoneId, cellId);
    },

    // 创建一个新的领地
    createZone : function (zone_id, server_id) {
        this.teamZones[zone_id] = {}
        this.teamZones[zone_id].players = [];
        this.teamZones[zone_id].servers = [];
        this.teamZones[zone_id].leader = 0;
        this.teamZones[zone_id].name = '';
        this.teamZones[zone_id].fight_force = 0;
        this.teamZones[zone_id].use_badge = 0;

        this.teamZones[zone_id].servers.push(server_id);
        this.markDirty(util.format('teamZones.%d', zone_id));

        return this.teamZones[zone_id];
    },

    // 获取领地数据
    getZoneData : function (uid, zone_id, server_id) {
        var data = {};
        var user = gUserInfo.getUser(uid);
        if (!user) {
            return data;
        }

        if (!this.teamZones[zone_id]) {
            // 还没有创建这个队伍的领地
            this.createZone(zone_id, server_id);
        }

        if (!user.team_zone) {
            return data;
        }

        var curZoneId = user.team_zone.pos.zone_id;

        var zone = this.teamZones[zone_id];
        if (zone.players.indexOf(uid) < 0) {
            var cellId = user.team_zone.pos.cell_id;
            this.onPlayerEnterZone(uid, zone_id, cellId);
        }

        // 获取此领地的玩家列表
        var playerList = {};
        for (var i = 0; i < this.teamZones[zone_id].players.length; i++) {
            var playerInfo = {};

            var playerId = this.teamZones[zone_id].players[i];
            var user = gUserInfo.getUser(playerId);
            if (user) {
                playerInfo.uid = playerId;
                playerInfo.un = user.info.un;
                playerInfo.team_id = user.team_zone.team_id;
                playerInfo.pos = user.team_zone.pos;
                playerInfo.weapon_illusion = user.sky_suit.weapon_illusion;
                playerInfo.wing_illusion = user.sky_suit.wing_illusion;
                playerInfo.custom_king = user.custom_king;

                playerList[playerInfo.uid] = playerInfo;
            }
        }

        data.self_data = clone(user.team_zone);    // 自身领地信息
        delete data.self_data.def_info;

        data.zone_data = this.teamZones[zone_id];   // 当前所在领地数据
        data.player_list = playerList;
        return data;
    },
};

// 注册服务器
exports.register_server = function (req, res, resp) {
    do {
        var serverId = req.args.sid;
        if ((!serverId || isNaN(serverId)) && serverId != 0) {
            resp.code = 1; resp.desc = 'server id needed'; break;
        }

        gTeamZone.registerServer(req.args.sid, req.args.ip, req.args.port, req.args.openTime);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var user = req.args.user;
        var teamId = +req.args.team_id;
        var serverId = +req.args.serverId;
        gUserInfo.update(uid, user, teamId, serverId);

        var user = gUserInfo.getUser(uid);
        var zoneId = teamId;
        if (user && user.team_zone) {
            zoneId = user.team_zone.pos.zone_id;
            if (zoneId == 0) {
                zoneId = teamId;
            }
        }

        resp.data = gTeamZone.getZoneData(uid, zoneId, serverId);
    } while (false);

    onReqHandled(res, resp, 1);
};

// 离开队伍
exports.leave_team = function (req, res, resp) {
    var uid = +req.uid;
    do {
        gTeamZone.onPlayerLeaveTeam(uid);
    } while(false);

    onReqHandled(res, resp, 1);
};

// 移动到指定格子
exports.move_to = function (req, res, resp) {
    var uid = +req.uid;
    do {
        var cellId = +req.args.cell_id;
        if (isNaN(cellId)) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        var user = gUserInfo.getUser(uid);
        if (!user) {
            resp.code = 1; resp.desc = 'can not find user'; break;
        }

        gUserInfo.moveTo(uid, cellId);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.TeamZone = TeamZone;