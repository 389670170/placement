var http = require('http');
var https = require('https');
var util = require('util');
var fs = require('fs');
var url = require('url');
var qs = require('querystring');
var zlib = require('zlib');

var clone = require('clone');
var mongodb = require('mongodb');
var redis = require('redis');

var common = require('./common.js');
var csv = require('./csv.js');
var logger = require('./logger.js');
var config = require(fs.existsSync('../config.js') ? '../config.js' : './config.js');

require('./global.js')

function loadGlobalServerConf(serverName, callback) {
    global.gConfGeneralText = new csv.CommonCSV('conf/language/' + config.language + '/generaltext.dat', ['key']);
    global.gConfGlobal = new csv.GlobalCSV('conf/global.dat');
    global.gConfGlobalNew = new csv.GlobalCSV('conf/global_new.dat');
    gConfGlobal.promoteRedRankBeginTime = csv.parseDate(gConfGlobal.promoteRedRankBegin);
    gConfGlobal.promoteRedRankEndTime = csv.parseDate(gConfGlobal.promoteRedRankEnd);

    if (serverName.indexOf('game') != -1 || serverName == 'world' || serverName == 'wss' || serverName == 'gateway' || serverName == 'landgrabber') {
        // 读取服务器信息
        var phpReq = {
            uid: 1,
            act: 'get_server_info',
            args: {
                uid: 1,
                sid: config.ServerId,
            },
        };

        global.gConfGlobalServer = {};

        var phpResp = {};
        phpResp.code = 0;
        phpResp.desc = '';
        requestPHP(phpReq, phpResp, function () {
            if (phpResp.code == 0) {
                global.serverInfo = phpResp['desc'];

                global.gConfGlobalServer.serverStartTime = csv.parseDate(global.serverInfo['ServerStartTime']);
                gConfGlobalServer.serverStartDate = getGameDate(gConfGlobalServer.serverStartTime);

                gConfGlobalServer.globalHost = global.serverInfo['globalHost'];
                gConfGlobalServer.globalPort = global.serverInfo['globalPort'];

                gConfGlobalServer.worldWarHost = global.serverInfo['worldWarHost'];
                gConfGlobalServer.worldWarPort = global.serverInfo['worldWarPort'];
                gConfGlobalServer.worldWarOpenTime = csv.parseDate(global.serverInfo['worldWarOpenTime']);

                gConfGlobalServer.legionWarHost = global.serverInfo['legionWarHost'];
                gConfGlobalServer.legionWarPort = global.serverInfo['legionWarPort'];

                gConfGlobalServer.territoryWarHost = global.serverInfo['territoryWarHost'];
                gConfGlobalServer.territoryWarPort = global.serverInfo['territoryWarPort'];

                gConfGlobalServer.countryWarHost = global.serverInfo['countryWarHost'];
                gConfGlobalServer.countryWarPort = global.serverInfo['countryWarPort'];

                gConfGlobalServer.arenaServerHost = global.serverInfo['arenaServerHost'];
                gConfGlobalServer.arenaServerPort = global.serverInfo['arenaServerPort'];

                gConfGlobalServer.landGrabberHost = global.serverInfo['landgrabberArrHost'];
                gConfGlobalServer.landGrabberPort = global.serverInfo['landgrabberArrPort'];

                gConfGlobalServer.teamzoneHost = global.serverInfo['teamZoneHost'];
                gConfGlobalServer.teamzonePort = global.serverInfo['teamZonePort'];

                gConfGlobalServer.merge_list = global.serverInfo.merge_list || [config.ServerId];

                callback && callback();
            }
        });
    }
}

