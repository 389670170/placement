var sign_high = require('./sign_high.js');


exports.login = function (player, req, resp, onHandled) {

    var today = getGameDate();

    if (player.user.mark.day != today) {
        var reqget = {};
        var respget = {};
        reqget.mod = req.mod;
        reqget.args = {};
        reqget.uid = +req.uid;
        reqget.act = 'getWorldInfo';
        requestWorld(reqget, respget, function () {
            if (respget.code == 0) {
                //更新world数据
                player.user.country.jadeLastCount = respget.data.jadeLastCount;
                login(player, req, resp, onHandled);
            }
        });
    } else {
        //var user = player.user;

        login(player, req, resp, onHandled);
    }
};

function testMail(uid) {
    var now = common.getTime();
    var mail = {
        content: [1002, 1000],
        awards: [['user', 'cash', 100]],
        time: now,
        expire: now + gConfMail[1002].time * OneDayTime,
    };

    requestWorldByModAndAct({ uid: uid }, 'mail', 'add_mail', { mail: mail });
}


function cheack_ifa_Val(ifa) {
    for (var i = 0, len = ifa.length; i < len; i++) {
        var ifa_char = ifa[i];
        if (ifa_char != "0" && ifa_char != "-") {
            return true;
        }
    }
    return false;
}

