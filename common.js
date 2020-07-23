var crypto = require('crypto');
var util = require('util');

Object.isEmpty = function (obj) {
    var empty = true;
    for (var key in obj) {
        empty = false;
        break;
    }
    return empty;
};

/** 差集       arr1.diff(arr2); */
Array.prototype.diff = function (array) {
    if (!array || !array.length) return this;
    return this.filter(function (value) {
        return array.indexOf(value) < 0;
    })
};

/** 返回满足要求的数组  一般用于判断可以领取哪些奖励    arr.factor(term)    term */
Array.prototype.factor = function (term) {
    if (!term || isNaN(term)) return this;
    return this.filter(function (value) {
        return term >= value;
    })
};

Array.prototype.sum = function () {
    var total = 0;
    for (var i = 0; i < this.length; i++) {
        if (!isNaN(this[i])) {
            total += +this[i];
        }
    }

    return total;
}

Array.prototype.remove = function (item) {
    var index = this.indexOf(item);
    if (index >= 0) {
        this.splice(index, 1);
    }
    return this;
};

Array.prototype.combine = function (another) {
    for (var i = 0, len = another.length; i < len; i++) {
        this.push(another[i]);
    }
}

Array.prototype.shuffle = function () {
    return this.sort(function () { return Math.random() - 0.5; });
}

Array.prototype.max = function () {
    return Math.max.apply(null, this);
};

Array.prototype.contains = function (obj) {
    var i = this.length;
    while (i--) {
        if (this[i] == obj) {
            return true;
        }
    }

    return false;
};

Array.prototype.min = function () {
    return Math.min.apply(null, this);
};

String.prototype.startWith = function (prefix) {
    if (!prefix || !this.length || this[0] != prefix[0]) return false;
    return (this.substr(0, prefix.length) == prefix);
}

String.prototype.beginWith = function (suffix) {
    if (!suffix || !this.length || suffix.length > this.length) return false;
    return (this.substr(0, suffix.length) == suffix);
}

String.prototype.endWith = function (suffix) {
    if (!suffix || !this.length || suffix.length > this.length) return false;
    return (this.substr(this.length - suffix.length) == suffix);
}

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{(\d+)\}/g, function (m, i) {
        return args[i];
    });
}

String.prototype.capWord = function () {
    return this.substr(0, 1).toUpperCase() + this.substr(1);
}

String.prototype.isASCII = function (index) {
    if (!this.charAt(index)) return false;

    return this.charCodeAt(index) <= 256;
}

String.prototype.isChineseWord = function (index) {
    if (!this.charAt(index)) return false;
    var charCode = this.charCodeAt(index);

    if (config.platform == 'korea') {
        return charCode >= 0xAC00 && charCode <= 0xD7AF;
    }

    return charCode >= 0x4e00 && charCode <= 0x9fbb;
}

String.prototype.isDigit = function (index) {
    if (!this.charAt(index)) return false;
    var charCode = this.charCodeAt(index);

    return charCode >= 48 && charCode <= 57;
}

String.prototype.isEnglishWord = function (index) {
    if (!this.charAt(index)) return false;
    var charCode = this.charCodeAt(index);

    return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);
}

/** 将时间转换为文本描述 */
Date.prototype.format = function (fmt) {
    var o = {
        'M+': this.getMonth() + 1,                 //月份
        'd+': this.getDate(),                    //日
        'h+': this.getHours(),                   //小时
        'm+': this.getMinutes(),                 //分
        's+': this.getSeconds(),                 //秒
        'q+': Math.floor((this.getMonth() + 3) / 3), //季度
        'S': this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ?
                (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        }
    }
    return fmt;
};

/** 获取当前时间的文本描述 yyyy-MM-dd hh:mm:ss */
Date.prototype.stdFormatedString = function () {
    return this.format('yyyy-MM-dd hh:mm:ss');
};
Date.stdFormatedString = function () {
    return (new Date()).stdFormatedString();
};

/** 获取时间戳 单位为秒 */
Date.prototype.getStamp = function () {
    return Math.floor(this.getTime() / 1000);
};
/** 获取时间戳 单位为秒 */
Date.getStamp = function () {
    return (new Date()).getStamp();
};

/** 获取是星期几 星期日为7 */
Date.prototype.getWeekDay = function () {
    var weekDay = this.getDay();
    if (weekDay == 0) {
        weekDay = 7;
    }
    return weekDay;
};
/** 获取是星期几 星期日为7 */
Date.getWeekDay = function () {
    return (new Date()).getWeekDay();
};

