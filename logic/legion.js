exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    req.args.own = user.legion.wish.own;
    req.args.give = user.legion.wish.give;
    requestWorld(req, resp, function() {
        if (resp.data.legion) {
            player.doTask('legionMember', 1);
            player.doOpenSeven('legionMember', 1);
            player.doOpenHoliday('legionMember', 1);
            player.memData.legion_id = resp.data.legion.lid;
            player.memData.legion_name = resp.data.legion.name;
            player.memData.legion_level = resp.data.legion.level;
            player.memData.legion_war_level = resp.data.legionWarLevel;
            player.memData.legion_icon = resp.data.legion.icon;
            updateWssData(req.uid, {lid : player.memData.legion_id});

            // FIXME 如果佣兵数据发生同步错误, 则手动删除佣兵
            var legionMercenary = resp.data.mercenary;
            for (var hid in user.legion.mercenary) {
                if (!legionMercenary || !legionMercenary.hasOwnProperty(hid)) {
                    delete user.legion.mercenary[hid];
                    player.markDelete('legion.mercenary.' + hid);
                }
            }
        } else if (resp.data.legions) {
            // 被踢出军团, 刷新离开军团时间
            if (resp.data.leave_time) {
                user.legion.leave_time = resp.data.leave_time;
                player.markDirty('legion.leave_time');
            } else {
                resp.data.leave_time = user.legion.leave_time;
            }

            // 不在军团，清除军团佣兵
            if (Object.keys(user.legion.mercenary) > 0) {
                user.legion.mercenary = {};
                player.markDirty('legion.mercenary');
            }
        }
        onHandled();
    });
};

exports.get_hall = function (player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

exports.impeachment = function (player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

exports.create = function (player, req, resp, onHandled) {
    var user = player.user;
    var doFirst = false;
    var costs = [];
    do{
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var name = req.args.name;
        var icon = req.args.icon;

        if (!name || isNaN(icon)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (name.legnth <= 0) {
            resp.code = 1; resp.desc = 'name is empty'; break;
        }

        if (name.length > gConfLegion.legionNameMax) {
            resp.code = 1; resp.desc = 'name is too long'; break;
        }

        var invalidWord = false;
        for (var i = 0; i < name.length; i++) {
            if (!name.isChineseWord(i) && !name.isDigit(i) && !name.isEnglishWord(i)) {
                invalidWord = true;
                break;
            }
        }
        if (invalidWord) {
            resp.code = 100; resp.desc = 'fucking name'; break;
        }

        if (icon <= 0 || icon > gConfLegion.legionIconNum) {
            resp.code = 1; resp.desc = 'icon id error'; break;
        }

        if ((user.status.vip >= gConfLegion.legionCreateVip) && (user.mark.first_create_legion == 1)) {
            doFirst = true;
        } else {
            costs = [['user', 'cash', -(+gConfLegion.legionCreateCost)]];
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'no enugh cash'; break;
            }
        }


    } while(false);

    if (resp.code != 0) {
        onHandled();
        return;
    }

    requestWorld(req, resp, function(){
        if(resp.code == 0) {
            if (doFirst) {
                // 修改首次创建标记
                user.mark.first_create_legion = 0;
                player.markDirty('mark.first_create_legion');
            } else {
                // 扣除玩家元宝
                resp.data.costs = player.addAwards(costs,req.mod,req.act);
            }

            player.doTask('legionMember', 1);
            player.memData.legion_id = resp.data.legion.lid;
            player.memData.legion_name = resp.data.legion.name;
            player.memData.legion_level = resp.data.legion.level;
            player.memData.legion_war_level = 0;
            player.memData.legion_icon = resp.data.legion.icon;
            updateWssData(req.uid, {lid : player.memData.legion_id});
        }
        onHandled();
    });
};

exports.search = function (player, req, resp, onHandled) {
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

exports.join = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if ((common.getTime() - user.legion.leave_time) < gConfLegion.joinTimeLimit) {
             resp.code = 1; resp.desc = 'time limit'; break;
        }

        req.args.level = user.status.level;
    } while(false);

    if (resp.code != 0) {
        onHandled();
        return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            if (resp.data.legion) {
                player.doTask('legionMember', 1);
                player.memData.legion_id = resp.data.legion.lid;
                player.memData.legion_name = resp.data.legion.name;
                player.memData.legion_level = resp.data.legion.level;
                player.memData.legion_war_level = resp.data.legion.war_level;
                player.memData.legion_icon = resp.data.legion.icon;
                updateWssData(req.uid, {lid : player.memData.legion_id});
            }
        }
        onHandled();
    });
};

exports.approve = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.reject = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.revoke_request = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.applicant_list = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.exit = function (player, req, resp, onHandled) {
    var timeGold = 0;
    var user = player.user;
    var now = common.getTime();
    for (var hid in user.legion.mercenary) {
        var level = 0;
        for (var p in user.pos) {
            if (user.pos[p].hid == hid) {
                level = user.pos[p].level; break;
            }
        }
        if (!level) continue;
        timeGold += getMercenaryTimeGold(now, user.legion.mercenary[hid], hid, level);
    }
    req.args.time_gold = timeGold;

    requestWorld(req, resp, function(){
        if (resp.code == 0) {
            player.user.legion.leave_time = now;
            player.markDirty('legion.leave_time');
            player.user.legion.mercenary = {};
            player.markDirty('legion.mercenary');
            player.user.legion.castle_loser = [];
            player.markDirty('legion.castle_loser');
            player.user.legion.castle_occupy = 0;
            player.markDirty('legion.castle_occupy');
            player.user.legion.castle_rescue = 0;
            player.markDirty('legion.castle_rescue');
            resp.data.leave_time = now;
            player.memData.legion_id = 0;
            updateWssData(req.uid, {lid : 0});
        }

        onHandled();
    });
};

