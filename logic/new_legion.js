var ErrorCode = require('../common/legiondefine.js').ErrorCode;

// 创建军团
exports.create = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        // 战队名字检测是否合法
        var name = req.args.name;
        var side = req.args.side;// 旗面
        var pattern = req.args.pattern;//花纹

        if (common.getTime() - user.new_legion.join_time < gConfGlobalNew.legionJoinTimeLimit * 60 * 60) {
            resp.code = ErrorCode.ERROR_LEGION_JOIN_CD; resp.desc = 'join_time error'; break;
        }

        // 验证name
        if (!name) {
            resp.code = ErrorCode.ERROR_NAME_INVALID; resp.desc = 'name is error'; break;
        }
        name = name.toString().replace(/\s\r\n/g, '');
        var nameLen = 0;
        for (var i = 0, len = name.length; i < len; i++) {
            name.isChineseWord(i) ? (nameLen += 2) : nameLen++;
        }
        if (nameLen > 12) {
            resp.code = ErrorCode.ERROR_NAME_INVALID; resp.desc = 'name is error'; break;
        }

        var gSide = gConfLegionFlag[1][side];
        var gPattern = gConfLegionFlag[2][pattern];

        // 验证icons
        if (!gSide || !gPattern) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'icons is error'; break;
        } else if (gSide.condition == 'legion_level' && gSide.value) {
            resp.code = ErrorCode.ERROR_FLAG_SET_CONDITION; resp.desc = 'side legion_level is error'; break;
        } else if (gPattern.condition == 'legion_level' && gPattern.value) {
            resp.code = ErrorCode.ERROR_TEXTURE_SET_CONDITION; resp.desc = 'pattern legion_level is error'; break;
        } else if (gSide.condition == 'vip_level' && gSide.value > user.status.vip) {
            resp.code = ErrorCode.ERROR_FLAG_SET_CONDITION; resp.desc = 'side vip_level is error'; break;
        } else if (gPattern.condition == 'vip_level' && gPattern.value > user.status.vip) {
            resp.code = ErrorCode.ERROR_TEXTURE_SET_CONDITION; resp.desc = 'pattern vip_level is error'; break;
        }

        var costs = parseAwardsConfig(gConfGlobalNew.legionCreatCost);
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'lack of resources'; break;
        }

        req.args.icons = [side, pattern];
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
                resp.data.costs = player.addAwards(costs);
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

// 进入主界面获取军团信息
exports.get = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        var legion = user.new_legion;
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);

                var curTime = common.getTime();
                if (legion.wood.time > curTime) {
                    legion.wood.time = curTime;
                    player.markDirty('new_legion.wood.time');
                }
                if (legion.fire.time > curTime) {
                    legion.fire.time = curTime;
                    player.markDirty('new_legion.fire.time');
                }

                var bonfireMsg = resp.data.bonfireMsg || {};
                bonfireMsg['wood_num'] = legion.wood.num;
                bonfireMsg['wood_time'] = legion.wood.time;
                bonfireMsg['fire_num'] = legion.fire.num;
                bonfireMsg['fire_time'] = legion.fire.time;
                bonfireMsg['red_awards'] = legion.red_awards;
                if (resp.data.join_time) {
                    legion.join_time = resp.data.join_time;
                    player.markDirty('new_legion.join_time');
                }
                resp.data.bonfireMsg = bonfireMsg;
                resp.data.boss = user.new_legion.boss;
            }
            onHandled();
        });
        return;
    } while (false);
    onHandled();
};

