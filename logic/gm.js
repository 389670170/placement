var http = require('http');
var server = require('../server.js');

var methods = {
    // 获取用户登录信息
    get: function (player, req, resp, onHandled) {
        var now = common.getTime();
        player.getFood(now);
        player.getFoodRed(now);
        var fight_force = player.getFightForce();
        resp.data.user = clone(player.user);
        resp.data.user.fight_force = fight_force;
        resp.data.user.mem_data = player.memData;
        resp.data.time = now;

        var options = {
            support: player.user.worldwar.support,        // 跨服战支持
            excepts: player.user.mail,                    // 已经读过或者删除的邮件
            create_time: player.user.info.create,         // 创建用户的时间
        };
        requestWorldByModAndAct({ uid: req.uid }, 'gm', 'get', { options: options }, function (worldResp) {
            resp.data.user.world_user = worldResp.data.user;
            resp.data.user.world_legion = worldResp.data.legion;
            resp.data.user.mails = worldResp.data.mails;
            resp.data.user.bulletins = worldResp.data.bulletins;
            onHandled();
        });
    },

    world_get: function (player, req, resp, onHandled) {
        requestWorldByModAndAct({ uid: req.uid }, 'gm', 'world_get', { type: req.args.type }, function (worldResp) {
            resp.code = worldResp.code;
            resp.desc = worldResp.desc;
            resp.data = worldResp.data;
            onHandled();
        });
    },

    // 清空装备
    clear_equip: function (player, req, resp, onHandled) {
        for (var eid in player.user.bag.equip) {
            if (!player.user.bag.equip[eid].pos) {
                delete player.user.bag.equip[eid];
                player.memData.equip_num--;
            }
        }
        player.markDirty('bag.equip');

        onHandled();
    },

    clear_dress: function (player, req, resp, onHandled) {
        player.user.bag.dress = {};
        player.markDirty('bag.dress');
        onHandled();
    },

    // 清空背包
    clear_bag: function (player, req, resp, onHandled) {
        var bag = player.user.bag;
        bag.material = {};
        bag.gem = {};
        bag.fragment = {};
        bag.card = {};
        bag.limitmat = {};
        player.markDirty('bag.material');
        player.markDirty('bag.gem');
        player.markDirty('bag.fragment');
        player.markDirty('bag.card');
        player.markDirty('bag.limitmat');

        player.memData.limitmat = [];
        onHandled();
    },

    // 清空龙晶
    clear_dragongem: function (player, req, resp, onHandled) {
        for (var gid in player.user.bag.dragon) {
            if (!player.user.bag.dragon[gid].dragon) {
                delete player.user.bag.dragon[gid];
                player.memData.dragongem_num--;
            }
        }
        player.markDirty('bag.dragon');

        onHandled();
    },

    // 踢掉玩家
    kick: function (player, req, resp, onHandled) {
        gPlayers.kick(req.uid);
        resp.code = 0;
        resp.desc = 'kick';
        onHandled();
    },

    kick_all: function (player, req, resp, onHandled) {
        for (var uid in gPlayers.players) {
            gPlayers.kick(+uid);
        }
        onHandled();
    },

    // 更改status,info数据
    status: function (player, req, resp, onHandled) {
        var user = player.user;
        do {
            for (var id in user.status) {
                if (req.args[id]) {
                    var value = req.args[id];
                    if (isNaN(value)) {
                        resp.code = 1; resp.desc = 'error ' + id; break;
                    }
                    if (id == 'level' && !gConfLevel[value]) {
                        resp.code = 1; resp.desc = 'error ' + id; break;
                    }
                    if (id == 'vip' && !gConfVip[value]) {
                        resp.code = 1; resp.desc = 'error ' + id; break;
                    }
                    if (+value != user.status[id]) {
                        user.status[id] = +value;
                        player.markDirty('status.' + id);
                        if (id == 'level') {
                            updateWssData(user._id, { level: +value });
                        } else if (id == 'vip') {
                            updateWssData(user._id, { vip: +value });

                            user.status.vip_xp = gConfVip[+value].cash;
                            player.markDirty('status.vip_xp');
                        } else if (id == 'vip_xp') {
                            value = (value - 0) || 0;

                            var tNotOver = true
                            var i = 0;
                            do {
                                if (!gConfVip[i + 1]) {
                                    tNotOver = false;
                                    break;
                                }
                                if (value >= gConfVip[i + 1].cash) {
                                    i++;
                                    continue;
                                }
                                tNotOver = false;
                            } while (tNotOver);

                            user.status.vip = gConfVip[i].level;
                            user.status.vip_xp = value;
                            player.markDirty('status.vip_xp');
                        } else if (id == 'food') {
                            user.mark.food_time = common.getTime();
                            player.addBttleProgress(+value);
                            player.markDirty('mark.food_time');
                        }
                    }
                }
            }

            if (req.args['paid']) {
                var value = (req.args['paid'] - 0) || 0;
                user.payment = user.payment || {};
                user.payment.paid = value;
                player.markDirty('status.payment');
            }

            for (var id in user.info) {
                if (req.args[id]) {
                    var value = req.args[id];
                    if (!isNaN(value)) {
                        value = +value;
                    }
                    if (value != user.status[id]) {
                        user.info[id] = value;
                        player.markDirty('info.' + id);
                        if (id == 'un') {
                            updateWssData(user._id, { un: value });
                        } else if (id == 'headpic') {
                            updateWssData(user._id, { headpic: value });
                        }
                    }
                }
            }
            var value = req.args.guide;
            if (value != user.mark.guide) {
                user.mark.guide = +value;
                player.markDirty('mark.guide');
            }
        } while (false);

        onHandled();
    },

    // 发放货币
    add: function (player, req, resp, onHandled) {
        do {
            if (!req.args.type || !req.args.value) {
                resp.code = 1; resp.desc = 'no type or value'; break;
            }
            if (isNaN(req.args.value)) {
                resp.code = 1; resp.desc = 'error value'; break;
            }
            var type = req.args.type;
            var value = Math.floor(+req.args.value);
            player.addAwards([['user', type, value]], req.mod, req.act);
            resp.data.value = player.user.status[type];
            if (type == 'cash') {
                resp.data.vip = player.user.status.vip;
            } else if (type == 'xp') {
                resp.data.level = player.user.status.level;
            }
        } while (false);

        onHandled()
    },

    // 删除装备
    delete_equip: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var eid = req.args.id;
            if (!eid || !user.bag.equip[eid]) {
                resp.code = 1; resp.desc = 'no this equip'; break;
            }
            if (user.bag.equip[eid].pos) {
                resp.code = 1; resp.desc = 'cannot delete this equip, it has been equiped'; break;
            }
            delete user.bag.equip[eid];
            player.memData.equip_num--;
            player.markDelete('bag.equip.' + eid);
        } while (false);

        onHandled();
    },

    // 更新装备
    update_equip: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var eid = req.args.eid;
            if (!eid || !user.bag.equip[eid]) {
                resp.code = 1; resp.desc = 'no this equip'; break;
            }
            var equip = user.bag.equip[eid];

            if (equip.pos) {
                player.markFightForceChanged(equip.pos);
            }

        } while (false);
        onHandled();
    },

    // 更改材料
    update_item: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var id = req.args.id;
            if (!id || !gConfItem[id]) {
                resp.code = 1; resp.desc = 'no this item'; break;
            }
            var num = req.args.num;
            var category = gConfItem[id].category;
            if (isNaN(num) || +num < 0) {
                resp.code = 1; resp.desc = 'num error'; break;
            }
            if (+num > 0) {
                user.bag[category][id] = Math.floor(+num);
                player.markDirty('bag.' + category + '.' + id);
            } else {
                delete user.bag[category][id];
                player.markDelete('bag.' + category + '.' + id);
            }
        } while (false);

        onHandled();
    },

    // 更改宝石
    update_gem: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var id = req.args.id;
            if (!id || !gConfGem[id]) {
                resp.code = 1; resp.desc = 'no this gem'; break;
            }
            var num = req.args.num;
            if (isNaN(num) || +num < 0) {
                resp.code = 1; resp.desc = 'num error'; break;
            }
            if (+num > 0) {
                user.bag.gem[id] = Math.floor(+num);
                player.markDirty('bag.gem.' + id);
            } else {
                delete user.bag.gem[id];
                player.markDelete('bag.gem.' + id);
            }
        } while (false);

        onHandled();
    },

    give_dragongem: function (player, req, resp, onHandled) {
        do {
            var num = Math.floor(req.args.num);
            if (isNaN(num) || +num < 0) {
                resp.code = 1; resp.desc = 'num error'; break;
            }

            var level = req.args.level;
            var type = req.args.type;
            for (var id in gConfDragonGem) {
                var conf = gConfDragonGem[id];
                if (conf.level == level) {
                    player.addAwards([['dragon', +id, num]], req.mod, req.act);
                    break;
                }
            }

            resp.data.dragon = player.user.bag.dragon;
        } while (false);

        onHandled();
    },

    // 删除龙晶
    delete_dragongem: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var gid = req.args.id;
            if (!gid || !user.bag.dragon[gid]) {
                resp.code = 1; resp.desc = 'no this dragongem'; break;
            }
            if (user.bag.dragon[gid].dragon) {
                resp.code = 1; resp.desc = 'it has been equiped'; break;
            }
            delete user.bag.dragon[gid];
            player.memData.dragongem_num--;
            player.markDelete('bag.dragon.' + gid);
        } while (false);

        onHandled();
    },

    // 更改卡牌
    update_hero: function (player, req, resp, onHandled) {
        do {
            var user = player.user;
            var id = req.args.id;
            if (!id || !gConfHero[id]) {
                resp.code = 1; resp.desc = 'no this hero'; break;
            }
            var num = req.args.num;
            if (isNaN(num) || +num < 0) {
                resp.code = 1; resp.desc = 'num error'; break;
            }

            user.bag.card[id] = Math.floor(+num);
            player.markDirty('bag.card.' + id);
        } while (false)

        onHandled();
    },

    // 更改小兵装备
    update_dress: function (player, req, resp, onHandled) {
        do {

            var user = player.user;
            var id = req.args.id;
            if (!id || !gConfSoldierDress[id]) {
                resp.code = 1; resp.desc = 'no this dress'; break;
            }
            var num = req.args.num;
            if (isNaN(num) || +num < 0) {
                resp.code = 1; resp.desc = 'num error'; break;
            }
            if (+num > 0) {
                user.bag.dress[id] = Math.floor(+num);
                player.markDirty('bag.dress.' + id);
            } else {
                delete user.bag.dress[id];
                player.markDelete('bag.dress.' + id);
            }
        } while (false);

        onHandled();
    },

    // 更改卡槽
    update_pos: function (player, req, resp, onHandled) {
        do {
            var user = player.user;

            var pos = req.args.id;
            if (!pos || !user.pos[pos]) {
                resp.code = 1; resp.desc = 'no this pos'; break;
            }

            var hid = req.args.hid;
            if (!hid || isNaN(hid)) {
                resp.code = 1; resp.desc = 'hid error'; break;
            }
            if (!gConfHero[hid]) {
                resp.code = 1; resp.desc = 'no this hid'; break;
            }
            for (var i in user.pos) {
                if (i != pos && +hid == user.pos[i].hid) {
                    resp.code = 1; resp.desc = 'hid repeat'; break;
                }
            }

            var slot = req.args.slot;
            if (!slot || isNaN(slot)) {
                resp.code = 1; resp.desc = 'slot error'; break;
            }
            slot = Math.floor(+slot);
            if (SlotArray.indexOf(slot) < 0) {
                resp.code = 1; resp.desc = 'no this slot'; break;
            }

            var level = req.args.level;
            if (!level || isNaN(level)) {
                resp.code = 1; resp.desc = 'level error'; break;
            }
            level = Math.floor(+level);
            if (!gConfLevel[level]) {
                resp.code = 1; resp.desc = 'no this level'; break;
            }

            var xp = req.args.xp;
            if (!xp || isNaN(xp)) {
                resp.code = 1; resp.desc = 'xp error'; break;
            }
            xp = Math.floor(+xp);

            var dlevel = req.args.dlevel;
            if (!dlevel || isNaN(dlevel)) {
                resp.code = 1; resp.desc = 'destiny level error'; break;
            }
            dlevel = Math.floor(+dlevel);
            if (!gConfDestiny[dlevel]) {
                resp.code = 1; resp.desc = 'no this destiny level'; break;
            }

            var quality = req.args.quality;
            if (!quality || isNaN(quality)) {
                resp.code = 1; resp.desc = 'quality error'; break;
            }
            quality = Math.floor(+quality);

            var energy = req.args.energy;
            if (!energy || isNaN(energy)) {
                resp.code = 1; resp.desc = 'energy error'; break;
            }
            energy = Math.floor(+energy);

            var talent = req.args.talent;
            if (!talent || isNaN(talent)) {
                resp.code = 1; resp.desc = 'talent error'; break;
            }
            talent = Math.floor(+talent);
            if (!gConfReborn['1'][talent]) {
                resp.code = 1; resp.desc = 'no this talent'; break;
            }

            var slevel = req.args.slevel;
            if (!slevel || isNaN(slevel)) {
                resp.code = 1; resp.desc = 'soldier level error'; break;
            }
            slevel = Math.floor(+slevel);
            if (!gConfSoldierLevel[gConfHero[hid].soldierId][slevel]) {
                resp.code = 1; resp.desc = 'no this soldier level'; break;
            }

            var sstar = req.args.sstar;
            if (!sstar || isNaN(sstar)) {
                resp.code = 1; resp.desc = 'soldier star error'; break;
            }
            sstar = Math.floor(+sstar);
            if (!gConfSoldierLevel[gConfHero[hid].soldierId][slevel][sstar]) {
                resp.code = 1; resp.desc = 'no this soldier star'; break;
            }

            var posObj = user.pos[pos];
            posObj.hid = +hid;
            posObj.level = +level;
            posObj.slot = +slot;
            posObj.xp = +xp;
            posObj.quality = +quality;
            posObj.destiny.level = +dlevel;
            posObj.destiny.energy = +energy;
            // 获取突破加成
            var oldTalent = posObj.talent;
            posObj.talent = +talent;
            player.getInnateByPos(pos, oldTalent);
            posObj.soldier.level = +slevel;
            posObj.soldier.star = sstar;

            player.getFateMap();
            player.markFightForceChanged(pos);

            player.markDirty('pos.' + pos);
            // by fish resp.data.fight_force = player.getHeroFightForce(pos);
            requestWorldByModAndAct({ uid: req.uid }, 'user', 'update');
        } while (false);

        onHandled();
    },

    // 更改副本星级和打斗次数
    update_progress: function (player, req, resp, onHandled) {
        do {
            var user = player.user;

            var cid = req.args.id;
            var battle = user.battle;
            if (cid > battle.progress + 1) {
                resp.code = 1; resp.desc = 'cannot access this city'; break;
            }
            var city = battle.city[cid];
            if (!city) {
                resp.code = 1; resp.desc = 'no this city'; break;
            }

            var star1 = Math.floor(+req.args.normal);
            var star2 = Math.floor(+req.args.elite);
            var star3 = Math.floor(+req.args.combat);
            var time1 = Math.floor(+req.args.normal_time);
            var time2 = Math.floor(+req.args.elite_time);
            var time3 = Math.floor(+req.args.combat_time);

            if (star1 < 0 || star1 > 3 || star2 < 0 || star2 > 3) {
                resp.code = 1; resp.desc = 'star error'; return;
            }
            //if(time1 < 0 || time1 > gConfCity[cid].limit1 || time2 < 0 || time2 > gConfCity[cid].limit2) {
            //    resp.code = 1; resp.desc = 'time error'; return;
            //}

            player.memData.all_star += star1 - city[1].star;
            player.memData.all_star += star2 - city[2].star;
            player.memData.star += star1 - city[1].star;
            player.memData.star += star2 - city[2].star;

            city[1].star = star1;
            city[1].time = time1;
            city[2].star = star2;
            city[2].time = time2;
            city[3].star = star3;
            city[3].time = time3;

            player.markDirty('battle.city.' + cid);
        } while (false);

        onHandled();
    },

    pass_all: function (player, req, resp, onHandled) {
        do {
            // 副本全通
            if (!config.SuperMan) {
                resp.code = 1; resp.desc = 'no super power'; break;
            }

            var user = player.user;
            var battle = player.user.battle;
            battle.city = {};
            var city = battle.city;
            for (var cid in gConfCustom) {
                city[cid] = {
                    '1': {
                        'star': 3,
                        'time': 0,
                        'reset_num': 0,
                    },

                    '2': {
                        'star': 3,
                        'time': 0,
                        'reset_num': 0,
                    },

                    '3': {
                        'star': 3,
                        'time': 0,
                        'reset_num': 0,
                    },
                };

                // 给奖励
                player.addAwards(gConfCustom[cid].first1);
                player.addAwards(gConfCustom[cid].first2);
                player.addAwards(gConfCustom[cid].first3);
            }

            battle.progress = +cid;
            battle.max_progress = +cid;
            player.markDirty('battle');
            player.updateHeadFrameStatus('mission_progress', battle.progress);

            var maxDragonId = Object.keys(gConfCustomDragon).max();
            for (var i = 1; i <= maxDragonId; i++) {
                if (!user.dragon[i]) {
                    user.dragon[i] = {
                        level: 1,
                        slot: {
                            1: 0,
                            2: 0,
                            3: 0,
                            4: 0,
                            5: 0,
                        },
                    };
                    player.markDirty('dragon.' + i);
                }
            }

            player.getStar();
        } while (false);

        onHandled();
    },

    reset_day: function (player, req, resp, onHandled) {
        player.resetByDay();
        onHandled();
    },

    reset_week: function (player, req, resp, onHandled) {
        player.resetByWeek();
        onHandled();
    },

    god: function (player, req, resp, onHandled) {
        do {
            if (!config.SuperMan) {
                resp.code = 1; resp.desc = 'no super power'; break;
            }

            // 设置基本信息
            var user = player.user;
            var status = user.status;
            for (var i = status.level; i < 150; i++) {
                status.xp += gConfLevel[i].exp;
            }
            player.addXp(0);
            status.gold = 80000000;
            status.cash = 800000;
            status.vip = 15;
            status.food = 600;
            status.luck = 80000000;
            status.tower = 8000;
            status.legion = 8000;
            status.soul = 800000;
            status.token = 8000;
            status.ntoken = 800;
            status.htoken = 800;
            status.gtoken = 800;
            status.mtoken = 800;
            status.rtoken = 800;
            status.egg = 8000;
            status.boon = 8000;
            status.wood = 8000;
            status.trial_coin = 800000;
            status.staying_power = 100;
            status.action_point = 300;
            status.rotate_score = 300;
            status.rotate_ncoin = 300;
            status.rotate_hcoin = 300;
            status.mine_1 = 1000;
            status.mine_2 = 1000;
            status.mine_3 = 1000;
            status.mine_4 = 1000;
            status.mine_5 = 1000;
            status.goods = 1000;                            // 物资
            status.countrywar = 1000;                       // 军资
            status.country_score = 1000;                    // 国战积分
            status.salary = 1000;                           // 皇城俸禄
            status.sky_book = 1000;                         // 技能书
            status.wine = 1000;                             // 朗姆酒
            status.star = 1000;                             // 星星
            status.moon = 1000;                             // 月亮
            status.sun = 1000;                              // 太阳
            status.rune_exp = 1000;                         // 符文经验
            status.rune_crystal = 1000;                     // 符文结晶
            status.godsoul = 1000;                          // 神之魂晶
            status.smelt = 1000;                            // 魔晶，装备分解产物
            status.atoken = 1000;                           // 竞技场门票
            status.active = 1000;                           // 活跃度
            status.digging = 1000;                          // 矿锄数量
            status.rob = 1000;                              // 占地凭证

            // 清除新手引导
            user.mark.guide = 0;
            user.mark.func_guide = 0;

            // 放置武将
            // 武将升星
            var maxQuality = Object.keys(gConfHeroQuality).max();
            var allRedCards = [];
            for (var hid in gConfHero) {
                var heroCombatConf = getHeroCombatConf(hid);
                if (heroCombatConf) {
                    if (heroCombatConf.quality == Quality.RED && heroCombatConf.camp != 5) {
                        allRedCards.push(+hid);
                    }
                } else {
                    DEBUG('can not find combat conf, hid = ' + hid);
                }
            }
            var cardToHeros = allRedCards;
            if (cardToHeros.length < MaxPos - 1) {
                var allOrangeCards = [];
                for (var hid in gConfHero) {
                    var heroCombatConf = getHeroCombatConf(hid);
                    if (heroCombatConf) {
                        if (heroCombatConf.quality == Quality.ORANGE && heroCombatConf.camp != 5) {
                            allOrangeCards.push(+hid);
                        }
                    } else {
                        DEBUG('can not find hero combat conf, hid = ' + hid);
                    }
                }
                cardToHeros.combine(common.randArrayWithNum(allOrangeCards, MaxPos - allRedCards.length - 1));
            }

            for (var i = 1; i <= MaxPos; i++) {
                if (i != 1) {
                    user.pos[i].hid = cardToHeros[i - 2];
                }
                user.pos[i].talent = 15;
                user.pos[i].slot = i;
                user.pos[i].level = 150;

                //if (i != 1) // 不是主公
                user.pos[i].promote = [];

                user.pos[i].destiny.level = 15;
                user.pos[i].soldier.level = 10;
                user.pos[i].soldier.star = 5;
                user.pos[i].soldier.dress = { '1': 0, '2': 0, '3': 0, '4': 0, };

                for (var j = 1; j <= HeroPartCount; j++) {
                    user.pos[i].part[j] =
                    {
                        level: 10,
                        exp: 0,
                        awake_level: 10,
                        max_awake: true,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    };
                }

                user.pos[i].quality = maxQuality;
            }

            // 删除之前装备
            user.bag.equip = {};

            var allMaxLevelGems = {};
            for (gid in gConfGem) {
                if (gConfGem[gid].level == 12) {
                    allMaxLevelGems[gConfGem[gid].type] = gid;
                }
            }

            // 穿装备
            for (var eid in gConfEquip) {
                DEBUG('eid = ' + eid);
                if (gConfEquip[eid].quality >= Quality.ORANGE) {
                    var type = gConfEquip[eid].type;
                    for (var i = 1; i <= MaxPos; i++) {
                        var equipId = player.addEquip(eid, 3, 200, 60, 'gm', 'god');
                        var equip = player.user.bag.equip[equipId];


                        // 避免重复穿装备
                        if (!user.pos[i].equip[type]) {
                            user.pos[i].equip[type] = equipId;
                            user.bag.equip[equipId].pos = i;
                        }
                    }
                }
            }

            // 缘分激活
            for (var pos in user.pos) {
                var posObj = user.pos[pos];
                var heroCombatConf = getHeroCombatConf(posObj.hid);
                if (heroCombatConf.camp != 5) {
                    var fates = heroCombatConf.fateGroup
                    for (var i = 0, len = fates.length; i < len; i++) {
                        if (!fates[i]) {
                            break;
                        }

                        var confFate = gConfFate[fates[i]];
                        var assistArr = posObj.assist[fates[i]] = [];
                        for (var j = 1; j <= 5; j++) {
                            var fateHid = confFate['hid' + j];
                            if (fateHid == posObj.hid || !fateHid) {
                                continue;
                            }

                            assistArr.push(fateHid);
                        }
                    }
                }
            }

            player.markDirty('status');
            player.markDirty('mark');
            player.markDirty('pos');
            for (var i = 1; i <= MaxPos; i++) {
                player.markFightForceChanged(i);
            }
            for (var pos in player.user.pos) {
                for (var etype in player.user.pos[pos].equip) {
                    player.memData.pos[pos].equip_changed[etype] = 1;
                }
            }

            // 发武将卡
            user.bag.card = {};
            for (var id in gConfHero) {
                var combatConf = getHeroCombatConf(id);
                if (combatConf && gConfHero[id].camp != 5 && combatConf.quality < 7) {
                    player.addAwards([['card', id, 99]], req.mod, req.act);
                }
            }

            // 发宝石
            user.bag.gem = {};
            for (var id in gConfGem) {
                player.addAwards([['gem', id, 30]], req.mod, req.act);
            }

            // 发材料
            user.bag.material = {};
            user.bag.fragment = {};
            for (var id in gConfItem) {
                player.addAwards([[gConfItem[id].category, id, 9999]], req.mod, req.act);
            }

            // 发小兵装备
            user.bag.dress = {};
            for (var id in gConfSoldierDress) {
                player.addAwards([['dress', +id, 9999]], req.mod, req.act);
            }

            // 升级主角品质
            //user.custom_king.chapter = 4;
            user.custom_king.index = 3;

            user.bag.dragon = {};
            player.markDirty('status');
            player.markDirty('mark');
            player.markDirty('pos');
            player.markDirty('bag');

            for (var i = 1; i <= MaxPos; i++) {
                player.markFightForceChanged(i);
            }

            // 君主技能
            var skills = Object.keys(gConfCustomDragon);
            skills.remove('1');
            for (var i = 1; i <= 5; i++) {
                var randSkill = common.randArray(skills);
                skills.remove(randSkill);
                user.skills[i].id = +randSkill;
                user.skills[i].level = 5;
            }
            player.markDirty('skills');

            var maxDragonId = Object.keys(gConfCustomDragon).max();
            user.dragon = {};
            for (var i = 1; i <= maxDragonId; i++) {
                user.dragon[i] = {
                    level: 5,
                    slot: {
                        1: player.addDragonGem(110, 'gm', 'god'),
                        2: player.addDragonGem(110, 'gm', 'god'),
                        3: player.addDragonGem(110, 'gm', 'god'),
                        4: player.addDragonGem(110, 'gm', 'god'),
                        5: player.addDragonGem(110, 'gm', 'god'),
                    },
                };

                for (var j = 1; j <= 5; j++) {
                    player.user.bag.dragon[player.user.dragon[i].slot[j]].dragon = i * 100 + j;
                }
            }
            player.markDirty('dragon');

            // 人皇套装
            user.sky_suit.weapon_level = 10;
            user.sky_suit.weapon_energy = 0;
            user.sky_suit.weapon_energy_target = 0;
            user.sky_suit.weapon_clean_time = 0;
            user.sky_suit.weapon_gas = 200;
            user.sky_suit.weapon_blood = 100;
            user.sky_suit.weapon_illusion = 10;
            user.sky_suit.weapon_collect = 0;
            for (var id in gConfSkyChange[1]) {
                if (gConfSkyChange[1][id].kind == 2) {
                    user.sky_suit.weapon_illusion_equip[id] = 1;
                } else {
                    user.sky_suit.weapon_illusion_equip_time[id] = common.getTime() + 86400;
                }
                user.sky_suit.weapon_collect++;
            }
            user.sky_suit.weapon_skills = {
                1: 100,
                2: 100,
                3: 100,
                4: 100,
            };

            user.sky_suit.wing_level = 10;
            user.sky_suit.wing_energy = 0;
            user.sky_suit.wing_energy_target = 0;
            user.sky_suit.wing_clean_time = 0;
            user.sky_suit.wing_gas = 200;
            user.sky_suit.wing_blood = 100;
            user.sky_suit.wing_illusion = 10;
            user.sky_suit.wing_collect = 0;
            for (var id in gConfSkyChange[2]) {
                if (gConfSkyChange[2][id].kind == 2) {
                    user.sky_suit.wing_illusion_equip[id] = 1;
                } else {
                    user.sky_suit.wing_illusion_equip_time[id] = common.getTime() + 86400;
                }
                user.sky_suit.wing_collect++;
            }
            user.sky_suit.wing_skills = {
                1: 100,
                2: 100,
                3: 100,
                4: 100,
            };
            player.markDirty('sky_suit');

            player.getPlayerMemData(true);
            player.resetByDay(getGameDate());
            player.resetByWeek();

            resp.data.user = user;
        } while (false);

        onHandled();
    },

    give_equip: function (player, req, resp, onHandled) {
        var eid = +req.args.eid;
        var godId = +req.args.god_id;
        var num = +req.args.num;

        resp.data.equips = player.addAwards([['equip', eid, godId, num]], req.mod, req.act);

        onHandled();
    },

    give_hero: function (player, req, resp, onHandled) {
        var heroId = req.args.id;
        player.addAwards([['card', heroId, 1]], req.mod, req.act);

        onHandled();
    },

    pass_progress: function (player, req, resp, onHandled) {
        do {
            var argsId = +req.args.id;
            if (!gConfCustom[argsId]) {
                resp.code = 1; resp.desc = 'invalid city'; break;
            }

            var user = player.user;
            var battle = user.battle;
            var city = battle.city;
            while (battle.progress < argsId) {
                var maxProgress = battle.max_progress;
                if (battle.progress == maxProgress) {
                    var nextGroup = gConfCustom[maxProgress + 1].openFogId;
                    maxProgress++;
                    while (gConfCustom[maxProgress] && gConfCustom[maxProgress].openFogId == nextGroup) {
                        city[maxProgress] = {
                            '1': {
                                'star': 0,
                                'time': 0,
                                'reset_num': 0,
                            },

                            '2': {
                                'star': 0,
                                'time': 0,
                                'reset_num': 0,
                            },

                            '3': {
                                'star': 0,
                                'time': 0,
                                'reset_num': 0,
                            },
                        };
                        maxProgress++;
                    }
                    maxProgress--;
                }

                for (var i = battle.progress + 1; i <= maxProgress && i <= argsId; i++) {
                    city[i][1].star = 3;
                    city[i][2].star = 3;
                    city[i][3].star = 3;

                    // 检查是否有龙获取
                    var dragonId = 0;
                    for (var id in gConfCustomDragon) {
                        var dragConf = gConfCustomDragon[id];
                        if (dragConf.limitCustom == i) {
                            dragonId = parseInt(id);
                            break;
                        }
                    }

                    if (dragonId > 0) {
                        if (!user.dragon[dragonId]) {
                            user.dragon[dragonId] = {
                                level: 1,
                                slot: {
                                    1: 0,
                                    2: 0,
                                    3: 0,
                                    4: 0,
                                    5: 0,
                                },
                            };
                            player.markDirty('dragon.' + dragonId);

                            // 通知客户端新获取的龙id
                            resp.data.dragon = dragonId;
                        }
                    }

                    battle.progress++;
                }

                battle.max_progress = maxProgress;
            }
            player.markDirty('battle');
            player.getStar();
            resp.data.battle = battle;

            player.updateHeadFrameStatus('mission_progress', battle.progress);
        } while (false);

        onHandled();
    },

    back_progress: function (player, req, resp, onHandled) {
        do {
            var id = Math.floor(+req.args.id);
            if (!gConfCustom[id]) {
                resp.code = 1; resp.desc = 'invalid city'; break;
            }

            var battle = player.user.battle;
            var city = battle.city;
            if (battle.progress < id) {
                resp.code = 1; resp.desc = 'invalid id'; break;
            }

            var maxProgress = battle.max_progress;
            var rebackIndex = maxProgress;
            if (gConfCustom[id].openFogId == gConfCustom[maxProgress].openFogId) {
                // 和当前城池同一组
                rebackIndex = battle.progress;
            } else {
                // 和当前城池不同组
                var newMaxProgress = id;
                var group = gConfCustom[id].openFogId;
                while (gConfCustom[++newMaxProgress].openFogId == group);
                newMaxProgress--;
                rebackIndex = newMaxProgress;
                battle.max_progress = newMaxProgress;
                player.markDirty('battle.max_progress');
                for (var i = newMaxProgress + 1; i <= maxProgress; i++) {
                    delete city[i];
                    player.markDelete('battle.city.' + i);
                }
            }

            for (var i = id + 1; i <= rebackIndex; i++) {
                city[i] = {
                    '1': {
                        'star': 0,
                        'time': 0,
                        'reset_num': 0,
                    },

                    '2': {
                        'star': 0,
                        'time': 0,
                        'reset_num': 0,
                    },

                    '3': {
                        'star': 0,
                        'time': 0,
                        'reset_num': 0,
                    },
                };
                player.markDirty('battle.city.' + i);
            }

            battle.progress = id;
            player.markDirty('battle.progress');
            player.updateHeadFrameStatus('mission_progress', battle.progress);

            player.getStar();
            resp.data.battle = battle;
        } while (false);

        onHandled();
    },

    reset_progress: function (player, req, resp, onHandled) {
        var battle = player.user.battle;
        var city = battle.city;
        for (var id in city) {
            city[id]['1'].time = 0;
            city[id]['2'].time = 0;
            city[id]['3'].time = 0;
        }
        player.markDirty('battle.city');

        resp.data.battle = battle;
        onHandled();
    },

    zero_progress_tribute: function (player, req, resp, onHandled) {
        var battle = player.user.battle;
        battle.tribute = 0;
        player.markDirty('battle.tribute');

        var boxConf = gConfFeilongFly[battle.progress];
        if (boxConf && boxConf.action1) {
            battle.passbox = 1;
            player.markDirty('battle.passbox');
        }
        onHandled();
    },

    change_tavern: function (player, req, resp, onHandled) {
        var tavern = player.user.tavern;
        for (var id in tavern) {
            if (id in req.args) {
                if (id == 'nfree' && req.args[id] > gConfGlobal.freeTavernPerDay) {
                    resp.code = 1; resp.desc = 'error ' + id; onHandled(); return;
                }
                tavern[id] = +req.args[id];
            }
        }

        player.markDirty('tavern');
        onHandled();
    },

    change_shop: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    change_mine: function (player, req, resp, onHandled) {
        var mine = player.user.mine;
        for (var id in mine) {
            if (id in req.args) {
                mine[id] = +req.args[id];
            }
        }
        player.markDirty('mine');

        onHandled();
    },

    change_arena: function (player, req, resp, onHandled) {
        var arena = player.user.arena;
        for (var id in arena) {
            if (id in req.args) {
                arena[id] = +req.args[id];
            }
        }

        player.markDirty('arena');
        onHandled();
    },

    change_tower: function (player, req, resp, onHandled) {
        var tower = player.user.tower;
        var curFloor = +req.args.cur_floor;
        var reset = +req.args.reset || 0;

        if (curFloor > gMaxFloorInTower) {
            curFloor = gMaxFloorInTower;
        }

        tower.cur_floor = curFloor;
        if (tower.top_floor < curFloor) {
            tower.top_floor = curFloor;
        }
        tower.reset_num = reset;

        player.markDirty('tower');
        onHandled();
    },

    change_day_money: function (player, req, resp, onHandled) {
        var payment = player.user.payment;
        if (req.args.day_money) {
            payment.day_money = +req.args.day_money;
            player.markDirty('payment.day_money');
        }

        onHandled();
    },

    change_unlimited_city: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    change_assistfight: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    change_unlimited_chapter: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    change_paid: function (player, req, resp, onHandled) {
        var payOnly = player.user.activity.pay_only;
        if (req.args.change_paid) {
            payOnly.paid = +req.args.change_paid;
            player.markDirty('activity.pay_only.paid');
        }

        onHandled();
    },

    change_login_day: function (player, req, resp, onHandled) {
        var loginGoodgift = player.user.activity.login_goodgift;
        if (req.args.login_day) {
            loginGoodgift.login = +req.args.login_day;
            player.markDirty('activity.login_goodgift.login');
        }

        onHandled();
    },

    reset_mine_duration: function (player, req, resp, onHandled) {
        var worldReq = {
            mod: 'mine',
            act: 'reset_mine_duration',
            uid: req.uid,
            args: {
                level_id: player.user.mine.level_id,
                zone_id: player.user.mine.zone_id,
            },
        };
        requestWorld(worldReq, resp, function () {
            onHandled();
        });
    },

    reset_tower: function (player, req, resp, onHandled) {
        player.user.tower = {
            'top_floor': 0,
            'top_time': 0,
            'cur_floor': 0,
            'sweep_start_time': 0,
            'reset_num': 0,
            'get_effort': [],
        };
        player.markDirty('tower');
        onHandled();
    },

    // 只能添加系统私人邮件
    add_mail: function (player, req, resp, onHandled) {
        do {
            if (!req.args.title) {
                resp.code = 1; resp.desc = 'no title'; break;
            }
            var title = unescape(req.args.title);
            if (!title || title.length > gConfGlobal.mailTitileMaxLength) {
                resp.code = 1; resp.desc = 'title length error'; break;
            }

            if (!req.args.content) {
                resp.code = 1; resp.desc = 'no content'; break;
            }
            var content = unescape(req.args.content);
            if (!content || content.length > gConfGlobal.mailContentMaxLength) {
                resp.code = 1; resp.desc = 'content length error'; break;
            }

            var awards = null;
            if (req.args.awards) {
                awards = (new Buffer(req.args.awards, 'base64')).toString('utf8');
                try {
                    awards = JSON.parse(awards);
                    if (typeof (awards) != 'object') {
                        resp.code = 1; resp.desc = 'awards error'; break;
                    }
                } catch (error) {
                    resp.code = 1; resp.desc = 'awards error'; break;
                }
            }

            if (!req.args.expire) {
                resp.code = 1; resp.desc = 'no expire'; break;
            }
            var expire = +req.args.expire;

            var mail = {
                from: 0,
                title: title,
                content: content,
                awards: awards,
                time: common.getTime(),
                expire: expire,
            };

            var reqWorld = {
                mod: 'mail',
                act: 'add_mail',
                uid: req.uid,
                args: {
                    mail: mail,
                },
            };

            requestWorld(reqWorld, resp, function () {
                if (resp.code == 0) {
                    resp.data.mail = mail;
                }
                onHandled();
            });
            return;
        } while (false);

        onHandled();
    },

    // 添加全服邮件或者公告
    add_sys_mail: function (player, req, resp, onHandled) {
        do {
            if (!req.args.type) {
                resp.code = 1; resp.desc = 'no type'; break;
            }
            var type = req.args.type;

            if (!req.args.title) {
                resp.code = 1; resp.desc = 'no title'; break;
            }
            var title = unescape(req.args.title);
            if (!title || title.length > gConfGlobal.mailTitileMaxLength) {
                resp.code = 1; resp.desc = 'title length error'; break;
            }

            if (!req.args.content) {
                resp.code = 1; resp.desc = 'no content'; break;
            }
            var content = unescape(req.args.content);
            if (!content || content.length > gConfGlobal.mailContentMaxLength) {
                resp.code = 1; resp.desc = 'content length error'; break;
            }

            var awards = null;
            if (req.args.awards) {
                awards = (new Buffer(req.args.awards, 'base64')).toString('utf8');
                try {
                    awards = JSON.parse(awards);
                    if (typeof (awards) != 'object') {
                        desc = 'awards error'; break;
                    }
                } catch (error) {
                    resp.code = 1; resp.desc = 'awards error'; break;
                }
            }

            if (!req.args.expire) {
                resp.code = 1; resp.desc = 'no expire'; break;
            }
            var expire = +req.args.expire;

            var mail = {
                type: 'all_user',
                title: title,
                content: content,
                awards: awards,
                time: common.getTime(),
                expire: expire,
            };

            var reqWorld = {
                mod: 'mail',
                act: 'add_sys_mail',
                uid: req.uid,
                args: {
                    mail: mail,
                },
            };

            requestWorld(reqWorld, resp, function () {
                if (resp.code == 0) {
                    resp.data.mail = mail;
                }
                onHandled();
            });
            return;
        } while (false);

        onHandled();
    },

    /** 礼包邮件 */
    add_gift_mail: function (player, req, resp, onHandled) {
        do {
            // var gameid = req.args.gameid; //游戏ID
            // var eyou_uid = req.args.eyou_uid; //Eyou平台用户ID
            var s_id = req.args.s_id; //游戏服务器ID
            var role_id = req.args.role_id; //游戏角色ID
            var is_all = req.args.is_all - 0; //是否给全服玩家发送礼包，0=否，1=是。注：1）全服是指向s_id参数指定的服的所有已有玩家发放礼包，并非向所有服的所有玩家；2）仅向已有的角色发放，新创建的角色不会收到礼包
            var pid = req.args.pid; //礼包ID


            var tGiftMailInfo = global.gConfGiftMail[pid];
            if (!tGiftMailInfo) {
                resp.code = 0;
                resp.reason = 'error pid';
                break;
            }

            req.args.title = req.args.title;
            req.args.content = req.args.content;
            // req.args.title = tGiftMailInfo.title;
            // req.args.content = tGiftMailInfo.content;
            req.args.awards = new Buffer(JSON.stringify(tGiftMailInfo.rewards)).toString('base64');
            req.args.expire = common.getTime() + tGiftMailInfo.time * 3600 * 24;

            if (is_all) {                                                       // 发给全服
                req.args.type = "gift_mail"
                req.args.method = "add_sys_mail"
            }
            else if (role_id) {                                               // 指定发给某人
                req.args.uid = role_id;
                req.args.method = "add_mail"
            }

            exports.gm(player, req, resp, onHandled)
            return;
        } while (false);

        onHandled();
    },

    change_rescopy: function (player, req, resp, onHandled) {
        onHandled();
    },

    change_shipper: function (player, req, resp, onHandled) {
        do {
            var args = req.args;
            player.user.shipper = {
                'delivery': +args.delivery,
                'rob': +args.rob,
                'rob_time': +args.rob_time,
                'type': +args.type,
                'free': +args.free,
            };
            player.markDirty('shipper');
        } while (false);

        onHandled();
    },

    get_sys_mails: function (player, req, resp, onHandled) {
        getMailsAndBulletins(req.uid, {}, resp.data, function () {
            if (resp.data.mails) {
                for (var i = 0; i < resp.data.mails.length; i++) {
                    var mail = resp.data.mails[i];
                    mail.unicode = getMailUniCode(mail);
                }
            }
            if (resp.data.bulletins) {
                for (var i = 0; i < resp.data.bulletins.length; i++) {
                    var bulletin = resp.data.bulletins[i];
                    bulletin.unicode = getMailUniCode(bulletin);
                }
            }
            onHandled();
        });
    },

    del_sys_mail: function (player, req, resp, onHandled) {
        do {
            if (!req.args.unicode) {
                resp.code = 1; resp.desc = 'no unicode'; break;
            }

            var worldReq = {
                mod: 'mail',
                act: req.args.method,
                uid: req.uid,
                args: {
                    unicode: req.args.unicode,
                },
            };
            requestWorld(worldReq, resp, function () {
                onHandled();
            });
            return;
        } while (false);

        onHandled();
    },

    change_self_legion: function (player, req, resp, onHandled) {
        var legion = player.user.new_legion;
        for (var id in legion) {
            if (req.args[id]) {
                if (id == 'shake_count' && req.args[id] > gConfGlobal.shakeGoldTreeCount) {
                    resp.code = 1; resp.desc = 'error ' + id; onHandled(); return;
                }
                if (id == 'trial_count' && req.args[id] > gConfGlobal.legionTrialMaxCount) {
                    resp.code = 1; resp.desc = 'error ' + id; onHandled(); return;
                }
                if (id == 'trial_stars' && (req.args[id] > 15 || req.args[id] < 0)) {
                    resp.code = 1; resp.desc = 'error ' + id; onHandled(); return;
                }
                legion[id] = +req.args[id];
            }
        }

        player.markDirty('legion');
        onHandled();
    },

    change_world_legion: function (player, req, resp, onHandled) {
        requestWorldByModAndAct({ uid: req.uid }, 'new_legion', 'gm_change_legion', req.args, onHandled);
    },

    clear_month_card: function (player, req, resp, onHandled) {
        player.user.payment.month_card = 0;
        player.markDirty('payment.month_card');
        player.updateHeadFrameStatus('month_card', 0);
        LOG(util.format(`-- gm 重置月卡 ${player.user.info.uid}`));
        onHandled();
    },

    clear_week_card: function (player, req, resp, onHandled) {
        player.user.payment.week_card = 0;
        player.markDirty('payment.week_card');
        player.updateHeadFrameStatus('week_card', 0);
        LOG(util.format(`-- gm 重置周卡 ${player.user.info.uid}`));
        onHandled();
    },

    open_field: function (player, req, resp, onHandled) {
        onHandled();
    },

    close_field: function (player, req, resp, onHandled) {
        onHandled();
    },

    change_guard: function (player, req, resp, onHandled) {
        onHandled();
    },

    change_field: function (player, req, resp, onHandled) {
        onHandled();
    },

    change_treasure: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    change_dragon: function (player, req, resp, onHandled) {
        player.user.dragon[req.args.dragon_id].level = +req.args.dragon_level;
        player.markDirty(util.format('dragon.%d.level', req.args.dragon_id));
        onHandled();
    },

    ban_chat: function (player, req, resp, onHandled) {

        var wssReq = {
            uid: 1,
            mod: 'chat',
            act: 'ban_chat',
            args: {
                uid: player.user.info.uid,
            }
        };
        requestWss(wssReq, resp, onHandled);
    },

    reset_jade_seal: function (player, req, resp, onHandled) {
        // 废弃
        onHandled();
    },

    fix_open_seven: function (player, req, resp, onHandled) {
        var oldOpenSeven = clone(player.user.activity.open_seven);
        player.openOpenSeven();
        var openSeven = player.user.activity.open_seven;
        openSeven.open_day = oldOpenSeven.open_day;
        for (var id in oldOpenSeven.progress) {
            var progress = openSeven.progress[id];
            if (progress) {
                openSeven.progress[id][1] = oldOpenSeven.progress[id][1];
            }
        }
        player.markDirty('activity.open_seven');
        onHandled();
    },

    fix_position: function (player, req, resp, onHandled) {
        requestWorldByModAndAct({ uid: req.uid }, 'country', 'fix_position', {}, onHandled);
    },

    reset_world: function (player, req, resp, onHandled) {
        requestWorldByModAndAct({ uid: req.uid }, 'user', 'reset_world', {}, onHandled);
    },

    reset: function (player, req, resp, onHandled) {
        player.resetByDay(getGamesky_suitDate());
        player.resetByWeek();
        player.resetByMonth();

        onHandled();
    },

    legion_promote: function (player, req, resp, onHandled) {
        requestWorldByModAndAct({ uid: req.uid }, 'legion', 'gm_promote', {}, onHandled);
    },

    open_verify: function (player, req, resp, onHandled) {
        gVerify = 1;
        onHandled();
    },

    close_verify: function (player, req, resp, onHandled) {
        gVerify = 0;
        onHandled();
    },

    open_cdkey: function (player, req, resp, onHandled) {
        gCDKey = 1;
        onHandled();
    },

    close_cdkey: function (player, req, resp, onHandled) {
        gCDKey = 0;
        onHandled();
    },

    add_gm_notice: function (player, req, resp, onHandled) {
        var wssReq = clone(req);
        wssReq.args.content = unescape(wssReq.args.content);
        wssReq.mod = 'chat';
        wssReq.act = 'notice';
        requestWss(wssReq, resp, onHandled);
    },

    change_task_active: function (player, req, resp, onHandled) {
        player.user.task.active = +req.args.active;
        player.markDirty('task.active');
        onHandled();
    },

    change_sky_suit: function (player, req, resp, onHandled) {
        var skySuit = player.user.sky_suit;
        for (var id in skySuit) {
            if (id in req.args) {
                skySuit[id] = +req.args[id];
            }

            var skyType = id.split('_')[0];
            var gConfSky = player.keyFindConf(skyType);
            skySuit[skyType + '_energy_target'] = common.seededRandom(gConfSky[+req.args[id]].energyMin, gConfSky[+req.args[id]].energyMax);
            player.markDirty('sky_suit.' + skyType + '_energy_target');


            /*if (id == 'weapon_level') {
                skySuit.weapon_energy_target = common.seededRandom(gConfSkyWeap[+req.args[id]].energyMin, gConfSkyWeap[+req.args[id]].energyMax);
                player.markDirty('sky_suit.weapon_energy_target');
            } else if (id == 'wing_level') {
                skySuit.wing_energy_target = common.seededRandom(gConfSkyWing[+req.args[id]].energyMin, gConfSkyWing[+req.args[id]].energyMax);
                player.markDirty('sky_suit.wing_energy_target');
            } else if (id == 'mount_level') {
                skySuit.wing_energy_target = common.seededRandom(gConfSkyMount[+req.args[id]].energyMin, gConfSkyMount[+req.args[id]].energyMax);
                player.markDirty('sky_suit.mount_energy_target');
            }else if (id == 'weapon_gas') {
                if (skySuit.weapon_gas >= gConfSkyGasAwaken[1][skySuit.weapon_level].num) {
                    resp.code = 1; resp.desc = 'than limit num'; break;
                }
            } else if (id == 'weapon_blood') {
               if (skySuit.weapon_blood >= gConfSkyBloodAwaken[1][skySuit.weapon_level].num) {
                   resp.code = 1; resp.desc = 'than limit num'; break;
               }
            } else if (id == 'wing_gas') {
                if (skySuit.wing_gas >= gConfSkyGasAwaken[2][skySuit.wing_level].num) {
                    resp.code = 1; resp.desc = 'than limite num'; break;
                }
            } else if (id == 'wing_blood') {
                if (skySuit.wing_blood >= gConfSkyBloodAwaken[2][skySuit.wing_level].num) {
                    resp.code = 1; resp.desc = 'than limite num'; break;
                }
            }*/
        }

        player.markDirty('sky_suit');
        onHandled();
    },

    sync_server_info: function (player, req, resp, onHandled) {
        server.loadGlobalServerConf('game');
        server.scheduleActivity();
        requestWorldByModAndAct({ uid: req.uid }, 'gm', 'sync_server_info', {}, onHandled);
        requestWorldByModAndAct({ uid: req.uid }, 'activity', 'reset_open_rank', {}, onHandled);
        onHandled();
    },

    // 多人邮件
    add_mail_multi: function (player, req, resp, onHandled) {
        do {

            if (!req.args.title) {
                resp.code = 1; resp.desc = 'no title'; break;
            }
            var title = unescape(req.args.title);
            if (!title || title.length > gConfGlobal.mailTitileMaxLength) {
                resp.code = 1; resp.desc = 'title length error'; break;
            }

            if (!req.args.content) {
                resp.code = 1; resp.desc = 'no content'; break;
            }
            var content = unescape(req.args.content);
            if (!content || content.length > gConfGlobal.mailContentMaxLength) {
                resp.code = 1; resp.desc = 'content length error'; break;
            }

            var uids = (new Buffer(req.args.uids, 'base64')).toString('utf8')
            var awards = (new Buffer(req.args.awards, 'base64')).toString('utf8')

            try {

                uids = JSON.parse(uids)
                awards = JSON.parse(awards)

                if (typeof (uids) != 'object' || typeof (awards) != 'object') {
                    resp.code = 1; resp.desc = 'awards error'; break;
                }
            } catch (error) {
                resp.code = 1; resp.desc = 'awards error'; break;
            }

            var times = 0

            for (var i = 0; i < uids.length; i++) {
                times++

                var mail = {
                    from: 0,
                    title: title,
                    content: content,
                    awards: awards,
                    time: common.getTime(),
                    expire: req.args.expire,
                }

                var reqWorld = {
                    mod: 'mail',
                    act: 'add_mail',
                    uid: uids[i],
                    args: {
                        mail: mail,
                    },
                }

                requestWorld(reqWorld, resp, function () {
                    if (resp.code == 0) {
                        resp.data.mail = mail;
                    }

                    times--

                    if (times == 0) {
                        onHandled()
                    }
                })
            }

            return
        } while (false)

        onHandled()
    },
    // 系统跑马灯
    add_sysMsg: function (player, req, resp, onHandled) {
        do {

            if (!req.args.start_expire) {
                resp.code = 1; resp.desc = 'no title'; break;
            }
            if (!req.args.end_expire) {
                resp.code = 1; resp.desc = 'no content'; break;
            }
            if (!req.args.cn_content && !req.args.tcn_content && !req.args.en_content) {
                resp.code = 1; resp.desc = 'no content'; break;
            }
            var reqWorld = {
                mod: 'gmPushSysMsg',
                act: 'addSysMsg',
                uid: 10000,
                args: req.args,
            }

            requestWorld(reqWorld, resp, function () {
                onHandled()
            });

            console.info("-------------" + req.args.start_expire + "  " + req.args.end_expire + "  " + req.args.cn_content);


            return
        } while (false)

        onHandled()
    },
};