exports.kick = function (player, req, resp, onHandled) {
    var tarUid = req.args.uid;
    if(!tarUid || isNaN(tarUid)) {
        resp.code = 1; resp.desc = 'no uid';
        onHandled();
        return;
    }

    // 强制同步要被踢出的玩家的数据到world服
    forceSyncToWorld(tarUid, function() {
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                // TODO 此处设计需要优化
                gPlayers.get(tarUid, function(tarPlayer) {
                    if(tarPlayer) {
                        tarPlayer.user.legion.castle_loser = [];
                        tarPlayer.markDirty('legion.castle_loser');
                        tarPlayer.user.legion.castle_occupy = 0;
                        tarPlayer.markDirty('legion.castle_occupy');
                        tarPlayer.user.legion.castle_rescue = 0;
                        tarPlayer.markDirty('legion.castle_rescue');
                    }
                });
            }
            onHandled();
        });
    });
};

exports.appoint = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.setting = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var uid = req.uid;
        var icon = req.args.icon;
        var type = req.args.type;
        var levelLimit = req.args.level_limit;

        if (isNaN(icon) || isNaN(type) || isNaN(levelLimit)) {
            resp.code = 1; resp.desc = 'args err'; break;
        }

        icon = Math.round(icon);
        type = Math.round(type);
        levelLimit = Math.round(levelLimit);

        if (!gConfLegionIcon[icon]) {
            resp.code = 1; resp.desc = 'icon id error'; break;
        }

        // 公会类型校验
        if (type != 0 && type != 1 && type != 2) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        // 公会加入限制等级
        if (levelLimit < gConfLegion.legionOpenLevel || levelLimit > gMaxUserLevel) {
            resp.code = 1; resp.desc = 'level limit error'; break;
        }

        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

exports.set_notice = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var uid = req.uid;
        var notice = req.args.notice;

        // 公会公告 校验
        if (notice.length > gConfLegion.legionNoticeMax) {
            resp.code = 1; resp.desc = 'notice is too long'; break;
        }

        if (notice.indexOf('$') >= 0 || notice.indexOf('.') >= 0) {
            resp.code = 1; resp.desc = '$ or . in notice'; break;
        }
    } while (false);

    if (resp.code != 0) {
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

exports.get_log = function(player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.invite = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var now = common.getTime();
        if (user.legion.invite_time + gConfLegion.legionHeadSendInvitationTime > now) {
            resp.code = 1; resp.desc = 'cooling down'; break;
        }

        var costs = [];
        if (req.args.type == 'shout') {
            costs.push(['material', gConfGlobal.shoutCostId, -1]);
            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = 'material not enough'; break;
            }
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var wssReq = clone(req);
                wssReq.mod = 'chat';
                wssReq.act = 'chat';
                wssReq.args.type = req.args.type;
                wssReq.args.sub_type = 'legion_invite';
                wssReq.args.content = resp.data.content;
                wssReq.args.info = resp.data.info;
                requestWss(wssReq, resp, function() {
                    if (resp.code == 0) {
                        resp.data.costs = player.addAwards(costs,req.mod,req.act);
                    }
                    onHandled();
                });
                return;
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.rank_list = function(player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

// 使用红包
exports.use_boon = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(req.args.type != 0 && req.args.type != 1) {
            resp.code = 1; resp.desc = 'type error'; break;
        }
        var costs = [['user', 'boon', -1]];
        if(!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'no boon'; break;
        }

        var count = 1;
        if(req.args.type == 1) {
            count = 10;
            if(user.status.boon < 10) {
                count = user.status.boon;
            }
            costs[0][2] = -count;
        }

        var awards = [];
        for(var i = 0; i < count; i++) {
            awards.combine(generateDrop(gConfLegion.boonDropId, user.status.level));
        }
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);

        var logConf = gConfPlayLog['legion']['boon'];
        player.recordPlay(logConf.logType, logConf.logName);

        // 发红包
        req.args.count = count;
        requestWorld(req, resp);
    } while(false);

    onHandled();
}

// 抢红包
exports.grab_boon = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        if (user.legion.grab_boon >= gConfGlobal.grabBoonPerDay) {
            resp.code = 1; resp.desc = 'max grab count'; break;
        }

        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                var count = resp.data.count;
                user.legion.grab_boon += count;
                player.markDirty('legion.grab_boon');

                var logConf = gConfPlayLog['legion']['grab_boon'];
                player.recordPlay(logConf.logType, logConf.logName);

                var awards = [];
                for(var i = 0; i < count; i++) {
                    awards.combine(generateDrop(gConfLegion.boonDropId, user.status.level));
                }
                resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
}

// 进入摇钱树
exports.get_gold_tree = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                resp.data.shake_tree = user.legion.shake_tree;
                resp.data.shake_time = user.legion.shake_time;
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
}

