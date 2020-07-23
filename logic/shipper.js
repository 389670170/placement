exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'shipper')) {
        resp.code = 1; resp.desc = 'not open'; onHandled(); return;
    }

    // 请求场景的至多9个玩家镖车
    requestWorld(req, resp, function() {
        var finished = resp.data.finished;
        if (finished) {
            var awards = gConfShipperReward[finished.slevel]['award' + finished.type];
            if (finished.extra) {
                awards = timeAwards(awards, gConfGlobal.shipperExtra);
            }
            if (finished.rob) {
                awards = timeAwards(awards, 1 - finished.rob*gConfGlobal.shipperRobProportion);
            }

            if (isActivityStart(player, 'todaydouble')) {
                var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
                if (doubleConf) {
                    if (doubleConf.gateway1 == 'shipper' || doubleConf.gateway2 == 'shipper') {
                        awards = timeAwards(awards, 2, true);
                    }
                }
            }

            resp.data.awards = player.addAwards(awards,req.mod,req.act);

            user.shipper.type = 1;
            user.shipper.free = 1;
            player.markDirty('shipper.type');
            player.markDirty('shipper.free');
        }

        resp.data.shipper = user.shipper;
        onHandled();
    });
};

exports.get_reward = function(player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'shipper')) {
        resp.code = 1; resp.desc = 'not open'; onHandled(); return;
    }

    // 请求场景的至多9个玩家镖车
    requestWorld(req, resp, function() {
        var finished = resp.data.finished;
        if (finished) {
            var awards = gConfShipperReward[finished.slevel]['award' + finished.type];
            if (finished.extra) {
                awards = timeAwards(awards, gConfGlobal.shipperExtra);
            }
            if (finished.rob) {
                awards = timeAwards(awards, 1 - finished.rob*gConfGlobal.shipperRobProportion);
            }

            if (isActivityStart(player, 'todaydouble')) {
                var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
                if (doubleConf) {
                    if (doubleConf.gateway1 == 'shipper' || doubleConf.gateway2 == 'shipper') {
                        awards = timeAwards(awards, 2, true);
                    }
                }
            }
            resp.data.awards = player.addAwards(awards,req.mod,req.act);

            user.shipper.type = 1;
            user.shipper.free = 1;
            player.markDirty('shipper.type');
            player.markDirty('shipper.free');
        }
        onHandled();
    });
};