exports.gm = function (player, req, resp, onHandled) {
    do {
        var method = req.args.method;
        var user = player.user;
        var uid = player.uid;

        var handler = methods[method];
        if (!handler) {
            resp.code = 1; resp.desc = 'method not support'; break;
        }

        if (!config.NoHack) {
            var phpReq = {
                uid: 10000,
                act: 'gm_auth',
                args: {
                    client_ip: req.args.client_ip || req.ip,
                },
            };
            var phpResp = {};
            requestPHP(phpReq, phpResp, function () {
                if (phpResp.code == 0) {
                    handler(player, req, resp, onHandled);
                } else {
                    resp.code = phpResp.code;
                    resp.desc = phpResp.desc;
                    onHandled();
                }
            });
            return;
        } else {
            handler(player, req, resp, onHandled);

            // 记录GM日志
            GMLogCollect(req.ip, req.uid.toString(), JSON.stringify(req.args))

            return;
        }
    } while (false);

    onHandled();
};

exports.pay = function (player, req, resp, onHandled) {
    do {
        if (isNaN(req.args.cash)) {
            resp.code = 1;
            resp.desc = 'invalid key or cash';
            break;
        }

        var cash = parseInt(req.args.cash);
        var chargeId = parseInt(req.args.charge_id);
        var giftCode = req.args.gift_code;

        var giftKey = null;
        var giftId = null;
        if (giftCode) {
            var arr = giftCode.split('_');
            giftKey = arr[0];
            giftId = parseInt(arr[1]);
        }

        var user = player.user;
        var payment = user.payment;

        if (!giftKey && gConfRecharge['weekCard'] == chargeId && payment.week_card > 0) {
            resp.code = 2;
            resp.desc = `payment.week_card=${payment.week_card}`;
            break;
        }

        if (!giftKey && gConfRecharge['monthCard'] == chargeId && payment.month_card > 0) {
            resp.code = 3;
            resp.desc = `payment.month_card=${payment.month_card}`;
            break;
        }

        if (!giftKey && gConfRecharge['weekCard'] == chargeId) {
            var tOldDayNum = payment.week_card;
            payment.week_card += gConfGlobalNew.weekCardDuration;
            LOG(`-- 购买周卡 ${payment.week_card} [ ${tOldDayNum} - ${gConfGlobalNew.weekCardDuration} ]`);
            for (var i = 0; i < 10; i++) {
                player.markDirty('payment.week_card');      // 强制保存月卡和周卡的充值数据
            }
            player.updateHeadFrameStatus('week_card', 1);

            var weekCardTask = gConfDailyTask['weekCard'];
            if (!user.task.daily_reward[weekCardTask]) {
                user.task.daily[weekCardTask] = 1;
                player.markDirty('task.daily.' + weekCardTask);
            }

            var logConf = gConfPlayLog['activity']['weekCardBuy'];
            if (logConf) {
                player.recordPlay(logConf.logName, logConf.logType);
            }
        } else if (!giftKey && gConfRecharge['monthCard'] == chargeId) {
            var tOldDayNum = payment.month_card;
            payment.month_card += gConfGlobalNew.monthCardDuration;
            LOG(`-- 购买月卡 ${payment.month_card} [ ${tOldDayNum} - ${gConfGlobalNew.monthCardDuration} ]`);
            for (var i = 0; i < 10; i++) {
                player.markDirty('payment.month_card');     // 强制保存月卡和周卡的充值数据
            }
            player.updateHeadFrameStatus('month_card', 1);

            var monthCardTask = gConfDailyTask['monthCard'];
            if (!user.task.daily_reward[monthCardTask]) {
                user.task.daily[monthCardTask] = 1;
                player.markDirty('task.daily.' + monthCardTask);
            }

            var logConf = gConfPlayLog['activity']['monthCardBuy'];
            if (logConf) {
                player.recordPlay(logConf.logName, logConf.logType);
            }
        } else if (!giftKey && gConfRecharge['longCard'] == chargeId) {
            payment.long_card = 1;
            player.markDirty('payment.long_card');
            player.updateHeadFrameStatus('limitless_card', 1);

            user.task.daily[gConfDailyTask['longCard']] = 1;
            var logConf = gConfPlayLog['activity']['longCardBuy'];
            if (logConf) {
                player.recordPlay(logConf.logName, logConf.logType);
            }
        } else if (!giftKey && gConfRecharge['growthFund'] == chargeId) {
            var growFund = user.activity.grow_fund;
            growFund.bought = 1;
            growFund.bought_type++;
            player.markDirty('activity.grow_fund.bought');
            player.markDirty('activity.grow_fund.bought_type');

            player.pay(cash, chargeId, req.args.order, giftKey, giftId, false, req.args.fake);

            var growReq = {
                'act': 'buy_grow_fund',
                'mod': 'activity',
                'uid': req.uid,
                'args': {}
            };
            var growResp = {};
            requestWorld(growReq, growResp, function () {
                onHandled();
            });
            return
        }

        // // 首充标志
        // if (!user.mark.first_pay && cash) {
        //     user.mark.first_pay = 1;
        //     player.markDirty('mark.first_pay');
        // }

        player.pay(cash, chargeId, req.args.order, giftKey, giftId, false, req.args.fake);
    } while (false);

    onHandled();
};