function login(player, req, resp, onHandled) {
    var user = player.user;
    footprint(user.info.account, player.uid, '', 'game_receiveLogin');

    if (req.args.reset_gift_bag) {
        player.reset_gift_bag();
    }

    if (req.args.name && !user.info.account) {
        user.info.account = req.args.name;
        player.markDirty('info.account');
    }

    if (req.args.ip) {
        user.info.ip = req.args.ip;
        player.markDirty('info.ip');
    }

    if (req.args.platform && (!user.info.platform || user.info.platform == "dev")) {
        user.info.platform = req.args.platform;
        player.markDirty('info.platform');
    }


    if (req.args.device_info) {
        try {
            var deviceInfo = JSON.parse(req.args.device_info);
            user.info.device = deviceInfo.device_name;
            player.markDirty('info.device');
            user.info.system = deviceInfo.device_system;
            player.markDirty('info.system');

            if (!user.info.device_id) {
                if (deviceInfo.device_mac) {
                    if (deviceInfo.device_mac == '02:00:00:00:00:00') {
                        user.info.device_id = user.info.account;//用用户的openid当唯一标识码
                    } else {
                        user.info.device_id = deviceInfo.device_mac;
                    }
                } else if (deviceInfo.device_imei) {
                    user.info.device_id = deviceInfo.device_imei;
                } else if (deviceInfo.device_ifa) {
                    if (cheack_ifa_Val(deviceInfo.device_ifa)) {//ifa是IOS的 广告追踪码， 如果设备关闭的了追踪码就没有数据
                        user.info.device_id = deviceInfo.device_ifa;
                    } else {
                        user.info.device_id = user.info.account;
                    }
                } else {
                    user.info.device_id = user.info.account;
                }
                player.markDirty('info.device_id');
            }

            if (player.gyyxLf != deviceInfo.gyyx_lf) {
                if (deviceInfo.gyyx_lf) {
                    player.gyyxLf = deviceInfo.gyyx_lf;
                    player.user.mark.gyyx_lf = deviceInfo.gyyx_lf;
                    player.markDirty('mark.gyyx_lf');
                } else {
                    player.gyyxLf = 'none';
                }

                player.loginId = 0;
                player.logoutId = 0;
                player.loginTime = 0;
            }
        } catch (error) {
            // do nothing
        }
    }

    if (user.info.device_id == '02:00:00:00:00:00') {//如果读取不到mac地址 就把openid作为唯一标识
        user.info.device_id = user.info.account;
        player.markDirty('info.device_id');
    }

    if (req.args.device_type) {
        if (!user.info.device_type) {
            user.info.device_type = req.args.device_type;
            player.markDirty('info.device_type');
        }
    }

    setTimeout(function () {
        //异步添加设备登陆日志
        DeviceLogCollect(player, 'device_login', { sid: config.DistId, }, false);
    }, 5);



    if (req.args.user_token) {
        player.winner_token = req.args.user_token;
    }

    // 在开始游戏逻辑之前处理活动
    inspect_level_activity(player);

    // 处理一本万利
    if (user.activity.investment && user.activity.investment.open_day == 0) {
        user.activity.investment.open_day = 20190721;
        player.markDirty('activity.investment');
    }

    // 统一成一个国家
    user.info.country = 1;

    // 统计相关
    var createDays = player.getCreateDays();
    if (createDays < 30) {
        user.mark.retention |= 1 << createDays;
        player.markDirty('mark.retention');
    }

    // 初始化黑森林探索
    player.initAutoFight();

    // 初始化山洞
    player.initCave();

    // 首冲重置
    if (isActivityStart(player, 'head_reset')) {
        var headReset = user.activity.head_reset;
        if (headReset.time != gConfActivities['head_reset'].startTime) {
            headReset.time = gConfActivities['head_reset'].startTime;
            user.payment.pay_records = {};
            //user.payment.pay_list = {};
            player.markDirty('activity.head_reset.time');
            player.markDirty('payment.pay_records');
        }
    }
    if (isActivityStart(player, 'tavern_normal') && user.activity.tavern_normal) {
        user.activity.tavern_normal.open_day = user.activity.tavern_normal.open_day || gConfActivities["tavern_normal"].startTime
        if (user.activity.tavern_normal.open_day != gConfActivities["tavern_normal"].startTime) {
            user.activity.tavern_normal = {
                'count': 0,    // 累计次数
                'award_got': [],   // 领奖记录
            };
        }
        player.markDirty('activity.tavern_normal');
    }
    if (isActivityStart(player, 'tavern_high') && user.activity.tavern_high) {
        user.activity.tavern_high.open_day = user.activity.tavern_high.open_day || gConfActivities["tavern_high"].startTime
        if (user.activity.tavern_high.open_day != gConfActivities["tavern_high"].startTime) {
            user.activity.tavern_high = {
                'count': 0,
                'award_got': [],   // 领奖记录
            };
        }
        player.markDirty('activity.tavern_high');
    }


    // 武将升阶信息获取
    for (var pos in user.pos) {
        if (pos == 1) {
            continue;
        }

        var posObj = user.pos[pos];
        var hid = posObj.hid;
        if (!hid) {
            continue;
        }

        var heroCombatConf = getHeroCombatConf(hid);
        if (!heroCombatConf) {
            DEBUG('heroCombatConf not found, hid = ' + hid);
            continue;
        }

        var heroQuality = heroCombatConf.quality;
        if (heroQuality < gConfGlobal.promoteQualityLimit) {
            continue;
        }

        var heroPromote = posObj.promote;
        var promoteConf = gConfHeroChangeQuality[heroQuality];
        if (!promoteConf) {
            continue;
        }

        if (heroPromote.length == 0) {
            var promoteType = promoteConf.id;
            heroPromote[0] = promoteType;
            heroPromote[1] = 0;
            player.markDirty(util.format('pos.%d.promote', pos));
        }
    }

    // 重置每日数据
    var today = getGameDate();
    var firstLogin = 0;
    if (user.mark.day != today) {
        firstLogin = 1;
        player.resetByDay(today);

        // 重置每周数据
        if (user.mark.login_time < getWeekResetTime()) {
            player.resetByWeek();
        }

        // 重置每月数据
        if (user.mark.login_time < getMonthResetTime()) {
            player.resetByMonth();
        }
    }

    // 记录真实的登录日期
    user.mark.login_day = common.getDate();
    player.markDirty('mark.login_day');

    // 登录好礼
    if (isActivityStart(player, 'login_goodgift')) {
        var loginGift = user.activity.login_goodgift;
        if (loginGift.time != gConfActivities['login_goodgift'].startTime) {
            loginGift.time = gConfActivities['login_goodgift'].startTime;
            loginGift.login = 1;
            loginGift.reward = {};
            player.markDirty('activity.login_goodgift');
        } else if (firstLogin) {
            loginGift.login++;
            player.markDirty('activity.login_goodgift.login');
        }
    }

    if (firstLogin) {
        if (!player.user.online_stat.guide_create) {
            player.user.online_stat.guide_create = common.getTime();
            player.markDirty("online_stat.guide_create")
            setTimeout(function () {
                DeviceLogCollect(player, "guide_create", {}, false);
            }, 500);

        }
    }

    var now = common.getTime();
    user.mark.login_time = now;
    user.mark.logins++;
    player.markDirty('mark.login_time');
    player.markDirty('mark.logins');
    player.doOpenSeven('login');
    player.updateVip();

    // 自动回复粮草
    if (!user.mark.food_time) {
        user.mark.food_time = now;
        player.markDirty('mark.food_time');
    }

    if (!user.mark.food_time_red && isModuleOpen_new(player, 'hard')) {
        user.mark.food_time_red = now;
        player.markDirty('mark.food_time_red');
    }

    player.getFood(now);
    player.getFoodRed(now);

    player.getStayingPower(common.getTime());
    player.getActionPoint(common.getTime());
    player.onPlayerLogin();

    /////////// 扫描功能，得到领奖tips //////////
    // 每日任务
    if (!user.tips['daily_task']) {
        var dailyTask = user.task.daily;
        for (var id in dailyTask) {
            if (!gConfDailyTask[id]) {
                continue;
            }

            if (dailyTask[id] >= gConfDailyTask[id].target && !user.task.daily_reward[id]) {
                DEBUG('daily_task id = ' + id + ', dailyTask[id] = ' + dailyTask[id] + ', target = ' + gConfDailyTask[id].target);
                user.tips['daily_task'] = 1;
                player.markDirty('tips.daily_task');
                break;
            }
        }
    }
    // 主线任务
    if (!user.tips['main_task']) {
        var mainTask = user.task.main;
        var reward = user.task.main_reward;
        for (var id in mainTask) {
            var curProgress = (reward[id] ? reward[id] : 0) + 1;
            var conf = gConfTask[id];

            if (!conf) {
                continue;
            }

            if (conf[curProgress]) {
                if ((conf[curProgress].event == 'fightPower' && mainTask[id] >= conf[curProgress].target * 10000) ||
                    (conf[curProgress].event != 'fightPower' && mainTask[id] >= conf[curProgress].target)) {
                    DEBUG('id = ' + id + ', curProgress = ' + curProgress + ', mainTask[id] = ' + mainTask[id] + ', target = ' + conf[curProgress].target);
                    user.tips['main_task'] = 1;
                    player.markDirty('tips.main_task');
                    break;
                }
            }
        }
    }
    // 天下形势
    if (!user.tips['world_reward']) {
        var reward = user.task.world_reward;
        for (var id in gConfWorldSituation) {
            if (user.battle.progress >= gConfWorldSituation[id].target && !reward[id]) {
                user.tips['world_reward'] = 1;
                player.markDirty('tips.world_reward');
                break;
            }
        }
    }

    // 挖矿
    if (!user.tips['digging']) {
        if (user.digging.reward.length < 3 && user.status.digging > 0) {
            user.tips['digging'] = 1;
            player.markDirty('tips.digging');
        }
    }

    // perks tips
    if (!user.misc.perks_opened) {
        user.tips['perks'] = 1;
        player.markDirty('tips.perks');
    }

    if (!user.hero_bag.hasOwnProperty('buy')) {
        user.hero_bag.buy = 0;
        player.markDirty('hero_bag.buy');
    }

    //一本万利活动登陆天数增加
    if (isActivityStart(player, 'investment')) {
        var investment = user.activity.investment;
        if (investment.isBuy == 1 && investment.loginDayCount < 9999) {
            if (investment.lastLoginTime < today) {
                investment.loginDayCount = investment.loginDayCount + 1;
                // player.markDirty('activity.investment.loginDayCount');
                investment.lastLoginTime = today;
                // player.markDirty('activity.investment.lastLoginTime');
                // investment.rewards = {};
                player.markDirty('activity.investment');
            }
        }
    }
    // 积分兑换
    if (isActivityStart(player, 'exchange_points')) {
        var exchangePoints = user.activity.exchange_points;
        var startTime = gConfAvExchangePointsTime[1].startTime;
        var endTime = gConfAvExchangePointsTime[1].endTime;
        var nowTime = common.getTime();
        if (nowTime >= startTime && nowTime <= endTime) {
            if (exchangePoints.time < startTime) {
                exchangePoints.time = startTime;
                exchangePoints.integral = 0,
                    exchangePoints.progress = {};
                exchangePoints.rewards = {};
                player.markDirty('activity.exchange_points');
            }
        }


        for (var id in gConfAvExchangePointsTime) {
            if (nowTime >= gConfAvExchangePointsTime[id].startTime && nowTime <= gConfAvExchangePointsTime[id].endTime) {
                var round = id;
            }
        }

        if (!user.tips['exchange_points']) {
            var exchangePoint = user.activity.exchange_points.progress;
            var rewards = user.activity.exchange_points.rewards;
            for (var key in exchangePoint) {
                var confPoints = gConfAvExchangePointsRound[round][key];
                for (var id in confPoints) {
                    if (exchangePoint[key] >= confPoints[id].target && !rewards[id]) {
                        user.tips['exchange_points'] = 1;
                        player.markDirty('tips.exchange_points');
                        break;
                    }
                }
            }
        }
    }

    // 人皇默认存在技能解锁
    player.cleanSkyIllusionEquip();
    var skySuit = user.sky_suit;
    var wnum = 0;
    var wcount = 0;
    for (var id in skySuit.weapon_skills) {
        wnum++;
        if (!skySuit.weapon_skills[id]) {
            wcount++;
        }
    }

    if (wnum == wcount) {
        //player.calcSkyUnlockSkill('weapon');
    }

    var inum = 0;
    var icount = 0;
    for (var id in skySuit.wing_skills) {
        inum++;
        if (!skySuit.wing_skills[id]) {
            icount++;
        }
    }
    if (inum == icount) {
        //player.calcSkyUnlockSkill('wing');
    }

    // 人皇进阶默认所需的能量值
    for (var i in player.skyTypeConfig) {
        var gConfSky = player.keyFindConf(i);
        if (!skySuit[i + '_energy_target']) {
            skySuit[i + '_energy_target'] = common.seededRandom(gConfSky[skySuit[i + '_level']].energyMin, gConfSky[skySuit[i + '_level']].energyMax);
            player.markDirty('sky_suit.' + i + '_energy_target');
        }
    }

    // 限时道具/幻化装备是否到期
    player.updateLimitMat();
    player.cleanSkyIllusionEquip();

    player.doGuideTask('levelUp', user.status.level);
    player.doGuideTask('heroLvUp', 1);
    player.doGuideTask('king_dragon', 1);

    for (var i = 0; i < user.custom_village.length; i++) {
        player.doGuideTask('villageOpen', user.custom_village[i]);
    }

    for (var i = 0; i < user.custom_treasure.length; i++) {
        player.doGuideTask('king_treasure', user.custom_treasure[i]);
    }

    if (user.mark.guide) {
        var nextProgress = user.battle.progress;
        var type = user.battle.type;

        var customConf = gConfCustomSet[type][nextProgress];

        if (nextProgress > 1 && customConf && (+customConf.guideIndex) <= 0) {
            // 当前没有引导
            DEBUG("清空不存在的引导记录");
            user.mark.guide = 0;
            player.markDirty('mark.guide');
        }
    }

    if (!user.activity.rewarded_first_pay) {
        user.activity.rewarded_first_pay = [];
    }

    // add by fish fix old user
    if (!user.mark.new_rune) {
        for (var hid in user.hero_bag.heros) {
            var heroObj = user.hero_bag.heros[hid];
            heroObj.rune_use = [0, 0, 0, 0];
            player.markDirty('hero_bag.heros.' + hid + '.rune_use');
        }

        user.mark.new_rune = 3;
        player.markDirty('mark.new_rune');
    }

    if (user.mark.new_rune < 3) {
        var bagRune = user.bag.rune;
        for (var ruid in bagRune) {
            bagRune[ruid].hid = 0;
        }

        for (var hid in user.hero_bag.heros) {
            var heroObj = user.hero_bag.heros[hid];
            for (var indx = 0; indx < 4; indx++) {
                var roneUid = heroObj.rune_use[indx];
                if (roneUid > 0 && bagRune[roneUid]) {
                    bagRune[roneUid].hid = hid;
                }

                if (roneUid > 0 && !bagRune[roneUid]) {
                    heroObj.rune_use[indx] = 0;
                }
            }

            player.markDirty('hero_bag.heros.' + hid + '.rune_use');
        }

        player.markDirty('bag.rune');
        user.mark.new_rune = 3;
        player.markDirty('mark.new_rune');
    }
    /////////////////////////////////////

    //testMail(player.uid);
    //ERROR('=====user=====getFightForce');
    player.getFightForce(true);

    resp.data = getLoginData(user);
    resp.data.first_login = firstLogin;
    resp.data.online_time = user.mark.online_time;
    resp.data.wssPort = config.WssPort;
    resp.data.server_open_time = gConfGlobalServer.serverStartTime;
    resp.data.worldwar_open_time = gConfGlobalServer.worldWarOpenTime;
    resp.data.timezone = gTimezone;
    resp.data.verify = gVerify;
    resp.data.cdkey = gCDKey;
    resp.data.boss_birth = user.auto_fight.boss.boss_birth;
    resp.data.monster_level = user.auto_fight.monster_level;
    resp.data.auto_fight_last_get_time = user.auto_fight.last_get_time;
    resp.data.auto_fight_tips = player.getAutoFightTips();
    resp.data.sign_high = sign_high.get_data(player);

    // 首充的奖励是否全部领取
    resp.data.first_pay_end = 1;
    var rewardedFirstPay = user.activity.rewarded_first_pay;
    for (var id in gConfAvFirstPay) {
        var num = +id;
        if (num && rewardedFirstPay.indexOf(num) < 0) {
            resp.data.first_pay_end = 0;
            break;
        }
    }

    resp.data.city_failed_times = user.misc.city_failed_times || 0;

    req.args.mine_level = user.mine.level_id;   // 金矿等级
    req.args.mine_zone = user.mine.zone_id;     // 金矿所在区
    req.args.options = {                        // 用于读邮件
        country: user.info.country,            // 国家, 用于读取太守每日结算
        excepts: user.mail,                    // 已经读过或者删除的邮件
        create_time: user.info.create,         // 创建用户的时间
    };
    var worldwar = user.worldwar;
    var worldResp = {};

    // 获取世界服的数据
    requestWorld(req, worldResp, function () {
        if (worldResp.code == 0) {
            // 获取邮件和公告
            var selfMails = worldResp.data.mail;
            var sysMails = worldResp.data.sys_mail;
            var minId = worldResp.data.min_mail_id;
            var mails = [];
            var bulletins = [];
            for (var id in user.mail) {
                if (id < minId) {
                    delete user.mail[id];
                    player.markDelete('mail.' + id);
                }
            }
            for (var id in selfMails) {
                selfMails[id].id = +id;
                selfMails[id].sys = 0;
                mails.push(selfMails[id]);
            }
            for (var id in sysMails) {
                var mail = sysMails[id];
                mail.id = +id;
                mail.sys = 1;
                mails.push(mail);
            }

            if (resp.data.activity.grow_fund) {
                resp.data.activity.grow_fund.count = worldResp.data.growFund;
            }

            // 检测战队是否存在
            if (worldResp.data.team_id) {
                resp.data.clan.team_id = worldResp.data.team_id;
                resp.data.clan.leader = worldResp.data.team_leader;
                user.clan.can_use_badge = worldResp.data.can_use_badge;
                resp.data.clan.can_use_badge = worldResp.data.can_use_badge;
                resp.data.clan.awardBox = worldResp.data.awardBox;
                resp.data.clan.team_level = worldResp.data.team_level;

                player.memData.team_id = worldResp.data.team_id;
                player.memData.team_name = worldResp.data.team_name;
                player.memData.team_level = worldResp.data.team_level;
                player.markDirty('clan.can_use_badge');
                player.doTask('teamLevel', 1);

                // 是否有人申请入队
                resp.data.has_join_apply = worldResp.data.has_join_apply;

                player.resetTeamByDay();
            } else {
                if (user.clan.can_use_badge && user.clan.can_use_badge.length > 0) {
                    user.clan.can_use_badge = [];
                    player.markDirty('clan.can_use_badge');
                }
            }

            resp.data.arena.cur_type = worldResp.data.arena_cur_type;
            resp.data.arena.cur_rank = worldResp.data.arena_cur_rank;

            // 村庄争夺相关数据
            if (worldResp.data.village_id) {
                resp.data.village_id = worldResp.data.village_id;
                player.memData.village_id = worldResp.data.village_id;
            } else {
                resp.data.village_id = 0;
                player.memData.village_id = 0;
            }

            if (worldResp.data.village_land) {
                resp.data.village_land = worldResp.data.village_land;
                player.memData.village_land = worldResp.data.village_land;
            } else {
                resp.data.village_land = [0, 0];
                player.memData.village_land = [0, 0];
            }

            resp.data.mails = mails;
            resp.data.bulletins = bulletins;
            var guide = {};
            guide.citytime = worldResp.data.citytime;
            guide.legionwarstage = worldResp.data.legionwarstage;
            guide.worldwarstage = worldResp.data.worldwarstage;
            //guide.legionwar_addCityBufNum = worldResp.data.legionwar_addCityBufNum;
            guide.legionwar_attackNum = worldResp.data.legionwar_attackNum;
            resp.data.guide = guide;

            if (worldResp.data.position && user.info.position != worldResp.data.position) {
                user.info.position = worldResp.data.position;
                player.markDirty('info.position');
            }
            player.calcCountrySalary(user.info.position);

            // 获取军团id
            var lid = worldResp.data.lid;
            resp.data.lid = lid;
            var legionMsg = worldResp.data.legionMsg;
            player.saveLegionMemData('', legionMsg);
            if (lid) {
                resp.data.lname = legionMsg.name;
                resp.data.llevel = legionMsg.level;
                resp.data.licon = legionMsg.icon;

                resp.data.lduty = worldResp.data.duty;
                resp.data.build = user.new_legion.build;

                if (worldResp.data.legionHasApply) {
                    // 有未处理的申请
                    user.tips['legion_apply'] = 1;
                }

                // TODO 登录更新军团离开时间
            }
            player.memData.legion_id = lid;

            // 金矿已占领时间
            if (worldResp.data.mine_duration != undefined) {
                resp.data.mine_duration = worldResp.data.mine_duration;
            } else if (user.mine.level_id) {
                user.mine.level_id = 0;
                user.mine.zone_id = 0;
                player.markDirty('mine');
            }
            resp.data.mine_id = worldResp.data.mine_id;

            if (!user.tips['legion']) {
                if (user.new_legion.build < gConfVip[user.status.vip].legionConstruct) {
                    user.tips['legion'] = 1;
                }
            }

            if (!user.tips['legion_bonfire'] && resp.data.lboneFireOpen) {
                user.tips['legion_bonfire'] = 1;
            }

            sign_high.check_tips(player);

            // 消息提醒
            resp.data.tips = worldResp.data.tips;
            var hasTip = false;
            for (var type in user.tips) {
                resp.data.tips[type] = user.tips[type];
                hasTip = true;
            }

            if (hasTip) {
                user.tips = {};
                player.markDirty('tips');
            }

            // 活动相关数据
            resp.data.grow_fund_count = worldResp.data.grow_fund_count;
            resp.data.country_jade = worldResp.data.country_jade;
            resp.data.country_jade_time = worldResp.data.country_jade_time;

            // 活动配置
            resp.data.avconf = gConfActivitiesClient;

            // 保证全局tips不覆盖
            player.hasTip = false;

            //自己是否有boss
            resp.data.hasfightboss = worldResp.data.hasfightboss;

            // 竞技榜第一名
            if (worldResp.data.arena_top_uid == player.uid) {
                player.updateHeadFrameStatus('arena_rank', 1);
            } else {
                player.updateHeadFrameStatus('arena_rank', 0);
            }

            // 战力榜第一名
            if (worldResp.data.fight_force_top_uid == player.uid) {
                player.updateHeadFrameStatus('fight_force_rank', 1);
            } else {
                player.updateHeadFrameStatus('fight_force_rank', 0);
            }

            // 皇城争霸排行
            if (worldResp.data.position == 1) {
                if (user.info.country == 1) {
                    player.updateHeadFrameStatus('country1_rank', 1);
                } else if (user.info.country == 2) {
                    player.updateHeadFrameStatus('country2_rank', 1);
                } else if (user.info.country == 3) {
                    player.updateHeadFrameStatus('country3_rank', 1);
                }
            } else {
                if (user.info.country == 1) {
                    player.updateHeadFrameStatus('country1_rank', 0);
                } else if (user.info.country == 2) {
                    player.updateHeadFrameStatus('country2_rank', 0);
                } else if (user.info.country == 3) {
                    player.updateHeadFrameStatus('country3_rank', 0);
                }
            }

            // 人品帝
            if (worldResp.data.tavern_top_uid == player.uid) {
                player.updateHeadFrameStatus('lucky_rank', 1);
            } else {
                player.updateHeadFrameStatus('lucky_rank', 0);
            }

            //检查是否有回收资源
            resp.data.hasresback = 0;//player.check_resback();

            // 临时
            var now = new Date();
            var today_flag = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            if (today_flag == 20190726) {
                if (!player.user.s20190726) {
                    player.user.s20190726 = today_flag;
                    player.markDirty("s20190726");

                    var id = 1;
                    var tab = 101;

                    if (player.user.shop_new[id] && player.user.shop_new[id][tab]) {
                        player.refreshShopGoods(id, tab);
                    }
                }
            }
        }

        footprint(user.info.account, player.uid, '', 'game_replyClient');
        onHandled();
    });
};