function loadConf(serverName, is_init_db) {
    if (!config.language) {
        // 如果没配，默认简体中文
        config.language = 'simplifiedchinese';
    }

    // 加载配置文件
    global.gConfLevel = new csv.CommonCSV('conf/level.dat', ['level']);
    global.gConfVip = new csv.CommonCSV('conf/vip.dat', ['level']);
    global.gConfHero = new csv.CommonCSV('conf/hero.dat', ['id']);
    global.gConfHeroEvolution = new csv.CommonCSV('conf/heroevolution.dat', ['id']);
    global.gConfHeroPermute = new csv.CommonCSV('conf/heropermute.dat', ['star', 'id']);

    //ERROR(gConfHeroPermute);

    global.gConfCombatHeroTemplate = new csv.CommonCSV('conf/combatherotemplate.dat', ['id']);
    global.gConfHeroQuality = new csv.CommonCSV('conf/heroquality.dat', ['level']);
    global.gConfHeroQualityAttr = new csv.CommonCSV('conf/heroqualityattr.dat', ['level', 'ability']);
    global.gConfCity = new csv.CommonCSV('conf/city.dat', ['id']);
    global.gConfAttribute = new csv.CommonCSV('conf/attribute.dat', ['id']);
    global.gConfDailyTask = new csv.CommonCSV('conf/dailytask.dat', ['id']);
    global.gConfLegion = new csv.GlobalCSV('conf/legion.dat');
    // global.gConfLegionLevel = new csv.CommonCSV('conf/legionlevel.dat', ['level']);
    global.gConfDrop = new csv.CommonCSV('conf/drop.dat', ['id']);
    global.gConfGuard = new csv.CommonCSV('conf/guard.dat', ['city', 'event']);

    global.gConfActivitiesRaw = new csv.CommonCSV('conf/activities.dat', ['key']);
    global.gConfAvCondition = new csv.CommonCSV('conf/activities_condition.dat', ['key', 'confId']);
    global.gConfAvSchedule = new csv.CommonCSV('conf/activities_schedule.dat', ['key', 'round']);
    global.gConfAvNewStage = new csv.CommonCSV('conf/activities_newstage.dat', ['key', 'round']);

    global.gConfFormation = new csv.CommonCSV('conf/formation.dat', ['id']);
    global.gConfMonster = new csv.CommonCSV('conf/monster.dat', ['id']);
    global.gConfPosition = new csv.CommonCSV('conf/position.dat', ['id']);
    global.gConfTavernHot = new csv.CommonCSV('conf/tavernhot.dat', ['id']);
    global.gConfAvLimitGroup = new csv.CommonCSV('conf/avlimitgroup.dat', ['id']);
    global.gConfAvLuckyWheel = new csv.CommonCSV('conf/avluckywheel.dat', ['id']);

    global.gConfPromoteLucklyOrange = new csv.CommonCSV('conf/promotelucklyorange.dat', ['id']);
    global.gConfPromoteLucklyRed = new csv.CommonCSV('conf/promotelucklyred.dat', ['id']);
    global.gConfAttPrCoEff = new csv.CommonCSV('conf/attprcoeff.dat', ['level']);
    global.gConfLegionIcon = new csv.CommonCSV('conf/legionicon.dat', ['id']);
    global.gConfVersion = new csv.CommonCSV('conf/version.dat', ['key']);

    // 战队系统配置
    global.gConfTeamBase = new csv.CommonCSV('conf/teambase.dat', ['level']);
    global.gConfTeamEmblem = new csv.CommonCSV('conf/teamemblem.dat', ['id']);
    global.gConfTeamhInt = new csv.CommonCSV('conf/teamhint.dat', ['key']);
    global.gConfTeamSkill = new csv.CommonCSV('conf/teamskill.dat', ['id']);

    // 新军团
    global.gConfLegionLevel = new csv.CommonCSV('conf/legionlevel.dat', ['level']);
    global.gConfLegionJurisDiction = new csv.CommonCSV('conf/legionjurisdiction.dat', ['member']);
    global.gConfLegionFlag = new csv.CommonCSV('conf/legionflag.dat', ['type', 'id']);
    global.gConfLegionBuild = new csv.CommonCSV('conf/legionbuild.dat', ['id']);
    global.gConfLegioBonfirerRedpaper = new csv.CommonCSV('conf/legionbonfireredpaper.dat', ['key']);
    global.gConfLegioBonfire = new csv.CommonCSV('conf/legionbonfire.dat', ['level']);

    // 军团战
    global.gConfLegionWarCityCard = new csv.CommonCSV('conf/legionwarcard.dat', ['id']);

    // 邮件配置
    global.gConfMail = new csv.CommonCSV('conf/language/' + config.language + '/mail.dat', ['id']);

    global.gConfGeneralText = new csv.CommonCSV('conf/language/' + config.language + '/generaltext.dat', ['key']);

    if (!serverName || serverName == 'game') {
        //global.gConfPlayerSkill = new csv.CommonCSV('conf/playerskill.dat',['id']);
        global.gConfReborn = new csv.CommonCSV('conf/reborn.dat', ['type', 'level']);
        global.gConfSkill = new csv.CommonCSV('conf/skill.dat', ['id']);
        global.gConfSkillGroup = new csv.CommonCSV('conf/skillgroup.dat', ['id']);
        global.gConfSoldier = new csv.CommonCSV('conf/soldier.dat', ['id']);
        global.gConfSoldierLevel = new csv.CommonCSV('conf/soldierlevel.dat', ['id', 'level', 'star']);
        global.gConfSoldierDress = new csv.CommonCSV('conf/dress.dat', ['id']);
        global.gConfSummon = new csv.CommonCSV('conf/summon.dat', ['id']);
        global.gConfEquipClassified = new csv.CommonCSV('conf/equip.dat', ['level', 'quality', 'id']);
        global.gConfGodEquip = new csv.CommonCSV('conf/godequip.dat', ['type', 'level']);
        global.gConfItem = new csv.CommonCSV('conf/item.dat', ['id']);   //物品配置表
        global.gConfGem = new csv.CommonCSV('conf/gem.dat', ['id']);
        global.gConfFate = new csv.CommonCSV('conf/fate.dat', ['id']);
        global.gConfFateTreasure = new csv.CommonCSV('conf/fatetreasure.dat', ['id']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);
        global.gConfInnate = new csv.CommonCSV('conf/innate.dat', ['id']);
        global.gConfInnateGroup = new csv.CommonCSV('conf/innategroup.dat', ['id']);

        // 关卡
        global.gConfCustom = new csv.CommonCSV('conf/custom.dat', ['id']);
        global.gConfCustomSet = new csv.CommonCSV('conf/customset.dat', ['type', 'id']);
        global.gConfCustomDropPool = new csv.CommonCSV('conf/customdroppool.dat', ['id']);
        global.gConfCustomPreview = new csv.CommonCSV('conf/custompreview.dat', ['id']);

        global.gConfCustomDragon = new csv.CommonCSV('conf/dragon.dat', ['id']);
        global.gConfCustomTreasure = new csv.CommonCSV('conf/customtreasure.dat', ['id']);
        global.gConfCustomVillage = new csv.CommonCSV('conf/customvillage.dat', ['id']);
        //global.gConfCustomKing          = new csv.CommonCSV('conf/customking.dat',  ['chapter', 'id']);
        global.gConfDragonGemConvert = new csv.CommonCSV('conf/dragongemconvert.dat', ['level']);   // 龙晶转换表
        global.gConfDragonGem = new csv.CommonCSV('conf/dragongem.dat', ['id']);
        global.gConfDragonLevel = new csv.CommonCSV('conf/dragonlevel.dat', ['level']);
        global.gConfCustomElement = new csv.CommonCSV('conf/customelement.dat', ['id']);
        global.gConfCustomKingWay = new csv.CommonCSV('conf/customkingway.dat', ['id']);
        global.gConfCustomPrincess = new csv.CommonCSV('conf/customprincess.dat', ['plan']);

        global.gConfTavern = new csv.CommonCSV('conf/tavern.dat', ['type']);
        global.gConfTavernLimitHero = new csv.CommonCSV('conf/tavernlimithero.dat', ['id']);

        // 商店配置
        global.gConfShop = new csv.CommonCSV('conf/shop.dat', ['id']);
        global.gConfShopNew = new csv.CommonCSV('conf/shopuniversaltab.dat', ['id']);
        global.gConfShopTab = new csv.CommonCSV('conf/shopuniversalconfig.dat', ['id']);
        global.gConfShopGoods = new csv.CommonCSV('conf/shopuniversalgoods.dat', ['groupId', 'id']);

        global.gConfOnline = new csv.CommonCSV('conf/avonline.dat', ['id']);                                    // 在线奖励

        global.gConfResCopyList = new csv.CommonCSV('conf/rescplist.dat', ['type']);
        global.gConfCountryJadeRewardFix = new csv.CommonCSV('conf/countryjaderewardfix.dat', ['level']);
        global.gConfCountryJadeRewardDrop = new csv.CommonCSV('conf/countryjaderewarddrop.dat', ['color']);

        for (var type in gConfResCopyList) {
            var copyConf = gConfResCopyList[type];
            if (copyConf.robotConf) {
                copyConf.robotConf = new csv.CommonCSV('conf/' + copyConf.robotConf, ['id']);
            }
        }
        global.gConfResCopyInfo = new csv.CommonCSV('conf/rescpinfo.dat', ['id', 'difficulty']);
        global.gConfBuy = new csv.CommonCSV('conf/buy.dat', ['times']);
        global.gConfArenaLevel = new csv.CommonCSV('conf/arenalevel.dat', ['level']);

        global.gConfTowerAttReward = new csv.CommonCSV('conf/towerattreward.dat', ['att']);
        global.gConfTowerStarReward = new csv.CommonCSV('conf/towerstarreward.dat', ['starNum']);
        global.gConfTowerCoinReward = new csv.CommonCSV('conf/towercoinreward.dat', ['id']);
        global.gConfTowerStarShop = new csv.CommonCSV('conf/towerstarshop.dat', ['id']);

        // 勇者之塔
        global.gConfTowerresultaward = new csv.CommonCSV('conf/towerresultaward.dat', ['id']);
        global.gConfTower = new csv.CommonCSV('conf/tower.dat', ['id']);

        global.gConfOctopus = new csv.CommonCSV('conf/avoctopusbase.dat', ['id']);          // 章鱼宝藏
        global.gConfOctopusAwardRaw = new csv.CommonCSV('conf/avoctopusaward.dat', ['confId', 'id']);          // 章鱼宝藏

        global.gConfAbyssCustom = new csv.CommonCSV('conf/abysscustom.dat', ['id']);        // 深渊世界 关卡信息
        global.gConfAbyssBox = new csv.CommonCSV('conf/abyssbox.dat', ['id']);              // 深渊世界 宝箱信息

        global.gConfAbyssTreasureCustom = new csv.CommonCSV('conf/abysstreasurecustom.dat', ['id']);        // 深渊宝藏 关卡信息
        global.gConfAbyssTreasureBox = new csv.CommonCSV('conf/abysstreasurebox.dat', ['id']);              // 深渊宝藏 宝箱信息

        global.gConfTreasure = new csv.CommonCSV('conf/treasure.dat', ['id', 'active']);
        // 装备相关配置
        global.gConfEquip = new csv.CommonCSV('conf/equipconf.dat', ['id']);
        global.gConfEquipBase = new csv.CommonCSV('conf/equipbase.dat', ['type', 'quality']);
        global.gConfEquipTalent = new csv.CommonCSV('conf/equiptalent.dat', ['type', 'level']);

        global.gConfEquipSuit = new csv.CommonCSV('conf/equipsuit.dat', ['id']);
        global.gConfEquipRefine = new csv.CommonCSV('conf/equiprefine.dat', ['id', 'level']);
        global.gConfEquipRefineSuit = new csv.CommonCSV('conf/equiprefinesuit.dat', ['id']);
        global.gConfEquipUpgrade = new csv.CommonCSV('conf/equipupgrade.dat', ['level']);
        global.gConfEquipUpgradeMaster = new csv.CommonCSV('conf/equipmasterupgrade.dat', ['level']);
        global.gConfEquipRefineMaster = new csv.CommonCSV('conf/equipmasterrefine.dat', ['level']);
        global.gConfEquipImprove = new csv.CommonCSV('conf/equipimprove.dat', ['quality', 'grade']);

        global.gConfGemSuit = new csv.CommonCSV('conf/gemsuit.dat', ['id']);
        global.gConfThief = new csv.CommonCSV('conf/thief.dat', ['id']);
        global.gConfTrial = new csv.CommonCSV('conf/trial.dat', ['level']);

        global.gConfHelpEquipRaw = new csv.CommonCSV('conf/avhelpequip.dat', ['confId', 'id']);           // 矮人支援

        // 竞技场相关配置
        global.gConfArenaBase = new csv.CommonCSV('conf/arenabase.dat', ['type']);
        global.gConfArenaRank = new csv.CommonCSV('conf/arenarank.dat', ['type', 'level']);
        global.gConfArenaAchievement = new csv.CommonCSV('conf/arenaachievement.dat', ['type', 'level']);
        global.gConfArenaRefresh = new csv.CommonCSV('conf/arenarefresh.dat', ['id']);

        global.gConfDailyTaskReward = new csv.CommonCSV('conf/dailytaskreward.dat', ['active']);
        global.gConfTask = new csv.CommonCSV('conf/task.dat', ['type', 'goalId']);
        global.gConfGuideTask = new csv.CommonCSV('conf/guidetask.dat', ['id']);

        global.gConfTowerType = new csv.CommonCSV('conf/towertype.dat', ['type']);
        global.gConfRecharge = new csv.CommonCSV('conf/recharge.dat', ['id']);
        global.gConfShipper = new csv.CommonCSV('conf/shipper.dat', ['shipper']);
        global.gConfShipperReward = new csv.CommonCSV('conf/shipperreward.dat', ['level']);
        global.gConfGuardField = new csv.CommonCSV('conf/guardfield.dat', ['city']);
        global.gConfGuardMonster = new csv.CommonCSV('conf/guardmonster.dat', ['id']);
        global.gConfGuardSkill = new csv.CommonCSV('conf/guardskill.dat', ['city', 'level']);
        global.gConfAltar = new csv.CommonCSV('conf/altar.dat', ['id']);
        global.gConfAltarGem = new csv.CommonCSV('conf/altargem.dat', ['level']);
        global.gConfSign = new csv.CommonCSV('conf/avsignin.dat', ['round', 'sort']);
        global.gConfSignHigh = new csv.CommonCSV('conf/avsignin_high.dat', ['round', 'sort']);

        global.gConfAVSignNew = new csv.CommonCSV('conf/avsign_new.dat', ['round', 'sort']);

        // global.gConfSignMonth = new csv.CommonCSV('conf/signmonth.dat', ['month']);
        // global.gConfSignReward = new csv.CommonCSV('conf/signreward.dat', ['day']);
        global.gConfExploitWall = new csv.CommonCSV('conf/exploitwall.dat', ['key', 'rank']);
        global.gConfJadeSeal = new csv.CommonCSV('conf/jadeseal.dat', ['id']);
        global.gConfJadeSealHero = new csv.CommonCSV('conf/jadesealhero.dat', ['star']);
        global.gConfLegionCopyReward = new csv.CommonCSV('conf/legioncopyreward.dat', ['damage']);
        global.gConfSpecialReward = new csv.CommonCSV('conf/specialreward.dat', ['id']);
        global.gConfModuleOpen = new csv.CommonCSV('conf/moduleopen.dat', ['module']);
        global.gConfModuleOpen_new = new csv.CommonCSV('conf/moduleopen_new.dat', ['module']);
        global.gConfTraining = new csv.CommonCSV('conf/training.dat', ['id']);
        global.gConfHookTreasure = new csv.CommonCSV('conf/hooktreasure.dat', ['id']);
        global.gConfCastleLevel = new csv.CommonCSV('conf/castlelevel.dat', ['level']);
        global.gConfArenaHistory = new csv.CommonCSV('conf/arenahistory.dat', ['stage']);
        global.gConfAchievement = new csv.CommonCSV('conf/achievement.dat', ['egg']);
        global.gConfMarket = new csv.CommonCSV('conf/market.dat', ['id']);
        global.gConfFeilongFly = new csv.CommonCSV('conf/feilongfly.dat', ['id']);
        global.gConfHeroBox = new csv.CommonCSV('conf/herobox.dat', ['id']);
        global.gConfTowerCoinAward = new csv.CommonCSV('conf/towercoinreward.dat', ['star']);
        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);

        global.gConfLegionWarCity = new csv.CommonCSV('conf/legionwarcity.dat', ['id']);
        global.gConfLegionWarCityBuf = new csv.CommonCSV('conf/legionwarcitybuf.dat', ['bufType']);
        global.gConfLegionWarAttackAward = new csv.CommonCSV('conf/legionwarattackaward.dat', ['attackCount']);
        global.gConfTavernLuck = new csv.CommonCSV('conf/tavernluck.dat', ['level']);
        global.gConfWarCollege = new csv.CommonCSV('conf/warcollege.dat', ['id']);
        global.gConfWorldSituation = new csv.CommonCSV('conf/worldsituation.dat', ['id']);

        global.gConfLegionConstruct = new csv.CommonCSV('conf/legionconstruct.dat', ['id']);
        global.gConfLegionConstructReward = new csv.CommonCSV('conf/legionconstructreward.dat', ['progress']);
        global.gConfHeadpic = new csv.CommonCSV('conf/settingheadicon.dat', ['id']);
        global.gConfUser = new csv.CommonCSV('conf/user.dat', ['id']);
        global.gConfLog = new csv.CommonCSV('conf/log.dat', ['modAct', 'index']);
        global.gConfLogIndex = new csv.CommonCSV('conf/logindex.dat', ['modAct']);
        global.gConfPlayLog = new csv.CommonCSV('conf/playlog.dat', ['type', 'name']);
        global.gConfCityTribute = new csv.CommonCSV('conf/citytribute.dat', ['id']);
        global.gConfLocalText = new csv.CommonCSV('conf/language/' + config.language + '/localtext.dat', ['Id']);
        global.gConfDiggingDistribution = new csv.CommonCSV('conf/diggingdistribution.dat', ['id']);
        global.gConfDiggingProduct = new csv.CommonCSV('conf/diggingproduct.dat', ['id']);
        global.gConfDiggingEvent = new csv.CommonCSV('conf/diggingevent.dat', ['level']);
        global.gConfDiggingProgress = new csv.CommonCSV('conf/diggingprogress.dat', ['id']);
        global.gConfDiggingBomb = new csv.CommonCSV('conf/diggingbomb.dat', ['id']);
        global.gConfDiggingRobot = new csv.CommonCSV('conf/diggingrobot.dat', ['id']);
        global.gConfNewUserMail = new csv.CommonCSV('conf/newusermail.dat', ['plat']);
        global.gConfExchangeKey = new csv.CommonCSV('conf/exchangekey.dat', ['id']);
        global.gConfLegionRobot = new csv.CommonCSV('conf/legiontrialrobot.dat', ['id']);
        global.gConfWorldWarScore = new csv.CommonCSV('conf/worldwarscore.dat', ['id']);
        global.gConfWorldWarBattle = new csv.CommonCSV('conf/worldwarbattle.dat', ['id']);
        global.gConfChatNotice = new csv.CommonCSV('conf/chatnotice.dat', ['key']);
        global.gConfResback = new csv.CommonCSV('conf/resback.dat', ['type']);
        global.gConfGoldMine = new csv.CommonCSV('conf/goldmine.dat', ['id'])
        global.gConfPositionShp = new csv.CommonCSV('conf/positionshop.dat', ['id'])

        /** 礼包邮件配置 */
        global.gConfGiftMail = new csv.CommonCSV('conf/giftmail.dat', ['pid']);

        // 活动相关配置
        global.gConfAvPayOnlyRaw = new csv.CommonCSV('conf/avpayonly.dat', ['confId', 'id']);
        global.gConfAvSingleRechargeRaw = new csv.CommonCSV('conf/avsinglerecharge.dat', ['confId', 'id']);
        global.gConfAvDailyRechargeRaw = new csv.CommonCSV('conf/avdailyrecharge.dat', ['confId', 'id']);
        global.gConfAvTodayDoubleRaw = new csv.CommonCSV('conf/avtodaydouble.dat', ['confId', 'day']);
        global.gConfAvLoginGiftRaw = new csv.CommonCSV('conf/avlogingift.dat', ['confId', 'day']);
        global.gConfAvDayRechargeRaw = new csv.CommonCSV('conf/avday_recharge.dat', ['confId', 'id']);
        global.gConfAvAccumulateDailyRaw = new csv.CommonCSV('conf/avaccumulatedaily.dat', ['confId', 'day', 'id']);
        global.gConfAvAccumulatePayRaw = new csv.CommonCSV('conf/accumulatepay.dat', ['confId', 'id']);
        global.gConfAvAccumulateRechargeRaw = new csv.CommonCSV('conf/avaccumulaterecharge.dat', ['confId', 'id']);
        global.gConfAvExpendGiftRaw = new csv.CommonCSV('conf/avexpendgift.dat', ['confId', 'id']);
        global.gConfAvDailyCostRaw = new csv.CommonCSV('conf/avdailycost.dat', ['confId', 'id']);
        global.gConfAvOvervaluedGiftIdRaw = new csv.CommonCSV('conf/avovervaluedgift.dat', ['confId', 'day', 'id']);
        global.gConfAvOvervaluedGiftNewId = new csv.CommonCSV('conf/avovervaluedgiftnew.dat', ['day', 'id']);
        global.gConfAvPrivilegeGift = new csv.CommonCSV('conf/avprivilegegift.dat', ['id']);
        global.gConfAvWeekGift = new csv.CommonCSV('conf/avweekgift.dat', ['id']);
        global.gConfAvLuckyWheelScore = new csv.CommonCSV('conf/avluckywheelscore.dat', ['score']);
        global.gConfAvTavernRecruit = new csv.CommonCSV('conf/avtavernrecruit.dat', ['id']);
        global.gConfAvTavernRecruitFrequencyRaw = new csv.CommonCSV('conf/avtavernrecruitfrequency.dat', ['confId', 'timeId']);
        global.gConfAvTavernRecruitFrequency = new csv.CommonCSV('conf/avtavernrecruitfrequency.dat', ['timeId']);
        global.gConfAvExchangePointsId = new csv.CommonCSV('conf/avexchangepoints.dat', ['id']);
        global.gConfAvExchangePoints = new csv.CommonCSV('conf/avexchangepoints.dat', ['key']);
        global.gConfAvExchangePointsRound = new csv.CommonCSV('conf/avexchangepoints.dat', ['round', 'key', 'id']);
        global.gConfAvExchangePointsKey = new csv.CommonCSV('conf/avexchangepoints.dat', ['key', 'id']);
        global.gConfAvExchangePointsAward = new csv.CommonCSV('conf/avexchangepointsaward.dat', ['id']);
        global.gConfAvExchangePointsTime = new csv.CommonCSV('conf/avexchangepointstime.dat', ['id']);
        global.gConfAvRoulette = new csv.CommonCSV('conf/avroulette.dat', ['id']);
        global.gConfAvLevelGift = new csv.CommonCSV('conf/avlevelgift.dat', ['id']);
        global.gConfAvLuckyDragon = new csv.CommonCSV('conf/avluckydragon.dat', ['frequency']);
        global.gConfAvGrowFund = new csv.CommonCSV('conf/avgrowfund.dat', ['id']);
        global.gConfAvDropsDragon = new csv.CommonCSV('conf/avdropsdragon.dat', ['id']);
        global.gConfAvDropsDragonLotteryFrequency = new csv.CommonCSV('conf/avdropsdragonlotteryfrequency.dat', ['level']);
        global.gConfAvOneYuanBuy = new csv.CommonCSV('conf/avoneyuanbuy.dat', ['id']);
        global.gConfAvThreeYuanBuy = new csv.CommonCSV('conf/avthreeyuanbuy.dat', ['id']);
        global.gConfAvDayChallenge = new csv.CommonCSV('conf/avdaychallenge.dat', ['day']);
        global.gConfAvDayChallengeId = new csv.CommonCSV('conf/avdaychallenge.dat', ['day', 'id']);
        global.gConfAvDayVouchsafeRaw = new csv.CommonCSV('conf/avdayvouchsafe.dat', ['confId', 'day']);
        global.gConfAvpromoteexchange = new csv.CommonCSV('conf/avpromoteexchange.dat', ['id']);
        global.gConfAvstepawards = new csv.CommonCSV('conf/avstepawards.dat', ['step']);
        global.gConfAvstepinfo = new csv.CommonCSV('conf/avstepinfo.dat', ['pos']);
        global.gConfAvhuman_armsRaw = new csv.CommonCSV('conf/avhuman_arms.dat', ['confId', 'level']);
        global.gConfAvhuman_wingRaw = new csv.CommonCSV('conf/avhuman_wing.dat', ['confId', 'level']);
        global.gConfAvhuman_mountRaw = new csv.CommonCSV('conf/avhuman_mount.dat', ['confId', 'level']);
        global.gConfAvFirstPay = new csv.CommonCSV('conf/avfirstpay.dat', ['id']);
        // global.gConfAvFirstPayKey1Id = new csv.CommonCSV('conf/avfirstpay.dat', ['key1', 'id']);
        // global.gConfAvFirstPayKey2Id = new csv.CommonCSV('conf/avfirstpay.dat', ['key2', 'id']);
        global.gConfAvTavernNormalRaw = new csv.CommonCSV('conf/avrecruit_ordinary.dat', ['confId', 'id']);
        global.gConfAvTavernHighRaw = new csv.CommonCSV('conf/avrecruit_senior.dat', ['confId', 'id']);
        global.gConfAvLimitExchangeRaw = new csv.CommonCSV('conf/avlimit_exchange.dat', ['confId', 'id']);
        global.gConfAvPrayRaw = new csv.CommonCSV('conf/avalasd_pray.dat', ['confId', 'id']);
        global.gConfAvDayExchangeRaw = new csv.CommonCSV('conf/avday_exchange.dat', ['confId', 'id']);

        global.gConfAvmanuallyLevelRaw = new csv.CommonCSV('conf/avmanuallylevel.dat', ['confId', 'id']);       // 龙纹手册
        global.gConfAvmanuallyTaskRaw = new csv.CommonCSV('conf/avmanuallytask.dat', ['confId', 'id']);         // 龙纹手册
        global.gConfAvmanuallyAwardRaw = new csv.CommonCSV('conf/avmanuallyaward.dat', ['confId', 'id']);       // 龙纹手册

        global.gConfAvAssetsFeed = new csv.CommonCSV('conf/avassets_feed.dat', ['id']);                      // 资源补给站
        global.gConfAvAssetsFeedAward = new csv.CommonCSV('conf/avassets_feedaward.dat', ['startDay']);            // 资源补给站

        // 开服七天乐配置
        global.gConfOpenSeven = new csv.CommonCSV('conf/openseven.dat', ['day', 'id']);
        global.gConfOpenSevenReward = new csv.CommonCSV('conf/opensevenreward.dat', ['id']);
        global.gConfOpenSevenBox = new csv.CommonCSV('conf/opensevenbox.dat', ['id']);

        global.gConfOpenHoliday_data = new csv.CommonCSV('conf/openholiday.dat', ['confId', 'day', 'id']);
        global.gConfOpenHolidayReward = new csv.CommonCSV('conf/openholidayreward.dat', ['id']);
        global.gConfOpenHolidayBox_data = new csv.CommonCSV('conf/openholidaybox.dat', ['confId', 'id']);
        global.gConfavbuy_award = new csv.CommonCSV('conf/avbuy_award.dat', ['confId', 'week', 'id']);
        //一本万利奖励配置
        global.gConfAvinvestmentReward = new csv.CommonCSV('conf/avinvestment.dat', ['conf']);
        // // 20170823之后用老配置
        // var timeopenSevenOld =  csv.parseDate("2017:08:23:05:00:00");
        // if (getGameDate(timeopenSevenOld) > gConfGlobalServer.serverStartDate) {
        //     global.gConfOpenSevenReward = new csv.CommonCSV('conf/oldopensevenreward.dat', ['id']);
        //     global.gConfOpenSeven = new csv.CommonCSV('conf/oldopenseven.dat', ['day', 'id']);
        //     global.gConfOpenSevenBox = new csv.CommonCSV('conf/oldopensevenbox.dat', ['id']);
        // }

        // 礼包活动
        if ((config.ServerId - 0) <= 20 && config.platform == "korea") {
            global.gConfGiftBag = new csv.CommonCSV('conf/avgiftbag_old.dat', ['id']);
        }
        else {
            global.gConfGiftBag = new csv.CommonCSV('conf/avgiftbag.dat', ['id']);
        }

        // 无限关卡
        global.gConfItMain = new csv.CommonCSV('conf/itmain.dat', ['id', 'num']);
        global.gConfItMainIsBranch = new csv.CommonCSV('conf/itmain.dat', ['id', 'isBranch']);
        global.gConfItMainOpenCondition = new csv.CommonCSV('conf/itmain.dat', ['id', 'openCondition']);
        global.gConfItBoss = new csv.CommonCSV('conf/itboss.dat', ['level']);
        global.gConfItSectionBox = new csv.CommonCSV('conf/itsectionbox.dat', ['id', 'level']);
        global.gConfItMapelement = new csv.CommonCSV('conf/itmapelement.dat', ['id', 'index']);

        // 军团试炼
        global.gConfLegionTrialAchievement = new csv.CommonCSV('conf/trialachievement.dat', ['type', 'id']);
        global.gConfLegionTrialAdventure = new csv.CommonCSV('conf/trialadventure.dat', ['id']);
        global.gConfLegionTrialBaseConfig = new csv.CommonCSV('conf/trialbaseconfig.dat', ['level']);
        global.gConfLegionTrialCoinIncreaseType = new csv.CommonCSV('conf/trialcoinincreasetype.dat', ['id']);
        global.gConfLegionTrialGoods = new csv.CommonCSV('conf/trialgoods.dat', ['id', 'number']);

        // 城池升级
        global.gConfLegionCityBase = new csv.CommonCSV('conf/legioncitybase.dat', ['type']);
        global.gConfLegionCityConf = new csv.CommonCSV('conf/legioncityconf.dat', ['id', 'level']);
        global.gConfLegionCityMain = new csv.CommonCSV('conf/legioncitymain.dat', ['level']);
        global.gConfLegionCityFunction = new csv.CommonCSV('conf/legioncityfunction.dat', ['key']);
        //global.gConfTerritoryWarActionCost = new csv.CommonCSV('conf/dfactioncost.dat', ['times']);

        global.gConfLegionwarCardExplore = new csv.CommonCSV('conf/legionwarcardexplore.dat', ['type']);                         // 军团战巡逻

        global.gConfTerritoryBossCost = new csv.CommonCSV('conf/dfbosscost.dat', ['times']);
        global.gConfTerritoryBossLegionConf = new csv.CommonCSV('conf/dfbosslegionconf.dat', ['legionLevel']);
        global.gConfTerritoryBossSelfAward = new csv.CommonCSV('conf/dfbossselfaward.dat', ['id']);

        // 军团许愿
        global.gConfLegionWishConf = new csv.CommonCSV('conf/legionwishconf.dat', ['heroQuality']);
        global.gConfLegionWishAchievement = new csv.CommonCSV('conf/legionwishachievement.dat', ['id', 'level']);
        global.gConfLegionWishAchievementKey = new csv.CommonCSV('conf/legionwishachievement.dat', ['key']);

        //天下合谋
        global.gConfFateadvancedconf = new csv.CommonCSV('conf/fateadvancedconf.dat', ['fateType', 'fateLevel']);
        global.gConfFateadvancedtype = new csv.CommonCSV('conf/fateadvancedtype.dat', ['fateType']);

        // 化神进阶
        global.gConfPromote = new csv.CommonCSV('conf/promoteorange.dat', ['id']);
        global.gConfPromoteProgress = new csv.CommonCSV('conf/promoteorange.dat', ['progress']);
        global.gConfPromoteType = new csv.CommonCSV('conf/promoteorange.dat', ['type', 'progress']);
        global.gConfHeroChange = new csv.CommonCSV('conf/herochange.dat', ['id']);
        global.gConfHeroChangeKey = new csv.CommonCSV('conf/herochange.dat', ['key']);
        global.gConfHeroChangeQuality = new csv.CommonCSV('conf/herochange.dat', ['quality']);
        global.gConfPromoteRed = new csv.CommonCSV('conf/promotered.dat', ['type', 'progress']);
        global.gConfPromoteGold = new csv.CommonCSV('conf/promotegold.dat', ['type', 'progress']);
        global.gConfPromoteLucklyOrange = new csv.CommonCSV('conf/promotelucklyorange.dat', ['id']);
        global.gConfPromoteLucklyRed = new csv.CommonCSV('conf/promotelucklyred.dat', ['id']);
        global.gConfPromoteAwardOrange = new csv.CommonCSV('conf/promoteawardorange.dat', ['number']);
        global.gConfPromoteAwardRed = new csv.CommonCSV('conf/promoteawardred.dat', ['number']);
        global.gConfPromoteRankRed = new csv.CommonCSV('conf/promoterankred.dat', ['rank']);
        global.gConfPromoteOrangeItem = new csv.CommonCSV('conf/promoteorangeitem.dat', ['id']);
        global.gConfPromoteOrangeItemKey = new csv.CommonCSV('conf/promoteorangeitem.dat', ['key']);
        global.gConfPromoteRedItem = new csv.CommonCSV('conf/promotereditem.dat', ['id']);
        global.gConfPromoteRedItemKey = new csv.CommonCSV('conf/promotereditem.dat', ['key']);

        global.gConfLordSpecialDrop = new csv.CommonCSV('conf/lordspecialdrop.dat', ['cnt', 'id']);
        global.gConfHeadFrame = new csv.CommonCSV('conf/settingheadframe.dat', ['id']);

        // 封爵
        global.gConfNobiltyLevel = new csv.CommonCSV('conf/nobiltylevel.dat', ['level']);
        global.gConfNobiltyLevelKey = new csv.CommonCSV('conf/nobiltylevel.dat', ['key']);
        global.gConfNobiltyBase = new csv.CommonCSV('conf/nobiltybase.dat', ['id']);
        global.gConfNobiltyBaseKey = new csv.CommonCSV('conf/nobiltybase.dat', ['key']);
        global.gConfNobiltyTitle = new csv.CommonCSV('conf/nobiltytitle.dat', ['id']);
        global.gConfNobiltyTitleKey = new csv.CommonCSV('conf/nobiltytitle.dat', ['key']);
        global.gConfNobiltyTitleKeyAndId = new csv.CommonCSV('conf/nobiltytitle.dat', ['key', 'id']);
        // 人皇套装
        global.gConfSkyWeap = new csv.CommonCSV('conf/skyweap.dat', ['level']);
        global.gConfSkyWing = new csv.CommonCSV('conf/skywing.dat', ['level']);
        global.gConfSkyMount = new csv.CommonCSV('conf/skymount.dat', ['level']);
        global.gConfSkySkill = new csv.CommonCSV('conf/skyskill.dat', ['type', 'id']);
        global.gConfSkySkillUp = new csv.CommonCSV('conf/skyskillup.dat', ['id', 'level']);
        global.gConfSkyBloodAwaken = new csv.CommonCSV('conf/skybloodawaken.dat', ['type', 'level']);
        global.gConfSkyGasAwaken = new csv.CommonCSV('conf/skygasawaken.dat', ['type', 'level']);
        global.gConfSkyChange = new csv.CommonCSV('conf/skychange.dat', ['type', 'id']);
        global.gConfSkyChangeId = new csv.CommonCSV('conf/skychange.dat', ['type', 'value']);
        global.gConfSkyCollect = new csv.CommonCSV('conf/skycollect.dat', ['type', 'collect']);


        // 挂机配置(黑森林探索)
        global.gConfExploreBase = new csv.CommonCSV('conf/explorebase.dat', ['key']);
        global.gConfExploreMonster = new csv.CommonCSV('conf/exploremonster.dat', ['level']);
        global.gConfItemGroupBase = new csv.CommonCSV('conf/itemgroupbase.dat', ['id']);
        global.gConfItemGroupConfig = new csv.CommonCSV('conf/itemgroupconfig.dat', ['groupId', 'id']);

        // 大本营-boss(黑森林探索)
        global.gConfExploreBoss = new csv.CommonCSV('conf/exploreboss.dat', ['type']);
        global.gConfExplorePath = new csv.CommonCSV('conf/explorepath.dat', ['pathId']);

        // 搜寻任务 (黑森林探索)
        global.gConfExploreTaskBasic = new csv.CommonCSV('conf/exploretaskbasic.dat', ['type']);
        global.gConfExploreTaskDetail = new csv.CommonCSV('conf/exploretaskdetail.dat', ['type', 'level']);

        // 山洞
        global.gConfCustomCaveEvent = new csv.CommonCSV('conf/customcaveevent.dat', ['key']);
        global.gConfCustomCaveDiceWeight = new csv.CommonCSV('conf/customcavediceweight.dat', ['point']);
        global.gConfCustomCaveAward = new csv.CommonCSV('conf/customcaveaward.dat', ['level']);

        // 魔法阵
        global.gConfExploreMagic = new csv.CommonCSV('conf/exploremagic.dat', ['id']);
        global.gConfexploreMagiConvert = new csv.CommonCSV('conf/exploremagicconvert.dat', ['id']);

        // 部位
        global.gConfPartAwake = new csv.CommonCSV('conf/partawake.dat', ['type', 'level']);
        global.gConfPartBase = new csv.CommonCSV('conf/partbase.dat', ['Id']);
        global.gConfPartEmbed = new csv.CommonCSV('conf/partembed.dat', ['level']);
        //global.gConfMasterAwake     = new csv.CommonCSV('conf/partmasterawake.dat', ['level']);
        global.gConfMasterEmbed = new csv.CommonCSV('conf/partmasterembed.dat', ['level']);
        global.gConfPartTitleActive = new csv.CommonCSV('conf/parttitleactivate.dat', ['type', 'titileLevel']);

        // 符文配置
        global.gConfRuneConf = new csv.CommonCSV('conf/runeconf.dat', ['id']);
        global.gConfRuneBoxConf = new csv.CommonCSV('conf/runebox.dat', ['id']);
        global.gConfRuneSlotConf = new csv.CommonCSV('conf/runetrench.dat', ['type', 'id']);
        global.gConfRuneUpgradeConf = new csv.CommonCSV('conf/runeupgrade.dat', ['level']);
        global.gConfRuneHandleBookConf = new csv.CommonCSV('conf/runehandbook.dat', ['type']);
        global.gConfRuneBaseAttConf = new csv.CommonCSV('conf/runebaseatt.dat', ['level']);
        global.gConfRuneSpecialAttConf = new csv.CommonCSV('conf/runespecialatt.dat', ['id', 'num']);
        global.gConfRuneBoxAwardConf = new csv.CommonCSV('conf/runeboxaward.dat', ['id', 'num']);

        global.gConfBarrenLand = new csv.CommonCSV('conf/territorywarbarrenland.dat', ['id']);
        global.gConfLegionBossAakb = new csv.CommonCSV('conf/legionbossaakb.dat', ['type']);

        global.gConfTerritoryWarTransfer = new csv.CommonCSV('conf/dftransmit.dat', ['id']);

        // 村庄争夺战
        global.gConfPersonalLand = new csv.CommonCSV('conf/territorywarpersonal.dat', ['id', 'landId']);

        // 在线奖励
        global.gConfOutlineBeadChange = new csv.CommonCSV('conf/outlinebeadchange.dat', ['id']);
        global.gConfOutlineCondition = new csv.CommonCSV('conf/outlinecondition.dat', ['id']);
        global.gConfOutlineDayBoss = new csv.CommonCSV('conf/outlinedayboss.dat', ['id']);
        global.gConfOutlineTheme = new csv.CommonCSV('conf/outlinetheme.dat', ['id']);

        global.gConfExploreMagicAwardUp = new csv.CommonCSV('conf/exploremagicawardup.dat', ['id', 'level']);

        // 幸运轮盘
        global.gConfAvLuckyRotateBase = new csv.CommonCSV('conf/avlucky_rotate_base.dat', ['id']);
        global.gConfAvLuckyRotateItem = new csv.CommonCSV('conf/avlucky_rotate_item.dat', ['groupId', 'num']);

        // 命运之轮
        global.gConfAvDestinyRotateCostRaw = new csv.CommonCSV('conf/avdestinyrotate_cost.dat', ['confId', 'id']);
        global.gConfAvDestinyRotateNormalRaw = new csv.CommonCSV('conf/avdestinyrotate_normal.dat', ['confId', 'id', 'sort']);
        global.gConfAvDestinyRotateHighRaw = new csv.CommonCSV('conf/avdestinyrotate_high.dat', ['confId', 'id', 'sort']);

        // 月度返利
        global.gConfAvMonthRebate = new csv.CommonCSV('conf/avmonthrebate.dat', ['id']);
    }

    if (!serverName || serverName == 'world') {
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);

        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);

        global.gConfGoldMine = new csv.CommonCSV('conf/goldmine.dat', ['id']);
        global.gConfLegionLog = new csv.CommonCSV('conf/legionlog.dat', ['event']);
        global.gConfArenaDaily = new csv.CommonCSV('conf/arenadaily.dat', ['rank']);
        global.gConfWorldWarGlory = new csv.CommonCSV('conf/worldwarglory.dat', ['rank']);
        global.gConfWorldWarReward = new csv.CommonCSV('conf/worldwarreward.dat', ['rank']);
        global.gConfLegionCopy = new csv.CommonCSV('conf/legioncopy.dat', ['id']);
        global.gConfAvWeekGift = new csv.CommonCSV('conf/avweekgift.dat', ['id']);
        global.gConfHookRepos = new csv.CommonCSV('conf/hookrepos.dat', ['id']);
        global.gConfArenaLevel = new csv.CommonCSV('conf/arenalevel.dat', ['level']);
        global.gConfAvLuckyWheelRank = new csv.CommonCSV('conf/avluckywheelrank.dat', ['rank']);
        global.gConfCountryJade = new csv.CommonCSV('conf/countryjade.dat', ['id']);
        global.gConfCountryJadeRewardFix = new csv.CommonCSV('conf/countryjaderewardfix.dat', ['level']);
        global.gConfCountryJadeRewardDrop = new csv.CommonCSV('conf/countryjaderewarddrop.dat', ['color']);

        global.gConfLegionWarSchedule = new csv.CommonCSV('conf/legionwarschedule.dat', ['type', 'id']);
        global.gConfLegionWarCityBuf = new csv.CommonCSV('conf/legionwarcitybuf.dat', ['bufType']);
        //global.gConfLegionWarCityCard = new csv.CommonCSV('conf/legionwarcard.dat', ['id']);
        global.gConfLegionWarRank = new csv.CommonCSV('conf/legionwarrank.dat', ['id']);
        global.gConfLegionWarAttackAward = new csv.CommonCSV('conf/legionwarattackaward.dat', ['attackCount']);
        global.gConfTavernLuck = new csv.CommonCSV('conf/tavernluck.dat', ['level']);
        global.gConfLordCountrySalary = new csv.CommonCSV('conf/lordcountrysalary.dat', ['rank']);

        global.gConfLegionCityBase = new csv.CommonCSV('conf/legioncitybase.dat', ['type']);
        global.gConfLegionCityConf = new csv.CommonCSV('conf/legioncityconf.dat', ['id', 'level']);
        global.gConfModuleOpen = new csv.CommonCSV('conf/moduleopen.dat', ['module']);
        global.gConfModuleOpen_new = new csv.CommonCSV('conf/moduleopen_new.dat', ['module']);
        global.gConfChatNotice = new csv.CommonCSV('conf/chatnotice.dat', ['key']);
        global.gConfLocalText = new csv.CommonCSV('conf/language/' + config.language + '/localtext.dat', ['Id']);

        global.gConfLegionCityMain = new csv.CommonCSV('conf/legioncitymain.dat', ['level']);
        global.gConfTerritoryBossLegionConf = new csv.CommonCSV('conf/dfbosslegionconf.dat', ['legionLevel']);
        global.gConfTerritoryBossSelfAward = new csv.CommonCSV('conf/dfbossselfaward.dat', ['id']);

        global.gConfLegionWishConf = new csv.CommonCSV('conf/legionwishconf.dat', ['heroQuality']);
        global.gConfLegionWishAchievementKey = new csv.CommonCSV('conf/legionwishachievement.dat', ['key']);
        global.gConfPromoteRankRed = new csv.CommonCSV('conf/promoterankred.dat', ['rank']);

        global.gConfGrowFundBought = new csv.CommonCSV('conf/avgrowfundbought.dat', ['day']);

        // 国战配置
        global.gConfCountryWarCountryRank = new csv.CommonCSV('conf/countrywarcamp.dat', ['id', 'num']);
        global.gConfCountryWarPersonalRank = new csv.CommonCSV('conf/countrywarpersonal.dat', ['id']);

        // 开服七天乐配置
        global.gConfOpenSeven = new csv.CommonCSV('conf/openseven.dat', ['day', 'id']);
        global.gConfOpenSevenReward = new csv.CommonCSV('conf/opensevenreward.dat', ['id']);
        global.gConfOpenSevenBox = new csv.CommonCSV('conf/opensevenbox.dat', ['id']);

        global.gConfOpenHoliday_data = new csv.CommonCSV('conf/openholiday.dat', ['confId', 'day', 'id']);
        global.gConfOpenHolidayReward = new csv.CommonCSV('conf/openholidayreward.dat', ['id']);
        global.gConfOpenHolidayBox_data = new csv.CommonCSV('conf/openholidaybox.dat', ['confId', 'id']);
        // // 20170823之后用老配置
        // var timeopenSevenOld =  csv.parseDate("2017:08:23:05:00:00");
        // if (getGameDate(timeopenSevenOld) > gConfGlobalServer.serverStartDate) {
        //     global.gConfOpenSevenReward = new csv.CommonCSV('conf/oldopensevenreward.dat', ['id']);
        //     global.gConfOpenSeven = new csv.CommonCSV('conf/oldopenseven.dat', ['day', 'id']);
        //     global.gConfOpenSevenBox = new csv.CommonCSV('conf/oldopensevenbox.dat', ['id']);
        // }

        // global.gConfAvRank = new csv.CommonCSV('conf/avrank.dat', ['name', 'rank']);

        global.gConfAvRankFightForce = new csv.CommonCSV('conf/avrankfightforce.dat', ['sort']);
        global.gConfAvRankFightForce10 = new csv.CommonCSV('conf/avrankfightforce_10.dat', ['sort']);
        global.gConfAvRankFightForce15 = new csv.CommonCSV('conf/avrankfightforce_15.dat', ['sort']);
        global.gConfAvRankLevel = new csv.CommonCSV('conf/avranklevel.dat', ['sort']);

        global.gConfAvRankRechargeRaw = new csv.CommonCSV('conf/avrank_recharge.dat', ['confId', 'id']);     // 充值排行
        global.gConfAvRankExpenseRaw = new csv.CommonCSV('conf/avrank_expense.dat', ['confId', 'id']);       // 消费排行

        // 挂机配置(黑森林探索)
        global.gConfExploreBase = new csv.CommonCSV('conf/explorebase.dat', ['key']);
        global.gConfExploreMonster = new csv.CommonCSV('conf/exploremonster.dat', ['level']);
        global.gConfItemGroupBase = new csv.CommonCSV('conf/itemgroupbase.dat', ['id']);
        global.gConfItemGroupConfig = new csv.CommonCSV('conf/itemgroupconfig.dat', ['groupId', 'id']);

        // 大本营-boss(黑森林探索)
        global.gConfExploreBoss = new csv.CommonCSV('conf/exploreboss.dat', ['type']);
        global.gConfExplorePath = new csv.CommonCSV('conf/explorepath.dat', ['pathId']);

        // 竞技场相关配置
        global.gConfArenaBase = new csv.CommonCSV('conf/arenabase.dat', ['type']);
        global.gConfArenaRank = new csv.CommonCSV('conf/arenarank.dat', ['type', 'level']);
        global.gConfArenaAchievement = new csv.CommonCSV('conf/arenaachievement.dat', ['type', 'level']);
        global.gConfArenaRefresh = new csv.CommonCSV('conf/arenarefresh.dat', ['id']);

        //global.gConfCustomKing          = new csv.CommonCSV('conf/customking.dat',  ['chapter', 'id']);


        // 村庄争夺
        global.gConfBarrenLand = new csv.CommonCSV('conf/territorywarbarrenland.dat', ['id']);
        global.gConfPersonalLand = new csv.CommonCSV('conf/territorywarpersonal.dat', ['id', 'landId']);
        global.gConfTeamLand = new csv.CommonCSV('conf/territorywarteam.dat', ['id']);

        // 军团boss
        global.gConfLegionBoss = new csv.CommonCSV('conf/legionbossconf.dat', ['level']);
        global.gConfLegionBossRank = new csv.CommonCSV('conf/legionbossrank.dat', ['level']);
        global.gConfLegionBossAakb = new csv.CommonCSV('conf/legionbossaakb.dat', ['type']);

        global.gConfAvTodayDoubleRaw = new csv.CommonCSV('conf/avtodaydouble.dat', ['confId', 'day']);
        global.gConfavbuy_award = new csv.CommonCSV('conf/avbuy_award.dat', ['confId', 'week', 'id']);
    }

    if (!serverName || serverName == 'worldwar') {
        global.gConfWorldWarSchedule = new csv.CommonCSV('conf/worldwarschedule.dat', ['progress']);
        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);
        global.gConfExploitWall = new csv.CommonCSV('conf/exploitwall.dat', ['key', 'rank']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);
        global.gConfWorldWarScore = new csv.CommonCSV('conf/worldwarscore.dat', ['id']);
        global.gConfWorldWarGlory = new csv.CommonCSV('conf/worldwarglory.dat', ['id']);
    }

    if (!serverName || serverName == 'legionwar') {
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);
        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);
        //global.gConfCustomKing = new csv.CommonCSV('conf/customking.dat',  ['chapter', 'id']);

        global.gConfLegionWarSchedule = new csv.CommonCSV('conf/legionwarschedule.dat', ['type', 'id']);
        global.gConfLegionWarCity = new csv.CommonCSV('conf/legionwarcity.dat', ['id']);
        global.gConfLegionWarCityBuf = new csv.CommonCSV('conf/legionwarcitybuf.dat', ['bufType']);
        global.gConfLegionWarRank = new csv.CommonCSV('conf/legionwarrank.dat', ['id']);

        global.gConfLegionwarCardExplore = new csv.CommonCSV('conf/legionwarcardexplore.dat', ['type']);                     // 军团战巡逻
    }

    // 领地战配置
    global.gConfTerritoryWarBase = new csv.CommonCSV('conf/dfbasepara.dat', ['key']);
    global.gConfTerritoryWarPuppet = new csv.CommonCSV('conf/dfpuppetconf.dat', ['level']);
    global.gConfTerritoryWarPuppetRobot = new csv.CommonCSV('conf/dfpuppetrobot.dat', ['id']);
    global.gConfTerritoryWarBoxDrop = new csv.CommonCSV('conf/dfboxloot.dat', ['level']);
    global.gConfTerritoryWarMapMine = new csv.CommonCSV('conf/dfmapmine.dat', ['id']);

    if (!serverName || serverName == 'territorywar') {
        global.gConfTerritoryWarAchievement = new csv.CommonCSV('conf/dfachievement.dat', ['type', 'goalId']);
        global.gConfTerritoryWarAchievementAwards = new csv.CommonCSV('conf/dfachievementaward.dat', ['id']);
        global.gConfTerritoryWarAchievementType = new csv.CommonCSV('conf/dfachievementtype.dat', ['id']);
        global.gConfTerritoryWarRelic = new csv.CommonCSV('conf/dfrelic.dat', ['id']);
        global.gConfTerritoryWarTransfer = new csv.CommonCSV('conf/dftransmit.dat', ['id']);
        global.gConfTerritoryWarMapElement = new csv.CommonCSV('conf/dfelement.dat', ['id']);
        global.gConfTerritoryWarMapMonster = new csv.CommonCSV('conf/dfmapcreature.dat', ['id']);
        global.gConfTerritoryWarMapGrid = new csv.CommonCSV('conf/dfmapgrid.dat', ['id']);
        global.gConfLegionWarRank = new csv.CommonCSV('conf/legionwarrank.dat', ['id']);
        global.gConfLegionName = new csv.CommonCSV('conf/language/' + config.language + '/dfrobotlegionname.dat', ['id']);

        // 城池升级
        global.gConfLegionCityBase = new csv.CommonCSV('conf/legioncitybase.dat', ['type']);
        global.gConfLegionCityConf = new csv.CommonCSV('conf/legioncityconf.dat', ['id', 'level']);
        global.gConfLegionCityMain = new csv.CommonCSV('conf/legioncitymain.dat', ['level']);
        global.gConfLegionCityFunction = new csv.CommonCSV('conf/legioncityfunction.dat', ['key']);

        global.gConfTerritoryBossCost = new csv.CommonCSV('conf/dfbosscost.dat', ['times']);
        global.gConfTerritoryBossForce = new csv.CommonCSV('conf/dfbossforce.dat', ['level']);
        global.gConfTerritoryBossLegionConf = new csv.CommonCSV('conf/dfbosslegionconf.dat', ['legionLevel']);
        global.gConfTerritoryBossSelfAward = new csv.CommonCSV('conf/dfbossselfaward.dat', ['id']);
    }

    // 服战相关配置
    global.gConfCountryWarBase = new csv.CommonCSV('conf/countrywarbase.dat', ['key']);
    if (!serverName || serverName == 'countrywar') {
        global.gConfCountryWarCity = new csv.CommonCSV('conf/countrywarcity.dat', ['id']);
        global.gConfSoldierLevel = new csv.CommonCSV('conf/soldierlevel.dat', ['id', 'level', 'star']);
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);
        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfCountryWarTask = new csv.CommonCSV('conf/countrywartask.dat', ['type', 'id']);
        global.gConfCountryWarTaskPersonal = new csv.CommonCSV('conf/countrywartaskpersonal.dat', ['id']);
        global.gConfCountryWarGuard = new csv.CommonCSV('conf/countrywarguard.dat', ['level']);
        global.gConfCountryRoom = new csv.CommonCSV('conf/countrywargrouppartition.dat', ['groupId']);
        global.gConfCountryWarKillScore = new csv.CommonCSV('conf/countrywarkillglory.dat', ['cnt']);
    }

    // 跨服竞技场
    if (!serverName || serverName == 'arena') {
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);
        global.gConfRobot = new csv.CommonCSV('conf/robot.dat', ['id']);
        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);

        global.gConfChatNotice = new csv.CommonCSV('conf/chatnotice.dat', ['key']);

        //global.gConfCustomKing = new csv.CommonCSV('conf/customking.dat',  ['chapter', 'id']);

        // 竞技场相关配置
        global.gConfArenaBase = new csv.CommonCSV('conf/arenabase.dat', ['type']);
        global.gConfArenaRank = new csv.CommonCSV('conf/arenarank.dat', ['type', 'level']);
        global.gConfArenaAchievement = new csv.CommonCSV('conf/arenaachievement.dat', ['type', 'level']);
        global.gConfArenaRefresh = new csv.CommonCSV('conf/arenarefresh.dat', ['id']);

        // 幸运轮盘
        global.gConfAvLuckyRotateBase = new csv.CommonCSV('conf/avlucky_rotate_base.dat', ['id']);
        global.gConfAvLuckyRotateItem = new csv.CommonCSV('conf/avlucky_rotate_item.dat', ['groupId', 'num']);
    }

    // 跨服村庄争夺
    if (!serverName || serverName == 'landgrabber') {
        global.gConfBarrenLand = new csv.CommonCSV('conf/territorywarbarrenland.dat', ['id']);
        global.gConfPersonalLand = new csv.CommonCSV('conf/territorywarpersonal.dat', ['id', 'landId']);
        global.gConfTeamLand = new csv.CommonCSV('conf/territorywarteam.dat', ['id']);

        global.gConfAvTodayDoubleRaw = new csv.CommonCSV('conf/avtodaydouble.dat', ['confId', 'day']);
    }

    if (!serverName || serverName == 'global') {
        global.gConfName = new csv.CommonCSV('conf/language/' + config.language + '/name.dat', ['id']);
        global.gConfHero = new csv.CommonCSV('conf/hero.dat', ['id']);

        global.gConfRobotType = new csv.CommonCSV('conf/robotconf.dat', ['id']);
        global.gConfRobotAtt = new csv.CommonCSV('conf/robotatt.dat', ['level']);
        global.gConfDestiny = new csv.CommonCSV('conf/destiny.dat', ['level']);

        global.gConfOctopus = new csv.CommonCSV('conf/avoctopusbase.dat', ['id']);          // 章鱼宝藏
        global.gConfOctopusAwardRaw = new csv.CommonCSV('conf/avoctopusaward.dat', ['confId', 'id']);          // 章鱼宝藏
    }

    onConfLoaded(serverName, is_init_db);
}

