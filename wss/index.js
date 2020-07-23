var mods = ['push', 'chat', 'user'];

mods.forEach(function(mod){
    module.exports[mod] = require('./' + mod + '.js');
});