exports.set_role = function (player, req, resp, onHandled) {
    do {
        var hid = req.args.hid;
        var user = player.user;
        var heroConf = gConfHero[hid];

        if (!heroConf) {
            resp.code = 1; resp.desc = 'invalid hid'; break;
        }

        resp.code = 1; resp.desc = 'ASK FISH hid'; break;

        if (Object.keys(player.pos).length > 0) {
            resp.code = 1; resp.desc = 'already have'; break;
        }

        if (heroConf.camp != 5) {
            resp.code = 1; resp.desc = 'not protagonist'; break;
        }

        player.addHero(hid, 1);
    } while (false);

    onHandled();
};

exports.set_name = function (player, req, resp, onHandled) {
    do {
        var name = req.args.name + "";
        var user = player.user;
        var info = user.info;
        if (!name) {
            resp.code = 102; resp.desc = 'empty string'; break;
        }

        // 验证过滤
        if (name.indexOf('*') >= 0) {
            resp.code = 102; resp.desc = 'invalid symbol'; break;
        }
        if (name.indexOf('.') >= 0) {
            resp.code = 102; resp.desc = 'invalid symbol'; break;
        }

        if (name.indexOf('官方') != -1 || name.indexOf('GM') != -1) {
            resp.code = 102; resp.desc = 'invalid name'; break;
        }

        // 已经设置了名字
        if (info.un && !req.args.cash && !user.mark.rename) {
            resp.code = 1; resp.desc = 'you have seted name'; break;
        }

        if (req.args.cash && !user.mark.rename && user.status.cash < Math.abs(gConfGlobalNew.renameCashCost[0][2])) {
            resp.code = 1; resp.desc = 'no enough cash'; break;
        }

        // 是否包含非法字符
        var invalidWord = 0;
        for (var i = 0; i < name.length; i++) {
            if (!name.isChineseWord(i) && !name.isDigit(i) && !name.isEnglishWord(i)) {
                invalidWord = 1;
                break;
            }
        }

        if (invalidWord) {
            resp.code = 102; resp.desc = 'invalid name'; break;
        }

        if (name.length > 12) {
            resp.code = 1; resp.desc = 'name too long'; break;
        }

        requestWorld(req, resp, function () {
            if (resp.code == 0) {
                if (!info.un) {
                    // 进入主场景
                    var phpReq = {
                        uid: req.uid,
                        act: 'user_scene',
                        args: {
                            sid: config.DistId,
                            openid: info.account,
                            level: user.status.level,
                            type: 0,
                            time: common.getTime() - user.activity.guide['guide_guanyu'],
                        },
                    };
                    LogCollect(phpReq.uid, phpReq.act, phpReq.args);
                    // requestPHP(phpReq, {});
                }
                info.un = name;
                player.markDirty('info.un');
                updateWssData(req.uid, { un: name });

                if (user.mark.rename) {
                    user.mark.rename = 0;
                    player.markDirty('mark.rename');
                }

                if (req.args.cash && !user.mark.rename) {
                    var costs = parseAwardsConfig(gConfGlobalNew.renameCashCost);
                    resp.data.costs = player.addAwards(costs, req.mod, req.act);
                }
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.set_headpic = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = +req.args.id;
        var conf = gConfHeadpic[id]
        if (!conf) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        if (user.status.vip < conf.vip_condition) {
            resp.code = 1; resp.desc = 'vip limit'; break;
        }

        user.info.headpic = id;
        player.markDirty("info.headpic");
        updateWssData(req.uid, { headpic: id });
    } while (false);

    onHandled();
};

// 设置头像框
exports.set_headframe = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = +req.args.id;
        var conf = gConfHeadFrame[id]
        if (!conf) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        // 是否已激活
        if (!user.head_frame_status[id]) {
            resp.code = 1; resp.desc = 'not active'; break;
        }

        user.info.headframe = id;
        player.markDirty("info.headframe");
        updateWssData(req.uid, { headframe: id });
    } while (false);

    onHandled();
};

// 获取头像框的状态
exports.get_head_frame_status = function (player, req, resp, onHandled) {
    var user = player.user;
    resp.data.head_frame_status = user.head_frame_status;
    resp.data.progress = player.getHeadFrameProgress();

    onHandled();
};

exports.get_fight_force_top = function (player, req, resp, onHandled) {
    requestWorld(req, resp, function () {
        var top = resp.data.top;
        if (top == player.uid) {
            player.updateHeadFrameStatus('fight_force_rank', 1);
        } else {
            player.updateHeadFrameStatus('fight_force_rank', 0);
        }
        resp.data.headframe = player.user.info.headframe;
        onHandled();
    });
};

exports.get_lucky_top = function (player, req, resp, onHandled) {
    requestWorld(req, resp, function () {
        var top = resp.data.top;
        if (top == player.uid) {
            player.updateHeadFrameStatus('lucky_rank', 1);
        } else {
            player.updateHeadFrameStatus('lucky_rank', 0);
        }
        resp.data.headframe = player.user.info.headframe;
        onHandled();
    });
};

exports.shop_get = function (player, req, resp, onHandled) {
    // 废弃
    onHandled();
};

analyze_user_mail = function (player, mails) {
    console.log(".......", mail ? mail.sys : '-', mail);
    if (!mails || mails.length <= 0) { return; }
    for (var i = 0; i < mails.length; i++) {
        var mail = mails[i];
        if (!mail || mail.sys != 1) { return; }
        logic_event_mgr.emit(logic_event_mgr.EVENT.GET_MAIL, player, mail);
    }
}

// 读邮件及公告
exports.read_mail = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = req.args.id;
        if (!id || isNaN(id)) {
            resp.code = 1; resp.desc = 'no id'; break;
        }

        var sys = req.args.sys;
        if (sys != 0 && sys != 1) {
            resp.code = 1; resp.desc = 'sys error'; break;
        }

        if (sys && (id in user.mail)) {
            resp.code = 1; resp.desc = 'has read'; break;
        }

        req.args.options = {                        // 用于读邮件
            country: user.info.country,            // 国家太守结算
            support: user.worldwar.support,        // 跨服战支持
            create_time: user.info.create,         // 创建用户的时间
        };
        var worldReq = {
            mod: 'mail',
            act: 'read_mail',
            uid: req.uid,
            args: req.args,
        };

        var worldResp = {};
        requestWorld(worldReq, worldResp, function () {
            if (worldResp.code == 0) {
                if (worldResp.data.awards) {
                    // var oldArenaLevel = user.status.arena_level;
                    resp.data.awards = player.addAwards(worldResp.data.awards, req.mod, req.act);

                    // if (oldArenaLevel != user.status.arena_level) {
                    //     var arenaCount = 0;
                    //     for (var l = oldArenaLevel+1; l <= user.status.arena_level; l++) {
                    //         arenaCount += gConfArenaLevel[l].arena;
                    //     }
                    //     resp.data.ext_awards = player.addAwards([['user', 'arena', arenaCount]],req.mod,req.act);
                    // }
                    if (sys) {
                        user.mail[id] = 2;
                        player.markDirty('mail.' + id);
                    }
                } else if (sys) {
                    user.mail[id] = 1;
                    player.markDirty('mail.' + id);
                }

                analyze_user_mail(player, worldResp.data.mails);
            } else {
                resp.code = worldResp.code; resp.desc = worldResp.desc;
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
};

exports.read_all_mail = function (player, req, resp, onHandled) {
    var user = player.user;
    req.args.options = {                       // 用于读邮件
        country: 1,
        read: 1,
        support: user.worldwar.support,        // 跨服战支持
        create_time: user.info.create,         // 创建用户的时间
        excepts: user.mail,                    // 已经读过或者删除的邮件
    };

    var worldReq = {
        mod: 'mail',
        act: 'read_all_mail',
        uid: req.uid,
        args: req.args,
    };

    DEBUG("============ read_all_mail ===========");

    var worldResp = {};
    requestWorld(worldReq, worldResp, function () {
        if (worldResp.code == 0) {
            if (worldResp.data.awards) {
                // var oldArenaLevel = user.status.arena_level;
                resp.data.awards = player.addAwards(worldResp.data.awards, req.mod, req.act);

                // 竞技场升级奖励(已废弃，驯龙2竞技场不能升级!!)
                // if (oldArenaLevel != user.status.arena_level) {
                //     var arenaCount = 0;
                //     for (var l = oldArenaLevel + 1; l <= user.status.arena_level; l++) {
                //         arenaCount += gConfArenaLevel[l].arena;
                //     }
                //     resp.data.ext_awards = player.addAwards([['user', 'arena', arenaCount]], req.mod, req.act);
                // }

                var ids = worldResp.data.ids;
                for (var i = 0, len = ids.length; i < len; i++) {
                    var id = ids[i];
                    user.mail[id] = 2;
                    player.markDirty('mail.' + id);
                }
            } else {
                resp.code = worldResp.code; resp.desc = worldResp.desc;
            }
            analyze_user_mail(player, worldResp.data.mails);
        } else {
            resp.code = worldResp.code; resp.desc = worldResp.desc;
        }
        onHandled();
    });
};

exports.get_mails = function (player, req, resp, onHandled) {
    var user = player.user;
    var ids = req.args.ids;
    if (!ids || !util.isArray(ids) || ids.length != 2) {
        resp.code = 1; resp.desc = 'no ids';
        onHandled();
        return;
    }

    req.args.options = {                        // 用于读邮件
        country: user.info.country,            // 国家标识
        support: user.worldwar.support,        // 跨服战支持
        excepts: user.mail,                    // 已经读过或者删除的邮件
        create_time: user.info.create,         // 创建用户的时间
    };
    var worldReq = {
        mod: 'mail',
        act: 'get',
        uid: req.uid,
        args: req.args,
    };

    var worldResp = {};
    requestWorld(worldReq, worldResp, function () {
        if (worldResp.code == 0) {
            var selfMails = worldResp.data.mail;
            var sysMails = worldResp.data.sys_mail;
            var mails = [];
            for (var id in selfMails) {
                selfMails[id].id = +id;
                selfMails[id].sys = 0;
                mails.push(selfMails[id]);
            }
            for (var id in sysMails) {
                if (user.mail[id] == 2) {
                    continue;
                }
                var mail = sysMails[id];
                mail.id = +id;
                mail.sys = 1;
                mails.push(mail);
            }
            resp.data.mails = mails;
        }

        onHandled();
    });
}

exports.exchange_cdkey = function (player, req, resp, onHandled) {
    do {
        if (!req.args.key) {
            resp.code = 1; resp.desc = 'no key'; break;
        }

        var phpResp = {};
        var cdkey = player.user.activity.cdkey;
        req.args.ids = Object.keys(cdkey);
        requestPHP(req, phpResp, function () {
            if (phpResp.code == 0) {
                var id = phpResp.data.id;
                if (cdkey[id]) {
                    resp.code = 102; resp.desc = 'has got';
                } else {
                    cdkey[id] = 1;
                    player.markDirty('activity.cdkey.' + id);

                    var awards = JSON.parse(phpResp.data.reward);
                    resp.data.awards = player.addAwards(awards, req.mod, req.act);
                }
            } else {
                resp.code = phpResp.code; resp.desc = phpResp.desc;
            }
            onHandled();
        });
        return;
    } while (false);

    onHandled();
}

exports.handshake = function (player, req, resp, onHandled) {
    var user = player.user;
    player.memData.wss_login = common.getTime();
    resp.data.user = {
        un: user.info.un,
        level: user.status.level,
        headpic: user.info.headpic,
        headframe: user.info.headframe,
        vip: user.status.vip,
        lid: player.memData.legion_id,
        team_id: player.memData.team_id,
        country: user.info.country,
        gyyx_lf: player.gyyxLf,
    };

    var phpResp = {};
    if (!player.loginId) {
        player.loginId == -1;
        var phpReq = {
            uid: req.uid,
            act: 'user_login',
            args: {
                openid: player.user.info.account,
                sid: config.DistId,
                device_id: player.user.info.device_id,
            },
        };

        LogCollect(phpReq.uid, phpReq.act, phpReq.args);
    }

    onHandled();
};

exports.offline = function (player, req, resp, onHandled) {
    player.onOffline(req.args.online_time);

    var phpResp = {};
    var phpReq = {
        uid: req.uid,
        act: 'user_logout',
        args: {
            openid: player.user.info.account,
            sid: config.DistId,
            id: player.logoutId,
            online_time: common.getTime() - player.loginTime,
            ip: player.user.info.ip,
            device_id: player.user.info.device_id,
        },
    }
    LogCollect(phpReq.uid, phpReq.act, phpReq.args);
    // requestPHP({
    //     uid : req.uid,
    //     act : 'user_logout',
    //     args : {
    //         openid: player.user.info.account,
    //         sid: config.DistId,
    //         id: player.logoutId,
    //         online_time: common.getTime() - player.loginTime,
    //         ip: player.user.info.ip,
    //     },
    // }, phpResp, function() {
    //     if (phpResp.code == 0) {
    //         player.logoutId = phpResp.data.logout_id;
    //     }
    // });

    // 记录下线时间（战队系统）
    req.mod = 'clan';
    requestWorld(req, resp, onHandled);
    onHandled();
};

exports.wss_debug = function (player, req, resp, onHandled) {
    req.type = 'all';
    requestWss(req, resp, onHandled);
};

// 喊话
exports.shout = function (player, req, resp, onHandled) {
    do {
        var costs = [['material', gConfGlobalNew.shoutCostId, -1]];
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'material not enough'; break;
        }

        if (!req.args.content) {
            resp.code = 1; resp.desc = 'no content'; break;
        }

        var worldReq = {
            uid: req.uid,
            mod: 'user',
            act: 'get_title',
            args: {}
        };

        var worldResp = {};

        // 检查是否有招募权限
        requestWorld(worldReq, worldResp, function () {
            var wssReq = clone(req);
            wssReq.mod = 'chat';
            wssReq.act = 'chat';
            wssReq.args.type = 'shout';
            wssReq.args.title = worldResp.data.title;
            wssReq.args.quality = player.getQuality();
            wssReq.args.legion_id = player.memData.legion_id; // 军团id
            wssReq.args.team_id = player.memData.team_id; // 小队id

            requestWss(wssReq, resp, function () {
                if (resp.code == 0) {
                    resp.data.costs = player.addAwards(costs, req.mod, req.act);
                }

                onHandled();
            });
            return;
        });
    } while (false);
};

// 招募
exports.recruit = function (player, req, resp, onHandled) {
    do {
        if (!req.args.content) {
            resp.code = 1; resp.desc = 'no content'; break;
        }

        var recruitType = req.args.recruit_type;
        if (!recruitType) {
            resp.code = 1; resp.desc = 'no recruit_type'; break;
        }

        req.args.quality = player.getQuality();

        if (recruitType == 'legion') {
            // 检查有没有军团
            if (!player.memData.legion_id) {
                resp.code = 1; resp.desc = 'no legion'; break;
            }

            var worldReq = {
                uid: req.uid,
                mod: 'new_legion',
                act: 'get_member_duty',
                args: {}
            };

            var worldResp = {};

            // 检查是否有招募权限
            requestWorld(worldReq, worldResp, function () {
                if (worldResp.code == 0) {
                    if (worldResp.data.duty > 2) {
                        // 没有权限
                        resp.code = 1; resp.desc = 'no priority';
                    } else {
                        var wssReq = clone(req);
                        wssReq.mod = 'chat';
                        wssReq.act = 'chat';
                        wssReq.args.type = 'recruit';
                        wssReq.args.title = worldResp.data.title;
                        wssReq.args.recruit_type = 'legion';
                        wssReq.args.legion_id = player.memData.legion_id; // 军团id
                        wssReq.args.legion_name = player.memData.legion_name;
                        wssReq.args.legion_level = player.memData.legion_level;
                        requestWss(wssReq, resp, function () {
                            onHandled();
                        });

                        return;
                    }
                } else {
                    resp.code = 1; resp.desc = worldResp.desc;
                }

                onHandled();
            });
            return;
        } else if (recruitType == 'team') {
            // 检查有没有小队
            if (!player.memData.team_id) {
                resp.code = 1; resp.desc = 'no team'; break;
            }

            // 检查有没有招募权限
            var worldReq = {
                uid: req.uid,
                mod: 'clan',
                act: 'get_leader_id',
                args: {}
            };

            var worldResp = {};

            requestWorld(worldReq, worldResp, function () {
                if (worldResp.code == 0) {
                    if (worldResp.data.leader != req.uid) {
                        // 没有权限
                        resp.code = 1; resp.desc = 'no priority';
                    } else {
                        var wssReq = clone(req);
                        wssReq.mod = 'chat';
                        wssReq.act = 'chat';
                        wssReq.args.type = 'recruit';
                        wssReq.args.title = worldResp.data.title;
                        wssReq.args.recruit_type = 'team';
                        wssReq.args.team_id = player.memData.team_id; // 小队id
                        wssReq.args.team_name = player.memData.team_name;
                        wssReq.args.team_level = player.memData.team_level;
                        requestWss(wssReq, resp, function () {
                            onHandled();
                        });

                        return;
                    }
                } else {
                    resp.code = 1; resp.desc = worldResp.desc;
                }

                onHandled();
            });
            return;
        }
        return;
    } while (false);

    onHandled();
};

exports.get_sign = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'sign')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var sign = user.sign;
        var today = getGameDate();
        var createDate = getGameDate(user.info.create);
        var createDiffDay = common.getDateDiff(createDate, today);
        var signEnableCount = createDiffDay % 7 + 1;

        resp.data.count = sign.count;
        resp.data.round_rewards = sign.round_rewards;
        resp.data.sign_enable_count = signEnableCount;
        resp.data.is_signed = sign.day == today ? 1 : 0;
    } while (false);

    onHandled();
};