// 修改军团名
exports.modify_name = function (player, req, resp, onHandled) {
    do {
        var name = req.args.name;
        if (!name) {
            resp.code = ErrorCode.ERROR_NAME_INVALID; resp.desc = 'name is error'; break;
        }
        name = name.toString().replace(/\s\r\n/g, '');
        var nameLen = 0;
        for (var i = 0, len = name.length; i < len; i++) {
            name.isChineseWord(i) ? (nameLen += 2) : nameLen++;
        }
        if (nameLen > 12) {
            resp.code = ErrorCode.ERROR_NAME_INVALID; resp.desc = 'name is error'; break;
        }

        var costs = parseAwardsConfig(gConfGlobalNew.legionNameChageCost);
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'lack of resources'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
                resp.data.costs = player.addAwards(costs);
            }
            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

// 修改公告
exports.modify_notice = function (player, req, resp, onHandled) {
    do {
        var notice = req.args.notice;
        if (!notice) {
            resp.code = ErrorCode.ERROR_NOTICE_INVALID; resp.desc = 'notice is error'; break;
        }
        notice = notice.toString().replace(/\s\r\n/g, '');
        var noticeLen = 0;
        for (var i = 0, len = notice.length; i < len; i++) {
            notice.isChineseWord(i) ? (noticeLen += 2) : noticeLen++;
        }
        if (noticeLen > 100) {
            resp.code = ErrorCode.ERROR_NOTICE_INVALID; resp.desc = 'notice is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

// 退出军团
exports.logout = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 解散军团
exports.dissolve = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 申请设置
exports.join_set = function (player, req, resp, onHandled) {
    do {
        var joinWay = req.args.joinWay;
        var termLevel = req.args.termLevel;
        if (joinWay == undefined || termLevel == undefined) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 搜索军团
exports.search = function (player, req, resp, onHandled) {
    do {
        var lid = req.args.lid;
        if (!lid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled();
        });
        return
    } while (false);

    onHandled();
};

// 返回军团列表
exports.get_legions_list = function (player, req, resp, onHandled) {
    do {

        // 等级不足
        if (!isModuleOpen_level(player.user.status.level, 'legion')) {
            resp.code = ErrorCode.ERROR_CAN_NOT_JOIN; resp.desc = 'level is not enough'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                resp.data.join_time = player.user.new_legion.join_time;
                onHandled()
            }
        });
        return;
    } while (false);
    onHandled();
};

// 加入军团 || 申请
exports.join = function (player, req, resp, onHandled) {
    do {
        var lid = req.args.lid;
        var user = player.user;
        if (!lid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        // 已经有军团了
        if (player.memData.legion_id > 0) {
            resp.code = ErrorCode.ERROR_ALREADY_HAS_LEGION; resp.desc = 'already has legion'; break;
        }

        if (common.getTime() - user.new_legion.join_time < gConfGlobalNew.legionJoinTimeLimit * 60 * 60) {
            resp.code = ErrorCode.ERROR_LEGION_JOIN_CD; resp.desc = 'join_time error'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
                var join_time = resp.data.join_time;
                if (join_time) {
                    user.new_legion.join_time = join_time;
                    player.markDirty('new_legion.join_time');
                }
            }
            onHandled()
        });

        return;
    } while (false);

    onHandled();
};

// 撤销申请
exports.undo = function (player, req, resp, onHandled) {
    do {
        var lid = req.args.lid;
        if (!lid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled()
        });
        return;
    } while (false);

    onHandled();
};

// 清空申请
exports.clear_apply = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, onHandled)
    } while (false);
};

// 获取军团申请列表
exports.get_apply_list = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, onHandled)
    } while (false);
};

// 申请管理操作
exports.set_apply = function (player, req, resp, onHandled) {
    do {
        var uid = req.args.uid;
        var type = req.args.type;
        if (!uid || !type || isNaN(type)) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled()
        });
        return;
    } while (false);

    onHandled();
};

// 获取军团成员列表
exports.get_member_list = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, onHandled)
    } while (false);
};

// 职位任免
exports.set_duty = function (player, req, resp, onHandled) {
    do {
        var uid = req.args.uid;
        var duty = req.args.duty;

        if (!uid || !duty || uid == req.uid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        requestWorld(req, resp, function () {
            onHandled()
        });
        return;
    } while (false);

    onHandled();
};

// 弹劾
exports.impeach = function (player, req, resp, onHandled) {
    do {
        var uid = req.args.uid;
        if (!uid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 踢出军团
exports.kick_out = function (player, req, resp, onHandled) {
    do {
        var uid = req.args.uid;
        if (!uid || uid == req.uid) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 更改旗帜
exports.modify_icon = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        var side = req.args.side;// 旗面
        var pattern = req.args.pattern;//花纹

        var gSide = gConfLegionFlag[1][side];
        var gPattern = gConfLegionFlag[2][pattern];

        // 验证icons
        if (!gSide || !gPattern) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'icons is error'; break;
        } else if (gSide.condition == 'legion_level' && gSide.value) {
            resp.code = ErrorCode.ERROR_FLAG_SET_CONDITION; resp.desc = 'side legion_level is error'; break;
        } else if (gPattern.condition == 'legion_level' && gPattern.value) {
            resp.code = ErrorCode.ERROR_TEXTURE_SET_CONDITION; resp.desc = 'pattern legion_level is error'; break;
        } else if (gSide.condition == 'vip_level' && gSide.value > user.status.vip) {
            resp.code = ErrorCode.ERROR_FLAG_SET_CONDITION; resp.desc = 'side vip_level is error'; break;
        } else if (gPattern.condition == 'vip_level' && gPattern.value > user.status.vip) {
            resp.code = ErrorCode.ERROR_TEXTURE_SET_CONDITION; resp.desc = 'pattern vip_level is error'; break;
        }

        req.args.icons = [side, pattern];
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
            }
            onHandled();
        });
        return;

    } while (false);

    onHandled();
};

