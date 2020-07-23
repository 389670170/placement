var fs = require('fs');
var config  = require(fs.existsSync('../config.js') ? '../config.js' : './config.js');
var spliter = '\t';

function parseDate(strDate){
    // 2013:8:7:14:0:0
    if( typeof(strDate) != 'string' ) {
        return 0;
    }

    var segs = strDate.split(':');
    if( 6 == segs.length ) {
        var date = new Date(segs[0], +segs[1]-1, segs[2], segs[3], segs[4], segs[5]);
        return Math.floor(date.getTime()/1000);
    }else{
        ERROR('parseDate invalid date:'+strDate);
    }

    return 0;
}

// 将对象obj的键排序后返回(数组)
var sortKeys = function(obj, isAscend) {
    var keys = Object.keys(obj);
    keys.sort(function(a, b) {
        if (!isNaN(a) && !isNaN(b)) {
            a = +a;
            b = +b;
        }

        return isAscend ? (a > b) : (a < b);
    });

    return keys;
}

function CommonCSV(name, indexs) {
    var rawData = fs.readFileSync(name, 'utf8');
    rawData = rawData.replace(/\t*\r*\n/g, '\n');

    indexs = indexs || [];

    var rows = rawData.split('\n');
    var columns = rows[1].split(spliter);
    for (var j = 0; j < columns.length; j++) {
        columns[j] = columns[j].trim();
    }
    var types = rows[2].split(spliter);
    if(types.length != columns.length) {
        ERROR('invalid csv type');
        return;
    }

    for (var i = 3; i < rows.length; i++) {
        if (rows[i].trim().length == 0) {
            continue;
        }

        var cols = rows[i].split(spliter);
        if (cols.length != columns.length) {
            ERROR('invalid csv ' + name + ' at line: ' + i);
            continue;
        }

        var obj = {};
        for (var j = 0; j < cols.length; j++) {
            var column = columns[j];
            var value = cols[j].trim();
            if(types[j] == 'Award') {
                var awards = value.split(',');
                value = [];
                for(var k = 0; k < awards.length; k++) {
                    var award = awards[k];
                    award = award.trim();
                    var segs = award.split(':');
                    if (2 == segs.length) {
                        award = segs[0].split('.');
                        award.push(+segs[1]);
                        value.push(award);
                    } else {
                        value = [];
                    }
                }
            } else if (types[j] == 'Time') {
                if (value) {
                    value = parseDate(value);
                }
            } else if (/^Int\d*$/.test(types[j]) && !isNaN(value)) {
                value = +(value);
            } else if (types[j] == 'Ints') {
                if (value != "" && value != 'nil') {
                    value = value.split('|');
                    for(var k = 0; k < value.length; k++) {
                        value[k] = +value[k];
                    }
                } else {
                    value = [];
                }
            } else if (types[j] == 'Strings') {
                if (value != "" && value != '0') {
                    value = value.split('|');
                    for(var k = 0; k < value.length; k++) {
                        value[k] = value[k];
                    }
                } else {
                    value = [];
                }
            } else if (types[j] != 'String' && types[j] != 'Chinese') {
                continue;
            }

            if (!isNaN(value) && types[j] != 'Ints' && types[j] != 'Award') {
                value = +value;
            }

            if (value == NaN) {
                ERROR('invalid csv ' + name + ' at ' + i + ':' + j);
            }

            obj[column] = value;
        }
        var data = this;
        for (var k = 0; k < indexs.length - 1; k++) {
            var index = indexs[k];
            if (!(obj[index] in data)) {
                data[obj[index]] = {};
            }
            data = data[obj[index]];
        }

        var lastIndex = indexs[indexs.length - 1];
        data[obj[lastIndex]] = obj;
    }
}

function GlobalCSV(name) {
    var rawData = fs.readFileSync(name, 'utf8');

    var rows = rawData.split('\n');
    for (var i = 3; i < rows.length; i++) {
        if (rows[i].trim().length == 0) {
            continue;
        }
        var cols = rows[i].split(spliter);
        if (cols.length != 3) {
            ERROR('CommonCSVinvalid global csv ' + name + ' at ' + i);
            continue;
        }
        var key = cols[0];
        var value = cols[1].trim();

        if (!isNaN(value)) {
            value = +value;
        }

        // 装备初始宝石配置 gid1:gid2
        if (key.endWith('GemSlot')) {
            value = value.split(':');
            for (var j = 0; j < value.length; j++) {
                value[j] = +value[j];
            }
        }

        this[key] = value;
    }
}

exports.parseDate = parseDate;
exports.CommonCSV = CommonCSV;
exports.GlobalCSV = GlobalCSV;