exports.sign = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 检测活动是否开放
        if (!isActivityStart(player, 'sign')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var sign = user.sign;
        var today = getGameDate();
        // 检测今天是否已经签到
        if (sign.day == today) {
            resp.code = 1; resp.desc = 'already signed'; break;
        }

        var createDate = getGameDate(user.info.create);
        var createDiffDay = common.getDateDiff(createDate, today);
        var signEnableCount = createDiffDay % 7 + 1;
        // 检测是否已经签满
        if (sign.count >= signEnableCount) {
            resp.code = 1; resp.desc = 'full sign'; break;
        }

        // if (common.getDateDiff(sign.day, today) != 1) {
        //     sign.continuous = 1;
        //     player.markDirty('sign.continuous');
        // } else if (gConfSignReward[sign.continuous + 1]) {
        //     sign.continuous++;
        //     player.markDirty('sign.continuous');
        // }
        // var conf = gConfSign[sign.count];
        // var awards = [];
        // if (conf.monthly) {
        //     var curMonth = Math.floor(today / 100) % 100;
        //     awards = gConfSignMonth[curMonth]['award' + conf.monthly];
        // } else {
        //     awards = conf.award;
        // }
        //
        // if (conf.vip && user.status.vip >= conf.vip) {
        //     awards = timeAwards(awards, 2);
        // }

        var awards = sign.round_rewards[sign.count];
        sign.count++;
        sign.day = today;
        player.markDirty('sign.count');
        player.markDirty('sign.day');
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.resign = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        // 检测活动是否开启
        if (!isActivityStart(player, 'sign')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }
        // 检测vip等级是否达到
        if (user.status.vip < gConfGlobalNew.resignVipRequire) {
            resp.code = 201; resp.desc = 'vip not reached'; break;
        }

        // if (user.status.level < gConfGlobal.signOpenLevel) {
        //     resp.code = 1; resp.desc = 'level not reached'; break;
        // }

        var sign = user.sign;
        var today = getGameDate();
        // 今天签到之后才能补签
        if (sign.day != today) {
            resp.code = 1; resp.desc = 'not signed'; break;
        }

        // var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));
        // if( sign.count > passedDay){
        //     resp.code = 1; resp.desc = 'not get sign condition'; break;
        // }

        var createDate = getGameDate(user.info.create);
        var createDiffDay = common.getDateDiff(createDate, today);
        var signEnableCount = createDiffDay % 7 + 1;
        // 检测是否已经签满
        if (sign.count >= signEnableCount) {
            resp.code = 1; resp.desc = 'full sign'; break;
        }

        // if (sign.count >= today % 100) {
        //     resp.code = 1; resp.desc = 'full sign'; break;
        // }

        //var costs = [['user', 'cash', -gConfGlobal.resignCashCost]];
        // 检测补签花费
        var costs = parseAwardsConfig(gConfGlobalNew.resignCashCost);
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'not enough cash'; break;
        }

        // var conf = gConfSign[sign.count];
        // var awards = [];
        // if (conf.monthly) {
        //     var curMonth = Math.floor(today / 100) % 100;
        //     awards = gConfSignMonth[curMonth]['award' + conf.monthly];
        // } else {
        //     awards = conf.award;
        // }
        //
        // if (conf.vip && user.status.vip >= conf.vip) {
        //     awards = timeAwards(awards, 2);
        // }

        var awards = sign.round_rewards[sign.count];
        sign.count++;
        player.markDirty('sign.count');
        resp.data.awards = player.addAwards(awards, req.mod, req.act);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
    } while (false);

    onHandled();
};