/** 获取0点的时间信息 Date对象 */
Date.prototype.zeroTime = function () {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate());
};
/** 获取0点的时间信息 Date对象 */
Date.zeroTime = function () {
    return (new Date()).zeroTime();
};

/** 星期一的0点的时间对象 */
Date.prototype.zeroWeek = function () {
    var dayMinus = this.getDay();
    if (dayMinus != 0) {
        dayMinus -= 1;
    } else {
        dayMinus = 6;
    }
    var firstWeekDay = (new Date(this - dayMinus * 86400000)).zeroTime();
    return firstWeekDay;
};
/** 星期一的0点的时间对象 */
Date.zeroWeek = function () {
    return (new Date()).zeroWeek();
};

global.List = function (obj) {
    this.obj = obj;
    this.next = null;
};

global.RankTree = require('./common/ranktree.js').RankTree;
global.TopList = require('./common/toplist').TopList;

/**
 * 获取day对应的秒数
 * @param {*} day 对应的日期 common.getDate() 20200412
 * @return  对应的日期返回对应的0点的秒数 
 *          默认值为返回当前的秒数
 */
function getTime(day) {
    if (day) {
        var year = Math.floor(day / 10000);
        var month = Math.floor((day % 10000) / 100);
        var dy = Math.floor(day % 100);

        return Math.floor((Date.parse('' + year + '/' + month + '/' + dy)) / 1000);
    }

    return Math.round(+(new Date()) / 1000);
}

/**
 * 获取time对应的日期描述 20200412
 * @param {*} time 对应的秒数 common.getTime() 默认为当前
 * @return  20200412
 *          time对应的天数
 *          默认值为是低昂前对应的秒数
 */
function getDate(time) {
    var theTime = null;
    if (!time) {
        theTime = new Date();
    } else {
        theTime = new Date(time * 1000);
    }

    return theTime.getFullYear() * 10000 + (theTime.getMonth() + 1) * 100 + theTime.getDate();
}

/**
 * 返回当前日期的字符串,eg:"2013/01/01"
 * @param {*} time 对应的秒数 common.getTime() 默认为当前
 */
function getDateString(time) {
    if (!time) {
        return (new Date()).format('yyyy/MM/dd');
    } else {
        return (new Date(time * 1000)).format('yyyy/MM/dd');
    }
}

/**
 * 返回当前日期的字符串,eg:"2013-01-01 12:12:12"
 * @param {*} time 对应的秒数 common.getTime() 默认为当前
 */
function getDateTimeString(time) {
    if (!time) {
        return (new Date()).format('yyyy-MM-dd hh:mm:ss');
    } else {
        return (new Date(time * 1000)).format('yyyy-MM-dd hh:mm:ss');
    }
}

/**
 * 返回两个日期之间的天数, 比如20150101和20150201相差31天
 * @param {*} date1 第一个日期 common.getDate() 20150101
 * @param {*} date2 第二个日期 common.getDate() 20150201
 */
function getDateDiff(date1, date2) {
    var y1 = Math.floor(date1 / 10000);
    var m1 = Math.floor((date1 - y1 * 10000) / 100);
    var d1 = Math.floor(date1 % 100);

    var y2 = Math.floor(date2 / 10000);
    var m2 = Math.floor((date2 - y2 * 10000) / 100);
    var d2 = Math.floor(date2 % 100);

    return getDateStringDiff(util.format('%d/%d/%d', y1, m1, d1), util.format('%d/%d/%d', y2, m2, d2));
}

/**
 * 返回两个日期"2013-01-01"00时00秒之间的天数
 * @param {*} date1 第一个日期 2015-01-01 或 2015/01/01
 * @param {*} date2 第二个日期 2015-02-01 或 2015/02/01
 */
function getDateStringDiff(date1, date2) {
    var dateTime1 = Math.floor(Date.parse(date1));
    var dateTime2 = Math.floor(Date.parse(date2));
    return Math.abs(Math.floor((dateTime2 - dateTime1) / 86400000));
}

/**
 * 返回两个日期之间的天数, 比如20150101和20150201相差31天
 * @param {*} date1 第一个日期 common.getDate() 20150101
 * @param {*} date2 第二个日期 common.getDate() 20150201
 * 之前取两个日期之间返回的差值是取的绝对值，这个函数返回的如果两个日期之间差为负数就返回 1
 */