// 刷新可运送的镖车
exports.refresh = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shipper = user.shipper;
        var useCash  = req.args.use_cash;
        if (!useCash && !shipper.free) {
            resp.code = 1; resp.desc = "no free refresh"; break;
        }
        if (useCash && shipper.free) {
            resp.code = 1; resp.desc = "free now"; break;
        }

        var costs = [];
        if (useCash) {
            costs = [['user', 'cash', -gConfGlobal.shipperRefreshCash]];
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        if (!gConfShipper[shipper.type+1]) {
            resp.code = 1; resp.desc = "max quality"; break;
        }

        var weights = {};
        for (var id in gConfShipper) {
            if (gConfShipper[id].weight) {
                weights[id] = gConfShipper[id].weight;
            }
        }

        var newShipper = +common.wRand(weights);
        if (!shipper.first_refresh) {
            newShipper = 2;
            shipper.first_refresh = 1;
            player.markDirty('shipper.first_refresh');
        } else if (shipper.first_refresh == 1 && useCash) {
            newShipper = +gConfShipper.max;
            shipper.first_refresh = 2;
            player.markDirty('shipper.first_refresh');
        }

        // 每天第一次元宝刷新必出红
        if (!shipper.day_first && useCash) {
            newShipper = +gConfShipper.max;
            shipper.day_first = 1;
            player.markDirty('shipper.day_first');
        }

        // 只随机更好品质的
        if (newShipper < shipper.type) {
            newShipper = shipper.type;
        }

        //第一次免费比出蓝
        if (!useCash) {
            shipper.free = 0;
            newShipper = 2;
            player.markDirty('shipper.free');
        }else {
            shipper.exchangenum += gConfGlobal.perShipperCashAdd;
            player.markDirty('shipper.exchangenum');
        }

        if (newShipper != shipper.type) {
            shipper.type = newShipper;
            player.markDirty('shipper.type');
        }

        resp.data.shipper = shipper;

        resp.data.type = newShipper;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.exchange = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shipper = user.shipper;

        if (!gConfShipper[shipper.type+1]) {
            resp.code = 1; resp.desc = "max quality"; break;
        }

        if(shipper.exchangenum < gConfGlobal.shipperExchangeLimit){
            resp.code = 1; resp.desc = 'not reach condition'; break;
        }

        shipper.exchangenum -= gConfGlobal.shipperExchangeLimit;
        player.markDirty('shipper.exchangenum');
        shipper.type = +gConfShipper.max;
        player.markDirty('shipper.type');

        resp.data.shipper = shipper;

    } while (false);
    onHandled();
};
exports.delivery = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shipper = user.shipper;
        if (shipper.delivery >= gConfGlobal.shipperDeliveryCount) {
            resp.code = 1; resp.desc = "delivery count limit"; break;
        }

        // 良辰吉时
        var isExtraTime = 0;
        var noon = gConfGlobal.shipperNoon.split('-');
        var night = gConfGlobal.shipperNight.split('-');
        var hour = new Date().getHours();

        if ((hour >= noon[0] && hour < noon[1]) || (hour >= night[0] && hour < night[1])) {
            isExtraTime = 1;
        }

        var levels = Object.keys(gConfShipperReward).sort(function(c1, c2) { return +c1 > +c2 ? -1 : 1; });
        var userLevel = user.status.level;
        var slevel = levels[0];
        for (var i = 0, len = levels.length; i < len; i++) {
            if (userLevel >= levels[i]) {
                slevel = levels[i];
                break;
            }
        }

        req.args.slevel = slevel;
        req.args.type = shipper.type;
        req.args.extra = isExtraTime;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                shipper.delivery++;
                shipper.type = 1;
                shipper.free = 1;
                player.markDirty('shipper');
                player.getExchangePointsProgress('shipper', 1);

                var logConf = gConfPlayLog['play_hall']['shipper'];
                player.recordPlay(logConf.logType, logConf.logName);
                player.doDailyTask('shipper');

                resp.data.delivery = shipper.delivery;
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.delivery_immediate = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.status.vip < gConfGlobal.shipperSpeedVipLimit) {
            resp.code = 1; resp.desc = 'vip limit'; break;
        }

        var costs = [['user', 'cash', -gConfGlobal.shipperImmediate]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var finished = resp.data.finished;
                var awards = gConfShipperReward[finished.slevel]['award' + finished.type];
                if (finished.extra) {
                    awards = timeAwards(awards, gConfGlobal.shipperExtra);
                }
                if (finished.rob) {
                    awards = timeAwards(awards, 1 - finished.rob*gConfGlobal.shipperRobProportion);
                }

                if (isActivityStart(player, 'todaydouble')) {
                    var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
                    if (doubleConf) {
                        if (doubleConf.gateway1 == 'shipper' || doubleConf.gateway2 == 'shipper') {
                            awards = timeAwards(awards, 2, true);
                        }
                    }
                }
                resp.data.awards = player.addAwards(awards,req.mod,req.act);

                user.shipper.type = 1;
                user.shipper.free = 1;
                player.markDirty('shipper.type');
                player.markDirty('shipper.free');

                resp.data.costs = player.addAwards(costs,req.mod,req.act);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.rob = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shipper = user.shipper;
        if (shipper.rob >= gConfGlobal.shipperRobCount) {
            resp.code = 1; resp.desc = "rob count limit"; break;
        }

        if (shipper.rob_time && common.getTime() - shipper.rob_time < gConfGlobal.shipperRobCD * 60) {
            resp.code = 1; resp.desc = "rob cd"; break;
        }

        if (req.args.target == req.uid) {
            resp.code = 1; resp.desc = "rob yourself"; break;
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'prepare_shipper';
                player.memData.enemy_id = +req.args.target;

                player.memData.rand1 = resp.data.rand1;
                player.memData.rand2 = resp.data.rand2;
                player.memData.fight_info = resp.data.info;
                player.memData.fight_enemy = resp.data.enemy;

                var randPos = common.randRange(1, player.memData.pos_count);
                var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                resp.data.fight_time = player.memData.fight_time = common.getTime();
                resp.data.rand_pos = player.memData.rand_pos = randPos;
                resp.data.rank_attrs = player.memData.rand_attrs = randAttrs;
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.clear_rob_cd = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shipper = user.shipper;
        if (shipper.rob >= gConfGlobal.shipperRobCount) {
            resp.code = 1; resp.desc = "rob count limit"; break;
        }

        var costs = [['user', 'cash', -gConfGlobal.shipperClearRobCDCash]];;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        user.shipper.rob_time = 0;
        player.markDirty('shipper.rob_time');

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (!req.args.target) {
            resp.code = 1; resp.desc = "no target"; break;
        }

        if (player.memData.status != 'prepare_shipper') {
            resp.code = 1; resp.desc = "status error"; break;
        }

        if (req.args.target != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        var star = req.args.star;
        if ([0, 1, 2, 3].indexOf(star) == -1) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        // TODO 验证战斗
        //var report = parseFightReport(report, this.memData.rand);
        //if(!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if(!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        var team = req.args.team;
        if (team) {
            var valid = true;
            for (var pos in team) {
                var slot = Math.floor(team[pos]);
                if(!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if (!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }

            var pos = player.memData.fight_info.pos;
            for (var p in team) {
                pos[p].slot = Math.floor(team[p]);
                player.markDirty(util.format('pos.%d.slot', p));
            }
        }

        req.args.replay = {
            rand1: player.memData.rand1,
            rand2: player.memData.rand2,
            info: player.memData.fight_info,
            enemy: player.memData.fight_enemy,
        };
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var shipper = user.shipper;
                player.memData.status = 'idle'

                if (star > 0) {
                    var awards = gConfShipperReward[resp.data.slevel]['award' + resp.data.type];
                    if (resp.data.extra) {
                        awards = timeAwards(awards, gConfGlobal.shipperExtra);
                    }
                    awards = timeAwards(awards, gConfGlobal.shipperRobProportion);
                    resp.data.awards = player.addAwards(awards,req.mod,req.act);
                }

                shipper.rob++;
                shipper.rob_time = common.getTime();
                player.markDirty('shipper.rob');
                player.markDirty('shipper.rob_time');

                var logConf = gConfPlayLog['play_hall']['rob_shipper'];
                player.recordPlay(logConf.logType, logConf.logName);

                resp.data.rob = shipper.rob;
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_report = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'shipper')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};
