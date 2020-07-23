function setResBack(player, resback, mod, day, awards, remainnum) {
    if (!resback[mod]) {
        resback[mod] = {};
        resback[mod][day]= {};
        resback[mod][day]['awards'] = awards;
        resback[mod][day]['remainnum'] = remainnum||1;
        player.markDirty('resback.' + mod);
    } else {
        resback[mod][day]= {};
        resback[mod][day]['awards'] = awards;
        resback[mod][day]['remainnum'] = remainnum||1;

        player.markDirty(util.format('resback.%s.%d', mod, day));
    }
}

function setResBackGet(player, resback, mod, day) {
    delete resback[mod][day];
    player.markDirty(util.format('resback.%s', mod));
}

// 根据参与等级获取试炼配置
function getLegionTrialBaseConf(join_level) {
    var fit_level = 1;
    var pre_key = 1;
    for (var k in gConfLegionTrialBaseConfig) {
        fit_level = pre_key;
        if (k > join_level) {
            break;
        } else if (k == join_level) {
            fit_level = parseInt(k);
        }

        pre_key = parseInt(k);
    }

    var conf = gConfLegionTrialBaseConfig[fit_level];
    return conf;
}

var JADE_COLORS = {
    1 : 'green',
    2 : 'blue',
    3 : 'purple',
    4 : 'orange',
    5 : 'red',
};

// 判断合璧是否开放
function is_open() {
    var openDays = (gConfGlobal.countryJadeOpenDays).split(',');
    var weekDay = Date.getWeekDay();
    if (openDays.indexOf(weekDay+'') == -1) {
        return false;
    }
    var openTime = Date.zeroTime().getStamp() + (gConfGlobal.countryJadeOpenTime * 3600);
    var endTime = openTime + (gConfGlobal.countryJadeOpenKeepTime) * 60;
    var now = Date.getStamp();
    return (now >= openTime && now < endTime);
}

