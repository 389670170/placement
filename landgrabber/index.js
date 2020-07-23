var mods = ['user','landgrabber'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});