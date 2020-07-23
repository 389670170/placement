// ----------------------------------------------------------------------------
// 月度返利
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// local

function getFlag() {
    let date = new Date();

    if (date.getHours() < 5) {
        date = new Date(+date - 86000000);
    }

    return date.getFullYear() * 100 + date.getMonth()+1;
};

// 获取数据
function get_data(player) {
    let act_data = player.user.activity;

    let reset = true;
    let flag  = getFlag();

    do{
        let rebate = act_data.month_rebate;
        if (!rebate || !rebate.open) {
            break;
        }

        if (rebate.open != flag) {
            break;
        }

        reset = false;
    } while(false);

    if (reset) {
        act_data.month_rebate = {
            open    : flag,  // 上次活动时间
            total   : 0,     // 累计购买金钻
            got     : [],    // 已经领取的奖励
        }
        player.markDirty('activity.month_rebate');
    }

    return act_data.month_rebate;
}


// ----------------------------------------------------------------------------
// export

// 每月重置1号5点
exports.reset_monthly = function(player) {
    get_data(player);
};

// 充值事件
exports.on_pay = function(player, cash) {
    let data = get_data(player);
    data.total += cash;
    player.markDirty('activity.month_rebate');
}


// ----------------------------------------------------------------------------
// export for request

// 拉取信息
exports.get_info = function(player, req, resp, onHandled) {
    resp.data.month_rebate = get_data(player);
    onHandled();
}

// 领取奖励
exports.get_records = function(player, req, resp, onHandled) {
    var id = +req.args.id;  // 领取的配置表ID

    do {
        if (!id) {
            resp.code = 102; resp.desc = 'absence id'; break;
        }

        let conf = gConfAvMonthRebate[id];
        if (!conf) {
            resp.code = 103; resp.desc = 'invalid id'; break;
        }

        let data = get_data(player);
        if (data.got.includes(id)) {
            resp.code = 104; resp.desc = 'got yet'; break;
        }

        if (data.total < conf.num) {
            resp.code = 105; resp.desc = 'not enough'; break;
        }

        data.got.push(id);
        player.markDirty('activity.month_rebate');

        resp.data.award        = player.addAwards(conf.award, 'activity', 'month_rebate');
        resp.data.month_rebate = data;
    }while(false);

    onHandled();
}