var mods = {
    'tower': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'tower')) {
            return;
        }

        var tower = player.user.tower;
        for (var i = 0; i < days; i++) {
            var awards = [];
            /*for (var floor in tower.floor) {
                if (i!=days-1 || (floor >= tower.cur_floor && !tower.failed)) {
                    for (var room in tower.floor[floor]) {
                        if (room == 'attr' || ( i==days-1 && floor == tower.cur_floor && room < tower.cur_room)) {
                            continue;
                        }

                        if (tower.floor[floor][room]) {
                            var star = tower.floor[floor][room];
                            if(star<=0)
                                continue;
                            var level = (floor - 1) * 3 + (+room);
                            var starAwardConf = gConfTowerCoinReward[level];
                            towerCoin = starAwardConf['normal3'];
                            awards.push(['user', 'tower', towerCoin]);
                        }
                    }
                }
            }*/

            awards = reformAwards(awards);
            if  (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'tower', day, awards);
            }
        }
    },

    'dragon': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'digging')) {
            return;
        }

        for (var i = 0; i < days; i++) {
            var awards = [];
            var canGet = i!=days-1 ? 1 : player.user.digging.isdigging?0:1;
            if (canGet){
                var awardDragon = ['material',gConfResback['dragon'].para[0],gConfResback['dragon'].para[1]];
                awards.push(awardDragon);
                var awardBox =  ['material',gConfResback['dragon'].para[2],gConfResback['dragon'].para[3]];
                awards.push(awardBox);
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'dragon', day, awards);
            }
        }
    },

    'task': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'task')) {
            return;
        }

        var daily_reward = player.user.task.daily_reward;
        for (var i = 0; i < days; i++) {
            var awards = [];
            var skip = i ? 1:0;
            var xpAdd = 0 ;
            for (var id in gConfDailyTask){
                if (!isModuleOpen_new(player, gConfDailyTask[id].key)) {
                    continue;
                }

                if (!skip && daily_reward[id]) {
                    continue;
                }

                var confAwards = gConfDailyTask[id].award;
                if (!confAwards) {
                    continue;
                }

                for (var k= 0; k < confAwards.length ;k++){
                    var award = confAwards[k];
                    if (award[1] == 'xp'){
                        xpAdd += award[2];
                    }
                }
            }

            if (xpAdd!=0){
                var award = ['user','xp',xpAdd];
                awards.push(award);
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'task', day, awards);
            }
        }
    },

    'food': function(player, endDay, days) {
        //第一天不找回
        var foodget = player.user.task.food_get;
        var id = gConfResback['food'].para[0];
        var privilege = player.user.task.privilege;

        for (var i = 0; i < days; i++) {
            var awards = [];

            var noonAwards = clone(gConfDailyTask[id].award);
            var noonFoodPrivilegeId = gConfNobiltyTitleKey['lunch'].id;
            if (privilege[noonFoodPrivilegeId]) {
                // noonAwards[0][2] += privilege[noonFoodPrivilegeId]
                noonAwards[0][2] +=player.getPrivilegeVal('lunch');
            }

            if(i!=days-1||foodget.indexOf(noonFoodPrivilegeId)<0)
                awards.combine(noonAwards);

            var eveningAwards = clone(gConfDailyTask[id].award);
            var eveningFoodPrivilegeId = gConfNobiltyTitleKey['dinner'].id;
            if (privilege[eveningFoodPrivilegeId]) {
                // eveningAwards[0][2] += privilege[eveningFoodPrivilegeId];
                eveningAwards[0][2] +=player.getPrivilegeVal('dinner');
            }

            if(i!=days-1||foodget.indexOf(eveningFoodPrivilegeId )<0)
                awards.combine(eveningAwards);

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'food', day, awards,awards.length);
            }
        }
    },

    'jade': function(player, endDay, days) {
        if (!is_open()) {
            return;
        }

        if (!isModuleOpen_new(player, 'countryJade')) {
            return;
        }

        var level = Math.floor(player.user.status.level/10);
        var jade = gConfResback['jade'].para[level];
        for (var i = 0; i < days; i++) {
            var awards =[];
            var jadeColor = JADE_COLORS[jade];
            var remainnum = i!=days-1? gConfGlobal.countryJadeFreeCount:gConfGlobal.countryJadeFreeCount-player.user.country.jadeLastCount;
            for (var k= 0; k < remainnum; k++) {
                var fixedAwards =  clone(gConfCountryJadeRewardFix[player.user.status.level][jadeColor]);
                var dropId = gConfCountryJadeRewardDrop[jadeColor].dropId;
                var dropAwards = clone(generateDrop(dropId));
                for (var idx = 0; idx < dropAwards.length; ++idx) {
                    dropAwards[idx].push(1);
                }

                awards.combine(fixedAwards.concat(dropAwards));
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'jade', day, awards,remainnum);
            }
        }
    },

    'explore' : function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'legion')) {
            return;
        }

        if (!player.user.legion.explore_play) {
            return;
        }

        var trialData = player.user.trial;
        for (var i = 0; i < days; i++) {
            var awards = [];
            var checkGet = i!=days-1 ? 0:1;
            var remainnum =3;
            var coinAdd = 0;
            for (var k= 1;k<4;k++){
                if (checkGet && trialData.round[k].award_got){
                    remainnum--;
                    continue;
                }

                var baseConf = getLegionTrialBaseConf(trialData.join_level);
                coinAdd += baseConf.coinBaseAward;
            }

            if (coinAdd!=0){
                var award = ['user', 'trial_coin', coinAdd];
                awards.push(award);
            }


            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'explore', day, awards,remainnum);
            }
        }
    },

    'copy' : function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'legion')) {
            return;
        }

        var legion = player.user.legion;
        if (!legion.copy_play) {
            return;
        }

        for (var i = 0; i < days; i++) {
            var awards = [];
            var daynum = gConfLegion.legionCopyFightLimit+legion.copy_buy-legion.copy_count;
            var remainnum = i!=days-1 ?gConfLegion.legionCopyFightLimit:daynum;

            for (var k = 0; k < remainnum; k++) {
                var award = ['user', 'legion', gConfLegion.legionCopyFightReward];
                awards.push(award);
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'copy', day, awards,remainnum);
            }
        }
    },

    'trial': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'legion')) {
            return;
        }

        var legion = player.user.legion;
        if (!legion.trial_play) {
            return;
        }

        for (var i = 0; i < days; i++) {
            var awards = [];
            var remainnum = i!=days-1?gConfLegion.legionTrialMaxCount:gConfLegion.legionTrialMaxCount-legion.trial_count;

            for (var k = 0;k< remainnum;k++){
                var level =player.user.status.level;
                var stages = Object.keys(gConfTrial).sort(function(a, b){return (+a)-(+b)});
                var j = 0;
                while (+stages[j] <= level) {
                    j++;
                }
                var index = stages[j-1];
                awards.combine(generateDrop(gConfTrial[index].dropId3, player.user.status.level));

            }

            awards = reformAwards(awards);
            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'trial', day, awards,remainnum);
            }
        }
    },

    'mine': function(player, endDay, days) {
        var mine = player.user.mine;
        if (!isModuleOpen_new(player, 'goldmine')) {
            return;
        }

        for (var i = 0; i < days; i++) {
            var awards =[];
            var getAward = i!=days-1 ? 1:mine.occupy_count? 0:1;
            if (getAward){
                var level = Math.floor(player.user.status.level/10);
                var levelId = gConfResback['mine'].para[level];
                var mineConf = gConfGoldMine[level];
                var gold =  10;//Math.floor(gConfGlobal.mineKeepMaxTime/60) * mineConf['level' + levelId];
                var award = ['user', 'gold', gold];
                awards.push(award);
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'mine', day, awards);
            }
        }
    },

    'arena': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'arena')) {
            return;
        }

        var arena = player.user.arena;
        for (var i = 0; i < days; i++) {
            var awards =[];
            var remainnum = i!=days-1 ?gConfGlobal.arenaMaxCount:arena.buy_count+ gConfGlobal.arenaMaxCount - arena.count;
            var addPer = 0;
            var xpAdd = 0;
            for (var k = 0;k< remainnum;k++){
                xpAdd += Math.floor(gConfGlobal.arenaLossXp * (1+addPer));
            }

            if (xpAdd !=0){
                var award = ['user','arena_xp',xpAdd];
                awards.push(award);
            }

            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'arena', day, awards,remainnum);
            }
        }
    },

    'shipper': function(player, endDay, days) {
        if (!isModuleOpen_new(player, 'shipper')) {
            return;
        }

        var shipper = player.user.shipper;
        for (var i = 0; i < days; i++) {
            var awards = [];
            var level = Math.floor(player.user.status.level/10);
            var leveltype = gConfResback['shipper'].para[level];

            var remainnum = i!=days-1?gConfGlobal.shipperDeliveryCount:gConfGlobal.shipperDeliveryCount- shipper.delivery;

            if (gConfShipperReward[level*10]) {
                for (var j = 0;j< remainnum;j++){
                    var award = clone(gConfShipperReward[level*10]['award' + leveltype]);
                    awards.combine(award);
                }
            }
            
            if (awards.length) {
                var day = common.getDate(common.getTime(endDay) - i * 86400 - 86400);
                setResBack(player, player.user.resback, 'shipper', day, awards,remainnum);
            }
        }
    }
};

