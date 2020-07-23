// 幸运轮盘

// ----------------------------------------------------------------------------
// template

var template = {
    id: "",   // 配置ID
    got: {},   // 已经抽中的记录  key:{groupId*100+num} val: times  
    power: 0,    // 玩家当前能量
    grids: [],   // [[groupid, num] ]，8个格子的刷出记录
    fresh_flag: 0,    // 上次刷新的时间标志
    records: [],   // 个人的抽取记录
}


// ----------------------------------------------------------------------------
// global data

const GRID_NUM = 8;
const LIST_SIZE = 20;


var SvrOpenDays = 0;
var ActName = "lucky_rotate";


// ----------------------------------------------------------------------------
// local

// 已购买数量的key
function gen_store_key(groupid, num) {
    return groupid * 100 + num;
}

// 更新开服天数
function update_svr_open_days() {
    var t1 = common.getTime();
    var t2 = gConfGlobalServer.serverStartTime;
    SvrOpenDays = Math.floor((t1 - t2) / OneDayTime) + 1;
}

function get_refresh_flag(arr) {

    var now = new Date();
    var day = Math.floor(now.getTime() / 1000 / 86400);
    var len = arr.length;
    var idx = len + 1;

    var hour = now.getHours();

    for (var i = 0; i < len; i++) {
        if (hour < arr[i]) {
            idx = i + 1;
            break;
        }
    }

    if (idx == len) {
        day = day + 1;
        idx = 1;
    }

    return day * 100 + idx;
}

// 获取活动的key
function get_activity_key(name) {
    return gConfActivities[name].startTime;
}

// 刷新单个格子
function grid_refresh(conf, data, idx) {

    var gid = conf.gridSet[idx];
    var items = gConfAvLuckyRotateItem[gid];
    var filtered = [];

    var def_item = null;

    for (num in items) {
        var v = items[num];

        if (!def_item) {
            def_item = v;
        }

        // 开服天数检测
        if (SvrOpenDays < v.dayLimitMin || SvrOpenDays > v.dayLimitMax) {
            continue;
        }

        // 是否满足上限检测
        var key = gen_store_key(v.groupId, v.num);
        var num = data.got[key] || 0;

        if (v.store > 0 && num >= v.store) {
            continue;
        }

        filtered.push(v);
    }

    var weight = 0;
    filtered.forEach(v => {
        weight += v.refreshWeight;
    });

    var idx = 0;
    var rand = common.randRange(0, weight);

    for (var i = filtered.length - 1; i >= 0; i--) {
        weight -= filtered[i].refreshWeight;
        if (rand >= weight) {
            idx = i;
            break;
        }
    }

    var v = filtered[idx];

    if (!v) {
        v = def_item;
        ERROR(`Not Found appropriate item: ${gid}  ${SvrOpenDays}`);
    }

    return [v.groupId, v.num];
}

// 检测是否需要刷新格子
// 返回是否刷新了格子
function grids_refresh(player, conf, data) {

    var refresh = false;
    var refresh_flag = get_refresh_flag(conf.resetTime);

    if (!data.refresh_flag || data.grids.length != GRID_NUM) {
        data.refresh_flag = refresh_flag;
        refresh = true;
    }

    if (data.refresh_flag != refresh_flag) {
        data.refresh_flag = refresh_flag;
        refresh = true;
    }

    if (refresh) {
        data.grids = [];
        for (var i = 0; i < GRID_NUM; i++) {
            data.grids[i] = grid_refresh(conf, data, i);
        }
    }

    return refresh;
}

// 获得下一次刷新时间
function get_next_refresh_time(conf) {
    var now = new Date();
    var hour = now.getHours();

    var len = conf.resetTime.length;
    var idx = len;

    for (var i = 0; i < len; i++) {
        if (hour < conf.resetTime[i]) {
            idx = i;
            break;
        }
    }

    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);

    if (idx == len) {
        var v = conf.resetTime[0];
        now.setHours(v);
        return Math.floor(now.getTime() / 1000) + 86400 + 5;
    } else {
        var v = conf.resetTime[idx];
        now.setHours(v);
        return Math.floor(now.getTime() / 1000) + 5;
    }
}

