function isEmpty(product) {
    if (product) {
        var key = gConfDiggingProduct[product].key;
        if (key != 'door' && key.indexOf('box') == -1 && key.indexOf('gem') == -1 && key.indexOf('enemy') == -1) {
            return false;
        }
    }
    return true;
}

// 检查对应位置是否可直接操作
// 周围至少一个已被挖或者自己本身被挖
function checkAccess(ground, x, y) {
    if (isNaN(x) || isNaN(y)) {
        return false;
    }

    var product = ground[x][y];
    if (!product) {
        return false;
    }

    if (product != gConfDiggingProduct['mud'] && product != gConfDiggingProduct['adamas']) {
        return true;
    }

    if (x < 1 || x > gConfGlobalNew.diggingWidth) {
        return false;
    }

    if (y < 1 || y > gConfGlobalNew.diggingHeight) {
        return false;
    }

    if (x - 1 > 0 && isEmpty(ground[x - 1][y])) {
        return true;
    }

    if (x + 1 <= gConfGlobalNew.diggingWidth && isEmpty(ground[x + 1][y])) {
        return true;
    }

    if (y - 1 > 0 && isEmpty(ground[x][y - 1])) {
        return true;

    }

    if (y + 1 <= gConfGlobalNew.diggingHeight && isEmpty(ground[x][y + 1])) {
        return true;
    }

    return false;
}

// 挖某个位置
function dig(player, x, y) {
    var digging = player.user.digging;
    var ground = digging.ground;
    var product = ground[x][y];


    if (product == gConfDiggingProduct['mud']) {
        ground[x][y] = 0;
        player.markDirty(util.format('digging.ground.%d.%d', x, y));
    } else if (product == gConfDiggingProduct['treasure']) {
        if (digging.gcount < gConfGlobalNew.diggingGemCount && gConfGlobalNew.diggingGemRange - digging.tcount - gConfGlobalNew.diggingGemCount + digging.gcount < 1) {
            ground[x][y] = gConfDiggingProduct['gem'];
        } else {
            var weights = {};
            for (var id in gConfDiggingProduct) {
                var weight = gConfDiggingProduct[id].weight;
                if (weight) {
                    if (digging.gcount < gConfGlobalNew.diggingGemCount) {
                        weights[id] = weight;
                    } else if (id != gConfDiggingProduct['gem']) {
                        weights[id] = weight;
                    }
                }
            }

            var id = +common.wRand(weights);
            if (id == gConfDiggingProduct['box']) {
                id = gConfDiggingProduct['box0'];
            }

            ground[x][y] = id;
        }

        if (ground[x][y] == gConfDiggingProduct['gem']) {
            digging.gcount++;
            player.markDirty('digging.gcount');

            var weights = {};
            var conf = gConfDiggingEvent[digging.level];
            for (var i = 1; i <= 5; i++) {
                if (conf['weight' + i]) {
                    weights[i] = conf['weight' + i];
                }
            }

            ground[x][y] = gConfDiggingProduct['gem' + common.wRand(weights)];
        }

        player.markDirty(util.format('digging.ground.%d.%d', x, y));

        digging.tcount++;
        player.markDirty('digging.tcount');

        if (!digging.hcount) {
            digging.hcount = 0;
        }
        digging.hcount++;
        player.markDirty('digging.hcount');

        if (digging.tcount >= digging.all_tcount) {
            // 所有宝藏已挖, 清空普通土壤
            for (var i = 1; i <= gConfGlobalNew.diggingWidth; i++) {
                for (var j = 1; j <= gConfGlobalNew.diggingHeight; j++) {
                    if (ground[i][j] == gConfDiggingProduct['mud']) {
                        ground[i][j] = 0;
                    }
                }
            }
            player.markDirty('digging.ground');
        }

        player.doOpenSeven('digging');
        player.doOpenHoliday('digging');
    } else {
        return false;
    }

    digging.isdigging = 1;
    player.markDirty('digging.isdigging');
    return true;
}