// exports.sign_continuous_reward = function(player, req, resp, onHandled) {
//     var user = player.user;
//     do {
//         if (user.status.level < gConfGlobal.signOpenLevel) {
//             resp.code = 1; resp.desc = 'level not reached'; break;
//         }
//
//         var sign = user.sign;
//         if (sign.day != getGameDate()) {
//             resp.code = 1; resp.desc = 'not signed'; break;
//         }
//
//         if (!sign.continuous) {
//             resp.code = 1; resp.desc = 'no reward'; break;
//         }
//
//         if (sign.continuous_reward) {
//             resp.code = 1; resp.desc = 'already reward'; break;
//         }
//
//         var conf = gConfSignReward[sign.continuous];
//         if (!conf) {
//             var max = 0;
//             for (var day in gConfSignReward) {
//                 if (day > max) {
//                     max = +day;
//                 }
//             }
//
//             conf = gConfSignReward[max];
//         }
//
//         sign.continuous_reward = 1;
//         player.markDirty('sign.continuous_reward');
//
//         resp.data.awards = player.addAwards(conf.awards,req.mod,req.act);
//     } while (false);
//
//     onHandled();
// };

exports.get_vip_reward = function (player, req, resp, onHandled) {
    var user = player.user;
    do {

        var vip = req.args.vip;
        var conf = gConfVip[vip];
        if (!conf) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (user.status.vip < vip) {
            resp.code = 1; resp.desc = 'vip not reached'; break;
        }

        var rewards = user.payment.vip_rewards;
        if (rewards[vip]) {
            resp.code = 1; resp.desc = 'rewarded'; break;
        }

        var costs = gConfVip[vip].curPrice;
        if (!player.checkCosts(costs)) {
            resp.code = 1; resp.desc = 'cash not enough'; break;
        }

        rewards[vip] = 1;
        player.markDirty('payment.vip_rewards.' + vip);
        resp.data.costs = player.addAwards(costs, req.mod, req.act);
        resp.data.awards = player.addAwards(conf.awards, req.mod, req.act);
    } while (false);

    onHandled();
};

