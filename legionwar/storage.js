var ErrorCode = require('./error.js').ErrorCode;
var Robot = require('./robot.js').Robot;

// 保存服务器注册数据
function saveServerRegData(serverRegData, callback) {
    gDBRegister.save({_id: serverRegData.sid, legions: serverRegData.legion_list}, function(err){
        if (err) {
            ERROR(util.format('%j', err));
            callback(ErrorCode.ERROR_DB_ERROR);
        } else {
            callback();
        }
    });
}

// 向所有世界服请求符合要求的军团列表
function getMatchConditionLegions(callback) {
    var WorldReq = {
        mod : 'legionwar',
        act : 'get_match_condition_legions',
        uid : 1,
        args : {}
    }

    var WorldResp = {};
    WorldResp.code = 0;
    gLegionWar.broadcastToAllWorld( WorldReq, WorldResp, function (sid) {
        if (WorldResp.code == 0) {
            DEBUG('getMatchConditionLegions to world finish!');
            WorldResp.data.sid = sid;
            saveServerRegData(WorldResp.data, function (err) {
            });
        } else {
            DEBUG('getMatchConditionLegions to world failed!');
        }
    }, function () {
        // 加载完成
        callback();
        gLegionWar.setLastSyncTime(common.getTime());
    });
}

// 删除服务器注册数据
function cleanServerRegData(callback) {
    gDBRegister.remove({}, function(err){
        callback(err);
    });
}

// 获取注册的军团数据
function getRegedLegions(callback) {
    DEBUG('call getRegedLegions');
    gDBRegister.find({}).toArray(function(err,docs){
        if (err) {
            callback(err);
        } else {
            var regedLegions = [];
            docs.forEach(function(servRegData){
                regedLegions = regedLegions.concat(servRegData.legions);
            });
            callback(null, regedLegions);
        }
    });
}

// 军团数据缓存
var legionCache = {};

// 准备军团数据(处理报名数据)
function prepareLegionData(callback) {
    async.series([function(cb){ // 删除军团数据
        gDBLegion.remove({}, function(err){
            if (!err) {
                // 清除缓存
                legionCache = {};
                LOG('OLD DB LEGION DATA CLEARED');
            }
            cb(err);
        });
    }, function(cb) {   // 向所有服务器请求军团列表
        getMatchConditionLegions(cb);
    }, function(cb){ // 准备新的军团数据
        setTimeout(function () {
            getRegedLegions(function(err, legions){
                DEBUG('getRegedLegions callback');
                if (err) cb(err);
                else {
                    async.each(legions, function(legion, cb2){
                        legion._id = legion.lid;
                        gDBLegion.save(legion, function(err){
                            cb2(err);
                        });
                    }, function(err){
                        if (!err) {
                            LOG('NEW DB LEGION DATA PREPARED');
                        }
                        cb(err);
                    });
                }
            });
        }, 10000);
    }], function(err){
        callback(err);
    });
}

// 获取军团数据
function getLegion(lid, callback) {
    if (lid == Robot.conf.lid) {
        callback(null, Robot.conf);
        return;
    }

    if (legionCache.hasOwnProperty(lid)) {
        callback(null, legionCache[lid]);
    } else {
        gDBLegion.find({'_id': lid}).limit(1).next(function (err, doc) {
            if (err) callback(err);
            else {
                if (doc) {
                    legionCache[lid] = doc;
                    callback(null, legionCache[lid]);
                } else {
                    callback(ErrorCode.ERROR_NO_SUCH_LEGION, 'NO SUCH LEGION');
                }
            }
        });
    }
}

// 获取所有军团匹配数据
function getLegionMatchInfo(callback) {
    gDBLegion.find({}, {'_id':1, 'sid':1, 'lid':1, 'score': 1, 'fight_force': 1, 'members': 1}).toArray(function(err,docs){
        if (err) {
            callback(err);
        } else {
            callback(null, docs);
        }
    });
}

// 获取军团成员数据
function getLegionUsers(lid, uids, callback) {
    getLegion(lid, function(err, legion){
        if (err) callback(err);
        else {
            var users = [];

            for (var uid in legion.members) {
                if (uids.indexOf(+uid) != -1) {
                    users.push(legion.members[uid]);
                }
            }

            callback(null, users);
        }
    });
}

// 保存机器人军团数据
function saveRobot(callback) {
    gDBRobot.save({_id: 'robot', conf: Robot.conf}, function(err){
        if (err) {
            ERROR(util.format('%j', err));
            callback(ErrorCode.ERROR_DB_ERROR);
        } else {
            callback();
        }
    });
}

// 加载机器人军团数据
function loadRobot(callback) {
    gDBRobot.find({_id:'robot'}).toArray(function(err, docs){
        if (err) {
            callback(err);
        } else {
            if (docs && docs.length > 0) {
                Robot.conf = docs[0].conf;
            }
            callback();
        }
    });
}

// 保存军团战结果
function saveRoundResult(result, callback) {
    gDBHistory.save(result, function(err){
        if (err) {
            ERROR(util.format('%j', err));
            callback(ErrorCode.ERROR_DB_ERROR);
        } else {
            callback();
        }
    });
}

// 获取结果数据
function getRoundResult(round, callback) {
    gDBHistory.find({_id:round}).toArray(function(err,docs){
        if (err) {
            callback(err);
        } else {
            if (docs && docs.length > 0) {
                callback(null, docs[0]);
            } else {
                callback('NO ROUND RESULT DATA');
            }
        }
    });
}

// 获取历史数据
function getRoundHistory(callback) {
    gDBHistory.find({}).toArray(function(err,docs){
        if (err) {
            callback(err);
        } else {
            callback(null, docs);
        }
    });
}

// 保存排行榜
function saveRankList(result, callback) {
    gDBRankList.save({_id:'ranklist', data: result}, function(err){
        if (err) {
            ERROR(util.format('%j', err));
            callback(ErrorCode.ERROR_DB_ERROR);
        } else {
            callback();
        }
    });
}

// 获取排行榜数据
function getRankList(callback) {
    gDBRankList.find({_id:'ranklist'}).toArray(function(err,docs){
        if (err) {
            callback(err);
        } else {
            if (docs[0]) {
                callback(null, docs[0]['data']);
            } else {
                callback(null, { rank:[], legions:{} });
            }
        }
    });
}

exports.saveServerRegData = saveServerRegData;
exports.cleanServerRegData = cleanServerRegData;
exports.prepareLegionData = prepareLegionData;
exports.getLegion = getLegion;
exports.getLegionMatchInfo = getLegionMatchInfo;
exports.getLegionUsers = getLegionUsers;
exports.saveRobot = saveRobot;
exports.loadRobot = loadRobot;
exports.saveRoundResult = saveRoundResult;
exports.getRoundResult = getRoundResult;
exports.getRoundHistory = getRoundHistory;
exports.saveRankList = saveRankList;
exports.getRankList = getRankList;