exports.third_pay = function (player, req, resp, onHandled) {
    do {
        if (isNaN(req.args.item_id) || isNaN(req.args.item_num) || isNaN(req.args.amt)) {
            resp.code = 1; resp.desc = 'invalid key or cash'; break;
        }

        var itemId = parseInt(req.args.item_id);
        var itemNum = parseInt(req.args.item_num);
        var amt = parseInt(req.args.amt);
        if (itemNum <= 0) {
            resp.code = 1; resp.desc = 'invalid param'; break;
        }

        var order = req.args.order;
        if (itemId == -1) {
            player.thirdPay('cash', itemNum, amt, order)
        } else if (itemId == -2) {
            player.thirdPay('bindcash', itemNum, amt, order)
        }
    } while (false);

    onHandled();
};

/** 第三方直充 */
exports.pay_direct_access = function (player, req, resp, onHandled) {
    do {
        if (!req.args || !req.args.order_id || !req.args.pay_time) {
            resp.code = 1;
            resp.desc = 'invalid order';
            break;
        }

        player.pay_direct_access(req.args.order_id, req.args.game_coin, req.args.bonus_game_coin, req.args.pay_time, req.args.total_fee, req.args.currency, req.args.order_type, req.args.is_sandbox);
    } while (false);

    onHandled();
}