// 摇摇钱树
exports.shake_tree = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var legion = user.legion;
        if (legion.shake_tree >= gConfLegion.shakeGoldTreeCount) {
            resp.code = 1; resp.desc = 'max shake count'; break;
        }

        var now = common.getTime();
        if (now-legion.shake_time < gConfLegion.shakeGoldTreeInterval*60) {
            resp.code = 1; resp.desc = 'colding'; break;
        }

        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                var level = resp.data.level;
                var gold = gConfLegionLevel[level].goldAwardCount;
                var awards = [['user', 'gold', gold]];
                resp.data.awards = player.addAwards(awards,req.mod,req.act);

                var logConf = gConfPlayLog['legion']['tree'];
                player.recordPlay(logConf.logType, logConf.logName);

                player.doDailyTask('tree', 1);

                legion.shake_tree++;
                legion.shake_time = now;
                player.markDirty('legion.shake_tree');
                player.markDirty('legion.shake_time');
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
}

// 打开佣兵
exports.mercenary = function(player, req, resp, onHandled) {
    var user = player.user;
    req.args.mercenary = user.legion.mercenary;
    requestWorld(req, resp, function() {
        if(resp.code == 0) {
            var mercenaries = resp.data.mercenaries;
            if(!mercenaries) {
                resp.data.mercenaries = {};
            }else {
                var now = common.getTime();
                for(var hid in mercenaries) {
                    // 玩家没有派出此武将
                    var mercenary = user.legion.mercenary[hid];
                    if (!mercenary) {
                        ERROR('not equal to world mercenary ' + hid);
                        continue;
                    }

                    var level = 0;
                    for(var p in user.pos) {
                        if(user.pos[p].hid == hid) {
                            level = user.pos[p].level; break;
                        }
                    }

                    // TODO : debug here
                    if(!level) {
                        ERROR('mercenary error, not in pos ' + hid);
                        delete mercenaries[hid];
                        continue;
                    }

                    mercenaries[hid] = {
                        time_gold : getMercenaryTimeGold(now, mercenary, hid, level),
                        hire_gold : mercenaries[hid],
                        duration : now-mercenary.send_time,
                    };
                }
            }
        }
        onHandled();
    });
};

// 派出佣兵
exports.send_mercenary = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.pos || !user.pos[req.args.pos]) {
            resp.code = 1; resp.desc = 'no pos'; break;
        }
        var hid = user.pos[req.args.pos].hid;
        if (!hid) {
            resp.code = 1; resp.desc = 'pos error'; break;
        }

        if (gConfHero[hid].camp == 5) {
            resp.code = 1; resp.desc = 'cannot send major'; break;
        }

        if (user.legion.mercenary[hid]) {
            resp.code = 1; resp.desc = 'has send'; break;
        }

        var mercenaryCount = Object.keys(user.legion.mercenary).length;
        if (mercenaryCount >= gConfVip[user.status.vip].mercenary) {
            resp.code = 1; resp.desc = 'max mercenary'; break;
        }

        req.args.hid = hid;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                user.legion.mercenary[hid] = {
                    send_time : common.getTime(),
                    upgrade_time : 0,
                    time_gold : 0,
                };
                player.markDirty('legion.mercenary.'+hid);

                player.doDailyTask('trial', 1);

                var logConf = gConfPlayLog['legion']['mercenary'];
                player.recordPlay(logConf.logType, logConf.logName);
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

// 召回佣兵
exports.recall_mercenary = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(!req.args.hid || isNaN(req.args.hid)) {
            resp.code = 1; resp.desc = 'no hid'; break;
        }

        var hid = req.args.hid;
        if(!user.legion.mercenary[hid]) {
            resp.code = 1; resp.desc = 'not mercenary'; break;
        }

        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                var level = 0;
                for(var p in user.pos) {
                    if(user.pos[p].hid == hid) {
                        level = user.pos[p].level; break;
                    }
                }

                if(!level) {
                    ERROR('mercenary error ' + hid);
                    delete user.legion.mercenary[hid];
                    player.markDelete('legion.mercenary.'+hid);
                    onHandled();
                    return;
                }

                var timeGold = getMercenaryTimeGold(common.getTime(),
                        user.legion.mercenary[hid], hid, level);
                var hireGold = resp.data.hire_gold;

                if(timeGold > 0 || hireGold > 0)
                resp.data.awards = player.addAwards([['user', 'gold', timeGold+hireGold]],req.mod,req.act);

                delete user.legion.mercenary[hid];
                player.markDelete('legion.mercenary.'+hid);
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.trial_get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        resp.data.trial_count = user.legion.trial_count;
        resp.data.trial_star = user.legion.trial_star;

        if (user.legion.trial_count < gConfLegion.legionTrialMaxCount) {
            var maxFF = user.mark.max_fight_force_no_extra;
            var hardLevel = +gConfLegion['legionTrialLevel' + (user.legion.trial_count + 1)];
            var robotFF = maxFF * hardLevel;

            // 生成阵容数据
            var fightInfo = randomPosObj(gConfLegionRobot,
                Object.keys(user.pos).length, // 上阵人数
                robotFF  // 总战斗力
            );

            // 设定小兵等级
            var mPos = 1;
            for (var pos in user.pos) {
                if (!user.pos.hasOwnProperty(pos)) {
                    continue;
                }

                fightInfo[mPos].soldier_level = user.pos[pos].soldier.level;
                mPos += 1;
            }

            resp.data.trial_robot = fightInfo;
        } else {
            resp.data.trial_robot = {};
        }
    } while(false);

    onHandled();
}