function onConfLoaded(serverName, is_init_db) {
    require('./global.js');

    // 机器人备选武将id
    global.gRobotHeroIds = [];

    // 玩家最大等级
    global.gMaxUserLevel = 0;

    // 玩家最大VIP等级
    global.gMaxVip = 0;

    if (!serverName || serverName == 'game') {
        // 遍历道具表，筛选出精炼道具
        global.gEquipRefineItems = [];
        global.gEquipRefineItemsLowToHigh = []; // 从小到大排列
        var index = 0;
        for (var id in gConfItem) {
            var itemConf = gConfItem[id];
            if (itemConf.useType == 'partexp') {
                gEquipRefineItems[index] = {};
                gEquipRefineItems[index].id = parseInt(id);
                gEquipRefineItems[index].exp = itemConf.useEffect;
                index++;
            }
        }

        // 按经验值从大到小排列
        gEquipRefineItems.sort(function (a, b) { return b.exp - a.exp });
        global.gEquipRefineItemsLowToHigh = clone(gEquipRefineItems);
        global.gEquipRefineItemsLowToHigh.sort(function (a, b) { return a.exp - b.exp });

        // 建立一个英雄id与缘分id的对应表
        global.gHeroFateMap = {};
        for (var id in gConfFate) {
            for (var i = 1; i <= 5; i++) {
                var hid = gConfFate[id]['hid' + i];
                if (hid != 0) {
                    if (!gHeroFateMap[hid]) {
                        gHeroFateMap[hid] = [];
                    }

                    gHeroFateMap[hid].push(parseInt(id));
                }
            }
        }

        // 普通招募权重表
        global.gNormalTavernWeight = {};    // 普通招募权重表

        // 高级招募权重表
        global.gHighTavernWeight = {};      // 高级招募权重表
        global.gAdvancedTavernWeight = {};  // 高级招募最低紫和最低橙卡牌的权重表
        gAdvancedTavernWeight[Quality.PURPLE] = {};
        gAdvancedTavernWeight[Quality.ORANGE] = {};

        // buy表times最大值
        global.gMaxBuyTimes = Object.keys(gConfBuy).max();

        // 千重楼最大层数
        global.gMaxFloorInTower = 0;

        // 引导任务索引
        global.gGuideTaskMap = {};

        // 商店组最大等级限制
        global.gShopGroupLimit = {
            // gid: [minLevel, maxLevel]    // 组id: [最低等级, 最高等级]
        };

        // 商店组权重表
        global.gShopGroupWeight = {
            /*
            type: {                         // 商店类型
                must: [],                   // 必出的组id
                others: {},                 // 其他组权重
            },
            */
        };

        // 商店行权重表
        global.gShopItemWeight = {
            /*
            type: {                         // 商店类型
                gid: {                      // 组id
                    id: 0,                  // 项id: 权重
                },
            },
            */
        };

        // 商店列权重表
        global.gShopGoodWeight = {
            /*
            id: {                           // 项id
                cid: 0,                     // 货币列id: 货币权重
            },
            */
        };

        // 封将转盘权重表
        global.gPromoteOrangeWeight = {};
        global.gPromoteRedWeight = {};

        // 神器套装加成最大累计星星数
        global.gMaxGodSuit = 0;

        // 装备套装加成最大累计等级
        global.gMaxEquipSuit = 0;

        // 宝石套装加成最大累计等级
        global.gMaxGemSuit = 0;

        // 山贼权重表
        global.gThiefWeight = {};

        // 挂机宝箱权重
        global.gHookTreasureWeights = {};

        /*for (var id in gConfTavern) {
            if (id >= 10000) {
                continue;
            }
            gNormalTavernWeight[id] = gConfTavern[id].nWeight;
            gHighTavernWeight[id] = gConfTavern[id].hWeight;

            var heroCombatConf = getHeroCombatConf(id);
            if (heroCombatConf.quality >= Quality.PURPLE) {
                gAdvancedTavernWeight[Quality.PURPLE][id] = gConfTavern[id].hWeight;
            }
            if (heroCombatConf.quality >= Quality.ORANGE) {
                gAdvancedTavernWeight[Quality.ORANGE][id] = gConfTavern[id].hWeight;
            }
        }*/

        for (var type in ShopType) {
            gShopGroupWeight[ShopType[type]] = {
                'must': [],        // 必出的组id
                'others': {},      // 其他组权重
            };
            gShopItemWeight[ShopType[type]] = {};
        }
        for (var id in gConfShop) {
            var confShop = gConfShop[id];
            var type = confShop.type;
            var groupId = confShop.groupId;
            if (!gShopItemWeight[type][groupId]) {
                var groupWeight = confShop.groupWeight;
                if (groupWeight == 0) {
                    gShopGroupWeight[type].must.push(groupId);
                } else if (groupWeight == -1) {
                    // 必不出
                } else {
                    gShopGroupWeight[type].others[groupId] = groupWeight;
                }
                gShopItemWeight[type][groupId] = {};
            }
            var minLevel = confShop.minLevel;
            var maxLevel = confShop.maxLevel;
            if (!gShopGroupLimit[groupId]) {
                gShopGroupLimit[groupId] = [minLevel, maxLevel];
            } else if (gShopGroupLimit[groupId][0] > minLevel) {
                gShopGroupLimit[groupId][0] = minLevel;
            } else if (gShopGroupLimit[groupId][0] < maxLevel) {
                gShopGroupLimit[groupId][1] = maxLevel;
            }
            gShopItemWeight[type][groupId][id] = confShop.weight;
            gShopGoodWeight[id] = {};
            for (var i = 1; i <= 11; i++) {
                if (!gConfShop[id].hasOwnProperty('weight' + i)) {
                    break;
                }
                gShopGoodWeight[id][i] = gConfShop[id]['weight' + i];
            }
        }

        for (var id in gConfPromoteLucklyOrange) {
            gPromoteOrangeWeight[id] = gConfPromoteLucklyOrange[id].weight;
        }
        for (var id in gConfPromoteLucklyRed) {
            gPromoteRedWeight[id] = gConfPromoteLucklyRed[id].weight;
        }

        // 巡逻装备奖励
        var unlocks = {      // 关卡累计解锁装备
            '1': [0, 0],    // 头盔: 等级, 品质
            '2': [0, 0],    // 武器: 等级, 品质
            '3': [0, 0],    // 腰带: 等级, 品质
            '4': [0, 0],    // 盔甲: 等级, 品质
            '5': [0, 0],    // 鞋子: 等级, 品质
            '6': [0, 0],    // 项链: 等级, 品质
        };
        var cids = Object.keys(gConfCity).sort(function (c1, c2) { if (+c1 > +c2) { return 1; } return -1; });
        for (var i = 0, len = cids.length; i < len; i++) {
            var city = gConfCity[cids[i]];
            city.patrolEquipIds = [];

            var type1 = city.patrolEquipType1;
            var type2 = city.patrolEquipType2;
            var level = city.patrolEquipLevel;

            if (type1 && unlocks[type1][0] <= level) {
                unlocks[type1] = [level, city.patrolEquipQuality];
            }

            if (type2 && unlocks[type2][0] <= level) {
                unlocks[type2] = [level, city.patrolEquipQuality];
            }

            /* 巡逻掉落
            for (var eid in gConfEquip) {
                if (gConfEquip[eid].isAncient) continue;

                var equip = gConfEquip[eid];
                var unlock = unlocks[equip.type];
                if (equip.level == unlock[0] && equip.quality <= unlock[1]) {
                    city.patrolEquipIds.push([eid, gConfGlobal['patrolQualityWeight' + equip.quality]]);
                }
            }*/
        }

        gMaxFloorInTower = Object.keys(gConfTower).max();

        /*
        for (var id in gConfGodSuit) {
            var attributes = gConfGodSuit[id].attribute;
            for(var i = 0; i < attributes.length; i++) {
                var segs = attributes[i].split(':');
                gConfGodSuit[id]['att'+(i+1)] = +segs[0];
                gConfGodSuit[id]['value'+(i+1)] = +segs[1];
            }
        }*/

        global.gEquipSuitId = {};
        for (var id in gConfEquipSuit) {
            for (i = 1; i <= 6; i++) {
                gEquipSuitId[gConfEquipSuit[id]['equip' + i]] = +id;
            }
        }

        for (var id in gConfEquipSuit) {
            for (var j = 1; j <= 6; j++) {
                var attributes = gConfEquipSuit[id]['attribute' + j];
                if (!attributes) {
                    continue;
                }

                gConfEquipSuit[id][j] = {};
                for (var i = 0; i < attributes.length; i++) {
                    var segs = attributes[i].split(':');
                    gConfEquipSuit[id][j]['att' + (i + 1)] = +segs[0];
                    gConfEquipSuit[id][j]['value' + (i + 1)] = +segs[1];
                }
            }
        }

        for (var id in gConfGemSuit) {
            var attributes = gConfGemSuit[id].attribute;
            for (var i = 0; i < attributes.length; i++) {
                var segs = attributes[i].split(':');
                gConfGemSuit[id]['att' + (i + 1)] = +segs[0];
                gConfGemSuit[id]['value' + (i + 1)] = +segs[1];
            }
        }

        for (var id in gConfThief) {
            gThiefWeight[id] = gConfThief[id].weight;
        }

        for (var id in gConfDailyTask) {
            var dailyTask = gConfDailyTask[id];
            gConfDailyTask[dailyTask.event] = id;
        }

        for (var id in gConfTask) {
            var task = gConfTask[id][1];
            gConfTask[task.event] = id;
            if (id == 1) {
                gConfTask['elite'] = id;
                gConfTask['hard'] = id;
                gConfTask['nightmare'] = id;
                gConfTask['hell'] = id;
            }
        }

        for (var id in gConfGuideTask) {
            var task = gConfGuideTask[id];
            if (!gGuideTaskMap[task.event]) {
                gGuideTaskMap[task.event] = [];
            }
            gGuideTaskMap[task.event].push(id);
        }

        for (var id in gConfJadeSeal) {
            var unlock = gConfJadeSeal[id].unlock;
            if (isNaN(unlock)) {
                var segs = unlock.split('.');
                if (!segs) {
                    continue;
                }
                gConfJadeSeal[segs[0]] = [+id, +segs[1] / 100];
            }
        }

        for (var id in gConfRecharge) {
            var recharge = gConfRecharge[id];
            gConfRecharge[recharge.type] = id;
        }

        for (var id in gConfHookTreasure) {
            var item = gConfHookTreasure[id].item;
            if (!gHookTreasureWeights[item]) {
                gHookTreasureWeights[item] = {};
            }
            gHookTreasureWeights[item][id] = gConfHookTreasure[id].weight;
        }

        gConfAvRoulette.max = Object.keys(gConfAvRoulette).max();
        gConfShipper.max = Object.keys(gConfShipper).max();
        gConfTowerCoinReward.max = Object.keys(gConfTower).max();
        gConfEquipSuit.max = Object.keys(gConfEquipSuit).max();
        gConfGemSuit.max = Object.keys(gConfGemSuit).max();
        gConfAvDropsDragonLotteryFrequency.max = Object.keys(gConfAvDropsDragonLotteryFrequency).max();
        gConfAvDropsDragon.max = Object.keys(gConfAvDropsDragon).max();
        gConfItMain.max = Object.keys(gConfItMain).max();
        gConfHeroChange.max = Object.keys(gConfHeroChange).max();
        gConfNobiltyLevel.max = Object.keys(gConfNobiltyLevel).max();
        gConfAvFirstPay.max = Object.keys(gConfAvFirstPay).max();

        global.gDragonGemLevel = {};
        for (var id in gConfDragonGem) {
            var conf = gConfDragonGem[id];
            if (gDragonGemLevel[conf.level]) {
                gDragonGemLevel[conf.level].push(+id);
            } else {
                gDragonGemLevel[conf.level] = [+id];
            }
        }

        for (var id in gConfDiggingProduct) {
            var key = gConfDiggingProduct[id].key;
            gConfDiggingProduct[key] = +id;
        }

        // 英雄升级物品id
        global.gHeroXpItemIds = [];
        for (var id in gConfItem) {
            var item = gConfItem[id];
            if (item['useType'] == 'xp') {
                gHeroXpItemIds.push(+id);
            }
        }
        gHeroXpItemIds.sort(function (a, b) {
            return gConfItem[a].useEffect - gConfItem[b].useEffect;
        });

        scheduleActivity();

        global.gOpenLevelActivities = {};
        for (var name in gConfActivities) {
            if (gConfActivities[name].type == 2) { // 等级开启活动
                var openLevel = gConfActivities[name].openLevel;
                if (gOpenLevelActivities[openLevel]) {
                    gOpenLevelActivities[openLevel].push(name);
                } else {
                    gOpenLevelActivities[openLevel] = [name];
                }
            }
        }

        // 步步惊喜活动每步概率
        global.gAvStepWeights = {};
        for (var pos in gConfAvstepinfo) {
            var weights = {};
            for (var i = 0; i < gConfAvstepinfo[pos]['steppos'].length; i++) {
                var nextpos = +gConfAvstepinfo[pos]['steppos'][i];
                weights[nextpos] = gConfAvstepinfo[pos]['steppro'][i] | 0;
            }
            gAvStepWeights[pos] = weights;
        }
    }

    if (!is_init_db && serverName && (serverName == 'landgrabber' || serverName == 'world')) {
        // 村庄争夺服务器
        scheduleActivity();
    }

    // 竞技场机器人武将随机池
    for (var id in gConfHero) {
        var heroCombatConf = getHeroCombatConf(id);
        if (heroCombatConf && heroCombatConf.quality >= Quality.PURPLE && heroCombatConf.camp != 5 && heroCombatConf.camp != 99) {
            gRobotHeroIds.push(id);
        }
    }

    for (var level in gConfLevel) {
        if (+level > gMaxUserLevel) {
            gMaxUserLevel = +level;
        }
    }

    for (var level in gConfVip) {
        if (+level > gMaxVip) {
            gMaxVip = +level;
        }
    }

    for (var id in gConfDrop) {
        var dropConf = gConfDrop[id]
        for (var i = 1; i <= 10; i++) {
            if (!dropConf['weight' + i]) break;
            var awards = dropConf['award' + 1]
            for (var j = 0, len = awards.length; j < len; j++) {
                if (awards[j][0] == 'equip') {
                    dropConf.isEquip = true;
                }
            }
        }
    }
}