exports.gm_notice = function (player, req, resp, onHandled) {
    do {
        if ((req.args.key != config.GMAuth)) {
            resp.code = 1;
            resp.desc = 'invalid key';
            break;
        }

        if (typeof (req.args.content) != 'string') {
            resp.code = 1;
            resp.desc = 'content type error';
            break;
        }

        if ((req.args.content.length >= 100) || (req.args.content.length == 0)) {
            resp.code = 1;
            resp.desc = 'too much words';
            break;
        }

        var wssReq = {
            uid: req.uid,
            mod: 'push',
            act: 'push',
            type: 'all',
            args: {
                text: args.content
            }
        };

        requestWss(wssReq, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

// 台湾获取可购买的礼包列表
exports.gift_list = function (player, req, resp, onHandled) {
    // FIXME: 这里需要再确定刷新礼包是否正确
    player.updateGiftBags();
    var user = player.user;
    var list = [];

    // 普通礼包
    var giftBags = user.activity.gift_bag;
    for (var id in giftBags) {
        var giftBag = giftBags[id];
        var conf = gConfGiftBag[id];
        if (!conf) {
            continue;
        }

        if (conf.onoff <= 0) {
            continue;
        }

        var limitValArr = String(conf.triggerLimit).split('.');
        if (limitValArr.length > 0) {
            if (limitValArr[0] == 'level') {
                var limitLv = parseInt(limitValArr[1]) || 0;
                if (limitLv > user.status.level) {
                    continue;
                }
            } else if (limitValArr[0] == 'vip') {
                var limitVip = parseInt(limitValArr[1]) || 0;
                if (limitVip > user.status.vip) {
                    continue;
                }
            } else if (limitValArr[0] == 'gameday') {
                var limitDay = parseInt(limitValArr[1]) || 0;
                var today = getGameDate();
                var passDay = common.getDateDiff(today, gConfGlobalServer.serverStartDate);
                if ((limitDay - 1) > passDay) {
                    continue;
                }
            }
        }

        if (conf.lifeTime != 0) {
            var today = getGameDate();
            var triggerDate = getGameDate(giftBag.time);
            var passDay = common.getDateDiff(today, triggerDate);
            if (passDay >= conf.lifeTime) {
                continue;
            }
        }

        if (giftBag.buy_count >= conf.count) {
            continue;
        }

        if (conf.costtype != 1) {
            continue;
        }

        list.push(conf.recharge * 100000000 + 1000000 + (+id));
    }

    // 七天乐礼包
    if (isActivityStart(player, 'open_seven') == ActivityProcess.NORMAL) {
        var openSeven = player.user.activity.open_seven;
        var day = common.getDateDiff(common.getDate(common.getTime() - gConfGlobal.resetHour * 3600), openSeven.open_day) + 1;

        for (var id in gConfOpenSevenReward) {
            var conf = gConfOpenSevenReward[id];
            if (conf.type != 'giftBuy') {
                continue;
            }

            var progress = user.activity.open_seven.progress[id]
            if (progress && progress[1]) {
                continue;
            }

            // 天数检测
            if (day < conf.needday) {
                continue;
            }

            // vip
            if (player.user.status.vip < conf.needvip) {
                continue;
            }

            list.push(conf.condition * 100000000 + 2000000 + (+id));
        }
    }

    // 五一礼包
    if (isActivityStart(player, 'openholiday') == ActivityProcess.NORMAL) {
        for (var id in gConfOpenHolidayReward) {
            var conf = gConfOpenHolidayReward[id];
            if (conf.type != 'giftBuy') {
                continue;
            }

            var progress = user.activity.open_holiday.progress[id]
            if (progress && progress[1] > conf.target) {
                continue;
            }

            list.push(conf.condition * 100000000 + 3000000 + (+id));
        }
    }

    // 普通购买与月卡, 成长基金
    for (var chargeId in gConfRecharge) {
        if (isNaN(chargeId)) {
            continue;
        }

        var conf = gConfRecharge[chargeId];
        if (conf.type.indexOf('cash') != 0) {
            continue;
        }

        list.push(+chargeId * 100000000);
    }
    list.push(+gConfRecharge['weekCard'] * 100000000);
    list.push(+gConfRecharge['monthCard'] * 100000000);
    if (!user.activity.grow_fund.bought) {
        list.push(+gConfRecharge['growthFund'] * 100000000);
    }

    resp.data.list = list;

    onHandled();
};

