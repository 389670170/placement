function SysMsg() {
    this.sysMsgData = {
        '_id' : 'sysMsgData',
        'msg':{}
        // '_id' : 'sysMsg',
        // 'msg':{},                        // 七日活动抢购
        // id: {
        //    start_time:
        //      end_time:
        //   msg:{中文，繁体，英文}
       // }                            // 子任务id: 已购买数量
    };

}

SysMsg.create = function(callback) {
    var sysMsgData = {
        '_id' : 'sysMsgData',
        'msg':{},
    };
    gDBWorld.insert(sysMsgData, function(err, result) {
        callback && callback();
    });
};

SysMsg.prototype = {
    init: function(callback) {
        gDBWorld.find({_id: 'sysMsgData'}).limit(1).next(function(err, doc) {
            if (doc) {
                this.sysMsgData = doc.sysMsgData;
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    save: function(callback) {
        gDBWorld.save({'_id': 'sysMsgData', 'msg' : this.sysMsgData}, function(err, result) {
            if (err) {
                ERROR(err);
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

};



exports.addSysMsg = function(req, res, resp) {
    do {
        console.info("给玩家推送系统消息 开始");
       var interval_content =  req.args.interval_content;
       var myVar =  setInterval(function () {
            var now = common.getTime();
            if(now > req.args.end_expire){
                clearInterval(myVar);
            }
            if(now > req.args.start_expire &&now <req.args.end_expire ){
                var array = [];
                array[0] = req.args.en_content;
                array[1] = req.args.cn_content;
                array[2] = req.args.tcn_content;
                var wssReq  = {
                    uid : 1,
                    mod : 'chat',
                    act : 'notice',
                    args : {
                    }
                };
                wssReq.args.content = array;
                requestWss(wssReq,{});
                console.info("给玩家推送系统消息");
            }
           
       }, (interval_content*60*1000));
    } while (false);
    onReqHandled(res, resp, 1);
};

exports.SysMsg = SysMsg;
