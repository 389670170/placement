function Tips() {
    this.tips = {
        /*
        uid : {
            arena_report : 0,
            ww_report : 0,
            shipper_report : 0,
            country_report : 0,
            exploit_wall : 0,
            legion_wish : 0,
        }
        */
    };
    this.time = 0;
    this.updates = {};
}

Tips.create = function(callback) {
    var tipsData = {
        '_id' : 'tips',
        'tips' : {},
        'time' : 0,
    };

    gDBWorld.insert(tipsData, function(err, result){
        callback && callback();
    });
};

Tips.prototype = {
    init : function(callback) {
        gDBWorld.find({_id : 'tips'}).limit(1).next(function(err, doc) {
            if(doc) {
                this.tips = doc.tips;
                this.time = doc.time;
                callback && callback(true);
            }else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save : function(callback) {
        if (Object.keys(this.updates).length) {
            gDBWorld.update({_id: 'tips'}, {'$set': this.updates}, function(err, result) {
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

    addTip : function(uid, type) {
        if(!this.tips[uid]) {
            this.tips[uid] = {};
        }
        if(!this.tips[uid][type]) {
            this.tips[uid][type] = 1;
            this.markDirty(uid);
        }
    },

    getTips : function(uid) {
        if(!this.tips[uid] || Object.keys(this.tips[uid]).length == 0) {
            return {};
        }
        var tips = this.tips[uid];
        this.tips[uid] = {};
        this.markDirty(uid);
        return tips;
    },

    resetTipType : function(uid ,type){
        if(!this.tips[uid] || Object.keys(this.tips[uid]).length == 0) {
            return;
        }

        if(this.tips[uid][type]) {
            delete this.tips[uid][type];
            this.markDirty(uid);
        }
    },

    markDirty : function(uid) {
        if (uid == 'time') {
            this.updates['time'] = this.time;
        } else {
            this.updates['tips.' + uid] = this.tips[uid];
        }
    },

    resetByWeek : function() {
        var weekResetTime = getWeekResetTime();
        if (this.time < weekResetTime) {
            this.time = weekResetTime;
            for(var uid in this.tips) {
                if(this.tips[uid].ww_report) {
                    delete this.tips[uid].ww_report;
                    this.markDirty(uid);
                }
            }
        }
    },
};

exports.add_tip = function(req, res, resp) {
    gTips.addTip(req.uid, req.args.type);
    onReqHandled(res, resp, 1);
}

exports.Tips = Tips;