// 获取军团建设信息
exports.get_build = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                resp.data.build_awards = user.new_legion.build_awards;
                resp.data.build_day = user.new_legion.build;
            }
            onHandled()
        });
        return;
    } while (false);

    onHandled()
};

// 建设
exports.build = function (player, req, resp, onHandled) {
    do {
        var type = req.args.type;
        var user = player.user;
        if (!type || isNaN(type)) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        if (!gConfLegionBuild[type]) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        if (user.new_legion.build >= gConfVip[user.status.vip].legionConstruct) {
            resp.code = ErrorCode.ERROR_BUILD_COUNT_MAX; resp.desc = 'num is error'; break;
        }

        var costs = gConfLegionBuild[type].cost;
        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'lack of resources'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.saveLegionMemData(req, resp.data.legionMsg);
                var awards = gConfLegionBuild[type].award;
                user.new_legion.build += 1;
                player.markDirty('new_legion.build');
                resp.data.costs = player.addAwards(costs);
                resp.data.awards = player.addAwards(awards);
                resp.data.build_day = user.new_legion.build;

                player.doDailyTask('build', 1);
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 建设领取宝箱奖励
exports.get_build_awards = function (player, req, resp, onHandled) {
    do {
        var type = req.args.type;
        var user = player.user;
        if (!type || isNaN(type)) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        if (user.new_legion.build_awards[type]) {
            resp.code = ErrorCode.ERROR_BUILD_AWARD_HAS_GOT; resp.desc = 'already awards'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                var awards = resp.data.awards;
                user.new_legion.build_awards[type] = 1;
                player.markDirty('new_legion.build_awards');
                resp.data.awards = player.addAwards(awards);
            }
            onHandled();
        });
        return
    } while (false);

    onHandled();
};

// 设置篝火开启时间
exports.set_bonfire_time = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, function () {
            onHandled();
        })
        return;
    } while (false);

    onHandled();
};

// 加入篝火
exports.join_bonfire = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                player.doDailyTask('legionFire', 1);
                player.doTask('legionFire', 1);
            }
            onHandled();
        })
        return;
    } while (false);

    onHandled();
};

// 添加木材 || 火苗
exports.add_material = function (player, req, resp, onHandled) {
    do {
        var user = player.user;
        var legion = user.new_legion;
        var type = req.args.type;

        if (!type || type != 1 && type != 2) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        var woodFire = '';
        var costs = parseAwardsConfig(gConfGlobalNew['legionBonfire_operateCost' + type]);
        var confOpt = gConfGlobalNew['legionBonfire_operate' + type].split('|');
        var woodFire = legion[type == '1' ? 'wood' : 'fire'];

        if (!player.checkCosts(costs)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'lack of resources'; break;
        }

        if (woodFire.num >= confOpt[0]) {
            if (type == 1) {
                resp.code = ErrorCode.ERROR_ADD_WOOD_COUNT_MAX;
            } else {
                resp.code = ErrorCode.ERROR_ADD_FIRE_COUNT_MAX;
            }
            resp.desc = 'num error'; break;
        } else if (common.getTime() - woodFire.time < confOpt[3] * 60) {
            if (type == 1) {
                resp.code = ErrorCode.ERROR_ADD_WOOD_CD_TIME;
            } else {
                resp.code = ErrorCode.ERROR_ADD_FIRE_CD_TIME;
            }
            resp.desc = 'CD  error'; break;
        }

        req.args.special = woodFire.special.indexOf(woodFire.num);
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                var ConfBonFireLevel = gConfLegionLevel[resp.data.level];
                var awards = ConfBonFireLevel['bonfireOperateAward' + type];
                var specialAwards = [];
                if (woodFire.special.length > 0 && woodFire.special.indexOf(woodFire.num) >= 0) {
                    specialAwards = ConfBonFireLevel['bonfireOperateSpecial' + type];
                }

                woodFire.num += 1;
                woodFire.time = common.getTime();

                if (type == 1) {
                    player.markDirty('new_legion.wood');
                } else {
                    player.markDirty('new_legion.fire');
                }

                resp.data.costs = player.addAwards(costs);
                resp.data.awards = player.addAwards(awards);
                resp.data.specialAwards = player.addAwards(specialAwards);
                resp.data.fire_time = legion.fire.time;
                resp.data.fire_num = legion.fire.num;
                resp.data.wood_time = legion.wood.time;
                resp.data.wood_num = legion.wood.num;
            }
            onHandled();
        });
        return
    } while (false);

    onHandled()
};

