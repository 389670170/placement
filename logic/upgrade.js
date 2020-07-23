var upgrades = [
    function giftBagVisit(player) {
        var user = player.user;
        if (!user.mark.visit_gift_bag) {
            user.mark.visit_gift_bag = [];
            player.markDirty('mark.visit_gift_bag');
        }
    },

    function wand_version(player) {
        var user = player.user;
        if (!user.status.wand) {
            user.status.wand = 0;
            player.markDirty('status.wand');
        }
    },

    function princess(player) {
        player.user.princess = {
            time: 0,
            progress: 0,
        };
        player.markDirty('princess');
    },

    function princess2(player) {
        player.user.princess.extra = {};
        player.markDirty('princess');
    },

    function legionscore(player) {
        player.user.status.legionwarscore = 0;
        player.markDirty('status.legionwarscore');
    },
    function investment(player) {
        player.user.activity.investment = {
            'open_day': 0,
            'isBuy': 0,
            'loginDayCount': 0,
            'lastLoginTime': 0,
            'notShow': 0,
            'rewards': {},
        };
        player.markDirty('activity.investment');
    },

    function limitExchange(player) { },
    function limitExchangeFix(player) {
        if (!player.user.activity.limit_exchange.time) {
            player.user.activity.limit_exchange.time = gConfActivities['limit_exchange'].time;
        }
        player.markDirty('activity.limit_exchange');
    },
    function update_day_recharge(player) {
        var day_recharge = player.user.activity.day_recharge;
        if (!player.user.activity.day_recharge) {

            player.user.activity.day_recharge = {
                'open_day': 0,                      // 活动开启时间
                'dayCount': 0,                      // 累计充值次数
                'today_status': 0,                   //今天任务是否完成
                'day_paid': 0,                       //今天已经充值数
                'reward': {                         // 领奖状态
                    // day: 1,                      // 已领取天数: 1
                },
            };
            player.markDirty('activity.day_recharge');
            day_recharge = player.user.activity.day_recharge;
        }
        if (day_recharge.open_day) {
            if (day_recharge.open_day < common.getTime(20190424)) {
                var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
                passedDay = passedDay > 6 ? 6 : passedDay;
                day_recharge.dayCount = passedDay;
                for (var i = 1; i < passedDay; i++) {
                    day_recharge.reward[i] = 1;
                }
                player.markDirty('activity.day_recharge');
            }
        }
    },

    /** 龙纹手册 */
    function update_manually(player) {
        player.user.activity.manually = {
            "now_exp": 0,                       // 当前经验值
            "is_unlock": 0,                     // 0-未解锁额外奖励 1-已解锁额外奖励
            "rewards": {                        // 基础奖励信息
                "def_list": [],                 // 已经领取的基础奖励列表
                "ex_list": [],                  // 已经领取的额外奖励列表
            },
            "task_info": {
                "task_info": {},                // 任务进度信息  key-任务ID  value-任务完成次数
                "buy_times": {},                // 购买等级情况 key-购买的等级类型 value-对应购买次数
            }
        }

        player.markDirty('activity.day_recharge.manually');
    },

    function update_open_holiday(player) {

        if (!player.user.activity.open_holiday) {
            player.user.activity.open_holiday = {                         // 新七日狂欢
                'open_day': 0,                      // 开启日期
                'progress': {                       // 每个任务目标状态
                    //id: [0, 0],                   // [进度, 是否已领取]
                },
                'rewarded_box': [],                  // 领过奖的箱子
            };
            player.markDirty('activity.open_holiday');
            player.openOpenHoliday();
        }
    },

    // 冒险赢钻石
    function update_custom_weal(player) {
        if (!player.user.custom_weal) {
            player.user.custom_weal = {
                gen: { '1': 0, '2': 0, '3': 0 },  // 普通领取  (数组内分别对应三种难度的通过关卡)
                vip: { '1': 0, '2': 0, '3': 0 },  // vip领取
            }
            player.markDirty('custom_weal');
        }
    },

    // 在线领奖
    function (player) {
        if (!player.user.mark.outline) {
            player.user.mark.outline = {
                'guide': {
                    'progress': {},
                    'got': {},
                },
                'boss': {
                    'progress': {},
                    'fight_num': 0,
                },
                'now_show': 'guide',   // guide or boss
            }
            player.markDirty('mark.outline');
        }

        if (!player.user.outline_rec) {
            player.user.outline_rec = {
                'exchg_first': 0,
                'exchg_other': 0,
                'rand_other': [],
                'kill_count': {},
                'boss_pass': {},
            }
            player.markDirty('outline_rec');
        }
    },

    // 大本营魔法阵（扩展）
    function (player) {
        if (!player.user.auto_fight.magic.extra) {
            player.user.auto_fight.magic.extra = {};
            player.markDirty('auto_fight.magic');
        }
    },

    // 运营统计数据
    function (player) {
        if (!player.user.online_stat) {
            player.user.online_stat = {
                'guide_city': 0,    // 出主城
                'guide_dragon': 0,    // 开启火龙
                'guide_help': 0,    // 开启救公主
                'guide_arena': 0,    // 竞技场引导结束
                'daily_task_count': 0, // 每日活跃任务完成数量
                // 以下两个用于统计总登入设备数
                'guide_create': 0,    // 新创建角色
                'guide_first': 0,    // 进入游戏的第一个引导
                // 以下为非首次添加
            };
            player.markDirty('online_stat');
        }
    },

    // 评价活动
    function (player) {
        player.user.activity.doappraise = {
            'open_day': 0,        // 开启日期
            'doappraise': 0,        // 评价领奖，0 = 未作任何操作 1 = 评价但未领奖 2 = 评价并领取
        }

        player.markDirty('activity.doappraise');
    },

    // 幸运轮盘
    function (player) {
        player.user.activity.lucky_rotation = {
            'time': 0,
        };
        player.markDirty('activity.lucky_rotation');
    },

    // 幸运转盘 货币
    function (player) {
        player.user.status.rotate_score = 0;
        player.user.status.rotate_ncoin = 0;
        player.user.status.rotate_hcoin = 0;
        player.markDirty('status');
    },

    // 杂项数据表
    function (player) {
        if (!player.user.misc) {
            player.user.misc = {};
            player.markDirty('misc');
        }
    },

    // QQ群
    function (player) {
        player.user.activity.doddqqgroup = {
            'open_day': 0,        // 开启日期
        }
        player.markDirty('activity.doddqqgroup');
    },


    // eyoufb活动
    function (player) {
        player.user.activity.facebook = {
            'open_day': 0,        // 开启日期
        }
        player.markDirty('activity.facebook');
    },
    /**
     * 排行活动
     * @param {*} player 
     */
    function (player) {
        player.user.activity.rank = player.user.activity.rank || {};
        player.user.activity.rank.recharge = player.user.activity.rank.recharge || {                           // 充值
            'stage': 0,
            'value': 0
        }

        player.user.activity.rank.expense = player.user.activity.rank.expense || {                           // 消费
            'stage': 0,
            'value': 0
        }

        player.markDirty('activity.rank');
    },

    /**
     * 等级礼包
     * @param {*} player 
     */
    function (player) {
        player.user.activity.level_up = player.user.activity.level_up || {};
        var tActInfo = player.user.activity.level_up;
        tActInfo.open_day = tActInfo.open_day || getGameDate();
        tActInfo.target_time = tActInfo.target_time || 0;
        tActInfo.can_get = tActInfo.can_get || 0;

        player.markDirty('activity.level_up');
    },

    // eyou零元礼包
    function (player) {
        player.user.activity.zero_gift = {
            'open_day': 0,        // 开启日期
        }
        player.markDirty('activity.zero_gift');
    },

    // eyou关注送礼
    function (player) {
        player.user.activity.follow_rewards = {
            'open_day': 0,        // 开启日期
        }
        player.markDirty('activity.follow_rewards');
    },

    require('./act_accumulate_daily.js').upgrade,
    require('./act_accumulate_pay.js').upgrade,
    require('./act_sign_new.js').upgrade,
    require('./act_online_award.js').upgrade,
    require('./act_help_equip.js').upgrade,
];

exports.version = upgrades.length;

exports.do = function (player, version) {
    for (var i = version; i < upgrades.length; i++) {
        if (upgrades[i]) {
            upgrades[i](player);
            player.user.mark.version = i + 1;
            player.markDirty('mark.version');
        }
    }
};
