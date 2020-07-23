function updateField(player, guard, id) {
    var fieldSync = guard.field_sync[id];
    if (!fieldSync.time) {
        return;
    }

    var isMessBefore = false;
    if (fieldSync.status == 3) {
        var isMessBefore = true;
    }

    // 每半个小时产出一次奖励
    var now = common.getTime();
    var beginTime = fieldSync.time;
    var endTime = beginTime + gConfGlobal['guardHourType' + fieldSync.type] * 3600;
    var isEnd = false;
    if (endTime > now) {
        endTime = now;
    } else {
        isEnd = true;
    }

    var field = guard.field[id];
    var allEventCount = Math.floor((endTime-beginTime)/gConfGlobal.guardProduceIntervalTime);
    var count = allEventCount - field.events.length;
    if (count) {
        var conf = gConfGuard[id];
        var weights = {};
        for (var event in conf) {
            if (conf[event].type != 'mess' || !isMessBefore) {
                weights[event] = conf[event].weight;
            }
        }

        var isMess = false;
        var critProb = gConfGuardSkill[id][field.skill].prob;
        for (var i = 0; i < count; i++) {
            common.seed(beginTime + field.events.length);
            var event = [+common.wRand(weights, true), 0];

            if (conf[event[0]].type == 'mess') {
                isMess = true;
                weights[event[0]] = 0;
            }

            if (!isMess && Math.random() * 100 < critProb) {
                event[1] = 1; // 几率翻倍
            }

            field.events.push(event);

            if (!gConfItem[field.hid]) {
                continue;
            }

            var expectFragment = (field.events.length-1)*gConfGlobal.guardIntervalFragment;
            if (field.fragment < expectFragment) {
                field.fragment = Math.floor(expectFragment);
                if (Math.random() < expectFragment % 1) {
                    field.fragment++;
                }
                player.markDirty(util.format('guard.field.%d.fragment', id));
            }
        }

        player.markDirty(util.format('guard.field.%d.events', id));

        if (isEnd) {
            fieldSync.status = 0;
            player.markDirty(util.format('guard.field_sync.%d.status', id));
        } else if (isMess) {
            fieldSync.status = 2;
            player.markDirty(util.format('guard.field_sync.%d.status', id));
        }

    }
}

// 获取更新所有领地状态
exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        var guard = user.guard;
        for (var id in guard.field) {
            updateField(player, guard, id);
        }

        var retGuard = {
            'field': {},
            'accumulate': guard.accumulate,
            'repress': guard.repress,
            'free_hour': guard.free_hour,
            'repress_list': guard.repress_list,
        };

        var fields = guard.field;
        var fieldsSync = guard.field_sync;
        for (var id in guard.field) {
            var fieldSync = fieldsSync[id];
            retGuard.field[id] = {
                'type': fieldSync.type,
                'status': fieldSync.status,
                'time': fieldSync.time,
                'hid': fields[id].hid,
                'fragment': fields[id].fragment,
                'skill': fields[id].skill,
                'events': fields[id].events,
            };
        }

        resp.data.guard = retGuard;
    } while (false);

    onHandled();
};

// 获取军团成员领地状态列表
exports.get_member_list = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = "not open legion"; break;
        }

        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

exports.before_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        var fieldConf = gConfGuardField[id];
        if (!fieldConf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (user.status.level < gConfGuardField[id].level) {
            resp.code = 1; resp.desc = 'level not reached'; break;
        }

        if (user.guard.field[id]) {
            resp.code = 1; resp.desc = 'alread fighted'; break;
        }

        if (id-1 !=0 && !user.guard.field[id-1]) {
            resp.code = 1; resp.desc = 'previous locked'; break;
        }

        var rand = Math.floor(common.randRange(100000, 999999));
        player.memData.rand = rand;
        player.memData.fight_time = common.getTime();
        player.memData.status = 'fight_guard';

        resp.data.rand = rand;
    } while (false);

    onHandled();
};

exports.fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        var fieldConf = gConfGuardField[id];
        if (!fieldConf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (user.status.level < gConfGuardField[id].level) {
            resp.code = 1; resp.desc = 'level not reached'; break;
        }

        if (user.guard.field[id]) {
            resp.code = 1; resp.desc = 'already fighted'; break;
        }

        if (player.memData.status != 'fight_guard') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        // TODO 验证战斗

        // 解锁领地
        if (req.args.star > 0) {
            user.guard.field[id] = {
                'hid': 0,
                'events': [],
                'fragment': 0,
                'skill': 0,
            };
            user.guard.field_sync[id] = {
                'type': 0,
                'status': 0,
                'time': 0,
            };
            player.markDirty('guard.field.' + id);
            player.markDirty('guard.field_sync.' + id);

            resp.data.awards = player.addAwards(gConfGuardMonster[id].award,req.mod,req.act);
        }
    } while (false);

    onHandled();
};

