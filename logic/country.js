exports.set_country = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'country')) {
            resp.code = 1; resp.desc = 'progress not reached'; break;
        }

        var country = req.args.country;
        if ([0, 1, 2, 3].indexOf(country) == -1) {
            resp.code = 1; resp.desc = 'invalid country'; break;
        }

        if (user.info.country) {
            resp.code = 1; resp.desc = 'already have country'; break;
        }

        requestWorld(req, resp, function() {
            user.info.country = resp.data.country;
            player.markDirty('info.country');
            updateWssData(req.uid, {country : country});

            user.info.position = resp.data.position;
            player.markDirty('info.position');
            player.doOpenSeven('position');
            player.doOpenHoliday('position');
            if (!country) {
                resp.data.awards = player.addAwards(gConfSpecialReward['random_country'].reward,req.mod,req.act);;
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.info.country) {
            resp.code = 1; resp.desc = 'not set country'; break;
        }
		
		if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        req.args.country = user.info.country;
        requestWorld(req, resp, onHandled);
        return;
    } while (false);

    onHandled();
};

exports.get_city = function(player, req, resp, onHandled) {
    var user = player.user;
    if (!user.info.country) {
        resp.code = 1; resp.desc = 'not set country'; onHandled();
        return;
    }
	
	if (!isModuleOpen_new(player, 'kingMe')) {
        resp.code = 1; resp.desc = 'not open'; onHandled();
		return;
    }

    req.args.country = user.info.country;
    requestWorld(req, resp, function() {
        if (resp.data.position) {
            resp.data.challenge = user.country.challenge;
            resp.data.buy = user.country.buy;

            player.calcCountrySalary(resp.data.position);
            resp.data.salary = user.country.day_salary;
        } else {
            resp.code = 1; resp.desc = 'lost country';
        }

        onHandled();
    });
};

exports.buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.info.country) {
            resp.code = 1; resp.desc = 'not set country'; break;
        }

        var country = user.country;
        var challenge = country.challenge - country.buy;
        if (challenge == 0) {
            resp.code = 1; resp.desc = 'full challenge time'; break;
        }

        var buyConf = gConfBuy[country.buy + 1];
        if (!buyConf) {
            buyConf = gConfBuy[gMaxBuyTimes];
        }
        var costs = buyConf.countryChallenge;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        country.buy++;
        player.markDirty('country.buy');

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.get_position = function(player, req, resp, onHandled) {
    var user = player.user;
    if (!user.info.country) {
        resp.code = 1; resp.desc = 'not set country'; onHandled();
        return;
    }

    req.args.country = user.info.country;
    requestWorld(req, resp, onHandled);
};