function getDateDiff2(date1, date2) {
    var y1 = Math.floor(date1 / 10000);
    var m1 = Math.floor((date1 - y1 * 10000) / 100);
    var d1 = Math.floor(date1 % 100);

    var y2 = Math.floor(date2 / 10000);
    var m2 = Math.floor((date2 - y2 * 10000) / 100);
    var d2 = Math.floor(date2 % 100);

    return getDateStringDiff2(util.format('%d/%d/%d', y1, m1, d1), util.format('%d/%d/%d', y2, m2, d2));
}

/**
 * 返回两个日期"2013-01-01"00时00秒之间的天数
 * @param {*} date1 第一个日期 
 * @param {*} date2 第二个日期 
 */
function getDateStringDiff2(date1, date2) {
    var dateTime1 = Math.floor(Date.parse(date1));
    var dateTime2 = Math.floor(Date.parse(date2));
    var num = Math.floor((dateTime2 - dateTime1) / 86400000);
    num = num > 0 ? num : 1;
    return num;
}

/**
 * 获取距离某个时间点的日期
 * @param {*} time1 目标时间秒数 common.getDate()
 * @param {*} time2 时间秒数 common.getDate()
 */
function getDayDiffFromTime(time1, time2) {
    var date1 = new Date(time1 * 1000);
    date1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(), 0, 0, 0);

    var date2 = new Date(time2 * 1000);
    date2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate(), 0, 0, 0);

    return Math.floor((date1 - date2) / 86400000);
}

function wRand(weights, useSeed) {
    var total = 0;
    for (var key in weights) {
        total += weights[key];
    }

    var rand = 0;
    if (useSeed) {
        rand = seededRandom(0, total);
    } else {
        rand = Math.random() * total;
    }

    var offset = 0;
    var keys = Object.keys(weights).sort(function (a, b) { return a - b; });
    for (var i = 0, len = keys.length; i < len; i++) {
        offset += weights[keys[i]];
        if (rand < offset) {
            return keys[i];
        }
    }

    return null;
}

// [from, to]
function randRange(from, to, useSeed) {
    if (useSeed) {
        return from + Math.floor(rawSeededRandom() * (to - from + 1));
    } else {
        return from + Math.floor(Math.random() * (to - from + 1));
    }
}


function randArray(arr, useSeed) {
    return arr[randRange(0, arr.length - 1, useSeed)];
}

function randArrayWithNum(arr, num) {
    var myarr = clone(arr);
    if (num >= myarr.length) {
        return myarr;
    }
    var randValues = [];
    for (var i = 0, max = Math.min(myarr.length, num); i < max; ++i) {
        var value = randArray(myarr);
        randValues.push(value);
        myarr.remove(value);
    }

    return randValues;
}

var authKey = 'Keep it simple stupid';
function genAuth(uid) {
    var now = getTime();
    var rawKey = uid + '-' + now;
    var key = sha1(rawKey).substring(0, 10);
    return { 'key': key, 'time': now };
}

function verifyAuth(uid, key, time) {
    var now = getTime();
    var rawKey = uid + '-' + time;
    if (key != sha1(rawKey).substring(0, 10)) {
        return false;
    }

    // 当前时间小于登录时间
    if (now < time) {
        return false;
    }

    return true;
}

function verifyGatewayAuth(openid, opentime, key) {
    var now = getTime();
    // if (opentime < now - 300 || opentime > now + 300) {          // 当多组服务器使用同一台jump服并且时区不同时 会造成玩家无法登陆 这里先屏蔽掉
    //     return false;
    // }

    var md5 = crypto.createHmac('sha1', authKey);
    return key == md5.update(openid + opentime, 'utf8').digest('hex').substring(0, 10);
}

function verifyHack(seq, stime, sig, args) {
    var first = Math.floor(stime / 100000)
    var second = Math.floor(stime % 100000);
    return sig == md5("" + ((second * first + stime) % second + seq) + args);
}

function genHack(seq, stime, args) {
    var first = Math.floor(stime / 100000);
    var second = Math.floor(stime % 100000);
    return md5("" + ((second * first + stime) % second + seq) + JSON.stringify(args));
}

function getTodaySecondsByHour(hour) {
    var today = new Date();
    var todayZero = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0) / 1000);
    var updateTime = todayZero + 3600 * hour;

    return updateTime;
}

/**
 * 获取用户创建时所在的服数  FIXME 机器人暂定为1服
 * @param {*} uid 
 */
function getServerId(uid) {
    if (uid < 100000) {
        return 1;
    }
    return parseInt((+uid) / 1000000);
}

var randSeed = getTime();
function seed(value) {
    randSeed = value;
}