// 获取所有可雇佣武将
exports.get_mercenaries = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(user.legion.trial_count >= gConfLegion.legionTrialMaxCount) {
            resp.code = 1; resp.desc = 'max count'; break;
        }

        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                player.memData.status = 'prepare_trail';
                player.memData.hire_owners = [];
                player.memData.hire_hids = [];
                var mercenaries = resp.data.mercenaries;
                for(var i = 0, len = mercenaries.length; i < len; i++) {
                    var owner = mercenaries[i].owner;
                    var hid = mercenaries[i].hid;
                    if(user.legion.hired_heros[owner] && user.legion.hired_heros[owner][hid]) {
                        mercenaries.splice(i, 1);
                        i--; len--;
                    }
                }
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
}

// 雇佣武将
exports.hire_mercenary = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (user.legion.trial_count >= gConfLegion.legionTrialMaxCount) {
            resp.code = 1; resp.desc = 'max count'; break;
        }

        if (player.memData.status != 'prepare_trail') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (req.args.owners && req.args.hids) {
            var owners = req.args.owners;
            var hids = req.args.hids;
            if(!util.isArray(owners) || !util.isArray(hids) || owners.length != hids.length) {
                resp.code = 1; resp.desc = 'owners or hids error'; break;
            }

            if(owners.length > 2) {
                resp.code = 1; resp.desc = 'hire too much'; break;
            }
            if(owners.length > 0) {
                for(var i = 0; i < owners.length; i++) {
                    var owner = +owners[i];
                    var hid = +hids[i];

                    if(owner == req.uid) {
                        resp.code = 1; resp.desc = 'cannot hire your own'; break;
                    }

                    if((owner in user.legion.hired_heros) && (hid in user.legion.hired_heros[owner])) {
                        resp.code = 1; resp.desc = 'has hired today'; break;
                    }
                }
                if(resp.code == 1) {
                    break;
                }

                requestWorld(req, resp, function() {
                    if(resp.code == 0) {
                        player.memData.hire_owners = owners;
                        player.memData.hire_hids = hids;
                    }
                    onHandled();
                });
                return;
            }
        }
    } while(false);

    onHandled();
};

exports.trial_before_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        if (team) {
            var valid = true;
            for(var pos in team) {
                var slot = Math.floor(team[pos]);
                if(!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if(!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }
            for(var pos in team) {
                user.pos[pos].slot = Math.floor(team[pos]);
                player.markDirty(util.format('pos.%d.slot', pos));
            }

        }

        if (player.memData.status != 'prepare_trail') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (user.legion.trial_count >= gConfLegion.legionTrialMaxCount) {
            resp.code = 1; resp.desc = 'max count'; break;
        }

        var rand = Math.floor(common.randRange(100000, 999999));
        player.memData.rand = rand;
        player.memData.fight_time = common.getTime();
        resp.data.rand = rand;
        player.memData.status = 'fight_trail';
    } while(false);

    onHandled();
};

// 挑战结束
exports.trial_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(user.status.level < gConfLegion.legionTrialOpenLevel) {
            resp.code = 1; resp.desc = 'low level'; break;
        }

        if(user.legion.trial_count >= gConfLegion.legionTrialMaxCount) {
            resp.code = 1; resp.desc = 'max count'; break;
        }

        if(player.memData.status != 'fight_trail') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star) || star > 3 || star < 0) {
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

        for (var i = 0; i < player.memData.hire_owners.length; i++) {
            var owner = player.memData.hire_owners[i];
            if(!user.legion.hired_heros[owner]) {
                user.legion.hired_heros[owner] = {};
                player.markDirty('legion.hired_heros.'+owner);
            }
            user.legion.hired_heros[owner][player.memData.hire_hids[i]] = 1;
            player.markDirty('legion.hired_heros.'+owner+'.'+player.memData.hire_hids[i]);
        }

        user.legion.trial_star += star;
        player.markDirty('legion.trial_star');
        player.memData.status = 'idle';

        // 发掉落奖励
        var level = user.status.level;
        var stages = Object.keys(gConfTrial).sort(function(a, b){return (+a)-(+b)});
        var i = 0;
        while (+stages[i] <= level) {
            i++;
        }
        var index = stages[i-1];

        // 此时玩家有可能已经被踢出军团，仍然发奖励，只是被雇佣的人没有对应的雇佣奖励
        var awards = null;
        if (star == 1) {
           awards = generateDrop(gConfTrial[index].dropId1, user.status.level);
        } else if (star == 2) {
           awards = generateDrop(gConfTrial[index].dropId2, user.status.level);
        } else if (star == 3) {
           awards = generateDrop(gConfTrial[index].dropId3, user.status.level);
        } else {
           awards = [];
        }

        if (star > 0) {
            user.legion.trial_count++;
            player.markDirty('legion.trial_count');
            player.doDailyTask('prGround', 1);
        }

        if(!user.legion.trial_play){
            user.legion.trial_play = 1;
            player.markDirty('legion.trial_play');
        }

        resp.data.awards = player.addAwards(awards,req.mod,req.act);

        if (player.memData.hire_owners.length) {
            req.args.owners = player.memData.hire_owners;
            req.args.hids = player.memData.hire_hids;
            requestWorld(req, resp);
        }

        var logConf = gConfPlayLog['legion']['trial'];
        player.recordPlay(logConf.logType, logConf.logName);
    } while(false);

    onHandled();
};