exports.check_resback = function(player) {
    if (!isActivityStart(player, 'res_back')) {
        return 0;
    }

    var resback = player.user.resback;
    for (var mod in resback) {
        var modBack = resback[mod];
        for (var date in modBack) {
            return 1;
        }
    }

    return 0;
}

exports.calc_resback = function(player, endDay, days) {
    if (!player.user.hasOwnProperty('resback')) {
        player.user.resback={};
        player.markDirty('resback');
    }

    var resback = player.user.resback;
    for (var mod in resback) {
        var modBack = resback[mod];
        for (var date in modBack) {
            if (common.getDateDiff(endDay, date) > 7) {
                delete modBack[date];
                player.markDelete(util.format('resback.%s.%d', mod, date));
            }
        }

        if (Object.isEmpty(modBack)) {
            delete resback[mod];
            player.markDelete('resback.' + mod);
        }
    }

    for (var mod in mods) {
        mods[mod](player, endDay, days);
    }
};

exports.get= function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'res_back')) {
            resp.code = 1; resp.desc = 'not open'; onHandled(); return;
        }

        resp.data.shipper = user.resback;
    } while (false);

    onHandled();
};

/**
 * 资源找回
 * @day 日期  20171107
 * @mod 找回资源的类型
 * @isCash  1(元宝找回)/0(免费找回)
 */
