var mods = ['user', 'arena', 'act_lucky_rotate'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});