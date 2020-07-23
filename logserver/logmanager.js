var LogType = require('./enum.js').LogType;
var moment = require('moment');

function LogManager() {
    this.LogQueue = [];
    this.ai = 1;
}

LogManager.create = function(callback){
    var logData = {
        '_id': 'logData',
        'ai' : 0,
        'time': 0,
    };

    gDBWorld.insert(logData, function(err, result) {
        callback && callback();
    });
};

LogManager.prototype = {
    init: function (callback) {
        callback && callback(true);
    },

    update : function () {
        this.save();
    },

    save : function (callback) {
        for (var i = 0; i < this.LogQueue.length; i++) {
            if (this.LogQueue[i] && gDBArray[i] && this.LogQueue[i].length > 0) {
                for (var j = 0; j < this.LogQueue[i].length; j++) {
                    gDBArray[i].insert(this.LogQueue[i], function(err, result) {
                        callback && callback();
                    });
                }

                this.LogQueue[i] = [];
                DEBUG('log manager save ' + i);
            }
        }

        callback && callback(true);
    },

    insertLog : function (type, args) {
        if (!this.LogQueue[type]) {
            this.LogQueue[type] = [];
        }

        var time = moment().format('YYYY-MM-DD HH:mm:ss')
        args.time = time;

        this.LogQueue[type].push(args);
    },
}

exports.log = function (req, res, resp) {
    do {
        var logType = req.type;
        if (!logType) {
            resp.code = 1; resp.desc = 'log type is invalid'; break;
        }

        DEBUG('logmaneger log, type = ' + logType);
        DEBUG(req.args);

        //gLogManager.insertLog(logType, req.args);
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.LogManager = LogManager