function scheduleActivity() {
    ERROR('scheduleActivity');
    global.gConfActivities = clone(gConfActivitiesRaw);
    var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime));

    for (var name in gConfAvSchedule) {
        if (name == 'human_arms') {
            var a = 0;
        }
        var confs = gConfAvSchedule[name];
        for (var round in confs) {
            var conf = confs[round];
            var delayDays = gConfActivities[name].delayDays;
            if (passedDay >= conf.startDay && passedDay <= (conf.endDay + delayDays)) {
                // console.log("---------name = "+name);
                var avConf = gConfActivities[name];
                avConf.openDay = 0;
                avConf.stage = conf.confId;
                var today = getGameDate();
                var startTime = common.getTime(gConfGlobalServer.serverStartDate) + conf.startDay * 86400 + gConfGlobal.resetHour * 3600;
                avConf.startTime = startTime;
                avConf.endTime = startTime + (conf.endDay - conf.startDay + 1) * 86400 - 60;
            }
        }
    }

    for (var name in gConfAvCondition) {
        var avConf = gConfActivities[name];
        if (avConf && !avConf.stage) {
            var gConfAvCondition_day = common.getDateDiff2(getGameDate(gConfGlobalServer.serverStartTime), getGameDate(avConf.startTime)) + 1;
            var conf = gConfAvCondition[name];
            for (var stage in conf) {
                if (gConfAvCondition_day >= conf[stage].startServerTime && gConfAvCondition_day <= conf[stage].endServerTime) {
                    avConf.stage = stage;
                    break;
                }
            }
        }
    }

    for (var name in gConfAvNewStage) {
        var confs = gConfAvNewStage[name];
        for (var round in confs) {
            var conf = confs[round];
            if (passedDay >= conf.startDay && passedDay <= conf.endDay) {
                var avConf = gConfActivities[name];
                avConf.openDay = 0;
                avConf.stage = conf.confId;
            }
        }
    }

    for (var name in gConfActivities) {
        var avConf = gConfActivities[name];
        //delete avConf.name;
        if (avConf.type == 1 || avConf.type == 0) {
            if (!avConf.stage) {
                avConf.stage = 1;
            }

            if (name == 'pay_only' && global.gConfAvPayOnlyRaw && global.gConfAvSingleRechargeRaw) {
                global.gConfAvPayOnly = global.gConfAvPayOnlyRaw[avConf.stage];
                global.gConfAvSingleRecharge = global.gConfAvSingleRechargeRaw[avConf.stage];
            } else if (name == 'single_recharge' && global.gConfAvSingleRechargeRaw) {
                global.gConfAvSingleRecharge = gConfAvSingleRechargeRaw[avConf.stage];
            } else if (name == 'todaydouble' && global.gConfAvTodayDoubleRaw) {
                global.gConfAvTodayDouble = global.gConfAvTodayDoubleRaw[avConf.stage];
            } else if (name == 'daily_recharge' && global.gConfAvDailyRechargeRaw) {
                global.gConfAvDailyRecharge = global.gConfAvDailyRechargeRaw[avConf.stage];
            } else if (name == 'login_goodgift' && global.gConfAvLoginGiftRaw) {
                global.gConfAvLoginGift = global.gConfAvLoginGiftRaw[avConf.stage];
            } else if (name == 'expend_gift' && global.gConfAvExpendGiftRaw) {
                global.gConfAvExpendGift = global.gConfAvExpendGiftRaw[avConf.stage];
            } else if (name == 'accumulate_recharge' && global.gConfAvAccumulateRechargeRaw) {
                global.gConfAvAccumulateRecharge = global.gConfAvAccumulateRechargeRaw[avConf.stage];
            } else if (name == 'tavern_recruit' && global.gConfAvTavernRecruitFrequencyRaw) {
                global.gConfAvTavernRecruitFrequency = global.gConfAvTavernRecruitFrequencyRaw[avConf.stage];
            } else if (name == 'daily_cost' && global.gConfAvDailyCostRaw) {
                global.gConfAvDailyCost = gConfAvDailyCostRaw[avConf.stage];
            } else if (name == 'value_package' && global.gConfAvOvervaluedGiftIdRaw) {
                global.gConfAvOvervaluedGiftId = global.gConfAvOvervaluedGiftIdRaw[avConf.stage];
            } else if (name == 'human_arms' && global.gConfAvhuman_armsRaw) {
                global.gConfAvhuman_arms = global.gConfAvhuman_armsRaw[avConf.stage];
            } else if (name == 'human_wing' && global.gConfAvhuman_wingRaw) {
                global.gConfAvhuman_wing = global.gConfAvhuman_wingRaw[avConf.stage];
            } else if (name == 'human_mount' && global.gConfAvhuman_mountRaw) {
                global.gConfAvhuman_mount = global.gConfAvhuman_mountRaw[avConf.stage];
            } else if (name == 'day_vouchsafe' && global.gConfAvDayVouchsafeRaw) {
                global.gConfAvDayVouchsafe = global.gConfAvDayVouchsafeRaw[avConf.stage];
                // 特惠活动开服时间+7天需要小于配置结束时间
                var endTime = common.getTime(gConfGlobalServer.serverStartDate) + (avConf.openDay + 7) * 86400 + gConfGlobal.resetHour * 3600 - 1;
                if (endTime > avConf.endTime) {
                    avConf.openDay = 10000;
                }
            } else if (name == 'tavern_normal' && global.gConfAvTavernNormalRaw) {
                global.gConfAvTavernNormal = global.gConfAvTavernNormalRaw[avConf.stage];
            } else if (name == 'tavern_high' && global.gConfAvTavernHighRaw) {
                global.gConfAvTavernHigh = global.gConfAvTavernHighRaw[avConf.stage];
            } else if (name == 'limit_exchange' && global.gConfAvLimitExchangeRaw) {
                global.gConfAvLimitExchange = global.gConfAvLimitExchangeRaw[avConf.stage];
            } else if (name == 'pray' && global.gConfAvPrayRaw) {
                global.gConfAvPray = global.gConfAvPrayRaw[avConf.stage];
            } else if (name == 'day_recharge' && global.gConfAvDayRechargeRaw) {
                global.gConfDayRecharge = global.gConfAvDayRechargeRaw[avConf.stage];
            } else if (name == 'accumulate_daily' && global.gConfAvAccumulateDailyRaw) {
                var tActPassDay = common.getDateDiff(getGameDate(), common.getDate(gConfActivities[name].startTime)) + 1;
                global.global.gConfAvAccumulateDaily = global.gConfAvAccumulateDailyRaw[avConf.stage][tActPassDay];
            } else if (name == 'accumulate_pay' && global.gConfAvAccumulatePayRaw) {
                global.global.gConfAvAccumulatePay = global.gConfAvAccumulatePayRaw[avConf.stage];
            } else if (name == 'day_exchange' && global.gConfAvDayExchangeRaw) {
                global.gConfDayExchange = global.gConfAvDayExchangeRaw[avConf.stage];
            } else if (name == 'manually' && global.gConfAvmanuallyLevelRaw && global.gConfAvmanuallyTaskRaw && global.gConfAvmanuallyAwardRaw) {         // 龙纹手册
                global.gConfAvmanuallyLevel = global.gConfAvmanuallyLevelRaw[avConf.stage];
                global.gConfAvmanuallyTask = global.gConfAvmanuallyTaskRaw[avConf.stage];
                global.gConfAvmanuallyAward = global.gConfAvmanuallyAwardRaw[avConf.stage];
            } else if (name == 'open_holiday' && global.gConfOpenHoliday_data) {
                global.gConfOpenHoliday = global.gConfOpenHoliday_data[avConf.stage];
                global.gConfOpenHolidayBox = global.gConfOpenHolidayBox_data[avConf.stage];
            } else if (name == 'buy_award' && global.gConfavbuy_award) {
                global.gConfBuyAward = global.gConfavbuy_award[avConf.stage];
            } else if (name == 'open_rank_recharge' && global.gConfAvRankRechargeRaw) {
                global.gConfAvRankRecharge = global.gConfAvRankRechargeRaw[avConf.stage];
            } else if (name == 'open_rank_expense' && global.gConfAvRankExpenseRaw) {
                global.gConfAvRankExpense = global.gConfAvRankExpenseRaw[avConf.stage];
            } else if (name == 'octopus' && global.gConfOctopusAwardRaw) {
                global.gConfOctopusAward = global.gConfOctopusAwardRaw[avConf.stage];
            } else if (name == 'help_equip' && global.gConfHelpEquipRaw) {
                global.gConfHelpEquip = global.gConfHelpEquipRaw[avConf.stage];
            } else if (name == 'destiny_rotate' && global.gConfAvDestinyRotateCostRaw && global.gConfAvDestinyRotateNormalRaw && global.gConfAvDestinyRotateHighRaw) {
                global.gConfAvDestinyRotateCost = global.gConfAvDestinyRotateCostRaw[avConf.stage];
                global.gConfAvDestinyRotateNormal = global.gConfAvDestinyRotateNormalRaw[avConf.stage];
                global.gConfAvDestinyRotateHigh = global.gConfAvDestinyRotateHighRaw[avConf.stage];
            }
        }
    }

    global.gConfActivitiesClient = clone(gConfActivities);
    for (var name in gConfActivitiesClient) {
        var avConf = gConfActivitiesClient[name];
        if (avConf.type == 1) {
            avConf.startTime = new Date(avConf.startTime * 1000).format('yyyy:MM:dd:hh:mm:ss');
            avConf.endTime = new Date(avConf.endTime * 1000).format('yyyy:MM:dd:hh:mm:ss');
        }
    }

    // 每日重置时间点前30秒刷新活动配置
    var timeout = getResetTime() + 86400 + 10 - common.getTime();
    ERROR('set scheduleActivity timeout: ' + timeout);
    setTimeout(function () {
        scheduleActivity();
    }, timeout * 1000);
}

