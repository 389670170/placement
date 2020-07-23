var ErrorCode = require('./error.js').ErrorCode;
var findErrorString = require('./error.js').findErrorString;

// 游戏服务器向云服注册
exports.register_server = function(req, res, resp) {
    gLegionWar.registerServer(req.args, function(err){
       if (err) {
           resp.code = 1;
           resp.desc = findErrorString(err);
       }
       onReqHandled(res, resp, 1);
    });
};

// 获取主界面数据
exports.get_main_page_info = function(req, res, resp) {
    gLegionWar.getMainPageInfo(+req.args.lid, req.args.joined, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = findErrorString(err);
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// 获取战斗界面数据
exports.get_battle_page_info = function(req, res, resp) {
    gLegionWar.getBattlePageInfo(req.args.uid, req.args.lid, req.args.garrison, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = findErrorString(err);
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// 获取城池数据
exports.get_city_info = function(req, res, resp) {
    gLegionWar.getCityInfo(
        req.uid,
        req.args.lid,
        req.args.city,
        req.args.hidd_dark,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};


// 获取城池数据
exports.get_city_info_multi = function(req, res, resp) {
    gLegionWar.getCityInfoMulti(
        req.uid,
        req.args.lid,
        req.args.city,
        req.args.hidd_dark,
        function(err, data) {
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};


// 增驻城池
exports.upgrade_citybuf = function(req, res, resp) {
    gLegionWar.upgradeCityBuff(
        req.args.lid,
        req.args.city,
        req.args.uid,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data.citybuf = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 取消修筑
exports.cancel_citybuf = function (req, res, resp) {
    gLegionWar.cancelCityBuf(
        req.args.lid,
        req.args.uid,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data.citybuf = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 向城池驻守玩家
exports.add_city_force = function(req, res, resp) {
    gLegionWar.addCityForce(
        +req.args.lid,
        +req.args.city,
        +req.args.arm,
        +req.args.arm_uid,
        function(err){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 将玩家从城池移除
exports.remove_city_force = function(req, res, resp) {
    gLegionWar.removeCityForce(
        req.args.lid,
        req.args.city,
        req.args.arm_uid,
        function(err){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 使用妙计卡
exports.use_card = function(req, res, resp) {
    gLegionWar.useCard(
        req.args.lid,
        req.args.card,
        req.args.target,
        req.args.uid,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 攻击敌方玩家
exports.attack_arm = function(req, res, resp) {
    gLegionWar.attackArm(
        req.args.lid,
        req.args.city,
        req.args.arm,
        req.args.uid,
        req.args.card || 0,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 战斗开始
exports.before_fight = function(req, res, resp) {
    gLegionWar.beforeFight(
        req.args.lid,
        req.args.city,
        req.args.arm,
        req.args.uid,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 战斗结束
exports.fight = function(req, res, resp) {
    gLegionWar.fight(
        req.args.lid,
        req.args.city,
        req.args.arm,
        req.args.uid,
        req.args.star,
        req.args.power,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 领取城池奖励
exports.get_city_award = function(req, res, resp) {
    gLegionWar.getCityAward(
        req.args.lid,
        req.args.city,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 查询当前轮结果
exports.get_round_result = function(req, res, resp) {
    gLegionWar.getRoundResult(
        req.args.lids,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 获取军团历史战绩
exports.get_history = function(req, res, resp) {
    gLegionWar.getHistory(
        req.args.lid,
        function(err, data){
            if (err) {
                resp.code = err;
                resp.desc = findErrorString(err);
            } else {
                resp.data = data;
            }
            onReqHandled(res, resp, 1);
        }
    );
};

// 获取排行榜
exports.get_world_ranklist = function(req, res, resp){
    var lid = req.args.lid;
    gLegionWar.getWorldRankList(lid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// 获取段位数据
exports.get_rank_info = function(req, res, resp){
    var lid = req.args.lid;
    gLegionWar.getRankInfo(lid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_accumulate_legion_war = function(req, res, resp){
    var uid = req.uid;
    gLegionWar.getAccumulateLegionwar(uid, function(err, data){
        if (err) {
            resp.code = err;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

// 检查TIPS
exports.check_tips = function(req, res, resp){
    var lid = req.args.lid;
    var uid = req.args.uid;
    gLegionWar.checkTips(lid, uid, function(err, data){
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.get_city_buf_speed = function (req, res, resp) {
    var uid = req.uid;
    var lid = req.args.lid;
    gLegionWar.getCityBufSpeed(lid, uid, function (err, data) {
        if (err) {
            resp.code = 1;
            resp.desc = err;
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.update_city_buf = function (req, res, resp) {
    var lid = req.args.lid;
    var city = req.args.city;
    gLegionWar.calculateCityBuff(lid, city, true);
    onReqHandled(res, resp, 1);
};

exports.get_enemy = function (req, res, resp) {
    gLegionWar.getEnemy(req.args.lid, req.args.enemy, function (err, data) {
        if (err) {
            resp.code = err;
            resp.desc = findErrorString(err);
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    });
};

exports.leave_legion = function (req, res, resp) {
    gLegionWar.leaveLegion(req.args.lid, req.args.uid, function (err, data) {
        if (err) {
            resp.code = err;
            resp.desc = findErrorString(err);
        } else {
            resp.data = data;
        }
        onReqHandled(res, resp, 1);
    })
};