function get_data(player) {

    var act = player.user.activity;
    var reset = false;

    if (!isActivityStart(player, ActName)) {
        return act.lucky_rotation;
    }

    if (!act.lucky_rotation) {
        act.lucky_rotation = {
            'time': 0,
        }
    }

    var key = get_activity_key(ActName);

    if (act.lucky_rotation.time == 0) {
        act.lucky_rotation.time = key;
        reset = true;
    }

    // 检测活动是否新的一期
    if (act.lucky_rotation.time != key) {
        act.lucky_rotation.time = key
        reset = true;
    }

    update_svr_open_days();

    var reseted = false;
    if (reset) {
        reseted = true;
    }

    // fresh data
    for (let id in gConfAvLuckyRotateBase) {

        let conf = gConfAvLuckyRotateBase[id];
        let data = act.lucky_rotation[id];

        // store power
        var power = 0;
        if (data && data.power) {
            power = data.power;
        }

        if (reset || !data) {
            act.lucky_rotation[id] = clone(template);
            data = act.lucky_rotation[id];
            data.id = id;
        }

        var r = grids_refresh(player, conf, data);
        if (r) {
            reseted = true;
        }

        // revert power
        if (power) {
            data.power = power;
        }

        if (!data.records) {
            data.records = [];
        }
    }

    if (reseted) {
        player.markDirty('activity.lucky_rotation');
    }

    return act.lucky_rotation;
}

// 保存抽奖记录
function add_records(data, award) {

    data.records.unshift([common.getTime(), award]);

    if (data.records.length > LIST_SIZE) {
        data.records.length = LIST_SIZE;
    }
}

function post_record(uid, type, item) {
    var req = {
        uid: uid,
        mod: 'act_lucky_rotate',
        act: 'list_add',
        args: {
            type: type,
            item: item,
        },
    }

    requestArenaServer(req, {}, function () { });
}

// 获得展示记录
function get_pond_item(conf, per) {
    var idx = -1;
    for (var i = 0; i < conf.pondPer.length; i++) {
        var v = conf.pondPer[i];
        if (v == per) {
            idx = i;
            break;
        }
    }

    if (idx != -1 && idx < conf.pondItem.length) {
        var item = clone(conf.pondItem[idx]);
        item[2] = per;
        return item;
    }
}

// 检测是否存在(给策划擦屁股)
function check_exist(conf, data) {
    for (let id in gConfAvLuckyRotateBase) {
        var tab = data[id];
        if (!tab) {
            continue;
        }

        for (var i = 0; i < GRID_NUM; i++) {
            var grid = tab.grids[i];

            var gid = grid[0];
            var num = grid[1];

            var items = gConfAvLuckyRotateItem[gid];
            if (!items || !items[num]) {
                DEBUG(`check_exist:  fuck hjj ${gid} ${num}`)
                tab.grids[i] = grid_refresh(conf, data, i)
            }
        }
    }
}

// ----------------------------------------------------------------------------
// export

// 每周重置
exports.reset_weekly = function (player) {
    update_svr_open_days();

    var act = player.user.activity;

    if (!act.lucky_rotation) {
        return;
    }

    for (let id in gConfAvLuckyRotateBase) {

        let conf = gConfAvLuckyRotateBase[id];
        let data = act.lucky_rotation[id];

        // store power
        var power = 0;
        if (data && data.power) {
            power = data.power;
        }

        act.lucky_rotation[id] = clone(template);
        data = act.lucky_rotation[id];
        data.id = id;

        grids_refresh(player, conf, data);

        // revert power
        if (power) {
            data.power = power;
        }
    }

    player.markDirty('activity.lucky_rotation');
};


// ----------------------------------------------------------------------------
// export for request

