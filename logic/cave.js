/**
 * get      获取信息
 */
exports.get = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player,'customcave')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        if (user.cave.cave_arr && user.cave.cave_arr.length == 0) { // 重置 没有格子数组
            var maxDiceNum = gConfGlobalNew.customCaveDiceNumLimit;// 最大骰子上限
            if (maxDiceNum > user.cave.left_num) {
                user.cave.start_reply_time = common.getTime();
                player.markDirty('cave.start_reply_time');
            }
            user.cave.cave_arr = createCaveArr(user.cave.put_shard_time);
            user.cave.level = user.status.level;
            player.markDirty('cave.cave_arr');
            player.markDirty('cave.level');
        }

        player.initCave();
        if (user.cave.cur_stay == 27) {// 到达终点直接重置
            user.cave.cur_stay = 0;
            user.cave.cave_arr = createCaveArr(user.cave.put_shard_time);
            user.cave.level = user.status.level;
            player.markDirty('cave.cave_arr');
            player.markDirty('cave.cur_stay');
            player.markDirty('cave.level');
        }
        resp.data.cave = user.cave;

    } while (false);

    onHandled();
};

/**
 * shake_dice   投骰子
 * @dice_num    骰子范围  1,2
 * return
 * cur_stay     awards      cave    diceNum
 */
exports.shake_dice = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var diceNum = req.args.dice_num;

        if (diceNum.split(',').length != 2) {
            resp.code = 1;resp.desc = 'dice_num is error';break;
        }
        var caveArr = user.cave.cave_arr;
        var leftNum = user.cave.left_num;// 剩余骰子数量

        if(leftNum <= 0){
            resp.code = 1;resp.desc = 'left num is not';break;
        }

        if(caveArr.length != 28){
            resp.code = 1;resp.desc = 'cave_arr is error;';break;
        }

        if (diceNum <= 0) {
            resp.code = 1;resp.desc = 'dice_num is error';break;
        }

        var num = caveNum(diceNum);// 点数
        var curStay = user.cave.cur_stay; // 当前的位置

        if(curStay == 27){
            resp.code = 1;resp.desc = 'already end';break;
        }

        var maxDiceNum = gConfGlobalNew.customCaveDiceNumLimit;// 最大骰子上限
        // 剩余骰子小于上限 && 没有开始恢复骰子的时间
        if(leftNum < maxDiceNum && !user.cave.start_reply_time){
            user.cave.start_reply_time = common.getTime();
            player.markDirty('cave.start_reply_time');
        }

        leftNum -= 1;
        leftNum <=0 && (leftNum = 0);
        curStay += parseInt(num);
        if(curStay >= 27){// 到达终点 发奖励
            curStay = 27;
        }

        // 领取奖励
        var getawards = getAwards(player, caveArr, curStay, user.cave.level, user.cave.shard);
        var awards = getawards.awards;
        leftNum += getawards.dice;// 奖励是骰子的情况 +=0
        if(getawards.chip) {// 如果是超级宝箱碎片
            user.cave.shard[getawards.chip] = 1;
            var index = 0;
            for(var i in user.cave.shard){
                if(user.cave.shard[i]) index += 1;
            }
            if(index >= gConfGlobalNew.customCaveBoxNeedChipNum){// 积满碎片
                user.cave.put_shard_time = common.getTime();
                player.markDirty('cave.put_shard_time');
            }
            player.markDirty('cave.shard');
        }

        user.cave.cur_stay = curStay;
        user.cave.left_num = leftNum;
        player.markDirty('cave.cur_stay');
        player.markDirty('cave.left_num');
        player.doDailyTask('cave', 1);
        player.doOpenHoliday('cave', 1);
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        resp.data.cave = user.cave;
        resp.data.diceNum = num;// 骰子点数
    } while (false);

    onHandled();
};

/**
 * 恢复骰子
 */
exports.reply_dice = function (player, req, resp, onHandled) {
    var user = player.user;
    do{
        if (common.getTime() - user.cave.start_reply_time < gConfGlobalNew.customCaveDiceInterval * 60) {
            resp.code = 1;resp.desc = 'time has not arrived';break;
        }
        player.initCave();
        resp.data.left_num =  user.cave.left_num;
        resp.data.start_reply_time = user.cave.start_reply_time;
    } while (false);

    onHandled();
};

/**
 * get_awards   打开宝箱
 * @key        什么方式打开的宝箱
 * return
 * awards
 */
exports.get_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    do{
        var shard = user.cave.shard;
        var flag = true;
        for(var i in shard){
            if(!shard[i]){
               flag = false;
               break;
            }
        }

        if(!flag) {
            resp.code = 1;resp.desc = 'not shard';break;
        }

        user.cave.shard = {'1':0,'2':0,'3':0,'4':0};
        player.markDirty('cave.shard');

        user.cave.put_shard_time = 0;
        player.markDirty('cave.put_shard_time');
        
        var awards = gConfCustomCaveAward[user.cave.level].superAward;
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
    } while (false);

    onHandled();
};