// 打开挖矿
exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var digging = user.digging;
        if (!gConfDiggingEvent[digging.level]) {
            ground = digging.ground = {};
            digging.all_tcount = 0;
            digging.tcount = 0;
            digging.gcount = 0;
            digging.buy = 0;
            digging.reward = [];

            var level = user.status.level;
            var levels = Object.keys(gConfDiggingEvent).sort(function (a, b) { return a - b; });
            var target = levels[levels.length - 1];
            for (var i = 0, len = levels.length; i < len; i++) {
                if (level < levels[i]) {
                    target = levels[i - 1];
                    break;
                }
            }

            var ground = digging.ground;
            var slots = [];
            var rand1 = common.randRange(1, 10);
            var rand2 = common.randRange(1, 10);
            for (var i = 1; i <= 10; i++) {
                ground[i] = {};
                for (var j = 1; j <= 10; j++) {
                    var conf = gConfDiggingDistribution[(i - 1) * 10 + j];
                    if (conf['treasure' + rand1]) {
                        var product = conf['treasure' + rand1];
                        if (product == 1) {
                            ground[i][j] = gConfDiggingProduct['treasure'];
                            digging.all_tcount++;
                        } else {
                            ground[i][j] = gConfDiggingProduct['door'];
                        }
                    } else if (conf['adamas' + rand2]) {
                        ground[i][j] = gConfDiggingProduct['adamas'];
                    } else {
                        slots.push(i * 10 + (j - 1));
                        ground[i][j] = gConfDiggingProduct['mud'];
                    }
                }
            }

            var dragonIdx = common.randArray(slots);
            ground[Math.floor(dragonIdx / 10)][dragonIdx % 10 + 1] = gConfDiggingProduct['dragon'];

            digging.level = target;
            player.markDirty('digging');
        }

        resp.data.digging = digging;
    } while (false);

    onHandled();
};

// 挖矿
exports.dig = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var digging = user.digging;
        var ground = digging.ground;

        if (user.status.digging <= 0) {
            resp.code = 1; resp.desc = 'not enough tool'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (!dig(player, x, y)) {
            resp.code = 1; resp.desc = 'cannot'; break;
        }

        var costs = [['user', 'digging', -1]];

        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.changed = ground[x][y];
    } while (false);

    onHandled();
};

// 拾取龙晶
exports.collect = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('gem') == -1) {
            resp.code = 1; resp.desc = 'not a gem'; break;
        }

        ground[x][y] = 0;
        player.markDirty(util.format('digging.ground.%d.%d', x, y));

        resp.data.changed = 0;
        resp.data.awards = player.addAwards(gConfDiggingEvent[digging.level]['gem' + conf.key.substr(3)], req.mod, req.act);
    } while (false);

    onHandled();
};

// 打开秘宝箱
exports.open_box = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var ground = user.digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('box') == -1) {
            resp.code = 1; resp.desc = 'not a box'; break;
        }

        var costs = conf.cash;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'something not enough'; break;
        }

        var nextTime = +conf.key.substr(3) + 1;
        var nextId = gConfDiggingProduct['box' + nextTime] || 0;
        ground[x][y] = nextId;
        player.markDirty(util.format('digging.ground.%d.%d', x, y));

        var segs = gConfItem[gConfDiggingEvent[user.digging.level][conf.key]].useEffect.split(':');
        var getNum = +segs[1];
        segs = segs[0].split('.');
        var dropId = +segs[1];
        var awards = timeAwards(generateDrop(dropId, user.status.level), getNum);

        resp.data.changed = nextId;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 点击小恐龙
exports.click_dragon = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key != 'dragon') {
            resp.code = 1; resp.desc = 'not a dragon'; break;
        }

        if (req.args.eat) {
            ground[x][y] = 0;
            player.markDirty(util.format('digging.ground.%d.%d', x, y));

            var awards = [['user', 'digging', gConfGlobalNew.diggingDragonRecover]];
            resp.data.awards = player.addAwards(awards, req.mod, req.act);
            resp.data.changed = 0;
        } else {
            ground[x][y] = 0;
            player.markDirty(util.format('digging.ground.%d.%d', x, y));

            var updates = [];
            if (Math.random() < 0.5) {
                for (var i = 1; i <= 10; i++) {
                    dig(player, x, i);
                    updates.push(ground[x][i]);
                }
                resp.data.change = 'col';
            } else {
                for (var i = 1; i <= 10; i++) {
                    dig(player, i, y);
                    updates.push(ground[i][y]);
                }
                resp.data.change = 'row';
            }

            resp.data.updates = updates;
        }
    } while (false);

    onHandled();
};

