// 豪华签到

// ----------------------------------------------------------------------------
// data

var tmpl_sign_high = {
    round: 0,    // 活动轮数
    today: 0,    // 最近一次充值完成日期
    pay_paid: 0,    // 今日充值黄钻数量
    pay_days: 0,    // 本期已经充值次数
    get_times: 0,    // 本期已领奖次数
    conf: [],   // 配置
}


// ----------------------------------------------------------------------------
// local

function get_round(player) {
    var user = player.user;

    var today = getGameDate();
    var create = getGameDate(user.info.create);
    var diff = common.getDateDiff(create, today);

    return Math.floor(diff / 7) + 1;
}

function get_data(player) {

    var user = player.user;
    var round = get_round(player);

    if (!user.sign_high || user.sign_high.round != round) {
        user.sign_high = clone(tmpl_sign_high);
        user.sign_high.round = round;

        var conf = gConfSignHigh[round];
        if (!conf) {
            conf = gConfSignHigh[0];
        }

        for (var i = 1; i <= 7; i++) {
            user.sign_high.conf.push([conf[i]['picture'], conf[i]['reward']]);
        }

        player.markDirty('sign_high');
    }

    var today = getGameDate();
    if (user.sign_high.today != today) {
        user.sign_high.today = today;
        user.sign_high.pay_paid = 0;
        user.sign_high.today_get = 0;
        player.markDirty('sign_high');
    }

    return user.sign_high;
}


// ----------------------------------------------------------------------------
// event

exports.get_data = get_data;

exports.on_pay = function (player, cash) {
    var data = get_data(player);
    var conf = data.conf;

    // if(data.pay_paid >= gConfGlobalNew.avSignHighDailyBuyGoldenDiamond) {
    //     return
    // }

    // if (data.pay_paid >= gConfGlobalNew.avSignHighDailyBuyGoldenDiamond) {
    if (!data.pay_paid) {
        data.pay_days++;
        player.markDirty('sign_high');
        player.addTip('sign_high');
    }
    // }

    data.pay_paid += cash - 0 + 1;
    player.markDirty('sign_high');
}


exports.check_tips = function (player) {
    if (!isActivityStart(player, 'sign_high')) {
        return
    }

    var data = get_data(player);
    if (data.pay_days > data.get_times) {
        player.addTip('sign_high');
    }
}

// ----------------------------------------------------------------------------
// export

// 拉去活动整体信息
exports.get_info = function (player, req, resp, onHandled) {
    var user = player.user;

    do {

        // 活动是否开启
        if (!isActivityStart(player, 'sign_high')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var data = get_data(player);

        resp.data.sign = {
            round: data.round,
            pay_paid: data.pay_paid,
            pay_days: data.pay_days,
            get_times: data.get_times,
            today_get: data.today_get,
            conf: data.conf,
        }

    } while (false);

    onHandled();
};

// 领取奖励
exports.get_award = function (player, req, resp, onHandled) {
    var user = player.user;

    do {

        // 活动是否开启
        if (!isActivityStart(player, 'sign_high')) {
            resp.code = 1; resp.desc = 'not open'; break;
        }

        var data = get_data(player);

        // 检测天数是否足够
        if (data.get_times >= data.pay_days) {
            resp.code = 1; resp.desc = 'pay enough'; break;
        }

        resp.data.awards = player.addAwards(data.conf[data.get_times][1], 'activity', 'sign_high-get_award');

        data.get_times++;
        data.today_get = 1;
        player.markDirty('sign_high');

        resp.data.today_get = data.today_get;
        resp.data.get_times = data.get_times;

    } while (false);

    onHandled();
};