// 钥匙开启宝箱
exports.open_box = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = +req.args.id;
        if(!id || isNaN(id)){
            resp.code = 1;resp.desc = 'args is error';break;
        }
        var costs = gConfItem[id].cost.slice(0);
        costs.push(['material',id,-1]);
        if(!player.checkCosts(costs)){
            resp.code = 1;resp.desc = 'lack of resources';break;
        }

        var specialAward = false;
        // 判断是不是王者宝箱
        if (id == 101106) {
            if (!user.mark.open_cave_box_count) {
                user.mark.open_cave_box_count = 1;
                player.markDirty('mark.open_cave_box_count');

                specialAward = true;
            }
        }

        var awards = [];
        if (specialAward) {
            awards = gConfSpecialReward['first_open_treasure'].reward;
        } else {
            awards = generateDrop(parseAwardsConfig(gConfItem[id].useEffect)[0][1],player.user.level);
        }

        resp.data.awards = player.addAwards(awards);
        resp.data.costs = player.addAwards(costs);

    } while (false);

    onHandled();
};

/**
 *
 * @param posIdArr          可能出现的位置
 * @param alreadyArr        已经存在的位置
 * @returns {number}
 */
function randPosId(posIdArr, alreadyArr) {
    var posId = -1;
    if (!alreadyArr.length) {
        posId = posIdArr[common.randRange(0, posIdArr.length - 1)];
    } else {
        // 把已经存在的删除掉
        for (var i = 0; i < alreadyArr.length; i++) {
            var index = posIdArr.indexOf(alreadyArr[i]);
            if (index >= 0) {
                posIdArr.splice(index, 1);
            }
        }

        if (posIdArr.length > 0) {
            posId = posIdArr[common.randRange(0, posIdArr.length - 1)];
        }
    }

    return posId;
}

/**
 * 创建格子数组
 * @param superCave     超级宝箱是否存在
 * @returns {Array}
 */
function createCaveArr(superCave) {
    var caveEvent = {};
    var caveArr = new Array(28);
    var arr = [];
    for (var i in gConfCustomCaveEvent) {
        var customCaveEvent = gConfCustomCaveEvent[i];
        var key = customCaveEvent.key;
        var minNum = customCaveEvent.num[0];
        var maxNum = customCaveEvent.num[1];
        var num = common.randRange(minNum, maxNum);// 出现的数量
        var posIdArr = clone(customCaveEvent.posId);// 可能出现的位置

        var posId = 0;  // 出现的位置
        for (var i = 0; i < num; i++) {
            posId = randPosId(posIdArr, arr);
            if (posId >= 0) {
                arr.push(posId);
                posId == 0 && (key = null);  // 如果位置为0，则奖励不存在
                caveArr[posId] = key;

                !caveEvent[key] && (caveEvent[key] = []);
                caveEvent[key].push(posId);
            }
        }
    }

    for (var i = 0, len = caveArr.length; i < len; i++) {
        if (superCave && caveArr[i] == 'chip') {
            caveArr[i] = 0; // 超级宝箱存在不再产生碎片
        }

        if (!caveArr[i]) {
            caveArr[i] = 0;
        }
    }

    return caveArr;
}

/**
 *  根据权重计算骰子点数
 * @param dice_num      权重字符串
 * @returns {number}    骰子点数
 */
function caveNum(dice_num) {
    var gw = getWeight(dice_num.split(','));
    /**
     * @param diceNumArr 增加权重的返回数组
     * @returns {[null,null]}   [每个位置的权重，总权重]
     */
    function getWeight(diceNumArr) {
        var weightJson = {};
        var max = 0;
        var initWeight = 0;// 初始总权重
        for (var i in gConfCustomCaveDiceWeight) {
            initWeight += gConfCustomCaveDiceWeight[i].weight;
        }
        var totalWeight = initWeight + gConfCustomCaveDiceWeight[diceNumArr[0]].addweight
            + gConfCustomCaveDiceWeight[diceNumArr[1]].addweight; // 总权重

        for (var i in gConfCustomCaveDiceWeight) {
            var weight = gConfCustomCaveDiceWeight[i].weight;
            var addWeight = 0;
            if (diceNumArr[0] == i || diceNumArr[1] == i) {
                addWeight = gConfCustomCaveDiceWeight[i].addweight;
            }
            var result = Math.floor((weight + addWeight) / totalWeight * 100);
            weightJson[i] = result;
            max += result;
        }
        return [weightJson, max];
    }

    var odds = common.randRange(1, gw[1]);
    var weight = gw[0];
    var num = 0;
    var result = 0;
    for (var i in weight) {
        num += weight[i];
        if (num >= odds) {
            result = i;
            break;
        }
    }
    return result;
}

/**
 * 获取奖励
 * @param arr       格子数组
 * @param curStay   当前的位置
 * @param level     当前领取奖励的等级
 * @param chip      已经领取的碎片
 */
function getAwards(player,arr,curStay,level,chip) {
    var awards = [];
    var dice = 0;
    var chipNum = 0;
    var type = arr[curStay];
    if (type == 'gold') {
        var odds = common.randRange(0, 10000);
        if (odds <= gConfGlobalNew.customCaveGoldAward) {
            var lootId = gConfCustomCaveAward[level]['goldAdditionalLootId'];
            awards.push(generateDrop(lootId, player.user.cave.level)[0]);
        }
    }
    else if (type == 'dice') {
        dice += 1;
    }
    else if (type == 'chip') {
        var arr = [];
        for(var i in chip){
            if(!chip[i]) arr.push(i);
        }
        var odds = common.randRange(0,arr.length - 1);
        chipNum = arr[odds];
    }
    if(gConfCustomCaveAward[level] && gConfCustomCaveAward[level][type]){
        awards.push(gConfCustomCaveAward[level][type][0]);
    }
    return {
        awards: awards,
        chip: chipNum, // 碎片位置
        dice: dice
    }
}