function loadDB(callback) {
    var mongoServer = new mongodb.Server(config.MongodbHost, config.MongodbPort,
        { auto_reconnect: true, poolSize: 4 });
    var db = new mongodb.Db(config.MongodbName, mongoServer,
        { 'native_parser': false, 'w': 1, 'wtimeout': 10, 'fsync': true });

    db.open(function (err, db) {
        if (err) {
            ERROR(err);
            process.exit(-1);
        }

        callback && callback(db);
    });
}

function loadLogDB(callback) {
    var mongoServer = new mongodb.Server(config.LogMongodbHost, config.LogMongodbPort,
        { auto_reconnect: true, poolSize: 4 });

    var db = new mongodb.Db(config.LogMongodbName, mongoServer,
        { 'native_parser': false, 'w': 1, 'wtimeout': 10, 'fsync': true });

    db.open(function (err, db) {
        if (err) {
            ERROR(err);
            process.exit(-1);
        }

        callback && callback(db);
    });
}

function loadCache(callback) {
    var client = redis.createClient(config.RedisPort, config.RedisHost);
    client.auth(config.RedisAuth || '');
    client.select(config.RedisId, function (err) {
        if (err) {
            ERROR(err);
            process.exit(-1);
        }
    });

    client.on('ready', function () {
        callback && callback(client);
    });

    client.on('error', function (e) {
        ERROR(e);
    });
}