exports.get_award= function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'res_back')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var day = req.args.day;
        var mod = req.args.mod;
        var resback = user.resback;
        var conf = gConfResback[mod];

        if (!conf){
            resp.code = 1; resp.desc = 'no conf'; break;
        }

        if (!resback[mod] || !resback[mod][day]){
            resp.code = 1; resp.desc = 'no award'; break;
        }

        var isCash = req.args.isCash;
        var costs = [];
        if (isCash) {
            var costnum = resback[mod][day]['remainnum'] * conf.perCash;
            costs = [['user','cash',-costnum]];
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        var awards = [];
        for (var i= 0;i< resback[mod][day]['awards'].length;i++){
            var award = resback[mod][day]['awards'][i];
            var radio = 1;
            if (isCash) {
                radio = conf.cashRadio;
            } else {
                if (mod=='dragon'&& award[1] == conf['para'][2]) {
                    continue;
                }
                radio = conf.freeRadio;
            }

            award[2] = Math.floor(radio*award[2]);
            awards.push(award);
        }

        if(mod == 'arena'){
           var oldArenaLevel = user.status.arena_level;
           resp.data.awards = player.addAwards(awards,req.mod,req.act);
           if (oldArenaLevel != user.status.arena_level) {
               var arenaCount = 0;
               for (var l = oldArenaLevel+1; l <= user.status.arena_level; l++){
                    arenaCount += gConfArenaLevel[l].arena;
               }
               resp.data.ext_awards = player.addAwards([['user', 'arena', arenaCount]],req.mod,req.act);
          }
        }else{
          resp.data.awards = player.addAwards(awards,req.mod,req.act);
        }

        setResBackGet(player,resback,mod,day);
       // resp.data.awards = player.addAwards(awards);
        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.get_all_award= function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'res_back')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var mod = req.args.mod;
        var resback = user.resback;
        var conf = gConfResback[mod];

        if (!conf) {
            resp.code = 1; resp.desc = 'no conf'; break;
        }

        if (!resback[mod]){
            resp.code = 1; resp.desc = 'no award'; break;
        }

        var isCash = req.args.isCash;
        var costs = [];
        var awards = [];
        var dayGet = [];
        var modBack = resback[mod];

        for (var day in modBack) {
            if (isCash) {
                var costnum = resback[mod][day]['remainnum'] * conf.perCash;
                var cost = ['user','cash',-costnum];
                costs.push(cost);
            }

            for (var i= 0; i< resback[mod][day]['awards'].length; i++){
                var award = resback[mod][day]['awards'][i];
                var radio = 1;
                if (isCash) {
                    radio = conf.cashRadio;
                } else {
                    if (mod=='dragon'&& award[1] == conf['para'][2]) {
                        continue;
                    }
                    radio = conf.freeRadio;
                }
                award[2] = Math.floor(radio*award[2]);
                awards.push(award);
            }
            dayGet.push(day);
        }

        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        if (!awards.length){
            resp.code = 1; resp.desc = 'already get'; break;
        }

        for (var k= 0; k<dayGet.length;k++) {
            setResBackGet(player,resback,mod,dayGet[k]);
        }

        if(mod == 'arena'){
           var oldArenaLevel = user.status.arena_level;
           resp.data.awards = player.addAwards(awards,req.mod,req.act);
           if (oldArenaLevel != user.status.arena_level) {
               var arenaCount = 0;
               for (var l = oldArenaLevel+1; l <= user.status.arena_level; l++){
                    arenaCount += gConfArenaLevel[l].arena;
               }
               resp.data.ext_awards = player.addAwards([['user', 'arena', arenaCount]],req.mod,req.act);
          }
        }else{
          resp.data.awards = player.addAwards(awards,req.mod,req.act);
        }

        resp.data.costs = player.addAwards(costs,req.mod,req.act);
    } while (false);

    onHandled();
};

exports.get_oneKey_award= function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'res_back')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        //var mod = req.args.mod;
        var resback = user.resback;
      //  var conf = gConfResback[mod];


        var isCash = req.args.isCash;
        var costs = [];
        var awards = [];
        var dayGet = [];
        var modBack = resback[mod];
        var costs=[];
        var awards =[];
        var ext_award =[];

        for(var mod in resback){
            var modBack = resback[mod];
            var conf = gConfResback[mod];
            for (var day in modBack) {
                if (isCash) {
                    var costnum = resback[mod][day]['remainnum'] * conf.perCash;
                    costs.push(['user','cash',-costnum]);
                }

                for (var i= 0; i< resback[mod][day]['awards'].length; i++){
                    var award = resback[mod][day]['awards'][i];
                    var radio = 1;
                    if (isCash) {
                        radio = conf.cashRadio;
                    } else {
                        if (mod=='dragon'&& award[1] == conf['para'][2]) {
                            continue;
                        }
                        radio = conf.freeRadio;
                    }
                    award[2] = Math.floor(radio*award[2]);
                    awards.push(award);
                }
                dayGet.push(day);
            }

            if (!player.checkCosts(costs)) {
                resp.code = 1; resp.desc = "cash not enough"; break;
            }

            if (!awards.length){
                resp.code = 1; resp.desc = 'already get'; break;
            }

            for (var k= 0; k<dayGet.length;k++) {
                setResBackGet(player,resback,mod,dayGet[k]);
            }

        }


        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = "cash not enough"; break;
        }

        if (!awards.length){
            resp.code = 1; resp.desc = 'already get'; break;
        }


        var oldArenaLevel = user.status.arena_level;
        resp.data.awards = player.addAwards(awards,req.mod,req.act);
        resp.data.costs = player.addAwards(costs,req.mod,req.act);

        var ext_awards = [];
        if (oldArenaLevel != user.status.arena_level) {
            var arenaCount = 0;
            for (var l = oldArenaLevel+1; l <= user.status.arena_level; l++){
                arenaCount += gConfArenaLevel[l].arena;
            }
            ext_awards.push(['user', 'arena', arenaCount]);
        }

        if (ext_awards.length)
             resp.data.ext_awards = player.addAwards(ext_awards,req.mod,req.act);



    } while (false);

    onHandled();
};