exports.get_enemy = function (player, req, resp, onHandled) {
    if (!req.args.enemy || isNaN(req.args.enemy)) {
        resp.code = 1; resp.desc = 'no enemy';
        onHandled();
        return;
    }

    var from = req.args.from;
    if (!from || from == 'world') {
        requestWorld(req, resp, onHandled);
    } else if (from == 'universe' || from == 'worldwar') {
        requestWorldWar(req, resp, onHandled);
    } else if (from == 'arena') {
        requestArenaServer(req, resp, onHandled);
    } else if (from == 'teamzone') {
        requestTeamZone(req, resp, onHandled);
    } else if (from == 'landgrabber') {
        requestLandGrabber(req, resp, onHandled);
    } else if (from == 'countrywar') {
        requestCountryWar(req, resp, onHandled);
    } else if (from == 'legionwar') {
        requestLegionWarByModAndAct(req, 'api', 'get_enemy', req.args, function (wResp) {
            resp.code = wResp.code;
            resp.desc = wResp.desc;
            resp.data = wResp.data;

            onHandled();
        });
    }
}

exports.mark_guide = function (player, req, resp, onHandled) {
    var request = req.args.request;
    var guide = player.user.activity.guide;
    if (guide[request] == 0) {
        guide[request] = common.getTime();
        player.markDirty('activity.guide.' + request);
        // resp.data.awards = player.addAwards(gConfSpecialReward[request].reward,req.mod,req.act);

        var retAwards = {};
        retAwards.awards = gConfSpecialReward[request].reward;
        resp.data.awards = retAwards;

        for (var i = 0; i < resp.data.awards.length; i++) {
            var r = resp.data.awards[i];
            r[1] = +r[1];
        }

        if (request == 'guide_guanyu') {
            // 进入主场景
            var phpReq = {
                uid: req.uid,
                act: 'user_scene',
                args: {
                    sid: config.DistId,
                    openid: player.user.info.account,
                    level: player.user.status.level,
                    type: 1,
                    time: 0,
                },
            };
            LogCollect(phpReq.uid, phpReq.act, phpReq.args);
            // requestPHP(phpReq, {});
        }
    }

    if (+req.guide == 5) {
        if (!player.user.online_stat.guide_first) {
            player.user.online_stat.guide_first = common.getTime()
            player.markDirty("online_stat.guide_first")
            DeviceLogCollect(player, "guide_first", {}, false);
        }
    }

    onHandled();
};