// 创建web服务器
function startWebServer(serverName, port, ip, handler, onExit) {

    DEBUG('###### start ' + serverName + ' on ' + ip + ':' + port + ' ######');
    var listener = function (req, res) {

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Credentials", "true");

        if (isExiting) {
            req.connection.destroy();
            return;
        }

        var body = '';
        req.on('data', function (chunk) {
            body += chunk;
            // POST请求不能超过100M
            if (body.length > 102400000) {
                ERROR('REQUEST BODY TOO LARGE');
                req.connection.destroy();
                return;
            }
        });

        req.on('end', function () {
            if (req.url.endWith('/crossdomain.xml')) {
                res.writeHead(200, common.defaultHeaders);
                res.end(common.defaultCrossDomain);
                return;
            } else if (req.url.beginWith('/log/')) {
                handleStaticFile(req.url.substr(1), res);
                return;
            } else if (req.url.endWith('.dat')) {
                var segs = req.url.split('/');
                handleStaticFile((config.ConfDir ? config.ConfDir : 'conf') + '/' + segs[segs.length - 1], res);
                return;
            }
            var rawData = '';
            if (req.method == 'POST') {
                rawData = body;
            } else {
                rawData = url.parse(req.url).query;
            }
            query = qs.parse(rawData);

            res._rawdata = rawData;
            res._query = query;
            res._args = query.args;
            res._time = +(new Date());
            res._ip = getClientIp(req);
            res._compress = req.headers['accept-encoding'] || '';

            if (config.Debug && query.mod == 'dump_obj') {
                var strData = "";
                try {
                    strData = JSON.stringify(dumpObj(query.path));
                } catch (e) {
                    strData = util.format('%j', e);
                }

                if (strData.length > 1024) {
                    zlib.deflate(strData, function (err, out) {
                        res.setHeader('Content-Encoding', 'deflate');
                        res.end(out);
                    });
                } else {
                    res.end(strData);
                }
                return;
            }

            handleReq(query, res, handler);
        });
    };

    var isExiting = false;
    var server = null;

    if (true || serverName.indexOf('game') == -1) {
        server = http.createServer(listener);
    } else {
        server = https.createServer({
            key: fs.readFileSync('./key/server.key'),
            cert: fs.readFileSync('./key/server.crt'),
            ca: fs.readFileSync('./key/server.csr'),
        }, listener);
    }

    server.listen(port, ip);

    var pidFile = serverName + '.pid';
    process.on('SIGINT', beforExit);
    process.on('SIGTERM', beforExit);
    process.on('SIGQUIT', beforExit);
    process.on('SIGABRT', beforExit);
    process.on('SIGHUP', beforExit);
    process.on('SIGUSR2', zhang_teacher);

    process.on('uncaughtException', function (err) {
        ERROR(err.stack);
        LogError(err.stack);

        if (err.code == 'EADDRINUSE') {
            beforExit();
        }
    });

    function beforExit() {
        INFO(serverName + ' begin shutdown');
        isExiting = true;

        if (onExit) {
            onExit(endExit);
        } else {
            endExit();
        }
    }

    // 张老师模式
    function zhang_teacher() {
        const fn = './zcg.js';
        if (!fs.existsSync(fn)) {
            DEBUG('Teacher ZHANG is unpresent !!!');
            return;
        }

        let path = require.resolve(fn);
        delete require.cache[fn];
        require(fn);

        DEBUG('ZCG MODE is happy');
    }

    function endExit() {
        fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
        INFO(serverName + ' end shutdown');

        // delete this
        DEBUG('end stopping : ' + (new Date()) / 1000);
        shutdownLog(function () {
            process.exit();
        });
    }

    INFO(serverName + ' start');
    fs.writeFileSync(pidFile, process.pid, 'utf8');

    return server;
}

