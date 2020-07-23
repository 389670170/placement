var mods = [
    'battle',
    'replay',
    'user',
    'mine',
    'arena',
    'mail',
    'tower',
    'legion',
    'shipper',
    'guard',
    'country',
    'activity',
    'tips',
    'tavern',
    'legionwar',
    'gm',
    'friend',
    'territorywar',
    'countrywar',
    'clan',
    'new_legion',
    'landgrabber',
    'teamzone',
    'register',
    'gmPushSysMsg'
];

mods.forEach(function (mod) {
    module.exports[mod] = require('./' + mod + '.js');
});