exports.mark_step = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var id = Math.floor(req.args.id);
        var step = Math.floor(req.args.step);
        if (isNaN(id) || isNaN(step)) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        user.mark.step[id] = step;
        player.markDirty('mark.step.' + id);
    } while (false);

    onHandled();
};

exports.rank_list = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.level_rank_list = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

exports.test_sys_mail = function (player, req, resp, onHandled) {
    requestWorld(req, resp, function () {
        onHandled();
    });
};

exports.get_honor_hall = function (player, req, resp, onHandled) {
    if (!isModuleOpen_new(player, 'gloryHall')) {
        resp.code = 1; resp.desc = 'not open'; onHandled(); return;
    }

    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            resp.data.honor_list['pvp'] = null;

            var retList = resp.data.honor_list;
            var names = resp.data.names;
            requestWorldWar(req, resp, function () {
                retList['pvp'] = resp.data.pvpInfo;
                delete resp.data.pvpInfo;
                resp.data.honor_list = retList;
                resp.data.names = names;
                onHandled();
            })
            return;
        }

        onHandled();
    });
};

exports.get_honor_user = function (player, req, resp, onHandled) {
    if (!isModuleOpen_new(player, 'gloryHall')) {
        resp.code = 1; resp.desc = 'not open'; onHandled(); return;
    }

    if (req.args.type != 'pvp') {
        requestWorld(req, resp, onHandled);
    } else {
        requestWorldWar(req, resp, function () {
            if (resp.data.info) {
                requestWorldByModAndAct(req, 'user', 'get_honor_bullet', { target: req.args.target }, function (worldResp) {
                    resp.data.info.bullet = worldResp.data.bullet;
                    onHandled();
                });
            } else {
                onHandled();
            }
        });
    }
};

exports.send_bullet = function (player, req, resp, onHandled) {
    do {
        var valid = true;
        switch (req.args.type) {
            case 'fight_force': break;
            case 'arena': break;
            case 'tower': break;
            case 'country1': break;
            case 'country2': break;
            case 'country3': break;
            case 'legion': break;
            case 'pvp': break;
            default: valid = false;
        }
        if (!valid) {
            resp.code = 1; resp.desc = 'invalid type'; break;
        }

        if (!isModuleOpen_new(player, 'gloryHall')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var bullet = req.args.bullet;
        if (!bullet) {
            resp.code = 1; resp.desc = 'require bullet'; break;
        }

        if (bullet.length > 8) {
            resp.code = 1; resp.desc = 'too long'; break;
        }

        // TODO bullet 敏感词过滤

        if (req.args.type == 'pvp') {
            requestWorldWar(req, resp, function () {
                if (resp.code == 0) {
                    requestWorld(req, resp, onHandled);
                } else {
                    onHandled();
                }
            });
            return;
        } else {
            requestWorld(req, resp, onHandled);
        }
        return;
    } while (false);

    onHandled();
};
// 废弃
// exports.get_first_pay_reward = function(player, req, resp, onHandled) {
//     var user = player.user;
//     do {
//         if (user.mark.first_pay != 1) {
//             resp.code = 1; resp.desc = "invalid status"; break;
//         }
//
//         user.mark.first_pay = 2;
//         player.markDirty('mark.first_pay');
//         player.updateFirstPayProgress('fight_force');
//
//         resp.data.awards = player.addAwards(gConfSpecialReward['first_pay'].reward,req.mod,req.act);
//         resp.data.first_pay = user.activity.first_pay;
//     } while (false);
//
//     onHandled();
// };

exports.active_user = function (player, req, resp, onHandled) {
    requestWss(req, resp, onHandled);
};

exports.get_main_city = function (player, req, resp, onHandled) {
    var user = player.user;
    requestWorld(req, resp, function () {
        if (resp.code == 0) {
            if (player.hasTip) {
                for (var type in user.tips) {
                    resp.data.tips[type] = user.tips[type];
                }

                user.tips = {};
                player.markDirty('tips');
            }

            // 检测到期的人皇装扮,发送最新的装扮数据
            // 幻化装备是否到期
            player.cleanSkyIllusionEquip();
            var skyObj = {};
            var arr = ['weapon', 'mount', 'wing'];
            for (var i = 0, len = arr.length; i < len; i++) {
                skyObj[arr[i] + '_illusion'] = user.sky_suit[arr[i] + '_illusion'];
            }
            resp.data.sky_suit = skyObj;

            var now = common.getTime();
            resp.data.food = player.getFood(now);
            resp.data.food_red = player.getFoodRed(now);
            resp.data.food_time = user.mark.food_time;
            resp.data.food_time_red = user.mark.food_time_red;
            resp.data.online_time = player.getOnlineTime();
            resp.data.guide_task = user.guide_task;

            var realDay = common.getDate();
            if (user.mark.login_day != realDay) {
                user.mark.login_day = realDay;
                player.markDirty('mark.login_day');

                // 统计相关
                var createDays = player.getCreateDays();
                if (createDays < 30) {
                    user.mark.retention |= 1 << createDays;
                    player.markDirty('mark.retention');
                }
            }
        }

        requestWorldWarByModAndAct(req, 'worldwar', 'get_fight_info', {}, function (worldWarResp) {
            var fightInfo = worldWarResp.data.fight_info;
            if (fightInfo) {
                resp.data.ww_fight_info = fightInfo

                player.memData.status = 'prepare_ww_third';
                player.memData.rand1 = fightInfo.rand1;
                player.memData.rand2 = fightInfo.rand2;
                player.memData.fight_info = fightInfo.info;
                player.memData.fight_enemy = fightInfo.enemy;
                player.memData.ww_record_third_pos = resp.data.pos;

                var randPos = common.randRange(1, player.memData.pos_count);
                var randAttrs = common.randArrayWithNum(AttributeIds, 3);
                fightInfo.fight_time = player.memData.fight_time = common.getTime();
                fightInfo.rand_pos = player.memData.rand_pos = randPos;
                fightInfo.rank_attrs = player.memData.rand_attrs = randAttrs;
            }

            onHandled();
        });
    });
};

// add by fish
exports.change_role = function (player, req, resp, onHandled) {
    do {
        var hid = req.args.hid;
        var target_hid = req.args.target_hid;
        var user = player.user;
        var team1 = user.team[1];
        var heros = user.hero_bag.heros;
        if (!team1[target_hid] || !heros[hid] || !heros[target_hid]) {
            resp.code = 1; resp.desc = 'no change role'; break;
        }

        var newTeam = {};
        for (var i in team1) {
            if (i == target_hid) {
                newTeam[hid] = team1[i];
            } else {
                newTeam[i] = team1[i];
            }
        }

        user.team[1] = newTeam;
        player.markDirty('team.1');

        var defNewTeam = {};
        var defTeam = user.def_info.team;
        for (var id in defTeam) {
            if (id == target_hid) {
                defNewTeam[hid] = defTeam[id];
            } else {
                defNewTeam[id] = defTeam[id];
            }
        }

        user.def_info.team = defNewTeam;
        player.markFightForceChanged(1);
        player.markDirty('def_info.team');
    } while (false);

    resp.data.team = user.team[1];

    onHandled();
};

exports.get_def_info = function (player, req, resp, onHandled) {
    resp.data.team = player.user.def_info.team;
    resp.data.skills = player.user.def_info.skills;
    onHandled();
};

exports.set_def_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        var skills = req.args.skills;

        // 保存阵容
        if (team) {
            // 保存阵容
            var valid = true;
            var oldNum = Object.keys(user.def_info.team).length;
            var newNum = Object.keys(team).length;
            if (newNum > 7 || oldNum > newNum) {
                return false;
            }

            if (!team) {
                return false;
            }
            if (Object.keys(team).length > 7) {
                return false;
            }

            for (var hid in team) {
                if (!user.hero_bag.heros[hid]) {
                    valid = false; break;
                }
            }

            if (!valid) {
                return false;
            }

            user.def_info.team = team;
            player.markDirty('def_info.team');
        }

        if (skills) {
            if (!util.isArray(skills)) {
                resp.code = 1; resp.desc = 'args error'; break;
            }

            var length = skills.length;
            if (length <= 0 || length > gConfGlobal.maxPlayerSkill) {
                resp.code = 1; resp.desc = 'length error'; break;
            }

            var ok = true;
            var test = [];
            var dragon = user.dragon;
            for (var i = 0; i < length; i++) {
                var skill = skills[i];
                skill = Math.floor(+skill);
                if (!skill) continue;

                if (!dragon[skill]) {
                    ok = false; break;
                }
                if (test.indexOf(skill) >= 0) {
                    ok = false; break;
                }
                if (i > gConfLevel[user.status.level].skillNum) {
                    ok = false; break;
                }

                test.push(skill);
            }

            if (!ok) {
                resp.code = 1; resp.desc = 'skills error'; break;
            }

            for (var i = 0, len = skills.length; i < len; i++) {
                user.def_info.skills[i + 1] = skills[i];
            }

            player.markDirty('def_info.skills');
        }

        if (!user.def_info.set) {
            user.def_info.set = 1;
            player.markDirty('def_info.set');
        }
    } while (false);

    onHandled();
};

