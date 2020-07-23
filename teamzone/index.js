var mods = ['user','teamzone'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});