function handleReq(query, res, handler) {
    var code = 1;
    var desc = '';

    query.uid = +query.uid;
    if (!query.mod) {
        desc = 'no mod';
    } else if (!query.act) {
        desc = 'no act';
    } else if (!query.uid) {
        desc = 'no uid';
    } else if (!query.args) {
        desc = 'no args';
    } else {
        try {
            query.args = JSON.parse(query.args);
            if (typeof (query.args) != 'object') {
                desc = 'args error';
            } else {
                if (!query.args) { ERROR(query); query.args = {}; }
                code = 0;
            }
        } catch (error) {
            desc = 'args not in json format';
        }
    }

    var resp = {
        'code': code,
        'desc': desc,
        'data': {}
    };

    if (resp.code != 0) {
        onReqHandled(res, resp);
        return;
    }
    handler(query, res, resp);
}

var staticFilePool = {};
function handleStaticFile(file, res) {
    if (file in staticFilePool) {
        sendStaticFile(file, staticFilePool[file], res);
    } else {
        fs.exists(file, function (exists) {
            if (exists) {
                fs.readFile(file, function (err, data) {
                    //staticFilePool[file] = data;
                    sendStaticFile(file, data, res);
                    delete staticFilePool[file];
                });
            } else {
                res.writeHead(404, common.defaultHeaders);
                res.end();
            }
        });
    }
}

function sendStaticFile(file, content, res) {
    if (file.endWith('html') || file.endWith('htm')) {
        res.writeHead(200, common.htmlHeaders);
    }
    res.end(content);
}

global.onReqHandled = function (res, data, noCompress) {
    if (!data.hasOwnProperty('code')) {
        data.code = 1;
        data.desc = 'no code';
    }

    if (!data.hasOwnProperty('desc')) {
        data.desc = '';
    }

    data.serverTime = common.getTime();
    var strData = JSON.stringify(data);
    var query = res._query;

    // jsonp
    if (query.args && query.args.callback && query.mod == 'gm') {
        strData = query.args.callback + "(" + strData + ");";
    }

    if (res._compress && strData.length > 1024) {
        zlib.deflate(strData, function (err, out) {
            if (err) {
                DEBUG(`zlib.deflate ERROR:  ${err} : ${strData}`);
            }
            ERROR(util.format('zlib result req handled time = %d %s %s %s', Date.now(), query.uid, query.mod, query.act));
            res.setHeader('Content-Encoding', 'deflate');
            res.end(out);
        });
    } else {
        ERROR(util.format('def result req handled time = %d %s %s %s', Date.now(), query.uid, query.mod, query.act));
        res.end(strData);
    }

    var timeCost = +(new Date()) - res._time;
    // TODO : 删除此处注释
    //if (data.code = 8 && query.mod == 'push' && query.act == 'push') {
    //    return;
    //}

    var costs = [];
    var awards = [];
    if (data.data) {
        if (data.data.costs) {
            costs = data.data.costs;
        }
        if (data.data.awards) {
            awards = data.data.awards;
        }
    }

    var addr = ``
    if (res.socket) {
        addr = `${res.socket.remoteAddress}:${res.socket.remotePort}`;
    }

    LOG(util.format('%d %s %s %s %s %j %j %d (addr=%s) %s', timeCost, query.uid, query.mod, query.act, query.seq || 0, query.args, data.data, data.code, addr, data.desc));

    if (timeCost > 1000) {
        ERROR(util.format('%d %s %s %s', timeCost, query.uid, query.mod, query.act));
    }
}

global.requestWorld = function (query, resp, callback) {
    var options = {
        host: config.WorldHost,
        port: config.WorldListen,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var gateResp = null;
            try {
                gateResp = JSON.parse(data);
            } catch (error) {
                ERROR('world resp ' + data);
                gateResp = null;
            }

            if (!gateResp) {
                resp.code = 1;
                resp.desc = 'request world error';
            } else {
                resp.code = gateResp.code;
                resp.desc = gateResp.desc;
                resp.data = gateResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function () {
        resp.code = 1;
        resp.desc = 'request world error';
        callback && callback(null);
    });

    // 更新世界服
    var update = {};
    if (query.uid) {

        var player = gPlayers.players[query.uid];
        if (player) {
            // 重新计算战斗属性
            player.getFightForce(true);
            //update['allUser'] = clone(player.user);

            //ERROR('=========SERVER-REQUIST WORLD:UPDATE DIRTY:');
            //ERROR(player.memData.dirty);
            var arrangedDirty = player.arrangeDirty(player.memData.dirty);
            for (var item in arrangedDirty) {
                var obj = player.user;
                var mirrorObj = gInitWorldUser;
                var args = item.split(".");
                var ok = true;
                for (var i = 0; i < args.length; i++) {
                    if (typeof (obj) != 'object') {
                        // 未找到
                        ok = false;
                        break;
                    }
                    obj = obj[args[i]];
                    if (typeof (mirrorObj) == 'object' && mirrorObj[args[i]]) {
                        mirrorObj = mirrorObj[args[i]];
                    } else {
                        mirrorObj = 0;
                        item = args[0];
                        for (var j = 1; j <= i; j++) {
                            item += '.' + args[j];
                        }
                        break;
                    }
                }

                if (ok && obj != undefined && obj != NaN && obj != null) {
                    var result = obj;
                    if (typeof (mirrorObj) == 'object' && !(util.isArray(mirrorObj))) {
                        result = mapObject(obj, mirrorObj);
                    }
                    update[item] = result;
                } else {
                    ERROR('invalid world update: ' + item);
                }
            }
            player.memData.dirty = {};

            for (var pos in player.memData.pos) {
                // 更新装备
                for (var type in player.memData.pos[pos].equip_changed) {
                    var eid = player.user.pos[pos].equip[type];
                    if (eid) {
                        var equip = player.user.bag.equip[eid];
                        if (equip) {
                            update['pos.' + pos + '.equip.' + type] = {
                                id: equip.id,
                                grade: equip.grade,
                                //intensify : equip.intensify,
                                //refine_exp : equip.refine_exp,
                            };
                        }
                    } else {
                        update['pos.' + pos + '.equip.' + type] = null;
                    }
                }
                player.memData.pos[pos].equip_changed = {};

                // 更新符文
                /*
                for (var index in player.memData.pos[pos].rune_changed) {
                    var rid = player.user.rune_use[pos][index];
                    if (rid) {
                        var rune = player.user.bag.rune[rid];
                        if (rune) {
                            update['pos.'+pos+'.rune.'+index] = {
                                id : rune.id,
                                level : rune.level,
                                base_attr : rune.base_attr,
                                attrs : rune.attrs,
                            };
                        }
                    } else {
                        update['pos.'+pos+'.rune.'+index] = null;
                    }
                }
                player.memData.pos[pos].rune_changed = {};
                */
            }
        }
    }
    //ERROR('-------server requestworld----------UPDATE-------------uid-'+query.uid);
    //ERROR(JSON.stringify(update));

    req.end('mod={0}&act={1}&uid={2}&args={3}&update={4}'.format(query.mod, query.act,
        query.uid, JSON.stringify(query.args), JSON.stringify(update)));
    req.end();
};


global.requestWorldSimple = function (query, resp, callback) {
    var options = {
        host: config.WorldHost,
        port: config.WorldListen,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var gateResp = null;
            try {
                gateResp = JSON.parse(data);
            } catch (error) {
                ERROR('world resp ' + data);
                gateResp = null;
            }

            if (!gateResp) {
                resp.code = 1;
                resp.desc = 'request world error';
            } else {
                resp.code = gateResp.code;
                resp.desc = gateResp.desc;
                resp.data = gateResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function () {
        resp.code = 1;
        resp.desc = 'request world error';
        callback && callback(null);
    });

    req.end('mod={0}&act={1}&uid={2}&args={3}'.format(query.mod, query.act,
        query.uid, JSON.stringify(query.args)));
    req.end();
};

// 强制将玩家数据更新到世界服，用于world和game必须同步的情况，
// 比如军团踢人的时候，被踢的人结算佣兵奖励，如果在线玩家被踢，且未同步，则取不到时间的佣兵奖励
global.forceSyncToWorld = function (uid, callback) {
    var player = gPlayers.players[uid];
    if (player && Object.keys(player.memData.dirty).length > 0) {
        var req = {
            mod: 'user',
            act: 'update',
            uid: uid,
            args: {},
        };
        requestWorld(req, {}, function () {
            callback && callback();
        });
    } else {
        callback && callback();
    }
};

global.requestWorldByModAndAct = function (req, mod, act, args, callback) {
    var reqWorld = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respWorld = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestWorld(reqWorld, respWorld, function () {
        callback && callback(respWorld);
    });
};

global.httpGet = function (host, port, path, callback, json, useSSL) {
    var options = {
        host: host,
        port: port,
        path: path,
        rejectUnauthorized: false,
    };

    var request = http.get;
    if (false && useSSL) {
        request = https.get;
    }
    request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            if (json) {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    data = null;
                }
            }
            callback && callback(data);
        });
    }).on('error', function (e) {
        if (json) {
            callback && callback(null);
        } else {
            callback && callback('error');
        }
    });
};

global.requestWorldWar = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.worldWarHost,
        port: gConfGlobalServer.worldWarPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var worldWarResp = null;
            try {
                worldWarResp = JSON.parse(data);
            } catch (error) {
                ERROR('worldwar resp ' + data);
                worldWarResp = null;
            }

            if (!worldWarResp) {
                resp.code = 1;
                resp.desc = 'request worldwar error';
            } else {
                resp.code = worldWarResp.code;
                resp.desc = worldWarResp.desc;
                resp.data = worldWarResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request worldwar error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestTerritoryWar = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.territoryWarHost,
        port: gConfGlobalServer.territoryWarPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var territoryWarResp = null;
            try {
                territoryWarResp = JSON.parse(data);
            } catch (error) {
                ERROR('territorywar resp ' + data);
                territoryWarResp = null;
            }

            if (!territoryWarResp) {
                resp.code = 1;
                resp.desc = 'request territorywar error';
            } else {
                resp.code = territoryWarResp.code;
                resp.desc = territoryWarResp.desc;
                resp.data = territoryWarResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request territorywar error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestTeamZone = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.teamzoneHost,
        port: gConfGlobalServer.teamzonePort,
        path: '/',
        method: 'POST'
    };

    // DEBUG(gConfGlobalServer.teamzoneHost);
    // DEBUG(gConfGlobalServer.teamzonePort);
    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var teamZoneResp = null;
            try {
                teamZoneResp = JSON.parse(data);
            } catch (error) {
                ERROR('team zone resp ' + data);
                teamZoneResp = null;
            }

            if (!teamZoneResp) {
                resp.code = 1;
                resp.desc = 'request team zone error';
            } else {
                resp.code = teamZoneResp.code;
                resp.desc = teamZoneResp.desc;
                resp.data = teamZoneResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request team zone error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};
global.requestTeamZoneByModAndAct = function (req, mod, act, args, callback) {
    var reqTeamZone = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respTeamZone = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestTeamZone(reqTeamZone, respTeamZone, function () {
        callback && callback(respTeamZone);
    });
}
global.requestTerritoryWarByModAndAct = function (req, mod, act, args, callback) {
    var reqTerritoryWar = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respTerritoryWar = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestTerritoryWar(reqTerritoryWar, respTerritoryWar, function () {
        callback && callback(respTerritoryWar);
    });
}
global.requestGlobal = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.globalHost,
        port: gConfGlobalServer.globalPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var globalResp = null;
            try {
                globalResp = JSON.parse(data);
            } catch (error) {
                ERROR('global resp ' + data);
                globalResp = null;
            }

            if (!globalResp) {
                resp.code = 1;
                resp.desc = 'request global error';
            } else {
                resp.code = globalResp.code;
                resp.desc = globalResp.desc;
                resp.data = globalResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request global error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestGlobalByModAndAct = function (req, mod, act, args, callback) {
    var reqGlobal = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respGlobal = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestGlobal(reqGlobal, respGlobal, function () {
        callback && callback(respGlobal);
    });
}

global.requestWorldWarByModAndAct = function (req, mod, act, args, callback) {
    var reqWorldWar = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respWorldWar = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestWorldWar(reqWorldWar, respWorldWar, function () {
        callback && callback(respWorldWar);
    });
};

global.requestWss = function (query, resp, callback) {
    var options = {
        host: "127.0.0.1",
        port: config.WssPort,
        localAddress: "127.0.0.1",
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var WssResp = null;
            try {
                WssResp = JSON.parse(data);
            } catch (error) {
                ERROR('worldwar resp ' + data);
                WssResp = null;
            }

            if (!WssResp) {
                resp.code = 1;
                resp.desc = 'request wss error';
            } else {
                resp.code = WssResp.code;
                resp.desc = WssResp.desc;
                resp.data = WssResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request wss error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j&type=%s&flag=%s', query.mod, query.act, query.uid, query.args, query.type, query.flag));
    req.end();
}

global.requestPHP = function (query, resp, callback) {
    var options = {
        host: config.PHPHost,
        port: config.PHPPort,
        path: config.PHPPath,
        method: 'POST',
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
        }
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var phpResp = null;
            try {
                phpResp = JSON.parse(data);
            } catch (error) {
                ERROR('php resp ' + data + " query:" + JSON.stringify(query));
                phpResp = null;
            }

            if (!phpResp) {
                resp.code = 1; resp.desc = 'request php error';
            } else {
                resp.code = phpResp.code;
                resp.desc = phpResp.desc;
                resp.data = phpResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request php error';
        callback && callback(null);
    });

    req.end(util.format('uid=%s&act=%s&args=%s&client_ip=%s',
        query.uid, query.act, encodeURIComponent(JSON.stringify(query.args)), query.client_ip || ''));
    req.end();
};

global.requestFootprintServer = function (query, resp, callback) {
    var footprintHost = config.footprintHost;
    if (!footprintHost) {
        footprintHost = '120.92.3.203';
    }
    var footprintPort = config.footprintPort;
    if (!footprintPort) {
        footprintPort = 80;
    }
    var footprintPath = config.footprintPath;
    if (!footprintPath) {
        footprintPath = '/msanguo/footprint.php';
    }

    var options = {
        host: footprintHost,
        port: footprintPort,
        path: footprintPath,
        method: 'POST',
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
        }
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request php error';
        callback && callback(null);
    });

    req.end(util.format('openid=%d&uid=%s&platform=%s&device_mac=%s&device_imei=%s&device_system=%s&device_name=%s&type=%s&dist_id=%d',
        query.openid, query.uid, query.platform, query.device_mac,
        query.device_imei, query.device_system, query.device_name, query.type, query.dist_id));
    req.end();
};

global.footprint = function (openid, uid, platform, type) {
    if (config.NoHack) {
        return;
    }

    var phpReq = {
        openid: openid,
        uid: uid,
        platform: platform,
        device_mac: 0,
        device_imei: 0,
        device_system: 0,
        device_name: 0,
        type: type,
        dist_id: config.DistId,
    };

    var phpResp = {
        code: 0,
        desc: '',
    };
    requestFootprintServer(phpReq, phpResp);
};

global.requestPHPLogServer = function (query, resp, callback) {
    var logHost = config.LogHost;
    if (!logHost) {
        logHost = '120.92.3.203';
    }
    var logPort = config.LogPort;
    if (!logPort) {
        logPort = 80;
    }
    var logPath = config.LogPath;
    if (!logPath) {
        logPath = '/msanguo/exceptionHandler.php';
    }

    var options = {
        host: logHost,
        port: logPort,
        path: logPath,
        method: 'POST',
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
        }
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request php error';
        callback && callback(null);
    });

    req.end(util.format('server=%d&subject=%s&content=%s',
        query.server, query.subject, query.content));
    req.end();
};

