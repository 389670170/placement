var mods = ['user', 'countrywar', 'replay'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});
