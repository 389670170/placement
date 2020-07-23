var fs     = require('fs');
var util   = require('util');
var log4js = require('log4js');
var config = require(fs.existsSync('../config.js') ? '../config.js' : './config.js');

global.logger = null;
global.elogger = null;
global.tlogger = null;

function getLogPath(name) {
    if (config.LogDir) {
        return util.format('%s/s%d/%s.log', config.LogDir, config.ServerId, name)
    }

    return 'log/' + name + '.log';
}

function getDateFileLogConf(name) {
    return {
        "type": "dateFile",
        "filename": getLogPath(name),
        "pattern": ".yyyyMMdd",
        "alwaysIncludePattern": false,
        "category": name,

        "layout": {
            "type": "pattern",
            "pattern": "[%d] %-5p %m",
        },
    };
}

function getHourFileLogConf(name) {
    return {
        "type": "dateFile",
        "filename": getLogPath(name),
        "pattern": ".yyyyMMddhh",
        "alwaysIncludePattern": false,
        "category": name,

        "layout": {
            "type": "pattern",
            "pattern": "[%d] %-5p %m",
        },
    };
}

function getFileLogConf(name) {
    return {
        "type": "file",
        "filename": getLogPath(name),
        "category": name,

        "layout": {
            "type": "pattern",
            "pattern": "[%d] %-5p %m",
        },
    };
}

global.setupLog = function(name) {
    try {
        if (config.LogDir) {
            fs.mkdirSync(util.format("%s/s%d", config.LogDir, config.ServerId));
        } else {
            fs.mkdirSync('log');
        }
    } catch (e) {
        if (e.code != 'EEXIST') {
            throw e;
        }
    }

    var appenders = [
        name.indexOf('game') != -1 ? getHourFileLogConf(name) : getDateFileLogConf(name),
        getDateFileLogConf(name + '_error'),
        {
            "type": 'console',
            "layout": {
                "type": "pattern",
                "pattern": "[%d] DEBUG %m",
            },
        }
    ];

    if (name.indexOf('wss') != -1) {
        appenders.push(getDateFileLogConf(name + '_trick'));
    }

    log4js.configure({
        "appenders": appenders
    });

    logger = log4js.getLogger(name);
    elogger = log4js.getLogger(name + '_error');
    if (name.indexOf('wss') != -1) {
        tlogger = log4js.getLogger(name + '_trick');
    }

    if (config.LogLevel) {
        logger.setLevel(config.LogLevel);
    } else {
        logger.setLevel('INFO');
    }
};

global.shutdownLog = function(callback) {
    log4js.shutdown(callback);
}

global.LOG = function(content) {
    logger.info(content);
};

global.DEBUG = function(content) {
    logger.debug(content);
};

global.ERROR = function(content) {
    elogger.error(content);
};

global.INFO = function(content) {
    elogger.info(content);
};

global.TRICK = function(content) {
    tlogger.info(content);
};
//日志记录
var mysql = require('mysql');

var db = null;
global.CreateLoggerDB = function(){
    db = mysql.createPool({
        connectionLimit : 1,
        host: config.LogDbHost,
        port: config.LogDbPort,
        user: config.LogDbUser,
        password: config.LogDbPwd,
        database: config.LogDbName,
        multipleStatements: true,
    });
};

var logBuf = [];

