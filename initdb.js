var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var UserInfo = require('./world/user.js').UserInfo;
var Battle = require('./world/battle.js').Battle;
var Mine = require('./world/mine.js').Mine;
var SysMail = require('./world/mail.js').SysMail;
var Arena = require('./world/arena.js').Arena;
var Tower = require('./world/tower.js').Tower;
var Legion = require('./world/legion.js').Legion;
var Shipper = require('./world/shipper.js').Shipper;
var Guard = require('./world/guard.js').Guard;
var SysMsg = require('./world/gmPushSysMsg.js').SysMsg;
var Country = require('./world/country.js').Country;
var Activity = require('./world/activity.js').Activity;
var Tips = require('./world/tips.js').Tips;
var Tavern = require('./world/tavern.js').Tavern;
var Replay = require('./world/replay.js').Replay;
var LegionWar = require('./world/legionwar.js').LegionWar;
var Friend =  require('./world/friend.js').Friend;
var Clan =  require('./world/clan.js').Clan;
var NewLegion = require('./world/new_legion').NewLegion;
var LandGrabber = require('./landgrabber/landgrabber').LandGrabber;

require('./logger.js');
setupLog('initdb');
global.common = require('./common.js');
require('./server.js').loadGlobalServerConf('world');
require('./server.js').loadConf();

(function main() {
    var mongoServer = new mongodb.Server(config.MongodbHost, config.MongodbPort,
                                        {auto_reconnect:true, poolSize:4});
    var db = new mongodb.Db(config.MongodbName, mongoServer,
                    {'native_parser':false, 'w':1, 'wtimeout':2, 'fsync':true});

    db.open(function(err, db) {
        if( err ) {
            ERROR('db open err!');
            process.exit(-1);
        }

        var loader = new common.Loader(function() {
            process.exit(0);
        });

        loader.addLoad(1);
        db.createCollection('plat', {}, function(err, result){
            loader.onLoad(1);

            var serverId = config.ServerId || 1;
            var gDBPlat = db.collection('plat');
            loader.addLoad(1);
            gDBPlat.insertOne({_id:'_userid', 'ai':serverId*1000000}, function(err, result){
                loader.onLoad(1);
            });
        });

        loader.addLoad(1);
        db.createCollection('user', {}, function(err, result){
            loader.onLoad(1);
        });

        loader.addLoad(1);
        db.createCollection('world', {}, function(err, result){
            loader.onLoad(1);
            global.gDBWorld = db.collection('world');

            // 玩家信息
            loader.addLoad('userinfo');
            UserInfo.create(function() {
                loader.onLoad('userinfo');
            });

            //  战场
            loader.addLoad('battle')
            Battle.create(function() {
                loader.onLoad('battle');
            });

            //  金矿
            loader.addLoad('mine')
            Mine.create(function() {
                loader.onLoad('mine');
            });

            //  系统邮件和公告
            loader.addLoad('sys_mail')
            SysMail.create(function() {
                loader.onLoad('sys_mail');
            });

            //  竞技场
            loader.addLoad('arena')
            Arena.create(function() {
                loader.onLoad('arena');
            });

            //  千重楼
            loader.addLoad('tower')
            Tower.create(function() {
                loader.onLoad('tower');
            });

            //   军团
            loader.addLoad('legion')
            Legion.create(function() {
                loader.onLoad('legion');
            });

            // 新的军团
            loader.addLoad('new_legion')
            NewLegion.create(function() {
                loader.onLoad('new_legion');
            });

            //   押镖
            loader.addLoad('shipper')
            Shipper.create(function() {
                loader.onLoad('shipper');
            });

            //   领地
            loader.addLoad('guard')
            Guard.create(function() {
                loader.onLoad('guard');
            });

            //  //   领地
            // loader.addLoad('sysMsgData')
            // SysMsg.create(function() {
            //     loader.onLoad('SysMsg');
            // });

            //   国家
            loader.addLoad('country')
            Country.create(function() {
                loader.onLoad('country');
            });

            //   活动
            loader.addLoad('activity')
            Activity.create(function() {
                loader.onLoad('activity');
            });

            //   提醒
            loader.addLoad('tips')
            Tips.create(function() {
                loader.onLoad('tips');
            });

            //   酒馆
            loader.addLoad('tavern')
            Tavern.create(function() {
                loader.onLoad('tavern');
            });

            //   酒馆
            loader.addLoad('replay')
            Replay.create(function() {
                loader.onLoad('replay');
            });

            //   军团战
            loader.addLoad('legionwar')
            LegionWar.create(function() {
                loader.onLoad('legionwar');
            });

            //   好友系统
            loader.addLoad('friend')
            Friend.create(function() {
                loader.onLoad('friend');
            });

            // 战队系统
            loader.addLoad('clan');
            Clan.create(function() {
                loader.onLoad('clan');
            });

            // 村庄争夺
            loader.addLoad('landgrabber');
            LandGrabber.create(function () {
                loader.onLoad('landgrabber');
            });
        });

        loader.addLoad(1);
        db.createCollection('pay', {}, function(err, result){
            loader.onLoad(1);
        });

        loader.addLoad(1);
        db.createCollection('analysis', {}, function(err, result){
            loader.onLoad(1);
        });

        loader.addLoad(1);
        db.createCollection('mail', {}, function(err, result){
            loader.onLoad(1);
        });
    });
})();
