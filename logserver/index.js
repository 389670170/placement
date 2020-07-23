var mods = ['logmanager'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});