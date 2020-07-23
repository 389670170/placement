/**
 * Created by 671643387 on 2016/7/25.
 */

var mods = [
    'server',
    'legionwar_toplist',
    'activity',
    'fight_rank',
];

mods.forEach(function (mod) {
    module.exports[mod] = require('./' + mod + '.js');
});