// 星星兑换钥匙
exports.exchange_key = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || !gConfExchangeKey[req.args.id]) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var id = req.args.id;
        var num = user.legion.trial_star;
        if (num < gConfExchangeKey[id].num) {
            resp.code = 1; resp.desc = 'star not enough'; break;
        }

        user.legion.trial_star -= gConfExchangeKey[id].num;
        player.markDirty('legion.trial_star');

        resp.data.awards = player.addAwards(gConfExchangeKey[id].awards,req.mod,req.act);
    } while(false);

    onHandled();

};

exports.get_copy = function(player, req, resp, onHandled) {
    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            var legion = player.user.legion;
            resp.data.copy_buy = legion.copy_buy;
            resp.data.copy_count = legion.copy_count;
            resp.data.copy_rewards = legion.copy_rewards;
        }

        onHandled();
    });
};

exports.get_enemy = function(player, req, resp, onHandled) {
    var legion = player.user.legion;
    if (legion.copy_count - legion.copy_buy >= gConfLegion.legionCopyFightLimit) {
        resp.code = 1; resp.desc = 'count max'; onHandled(); return;
    }

    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            player.memData.status = 'prepare_legioncopy';
            player.memData.chapter = req.args.chapter;
            player.memData.progress = req.args.progress;
        }

        onHandled();
    });
};

exports.before_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (player.memData.status != 'prepare_legioncopy') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        req.args.chapter = player.memData.chapter;
        req.args.progress = player.memData.progress;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var rand = Math.floor(common.randRange(100000, 999999));
                player.memData.rand = rand;
                player.memData.status = 'fight_legioncopy';

                resp.data.rand = rand;
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.fight = function(player, req, resp, onHandled) {
    do {
        if (!req.args.autofight && player.memData.status != 'fight_legioncopy') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        // TODO 战斗校验

        var damage = req.args.damage;
        if (!util.isArray(damage)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var validDamage = true;
        for (var i = 0, len = damage.length; i < len; i++) {
            if (isNaN(damage[i])) {
                validDamage = false;
                break;
            }
        }
        if (!validDamage) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        req.args.chapter = player.memData.chapter;
        req.args.progress = player.memData.progress;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var legion = player.user.legion;
                player.memData.status = 'idle';
                legion.copy_count++;
                player.markDirty('legion.copy_count');

                if(!legion.copy_play){
                   legion.copy_play = 1;
                   player.markDirty('legion.copy_play');
                }

                var awards = [['user', 'legion', gConfLegion.legionCopyFightReward]];
                if (resp.data.pass) {
                    awards.push(['user', 'legion', gConfLegion.legionCopyPassReward]);
                }

                if (isActivityStart(player, 'todaydouble')) {
                    var doubleConf = gConfAvTodayDouble[getActivityOpenDay('todaydouble')];
                    if (doubleConf) {
                        if (doubleConf.gateway1 == 'legion' || doubleConf.gateway2 == 'legion') {
                            awards = timeAwards(awards, 2, true);
                        }
                    }
                }

                player.doDailyTask('expedition', 1);

                if (resp.data.copy) {
                    resp.data.copy.copy_buy = legion.copy_buy;
                    resp.data.copy.copy_count = legion.copy_count;
                    resp.data.copy.copy_rewards = legion.copy_rewards;
                }

                var logConf = gConfPlayLog['legion']['copy'];
                player.recordPlay(logConf.logType, logConf.logName);
                resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_damage_reward = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var damage = req.args.damage;
        var conf = gConfLegionCopyReward[damage];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                user.legion.copy_rewards.push(damage);
                player.markDirty('legion.copy_rewards');
                resp.data.awards = player.addAwards(conf.reward,req.mod,req.act);
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.buy_count = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var legion = user.legion;
        if (legion.copy_buy >= gConfVip[user.status.vip].legionCopy) {
            resp.code = 1; resp.desc = 'buy max'; onHandled(); return;
        }

        var buyConf = gConfBuy[legion.copy_buy + 1];
        if (!buyConf) {
            buyConf = gConfBuy[gMaxBuyTimes];
        }
        var costs = [['user', 'cash', -1]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        legion.copy_buy++;
        player.markDirty('legion.copy_buy');

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.shop_get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }
        var shopType = ShopType.LEGION;
        var count = gConfGlobal.legionShopSellCount;
        var now = common.getTime();
        var legionShop = user.shop[shopType];

        // 自动刷新
        var today = common.getDate();
        if (legionShop.refresh != today) {
            player.refreshShop(shopType, count);
            legionShop.refresh = today;
            player.markDirty(util.format('shop.%d.refresh', shopType));
        }

        resp.data.shop = legionShop;

    } while(false);

    onHandled();
};

exports.shop_buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if(!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var id = Math.floor(+req.args.id);
        var type = req.args.type;

        var shopType = ShopType.LEGION;
        var legionShop = user.shop[shopType];

        if (!legionShop.goods[id]) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        var good = legionShop.goods[id];
        if (good[1]) {
            resp.code = 1; resp.desc = 'has bought'; break;
        }

        var costId = good[0];
        var costs = gConfShop[id]['cost'+costId];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var awards = gConfShop[id].get;
        if (awards[0][0] == 'equip') {
            awards = [['equip', good[2], good[3], 1]];
        }

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        good[1] = 1;
        player.markDirty(util.format('shop.%d.goods.%d', shopType, id));

        player.doDailyTask('shopBuy', 1);
    } while(false);

    onHandled();
};