//日志存储
function WriteDB(callback) {
    var logs = logBuf;
    logBuf = [];

    var sql = '';
    var sqls = '';
    for (var i = 0; i < logs.length; i++) {
        var uid = logs[i][0];
        var sid = logs[i][2].sid;
        var type = logs[i][2].type;
        var typeName = logs[i][2].typeName;
        var level = logs[i][2].level;
        var openid = logs[i][2].openid;
        var now = new Date(logs[i][3] * 1000).format('yyyyMMddhhmmss');

        switch(logs[i][1]) {
            case 'user_cost':
            {
                var costName = logs[i][2].costName;
                var costValue = logs[i][2].costValue;
                var number = logs[i][2].number;
                var update_before = logs[i][2].update_before;
                var update_later = logs[i][2].update_later;
                sql = "INSERT INTO cost_log VALUES (NULL," + sid + ",'" + openid + "','" + uid + "'," + level + ",'" + type + "','" + typeName + "','" + costName + "'," + costValue + ","+ number + "," + now + ","+update_before+","+update_later+");";
                sqls += sql;
            }
                break;
            case 'add_bag':
                    {
                        var costName = logs[i][2].costName;
                        var costValue = logs[i][2].costValue;
                        var update_before = logs[i][2].update_before;
                        var update_later = logs[i][2].update_later;
                        var material_id = logs[i][2].material_id;
                        sql = "INSERT INTO cost_prop_log VALUES (NULL," + sid + ",'" + openid + "','" + uid + "'," + level + ",'" + type + "','" + material_id + "','" + costName + "'," + costValue + "," + now + ","+update_before+","+update_later+");";
                        sqls += sql;
                    }
                    break;
            case 'user_levelup':
            {
                sql = "INSERT INTO level_log VALUES (NULL, " + sid + ",'" + openid + "','" + uid + "'," + level + ",'" + now + "');";
                sqls += sql;
            }
                break;
            case 'user_pay':
            {

                var amount = logs[i][2].amount;
                var order = logs[i][2].order;
                var chargeId = logs[i][2].chargeId;
                var gift_key = logs[i][2].gift_key;
                var gift_id = logs[i][2].gift_id;
                var platform = logs[i][2].platform;
                var device_id = logs[i][2].device_id;
                sql = "INSERT INTO credit_log VALUES (NULL, " +  sid + ",'" + openid + "','" + uid + "'," + level + "," +amount+",'"+order+"',"+chargeId+",'"+gift_key+"',"+gift_id+",'"+platform+"',"+ now + ",'"+device_id+"');";
                sqls += sql;
            }
                break;
            case 'user_play':
            {


                var success = logs[i][2].success == 1 ? 1 : 2;
                // sql = "INSERT INTO play_log VALUES (NULL, " + sid + ",'" + openid + "','" + uid + "'," + level + ",'" + type + "','" + name + "', 0, 0, '" + now + "');";
                // sqls += sql;

                sql = "INSERT INTO play_log VALUES (NULL, " + sid + ",'" + openid + "','" + uid + "'," + level + ",'" + type + "','" + typeName + "'," + success + ", 0, " + now + ");";
                sqls += sql;
            }
                break;
            case 'user_online':
            {
                sql = "INSERT INTO online_log  VALUES (NULL,"  + sid + ",'" + openid + "'," + now + ");";
                sqls += sql;
            }
                break;
            case 'user_scene':
            {
                var time = logs[i][2].time;
                sql = "INSERT INTO enter_scene_log VALUES (NULL, " + sid + ",'" + openid + "','" + uid + "'," + level + "," + type + "," + time + "," + now + ");";
                sqls += sql;
            }
                break;
            case 'user_logout':
            {
                var online_time = logs[i][2].online_time;
                var ip = logs[i][2].ip;
                var device_id = logs[i][2].device_id;
                sql = "INSERT INTO enter_dist_log VALUES (NULL, " + sid + ",'" + openid + "', 0," + online_time + ",'" + now + "','"+device_id+"');";
                sqls += sql;

                // sql = "INSERT INTO union_public_log.account_login_log VALUES (NULL," + openid + "', 0," + online_time + ",'" + ip + "','" + now + "');";
                // sqls += sql;
            }
                break;
            case 'user_login':
            {
                var device_id = logs[i][2].device_id;
                sql = "INSERT INTO enter_dist_log VALUES (NULL, " + sid + ",'" + openid + "', 1, 0,'" + now + "','"+device_id+"');";
                sqls += sql;
            }
                break;

            // 日常完成
            case 'daily_task_count':
            {
                var device_id = logs[i][2].device_id;
                var platform = logs[i][2].platform;
                sql = `INSERT INTO device_active VALUES (NULL,  '${device_id}', '${openid}', '${uid}', ${sid}, '${platform}',  ${now} );`;
                sqls += sql;
            }
            break;

            default:
                break;
        }
    }
    if (!db) {
        CreateLoggerDB();
    }

    db && db.query(sqls, function(error, results, fields) {
        if (error) {
            ERROR(util.format('LogCollect ERROR: %j', {
                code: error.code,
                sql: error.sql,
            }));
            callback && callback(false);
        } else {
            callback && callback(true);
        }
    });


}

//日志收集
var timer = undefined;
global.LogCollect = function(uid, act, args) {
  
    logBuf.push([uid, act, args, common.getTime()]);
    if (logBuf.length >= 100) {
        clearTimeout(timer);
        timer = undefined;
        WriteDB();
    } else if (!timer){
        timer = setTimeout(function() {
            WriteDB();
            timer = undefined;
        }, 5 * 60 * 1000);
    }
};

global.SaveLog = function(callback) {
    if (logBuf.length > 0) {
        WriteDB(function (err){
            callback && callback();
        });
    } else {
        callback && callback();
    }
};


Date.prototype.Format = function(fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}