exports.challenge = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.info.country) {
            resp.code = 1; resp.desc = 'not set country'; break;
        }
		
		if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (req.uid == req.args.enemy) {
            resp.code = 1; resp.desc = 'fight self'; break;
        }

        var country = user.country;
        if (country.challenge - country.buy >= gConfGlobalNew.countryChallengeLimit) {
            resp.code = 1; resp.desc = 'challenge time limit'; break;
        }

        req.args.country = user.info.country;
        requestWorld(req, resp, function() {
            if (resp.code == 0) {
                player.memData.status = 'prepare_position';
                player.memData.enemy_id = +req.args.enemy;

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

exports.fight = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!user.info.country) {
            resp.code = 1; resp.desc = 'not set country'; break;
        }
		
		if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (player.memData.status != 'prepare_position') {
            resp.code = 1; resp.desc = 'status error'; break;
        }

        if (req.args.enemy != player.memData.enemy_id) {
            resp.code = 1; resp.desc = 'enemy error'; break;
        }

        // TODO 战斗校验

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
        req.args.country = user.info.country;
        requestWorld(req, resp, function() {
            player.memData.status = 'idle';

            if (resp.code == 0) {
                if (resp.data.position) {
                    var oldPosition = user.info.position;
                    user.info.position = resp.data.position;
                    player.markDirty('info.position');
                    player.doOpenSeven('position');
                    player.doOpenHoliday('position');
                    if (resp.data.position != oldPosition) {
                        player.calcCountrySalary(oldPosition, resp.data.position);

                        if (player.memData.fight_enemy.uid && !isDroid(player.memData.fight_enemy.uid)) {
                            gPlayers.get(player.memData.fight_enemy.uid, function (enemyPlayer) {
                                enemyPlayer.calcCountrySalary(resp.data.position, resp.data.enemy_position);
                            });
                        }
                    }

                    if (resp.data.position == 1) {
                        if (user.info.country == 1) {
                            player.updateHeadFrameStatus('country1_rank', 1);
                        } else if (user.info.country == 2) {
                            player.updateHeadFrameStatus('country2_rank', 1);
                        } else if (user.info.country == 3) {
                            player.updateHeadFrameStatus('country3_rank', 1);
                        }

                        var enemyPosition = resp.data.enemy_position;
                        if (enemyPosition) {
                            gPlayers.get(player.memData.fight_enemy.uid, function (enemyPlayer) {
                                if (enemyPlayer.user.info.country == 1) {
                                    enemyPlayer.updateHeadFrameStatus('country1_rank', 0);
                                } else if (enemyPlayer.user.info.country == 2) {
                                    enemyPlayer.updateHeadFrameStatus('country2_rank', 0);
                                } else if (enemyPlayer.user.info.country == 3) {
                                    enemyPlayer.updateHeadFrameStatus('country3_rank', 0);
                                }

                                pushToUser(player.memData.fight_enemy.uid, 'self', {
                                    'mod' : 'user',
                                    'act' : 'headframe_change',
                                    'headframe' : enemyPlayer.user.info.headframe,
                                });
                            });
                        }
                    }
                }

                var logConf = gConfPlayLog['pvp']['position'];
                player.recordPlay(logConf.logType, logConf.logName);

                user.country.challenge++;
                player.markDirty('country.challenge');

                // 积分兑换获取皇城争霸次数
                player.getExchangePointsProgress('country', 1);

                player.doDailyTask('supremacy', 1);

                resp.data.awards = player.addAwards(gConfLevel[user.status.level].positionAward,req.mod,req.act);
            }

            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.get_report = function(player, req, resp, onHandled) {
    if (!player.user.info.country) {
        resp.code = 1; resp.desc = 'not set country'; onHandled();
        return;
    }
	
	if (!isModuleOpen_new(player, 'kingMe')) {
		resp.code = 1; resp.desc = 'not open'; onHandled();
        return;
    }

    requestWorld(req, resp, onHandled);
};

exports.rank_list = function(player, req, resp, onHandled) {
    // if ([1, 2, 3].indexOf(req.args.country) == -1) {
    //     resp.code = 1; resp.desc = 'invalid country'; onHandled();
    //     return;
    // }

    // 现在没有三国的设定，玩家默认归属于魏国（1)
    if ([1, 2, 3].indexOf(req.args.country) == -1) {
        req.args.country = 1;
    }

    requestWorld(req, resp, onHandled);
};

// 官职商店
exports.position_shop_get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }
        var shopType = ShopType.COUNTRYPOSITION;
        var positionShop = user.shop[shopType];

        resp.data.shop = positionShop;
    } while (false);

    onHandled();
};

exports.position_shop_buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var id = req.args.id;
        if (!gConfPositionShp[id]) {
            resp.code = 1; resp.desc = 'id error'; break;
        }

        var shopType = ShopType.COUNTRYPOSITION;
        var rankShop = user.shop[shopType];
        if (rankShop[id]) {
            resp.code = 1; resp.desc = 'has bought'; break;
        }

        var posConf = gConfPosition[user.info.position];
        if (posConf.position > gConfPositionShp[id].position) {
            resp.code = 1; resp.desc = 'position not enough'; break;
        }

        var costs = gConfPositionShp[id].cost;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var awards = gConfPositionShp[id].award;

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);

        rankShop[id] = 1;
        player.markDirty(util.format('shop.%d.%d', shopType, id));
        player.doDailyTask('shopBuy', 1);
    } while (false);

    onHandled();
};

// 俸禄商店
exports.salary_shop_get = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var shopType = ShopType.COUNTRYSALARY;
        var count = 99;
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

exports.salary_shop_buy = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'kingMe')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if(!req.args.id || isNaN(req.args.id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var id = Math.floor(+req.args.id);
        var type = req.args.type;

        var shopType = ShopType.COUNTRYSALARY;
        var legionShop = user.shop[shopType];

        if (!legionShop.goods[id]) {
            resp.code = 1; resp.desc = 'id error'; break;
        }
        var good = legionShop.goods[id];
        if (good[1]) {
            resp.code = 1; resp.desc = 'has bought'; break;
        }

        var num = req.args.num;
        if (!num) {
            num = 1;
        }

        var costId = good[0];
        var costs = clone(gConfShop[id]['cost'+costId]);
        for (var i = 0; i < costs.length; i++) {
            costs[i][2] *= num;
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var awards = clone(gConfShop[id].get);

        for (var i = 0; i < awards.length; i++) {
            awards[i][2] *= num;
        }

        if (awards[0][0] == 'equip') {
            awards = [['equip', good[2], good[3], 1]];
        }

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        //good[1] = 1;
        //player.markDirty(util.format('shop.%d.goods.%d', shopType, id));

        player.doDailyTask('shopBuy', 1);
    } while(false);

    onHandled();
};