exports.shop_refresh = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var costs = [['user', 'cash', -gConfGlobal.legionShopRefreshCashCost]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough'; break;
        }

        var shopType = ShopType.LEGION;
        var legionShop = user.shop[shopType];

        player.refreshShop(shopType, gConfGlobal.legionShopSellCount);
        resp.data.shop = legionShop;
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while(false);

    onHandled();
};

exports.buy_dress = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || !gConfSoldierDress[req.args.id]) {
            resp.code = 1; resp.desc = "id error"; break;
        }

        var num = Math.floor(req.args.num) || 1;
        if (num < 1) {
            resp.code = 1; resp.desc = "num error"; break;
        }

        var dressId = +req.args.id;
        var costs = timeAwards(gConfSoldierDress[dressId].cost, num);
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cost not enough"; break;
        }

        var awards = [['dress', dressId, num]];
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
    } while(false);

    onHandled();
};

exports.get_castle = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                resp.data.rescue = user.legion.castle_rescue;
                resp.data.occupy = user.legion.castle_occupy;
                resp.data.full = player.getLegionCityAwards(common.getTime());
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.upgrade_castle = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var castleLevel = user.legion.castle_level;
        if(!gConfCastleLevel[castleLevel+1]) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var costs = gConfCastleLevel[castleLevel].cost;
        if(!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'sth not enough'; break;
        }

        user.legion.castle_level++;
        player.markDirty('legion.castle_level');

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while(false);

    onHandled();
};

// 获取可侵略的城池列表
exports.get_legion_list = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        requestWorld(req, resp, onHandled);
    } while(false);

    onHandled();
};

// 入侵城池
exports.invade_castle = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(!req.args.lid || !req.args.enemy) {
            resp.code = 1; resp.desc = 'no lid or no enemy'; break;
        }

        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }
        if(user.legion.castle_rescue >= gConfLegion.legionCastleAttackCount) {
            resp.code = 1; resp.desc = 'max invade count'; break;
        }
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                player.memData.status = 'prepare_castle';
                player.memData.enemy_id = +req.args.enemy;
                player.memData.legion_id = +req.args.lid;
                player.memData.castle_type = 'invade';
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

// 入侵城池
exports.rescue_castle = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(!req.args.lid || !req.args.enemy) {
            resp.code = 1; resp.desc = 'no lid or no enemy'; break;
        }

        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }
        if(user.legion.castle_rescue >= gConfLegion.legionCastleRescueCount) {
            resp.code = 1; resp.desc = 'max rescue count'; break;
        }
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                player.memData.status = 'prepare_castle';
                player.memData.enemy_id = +req.args.enemy;
                player.memData.legion_id = +req.args.lid;
                player.memData.castle_type = 'rescue';
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.castle_before_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(player.memData.status != 'prepare_castle') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (!isModuleOpen_new(player, 'legion')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if(req.args.enemy != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        var team = req.args.team;
        if(team) {
            var valid = true;
            for(var pos in team) {
                var slot = Math.floor(team[pos]);
                if(!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if(!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }
            for(var pos in team) {
                user.pos[pos].slot = Math.floor(team[pos]);
                player.markDirty(util.format('pos.%d.slot', pos));
            }
        }

        // 判断是否加锁，以及是否已经被打过了
        req.args.enemy = player.memData.enemy_id;
        req.args.lid = player.memData.legion_id;
        var type = player.memData.castle_type;
        req.args.type = type;
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
                if(type == 'invade') {
                    user.legion.castle_occupy++;
                    player.markDirty('legion.castle_occupy');
                }else {
                    user.legion.castle_rescue++;
                    player.markDirty('legion.castle_rescue');
                }

                var rand = Math.floor(common.randRange(100000, 999999));
                player.memData.rand = rand;
                player.memData.fight_time = common.getTime();
                resp.data.rand = rand;
                player.memData.status = 'fight_castle';
            }
            onHandled();
        });
        return;
    } while(false);

    onHandled();
};

exports.castle_fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if(player.memData.status != 'fight_castle') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var type = player.memData.castle_type;
        if(type != 'invade' && type != 'rescue') {
            resp.code = 1; resp.desc = 'castle type errro'; break;
        }

        var star = req.args.star;

        if (isNaN(star)) {
            resp.code = 1; resp.desc = "star error"; break;
        }
        star = Math.floor(+star);

        // TODO 验证战斗
        //var report = parseFightReport(report, this.memData.rand);
        //if(!report) {
        //    resp.code = 1; resp.desc = "report error"; break;
        //}
        //if(!player.checkBattleReport(report, BattleType.PVE)) {
        //    resp.code = 1; resp.desc = "check report error"; break;
        //}

        req.args.enemy = player.memData.enemy_id;
        req.args.lid = player.memData.legion_id;
        req.args.type = type;
        requestWorld(req, resp, function() {
            player.memData.enemy_id = 0;
            player.memData.status = 0;
            player.memData.legion_id = 0;
            player.memData.castle_type = 0;
            onHandled();
        });

        return;

    } while(false);

    onHandled();
};

