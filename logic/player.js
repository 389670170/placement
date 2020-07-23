var CostLog = require('./cost_log.js');
var ResBack = require('./resback.js');
var Upgrade = require('./upgrade.js');
var loginCommon = require('./common.js');
var LogType = require('../logserver/enum.js').LogType;

// modules
var sign_high = require('./sign_high.js');
var act_lucky_rotate = require('./act_lucky_rotate.js');
var act_month_rebate = require('./act_month_rebate.js');
const { getGroupItemWeightInfo } = require('../global.js');

const SEC_PER_MONTH = 86400 * 30;

function Player(uid) {
    this.uid = uid;
    this.user = null;
    this.dirty = {};                    // 本次操作脏数据
    this.allDirty = {};                 // 累计的脏数据
    this.saveCount = 0;                 // 数据库存盘计数
    this.saveError = false;             // 是否出现数据库写入错误
    this.lastActive = common.getTime(); // 上次活跃时间
    this.heroDirty = true;              // 阵上武将数据是否需要重新计算
    this.teamChanged = true;            // 阵型是否发生了变化
    this.lock = false;                  // 并发锁
    this.seq = 0;                       // 请求序列值, 用于判断是否是消息重发
    this.hasTip = false;                // 是否有提醒
    this.payNotify = false;             // 是否有新支付

    this.winner_token = '';             // 微蓝登录token
    this.loginId = 0;                   // 登录日志ID, 0为未记录
    this.logoutId = 0;                  // 登出日志ID, 0为未记录
    this.loginTime = 0;                 // 登录时间

    this.action = {                     // 当前消息
        mod: 'mod',                     // 消息模块
        act: 'act',                     // 消息接口
        args: {},                       // 请求参数
        getEvent: function () {
            return util.format('%s.%s', this.mod, this.act);
        }
    };
}


Player.create = function (uid) {
    var now = common.getTime();

    var initUser = {
        '_id': uid,
        'lock': 0,                                 // 并发锁, 0空闲 >0解锁时间(单位s)
        'ai': 1,                                   // 自增长ID,用于编号系统
        'info': {                                  // 基本信息
            'un': '',                               // 玩家角色名
            'account': '',                          // 玩家账号
            'headpic': 1,                           // 玩家头像
            'headframe': 30002,                        // 头像框
            'create': now,                          // 用户创建时间
            'uid': uid,                             // 玩家ID
            'country': 0,                          // 国号, 1/2/3 魏/蜀/吴
            'position': 0,                          // 皇城官职
            'dragon': 1,                            // 主角坐骑

            'ip': '',                              // 玩家登录ip
            'platform': '',                         // 玩家登陆平台
            'device': '',                           // 玩家登陆设备
            'system': '',                           // 玩家登陆系统
            'device_id': '',                        //玩家首登的设备唯一ID
            'device_type': '',                       //设备类型
        },

        'status': { // 基础数据
            'hero_exp': 0,                           // 英雄貨幣
            'team_exp': 0,                           // 战队经验
            'team': 0,                               // 战队币
            'xp': 0,                                // 经验
            'level': 1,                             // 等级
            'gold': gConfGlobalNew.initGold,        // 金币
            'cash': 0,                              // 元宝
            'bindcash': 0,                         // 绑定元宝
            'vip': 0,                               // VIP等级
            'vip_xp': 0,                            // VIP经验
            'food': gConfGlobalNew.initFood,           // 粮草
            'food_red': gConfGlobalNew.foodRedInitial, // 噩梦关卡体力
            'luck': 0,                              // 幸运值
            'tower': 0,                             // 爬塔币
            'arena': 0,                             // 竞技场币
            'country': 0,                           // 国家货币
            'legion': 0,                            // 军团币 || 新军团用这个
            'soul': 0,                             // 将魂数
            'token': 0,                            // 荣誉令牌
            'ntoken': 0,                           // 普通招募令
            'htoken': 0,                           // 高级招募令
            'gtoken': 0,                           // 神将商店刷新令
            'free_gtoken': 0,                      // 神将商店免费刷新令
            'mtoken': 0,                           // 神秘商店刷新令
            'free_mtoken': 0,                      // 神秘商店免费刷新令
            'boon': 0,                             // 军团红包
            'egg': 0,                              // 成就蛋
            'arena_xp': 0,                         // 竞技场经验
            'arena_level': 1,                      // 竞技场等级
            'wood': 0,                             // 木材
            'legionwar': 0,                         // 玩家军团战个人贡献
            'legionwarscore': 0,                    // 军团巡逻点数
            'trial_coin': 0,                       // 试炼币
            'love': 0,                             // 爱心值
            'shas': 0,                             // 行军令
            'staying_power': parseInt(gConfTerritoryWarBase.enduranceLimit.value),                    // 领地战耐力
            'action_point': 100,                     // 领地战行动力
            'rotate_score': 0,                     // 幸运转盘 积分
            'rotate_ncoin': 0,                     // 幸运转盘 低级硬币
            'rotate_hcoin': 0,                     // 幸运转盘 高级硬币
            'fate_coin': 0,                        // 命运之轮 硬币
            'mine_1': 0,                           // 龙晶石
            'mine_2': 0,                           // 龙栖木
            'mine_3': 0,                           // 龙玄锭
            'mine_4': 0,                           // 龙岗岩
            'mine_5': 0,                           // 龙泉泪
            'goods': 0,                            // 物资
            'countrywar': 0,                       // 军资
            'country_score': 0,                    // 国战积分
            'salary': 0,                           // 皇城俸禄
            'sky_book': 0,                         // 技能书
            'wine': 0,                             // 朗姆酒
            'star': 0,                             // 星星
            'moon': 0,                             // 月亮
            'sun': 0,                              // 太阳
            'rune_exp': 0,                         // 符文经验
            'rune_crystal': 0,                     // 符文结晶
            'rune_crystal2': 0,                    // 高级符文结晶
            'godsoul': 0,                          // 神之魂晶
            'smelt': 0,                            // 魔晶，装备分解产物
            'atoken': 0,                           // 竞技场门票
            'active': 0,                           // 活跃度
            'digging': gConfGlobalNew.diggingToolInit,// 矿锄数量
            'rob': 0,                              // 占地凭证
            'wand': 0,                             // 魔法棒
        },

        'mark': {                                   // 标志
            'new_rune': 3,                              // is use now rune
            'version': Upgrade.version,             // 数据版本, 依次递增
            'gyyx_lf': '',                          // 光宇生命指纹
            'guide': 1,                             // 新手引导步奏,0完成
            'func_guide': 0,                        // 功能开启引导
            'step': {                               // 一次性引导记录
                // gid: 0,                          // 引导id: 引导完成步骤
            },
            'day': 0,                               // 上次登录日期20130101，游戏日期，以每天的凌晨5点为分界线
            'login_day': 0,                        // 上次登录日期20130101，真实日期
            'login_today_time': 0,                  // 今日首次登陆时间
            'login_time': 0,                        // 上次登录时间
            'active_time': 0,                       // 上次活跃时间
            'logins': 0,                            // 累计登录次数
            'login_days': 0,                        // 累计登录天数
            'retention': 0,                         // 留存, 按bit计算是否登陆
            'food_time': 0,                         // 最近一次粮草恢复的时间
            'food_time_red': 0,                    // 最近一次粮草恢复的时间
            'staying_power_time': 0,                // 最近一次耐力恢复时间
            'action_point_time': 0,                 // 最近一个行动力恢复时间
            'online_time': 0,                       // 当日在线时长
            'total_online_time': 0,                 // 总在线时长
            'first_create_legion': 1,               // 是否首次创建军团
            'max_fight_force': 0,                   // 玩家最高战力
            'max_fight_force_no_extra': 0,          // 玩家最高战力(不计算额外属性)
            'day_world_chat_count': 0,              // 玩家当日世界聊天次数
            'occupy_land_count': 0,                // 占领村庄地块次数
            'open_cave_box_count': 0,              // 开启王者宝箱的数量
            'mail': 0,                             // 是否发过新手邮件
            'map_hero_id': 0,                      // 赠送英雄的id
            'map_hero_timer': 0,                   // 领取英雄计时器
            'first_pay_time': 0,                   // 首次付费时间，后台统计用
            'first_pay_cash': 0,                     //首笔充值金额，后台统计用
            'visit_gift_bag': [],                  // 看过的礼包id列表
            'boss_notice': [],                     // boss出生提示
            'outline': {                           // 在线奖励
                'guide': {
                    'progress': {},
                    'got': {},
                },
                'boss': {
                    'progress': {},
                    'fight_num': 0,
                },
                'now_show': 'guide',   // guide or boss
            },
        },

        'skills': {                                 // 君主技能
            '1': {                                  // 槽位
                'level': 1,                         // 槽位等级
                'id': 0,                            // 装备的技能
            },
            '2': {                                  // 槽位
                'level': 1,                         // 槽位等级
                'id': 0,                            // 装备的技能
            },
            '3': {                                  // 槽位
                'level': 1,                         // 槽位等级
                'id': 0,                            // 装备的技能
            },
            '4': {                                  // 槽位
                'level': 1,                         // 槽位等级
                'id': 0,                            // 装备的技能
            },
            '5': {                                  // 槽位
                'level': 1,                         // 槽位等级
                'id': 0,                            // 装备的技能
            },
        },

        'pos': {                                    // 武将槽位
            /*
            '1' : {                                 // 槽位对象
                'hid' : 0,                          // 上阵武将编号--改为唯一编号
                'level' : 1,                        // 等级
                'xp' : 0,                           // 经验
                'equip': {                          // 装备
                    '1' : 0,                        // 头盔
                    '2' : 0,                        // 武器
                    '3' : 0,                        // 腰带
                    '4' : 0,                        // 盔甲
                    '5' : 0,                        // 鞋子
                    '6' : 0,                        // 项链
                },
                'destiny': {                        // 天命
                    'level' : 1,                    // 等级
                    'energy' : 0,                   // 能量
                    'expect': 0,                    // 期望升级能量值
                },
                'talent' : 0,                       // 天赋等级
                'promote' : [],                     // 武将升阶
                'soldier': {                        // 小兵
                    'level' : 1,                    // 等阶
                    'star' : 0,
                    'dress' : {                     // 小兵装备
                        '1' : 0,                    // 0, 已经装备，1，未装备
                        '2' : 0,
                        '3' : 0,
                        '4' : 0,
                    },
                },
                'fight_force': 0,                   // 战斗力
                'slot' : 1,                         // 阵容上的位置
                'attr' : {                          // 属性值
                    '1' : 0,
                    ...
                    '19' : 0,
                },
                'fate_attr' : {                     // 缘分属性加成，用于军团雇佣去掉缘分
                },
                'assist' : {                        // 助阵武将
                    fateId : [],
                },
                'quality' : 0,                      // 武将升星
                'part': {
                    '1': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                    '2': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                    '3': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                    '4': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                    '5': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                    '6': {
                        'awake_level': 0,
                        'max_awake': false,
                        'gems': {
                            '1': 0,
                            '2': 0,
                            '3': 0,
                            '4': 0,
                        },
                    },
                },
            },
            */
        },

        // 上陣的位置對應role index
        'team': {
            '1': {
                //'index':pos,
            },
            //'2':{},
        },

        'hero_bag': {                                // hero
            'index': 1,
            'heros': {/*index:{},*/ },
            'buy': 0, // buy times
            'reset_gem_time': "20200525",
        },

        'bag': {                                    // 背包
            'material': {},                         // 材料
            'gem': {},                              // 宝石
            'fragment': {},                         // 碎片
            'card': {},                             // 卡牌
            'equip': {
                /*
                'eid': {                            // 唯一ID
                    'id':                           // 装备编号
                    'grade' : 0                     // 品级：0-6级
                    'hid':                          // 所属武将的编号
                }
                */
            },
            'dress': {},                           // 小兵装备
            'dragon': {                            // 龙晶
                /*
                gid: {                              // 龙晶唯一id
                    id: 0,                          // 龙晶id
                    dragon: 0,                      // 镶嵌龙
                    attr: {                         // 属性
                        type: value,                // 属性类型: 属性值
                    },
                },
                */
            },
            'limitmat': {                           // 限时道具
                /*
                    mid: {                              // 唯一id
                        id: 0,                          // 道具id
                        expire: 0,                      // 过期时间
                        num: 0,                         // 数量
                    },
                */
            },
            'rune': {                              // 符文
                /*
                rid : {                             // 符文唯一id
                    id : 0,                         // 符文id
                    level : 0,                      // 符文等级
                    base_attr : 0,                  // 基础属性id
                    attrs : [                       // 特殊属性数组
                        [id, value, seq],           // id,值,随机序号
                    ],
                }
                 */
            }
        },

        'cardGetRecord': { // 卡片获取记录

        },

        'equipGetRecord': {    // 装备获取记录

        },

        'runeGetRecord': {     // 符文获取记录

        },

        'keyGetRecord': {      // 钥匙获取记录

        },

        'payment': {
            'pay_list': {                           // 购买记录
                // id: 0,                           // 充值id: 充值次数
            },
            'pay_records': {                        // 购买记录
                // id: 0,                           // 充值id: 充值次数
            },
            'paid': 0,                              // 已经购买元宝数
            'gift_cash': 0,                         // 首次购买赠送和月卡领取的元宝
            'cost': 0,                              // 已经花费金钻
            'cost_bindcash': 0,                    // 已花费的蓝钻
            'week_card': 0,                         // 周卡剩余天数
            'month_card': 0,                        // 月卡剩余天数
            'long_card': 0,                         // 终身卡已领取领取日期, 0为未购买
            'vip_rewards': {                        // vip特权礼包
                // vip: 0,                          // vip等级: 是否已购买
            },
            'vip_rewards_version': gConfVersion["vipReset"] ? gConfVersion["vipReset"].version : 0,
            'money': 0,                             // 已充值的钱数
            'day_money': 0,                         // 每日累计充值金额
            'old_paid': 0,                           //测试的充值金
            'last_pay_money': 0,                     //最后一次充值金额
            'last_pay_time': 0,                      //最后一尺充值时间
        },

        'activity': {
            'cdkey': {},                            // 已领取的cdkey
            'investment': {      //一本万利
                'open_day': 0,
                'isBuy': 0,   //是否购买0 = 未购买1 = 购买
                'loginDayCount': 0, //登陆天数
                'lastLoginTime': 0,//最后登陆时间
                'notShow': 0,//是否显示界面 0 显示 1、不显示  领取完所有的奖励就不再显示
                'rewards': {//奖励领取状态
                    //id : 0未领取 ， 1领取过
                },

            },
            'open_seven': {                         // 七日狂欢
                'open_day': 0,                      // 开启日期
                'progress': {                       // 每个任务目标状态
                    //id: [0, 0],                   // [进度, 是否已领取]
                },
                'rewarded_box': [],                  // 领过奖的箱子
            },

            'doappraise': {
                'open_day': 0,                      // 开启日期
                'doappraise': 0,                      //评价领奖，0 = 未作任何操作 1 = 评价但未领奖 2 = 评价并领取
            },

            'doddqqgroup': {
                'open_day': 0,                      // 开启日期
            },

            'facebook': {
                'open_day': 0,                      // 开启日期
            },

            'zero_gift': {
                'open_day': 0,                      // 开启日期
            },

            'follow_rewards': {
                'open_day': 0,                      // 开启日期
            },

            'open_holiday': {                         // 七日狂欢
                'open_day': 0,                      // 开启日期
                'progress': {                       // 每个任务目标状态
                    //id: [0, 0],                   // [进度, 是否已领取]
                },
                'rewarded_box': [],                  // 领过奖的箱子
            },


            'overvalued_gift': {                    // 超值礼包
                'day': 0,                           // 刷新日期
                'rewards': {                        // 奖励领取状态
                    // id : 0,                      // 物品id : 是否已领取
                },
            },

            'guide': {                              // 引导送物品
                'guide_guanyu': 0,                  // 新手引导送关羽, 领取后记录领取时间
                'guide_treasure': 0,                // 新手引导送砸宝物材料
                'guide_award1': 0,                  // 新手引导送送经验丹
            },

            'level_gift': {                         // 等级礼包
                // id : 0,                          // 等级目标奖励是否已领取
            },

            // 祈愿活动
            'pray': {
                'open_day': 0,                      // 活动开启日期
                'day': 0,                           // 上次重置日期
                'point': 0,                         // 祈愿点数
                'time': 0,                          // 上次祈愿点恢复在线时间总需求
                'recover': 0,                       // 今日祈愿点已恢复点数
                'got': 0,                           // 上一次领奖日期
                'reward': [/*[id, time]*/],         // 请愿奖励, [奖励id, 暴击倍数]
                'options': [/*[id, choose]*/],     // 可选项，[奖励id, 是否已选择]
                'refresh_num': 0,                  // 今日刷新次数
            },

            'login_goodgift': {                     // 登录好礼
                'time': 0,                          // 上次活动开启时间
                'login': 1,                         // 累计登录次数
                'reward': {                         // 领奖状态
                    // day: 1,                      // 已领取天数: 1
                },
            },
            'day_recharge': {                       // 砖石狂欢
                'open_day': 0,                      // 活动开启时间
                'dayCount': 0,                      // 累计充值次数
                'today_status': 0,                   //今天任务是否完成
                'day_paid': 0,                       //今天已经充值数
                'reward': {                         // 领奖状态
                    // day: 1,                      // 已领取天数: 1
                },
            },
            'pay_only': {                           // 充值专享
                'day': 0,                           // 上次刷新日期
                'award': [],                        // 充值奖励
                'paid': 0,                          // 活动期间充值金额
                'buy': {                            // 今日每档每个折扣商品购买次数
                    /*
                    stage: {                        // 充值达标档次
                        id: 0,                      // 该档次折扣商品: 购买次数
                    },
                    */
                },
            },

            'limit_group': {                        // 限时团购
                'day': 0,                           // 上次刷新日期
                'buy': {                            // 今日购买记录
                    // id: 0,                       // 商品id: 今日已购买次数
                },
            },

            'lucky_wheel': {                        // 幸运转轮
                'time': 0,                          // 上次活动开启时间
                'score': 0,                         // 积分
                'reward': {                         // 积分奖励领取记录
                    // score: 0,                    // 积分: 1表示已领取, 未领取没有此项
                },
            },

            'lucky_dragon': {                       // 招财龙
                'open_day': 0,                      // 开启日期
                'use': 0,                           // 已用抽奖次数
                'last': 0,                          // 上次获取元宝数
            },

            'grow_fund': {                          // 成长基金
                'bought': 0,                        // 是否已购买
                'bought_type': 0,                  // 基金类型: 0未购买, 1购买小基金, 2购买大基金
                'rewards': {                       // 奖励领取状态
                    // id ；0,                      // 物品id ：是否已领取
                },
            },

            'accumulate_recharge': {                // 累冲豪礼
                'time': 0,                          // 上次活动开启时间
                'paid': 0,                          // 玩家累计充值的元宝
                'rewards': {                       // 奖励领取状态
                    // id : 0,                      // 物品id : 是否已领取
                },
            },

            'daily_recharge': {                     // 每日充值
                'day': 0,                           // 刷新日期
                'rewards': {                       // 奖励领取状态
                    // id ；0,                      // 物品id ：是否已领取
                },
            },

            'single_recharge': {                    // 单冲有礼
                'time': 0,                         // 上次活动开启时间
                'money': {                         // 每次充值的金额
                    // id : 0,                      // 充值id : 充值金额
                },

                'progress': {                      // 玩家单笔充值的进度
                    // id : 0,                      // id : 次数
                },

                'rewards': {                       // 奖励领取状态
                    // id : 0,                      // 物品id : 领取次数
                },
            },

            'expend_gift': {                        // 消费有礼
                'time': 0,                         // 上次活动的开启时间
                'paid': 0,                         // 玩家在活动期间累积消费的元宝
                'rewards': {                       // 奖励领取状态
                    // id : 0,                      // 物品id : 是否已领取
                },
            },

            'head_reset': {                         // 首冲重置
                'time': 0,                         // 上次活动开启时间
            },

            'tavern_recruit': {                    // 酒馆派对
                'time': 0,                         // 上次活动开启时间
                'frequency': 0,                    // 已招募次数
                'num': 0,                          // 获取武将数目
                'rewards': {                       // 宝箱领取状态
                    // id : 0,                      // 物品id : 是否领取
                },
            },

            'exchange_points': {                   // 积分兑换
                'time': 0,                         // 活动开启时间
                'integral': 0,                     // 积分
                'progress': {                       // 任务进度
                    // id : 0,                      // 任务: 完成进度
                },
                'rewards': {                        // 奖励领取状态
                    // id : 0,                      // 物品id : 是否领取
                },
            },

            'daily_cost': {                        // 每日消耗
                'day': 0,                          // 刷新日期
                'day_cost': 0,                     // 每日累计消耗的元宝
                'rewards': {                       // 奖励领取状态
                    // id : 0,                      // 奖励id : 是否领取
                },
            },

            'day_vouchsafe': {
                'time': 0,                         // 活动开启时间
                'day_pay': 0,                      // 当日是否充值
                'day_money': 0,                     // 当日充值金额
                'rewards': [],                     // 奖励领取
            },

            'promote_exchange': {                    // 封将兑换
                //id : 0                            // id兑换数量
                //time : 0                          // 活动开启时间
            },

            'human_wing': {
                'time': 0,                         // 活动开启时间
                'level': 0,                         // 活动开启时候等级
                'achieve': {
                    //2 : 1,                        // 对应等级的领取状态（1标示领取）
                }
            },

            'human_arms': {
                'time': 0,                         // 活动开启时间
                'level': 0,                         // 活动开启时候等级
                'achieve': {
                    //2 : 1,                        // 对应等级的领取状态（1标示领取）
                }
            },

            'human_mount': {
                'time': 0,                         // 活动开启时间
                'level': 0,                         // 活动开启时候等级
                'achieve': {
                    //2 : 1,                        // 对应等级的领取状态（1标示领取）
                }
            },

            //------------------------------------------------------
            // 'first_pay': {                          // 首冲任务
            //     'progress': {                       // 任务完成进度
            //         /*
            //         id: {                           // 任务id
            //             //id : 0,                   // 任务类型: 进度
            //         },
            //         */
            //     },
            //     'rewards': {                        // 领取进度
            //         //id : 0                        // id: 是否领取
            //     },
            // },
            //------------------------------------------------------
            'rewarded_first_pay': [],                        // 已领取过奖励的首冲任务

            // 平凡招募活动
            'tavern_normal': {
                'count': 0,    // 累计次数
                'award_got': [],   // 领奖记录
            },

            // 奢华招募活动
            'tavern_high': {
                'count': 0,
                'award_got': [],   // 领奖记录
            },

            // 礼包
            'gift_bag': {
                /*
                id : {
                    time: 0,            // 触发或者重置时间
                    buy_count: 0,       // 已经购买的数量
                    sell_out_time: 0,   // 售罄时间
                }
                */
            },

            // 限时兑换
            'limit_exchange': {
                'time': 0,                          // 活动开启时间
                /*
                id : num,                           // id : 数量
                 */
            },            // 限时兑换
            'day_exchange': {
                'time': 0,                          // 活动开启时间
                /*
                id : num,                           // id : 数量
                 */
            },
            'buy_award': {
                'time': 0,
            },

            'lucky_rotation': {                    // 幸运轮盘
                'time': 0,
            },

            'month_rebate': {                      // 月度返利
                'time': 0,
            },

            'manually': {                            // 龙纹手册
                "now_exp": 0,                       // 当前经验值
                "is_unlock": 0,                     // 0-未解锁额外奖励 1-已解锁额外奖励
                "stage": 0,                         // 参与的是第几期
                "rewards": {                        // 基础奖励信息
                    "def_list": [],                 // 已经领取的基础奖励列表
                    "ex_list": [],                  // 已经领取的额外奖励列表
                },
                "task_info": {
                    "task_info": {},                // 任务进度信息  key-任务ID  value-任务完成次数
                    "buy_times": {},                // 购买等级情况 key-购买的等级类型 value-对应购买次数
                    "task_cmpt_time": {},           // 任务是第几天完成的
                }
            },

            'assets_feed': {                            // 资源补给
                "gift_info": {
                    //     index: {                            // 礼包ID
                    //         get_stage: number,                   // 购买的类型 默认为0 购买后会为正数
                    //         get_times: number,                   // 购买后领取的次数
                    //         last_get_day: number,                // 最后一次领取是第几天
                    //     }
                },
            },

            'rank': {                               // 排行活动
                'recharge': {                           // 充值
                    'stage': 0,
                    'value': 0,
                    'time': 99999999999,
                },
                'expense': {                            // 消费
                    'stage': 0,
                    'value': 0,
                    'time': 99999999999,
                }
            },

            'level_up': {                       // 等级礼包
                'open_day': 0,                     // 开启时间
                'target_time': 0,                  // 目标时间
                'can_get': 0,                      // 是否可领取
            }
        },

        'battle': {
            'progress': 1,                          // now进度
            'type': 1,
        },

        'princess': {
            'time': 0,              // 当前过期时间
            'progress': 0,          // 当前进度
            'extra': {
                // progress: 1,      // 急速救援记录
            }
        },

        // 帝王篇
        'custom_king': {
            //'chapter': 0,  // 章节
            'index': 1,    // 组内id

            /*'upgrade_time': {

            },*/

            //'award_get': [],   // 奖励领取记录
        },

        // 宝物篇
        'custom_treasure': [],

        // 村庄篇
        'custom_village': [],

        'barren_land': 0,  // 当前荒地id

        // 巨龙篇
        'dragon': {                                 // 龙培养
            /*
             id: {
                level: 1,                           // 龙等级
                slot: {                             // 龙槽位
                    1: 0,                           // 槽位龙晶id
                    2: 0,                           // 槽位龙晶id
                    3: 0,                           // 槽位龙晶id
                    4: 0,                           // 槽位龙晶id
                    5: 0,                           // 槽位龙晶id
                },
             },
             */
        },

        'equip_valume': gConfGlobal.maxEquipCount, // 背包最大容量
        'dragongem_valume': gConfGlobal.maxDragonGemCount, // 龙晶最大容量

        'promote_wheel': {                         // 封将转盘
            'time': 0,                             // 封将转盘开启时间
            'end_time': 0,                         // 封将转盘结束时间
            'rank_score': 0,                       // 封将转盘排行榜积分
            'orange': {                            // 橙将转盘
                'score': 0,                        // 积分
                'reward': {                        // 积分奖励领取记录
                    // score: 0,                    // 积分: 1表示已领取,未领取没有此项
                },
                'item': [],                         // 累计获取道具
            },
            'red': {                               // 红将转盘
                'score': 0,                        // 积分
                'reward': {                        // 积分奖励领取记录
                    // score: 0,                    // 积分: 1表示已领取,未领取没有此项
                },
                'item': [],                        // 累计获取道具
            },
        },

        'tavern': {                                // 招募
            'ntime': 0,                            // 普通招募下次免费招募时间
            'htime': 0,                            // 高级招募下次免费招募时间

            'nfree': 0,                            // 已经使用的普通招募免费次数
            'hcash': 0,                            // 高级招募是否用过招募令

            'call_count': {                        // 招募次数
                '1': 0,                            // 普通招募次数
                '2': 0,                            // 高级招募次数
            },

            'hero_refresh_time': common.getTime(),                // 兑换英雄上次刷新时间
            'exchange_hid': 0,                     // 当前可兑换的武将id
            'gold_count': 0,                       // 金币招募次数
        },

        // 酒馆服务器独有数据
        'tavern_server': {
            'normal_version': '',                  // 普通招募版本号
            'advanced_version': '',                // 高级招募版本号
            'hero_version': '',                    // 英雄刷新版本号

            'max_cycle': [],                        // 最大周期
            'card_tab': {},                        // 兑换列表
            'award_tab': {},                       // 奖励列表

            'hero_fresh_count': 0,                 // 武将刷新次数
        },

        // 新商店数据
        'shop_new': {
            /*
            'shop_id' : {   // 商店id
                'tab_id' : { // 商店里的索引
                    goods : {           // 商品列表
                        index : {           // 索引
                            groupId : 0,        // 商品组id
                            goodsId : 0,        // 商品id
                            buy : 0,          // 是否已购买
                        },
                    },
                    manual_refresh_count : 0,    // 手动刷新次数
                    buy_count : 0,               // 购买次数
                    refresh_time : 0,            // 上次刷新时间
                },
            },
             */
        },

        'mine': {                                  // 金矿
            'level_id': 0,                         // 等级id
            'zone_id': 0,                          // 矿区id
            'count': 0,                            // 当日成功抢劫抢劫矿的次数
            'occupy_count': 0,                     // 当日成功占领矿的次数
        },

        'arena': {                                 // 竞技场
            'challenge_cd': 0,                     // 挑战冷却时间
            'max_type': 0,                         // 历史最高段位
            'max_rank': 0,                         // 历史最大排名
            'max_cross_rank': 0,                    // 跨服 历史最大排名
            'max_rank_tab': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],    // 每个竞技场最高排名
            'count': 0,                            // 当日已经挑战次数
            'count_cross': 0,                       // 当日跨服挑战次数
            'win_times': 0,                        // 擂台获胜次数
            'award_got': {},                       // 成就奖励领取记录
        },

        // 勇者之塔
        'tower': {
            'top_floor': 0,                             // 历史挑战最高层
            'top_time': 0,                             // 达到历史最高层的时间
            'cur_floor': 0,                             // 当前到多少层    已经挑战的
            'sweep_start_time': 0,                       // 扫荡开始的时间
            'reset_num': 0,                             // 已经重置多少次
            'get_effort': [],                            // 已经领取的成就
        },

        'tower_server': {
            'rune_box_conf_version': 0,                // 配置版本号
            'rune_new_drop_tab': [],                   // 新手符文掉落表
            'rune_drop_tab': [],                       // 符文掉落列表
            'rune_drop_count': 0,                      // 符文掉落次数
            'rune_new_drop_count': 0,                  // 新手阶段的掉落次数
        },

        // 符文使用
        'rune_use': {
            1: [0, 0, 0, 0],
            2: [0, 0, 0, 0],
            3: [0, 0, 0, 0],
            4: [0, 0, 0, 0],
            5: [0, 0, 0, 0],
            6: [0, 0, 0, 0],
            7: [0, 0, 0, 0],
        },

        'mail': {                                  // 已读的系统邮件和系统公告
            // id : 1,                              // 邮件或公告id : 1 已读，2 已删
        },

        'trial': {                             // 试炼数据
            'join_level': 0,                   // 参与等级
            'daily_score': 0,                  // 每周积分
            'week_score': 0,                   // 每日积分
            'explore_count': 0,                // 探索次数
            'round': {                         // 探索记录
                '1': {
                    'reset_count': 0,                  // 重置次数
                    'award_got': 0,            // 是否已领奖
                    'coins': {                 // 每个位置随机出的结果
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                        '5': 0,
                        '6': 0,
                        '7': 0,
                        '8': 0,
                        '9': 0,
                    },
                },
                '2': {
                    'reset_count': 0,                  // 重置次数
                    'award_got': 0,            // 是否已领奖
                    'coins': {                 // 每个位置随机出的结果
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                        '5': 0,
                        '6': 0,
                        '7': 0,
                        '8': 0,
                        '9': 0,
                    },
                },
                '3': {
                    'reset_count': 0,                  // 重置次数
                    'award_got': 0,            // 是否已领奖
                    'coins': {                 // 每个位置随机出的结果
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                        '5': 0,
                        '6': 0,
                        '7': 0,
                        '8': 0,
                        '9': 0,
                    },
                },
            },
            'adventure': {                     // 奇遇
                /*
                 '1' : {
                 'type' : 1,                 // 奇遇类型
                 'param1' : 0,               // 奇遇参数：怪物战力，或道具组id，或元宝数
                 'param2' : 0,               // 参数2：怪人挑战星级，或道具索引
                 'param3' : 0,              // 重置次数，怪人挑战专用
                 'pass' : 0,                 // 是否已通关，怪人挑战专用
                 'award_got' : 0,            // 是否已领奖
                 'time' : 0,                 // 到期时间
                 },
                 */
            },
            'achievement': [],               // 成就领取记录
            'daily_award_got': 0,          // 每日宝箱是否领取
        },

        'adventure_rand': {                        // 探索随机结果，不同步到客户端，隔天要重置
            // 1 : 0
        },

        'task': {
            'daily': {
                // id: count,                       // id对应任务完成的进度
            },
            'daily_reward': {
                // id: 0,                           // id对应奖励是否已领取, 0/1
            },
            'daily_active': 0,                      // 每日活跃度上一次领奖的分数

            'active': 0,                            // 玩家总活跃度

            'nobility': [],                        // 爵位等级

            'privilege': {                         // 特权
                // id: 0,                           // 特权id: 特权值
            },

            'main': {
                // id: 0,                           // id对应任务的完成进度
            },
            'main_reward': {
                // id: 0,                           // id对应任务的领奖进度
            },
            'world_reward': {
                // id: 0,                           // id对应奖励是否领取, 0/1
            },
            'food_get': [],                         //粮草领取id
        },

        // 新手引导任务
        'guide_task': {
            /*
            id : [0, 0],                    // 引导id : [进度，是否已领奖]
             */
        },

        'shipper': {                                // 押镖
            'delivery': 0,                          // 运送次数
            'rob': 0,                               // 抢夺次数
            'rob_time': 0,                          // 上次掠夺时间
            'type': 1,                              // 当前选择的镖车
            'free': 1,                              // 是否可以免费刷新
            'first_refresh': 0,                     // 第一次刷新, 0代表未刷新, 1代表已免费刷新, 2代表已元宝刷新
            'exchangenum': 0,                       // 兑换值用以兑换红色
            'day_first': 0,                        // 每天第一次元宝刷新必出红
        },

        'sign': {
            'day': 0,                               // 上次签到日期
            'count': 0,                             // 已签到次数
            // 'continuous': 0,                        // 连续签到天数
            // 'continuous_reward': 0,                 // 连续奖励是否领取
            'version': '',                           // 签到数据对应的版本
            'round_rewards': [],                     // 本轮七天的奖励数据
            'last_reset_date': 0                    // 上次重置奖励的日期
        },

        'country': {                                // 皇城争霸
            'buy': 0,                               // 今日皇城争霸购买次数
            'challenge': 0,                         // 今日皇城争霸挑战次数
            'score': 0,                             // 国战积分
            'kill': 0,                              // 国战最高连斩
            'join': 0,                              // 国战参与数
            'update_time': 0,                       // 皇城上一次俸禄结算时间
            'day_salary': 0,                       // 当天累计俸禄
            //jadeLastCount                         // 合璧最近一天次数
        },

        'worldwar': {
            'sign_up': 0,                          // 本周是否报过名sign_up
            'match': 0,                            // 当日匹配的次数
            'battle': 0,                           // 当日挑战的次数
            'matched': 0,                          // 上次匹配的对手
            'fighted': 0,                          // 上次匹配的对手是否已经打过
            'worship': 0,                            // 今日膜拜次数
        },

        'altar': {                                 // 祭坛
            /*
            id: 0,                                  // 祈祷类型id: 今日祈祷次数
            */
        },
        'altar_lv': {                                 // 祭坛lv
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            /*
            id: 0,                                  // 祈祷类型id: lv
            */
        },

        'cdkey': {},                               // 已经使用的可重复使用兑换码id

        'digging': {
            'ground': {
                /*
                x: {                                // 坐标X
                    y: 0,                           // 坐标Y: 块信息
                },
                */
            },

            'level': 0,                             // 开启本层时的配置等级
            'tcount': 0,                            // 挖开宝藏数量
            'gcount': 0,                            // 宝藏已出龙晶矿数量
            'all_tcount': 0,                        // 一共的宝藏数量
            'buy': 0,
            'reward': [],                           // 已领取的进度奖励id
            'isdigging': 0,                        // 是否挖过
        },

        'hook_vol': gConfGlobal.hookReposLimit,    // 挂机仓库的容量

        'tips': {                                  // 提醒
            /*
            'daily_task' : 0,                       // 每日任务
            'main_task' : 0,                        // 主线任务
            'world_situation' : 0,                  // 天下形势
            'open_seven' : 0,                       // 七天乐
            'exchange_points' : 0,                  // 积分兑换
            'first_pay' : 0,                        // 首冲任务
            */
        },

        'def_info': {                              // 防守信息
            'set': 0,                              // 是否主动设置过防守信息
            'team': {                              // 防守阵型
                /*
                hid: slot,                          // 武将位置: 阵型位置
                */
            },
            'skills': {                            // 防守君主技能
                '1': 0,                            // 技能槽1设置的技能
                '2': 0,                            // 技能槽2设置的技能
                '3': 0,                            // 技能槽3设置的技能
                '4': 0,                            // 技能槽4设置的技能
                '5': 0,                            // 技能槽5设置的技能
            },
        },

        'war_college': {                           // 战争学院
            'challenge': 0,                        // 受否挑战课程
        },

        'territory_war': {     // 领地战数据
            'open': 0, // 是否开启领地战
            'buy_action_count': 0, // 购买体力次数
            'level': 0,

            'secKill': [], // 可以秒杀的怪物索引列表
            'gather_record': [],   // 一次性资源拾取记录
        },

        'conspiracy': {
            /*
             id : 0,                                // 天下合谋当前等级
             */
        },

        // 头像框状态
        'head_frame_status': {
            /*
             * id : 0, // 0表示未激活，1表示已激活
             * */
        },

        'resback': {                                // 资源找回
            /*
            mod: {                                  // 功能
                day:{
                    awards : [],                     // 日期: 返还奖励, eg: 20100101: [[user, cash, 100]]
                    remainnum : 0,                   // 剩余次数
                    isget:0,                         // 是否找回
                }
            },
            */
        },

        'sky_suit': {                               // 人皇套装
            // 圣武相关
            'weapon_level': 0,                      // 进阶数
            'weapon_energy': 0,                     // 能量值
            'weapon_energy_target': 0,              // 进阶所需能量值
            'weapon_energy_clean_time': 0,          // 能量值清空时间
            'weapon_illusion': 0,                   // 幻化id
            'weapon_illusion_equip_time': {         // 限时道具
                // id : 0,                          // 道具id : 到期时间
            },
            'weapon_illusion_equip': {              // 永久道具
                // id : 1,                          // 道具id
            },
            'weapon_collect': 0,                    // 收集数
            'weapon_gas': 0,                        // 觉醒精气石使用个数
            'weapon_blood': 0,                      // 觉醒精血石使用个数
            'weapon_skills': {                      // 技能
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
            },

            // 圣翼相关
            'wing_level': 0,                        // 进阶数
            'wing_energy': 0,                       // 能量值
            'wing_energy_target': 0,                // 进阶所需能量值
            'wing_energy_clean_time': 0,            // 能量值清空时间
            'wing_illusion': 0,                     // 幻化id
            'wing_illusion_equip_time': {           // 限时道具
                // id : 0,                          // 道具id : 到期时间
            },
            'wing_illusion_equip': {                // 永久道具
                // id : 1,                          // 道具id
            },
            'wing_collect': 0,                      // 收集数
            'wing_gas': 0,                          // 觉醒精气石使用个数
            'wing_blood': 0,                        // 觉醒精血石使用个数
            'wing_skills': {                        // 技能
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
            },

            // 圣骑相关
            'mount_level': 0,                        // 进阶数
            'mount_energy': 0,                       // 能量值
            'mount_energy_target': 0,                // 进阶所需能量值
            'mount_energy_clean_time': 0,            // 能量值清空时间
            'mount_illusion': 0,                     // 幻化id
            'mount_illusion_equip_time': {           // 限时道具
                // id : 0,                           // 道具id : 到期时间
            },
            'mount_illusion_equip': {                // 永久道具
                // id : 1,                           // 道具id
            },
            'mount_collect': 0,                      // 收集数
            'mount_gas': 0,                          // 觉醒精气石使用个数
            'mount_blood': 0,                        // 觉醒精血石使用个数
            'mount_skills': {                        // 技能
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
            },
        },

        'auto_fight': {
            'bag': {                                // 挂机背包
                'material': {},                     // 材料
                'gem': {},                          // 宝石
                'fragment': {},                     // 碎片
                'card': {},                         // 卡牌
                'equip': {},                       // 装备
                'group': {},                       // 组
                'gold': 0,                         // 金币
                'xp': 0,                           // 经验
                'hero_exp': 0,
            },
            'speed_num': 0,                        // 已经加速的次数
            'last_calc_time': 0,                   // 上一次结算时间
            'last_get_time': 0,                    // 上一次领取奖励的时间
            'last_calc_equip_time': 0,
            'last_get_equip_time': 0,
            'monster_level': 1,                    // 小怪等级
            'drop_count': 0,                       // 存储的掉落次数

            // 大本营-boss
            'boss': {
                'already_num': 0,                                // 已经刷新的次数
                'boss_birth': [
                    /*
                        {
                            type : 0,                   // boss type
                            path_id : 0                 // 路径点id
                            click_count : 0,            // 点击次数
                        }
                     */
                ],

                // boss击杀数量
                'boss_kill_count': [],
            },

            // 探索任务
            'search_task': {
                'already_num': 0,                        // 已经探索次数
                'first_come': 1,                        // 是否是第一次进入
                'already_buy': 0,                         // 已经购买的次数
                'already_star_num': 0,                    // 已经升星的次数
                //'speed_task_num' : 0,                   // 马上完成任务次数
                'task_list': {}
                /*
                'task_id':{
                    'task_id':0,                    // 区分多个任务，刷新，完成任务，必传
                    'type' : 0,                     // 任务id
                    'star' : 0,                     // 任务星数
                    'start_time' : 0,               // 开始搜寻的时间
                    'hid' : 0,                      // 派遣的武将
                    'task_level':1,                 // 任务等级
                }
                 */
                ,
            },

            // 魔法阵
            'magic': {
                'msg': {
                    /*
                   id:{
                       start_time:0,               // 开始时间
                       last_time:0,                // 最近一次结算时间
                       limit_time: 0               // 奖励时间间隔
                       max: 0,                     // 判断是否达到上限
                   }
                   */
                },

                'bag': {
                    /*
                        id:[]                       // 对应魔法阵奖励
                     */
                },                                  // 记录奖励背包

                'extra': {
                    /*
                    id:lv
                    */
                }
            },

        },

        // 挂机服务器数据
        'auto_fight_server': {
            'boss_birth_sequence': [],     // boss出生序列
            'boss_create_count': 0,         // 已创建boss数量
            'boss_kill_count': 0,          // 已击杀boss数量
            'boss_last_birth_time': 0,     // 上次刷新boss的时间
            'boss_special_award_index': [],// 特殊掉落索引
            'speed_count': 0,              // 加速挂机次数
        },

        //山洞玩法
        'cave': {
            'cave_arr': [/*gold,chip*/],                    // 格子数组
            'cur_stay': 0,                                 // 当前停留的位置
            'left_num': gConfGlobalNew.customCaveDiceInitNum,     // 剩余的色子数
            'shard': {                                      // 碎片位置
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0
            },
            'put_shard_time': 0,                           // 宝箱凑齐的时间
            'start_reply_time': 0,                         // 开始回复色子数量的开始时间
            'level': 0,                                    // 重置的等级
            'super_box_mar': 0,
        },

        // 战队系统
        'clan': {                                                // 战队系统
            'last_team_id': 0,                                   // 上一个加入的战队id   退出战队当前战队，重新加入，task不清空
            'get_award': 0,                                      // 是否已领取每日奖励
            'can_use_badge': [],                                 // 已经激活的徽章
            'task_award': 0,                                     // 战队每日玩家已领取任务宝箱次数
            'task': 0,                                           // 战队每日玩家已完成任务次数
            'is_impeach': 0,                                     // 是否发起弹劾，发起了弹劾进入战队页面检测
            'refresh_task': {                                    // 任务栏  上限3个 不读配置
                1: [/*id,time*/],                                 // 任务栏位置: [任务编号  1-7,任务开始时间] 任务开始不能刷新当前这个任务
                2: [/*id,time*/],
                3: [/*id,time*/]
            },
        },

        // 军团
        'new_legion': {
            'join_time': 0,                                      // 加入军团时间，
            'wood': {                                            // 木材
                'num': 0,                                        // 当日添加木材的次数
                'time': 0,                                       // 计算冷却时间
                'special': []                                    // 当日特殊奖励在第几次添加木材的时候出现
            },
            'fire': {                                            // 火苗
                'num': 0,
                'time': 0,
                'special': []
            },
            'build': 0,                                              // 建设次数
            'build_awards': { 1: 0, 2: 0, 3: 0, 4: 0 },                    // 领取宝箱记录
            'red_awards': {                                          // 红包奖励
                'operate1': 0,                                       // 柴火
                'operate2': 0,                                       // 火苗
                'level1': 0,                                         // 升级
                'level2': 0,
                'level3': 0,
                'level4': 0,
                'level5': 0,
            },

            'boss': {
                'fight_count': 0,      // 今日军团boss挑战次数
                'inspire_count': 0,    // 今日鼓舞次数
            },
        },

        // 村庄争夺
        'land_grabber': {

        },

        'abyss': {                                       //深渊世界
            'progress': {},                                 // 每个关卡的星级 没有的话代表未通关
            'reward_box': {},                               // 已经获取的奖励区域列表
        },

        'abyss_treasure': {                              //深渊宝藏
            'progress': {},                                 // 每个关卡的星级 没有的话代表未通关
            'reward_box': {},                               // 已经获取的奖励区域列表
        },

        // 雕像祈祷
        'statue_awards': {
            'last_time': 0,                                // 上次祈祷的时间戳
        },

        // 军团战
        'legionwar': {
            'cards': {},                                     // 魔法卡

            // 探索任务
            'search_task': {
                'already_num': 0,                        // 已经探索次数
                'first_come': 1,                        // 是否是第一次进入
                'already_buy': 0,                         // 已经购买的次数
                'already_star_num': 0,                    // 已经升星的次数
                //'speed_task_num' : 0,                   // 马上完成任务次数
                'task_list': {}
                /*
                'task_id':{
                    'task_id':0,                    // 区分多个任务，刷新，完成任务，必传
                    'type' : 0,                     // 任务id
                    'star' : 0,                     // 任务星数
                    'start_time' : 0,               // 开始搜寻的时间
                    'hid' : 0,                      // 派遣的武将
                    'task_level':1,                 // 任务等级
                }
                 */
                ,
            },
        },

        // 军团战赢钻石
        'custom_weal': {
            'total': 0, // yjinglingqu le
            'vip1': 0,  // leiji yuanbao
            'vip2': 0,
        },

        // outline不同步数据
        'outline_rec': {
            'exchg_first': 0,      // 第一轮兑换次数
            'exchg_other': 0,      // 非第一轮兑换次数
            'rand_other': [],     // 伪随机
            'kill_count': {},
            'boss_pass': {},     // boss是否胜利过
        },

        // 新手教学
        'online_stat': {           // 台湾统计数据
            'guide_city': 0,    // 出主城
            'guide_dragon': 0,    // 开启火龙
            'guide_help': 0,    // 开启救公主
            'guide_arena': 0,    // 竞技场引导结束
            'daily_task_count': 0, // 每日活跃任务完成数量
            // 以下两个用于统计总登入设备数
            'guide_create': 0,    // 新创建角色
            'guide_first': 0,    // 进入游戏的第一个引导
        },

        'octopus': {
            'start_week': 0,                   // 开始的星期
            'end_week': 0,                     // 结束的星期
            'start_time': 0,                   // 开始时间
            'end_time': 0,                     // 结束时间
            'heroes_state': {},                // 英雄状态 血量百分比
            'get_reward_ids': {},              // 领奖列表 领取过的代表已经通关的
            'embattle': [],                    // 布阵
            'rank': 0,                         // 快照中的排名
            'target_list': [],                 // 目标列表
        },

        // 杂项数据
        'misc': {
        },

    };

    // 初始化卡槽信息
    /*delet by fish no user.pos
    for (var pos = 1; pos <= MaxPos; pos++) {
        initUser.pos[pos] = {
            'hid': 0,
            'level': 1,
            'xp': 0,
            'equip': {
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '6': 0,
            },
            'destiny': {
                'level': 1,
                'energy': 0,
            },

            'talent': 0,
            'promote': [],
            'soldier': {
                'level': 1,
                'star': 0,
                'dress': {
                    '1': 0,
                    '2': 0,
                    '3': 0,
                    '4': 0,
                },
            },
            'fight_force': 0,
            'slot': pos,
            'attr': {},
            'fate_attr': {},
            'assist': {},
            'quality': 1,
            'part': {
                '1': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '2': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '3': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '4': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '5': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '6': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
            },
        };

        for (var attr in Attribute) {
            initUser.pos[pos]['attr'][Attribute[attr]] = 0;
        }
    }*/

    for (var tKey in logic) {
        var tLogic = logic[tKey];
        if (!tLogic) { continue; }
        if (!tLogic.init_user_data) { continue; }
        tLogic.init_user_data(initUser);
    }

    // 重新生成随机数据
    var indexArr = [];
    for (var i = 1; i <= TrialExploreMaxCount; i++) {
        indexArr.push(i);
        initUser.adventure_rand[i] = 0;
    }

    var maxCnt = Object.keys(gConfLegionTrialAdventure).length;
    for (var i = 1; i <= maxCnt; i++) {
        var conf = gConfLegionTrialAdventure[i];
        var min = conf.times[0];
        var max = conf.times[1];
        var count = Math.floor(common.randRange(min, max));

        for (var j = 1; j <= count; j++) {
            var newIndex = common.randRange(1, indexArr.length - 1);
            var realIndex = indexArr[newIndex];
            initUser.adventure_rand[realIndex] = i;
            indexArr.remove(realIndex);
        }
    }

    // 初始化征战信息
    /*
    initUser.battle.max_progress = Object.keys(gConfCustom).max();
    var city = initUser.battle.city;
    for (var cid in gConfCustom) {
        city[cid] = {
            '1': {
                'star': 0,
                'time': 0,
                'reset_num': 0,
            },

            '2': {
                'star': 0,
                'time': 0,
                'reset_num': 0,
            },

            '3': {
                'star': 0,
                'time': 0,
                'reset_num': 0,
            },
        };
    }
    initUser.battle.city = city;
    */

    // 初始化封爵信息
    initUser.task.nobility[0] = 1;
    initUser.task.nobility[1] = 0;

    /* 初始化天命升级 delet by fish now only use awake
    var pos = initUser.pos;
    for (var p in pos) {
        var posObj = pos[p];
        var confDestiny = gConfDestiny[posObj.destiny.level];
        var chance = confDestiny.baseProb / 100;
        var maxTry = 10000;
        posObj.destiny.expect = confDestiny.minUpEnergy;
        while (maxTry-- && Math.random() > chance && posObj.destiny.expect < confDestiny.maxEnergy) {
            posObj.destiny.expect += Math.floor(confDestiny.getEnergy);
        }

        if (posObj.destiny.expect > confDestiny.maxEnergy) {
            posObj.destiny.expect = confDestiny.maxEnergy;
        }
        posObj.destiny.expect = Math.floor(posObj.destiny.expect);
    }*/

    //--------------------------------------------------
    // // 初始化首冲任务进度
    // for (var id = 1; id <= gConfAvFirstPay.max; id++) {
    //     initUser.activity.first_pay.progress[id] = {
    //         '1': 0,
    //         '2': 0,
    //     };
    // }
    //--------------------------------------------------

    // 初始化签到数据
    initUser.sign.version = gConfVersion.signInReset;
    initUser.sign.last_reset_date = getGameDate();
    initUser.sign.round_rewards = [];
    for (var i = 1; i <= 7; i++) {
        initUser.sign.round_rewards.push(gConfSign[2][i]['reward']);
    }

    return initUser;
};

Player.prototype = {
    init: function (fields, callback) {
        if (fields && (typeof (fields) == 'object') &&
            Object.getOwnPropertyNames(fields).length > 0) {
            // 加载玩家部分数据
            fields['ai'] = 1;
        }

        var player = this;

        // 读取玩家数据
        gDBUser.findOne({ _id: player.uid }, fields, function (err, doc) {
            if (!doc) {
                if (err) {
                    callback && callback(false);
                } else {
                    //创建新用户
                    player.user = Player.create(player.uid);
                    player.getPlayerMemData();
                    player.addHero(gConfGlobalNew.initHero, 1);
                    player.addInTeam(1, 1, 1);
                    // player.addHero(gConfGlobalNew.initHero2, 1);
                    // player.addInTeam(2, 1, 2);
                    player.getPlayerMemData(true);// pos init
                    var firstAwards = gConfSpecialReward['first_play_award'].reward;
                    player.addAwards(firstAwards, 'player', 'init');
                    //player.onCardGetCallback(gConfGlobalNew.initHero2, 1);

                    {   // 穿装备
                        //var awards = parseAwardsConfig(gConfGlobalNew.initEquip1);
                        //var addedAwards = player.addAwards(awards, "init_player", "lord1");
                        //player_wear(player, 1, addedAwards);

                        // 不给小萝莉发装备
                        // var awards = parseAwardsConfig(gConfGlobalNew.initEquip2);
                        // var addedAwards = player.addAwards(awards, "init_player", "lord2");
                        // player_wear(player, 2, addedAwards);
                    }

                    // 初始高级招募不免费
                    var now = common.getTime();
                    //player.user.tavern.htime = now + gConfGlobalNew.tavernAdvancedFreeInterval * 3600;

                    //player.getFightForce();

                    gDBUser.insertOne(player.user, function (err, result) {
                        if (err) {
                            callback && callback(false);
                        } else {
                            callback && callback(true);
                        }
                    });

                    // 初始化等级活动, 但为等级1开启
                    var activities = gOpenLevelActivities[1];
                    if (activities) {
                        for (var i = 0, len = activities.length; i < len; i++) {
                            player.openActivity(activities[i]);
                        }
                    }

                    // 检测活动是否开启

                    for (var item in player.user) {
                        player.markDirty(item);
                    }
                }
            } else {
                player.user = doc;

                player.resetSomeData();
                player.checkVersion();
                player.getPlayerMemData();
                callback && callback(true);
            }
        });
    },

    resetSomeData: function () {
        var user = this.user;
        user.payment = user.payment || {};

        var tResetVersion = gConfVersion["vipReset"] ? gConfVersion["vipReset"].version : 0;                       // 重置vip礼包领取信息
        user.payment.vip_rewards_version = user.payment.vip_rewards_version || 0;

        if (user.payment.vip_rewards_version != tResetVersion) {
            user.payment.vip_rewards_version = tResetVersion;
            user.payment.vip_rewards = {};
            this.markDirty('payment');
        }

        user.payment.money = (user.payment.money - 0) || 0;
        this.markDirty('payment');

        for (var tKey in logic) {                       // 登陆时重置
            var tLogic = logic[tKey];
            if (!tLogic) { continue; }
            if (!tLogic.reset_by_login) { continue; }
            tLogic.reset_by_login(this);
        }
    },

    save: function (force, callback) {
        // 合并写入
        var haveDirty = false;
        for (var key in this.dirty) {
            haveDirty = true;
            this.allDirty[key] = this.dirty[key];
        }

        this.dirty = {};

        if (haveDirty) {
            this.saveCount += 1;
        }

        if ((!force && this.saveCount < 10) || (Object.keys(this.allDirty).length == 0)) {
            // 10次数据库操作必写入
            callback && callback(true);
            return;
        }

        var updates = { $set: {}, $unset: {} };
        var arrangedDirty = this.arrangeDirty(this.allDirty);
        for (var item in arrangedDirty) {
            var remove = arrangedDirty[item];
            if (remove) {
                updates['$unset'][item] = 1;
            } else {
                var obj = this.user;
                var args = item.split(".");
                var ok = true;
                for (var i = 0; i < args.length; i++) {
                    if (typeof (obj) != 'object') {
                        // 未找到
                        ok = false;
                        break;
                    }
                    obj = obj[args[i]];
                }

                if (ok && obj != undefined && obj != NaN && obj != null) {
                    updates['$set'][item] = obj;
                } else {
                    ERROR('invalid save: ' + item);
                }
            }
        }

        this.allDirty = {};
        this.saveCount = 0;

        var toUpdate = 2;

        if (Object.keys(updates['$unset']).length == 0) {
            delete updates['$unset'];
            toUpdate--;
        }

        if (Object.keys(updates['$set']).length == 0) {
            delete updates['$set'];
            toUpdate--;
        }

        if (toUpdate) {
            gDBUser.update({ _id: this.uid }, updates, function (err, result) {
                if (err) {
                    ERROR(util.format('%d SAVE %j %j', this.uid, updates, err));
                    this.saveError = true;
                    callback && callback(false);
                } else {
                    callback && callback(true);
                }
            }.bind(this));
        }
    },

    saveAll: function () {
        gDBUser.save(this.user, function (err, result) {
        });
    },

    nextId: function () {
        this.user.ai += 1;
        this.markDirty('ai');
        return this.user.ai;
    },

    // 重置试炼探索随机数据
    resetAdventureRand: function () {
        this.user.adventure_rand = {};

        // 重新生成随机数据
        var indexArr = [];
        for (var i = 1; i <= TrialExploreMaxCount; i++) {
            indexArr[i] = i;
            this.user.adventure_rand[i] = 0;
        }

        var maxCnt = Object.keys(gConfLegionTrialAdventure).length;
        for (var i = 1; i <= maxCnt; i++) {
            var conf = gConfLegionTrialAdventure[i];
            var min = conf.times[0];
            var max = conf.times[1];
            var count = Math.floor(common.randRange(min, max));

            for (var j = 1; j <= count; j++) {
                var newIndex = common.randRange(1, indexArr.length - 1);
                var realIndex = indexArr[newIndex];
                this.user.adventure_rand[realIndex] = i;
                indexArr.remove(realIndex);
            }
        }

        this.markDirty('adventure_rand');
    },

    resetByDay: function (today) {
        DEBUG(`-------zcg: player resetByDay ${this.uid}, ${today}`)
        var player = this;
        // 共用数据
        var user = this.user;
        var dayDiff = common.getDateDiff(today, user.mark.day);

        if (!user.mark.day) {
            // 微蓝首发，充值返还
            // if (config.platform == 'winner_3') {
            var phpReq = {
                uid: this.uid,
                act: 'pay_back',
                args: {
                    openid: this.user.info.account,
                },
            };
            var phpResp = {};
            requestPHP(phpReq, phpResp, function () {
                if (phpResp.code != 0) {
                    return;
                }

                if (phpResp.data.isPayBack == 1) {//为1表示 已经返过利了
                    return;
                }
                var conf = gConfMail[1012];
                if (conf) {
                    // 返还金钻、蓝钻、vip经验等
                    var cashNum = phpResp.data.cash * 10;
                    var bindcashNum = phpResp.data.cash * 30;
                    var vipExpNum = phpResp.data.cash * 10;
                    var awards = [['user', 'vip_xp', vipExpNum], ['user', 'cash', cashNum], ['user', 'bindcash', bindcashNum]];

                    if (phpResp.data.cash && phpResp.data.cash > 0) {
                        user.payment.old_paid = phpResp.data.cash * 10;
                        player.markDirty('payment');
                    }

                    if (phpResp.data.weekcard && phpResp.data.weekcard > 0) {//返还周卡
                        awards.push(['weekcard', 400001, phpResp.data.weekcard]);
                        var awardAry = parseAwardsConfig(gConfGlobalNew.weekCardSpecialAward);
                        for (var num = 0; num < phpResp.data.weekcard; num++) {
                            for (var i = 0; i < awardAry.length; i++) {
                                awards.push(awardAry[i]);
                            }
                        }

                    }

                    if (phpResp.data.monthcard && phpResp.data.monthcard > 0) {//返还月卡
                        awards.push(['monthcard', 400002, phpResp.data.monthcard]);
                        var awardAry = parseAwardsConfig(gConfGlobalNew.monthCardSpecialAward);
                        for (var num = 0; num < phpResp.data.monthcard; num++) {
                            for (var i = 0; i < awardAry.length; i++) {
                                awards.push(awardAry[i]);
                            }
                        }

                    }

                    if (phpResp.data.grow_fund && phpResp.data.grow_fund > 0) {//激活成长基金
                        var growFund = user.activity.grow_fund;
                        growFund.bought = 1;
                        growFund.bought_type++;
                        player.markDirty('activity.grow_fund.bought');
                        player.markDirty('activity.grow_fund.bought_type');

                        var growReq = {
                            'act': 'buy_grow_fund',
                            'mod': 'activity',
                            'uid': player.uid,
                            'args': {}
                        };
                        var growResp = {};
                        requestWorld(growReq, growResp, function () { });
                    }

                    var mail = {
                        content: [1012, phpResp.data.cash],
                        awards: awards,
                        time: common.getTime(),
                        expire: common.getTime() + gConfMail[1012].time * OneDayTime,
                    };

                    var reqWorld = {
                        mod: 'mail',
                        act: 'add_mail',
                        uid: user.info.uid,
                        args: {
                            mail: mail,
                        },
                    };
                    requestWorld(reqWorld, {});
                }
            });
            // }
        } else {
            if (dayDiff >= 1) {
                //ResBack.calc_resback(this, today, dayDiff > 7 ? 7 : dayDiff);
            }
        }

        // 重置篝火
        user.new_legion.wood.num = 0;
        user.new_legion.wood.time = 0;
        user.new_legion.fire.time = 0;
        user.new_legion.fire.num = 0;
        // 重置篝火每日特殊奖励
        var woodOpt = gConfGlobalNew.legionBonfire_operate1.split('|');
        var fireOpt = gConfGlobalNew.legionBonfire_operate2.split('|');

        user.new_legion.wood.special = this.initBonFireSpecial(woodOpt);
        user.new_legion.fire.special = this.initBonFireSpecial(fireOpt);

        user.new_legion.boss.fight_count = 0;
        user.new_legion.boss.inspire_count = 0;

        // 重置每日建设
        user.new_legion.build = 0;
        user.new_legion.build_awards = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // 重置军团红包领取记录
        user.new_legion.red_awards.operate1 = 0;
        user.new_legion.red_awards.operate2 = 0;
        user.new_legion.red_awards.level1 = 0;
        user.new_legion.red_awards.level2 = 0;
        user.new_legion.red_awards.level3 = 0;
        user.new_legion.red_awards.level4 = 0;
        user.new_legion.red_awards.level5 = 0;

        this.markDirty('new_legion.build');
        this.markDirty('new_legion.build_awards');
        this.markDirty('new_legion.wood');
        this.markDirty('new_legion.fire');
        this.markDirty('new_legion.boss');
        this.markDirty('new_legion.red_awards');

        user.mark.login_today_time = common.getTime();
        user.mark.day = today;
        user.mark.login_days++;
        this.markDirty('mark.day');
        this.markDirty('mark.login_days');
        // this.updateFirstPayProgress('login_days');

        user.mark.boss_notice = [];
        this.markDirty('mark.boss_notice');

        // // 重置副本征战次数与巡逻加速次数
        /* fish
        // user.battle.patrol_accelerate = 0;
        // this.markDirty('battle.patrol_accelerate');

        var city = user.battle.city;
        var nextCity = user.battle.progress;
        if (city[nextCity + 1]) {
            nextCity++;
        }

        for (var i = 1; i <= nextCity; i++) {
            city[i][1].time = 0;
            city[i][2].time = 0;
            city[i][3].time = 0;
            city[i][1].reset_num = 0;
            city[i][2].reset_num = 0;
            city[i][3].reset_num = 0;
        }
        this.markDirty('battle.city');
        */

        // 重置争太守次数
        // user.battle.lord.count = 0;
        // this.markDirty('battle.lord.count');

        // 重置每日切磋购买
        // user.battle.combat_reset = {};
        // this.markDirty('battle.combat_reset');

        // 重置每日精英购买
        // user.battle.elite_reset = {};
        // this.markDirty('battle.elite_reset');

        // 重置每日城池进贡
        // user.battle.city_tribute = {};
        // this.markDirty('battle.city_tribute');

        // 重置乐浪太守掉落
        // user.battle.self_lord_drop = 0;
        // this.markDirty('battle.self_lord_drop');

        // 重置手动刷新次数和购买次数
        for (var id in user.shop_new) {
            var shop = user.shop_new[id];
            for (var tab in shop) {
                var tabInfo = shop[tab];
                tabInfo.manual_refresh_count = 0;
                tabInfo.buy_count = 0;
                this.markDirty(util.format('shop_new.%d.%d.manual_refresh_count', parseInt(id), parseInt(tab)));
                this.markDirty(util.format('shop_new.%d.%d.buy_count', parseInt(id), parseInt(tab)));
            }
        }

        // 重置神将、装备商店免费刷新次数
        var privilege = user.task.privilege;
        var godStorePrivilegeId = gConfNobiltyTitleKey['godShopRefresh'].id;
        var equipStorePrivilegeId = gConfNobiltyTitleKey['equipShopRefresh'].id;
        if (privilege[godStorePrivilegeId]) {
            user.status.free_gtoken = privilege[godStorePrivilegeId];
            this.markDirty('status.free_gtoken');
        }

        if (privilege[equipStorePrivilegeId]) {
            user.status.free_mtoken = privilege[equipStorePrivilegeId];
            this.markDirty('status.free_mtoken');
        }

        // 重置金矿
        user.mine = {
            'level_id': 0,
            'zone_id': 0,
            'count': 0,
            'occupy_count': 0,
        };
        this.markDirty('mine');

        // 重置竞技场
        user.arena.count = 0;
        this.markDirty('arena.count');
        user.arena.count_cross = 0;
        this.markDirty('arena.count_cross');
        user.arena.buy_num = 0;
        this.markDirty('arena.buy_num');

        // 重置勇者之塔
        var tower = user.tower;
        tower.reset_num = 0;
        this.markDirty('tower');

        // 重置黑森林探索
        var auto_fight = user.auto_fight;
        auto_fight.speed_num = 0;
        auto_fight.speed_time = 0;
        auto_fight.search_task.already_buy = 0;
        auto_fight.search_task.already_num = 0;
        auto_fight.search_task.already_star_num = 0;
        this.markDirty('auto_fight');

        // 重置山洞筛子数
        // user.cave.left_num = gConfGlobalNew.customCaveDiceInitNum;
        // this.markDirty('cave.left_num');

        // 重置试炼数据
        user.trial.join_level = user.status.level;
        user.trial.explore_count = 0;
        user.trial.reset_count = 0;
        user.trial.daily_score = 0;
        for (var i = 1; i <= 3; i++) {
            user.trial.round[i].award_got = 0;
            for (var j = 1; j <= 9; j++) {
                user.trial.round[i].coins[j] = 0;
            }
        }
        user.trial.adventure = {};
        user.trial.daily_award_got = 0;
        this.markDirty('trial');

        this.resetAdventureRand();

        // 重置每日任务, 月卡, 终身卡
        user.task.daily = {};
        user.task.daily_reward = {};
        user.task.daily_active = 0;
        user.task.food_get = [];

        // 玩家身上有多个月卡，发放未激活的奖励
        //this.spare_month_card_award();

        // 重置周卡领取
        var payment = user.payment;
        if (payment.week_card) {
            LOG(util.format(`-- 修改周卡领取 ${user.info.uid} [ ${payment.week_card} - ${dayDiff} ]`));
            payment.week_card -= dayDiff;
            if (payment.week_card <= 0) {
                payment.week_card = 0;
            } else {
                user.task.daily[gConfDailyTask['weekCard']] = 1;
            }
            this.markDirty('payment.week_card');
        }

        // 重置月卡领取
        if (payment.month_card) {
            LOG(util.format(`-- 修改月卡领取 ${user.info.uid} [ ${payment.month_card} - ${dayDiff} ]`));
            payment.month_card -= dayDiff;
            if (payment.month_card <= 0) {
                payment.month_card = 0;
            } else {
                user.task.daily[gConfDailyTask['monthCard']] = 1;
            }
            this.markDirty('payment.month_card');
        }

        // 重置终身卡领取
        if (user.payment.long_card) {
            user.task.daily[gConfDailyTask['longCard']] = 1;
        }
        this.markDirty('task.daily');
        this.markDirty('task.daily_reward');
        this.markDirty('task.daily_active');
        this.markDirty('task.food_get');
        player.doOpenHoliday('login');
        // 重置押镖
        user.shipper.delivery = 0;
        user.shipper.rob = 0;
        user.shipper.rob_time = 0;
        user.shipper.type = 1;
        user.shipper.free = 1;
        user.shipper.day_first = 0;
        this.markDirty('shipper');

        // 重置跨服战数据
        user.worldwar.match = 0;
        user.worldwar.battle = 0;
        user.worldwar.matched = 0;
        user.worldwar.fighted = 0;
        user.worldwar.worship = 0;
        this.markDirty('worldwar');

        // 重置皇城争霸次数
        user.country.challenge = 0;
        user.country.buy = 0;
        user.country.day_salary = 0;

        user.country.update_time = this.getCountrySalaryStartTime();    // 设置为每天俸禄开始时间
        this.markDirty('country.buy');
        this.markDirty('country.challenge');
        this.markDirty('country.day_salary');
        this.markDirty('country.update_time');

        // 重置祭坛祈祷次数
        for (var id in user.altar) {
            user.altar[id] = 0;
            this.markDirty('altar.' + id);
        }

        // // 重置连续签到领取状态
        // user.sign.continuous_reward = 0;
        // this.markDirty('sign.continuous_reward');
        // if (common.getDateDiff(today, user.sign.day) != 1) {
        //     user.sign.continuous = 0;
        //     this.markDirty('sign.continuous');
        // }

        // 检测并重置签到数据
        this.checkAndResetSign()

        // 重置每日充值
        user.payment.day_money = 0;
        this.markDirty('payment.day_money');
        user.payment.day_paid = 0;
        this.markDirty('payment.day_paid');


        // 重置每日提醒
        if (user.tips.daily_task) {
            delete user.tips.daily_task;
            this.markDirty('tips.daily_task');
        }
        if (user.tips.active_task) {
            delete user.tips.active_task;
            this.markDirty('tips.active_task');
        }

        // 重置每日在线时间
        user.mark.online_time = 0;
        this.markDirty('mark.online_time');

        // 重置酒馆免费招募信息
        user.tavern.nfree = 0;
        user.tavern.gold_count = 0;
        this.markDirty('tavern.nfree');
        this.markDirty('tavern.gold_count');

        // 充值积分兑换充值奖励
        if (isActivityStart(this, 'exchange_points')) {
            var exchangePoints = this.user.activity.exchange_points;
            if (exchangePoints.time < gConfAvExchangePointsTime[1].startTime) {
                exchangePoints.time = gConfAvExchangePointsTime[1].startTime;
                exchangePoints.interval = 0;
                exchangePoints.progress = {};
                exchangePoints.rewards = {};
                this.markDirty('activity.exchange_points');
            }

            var payCash = 'payCash';
            for (var id in gConfAvExchangePointsKey['payCash']) {
                delete exchangePoints.rewards[id];
                delete exchangePoints.progress[payCash];
                this.markDelete('activity.exchange_points.rewards.' + id);
                this.markDelete('activity.exchange_points.progress.' + payCash);
            }
        }

        // 重置挖矿
        user.digging.level = 0;
        user.digging.isdigging = 0;
        this.markDirty('digging.level');
        this.markDirty('digging.isdigging');
        user.status.digging = gConfGlobalNew.diggingToolInit;
        this.markDirty('status.digging');

        // 发放行军令
        if (isModuleOpen_new(this, 'infinite_battle')) {
            user.status.shas += gConfGlobal.shasCountPerDay * dayDiff;
            if (user.status.shas >= gConfGlobal.shasMaxCount) {
                user.status.shas = gConfGlobal.shasMaxCount;
            }
            this.markDirty('status.shas');
        }

        // 重置领地战数据
        user.territory_war.buy_action_count = 0;
        this.markDirty('territory_war.buy_action_count');

        // 重置每日世界聊天次数
        user.mark.day_world_chat_count = 0;
        this.markDirty('mark.day_world_chat_count');

        // 每日任务月卡、终身卡
        if (user.payment.month_card) {
            this.doDailyTask('doubleCard', 1);
        }

        if (user.payment.week_card) {
            this.doDailyTask('doubleCard', 1);
        }

        // 重置服战物资
        if (user.status.goods) {
            user.status.goods = 0;
            this.markDirty('status.goods');
        }

        // 重置小队数据
        if (user.clan) {
            user.clan.task = 0;
            user.clan.get_award = 0;
            user.clan.task_award = 0;

            this.markDirty('clan.task');
            this.markDirty('clan.get_award');
            this.markDirty('clan.task_award');
        }

        // 重置许愿数据
        var pray = user.activity.pray;
        if (pray) {
            var gotDay = pray.got;
            if (pray.reward.length == 0) {
                // 昨天没有许愿
                gotDay = today;
            }
            user.activity.pray = {
                'open_day': pray.open_day,
                'day': today,
                'point': 0,
                'time': 0,
                'recover': 0,
                'got': gotDay,
                'reward': pray.reward,
                'options': [],
                'refresh_num': 0,
            };
            this.markDirty('activity.pray');
        }

        // if (isActivityStart(this, 'day_recharge')) {
        //充值砖石狂欢活动天任务是否完成
        var day_recharge = user.activity.day_recharge;
        if (!day_recharge) {
            user.activity.day_recharge = {
                'open_day': 0,                      // 活动开启时间
                'dayCount': 0,                      // 累计充值次数
                'today_status': 0,                   //今天任务是否完成
                'day_paid': 0,                       //今天已经充值数
                'reward': {                         // 领奖状态
                    // day: 1,                      // 已领取天数: 1
                },
            };
            day_recharge = user.activity.day_recharge;
        }
        day_recharge.day_paid = 0;
        day_recharge.today_status = 0;
        this.markDirty('activity.day_recharge');
        DEBUG(`day_recharge.day_paid`)
        // }

        // if (isActivityStart(this, 'accumulate_recharge')) {
        user.activity.accumulate_recharge = {
            'time': 0,                          // 上次活动开启时间
            'paid': 0,                          // 玩家累计充值的元宝
            'rewards': {                       // 奖励领取状态
                // id : 0,                      // 物品id : 是否已领取
            },
        };
        this.markDirty('activity.accumulate_recharge');
        // }

        // 重置荒地
        this.randBarrenLand();

        // 刷新礼包
        this.updateGiftBags();

        // 在线奖励(充值BOSS攻击次数)
        if (this.user.mark.outline) {
            this.user.mark.outline.boss.fight_num = 0;
            player.markDirty('mark.outline');
        }

        if (this.user.online_stat) {
            this.user.online_stat.daily_task_count = 0;
            player.markDirty('online_stat.daily_task_count');
        }

        // 月度返利充值
        act_month_rebate.reset_monthly(this);

        for (var tKey in logic) {
            var tLogic = logic[tKey];
            if (!tLogic) { continue; }
            if (!tLogic.reset_by_day) { continue; }
            tLogic.reset_by_day(this, today);
        }
    },

    // 检测战队成员离线时间，自动解散战队
    resetTeamByDay: function () {
        // 由于小队数据在World中，所以不能在登陆时立即检测重置操作，需要在World同步数据后再检测
        // 避免服务器重启后，memData数据为空情况
        if (this.memData.team_id != 0) {
            var reqJson = {};
            reqJson.uid = this.uid;
            reqJson.args = {};
            reqJson.mod = 'clan';
            reqJson.act = 'auto_dissolve_team';
            requestWorld(reqJson, {});
        }
    },

    resetByWeek: function () {
        var user = this.user;

        // 重置擂台数据
        user.status.arena_level = 1;
        user.status.arena_xp = 0;
        this.markDirty('status.arena_level');
        this.markDirty('status.arena_xp');

        // 重置跨服战数据
        user.worldwar.sign_up = 0;
        user.worldwar.registed = 0;
        this.markDirty('worldwar.sign_up');
        this.markDirty('worldwar.registed');

        user.trial.week_score = 0;
        user.trial.achievement = [];
        user.status.trial_coin = 0;
        this.markDirty('trial.week_score');
        this.markDirty('trial.achievement');
        this.markDirty('status.trial_coin');

        // 重置领地战数据
        user.territory_war.level = user.status.level;
        this.markDirty('territory_war.level');

        // 清理密匣，无尽傀儡
        for (var i = 1; i <= 3; i++) {
            var materialId = 310000 + i;
            var cnt = this.getMaterialCount(materialId);
            if (cnt > 0) {
                var costs = [['material', materialId, -cnt]];
                this.addAwards(costs);
            }
        }

        // 每周活动数据重置
        act_lucky_rotate.reset_weekly(this);
    },

    resetByMonth: function () {
        // this.user.sign.count = 0;
        // this.markDirty('sign.count');
    },

    // 获取玩家的内存数据，这些数据不会存数据库
    getPlayerMemData: function (force) {
        if (!this.memData || force) {
            this.memData = {
                //'all_star': 0,                      // 通关的总星星数
                //'star_num': 0,                     // 星星数量
                'moon_num': 0,                     // 月亮数量
                'sun_num': 0,                      // 太阳数量
                'ffchanged': 1,                     // 战斗力是否发生了变化
                'fight_force': 0,                   // 总战斗力
                'pos': {                            // 每个卡槽信息
                    /*
                    hid : {
                        'ffchanged' : 0,            // 武将战斗力是否变化
                        'innate' : {                // 突破成长对武将的加成
                            pos : [innateId, value] // 位置 : 对此武将的属性加成id, 值
                        }

                        'equip_suit_count' : {},    // 套装件数
                        'equip_changed' : {},       // 发生变化的装备位置
                        'uni_equip_changed' : {},   // 跨服服发生变化的装备位置

                        //'rune_changed' : {},        // 发送变化的符文位置
                    }
                    */
                },
                'pos_count': 0,                     // 已上阵的武将数量
                'equip_num': 0,                     // 未被装备的装备数量
                'dragongem_num': 0,                 // 未被装备的龙晶数量
                'limitmat': [                       // 限时道具过期队列
                    /* [mid, expire] */             // 道具唯一id, 过期时间
                ],

                'enemy_id': '',                     // PVP状态下匹配对手UID
                'fight_info': 0,                    // 战斗己方信息
                'fight_enemy': 0,                   // 战斗敌方信息
                'rand1': 0,                         // 战斗随机数1
                'rand2': 0,                         // 战斗随机数2
                'rand_pos': 0,                      // 战斗校验武将选取位置
                'rand_attrs': [],                   // 战斗校验属性选取
                'fight_time': 0,                    // 战斗开始时间
                'status': '',                       // 当前战斗状态(金矿,爬塔,军团试炼,竞技场,押镖)

                'chapter': 0,                       // 当前攻打军团副本章节ID
                'progress': 0,                      // 当前攻打军团副本进度ID

                'mine_id': 0,                       // 当前准备占领的金矿id
                'deposit': 0,                       // 打金矿的押金

                'arena_enemy': {},                  // 竞技场刷新的对手

                'legion_id': 0,                     // 玩家军团id
                'legion_name': '',                  // 玩家军团名称
                'legion_level': 0,                  // 军团等级
                'legion_war_level': 0,              // 军团战段位
                'legion_icon': [],                  // 军团icon
                'hire_owners': [],                  // 雇佣武将的玩家uid
                'hire_hids': [],                    // 雇佣的武将id

                'team_id': 0,                      // 战队id
                'team_name': '',                     // 战队名字
                'team_level': 0,                     // 战队等级

                'dirty': {},                        // 用于向世界服更新玩家数据
                'uni_dirty': {},                    // 跨服战的更新数据
                'land_grabber_dirty': {},          // 跨服村庄更新数据

                'use_cash': 0,                      // 跨服战排位赛是否使用元宝
                'score_add': 0,                     // 排位赛临时积分变化，打完后要返回去
                'updated_worldwar': 0,              // 是否已经更新过跨服服务数据

                'wss_login': 0,                     // 长连接握手时间

                'village_id': 0,                   // 当前小队占领的村庄id
                'village_land': [],                // 当前占领的地块【村庄ID，地块id】
                'village_o_ts': 0,                 // 当前占领村庄的时间戳, 用于异步控制 o=occupy
                'village_f_ts': 0,                 // 当前战斗村庄的时间戳, 用于异步控制 f=fight
            };

            var team1 = this.user.team[1];
            for (var hid in team1) {
                var pos = team1[hid];
                this.memData.pos[hid] = {
                    'ffchanged': 1,
                    //'fate': [],
                    'innate': {},
                    'equip_suit_count': {},
                    'equip_changed': {},
                    'uni_equip_changed': {},
                    //'rune_changed': {},
                };

                if (hid) {
                    this.memData.pos_count++;
                }
            }

            // 获取缘分
            //this.getFateMap();

            // 获取全体突破加成
            this.getInnateMap();

            // 获取未装备的装备数量
            var bag = this.user.bag;
            for (var eid in bag.equip) {
                var equip = bag.equip[eid];
                if (!equip.pos) {
                    this.memData.equip_num++;
                }
            }

            // 获取未装备的龙晶数量
            for (var gid in bag.dragon) {
                var gem = bag.dragon[gid];
                if (!gem.dragon) {
                    this.memData.dragongem_num++;
                }
            }

            // 获取限时道具过期队列
            for (var mid in bag.limitmat) {
                var mat = bag.limitmat[mid];
                this.memData.limitmat.push([+mid, mat.expire]);
            }
            this.memData.limitmat.sort(function (item1, item2) {
                return item1[1] - item2[1];
            });

            // 获取未使用的星星数
            //this.getStar();

            // 获取套装数据
            this.getSuits();

            // 转换dirty
            for (var item in this.dirty) {
                this.memData.dirty[item] = 0;
                if (this.user.worldwar.registed && (item.split('.') in gWorldWarUser) && this.memData.updated_worldwar) {
                    this.memData.uni_dirty[item] = 0;
                }

                if (this.isNeedSyncToLandGrabber() && (item.split('.') in gLandGrabberUser)) {
                    this.memData.land_grabber_dirty[item] = 0;
                }
            }
        }
    },

    arrangeDirty: function (dirty) {
        var arrangedDirty = {};

        for (var item in dirty) {
            var dirtyType = dirty[item];

            var needRemove = [];
            var addNew = true;
            var levels = item.split('.');
            for (var eitem in arrangedDirty) {
                var elevels = eitem.split('.');
                if (elevels.length == levels.length) continue;
                var minLen = Math.min(elevels.length, levels.length);

                var isTree = true;
                for (var i = 0; i < minLen; i++) {
                    if (elevels[i] != levels[i]) {
                        isTree = false;
                        break;
                    }
                }

                if (!isTree) continue;

                if (elevels.length < levels.length) {
                    // 更低级别的变更,抛弃
                    addNew = false;
                    break;
                } else {
                    // 更高级别的变更
                    needRemove.push(eitem);
                }
            }

            needRemove.forEach(function (removeItem) {
                delete arrangedDirty[removeItem];
            });

            if (addNew) {
                arrangedDirty[item] = dirtyType;
            }
        }

        return arrangedDirty;
    },


    mapWorldWarDirty: function () {
        var updateData = {};
        var arrangedDirty = this.arrangeDirty(this.memData.uni_dirty);
        for (var item in arrangedDirty) {
            var obj = this.user;
            var mirrorObj = gInitWorldUser;
            var args = item.split(".");
            var ok = true;
            for (var i = 0; i < args.length; i++) {
                if (typeof (obj) != 'object') {
                    // 未找到
                    ok = false;
                    break;
                }
                obj = obj[args[i]];
                if (mirrorObj) {
                    mirrorObj = mirrorObj[args[i]];
                } else {
                    mirrorObj = 0;
                }
            }

            if (ok && obj != undefined && obj != NaN && obj != null) {
                var result = null;
                if (typeof (mirrorObj) == 'object' && !(util.isArray(mirrorObj))) {
                    result = mapObject(obj, mirrorObj);
                } else {
                    result = obj;
                }
                updateData[item] = result;
            } else {
                ERROR('invalid worldwar update: ' + item);
            }
        }
        this.memData.uni_dirty = {};
        return updateData;
    },

    // 标志需要写入的变更数据名 a.b格式
    markDirty: function (item) {

        this.dirty[item] = 0;
        var worldUpdate = gInitWorldUser;
        var segs = item.split('.');
        for (var i = 0, len = segs.length; i < len; i++) {
            var seg = segs[i];
            if (!(seg in worldUpdate)) {
                return;
            }
            worldUpdate = worldUpdate[seg];
            if (typeof (worldUpdate) != 'object') {
                break;
            } else {
                var empty = true;
                for (var id in worldUpdate) {
                    empty = false;
                    break;
                }
                if (empty) {
                    break;
                }
            }
        }

        if (this.memData) {
            this.memData.dirty[item] = 0;

            // 玩家本周已经报上了名
            if (this.user.worldwar.registed && (item.split('.')[0] in gWorldWarUser) && this.memData.updated_worldwar) {
                this.memData.uni_dirty[item] = 0;
            }

            if (this.isNeedSyncToLandGrabber() && (item.split('.') in gLandGrabberUser)) {
                this.memData.land_grabber_dirty[item] = 0;
            }
        }
    },

    markDelete: function (item) {
        this.dirty[item] = 1;
    },

    cleanDirty: function () {
        this.dirty = {};
    },

    // ---------------玩家逻辑相关------------------

    addXp: function (exp, mod, act) {
        var award = [];
        var status = this.user.status;
        var oldLevel = status.level;
        var level = oldLevel;
        var xp = status.xp + exp;
        while (gConfLevel[level + 1] && xp >= gConfLevel[level].exp) {
            xp -= gConfLevel[level].exp;
            level++;
        }

        if (!gConfLevel[level + 1]) {
            // 达到最高等级
            var maxXp = gConfLevel[level].exp - 1;
            xp = xp > maxXp ? maxXp : xp;
        }

        if (oldLevel != level) {
            award = this.onPlayerLevelUp(level, oldLevel);
        }

        status.xp = xp;
        this.markDirty('status.xp');

        var args = {
            uid: this.uid,
            type: 'xp',
            num: exp,
            mod: mod,
            act: act,
            old_level: oldLevel,   // 加经验前的等级
            new_level: level,      // 加经验后的等级
        };
        addGameLog(LogType.LOG_CURRENCY_PRODUCE, args, null);

        return award;
    },

    // 等级提升
    onPlayerLevelUp: function (newLevel, oldLevel) {
        //this.user.pos[1].level = newLevel;
        //this.markDirty('pos.1.level');
        //this.markFightForceChangedAll();
        this.user.status.level = newLevel;
        this.markDirty('status.level');
        this.doGuideTask('levelUp', newLevel);

        this.updateHeadFrameStatus('user_level', newLevel);

        var lvAward = clone(gConfLevel[newLevel].lvAwardFood);
        if (newLevel - oldLevel > 1) {
            lvAward = lvAward * (newLevel - oldLevel);
        }
        var levelUpAward = [];

        // 向wss服更新玩家等级
        updateWssData(this.user._id, { level: newLevel });

        // 等级变化到下一阶段时刷新竞技商店
        if (Math.floor(oldLevel / 10) != Math.floor(newLevel / 10)) {

        }

        for (var openLevel in gOpenLevelActivities) {
            if (openLevel > oldLevel && openLevel <= newLevel) {
                var activities = gOpenLevelActivities[openLevel];
                for (var i = 0, len = activities.length; i < len; i++) {
                    this.openActivity(activities[i]);
                }
            }
        }

        if (newLevel >= 60 && newLevel % 10 == 0) {
            var array = [];
            var userName = this.user.info.un;
            array[0] = userName;
            array[1] = newLevel;
            if (userName == null) {
                array[0] = '';
            }

            pushSysMsg('updateLevel', array);
        }

        if (gConfLevel[newLevel].guideIndex > 0) {
            this.user.mark.guide = 1;
            this.markDirty('mark.guide');
        }

        this.doTask('level');
        this.doOpenSeven('level');
        this.doOpenHoliday('level');
        if (oldLevel < gConfActivities['login_goodgift'].openLevel
            && isActivityStart(this, 'login_goodgift')) {
            var loginGift = this.user.activity;
            loginGift.time = gConfActivities['login_goodgift'].startTime;
            loginGift.login = 1;
            loginGift.reward = {};
            this.markDirty('activity.login_goodgift');
        }

        var phpReq = {
            uid: this.uid,
            act: 'user_levelup',
            args: {
                sid: config.DistId,
                openid: this.user.info.account,
                level: newLevel,
            },
        };
        LogCollect(phpReq.uid, phpReq.act, phpReq.args);
        // requestPHP(phpReq, {});

        // 初始化黑森林探索
        this.initAutoFight();

        // 在线奖励通知
        outline_sync_to_client(this);

        return levelUpAward;
    },

    // 玩家关卡胜利回调
    onCustomFightWin: function (customId) {
        // 检测大本营是否开启
        this.initAutoFight();

        // 检测是否开启噩梦关卡
        /*
        if (this.user.mark.food_time_red == 0 && isModuleOpen_new(this, 'hard')) {
            this.user.mark.food_time_red = common.getTime();
            this.markDirty('mark.food_time_red');
        }
        */
    },


    // 发送新用户邮件
    sendNewUserMail: function () {
        var user = this.user;
        // 微蓝一测，要发一个新手邮件
        // if (config.platform && config.platform == 'winner_1' && !user.mark.mail) {
        if (!user.mark.mail) {
            // 新用户奖励邮件
            // var awards = [['user', 'bindcash', 3000], ['user', 'vip_xp', 3000], ['weekcard', 400001, 1], ['monthcard', 400002, 1]];
            var awards = parseAwardsConfig(gConfGlobalNew.initMail);
            var reqWorld = {
                mod: 'mail',
                act: 'add_mail',
                uid: this.uid,
                args: {
                    mail: {
                        content: [1010],
                        awards: awards,
                        time: common.getTime(),
                        expire: common.getTime() + gConfMail[1010].time * OneDayTime,
                    }
                },
            };

            var _me = this;
            requestWorld(reqWorld, {}, function () {
                user.mark.mail = 1;
                _me.markDirty('mark.mail');
            });
        }
    },

    addHeroXp: function (pos, exp) {
        return;
        var posObj = this.user.pos[pos];
        var toXp = posObj.xp;
        var totalXp = exp + toXp;
        var toLevel = posObj.level;
        var levelup = false;
        while (true) {
            if (toLevel >= this.user.status.level) {
                toLevel = this.user.status.level;
                if (totalXp >= gConfLevel[toLevel].roleExp) {
                    toXp = gConfLevel[toLevel].roleExp - 1;
                } else {
                    toXp = totalXp;
                }
                break;
            }

            if (totalXp - gConfLevel[toLevel].roleExp >= 0) {
                totalXp -= gConfLevel[toLevel].roleExp;
                toLevel++;
                levelup = true;
            } else {
                toXp = totalXp;
                break;
            }
        }
        if (levelup) {
            posObj.level = toLevel;
            this.markDirty(util.format("pos.%d.level", pos));
            this.markFightForceChanged(pos);
        }
        posObj.xp = toXp;
        this.markDirty(util.format("pos.%d.xp", pos));
    },

    addArenaXp: function (xpAdd, mod, act) {
        var arenaLevel = this.user.status.arena_level;
        if (!gConfArenaLevel[arenaLevel + 1]) {
            return false;
        }
        var arenaXp = this.user.status.arena_xp + xpAdd;
        var changed = false;
        while (gConfArenaLevel[arenaLevel + 1] && arenaXp >= gConfArenaLevel[arenaLevel].xp) {
            arenaXp -= gConfArenaLevel[arenaLevel].xp;
            arenaLevel++;
            changed = true;
        }
        if (!gConfArenaLevel[arenaLevel + 1]) {
            var maxXp = gConfArenaLevel[arenaLevel].xp - 1;
            arenaXp = arenaXp > maxXp ? maxXp : arenaXp;
        }

        if (changed) {
            this.user.status.arena_level = arenaLevel;
            this.markDirty('status.arena_level');
        }
        this.user.status.arena_xp = arenaXp;
        this.markDirty('status.arena_xp');

        var args = {
            uid: this.uid,
            type: 'arena_xp',
            num: xpAdd,
            mod: mod,
            act: act,
        };
        addGameLog(LogType.LOG_CURRENCY_PRODUCE, args, null);
    },

    getFateMap: function (fateId) {
        return;
        for (var pos in this.user.pos) {
            if (this.user.pos[pos].hid) {
                this.getHeroFate(pos, fateId);
            }
        }
    },

    getHeroFate: function (pos, fateId) {
        return;
        var hid = this.user.pos[pos].hid;
        var heroCombatConf = getHeroCombatConf(hid);
        if (!heroCombatConf) {
            DEBUG('getHeroFate not find hid = ' + hid);
            return;
        }

        var fateMap = heroCombatConf.fateGroup;
        if (fateId && fateMap.indexOf(fateId) < 0) {
            return;
        }

        var fate = this.memData.pos[pos].fate = [];
        for (var i = 0; i < fateMap.length; i++) {
            var fateId = fateMap[i];
            if (!fateId)
                continue;

            var fateHids = [];
            var confFate = gConfFate[fateId];
            if (pos == 1) {
                confFate = gConfFateTreasure[fateId];
            }

            if (!confFate) {
                Error('fate conf error, id = ' + fateId);
                continue;
            }

            var satisfied = true;

            if (pos == 1) {
                // 除去自己之外的英雄列表
                for (var j = 1; j <= 4; j++) {
                    if (confFate['treasure' + j]) {
                        fateHids.push(confFate['treasure' + j]);
                    }
                }

                // 检查缘分是否激活
                var custom_treasure = this.user.custom_treasure;
                if (custom_treasure) {
                    for (var j = 0; j < fateHids.length; j++) {
                        if (custom_treasure.indexOf(fateHids[j]) < 0) {
                            satisfied = false;
                            break;
                        }
                    }
                }
            } else {
                // 除去自己之外的英雄列表
                for (var j = 1; j <= 5; j++) {
                    if (confFate['hid' + j] == hid) {
                        continue;
                    }
                    if (confFate['hid' + j]) {
                        fateHids.push(confFate['hid' + j]);
                    }
                }

                // 检查缘分是否激活
                var satisfied = true;
                var gotCards = this.user.cardGetRecord;
                if (gotCards) {
                    for (var j = pos == 1 ? 1 : 0; j < fateHids.length; j++) {
                        if (!gotCards[fateHids[j]]) {
                            satisfied = false;
                            break;
                        }
                    }
                }
            }

            if (satisfied) {
                for (var j = 1; j <= 2; j++) {
                    if (confFate['att' + j]) {
                        var attrObj = {};
                        attrObj.attrId = confFate['att' + j];
                        attrObj.attrValue = confFate['value' + j];
                        attrObj.addType = confFate['attType' + j];

                        fate.push(attrObj);
                    }
                }
            }
        }
    },

    // 检查缘分激活情况
    checkFateMap: function (hid) {
        var fateIds = gHeroFateMap[hid];
        if (!fateIds) {
            return;
        }

        for (i = 0; i < fateIds.length; i++) {
            this.getFateMap(fateIds[i]);
        }
    },

    getAssistFateMap: function (pos, fateId) {
        return;
        var hid = this.user.pos[pos].hid;
        var fate = this.memData.pos[pos].fate;
        if (!fate) {
            this.getFateMap();
            for (var pos in user.pos) {
                if (this.user.pos[pos].hid) {
                    this.markFightForceChanged(pos);
                }
            }
            return;
        }
        var confFate = gConfFate[fateId];
        var fateHids = [];
        var index = 0;
        if (pos == 1) {
            index = 1;
        }
        for (var j = 1; j <= 5; j++) {
            if (confFate['hid' + j] == hid) {
                index = j;
                continue;
            }
            if (confFate['hid' + j]) {
                fateHids.push(confFate['hid' + j]);
            }
        }
        var heros = {};
        for (var p = 1; p <= MaxPos; p++) {
            heros[this.user.pos[p].hid] = 1;
        }
        var j = 0;
        if (pos == 1) {
            j = 1;
        }
        for (; j < fateHids.length; j++) {
            if (!heros[fateHids[j]] && (!this.user.pos[pos].assist[fateId]
                || this.user.pos[pos].assist[fateId].indexOf(fateHids[j]) < 0)) {
                return;
            }
        }
        var fateAttValue = [];
        for (var j = 1; j <= 2; j++) {
            if (gConfFate[fateId]['att' + j]) {
                var attrObj = {};
                attrObj.attrId = gConfFate[fateId]['att' + j];
                attrObj.attrValue = gConfFate[fateId]['value' + j];
                attrObj.addType = gConfFate[fateId]['attType' + j];

                fate.push(attrObj);
            }
        }

        this.markFightForceChanged(pos);
    },

    getInnateMap: function () {
        for (var pos = 1; pos <= 9; pos++) {
            index = this.user.team[pos];
            if (index > 0) {
                this.getInnateByPos(index, 0);
            }
        }
    },

    getHeroBagMax: function () {
        var buyAdd = this.user.hero_bag.buy * (+gConfGlobalNew.heroNumBuyAdd);
        var vipAdd = gConfVip[this.user.status.vip]['heroNumLimit'];
        var tequanAdd = this.getPrivilegeVal('heroNumLimit');
        return buyAdd + vipAdd + tequanAdd;
    },

    getInnateByPos: function (index, oldTalent) {
        var hid = this.user.hero_bag.heros[index].rid;
        if (hid == 0) {
            return;
        }
        /* by fish todo huang
        var customKing = null;
        if (index == 1) {
            customKing = this.user.custom_king;
        }

        var heroCombatConf = getHeroCombatConf(hid, customKing);
        if (heroCombatConf == null) {
            DEBUG('can not find hero combat conf, hid = ' + hid);
            return;
        }

        var innateNum = 0;
        var quality = 0;

        if (index == 1) {
            quality = this.getQuality();
        } else {
            quality = heroCombatConf.quality;
        }

        innateNum = gConfGlobalNew[`innateNum${quality}`];
        if (!innateNum) {
            innateNum = 6;
            DEBUG(`ZcgError: ${hid} ${pos} ${quality}`);
        }

        var talent = this.user.hero_bag.heros[index].talent;
        if (talent == 0 || oldTalent == 0) {
            // 清除原来的突破成长加成, 如果之前没有突破加成，则初始化
            for (var p in this.user.pos) {
                this.memData.pos[p].innate[pos] = [];
            }
            // 当前没有突破则不计算加成
            //if (!talent) return;
        }

        var innateGroupId = heroCombatConf.innateGroup;
        var confInnateGroup = gConfInnateGroup[innateGroupId];
        var teamHid = confInnateGroup.teamheroID;
        var teamInnate = false;
        var teamTalent = 0;
        for (var p in this.user.pos) {
            if (this.user.pos[p].hid == teamHid) {
                teamInnate = true;
                teamTalent = this.user.pos[p].talent;
                break;
            }
        }
        for (var tlt = oldTalent + 1; tlt <= talent; tlt++) {
            var innateId = confInnateGroup['level' + tlt];
            var value = confInnateGroup['value' + tlt];

            if (tlt > innateNum) {
                break;
            }

            var target = gConfInnate[innateId].target;
            if (target == 1) {
                this.memData.pos[pos].innate[pos].push(innateId, value);
            } else {
                for (var p in this.user.pos) {
                    this.memData.pos[p].innate[pos].push(innateId, value);
                }
            }
        }

        if (teamInnate && confInnateGroup.teamheroID != 0) {
            for (var i = 0; i < confInnateGroup.teamvaluegroup.length; i++) {
                if (talent >= confInnateGroup.teamvaluegroup[i] &&
                    teamTalent >= confInnateGroup.teamvaluegroup[i]) {
                    // 双方突破等级都满足
                    var teamIndex = i + 1;
                    var teamInnateId = confInnateGroup['teamId' + teamIndex];
                    var teamInnateValue = confInnateGroup['teamValues' + teamIndex];

                    if (!gConfInnate[teamInnateId]) {
                        DEBUG('not find teamInnateId = ' + teamInnateId);
                    } else {
                        var target = gConfInnate[teamInnateId].target;
                        if (target == 1) {
                            // 个人
                            this.memData.pos[pos].innate[pos].push(teamInnateId, teamInnateValue);
                        } else {
                            // 全体
                            for (var p in this.user.pos) {
                                this.memData.pos[p].innate[pos].push(teamInnateId, teamInnateValue);
                            }
                        }
                    }
                }
            }
        }*/
    },

    getFightForce: function (forceMark, callback) {
        try {
            if (!this.memData.ffchanged && !forceMark) {
                //ERROR('FF NOT CHANGE');
                callback && callback(this.memData.fight_force);
                return this.memData.fight_force;
            }
            var team1 = this.user.team[1];
            var fightForce = 0;
            var fightForceNoExtra = 0;

            var oldPosObj = {};
            for (var indx in team1) {
                var pos = team1[indx];
                if (indx) {
                    var heroFightForce = this.getHeroFightForce(indx, pos);
                    fightForce += heroFightForce;
                }

                oldPosObj[indx] = this.user.hero_bag.heros[indx];
                oldPosObj[indx].slot = pos;
            }

            //ERROR(this.user.pos);
            this.user.pos = clone(oldPosObj);
            this.markDirty('pos');
            this.memData.pos = clone(oldPosObj);

            // 更新玩家最高战力
            if (fightForce > this.user.mark.max_fight_force) {
                this.user.mark.max_fight_force = fightForce;
                this.markDirty('mark.max_fight_force');

                // 在线奖励通知
                outline_sync_to_client(this);
            }
            if (fightForceNoExtra > this.user.mark.max_fight_force_no_extra) {
                this.user.mark.max_fight_force_no_extra = fightForceNoExtra;
                this.markDirty('mark.max_fight_force_no_extra');
            }

            this.user.temp = this.user.temp || {};
            this.user.temp.max_fight_force = this.user.temp.max_fight_force || 0;
            if (fightForce > this.user.temp.max_fight_force) {
                var tRespData = {};
                requestGlobal(                                      // 通知跨服global更新最高战力
                    {
                        mod: "fight_rank",
                        act: "fight_update",
                        uid: this.uid,
                        args: {
                            fight: fightForce,
                            data: user_snapshot_data(this.user),
                        }
                    },
                    tRespData,
                    function () {
                        if (!tRespData.code) {
                            this.user.temp.max_fight_force = fightForce;
                        }
                        callback && callback(this.user.temp.max_fight_force);
                    }.bind(this)
                );
            }

            this.memData.fight_force = fightForce;
            this.memData.ffchanged = 0;
            this.doOpenSeven('fightForce');
            this.doOpenHoliday('fightForce');
            this.doTask('fightPower', fightForce);

            //this.updateFirstPayProgress('fight_force');
            //this.doTask('fightPower', fightForce);
            //ERROR('uid = ' + this.uid + ', fightForce = ' + fightForce);
            if (!tRespData) {
                callback && callback(fightForce);
            }
            return fightForce;
        } catch (err) {
            // 计算战斗力出错, 不能影响其他功能
            ERROR('ff error cause by ' + this.uid);
            ERROR(err.stack);
            callback && callback(0);
            return 0;
        }
    },

    getHeroFightForce: function (heroIndex, pos) {
        var user = this.user;
        var heroObj = user.hero_bag.heros[heroIndex];
        var posObj = heroObj;
        if (!posObj) {
            return 0;
        }

        var debugHid = 0; // this.user.pos[pos].hid;

        // 武将属性初始化 111
        //posObj.attr  = {};
        //ERROR('=========getHeroFightForce=========='+heroIndex+' pos:'+pos);
        // step----1
        var funcCalcBaseAttr = function (theHero) {
            var attrArr = cloneHeroInitAttr();
            var baseConf = gConfHero[theHero.rid];
            var combatConf = getHeroCombatConf(theHero.rid, theHero.awake);

            var destinyConf = gConfDestiny[theHero.awake];
            var rebornType = combatConf['rebornType'];
            var rebornconf = gConfReborn[rebornType][theHero.tier];

            var curLv = theHero.level;

            attrArr[1] = rebornconf['baseAtk'] + (curLv - 1) * rebornconf['atkGrowth'];
            attrArr[2] = rebornconf['baseDef'] + (curLv - 1) * rebornconf['defGrowth'];
            attrArr[3] = rebornconf['baseMagDef'] + (curLv - 1) * rebornconf['magDefGrowth'];
            attrArr[4] = rebornconf['baseHp'] + (curLv - 1) * rebornconf['hpGrowth'];

            // other base attr
            attrArr[9] = +combatConf.baseSpeed;
            attrArr[10] = +combatConf.attackSpeed;

            // 英雄觉醒加成 
            attrArr[1] = Math.floor(attrArr[1] * (1 + destinyConf['atk'] / 100));
            attrArr[2] = Math.floor(attrArr[2] * (1 + destinyConf['def'] / 100));
            attrArr[3] = Math.floor(attrArr[3] * (1 + destinyConf['mdef'] / 100));
            attrArr[4] = Math.floor(attrArr[4] * (1 + destinyConf['hp'] / 100));

            return attrArr
        };
        var baseAttrArr = funcCalcBaseAttr(heroObj);
        // ERROR('=========baseattr==========');
        // ERROR(baseAttrArr);

        var funcCalcInnateAttr = function (heros, targetHid, team) {
            var attrArr = cloneHeroInitAttr();
            for (var hid in team) {
                //var hid  = team[i];
                var hObj = heros[hid];
                var combatConf = getHeroCombatConf(hObj.rid, hObj.awake);
                var baseStarLv = combatConf['starBase'];
                var innateGroupId = combatConf['innateGroup'];
                var innateGroupCfg = gConfInnateGroup[innateGroupId];
                var innateCfg = gConfInnate;

                //已激活天赋条数         
                var activeCount = Math.min(+(gConfGlobalNew['innateNum' + baseStarLv]), hObj.tier);
                for (var k = 1; k <= activeCount; k++) {
                    var innateId = innateGroupCfg['level' + k];
                    var value = innateGroupCfg['value' + k];
                    var attrType1 = innateCfg[innateId]['att1'];
                    var attrType2 = innateCfg[innateId]['att2'];
                    var addType = innateCfg[innateId]['type'];
                    var targetType = innateCfg[innateId]['target'];
                    var isAdd = false;

                    if (hid != targetHid) {
                        //作用全体上阵武将
                        if (targetType == 2) {
                            isAdd = true;
                        }
                    } else {
                        if (targetType == 1 || targetType == 2) {
                            isAdd = true;
                        }
                    }

                    if (isAdd) {
                        //固定值
                        if (addType == 1) {
                            attrArr[attrType1] = attrArr[attrType1] + value;
                            attrArr[attrType2] = attrArr[attrType2] + value;
                            //百分比
                        } else if (addType == 2) {
                            attrArr[attrType1] = attrArr[attrType1] + Math.floor(baseAttrArr[attrType1] * value / 100);
                            attrArr[attrType2] = attrArr[attrType2] + Math.floor(baseAttrArr[attrType2] * value / 100);
                        }
                    }
                }
            }

            return attrArr;
        };

        var innateAttrArr = funcCalcInnateAttr(user.hero_bag.heros, heroIndex, user.team[1]);
        // ERROR('=========innateAttrArr==========');
        // ERROR(innateAttrArr);

        // 符文
        var funcCalcRuneAttrArr = function (heroObj) {
            var attrArr = cloneHeroInitAttr();
            for (var i = 1; i <= 4; i++) {
                var runeSid = heroObj.rune_use[i - 1];
                if (runeSid > 0) {
                    var runeObj = user.bag.rune[runeSid];
                    var attrType = runeObj.base_attr;

                    var conf = gConfRuneBaseAttConf[runeObj.level];
                    var runeConf = gConfRuneConf[runeObj.id];
                    var runeQuality = runeConf.quality;

                    var attrMap = ['atk', 'def', 'magdef', 'hp'];
                    var key1 = attrMap[attrType - 1] + runeQuality;
                    var key2 = attrMap[attrType - 1] + '_p' + runeQuality;

                    var baseValue = conf[key1];
                    var basePer = conf[key2];

                    // 符文固定加成
                    attrArr[attrType] = attrArr[attrType] + baseValue;
                    // 符文万分比加成 
                    attrArr[attrType] = attrArr[attrType] + Math.floor(baseAttrArr[attrType] * basePer / 10000);
                    // 符文特殊属性加成
                    for (j = 0; j <= 3; j++) {
                        if (runeObj.attrs[j]) {
                            var sType = runeObj.attrs[j][0];
                            var sValue = runeObj.attrs[j][1];

                            attrArr[sType] = attrArr[sType] + sValue;
                        }
                    }
                }
            }

            return attrArr;
        };

        var runeAttrArr = funcCalcRuneAttrArr(heroObj);

        // setp 3 part
        var funcCalcPartAttr = function (heroObj) {
            var attrArr = cloneHeroInitAttr();
            for (i = 1; i <= 6; i++) {
                var partObj = heroObj.part[i];
                if (partObj && partObj.max_awake && partObj.awake_level > 0) {
                    //部位特殊属性加成
                    var attrType = gConfPartBase[i]['maxAtt'];
                    var attrValue = gConfPartAwake[i][partObj.awake_level]['maxVal'];
                    attrArr[attrType] = attrArr[attrType] + attrValue;

                    //宝石加成
                    var pGems = partObj.gems;
                    //var partEmbed = gConfPartEmbed[part_pos];
                    for (var gem_pos = 1; gem_pos <= 4; ++gem_pos) {
                        // 宝石id
                        var embedId = pGems[gem_pos];
                        var confGem = gConfGem[embedId];
                        if (confGem) {
                            attrArr[confGem.type] += confGem.value;
                        }
                    }
                }
            }

            return attrArr;
        };
        var partAttrArr = funcCalcPartAttr(heroObj);
        //ERROR('=========partAttrArr==========');
        //ERROR(partAttrArr);

        var funcCalcEquipAttr = function (heroObj, equipBag) {
            var attrArr = cloneHeroInitAttr();

            var partAwakeConf = gConfPartAwake;
            var partEmbedConf = gConfPartEmbed;

            var suitId = -1;
            var isSuitActive = true;

            for (i = 1; i <= 6; i++) {
                var eid = heroObj.equip[i];
                if (eid <= 0) {
                    isSuitActive = false;
                    continue;
                }

                var eObj = equipBag[eid];
                var eConf = gConfEquip[eObj.id];
                var ebaseConf = gConfEquipBase[eConf.type][eConf.quality];
                if (!ebaseConf) {
                    continue;
                }

                if (eObj) {
                    if (suitId == -1) {
                        suitId = eConf.suitId;
                    }

                    if (suitId != eConf.suitId) {
                        isSuitActive = false
                    }

                    //装备基础属性
                    var equipMainAttr = { 1: 0, 2: 0, 3: 0, 4: 0 };//eObj:getMainAttribute()
                    for (var mi = 1; mi <= 4; mi++) {
                        //var mainAttrType  = ebaseConf['attributeType'+mi];
                        var mainAttrValue = ebaseConf['attributeValue' + eObj.grade];
                        equipMainAttr[mi] += mainAttrValue[mi - 1];
                    }

                    //部位装备基础百分比加成
                    var partObj = heroObj.part;
                    var addPercent = 0

                    if (partObj && partObj.max_awake && partObj.awake_level > 0) {
                        var partGemEmbedLv = getEmbedLevel(heroObj, i);
                        addPercent = partAwakeConf[i][partObj.awake_level]['addEquipMainAtt'];

                        if (partGemEmbedLv > 0) {
                            addPercent = addPercent + partEmbedConf[partGemEmbedLv]['addEquipMainAtt'];
                        }
                    }

                    for (var j = 1; j <= 4; j++) {
                        var normalAttrId = j;
                        var normalValue = Math.floor(equipMainAttr[j] * (100 + addPercent) / 100);
                        attrArr[normalAttrId] = attrArr[normalAttrId] + normalValue;
                    }

                    //装备特殊属性 todo  specialAttValue0
                    var specialAType = ebaseConf.specialAttType;
                    var specialAValue = ebaseConf['specialAttValue' + eObj.grade];
                    attrArr[specialAType] = attrArr[specialAType] + specialAValue;
                } else {
                    isSuitActive = false;
                }

            }

            //套装加成
            if (suitId > 0 && isSuitActive) {
                var suitCfg = gConfEquipSuit[suitId];
                var suitAttr = suitCfg['attribute6'];

                var len = suitAttr.length;
                for (var i = 0; i < len; i++) {
                    var attrStr = suitAttr[i];
                    var arr1 = attrStr.split(':');
                    var attrType = Number(arr1[0]);
                    var attrValue = Number(arr1[1]);

                    attrArr[attrType] = attrArr[attrType] + attrValue;
                }
            }

            return attrArr;
        }
        var equipAttrArr = funcCalcEquipAttr(heroObj, user.bag.equip);

        var funcCalcEquipTalentAttr = function (heroObj, equipBag) {
            var attrArr = cloneHeroInitAttr();

            var allPoints = heroObj.talent.point;
            var treeObj = heroObj.talent.tree;

            var heroType = gConfHero[heroObj.rid]['soldierId'];


            for (i = 1; i <= 6; i++) {
                var talentConf = gConfEquipTalent[heroType][i];

                var isActive = allPoints >= talentConf['limit'];

                if (isActive) {
                    // 选的左边
                    if (treeObj[i - 1] == 1) {
                        var normalAttrId = talentConf['talentValue1'][0];
                        var normalValue = talentConf['talentValue1'][1];

                        attrArr[normalAttrId] += normalValue;
                    }
                    // 选的右边
                    else if (treeObj[i - 1] == 2) {
                        var normalAttrId = talentConf['talentValue2'][0];
                        var normalValue = talentConf['talentValue2'][1];

                        attrArr[normalAttrId] += normalValue;
                    }
                }
            }

            return attrArr;
        }
        var equipTalentAttrArr = funcCalcEquipTalentAttr(heroObj, user.bag.equip);

        var getPeopleKingWeaponAttr = function () {
            var attrArr = cloneHeroInitAttr();

            var peopleKingData = user.sky_suit;

            var skyskillConf = gConfSkySkill;
            var skyskillupConf = gConfSkySkillUp;
            var skyweapConf = gConfSkyWeap[peopleKingData.weapon_level];
            var skybloodawakenConf = gConfSkyBloodAwaken;
            var skygasawakenConf = gConfSkyGasAwaken;
            var skychangeConf = gConfSkyChange[1];

            var skillAttrs = clone(attrArr);

            for (var id in peopleKingData.weapon_skills) {
                if (peopleKingData.weapon_skills[id]) {
                    var sLv = peopleKingData.weapon_skills[id];
                    var attrId = skyskillConf[1][+id].att;

                    skillAttrs[attrId] += skyskillupConf[100 + (+id)][sLv].attValue;
                }
            }

            var now = common.getTime();

            // 幻化
            var changeAdd = 0;

            // 永久幻化
            for (var k in peopleKingData.weapon_illusion_equip) {
                var attrAdd = skychangeConf[+k].attribute / 100;
                changeAdd = changeAdd + attrAdd;
            }

            // 限时幻化
            for (var k in peopleKingData.weapon_illusion_equip_time) {
                var time = peopleKingData.weapon_illusion_equip_time[k];

                if (time >= now) {
                    var attrAdd = skychangeConf[+k].attribute / 100;
                    changeAdd = changeAdd + attrAdd;
                }
            }

            if (peopleKingData.weapon_level > 0) {
                var wLv = peopleKingData.weapon_level;
                var wBlood = peopleKingData.weapon_blood;
                var wGas = peopleKingData.weapon_gas;

                var bloodAtkPercent = skybloodawakenConf[1][wLv].atk * wBlood / 100;
                var gasAtk = skygasawakenConf[1][wLv].atk * wGas;

                attrArr[1] = Math.floor(skyweapConf.atk * (1 + bloodAtkPercent + changeAdd) + gasAtk + skillAttrs[1]);

                var bloodHpPercent = skybloodawakenConf[1][wLv].hp * wBlood / 100;
                var gasHp = skygasawakenConf[1][wLv].hp * wGas;

                attrArr[4] = Math.floor(skyweapConf.hp * (1 + bloodHpPercent + changeAdd) + gasHp + skillAttrs[4]);

                var bloodDefPercent = skybloodawakenConf[1][wLv].def * wBlood / 100;

                var gasDef = skygasawakenConf[1][wLv].def * wGas;
                attrArr[2] = Math.floor(skyweapConf.def * (1 + bloodDefPercent + changeAdd) + gasDef + skillAttrs[2]);

                var bloodMdefPercent = skybloodawakenConf[1][wLv].mdef * wBlood / 100;
                var gasMdef = skygasawakenConf[1][wLv].mdef * wGas;

                attrArr[3] = Math.floor(skyweapConf.mdef * (1 + bloodMdefPercent + changeAdd) + gasMdef + skillAttrs[3]);
            }

            for (var k in peopleKingData.weapon_illusion_equip) {
                for (i = 1; i <= 6; i++) {
                    if (skychangeConf[+k]["att" + i] > 0) {
                        var attrType = skychangeConf[+k]["att" + i];
                        var attrValue = skychangeConf[+k]["val" + i];

                        attrArr[attrType] += attrValue;
                    }
                }
            }

            for (var k in peopleKingData.weapon_illusion_equip_time) {
                var time = peopleKingData.weapon_illusion_equip_time[k];
                if (time >= now) {
                    for (i = 1; i <= 6; i++) {
                        if (skychangeConf[+k]["att" + i] > 0) {
                            var attrType = skychangeConf[+k]["att" + i];
                            var attrValue = skychangeConf[+k]["val" + i];

                            attrArr[attrType] += attrValue;
                        }
                    }
                }
            }

            return attrArr;
        }

        var getPeopleKingWingAttr = function () {
            var attrArr = cloneHeroInitAttr();

            var peopleKingData = user.sky_suit;

            var skyskillConf = gConfSkySkill;
            var skyskillupConf = gConfSkySkillUp;
            var skyweapConf = gConfSkyWing[peopleKingData.wing_level];
            var skybloodawakenConf = gConfSkyBloodAwaken;
            var skygasawakenConf = gConfSkyGasAwaken;
            var skychangeConf = gConfSkyChange[2];

            var skillAttrs = clone(attrArr);

            for (var id in peopleKingData.wing_skills) {
                if (peopleKingData.wing_skills[id]) {
                    var sLv = peopleKingData.wing_skills[id];
                    var attrId = skyskillConf[2][+id].att;

                    skillAttrs[attrId] += skyskillupConf[200 + (+id)][sLv].attValue;
                }
            }

            var now = common.getTime();

            // 幻化
            var changeAdd = 0;

            // 永久幻化
            for (var k in peopleKingData.wing_illusion_equip) {
                var attrAdd = skychangeConf[+k].attribute / 100;
                changeAdd = changeAdd + attrAdd;
            }

            // 限时幻化
            for (var k in peopleKingData.wing_illusion_equip_time) {
                var time = peopleKingData.wing_illusion_equip_time[k];

                if (time >= now) {
                    var attrAdd = skychangeConf[+k].attribute / 100;
                    changeAdd = changeAdd + attrAdd;
                }
            }

            if (peopleKingData.wing_level > 0) {
                var wLv = peopleKingData.wing_level;
                var wBlood = peopleKingData.wing_blood;
                var wGas = peopleKingData.wing_gas;

                var bloodAtkPercent = skybloodawakenConf[2][wLv].atk * wBlood / 100;
                var gasAtk = skygasawakenConf[2][wLv].atk * wGas;

                attrArr[1] = Math.floor(skyweapConf.atk * (1 + bloodAtkPercent + changeAdd) + gasAtk + skillAttrs[1]);

                var bloodHpPercent = skybloodawakenConf[2][wLv].hp * wBlood / 100;
                var gasHp = skygasawakenConf[2][wLv].hp * wGas;

                attrArr[4] = Math.floor(skyweapConf.hp * (1 + bloodHpPercent + changeAdd) + gasHp + skillAttrs[4]);

                var bloodDefPercent = skybloodawakenConf[2][wLv].def * wBlood / 100;

                var gasDef = skygasawakenConf[2][wLv].def * wGas;
                attrArr[2] = Math.floor(skyweapConf.def * (1 + bloodDefPercent + changeAdd) + gasDef + skillAttrs[2]);

                var bloodMdefPercent = skybloodawakenConf[2][wLv].mdef * wBlood / 100;
                var gasMdef = skygasawakenConf[2][wLv].mdef * wGas;

                attrArr[3] = Math.floor(skyweapConf.mdef * (1 + bloodMdefPercent + changeAdd) + gasMdef + skillAttrs[3]);
            }

            for (var k in peopleKingData.wing_illusion_equip) {
                for (i = 1; i <= 6; i++) {
                    if (skychangeConf[+k]["att" + i] > 0) {
                        var attrType = skychangeConf[+k]["att" + i];
                        var attrValue = skychangeConf[+k]["val" + i];

                        attrArr[attrType] += attrValue;
                    }
                }
            }

            for (var k in peopleKingData.wing_illusion_equip_time) {
                var time = peopleKingData.wing_illusion_equip_time[k];
                if (time >= now) {
                    for (i = 1; i <= 6; i++) {
                        if (skychangeConf[+k]["att" + i] > 0) {
                            var attrType = skychangeConf[+k]["att" + i];
                            var attrValue = skychangeConf[+k]["val" + i];

                            attrArr[attrType] += attrValue;
                        }
                    }
                }
            }

            return attrArr;
        }

        var getPeopleKingMountAttr = function () {
            var attrArr = cloneHeroInitAttr();

            var peopleKingData = user.sky_suit;

            var skyskillConf = gConfSkySkill;
            var skyskillupConf = gConfSkySkillUp;
            var skyweapConf = gConfSkyMount[peopleKingData.mount_level];
            var skybloodawakenConf = gConfSkyBloodAwaken;
            var skygasawakenConf = gConfSkyGasAwaken;
            var skychangeConf = gConfSkyChange[3];

            var skillAttrs = clone(attrArr);

            for (var id in peopleKingData.mount_skills) {
                if (peopleKingData.mount_skills[id]) {
                    var sLv = peopleKingData.mount_skills[id];
                    var attrId = skyskillConf[3][+id].att;

                    skillAttrs[attrId] += skyskillupConf[300 + (+id)][sLv].attValue;
                }
            }

            var now = common.getTime();

            // 幻化
            var changeAdd = 0;

            // 永久幻化
            for (var k in peopleKingData.mount_illusion_equip) {
                var attrAdd = skychangeConf[+k].attribute / 100;
                changeAdd = changeAdd + attrAdd;
            }

            // 限时幻化
            for (var k in peopleKingData.mount_illusion_equip_time) {
                var time = peopleKingData.mount_illusion_equip_time[k];

                if (time >= now) {
                    var attrAdd = skychangeConf[+k].attribute / 100;
                    changeAdd = changeAdd + attrAdd;
                }
            }

            if (peopleKingData.mount_level > 0) {
                var wLv = peopleKingData.mount_level;
                var wBlood = peopleKingData.mount_blood;
                var wGas = peopleKingData.mount_gas;

                var bloodAtkPercent = skybloodawakenConf[3][wLv].atk * wBlood / 100;
                var gasAtk = skygasawakenConf[3][wLv].atk * wGas;

                attrArr[1] = Math.floor(skyweapConf.atk * (1 + bloodAtkPercent + changeAdd) + gasAtk + skillAttrs[1]);

                var bloodHpPercent = skybloodawakenConf[3][wLv].hp * wBlood / 100;
                var gasHp = skygasawakenConf[3][wLv].hp * wGas;

                attrArr[4] = Math.floor(skyweapConf.hp * (1 + bloodHpPercent + changeAdd) + gasHp + skillAttrs[4]);

                var bloodDefPercent = skybloodawakenConf[3][wLv].def * wBlood / 100;

                var gasDef = skygasawakenConf[3][wLv].def * wGas;
                attrArr[2] = Math.floor(skyweapConf.def * (1 + bloodDefPercent + changeAdd) + gasDef + skillAttrs[2]);

                var bloodMdefPercent = skybloodawakenConf[3][wLv].mdef * wBlood / 100;
                var gasMdef = skygasawakenConf[3][wLv].mdef * wGas;

                attrArr[3] = Math.floor(skyweapConf.mdef * (1 + bloodMdefPercent + changeAdd) + gasMdef + skillAttrs[3]);
            }

            for (var k in peopleKingData.mount_illusion_equip) {
                for (i = 1; i <= 6; i++) {
                    if (skychangeConf[+k]["att" + i] > 0) {
                        var attrType = skychangeConf[+k]["att" + i];
                        var attrValue = skychangeConf[+k]["val" + i];

                        attrArr[attrType] += attrValue;
                    }
                }
            }

            for (var k in peopleKingData.mount_illusion_equip_time) {
                var time = peopleKingData.mount_illusion_equip_time[k];
                if (time >= now) {
                    for (i = 1; i <= 6; i++) {
                        if (skychangeConf[+k]["att" + i] > 0) {
                            var attrType = skychangeConf[+k]["att" + i];
                            var attrValue = skychangeConf[+k]["val" + i];

                            attrArr[attrType] += attrValue;
                        }
                    }
                }
            }

            return attrArr;
        }

        var getPeopleKingWeaponCollectLv = function () {
            var weaponCollectLv = 0;
            var weapon_collect = user.sky_suit.weapon_collect;

            var peopleKingData = user.sky_suit;

            var now = common.getTime();

            for (var k in peopleKingData.weapon_illusion_equip_time) {
                var time = peopleKingData.weapon_illusion_equip_time[k];
                if (time < now) {
                    weapon_collect = weapon_collect - 1;
                }
            }

            if (weapon_collect > 0) {
                var skycollectConf = gConfSkyCollect[1];

                for (var k in skycollectConf) {
                    var goalValue = skycollectConf[k]['goalValue'];
                    if (weapon_collect >= goalValue) {
                        weaponCollectLv = k;
                    }
                    else {
                        break;
                    }
                }
            }

            return weaponCollectLv;
        }

        var getPeopleKingWingCollectLv = function () {
            var weaponCollectLv = 0;
            var weapon_collect = user.sky_suit.wing_collect;

            var peopleKingData = user.sky_suit;

            var now = common.getTime();

            for (var k in peopleKingData.wing_illusion_equip_time) {
                var time = peopleKingData.wing_illusion_equip_time[k];
                if (time < now) {
                    weapon_collect = weapon_collect - 1;
                }
            }

            if (weapon_collect > 0) {
                var skycollectConf = gConfSkyCollect[2];

                for (var k in skycollectConf) {
                    var goalValue = skycollectConf[k]['goalValue'];
                    if (weapon_collect >= goalValue) {
                        weaponCollectLv = k;
                    }
                    else {
                        break;
                    }
                }
            }

            return weaponCollectLv;
        }

        var getPeopleKingMountCollectLv = function () {
            var weaponCollectLv = 0;
            var weapon_collect = user.sky_suit.mount_collect;

            var peopleKingData = user.sky_suit;

            var now = common.getTime();

            for (var k in peopleKingData.mount_illusion_equip_time) {
                var time = peopleKingData.mount_illusion_equip_time[k];
                if (time < now) {
                    weapon_collect = weapon_collect - 1;
                }
            }

            if (weapon_collect > 0) {
                var skycollectConf = gConfSkyCollect[3];

                for (var k in skycollectConf) {
                    var goalValue = skycollectConf[k]['goalValue'];
                    if (weapon_collect >= goalValue) {
                        weaponCollectLv = k;
                    }
                    else {
                        break;
                    }
                }
            }

            return weaponCollectLv;
        }

        var getPeopleKingPvpAttr = function () {
            var attrArr = cloneHeroInitAttr();

            var attrWeapon = {};
            var attrWing = {};
            var attrMount = {};

            var skycollectConf = gConfSkyCollect;

            var weaponCollectLv = getPeopleKingWeaponCollectLv();

            if (weaponCollectLv > 0) {
                var attId = skycollectConf[1][weaponCollectLv].att1;
                attrArr[attId] += skycollectConf[1][weaponCollectLv].value1;

                var attId2 = skycollectConf[1][weaponCollectLv].att2;
                attrArr[attId2] += skycollectConf[1][weaponCollectLv].value2;
            }

            var wingCollectLv = getPeopleKingWingCollectLv();

            if (wingCollectLv > 0) {
                var attId = skycollectConf[2][wingCollectLv].att1;
                attrArr[attId] += skycollectConf[2][wingCollectLv].value1;

                var attId2 = skycollectConf[2][wingCollectLv].att2;
                attrArr[attId2] += skycollectConf[2][wingCollectLv].value2;
            }

            var mountCollectLv = getPeopleKingMountCollectLv();

            if (mountCollectLv > 0) {
                var attId = skycollectConf[3][mountCollectLv].att1;
                attrArr[attId] += skycollectConf[3][mountCollectLv].value1;

                var attId2 = skycollectConf[3][mountCollectLv].att2;
                attrArr[attId2] += skycollectConf[3][mountCollectLv].value2;
            }

            return attrArr;
        }

        var funcCalcPeopleKingAttr = function () {
            var attrArr = cloneHeroInitAttr();

            var peopleKingWeaponAttrArr = getPeopleKingWeaponAttr();
            var peopleKingWingAttrArr = getPeopleKingWingAttr();
            var peopleKingMountAttrArr = getPeopleKingMountAttr();
            var peopleKingPvpAttrArr = getPeopleKingPvpAttr();

            for (var aid in attrArr) {
                var weaponValue = peopleKingWeaponAttrArr[aid];
                var wingValue = peopleKingWingAttrArr[aid];
                var mountValue = peopleKingMountAttrArr[aid];
                var pvpValue = peopleKingPvpAttrArr[aid];

                attrArr[aid] = weaponValue + wingValue + mountValue + pvpValue;
            }

            return attrArr;
        }
        var peopleKingAttrArr = funcCalcPeopleKingAttr();

        //ERROR('=========equipAttrArr==========');
        //ERROR(equipAttrArr);
        /*
        local achieveAttrArr                = RoleData:getAchievementAttr()
        */

        //获得成就属性
        var funcGetAchievementAttr = function (egg) {
            var attrArr = cloneHeroInitAttr();
            var conf = gConfAchievement;
            var min = 0
            var currProgress = 0
            for (var id in conf) {
                var oneConf = conf[id];
                if (egg >= oneConf.egg) {
                    attrArr[1] = attrArr[1] + oneConf['attr1'];
                    attrArr[2] = attrArr[2] + oneConf['attr2'];
                    attrArr[3] = attrArr[3] + oneConf['attr3'];
                    attrArr[4] = attrArr[4] + oneConf['attr4'];
                }
            }

            return attrArr
        };
        var achieveAttrArr = funcGetAchievementAttr(user.status.egg);

        var funcCalcTeamBadgeAttr = function (canUseBadgeArr) {
            var attrArr = cloneHeroInitAttr();
            if (util.isArray(canUseBadgeArr) && canUseBadgeArr.length > 0) {
                for (var v = 0; v < canUseBadgeArr.length; v++) {
                    var key = canUseBadgeArr[v];
                    var conf = gConfTeamEmblem[key];
                    for (i = 1; i <= 2; i++) {
                        var attrType = conf['attType' + i];
                        if (attrType && attrType > 0) {
                            var attrValue = conf['attValue' + i];
                            attrArr[attrType] = attrArr[attrType] + attrValue;
                        }
                    }
                }
            }

            return attrArr;
        }
        var teamBadgeAttrArr = funcCalcTeamBadgeAttr(user.clan.can_use_badge);

        var funcCalcNobilityAttrArr = function (nobilityArr) {
            var attrArr = cloneHeroInitAttr();

            if (nobilityArr) {
                var nobilityId = nobilityArr[0];

                for (i = 1; i <= 4; i++) {
                    var attrValue = gConfNobiltyBase[nobilityId]['attr' + i];
                    attrArr[i] = attrArr[i] + attrValue;
                }
            }

            return attrArr;
        }

        var nobilityAttrArr = funcCalcNobilityAttrArr(user.task.nobility);

        var getDragonAttr = function (dragons, dragonGemBag) {
            var attrArr = cloneHeroInitAttr();

            for (var did in dragons) {
                var rateAdd = 0;
                var dragonData = dragons[did];
                var gemSlot = dragonData.slot;
                for (var gslot in gemSlot) {

                    var gemid = gemSlot[gslot];
                    if (!gemid) {
                        continue;
                    }

                    var gemObj = dragonGemBag[gemid];
                    if (!gemObj) {
                        continue;
                    }
                    rateAdd += gemObj.attr;
                }

                var oneDraConf = gConfCustomDragon[did];
                var dragonAttr = {};
                dragonAttr[1] = Math.floor(oneDraConf.attack * (1 + rateAdd / 100));
                dragonAttr[2] = Math.floor(oneDraConf.defence * (1 + rateAdd / 100));
                dragonAttr[3] = Math.floor(oneDraConf.mdefence * (1 + rateAdd / 100));
                dragonAttr[4] = Math.floor(oneDraConf.hp * (1 + rateAdd / 100));

                for (var aid in dragonAttr) {
                    attrArr[aid] += dragonAttr[aid];
                }
            }

            return attrArr;
        }

        var dragonAttrArr = getDragonAttr(user.dragon, user.bag.dragon);
        // ERROR('=========dragonAttrArr==========');
        // ERROR(dragonAttrArr);

        // 战斗力没有变化，直接返回
        //if (this.memData.pos[pos].ffchanged == 0) {
        //return posObj.fight_force;
        //}

        // if(posObj.rid == 10000)
        // {
        //     ERROR('=========baseAttrArr==========');
        //     ERROR(baseAttrArr);
        //     ERROR('=========innateAttrArr==========');
        //     ERROR(innateAttrArr);
        //     ERROR('=========equipAttrArr==========');
        //     ERROR(equipAttrArr);
        //     ERROR('=========peopleKingAttrArr==========');
        //     ERROR(peopleKingAttrArr);
        //     ERROR('=========dragonAttrArr==========');
        //     ERROR(dragonAttrArr);
        // }


        var allAattr = cloneHeroInitAttr();
        for (var attrid in allAattr) {
            var value1 = baseAttrArr[attrid] || 0;
            var value2 = innateAttrArr[attrid] || 0;
            var value3 = runeAttrArr[attrid] || 0;
            var value4 = partAttrArr[attrid] || 0;
            var value5 = equipAttrArr[attrid] || 0;
            var value6 = equipTalentAttrArr[attrid] || 0;

            var value7 = peopleKingAttrArr[attrid] || 0;
            var value8 = achieveAttrArr[attrid] || 0;
            var value9 = nobilityAttrArr[attrid] || 0;
            var value10 = teamBadgeAttrArr[attrid] || 0;
            var value11 = dragonAttrArr[attrid] || 0;

            var finalValue = value1 + value2 + value3 + value4 + value5 + value6 + value7 + value8 + value9 + value10 + value11;

            allAattr[attrid] = Math.floor(finalValue);
            //ERROR('==========ATTR['+attrid+'] +'+finalValue);       
        }

        posObj.attr = clone(allAattr);

        var combatConf = getHeroCombatConf(posObj.rid, posObj.awake);
        var starLv = this.getHeroStar(heroIndex);
        var fightForce = calcFightForceNew(posObj, starLv, combatConf);
        posObj.fight_force = Math.floor(fightForce);
        this.markDirty(util.format('hero_bag.heros.%d.fight_force', heroIndex));

        //this.memData.pos[pos].ffchanged = 0;
        //posObj.slot = +pos;

        this.markDirty(util.format('hero_bag.heros.%d.attr', heroIndex));

        if (!allAattr[1]) {
            //ERROR('getFightForce errro  attr == 000000000000000000000 id:'+heroIndex);
            //ERROR(baseAttrArr);
            //ERROR(innateAttrArr);
            //ERROR(partAttrArr);
            //ERROR(equipAttrArr);
            //console.trace();
        }

        return fightForce;
    },

    markFightForceChanged: function (pos) {
        //if (!this.user.hero_bag.heros[pos] ) {
        //return;
        //}
        //this.memData.pos[pos].ffchanged = 1;
        this.memData.ffchanged = 1;
    },

    markFightForceChangedByType: function (type) {
        var user = this.user;
        for (var pos in user.hero_bag.heros) {
            var heroCombatConf = getHeroCombatConf(user.hero_bag.heros[pos].hid);
            if (heroCombatConf && heroCombatConf.legionType == type) {
                this.markFightForceChanged(pos)
            }
        }
    },

    markFightForceChangedAll: function () {
        var user = this.user;
        for (var pos in user.hero_bag.heros) {
            if (user.hero_bag.heros[pos].hid) {
                this.markFightForceChanged(pos);
            }
        }
    },

    getStar: function () {
        /*
        var allCity = this.user.battle.city;
        for (var id in allCity) {
            var city = allCity[id];

            if (city[1].star > 0) {
                this.memData.star_num++;
            }

            if (city[2].star > 0) {
                this.memData.moon_num++;
            }

            if (city[3].star > 0) {
                this.memData.sun_num++;
            }
        }*/
    },

    getSuits: function (inPos, type) {
        /*
        for (var pos in this.user.pos) {
            if (inPos && pos != inPos) {
                continue;
            }

            if (!this.user.pos[pos].hid) {
                continue;
            }

            var memPosData = this.memData.pos[pos];
            var suitCount = memPosData.equip_suit_count = {};

            var equips = this.user.pos[pos].equip;
            for (var slot in equips) {
                var eid = equips[slot];
                if (!eid) {
                    continue;
                }

                var equip = this.user.bag.equip[eid];
                if (!equip) {
                    continue;
                }

                var equipId = equip.id;

                var suitId = gEquipSuitId[equipId];
                if (suitId) {
                    if (suitCount[suitId]) {
                        suitCount[suitId] += 1;
                    } else {
                        suitCount[suitId] = 1;
                    }
                }
            }
        }
        */
    },

    ispassbattle: function (limitType, limitCustom) {
        var user = this.user;
        var myValue = user.battle.type * 10000 + user.battle.progress;
        var targetV = (+limitType) * 10000 + (+limitCustom);
        ERROR('myValue:' + myValue + ' targetV' + targetV);
        if (myValue > targetV) {
            return true;
        } else {
            return false;
        }
    },

    checkFightforce: function (ff, levels) {
        if (!gVerify) {
            return true;
        }

        if (ff == NaN || levels == NaN) {
            return false;
        }

        if (!ff) {
            return true;
        }

        if (ff < this.getFightForce() * 1.5) {
            var sumLevel = this.user.status.level;
            var pos = this.user.pos;
            for (var i in pos) {
                sumLevel += pos[i].level;
            }
            if (levels == sumLevel) {
                return true;
            }
        }

        var wssReq = {
            uid: this.user.info.uid,
            mod: 'user',
            act: 'trick',
            type: '',
            flag: '',
            args: {},
        };
        requestWss(wssReq, {});
        return false;
    },

    checkFight: function (sig, type) {
        if (!this.memData.fight_time) {
            return false;
        }

        var pKey = '79e02043dragon61304b1f2e9ca6a';
        var rawStr = '%d:%d:%d:%s|%s';

        // 先刷新属性
        this.getFightForce();
        var randoIndex = this.user.team[1][this.memData.rand_pos];
        var attrs = this.user.hero_bag.heros[randoIndex].attr;
        var values = [];
        this.memData.rand_attrs.forEach(function (attr) {
            values.push(attrs[attr]);
        });

        rawStr = util.format(rawStr, values[0], values[1], values[2], type, pKey);

        this.memData.fight_time = 0;
        return sig == common.md5(rawStr);
    },

    // 处理礼包购买
    handleGiftBuy: function (gift_key, gift_id) {
        var user = this.user;
        if (gift_key == 'avgiftbag') {
            var conf = gConfGiftBag[gift_id];
            if (conf) {
                var awards = this.addAwards(conf.rewards);
                if (this.memData.payAwards) {
                    this.memData.payAwards = this.memData.payAwards.concat(awards.awards);
                } else {
                    this.memData.payAwards = awards.awards;
                }
                var giftBagData = user.activity.gift_bag[gift_id];
                if (giftBagData) {
                    giftBagData.buy_count++;
                    if (giftBagData.buy_count >= conf.count) {
                        giftBagData.sell_out_time = common.getTime();
                    }
                    this.markDirty(util.format('activity.gift_bag.%d', gift_id));
                }
            }
        } else if (gift_key == 'openseven') {
            var conf = gConfOpenSevenReward[gift_id];
            if (conf) {
                // 检测是否在当天
                if (this.getCreateDaysFix() + 1 < conf.needday) {
                    ERROR('===============' + this.getCreateDays());
                    DEBUG(`${this.uid} ${gift_key} ${gift_id}, 充了值但是没有发奖励，因为他冲的不是当天的`);
                    return;
                }
                var awards = this.addAwards(conf.award);
                if (this.memData.payAwards) {
                    this.memData.payAwards = this.memData.payAwards.concat(awards.awards);
                } else {
                    this.memData.payAwards = awards.awards;
                }

                user.activity.open_seven.progress[gift_id] = [1, 1];
                this.markDirty(util.format('activity.open_seven.progress.%d', gift_id));
            }
        } else if (gift_key == 'openholiday') {
            var conf = gConfOpenHolidayReward[gift_id];
            if (conf) {
                var awards = this.addAwards(conf.award);
                if (this.memData.payAwards) {
                    this.memData.payAwards = this.memData.payAwards.concat(awards.awards);
                } else {
                    this.memData.payAwards = awards.awards;
                }

                if (!user.activity.open_holiday.progress[gift_id]) {
                    user.activity.open_holiday.progress[gift_id] = [1, 1];
                } else {
                    user.activity.open_holiday.progress[gift_id][1]++;
                }

                this.markDirty(util.format('activity.open_holiday.progress.%d', gift_id));
            }
        }
        else if (gift_key == "dragonmanual") {
            awards = this.addAwards(parseAwardsConfig(gConfGlobalNew.avmanuallyVipExp));
            if (this.memData.payAwards) {
                this.memData.payAwards = this.memData.payAwards.concat(awards.awards);
            } else {
                this.memData.payAwards = awards.awards;
            }
        }
        else {
            switch (gift_key + "_" + gift_id) {
                case gConfGlobalNew["avZerogiftGmRechargeid"]:
                    awards = this.addAwards(parseAwardsConfig(gConfGlobalNew["avZerogiftBuyAward"]));
                    if (this.memData.payAwards) {
                        this.memData.payAwards = this.memData.payAwards.concat(awards.awards);
                    } else {
                        this.memData.payAwards = awards.awards;
                    }
                    break;
                default:
                    break;
            }
        }

    },

    /**
     * 第三方直充
     * @param {string} order_id                  // 订单号
     * @param {number} game_coin                 // 钻石数量
     * @param {number} bonus_game_coin           // 返利钻石数量，返利钻石需要用单独的邮件发放给玩家
     * @param {number} pay_time                  // 订单时间戳
     * @param {number} total_fee                 // 订单金额
     * @param {string} currency                  // 币种
     * @param {string} order_type                // 商品类型（也可理解为商品ID），没传或值为0的时候，根据game_coin参数发放对应数量的钻石/元宝；如为其它值，则发放特殊物品（如周卡/月卡/礼包）等，特殊物品的值可以跟开发人员商量定义
     * @param {number} is_sandbox                // 是否是测试订单
     */
    pay_direct_access: function (order_id, game_coin, bonus_game_coin, pay_time, total_fee, currency, order_type, is_sandbox) {

        // var order_id = order_id;
        // var game_coin = game_coin;
        // var bonus_game_coin = bonus_game_coin;
        // var pay_time = pay_time;
        // var total_fee = total_fee;
        // var currency = currency;
        // var order_type = order_type;
        // var is_sandbox = is_sandbox;
        total_fee = (total_fee - 0) || 0;
        game_coin = (game_coin - 0) || 0;
        bonus_game_coin = (bonus_game_coin - 0) || 0;
        var user = this.user;

        var gem_desc = "";
        var number = game_coin;
        this.memData.payAwards = this.memData.payAwards || [];
        if (game_coin) {
            gem_desc = "user.cash:" + game_coin;
            var specialAwardConf = parseAwardsConfig(gem_desc);
            var specialAward = this.addAwards(specialAwardConf, 'player', 'third_direct_pay');
            this.memData.payAwards = this.memData.payAwards.concat(specialAward.awards);
        }

        //user.payment.money += total_fee;
        //user.payment.day_money += total_fee;
        user.payment.day_paid = (user.payment.day_paid - 0) || 0;
        user.payment.paid = (user.payment.paid - 0) || 0;
        user.payment.day_paid += game_coin;
        user.payment.paid += game_coin;

        var gift_key = 0;
        var gift_id = 0;
        var t_order_type_list = [];
        if (order_type) {
            t_order_type_list = order_type.split("_");
        }
        if (t_order_type_list && t_order_type_list.length == 2) {
            gift_key = t_order_type_list[0];
            gift_id = t_order_type_list[1];
        }
        this.pay(number, 0, 0, gift_key, gift_id, "third_pay", 0, total_fee);

        if (bonus_game_coin) {
            gem_desc = "user.bindcash:" + bonus_game_coin;
            var specialAwardConf = parseAwardsConfig(gem_desc);
            var now = common.getTime();
            var mail = {
                content: [1016, total_fee],
                awards: specialAwardConf,
                time: now,
                expire: now + gConfMail[1016].time * OneDayTime,
            };

            requestWorldByModAndAct({ uid: user._id }, 'mail', 'add_mail', { mail: mail });
        }

        var phpReq = {                                                                          // 第三方订单，单独记录日志
            uid: this.uid,
            act: 'third_direct_pay' + (is_sandbox ? "_sandbox" : ""),
            args: {
                sid: config.DistId,
                openid: this.user.info.account,
                level: this.user.status.level,
                order: order_id || 0,
                amount: total_fee || 0,
                chargeId: 0,
                gift_key: gift_key,
                gift_id: gift_id,
                platform: this.user.info.platform,
                device_id: this.user.info.device_id,
            },
        };
        LogCollect(phpReq.uid, phpReq.act, phpReq.args);
    },

    thirdPay: function (type, number, amt, order) {
        amt = (amt - 0) || 0;
        number = (number - 0) || 0;
        var user = this.user;
        user.payment.money = (user.payment.money - 0) || 0;
        user.payment.day_money = (user.payment.day_money - 0) || 0;
        user.payment.money += amt;
        user.payment.day_money += amt;
        if (type == 'cash') {
            user.payment.day_paid = (user.payment.day_paid - 0) || 0;
            user.payment.paid = (user.payment.paid) || 0;
            user.payment.day_paid += number;
            user.payment.paid += number;
            // user.status.vip_xp += number;
            // this.markDirty('status.vip_xp');
            // this.updateVip();
        }
        this.markDirty('payment');

        this.memData.chargeId = 0;
        this.addResource(type, number, 'player', 'third_pay');
        if (!this.memData.payAwards) {
            this.memData.payAwards = [['user', type, number]];
        } else {
            this.memData.payAwards.push(['user', type, number]);
        }

        if (type == 'cash') {
            this.pay(number, 0, 0, 0, 0, "third_pay", 0, amt)

            // 第三方订单，单独记录日志
            var phpReq = {
                uid: this.uid,
                act: 'user_pay',
                args: {
                    sid: config.DistId,
                    openid: this.user.info.account,
                    level: this.user.status.level,
                    order: order || 0,
                    amount: amt || 0,
                    chargeId: 0,
                    gift_key: 0,
                    gift_id: 0,
                    platform: this.user.info.platform,
                    device_id: this.user.info.device_id,
                },
            };
            LogCollect(phpReq.uid, phpReq.act, phpReq.args);
        }

        pushToUser(this.uid, 'self', {
            mod: 'user',
            act: 'get_pay',
            args: {},
        });
        this.payNotify = true;
    },

    pay: function (cash, chargeId, order, gift_key, gift_id, third_pay, fake, totle_fee) {
        var user = this.user;
        var extraCash = 0;
        var rechargeConf = gConfRecharge[chargeId];
        var amount = totle_fee || 0;
        if (rechargeConf) {
            amount = rechargeConf.amount || amount;

            var payList = user.payment.pay_list;
            var payRecords = user.payment.pay_records;
            var payCount = payList[chargeId] || 0;
            var payFrequency = payRecords[chargeId] || 0; // first pay
            payCount += 1;
            payFrequency += 1;

            if (rechargeConf && (rechargeConf.type == 'weekCard' || rechargeConf.type == 'monthCard')) {

            } else {
                if (payCount == 1 || payFrequency == 1) {
                    extraCash = rechargeConf.firstExtraAward
                } else {
                    extraCash = rechargeConf.extraAward
                }
            }

            payRecords[chargeId] = payFrequency;
            payList[chargeId] = payCount;
            user.payment.day_paid += cash;
            user.payment.paid += cash;
            user.payment.last_pay_time = common.getTime();
            this.markDirty('payment');
        }

        amount = (amount - 0) || 0;
        if (amount) {
            user.payment.money += amount;
            user.payment.day_money += amount;
            //user.payment.paid += amount * 10;
            user.payment.last_pay_money = amount;
            this.markDirty('payment');
        }

        if (!this.memData.payAwards) {
            this.memData.payAwards = [];
        }

        if (cash != 0 && !third_pay) {
            this.addResource('cash', cash, 'player', 'pay');
            this.memData.payAwards.push(['user', 'cash', cash]);
        }

        // 记录一下本次充值获得的奖励
        this.memData.chargeId = chargeId;

        if (extraCash.length && extraCash[0][2] > 0) {
            this.addResource(extraCash[0][1], extraCash[0][2], 'player', 'pay');// 新加的
            this.memData.payAwards = this.memData.payAwards.concat(extraCash);
        }

        //this.updateFirstPayProgress('single_recharge');
        this.updateFirstPayProgress();

        if (rechargeConf && rechargeConf.type == 'month') {
            user.payment.gift_cash += extraCash[0][2];
            this.markDirty('payment.gift_cash');
        }

        if (rechargeConf && rechargeConf.type == 'weekCard') {
            this.doDailyTask('weekCard', 1);
            this.doDailyTask('doubleCard', 1);

            var specialAwardConf = parseAwardsConfig(gConfGlobalNew.weekCardSpecialAward);
            var specialAward = this.addAwards(specialAwardConf, 'player', 'pay');
            this.memData.payAwards = this.memData.payAwards.concat(specialAward.awards);
        }

        if (rechargeConf && rechargeConf.type == 'monthCard') {
            this.doDailyTask('monthCard', 1);
            this.doDailyTask('doubleCard', 1);

            var specialAwardConf = parseAwardsConfig(gConfGlobalNew.monthCardSpecialAward);
            var specialAward = this.addAwards(specialAwardConf, 'player', 'pay');
            this.memData.payAwards = this.memData.payAwards.concat(specialAward.awards);
        }

        if (rechargeConf && rechargeConf.type == 'longCard') {
            this.doDailyTask('longCard', 1);
            //this.doDailyTask('doubleCard', 1);
        }

        this.onPay(cash, chargeId, order, amount, gift_key, gift_id, third_pay, fake);

        if (this.user.info.platform == "winner_zancheng") {
            this.post_payment(order, amount);
        }
    },

    check_resback: function () {
        return ResBack.check_resback(this);
    },
    // ---------------武将逻辑相关------------------


    // 能否加英雄的逻辑放在调用此函数之前判断
    addHero: function (hid, num) {
        /*mod by fish
        var posObj = this.user.pos[pos];
        posObj.hid = hid;

        this.memData.pos[pos] = {
            'ffchanged': 1,
            'fate': [],
            'innate': {},
            'equip_suit_count': {},
            'equip_changed': {},
            'uni_equip_changed': {},
            'rune_changed': {},
        };
        this.memData.ffchanged = 1;

        this.markDirty(util.format("pos.%d.hid", pos));
        this.markFightForceChanged(pos);
        */

        var hBagObj = this.user.hero_bag;
        var max = this.getHeroBagMax();
        //ERROR('======HERO====MAX:'+max);
        if (Object.keys(hBagObj.heros).length >= max) {
            return [];
        }

        var initRole = {
            'rid': 0,      // 主公的武將id
            'awake': 1,    // 老天命，初始1級，武将觉醒等级，决定技能等级 配置星級+awake = 顯示星級
            'tier': 0,     // 品阶（6星以上10阶才能觉醒）
            'level': 1,
            'equip': {                          // 装备
                '1': 0,                        // 头盔
                '2': 0,                        // 武器
                '3': 0,                        // 腰带
                '4': 0,                        // 盔甲
                '5': 0,                        // 鞋子
                '6': 0,                        // 项链
            },
            'rune_use': [0, 0, 0, 0],
            'talent': {
                'point': 0,
                'tree': [0, 0, 0, 0, 0, 0],    // 0-1-2
            },
            'part': {
                '1': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '2': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '3': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '4': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '5': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
                '6': {
                    'level': 0,
                    'exp': 0,
                    'awake_level': 0,
                    'max_awake': false,
                    'gems': {
                        '1': 0,
                        '2': 0,
                        '3': 0,
                        '4': 0,
                    },
                },
            },
            'attr': {},
        };

        // init attr
        for (var attr in Attribute) {
            initRole['attr'][Attribute[attr]] = 0;
        }

        var hBagObj = this.user.hero_bag;
        var herosObj = hBagObj.heros;
        var getArr = [];
        for (var i = 1; i <= num; i++) {
            var newIndex = hBagObj.index;
            var newRole = clone(initRole);
            newRole.rid = +hid;
            herosObj[newIndex] = newRole;

            getArr.push(newIndex);
            hBagObj.index = hBagObj.index + 1;
            this.markDirty('hero_bag.heros.' + newIndex);

            this.onCardGetOneCallback(+hid, newIndex);
        }

        //this.getFightForce(true);
        this.markFightForceChanged(1);
        this.markDirty('hero_bag.index');
        return getArr;
    },

    addInTeam: function (index, teamId, pos) {
        if (pos > 9 || pos <= 0) {
            //ERROR('111111111pos='+pos);
            return false;
        }

        if (!this.user.hero_bag.heros[index]) {
            //ERROR('1111111111='+index);
            return false;
        }

        if (!this.user.team[teamId]) {
            this.user.team[teamId] = {};
        }

        this.memData.ffchanged = 1;

        this.user.team[teamId][index] = +pos;
        this.markDirty('team');
        this.getFightForce();
        return true;
    },

    addToTeam: function (teamId, hid) {
        var user = this.user;
        var team = {};

        var oldNum = Object.keys(user.team[teamId]).length;
        var level = user.status.level;
        if ((1 + oldNum) >= gConfLevel[level].heroNum) {
            return 0;
        }
        for (var tKey in user.team[teamId]) {
            team[tKey] = user.team[teamId][tKey];
        }
        var i;
        for (i = 1; i <= 9; i++) {
            if (team[i]) { continue; }
            team[i] = hid - 0;
            break;
        }

        var tIsSyncOK = this.syncTeam(teamId, team);
        if (tIsSyncOK) {
            return i;
        }
        else {
            return 0;
        }
    },

    syncTeam: function (teamId, team) {
        var user = this.user;

        // 保存阵容
        var valid = true;
        var oldNum = Object.keys(user.team[teamId]).length;
        var newNum = Object.keys(team).length;

        if (newNum > 7 || oldNum > newNum) {
            return false;
        }

        if (!team || teamId > 3 || teamId <= 0) {
            return false;
        }
        if (Object.keys(team).length > 7) {
            return false;
        }

        for (var hid in team) {
            if (!user.hero_bag.heros[hid]) {
                valid = false; break;
            }
        }

        if (!valid) {
            return false;
        }

        user.team[teamId] = team;
        this.markDirty('team.' + teamId);

        this.syncDefTeam(teamId);

        this.markFightForceChanged();
        this.getFightForce();

        return true;
    },

    findOneUnusePosInTeam: function (team) {
        var usePosMap = {};

        for (var hid in team) {
            var pos = team[hid];
            usePosMap[pos] = true;
        }

        var index = -1;

        for (var i = 1; i <= 9; i++) {
            if (!usePosMap[i]) {
                index = i;
                break;
            }
        }

        return index;
    },

    syncDefTeam: function (teamId) {
        var user = this.user;
        var team = this.user.team[teamId];

        var defNewTeam = {};
        var defOldTeam = user.def_info.team;

        for (var hid in team) {
            // 如果以前防守阵型里有这个武将
            if (defOldTeam[hid]) {
                defNewTeam[hid] = defOldTeam[hid];
            }
            else {
                defNewTeam[hid] = 0;
            }
        }

        // 修复错误数据
        var usePosMap = {};

        for (var hid in defNewTeam) {
            var pos = defNewTeam[hid];

            // 如果这个pos已经被使用了，或者为0，就找一个空位置分配给他
            if (usePosMap[pos] || pos <= 0) {
                var newPos = this.findOneUnusePosInTeam(defNewTeam);

                DEBUG("zzx newPos = " + newPos);

                defNewTeam[hid] = newPos;

                usePosMap[newPos] = true;
            }
            else {
                usePosMap[pos] = true;
            }
        }

        user.def_info.team = defNewTeam;
        this.markDirty('def_info.team');
    },

    getRoleTeamPos: function (index) {
        if (index <= 0) {
            //ERROR('111111111pos='+pos);
            return false;
        }

        if (!this.user.hero_bag.heros[index]) {
            //ERROR('1111111111='+index);
            return false;
        }

        if (!this.user.team[1][index]) {
            //ERROR('1111111111='+index);
            return false;
        }
        var pos = this.user.team[1][index];
        var posRet = { 'id': 1, 'pos': +pos };

        return posRet;
    },

    getHeroRetrunAwards: function (theHero, resolve) {
        // tier return 
        var awards = [];
        var heroConf = gConfHero[theHero.rid];
        if (!heroConf) {
            return [];
        }

        //ERROR('====getHeroRetrunAwards===LIMIT:'+resolve);
        if (resolve) {
            var resolveAward = heroConf['resolveAward'];
            awards = awards.concat(resolveAward);
        }

        var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
        //gConfCombatHeroTemplate[heroTemplateId]['']     
        if (theHero.awake > 4) {
            heroTemplateId = heroConf.templatedIdUltimate;
        }

        // 模板類型
        var rebornType = gConfCombatHeroTemplate[heroTemplateId]['rebornType'];
        var tier = theHero.tier;
        if (gConfReborn[rebornType][tier]) {
            var tierAwards = clone(gConfReborn[rebornType][tier]['return']);
            if (resolve) {
                for (var i = 0; i < tierAwards.length; i++) {
                    var rate = +gConfGlobalNew['heroReturnTier' + (i + 1)];
                    tierAwards[i][2] = Math.ceil(tierAwards[i][2] * (rate / 100));
                }
            }

            //ERROR('gConfReborn');
            //ERROR(tierAwards);
            awards = awards.concat(tierAwards);
        }

        // level return
        var levelAwards = clone(gConfLevel[theHero.level]['roleUpGradeReturn']);
        if (resolve) {
            for (var i = 0; i < levelAwards.length; i++) {
                var rate = +gConfGlobalNew['heroReturnLevel' + (i + 1)];
                levelAwards[i][2] = Math.ceil(levelAwards[i][2] * (rate / 100));
            }
        }
        //ERROR('levelAwards');
        //ERROR(levelAwards);
        awards = awards.concat(levelAwards);

        //part awake
        for (var pos in theHero.part) {
            var awakeLevel = theHero.part[pos]['awake_level'];
            var maxAwake = theHero.part[pos]['max_awake'];

            if (maxAwake) {
                var tReturnHeroRID = gConfHero[theHero.rid]['selfCostId'];
                var tReturnInfo = gConfPartBase[pos].return;
                var tRID = 0;
                switch (tReturnInfo[0]) {
                    case 1:
                        tRID = tReturnInfo[1];
                        // awards = awards.concat(["card", tReturnInfo[1], tReturnInfo[2]]);
                        break;
                    case 2:
                        // awards = awards.concat(["card", tReturnInfo[1], tReturnInfo[2]]);
                        break;
                    case 3:
                        tRID = tReturnHeroRID
                        // awards = awards.concat(["card", tReturnHeroRID, tReturnInfo[2]]);
                        break;
                }
                var itemConf = gConfItem[tRID];

                if (!itemConf) { continue; }
                var tItemNum = itemConf.mergeNum * tReturnInfo[2];

                if (!(tItemNum > 0)) { continue; }
                awards.push(["fragment", tRID, tItemNum]);

                // var maxAwards = clone(gConfPartBase[pos].return);
                // if (resolve) {
                //     for (var i = 0; i < maxAwards.length; i++) {
                //         var rate = +gConfGlobalNew['heroReturnPart1'];
                //         maxAwards[i][2] = Math.ceil(maxAwards[i][2] * (rate / 100));
                //     }
                // }
                // //ERROR('maxAwards');
                // //ERROR(maxAwards);
                // awards = awards.concat(maxAwards);
            }

            if (awakeLevel <= 0 || !gConfPartAwake[pos][awakeLevel]) {
                continue;
            }

            var partAwards = clone(gConfPartAwake[pos][awakeLevel]['return']);
            if (resolve) {
                for (var i = 0; i < partAwards.length; i++) {
                    var rate = +gConfGlobalNew['heroReturnPart1'];
                    partAwards[i][2] = Math.ceil(partAwards[i][2] * (rate / 100));
                }
            }

            //ERROR('partAwards');
            //ERROR(partAwards);
            awards = awards.concat(partAwards);
        }

        //awake
        if (resolve && theHero.awake > 1) {
            var awakeRreward = clone(gConfDestiny[theHero.awake]['return']);
            if (resolve) {
                for (var i = 0; i < awakeRreward.length; i++) {
                    var rate = +gConfGlobalNew['heroReturnAwake' + (i + 1)];
                    awakeRreward[i][2] = Math.ceil(awakeRreward[i][2] * (rate / 100));
                }
            }

            //ERROR('awakeRreward');
            //ERROR(awakeRreward);
            awards = awards.concat(awakeRreward);
        }

        // role


        return awards;
    },

    resetHeros: function (hid) {
        var awards = [];
        var herosObj = this.user.hero_bag.heros;

        var theHero = herosObj[hid];
        if (hid == 1 || !theHero) {
            //ERROR('================error delete hero in palyer.deleteHeros');
            return [];
        }

        var oneReturn = this.getHeroRetrunAwards(theHero, false);
        awards = awards.concat(oneReturn);

        // equip  'hid': 0,
        var theEquips = theHero.equip;
        for (var id in theEquips) {
            var eId = theEquips[id];
            if (eId == 0) {
                continue;
            }
            this.user.bag.equip[eId].hid = 0;
            this.markDirty(util.format('bag.equip.%d.hid', eId));

            theEquips[id] = 0;
        }

        // gems
        var partInfo = theHero.part;
        for (var pos in partInfo) {
            var partGems = partInfo[pos].gems;
            for (var k = 1; k <= 4; k++) {
                var gid = partGems[k];
                if (gid <= 0) { continue; }
                awards.push(['gem', +gid, +1]);

                partGems[k] = 0;
            }
            partInfo[pos].level = 0;
            partInfo[pos].max_awake = false;
            partInfo[pos].exp = 0;
            partInfo[pos].awake_level = 0;
        }

        // rune 
        var runeUse = theHero.rune_use;
        for (var index = 0; index < 4; index++) {
            var runId = runeUse[index];
            if (runId <= 0) { continue; }
            this.changeRune(runId, 0);
            runeUse[index] = 0;
        }

        herosObj[hid].tier = 0;
        herosObj[hid].level = 1;
        this.markDirty("hero_bag.heros." + hid);

        return awards;
    },

    deleteHeros: function (hids, isResolve) {
        var awards = [];
        var herosObj = this.user.hero_bag.heros;

        for (var i = hids.length - 1; i >= 0; i--) {
            var hid = hids[i];
            // fanhuan ziyuan
            var theHero = herosObj[hid];
            if (hid == 1 || !theHero) {
                //ERROR('================error delete hero in palyer.deleteHeros');
                continue;
            }

            var oneReturn = this.getHeroRetrunAwards(theHero, isResolve);
            awards = awards.concat(oneReturn);
            //ERROR('============all return ===============');
            //ERROR(awards);
            //awards.push(['user','cash',10*theHero.level]);// waite for huang todo
            /*
            var awards = clone(gConfHero[cid].resolveAward);
            for (var i = 0; i < awards.length; i++) {
                awards[i][2] = awards[i][2] * num;
            }*/

            // equip  'hid': 0,
            var theEquips = theHero.equip;
            for (var id in theEquips) {
                var eId = theEquips[id];
                if (eId == 0) {
                    continue;
                }

                this.user.bag.equip[eId].hid = 0;
                this.markDirty(util.format('bag.equip.%d.hid', eId));
            }

            // gems
            var partInfo = theHero.part;
            for (var pos in partInfo) {
                var partGems = partInfo[pos].gems;
                for (var k = 1; k <= 4; k++) {
                    var gid = partGems[k];
                    if (gid > 0) {
                        awards.push(['gem', +gid, +1]);
                    }
                }
            }

            // rune 
            var runeUse = theHero.rune_use;
            for (var index = 0; index < 4; index++) {
                var runId = runeUse[index];
                if (runId > 0) {
                    this.changeRune(runId, 0);
                }
            }

            delete herosObj[hid];
            this.markDelete("hero_bag.heros." + hid);
        }

        return awards;
    },

    refineImpl: function (eid, subattr, attrArray) {
        var refineNum = 0;
        for (var i = 0; i < attrArray.length; i++) {
            var attrId = attrArray[i];
            switch (+attrId) {
                case Attribute.HIT:                            // 命中
                    var baseHit = gConfEquip[eid]['baseHit'];
                    var hitPer = gConfEquip[eid]['hitPercentage'];
                    var minHit = Math.round(baseHit * (1 - hitPer / 100));
                    var maxHit = Math.round(baseHit * (1 + hitPer / 100));
                    if (subattr[attrId] != maxHit) {
                        var hit = common.randRange(minHit, maxHit);
                        subattr[attrId] = hit;
                        refineNum++;
                    }
                    break;
                case Attribute.DODGE:                           // 闪避
                    var baseDodge = gConfEquip[eid]['baseDodge'];
                    var dodgePer = gConfEquip[eid]['dodgePercentage'];
                    var minDodge = Math.round(baseDodge * (1 - dodgePer / 100));
                    var maxDodge = Math.round(baseDodge * (1 + dodgePer / 100));
                    if (subattr[attrId] != maxDodge) {
                        var dodge = common.randRange(minDodge, maxDodge);
                        subattr[attrId] = dodge;
                        refineNum++;
                    }
                    break;
                case Attribute.CRIT:                           // 暴击
                    var baseCrit = gConfEquip[eid]['baseCrit'];
                    var critPer = gConfEquip[eid]['critPercentage'];
                    var minCrit = Math.round(baseCrit * (1 - critPer / 100));
                    var maxCrit = Math.round(baseCrit * (1 + critPer / 100));
                    if (subattr[attrId] != maxCrit) {
                        var crit = common.randRange(minCrit, maxCrit);
                        subattr[attrId] = crit;
                        refineNum++;
                    }
                    break;
                case Attribute.RESI:                           // 韧性
                    var baseResi = gConfEquip[eid]['baseResi'];
                    var resiPer = gConfEquip[eid]['resiPercentage'];
                    var minResi = Math.round(baseResi * (1 - resiPer / 100));
                    var maxResi = Math.round(baseResi * (1 + resiPer / 100));
                    if (subattr[attrId] != maxResi) {
                        var resi = common.randRange(minResi, maxResi);
                        subattr[attrId] = resi;
                        refineNum++;
                    }
                    break;
                default:
                    break;
            }
        }

        return refineNum;
    },

    addEquip: function (id, grade, intensify, refine_exp, mod, act) {
        var equip = {
            'id': +id,
            'grade': 0,
            'hid': 0,
        };

        if (grade) {
            equip.grade = grade;
        }

        var eid = this.nextId();
        this.user.bag.equip[eid] = equip;
        this.markDirty('bag.equip.' + eid);

        var args = {
            uid: this.uid,
            eid: eid,
            id: id,
            grade: grade,
            intensify: 0,
            refine_exp: 0,
            mod: mod,
            act: act,
        }

        addGameLog(LogType.LOG_EQUIP_PRODUCE, args, null);

        return eid;
    },

    addRune: function (id, mod, act) {
        var rune = {
            'id': +id,
            'level': 0,
            'hid': 0,
        };

        // 随机基础属性
        var baseAttrId = common.randRange(1, 4);
        rune.base_attr = baseAttrId;

        var runeConf = gConfRuneConf[id];
        if (!runeConf) {
            ERROR('rune not found, id = ' + id);
            return 0;
        }

        // 随机特殊属性
        rune.attrs = [];

        var numWeights = {};
        for (var i = 0; i < runeConf.attNumWeight.length; i++) {
            numWeights[i] = runeConf.attNumWeight[i];
        }

        var execpts = [];
        var specialAttNum = runeConf.attNum[common.wRand(numWeights)];
        for (var i = 0; i < specialAttNum; i++) {
            var attr = randRuneSpecialAtt(runeConf.attMode, execpts);
            rune.attrs.push(attr);
            execpts.push(attr[2])
        }

        var rid = this.nextId();
        this.user.bag.rune[rid] = rune;
        this.markDirty('bag.rune.' + rid);

        var args = {
            uid: this.uid,
            rid: rid,
            id: id,
            mod: mod,
            act: act,
        }

        addGameLog(LogType.LOG_RUNE_PRODUCE, args, null);

        return rid;
    },

    changeRune: function (rid, hid) {
        var rune = this.user.bag.rune[rid];

        if (!rune) {
            return false;
        }

        if (hid < 0) {
            return false;
        }

        rune.hid = hid;
        this.markDirty('bag.rune.' + rid);
        return true;
    },

    addDragonGem: function (id, mod, act, attr) {
        var conf = gConfDragonGem[id];
        if (!conf) {
            return;
        }

        var gid = this.nextId();

        if (!attr) {
            attr = common.randRange(conf.min, conf.max);
        }

        var dragonGem = {
            id: +id,
            dragon: 0,
            attr: attr,
        };

        this.user.bag.dragon[gid] = dragonGem;
        this.markDirty('bag.dragon.' + gid);

        var args = {
            uid: this.uid,
            gid: gid,
            id: id,
            attr: attr,
            mod: mod,
            act: act,
        }

        addGameLog(LogType.LOG_DRAGON_PRODUCE, args, null);

        return gid;
    },

    addLimitMat: function (id, type, expire, num, mod, act) {
        var mid = this.nextId();
        var realExpire = 0;
        if (type == 1) {
            realExpire = common.getTime(Math.floor(expire / 100)) + expire % 100 * 3600;
        } else if (type == 2) {
            realExpire = common.getTime() + expire * 86400;
        }

        var limitmat = {
            id: +id,
            num: +num,
            type: +type,
            expire: realExpire,
        };

        this.user.bag.limitmat[mid] = limitmat;
        this.markDirty('bag.limitmat.' + mid);
        return mid;
    },

    // 增加人皇装备
    addWeaponEquip: function (id, type, time, mod, act) {
        var skySuit = this.user.sky_suit;
        var weaponEquip = skySuit.weapon_illusion_equip;
        var weaponEquipTime = skySuit.weapon_illusion_equip_time;
        var now = common.getTime();
        // 限时
        if (type == 1) {
            if (!weaponEquipTime[id]) {
                weaponEquipTime[id] = now + time * 24 * 3600;
            } else {
                weaponEquipTime[id] += time * 24 * 3600;
            }
        } else if (type == 2) {
            // 永久
            if (!weaponEquip[id]) {
                weaponEquip[id] = time;
            } else {
                return;
            }
        }

        if (type == 1) {
            this.markDirty('sky_suit.weapon_illusion_equip_time.' + id);
        } else if (type == 2) {
            this.markDirty('sky_suit.weapon_illusion_equip.' + id);
        }

        this.updateSkyCollect('weapon');
        this.markFightForceChangedAll();
    },

    // 增加人皇装备
    addWingEquip: function (id, type, time, mod, act) {
        var skySuit = this.user.sky_suit;
        var wingEquip = skySuit.wing_illusion_equip;
        var wingEquipTime = skySuit.wing_illusion_equip_time;
        var now = common.getTime();
        // 限时
        if (type == 1) {
            if (!wingEquipTime[id]) {
                wingEquipTime[id] = now + time * 24 * 3600;
            } else {
                wingEquipTime[id] += time * 24 * 3600;
            }
        } else if (type == 2) {
            // 永久
            if (!wingEquip[id]) {
                wingEquip[id] = time;
            } else {
                return;
            }
        }

        if (type == 1) {
            this.markDirty('sky_suit.wing_illusion_equip_time.' + id);
        } else if (type == 2) {
            this.markDirty('sky_suit.wing_illusion_equip.' + id);
        }

        this.updateSkyCollect('wing');
        this.markFightForceChangedAll();
    },

    // 增加人皇坐骑
    addSkyMount: function (id, type, time, mod, act) {
        var skySuit = this.user.sky_suit;
        var mountEquip = skySuit.mount_illusion_equip;
        var mountEquipTime = skySuit.mount_illusion_equip_time;
        var now = common.getTime();
        // 限时
        if (type == 1) {
            if (!mountEquipTime[id]) {
                mountEquipTime[id] = now + time * 24 * 3600;
            } else {
                mountEquipTime[id] += time * 24 * 3600;
            }
        } else if (type == 2) {
            // 永久
            if (!mountEquip[id]) {
                mountEquip[id] = time;
            } else {
                return;
            }
        }

        if (type == 1) {
            this.markDirty('sky_suit.mount_illusion_equip_time.' + id);
        } else if (type == 2) {
            this.markDirty('sky_suit.mount_illusion_equip.' + id);
        }

        this.updateSkyCollect('mount');
        this.markFightForceChangedAll();
    },

    costLimitMat: function (id, num, mod, act) {
        var limitmat = this.user.bag.limitmat;
        var costs = [];
        for (var i = 0, len = this.memData.limitmat.length; i < len && num; i++) {
            var earliest = this.memData.limitmat[i][0];
            var mat = limitmat[earliest];
            if (mat.id != id) {
                continue;
            }
            if (mat.num + num > 0) {
                mat.num += num;
                this.markDirty('bag.limitmat.' + earliest);
                costs.push(['limitmat', earliest, num]);
                num = 0;
            } else {
                this.memData.limitmat.splice(i, 1);
                delete limitmat[earliest];
                this.markDelete('bag.limitmat.' + earliest);
                costs.push(['limitmat', earliest, -mat.num]);
                num += mat.num;
                i--;
                len--;
            }
        }
        return costs;
    },

    updateLimitMat: function () {
        var now = common.getTime();
        for (var i = 0, len = this.memData.limitmat.length; i < len; i++) {
            var limitmat = this.memData.limitmat[i];
            if (limitmat[1] < now) {
                this.memData.limitmat.shift();
                delete this.user.bag.limitmat[limitmat[0]];
                this.markDelete('bag.limitmat.' + limitmat[0]);
                i--;
                len--;
            } else {
                break;
            }
        }
    },

    checkCosts: function (costs) {
        if (!costs) return true;

        var reformCost = reformAwards(costs)
        var now = common.getTime();
        for (var i = 0, max = reformCost.length; i < max; i++) {
            var cost = reformCost[i];
            var costType = cost[0];
            var costId = cost[1];
            var costNum = Math.floor(+cost[2]);
            if (isNaN(costNum)) continue;

            var user = this.user;
            if (costType == 'user') {
                if (costId == 'food') {
                    this.getFood(common.getTime());
                }

                if (costId == 'food_red') {
                    this.getFoodRed(common.getTime());
                }

                if (costId == 'staying_power') {
                    this.getStayingPower(common.getTime());
                }

                if (costId == 'action_point') {
                    this.getActionPoint(common.getTime());
                }

                if (costId == 'mixcash') {
                    var costBindCash = Math.abs(costNum);
                    var hasBindCash = user.status.bindcash;
                    if (hasBindCash < costBindCash) {
                        costBindCash = hasBindCash;

                        var needCash = Math.abs(costNum) - costBindCash;
                        var hasCash = user.status.cash;
                        if (hasCash < needCash) {
                            return false;
                        }
                    }
                } else {
                    var status = user.status;
                    if (status.hasOwnProperty(costId)) {
                        if (isNaN(costNum)) {
                            ERROR('add award error type: ' + costId + 'number: ' + costNum);
                            return false;
                        }
                        if (status[costId] + costNum < 0) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            } else if (costType == 'equip') {
                if (!this.user.bag.equip[costId]) {
                    return false;
                }
            } else if (costType == 'dragon') {
                if (!this.user.bag.dragon[costId]) {
                    return false;
                }
            } else if (costType == 'limitmat') {
                var limitmat = this.user.bag.limitmat;
                var curNum = 0;
                for (var mid in limitmat) {
                    if (limitmat[mid].id == costId && limitmat[mid].expire > now) {
                        curNum += limitmat[mid].num;
                        if (curNum > costNum) {
                            return true;
                        }
                    }
                }
                return false;
            } else {
                if (isNaN(costNum) || isNaN(costId)) {
                    return false;
                }

                costId = +costId;
                costNum = Math.floor(costNum);
                if (costNum < 0) {
                    if (!user.bag[costType]) {
                        return false;
                    }

                    var curNum = user.bag[costType][costId];
                    if (!curNum) {
                        return false;
                    }

                    if (curNum + costNum < 0) {
                        return false;
                    }
                }
            }
        }

        return true;
    },

    getMatrialCount: function (matrialID) {
        if (isNaN(matrialID)) {
            return 0;
        }

        var costType = 'material';
        var user = this.user;
        if (!user.bag[costType]) {
            return 0;
        }

        var curNum = user.bag[costType][matrialID] || 0;

        return curNum;
    },

    // 获取宝石数量
    getGemNumByTypeAndLevel: function (gemType, gemLevel) {
        var user = this.user;
        if (!user.bag['gem']) {
            return 0;
        }

        for (gemid in user.bag['gem']) {
            var type = parseInt(gemid / 100);
            var level = gemid % 100;

            if (gemType == type && gemLevel == level) {
                return user.bag['gem'][gemid];
            }
        }

        return 0;
    },

    // 添加一个奖励
    addAward: function (addedAwards, awardType, awardId, awardNum, award, mod, act, notShow) {
        var user = this.user;
        if (awardType == 'user') {
            var status = user.status;
            if (awardId == 'xp') {
                var levelUpAward = this.addXp(awardNum, mod, act);
                addedAwards.push(award);

                if (levelUpAward.length > 0) {
                    this.addAward(addedAwards, levelUpAward[0][0], levelUpAward[0][1], levelUpAward[0][2], levelUpAward[0], mod, act, true);
                }
            } else if (awardId == 'arena_xp') {
                // 已废弃该奖励
                // this.addArenaXp(awardNum, mod, act);
                // addedAwards.push(award);
            } else if (awardId == 'vip_xp') {
                user.status.vip_xp = ((user.status.vip_xp - 0) || 0) + awardNum;
                this.markDirty('status.vip_xp');
                this.updateVip();
                addedAwards.push(award);
            } else if (awardId == 'mixcash') {
                // 先消耗绑定元宝，再消耗非绑定元宝
                var consumeBindCash = Math.abs(awardNum);
                var consumeCash = 0;
                var hasBindCash = user.status.bindcash;
                if (hasBindCash < Math.abs(awardNum)) {
                    consumeBindCash = hasBindCash;

                    var hasCash = user.status.cash;
                    if (hasCash >= Math.abs(awardNum) - hasBindCash) {
                        consumeCash = Math.abs(awardNum) - hasBindCash;
                    }
                }

                if (consumeBindCash > 0) {
                    var cost = ['user', 'bindcash', -consumeBindCash];
                    if (this.addResource('bindcash', -consumeBindCash, mod, act)) {
                        addedAwards.push(cost);
                    }
                }
                if (consumeCash > 0) {
                    var cost = ['user', 'cash', -consumeCash];
                    if (this.addResource('cash', -consumeCash, mod, act)) {
                        addedAwards.push(cost);
                    }
                }

                logic_event_mgr.emit(logic_event_mgr.EVENT.COST_MIX_CASH, this, Math.abs(awardNum));
            } else if (this.addResource(awardId, awardNum, mod, act)) {
                if (notShow && notShow == true) {
                    award[3] = 1;// 不显示在奖励列表
                }
                addedAwards.push(award);

                if (awardNum < 0 && ('bindcash' == awardId || 'cash' == awardId)) {
                    logic_event_mgr.emit(logic_event_mgr.EVENT.COST_MIX_CASH, this, Math.abs(awardNum));
                }
            }
        } else if (awardType == 'equip') {
            if (awardNum < 0) {
                var equipObj = this.user.bag.equip[awardId];
                if (equipObj) {
                    var args = {
                        uid: this.uid,
                        eid: awardId,
                        id: equipObj.id,
                        grade: equipObj.grade,
                        intensify: equipObj.intensify,
                        refine_exp: equipObj.refine_exp,
                        mod: mod,
                        act: act,
                    }

                    addGameLog(LogType.LOG_EQUIP_CONSUME, args, null);
                }

                delete this.user.bag.equip[awardId];
                this.markDelete("bag.equip." + awardId);
                award[1] = +award[1];
                addedAwards.push(award);
            } else {
                if (!gConfEquip[awardId])
                    return;

                var grade = +award[2];
                for (var j = 0; j < awardNum; j++) {
                    var eid = this.addEquip(awardId, grade, 0, 0, mod, act);
                    var equip = this.user.bag.equip[eid];
                    addedAwards.push(['equip', eid, equip]);
                }

                this.onEquipGetCallback(awardId, awardNum);
            }
            this.memData.equip_num += awardNum;
        } else if (awardType == 'dragon') {
            if (awardNum < 0) {
                var dragonObj = this.user.bag.dragon[awardId];
                if (dragonObj) {
                    var args = {
                        uid: this.uid,
                        gid: this.user.bag.dragon[awardId],
                        id: dragonObj.id,
                        attr: dragonObj.attr,
                        mod: mod,
                        act: act,
                    };
                    addGameLog(LogType.LOG_DRAGON_PRODUCE, args, null);
                }

                delete this.user.bag.dragon[awardId];
                this.markDelete("bag.dragon." + awardId);
                award[1] = +award[1];
                addedAwards.push(award);
            } else {
                if (!gConfDragonGem[awardId])
                    return;
                for (var j = 0; j < awardNum; j++) {
                    var gid = this.addDragonGem(awardId, mod, act);
                    addedAwards.push(['dragon', gid, this.user.bag.dragon[gid]]);
                }
                this.memData.dragongem_num += awardNum;
            }
        } else if (awardType == 'headframe') {
            this.updateHeadFrameStatus(awardId, awardNum > 0);
            addedAwards.push(award);
        } else if (awardType == 'limitmat') {
            if (awardNum < 0) {
                addedAwards.combine(this.costLimitMat(awardId, awardNum, mod, act));
            } else if (this.memData.limitmat.length < 50) {
                var mid = this.addLimitMat(awardId, award[2], award[3], award[4], mod, act);
                addedAwards.push(['limitmat', mid, this.user.bag.limitmat[mid]]);
                this.memData.limitmat.push([mid, this.user.bag.limitmat[mid].expire]);
                this.memData.limitmat.sort(function (item1, item2) {
                    return item1[1] - item2[1];
                });
            }
        } else if (awardType == 'skyweapon') {
            this.addWeaponEquip(award[1], award[2], award[3], mod, act);
            addedAwards.push(award);
        } else if (awardType == 'skywing') {
            this.addWingEquip(award[1], award[2], award[3], mod, act);
            addedAwards.push(award);
        } else if (awardType == 'skymount') {
            this.addSkyMount(award[1], award[2], award[3], mod, act);
            addedAwards.push(award);
        } else if (awardType == 'rune') {
            if (awardNum < 0) {
                var runeObj = this.user.bag.rune[awardId];
                if (runeObj) {
                    var args = {
                        uid: this.uid,
                        rid: awardId,
                        id: runeObj.id,
                        level: runeObj.level,
                        mod: mod,
                        act: act,
                    }

                    addGameLog(LogType.LOG_RUNE_CONSUME, args, null);
                }

                delete this.user.bag.rune[awardId];
                this.markDelete("bag.rune." + awardId);
                award[1] = +award[1];
                addedAwards.push(award);
            } else {
                if (!gConfRuneConf[awardId])
                    return;

                for (var j = 0; j < awardNum; j++) {
                    var rid = this.addRune(award[1], mod, act);
                    if (rid > 0) {
                        var rune = this.user.bag.rune[rid];
                        addedAwards.push(['rune', rid, rune]);
                    }
                }

                this.onRuneGetCallback(awardId, awardNum);
            }
        } else if (awardType == 'weekcard') {
            // 小月卡
            user.payment.week_card += 30;
            this.markDirty('payment.week_card');
            addedAwards.push(award);

            this.doDailyTask('weekCard', 1);
            this.doDailyTask('doubleCard', 1);
        } else if (awardType == 'monthcard') {
            // 月卡
            user.payment.month_card += 30;
            this.markDirty('payment.month_card');
            addedAwards.push(award);

            this.doDailyTask('monthCard', 1);
            this.doDailyTask('doubleCard', 1);
        } else if (awardType == 'wake_dragon') {
            // 激活巨龙
            if (gConfCustomDragon[awardId]) {
                this.wake_dragon(awardId);
                addedAwards.push(award);
            }
        } else if (awardType == 'card' && awardNum > 0) {
            // 获得英雄
            award[1] = +award[1];
            addedAwards.push(award);
            // 估计得上报英雄结构-fish
        } else {
            if (this.addBag(awardType, awardId, awardNum, mod, act)) {
                award[1] = +award[1];
                addedAwards.push(award);
            }
        }
    },

    randomAward: function (itemGroupConf, totalOdds) {
        // 随机出一个奖励
        var awardIndex = 1;
        var rangeOdd = 0;
        var randOdd = common.randRange(0, totalOdds);
        var groupLength = Object.keys(itemGroupConf).length;
        for (var j = 1; j <= groupLength; j++) {
            rangeOdd += itemGroupConf[j].weight;
            if (randOdd < rangeOdd) {
                awardIndex = j;
                break;
            }
        }

        var award = clone(itemGroupConf[awardIndex].award[0]);
        var awardType = award[0];
        var awardId = award[1];
        var awardNum = 0;

        // 再算一遍数量
        if (awardType == 'equip') {
            awardNum = Math.floor(+award[award.length - 1]);
        } else if (awardType == 'user' && awardId == 'staying_power') {
            // 耐力上限为100，不能超过
            awardNum = Math.floor(+award[2]);
            var curNum = this.user.status.staying_power;
            if (curNum + awardNum > parseInt(gConfTerritoryWarBase.enduranceLimit.value)) {
                awardNum = parseInt(gConfTerritoryWarBase.enduranceLimit.value) - curNum;
            }
        } else {
            awardNum = Math.floor(+award[2]);
        }

        var retAward = {};
        retAward.award = award;
        retAward.awardType = awardType;
        retAward.awardId = awardId;
        retAward.awardNum = awardNum;

        return retAward;
    },

    // @param mod,哪个模块调用的，用于日志记录
    // @param act,哪个接口调用的，用于日志记录
    addAwards: function (awards, mod, act) {
        // awards 格式[[user,gold,100], [material,10,10]], [gem,10,1], [limitmat,1,1,2010010101,1]
        //  [equip, weapon, '1',1], [card,1,1], [user, cash, 100]
        var addedAwards = [];
        if (!awards) return false;
        for (var i = 0, max = awards.length; i < max; i++) {
            var award = awards[i];
            if (!award) continue;
            var awardType = award[0];
            var awardId = award[1];
            if (awardId == 'food') {
                continue;
            }

            var awardNum = 0;
            if (awardType == 'equip') {
                awardNum = Math.floor(+award[award.length - 1]);
            } else if (awardType == 'user' && awardId == 'staying_power') {
                // 耐力上限为100，不能超过
                awardNum = Math.floor(+award[2]);
                var curNum = this.user.status.staying_power;
                if (curNum + awardNum > parseInt(gConfTerritoryWarBase.enduranceLimit.value)) {
                    awardNum = parseInt(gConfTerritoryWarBase.enduranceLimit.value) - curNum;
                }
            } else if (awardType == 'group') {
                awardNum = Math.floor(+award[3]);
            } else {
                awardNum = Math.floor(+award[2]);
            }
            if (isNaN(awardNum) || !awardNum) continue;

            var suss = true;
            if (awardType == 'user' && awardId == 'country_score') {
                var countryWarReq = {};
                countryWarReq.mod = 'countrywar';
                countryWarReq.act = 'add_score';
                countryWarReq.uid = this.uid;
                countryWarReq.args = {
                    score: awardNum,
                };

                var countryWarResp = {};
                countryWarResp.code = 0;
                countryWarResp.desc = '';
                countryWarResp.data = {};

                requestCountryWar(countryWarReq, countryWarResp, function () {
                    if (countryWarResp.code != 0) {
                        suss = false;
                    }
                });
            }

            if (!suss) {
                continue;
            }

            // 道具组
            if (awardType == 'group') {
                var groupAwardMod = award[2];   // 奖励模式
                var groupAwardNum = Math.floor(+award[3]);
                var groupId = parseInt(awardId);

                var tGroupItemWeightInfo = getGroupItemWeightInfo(gConfItemGroupConfig[groupId], this);
                var itemGroupConf = tGroupItemWeightInfo.itemGroupConf;
                var totalOdds = tGroupItemWeightInfo.totalOdds;

                // var itemGroupConf = gConfItemGroupConfig[groupId];
                if (!itemGroupConf || itemGroupConf.length == 0)
                    continue;

                // var totalOdds = 0;
                // var groupLength = Object.keys(itemGroupConf).length;
                // for (var j = 1; j <= groupLength; j++) {
                //     totalOdds += itemGroupConf[j].weight;
                // }

                if (groupAwardMod == 0) {
                    // 随机多次
                    for (var j = 0; j < groupAwardNum; j++) {
                        var retAward = this.randomAward(itemGroupConf, totalOdds);
                        award = retAward.award;
                        awardType = retAward.awardType;
                        awardId = retAward.awardId;
                        awardNum = retAward.awardNum;

                        if (isNaN(awardNum) || !awardNum) continue;

                        this.addAward(addedAwards, awardType, awardId, awardNum, award, mod, act);
                    }
                } else if (groupAwardMod == 1) {
                    // 随机1次
                    var retAward = this.randomAward(itemGroupConf, totalOdds);
                    award = retAward.award;
                    awardType = retAward.awardType;
                    awardId = retAward.awardId;
                    awardNum = retAward.awardNum * groupAwardNum;

                    if (awardType == 'equip') {
                        award[3] = awardNum;
                    } else {
                        award[2] = awardNum;
                    }

                    if (isNaN(awardNum) || !awardNum)
                        continue;

                    this.addAward(addedAwards, awardType, awardId, awardNum, award, mod, act);
                }
            } else {
                this.addAward(addedAwards, awardType, awardId, awardNum, award, mod, act);
            }
        }

        var retAwards = {};
        retAwards.awards = addedAwards;
        retAwards.heros = this.selectHeroAwards(addedAwards);
        return retAwards;
    },

    // selecte heros in awards
    selectHeroAwards: function (addedAwards) {
        var heroIndexs = [];
        var heros = {};
        for (var i = addedAwards.length - 1; i >= 0; i--) {
            if (addedAwards[i][0] == 'card') {
                var heroArr = this.addHero(+addedAwards[i][1], Math.floor(+addedAwards[i][2]))
                if (heroArr.length > 0) {
                    heroIndexs = heroIndexs.concat(heroArr);
                }
            }
        }

        for (var k = heroIndexs.length - 1; k >= 0; k--) {
            var index = heroIndexs[k];
            heros[index] = this.user.hero_bag.heros[index];
        }

        return heros;
    },

    getPrivilegeVal: function (typeStr) {
        var user = this.user;
        var vipPrivilegeId = gConfNobiltyTitleKeyAndId[typeStr];

        var nobility = user.task.nobility;
        var nobilityId = nobility[0];
        var nobilityStars = nobility[1];
        var val = 0;
        for (var num = 1; num <= nobilityId; num++) {
            var maxNum = 3;
            if (num == nobilityId) {
                maxNum = nobilityStars;
            }
            for (var star = 1; star <= maxNum; star++) {
                var type = gConfNobiltyBase[num]['pg' + star];
                if (vipPrivilegeId[type] && vipPrivilegeId[type].lock == 2) {
                    val += gConfNobiltyBase[num]['pgnum' + star];
                }
            }
        }

        return val;
    }
    ,
    addResource: function (name, num, mod, act) {
        var status = this.user.status;

        if (!status.hasOwnProperty(name)) {
            return false;
        }

        if (isNaN(num)) return false;

        num = Math.floor(num);

        if (status[name] + num < 0) {
            LOG(util.format("Error: 材料扣除不足 %s %d", name, num))
            return false;
        }
        var update_before = status[name];
        status[name] += num;
        if (name == 'food') {
            // 粮草上限特权
            var privilege = this.user.task.privilege;
            var extraFoodLimit = 0;
            if (gConfNobiltyTitleKey['maxFood']) {
                var topFoodPrivilegeId = gConfNobiltyTitleKey['maxFood'].id;
                if (privilege[topFoodPrivilegeId]) {
                    // extraFoodLimit = privilege[topFoodPrivilegeId];
                    extraFoodLimit = this.getPrivilegeVal('maxFood');
                }
            }

            if (status[name] > gConfGlobal.foodLimit) {
                status[name] = gConfGlobal.foodLimit;
            }
            var now = common.getTime();
            if (num < 0 && status[name] < gConfGlobalNew.foodMax + extraFoodLimit &&
                status[name] - num >= gConfGlobalNew.foodMax + extraFoodLimit &&
                now - this.user.mark.food_time > gConfGlobalNew.foodInterval * 60) {
                this.user.mark.food_time = now - gConfGlobalNew.foodInterval * 60;
                this.markDirty('mark.food_time');
            }
        } else if (name == 'cash') {
            if (num < 0) {
                this.onCashCost(-num);
            } else {
                this.checkLuckyDragon();
            }
        } else if (name == 'bindcash') {
            if (num < 0) {
                this.onBindCashCost(-num);
            }
        }
        var update_later = status[name];
        if (gConfUser[name].record) {
            CostLog(this, this.action.mod, this.action.act, this.action.args, name, num, update_before, update_later);
        }

        // 日志记录
        if (num < 0) {
            // 消耗
            var args = {
                uid: this.uid,
                type: name,
                num: num,
                mod: mod,
                act: act,
            };
            addGameLog(LogType.LOG_CURRENCY_CONSUME, args, function () {

            });
        } else if (num > 0) {
            // 获得
            var args = {
                uid: this.uid,
                type: name,
                num: num,
                mod: mod,
                act: act,
            };
            addGameLog(LogType.LOG_CURRENCY_PRODUCE, args, function () {

            });
        }

        this.markDirty('status.' + name);
        return true;
    },

    addBag: function (type, id, num, mod, act) {
        if (isNaN(num) || isNaN(id)) return false;
        id = +id;
        num = Math.floor(num);
        if (type == 'equip') {
            return false;
        }

        if (!(type in this.user.bag)) {
            return false;
        }

        if (!(id in this.user.bag[type])) {
            this.user.bag[type][id] = 0;
        }

        if ((this.user.bag[type][id] + num) < 0) {
            return false;
        }

        var oldNum = this.user.bag[type][id];
        this.user.bag[type][id] += num;
        var newNum = this.user.bag[type][id];
        if (this.user.bag[type][id] == 0 && type != 'card') {
            delete this.user.bag[type][id];
            this.markDelete(['bag', type, id].join('.'));
        } else {
            this.markDirty(['bag', type, id].join('.'));
        }

        // 记录日志
        var args = {
            uid: this.uid,
            id: id,
            num: num,
            old_num: oldNum,
            mod: mod,
            act: act,

        }


        var bag_args = {
            sid: config.DistId,
            openid: this.user.info.account,
            level: this.user.status.level,
            type: type,
            material_id: id,
            costName: mod + '_' + act,
            costValue: num,
            update_before: oldNum,
            update_later: newNum,
        };

        if (type == 'material') {
            if (num > 0) {
                addGameLog(LogType.LOG_MATERIAL_PRODUCE, args, null);
            } else {
                addGameLog(LogType.LOG_MATERIAL_CONSUME, args, null);
            }
            LogCollect(this.uid, 'add_bag', bag_args);
        } else if (type == 'fragment') {
            if (num > 0) {
                addGameLog(LogType.LOG_CARD_FRAGMENT_PRODUCE, args, null);
            } else {
                addGameLog(LogType.LOG_CARD_FRAGMENT_CONSUME, args, null);
            }
            LogCollect(this.uid, 'add_bag', bag_args);
        } else if (type == 'dress') {
            if (num > 0) {
                addGameLog(LogType.LOG_SOLDIER_EQUIP_PRODUCE, args, null);
            } else {
                addGameLog(LogType.LOG_SOLDIER_EQUIP_CONSUME, args, null);
            }
            LogCollect(this.uid, 'add_bag', bag_args);
        } else if (type == 'gem') {
            if (num > 0) {
                addGameLog(LogType.LOG_GEM_PRODUCE, args, null);
            } else {
                addGameLog(LogType.LOG_GEM_CONSUME, args, null);
            }
            LogCollect(this.uid, 'add_bag', bag_args);
        }

        return true;
    },

    getEquipsByQuality: function (quality) {
        var equips = [];
        var level = this.user.status.level;
        for (var id in gConfEquip) {
            if (gConfEquip[id].quality == quality
                && gConfEquip[id].level <= (Math.floor(level / 10) + 1) * 10
                && gConfEquip[id].level >= Math.floor(level / 10) * 10) {
                equips.push(id);
            }
        }
        return equips;
    },

    getUpgradeEquipId: function (id) {
        if (gConfEquip[id].quality >= Quality.ORANGE) {
            return 'god';
        }

        var equipConf = gConfEquip[id];
        for (var i in gConfEquip) {
            var upgradeConf = gConfEquip[i];
            if (upgradeConf.isAncient) {
                continue;
            }

            if (equipConf.name == upgradeConf.name
                && equipConf.quality + 1 == upgradeConf.quality
                && equipConf.level == upgradeConf.level) {
                return i;
            }
        }
        return 0;
    },

    updateRoleEquipTalent: function (hid) {
        var roleObj = this.user.hero_bag.heros[hid];
        if (!roleObj) {
            return;
        }
        var wearEquip = this.user.hero_bag.heros[hid].equip;
        var equipBag = this.user.bag.equip;
        var talent = roleObj.talent;
        var points = 0;
        for (var pos in wearEquip) {
            var eid = wearEquip[pos];
            if (!eid) {
                //ERROR('===========EQUIP WEAR ERROR!')
                continue;
            }

            var oneObj = equipBag[eid];
            if (!oneObj) {
                //ERROR('===========EQUIP BAG ERROR!')
                continue;
            }

            var grade = oneObj.grade;
            var equipConf = gConfEquip[oneObj.id];
            if (!equipConf) {
                //ERROR('===========EQUIP CONF ERROR!')
                continue;
            }

            var quality = equipConf.quality;
            var talentConf = gConfEquipBase[pos][quality];
            if (!talentConf) {
                //ERROR('===========EQUIP talentConf ERROR!')
                continue;
            }

            var talentPoints = talentConf.talentPoints;

            points += talentPoints[grade] || 0;

        }

        talent.point = points;
        this.markDirty('hero_bag.heros.' + hid + '.talent');
        this.getFightForce(true);
        return points;
    },

    getEquipMinTalent: function () {
        return 0;
        /*
        var talent = [];
        var minTalent = 0;
        for (var id in this.user.pos) {
            talent.push(this.user.pos[id].talent);
            minTalent = Math.min.apply(null, talent);
        }
        return minTalent;
        */
    },

    refreshShop: function (type, count) {
        var selectedGroups = gShopGroupWeight[type].must.slice();
        var userLevel = this.user.status.level;
        for (var i = 0, len = selectedGroups.length; i < len; i++) {
            var groupId = selectedGroups[i];
            if (gShopGroupLimit[groupId][0] > userLevel || gShopGroupLimit[groupId][1] < userLevel) {
                selectedGroups.splice(i, 1);
                i--;
                len--;
            }
        }

        var leftCount = count - selectedGroups.length;
        if (leftCount > 0) {
            var otherGroups = clone(gShopGroupWeight[type].others);
            for (var groupId in otherGroups) {
                if (gShopGroupLimit[groupId][0] > userLevel || gShopGroupLimit[groupId][1] < userLevel) {
                    delete otherGroups[groupId];
                }
            }

            for (var i = 0, len = Object.keys(otherGroups).length; i < len; i++) {
                var sgId = common.wRand(otherGroups);
                selectedGroups.push(sgId);
                delete otherGroups[sgId];
            }
        }

        var goods = {};
        for (var i = 0, cnt = 0, len = selectedGroups.length; i < len && cnt < count; i++) {
            var groupId = selectedGroups[i];
            var weights = clone(gShopItemWeight[type][groupId]);
            for (var id in weights) {
                if (userLevel < gConfShop[id].minLevel || userLevel > gConfShop[id].maxLevel) {
                    delete weights[id];
                }

                if (type == ShopType.MYSTERY && !this.user.shop[type].refresh) {
                    // 神秘商店第一次一定只能刷新出橙色装备
                    if (gConfShop[id].get[0][1] < Quality.ORANGE) {
                        delete weights[id];
                    }
                }
            }

            var rid = common.wRand(weights);
            if (!rid) {
                continue;
            }
            var lid = 3;
            if (type != ShopType.MYSTERY || this.user.shop[type].refresh) {
                lid = common.wRand(gShopGoodWeight[rid]);
            }
            goods[rid] = [lid, 0];
            var good = gConfShop[rid].get[0];
            // 随机装备
            if (good[0] == 'equip' && good.length > 4) {
                goods[rid][2] = generateEquip(good, userLevel);
                goods[rid][3] = good[3];
            }
            cnt++;
        }
        if (type == ShopType.COUNTRYPOSITION) {
            this.user.shop[type] = {};
            this.user.shop[type].goods = {};
            this.user.shop[type].refresh = common.getDate();
            this.markDirty(util.format('shop.%d', type));
        }
        this.user.shop[type].goods = goods;
        this.markDirty(util.format('shop.%d.goods', type));
    },

    // 刷新商店物品
    refreshShopGoods: function (id, tab) {
        var shopConf = gConfShopNew[id];
        if (!shopConf) {
            return;
        }

        var tabConf = gConfShopTab[tab];
        if (!tabConf) {
            return;
        }

        var user = this.user;
        user.shop_new[id][tab].goods = [];
        user.shop_new[id][tab].refresh_time = 0;

        var userLevel = user.status.level;

        //获取开服天数
        var curTime = common.getTime();
        var serverOpenTime = gConfGlobalServer.serverStartTime;
        var serverOpenDay = Math.floor((curTime - serverOpenTime) / OneDayTime) + 1;

        var groups = tabConf.groups;
        for (var i = 0; i < groups.length; i++) {
            var groupId = groups[i];
            var groupConf = gConfShopGoods[groupId];
            var goodsCount = Object.keys(groupConf).length;

            // 帅选符合条件的商品
            var weightArr = {};
            for (var j = 1; j <= goodsCount; j++) {
                if (userLevel >= groupConf[j].minLevel && userLevel <= groupConf[j].maxLevel
                    && serverOpenDay >= groupConf[j].minDay && serverOpenDay <= groupConf[j].maxDay
                    && groupConf[j].groupWeight != -1) {
                    weightArr[j] = groupConf[j].groupWeight;
                }
            }

            if (Object.keys(weightArr).length > 0) {
                var goodsId = common.wRand(weightArr);
                //var goodsId = weightArr[randIndex];
                var goodsObj = {};
                goodsObj.groupId = groupId;
                goodsObj.goodsId = parseInt(goodsId);
                goodsObj.buy = 0;
                user.shop_new[id][tab].goods.push(goodsObj);
            }
        }

        if (tabConf.resetAlgorithm == 'disorderGroup') {
            // 随机打乱顺序
            user.shop_new[id][tab].goods.sort(function (a, b) { return (Math.random() > 0.5) ? 1 : -1; });
        }

        user.shop_new[id][tab].refresh_time = common.getTime();
        this.markDirty(util.format('shop_new.%d.%d.goods', id, tab));
        this.markDirty(util.format('shop_new.%d.%d.refresh_time', id, tab));
    },

    getShopRefreshTime: function (type) {
        var interval = gConfGlobal[type + 'ShopRefreshInterval'];
        if (interval == 0) {
            return 9999999999;
        }
        var hour = (new Date()).getHours();
        hour = Math.floor(hour / interval) * interval;
        var timeString = common.getDateString() + ' ' + hour + ':00:00';
        return Date.parse(timeString) / 1000;
    },

    //积分兑换进度获取
    getExchangePointsProgress: function (key, count) {
        if (!isActivityStart(this, 'exchange_points')) {
            return;
        }

        var conf = gConfAvExchangePointsKey[key];
        if (!conf) {
            return;
        }

        for (var id in gConfAvExchangePointsKey[key]) {
            var round = gConfAvExchangePointsId[id].round;
            var startTime = gConfAvExchangePointsTime[round].startTime;
            var endTime = gConfAvExchangePointsTime[round].endTime;
            var nowTime = common.getTime();
            if (nowTime >= startTime && nowTime <= endTime) {
                var exchangePoints = this.user.activity.exchange_points;
                if (exchangePoints.time != gConfAvExchangePointsTime[round].startTime) {
                    exchangePoints.time = gConfAvExchangePointsTime[round].startTime;
                    exchangePoints.progress = {};
                    exchangePoints.rewards = {};
                    if (round == 1) {
                        exchangePoints.integral = 0;
                    }
                    this.markDirty('activity.exchange_points');
                }

                if (!exchangePoints.progress[key]) {
                    exchangePoints.progress[key] = count;
                } else {
                    exchangePoints.progress[key] += count;
                }

                var rewards = exchangePoints.rewards;
                for (var id in conf) {
                    if (exchangePoints.progress[key] >= conf[id].target && !rewards[id]) {
                        this.addTip('exchange_points');
                    }
                }

                this.markDirty('activity.exchange_points.progress.' + key);
                break;
            }
        }
    },

    doDailyTask: function (type, count) {
        if (!isModuleOpen_new(this, 'task')) {
            return;
        }

        var user = this.user;
        var dailyTask = user.task.daily;
        var id = gConfDailyTask[type];
        if (!id) return;

        var oldTarget = 0;
        count = count ? count : 1;
        if (!dailyTask[id]) {
            dailyTask[id] = +count;
        } else {
            oldTarget = dailyTask[id];
            dailyTask[id] += +count;
        }

        this.markDirty('task.daily.' + id);

        var target = gConfDailyTask[id].target;
        if (dailyTask[id] >= target && oldTarget < target) {
            this.addTip('daily_task');
        }
    },

    doTask: function (type, count, condition, oldCondition) {
        var user = this.user;
        var task = user.task;
        var reward = task.main_reward;
        var id = gConfTask[type];
        if (!id) {
            return;
        }

        if (!task.main[id]) {
            task.main[id] = 0;
            this.markDirty('task.main.' + id);
        }

        //ERROR('dotask===add ========='+type+' id:'+id);
        count = count ? count : 1;
        var curProgress = reward[id] ? reward[id] : 0;
        var curConf = gConfTask[id][curProgress + 1];
        if (!curConf) return;

        if (type == 'level') {
            task.main[id] = user.status.level;
        } else if (type == 'arenaRank') {
            if (condition > gConfTask[id][1].condition) return;
            task.main[id] = 1;
        } else if (type == 'battle') {
            task.main[id] = count;
            //ERROR('dotask===add battle========='+task.main[id]);     
        } else if (type == 'elite') {
            task.main[id] = count;
        } else if (type == 'hard') {
            task.main[id] = count;
        } else if (type == 'nightmare') {
            task.main[id] = count;
        } else if (type == 'hell') {
            if (count > 5150) {
                count = 5150;
            }
            task.main[id] = count;

            // var battleType = user.battle.type;
            // if (battleType == 5) {
            //     task.main[id] = user.battle.progress - 1;
            // } else {
            //     task.main[id] = 150;
            // }
        } else if (type == 'roleQuality') {
            // 集齐指定品质武将（这个需要了解封将的是否计算在内）
            //var curCnt = this.calcRoleQuality(curConf.condition);
            //ERROR('dotask===roleQuality======id===='+id);
            // ERROR('dotask===add condition========='+condition+' conf:'+curConf.condition);

            if (+condition >= +curConf.condition) {
                if (!task.main[id]) {
                    task.main[id] = 0;
                }
                task.main[id] += count;
            }
            //ERROR('dotask===main count now========='+task.main[id]);
        } else if (type == 'roleReborn') {
            // 武将突破到指定等级打到指定数量
            var curCnt = this.calcRoleReborn(curConf.condition);
            if (task.main[id] >= curCnt) return;
            task.main[id] = curCnt;
        } else if (type == 'soldierLevel') {
            // 小兵升级到指定等级打到指定数量
            var curCnt = this.calcSoldierLevel(curConf.condition);
            if (task.main[id] >= curCnt) return;
            task.main[id] = curCnt;
        } else if (type == 'equipGod') {
            if (oldCondition && oldCondition >= curConf.condition) return;

            if (condition >= curConf.condition) {
                if (!task.main[id]) {
                    task.main[id] = +count;
                } else {
                    task.main[id] += count;
                }
            }
        } else if (type == 'legionLevel') {
            // 军团达到指定等级
            if (this.memData.legion_level > task.main[id]) {
                task.main[id] = this.memData.legion_level;
            }
        } else if (type == 'teamLevel') {
            // 战队达到指定等级
            if (this.memData.team_level > task.main[id]) {
                task.main[id] = this.memData.team_level;
            }
        } else if (type == 'fightPower') {
            // 战斗力达到X
            if (this.memData.fight_force > task.main[id]) {
                task.main[id] = this.memData.fight_force;
            }
        } else if (type == 'legionFire') {
            // 参与军团篝火达到指定次数
            task.main[id] += +count;
        } else if (!task.main[id]) {
            task.main[id] = +count;
        } else {
            task.main[id] += +count;
        }

        if (task.main[id]) {
            this.markDirty('task.main.' + id);

            if (type == 'fightPower') {
                if (task.main[id] >= curConf.target * 10000) {
                    this.addTip('main_task');
                }
            } else {
                if (task.main[id] >= curConf.target) {
                    this.addTip('main_task');
                }
            }
        }
    },

    // 统计强化到指定等级的装备件数
    getEquipCountWithIntensifyLevel: function (level) {
        var user = this.user;
        var bag = user.bag;
        var count = 0;
        for (var eid in bag.equip) {
            var equipObj = bag.equip[eid];
            if (equipObj.intensify >= level && equipObj.pos > 0) {
                count++;
            }
        }

        return count;
    },

    // 统计强化到指定等级的装备件数
    getEquipCountWithIntensifyLevel_SingleHero: function (pos, level) {
        //var posObj = this.user.pos[pos];

        var count = 0;
        /*
        for (var i = 1; i <= 6; i++) {
            var eid = posObj.equip[i];
            if (!eid) continue;

            var equipObj = this.user.bag.equip[eid];
            if (!equipObj) {
                continue;
            }

            if (equipObj.intensify >= level && equipObj.pos > 0) {
                count++;
            }
        }*/

        return count;
    },

    // 统计指定品级的装备件数
    getEquipCountWithQuality: function (quality) {
        var user = this.user;
        var bag = user.bag;
        var count = 0;
        for (var eid in bag.equip) {
            var equipObj = bag.equip[eid];
            var equipConf = gConfEquip[equipObj.id];

            if (equipConf.quality >= quality && equipObj.hid > 0) {
                count++;
            }
        }
        return count;
    },

    // 统计精炼到指定等级的装备件数
    getEquipCountWithRefineLevel: function (level) {
        var user = this.user;
        var bag = user.bag;
        var count = 0;
        for (var eid in bag.equip) {
            var equipObj = bag.equip[eid];
            var equipConf = gConfEquip[equipObj.id];
            if (equipConf) {
                var refineExp = equipObj.refine_exp;
                var refineLevel = getRefineLevelByExp(equipConf.quality, refineExp)[0];
                if (refineLevel >= level && equipObj.pos > 0) {
                    count++;
                }
            }
        }

        return count;
    },

    // 统计精炼到指定等级的装备件数  // !!! 单个英雄
    getEquipCountWithRefineLevel_SingleHero: function (pos, level) {
        return 0;

        var posObj = this.user.pos[pos];

        var count = 0;
        for (var i = 1; i <= 6; i++) {
            var eid = posObj.equip[i];
            if (!eid) continue;

            var equipObj = this.user.bag.equip[eid];
            if (!equipObj) {
                continue;
            }

            var equipConf = gConfEquip[equipObj.id];
            if (!equipConf) {
                continue;
            }

            var refineExp = equipObj.refine_exp;
            var refineLevel = getRefineLevelByExp(equipConf.quality, refineExp)[0];
            if (refineLevel >= level && equipObj.pos > 0) {
                count++;
            }
        }

        return count;
    },

    // 统计等级达到指定等级的英雄数，除去主公
    getHeroCountWithLevel: function (level) {
        var user = this.user;
        var count = 0;
        var team1 = user.team[1];
        for (var hid in team1) {
            var theHero = user.hero_bag.heros[hid];
            if (theHero && theHero.level >= level) {
                count++;
            }
        }

        return count;
    },

    // 统计突破到指定等级的英雄数
    getHeroCountWithTalentLevel: function (talent) {
        var user = this.user;
        var count = 0;
        var team1 = user.team[1];
        for (var hid in team1) {
            var theHero = user.hero_bag.heros[hid];
            if (theHero && theHero.tier >= talent) {
                count++;
            }
        }

        return count;
    },

    // 统计升到指定等级的龙数量
    getDragonCountWithLevel: function (level) {
        var user = this.user;
        var count = 0;
        for (var id in user.dragon) {
            var dragonObj = user.dragon[id];
            if (dragonObj) {
                if (dragonObj.level >= level) {
                    count++;
                }
            }
        }

        return count;
    },

    getArenaRankConditionDetail: function (condition) {
        var baseRank = 100000;
        var detail = {
            type: Math.floor(condition / baseRank),
            rank: condition % baseRank
        };
        return detail;
    },

    // 统计觉醒到指定星级的部位数量
    getPartCountWithStar: function (star) {
        var user = this.user;
        var count = 0;

        for (var i in user.pos) {
            if (user.pos[i].rid > 0) {
                for (var j = 1; j <= HeroPartCount; j++) {
                    if (user.pos[i].part[j] && user.pos[i].part[j].awake_level >= star) {
                        count++;
                    }
                }
            }
        }

        return count;
    },

    // 统计所有部位总的觉醒星级
    getAllPartStarCount: function () {
        var user = this.user;
        var team1 = user.team[1];
        var count = 0;
        for (var hid in team1) {
            var heroObj = user.hero_bag.heros[hid];
            if (heroObj) {
                for (var j = 1; j <= HeroPartCount; j++) {
                    if (heroObj.part[j]) {
                        count += heroObj.part[j].awake_level;
                    }
                }
            }
        }
        return count;
    },

    // 统计镶嵌指定等级及以上宝石数量
    getEmbedGemCountWithLevel: function (level) {
        var user = this.user;
        var count = 0;

        for (var i in user.pos) {
            if (user.pos[i].rid > 0) {
                for (var j = 1; j <= HeroPartCount; j++) {
                    for (var k = 1; k <= 4; k++) {
                        var gemId = user.pos[i].part[j].gems[k];
                        if (gemId > 0) {
                            var gemConf = gConfGem[gemId];
                            if (gemConf && gemConf.level >= level) {
                                count++;
                            }
                        }
                    }
                }
            }
        }

        return count;
    },

    // 获取哥布林击杀数
    getExploreBossKillCount: function (type) {
        var user = this.user;
        var count = 0;
        if (type) {
            return user.auto_fight.boss.boss_kill_count[type] || 0;
        } else {
            for (var i = 1; i <= 3; i++) {
                if (user.auto_fight.boss.boss_kill_count[i]) {
                    count += parseInt(user.auto_fight.boss.boss_kill_count[i]);
                }
            }
        }

        return count;
    },

    // 执行引导任务
    doGuideTask: function (type, count) {
        var user = this.user;
        var taskGuide = user.guide_task;
        var ids = gGuideTaskMap[type];
        if (!ids) {
            return;
        }

        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];

            var curConf = gConfGuideTask[id];
            if (!curConf) {
                continue;
            }

            if (!taskGuide[id]) {
                taskGuide[id] = [0, 0];
                this.markDirty(util.format('guide_task.%d', id));
            }

            if (taskGuide[id][0] == null) {
                taskGuide[id][0] = 0;
                this.markDirty(util.format('guide_task.%d', id));
            }

            count = count ? count : 1;

            if (curConf.event == 'levelUp') {
                taskGuide[id][0] = user.status.level;
            } else if (curConf.event == 'villageOpen' || curConf.event == 'king_treasure') {
                if (count == curConf.condition[0]) {
                    taskGuide[id][0] = count;
                }
            } else if (curConf.event == 'equipUpgrade') {
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    // 统计强化到指定等级的装备件数
                    taskGuide[id][0] = this.getEquipCountWithIntensifyLevel(curConf.condition[1])
                }
            } else if (curConf.event == 'reborn') {
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = this.getHeroCountWithTalentLevel(curConf.condition[1])
                }
            } else if (curConf.event == 'heroLvUp') {
                taskGuide[id][0] = this.getHeroCountWithLevel(curConf.condition[1]);
            } else if (curConf.event == 'king_dragon') {
                taskGuide[id][0] = this.getDragonCountWithLevel(curConf.condition[1]);
            } else if (curConf.event == 'part') {
                // 部位觉醒
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = this.getPartCountWithStar(curConf.condition[1])
                }
            } else if (curConf.event == 'war_college') {
                // 战争学院
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = user.war_college.challenge;
                }
            } else if (curConf.event == 'territorywar') {
                // 村庄争夺
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = user.mark.occupy_land_count || 0;
                }
            } else if (curConf.event == 'equipRefine') {
                // 装备精炼
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = this.getEquipCountWithRefineLevel(curConf.condition[1]);
                }
            } else if (curConf.event == 'partgem') {
                // 镶嵌宝石
                taskGuide[id][0] = this.getEmbedGemCountWithLevel(curConf.condition[1]);
            } else if (curConf.event == 'exploreBoss') {
                // 哥布林
                if (curConf.groupid == 1) {
                    taskGuide[id][0] += count;
                } else {
                    taskGuide[id][0] = this.getExploreBossKillCount();
                }
            } else {
                taskGuide[id][0] += count;
            }

            this.markDirty(util.format('guide_task.%d', id));

            if (taskGuide[id][0] > 0 && taskGuide[id][0][1] == 0) {
                this.addTip('guide_task');
            }
        }
    },

    worldTask: function (id) {
        var user = this.user;
        var conf = gConfWorldSituation[id];
        if (!conf) return;

        if (user.battle.progress >= conf.target) {
            this.addTip('world_situation');
        }
    },

    openActivity: function (name) {
        switch (name) {
            case 'open_seven':
                this.openOpenSeven();
                break;
            case 'open_holiday':
                this.openOpenHoliday();
                break;
            case 'pray':
                this.openPray();
                break;
            case 'lucky_dragon':
                this.openLuckyDragon();
                break;
            case 'doappraise':
                this.openDoappraise();
                break;
            case 'doddqqgroup':
                this.openDoAddQQGroup();
                break;
            case 'facebook':
                this.openFacebook();
                break;
            case 'zero_gift':
                this.openZeroGift();
                break;
            case 'follow_rewards':
                this.openFollowRewards();
                break;
            case 'investment':
                this.openInvestment();
                break;
            default:
                break;
        }
    },

    openLuckyDragon: function () {
        var today = getGameDate();
        this.user.activity.lucky_dragon = {
            'open_day': today,
            'use': 0,
            'last': 0,
        };
        this.markDirty('activity.lucky_dragon');
        this.checkLuckyDragon();
    },

    openPray: function () {
        var today = getGameDate();
        this.user.activity.pray = {
            'open_day': today,
            'day': today,
            'point': 0,
            'time': 0,
            'recover': 0,
            'got': today,
            'reward': [],
            'options': [],
            'refresh_num': 0,
        };
        this.markDirty('activity.pray');
    },

    openOpenSeven: function () {
        var openSeven = this.user.activity.open_seven;
        openSeven.open_day = getGameDate();
        openSeven.progress = {};

        // 计算各成就型任务状态
        for (var day = 1; day <= 7; day++) {
            var dayConf = gConfOpenSeven[day];
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    var taskConf = gConfOpenSevenReward[taskId];
                    var taskType = taskConf.type;
                    if (taskType == 'login') {
                        if (day == 1) {
                            openSeven.progress[taskId] = [1, 0];
                        }
                    } else if (taskType == 'roleQuality') {
                        //openSeven.progress[taskId] = [this.calcRoleQuality(taskConf.condition), 0];
                        openSeven.progress[taskId] = [0, 0];
                    } else if (taskType == 'roleReborn') {
                        openSeven.progress[taskId] = [this.calcRoleReborn(taskConf.condition), 0]
                    } else if (taskType == 'soldierLevel') {
                        openSeven.progress[taskId] = [this.calcSoldierLevel(taskConf.condition), 0]
                    } else if (taskType == 'equipGod') {
                        openSeven.progress[taskId] = [this.calcEquipGod(taskConf.condition), 0]
                    } else if (taskType == 'level') {
                        openSeven.progress[taskId] = [this.user.status.level, 0]
                    } else if (taskType == 'gemLevel') {
                        openSeven.progress[taskId] = [this.calcGemLevel(), 0]
                    } else if (taskType == 'equipLevel') {
                        openSeven.progress[taskId] = [this.calcEquipLevel(), 0]
                        // } else if (taskType == 'equipStar') {
                        //     openSeven.progress[taskId] = [this.calcEquipStar(), 0]
                        // } else if (taskType == 'towerStar') {
                        //     openSeven.progress[taskId] = [this.user.tower.top_floor, 0]
                    } else if (taskType == 'fightForce') {
                        if (this.getFightForce() >= taskConf.confdition) {
                            openSeven.progress[taskId] = [1, 0]
                        }
                    } else if (taskType == 'position') {
                        var posConf = gConfPosition[this.user.info.position];
                        if (posConf && posConf.position <= taskConf.condition) {
                            openSeven.progress[taskId] = [1, 0]
                        }
                        // } else if (taskType == 'skillSlot') {
                        //     openSeven.progress[taskId] = [this.calcSkillSlot(taskConf.condition), 0]
                    } else if (taskType == 'pay') {
                        openSeven.progress[taskId] = [0, 0]
                    } else if (taskType == 'battle') {
                        openSeven.progress[taskId] = [this.user.battle.progress, 0]
                    } else if (taskType == 'elite') {
                        var curProgress = 0;/*
                        var cities = this.user.battle.city;
                        while (cities[++curProgress] && cities[curProgress][2].star);
                        openSeven.progress[taskId] = [curProgress - 1, 0]*/
                    } else if (taskType == 'arenaRank') {
                        var arena = this.user.arena;
                        var detail = this.getArenaRankConditionDetail(taskConf.condition);
                        if (arena.max_type >= detail.type &&
                            arena.max_rank > 0 && arena.max_rank < detail.rank) {
                            openSeven.progress[taskId] = [1, 0];
                        } else {
                            openSeven.progress[taskId] = [0, 0];
                        }
                    } else if (taskType == 'dragon') {
                        openSeven.progress[taskId] = [this.calcDragonLevel(taskConf.condition), 0]
                    } else if (taskType == 'destiny') {
                        openSeven.progress[taskId] = [this.calcRoleDestiny(taskConf.condition), 0];
                    } else if (taskType == 'wing') {
                        openSeven.progress[taskId] = [this.user.sky_suit.wing_level, 0];
                    } else if (taskType == 'weapon') {
                        openSeven.progress[taskId] = [this.user.sky_suit.weapon_level, 0];
                    } else if (taskType == 'equiprefine') {
                        openSeven.progress[taskId] = [this.calcEquipRefineLvAll(taskConf.condition), 0];
                        // } else if (taskType == 'fateadvanced') {
                        //     openSeven.progress[taskId] = [this.calcConspiracy(taskConf.condition), 0];
                    } else if (taskType == 'partAwake') {
                        // 部位觉醒总星级X星
                        openSeven.progress[taskId] = [this.getAllPartStarCount(), 0];
                    } else if (taskType == 'towerTier') {
                        // 勇者之塔达到第X层
                        openSeven.progress[taskId] = [this.user.tower.top_floor, 0];
                    } else if (taskType == 'equipNum') {
                        // 穿戴X件指定品质以上装备
                        openSeven.progress[taskId] = [this.getEquipCountWithQuality(taskConf.condition), 0];
                    } else if (taskType == 'equipUpgrade') {
                        // X件装备强化至X级
                        openSeven.progress[taskId] = [this.getEquipCountWithIntensifyLevel(taskConf.condition), 0];
                    } else {
                        openSeven.progress[taskId] = [0, 0];
                    }
                }
            }
        }

        this.markDirty('activity.open_seven');
        this.addTip('open_seven');
    },
    openDoappraise: function () {
        if (!this.user.activity.doappraise) {
            this.user.activity.doappraise = {
                'open_day': 0,
                'doappraise': 0,
            }
        }

        if (!this.user.activity.doappraise || !this.user.activity.doappraise.open_day) {
            this.user.activity.doappraise.open_day = getGameDate();
            this.user.activity.doappraise.doappraise = 0
            this.markDirty('activity.doappraise');
        }
    },

    openDoAddQQGroup: function () {
        if (!this.user.activity.doddqqgroup) {
            this.user.activity.doddqqgroup = {
                'open_day': 0,
            }
        }

        if (!this.user.activity.doddqqgroup || !this.user.activity.doddqqgroup.open_day) {
            this.user.activity.doddqqgroup.open_day = getGameDate();
            this.markDirty('activity.doddqqgroup');
        }
    },

    openFacebook: function () {
        if (!this.user.activity.facebook) {
            this.user.activity.facebook = {
                'open_day': 0,
            }
        }

        if (!this.user.activity.facebook || !this.user.activity.facebook.open_day) {
            this.user.activity.facebook.open_day = getGameDate();
            this.markDirty('activity.facebook');
        }
    },

    openZeroGift: function () {
        if (!this.user.activity.zero_gift) {
            this.user.activity.zero_gift = {
                'open_day': 0,
            }
        }

        if (!this.user.activity.zero_gift || !this.user.activity.zero_gift.open_day) {
            this.user.activity.zero_gift.open_day = getGameDate();
            this.markDirty('activity.zero_gift');
        }
    },

    openFollowRewards: function () {
        if (!this.user.activity.follow_rewards) {
            this.user.activity.follow_rewards = {
                'open_day': 0,
            }
        }

        if (!this.user.activity.follow_rewards || !this.user.activity.follow_rewards.open_day) {
            this.user.activity.follow_rewards.open_day = getGameDate();
            this.markDirty('activity.follow_rewards');
        }
    },

    // 一本万利初始化
    openInvestment: function () {
        if (!this.user.activity.investment) {
            this.user.activity.investment = {
                'open_day': 0,
                'isBuy': 0,
                'loginDayCount': 0,
                'lastLoginTime': 0,
                'notShow': 0,
                'rewards': {},
            }
        }

        if (!this.user.activity.investment.open_day) {
            this.user.activity.investment.open_day = getGameDate();
            this.markDirty('activity.investment');
        }
    },


    doOpenSeven: function (type, count, condition, oldCondition) {
        if (isActivityStart(this, 'open_seven') != ActivityProcess.NORMAL) {
            return;
        }

        //ERROR('========doOpenSeven========'+type);
        var openSeven = this.user.activity.open_seven;
        var today = getGameDate();
        var day = common.getDateDiff(today, openSeven.open_day) + 1;
        var dayConf = gConfOpenSeven[day];
        if (!dayConf) {
            return; // 活动结束
        }

        /*
        if (type == 'login') {
            // 只记录当天完成的
            for (var id in dayConf) {
                var tasks = dayConf[id].task;
                for (var i = 0, len = tasks.length; i < len; i++) {
                    var taskId = tasks[i];
                    if (gConfOpenSevenReward[taskId].type == type) {
                        this.doOpenSevenAux(taskId, type, count, condition, oldCondition);
                    }
                }
            }
        } else {
            // 全部记录
            for (var d = 1; d <= gConfActivities['open_seven'].duration; d++) {
                var dayConf = gConfOpenSeven[d];
                for (var id in dayConf) {
                    for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                        var taskId = dayConf[id].task[i];
                        if (gConfOpenSevenReward[taskId].type == type) {
                            this.doOpenSevenAux(taskId, type, count, condition, oldCondition, d <= day);
                        }
                    }
                }
            }
        }
        */

        // 全部记录 (应策划要求login类型的任务可以中间不登录，最后一天登录全领)
        for (var d = 1; d <= gConfActivities['open_seven'].duration; d++) {
            var dayConf = gConfOpenSeven[d];
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    if (gConfOpenSevenReward[taskId].type == type) {
                        this.doOpenSevenAux(taskId, type, count, condition, oldCondition, d <= day);
                    }
                }
            }
        }
    },

    doOpenSevenAux: function (taskId, type, count, condition, oldCondition, tips) {
        if (!taskId) {
            return;
        }

        var user = this.user;
        var progresses = user.activity.open_seven.progress;
        if (!progresses[taskId]) {
            progresses[taskId] = [0, 0];
        }

        var progress = progresses[taskId];
        if (progress[1]) {
            return;
        }

        var openSeven = this.user.activity.open_seven;
        var conf = gConfOpenSevenReward[taskId];
        var curProgress = progress[0];
        var count = count ? count : 1;
        if (type == 'level') {
            progress[0] = user.status.level;
        } else if (type == 'login') {
            var today = getGameDate();
            var day = common.getDateDiff(today, openSeven.open_day) + 1;
            if (day < conf.condition) return;
            progress[0] = 1;
        } else if (type == 'arenaRank') {
            // if (condition > conf.condition) return;
            // progress[0] = 1;
            var arena = this.user.arena;
            var detail = this.getArenaRankConditionDetail(conf.condition);
            if (arena.max_rank <= 0 || arena.max_rank > detail.rank) {
                return;
            }
            switch (detail.type) {
                case ArenaType.CROSS:
                    progress[0] = 1;
                    break;
                case ArenaType.THIS:
                    progress[0] = 1;
                    break;
            }
            // if (arena.max_type < detail.type ||
            //     arena.max_rank <= 0 || arena.max_rank > detail.rank) {
            //     return;
            // }
            // progress[0] = 1;
        } else if (type == 'battle') {
            progress[0] = user.battle.progress;
        } else if (type == 'elite') {
            /*
            var cities = user.battle.city;
            while (cities[++curProgress] && cities[curProgress][2].star);
            progress[0] = curProgress;*/
        } else if (type == 'roleQuality') {
            //var curCnt = this.calcRoleQuality(conf.condition);
            if (+condition == +conf.condition) {
                progress[0] += count;
            }

        } else if (type == 'equipLevel') {
            var curSumLv = this.calcEquipLevel();
            if (progress[0] >= curSumLv) return;
            progress[0] = curSumLv;
            // } else if (type == 'equipStar') {
            //     var curSumStar = this.calcEquipStar();
            //     if (progress[0] >= curSumStar) return;
            //     progress[0] = curSumStar;
        } else if (type == 'gemLevel') {
            var curSumLv = this.calcGemLevel();
            if (progress[0] >= curSumLv) return;
            progress[0] = curSumLv;
        } else if (type == 'position') {
            if (gConfPosition[user.info.position].position > conf.condition) return;
            progress[0] = 1;
        } else if (type == 'fightForce') {
            var ff = this.getFightForce();
            if (ff < conf.condition) return;
            progress[0] = 1;
        } else if (type == 'roleReborn') {
            var curSum = this.calcRoleReborn(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
            // } else if (type == 'skillSlot') {
            //     var curSum = this.calcSkillSlot(conf.condition);
            //     if (progress[0] >= curSum) return;
            //     progress[0] = curSum;
        } else if (type == 'dragon') {
            var curSum = this.calcDragonLevel(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipGod' || type == 'soldierLevel') {
            if (oldCondition && oldCondition >= conf.condition) return;

            if (condition >= conf.condition) {
                progress[0] += count;
            }
        } else if (type == 'destiny') {
            var curSum = this.calcRoleDestiny(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'wing') {
            var curSum = user.sky_suit.wing_level;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'weapon') {
            var curSum = user.sky_suit.weapon_level;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equiprefine') {
            var curSum = this.calcEquipRefineLvAll();
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
            // } else if (type == 'fateadvanced') {
            //     var curSum = this.calcConspiracy(conf.condition);
            //     if (progress[0] >= curSum) return;
            //     progress[0] = curSum;
        } else if (type == 'payOnce') {
            if (count == conf.condition)
                progress[0]++;
            else {
                return;
            }
        } else if (type == 'partAwake') {
            var curSum = this.getAllPartStarCount();
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'towerTier') {
            var curSum = user.tower.top_floor;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipUpgrade') {
            var curSum = this.getEquipCountWithIntensifyLevel(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipNum') {
            var curSum = this.getEquipCountWithQuality(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else {
            progress[0] += count;
        }

        this.markDirty('activity.open_seven.progress.' + taskId);
        if (tips && progress[0] >= conf.target) {
            this.addTip('open_seven');
        }
    },

    getCompleteOpenSevenTaskCount: function () {
        var openSeven = this.user.activity.open_seven;
        var today = common.getDate(common.getTime() - gConfGlobalNew.resetHour * 3600);
        var day = common.getDateDiff(today, openSeven.open_day) + 1;
        if (!gConfOpenSeven[day]) {
            // 活动已经结束
            return 0;
        }
        var completeCount = 0;
        var progresses = openSeven.progress;
        for (var d = 1; d <= day; d++) {
            var dayConf = gConfOpenSeven[d];
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    var progress = progresses[taskId];
                    if (progress) {
                        if (progress[1] > 0) {
                            // 完成且已经领过奖
                            completeCount++;
                        } else {
                            var taskConf = gConfOpenSevenReward[taskId];
                            if (taskConf && progress[0] >= taskConf.target) {
                                completeCount++;
                            }
                        }
                    }
                }
            }
        }
        return completeCount;
    },
    openOpenHoliday: function () {
        if (!isActivityStart(this, 'open_holiday')) {
            return;
        }
        var openHoliday = this.user.activity.open_holiday;
        if (!openHoliday || openHoliday.open_day != gConfActivities['open_holiday'].startTime) {
            openHoliday.open_day = gConfActivities['open_holiday'].startTime;
            openHoliday.rewarded_box = [];
        }
        openHoliday.progress = {};
        // 计算各成就型任务状态
        for (var day = 1; day <= 7; day++) {
            var dayConf = gConfOpenHoliday[day];
            if (!dayConf) {
                continue;
            }
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    var taskConf = gConfOpenHolidayReward[taskId];
                    var taskType = taskConf.type;
                    if (taskType == 'login') {
                        if (day == 1) {
                            openHoliday.progress[taskId] = [1, 0];
                        }
                    } else if (taskType == 'roleQuality') {
                        /*
                        var scount = 0;
                        for (var hid in this.user.hero_bag.heros) {
                            var star = this.getHeroStar(hid);
                            if( star == +taskConf.condition ){
                                scount++; 
                            }
                        }*/
                        openHoliday.progress[taskId] = [0, 0];
                        //openHoliday.progress[taskId] = [scount, 0];
                    } else if (taskType == 'roleReborn') {
                        openHoliday.progress[taskId] = [this.calcRoleReborn(taskConf.condition), 0]
                    } else if (taskType == 'soldierLevel') {
                        openHoliday.progress[taskId] = [this.calcSoldierLevel(taskConf.condition), 0]
                    } else if (taskType == 'equipGod') {
                        openHoliday.progress[taskId] = [this.calcEquipGod(taskConf.condition), 0]
                    } else if (taskType == 'level') {
                        openHoliday.progress[taskId] = [this.user.status.level, 0]
                    } else if (taskType == 'gemLevel') {
                        openHoliday.progress[taskId] = [this.calcGemLevel(), 0]
                    } else if (taskType == 'equipLevel') {
                        openHoliday.progress[taskId] = [this.calcEquipLevel(), 0]
                        // } else if (taskType == 'equipStar') {
                        //     openHoliday.progress[taskId] = [this.calcEquipStar(), 0]
                        // } else if (taskType == 'towerStar') {
                        //     openHoliday.progress[taskId] = [this.user.tower.top_floor, 0]
                    } else if (taskType == 'fightForce') {
                        if (this.getFightForce() >= taskConf.confdition) {
                            openHoliday.progress[taskId] = [1, 0]
                        }
                    } else if (taskType == 'position') {
                        var posConf = gConfPosition[this.user.info.position];
                        if (posConf && posConf.position <= taskConf.condition) {
                            openHoliday.progress[taskId] = [1, 0]
                        }
                        // } else if (taskType == 'skillSlot') {
                        //     openHoliday.progress[taskId] = [this.calcSkillSlot(taskConf.condition), 0]
                    } else if (taskType == 'pay') {
                        openHoliday.progress[taskId] = [0, 0]
                    } else if (taskType == 'battle') {
                        openHoliday.progress[taskId] = [this.user.battle.progress, 0]
                    } else if (taskType == 'elite') {
                        /*
                        var curProgress = 0;
                        var cities = this.user.battle.city;
                        while (cities[++curProgress] && cities[curProgress][2].star);
                        openHoliday.progress[taskId] = [curProgress - 1, 0]
                        */
                    } else if (taskType == 'arenaRank') {
                        var arena = this.user.arena;
                        var detail = this.getArenaRankConditionDetail(taskConf.condition);
                        if (arena.max_type >= detail.type &&
                            arena.max_rank > 0 && arena.max_rank < detail.rank) {
                            openHoliday.progress[taskId] = [1, 0];
                        } else {
                            openHoliday.progress[taskId] = [0, 0];
                        }
                    } else if (taskType == 'dragon') {
                        openHoliday.progress[taskId] = [this.calcDragonLevel(taskConf.condition), 0]
                    } else if (taskType == 'destiny') {
                        openHoliday.progress[taskId] = [this.calcRoleDestiny(taskConf.condition), 0];
                    } else if (taskType == 'wing') {
                        openHoliday.progress[taskId] = [this.user.sky_suit.wing_level, 0];
                    } else if (taskType == 'weapon') {
                        openHoliday.progress[taskId] = [this.user.sky_suit.weapon_level, 0];
                    } else if (taskType == 'equiprefine') {
                        openHoliday.progress[taskId] = [this.calcEquipRefineLvAll(taskConf.condition), 0];
                        // } else if (taskType == 'fateadvanced') {
                        //     openHoliday.progress[taskId] = [this.calcConspiracy(taskConf.condition), 0];
                    } else if (taskType == 'partAwake') {
                        // 部位觉醒总星级X星
                        openHoliday.progress[taskId] = [this.getAllPartStarCount(), 0];
                    } else if (taskType == 'towerTier') {
                        // 勇者之塔达到第X层
                        openHoliday.progress[taskId] = [this.user.tower.top_floor, 0];
                    } else if (taskType == 'equipNum') {
                        // 穿戴X件指定品质以上装备
                        openHoliday.progress[taskId] = [this.getEquipCountWithQuality(taskConf.condition), 0];
                    } else if (taskType == 'equipUpgrade') {
                        // X件装备强化至X级
                        openHoliday.progress[taskId] = [this.getEquipCountWithIntensifyLevel(taskConf.condition), 0];
                    } else {
                        openHoliday.progress[taskId] = [0, 0]
                    }
                }
            }
        }

        this.markDirty('activity.open_holiday');
        this.addTip('open_holiday');
    },

    doOpenHoliday: function (type, count, condition, oldCondition) {
        if (isActivityStart(this, 'open_holiday') != ActivityProcess.NORMAL) {
            return;
        }


        if (!isActivityStart(this, 'open_holiday')) {
            return;
        }
        var openHoliday = this.user.activity.open_holiday;
        if (!openHoliday || openHoliday.open_day != gConfActivities['open_holiday'].startTime) {
            this.openOpenHoliday();
        }



        var day = 7;

        // 全部记录 (应策划要求login类型的任务可以中间不登录，最后一天登录全领)
        for (var d = 1; d <= 7; d++) {
            var dayConf = gConfOpenHoliday[d];
            if (!dayConf) {
                continue;
            }
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    if (gConfOpenHolidayReward[taskId].type == type) {
                        this.doOpenHolidayAux(taskId, type, count, condition, oldCondition, d <= day);
                    }
                }
            }
        }
    },

    doOpenHolidayAux: function (taskId, type, count, condition, oldCondition, tips) {
        if (!taskId) {
            return;
        }

        var user = this.user;
        var progresses = user.activity.open_holiday.progress;
        if (!progresses[taskId]) {
            progresses[taskId] = [0, 0];
        }

        var progress = progresses[taskId];
        if (progress[1]) {
            return;
        }

        var openHoliday = this.user.activity.open_holiday;
        var conf = gConfOpenHolidayReward[taskId];
        var curProgress = progress[0];
        var count = count ? count : 1;
        if (type == 'level') {
            progress[0] = user.status.level;
        } else if (type == 'login') {
            // var today = getGameDate();
            // var day = common.getDateDiff(today, getGameDate(openHoliday.open_day) ) + 1;
            // if (day <= conf.target){
            progress[0]++;
            // };

        } else if (type == 'arenaRank') {
            // if (condition > conf.condition) return;
            // progress[0] = 1;
            var arena = this.user.arena;
            var detail = this.getArenaRankConditionDetail(conf.condition);
            if (arena.max_type < detail.type ||
                arena.max_rank <= 0 || arena.max_rank > detail.rank) {
                return;
            }
            progress[0] = 1;
        } else if (type == 'battle') {
            progress[0] = user.battle.progress;
        } else if (type == 'elite') {
            /*
            var cities = user.battle.city;
            while (cities[++curProgress] && cities[curProgress][2].star);
            progress[0] = curProgress;
            */
        } else if (type == 'roleQuality') {
            if (+condition == +conf.condition) {
                progress[0] += count;
            }
        } else if (type == 'equipLevel') {
            var curSumLv = this.calcEquipLevel();
            if (progress[0] >= curSumLv) return;
            progress[0] = curSumLv;
            // } else if (type == 'equipStar') {
            //     var curSumStar = this.calcEquipStar();
            //     if (progress[0] >= curSumStar) return;
            //     progress[0] = curSumStar;
        } else if (type == 'gemLevel') {
            var curSumLv = this.calcGemLevel();
            if (progress[0] >= curSumLv) return;
            progress[0] = curSumLv;
        } else if (type == 'position') {
            if (gConfPosition[user.info.position].position > conf.condition) return;
            progress[0] = 1;
        } else if (type == 'fightForce') {
            var ff = this.getFightForce();
            if (ff < conf.condition) return;
            progress[0] = 1;
        } else if (type == 'roleReborn') {
            var curSum = this.calcRoleReborn(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
            // } else if (type == 'skillSlot') {
            //     var curSum = this.calcSkillSlot(conf.condition);
            //     if (progress[0] >= curSum) return;
            //     progress[0] = curSum;
        } else if (type == 'dragon') {
            var curSum = this.calcDragonLevel(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipGod' || type == 'soldierLevel') {
            if (oldCondition && oldCondition >= conf.condition) return;

            if (condition >= conf.condition) {
                progress[0] += count;
            }
        } else if (type == 'destiny') {
            var curSum = this.calcRoleDestiny(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'wing') {
            var curSum = user.sky_suit.wing_level;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'weapon') {
            var curSum = user.sky_suit.weapon_level;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equiprefine') {
            var curSum = this.calcEquipRefineLvAll();
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
            // } else if (type == 'fateadvanced') {
            //     var curSum = this.calcConspiracy(conf.condition);
            //     if (progress[0] >= curSum) return;
            //     progress[0] = curSum;
        } else if (type == 'payOnce') {
            if (count == conf.condition)
                progress[0]++;
            else {
                return;
            }
        } else if (type == 'partAwake') {
            var curSum = this.getAllPartStarCount();
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'towerTier') {
            var curSum = user.tower.top_floor;
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipUpgrade') {
            var curSum = this.getEquipCountWithIntensifyLevel(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else if (type == 'equipNum') {
            var curSum = this.getEquipCountWithQuality(conf.condition);
            if (progress[0] >= curSum) return;
            progress[0] = curSum;
        } else {
            progress[0] += count;
        }

        this.markDirty('activity.open_holiday.progress.' + taskId);
        if (tips && progress[0] >= conf.target) {
            this.addTip('open_holiday');
        }
    },

    getCompleteOpenHolidayTaskCount: function () {
        var openHoliday = this.user.activity.open_holiday;
        var completeCount = 0;
        var day = 7;
        var progresses = openHoliday.progress;
        for (var d = 1; d <= day; d++) {
            var dayConf = gConfOpenHoliday[d];
            if (!dayConf) {
                continue;
            }
            for (var id in dayConf) {
                for (var i = 0, len = dayConf[id].task.length; i < len; i++) {
                    var taskId = dayConf[id].task[i];
                    var progress = progresses[taskId];
                    if (progress) {
                        if (progress[1] > 0) {
                            // 完成且已经领过奖
                            completeCount++;
                        } else {
                            var taskConf = gConfOpenHolidayReward[taskId];
                            if (taskConf && progress[0] >= taskConf.target) {
                                completeCount++;
                            }
                        }
                    }
                }
            }
        }
        return completeCount;
    },

    getFood: function (now) {
        /*
        var user = this.user;
        var foodTime = user.mark.food_time;
        var foodInterval = gConfGlobalNew.foodInterval * 60;
        // 粮草上限特权
        var privilege = user.task.privilege;
        var topFoodPrivilegeId = gConfNobiltyTitleKey['maxFood'].id;
        var extraFoodLimit = 0;
        if (privilege[topFoodPrivilegeId]) {
            // extraFoodLimit = privilege[topFoodPrivilegeId];
            extraFoodLimit =this.getPrivilegeVal('maxFood');
        }

        if (now - foodTime < foodInterval || user.status.food >= gConfGlobalNew.foodMax + extraFoodLimit) {
            return user.status.food;
        }

        var gotFood = Math.floor((now - foodTime) / foodInterval);
        if (user.status.food + gotFood > gConfGlobalNew.foodMax + extraFoodLimit) {
            gotFood = gConfGlobalNew.foodMax + extraFoodLimit - user.status.food;
        }
        user.status.food += gotFood;
        this.markDirty('status.food');
        user.mark.food_time = foodTime + gotFood * foodInterval;
        this.markDirty('mark.food_time');
        return user.status.food;
        */
    },

    // 红色体力
    getFoodRed: function (now) {
        var user = this.user;
        if (!isModuleOpen_new(this, 'hard')) {
            return user.status.food_red;
        }

        var user = this.user;
        var foodTime = user.mark.food_time_red;
        var foodInterval = gConfGlobalNew.foodRed * 60;

        if (now - foodTime < foodInterval) {
            return user.status.food_red;
        }

        var gotFood = Math.floor((now - foodTime) / foodInterval);
        user.mark.food_time_red = foodTime + gotFood * foodInterval;
        this.markDirty('mark.food_time_red');

        if (user.status.food_red >= gConfGlobalNew.foodRedMax) {
            return user.status.food_red;
        }

        if (user.status.food_red + gotFood > gConfGlobalNew.foodRedMax) {
            gotFood = gConfGlobalNew.foodRedMax - user.status.food_red;
        }

        user.status.food_red += gotFood;
        this.markDirty('status.food_red');
        return user.status.food_red;
    },

    getStayingPower: function (now) {
        var param = this.getBuildingParam('enduranceRecoverRate');

        var user = this.user;
        var powerTime = user.mark.staying_power_time;
        var powerInterval = parseInt(gConfTerritoryWarBase.enduranceRecoverInterval.value);
        powerInterval = Math.floor(powerInterval * (1 - param[0] / 100));

        var powerMax = parseInt(gConfTerritoryWarBase.enduranceLimit.value);
        if (user.status.staying_power >= powerMax) {
            user.status.staying_power = powerMax;
            user.mark.staying_power_time = now;
            this.markDirty('status.staying_power');
            this.markDirty('mark.staying_power_time');
            return user.status.staying_power;
        }

        if (now - powerTime < powerInterval) {
            return user.status.staying_power;
        }

        var gotPowner = Math.floor((now - powerTime) / powerInterval);
        if (user.status.staying_power + gotPowner > powerMax) {
            gotPowner = powerMax - user.status.staying_power;
            powerTime = now;
        } else {
            powerTime = powerTime + gotPowner * powerInterval;
        }

        user.status.staying_power += gotPowner;
        this.markDirty('status.staying_power');
        user.mark.staying_power_time = powerTime;
        this.markDirty('mark.staying_power_time');
        return user.status.staying_power;
    },

    cullStayingPower: function (val) {
        var new_val = val;
        var powerMax = parseInt(gConfTerritoryWarBase.enduranceLimit.value);
        if (new_val > powerMax) {
            new_val = powerMax;
        }

        if (new_val < 0) {
            new_val = 0;
        }

        return new_val;
    },

    updateNobility: function () {
        if (!isModuleOpen_new(this, 'task')) {
            return;
        }

        var user = this.user;
        var active = user.task.active || 0;
        var nobility = user.task.nobility;
        var nobilityId = nobility[0];
        var nobilityStars = nobility[1];
        var baseKey = gConfNobiltyBase[nobilityId].key;
        var nobilityLevel = gConfNobiltyLevelKey[baseKey].level + nobilityStars;
        var upgradNobilityLevel = nobilityLevel + 1;
        if (nobilityLevel == gConfNobiltyLevel.max) {
            return;
        }

        var allCosts = 0;
        for (var id = 2; id <= upgradNobilityLevel; id++) {
            var upgradCosts = gConfNobiltyLevel[id - 1].active;
            allCosts += upgradCosts;
        }

        if (active < allCosts) {
            return;
        }

        if (!gConfNobiltyLevel[upgradNobilityLevel].key) {
            nobility[1]++;
            this.markDirty('task.nobility');
        } else {
            var levelKey = gConfNobiltyLevel[upgradNobilityLevel].key;
            nobility[0] = gConfNobiltyBaseKey[levelKey].id;
            nobility[1] = 0;
            this.markDirty('task.nobility');

            // 爵位升级，标记属性改变
            this.markFightForceChangedAll();
        }

        var alreadyLockAwards = this.updateNobilityPrivilege();
        return alreadyLockAwards;
    },

    updateNobilityPrivilege: function () {
        if (!isModuleOpen_new(this, 'task')) {
            return;
        }

        var user = this.user;
        var active = user.task.active || 0;
        var privilege = user.task.privilege;
        var vip = user.status.vip;
        var nobility = user.task.nobility;
        var nobilityId = nobility[0];
        var nobilityStars = nobility[1];
        var privilegeId = gConfNobiltyBase[nobilityId]['pg' + nobilityStars];
        if (!privilegeId) {
            return;
        }

        var privilegeCount = gConfNobiltyBase[nobilityId]['pgnum' + nobilityStars];
        var privilegeType = gConfNobiltyTitle[privilegeId].key;
        var privilegeLock = gConfNobiltyTitle[privilegeId].lock;
        var awards = 0;
        if (privilegeLock == 1) {
            // 特权解锁
            if (privilegeType == 'tavernLimit') {
                if (vip >= gConfGlobal.tavernHotVIPRequire) {
                    awards = gConfNobiltyTitle[privilegeId].award;
                }
            } else if (privilegeType == 'orangeDial') {
                if (vip >= gConfGlobal.promoteOrangeVipRestrict) {
                    awards = gConfNobiltyTitle[privilegeId].award;
                }
            } else if (privilegeType == 'redDial') {
                if (vip >= gConfGlobal.promoteRedVipRestrict) {
                    awards = gConfNobiltyTitle[privilegeId].award;
                }
            } else if (privilegeType == 'lifeCard') {
                if (user.payment.long_card) {
                    awards = gConfNobiltyTitle[privilegeId].award;
                } else {
                    // 解锁终身卡
                    user.payment.long_card = 1;
                    this.markDirty('payment.long_card');
                    this.doDailyTask('longCard', 1);
                    this.doDailyTask('doubleCard', 1);
                }
            }

            privilege[privilegeId] = privilegeCount;
            this.markDirty('task.privilege.' + privilegeId);
            this.updateVip();
        } else if (privilegeLock == 2) {
            // 特权累计不包括训练馆
            if (!privilege[privilegeId]) {
                privilege[privilegeId] = privilegeCount;
            } else {
                privilege[privilegeId] += privilegeCount;
            }
            this.markDirty('task.privilege.' + privilegeId);
            var nowPrivilegeCount = privilege[privilegeId];
            if (privilegeType == 'godShopRefresh') {
                user.status.free_gtoken = nowPrivilegeCount;
                this.markDirty('status.free_gtoken');
            } else if (privilegeType == 'equipShopRefresh') {
                user.status.free_mtoken = nowPrivilegeCount;
                this.markDirty('status.free_mtoken');
            } else if (privilegeType == 'vipExp') {
                this.updateVip();
            }
        }

        return awards;
    },

    updateVip: function () {
        var user = this.user;
        var vipXp = user.status.vip_xp;
        var oldVip = user.status.vip;
        var extraVip = this.getPrivilegeVal('vipExp');

        for (var i = 1; i < 1000; i++) {
            if (!gConfVip[i] || gConfVip[i].cash > vipXp + extraVip) {
                break;
            }
        }

        user.status.vip = i - 1;
        var newVip = i - 1;
        if (oldVip != i - 1) {
            updateWssData(user.info.uid, { vip: i - 1 });
            forceSyncToWorld(user.info.uid);
            this.markDirty('status.vip');

            requestWorldByModAndAct({ uid: user._id }, 'user', 'update_vip', {
                old_vip: oldVip,
                new_vip: newVip,
            });

            this.updateHeadFrameStatus('vip_level', newVip);
        }
    },

    updateStayingPower: function (power, time) {
        var user = this.user;
        user.status.staying_power = this.cullStayingPower(power);
        this.markDirty('status.staying_power');
        user.mark.staying_power_time = time;
        this.markDirty('mark.staying_power_time');
    },

    updateFirstPayProgress: function () {
        var user = this.user;
        var rewardedFistPay = user.activity.rewarded_first_pay;
        // 判断首冲活动红点
        for (var avFirstPay in gConfAvFirstPay) {
            if (rewardedFistPay.indexOf(avFirstPay['id']) < 0) {
                if (avFirstPay['pay'] <= user.payment.paid) {
                    this.addTip('first_pay');
                    break;
                }
            }
        }
    },

    // updateFirstPayProgress: function (type) {
    //     var user = this.user;
    //     var firstPay = user.activity.first_pay;
    //     if (gConfAvFirstPayKey1Id[type]) {
    //         var tid = 1;
    //         var confId = gConfAvFirstPayKey1Id[type];
    //     } else if (gConfAvFirstPayKey2Id[type]) {
    //         var tid = 2;
    //         var confId = gConfAvFirstPayKey2Id[type];
    //     }
    //
    //     for (var sid in confId) {
    //         if (type == 'city_progress') {
    //             firstPay.progress[sid][tid] = user.battle.progress;
    //         } else if (type == 'fight_force') {
    //             var ff = this.getFightForce();
    //             firstPay.progress[sid][tid] = ff;
    //         } else if (type == 'login_days') {
    //             firstPay.progress[sid][tid] = user.mark.login_days;
    //         } else if (type == 'single_recharge') {
    //             for (var rid in user.payment.pay_records) {
    //                 if (tid == 1) {
    //                     if (!firstPay.progress[sid][tid] && gConfRecharge[rid].amount == confId[sid].target1) {
    //                         firstPay.progress[sid][tid] = confId[sid].target1;
    //                     }
    //                 } else if (tid == 2) {
    //                     if (!firstPay.progress[sid][tid] && gConfRecharge[rid].amount == confId[sid].target2) {
    //                         firstPay.progress[sid][tid] = confId[sid].target2;
    //                     }
    //                 }
    //             }
    //         }
    //
    //         if (user.mark.first_pay == 2) {
    //             if (tid == 1) {
    //                 if (firstPay.progress[sid][tid] >= confId[sid].target1 &&
    //                     !firstPay.rewards[sid]) {
    //                     this.addTip('first_pay');
    //                 }
    //             } else if (tid == 2) {
    //                 if (firstPay.progress[sid][tid] >= confId[sid].target2 &&
    //                     !firstPay.rewards[sid]) {
    //                     this.addTip('first_pay');
    //                 }
    //             }
    //         }
    //
    //         this.markDirty(util.format('activity.first_pay.progress.%d.%d', sid, tid));
    //     }
    // },

    getActionPoint: function (now) {
        var user = this.user;
        var actionTime = user.mark.action_point_time;

        // 领地战没开启的时候不回复体力
        if (!this.isTerritoryWarOpen() && actionTime == 0) {
            return user.status.action_point;
        }

        if (actionTime == 0) {
            actionTime = now;
        }

        var param = this.getBuildingParam('actionMax');
        var param2 = this.getBuildingParam('actionRecoverRate');

        var actionInterval = parseInt(gConfTerritoryWarBase.actionRecoverInterval.value);
        actionInterval = Math.floor(actionInterval * (1 - param2[0] / 100));

        var pointMax = parseInt(gConfTerritoryWarBase.actionLimit.value);
        pointMax = Math.floor(pointMax + param[0]);

        if (user.status.action_point >= pointMax) {
            user.mark.action_point_time = now;
            this.markDirty('mark.action_point_time');
            return user.status.action_point;
        }

        if (now - actionTime < actionInterval) {
            return user.status.action_point;
        }

        var gotPoint = Math.floor((now - actionTime) / actionInterval);
        if (user.status.action_point + gotPoint > pointMax) {
            gotPoint = pointMax - user.status.action_point;
            actionTime = now;
        } else {
            actionTime = actionTime + gotPoint * actionInterval;
        }

        user.status.action_point += gotPoint;
        this.markDirty('status.action_point');
        user.mark.action_point_time = actionTime;
        this.markDirty('mark.action_point_time');
        return user.status.action_point;
    },

    getLegionCityAwards: function (now) {
        return false;
    },

    calcRoleQuality: function (condition) {
        var user = this.user;
        var cnt = 0;

        // 主角
        var heroCombatConf = getHeroCombatConf(user.hero_bag.heros[1].rid);

        // todo by fish替换为星级
        if (heroCombatConf.quality >= condition) {
            cnt++;
        }

        // 背包
        var bag = user.bag;
        for (var hid in bag.card) {
            heroCombatConf = getHeroCombatConf(hid);
            if (heroCombatConf && heroCombatConf.quality >= condition) {
                cnt++;
            }
        }

        return cnt;
    },

    calcRoleDestiny: function (condition) {
        var allPos = this.user.pos;
        var cnt = 0;
        for (var pos in allPos) {
            if (allPos[pos].destiny.level >= condition) {
                cnt++;
            }
        }

        return cnt;
    },

    calcEquipRefineLvAll: function () {
        var user = this.user;
        var bag = user.bag;
        var totalLv = 0;
        for (var eid in bag.equip) {
            var equipObj = bag.equip[eid];
            var equipConf = gConfEquip[equipObj.id];
            if (equipConf) {
                var refineExp = equipObj.refine_exp;
                var refineLevel = getRefineLevelByExp(equipConf.quality, refineExp)[0];
                if (equipObj.pos > 0) {
                    totalLv += refineLevel;
                }
            }
        }

        return totalLv;
    },

    calcConspiracy: function (condition) {
        var conspiracy = this.user.conspiracy;
        return conspiracy[condition] || 0;
    },

    calcLeaderLevel: function (condition) {
        var user = this.user;
        var cnt = 0;

        // 主角
        if (user.pos[1].level >= condition)
            cnt++;

        return cnt;
    },

    calcWingLevel: function (condition) {
        var user = this.user;
        var cnt = 0;

        if (user.sky_suit.wing_level >= condition)
            cnt++;

        return cnt;
    },

    calcWeaponLevel: function (condition) {
        var user = this.user;
        var cnt = 0;

        if (user.sky_suit.weapon_level >= condition)
            cnt++;

        return cnt;
    },

    calcRoleReborn: function (condition) {
        var allPos = this.user.hero_bag.heros;
        var cnt = 0;
        for (var hid in allPos) {
            if (allPos[hid].tier >= condition) {
                cnt++;
            }
        }
        return cnt;
    },

    calcSoldierLevel: function (condition) {
        //var allPos = this.user.pos;
        var cnt = 0;
        /*
        for (var pos in allPos) {
            if (allPos[pos].soldier.level >= condition) {
                cnt++;
            }
        }
        */
        return cnt;
    },

    calcEquipGod: function (condition) {
        return 0;
    },

    calcEquipLevel: function () {
        var equips = this.user.bag.equip;
        var sumLv = 0;
        var team1 = this.user.team[1];
        for (var hid in team1) {
            var heroObj = this.user.hero_bag.heros[hid];
            var posEquip = heroObj.equip;
            for (var type in posEquip) {
                if (!posEquip[type]) continue;
                sumLv += gConfEquip[equips[posEquip[type]].id].level;
            }
        }
        return sumLv;
    },

    calcEquipStar: function () {
        return 0;
    },

    calcGemLevel: function () {
        var user = this.user;
        var team1 = user.team[1];
        var sumLv = 0;

        for (var hid in team1) {
            var heroObj = user.hero_bag.heros[hid];
            if (heroObj) {
                for (var j = 1; j <= HeroPartCount; j++) {
                    for (var k = 1; k <= 4; k++) {
                        var gemId = heroObj.part[j].gems[k];
                        if (gemId > 0) {
                            var gemConf = gConfGem[gemId];
                            if (gemConf) {
                                sumLv += gemConf.level;
                            }
                        }
                    }
                }
            }
        }

        return sumLv;
    },

    calcSkillSlot: function (condition) {
        var count = 0;
        var dragons = this.user.dragon;
        var gems = this.user.bag.dragon;
        for (var id in dragons) {
            var sumLv = 0;
            for (var i = 1; i <= 5; i++) {
                var gem = gems[dragons[id].slot[i]];
                if (gem) {
                    sumLv += gConfDragonGem[gem.id].level;
                }
            }

            if (sumLv >= condition) {
                count++;
            }
        }
        return count;
    },

    calcDragonLevel: function (condition) {
        var count = 0;
        var dragons = this.user.dragon;
        for (var id in dragons) {
            if (dragons[id].level >= condition) {
                count++;
            }
        }
        return count;
    },

    // 人皇自定义配置  修改人皇功能在这里修改即可
    skyTypeConfig: {
        weapon: 1,
        wing: 2,
        mount: 3
    },

    keyFindVal: function (type) {
        return this.skyTypeConfig[type];
    },

    valFindKey: function (nums) {
        var skyType = this.skyTypeConfig;
        var val = '';
        for (var i in skyType) {
            if (skyType[i] == nums) {
                val = i; break;
            }
        }
        return val;
    },

    // 通过key获取人皇配置
    keyFindConf: function (key) {
        var gConfSky = '';
        key == 'weapon' && (gConfSky = gConfSkyWeap);
        key == 'wing' && (gConfSky = gConfSkyWing);
        key == 'mount' && (gConfSky = gConfSkyMount);
        return gConfSky;
    },


    // 更新人皇收集数量 & 返回已活装备
    updateSkyCollect: function (type, unlock) {
        var skySuit = this.user.sky_suit;
        var collectProgress = 0;
        var skyLevel = skySuit[type + '_level'];
        var indexType = this.keyFindVal(type);

        var skyIllusionEquip = skySuit[type + '_illusion_equip'];
        var skyIllusionEquipTime = skySuit[type + '_illusion_equip_time'];

        var unlockEquip = {};
        for (var id in gConfSkyChange[indexType]) {
            if (gConfSkyChange[indexType][id].condition == 'level') {
                if (id != 0 && skyLevel >= gConfSkyChange[indexType][id].value) {
                    collectProgress++;
                    unlockEquip[id] = 1;

                    if (!skyIllusionEquip[id]) {
                        skyIllusionEquip[id] = 1;
                        this.markDirty('sky_suit.' + type + '_illusion_equip');
                    }
                }
            } else {
                if (skyIllusionEquip[id]) {
                    collectProgress++;
                    unlockEquip[id] = 1;
                }
            }
        }

        /*
        for (var id in skyIllusionEquip) {
            if (skyIllusionEquip[id]) {
                collectProgress++;
                unlockEquip[id] = 1;
            }
        }
        */

        for (var tid in skyIllusionEquipTime) {
            if (skyIllusionEquipTime[tid]) {
                collectProgress++;
                unlockEquip[tid] = skyIllusionEquipTime[tid];
            }
        }

        skySuit[type + '_collect'] = collectProgress;
        this.markDirty('sky_suit.' + type + '_collect');

        if (unlock) return unlockEquip;
    },

    // 人皇幻化默认穿戴装备id
    calcSkyIllusionId: function (type) {
        var confId = this.keyFindVal(type);

        var skySuit = this.user.sky_suit;
        var skyLevel = skySuit[type + '_level'];

        var value = 0;
        var conf = gConfSkyChange[confId];
        var change = Object.keys(conf).sort(function (a, b) {
            return a - b;
        });
        for (var i = 0, len = change.length; i < len; i++) {
            var changeId = change[i];
            if (conf[changeId].condition == 'level' && skyLevel >= conf[changeId].value) {
                value = changeId;
            }
        }

        return +value;
    },

    // 人皇技能已解锁
    calcSkyUnlockSkill: function (type) {
        var skySuit = this.user.sky_suit;
        var skyLevel = skySuit[type + '_level'],
            skySkill = skySuit[type + '_skills'];
        var confIndex = this.keyFindVal(type);

        for (var id in skySkill) {
            if (skyLevel >= gConfSkySkill[confIndex][id].unlock) {
                if (!skySuit[type + '_skills'][id]) {
                    skySuit[type + '_skills'][id] = 1;
                    this.markDirty('sky_suit.' + type + '_skills' + id);
                }
            }
        }
    },

    // 计算人皇收集进度
    calcSkyCollect: function (type) {
        var skySuit = this.user.sky_suit;
        var collectProgress = 0;
        var confIndex = this.keyFindVal(type);

        var skyCollect = skySuit[type + '_collect'];

        var conf = gConfSkyCollect[confIndex];
        var collect = Object.keys(conf).sort(function (a, b) {
            return a - b;
        });
        for (var i = 0, len = collect.length; i < len; i++) {
            var collectId = collect[i];
            if (skyCollect >= gConfSkyCollect[confIndex][collectId].goalValue) {
                collectProgress = parseInt(collectId);
            }
        }

        return collectProgress;
    },

    // 计算幻化加成
    calcSkyIllusionPerc: function (type) {
        var skySuit = this.user.sky_suit;
        var skyIllusionPerc = 0;

        var confId = this.keyFindVal(type);

        var skyIllusionEquip = skySuit[type + '_illusion_equip'];
        var skyIllusionEquipTime = skySuit[type + '_illusion_equip_time'];
        var skyLevel = skySuit[type + '_level'];

        for (var id in skyIllusionEquip) {
            skyIllusionPerc += gConfSkyChange[confId][id].attribute;
        }

        for (var tid in skyIllusionEquipTime) {
            skyIllusionPerc += gConfSkyChange[confId][tid].attribute;
        }

        /*for (var id in gConfSkyChange[confId]) {
            if (gConfSkyChange[confId][id].condition == 'level') {
                if (id != 0 && skyLevel >= gConfSkyChange[confId][id].value) {
                    skyIllusionPerc += gConfSkyChange[confId][id].attribute;
                }
            }
        }*/

        return skyIllusionPerc;
    },


    //基础属性加成
    calcBaseSkyIllusionPerc: function (type) {
        var skySuit = this.user.sky_suit;
        var skyIllusionPerc = [];

        var confId = this.keyFindVal(type);

        var skyIllusionEquip = skySuit[type + '_illusion_equip'];
        var skyIllusionEquipTime = skySuit[type + '_illusion_equip_time'];

        for (var id in skyIllusionEquip) {
            for (var i = 1; i <= 6; i++) {
                if (!skyIllusionPerc[gConfSkyChange[confId][id]['att' + i]]) {
                    skyIllusionPerc[gConfSkyChange[confId][id]['att' + i]] = 0;
                }
                skyIllusionPerc[gConfSkyChange[confId][id]['att' + i]] += gConfSkyChange[confId][id]['val' + i];
            }
        }

        for (var tid in skyIllusionEquipTime) {
            for (var i = 1; i <= 6; i++) {
                if (!skyIllusionPerc[gConfSkyChange[confId][tid]['att' + i]]) {
                    skyIllusionPerc[gConfSkyChange[confId][tid]['att' + i]] = 0;
                }
                skyIllusionPerc[gConfSkyChange[confId][tid]['att' + i]] += gConfSkyChange[confId][tid]['val' + i];
            }
        }
        return skyIllusionPerc;
    },

    // 人皇进阶能量值是否清空
    cleanSkyEnergy: function (sky_type) {
        var now = common.getTime();
        var skySuit = this.user.sky_suit;
        if (skySuit[sky_type + '_energy_clean_time'] && now >= skySuit[sky_type + '_energy_clean_time']) {
            skySuit[sky_type + '_energy'] = 0;
            this.markDirty('sky_suit.' + sky_type + '_energy');
            skySuit[sky_type + '_energy_clean_time'] = 0;
            this.markDirty('sky_suit.' + sky_type + '_energy_clean_time');
        }
    },

    // 幻化装备是否到期
    cleanSkyIllusionEquip: function () {
        var change = false;
        var now = common.getTime();
        var skySuit = this.user.sky_suit;
        var type = Object.keys(this.skyTypeConfig);

        for (var i = 0, len = type.length; i < len; i++) {
            var illusionEquipTime = skySuit[type[i] + '_illusion_equip_time'];
            for (var id in illusionEquipTime) {
                if (illusionEquipTime[id] && now >= illusionEquipTime[id]) {
                    delete illusionEquipTime[id];
                    this.markDelete('sky_suit.' + type[i] + '_illusion_equip_time' + i);
                    if (skySuit[type[i] + '_illusion'] == id) {
                        skySuit[type[i] + '_illusion'] = this.calcSkyIllusionId(type[i]);
                        this.markDirty('sky_suit.' + type[i] + '_illusion');
                    }
                    change = true;
                }
            }
        }

        this.checkEquipedIllusionState();
        //更新收集数量
        this.updateSkyCollect('mount');
        this.updateSkyCollect('wing');
        this.updateSkyCollect('weapon');

        if (change) {
            // 重新计算战斗力
            this.memData.ffchanged = 1;
            for (var pos in this.memData.pos) {
                this.memData.pos[pos].ffchanged = 1;
            }
            this.getFightForce()
        }
    },

    // 检测当前装备的幻化是否失效
    checkEquipedIllusionState: function () {
        var now = common.getTime();
        var skySuit = this.user.sky_suit;
        var type = Object.keys(this.skyTypeConfig);

        for (var i = 0, len = type.length; i < len; i++) {
            var curIllusionId = skySuit[type[i] + '_illusion'];
            var conf = gConfSkyChange[i + 1][curIllusionId];
            if (conf && conf.kind == 1) {
                // 当前装备的是限时幻化，检测该幻化是否过期
                var illusionEquipTime = skySuit[type[i] + '_illusion_equip_time'];
                if (!illusionEquipTime[curIllusionId] || now >= illusionEquipTime[curIllusionId]) {
                    skySuit[type[i] + '_illusion'] = this.calcSkyIllusionId(type[i]);
                    this.markDirty('sky_suit.' + type[i] + '_illusion');
                }
            }
        }
    },


    // ---------------人皇 end---------------------

    getCreateDays: function () {
        var createDate = common.getDate(this.user.info.create);
        var today = common.getDate();
        return common.getDateDiff(createDate, today);
    },

    getCreateDaysFix: function () {
        var createDate = getGameDate(this.user.info.create)
        //var createDate = common.getDate(this.user.info.create);
        var today = common.getDate();
        return common.getDateDiff(createDate, today);
    },

    getOnlineTime: function () {
        if (!this.memData.wss_login) {
            return 0;
        }

        return common.getTime() - this.memData.wss_login + this.user.mark.online_time;
    },

    onCashCost: function (cash) {
        var user = this.user;
        user.payment.cost += cash;
        this.markDirty('payment.cost');
        this.doOpenHoliday('payment.paid', cash);
        // 消费有礼
        if (isActivityStart(this, 'expend_gift')) {
            var expendGift = this.user.activity.expend_gift;
            if (expendGift.time != gConfActivities['expend_gift'].startTime) {
                expendGift.time = gConfActivities['expend_gift'].startTime;
                expendGift.paid = 0;
                expendGift.rewards = {};
                this.markDirty('activity.expend_gift');
            }

            if (this.action.act != 'click_lucky_dragon') {
                expendGift.paid += cash;
                this.markDirty('activity.expend_gift.paid');
            }
        }

        // 每日消耗
        if (isActivityStart(this, 'daily_cost')) {
            var today = getGameDate();
            var dailyCost = this.user.activity.daily_cost;
            if (dailyCost.day != today) {
                dailyCost.day = today;
                dailyCost.day_cost = 0;
                dailyCost.rewards = {};
                this.markDirty('activity.daily_cost');
            }

            if (this.action.act != 'click_lucky_dragon') {
                dailyCost.day_cost += cash;
                this.markDirty('activity.daily_cost.day_cost');
            }
        }
    },

    onBindCashCost: function (cash) {
        var user = this.user;
        if (!user.payment.cost_bindcash) {
            user.payment.cost_bindcash = 0;
        }

        user.payment.cost_bindcash += cash;
        this.markDirty('payment.cost_bindcash');

        // 消费有礼
        if (isActivityStart(this, 'expend_gift')) {
            var expendGift = this.user.activity.expend_gift;
            if (expendGift.time != gConfActivities['expend_gift'].startTime) {
                expendGift.time = gConfActivities['expend_gift'].startTime;
                expendGift.paid = 0;
                expendGift.rewards = {};
                this.markDirty('activity.expend_gift');
            }

            if (this.action.act != 'click_lucky_dragon') {
                expendGift.paid += cash;
                this.markDirty('activity.expend_gift.paid');
            }
        }
    },

    addTip: function (type) {
        if (!this.user.tips[type]) {
            this.user.tips[type] = 1;
            this.markDirty('tips.' + type);
        }
        this.hasTip = true;
    },

    rmTip: function (type) {
        if (this.user.tips[type]) {
            delete this.user.tips[type];
            this.markDelete('tips.' + type)
        }
    },

    onPay: function (cash, chargeId, order, amount, gift_key, gift_id, third_pay, fake) {
        this.handleGiftBuy(gift_key, gift_id);

        logic_event_mgr.emit(logic_event_mgr.EVENT.ON_PAY, this, (cash - 0), chargeId, gift_key, gift_id, (amount - 0));

        var user = this.user;
        pushToUser(this.uid, 'self', {
            mod: 'user',
            act: 'get_pay',
            args: {},
        });
        this.payNotify = true;

        // 记录首次充值时间
        if (!user.mark.first_pay_time) {
            user.mark.first_pay_time = common.getTime();
            this.markDirty('mark.first_pay_time');
            user.mark.first_pay_cash = cash;
            this.markDirty('mark.first_pay_cash');

            //设备登陆日志
            DeviceLogCollect(this, 'first_pay', { first_pay: amount || 0, }, false);
        }


        user.status.vip_xp += cash;
        this.markDirty('status.vip_xp');

        this.updateVip();

        var phpReq = {
            uid: this.uid,
            act: 'user_pay',
            args: {
                sid: config.DistId,
                openid: this.user.info.account,
                level: this.user.status.level,
                order: order || 0,
                amount: amount || 0,
                chargeId: chargeId,
                gift_key: gift_key || 0,
                gift_id: gift_id || 0,
                platform: this.user.info.platform,
                device_id: this.user.info.device_id,
            },
        };

        if (!third_pay && !fake) {
            LogCollect(phpReq.uid, phpReq.act, phpReq.args);
        }

        this.doOpenSeven('pay', cash);
        this.doOpenSeven('payOnce', amount);

        this.doOpenHoliday('pay', cash);
        this.doOpenHoliday('payOnce', amount);

        // var phpResp = {};
        // requestPHP(phpReq, phpResp, function () {
        //     if (phpResp.code != 0) {
        //         DEBUG(phpResp.desc);
        //     }
        // });

        // 超值礼包
        var now = common.getTime();
        var today = getGameDate();
        if (isActivityStart(this, 'value_package')) {
            var overvalued = this.user.activity.overvalued_gift;
            if (overvalued.day != today) {
                overvalued.day = today;
                overvalued.rewards = {};
                this.markDirty('activity.overvalued_gift');
            }

            for (var id in gConfAvOvervaluedGiftId[getActivityOpenDay('value_package')]) {
                var conf = gConfAvOvervaluedGiftId[getActivityOpenDay('value_package')][id];
                if (conf && !overvalued.rewards[id] && user.payment.day_money >= conf.money) {
                    var mail = {
                        content: [1002, conf.money],
                        awards: conf.award,
                        time: now,
                        expire: now + gConfMail[1002].time * OneDayTime,
                    };

                    requestWorldByModAndAct({ uid: user._id }, 'mail', 'add_mail', { mail: mail });

                    overvalued.rewards[id] = 1;
                    this.markDirty('activity.overvalued_gift.rewards.' + id);
                }
            }
        }

        // 单冲有礼
        if (isActivityStart(this, 'single_recharge')) {
            var singleRecharge = this.user.activity.single_recharge;
            if (singleRecharge.time != gConfActivities['single_recharge'].startTime) {
                singleRecharge.time = gConfActivities['single_recharge'].startTime;
                singleRecharge.rewards = {};
                singleRecharge.money = {};
                singleRecharge.progress = {};
                this.markDirty('activity.single_recharge');
            }

            for (var id in gConfAvSingleRecharge) {
                var rechargeConf = gConfRecharge[chargeId];
                var conf = gConfAvSingleRecharge[id];
                if (rechargeConf.amount == conf.money) {
                    if (!singleRecharge.progress[id]) {
                        singleRecharge.progress[id] = 1;
                    } else {
                        singleRecharge.progress[id]++;
                    }
                    this.markDirty('activity.single_recharge.progress.' + id);
                    //singleRecharge.money[id] = rechargeConf.amount;
                    //this.markDirty('activity.single_recharge.money.' + id);
                }
            }
        }

        DEBUG(`onpay:day_recharge 0`)
        if (isActivityStart(this, 'day_recharge')) {
            DEBUG(`onpay:day_recharge 1`)
            var day_recharge = user.activity.day_recharge;
            var passedDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
            if (gConfGlobalServer.serverStartDate > common.getTime(20190424) || passedDay > 7) {//这样写,是因为这个活动之前 是没有重置数据
                if (!day_recharge || !day_recharge.open_day || day_recharge.open_day != gConfActivities['day_recharge'].startTime) {
                    user.activity.day_recharge = {
                        'open_day': gConfActivities['day_recharge'].startTime,                      // 活动开启时间
                        'dayCount': 0,                      // 累计充值次数
                        'today_status': 0,                   //今天任务是否完成
                        'day_paid': 0,                       //今天已经充值数
                        'reward': {                         // 领奖状态
                            // day: 1,                      // 已领取天数: 1
                        },
                    };
                    day_recharge = user.activity.day_recharge;
                    this.markDirty('activity.day_recharge');
                }
            }
            day_recharge.day_paid += cash;
            DEBUG(`onpay:day_recharge 2:  ${cash}  ${day_recharge.day_paid}`)
            if (day_recharge.day_paid >= gConfGlobalNew.day_rechargeDailyBuyGoldenDiamond) {
                if (day_recharge.today_status == 0) {
                    day_recharge.today_status = 1;
                    day_recharge.dayCount++;
                }
            }
            this.markDirty('activity.day_recharge');
        }

        // 累冲豪礼
        if (isActivityStart(this, 'accumulate_recharge')) {
            var accumulateRecharge = this.user.activity.accumulate_recharge;
            // var rechargeConf = gConfRecharge[chargeId];
            accumulateRecharge.paid += cash;
            this.markDirty('activity.accumulate_recharge.paid');
            for (var id in gConfAvAccumulateRecharge) {
                var conf = gConfAvAccumulateRecharge[id];
                if (accumulateRecharge.paid > conf.needRechargeGoldNumber
                    && !accumulateRecharge.rewards[id]) {
                    this.addTip('accumulate_recharge');
                    break;
                }
            }
        }

        this.doOpenHoliday('paid', cash);
        // 充值专享
        if (isActivityStart(this, 'pay_only')) {
            var payOnly = this.user.activity.pay_only;
            var openDay = getGameDate(gConfActivities['pay_only'].startTime);
            if (payOnly.day != openDay) {
                payOnly.day = openDay;
                payOnly.paid = 0;
                payOnly.award = [];
                payOnly.buy = {};
                this.markDirty('activity.pay_only');
            }

            payOnly.paid += cash;
            this.markDirty('activity.pay_only.paid');
        }

        // 积分兑换充值获取积分
        if (isActivityStart(this, 'exchange_points')) {
            var exchangePoints = this.user.activity.exchange_points;
            if (exchangePoints.time < gConfAvExchangePointsTime[1].startTime) {
                exchangePoints.time = gConfAvExchangePointsTime[1].startTime;
                exchangePoints.interval = 0;
                exchangePoints.progress = {};
                exchangePoints.rewards = {};
                this.markDirty('activity.exchange_points');
            }

            var payCash = 'payCash';
            for (var id in gConfAvExchangePointsKey[payCash]) {
                if (cash >= gConfAvExchangePointsId[id].target && !exchangePoints.progress[payCash]) {
                    this.getExchangePointsProgress('payCash', cash);
                }
            }
        }

        //每日特惠
        if (isActivityStart(this, 'day_vouchsafe')) {
            var vouchsafe = this.user.activity.day_vouchsafe;
            if (!vouchsafe || vouchsafe.time != gConfActivities['day_vouchsafe'].startTime) {
                vouchsafe = this.user.activity.day_vouchsafe = {
                    time: gConfActivities['day_vouchsafe'].startTime,
                    day_pay: today,
                    day_money: 0,
                    rewards: [],
                };
            }

            if (vouchsafe.day_pay != today) {
                vouchsafe.day_money = 0;
                vouchsafe.day_pay = today;
            }

            var voupayold = vouchsafe.day_money;
            vouchsafe.day_money += amount;
            if (voupayold < gConfGlobal.vouchmoney && vouchsafe.day_money >= gConfGlobal.vouchmoney) {
                vouchsafe.rewards.push(0);
                this.addTip('day_vouchsafe');
            }
            this.markDirty('activity.day_vouchsafe');
        }

        if (isActivityStart(this, 'sign_high')) {
            sign_high.on_pay(this, cash)
        }

        if (cash > 0) {
            act_month_rebate.on_pay(this, cash);
        }
    },

    onOffline: function (online_time) {
        var user = this.user;
        var now = common.getTime();

        user.mark.online_time += online_time;
        user.mark.total_online_time += online_time;
        this.markDirty('mark.online_time');
        this.markDirty('mark.total_online_time');

        this.stopBossTimer();
    },

    recordPlay: function (type, name, success) {
        var phpReq = {
            uid: this.uid,
            act: 'user_play',
            args: {
                sid: config.DistId,
                openid: this.user.info.account,
                level: this.user.status.level,
                type: type,
                name: name,
                success: success ? success : 1,
            },
        };
        LogCollect(phpReq.uid, phpReq.act, phpReq.args);
        // requestPHP(phpReq, {});
    },

    // 根据功能名查找对应的建筑id
    getBuildingIdWithFunction: function (func_name) {
        for (var cityId in gConfLegionCityBase) {
            var cityInfo = gConfLegionCityBase[cityId];
            for (var i = 1; i <= 4; i++) {
                if (cityInfo['buildFunction' + i] == func_name) {
                    return cityInfo['buildId' + i];
                }
            }
        }

        return 0;
    },

    getBuildingParam: function (func_name) {
        var param = [0];
        return param;
    },

    getBuildingTotalLevel: function () {
        var totalLevel = 0;
        return totalLevel;
    },

    onBuyActionPoint: function () {
        this.user.territory_war.buy_action_count += 1;
        this.markDirty('territory_war.buy_action_count');
    },

    openTerritoryWar: function () {
        if (!this.user.territory_war.open) {
            this.user.mark.action_point_time = common.getTime();
            this.markDirty('mark.action_point_time');

            this.user.territory_war.open = 1;
            this.markDirty('territory_war.open');
        }
    },

    isTerritoryWarOpen: function () {
        if (!this.user.territory_war.open)
            return false;

        return true;
    },

    getMaterialCount: function (materialID) {
        if (isNaN(materialID)) {
            return 0;
        }

        var costType = 'material';
        var user = this.user;
        if (!user.bag[costType]) {
            return 0;
        }

        var curNum = user.bag[costType][materialID];
        if (!curNum) {
            curNum = 0;
        }

        return curNum;
    },

    checkLuckyDragon: function () {
        var conf = gConfAvLuckyDragon[this.user.activity.lucky_dragon.use + 1];
        if (isActivityStart(this, 'lucky_dragon') && conf && this.user.status.cash >= conf.spend) {
            this.addTip('lucky_dragon');
        }
    },


    insertSecKillMonster: function (index) {
        var user = this.user;
        if (!user.territory_war.secKill) {
            user.territory_war.secKill = [];
        }

        if (user.territory_war.secKill.indexOf(index) < 0) {
            user.territory_war.secKill.push(index);
            this.markDirty('territory_war.secKill');
        }
    },

    // 刷新头像框的状态
    updateHeadFrameStatus: function (type, value) {
        var user = this.user;
        if (!user.head_frame_status) {
            user.head_frame_status = {};
            this.markDirty('head_frame_status');
        }

        var tempType = '';

        if (isNaN(+type)) {
            tempType = 'string';
        }
        else {
            tempType = 'number';
            type = +type;
        }

        if (tempType == "number") {
            var conf = gConfHeadFrame[type];
            if (conf) {
                type = conf.condition;
                if (type == 'fight_force_rank' || type == 'arena_rank') {
                    if (value != 0 && value <= conf.value) {
                        if (!user.head_frame_status[conf.id]) {
                            // 激活
                            user.head_frame_status[conf.id] = 1;
                            this.markDirty(util.format('head_frame_status.%d', conf.id));
                        }
                    } else {
                        if (user.head_frame_status[conf.id] == 1) {
                            // 失活
                            user.head_frame_status[conf.id] = 0;
                            this.markDirty(util.format('head_frame_status.%d', conf.id));

                            if (user.info.headframe == conf.id) {
                                user.info.headframe = 30000 + this.getQuality();
                                this.markDirty('info.headframe');
                            }
                        }
                    }
                } else if (type == 'getHero' || type == 'player') {
                    if (value != 0 && value == conf.value) {
                        if (!user.head_frame_status[conf.id]) {
                            // 激活
                            user.head_frame_status[conf.id] = 1;
                            this.markDirty(util.format('head_frame_status.%d', conf.id));
                        }
                    }
                } else {
                    if (value != 0 && value >= conf.value) {

                        if (!user.head_frame_status[conf.id]) {
                            // 激活
                            user.head_frame_status[conf.id] = 1;
                            this.markDirty(util.format('head_frame_status.%d', conf.id));
                        }
                    } else {
                        if (user.head_frame_status[conf.id] == 1) {
                            // 失活
                            user.head_frame_status[conf.id] = 0;
                            this.markDirty(util.format('head_frame_status.%d', conf.id));

                            if (user.info.headframe == conf.id) {
                                user.info.headframe = 30000 + this.getQuality();
                                this.markDirty('info.headframe');
                            }
                        }
                    }
                }
            }
        } else {
            if (type == 'fight_force_rank' || type == 'arena_rank') {
                // 排行榜类型的
                for (var id in gConfHeadFrame) {
                    var conf = gConfHeadFrame[id];
                    if (conf) {
                        if (conf.condition == type) {
                            if (value != 0 && value <= conf.value) {
                                if (!user.head_frame_status[+id]) {
                                    // 激活
                                    user.head_frame_status[+id] = 1;
                                    this.markDirty(util.format('head_frame_status.%d', id));
                                }
                            } else {
                                if (user.head_frame_status[+id] == 1) {
                                    // 失活
                                    user.head_frame_status[+id] = 0;
                                    this.markDirty(util.format('head_frame_status.%d', id));

                                    if (user.info.headframe == id) {
                                        user.info.headframe = 30000 + this.getQuality();
                                        this.markDirty('info.headframe');
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (type == 'getHero' || type == 'player') {
                for (var id in gConfHeadFrame) {
                    var conf = gConfHeadFrame[id];
                    if (conf) {
                        if (conf.condition == type) {
                            if (value != 0 && value == conf.value) {
                                if (!user.head_frame_status[+id]) {
                                    // 激活
                                    user.head_frame_status[+id] = 1;
                                    this.markDirty(util.format('head_frame_status.%d', id));
                                }
                            }
                        }
                    }
                }
            } else {
                for (var id in gConfHeadFrame) {
                    var conf = gConfHeadFrame[id];
                    if (conf) {
                        if (conf.condition == type) {
                            if (value != 0 && value >= conf.value) {
                                if (!user.head_frame_status[+id]) {
                                    // 激活
                                    user.head_frame_status[+id] = 1;
                                    this.markDirty(util.format('head_frame_status.%d', id));
                                }
                            } else {
                                if (user.head_frame_status[+id] == 1) {
                                    // 失活
                                    user.head_frame_status[+id] = 0;
                                    this.markDirty(util.format('head_frame_status.%d', id));

                                    if (user.info.headframe == id) {
                                        user.info.headframe = 30000 + this.getQuality();
                                        this.markDirty('info.headframe');
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    getHeadFrameProgress: function () {
        var progress = {};
        for (var i = 1; i <= Object.keys(gConfHeadFrame).length; i++) {
            var conf = gConfHeadFrame[i];
            if (conf) {
                if (conf.condition == 'user_level') {
                    progress[conf.id] = this.user.status.level;
                } else if (conf.condition == 'player') {
                    progress[conf.id] = this.getQuality();
                } else if (conf.condition == 'vip_level') {
                    progress[conf.id] = this.user.status.vip;
                }
            }
        }

        return progress;
    },

    checkVersion: function () {
        if ((this.user.mark.version || 0) < Upgrade.version) {
            Upgrade.do(this, this.user.mark.version || 0);
        }
    },

    setCountryScore: function (score) {
        var user = this.user;
        user.status.country_score = score;
        this.markDirty('status.country_score');
    },

    getCountrySalaryStartTime: function () {
        // 设置为当天的10点
        var timeStr = gConfGlobalNew['countrySalaryTime'];
        var arr = timeStr.split('-');
        var beginHour = parseInt(arr[0]) - 1;

        var now = new Date();
        now.setHours(beginHour);
        now.setMinutes(0);
        now.setSeconds(0);

        return now.getTime() / 1000;
    },

    // 计算皇城俸禄
    calcCountrySalary: function (oldPosition, newPosition) {
        if (!isModuleOpen_new(this, 'kingMe')) {
            return;
        }

        if (!gConfPosition[oldPosition])
            return;

        var user = this.user;
        var salary = gConfPosition[oldPosition].salary;

        if (newPosition) {
            user.info.position = newPosition;
            this.markDirty('info.position');
        }

        var curDate = new Date();
        var curTime = common.getTime();
        var curHour = curDate.getHours();
        var curDay = curDate.getDate();

        var startCalcTime = this.getCountrySalaryStartTime();
        var lastCalcTime = user.country.update_time;
        if (!lastCalcTime || lastCalcTime < startCalcTime) {
            lastCalcTime = startCalcTime;
            user.country.day_salary = 0;
            user.country.update_time = lastCalcTime;
            this.markDirty('country.day_salary');
            this.markDirty('country.update_time');
        }

        var lastDate = new Date(lastCalcTime * 1000);
        var lastCalcHour = lastDate.getHours();
        var lastCalcDay = lastDate.getDate();

        var timeStr = gConfGlobalNew['countrySalaryTime'];
        var arr = timeStr.split('-');
        var beginHour = parseInt(arr[0]) - 1;
        var endHour = parseInt(arr[1]);

        // 如果上次计算的日期跟现在不是同一天，那今天的开始计算时间就从头开始
        if (lastCalcDay != curDay) {
            lastCalcHour = beginHour;
        }

        if (curHour != lastCalcHour) {
            // 跨点了才需要重新计算
            if ((curHour >= beginHour && curHour < endHour) ||
                (lastCalcHour < endHour && curHour >= endHour)) {
                var calcEndHour = curHour;
                if (calcEndHour > endHour) {
                    calcEndHour = endHour;
                }

                var diffHour = calcEndHour - lastCalcHour;
                if (diffHour > 0) {
                    user.country.day_salary += (salary * diffHour);
                    user.country.update_time = curTime;
                    this.markDirty('country.day_salary');
                    this.markDirty('country.update_time');

                    var reqWorld = {
                        mod: 'user',
                        act: 'update_salary',
                        uid: this.uid,
                        args: {
                            day_salary: user.country.day_salary,
                            update_time: user.country.update_time,
                        },
                    };
                    requestWorld(reqWorld, {});
                }
            }
        }
    },

    // 获取上阵武将数量
    getHeroCount: function () {
        var num = 0;
        var user = this.user;
        for (var p in user.pos) {
            if (user.pos[p].rid) {
                num++;
            }
        }

        return num;
    },

    // 获取掉落间隔
    getAutoFightDropInterval: function () {
        //var onceKillMin = gConfExploreBase['OnceKillMin'].value;
        //var onceKillMax = gConfExploreBase['OnceKillMax'].value;
        //var patrolTime = gConfExploreBase['ExistTime'].value;
        //var restTime = gConfExploreBase['RestTime'].value;

        //var calcInterval = gConfExploreBase['accountInterval'].value;//patrolTime + restTime / (onceKillMin + onceKillMax) * 2;

        //var vip = this.user.status.vip;
        //var exploreBossImprove = gConfVip[vip]['exploreBossImprove'] || 0
        // 四舍五入保留两位有效小数
        var calcInterval = +gConfExploreBase['accountInterval'].value;

        return calcInterval;
    },

    getAutoFightEquipDropInterval: function () {
        var calcInterval = +gConfExploreBase['accountIntervalLoot'].value;
        return calcInterval;
    },

    // 掉落次数
    getAutoFightDropCount: function (speed) {
        var user = this.user;
        var retCount = {
            'equipCount': 0,
            'dropCount': 0,
        };

        var dropTime = this.getAutoFightDropInterval();
        var equipTime = this.getAutoFightEquipDropInterval()

        var diffTime = 0;
        if (speed) {
            // 加速挂机
            diffTime = speed * 3600;
            retCount.dropCount = Math.floor(diffTime / dropTime);
            retCount.equipCount = Math.floor(diffTime / equipTime);
        } else {
            var curTime = common.getTime();
            var storageMaxTime = gConfExploreBase['StorageCubage'].value * 3600;// 存储最大时间

            // dropcount
            var storageExistTime = user.auto_fight.last_calc_time - user.auto_fight.last_get_time;// 已经存储的时间
            if (storageExistTime >= storageMaxTime) { //full
                storageExistTime = storageMaxTime;
            }

            var needCalcTime = curTime - user.auto_fight.last_calc_time;
            if (needCalcTime < 0) {
                needCalcTime = 0;
            }

            diffTime = Math.min(storageMaxTime - storageExistTime, needCalcTime);
            retCount.dropCount = Math.floor(diffTime / dropTime);

            if (diffTime == needCalcTime) { // a little time last
                user.auto_fight.last_calc_time = user.auto_fight.last_calc_time + (retCount.dropCount) * dropTime;
            } else {// full
                user.auto_fight.last_calc_time = curTime;
            }

            this.markDirty('auto_fight.last_calc_time');

            var storageEquipExistTime = user.auto_fight.last_calc_equip_time - user.auto_fight.last_get_equip_time;// equip
            if (storageEquipExistTime >= storageMaxTime) {
                storageEquipExistTime = storageMaxTime;
            }
            var equippassTime = curTime - user.auto_fight.last_calc_equip_time;
            if (equippassTime < 0) {
                equippassTime = 0;
            }

            diffTime = Math.min(storageMaxTime - storageEquipExistTime, equippassTime);
            retCount.equipCount = Math.floor(diffTime / equipTime);

            if (diffTime == equippassTime) { // a little time last
                user.auto_fight.last_calc_equip_time = user.auto_fight.last_calc_equip_time + retCount.equipCount * equipTime;
            } else {// full
                user.auto_fight.last_calc_equip_time = curTime;
            }

            this.markDirty('auto_fight.last_calc_equip_time');
        }

        //ERROR('========exp drop:'+retCount.dropCount);
        //ERROR('========Eequip drop:'+retCount.equipCount);

        return retCount;
    },

    // 获取挂机最大掉落次数
    getAutoFightMaxDropCount: function () {
        var heroCount = this.getHeroCount();   // 上阵武将数量
        if (heroCount == 0) {
            return 0;
        }

        var storageMaxTime = gConfExploreBase['StorageCubage'].value * 3600; // 仓库最大时间
        var calcInterval = this.getAutoFightDropInterval();// 服务器间隔
        var dropCount = Math.floor(storageMaxTime / calcInterval);
        return dropCount;
    },

    //open
    condtionSelect: function (type, value) {
        var user = this.user;
        //ERROR('=========type '+type+'  value0:'+value[0]);
        if (type == 'gameday') {
            var openDay = common.getDateDiff(getGameDate(), getGameDate(gConfGlobalServer.serverStartTime)) + 1;
            if (openDay >= +value[0]) {
                //ERROR('=====true===='+openDay+'  value:'+value[0]);
                return true;
            }
        } else if (type == 'level') {
            if (user.status.level >= +value[0]) {
                //ERROR('=====true==level=='+user.status.level+'  value:'+value[0]);
                return true;
            }
        } else if (type == 'vip') {
            if (user.status.vip >= +value[0]) {
                return true;
            }
        } else if (type == 'activity') {
            if (isActivityStart(this, value[0])) {
                return true;
            }
        } else if (type == 'custom') {
            if (+value[0] < user.battle.type) {
                return true;
            }

            if (+value[0] == user.battle.type && (+value[1] <= user.battle.progress)) {
                return true;
            }
        }

        return false;
    },

    // 计算挂机产出（结算奖励 to bag）
    calcAutoFight: function (speed) {
        if (isModuleOpen_new(this, 'exploreMonster') == false) {
            ERROR("--------calcAutoFight----NO OPEN-------");
            return;
        }

        //var heroCount = this.getHeroCount();   // 上阵武将数量

        var user = this.user;
        var cycle = this.getAutoFightDropCount(speed);
        var dropCount = cycle.dropCount;// * heroCount; // 掉落次数

        var monsterLevel = user.auto_fight.monster_level;
        if (!monsterLevel)
            monsterLevel = 1;

        var monsterConf = gConfExploreMonster[monsterLevel];
        if (!monsterConf) {
            //ERROR("--------calcAutoFight----monsterConf--LV-----"+monsterLevel);
            return;
        }

        var awards = [];
        var battleType = 1;
        var battleProgress = 1;
        if (user.battle.progress == 1) {
            if (user.battle.type == 1) {
                battleProgress = user.battle.progress;
                battleType = user.battle.type
            } else {
                battleType = user.battle.type - 1;
                battleProgress = 150;
            }
        } else {
            battleType = user.battle.type
            battleProgress = user.battle.progress - 1;
        }

        var customConf = gConfCustomSet[battleType][battleProgress];
        if (dropCount > 0) {
            awards.push(['user', 'xp', customConf.singleExp * dropCount]);
            awards.push(['user', 'gold', customConf.singleGold * dropCount]);
            awards.push(['user', 'hero_exp', customConf.singleHeroExp * dropCount]);

            var equipCount = cycle.equipCount;
            if (equipCount > 0) {
                var xyRandomSet = {};
                for (var id in gConfCustomDropPool) {
                    var closeType = gConfCustomDropPool[id].closeType;
                    var closeValue = String(gConfCustomDropPool[id].closeValue).split(',');
                    var openType = gConfCustomDropPool[id].openType;
                    var openValue = String(gConfCustomDropPool[id].openValue).split(',');
                    //ERROR('===================ID:'+id);
                    //ERROR('===================closeValue:'+closeValue);
                    //ERROR('===================openValue:'+openValue);

                    if (!this.condtionSelect(closeType, closeValue) && this.condtionSelect(openType, openValue)) {
                        xyRandomSet[id] = gConfCustomDropPool[id].prob;
                    }
                }

                for (var i = 0; i < equipCount; i++) {
                    // 判断奖励是否激活   
                    for (var indx in xyRandomSet) {
                        var prob = xyRandomSet[indx];
                        if (common.randRange(1, 100000000) < +prob) {
                            //ERROR("=============have=================");
                            awards = awards.concat(gConfCustomDropPool[indx].award);
                        }
                    }
                }
            }


            // 合并同类型的奖励
            awards = reformAwards(awards);


            if (speed) {     // 加速挂机
                var autoFightServer = user.auto_fight_server;
                if (!autoFightServer.speed_count) {
                    autoFightServer.speed_count = 1;
                    this.markDirty('auto_fight_server.speed_count');

                }

                return awards;
            } else {
                user.auto_fight.drop_count += cycle.dropCount;;
                //user.auto_fight.last_calc_time = user.auto_fight.last_calc_time + cycle * this.getAutoFightDropInterval();

                if (user.auto_fight.last_calc_time > common.getTime()) {
                    Error('last_calc_time error');
                }

                this.markDirty('auto_fight.drop_count');
                //this.markDirty('auto_fight.last_calc_time');
                this.addAutoFightAwards(awards);
            }
        }
    },

    // 添加挂机背包
    addAutoFightAwards: function (awards) {
        // awards 格式[[user,gold,100], [material,10,10]], [gem,10,1],
        //  [equip, id, 'grade',1], [card,1,1], [user, cash, 100]

        if (!awards) return false;
        var user = this.user;
        for (var i = 0, max = awards.length; i < max; i++) {
            var award = awards[i];
            if (!award) continue;
            var awardType = award[0];
            var awardId = award[1];

            var awardNum = 0;
            if (awardType == 'equip') {
                if (award.length == 5) {
                    awardNum = Math.floor(+award[award.length - 2]);
                } else {
                    awardNum = Math.floor(+award[award.length - 1]);
                }
            } else {
                awardNum = Math.floor(+award[2]);
            }
            if (isNaN(awardNum) || !awardNum) continue;

            // 目前只处理gold
            if (awardType == 'user' && awardId != 'gold' && awardId != 'xp' && awardId != 'hero_exp') {
                continue;
            }

            if (awardType == 'user') {
                if (awardId == 'gold') {
                    user.auto_fight.bag.gold += awardNum;
                } else if (awardId == 'xp') {
                    user.auto_fight.bag.xp += awardNum;
                } else if (awardId == 'hero_exp') {
                    if (!user.auto_fight.bag.hero_exp) {
                        user.auto_fight.bag.hero_exp = 0;
                    }
                    user.auto_fight.bag.hero_exp += awardNum;
                }
            } else if (awardType == 'group') {
                awardNum = award[3];
                if (!user.auto_fight.bag[awardType]) {
                    user.auto_fight.bag[awardType][awardId] = awardNum;
                } else {
                    user.auto_fight.bag[awardType][awardId] += awardNum;
                }
            } else if (awardType == 'equip') {// by fish
                var grade = award[2];
                if (!user.auto_fight.bag[awardType] || !util.isArray(user.auto_fight.bag[awardType])) {
                    user.auto_fight.bag[awardType] = [];
                } else {
                    user.auto_fight.bag[awardType].push([awardId, grade, awardNum]);
                }
            } else {
                if (!user.auto_fight.bag[awardType][awardId]) {
                    user.auto_fight.bag[awardType][awardId] = awardNum;
                } else {
                    user.auto_fight.bag[awardType][awardId] += awardNum;
                }
            }
        }

        this.markDirty('auto_fight.bag');
    },

    // 拼接挂机背包奖励串
    concatAutoFightAwards: function () {
        var user = this.user;
        var bag = user.auto_fight.bag;
        var awards = [];
        if (bag.gold > 0) {
            awards.push(['user', 'gold', bag.gold]);
        }
        if (bag.xp > 0) {
            awards.push(['user', 'xp', bag.xp]);
        }

        if (bag.hero_exp > 0) {
            awards.push(['user', 'hero_exp', bag.hero_exp]);
        }

        for (var materialId in bag.material) {
            awards.push(['material', parseInt(materialId), parseInt(bag.material[materialId])]);
        }

        for (var gemId in bag.gem) {
            awards.push(['gem', parseInt(gemId), parseInt(bag.gem[gemId])]);
        }

        for (var fragmentId in bag.fragment) {
            awards.push(['fragment', parseInt(fragmentId), parseInt(bag.fragment[fragmentId])]);
        }

        for (var cardId in bag.card) {
            awards.push(['card', parseInt(cardId), parseInt(bag.card[cardId])]);
        }

        var equipcont = bag.equip.length;
        for (var eci = 0; eci < equipcont; eci++) {
            var equipArr = bag.equip[eci];
            var equipId = equipArr[0];
            var equipGrade = equipArr[1];
            var equipNum = equipArr[2];

            awards.push(['equip', parseInt(equipId), parseInt(equipGrade), equipNum]);
        }

        for (var groupId in bag.group) {
            for (var i = 0; i < bag.group[groupId]; i++) {
                // var itemGroupConf = gConfItemGroupConfig[groupId];

                var tGroupItemWeightInfo = getGroupItemWeightInfo(gConfItemGroupConfig[groupId], this);
                var itemGroupConf = tGroupItemWeightInfo.itemGroupConf;
                var totalOdds = tGroupItemWeightInfo.totalOdds;
                if (!itemGroupConf) continue;

                // var totalOdds = 0;
                // for (var j in itemGroupConf) {
                //     totalOdds += itemGroupConf[j].weight;
                // }

                // 随机出一个奖励
                var awardIndex = 0;
                var rangeOdd = 0;
                var flag = 1; // 随机出一个奖励，json不能break
                var randOdd = common.randRange(0, totalOdds);
                for (var j in itemGroupConf) {
                    if (flag) {
                        rangeOdd += itemGroupConf[j].weight;
                        if (randOdd < rangeOdd) {
                            awardIndex = j;
                            flag = 0;
                            break;
                        }
                    }
                }

                var award = '';
                try {
                    award = itemGroupConf[awardIndex].award[0];
                } catch (e) {
                    award = ''
                }
                if (award) {
                    var awardType = award[0];
                    var awardId = award[1];
                    var awardNum = parseInt(award[2]);

                    awards.push([awardType, awardId, awardNum]);
                }
            }
        }

        // 合并奖励
        awards = reformAwards(awards);

        return awards;
    },

    // 清理挂机背包
    clearAutoFightBag: function () {
        var bag = this.user.auto_fight.bag;
        var user = this.user;

        bag.gold = 0;
        bag.xp = 0;
        bag.hero_exp = 0;

        bag.material = {};
        bag.gem = {};
        bag.fragment = {};
        bag.card = {};
        bag.equip = {};
        bag.group = {};

        /*
        var maxDropCount = this.getAutoFightMaxDropCount();// 最大掉落次数
        var existDropCount = this.user.auto_fight.drop_count;// 掉落次数

        DEBUG('clearAutoFightBag maxDropCount = ' + maxDropCount + ', existDropCount = ' + existDropCount);
        if (existDropCount >= maxDropCount) {
            // 满了，领完之后重新开始计时
            user.auto_fight.last_calc_time = common.getTime();
            user.auto_fight.last_get_time  = common.getTime();
        } else {
            // 没满，只需要更新领取时间
            user.auto_fight.last_get_time = user.auto_fight.last_get_time + existDropCount * this.getAutoFightDropInterval();

            if (common.getTime() > user.auto_fight.last_get_time + this.getAutoFightDropInterval()) {
                user.auto_fight.last_get_time = common.getTime();
            }
        }*/

        user.auto_fight.drop_count = 0;
        user.auto_fight.speed_time = 0;// 领取奖励，加速卡清0

        user.auto_fight.last_get_time = user.auto_fight.last_calc_time;
        user.auto_fight.last_get_equip_time = user.auto_fight.last_calc_equip_time;

        this.markDirty('auto_fight.bag');
        this.markDirty('auto_fight.last_get_equip_time');
        this.markDirty('auto_fight.last_get_time');
        this.markDirty('auto_fight.drop_count');
    },

    // 升级小怪等级
    upgradeMonsterLevel: function () {
        var user = this.user;
        var maxLevel = Object.keys(gConfExploreMonster).length;
        if (user.auto_fight.monster_level >= maxLevel)
            return;

        user.auto_fight.monster_level += 1;
        this.markDirty('auto_fight.monster_level');
    },

    // 获取玩家武将信息
    getHero: function (hid) {
        var heros = this.user.hero_bag.heros;
        var heroMsg = heros[hid];
        if (!heroMsg) {
            return false;
        }

        return heroMsg;
    },

    getHeroStar: function (hid) {
        var heros = this.user.hero_bag.heros;
        var theHero = heros[hid];
        if (!theHero) { return 0; }

        var heroConf = gConfHero[theHero.rid];
        if (!heroConf) { return 0; }

        var heroTemplateId = heroConf.heroTemplateId;     // hero模板id
        if (theHero.awake > 4) {
            heroTemplateId = heroConf.templatedIdUltimate;
        }
        // 模板類型
        var starBase = gConfCombatHeroTemplate[heroTemplateId]['starBase'];
        return (starBase + theHero.awake - 1);
    },

    // 获得卡牌回调
    onCardGetOneCallback: function (id, newIndex) {
        if (!this.user.cardGetRecord) {
            this.user.cardGetRecord = {};
            this.markDirty("cardGetRecord");
        }

        var star = this.getHeroStar(newIndex);
        //ERROR('doTask========IN ADD HERO:'+newIndex);
        this.doTask('roleQuality', 1, star);
        this.doOpenSeven('roleQuality', 1, star);
        this.doOpenHoliday('roleQuality', 1, star);

        if (this.user.cardGetRecord[id] == null) {
            this.user.cardGetRecord[id] = 0;
        }

        this.user.cardGetRecord[id] += 1;
        this.markDirty(util.format("cardGetRecord.%d", id));

        this.checkFateMap(id);

        this.updateHeadFrameStatus('getHero', id);
    },

    // 获得装备回调
    onEquipGetCallback: function (id, num) {
        if (!this.user.equipGetRecord) {
            this.user.equipGetRecord = {};
            this.markDirty("equipGetRecord");
        }

        if (this.user.equipGetRecord[id] == null) {
            this.user.equipGetRecord[id] = 0;
        }

        this.user.equipGetRecord[id] += num;
        this.markDirty(util.format("equipGetRecord.%d", id));
    },

    // 符文获取回调
    onRuneGetCallback: function (id, num) {
        if (!this.user.runeGetRecord) {
            this.user.runeGetRecord = {};
            this.markDirty("runeGetRecord");
        }

        if (this.user.runeGetRecord[id] == null) {
            this.user.runeGetRecord[id] = 0;
        }

        this.user.runeGetRecord[id] += num;
        this.markDirty(util.format("runeGetRecord.%d", id));
    },

    onKeyGetCallback: function (id, num) {
        if (!this.user.keyGetRecord) {
            this.user.keyGetRecord = {};
            this.markDirty("keyGetRecord");
        }

        if (this.user.keyGetRecord[id] == null) {
            this.user.keyGetRecord[id] = 0;
        }

        this.user.keyGetRecord[id] += num;
        this.markDirty(util.format("keyGetRecord.%d", id));
    },

    hasGetKey: function (id) {
        if (!this.user.keyGetRecord) {
            return false;
        }

        if (this.user.keyGetRecord[id] == null) {
            return false;
        }

        if (this.user.keyGetRecord[id] == 0) {
            return false;
        }

        return true;
    },

    // 重置酒馆奖励数据
    resetTavernAwards: function (type) {
        var user = this.user;

        for (var n = 1; n <= Object.keys(gConfTavern).length; n++) {
            if (type && n != type) {
                continue;
            }

            var existLength = 0;
            if (user.tavern_server.award_tab[n]) {
                existLength = Object.keys(user.tavern_server.award_tab[n]);
            }

            if (n == 1 && existLength > 0 && user.tavern_server.normal_version == gConfVersion.tarvenNormalCycle.version) {
                // 版本号一样，不重置
                continue;
            }

            if (n == 2 && existLength > 0 && user.tavern_server.advanced_version == gConfVersion.tarvenAdvancedCycle.version) {
                continue;
            }

            user.tavern_server.award_tab[n] = {};

            var lootTypes = [];
            var maxCycle = 0;
            for (var i = 1; i <= 3; i++) {
                var lootType = gConfTavern[n]['lootType' + i];
                var obj = {};

                obj.type = i;   // 类型
                obj.begin = lootType[0]; // 起始索引
                obj.cycle = lootType[1]; // 周期
                obj.count = lootType[2]; // 次数

                if (obj.cycle > maxCycle) {
                    maxCycle = obj.cycle;
                }

                lootTypes.push(obj);
            }

            user.tavern_server.max_cycle[n] = maxCycle;
            this.markDirty('tavern_server.max_cycle');

            var indexArr = [];
            for (var i = 0; i < maxCycle; i++) {
                indexArr[i] = i;
            }

            if (user.tavern.call_count[n] == 0) {
                // 首次招募
                if (n == 1) {
                    // 普通招募
                    user.tavern_server.award_tab[n][0] = gConfSpecialReward.normal_tavern_first.reward;
                } else if (n == 2) {
                    // 高级招募
                    user.tavern_server.award_tab[n][0] = gConfSpecialReward.high_tavern_first.reward;
                }

                indexArr.remove(0);
            }

            // 插入10连抽特殊奖励
            if (gConfTavern[n].specialNeed > 0) {
                var removeVals = [];
                for (var i = 0; i < maxCycle; i++) {
                    if ((indexArr[i] + 1) % gConfTavern[n].specialNeed == 0) {
                        user.tavern_server.award_tab[n][indexArr[i]] = 0; // 0表示特殊奖励
                        removeVals.push(indexArr[i]);
                    }
                }

                for (var j = 0; j < removeVals.length; j++) {
                    indexArr.remove(removeVals[j]);
                }
            }

            for (var i = 0; i < lootTypes.length; i++) {
                var repeatCount = Math.floor(maxCycle / lootTypes[i].cycle);
                var removeVals = [];
                for (var j = 0; j < repeatCount; j++) {
                    var startIndex = lootTypes[i].begin + lootTypes[i].cycle * j;
                    var endIndex = (j + 1) * lootTypes[i].cycle;

                    // 筛选出符合起始索引和结束索引的索引
                    var fitIndexArr = [];
                    for (var k = 0; k < indexArr.length; k++) {
                        if (indexArr[k] >= startIndex && indexArr[k] <= endIndex) {
                            fitIndexArr.push(indexArr[k]);
                        }
                    }

                    // 随机出指定数量的索引
                    for (var k = 0; k < lootTypes[i].count; k++) {
                        if (fitIndexArr.length > 0) {
                            var randIndex = common.randRange(0, fitIndexArr.length - 1);
                            var val = fitIndexArr[randIndex];
                            if (user.tavern_server.award_tab[n][val] == 0) {
                                Error(util.format('#### award_tab[%d][%d] has value', n, val));
                            }
                            user.tavern_server.award_tab[n][val] = lootTypes[i].type;
                            fitIndexArr.remove(val);
                            removeVals.push(val);
                        }
                    }
                }

                // 从全局索引里面移除随机到的值
                for (var j = 0; j < removeVals.length; j++) {
                    indexArr.remove(removeVals[j]);
                }
            }
        }

        user.tavern_server.normal_version = gConfVersion.tarvenNormalCycle.version;
        user.tavern_server.advanced_version = gConfVersion.tarvenAdvancedCycle.version;

        this.markDirty('tavern_server.award_tab');
        this.markDirty('tavern_server.normal_version');
        this.markDirty('tavern_server.advanced_version');
    },

    // 重置酒馆兑换数据
    resetTavernCards: function () {

        var user = this.user;
        if (Object.keys(user.tavern_server.card_tab).length == 0) {
            // 首次，直接读global
            var tavernExchangeSpecialList = gConfGlobalNew.tavernExchangeSpecialList;
            var arr = tavernExchangeSpecialList.split('|');
            for (var i = 0; i < arr.length; i++) {
                var length = Object.keys(user.tavern_server.card_tab).length;
                user.tavern_server.card_tab[length] = {};
                user.tavern_server.card_tab[length].id = parseInt(arr[i]);
                //ERROR('=================='+arr[i]);
                var awards = parseGroupAwards(gConfTavernLimitHero[parseInt(arr[i])].heroGroup[0], this);
                user.tavern_server.card_tab[length].awards = awards;
            }
        } else {
            var totalCount = 0;
            user.tavern_server.card_tab = {};   // 清空
            var cardArr = [];
            for (var i = 1; i <= Object.keys(gConfTavernLimitHero).length; i++) {
                totalCount += gConfTavernLimitHero[i].cycleManner;

                for (var j = 0; j < gConfTavernLimitHero[i].cycleManner; j++) {
                    cardArr.push(i);
                }
            }

            for (var i = 0; i < totalCount; i++) {
                var randIndex = common.randRange(0, cardArr.length - 1);
                var val = cardArr[randIndex];
                var length = Object.keys(user.tavern_server.card_tab).length;
                user.tavern_server.card_tab[length] = {};
                user.tavern_server.card_tab[length].id = val;
                var awards = parseGroupAwards(gConfTavernLimitHero[val].heroGroup[0], this);
                user.tavern_server.card_tab[length].awards = awards;
                cardArr.remove(val);
            }
        }

        this.markDirty('tavern_server.card_tab');

        if (user.tavern.hero_refresh_time == 0) {
            user.tavern.hero_refresh_time = common.getTime();
            this.markDirty('tavern.hero_refresh_time');
        }

        user.tavern_server.hero_version = gConfVersion.tarvenRefreshCycle.version;
        this.markDirty('tavern_server.hero_version');
    },

    // 获取当前酒馆奖励
    getTavernAwards: function (type) {
        var user = this.user;
        if (!user.tavern_server.award_tab[type]) {
            return null;
        }

        var realCount = user.tavern.call_count[type];
        if (realCount == 0) {
            var awards = user.tavern_server.award_tab[type][0];
            return awards;
        } else {
            var awards = [];
            var count = realCount % user.tavern_server.max_cycle[type];
            var lootType = user.tavern_server.award_tab[type][count];
            //DEBUG('count = ' + count + ', lootType = ' + String(lootType));
            if (!lootType) {
                if (lootType == 0) {
                    // 特殊掉落
                    awards = gConfTavern[type].specialAward;
                } else {
                    // 默认掉落
                    awards = gConfTavern[type].cycleBasicAward1;
                }
            } else {
                awards = gConfTavern[type]['cycleAward' + lootType]; //user.tavern_server.award_tab[type][count];
            }

            if ((realCount + 1) % user.tavern_server.max_cycle[type] == 0) {
                // 需要重置了
                this.resetTavernAwards(type);
            }

            if (type == 2 && realCount < 10) {
                // 前十次高级招募不能出现法老
                if (awards[0][0] == 'group' && parseInt(awards[0][1]) == 10000012) {
                    var replaceAwards = clone(awards);
                    replaceAwards[0][1] = 10000016;
                    awards = replaceAwards;
                    DEBUG('#### release group 10000012 with 10000016 #####');
                }
            }
            return awards;
        }
    },

    // 获取当前酒馆兑换的卡片
    getTavernCard: function () {
        var user = this.user;
        var freshCount = user.tavern_server.hero_fresh_count;
        DEBUG('call getTavernCard: freshCount = ' + freshCount);
        if (user.tavern_server.card_tab[freshCount])
            return user.tavern_server.card_tab[freshCount].awards;

        return [];
    },

    getTavernCardObj: function () {
        var user = this.user;
        var freshCount = user.tavern_server.hero_fresh_count;
        if (!user.tavern_server.card_tab[freshCount]) {
            DEBUG('call getTavernCardObj : freshCount = ' + freshCount);
            DEBUG(user.tavern_server.card_tab);
        }

        return user.tavern_server.card_tab[freshCount];
    },

    getTavernCardLength: function () {
        var user = this.user;
        return Object.keys(user.tavern_server.card_tab).length;
    },

    onTavernTimeout: function () {
        var user = this.user;
        user.tavern_server.hero_fresh_count++;
        var length = this.getTavernCardLength();
        if (user.tavern_server.hero_fresh_count >= length) {
            // 需要重新生成兑换数据了
            this.resetTavernCards();

            // 刷新次数清0
            user.tavern_server.hero_fresh_count = 0;
        }
        this.markDirty('tavern_server.hero_fresh_count');

        var awards = this.getTavernCard();
        user.tavern.exchange_hid = parseInt(awards[0][1]);
        this.markDirty('tavern.exchange_hid');

        user.tavern.hero_refresh_time = common.getTime();
        this.markDirty('tavern.hero_refresh_time');

        // 重新开个定时器
        var timeout = gConfGlobalNew.tavernExchangeRefreshInterval * 3600; // 刷新周期
        var _me = this;
        setTimeout(function () {
            _me.onTavernTimeout();
        }, timeout * 1000);
    },

    // 登录回调
    onPlayerLogin: function () {
        var user = this.user;
        this.updateVip();

        this.updateCustomKing();
        var tMaxQuality = this.getQuality();
        for (var i = 1; i <= tMaxQuality; i++) {
            this.updateHeadFrameStatus('player', i);
        }
        this.updateCustomDragon();

        var team1 = user ? user.team[1] : {};
        for (var hid in team1) {
            if (!team1[hid]) { continue; }
            team1[hid] = team1[hid] - 0;
        }

        if (user.hero_bag.reset_gem_time != "20200525") {
            user.hero_bag.reset_gem_time = "20200525";

            var costs = [];
            for (var tKey in user.hero_bag.heros) {
                var posObj = user.hero_bag.heros[tKey];
                if (!posObj.part) { continue; }
                for (var part_pos in posObj.part) {
                    if (!posObj.part[part_pos]) { continue; }
                    var tGems = posObj.part[part_pos].gems || [];
                    // for (var gem_index = 0; gem_index < tGems.length; gem_index++) {
                    for (var gem_index in tGems) {
                        if (tGems[gem_index] == 0) { continue; }

                        costs.push(['gem', tGems[gem_index], 1]);                    // 卸下原来的宝石
                        tGems[gem_index] = 0;

                        this.markDirty(`hero_bag.heros.${tKey}.part`);
                    }
                }
            }
            this.markDirty(`hero_bag.reset_gem_time`);
            if (costs.length > 0) {
                this.addAwards(costs, "player", "reset_all_part_gems");
            }
        }

        var curTime = common.getTime();

        if (Object.keys(user.tavern_server.award_tab).length == 0 ||
            user.tavern_server.normal_version != gConfVersion.tarvenNormalCycle.version ||
            user.tavern_server.advanced_version != gConfVersion.tarvenAdvancedCycle.version) {
            this.resetTavernAwards();
        }

        // 检查英雄兑换是否需要刷新
        var refreshCycle = gConfGlobalNew.tavernExchangeRefreshInterval * 3600; // 刷新周期
        var passTime = curTime - user.tavern.hero_refresh_time;
        var remainTime = refreshCycle - passTime;
        var needRefresh = false;
        if (passTime >= refreshCycle || Object.keys(user.tavern_server.card_tab).length == 0) {
            // 需要刷新了
            var refreshCount = Math.floor(passTime / refreshCycle);
            remainTime = gConfGlobalNew.tavernExchangeRefreshInterval * 3600;

            this.resetTavernCards();
            user.tavern_server.hero_fresh_count += refreshCount;

            var length = this.getTavernCardLength();
            DEBUG('length = ' + length);
            if (user.tavern_server.hero_fresh_count >= length) {
                user.tavern_server.hero_fresh_count = user.tavern_server.hero_fresh_count % length;
            }

            this.markDirty('tavern_server.hero_fresh_count');
            needRefresh = true;
        }

        if (!user.tavern.exchange_hid || needRefresh) {
            var awards = this.getTavernCard();
            if (awards.length > 0) {
                user.tavern.exchange_hid = parseInt(awards[0][1]);
            }

            user.tavern.hero_refresh_time = curTime;
            this.markDirty('tavern.exchange_hid');
            this.markDirty('tavern.hero_refresh_time');
        }

        if (!user.tavern_server.hero_version) {
            user.tavern_server.hero_version = gConfVersion.tarvenRefreshCycle.version;
            this.markDirty('tavern_server.hero_version');
        }

        if (!user.tavern_server.normal_version) {
            user.tavern_server.normal_version = gConfVersion.tarvenNormalCycle.version;
            this.markDirty('tavern_server.normal_version');
        }

        if (!user.tavern_server.advanced_version) {
            user.tavern_server.advanced_version = gConfVersion.tarvenAdvancedCycle.version;
            this.markDirty('tavern_server.advanced_version');
        }

        if (remainTime > 0) {
            var _me = this;
            setTimeout(function () {
                _me.onTavernTimeout();
            }, remainTime * 1000);
        }

        // 符文刷新
        if (user.tower_server.rune_drop_tab.length == 0 || Object.keys(user.tower_server.rune_drop_tab).length == 0 ||
            user.tower_server.rune_box_conf_version != gConfVersion.runeBoxCycle.version ||
            user.tower_server.rune_drop_count >= user.tower_server.rune_drop_tab.length) {
            this.resetRuneDropTab();
        }

        // 设置boss定时器
        if (isModuleOpen_new(this, 'exploreBoss')) {
            this.resetBossTimer();
        }

        if (user.new_legion) {
            // 初始化军团篝火特殊奖励
            if (user.new_legion.wood.special.length == 0) {
                var woodOpt = gConfGlobalNew.legionBonfire_operate1.split('|');
                user.new_legion.wood.special = this.initBonFireSpecial(woodOpt);
                this.markDirty('new_legion.wood.special');
            }

            if (user.new_legion.fire.special.length == 0) {
                var fireOpt = gConfGlobalNew.legionBonfire_operate2.split('|');
                user.new_legion.fire.special = this.initBonFireSpecial(fireOpt);
                this.markDirty('new_legion.fire.special');
            }
        }

        // 新手邮件
        this.sendNewUserMail();

        this.handleEquipError();
        this.handleTowerError();

        this.updateHeadFrameStatus('player', this.getQuality());

        if (user.status.headframe == 0) {
            user.status.headframe = 30000 + this.getQuality();
            this.markDirty('status.headframe');
        }

        user.status.legionwarscore = user.status.legionwarscore || 0;
        this.markDirty('status.status.legionwarscore');

        if (!("count_cross" in user.arena)) {
            user.arena.count_cross = 5;
            this.markDirty('status.arena.count_cross');
        }
    },

    // 临时处理装备错误
    handleEquipError: function () {
        return 0;

        var user = this.user;
        var equips = user.bag.equip;
        for (var eid in equips) {
            var equipObj = equips[eid];
            if (equipObj && equipObj.pos > 0) {
                // 检查该英雄身上是否有该件装备
                var posObj = user.pos[equipObj.hid];
                var equipType = gConfEquip[equipObj.id].type;
                if (posObj.equip[equipType] == 0) {
                    equipObj.pos = 0;
                    this.markDirty(util.format('bag.equip.%d.pos', eid));
                }
            }
        }
    },

    handleTowerError: function () {
        var user = this.user;
        var tower = user.tower;
        if (tower.top_floor < tower.cur_floor) {
            tower.cur_floor = tower.top_floor;
            this.markDirty('tower.cur_floor');
        }
    },

    // 初始化黑森林探索
    initAutoFight: function () {
        // 判断挂机模块是否开启
        if (isModuleOpen_new(this, 'exploreMonster') &&
            this.user.auto_fight.last_calc_time == 0 &&
            this.user.auto_fight.last_get_time == 0) {
            this.user.auto_fight.last_calc_time = common.getTime();
            this.user.auto_fight.last_get_time = common.getTime();
            this.markDirty('auto_fight.last_calc_time');
            this.markDirty('auto_fight.last_get_equip_time');

            this.user.auto_fight.last_calc_equip_time = common.getTime();
            this.user.auto_fight.last_get_equip_time = common.getTime();
            this.markDirty('auto_fight.last_calc_equip_time');
            this.markDirty('auto_fight.last_get_equip_time');
        }

        // 黑森林boss
        if (isModuleOpen_new(this, 'exploreBoss')) {
            this.initBoss();
        }

        // 黑森林任务
        if (isModuleOpen_new(this, 'exploreTask')) {
            this.initTask();
        }
    },

    getBossBirthInterval: function () {
        return gConfExploreBase.bossBornInterval.value * 3600;
    },

    // 补齐boss
    generateBoss: function () {
        var auto_fight = this.user.auto_fight;
        var autoFightServer = this.user.auto_fight_server;

        var addCount = 0;
        var birthCount = 1;
        if (autoFightServer.boss_birth_sequence.length <= gConfExploreBase.bossSysAmountLmint.value) {
            // 首次要生成3只
            birthCount = autoFightServer.boss_birth_sequence.length;
        }

        // 计算一下当前时间减去上次boss刷新时间够刷几只
        var bossCount = 0;
        var curTime = common.getTime();
        if (autoFightServer.boss_last_birth_time > 0) {
            var passTime = curTime - autoFightServer.boss_last_birth_time;
            bossCount = Math.floor(passTime / this.getBossBirthInterval());
            if (bossCount > birthCount) {
                birthCount = bossCount;
            }
        }

        if (birthCount > gConfExploreBase.bossSysAmountLmint.value) {
            birthCount = gConfExploreBase.bossSysAmountLmint.value;
            DEBUG('in player generateBoss birthCount is too big, please careful!');
        }

        for (var i = 0; i < birthCount; i++) {
            var newBoss = this.getNewBoss();
            if (newBoss) {
                var bossObj = {};
                bossObj.type = newBoss[0];
                bossObj.path_id = newBoss[1];
                bossObj.click = 0;

                if (autoFightServer.boss_kill_count == 0 && auto_fight.boss.boss_birth.length == 0) {
                    // 这是第一只
                    bossObj.is_first = 1;
                }
                auto_fight.boss.boss_birth.push(bossObj);
                this.markDirty('auto_fight.boss.boss_birth');

                addCount++;
            }
        }

        if (addCount > 0) {
            if (autoFightServer.boss_last_birth_time == 0) {
                autoFightServer.boss_last_birth_time = curTime;
            } else {
                autoFightServer.boss_last_birth_time = autoFightServer.boss_last_birth_time + addCount * this.getBossBirthInterval();
                if (curTime > autoFightServer.boss_last_birth_time + this.getBossBirthInterval()) {
                    autoFightServer.boss_last_birth_time = curTime;
                }
            }

            this.markDirty('auto_fight_server.boss_last_birth_time');
        } else {
            // 已经满了，不需要再生成，那把上次刷新时间更新下
            if (autoFightServer.boss_last_birth_time == 0) {
                autoFightServer.boss_last_birth_time = curTime;
            } else {
                if (autoFightServer.boss_last_birth_time == NaN || !autoFightServer.boss_last_birth_time) {
                    autoFightServer.boss_last_birth_time = curTime;
                } else {
                    autoFightServer.boss_last_birth_time = autoFightServer.boss_last_birth_time + bossCount * this.getBossBirthInterval();
                    if (curTime > autoFightServer.boss_last_birth_time + this.getBossBirthInterval()) {
                        autoFightServer.boss_last_birth_time = curTime;
                    }
                }
            }

            this.markDirty('auto_fight_server.boss_last_birth_time');
        }

        if (addCount > 0) {
            pushToUser(this.uid, 'self', {
                mod: 'auto_fight',
                act: 'boss_birth',
                boss_birth: auto_fight.boss.boss_birth,
            });
        }

        this.resetBossTimer();

        return addCount;
    },

    // 生成特殊掉落
    generateBossSpecialAward: function () {
        for (var type in gConfExploreBoss) {
            this.generateBossSpecialAwardByType(type);
        }
    },

    generateBossSpecialAwardByType: function (type) {
        var autoFightServer = this.user.auto_fight_server;
        if (!autoFightServer.boss_special_award_index[type - 1]) {
            var conf = gConfExploreBoss[type];
            var startIndex = conf.specialLootFrequency[0] - 1;
            var endIndex = conf.specialLootFrequency[1] - 1;
            var randIndex = common.randRange(startIndex, endIndex);
            autoFightServer.boss_special_award_index[type - 1] = randIndex;
            this.markDirty('auto_fight_server.boss_special_award_index');
        }
    },

    // 是否要特殊掉落
    hasBossSpecialAward: function (bossType) {
        var autoFight = this.user.auto_fight;
        var autoFightServer = this.user.auto_fight_server;
        var bossConf = gConfExploreBoss[bossType];
        var cycle = bossConf.specialLootFrequency[1];
        var curIndex = autoFight.boss.boss_kill_count[bossType] % cycle;
        if (curIndex == autoFightServer.boss_special_award_index[bossType - 1]) {
            return true;
        }

        return false;
    },

    // 重置指定boss特殊掉落
    resetBossSpecialAwardByType: function (type) {
        var autoFightServer = this.user.auto_fight_server;
        autoFightServer.boss_special_award_index[type - 1] = 0;
        this.generateBossSpecialAwardByType(type);
    },

    // 随机一个boss
    getNewBoss: function () {
        var auto_fight = this.user.auto_fight;
        var autoFightServer = this.user.auto_fight_server;

        // 判断是否要重置boss序列
        if (autoFightServer.boss_create_count >= autoFightServer.boss_birth_sequence.length) {
            this.resetBossSequence();
        }

        var index = autoFightServer.boss_create_count;
        var bossType = autoFightServer.boss_birth_sequence[index];

        // 获取已经存在的路点
        var existPathIds = [];
        for (var i = 0; i < auto_fight.boss.boss_birth.length; i++) {
            existPathIds.push(auto_fight.boss.boss_birth[i].path_id);
        }

        var newPathId = loginCommon.getRandomPathId(existPathIds);
        if (newPathId == 0) {
            return null;
        }

        autoFightServer.boss_create_count++;
        this.markDirty('auto_fight_server.boss_create_count');

        return [bossType, newPathId];
    },

    setBossTimer: function () {
        //var auto_fight = this.user.auto_fight;
        var autoFightServer = this.user.auto_fight_server;

        var curTime = common.getTime();
        var remainTime = autoFightServer.boss_last_birth_time + this.getBossBirthInterval() - curTime;
        if (remainTime > this.getBossBirthInterval()) {
            remainTime = this.getBossBirthInterval();
        }

        if (remainTime > 0) {
            var player = this;
            this.bossTimer = setTimeout(function () {
                player.generateBoss();
            }, remainTime * 1000);
        } else {
            this.generateBoss();
        }
    },

    stopBossTimer: function () {
        if (this.bossTimer) {
            clearTimeout(this.bossTimer);
            this.bossTimer = null;
        }
    },

    // 重置boss刷新定时器
    resetBossTimer: function () {
        this.stopBossTimer();
        this.setBossTimer();
    },

    // 生成boss序列
    resetBossSequence: function () {
        var autoFightServer = this.user.auto_fight_server;

        autoFightServer.boss_birth_sequence = [];
        autoFightServer.boss_create_count = 0;

        var totalCount = 0
        var indexArr = [];
        for (var k in gConfExploreBoss) {
            var bossConf = gConfExploreBoss[k];
            totalCount += bossConf.bossFrequency;
        }

        for (var i = 0; i < totalCount; i++) {
            indexArr[i] = i;
            autoFightServer.boss_birth_sequence[i] = 0;
        }

        for (var k in gConfExploreBoss) {
            var bossConf = gConfExploreBoss[k];
            for (var i = 0; i < bossConf.bossFrequency; i++) {
                if (indexArr.length > 0) {
                    var rand = common.randRange(0, indexArr.length - 1);
                    var index = indexArr[rand];

                    autoFightServer.boss_birth_sequence[index] = k;
                    indexArr.splice(rand, 1);
                }
            }
        }

        this.markDirty('auto_fight_server.boss_birth_sequence');
        this.markDirty('auto_fight_server.boss_create_count');
    },

    // 初始化boss
    initBoss: function () {
        var autoFightServer = this.user.auto_fight_server;

        // 如果还没初始化过，或者已经过了一轮了，需要重新随机
        if (autoFightServer.boss_birth_sequence.length == 0) {

            autoFightServer.boss_birth_sequence = [];
            autoFightServer.boss_create_count = 0;

            var initSeq = gConfGlobalNew.exploreBossInit.split('|');
            for (var i = 0; i < initSeq.length; i++) {
                autoFightServer.boss_birth_sequence.push(parseInt(initSeq[i]));
            }

            this.markDirty('auto_fight_server.boss_birth_sequence');
            this.markDirty('auto_fight_server.boss_create_count');
        }

        if (autoFightServer.boss_create_count >= autoFightServer.boss_birth_sequence.length) {
            this.resetBossSequence();
        }

        if (autoFightServer.boss_last_birth_time == 0) {
            this.generateBoss();
        }

        this.generateBossSpecialAward();
    },

    // 初始化任务
    initTask: function () {
        var player = this;
        var user = player.user;
        var search_task = user.auto_fight.search_task;
        var task_list = search_task.task_list;
        if (search_task.first_come) {// 首次进入 刷两个任务
            search_task.first_come = 0;
            // 随机出来的任务
            var task1 = loginCommon.createTask(user.status.level);
            var task2 = loginCommon.createTask(user.status.level);
            task_list[task1[1]] = task1[0];
            task_list[task2[1]] = task2[0];

            search_task.task_list = task_list;
            player.markDirty('auto_fight.search_task.task_list');
            player.markDirty('auto_fight.search_task.first_come');
        } else {
            var index = 0;
            for (var i in task_list) {
                index += 1;
            }
            if (index < 2) {
                var task = loginCommon.createTask(user.status.level);
                task_list[task[1]] = task[0];
                player.markDirty('auto_fight.search_task.task_list');
            }
        }
    },

    // 初始化山洞
    initCave: function () {
        if (!isModuleOpen_new(this, 'customcave')) {
            return;
        }

        var user = this.user;
        if (user.cave.level <= 0) {
            user.cave.level = user.status.level;
            this.markDirty('status.level');
        }

        // 初始化超级宝箱
        var keepTime = gConfGlobalNew.customCaveSuperBoxLife * 60 * 60;    // 宝箱存在时间
        if (user.cave.put_shard_time && common.getTime() - user.cave.put_shard_time > keepTime) { // 宝箱开启时间到
            user.cave.put_shard_time = 0;
            user.cave.shard = { '1': 0, '2': 0, '3': 0, '4': 0 };
            user.cave.super_box_mar = 0;
            this.markDirty('cave.put_shard_time');
            this.markDirty('cave.super_box_mar');
            this.markDirty('cave.shard');
        }

        // 骰子恢复
        var judge = loginCommon.judgeStartTime(user.cave.start_reply_time);
        judge.newTime && (user.cave.start_reply_time = judge.newTime);

        var leftNum = user.cave.left_num;
        leftNum += judge.addDiceNum;
        if (leftNum >= gConfGlobalNew.customCaveDiceNumLimit) {
            leftNum = gConfGlobalNew.customCaveDiceNumLimit;
            user.cave.start_reply_time = 0;
        }

        user.cave.left_num = leftNum;
        this.markDirty('cave.left_num');
        this.markDirty('cave.start_reply_time');

    },

    // 宝物获得
    onTreasureGet: function (id) {
        var user = this.user;
        if (user.custom_treasure.indexOf(id) >= 0) {
            return;
        }

        user.custom_treasure.push(id);
        this.markDirty('custom_treasure');

        this.doGuideTask('king_treasure', id);
        this.getFateMap();
        // 判断是否有属性改变
        this.markFightForceChangedAll();

        // 在线奖励通知
        outline_sync_to_client(this);
    },

    // 解救村庄
    onVillageRelease: function (id) {
        var user = this.user;
        if (user.custom_village.indexOf(id) >= 0) {
            return;
        }

        user.custom_village.push(id);
        this.markDirty('custom_village');

        // 引导任务
        this.doGuideTask('villageOpen', id);

        // 判断魔法阵开启
        /*
        var magicRate = calcMagicRate(user.status.vip, user.payment.long_card, user.payment.month_card, user.payment.week_card);
        var curTime = common.getTime();

        for (var k in gConfExploreMagic) {
            var extra = calcMagicRateExtra(k, user.auto_fight.magic);
            var confData = gConfExploreMagic[k];
            var awardTimeLimit = parseInt(86400 / (confData.base * (magicRate+extra)));
            if (id >= confData.villageId) {
                // 达到激活条件
                if (!user.auto_fight.magic.msg[k]) {
                    user.auto_fight.magic.msg[k] = {
                        start_time: curTime - Math.floor(awardTimeLimit / 4),
                        last_time: curTime,
                        limit_time: awardTimeLimit,
                        max: 0,
                    };

                    user.auto_fight.magic.bag[k] = [];
                }
            }
        }*/

        // 有占领村庄才通知
        if (this.memData.village_id > 0) {
            // 通知world服务器
            var worldReq = {
                uid: this.uid,
                mod: 'landgrabber',
                act: 'village_member_open',
                args: {
                    team_id: this.memData.team_id,
                    member_id: this.uid,
                    village_id: id
                }
            }

            requestWorld(worldReq, {}, function () {
                DEBUG('send village release notify to world suss, uid = ' + this.uid);
            });

            requestLandGrabber(worldReq, {}, function () {
                DEBUG('send village release notify to landgrabber suss, uid = ' + this.uid);
            });
        }

        // 在线奖励通知
        outline_sync_to_client(this);
    },

    // 判断存在是否已经解救
    isVillageReleased: function (id) {
        var user = this.user;
        if (user.custom_village.indexOf(id) >= 0) {
            return true;
        }

        return false;
    },

    // 初始化篝火特殊奖励
    initBonFireSpecial: function (arr) {
        var count = common.randRange(parseInt(arr[1]), parseInt(arr[2]));
        if (!count) {
            return "";
        }

        var dropArr = [];
        var maxCount = parseInt(arr[0]);
        for (var i = 0; i < maxCount; i++) {
            dropArr.push(i);
        }

        var specialArr = [];
        for (var i = 0; i < count; i++) {
            var randR = common.randRange(0, dropArr.length - 1);
            specialArr.push(dropArr[randR]);
            dropArr.remove(dropArr[randR]);
        }

        return specialArr;
    },

    // 重置符文掉落
    resetRuneDropTab: function () {
        var user = this.user;

        if (user.tower_server.rune_new_drop_tab.length == 0) {
            // 初始化新手掉落
            var initRunes = gConfGlobalNew.runeLootSpecialList.split('|');
            for (var i = 0; i < initRunes.length; i++) {
                user.tower_server.rune_new_drop_tab[i] = parseInt(initRunes[i]);
                user.tower_server.rune_new_drop_count = 0;
                this.markDirty('tower_server.rune_new_drop_tab');
                this.markDirty('tower_server.rune_new_drop_count');
            }
        }

        user.tower_server.rune_drop_tab = [];
        user.tower_server.rune_drop_count = 0;

        var totalCount = 0;
        for (var i = 1; i <= Object.keys(gConfRuneBoxConf).length; i++) {
            totalCount += gConfRuneBoxConf[i].cycleManner;
        }

        for (var i = 0; i <= totalCount; i++) {
            user.tower_server.rune_drop_tab[i] = 0;
        }

        var indexArr = [];
        for (var i = 1; i < totalCount; i++) {
            indexArr[i - 1] = i;
        }

        for (var i = 1; i <= Object.keys(gConfRuneBoxConf).length; i++) {
            var repeatCount = gConfRuneBoxConf[i].cycleManner;
            for (var j = 0; j < repeatCount; j++) {
                var randIndex = common.randRange(0, indexArr.length - 1);
                var val = indexArr[randIndex];

                if (val) {
                    user.tower_server.rune_drop_tab[val - 1] = i;
                    indexArr.remove(val);
                }
            }
        }

        this.markDirty('tower_server.rune_drop_tab');
        this.markDirty('tower_server.rune_drop_count');

        // 修改版本号
        if (user.tower_server.rune_box_conf_version != gConfVersion.runeBoxCycle.version) {
            user.tower_server.rune_box_conf_version = gConfVersion.runeBoxCycle.version;
            this.markDirty('tower_server.rune_box_conf_version');
        }
    },

    // 获取当前掉落符文奖励
    getRuneDropAward: function () {
        var user = this.user;

        var awards = [];
        if (user.tower_server.rune_new_drop_count < user.tower_server.rune_new_drop_tab.length) {
            // 新手掉落还没掉完
            awards.push(['rune', user.tower_server.rune_new_drop_tab[user.tower_server.rune_new_drop_count], 1]);
            user.tower_server.rune_new_drop_count++;
            this.markDirty('tower_server.rune_new_drop_count');
        } else {
            // 周期性掉落
            var curDropId = user.tower_server.rune_drop_tab[user.tower_server.rune_drop_count];
            var topFloor = user.tower.top_floor;
            var dropConf = gConfRuneBoxConf[curDropId];
            if (!dropConf) {
                DEBUG('curDropId = ' + curDropId);
            } else {
                if (dropConf.replaceAward.length > 0 && topFloor >= dropConf.limit) {
                    awards = dropConf.replaceAward;
                } else {
                    awards = dropConf.award;
                }
            }

            user.tower_server.rune_drop_count++;
            this.markDirty('tower_server.rune_drop_count');

            if (user.tower_server.rune_drop_count >= user.tower_server.rune_drop_tab.length) {
                // 这一轮周期已经走完，需要重置
                this.resetRuneDropTab();
            }
        }

        return awards;
    },

    // 军团信息加入内存数据
    saveLegionMemData: function (req, legion) {
        this.doTask('legionMember', 1);
        this.doOpenSeven('legionMember', 1);
        this.doOpenHoliday('legionMember', 1);
        try {
            this.memData.legion_id = legion.lid || 0;
            this.memData.legion_name = legion.name || '';
            this.memData.legion_level = legion.level || 0;
            this.memData.legion_icon = legion.icon || [0, 0];
        } catch (e) {
            this.memData.legion_id = 0;
            this.memData.legion_name = '';
            this.memData.legion_level = 0;
            this.memData.legion_icon = [0, 0];
        }

        this.doTask('legionLevel', 1);

        req && updateWssData(req.uid, { lid: this.memData.legion_id });
    },

    getQuality: function () {
        var quality = 2;    // 一开始是绿色
        var user = this.user;
        if (user.custom_king.index > 0) {
            var maxId = +(this.user.custom_king.index);

            if (gConfCustomPreview[maxId].showType == 'hero') {
                quality = gConfCustomPreview[maxId].titleQuality;
            }
        }

        return quality;
    },

    updateCustomKing: function () {
        var arrCondtion = [];
        var maxId = +(this.user.custom_king.index);
        var myValue = this.user.battle.type * 10000 + this.user.battle.progress;
        for (var i in gConfCustomPreview) {
            if (maxId >= +i) {
                continue;
            }

            var oneConf = gConfCustomPreview[i];
            var onValue = oneConf.limitValue[0] * 10000 + oneConf.limitValue[1];
            if (myValue > onValue && (+i > maxId)) {
                maxId = +i;
            }
        }

        this.user.custom_king.index = +maxId;
        this.markDirty('custom_king.index');

        return +maxId;
    },

    updateCustomDragon: function () {
        var dragonIdList = [];
        for (var dragonId in gConfCustomDragon) {
            var dragConf = gConfCustomDragon[dragonId];
            if (dragConf.limitType == 9999 && dragConf.limitCustom == 9999) { continue; }
            if (dragConf.limitType > this.user.battle.type) {
                delete this.user.dragon[dragonId];
                continue;
            }
            if (dragConf.limitType == this.user.battle.type && dragConf.limitCustom > this.user.battle.progress) {
                delete this.user.dragon[dragonId]; continue;
            }

            if (this.user.dragon[dragonId]) { continue; }
            this.user.dragon[dragonId] = {
                level: 1,
                slot: {
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                },
            };
            this.markDirty('dragon.' + dragonId);
            dragonIdList.push(dragonId);
        }
        if (this.user.status.vip < 9) {
            delete this.user.dragon[7];
        }
        if (this.user.payment.paid < 1000) {
            delete this.user.dragon[9];
        }
        if (this.user.activity && this.user.activity.gift_bag && this.user.activity.gift_bag[4103] && this.user.activity.gift_bag[4103].buy_count > 0) {
            this.user.dragon[5] = this.user.dragon[5] || {
                level: 1,
                slot: {
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                },
            };
        }
        else {
            delete this.user.dragon[5];
        }

        for (var tKey in this.user.bag.dragon) {
            var tDragonGidInfo = this.user.bag.dragon[tKey];
            if (!tDragonGidInfo) { continue; }                                      // 龙晶不存在
            var tDragonID = ~~(tDragonGidInfo.dragon / 100);
            if (!tDragonID) { continue; }                                           // 龙的id不存在
            var tSlotIdx = ~~(tDragonGidInfo.dragon % 100);
            var tDragonInfo = this.user.dragon[tDragonID];
            if (tDragonInfo && tDragonInfo.slot[tSlotIdx] == tKey) { continue; }    // 拥有这条龙 且 这条龙对应位置的龙晶是这个龙晶

            tDragonGidInfo.dragon = 0;
            this.markDirty(`bag.dragon.${tKey}.dragon`);
        }

        this.markDirty('dragon');
        return [dragonId];
    },

    // 随机一块荒地
    randBarrenLand: function () {
        if (!isModuleOpen_new(this, 'territorywar')) {
            return;
        }

        // 先随机类型
        var weight1 = gConfGlobalNew.territoryWarPersonalLootWeight1;
        var weight2 = gConfGlobalNew.territoryWarPersonalLootWeight2;
        var total = weight1 + weight2;
        var rand = common.randRange(0, total);

        var landType = 2;
        if (rand <= weight1) {
            landType = 1;
        }

        // 找出符合条件的地块
        var lands = [];
        for (var k in gConfBarrenLand) {
            if (gConfBarrenLand[k].type == landType && this.isVillageReleased(gConfBarrenLand[k].limit)) {
                lands.push(k);
            }
        }

        if (lands.length > 0) {
            var rand2 = common.randRange(0, lands.length - 1);

            this.user.barren_land = lands[rand2];
            if (!this.user.barren_land || this.user.barren_land == 0) {
                this.user.barren_land = 1;
            }
            this.markDirty('barren_land');
        }
    },

    // 判断是否需要向村庄跨服服务器同步数据
    isNeedSyncToLandGrabber: function () {
        if (this.memData.village_id > 0 && isCrossVillage(this.memData.village_id)) {
            return true;
        }

        if (this.memData.village_land && this.memData.village_land[0] > 0 && isCrossVillage(this.memData.village_land[0])) {
            return true;
        }

        return false;
    },

    // 判断是否需要向村庄跨服服务器同步数据
    addBttleProgress: function (passNum) {
        var type = ~~(passNum / 150) + 1;
        this.user.battle.type = (type > 5) ? 5 : type;
        this.user.battle.progress = ((type > 5) ? (passNum - (4 * 150)) : (passNum % 150)) + 1;

        this.markDirty('battle');

        return this.user.battle;
    },

    // 获取大本营挂机的一些状态提示数据
    getAutoFightTips: function () {
        var autoFight = this.user.auto_fight;
        var curTime = common.getTime();
        var storageTime = curTime - autoFight.last_get_time;
        var storageMaxTime = gConfExploreBase['StorageCubage'].value * 3600;// 存储最大时间
        var full = false;   // 是否已满
        if (autoFight.last_get_time > 0 && storageTime >= storageMaxTime) {
            full = true;
        }

        var hasBossAward = false;   // 是否有boss奖励可以兑换
        if (autoFight.boss.boss_kill_count) {
            for (var i = 1; i <= 3; i++) {
                if (autoFight.boss.boss_kill_count[i] >= gConfExploreBoss[i].awardNeed) {
                    hasBossAward = true;
                    break;
                }
            }
        }

        var hasTask = false;    // 是否有未完成探索任务
        var dailySearchCount = autoFight.search_task.already_num;
        var remainCount = gConfExploreBase.taskBasicTimes.value + autoFight.search_task.already_buy - dailySearchCount;
        if (remainCount > 0) {
            for (var k in autoFight.search_task.task_list) {
                if (autoFight.search_task.task_list[k].hid == 0) {
                    hasTask = true;
                    break;
                }
            }
        }

        var taskEndTime = {};
        for (var k in autoFight.search_task.task_list) {
            var task = autoFight.search_task.task_list[k];// 任务
            var limitTime = gConfExploreTaskBasic[task.type].needTime[task.star - 1] * 60;//  所需时间
            if (task && task.hid != 0) {
                var endTime = task.start_time + limitTime;
                if (curTime >= endTime) {
                    // 有已经完成的探索任务
                    hasTask = true;
                } else {
                    taskEndTime[k] = endTime;
                }
            }
        }

        var magicMax = false;
        /*
        for (var k in autoFight.magic.msg) {
            if (autoFight.magic.msg[k].max > 0) {
                magicMax = true;
                break;
            }
        }*/

        var tipsObj = {};
        tipsObj.full = full;
        tipsObj.hasBossAward = hasBossAward;
        tipsObj.hasTask = hasTask;
        tipsObj.endTime = taskEndTime;
        tipsObj.magicMax = magicMax;
        return tipsObj;
    },

    // 计算魔法阵奖励
    calcAutoFightMagic: function () {
        var user = this.user;
        var magic = user.auto_fight.magic;
        var magicMsg = magic.msg;
        var magicBag = magic.bag;

        // 转化率
        var magicRate = calcMagicRate(user.status.vip, user.payment.long_card, user.payment.month_card, user.payment.week_card);
        var curTime = common.getTime();
        var maxLimitTime = gConfExploreBase.magicCircleLimit.value * 24 * 60 * 60; // 最大时间间隔

        // 初始化魔法阵配置
        for (var id in gConfExploreMagic) {
            var confData = gConfExploreMagic[id];

            if (this.isVillageReleased(confData.villageId)) {
                var extra = calcMagicRateExtra(id, magic);
                var awardTimeLimit = parseInt(86400 / (confData.base * (extra + magicRate))); // 单个奖励获得的时间
                if (!magicMsg[id]) {
                    magicMsg[id] = {
                        start_time: curTime - Math.floor(awardTimeLimit / 4),
                        last_time: curTime,
                        limit_time: awardTimeLimit,
                        max: 0,
                    };
                    magicBag[id] = [];
                } else {
                    if (!magicMsg[id]) continue;
                    if (magicMsg[id].max) continue; // 已经结算过

                    var lastTime = magicMsg[id].last_time;

                    var curMaxNum = parseInt((maxLimitTime - (lastTime - magicMsg[id].start_time)) / awardTimeLimit);// 上次结算时间至最大储存时间中间的时间可以结算多少次
                    var calcNum = parseInt((curTime - lastTime) / awardTimeLimit);// 本次结算次数
                    var residue = parseInt((curTime - lastTime) % awardTimeLimit);// 余数

                    // 达到上限
                    if (curTime - magicMsg[id].start_time >= maxLimitTime) {
                        // 实际最大结算次数
                        calcNum = curMaxNum;
                        residue = 0;
                        magicMsg[id].max = curMaxNum;
                    }

                    if (!magicMsg[id].max_num) {
                        magicMsg[id].max_num = 0;
                    }

                    if (!magicMsg[id].cur_num) {
                        magicMsg[id].cur_num = 0;
                    }

                    magicMsg[id].max_num = magicMsg[id].cur_num + curMaxNum;
                    magicMsg[id].cur_num += calcNum;

                    if (calcNum > 0) {
                        magicMsg[id].last_time = curTime - residue
                    }

                    magicMsg[id].limit_time = awardTimeLimit;
                    for (var i = 0; i < calcNum; i++) {
                        !magicBag[id] && (magicBag[id] = []);
                        magicBag[id].push(confData.award[0]);
                    }

                    if (magicBag[id] && magicBag[id].length) {
                        magicBag[id] = reformAwards(magicBag[id]);
                    }
                }
            }
        }

        this.markDirty('auto_fight.magic');
    },

    // 根据玩家建号时间获取签到数据
    checkAndResetSign: function () {
        var user = this.user;
        var sign = user.sign;
        var createDate = getGameDate(user.info.create);
        var today = getGameDate();
        var createDiffDay = common.getDateDiff(createDate, today);
        var signDiffDay = common.getDateDiff(sign.day, today);
        var resetDiffDay = common.getDateDiff(sign.last_reset_date, today);
        // 检查是否需要刷新本轮奖励(配置版本变化, 本轮签到结束都需要重置本轮签到奖励)
        if ((sign.version != gConfVersion.signInReset) || (createDiffDay % 7 < resetDiffDay)) {
            // 重置本轮签到奖励
            sign.round_rewards = [];
            var round2len = Object.keys(gConfSign[2]).max();
            if (createDiffDay >= round2len) {
                // 无限循环签到配置的第一波奖励
                for (var i = 1; i <= 7; i++) {
                    sign.round_rewards.push(gConfSign[1][i]['reward']);
                }
            } else {
                // 按签到配置的第2波奖励发放
                var startSortId = createDiffDay - createDiffDay % 7 + 1;
                var endSortId = startSortId + 7;
                for (var i = startSortId; i < endSortId; i++) {
                    sign.round_rewards.push(gConfSign[2][i]['reward']);
                }
            }
            sign.last_reset_date = today;
            sign.version = gConfVersion.signInReset;
            this.markDirty('sign.last_reset_date');
            this.markDirty('sign.round_rewards');
            this.markDirty('sign.version');
        }

        // 检查是否需要重置签到次数(距离上次签到已过7天，本轮签到结束都需要重置签到次数)
        if (createDiffDay % 7 < signDiffDay) {
            sign.count = 0;
            this.markDirty('sign.count');
        }
    },

    // ----------------------------  ↓↓↓ 礼包活动 ↓↓↓  ----------------------------------
    updateGiftBags: function () {
        this.cleanInvalidGiftBags();
        this.checkTriggerGiftBags();
    },

    // 清理无效的礼包和过期的礼包
    cleanInvalidGiftBags: function () {
        var user = this.user;
        var today = getGameDate();
        var gift_bag = user.activity.gift_bag;
        // 先清理掉被删掉的礼包数据和过期的礼包数据
        var giftBagIds = Object.keys(gift_bag);
        for (var i = 0; i < giftBagIds.length; i++) {
            var id = giftBagIds[i];
            // 删除废弃配置相关数据
            var conf = gConfGiftBag[id];
            if (!conf) {
                delete gift_bag[id];

                if (user.mark.visit_gift_bag) {
                    var index = user.mark.visit_gift_bag.indexOf(+id);
                    if (index >= 0) {
                        user.mark.visit_gift_bag.splice(index, 1);
                        this.markDirty('mark.visit_gift_bag');
                    }
                }

                continue;
            }
            // 删除过期礼包
            if (conf.lifeTime != 0) {
                var triggerDate = getGameDate(gift_bag[id].time);
                var passDay = common.getDateDiff(today, triggerDate);
                if (passDay >= conf.lifeTime) {
                    delete gift_bag[id];

                    if (user.mark.visit_gift_bag) {
                        var index = user.mark.visit_gift_bag.indexOf(+id);
                        if (index >= 0) {
                            user.mark.visit_gift_bag.splice(index, 1);
                            this.markDirty('mark.visit_gift_bag');
                        }
                    }
                }
            }
        }
        this.markDirty('activity.gift_bag');
    },

    // 检测时间相关礼包的触发
    checkTriggerGiftBags: function () {
        var user = this.user;
        var curTime = common.getTime();
        var today = getGameDate();
        for (var id in gConfGiftBag) {
            var conf = gConfGiftBag[id];
            if (conf.onoff <= 0) continue;
            var triggerValStr = String(conf.triggerVal);
            var triggerValArr = triggerValStr.split(':');
            var triggerTime = 0;
            if (conf.triggerCondition == 'fixedTime') {
                var triggerDate = new Date(triggerValArr[0], Number(triggerValArr[1]) - 1, triggerValArr[2]);
                triggerTime = triggerDate.getStamp() + gConfGlobalNew.resetHour * 3600;
            } else if (conf.triggerCondition == 'gameDay') {
                var day = Number(triggerValArr[0]) || 1;
                var dayOffset = day > 0 ? day - 1 : 0;
                triggerTime = gConfGlobalServer.serverStartTime + dayOffset * 86400;
            } else if (conf.triggerCondition == 'loginDay') {
                var day = Number(triggerValArr[0]) || 1;
                var dayOffset = day > 0 ? day - 1 : 0;
                triggerTime = this.user.info.create + dayOffset * 86400;
            } else if (conf.triggerCondition == 'yearLoop') {
                var year = Math.floor(today / 10000);
                var triggerDate = new Date(year, Number(triggerValArr[0]) - 1, triggerValArr[1]);
                triggerTime = triggerDate.getStamp() + gConfGlobalNew.resetHour * 3600;
            } else if (conf.triggerCondition == 'monthLoop') {
                var day = Number(triggerValArr[0]) || 1;
                var dayOffset = day > 0 ? day - 1 : 0;
                triggerTime = getMonthResetTime() + dayOffset * 86400;
            } else if (conf.triggerCondition == 'weekLoop') {
                var day = Number(triggerValArr[0]) || 1;
                var dayOffset = day > 0 ? day - 1 : 0;
                triggerTime = getWeekResetTime() + dayOffset * 86400;
            } else if (conf.triggerCondition == 'dayLoop') {
                triggerTime = common.getTime(today) + gConfGlobalNew.resetHour * 3600;
            } else {
                // 不支持的类型
                continue;
            }
            if (triggerTime <= 0) continue;

            var triggerGameDate = getGameDate(triggerTime);
            // 没到触发日期
            if (triggerGameDate > today) continue;

            if (conf.lifeTime != 0) {
                // 限时礼包检测是否过期
                var passDay = common.getDateDiff(today, triggerGameDate);
                if (passDay >= conf.lifeTime) continue;
            }

            var triggerLimit = conf.triggerLimit;
            if (triggerLimit && triggerLimit != 0) {
                var limitValArr = String(triggerLimit).split('.');
                if (limitValArr.length > 0) {
                    if (limitValArr[0] == 'gameday') {
                        var limitDay = parseInt(limitValArr[1]) || 0;
                        var today = getGameDate();
                        var passDay = common.getDateDiff(today, gConfGlobalServer.serverStartDate);
                        if ((limitDay - 1) > passDay) {
                            continue;
                        }
                    }
                }
            }

            var gift_bag = this.user.activity.gift_bag;
            // 已经触发过了
            if (gift_bag[id] && gift_bag[id].time == triggerTime) continue;
            // 初始化礼包数据
            if (!gift_bag[id]) {
                gift_bag[id] = {};
            }
            gift_bag[id].time = triggerTime;
            gift_bag[id].sell_out_time = 0;
            gift_bag[id].buy_count = 0;
            this.markDirty(util.format('activity.gift_bag.%d', id));
        }
    },

    reset_gift_bag: function () {
        this.user.activity.gift_bag = {};
        this.checkTriggerGiftBags();
    },

    // ----------------------------   ↑↑↑ 礼包活动 ↑↑↑ ----------------------------------

    doPrayRecover: function () {
        var pray = this.user.activity.pray;
        var payRecoverCD = gConfGlobalNew.avAlasdPrayOnlineTime * 60;
        var onlineTime = this.getOnlineTime();
        var recover = Math.floor((onlineTime - pray.time) / payRecoverCD);
        if (recover > 0 && pray.recover < gConfGlobalNew.avAlasdPrayPrayNum) {
            var leftRecover = gConfGlobalNew.avAlasdPrayPrayNum - pray.recover;
            if (recover > leftRecover) {
                recover = leftRecover;
            }

            pray.point += recover;
            pray.recover += recover;
            pray.time += recover * payRecoverCD;
            this.markDirty('activity.pray.point');
            this.markDirty('activity.pray.recover');
            this.markDirty('activity.pray.time');
        }
        return pray;
    },

    // 冒险赢钻石
    getCustomWealData: function () {
        var custom_weal = this.user.custom_weal;
        if (!custom_weal || !custom_weal.hasOwnProperty('vip1')) {
            custom_weal = {
                'total': 0, // yjinglingqu le
                'vip1': 0,  // leiji yuanbao
                'vip2': 0,
            };
            this.user.custom_weal = custom_weal;
            this.markDirty('custom_weal');
        }
        return custom_weal;
    },

    addCustomWealCash: function (cash) {
        if (!cash || cash < 0) {
            return;
        }

        var custom_weal = this.user.custom_weal;
        if (!custom_weal || !custom_weal.hasOwnProperty('vip1')) {
            custom_weal = {
                'total': 0, // yjinglingqu le
                'vip1': 0,  // leiji yuanbao
                'vip2': 0,
            };
            this.user.custom_weal = custom_weal;
        }

        this.user.custom_weal.vip1 += cash;
        this.user.custom_weal.vip2 += cash;

        this.markDirty('custom_weal');
        return custom_weal;
    },

    // 检测属性
    check_attrs: function (attrs) {
        return true;

        // todo
        if (!attrs) {
            return false
        }

        for (var i in this.user.pos) {

            var hero = this.user.pos[i];
            if (!hero.rid) {
                continue;
            }

            var client_attr = attrs[i - 1];
            if (!client_attr) {
                return false;
            }

            for (var x = 0; x < 29; x++) {
                DEBUG(`attr ${x} is:  ${hero.attr[x + 1]}, ${client_attr[x]}, ${hero.attr[x + 1] == client_attr[x]}`)
                if (client_attr[x] > (hero.attr[x + 1]) * 1.1) {
                    return false;
                }
            }
        }

        return true
    },

    // 数据上报
    post_payment: function (orderid, amount) {

        var info = this.user.info;
        var args = {
            who: info.uid,
        };

        args.context = {
            '_transactionid': orderid,
            '_paymenttype': "weixinpay",   // alipay unionpay weixinpay yeepay
            '_currencytype': "CNY",
            '_currencyamount': amount,
            '_ip': info.ip,
            '_ipv6': info.ip,
            '_tz': "+8",
            '_rydevicetype': info.device,
        };

        if (info.device_type != "android") {
            args.appid = "6c8761571286fb25906773080f485d62";
            args.context._idfa = info.device_id;
            args.context._deviceid = args.context._idfa;
        } else {
            args.appid = "66f8c48aa35491ed7b3bb5fe1b20b38d";
            args.context._imei = info.device_id;
            args.context._androidid = info.device_id;
            args.context._deviceid = args.context._imei || args.context._androidid;
        }

        zc_post_payment(args, function () {
            DEBUG(`zc_post_payment !!!`)
        });
    },

    wake_dragon: function (dragonId) {
        let dragon = this.user.dragon;

        if (dragonId < 0) {
            return;
        }

        if (dragon[dragonId]) {
            return;
        }

        dragon[dragonId] = {
            level: 1,
            slot: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
            },
        };

        this.markDirty('dragon.' + dragonId);
        this.markFightForceChangedAll();
    },

};

function PlayerManager() {
    this.players = {};
}

PlayerManager.prototype = {
    get: function (uid, callback) {
        var player = this.players[+uid];
        if (player) {
            callback && callback(player);
        } else {
            this.load(+uid, callback);
        }
    },

    load: function (uid, callback) {
        if (uid != 10000 && isDroid(uid)) {
            DEBUG('can not load a robot player, uid = ' + uid);
            return;
        }

        var player = new Player(+uid);
        player.init({}, function (succ) {
            if (succ) {
                this.players[player.uid] = player;
                callback && callback(player);
            } else {
                callback && callback(null);
            }
        }.bind(this));
        player.save(true);
    },

    kick: function (kickedUid) {
        var offlines = [];
        var now = common.getTime();

        if (kickedUid && this.players[kickedUid]) {
            var player = this.players[kickedUid];
            player.stopBossTimer();
            offlines.push(kickedUid);
        } else {
            for (var uid in this.players) {
                var player = this.players[uid];
                if ((now - player.lastActive) > 1800) {
                    player.stopBossTimer();
                    offlines.push(uid);
                }
                else {
                    forceSyncToWorld(uid);
                }
            }
        }

        for (var i = 0, max = offlines.length; i < max; i++) {
            // 踢下线前强制保存
            var player = this.players[offlines[i]];
            // 踢下线前更新世界服数据
            forceSyncToWorld(offlines[i]);
            player.save(true);

            delete this.players[offlines[i]];
            delete gAuthTimes[offlines[i]];
        }

        // 关闭长连接
        if (offlines.length > 0) {
            var wssReq = {
                uid: offlines[0],
                mod: 'user',
                act: 'close',
                type: '',
                flag: '',
                args: {
                    uids: offlines,
                },
            };
            requestWss(wssReq, {});
        }
    },
};

var old_reset_time = 0;
exports.update = function (now) {
    var tResetTime = getResetTime();
    if (old_reset_time >= tResetTime) { return; }
    old_reset_time = tResetTime;
    gPlayers.kick();
}

exports.init = function () {
    old_reset_time = getResetTime();
}

exports.Player = Player;
exports.PlayerManager = PlayerManager;