global.LogError = function (msg) {
    if (config.NoHack) {
        return;
    }

    var serverId = config.DistId;
    var phpReq = {
        server: serverId,
        subject: 'server_' + serverId + '_crash',
        content: msg,
    };

    var phpResp = {
        code: 0,
        desc: '',
    };
    requestPHPLogServer(phpReq, phpResp);
};

global.requestClientWorld = function (sid, query, resp, callback) {
    if (!config.ClientWorldServers[sid]) {
        resp.code = 1; resp.desc = "no this server: " + sid;
        callback && callback(sid); return;
    }

    requestClientWorldByIpAndPort(sid, config.ClientWorldServers[sid].host,
        config.ClientWorldServers[sid].port, query, resp, callback);
};

global.requestClientWorldByIpAndPort = function (sid, host, port, query, resp, callback) {
    var options = {
        host: host,
        port: port,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var worldResp = null;
            try {
                worldResp = JSON.parse(data);
            } catch (error) {
                ERROR('' + sid + ' world resp ' + data);
                worldResp = null;
            }

            if (!worldResp) {
                resp.code = 1;
                resp.desc = 'request ' + sid + ' world error';
            } else {
                resp.code = worldResp.code;
                resp.desc = worldResp.desc;
                resp.data = worldResp.data;
            }

            callback && callback(sid);
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request ' + sid + ' world error';
        console.log(err);
        callback && callback(sid);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestFightServer = function (query, resp, callback) {
    var options = {
        host: config.FightHost,
        port: config.FightPort,
        path: config.FightPath,
        method: 'POST',
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var fightResp = null;
            try {
                fightResp = JSON.parse(data);
            } catch (error) {
                ERROR('fight resp ' + data + " query:" + JSON.stringify(query));
                fightResp = null;
            }

            if (!fightResp) {
                resp.code = 1; resp.desc = 'request fight error';
            } else {
                resp.code = fightResp.code;
                resp.desc = fightResp.desc;
                resp.data = fightResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request fight error';
        callback && callback(null);
    });

    req.end(util.format('attacker=%s&enemy=%s&attackerInfo=%j&enemyInfo=%j', query.attacker, query.enemy, query.attackerInfo, query.enemyInfo));
    req.end();
}

global.requestLogServer = function (query, resp, callback) {
    var options = {
        host: config.LogServerHost,
        port: config.LogServerPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var legionWarResp = null;
            try {
                legionWarResp = JSON.parse(data);
            } catch (error) {
                ERROR('log server resp ' + data);
                legionWarResp = null;
            }

            if (!legionWarResp) {
                resp.code = 1;
                resp.desc = 'request log server error';
            } else {
                resp.code = legionWarResp.code;
                resp.desc = legionWarResp.desc;
                resp.data = legionWarResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request log server error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&type=%d&args=%j', query.mod, query.act, query.uid, query.type, query.args));
    req.end();
};

global.addGameLog = function (type, args, callback) {
    return;
    var reqLog = {
        mod: 'logmanager',
        act: 'log',
        uid: 1,
        type: type,
        args: args || {},
    };

    var respLog = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestLogServer(reqLog, respLog, function () {
        callback && callback(respLog);
    });
};

global.requestLegionWar = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.legionWarHost,
        port: gConfGlobalServer.legionWarPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var legionWarResp = null;
            try {
                legionWarResp = JSON.parse(data);
            } catch (error) {
                ERROR('global resp ' + data);
                legionWarResp = null;
            }

            if (!legionWarResp) {
                resp.code = 1;
                resp.desc = 'request legionwar error';
            } else {
                resp.code = legionWarResp.code;
                resp.desc = legionWarResp.desc;
                resp.data = legionWarResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request legionwar error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestLegionWarByModAndAct = function (req, mod, act, args, callback) {
    var reqLegionWar = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respLegionWar = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestLegionWar(reqLegionWar, respLegionWar, function () {
        callback && callback(respLegionWar);
    });
};


global.requestCountryWar = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.countryWarHost,
        port: gConfGlobalServer.countryWarPort,
        path: '/',
        method: 'POST'
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var countryWarResp = null;
            try {
                countryWarResp = JSON.parse(data);
            } catch (error) {
                ERROR('server war resp ' + data);
                countryWarResp = null;
            }

            if (!countryWarResp) {
                resp.code = 1;
                resp.desc = 'request countrywar error';
            } else {
                resp.code = countryWarResp.code;
                resp.desc = countryWarResp.desc;
                resp.data = countryWarResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request countrywar error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestCountryWarByModAndAct = function (req, mod, act, args, callback) {
    var reqCountryWar = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respCountryWar = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestCountryWar(reqCountryWar, respCountryWar, function () {
        callback && callback(respCountryWar);
    });
}

global.requestArenaServer = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.arenaServerHost,
        port: gConfGlobalServer.arenaServerPort,
        path: '/',
        method: 'POST'
    };

    DEBUG('requestArenaServer host : ' + options.host + ', port : ' + options.port);

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var arenaServerResp = null;
            try {
                arenaServerResp = JSON.parse(data);
            } catch (error) {
                ERROR('arena server resp ' + data);
                arenaServerResp = null;
            }

            if (!arenaServerResp) {
                resp.code = 1;
                resp.desc = 'request arena server error';
            } else {
                resp.code = arenaServerResp.code;
                resp.desc = arenaServerResp.desc;
                resp.data = arenaServerResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request arena server error';
        callback && callback(null);
    });

    req.end(util.format('mod=%s&act=%s&uid=%s&args=%j', query.mod, query.act, query.uid, query.args));
    req.end();
};

global.requestArenaServerByModAndAct = function (req, mod, act, args, callback) {
    var reqCountryWar = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respArenaWar = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestArenaServer(reqCountryWar, respArenaWar, function () {
        callback && callback(respArenaWar);
    });
}

// 请求村庄争夺服务器
global.requestLandGrabber = function (query, resp, callback) {
    var options = {
        host: gConfGlobalServer.landGrabberHost,
        port: gConfGlobalServer.landGrabberPort,
        path: '/',
        method: 'POST'
    };

    DEBUG('requestLandGrabber host : ' + options.host + ', port : ' + options.port);

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            var landGrabberResp = null;
            try {
                landGrabberResp = JSON.parse(data);
            } catch (error) {
                ERROR('land grabber server resp ' + data);
                landGrabberResp = null;
            }

            if (!landGrabberResp) {
                resp.code = 1;
                resp.desc = 'request arena server error';
            } else {
                resp.code = landGrabberResp.code;
                resp.desc = landGrabberResp.desc;
                resp.data = landGrabberResp.data;
            }

            callback && callback();
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'request land grabber server error';
        callback && callback(null);
    });

    req.end('mod={0}&act={1}&uid={2}&args={3}'.format(query.mod, query.act,
        query.uid, JSON.stringify(query.args)));
    req.end();
};

global.requestLandGrabberByModAndAct = function (req, mod, act, args, callback) {
    var reqLandGrabber = {
        mod: mod,
        act: act,
        uid: req.uid,
        seq: req.seq ? req.seq : 0,
        args: args || {},
    };

    var respLandGrabber = {
        'code': 0,
        'desc': '',
        'data': {},
    };

    requestLandGrabber(reqLandGrabber, respLandGrabber, function () {
        callback && callback(respLandGrabber);
    });
}

global.getMailsAndBulletins = function (uid, options, res, onHandled) {
    var worldReq = {
        mod: 'mail',
        act: 'get',
        uid: uid,
        args: {
            options: options,
        },
    };

    var worldResp = {};
    requestWorld(worldReq, worldResp, function () {
        if (worldResp.code == 0) {
            var selfMails = worldResp.data.mail;
            var sysMails = worldResp.data.sys_mail;
            var mails = [];
            var bulletins = [];
            for (var id in selfMails) {
                selfMails[id].id = +id;
                selfMails[id].sys = 0;
                mails.push(selfMails[id]);
            }
            for (var id in sysMails) {
                var mail = sysMails[id];
                mail.id = +id;
                mail.sys = 1;
                if (mail.type == 0) {
                    mail.from = 0;
                    mails.push(mail);
                } else {
                    bulletins.push(mail);
                }
            }
            res.mails = mails;
            res.bulletins = bulletins;
        }

        onHandled();
    });
}

global.pushToUser = function (uid, type, args, flag) {
    var reqWss = {
        uid: uid,
        mod: 'push',
        act: 'push',
        type: type,    // 'self', 'all', null
        flag: flag,
        args: args,
    }
    requestWss(reqWss, {});
}

global.pushToGroupUser = function (uids, type, args, flag) {
    for (var i = 0, max = uids.length; i < max; i++) {
        var reqWss = {
            uid: uids[i],
            mod: 'push',
            act: 'push',
            type: type,    // 'self', 'all', null
            flag: flag,
            args: args,
        }
        requestWss(reqWss, {});
    }
}

// 根据触发类型触发系统提示
global.pushSysMsg = function (type, array) {
    if (!type || !array) {
        return;
    }

    var conf = gConfChatNotice[type];
    if (!conf) {
        return;
    }

    var typeId = conf.id;
    var wssReq = {
        uid: 10000,
        mod: 'chat',
        act: 'push_sys_msg',
        args: {},
    };

    var wssResp = {};
    wssReq.args.type_id = typeId;
    wssReq.args.type = type;
    wssReq.args.array = array;
    requestWss(wssReq, wssResp);
};


// 根据触发类型触发系统提示
global.gmPushSysMsg = function (array) {
    if (!array) {
        return;
    }
    var wssReq = {
        uid: 10000,
        mod: 'chat',
        act: 'push_sys_msg',
        args: {},
    };

    var wssResp = {};
    wssReq.args.type_id = 13;
    wssReq.args.type = "gmPushSysMsg";
    wssReq.args.array = array;
    requestWss(wssReq, wssResp);
};

global.addUserChatMsg = function (uid, type, content, info) {
    var reqWss = {
        uid: uid,
        mod: 'chat',
        act: 'chat',
        args: {
            type: type,        // 类型，'world' 世界聊天, 'friend' 好友聊天', 'legion' 军团聊天
            content: content,  // 聊天文本
            info: info,        // 其他附加信息, 用于系统发红包等
        },
    };
    requestWss(reqWss, {});
}

global.delUserChatMsg = function (uid, type, content, info) {
    var reqWss = {
        uid: uid,
        mod: 'chat',
        act: 'del_msg',
        args: {
            type: type,
            content: content,
            info: info,
        },
    };

    requestWss(reqWss, {});
}

global.markChatMsg = function (uid, type, info) {
    var reqWss = {
        uid: uid,
        mod: 'chat',
        act: 'mark_msg',
        args: {
            type: type,
            info: info,
        },
    };

    requestWss(reqWss, {});
}

global.updateWssData = function (uid, args) {
    var reqWss = {
        uid: uid,
        mod: 'user',
        act: 'update',
        type: 'self',
        args: args
    };

    requestWss(reqWss, {});
}

global.getDistId = function (game) {
    if (config.DistConfig[game]) {
        return config.DistConfig[game];
    } else {
        return config.DistConfig[config.DefaultGame];
    }
};

// 赞成上报充值数据
global.zc_post_payment = function (args, callback) {

    var resp = {};
    var args = JSON.stringify(args);

    var options = {
        host: 'log.trackingio.com',
        port: 80,
        path: '/receive/tkio/payment',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(args),
        }
    };

    var req = http.request(options, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks).toString();
            try {
                phpResp = JSON.parse(data);
                resp.code = phpResp.status;
                if (phpResp.status != 0) {
                    ERROR(phpResp);
                }
            } catch (error) {
                resp.code = 2;
                resp.desc = 'JSON.parse error';
                ERROR('zc_post_payment JSON.parse error: ' + data);
            }

            callback && callback(resp);
        });
    });

    req.on('error', function (err) {
        resp.code = 1;
        resp.desc = 'zc_post_payment error';
        callback && callback(resp);
    });

    req.write(args);
    req.end();
};

/** 获取玩家数据快照 */
global.user_snapshot_data = function (user) {
    var tResultData = {};
    if (user) {
        tResultData["_id"] = user._id;
        tResultData["sid"] = config.ServerId;
        tResultData["info"] = user.info || {};
        tResultData["info"]["sid"] = config.ServerId;
        tResultData["status"] = {};
        user.status = user.status || {};
        tResultData["status"]["level"] = user.status.level;
        tResultData["status"]["xp"] = user.status.xp;
        tResultData["status"]["vip"] = user.status.vip;
        tResultData["status"]["staying_power"] = user.status.staying_power;
        tResultData["status"]["team_exp"] = user.status.team_exp;
        tResultData["pos"] = user.pos;
        tResultData["skills"] = user.skills;
        tResultData["def_info"] = user.def_info;
        tResultData["sky_suit"] = {};
        user.sky_suit = user.sky_suit || {};
        tResultData["sky_suit"]["weapon_illusion"] = user.sky_suit.weapon_illusion;
        tResultData["sky_suit"]["wing_illusion"] = user.sky_suit.wing_illusion;
        tResultData["sky_suit"]["mount_illusion"] = user.sky_suit.mount_illusion;
        tResultData["custom_king"] = user.custom_king;
        tResultData["dragon"] = user.dragon;
        tResultData["mark"] = {};
        user.mark = user.mark || {};
        tResultData["mark"]["fight"] = user.mark.max_fight_force;
    }

    return tResultData;
};

exports.loadDB = loadDB;
exports.loadLogDB = loadLogDB;
exports.loadCache = loadCache;
exports.loadGlobalServerConf = loadGlobalServerConf;
exports.loadConf = loadConf;
exports.startWebServer = startWebServer;
exports.httpGet = httpGet;
exports.scheduleActivity = scheduleActivity;
