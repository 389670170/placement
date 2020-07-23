// >> 军团战通用函数

/**
 * 获取指定时间/当前时间所在的军团战阶段和场次编号
 * @param timestamp
 * @returns {{type: number, id: number}}
 */
exports.getSchedule = function() {
    var timestamp = Date.getStamp();

    for (var type in gConfLegionWarSchedule) {
        if (!gConfLegionWarSchedule.hasOwnProperty(type)) {
            continue;
        }

        var typeSchedule = gConfLegionWarSchedule[type];
        for (var id in typeSchedule) {
            if (!typeSchedule.hasOwnProperty(id)) {
                continue;
            }

            var idSchedule = typeSchedule[id];

            // 计算该阶段时间段
            var startDay = +idSchedule.startDay;
            var startHour = +idSchedule.startHour;
            var startMinite = +idSchedule.startMinite;

            var endDay = +idSchedule.endDay;
            var endHour = +idSchedule.endHour;
            var endMinite = +idSchedule.endMinite;

            var weekBegin = Date.zeroWeek().getStamp();

            var stageBegin = weekBegin + (startDay - 1) * 86400 + startHour * 3600 + startMinite * 60;
            var stageEnd = weekBegin + (endDay - 1) * 86400 + endHour * 3600 + endMinite * 60;
            if (endDay < startDay) {
                var newStageEnd = stageEnd + 7 * 86400;
                if (timestamp >= stageBegin && timestamp < newStageEnd) {
                    return {
                        type: +type,
                        id: +id,
                        stageBegin: stageBegin,
                        stageEnd: newStageEnd,
                    };
                } else {
                    var newStageBegin = stageBegin - 7 * 86400;
                    if (timestamp >= newStageBegin && timestamp < stageEnd) {
                        return {
                            type: +type,
                            id: +id,
                            stageBegin: newStageBegin,
                            stageEnd: stageEnd
                        };
                    }
                }

            } else {
                if (timestamp >= stageBegin && timestamp < stageEnd) {
                    return {
                        type: +type,
                        id: +id,
                        stageBegin: stageBegin,
                        stageEnd: stageEnd
                    };
                }
            }
        }
    }

    return { type: -1, id: -1, stageEnd: -1, stageBegin: -1 };
};

// 根据阶段重新计算阶段结束时间, 用于服务器开启后阶段不匹配的容错
exports.genStageEndTime = function (stage, next) {
    var stageConf = gConfLegionWarSchedule[stage];
    var beginOfWeek = Date.zeroWeek().getStamp();
    var now = Date.getStamp();
    var newEndTime = beginOfWeek;

    for (var id in stageConf) {
        var startDay = stageConf[id].startDay - 1;
        var startHour = stageConf[id].startHour;
        var startMin = stageConf[id].startMinite;
        var startTime = beginOfWeek + startDay * 86400 + startHour * 3600 + startMin * 60;

        var endDay = stageConf[id].endDay - 1;
        var endHour = stageConf[id].endHour;
        var endMin = stageConf[id].endMinite;
        var endTime = beginOfWeek + endDay * 86400 + endHour * 3600 + endMin * 60;

		if (endDay < startDay) {
			endTime += 7 * 86400;
		}

        // FIXME: id顺序随机
        if ((next || now >= startTime) && now < endTime) {
            newEndTime = endTime;
            break;
        }
    }

    return newEndTime;
};

// 根据阶段获取该阶段的起始时间
exports.genStageBeginTime = function (stage, prev) {
    var stageConf = gConfLegionWarSchedule[stage];
    var beginOfWeek = Date.zeroWeek().getStamp();
    var now = Date.getStamp();
    var newStartTime = beginOfWeek;

    for (var id in stageConf) {
        var startDay = stageConf[id].startDay - 1;
        var startHour = stageConf[id].startHour;
        var startMin = stageConf[id].startMinite;
        var startTime = beginOfWeek + startDay * 86400 + startHour * 3600 + startMin * 60;

        var endDay = stageConf[id].endDay - 1;
        var endHour = stageConf[id].endHour;
        var endMin = stageConf[id].endMinite;
        var endTime = beginOfWeek + endDay * 86400 + endHour * 3600 + endMin * 60;

		if (endDay < startDay) {
			endTime += 7 * 86400;
		}

        if (now >= startTime && (prev || now < endTime)) {
            newStartTime = startTime;
        }
    }

    return newStartTime;
};

/**
 * 在数组中找到元素的插入位置(从大到小)
 * @param array
 * @param key
 * @param val
 * @param lid
 * @returns {number}
 */
exports.findInsertPos = function(array, key, val, lid) {
    var pos = 0;
    for (var idx = 0; idx < array.length; ++idx) {
        pos = idx;

        if (val > array[idx][key]) {
            break;
        } else if (val == array[idx][key]) {
            if (lid > (+array[idx].lid)) {
                break;
            }
            continue;
        } else {
            var nexIdx = idx + 1;
            pos = nexIdx;
            if (nexIdx < array.length) {
                if (val < array[idx][key] && val > array[nexIdx][key]) {
                    break;
                }
            } else {
                break;
            }
        }
    }
    return pos;
}

/**
 * 查找军团排名
 * @param array
 * @param key
 * @param lid
 * @returns {number}
 */
exports.findLegionIndex = function (array, key, lid) {
    for (var idx = 0; idx < array.length; ++idx) {
        if (array[idx][key] == lid) {
            return idx;
        }
    }
    return -1;
};

/**
 * 根据积分获取段位
 * @param score
 * @returns {number}
 */
exports.getRank = function(score) {
    for (var id in gConfLegionWarRank) {
        if (!gConfLegionWarRank.hasOwnProperty(id)) {
            continue;
        }

        var rankConf = gConfLegionWarRank[id];
        if (score >= rankConf.minScore && score <= rankConf.maxScore) {
            return +id;
        }
    }
    return 1;
}
