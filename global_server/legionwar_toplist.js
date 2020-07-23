/**
 * 军团战全局排行榜(军团段位排行)
 */

function LegionWarTopList() {
    this.topList = null;            // 排行榜

    this.legions = {
        /*
            军团ID: {
                lid:        军团ID
                score:      军团积分
                icon:       军团图标
                name:       军团名字
                sid:        军团服务器ID
            }
         */
    };
}


LegionWarTopList.create = function(callback) {
    var guardData = {
        '_id': 'legionwar_toplist',
        'legions': {},
    };

    gDBWorld.insert(guardData, function(err, result) {
        callback && callback();
    });
};

LegionWarTopList.prototype = {
    init: function (callback) {
        gDBWorld.find({_id: 'legionwar_toplist'}).limit(1).next(function (err, doc) {
            if (doc) {
                this.legions = doc.legions;
                this.topList = new TopList(gCache, 'legionwar_toplist');
                // 初始化排行榜
                this.topList.clear(function(err){
                    if (err) {
                        ERROR(err);
                        callback && callback(false);
                    } else {
                        var reqArr = [];
                        for (var legionId in this.legions) {
                            if (!this.legions.hasOwnProperty(legionId)) {
                                continue;
                            }
                            reqArr.push(+this.legions[legionId].score);
                            reqArr.push(+legionId);
                        }
                        if (reqArr.length != 0) {
                            this.topList.adds(reqArr, function(err){
                                if (err) ERROR(err);
                                callback && callback(err ? false : true);
                            })
                        } else {
                            callback && callback(true);
                        }
                    }
                }.bind(this));
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function (callback) {
        gDBWorld.save({'_id': 'legionwar_toplist', legions: this.legions}, function (err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    /**
     * 添加军团到排行榜或更新军团数据
     * @param legion
     * @param callback
     */
    add: function(legion, callback) {
        var oldScore = -1;
        if (this.legions.hasOwnProperty(legion.lid)) {
            oldScore = this.legions[legion.lid].score;
        }

        // 更新数据
        this.legions[legion.lid] = legion;

        // 更新排名
        if (oldScore != legion.score) {
            this.topList.add(legion.score, legion.lid, function(err){
                callback && callback(err);
            });
            return;
        }
        callback && callback();
    },

    /**
     * 取排名
     * @param lid           玩家军团ID
     * @param size          排名数量
     * @param callback
     */
    getRanks: function(lid, size, callback) {
        if (size == 0) size = 1;

        // 排行榜没有该军团数据
        if (!this.legions.hasOwnProperty(lid)) {
            callback && callback('legion not in top list');
            return;
        }

        // 获取玩家军团排名
        this.topList.getRank(lid, function(err, rank){
            if (err) {
                callback && callback(err);
            } else {
                // 获取前几名的军团ID
                this.topList.getRange(0, size - 1, function(err, ranks){
                    if (err) {
                        callback && callback(err);
                    } else {

                        // 构造前几名军团数据
                        for (var key in ranks) {
                            if (!ranks.hasOwnProperty(key)) {
                                continue;
                            }

                            var rankLid = +ranks[key];
                            ranks[key] = this.legions[rankLid] || null;
                        }

                        // 玩家军团数据
                        var userRank = clone(this.legions[lid]);
                        userRank.rank = rank;
                        ranks.push(userRank);

                        callback && callback(null, ranks);
                    }
                }.bind(this));
            }
        }.bind(this));
    }
};
exports.LegionWarTopList = LegionWarTopList;


exports.add = function(req, res, resp) {
    do {
        if (!req.args.legion) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        gLegionWarTopList.add(req.args.legion, function(err){
            if (err) {
                resp.code = 1; resp.desc = util.format('%j', err);
            }
            onReqHandled(res, resp, 1);
        });
        return;
    } while (false);
    onReqHandled(res, resp, 1);
};

exports.getRanks = function(req, res, resp) {
    do {
        var lid = +req.args.lid;
        var size = +req.args.size;

        if (isNaN(lid) || isNaN(size)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        gLegionWarTopList.getRanks(lid, size, function(err, ranks){
            if (err) {
                resp.code = 1; resp.desc = util.format('%j', err);
            } else {
                resp.data.ranks = ranks;
            }
            onReqHandled(res, resp, 1);
        });
        return;
    } while (false);
    onReqHandled(res, resp, 1);
};
