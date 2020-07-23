function Guard() {
    this.guard = {                  // 这里只记录镇压
    };

}

Guard.create = function(callback) {
    var guardData = {
        '_id': 'guard',
        'guard': {},
    };

    gDBWorld.insert(guardData, function(err, result) {
        callback && callback();
    });
};

Guard.prototype = {
    init: function(callback) {
        this.guard = {};
        callback && callback(true);
    },

    save: function(callback) {
        gDBWorld.save({'_id': 'guard', guard : this.guard}, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },
};

exports.get_reward = function(req, res, resp) {
    var represses = gGuard.guard[req.uid];
    if (represses && represses[req.args.id]) {
        resp.data.repress = 1;
        delete represses[req.args.id];
    }

    onReqHandled(res, resp, 1);
};

exports.get_member_list = function(req, res, resp) {
    do {
        var lid = gNewLegion.userLegion[req.uid];
        if (!lid) {
            resp.code = 1; resp.desc = 'not join legion'; break;
        }

        var retList = {};
        var legion = gNewLegion.get(lid);
        for (var uid in legion.members) {
            if (uid == req.uid) {
                continue;
            }

            var user = gUserInfo.getUser(uid);
            var heroCombatConf = getHeroCombatConf(user.pos[1].hid);
            var retUser = retList[uid] = {
                'un': user.info.un,
                'headpic': user.info.headpic,
                'headframe' : user.info.headframe,
                'quality': heroCombatConf.quality,
                'level': user.status.level,
                'field': user.guard.field_sync,
            };
        }

        resp.data.list = retList;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.Guard = Guard;
