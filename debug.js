var logic   = require('./logic');
var config  = require(require('fs').existsSync('../config.js') ? '../config.js' : './config.js');
require('./global.js');

function recursive(uid) {
    if (uid > 101000032)
        process.exit(1);

    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'gm', act: 'gm', args: {method: 'god'}};
    query = {mod: 'gm', act: 'gm', args: {method: 'pass_all'}};
    query = {mod: 'user', act: 'set_name', args: {name: Math.floor(uid%101000000) + ''}};
    query = {mod: 'worldwar', act: 'get', args: {}};
    query.uid = uid;
    query.seq = 1;

    var resp = {code: 0, desc: '', data: {}};
    var logicHandler = logic[query.mod][query.act];
    gPlayers.load(query.uid, function(player) {
        logicHandler(player, query, resp, function() {
            console.log(JSON.stringify(resp));
            player.save(true, function() {
                recursive(uid +1);
            });
        });
    });
}

exports.Debug = function() {
    var uid = config.DebugUID;
    var key = config.GMAuth;
    var query = {};

    query = {mod: 'hero', act: 'wear', args: {'mid' : 200001, 'num': 3, 'pos':1, 'level':3, 'xp':10}};
    query = {mod: 'hero', act: 'level_up', args: {'mid' : 200001, 'num': 3, 'pos':1, 'level':3, 'xp':10}};
    query = {mod: 'hero', act: 'wear', args: {'pos':1, 'eid':3}};
    query = {mod: 'hero', act: 'take_off', args: {'pos':1, 'type':1}};
    query = {mod: 'hero', act: 'exchange', args: {'pos':2, 'hid':202}};
    query = {mod: 'hero', act: 'upgrade_destiny', args: {'num':6, 'pos':2, 'time':202, 'level':6, 'energy':60}};
    query = {mod: 'hero', act: 'upgrade_talent', args: {'pos':2}};
    query = {mod: 'hero', act: 'dress_wear', args: {'pos':1, 'slot':1}};
    query = {mod: 'hero', act: 'upgrade_soldier', args: {'pos':1}};
    query = {mod: 'hero', act: 'resolve_card', args: {'cid':101}};
    query = {mod: 'hero', act: 'resolve_all', args: {'quality':4}};

    query = {mod: 'equip', act: 'smelt', args: {'eids' : [10]}};
    query = {mod: 'equip', act: 'smelt_all', args: {'quality' : 2}};
    query = {mod: 'equip', act: 'swallow', args: {'eid' : 10, 'sids': [12, 13]}};
    query = {mod: 'equip', act: 'inherit', args: {'from' : 15, 'to': 10}};
    query = {mod: 'equip', act: 'fill_gem', args: {'eid' : 15, 'gid': 108, 'slot':1}};
    query = {mod: 'equip', act: 'take_off_all_gems', args: {'eid' : 10}};
    query = {mod: 'equip', act: 'upgrade_gem', args: {'gid' : 309, 'num': 7,'luck':0, 'tgid':310, 'time':1438842621, 'cgid':308}};
    query = {mod: 'equip', act: 'refine', args: {'eid' : 10}};
    query = {mod: 'equip', act: 'make_refresh', args: {'cash':10}};

    query = {mod: 'bag', act: 'use', args: {'id' : 102, 'num' : 50}};
    query = {mod: 'battle', act: 'fight', args: {'id' : 1, 'type': 1}};
    query = {mod: 'battle', act: 'patrol_accelerate', args: {}};
    query = {mod: 'battle', act: 'patrol_get_award', args: {}};

    query = {mod: 'gm', act: 'gm', args: {'key':'', 'method':'god'}};

    query = {mod: 'equip', act: 'fill_gem', args: {'eid' : 3, 'gid': 108, 'slot':1}};
    query = {mod: 'hero', act: 'upgrade_destiny', args: {'num':6, 'pos':2, 'time':202, 'level':6, 'energy':60}};
    query = {mod: 'hero', act: 'exchange', args: {'pos':2, 'hid':5302}};
    query = {mod: 'hero', act: 'upgrade_talent', args: {'pos':2}};
    query = {mod: 'equip', act: 'refine', args: {'eid' : 99}};

    //query = {mod: 'gm', act: 'gm', args: {'key':'', 'method':'god'}};
    query = {mod: 'gm', act: 'gm', args: {'key':'', 'method':'get'}};
    query = {mod: 'battle', act: 'explore', args: {}};

    query = {mod: 'tavern', act: 'normal_tavern', args: {}};
    query = {mod: 'tavern', act: 'normal_tavern', args: {'free':1}};
    query = {mod: 'tavern', act: 'high_tavern', args: {'token':1}};
    query = {mod: 'tavern', act: 'high_tavern', args: {}};
    query = {mod: 'tavern', act: 'ten_tavern', args: {'token':1}};
    query = {mod: 'tavern', act: 'ten_tavern', args: {}};
    query = {mod: 'tavern', act: 'shop_refresh', args: {'token':1}};
    query = {mod: 'tavern', act: 'shop_get', args: {}};
    query = {mod: 'tavern', act: 'shop_buy', args: {'id':93}};
    query = {mod: 'hero', act: 'upgrade_soldier_skill', args: {'pos':3}};
    query = {mod: 'hero', act: 'upgrade_soldier', args: {'pos':3}};

    query = {mod: 'hero', act: 'dress_wear_all', args: {'pos':3}};

    query = {mod: 'battle', act: 'fight', args: {'id' : 8, 'type': 1, 'star': 2}};
    query = {mod: 'hero', act: 'exchange', args: {'pos':2, 'hid':5201}};
    query = {mod: 'equip', act: 'take_off_gem', args: {'eid' : 1650, 'slot':1}};

    query = {mod: 'bag', act: 'sell', args: {'type': 'equip', 'id' : 1997, 'num' : 50}};
    query = {mod: 'bag', act: 'sell', args: {'type': 'material', 'id' : 1, 'num' : 5}};

    query = {mod: 'mine', act: 'fight', args: {'id' : 1, 'star' : 3}};
    query = {mod: 'mine', act: 'leave', args: {'id': 1}};
    query = {mod: 'mine', act: 'occupy', args: {'id' : 2}};
    query = {mod: 'mine', act: 'before_fight', args: {'id' : 1}};
    query = {mod: 'mine', act: 'get', args: {}};

    query = {mod: 'arena', act: 'refresh', args: {}};
    query = {mod: 'arena', act: 'before_fight', args: {}};
    query = {mod: 'arena', act: 'buy_count', args: {}};
    query = {mod: 'arena', act: 'get_report', args: {uid : 3000001}};

    query = {mod: 'tower', act: 'rank_list', args: {'bundle' : 1}};
    query = {mod: 'tower', act: 'select_award', args: {id : 1}};
    query = {mod: 'tower', act: 'reset', args: {}};
    query = {mod: 'tower', act: 'before_fight', args: {'floor' : 2, 'room' : 1} };
    query = {mod: 'tower', act: 'get', args: {}};
    query = {mod: 'tower', act: 'reset', args: {}};

    query = {mod: 'user', act: 'wss_debug', args: {'uid' : 2000001}};

    query = {mod: 'battle', act: 'auto_fight', args: {'id' : 109, 'type': 1, 'time':10}};
    query = {mod: 'battle', act: 'lord_get', args: {'id' : 1}};

    query = {mod: 'battle', act: 'click_thief', args: {'id' : 1}};
    query = {mod: 'battle', act: 'get_thief_award', args: {'id' : 1, 'count': 8, 'die': 0}};
    query = {mod: 'battle', act: 'get', args: {}};
    query = {mod: 'user', act: 'read_mail', args: {id:1, sys:0}};
    query = {mod: 'hero', act: 'upgrade_talent', args: {'pos' : 1}};

    query = {mod: 'legion', act: 'create', args: {name: '朕之天团', icon: 1}};
    query = {mod: 'legion', act: 'get_log', args: {}};
    query = {mod: 'legion', act: 'create', args: {name: '朕之天团', icon: 1}};
    query = {mod: 'legion', act: 'search', args: {search: '220002'}};
    query = {mod: 'legion', act: 'exit', args: {}};
    query = {mod: 'legion', act: 'join', args: {lid: 220002}};
    query = {mod: 'legion', act: 'use_boon', args: {type: 0}};
    query = {mod: 'legion', act: 'grab_boon', args: {id: 1}};
    query = {mod: 'legion', act: 'get_gold_tree', args: {}};
    query = {mod: 'legion', act: 'shake_tree', args: {}};
    query = {mod: 'tavern', act: 'ten_tavern', args: {'token' : 1}};
    query = {mod: 'user', act: 'wss_debug', args: {'chat_log' : 'all'}};
    query = {mod: 'legion', act: 'trial_get', args: {}};
    query = {mod: 'legion', act: 'trial_before_fight', args: {}};
    query = {mod: 'legion', act: 'trial_fight', args: {'star' : 3}};
    query = {mod: 'legion', act: 'get_trial_star_award', args: {'star' : 3}};
    query = {mod: 'arena', act: 'rank_list', args: {}};
    query = {mod: 'legion', act: 'recall_mercenary', args: {'hid': 5101}};
    query = {mod: 'hero', act: 'exchange', args: {'pos':2, 'hid':3302}};
    query = {mod: 'legion', act: 'create', args: {name: 'ljz', icon: 1}};
    query = {mod: 'legion', act: 'trial_before_fight', args: {}};
    query = {mod: 'legion', act: 'get_mercenaries', args: {}};
    query = {mod: 'legion', act: 'hire_mercenary', args: {hids : [5202], owners : [1000001]}};
    query = {mod: 'legion', act: 'exit', args: {}};
    query = {mod: 'legion', act: 'join', args: {'lid': 40001}};
    query = {mod: 'legion', act: 'send_mercenary', args: {'pos': 5}};
    query = {mod: 'legion', act: 'trial_fight', args: {'star' : 3}};
    query = {mod: 'legion', act: 'mercenary', args: {}};
    query = {mod: 'legion', act: 'kick', args: {uid : 1000001}};
    query = {mod: 'legion', act: 'get_copy', args: {}};

    query = {mod: 'legion', act: 'hire_mercenary', args: {hids : [5101], owners : [1000001]}};
    query = {mod: 'task', act: 'get', args: {}};
    query = {mod: 'user', act: 'wss_debug', args: {}};
    query = {mod: 'gm', act: 'gm', args: {'key':'', 'method':'invincible'}};
    query = {mod: 'tower', act: 'fight', args: {'star' : 3} };
    query = {mod: 'bag', act: 'use', args: {'id' : 500001, 'num' : 1} };

    query = {mod: 'shipper', act: 'get_reward', args: {}};
    query = {mod: 'shipper', act: 'rob', args: {target: 22000015}};
    query = {mod: 'shipper', act: 'refresh', args: {use_cash: 0}};
    query = {mod: 'shipper', act: 'get', args: {}};
    query = {mod: 'shipper', act: 'delivery', args: {}};
    query = {mod: 'shipper', act: 'before_fight', args: {target: 22000022}};
    query = {mod: 'shipper', act: 'fight', args: {target: 22000022, star: 3}};
    query = {mod: 'shipper', act: 'rob', args: {target: 22000028}};
    query = {mod: 'shipper', act: 'get_report', args: {}};
    query = {mod: 'treasure', act: 'set_skills', args: {'skills': [3, 4, 0, 0, 0]}};
    query = {mod: 'treasure', act: 'change_dragon', args: {'id': 1}};

    query = {mod: 'arena', act: 'auto_battle', args: {}};
    query = {mod: 'guard', act: 'before_fight', args: {id: 2, type: 1}};
    query = {mod: 'guard', act: 'get', args: {}};
    query = {mod: 'guard', act: 'get_member_list', args: {}};
    query = {mod: 'guard', act: 'get_other', args: {target: 22000085}};
    query = {mod: 'guard', act: 'upgrade_skill', args: {id: 1}};
    query = {mod: 'user', act: 'rank_list', args: {}};

    query = {mod: 'mine', act: 'get', args: {}};

    query = {mod: 'worldwar', act: 'get_replay', args: {id : 1}};
    query = {mod: 'worldwar', act: 'support', args: {id : 1}};
    query = {mod: 'worldwar', act: 'match_enemy', args: {}};
    query = {mod: 'worldwar', act: 'rank_fight', args: {enemy : 1}};
    query = {mod: 'worldwar', act: 'challenge', args: {enemy : 14}};
    query = {mod: 'worldwar', act: 'before_fight', args: {}};
    query = {mod: 'worldwar', act: 'rank_fight', args: {enemy : 14, star : 3}};
    query = {mod: 'worldwar', act: 'get_replay_list', args: {}};

    query = {mod: 'arena', act: 'get', args: {}};
    query = {mod: 'user', act: 'test_sys_mail', args: {}};
    query = {mod: 'user', act: 'read_mail', args: {id:24, sys:1}};
    query = {mod: 'altar', act: 'pray', args: {type : 4}};
    query = {mod: 'user', act: 'get_mails', args: {'ids': [0, 0]}};
    query = {mod: 'worldwar', act: 'test_mail', args: {}};
    query = {mod: 'worldwar', act: 'get_rank_list', args: {}};
    query = {mod: 'user', act: 'sign', args: {}};
    query = {mod: 'worldwar', act: 'price_rank', args: {}};
    query = {mod: 'worldwar', act: 'support', args: {id : 1000023}};

    query = {mod: 'country', act: 'get_report', args: {}};
    query = {mod: 'user', act: 'login', args: {'name' : 'ljz', 'headpic': 'headpic'}};
    query = {mod: 'country', act: 'get_report', args: {}};
    query = {mod: 'guard', act: 'get_member_list', args: {}};
    query = {mod: 'guard', act: 'get', args: {}};

    query = {mod: 'worldwar', act: 'get_rank_list', args: {last: 1}};
    query = {mod: 'user', act: 'login', args: {'name' : 'wdd1', 'headpic': 'headpic'}};
    query = {mod: 'activity', act: 'get_openseven_reward', args: {id: 29}};
    query = {mod: 'activity', act: 'get_openseven', args: {}};

    query = {mod: 'worldwar', act: 'get', args: {}};
    query = {mod: 'battle', act: 'shop_get', args: {}};
    query = {mod: 'legion', act: 'use_boon', args: {type: 0}};
    query = {mod: 'legion', act: 'grab_boon', args: {id: 1}};
    query = {mod: 'user', act: 'wss_debug', args: {'chat_log' : 'black'}};
    query = {mod: 'user', act: 'get_enemy', args: {'enemy' : 10000, 'from' : 'world', 'state' : 'arena'}};
    query = {mod: 'worldwar', act: 'test_fight', args: {}};
    query = {mod: 'user', act: 'exchange_cdkey', args: {'key' : 'AXfTC7iAH279Hu4YNSl4HTfCzoKmA001'}};
    query = {mod: 'bag', act: 'use', args: {'id' : 200010, 'num' : 20}};

    query = {mod: 'user', act: 'get_honor_hall', args: {}};
    query = {mod: 'user', act: 'get_honor_user', args: {type: 'fight_force'}};
    query = {mod: 'user', act: 'send_bullet', args: {"type":"fight_force","target":21000003,"bullet":"32132131"}};
    query = {mod: 'user', act: 'get_enemy', args: {'enemy' : 1000051}};
    query = {mod: 'tower', act: 'get', args: {}};
    query = {mod: 'worldwar', act: 'get', args: {}};
    query = {mod: 'user', act: 'wss_debug', args: {'chat_log' : 'all'}};
    query = {mod: 'activity', act: 'get_overvalued_gift_awards', args: {id : 2}};
    query = {mod: 'activity', act: 'get_overvalued_gift', args: {}};
    query = {mod: 'legion', act: 'mercenary', args: {}};
    query = {mod: 'user', act: 'wss_debug', args: {}};
    query = {mod: 'user', act: 'active_user', args: {}};

    query = {mod: 'activity', act: 'get_level_gift', args: {}};
    query = {mod: 'activity', act: 'get_level_gift_award', args: {id: 1}};
    query = {mod: 'hero', act: 'get_train', args: {}};
    query = {mod: 'hero', act: 'train', args: {pos : 2, slot : 1}};

    query = {mod: 'user', act: 'login', args: {'name' : 'ljz1'}};
    query = {mod: 'hook', act: 'get_queues', args: {}};
    query = {mod: 'hook', act: 'get_hook_awards', args: {}};
    query = {mod: 'hook', act: 'leave_queue', args: {qid : 1}};
    query = {mod: 'hook', act: 'create_queue', args: {}};
    query = {mod: 'hook', act: 'join_queue', args: {qid : 1}};
    query = {mod: 'hook', act: 'get', args: {}};
    query = {mod: 'hook', act: 'get_hook_repos', args: {}};

    query = {mod: 'legion', act: 'get_castle', args: {}};

    query = {mod: 'equip', act: 'shop_refresh', args: {'free' : 1}};

    query = {mod: 'digging', act: 'dig', args: {level: 1, x: 64, y: 1}};
    query = {mod: 'digging', act: 'collect', args: {level: 1, x: 64, y: 1}};
    query = {mod: 'digging', act: 'refresh_queue', args: {}};
    query = {mod: 'digging', act: 'get', args: {}};
    query = {mod: 'gm', act: 'gm', args: {'key':'', 'method':'get'}};

    query = {mod: 'arena', act: 'shop_refresh', args: {}};

    query = {mod: 'activity', act: 'get_limit_buy', args: {}};
    query = {mod: 'activity', act: 'cut_limit_buy', args: {id: 1}};
    query = {mod: 'activity', act: 'buy_limit_buy', args: {id: 1}};
    query = {mod: 'legion', act: 'get_trial_star_award', args: {star: 9}};
    query = {mod: 'hero', act: 'upgrade_soldier_skill', args: {pos: 1, skill : 1}};
    query = {mod: 'bag', act: 'use', args: {'id' : 1000001, 'num' : 1, 'type' : 'material'}};
    query = {mod: 'equip', act: 'shop_get', args: {}};
    query = {mod: 'hook', act: 'get_hook_repos', args: {}};

    query = {mod: 'legion', act: 'buy_dress', args: {did : 101}};
    query = {mod: 'worldwar', act: 'get', args: {}};
    query = {mod: 'arena', act: 'refresh_shop', args: {}};
    query = {mod: 'arena', act: 'fight', args: {star : 3, enemy : 6030}};
    query = {mod: 'user', act: 'debug_world_user', args: {}};
    query = {mod: 'bag', act: 'use', args: {"type":"material","num":1,"id":200056}};

    query = {mod: 'activity', act: 'get_petition', args: {}};
    query = {mod: 'activity', act: 'do_petition', args: {id: 1}};
    query = {mod: 'activity', act: 'reward_petition', args: {}};

    query = {mod: 'activity', act: 'get_roulette', args: {}};
    query = {mod: 'activity', act: 'turn_roulette', args: {}};
    query = {mod: 'activity', act: 'reward_roulette', args: {}};
    query = {mod: 'activity', act: 'reset_roulette', args: {}};

    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'market', act: 'get', args: {}};
    query = {mod: 'market', act: 'buy', args: {id: 13, num: 1}};
    query = {mod: 'battle', act: 'open_pass_box', args: {id: 1}};
    query = {mod: 'battle', act: 'open_pass_box', args: {id: 1}};
    query = {mod: 'battle', act: 'get', args: {}};

    query = {mod: 'tavern', act: 'buy_hot', args: {}};
    query = {mod: 'tavern', act: 'exchange_hot', args: {}};
    query = {mod: 'tavern', act: 'get_hot', args: {}};

    query = {mod: 'equip', act: 'fill_all_gem', args: {eid: 9, gids: {2: 210}}};

    query = {mod: 'legion', act: 'get_hall', args: {}};

    query = {mod: 'user', act: 'refresh_pay', args: {
        "pf":"desktop_m_qq_m-00000000-android-00000000-ysdk",
        "pfkey":"504d14a1826532bd2e2e882d870de6e2",
        "zoneid":1,
        "login":"qq",
        "openid":"DDD937259F3EC760AB1166875CB4C4EA",
        "openkey":"31DD825DEC303F4366AB5B4451A5D396"
    }};

    query = {mod: 'activity', act: 'buy_limit_group', args: {id: 4, num: 20}};
    query = {mod: 'activity', act: 'get_limit_group', args: {}};

    query = {mod: 'tavern', act: 'get', args: {}};
    query = {mod: 'tavern', act: 'get_luck_list', args: {}};

    query = {mod: 'activity', act: 'click_lucky_dragon', args: {}};
    query = {mod: 'activity', act: 'get_lucky_dragon', args: {}};

    query = {mod: 'altar', act: 'one_key', args: {type: 1}};

    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'activity', act: 'get_grow_fund_award', args: {id: 9}};
    query = {mod: 'activity', act: 'buy_grow_fund', args: {}};
    query = {mod: 'activity', act: 'get_grow_fund', args: {id: 3}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'warcollege', act: 'war_college_challenge', args: {challenge: 2, star:5}};

    query = {mod: 'warcollege', act: 'war_college_challenge', args: {challenge: 2, star:5}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'task', act: 'world_situation_reward', args: {id: 4}};

    query = {mod: 'treasure', act: 'transfer_gem', args: {gids: [228,233]}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'activity', act: 'get_daily_recharge_award', args: {id: 1}};
    query = {mod: 'activity', act: 'get_daily_recharge', args: {}};
    query = {mod: 'activity', act: 'get_daily_recharge_award', args: {id: 3}};
    query = {mod: 'activity', act: 'get_accumulate_recharge_award', args: {id: 3}};
    query = {mod: 'activity', act: 'get_accumulate_recharge', args: {}};
    query = {mod: 'activity', act: 'get_single_recharge', args: {}};
    query = {mod: 'activity', act: 'get_single_recharge_award', args: {id: 3}};

    query = {mod: 'legion', act: 'build_construct', args: {id: 3}};
    query = {mod: 'legion', act: 'get_construct', args: {}};
    query = {mod: 'legion', act: 'get_construct_reward', args: {progress: 40}};

    query = {mod: 'gm', act: 'gm', args: {method: 'god'}};
    query = {mod: 'activity', act: 'click_lucky_dragon', args: {}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'task', act: 'world_situation_reward', args: {id: 2}};
    query = {mod: 'hero', act: 'buy_train_slot', args: {slot: 4}};
    query = {mod: 'battle', act: 'get_city_tribute', args: {}};
    query = {mod: 'activity', act: 'get_expend_gift', args: {}};
    query = {mod: 'activity', act: 'get_expend_gift_award', args: {id: 1}};
    query = {mod: 'user', act: 'get_head_reset', args: {}};
    query = {mod: 'activity', act: 'get_drops_dragon_award', args: {}};
    query = {mod: 'activity', act: 'get_drops_dragon', args: {}};
    query = {mod: 'activity', act: 'get_tavern_recruit_award', args: {id: 3}};
    query = {mod: 'activity', act: 'get_tavern_recruit_generals', args: {id: 1}};
    query = {mod: 'activity', act: 'get_tavern_recruit', args: {}};
    query = {mod: 'activity', act: 'get_exchange_points_award', args: {id: 6}};
    query = {mod: 'activity', act: 'get_exchange_points_buy', args: {id: 3}};
    query = {mod: 'activity', act: 'get_exchange_points', args: {}};
    query = {mod: 'tavern', act: 'refresh_hot', args: {}};
    query = {mod: 'tavern', act: 'get_hot', args: {}};

    query = {mod: 'digging', act: 'get', args: {}};
    query = {mod: 'legion', act: 'get_wish_fragment', args: {times:4, id:4409}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'legion', act: 'wish_give', args: {ruid:2000111, times:3, id:4409}};
    query = {mod: 'legion', act: 'get_wish_awards_message', args: {}};
    query = {mod: 'legion', act: 'wish', args: {id: 4409, num:30}};
    query = {mod: 'legion', act: 'get_wish_log', args: {}};
    query = {mod: 'legion', act: 'get_wish_awards', args: {id: 3}};
    query = {mod: 'legion', act: 'get_wish_list', args: {}};
    query = {mod: 'activity', act: 'get_promote_wheel_reward', args: {score: 100}};
    query = {mod: 'hero', act: 'promote', args: {pos:7}};
    query = {mod: 'activity', act: 'get_promote_wheel_rank', args: {}};
    query = {mod: 'activity', act: 'get_promote_wheel', args: {}};
    query = {mod: 'activity', act: 'turn_promote_wheel', args: {time: 1}};
    query = {mod: 'task', act: 'investiture', args: {level: 2}};

    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'user', act: 'get_resback', args: {}};
    query = {mod: 'hero', act: 'get_sky', args: {}};
    query = {mod: 'hero', act: 'upgrade_sky_skill_max', args: {'skill':1, 'type':1,}};
    query = {mod: 'hero', act: 'upgrade_sky_weapon', args: {'num':1, 'type':1, }};
    query = {mod: 'hero', act: 'awaken_sky_weapon', args: {'utype':1}};
    query = {mod: 'hero', act: 'awaken_sky_wing', args: {'utype':1}};
    query = {mod: 'activity', act: 'get_first_pay', args: {}};
    query = {mod: 'activity', act: 'get_first_pay_reward', args: {'id':3}};

    query = {mod: 'activity', act: 'get_open_rank', args: {}};
    query = {mod: 'new_legion', act: 'rank_list', args: {}};
    query = {mod: 'legionwar', act: 'get_world_ranklist', args: {}};
    query = {mod: 'hero', act: 'level_up', args: {}};
   
    query = {mod: 'tavern', act: 'ten_tavern', args: {'type':2}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'hero', act: 'level_up', args: {'hid':29}};
    query = {mod: 'hero', act: 'exchange_card', args: {'hid':57}};
    query = {mod: 'auto_fight', act: 'get', args: {'hid':57}};
    query = {mod: 'battle', act: 'fight', args: {'progress' : 1, 'type': 1}};
    query = {mod: 'battle', act: 'fight', args: {'progress' : 1, 'type': 1,'success':1,'type':1,'time':11234444,'sign':112212,'ff':1213}};
    query = {mod: 'auto_fight', act: 'get', args: {}};
    query = {mod: 'auto_fight', act: 'get_award', args: {}};
    query = {mod: 'user', act: 'login', args: {}};
    query = {mod: 'hero', act: 'expand_hero_bag', args: {}};
    query = {mod: 'arena', act: 'challenge', args: {'type':1,'enemy':8571,'rank':8571}};
    query = {mod: 'auto_fight', act: 'magic_extra_fight_before', args: {'type':1}};
    query = {mod: 'landgrabber', act: 'get', args: {'type':1}};
    query = {mod: 'battle', act: 'before_fight', args: {'progress' : 19, 'type': 1,'team':{1:2,2:2,3:3}}};
    //global.resetByNewDay = false;
    //global.resetByNewWeek = false;
    global.resetByNewDay = true;
    global.resetByNewWeek = true;
    query.uid = 2000225;
    query.uid = 106000171;


    query.seq = 1;

    var resp = {code: 0, desc: '', data: {}};
    var logicHandler = logic[query.mod][query.act];
    gPlayers.load(query.uid, function(player) {
        player.resetByDay(getGameDate());
        logicHandler(player, query, resp, function() {
            console.log(JSON.stringify(resp));
            player.save(true, function() {
                process.exit(1);
            });
        });
    });
}
