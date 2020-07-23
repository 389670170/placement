var mods = ['user', 'worldwar'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});

