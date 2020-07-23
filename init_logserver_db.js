var mongodb = require('mongodb');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
var common  = require('./common.js');
var server  = require('./server.js');

var LogManager = require('./logserver/logmanager').LogManager;

(function main(){
    server.loadLogDB(function(db){

        var loader = new common.Loader(function() {
            process.exit(0);
        });

        // 货币生产、消耗表
        db.createCollection('currency_produce', {}, function(err, result) {});
        db.createCollection('currency_consume', {}, function(err, result) {});

        // 材料生产、消耗表
        db.createCollection('material_produce', {}, function(err, result) {});
        db.createCollection('material_consume', {}, function(err, result) {});

        // 装备生产、消耗表
        db.createCollection('equip_produce', {}, function(err, result) {});
        db.createCollection('equip_consume', {}, function(err, result) {});

        // 卡片生产、消耗表
        db.createCollection('card_produce', {}, function(err, result) {});
        db.createCollection('card_consume', {}, function(err, result) {});

        // 龙晶产出、消耗表
        db.createCollection('dragon_produce', {}, function(err, result) {});
        db.createCollection('dragon_consume', {}, function(err, result) {});

        // 武将碎片产出、消耗表
        db.createCollection('card_fragment_produce', {}, function(err, result) {});
        db.createCollection('card_fragment_consume', {}, function(err, result) {});

        // 装备碎片产出、消耗表
        db.createCollection('equip_fragment_produce', {}, function(err, result) {});
        db.createCollection('equip_fragment_consume', {}, function(err, result) {});

        // 宝石产出、消耗表
        db.createCollection('gem_produce', {}, function(err, result) {});
        db.createCollection('gem_consume', {}, function(err, result) {});

        // 小兵装备产出、消耗表
        db.createCollection('soldier_equip_produce', {}, function(err, result) {});
        db.createCollection('soldier_equip_consume', {}, function(err, result) {});

        // 符文产出、消耗表
        db.createCollection('rune_produce', {}, function(err, result) {});
        db.createCollection('rune_consume', {}, function(err, result) {});

        db.createCollection('world', {}, function(err, result){
            global.gDBWorld = db.collection('world');

            // 创建军团战数据
            loader.addLoad('logmanager');
            LogManager.create(function () {
                loader.onLoad('logmanager');
            });
        });
    });
})();
