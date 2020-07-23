function Tower() {
    this.ranks = new RankTree(                     // 层数排行榜
        // 存储对象 [uid, floor, time]
        function (c1, c2) {
            return judge(c1, c2);
        }, gConfGlobal.towerRankListLimit);

    this.top_ranks = new RankTree(function (c1, c2) {// 通关的排名
        return judge(c1, c2);
    }, gConfGlobal.towerRankListLimit);

    function judge(c1, c2) {
        // 同一个人作为相等, 用于删除
        if (c1[0] == c2[0]) return 0;

        // 不同人通关层数排先后
        if (c1[1] > c2[1]) return -1;
        if (c1[1] < c2[1]) return 1;

        // 通关数相等按照达成时间排先后
        if (c1[2] < c2[2]) return -1;
        if (c1[2] > c2[2]) return 1;

    }
}

Tower.create = function (callback) {
    var towerData = {
        '_id': 'tower',
        'ranks': [],
        'top_ranks': []
    };

    gDBWorld.insert(towerData, function (err, result) {
        callback && callback();
    });
};

Tower.prototype = {
    init: function (callback) {
        gDBWorld.find({_id: 'tower'}).limit(1).next(function (err, doc) {
            if (doc) {
                // TODO : delete it 临时重算排行榜
                var now = common.getTime();

                for (var uid in gUserInfo.users) {
                    var userTower = gUserInfo.users[uid].tower;
                    var floor = userTower.top_floor;
                    var time = userTower.top_time;
                    if (floor && floor > 0) {
                        this.ranks.update([+uid, floor, time]);
                    }
                }

                /*doc.ranks = [];
                var rankCnt = gConfGlobal.fightForceRankListLimit;
                var iter = this.ranks.iterator();
                var item = null;
                while (doc.ranks.length != rankCnt && (item = iter.next()) != null) {
                    doc.ranks.push(item);
                }
                this.ranks.erase();
                //////////////////////////////////////////

                for (var i = 0, len = doc.ranks.length; i < len; i++) {
                    this.ranks.insert(doc.ranks[i]);
                }*/
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function (callback) {
        var towerObj = {
            _id: 'tower',
            ranks: [],
            top_ranks: []
        };

        var ranks = towerObj.ranks;
        this.ranks.each(function (data) {
            ranks.push(data);
        });

        var top_ranks = towerObj.top_ranks;
        this.top_ranks.each(function (data) {
            top_ranks.push(data);
        });

        gDBWorld.save(towerObj, function (err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    getHonorTopUid: function () {
        var rankInfo = gTower.ranks.iterator().next();
        if (!rankInfo) {
            return 0;
        } else {
            return rankInfo[0];
        }
    },

    getHonorTopUser: function () {
        var uid = this.getHonorTopUid();
        if (!uid) {
            return null;
        } else {
            return gUserInfo.getHonorUser(uid);
        }
    },
};

exports.fight = function (req, res, resp) {
    gTower.ranks.update([req.uid, req.args.top_floor, req.args.new_time]);
    // 判断是否通关，更新通关排名
    if (req.args.top_floor == req.args.max_floor) {
        gTower.top_ranks.update([req.uid, req.args.top_floor, req.args.new_time]);
    }
    onReqHandled(res, resp, 1);
};

// 获得排名
exports.get = function (req, res, resp) {
    resp.data.rank = gTower.ranks.rankById(req.uid);
    onReqHandled(res, resp, 1);
};

exports.rank_list = function (req, res, resp) {
    do {
        var rankList = [];
        if (!gTower.ranks.root) { // 解决重启服务器排行榜不显示问题
            if (req.args.top_floor > 0) {
                gTower.ranks.update([req.uid, req.args.top_floor, req.args.new_time]);
            }
        }
        gTower.ranks.each(function (data) {
            var floor = data[1];
            if (rankList.length < gConfGlobalNew.rankListLimit_tower) {
                var user = gUserInfo.getUser(data[0]);

                var fightForce = 0;
                var maxFightForce = 0;
                var maxFightForceHid = 0;
                var maxHidPromote = 0;
                for(var p in user.pos) {
                    fightForce += user.pos[p].fight_force;

                    if (user.pos[p].fight_force > maxFightForce) {
                        maxFightForce = user.pos[p].fight_force;
                        maxFightForceHid = user.pos[p].rid;
                        maxHidPromote = user.pos[p].promote;
                    }
                }

                var info = {
                    uid : data[0],
                    floor : floor,
                    un : user.info.un,
                    headpic : user.info.headpic,
                    headframe : user.info.headframe,
                    level : user.status.level,
                    main_role : user.pos[1].rid,
                    vip : user.status.vip,
                    fight_force : fightForce,
                    custom_king : user.custom_king,
                };

                if (rankList.length == 0) {
                    // 第一名需要显示军团名
                    info.legionName = '';
                    info.max_force_hid = maxFightForceHid;
                    info.promote = maxHidPromote;
                    info.weapon_illusion = 0;
                    info.wing_illusion = 0;
                    info.mount_illusion = 0;
                    info.custom_king = {};

                    if (user.pos[1].rid == maxFightForceHid) {
                        info.weapon_illusion = user.sky_suit.weapon_illusion;
                        info.wing_illusion = user.sky_suit.wing_illusion;
                        info.mount_illusion = user.sky_suit.mount_illusion;
                        info.custom_king = user.custom_king;
                    }

                    var lid = gNewLegion.getUserLegionId(data[0]);
                    if (lid > 0) {
                        var legion = gNewLegion.get(lid);
                        if (legion) {
                            info.legionName = legion.name;
                        }
                    }
                }
                rankList.push(info);
            }
        });
        var selfRankData = gTower.ranks.idMap[req.uid];
        var selfUser = gUserInfo.getUser(req.uid);
        var selfInfo = {
            uid : req.uid,
            floor : selfRankData ? selfRankData[1] : 0,
            un : selfUser.info.un,
            headpic : selfUser.info.headpic,
            headframe : selfUser.info.headframe,
            level : selfUser.status.level,
            main_role : selfUser.pos[1].rid,
            vip : selfUser.status.vip,
            fight_force : selfUser.fight_force,
            custom_king : selfUser.custom_king,
            rank : gTower.ranks.rankById(req.uid)
        };
        resp.data.self = selfInfo;

        //resp.data.rank = gTower.ranks.rankById(req.uid);
        resp.data.rank_list = rankList;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.Tower = Tower;
