var mods = ['api'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});