// 抢红包
exports.grab_red_awards = function (player, req, resp, onHandled) {
    do {
        var type = req.args.type;
        var user = player.user;
        var legion = user.new_legion;
        if (legion.red_awards[type] == undefined) {
            resp.code = ErrorCode.ERROR_INVALID_ARGS; resp.desc = 'args is error'; break;
        }

        if (legion.red_awards[type] >= gConfLegioBonfirerRedpaper[type].limit) {
            resp.code = ErrorCode.ERROR_GRAB_RED_GIT_MAX; resp.desc = 'already up'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                var level = resp.data.level;
                var typeNum = type.match(/\d+/g)[0];
                var awards = [];
                if (type.indexOf('level') > -1) {// 等级红包
                    awards = gConfLegionLevel[level]['bonfireLevelRedPaper' + typeNum];
                } else {// 添柴红包
                    awards = gConfLegionLevel[level]['bonfireOperateRedPaper' + typeNum];
                }

                legion.red_awards[type] += 1;
                player.markDirty('new_legion.red_awards');

                resp.data.red_awards = legion.red_awards;
                resp.data.awards = player.addAwards(awards);
            }
            onHandled()
        });
        return;
    } while (false);

    onHandled();
};

// 获取日志
exports.get_logs = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, onHandled);
    } while (false);
};

// 获取贡献
exports.get_contribution = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, onHandled);
    } while (false);
};

// 获取军团信息
exports.get_legion_info = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

// 获取boss信息
exports.boss_get_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                resp.data.boss.fight_count = user.new_legion.boss.fight_count;
                resp.data.boss.inspire_count = user.new_legion.boss.inspire_count;
            }
            onHandled();
        });
    } while (false);
};