function rawSeededRandom() {
    randSeed = (randSeed * 9301 + 49297) % 233280;
    return randSeed / 233280.0;
}

function seededRandom(min, max) {
    return min + Math.floor(rawSeededRandom() * (max - min));
}

function srandom(seedValue, min, max, times) {
    randSeed = seedValue;
    var arr = [];
    for (var i = 0; i < times; i++) {
        arr.push(seededRandom(min, max));
    }
    return arr;
}

function md5(string) {
    return crypto.createHash('md5').update(string).digest('hex').toLowerCase();
}

function sha1(string) {
    return crypto.createHash('sha1').update(string).digest('hex').toLowerCase();
}

function isLocalAddr(addr) {
    var segs = addr.split(':');
    var ip4Addr = segs[segs.length - 1];
    var segs = ip4Addr.split('.');
    if (+segs[0] == 10) {
        // A类 10.0.0.0 - 10.255.255.255
        return true;
    } else if (+segs[0] == 172 && +segs[1] >= 16 && +segs[1] <= 31) {
        // B类 172.16.0.0 - 172.31.255.255
        return true;
    } else if (+segs[0] == 192 && +segs[1] == 168) {
        // C类 192.168.0.0 - 192.168.255.255
        return true;
    } else if (+segs[0] == 127) {
        // 本地回环
        return true;
    }

    return false;
}

/**
 * 主键是level的配置表
 * @param conf
 * @param level
 */
function judgeLevel(conf, level) {
    var result = 0;
    var levelArr = [];
    for (var i in conf) {
        levelArr.push(i);
    }

    if (level > levelArr[levelArr.length - 1]) {
        result = levelArr[levelArr.length - 1];
    } else {
        for (var i = 0, len = levelArr.length; i < len; i++) {
            if (level >= levelArr[i] && level < levelArr[i + 1]) {
                result = levelArr[i];
                break;
            }
        }
    }

    return result;
}


function Loader(onAllLoad) {
    this.tasks = [];
    this.onAllLoad = onAllLoad;
}

Loader.prototype = {
    addLoad: function (task) {
        this.tasks.push(task);
    },

    onLoad: function (task) {
        var index = this.tasks.indexOf(task);
        if (index >= 0) {
            this.tasks.splice(index, 1);
            if (this.tasks.length == 0) {
                this.onAllLoad && this.onAllLoad();
            }
        }
    },
};

global.getClientIp = function (req) {
    return req.headers['x-forwarded-for']
        || req.connection.remoteAddress
        || req.socket.remoteAddress
        || (req.connection.socket && req.connection.socket.remoteAddress)
        || '';
};

global.dumpObj = function (keyPath) {
    var keys = keyPath.split('.');
    var rootObj = global;

    var retObj = null;
    for (var idx = 0; idx < keys.length; ++idx) {
        var key = keys[idx];
        retObj = rootObj[key];
        if (!retObj) {
            break;
        }
    }

    return retObj;
};

exports.judgeLevel = judgeLevel;
exports.getTime = getTime;
exports.getDate = getDate;
exports.wRand = wRand;
exports.randRange = randRange;
exports.randArray = randArray;
exports.defaultHeaders = { 'Content-Type': 'text/plain;charset=utf-8' };
exports.htmlHeaders = { 'Content-Type': 'text/html;charset=utf-8' };
exports.downloadHeaders = { 'Content-Type': 'application/octet-stream' };
exports.defaultCrossDomain = '<cross-domain-policy><allow-access-from domain="*" secure="true" /></cross-domain-policy>';
exports.authKey = authKey;
exports.genAuth = genAuth;
exports.verifyAuth = verifyAuth;
exports.verifyGatewayAuth = verifyGatewayAuth;
exports.verifyHack = verifyHack;
exports.genHack = genHack;
exports.getDateString = getDateString;
exports.getDateTimeString = getDateTimeString;
exports.getDateDiff = getDateDiff;
exports.getDateDiff2 = getDateDiff2;
exports.getDateStringDiff = getDateStringDiff;
exports.getTodaySecondsByHour = getTodaySecondsByHour;
exports.Loader = Loader;
exports.randArrayWithNum = randArrayWithNum;
exports.getServerId = getServerId;
exports.getDayDiffFromTime = getDayDiffFromTime;
exports.seed = seed;
exports.seededRandom = seededRandom;
exports.srandom = srandom;
exports.md5 = md5;
exports.sha1 = sha1;
exports.isLocalAddr = isLocalAddr;
