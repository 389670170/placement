// 幸运转盘

// ----------------------------------------------------------------------------

var ActKey = 'act_lucky_rotation';

const LIST_SIZE = 20;

var template = {
    total : 0,      // 当前仓库总量
    count : 0,      // 当前已抽次数
    list  : [],     // 幸运榜      抽中道具：[1, time, name, [award], sid]   or  奖池中奖：[2, time, name, [award], sid]
    dist  : [],     // 奖项分布
}


// ----------------------------------------------------------------------------
// aux

// 从本周开始到目前的秒数
function get_curr_weekly() {
    var now = new Date();
    return now.getDay() * 86400 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

// 周一早上5点(重置点)的秒数
function get_reset_weekly () {
    return 1 * 86400 + 5 * 3600
}


// ----------------------------------------------------------------------------
// local

// 分配奖池
function dist_pond(conf, data) {
    
    data.dist  = [];
    data.count = 0;

    for(var i = 0; i < conf.pondPer.length; i++) {
        
        var v = conf.pondPer[i];
        var t = conf.pondTimes[i];
        
        for (var m = 0; m < t; m++) {
            data.dist.push(v);
        }
    }

    var len = data.dist.length;
    for(var i = len; i < conf.pondCycle; i++) {
        data.dist[i] = 0;
    }

    data.dist.shuffle();
    data.dist.shuffle();
}

// 增加列表显示项目
function list_add_limited(data, item) {
    data.list.unshift(item);

    if (data.list.length > LIST_SIZE) {
        data.list.length = LIST_SIZE;
    }
}

// ----------------------------------------------------------------------------

function ActLuckyRotation() {
    // saved
    this.key  = 0;
    this.data = {};

    // unsaved
}


ActLuckyRotation.create = function(callback) {
    var doc = {
        '_id'   : ActKey,
        'key'   : 0,
        'data'  : {},
    };

    gDBWorld.insert(doc, function(err, result) {
        callback && callback();
    });
}


ActLuckyRotation.prototype = {

    init: function(callback) {
        gDBWorld.find({_id: ActKey}).limit(1).next(function(err, doc) {
            if (doc) {
                this.key  = doc.key;
                this.data = doc.data;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));

        setTimeout(function(){
            gActLuckyRotation.save();
        }, 60*1000);

        // 设置重置时间(此种涉及不能停服不能跨过重置时间)
        var now = get_curr_weekly();
        var rst = get_reset_weekly();

        var diff = rst - now;
        if (diff < 0) {
            diff = 86400 * 7 - now + rst;
        }

        setTimeout(function(){
            gActLuckyRotation.set_reset_timer();
        }, diff*1000);
    },

    save: function(callback) {
        var doc = {
            _id:  ActKey,
            key:  this.key,
            data: this.data,
        };

        gDBWorld.save(doc, function (err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    // 新的一期活动，初始化数据
    reset: function() {
        for (let id in gConfAvLuckyRotateBase) {
            let conf = gConfAvLuckyRotateBase[id];

            this.data[id] = clone(template);
            let data = this.data[id];

            // 初始化基础金额
            data.total = +conf.basePond[0][2];

            // 分配奖池
            // dist_pond(conf, data);
        }
    },

    // 每周一早上5点重置
    set_reset_timer: function() {
        setTimeout(function(){
            gActLuckyRotation.set_reset_timer();
        }, 86400*7*1000);

        gActLuckyRotation.reset();
    },

}

// ----------------------------------------------------------------------------
// export

// 拉
exports.get_info = function(req, res, resp) {

    do {
        // 检测是否需要重置活动数据
        if (req.args.key && !gActLuckyRotation.key) {
            gActLuckyRotation.key = req.args.key;
            gActLuckyRotation.reset();
        }

        var type = req.args.type;
        var data = gActLuckyRotation.data[type];

        if (!data) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        resp.data.list  = data.list;
        resp.data.total = data.total;

    } while (false);

    onReqHandled(res, resp, 1);
};


// 转
exports.rotate = function(req, res, resp) {
    do {

        var name =  req.args.un || "";
        var type = +req.args.type;
        var time = +req.args.time;

        var data = gActLuckyRotation.data[type];
        var conf = gConfAvLuckyRotateBase[type];

        if (!data || !conf) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        var result = [];

        for(var i = 0; i < time; i++) {
            // 奖池增加
            data.total += conf.pondIncrease;

            if (data.count >= data.dist.length) {
                dist_pond(conf, data)
            }

            var bonus = 0;
            var hit = data.dist[data.count];
            if (hit != 0) {
                // 哇塞，龟儿子运气好哦
                bonus = Math.floor(data.total * hit / 100);

                data.total -= bonus;
                if (data.total < 0) {
                    data.total = 0;
                }

                var award = clone(conf.basePond[0]);
                award[2] = bonus;

                list_add_limited(data, [2, common.getTime(), name, [award], req.args.svrId]);
            }

            data.count++;

            result.push([hit, bonus]);
        }

        resp.data.result = result;

    } while (false);
    
    onReqHandled(res, resp, 1);
}

// 记录：存抽中的道具大奖
exports.list_add = function(req, res, resp) {

    do {
        var item = req.args.item;
        var type = req.args.type;

        var data = gActLuckyRotation.data[type];

        if (!data) {
            resp.code = 1; resp.desc = 'type error'; break;
        }

        list_add_limited(data, item);

    } while (false);
    
    onReqHandled(res, resp, 1);
}


// ----------------------------------------------------------------------------
exports.ActLuckyRotation = ActLuckyRotation;