function updateDeviceInfo(player, act, args,device_info){
    var sql = '';
    switch(act){
        case 'guide_city': {
            if(device_info.guide_city.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET guide_city='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'guide_dragon': {
            if(device_info.guide_dragon.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET guide_dragon='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'guide_help': {
            if(device_info.guide_help.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET guide_help='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'guide_arena': {
            if(device_info.guide_arena.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET guide_arena='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'guide_create': {
            if(device_info.create_name.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET create_name='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'guide_first': {
            if(device_info.into_city.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET into_city='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;

        }
        case 'device_login':{
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET login_date='"+today+"' where device_id = '"+device_info.device_id+"';";
            break;
        }
        case 'first_pay':{
            if(device_info.first_pay_time.getFullYear() != 1111){
                return;
            }
            var today = (new Date()).Format("yyyy-MM-dd");
            sql = "UPDATE device_info SET first_pay_time='"+today+"' ,first_pay = "+args.first_pay+" where device_id = '"+device_info.device_id+"';";
            break;
        }
    }

    if (!db) {
        CreateLoggerDB();
    }

    db && db.query(sql, function(error, results, fields) {
        if (error) {
            ERROR(util.format('LogCollect ERROR: %j', {
                code: error.code,
                sql: error.sql,
            }));
        }
    });
}
function checkdeviceid_openid_uid(player,args){

    var sql = "select * from deviceid_openid_uid where device_id =  '"+player.user.info.device_id+"' and open_id = '"+player.user.info.account+"'"+" and uid = '"+player.user._id+"' and sid = "+config.DistId+";";
    db && db.query(sql, function(error, results, fields) {
        if (error) {
            ERROR(util.format('LogCollect ERROR: %j', {
                code: error.code,
                sql: error.sql,
            }));
           
        } else {
            if(results.length ==0 ){ //如果没有设备的信息，那么就新创建一个
                var createDate  = (new Date(player.user.info.create*1000)).Format("yyyy-MM-dd");
                sql = "INSERT INTO `deviceid_openid_uid` VALUES (null, '"+player.user.info.device_id+"', '"+player.user.info.account+"', '"+player.user._id+"', '"+config.DistId+"', '"+player.user.info.platform+"','"+createDate+"');";
                db && db.query(sql, function(error, results, fields) {
                    if (error) {
                        ERROR(util.format('LogCollect ERROR: %j', {
                            code: error.code,
                            sql: error.sql,
                        }));
                    }});
            }}});

}

    //设备日志收集
global.DeviceLogCollect = function(player, act, args,state) {//state 是怕玩家设备数据查不进去，然后进入递归了


    if (!db) {
        CreateLoggerDB();
    }
    //先查询出设备的信息
    var sql = "select * from device_info where device_id =  '"+player.user.info.device_id+"'";
    db && db.query(sql, function(error, results, fields) {
        if (error) {
            ERROR(util.format('LogCollect ERROR: %j', {
                code: error.code,
                sql: error.sql,
            }));
           
        } else {
            if(results.length ==0 && !state){ //如果没有设备的信息，那么就新创建一个

                 var sql = "select * from deviceid_openid_uid where open_id = '"+player.user.info.account+"'";
                 db && db.query(sql, function(error, opneid_results, fields) {
                    if (error) {
                        ERROR(util.format('LogCollect ERROR: %j', {
                            code: error.code,
                            sql: error.sql,
                        }));
                       
                    } else {
                        if(opneid_results.length ==0){

                            var today = (new Date()).Format("yyyy-MM-dd");
                            var device_type = 0;
                            if(player.user.info.device_type == 'ios'){
                                device_type =2;
                            }else if(player.user.info.device_type == 'android'){
                                device_type =1;
                            }

                            var createDate  = (new Date(player.user.info.create*1000)).Format("yyyy-MM-dd");
                            var default_date = "1111-11-11";
                            var sqls = '';
                            sql =  " INSERT INTO `device_info` VALUES (null, '"+player.user.info.device_id+"', '"+createDate+"', '"+today+"', '0', "+device_type+", '"+player.user.info.platform+"', '0', '"+default_date+"', '"+default_date+"', '"+default_date+"', '"+default_date+"', '"+default_date+"', '"+default_date+"', '"+default_date+"', '"+default_date+"') ;";
                            sqls += sql;
                            sql = "INSERT INTO `deviceid_openid_uid` VALUES (null, '"+player.user.info.device_id+"', '"+player.user.info.account+"', '"+player.user._id+"', '"+config.DistId+"', '"+player.user.info.platform+"','"+createDate+"');";
                            sqls += sql;
            
                            db && db.query(sqls, function(error, results, fields) {
                                if (error) {
                                    ERROR(util.format('LogCollect ERROR: %j', {
                                        code: error.code,
                                        sql: error.sql,
                                    }));
                                } else {
                                    DeviceLogCollect(player, act, args,true);
                                }
                            });
                        }else if(opneid_results.length > 0){//如果玩家账号之前在其他设备上登陆过， 那么这个账号 还是算之前设备的账号
                            var openid_device_info = opneid_results[0];
                            player.user.info.device_id = openid_device_info.device_id;
                            player.markDirty('info.device_id');
                            DeviceLogCollect(player, act, args,true);
                        }
                    }});

            }else if(results.length >0){//如果有设备信息就拿设备信息判断并做修改
                var device_info = results[0];
                updateDeviceInfo(player, act, args,device_info);
                checkdeviceid_openid_uid(player,args);
            }
           
        }
    });
};

// 记录GM操作日志
global.GMLogCollect = function(ip, uid, args) {
    if (!db) {
        CreateLoggerDB();
    }

    var now = (new Date()).Format("yyyy-MM-dd hh:mm:ss");
    var sql = `INSERT INTO gm_log VALUES (NULL, '${ip}', ${config.ServerId}, '${uid}', '${args}', '${now}');`

    db && db.query(sql, function(error, results, fields) {
        if (error) {
            ERROR(util.format('LogCollect ERROR: %j', {
                code: error.code,
                sql: error.sql,
            }));
        }
    })
};