// 拉
exports.get_info = function (player, req, resp, onHandled) {

    do {

        // 活动是否开启
        if (!isActivityStart(player, ActName)) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var type = +req.args.type;       // 转盘类型
        if (!type) {
            resp.code = 2; resp.desc = 'args absence'; break;
        }

        let conf = gConfAvLuckyRotateBase[type];
        if (!conf) {
            resp.code = 3; resp.desc = 'invalid type'; break;
        }

        let data = get_data(player)[type];
        if (!data) {
            resp.code = 4; resp.desc = 'invalid type'; break;
        }

        check_exist(conf, player.user.activity.lucky_rotation)

        req.args.key = get_activity_key(ActName);

        // 请求活动的跨服数据
        requestArenaServer(req, resp, function () {
            if (resp.code == 0) {
                // 对数据进行转换
                resp.data.award_pool_num = resp.data.total;
                resp.data.refresh_time = get_next_refresh_time(conf);

                // 得奖记录
                var award_log = [];
                for (var i = 0; i < resp.data.list.length; i++) {
                    var v = resp.data.list[i];
                    var o = {
                        type: v[0],
                        time: v[1],
                        name: v[2],
                        award: v[3],
                        sever_id: v[4] || config.ServerId,
                    }
                    award_log.push(o);
                }

                resp.data.award_log = award_log;

                // 列表
                resp.data.award_list = data.grids;
            }
            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

// 转
exports.rotate = function (player, req, resp, onHandled) {

    do {
        // 活动是否开启
        if (!isActivityStart(player, ActName)) {
            resp.code = 1; resp.desc = 'act not open'; break;
        }

        var type = +req.args.type;       // 转盘类型
        var time = +req.args.time;       // 转的次数

        if (!type || !time || time < 1 || time > 10) {
            resp.code = 2; resp.desc = 'args absence'; break;
        }

        let conf = gConfAvLuckyRotateBase[type];
        if (!conf) {
            resp.code = 3; resp.desc = 'invalid type'; break;
        }

        let data = get_data(player)[type];
        if (!data) {
            resp.code = 4; resp.desc = 'invalid type'; break;
        }

        // 所需消耗是否足够
        var costs = clone(conf.cost);
        if (time > 1) {
            for (var i = 0; i < costs.length; i++) {
                var v = costs[i];
                v[2] = +v[2] * time;
            }
        }

        if (!player.checkCosts(costs)) {
            resp.code = 5; resp.desc = 'cost not enough'; break;
        }

        // 额外参数
        req.args.un = player.user.info.un;
        req.args.svrId = config.ServerId;

        // 检测是否中了钻石
        requestArenaServer(req, resp, function () {
            if (resp.code != 0) {
                onHandled();
                return;
            }

            var pos = -1;       // 客户端数组下标从1开始
            var awards = [];
            var special_awards = [];
            var need_refresh = 0;

            // N次抽奖处理
            for (var i = 0; i < time; i++) {

                // 单次抽取玩家必得
                awards = awards.concat(conf.awardOnce);

                // 抽取前加能量
                data.power += conf.rotatePower;

                var id = -1;
                if (data.power >= conf.pPower[1]) {
                    id = conf.pPower[0] - 1;
                } else {
                    // 从8个格子中随机一个奖励

                    var filtered = [];
                    for (var j = 0; j < GRID_NUM; j++) {

                        var grid = data.grids[j];
                        var item = gConfAvLuckyRotateItem[grid[0]][grid[1]];

                        if (data.power >= item.limitPower) {
                            filtered.push([j, item.awardWeight]);
                        }
                    }

                    var weight = 0;
                    filtered.forEach(v => {
                        weight += v[1];
                    });

                    var rand = common.randRange(0, weight - 1);

                    for (var m = filtered.length - 1; m >= 0; m--) {
                        weight -= filtered[m][1];
                        if (rand >= weight) {
                            id = filtered[m][0];
                            break;
                        }
                    }
                }

                if (id == -1) {
                    id = 7;
                }

                if (pos == -1) {
                    pos = id + 1;
                }

                // 扣除本次能量消耗
                var grid = data.grids[id];
                var item = gConfAvLuckyRotateItem[grid[0]][grid[1]];

                data.power -= item.costPower;

                // 是否需要刷新格子
                if (item.store) {
                    var key = gen_store_key(grid[0], grid[1])
                    data.got[key]++;

                    if (data.got[key] >= item.store) {
                        data.grids[id] = grid_refresh(conf, data, id);
                        need_refresh = 1;
                    }
                } else if (item.isRefresh) {
                    data.grids[id] = grid_refresh(conf, data, id);
                    need_refresh = 1;
                }

                // 增加奖励
                awards = awards.concat(item.award);

                // 大奖
                if (item.isBig) {
                    special_awards = special_awards.concat(item.award);
                    post_record(req.uid, type, [1, common.getTime(), player.user.info.un, item.award, config.ServerId]);
                }

                add_records(data, item.award);
            }

            // 是否抽中钻石
            for (var i = 0; i < resp.data.result.length; i++) {
                var v = resp.data.result[i];

                if (v[0] != 0) {

                    var pondAward = clone(conf.basePond);
                    pondAward[0][2] = v[1];
                    awards = awards.concat(pondAward);

                    var pondItem = get_pond_item(conf, v[0])
                    if (pondItem) {
                        special_awards = special_awards.concat([pondItem]);
                    }

                    var award = clone(conf.basePond[0]);
                    award[2] = v[1];

                    add_records(data, [award]);
                }
            }

            awards = reformAwards(awards);
            special_awards = reformAwards(special_awards);

            // 通知客户端
            resp.data.costs = player.addAwards(costs, 'lucky_rotation', 'rotate');
            resp.data.awards = player.addAwards(awards, 'lucky_rotation', 'rotate');
            resp.data.pos = pos;
            resp.data.need_refresh = need_refresh;
            resp.data.special_awards = special_awards;

            player.markDirty('activity.lucky_rotation');

            player.doDailyTask('doWheel', time);
            player.doOpenSeven('luckyRotateNum', time);
            player.doOpenHoliday('luckyRotateNum', time);

            onHandled();
        })

        return;
    } while (false);

    onHandled();
};

// 刷
exports.refresh = function (player, req, resp, onHandled) {
    do {
        // 活动是否开启
        if (!isActivityStart(player, ActName)) {
            resp.code = 1; resp.desc = 'act not open'; break;
        }

        var type = +req.args.type;       // 转盘类型

        if (!type) {
            resp.code = 2; resp.desc = 'args absence'; break;
        }

        let conf = gConfAvLuckyRotateBase[type];
        if (!conf) {
            resp.code = 3; resp.desc = 'invalid type'; break;
        }

        let data = get_data(player)[type];
        if (!data) {
            resp.code = 4; resp.desc = 'invalid type'; break;
        }

        // 检测消耗是否足够
        if (!player.checkCosts(conf.refreshCost)) {
            resp.code = 5; resp.desc = 'cost not enough'; break;
        }

        data.grids = [];
        for (var i = 0; i < GRID_NUM; i++) {
            data.grids[i] = grid_refresh(conf, data, i);
        }

        req.args.key = get_activity_key(ActName);
        req.act = 'get_info';

        requestArenaServer(req, resp, function () {
            if (resp.code == 0) {
                resp.data.award_pool_num = resp.data.total;
            }

            resp.data.costs = player.addAwards(conf.refreshCost, 'lucky_rotation', 'refresh');
            resp.data.award_list = data.grids;

            onHandled();
        });

        return;
    } while (false);

    onHandled();
}


// 拉去个人抽奖记录
exports.get_records = function (player, req, resp, onHandled) {
    do {
        // 活动是否开启
        if (!isActivityStart(player, ActName)) {
            resp.code = 1; resp.desc = 'act not open'; break;
        }

        var type = +req.args.type;       // 转盘类型

        if (!type) {
            resp.code = 2; resp.desc = 'args absence'; break;
        }

        let conf = gConfAvLuckyRotateBase[type];
        if (!conf) {
            resp.code = 3; resp.desc = 'invalid type'; break;
        }

        let data = get_data(player)[type];
        if (!data) {
            resp.code = 4; resp.desc = 'invalid type'; break;
        }

        var records = [];
        for (var i = 0; i < data.records.length; i++) {
            var v = data.records[i];
            records.push({
                time: v[0],
                award: v[1],
            });
        }

        resp.data.records = records;
    } while (false);

    onHandled();
}