// 改变阵型 -fish
exports.save_team = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        var skills = req.args.skills;
        var teamId = 1;

        if (!player.syncTeam(1, team)) {
            resp.code = 1; resp.desc = 'args error'; break;
        }

        if (skills) {
            if (!util.isArray(skills)) {
                resp.code = 1; resp.desc = 'args error'; break;
            }

            var length = skills.length;
            if (length <= 0 || length > gConfGlobal.maxPlayerSkill) {
                resp.code = 1; resp.desc = 'length error'; break;
            }

            var ok = true;
            var test = [];
            var dragon = user.dragon;
            for (var i = 0; i < length; i++) {
                var skill = skills[i];
                skill = Math.floor(+skill);
                if (!skill) continue;

                if (!dragon[skill]) {
                    ok = false; break;
                }
                if (test.indexOf(skill) >= 0) {
                    ok = false; break;
                }
                if (i > gConfLevel[user.status.level].skillNum) {
                    ok = false; break;
                }

                test.push(skill);
            }

            if (!ok) {
                resp.code = 1; resp.desc = 'skills error'; break;
            }

            for (var i = 0, len = skills.length; i < len; i++) {
                user.def_info.skills[i + 1] = skills[i];
            }

            player.markDirty('def_info.skills');
        }

        if (!user.def_info.set) {
            user.def_info.set = 1;
            player.markDirty('def_info.set');
        }
    } while (false);

    onHandled();
};

// 改变换英雄上阵 -fish
exports.change_team = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var team = req.args.team;
        var skills = req.args.skills;

        // 保存阵容
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

            user.def_info.team = clone(team);

            player.markDirty('def_info.team');
        }

        if (skills) {
            if (!util.isArray(skills)) {
                resp.code = 1; resp.desc = 'args error'; break;
            }

            var length = skills.length;
            if (length <= 0 || length > gConfGlobal.maxPlayerSkill) {
                resp.code = 1; resp.desc = 'length error'; break;
            }

            var ok = true;
            var test = [];
            var dragon = user.dragon;
            for (var i = 0; i < length; i++) {
                var skill = skills[i];
                skill = Math.floor(+skill);
                if (!skill) continue;

                if (!dragon[skill]) {
                    ok = false; break;
                }
                if (test.indexOf(skill) >= 0) {
                    ok = false; break;
                }
                if (i > gConfLevel[user.status.level].skillNum) {
                    ok = false; break;
                }

                test.push(skill);
            }

            if (!ok) {
                resp.code = 1; resp.desc = 'skills error'; break;
            }

            for (var i = 0, len = skills.length; i < len; i++) {
                user.def_info.skills[i + 1] = skills[i];
            }

            player.markDirty('def_info.skills');
        }

        if (!user.def_info.set) {
            user.def_info.set = 1;
            player.markDirty('def_info.set');
        }
    } while (false);

    onHandled();
};

exports.refresh_pay = function (player, req, resp, onHandled) {
    if (!player.payNotify) {
        resp.code = 1; resp.desc = 'no pay';
    } else {
        var user = player.user;
        resp.data.vip = user.status.vip;
        resp.data.vip_xp = user.status.vip_xp;
        resp.data.cash = user.status.cash;
        resp.data.bindcash = user.status.bindcash;
        resp.data.payment = user.payment;

        if (player.memData.payAwards) {
            resp.data.awards = {};
            resp.data.awards.awards = player.memData.payAwards;
            resp.data.awards.heros = {};
            player.memData.payAwards = null;
        }

        if (player.memData.chargeId) {
            resp.data.chargeId = player.memData.chargeId;
            player.memData.chargeId = null;
        }
    }

    onHandled();
};

exports.get_pay = function (player, req, resp, onHandled) {
    resp.data.vip = user.status.vip;
    resp.data.cash = user.status.cash;
    resp.data.payment = user.payment;
    onHandled();
};

exports.debug_world_user = function (player, req, resp, onHandled) {
    if (debugging) {
        requestWorld(req, resp, onHandled);
    } else {
        resp.code = 1; resp.desc = "not support";
        onHandled();
    }
};

exports.get_title = function (player, req, resp, onHandled) {
    requestWorld(req, resp, function () {
        var titleone = resp.data.title;

        requestWorldWar(req, resp, function () {
            var titletwo = resp.data.title;
            if (titletwo == '') {
                resp.data.title = titleone;
            } else if (titleone == 'legion' || titleone == 'tower' || titleone == 'tavern') {
                resp.data.title = titletwo;
            } else {
                resp.data.title = titleone;
            }

            resp.data.quality = player.getQuality();
            resp.data.day_world_chat_count = player.user.mark.day_world_chat_count;
            onHandled();
        });
    });
};

exports.add_world_time = function (player, req, resp, onHandled) {
    player.user.mark.day_world_chat_count++;
    player.markDirty('mark.day_world_chat_count');
    onHandled();
};

exports.get_resback = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isActivityStart(player, 'res_back')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        resp.data.resback = user.resback;
    } while (false);

    onHandled();
};

// 获取玩家申请的军团列表和小队列表
exports.get_apply_list = function (player, req, resp, onHandled) {
    requestWorld(req, resp, onHandled);
};

// 小队雕像赏赐
exports.get_statue_awards_info = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var lastTime = user.statue_awards.last_time;
        resp.data.statue_awards = user.statue_awards;
    } while (false);

    onHandled();
};

// 小队雕像赏赐
exports.get_statue_awards = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var lastTime = user.statue_awards.last_time;
        var time = common.getTime();
        var cdTime = gConfGlobalNew.teamManorStatueAwardCD * 3600;
        if (time - lastTime < cdTime) {
            resp.code = 1; resp.desc = 'time has not yet'; break;
        }

        user.statue_awards.last_time = time;
        player.markDirty('statue_awards.last_time');

        var level = user.status.level;
        var dropId = gConfLevel[level].teamStatueAward;
        var awards = generateDrop(dropId);

        resp.data.time = time;
        resp.data.awards = player.addAwards(awards, 'user', 'get_awards_statue');

        player.doDailyTask('statueAward');
    } while (false);

    onHandled();
};

exports.http_test = function (player, req, resp, onHandled) {
    var curTime = common.getTime();
    var curTimeString = common.getDateTimeString(curTime);
    var clientSendTimeString = common.getDateTimeString(req.stime);

    resp.data.desc = util.format('[%s]-[%s] %s', clientSendTimeString, curTimeString, query.uid);

    onHandled();
};

// 标记boss提示
exports.mark_boss_notice = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var noticeId = req.args.id;
        if (!noticeId) {
            resp.code = 1; resp.desc = 'invalid args'; break;
        }

        if (!user.mark.boss_notice) {
            user.mark.boss_notice = [];
            player.markDirty('mark.boss_notice');
        }

        if (user.mark.boss_notice.indexOf(noticeId) < 0) {
            user.mark.boss_notice.push(noticeId);
            player.markDirty('mark.boss_notice');
        }

    } while (false);

    onHandled();
};

// 标记boss提示
exports.get_world_chat_count = function (player, req, resp, onHandled) {
    var user = player.user;
    do {
        var dayWorldChatMaxTime = gConfLevel[user.status.level].worldChatCount;
        resp.data.dayWorldChatCount = player.user.mark.day_world_chat_count;
        resp.data.dayWorldChatMaxTime = dayWorldChatMaxTime;
    } while (false);

    onHandled();
};


// 更新战斗力
exports.update_fight_force = function (player, req, resp, onHandled) {
    player.markFightForceChangedAll()
    player.getFightForce();

    onHandled();
};
