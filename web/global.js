gConf = {
};

var confIdx = {
    'user': ['id'],
    'hero': ['id'],
    'gem': ['id'],
    'recharge': ['id'],
    'mail': ['id'],
    'localtext': ['id'],
    'treasure': ['id', 'active'],
    'city': ['id'],
    'item': ['id'],
    'equipconf': ['id'],
    'equipbase': ['type', 'quality'],
    'dress': ['id'],
    'log': ['mod', 'act'],
    'playerskill': ['id'],
    'dragongem': ['id'],
    'dragonlevel': ['level'],
    'skychange': ['type', 'id'],
    'runeconf': ['id'],
    'combatherotemplate': ['id'],
    'generaltext': ['key'],
    'custom': ['id'],
    'dragon': ['id'],
    'giftmail': ['pid'],
}

var gQuality = {
    '1': '白',
    '2': '绿',
    '3': '蓝',
    '4': '紫',
    '5': '橙',
    '6': '红',
    '7': '金',
};

var gAbility = {
    '1': '物理',
    '2': '法术',
    '3': '防御',
    '4': '辅助',
};

var gCamp = {
    '1': '魏',
    '2': '蜀',
    '3': '吴',
    '4': '群雄',
    '5': '主角',
};

function loadConf(names, callback) {
    var confCount = names.length;
    function onConfLoad() {
        if (--confCount == 0) {
            callback && callback();
        }
    }

    for (var i = 0; i < names.length; i++) {
        _loadConf(names[i], confIdx[names[i]], onConfLoad);
    }
}

function _loadConf(name, indexes, callback) {
    if (gConf[name]) {
        callback && callback();
        return;
    }

    var fullname = "conf/" + name + ".dat";
    if (name == 'generaltext') {
        fullname = "conf/language/simplifiedchinese/" + name + ".dat";
    }

    $.get(fullname, {}, function (rawData, textStatus) {
        rawData = rawData.replace(/\t*\r*\n/g, '\n');

        indexes = indexes || [];

        var rows = rawData.split('\n');
        var columns = rows[1].split('\t');
        for (var j = 0; j < columns.length; j++) {
            columns[j] = columns[j].trim();
        }
        var types = rows[2].split('\t');

        var csvData = {};
        for (var i = 3; i < rows.length; i++) {
            if (rows[i].trim().length == 0) {
                continue;
            }

            var cols = rows[i].split('\t');

            var obj = {};
            for (var j = 0; j < cols.length; j++) {
                var column = columns[j];
                var value = cols[j].trim();
                if (types[j] == 'Award') {
                    var awards = value.split(',');
                    value = [];
                    for (var k = 0; k < awards.length; k++) {
                        var award = awards[k];
                        award = award.trim();
                        var segs = award.split(':');
                        if (2 == segs.length) {
                            award = segs[0].split('.');
                            award.push(+segs[1]);
                            value.push(award);
                        } else {
                            value = null;
                        }
                    }
                } else if (types[j] == 'Time') {
                    var segs = value.split(':');
                    if (6 == segs.length) {
                        // 获取活动开始和结束的时间(秒)
                        value = Math.floor((new Date(segs[0], +segs[1] - 1, segs[2], segs[3], segs[4], segs[5])).getTime() / 1000);
                    }
                } else if (/^Int\d*$/.test(types[j]) && !isNaN(value)) {
                    value = +(value);
                } else if (types[j] == 'Ints') {
                    value = value.split('|');
                    for (var k = 0; k < value.length; k++) {
                        value[k] = +value[k];
                    }
                } else if (types[j] != 'String' && types[j] != 'Chinese' && types[j] != 'Strings') {
                    continue;
                }
                if (!isNaN(value) && types[j] != 'Ints') {
                    value = +value;
                }
                obj[column] = value;
            }
            var data = csvData;
            for (var k = 0; k < indexes.length - 1; k++) {
                var index = indexes[k];
                if (!(obj[index] in data)) {
                    data[obj[index]] = {};
                }
                data = data[obj[index]];
            }

            var lastIndex = indexes[indexes.length - 1];
            data[obj[lastIndex]] = obj;
        }

        gConf[name] = csvData;

        callback && callback();
    });
}