// 打开秘宝箱
exports.click_enemy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('enemy1') == -1) {
            resp.code = 1; resp.desc = 'not a enemy'; break;
        }

        ground[x][y] = 0;
        player.markDirty(util.format('digging.ground.%d.%d', x, y));

        var awards = generateDrop(gConfDiggingEvent[digging.level].enemyDrop1);
        resp.data.changed = 0;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 购买矿锄
exports.buy_tool = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var diggingData = user.digging;
        var buyConf = gConfBuy[diggingData.buy + 1];
        if (!buyConf) {
            buyConf = gConfBuy[gMaxBuyTimes];
        }

        var costs = buyConf.diggingBuy;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        // 增加购买次数
        diggingData.buy += 1;
        player.markDirty('digging.buy');

        var awards = [['user', 'digging', gConfGlobalNew.diggingToolPerDeal]];
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// 获取战斗信息
exports.get_enemy = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('enemy') == -1 && conf.key != 'enemy1') {
            resp.code = 1; resp.desc = 'not a enemy'; break;
        }

        // 生成机器人
        var posObj = generateRobot(3, user.status.level, player.getFightForce());

        resp.data.enemy = {
            un: 'regular',
            level: 1,
            pos: posObj,
        };
    } while (false);

    onHandled();
};

// 准备战斗
exports.before_fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('enemy') == -1 && conf.key != 'enemy1') {
            resp.code = 1; resp.desc = 'not a dragon'; break;
        }

        // 随机种子
        var rand = Math.floor(common.randRange(100000, 999999));
        player.memData.rand = rand;
        player.memData.fight_time = common.getTime();
        player.memData.status = 'fight_digging';

        resp.data.rand = rand;
    } while (false);

    onHandled();
};

// 战斗结束
exports.fight = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (player.memData.status != 'fight_digging') {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var star = Math.floor(req.args.star);
        if (isNaN(star)) {
            resp.code = 1; resp.desc = 'invalid star'; break;
        }

        if (star <= 0) {
            break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!checkAccess(ground, x, y)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var conf = gConfDiggingProduct[ground[x][y]];
        if (conf.key.indexOf('enemy') == -1 && conf.key != 'enemy1') {
            resp.code = 1; resp.desc = 'not a dragon'; break;
        }

        ground[x][y] = 0;
        player.markDirty(util.format('digging.ground.%d.%d', x, y));

        var awards = generateDrop(gConfDiggingEvent[digging.level].drop);
        resp.data.changed = 0;
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 领取进度宝箱
exports.click_box = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = +req.args.id;
        var conf = gConfDiggingProgress[id];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var digging = user.digging;
        if (digging.reward.indexOf(id) != -1) {
            resp.code = 1; resp.desc = 'already rewarded'; break;
        }

        digging.reward.push(id);
        player.markDirty('digging.reward');

        var boxId = conf.boxId;
        if (!boxId) {
            boxId = gConfDiggingEvent[digging.level].endBox;
            player.doDailyTask('superBox', 1);
        }

        var segs = gConfItem[boxId].useEffect.split(':');
        var getNum = +segs[1];
        segs = segs[0].split('.');
        var dropId = +segs[1];
        var awards = timeAwards(generateDrop(dropId, user.status.level), getNum);

        awards.push(['user', 'digging', conf.tool]);

        if (id == 3) {
            // 领取终极宝箱
            player.doGuideTask('mine_diggingAward', 1);
            logic_event_mgr.emit(logic_event_mgr.EVENT.DIGGING_BOX, player, id);
        }

        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

// 使用炸弹
exports.bomb = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'mine_digging')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var x = Math.floor(req.args.x);
        var y = Math.floor(req.args.y);
        var digging = user.digging;
        var ground = digging.ground;
        if (!ground[x] || ground[x][y] != 0) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        var bombConf = gConfDiggingBomb[req.args.id];
        if (!bombConf) {
            resp.code = 1; resp.desc = 'invalid id'; break;
        }

        var costs = [['material', bombConf.itemId, -1]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'bomb not enough'; break;
        }

        var updates = [];
        if (bombConf.effect == 'col') {
            for (var i = 1; i <= 10; i++) {
                dig(player, x, i);
                updates.push(ground[x][i]);
            }
        } else {
            for (var i = 1; i <= 10; i++) {
                dig(player, i, y);
                updates.push(ground[i][y]);
            }
        }

        resp.data.change = bombConf.effect;
        resp.data.updates = updates;
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};
