function Replay() {
    this.id = 1;
    this.count = 0;
}

Replay.create = function(callback) {
    gDBWorld.save({_id:'_replay_autoid', ai:1}, function(err, result){
        if (err) {
            ERROR('_replay_autoid create error');
            process.exit(-1);
        }
        callback && callback();
    });
}

Replay.prototype = {
    init : function(callback) {
        gDBWorld.find({_id: '_replay_autoid'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.id = doc.ai;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save : function(callback) {
        gDBWorld.update({_id: '_replay_autoid'}, {$set:{ai:this.id}}, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    addReplay : function(replay) {
        this.count += 1;
        this.id += 1;
        if (this.count > 100) {
            this.count = 0;
            gDBWorld.update({_id: '_replay_autoid'}, {$set:{ai:this.id}}, function(err, doc){});
        }

        var replayKey = util.format('replay_%d_%d', config.ServerId, this.id);
        gCache.set(replayKey, JSON.stringify(replay));

        return replayKey;
    },

    getReplay : function(replayKey, callback) {
        gCache.get(replayKey, function(err, doc) {
            callback && callback(err ? null : JSON.parse(doc));
        });
    },

    deleteReplay : function(replayKey) {
        gCache.del(replayKey);
    },

    updateReplay : function(replayKey, replay) {
        gCache.set(replayKey, JSON.stringify(replay));
    },
}

exports.get = function( req, res, resp) {
    gReplay.getReplay(req.args.id, function(replay){
        if (replay) {
            resp.data = replay;
        } else {
            resp.code = 1; resp.desc = 'no such replay';
        }
        onReqHandled(res, resp, 1);
    });
}

exports.Replay = Replay;
