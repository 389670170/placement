function FightRank() {
    this.robotNameIds = {};
    this.update_list = [];
    this.rank_by_max = new RankList(
        (a, b) => {
            b.fight = b.fight || 0;
            a.fight = a.fight || 0;
            return (b.fight - a.fight);
        }
    );                    // 最高战力排行榜
}

FightRank.create = function (callback) {
    var fightRankData = {
        '_id': 'fight_rank',
        'rank': [],
    };

    gDBWorld.insert(fightRankData, function (err, result) {
        callback && callback();
    });
};

FightRank.prototype = {
    init: function (callback) {
        gDBWorld.find({ _id: 'fight_rank' }).limit(1).next(function (err, doc) {
            if (doc) {
                this.rank_by_max.set_list(doc.rank);
                callback && callback(true);
            }
            else {
                if (err) {
                    ERROR(err);
                }
                this.save();
                callback && callback(true);
            }
        }.bind(this));
    },

    save: function (callback) {
        if (!this.rank_by_max.is_sorted) {
            // this.rank_by_max.sort();                          // 暂时不排序，使用时对应服务器自己排序
        }
        if (!this.rank_by_max.item_list || !this.rank_by_max.item_list.length) {
            var fightRankObj = {
                _id: 'fight_rank',
                rank: this.rank_by_max.item_dict || {}
            };

            gDBWorld.save(fightRankObj, function (err, result) {
                if (err) {
                    ERROR(err);
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            });
        }
        else {
            this.save_itme(true);
            callback && callback(true);
        }
    },

    save_itme: function (force) {
        if (!force && this.update_list.length < 10) { return; }
        var tUpdateList = this.update_list || [];
        this.update_list = [];
        var tUpdateObj = {};
        var tHasUpdate = false;
        for (var i = 0; i < tUpdateList.length; i++) {
            var tId = tUpdateList[i];
            var tWhereStr = { _id: 'fight_rank' };
            tUpdateObj[`rank.${tId}`] = this.rank_by_max.item_dict[tId];
            tHasUpdate = true;
        }

        if (!tHasUpdate) { return; }

        var tUpdateOverCall = function (err, result) {
            if (!err) { return; }
            this.update_list = this.update_list.concat(tUpdateList);
        }

        gDBWorld.updateOne(
            tWhereStr,
            { $set: tUpdateObj },
            tUpdateOverCall.bind(this)
        );
    },

    update: function (uid, args, is_waite) {
        this.update_list.push(uid);
        gFightRank.rank_by_max.update(uid, args, is_waite);

        this.save_itme();
    },



    /** 生成机器人 */
    get_robot(id, lv, fight_force) {
        var tRobotInfo = {};

        var robotFightForce = fight_force;
        var level = lv;
        var posObj = generateRobot(8, lv, robotFightForce);

        var realFightForce = 0;
        var maxHeroFF = 0;
        var maxHero = 0;
        for (var pos in posObj) {
            var ff = posObj[pos].fight_force;
            realFightForce += ff;
            if (ff > maxHeroFF) {
                maxHeroFF = ff;
                maxHero = +posObj[pos].rid;
            }
        }

        var nameId = this.robotNameIds[id];
        if (!nameId) {
            var maxId = Object.keys(gConfName).max();
            var firstId = common.randRange(1, maxId);
            var secondId = common.randRange(1, maxId);
            var male = common.randArray([0, 1]);
            nameId = firstId * 100000 + secondId * 10 + male;

            this.robotNameIds[id] = nameId;
        }

        var firstId = Math.floor(nameId / 100000);
        var secondId = Math.floor((nameId % 100000) / 10);
        var male = nameId % 10 ? 'female' : 'male';
        var name = gConfName[firstId].first + gConfName[secondId][male];
        tRobotInfo = {
            id: id,
            un: name,
            headpic: common.randArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
            headframe: 30002,
            level: level,
            pos: posObj,
            max_hero: maxHero,
            fight_force: realFightForce,
            vip: 0
        };

        return tRobotInfo;
    }
};

var snapshot_data = {};

exports.fight_update = function (req, res, resp) {
    var tOldFightData = gFightRank.rank_by_max.get_item(req.uid);
    if (!tOldFightData || (tOldFightData.fight < req.args.fight)) {
        req.args.data = req.args.data || {};
        req.args.data.fight = req.args.fight;
        gFightRank.update(req.uid, req.args.data, true);
    }
    onReqHandled(res, resp, 1);
};

function get_snapshot(snapshot_name, snapshot_time, callback) {
    var snapshot = snapshot_data[snapshot_name];

    var save_itme = (start, num, name, callback) => {
        var callback = callback || null;
        var tList = gFightRank.rank_by_max.item_list;
        var tUpdateObj = {};
        var tHasUpdate = false;
        for (var i = start; (i < (start + num) && i < tList.length); i++) {
            var tId = tList[i]._id;
            tUpdateObj[`snapshot.rank.${tId}`] = tList[i];
            tHasUpdate = true;
        }

        var tUpdateOverCall = function (err, result) {
            if (!err) {
                callback && callback(false, (start + num) >= tList.length, start);
            }
            else {
                callback && callback(true, (start + num) >= tList.length, start);
            }
        }

        if (!tHasUpdate) {
            tUpdateOverCall();
            return;
        }
        else {
            gDBWorld.updateOne(
                { _id: name },
                { $set: tUpdateObj },
                tUpdateOverCall
            );
        }
    }

    var tOnRemoveCall = () => {
        var tDBKey = "snapshot_" + snapshot_name;
        var snapshotData = {
            rank: {},//gFightRank.rank_by_max.item_dict,
            time: snapshot_time,
        }

        gDBWorld.save({ "_id": tDBKey, snapshot: snapshotData }, function (err, result) {
            if (err) {
                ERROR(err);
            }
            var tStartNum = 0;
            var tSaveNum = 10;

            var go_on_save = (is_error, is_over) => {
                if (!is_error) {
                    tStartNum = tStartNum - 0 + tSaveNum;
                }
                if (is_over) {
                    tOnSaveCall(err, result);
                }
                else {
                    save_itme(tStartNum, tSaveNum, tDBKey, go_on_save);
                }
            }

            go_on_save(true, false);
        });
    }

    var tOnSaveCall = (err, doc) => {
        var tDBKey = "snapshot_" + snapshot_name;
        if (!snapshot_data[snapshot_name]) {
            gDBWorld.findOne(
                { "_id": tDBKey },
                (err, doc) => {
                    var data = doc.snapshot
                    var tRank = new RankList((a, b) => { return (b.fight - a.fight) });
                    tRank.set_list(data.rank, false);
                    snapshot = {
                        time: data.time,
                        rank: tRank
                    };
                    snapshot_data[snapshot_name] = snapshot;

                    if (callback) {
                        callback(snapshot.rank);
                    }
                }
            );

        }
        else {
            if (callback) {
                callback(snapshot_data[snapshot_name].rank);
            }
        }
    }

    if (snapshot && snapshot.time != snapshot_time) {
        var tDBKey = "snapshot_" + snapshot_name;
        gDBWorld.remove(
            { "_id": tDBKey },
            () => {
                snapshot_data[snapshot_name] = null;
                tOnRemoveCall();
            }
        );
    }
    else if (!snapshot) {
        tOnRemoveCall();
    }
    else {
        tOnSaveCall();
    }

    return null;
}

exports.get_list_by_snapshot = function (req, res, resp) {
    var tResultList = null;
    var uid = req.uid;

    var tOnGetSnapshot = (snapshot) => {
        if (snapshot) {
            if (!snapshot.is_sorted) {
                snapshot.sort();
            }

            switch (snapshot_name) {
                case "octopus":
                    tResultList = get_octopus_list(uid, snapshot);
                    break;
                default:
                    break;
            }
            if (tResultList) {
                resp.data.list = tResultList.list;
                resp.data.rank = tResultList.rank;
            }
        }
        onReqHandled(res, resp, 1);
    }

    var snapshot_name = req.args.snapshot_name;
    var snapshot_time = req.args.snapshot_time;
    get_snapshot(snapshot_name, snapshot_time, tOnGetSnapshot);
}

function get_octopus_list(uid, snapshot_dict) {
    var tResultList = {};
    var tKeyList = [];
    for (var tKey in gConfOctopus) {
        tKeyList.push(tKey);
    }
    tKeyList.sort((a, b) => { return a - b });

    var tRank = 0;
    var snapshot = null;

    if (!snapshot) {
        tRank = snapshot_dict.get_rank(uid);
        snapshot = snapshot_dict.get_item(uid);
    }
    tRank = tRank || 0;
    snapshot = snapshot || {};
    snapshot.status = snapshot.status || {};
    snapshot.status.level = snapshot.status ? (snapshot.status.level || 0) : 0;
    snapshot.fight = snapshot.fight || 0;

    var tTargetRankList = [];
    for (var i = 0; i < tKeyList.length; i++) {
        var tKey = tKeyList[i];
        var tConfInfo = gConfOctopus[tKey];
        var tRangeList = tConfInfo.rankRange;

        var target_rank = common.randRange(tRank - tRangeList[0], tRank - tRangeList[1]);
        tTargetRankList.push(target_rank);
        var target_snapshot = null;
        target_snapshot = snapshot_dict.get_item_by_idx(target_rank);
        var tResult = {};
        if (target_snapshot) {
            target_snapshot.name = target_snapshot.un;
            tResult = {
                uid: target_snapshot._id,
                vip: target_snapshot.status.vip,
                level: target_snapshot.status.level,
                fight_force: target_snapshot.fight,
                name: target_snapshot.info.un,
                headframe: target_snapshot.info.headframe,
                target_data: target_snapshot,
                sid: target_snapshot.sid,
            };
        }
        else if (tConfInfo) {
            var tTargetLv = (snapshot.status.level + tConfInfo.robotLevelOffset);
            tTargetLv = tTargetLv <= 0 ? 1 : tTargetLv;
            tTargetLv = tTargetLv > gMaxUserLevel ? gMaxUserLevel : tTargetLv;
            target_snapshot = gFightRank.get_robot(i, tTargetLv, (snapshot.fight * tConfInfo.robotFightC));
            target_snapshot.name = target_snapshot.un;
            tResult = {
                uid: target_snapshot.id,
                vip: target_snapshot.vip,
                level: target_snapshot.level,
                fight_force: target_snapshot.fight_force,
                name: target_snapshot.un,
                headframe: target_snapshot.headframe,
                target_data: target_snapshot,
                sid: 1,
            };
        }

        tResultList[tKey] = tResult;
    }

    return {
        list: tResultList,
        rank: tRank,
        fight: snapshot.fight,
    };
}

function RankList(sort_func) {
    this.sort_func = sort_func;
    this.item_dict = {};
    this.item_list = [];
    this.is_sorted = false;
}
RankList.prototype = {
    set_list: function (list, is_waite) {
        list = list || {};
        for (var tKey in list) {
            var data = list[tKey];
            if (!data) { continue; }
            this.update(tKey, data, true);
        }

        if (is_waite) { return; }

        this.sort();
    },

    update: function (uid, data, is_waite) {
        if (this.item_dict[uid]) {
            this.item_list.splice(this.item_list.indexOf(this.item_dict[uid]), 1, data);
        }
        else {
            this.item_list.push(data);
        }
        this.item_dict[uid] = data;
        this.is_sorted = false;

        if (is_waite) { return; }

        this.sort();
    },

    sort: function () {
        this.item_list = this.item_list.sort(this.sort_func);
        this.is_sorted = true;
    },

    get_item_by_idx: function (idx) {
        if (idx < 0 || idx >= this.item_list.length) { return null; }
        return this.item_list[idx];
    },

    get_item: function (uid) {
        return this.item_dict[uid];
    },

    get_rank: function (uid) {
        return this.item_list.indexOf(this.item_dict[uid]);
    },
}

exports.FightRank = FightRank;