exports.get_construct = function(player, req, resp, onHandled) {
    var legion = player.user.legion;
    requestWorld(req, resp, function() {
        if (resp.code == 0) {
            resp.data.count = legion.construct_count;
            resp.data.rewards = legion.construct_rewards;
        }

        onHandled();
    });
};

exports.build_construct = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var conf = gConfLegionConstruct[req.args.id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        if (user.legion.construct_count >= gConfVip[user.status.vip].legionConstruct) {
            resp.code = 1; resp.desc = 'time limit'; break;
        }

        var costs = conf.cost;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something is not enough'; break;
        }

        req.args.type = conf.name;
        req.args.add_xp = conf.xp;
        req.args.add_progress = conf.progress;
        if (!user.legion.construct_count) {
            req.args.new = 1;
        }
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                user.legion.construct_count++;
                player.markDirty('legion.construct_count');

                player.doDailyTask('build', 1);

                resp.data.awards = player.addAwards([['user', 'legion', conf.legionCoin]],req.mod,req.act);
                resp.data.costs = player.addAwards(costs,req.mod,req.act);
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_construct_reward = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var progress = +req.args.progress;
        var conf = gConfLegionConstructReward[progress];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid progress'; break;
        }

        if (user.legion.construct_rewards[progress]) {
            resp.code = 1; resp.desc = 'already rewarded'; break;
        }

        user.legion.construct_rewards[progress] = 1;
        player.markDirty('legion.construct_rewards.' + progress);

        resp.data.awards = player.addAwards(conf.award,req.mod,req.act);
    } while (false);

    onHandled();
};

// 升级玩家城池
exports.upgrade_building = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var buildingId = req.args.building_id;
        if (isNaN(buildingId)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var buildConf = gConfLegionCityConf[buildingId];
        if (!buildConf) {
            resp.code = 1; resp.desc = 'building conf not found'; break;
        }

        var curLevel = 0;
        if (user.legion.city.buildings[buildingId]) {
            curLevel = user.legion.city.buildings[buildingId].level;
        }

        var nextLevel = curLevel + 1;
        if (!gConfLegionCityConf[buildingId][nextLevel]) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var costs = gConfLegionCityConf[buildingId][nextLevel].cost;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'res not enough'; break;
        }
        // 检查主城等级够不够
        var totalLevel = player.getBuildingTotalLevel();
        var mainCityLevel = 1;
        for (var city_level in gConfLegionCityMain) {
            if (totalLevel >= parseInt(gConfLegionCityMain[city_level].condition)){
                mainCityLevel = parseInt(city_level) + 1;
            }
        }

        if (mainCityLevel < parseInt(buildConf[nextLevel].condition1)) {
            resp.code = 1; resp.desc = 'max level'; break;
        }

        var needBuilding = gConfLegionCityConf[buildingId][nextLevel].needBuild;
        var needLevel = gConfLegionCityConf[buildingId][nextLevel].needLevel;
        var canUpgrade = true;
        for (var i = 0; i < needBuilding.length; i++) {
            var buildLevel = 0;
            if (user.legion.city.buildings[needBuilding[i]]) {
                buildLevel = user.legion.city.buildings[needBuilding[i]].level;
            }

            if (buildLevel < needLevel) {
                canUpgrade = false;
                break;
            }
        }

        if (!canUpgrade) {
            resp.code = 1; resp.desc = 'builgding level not enough'; break;
        }

        if (!user.legion.city.buildings[buildingId]) {
            user.legion.city.buildings[buildingId] = {};
        }

        user.legion.city.buildings[buildingId].level = nextLevel;
        player.markDirty(util.format('legion.city.buildings.%d', buildingId));

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.level = nextLevel;

        if (nextLevel == 1 && (buildingId == 4 || buildingId == 8 || buildingId == 12 || buildingId == 16)) {
            var cityType = buildingId/4;
            var cityConf = gConfLegionCityBase[cityType];
            var awards = clone(cityConf.award);
            for (var i = 0; i < awards.length; i++) {
                var awardId = awards[i][1];
                if (!user.legion.city.awards[awardId]) {
                    user.legion.city.awards[awardId] = {};
                    user.legion.city.awards[awardId].num = 0;
                    user.legion.city.awards[awardId].time = common.getTime();
                    user.legion.city.awards[awardId].buildingId = buildingId;
                    player.markDirty(util.format('legion.city.awards.%d', awardId))
                }
            }

            resp.data.awards = user.legion.city.awards;
        }

    } while (false);

    onHandled();
};

// 领取城池奖励
exports.get_city_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var cityType = req.args.city_type;
        if (isNaN(cityType)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var cityConf = gConfLegionCityBase[cityType];
        if (!cityConf) {
            resp.code = 1; resp.desc = 'city conf not found'; break;
        }

        player.getLegionCityAwards(common.getTime());

        var awards = clone(cityConf.award);
        for (var i = 0; i < awards.length; i++) {
            var awardId = awards[i][1];
            if (user.legion.city.awards[awardId]) {
                awards[i][2] = user.legion.city.awards[awardId].num;
                user.legion.city.awards[awardId].num = 0;
                player.markDirty(util.format('legion.city.awards.%d', awardId))
            } else {
                awards[i][2] = 0;
            }
        }

        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        resp.data.city = user.legion.city;
    } while (false);

    onHandled();
};