// 将奖励变为可读
function hawards(awards, req) {
    if (awards && !awards.length && awards.length != 0) {
        return '无法解析:' + JSON.stringify(awards);
    }
    if (!awards || awards.length == 0) {
        return "无";
    }

    var res = "";
    for (var i = 0; i < awards.length; i++) {
        var award = awards[i];
        var type = award[0];
        if (res != "") {
            res += ", ";
        }
        if (type == 'equip') {
            if (req) {
                var id = award[1];
                var god = award[2];
                var num = award[3];
            } else {
                var equip = award[1];
                var num = award[2];
                var god = equip.god_id;
                var id = equip.id;
            }

            if (god == 0) {
                res += "普通";
            } else if (god == 3) {
                res += "混合属性神器";
            } else {
                res += "单一属性神器";
            }

            if (gConf.equipconf[id]) {
                res += gQuality[gConf.equipconf[id].quality] + "色" + gConf.generaltext[gConf.equipconf[id].name].text + num + "件";
            }
        } else if (type == 'user') {
            var id = award[1];
            var num = award[2];
            res += gConf.generaltext[gConf.user[id].name].text + num + "个";
        } else if (type == 'card') {
            var id = award[1];
            var num = award[2];
            res += gConf.generaltext[gConf.hero[id].heroName].text + "卡牌" + num + "张";
        } else if (type == 'material' || type == 'fragment') {
            var id = award[1];
            var num = award[2];
            if (gConf.item[id]) {
                res += gConf.generaltext[gConf.item[id].name].text + num + "个";
            }
        } else if (type == 'gem') {
            var id = award[1];
            var num = award[2];
            res += gConf.generaltext[gConf.gem[id].name].text + num + "个";
        } else if (type == 'dress') {
            var id = award[1];
            var num = award[2];
            res += gConf.generaltext[gConf.dress[id].name].text + num + "个";
        } else if (type == 'skyweapon') {
            var id = award[1];
            var num = award[3];
            res += gConf.generaltext[gConf.skychange[1][id].name].text + num + "个";
        } else if (type == 'skywing') {
            var id = award[1];
            var num = award[3];
            res += gConf.generaltext[gConf.skychange[2][id].name].text + num + "个";
        } else if (type == 'rune') {
            var id = award[1];
            var num = award[2];
            res += gConf.generaltext[gConf.runeconf[id].name].text + num + "个";
        } else {
            res += type;
            for (var i = 1; i < award.length - 1; i++) {
                res += "." + award[i];
            }
            res += ":" + award[award.length - 1];
        }
    }
    return res;
}

function setKeyboardEvent(escCb, enterCb, delCb) {
    document.onkeydown = function (event) {
        var e = event || window.event || arguments.callee.caller.arguments[0];
        if (e && e.keyCode == 27) { // 按 Esc
            escCb && escCb();
        }

        if (e && e.keyCode == 13) { // enter 键
            enterCb && enterCb();
        }

        if (e && e.keyCode == 46) { // enter 键
            delCb && delCb();
        }
    };
}

function formatTime(time) {
    var theTime = new Date(time * 1000);
    var value = '' + theTime.getFullYear() + '/' + (theTime.getMonth() + 1) + '/' + theTime.getDate() + ' ' + theTime.getHours() + ':' + theTime.getMinutes() + ':' + theTime.getSeconds();
    return value;
}

function getTime() {
    return Math.round(+(new Date()) / 1000);
}

function secondToTime(seconds) {
    seconds = Math.floor(seconds);
    if (seconds < 0 || isNaN(seconds)) {
        return '0:0:0';
    }

    var hour = Math.floor(seconds / 3600);
    var minute = Math.floor(seconds / 60 - hour * 60);
    var second = seconds % 60;
    return hour + ':' + minute + ':' + second;
}

// minutes 为字符串格式, HH:mm:ss格式, 表示时长
function timeToSecond(time) {
    var segs = time.split(':');
    if (segs.length != 3) {
        return -1;
    }

    var seconds = 0;
    if (isNaN(segs[0])) {
        return -1;
    }
    seconds += Math.floor(segs[0]) * 3600;

    if (isNaN(segs[1])) {
        return -1;
    }
    seconds += Math.floor(segs[1]) * 60;

    if (isNaN(segs[0])) {
        return -1;
    }
    seconds += Math.floor(segs[2]);

    return seconds;
}

var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var base64DecodeChars = new Array(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1);

function base64encode(str) {
    var out, i, len;
    var c1, c2, c3;
    len = str.length;
    i = 0;
    out = "";
    while (i < len) {
        c1 = str.charCodeAt(i++) & 0xff;
        if (i == len) {
            out += base64EncodeChars.charAt(c1 >> 2);
            out += base64EncodeChars.charAt((c1 & 0x3) << 4);
            out += "==";
            break;
        }
        c2 = str.charCodeAt(i++);
        if (i == len) {
            out += base64EncodeChars.charAt(c1 >> 2);
            out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
            out += base64EncodeChars.charAt((c2 & 0xF) << 2);
            out += "=";
            break;
        }
        c3 = str.charCodeAt(i++);
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
        out += base64EncodeChars.charAt(c3 & 0x3F);
    }
    return out;
}

function base64decode(str) {
    var c1, c2, c3, c4;
    var i, len, out;
    len = str.length;
    i = 0;
    out = "";
    while (i < len) {
        do {
            c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
        } while (i < len && c1 == -1);
        if (c1 == -1)
            break;

        do {
            c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
        } while (i < len && c2 == -1);
        if (c2 == -1)
            break;
        out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));

        do {
            c3 = str.charCodeAt(i++) & 0xff;
            if (c3 == 61)
                return out;
            c3 = base64DecodeChars[c3];
        }
        while (i < len && c3 == -1);
        if (c3 == -1)
            break;
        out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));

        do {
            c4 = str.charCodeAt(i++) & 0xff;
            if (c4 == 61)
                return out;
            c4 = base64DecodeChars[c4];
        }
        while (i < len && c4 == -1);
        if (c4 == -1)
            break;
        out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
    }
    return out;
}

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/\{(\d+)\}/g, function (m, i) {
        return args[i];
    });
}
