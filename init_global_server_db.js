var mongodb = require('mongodb');
var config = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common = require('./common.js');
var server = require('./server.js');

var LegionWarTopList = require('./global_server/legionwar_toplist').LegionWarTopList;
var Activtiy = require('./global_server/activity').Activity;
var FightRank = require('./global_server/fight_rank.js').FightRank;

(function main() {
    server.loadDB(function (db) {
        var loader = new common.Loader(function () {
            process.exit(0);
        });

        db.createCollection('world', {}, function (err, result) {
            global.gDBWorld = db.collection('world');

            // 创建军团段位排行榜数据
            loader.addLoad('LegionWarTopList');
            LegionWarTopList.create(function () {
                loader.onLoad('LegionWarTopList');
            });

            // 创建全服活动数据
            loader.addLoad('Activity');
            Activtiy.create(function () {
                loader.onLoad('Activity');
            });

            // 创建全服活动数据
            loader.addLoad('FightRank');
            FightRank.create(function () {
                loader.onLoad('FightRank');
            });
        });
    });
})();