// 获取城池升级信息
exports.get_city_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        //var awards = [['user', 'mine_1', 10000],['user', 'mine_2', 10000],['user', 'mine_3', 10000],['user', 'mine_4', 10000],['user', 'mine_5', 10000]];

        //player.addAwards(awards);
        player.getLegionCityAwards(common.getTime());
        resp.data.city = user.legion.city;
    } while (false);

    onHandled();
};

exports.get_wish_list = function(player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.wish = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var legion = user.legion;
        var id = req.args.id;
        if (isNaN(id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var heroConf = gConfHero[id];
        if (!heroConf) {
            resp.code = 1; resp.desc = 'id error'; break;
        }

        var confWish = gConfLegionWishConf[heroConf.quality];
        if (!confWish) {
            resp.code = 1; resp.desc = 'can not wish'; break;
        }

        var fragmentNum = user.bag.fragment[id] || 0;
        var cardNum = user.bag.card[id];
        var wishLimit = gConfLegionWishConf[heroConf.quality].wishLimit;
        var pos = user.pos;
        for (var p in pos) {
            if (pos[p].hid == id) {
                cardNum++;
            }

            for (var fateId in user.pos[p].assist) {
                var fateArray = user.pos[p].assist[fateId];
                if (fateArray.contains[p]) {
                    cardNum++;
                }
            }
        }

        if (fragmentNum < wishLimit && cardNum < 1) {
            resp.code = 1; resp.desc = 'fragment or card not enough'; break;
        }

        if (legion.wish.own > gConfLegion.leigionWishTimes) {
            resp.code = 1; resp.desc = 'max own'; break;
        }

        req.args.own = legion.wish.own;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                legion.wish.own++;
                player.markDirty('legion.wish.own');
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.wish_give = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var givenUid = req.args.ruid;
        var givenWishTimes = req.args.times;
        var givenFragmentId = req.args.id;
        var legion = user.legion;
        if (isNaN(givenUid) || isNaN(givenWishTimes) || isNaN(givenFragmentId)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var confHero = gConfHero[givenFragmentId];
        if (!confHero) {
            resp.code = 1; resp.desc = 'args id error'; break;
        }

        var quality = confHero.quality;
        var onceGiveNum = gConfLegionWishConf[quality].giveLimit;
        var costs = [['fragment', givenFragmentId, -onceGiveNum]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough fragment'; break;
        }

        var vip = user.status.vip;
        var give = legion.wish.give;
        if (give > gConfVip[vip].wishGiveTimes) {
            resp.code = 1; resp.desc = 'give times not enough'; break;
        }

        req.args.onceGiveNum = onceGiveNum;
        requestWorld(req, resp, function() {
            if(resp.code == 0) {
               if(resp.data.awards) {
                  var giveAwards = resp.data.awards;
                  legion.wish.give++;
                  player.markDirty('legion.wish.give');

                  var giveId = gConfLegionWishAchievementKey['give'].id;
                  legion.wish.wish_progress[giveId] = legion.wish.give;
                  if (legion.wish.give) {
                      player.markDirty('legion.wish.wish_progress.' + giveId);
                  }

                  resp.data.costs = player.addAwards(costs,req.mod,req.act);
                  resp.data.awards = player.addAwards(giveAwards,req.mod,req.act);
               }
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_wish_fragment = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var times = req.args.times;
        var fragmentId = req.args.id;
        if (isNaN(times) || isNaN(fragmentId)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        requestWorld(req, resp, function() {
            if(resp.code == 0) {
               var canGet = resp.data.can_get;
               var awards = [['fragment', fragmentId, canGet]];
               resp.data.awards = player.addAwards(awards,req.mod,req.act);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_wish_awards_message = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var legion = user.legion;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                var wishId = gConfLegionWishAchievementKey['wish'].id;
                if (resp.data.achievement_wish) {
                    legion.wish.wish_progress[wishId] = resp.data.achievement_wish;
                    player.markDirty('legion.wish.wish_progress.' + wishId);
                }

                resp.data.wish_progress = legion.wish.wish_progress;
                resp.data.wish_reward = legion.wish.wish_reward;
            }
            onHandled();
        });
        return;
    } while (false);
};

exports.get_wish_awards = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        var legion = user.legion;
        if (isNaN(id)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        var conf = gConfLegionWishAchievement[id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var wishReward = legion.wish.wish_reward[id];
        var wishProgress = legion.wish.wish_progress[id];
        var curProgress = (wishReward ? wishReward : 0) + 1;
        if (!conf[curProgress] || !wishProgress || wishProgress < conf[curProgress].target) {
            resp.code = 1; resp.desc = 'not achieved'; break;
        }

        if (wishReward) {
            legion.wish.wish_reward[id]++;
        } else {
            legion.wish.wish_reward[id] = 1;
        }

        player.markDirty('legion.wish.wish_reward.' + id);
        resp.data.awards = player.addAwards(conf[curProgress].award,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.get_wish_log = function(player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};