// 开始挑战boss
exports.boss_challenge = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 检查挑战次数
        if (user.new_legion.boss.fight_count >= parseInt(gConfGlobalNew.legionBossChallengeTimes)) {
            resp.code = ErrorCode.ERROR_BOSS_FIGHT_COUNT_MAX; resp.desc = 'max count'; break;
        }

        // 检查是否在挑战时间内
        var bossTime = getLegionBossTime();
        var curTime = common.getTime();
        if (curTime < bossTime[0] || curTime > bossTime[1]) {
            resp.code = ErrorCode.ERROR_BOSS_NOT_FIGHT_TIME; resp.desc = 'not in fight time'; break;
        }

        var cost = gConfBuy[user.new_legion.boss.fight_count + 1].legionBossC;
        if (!player.checkCosts(cost)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {

            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// boss 战斗
exports.boss_before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 检查挑战次数
        if (user.new_legion.boss.fight_count >= parseInt(gConfGlobalNew.legionBossChallengeTimes)) {
            resp.code = ErrorCode.ERROR_BOSS_FIGHT_COUNT_MAX; resp.desc = 'max count'; break;
        }

        var cost = gConfBuy[user.new_legion.boss.fight_count + 1].legionBossC;
        if (!player.checkCosts(cost)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        var team = req.args.team;
        if (team) {
            var valid = true;
            for (var pos in team) {
                var slot = Math.floor(team[pos]);
                if (!user.pos[pos] || slot < 1 || slot > MaxSlot) {
                    valid = false; break;
                }
            }
            if (!valid) {
                resp.code = 1; resp.data = 'invalid team'; break;
            }
            for (var pos in team) {
                user.pos[pos].slot = Math.floor(team[pos]);
                player.markDirty(util.format('pos.%d.slot', pos));
            }
        }

        requestWorld(req, resp, function () {
            var rand = Math.floor(common.randRange(100000, 999999));
            var rand_enc = tower_encrypt(rand.toString(), pubKey);

            player.memData.rand_origin = rand;
            player.memData.rand = rand_enc;
            player.memData.fight_time = common.getTime();

            resp.data.rand = rand_enc;
            player.memData.status = 'fight_legion_boss';

            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

exports.boss_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (player.memData.status != 'fight_legion_boss') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        var star = req.args.star;
        if (isNaN(star) || star > 3 || star < 0) {
            resp.code = 1; resp.desc = "star error"; break;
        }

        // checking
        var ff = +req.args.ff;

        // if (isNaN(ff) || ff > player.getFightForce() * 1.1 || !player.check_attrs(req.args.attrs)) {
        //     DEBUG(`FightForce checking: ${ff}, ${player.getFightForce() * 1.1}`)
        //     // resp.code = 999; resp.desc = "invalid_fight_force"; break;
        // }
        if (user.status.level && user.status.level > 30)
        {
            if (isNaN(ff) || ff > player.getFightForce() * 1.5) {
                DEBUG(`FightForce checking: ${ff}, ${player.getFightForce()}, ${req.uid}`)
                resp.code = 999; resp.desc = "invalid_fight_force"; 
                break;
            }
        }

        var sign = req.args.sign;
        var damage = req.args.damage;

        var rand_origin = player.memData.rand_origin;
        var dec_sign = tower_decrypt(sign, priKey);

        var time = req.args.time;

        // 验证战斗
        var serverSign = getBattleFightSign('new_legion', req.uid, time, damage, rand_origin);

        DEBUG(`fight: ${dec_sign} ${serverSign} ${sign}`)

        // if (serverSign != dec_sign) {
        //     resp.code = 999;
        //     resp.desc = "sign not match";
        //     break;
        // }

        // 检查挑战次数
        if (user.new_legion.boss.fight_count >= parseInt(gConfGlobalNew.legionBossChallengeTimes)) {
            resp.code = ErrorCode.ERROR_BOSS_FIGHT_COUNT_MAX; resp.desc = 'max count'; break;
        }

        var cost = gConfBuy[user.new_legion.boss.fight_count + 1].legionBossC;
        if (!player.checkCosts(cost)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        player.memData.status = 'idle';
        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                user.new_legion.boss.fight_count++;
                player.markDirty('new_legion.boss.fight_count');
                var awards = resp.data.awards;
                if (awards) {
                    resp.data.awards = player.addAwards(awards, req.mod, req.act);
                }

                resp.data.costs = player.addAwards(cost, req.mod, req.act);
            }

            onHandled();
        });
        return;

    } while (false);

    onHandled();
};

// boss鼓舞
exports.boss_inspire = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var type = req.args.type;   // 鼓舞类型
        if (type == null || type == undefined) {
            resp.code = 1; resp.desc = 'args invalid'; break;
        }

        if (!gConfLegionBossAakb[type]) {
            resp.code = 1; resp.desc = 'type not exist'; break;
        }

        // 检查是否超过鼓舞次数
        if (user.new_legion.boss.inspire_count >= parseInt(gConfGlobalNew.legionBossAakbTimes)) {
            resp.code = ErrorCode.ERROR_INSPIRE_COUNT_MAX; resp.desc = 'max count'; break;
        }

        // 检查当前时间是否可鼓舞,凌晨五点至当日活动结束时间内为可鼓舞时间
        var curTime = common.getTime();
        var dailyResetTime = getResetTime();    // 下一次重置时间
        var endTime = getLegionBossTime()[1];

        if (curTime < dailyResetTime || curTime >= endTime) {
            resp.code = ErrorCode.ERROR_NOT_INSPIRE_TIME; resp.desc = 'not time'; break;
        }

        // 检查消耗够不够
        var cost = gConfLegionBossAakb[type].cost;
        if (!player.checkCosts(cost)) {
            resp.code = ErrorCode.ERROR_COST_NOT_ENOUGH; resp.desc = 'cost not enough'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                resp.data.costs = player.addAwards(cost, req.mod, req.act);

                var awards = gConfLegionBossAakb[type].award;
                resp.data.awards = player.addAwards(awards, req.mod, req.act);

                // 更新鼓舞次数
                user.new_legion.boss.inspire_count++;
                player.markDirty('new_legion.boss.inspire_count');
            }
            onHandled();
        });
        return;

    } while (false);

    onHandled();
};

// 获取boss伤害排行榜
exports.boss_get_damage_rank = function (player, req, resp, onHandled) {
    do {
        requestWorld(req, resp, function () {
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

// 排行榜 
exports.rank_list = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

// -------------------------------- 军团战 --------------------------------------------
exports.get_hall = function (player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

// ------------------------------------------------------------------------------------

// 获取军团boss信息
exports.get_legion_boss_info = function (player, req, resp, onHandled) {
    var user = player.user;
    if (!isModuleOpen_new(player, 'legion')) {
        resp.code = 1; resp.desc = 'not open';
        onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};