// 开始巡逻
exports.guard = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        var hid = +req.args.hid;
        var valid = false;
        for (var pos in user.pos) {
            if (user.pos[pos].hid == hid) {
                valid = true; break;
            }
        }
        if (hid == 10000) {
            resp.code = 1; resp.desc = "fate card"; break;
        }

        if (!valid && user.bag.card[hid] > 0) {
            valid = true;
        }

        var guard = user.guard;
        var fields = guard.field;
        if (valid) {
            for (var id in fields) {
                if (fields[id].hid == hid) {
                    valid = false; break;
                }
            }
        }

        if (!valid) {
            resp.code = 1; resp.desc = 'invalid hid'; break;
        }

        var hour = +gConfGlobal['guardHourType' + req.args.type];
        if (!hour) {
            resp.code = 1; resp.desc = 'invalid type'; break;
        }


        var id = req.args.id;
        var field = fields[id];
        if (!field) {
            resp.code = 1; resp.desc = 'no such field'; break;
        }

        var fieldSync = guard.field_sync[id];
        if (fieldSync.time) {
            resp.code = 1; resp.desc = 'already guard'; break;
        }

        var soulCost = 0;
        var freeHours = -guard.free_hour;
        for (var fid in fields) {
            freeHours += gConfGuardField[fid].free;
        }

        if (freeHours > 0) {
            if (freeHours < hour) {
                soulCost = (hour - freeHours) * gConfGlobal.guardSoulCostPerHour;
            }
        } else {
            soulCost = hour * gConfGlobal.guardSoulCostPerHour;
        }

        var costs = [['user', 'soul', -soulCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough soul'; break;
        }

        player.doDailyTask('patrol', hour);

        if (freeHours > 0) {
            if (freeHours > hour) {
                guard.free_hour += hour;
            } else {
                guard.free_hour = freeHours + guard.free_hour;
            }
            player.markDirty('guard.free_hour');
        }

        fieldSync.type = req.args.type;
        fieldSync.status = 1;
        fieldSync.time = common.getTime();
        player.markDirty(util.format('guard.field_sync.%d', id));

        field.hid = hid;
        player.markDirty(util.format('guard.field.%d.hid', id));

        var retField = clone(field);
        retField.type = fieldSync.type;
        retField.status = fieldSync.status;
        retField.time = fieldSync.time;

        resp.data.field = retField;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

        var logConf = gConfPlayLog['play_hall']['guard'];
        player.recordPlay(logConf.logType, logConf.logName);
    } while (false);

    onHandled();
};

// 领奖
exports.get_reward = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        var id = req.args.id;
        var guard = user.guard;
        var field = guard.field[id];
        if (!field) {
            resp.code = 1; resp.desc = 'have no field'; break;
        }

        var now = common.getTime();
        var fieldSync = guard.field_sync[id];
        var duration = gConfGlobal['guardHourType' + fieldSync.type] * 3600;
        var endTime = fieldSync.time + duration;
        if (now < endTime) {
            resp.code = 1; resp.desc = 'not finished'; break;
        }

        updateField(player, guard, id);

        guard.accumulate += +gConfGlobal['guardHourType' + fieldSync.type] || 0;
        player.markDirty(util.format('guard.accumulate'));

        guard.day_accumulate += +gConfGlobal['guardHourType' + fieldSync.type];
        player.markDirty(util.format('guard.day_accumulate'));


        var awards = [];
        var conf = gConfGuard[id];
        for (var i = 0, len = field.events.length; i < len; i++) {
            var event = field.events[i];
            if (event[1]) {
                awards.combine(timeAwards(conf[event[0]].award, 2));
            } else {
                awards.combine(conf[event[0]].award);
            }
        }

        awards.push(['fragment', field.hid, field.fragment]);

        fieldSync.type = 0;
        fieldSync.time = 0;
        player.markDirty('guard.field_sync.' + id);

        field.hid = 0;
        field.events = [];
        field.fragment = 0;
        player.markDirty('guard.field.' + id);

        requestWorld(req, resp, function() {
            if (resp.data.repress) {
                for (var event in conf) {
                    if (conf[event].type == 'repress') {
                        awards.combine(conf[event].award);
                        break;
                    }
                }
            }

            if (isActivityStart(player, 'todaydouble')) {
                var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
                if (doubleConf) {
                    if (doubleConf.gateway1 == 'patrol' || doubleConf.gateway2 == 'patrol') {
                        awards = timeAwards(reformAwards(awards), 2, true);
                    }
                }
            }

            var jadeId = gConfJadeSeal.guard[0];
            var addPer = gConfJadeSeal.guard[1];
            if (user.jade_seal[jadeId]) {
                awards = timeAwards(reformAwards(awards), (1+addPer));
            }
            resp.data.awards = player.addAwards(awards,req.mod,req.act);

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 升级技能
exports.upgrade_skill = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        var id = req.args.id;
        var guard = user.guard;
        var field = guard.field[id];
        if (!field) {
            resp.code = 1; resp.desc = 'have no field'; break;
        }

        var conf = gConfGuardSkill[id][field.skill + 1];
        if (!conf) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var costs = conf.costs;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        if (guard.accumulate < conf.need) {
            resp.code = 1; resp.desc = 'not enough hour'; break;
        }

        field.skill++;
        player.markDirty(util.format('guard.field.%d.skill', id));

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

// 镇压
exports.repress = function(player, req, resp, onHandled) {
    do {
        if (!isModuleOpen_new(player, 'patrol')) {
            resp.code = 1; resp.desc = "not open"; break;
        }

        var tarUid = Math.floor(req.args.target);
        if (!tarUid) {
            resp.code = 1; resp.desc = "no target"; break;
        }

        var id = req.args.id;
        if (!gConfGuard[id]) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var guard = player.user.guard;
        if (guard.repress >= gConfGlobal.guardRepressLimitEachDay) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        guard.repress_list[tarUid] = 1;
        player.markDirty('guard.repress_list.' + tarUid);

        guard.repress++;
        player.markDirty('guard.repress');

        var logConf = gConfPlayLog['play_hall']['repress_guard'];
        player.recordPlay(logConf.logType, logConf.logName);

        resp.data.awards = player.addAwards(gConfGuardField[id].repressAward,req.mod,req.act);
    } while (false);

    onHandled();
};
