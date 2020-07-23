var server = require('../server.js')
exports.get = function(req, res, resp) {
    resp.data.user = gUserInfo.getUser(req.uid);
    resp.data.legion = gNewLegion.getUserLegion(req.uid);

    var selfMails = gMail.get(req.uid, req.args.ids);
    var sysMails = gSysMail.get(req.uid, req.args.ids, req.args.options);

    var mails = [];
    for (var id in selfMails) {
        selfMails[id].id = +id;
        selfMails[id].sys = 0;
        mails.push(selfMails[id]);
    }

    var bulletins = [];
    for (var id in sysMails) {
        var mail = sysMails[id];
        mail.id = +id;
        mail.sys = 1;
        if (mail.type == 0) {
            mail.from = 0;
            mails.push(mail);
        } else {
            bulletins.push(mail);
        }
    }

    resp.data.mails = mails;
    resp.data.bulletins = bulletins;
    onReqHandled(res, resp, 1);
};

exports.world_get = function(req, res, resp) {
    switch (req.args.type) {
        case 'mail': resp.data = gMail; break;
        case 'sys_mail': resp.data = gSysMail; break;
        case 'arena': resp.data = gArena; break;
        case 'tower': resp.data = gTower; break;
        case 'legion': resp.data = gNewLegion; break;
        case 'shipper': resp.data = gShipper; break;
        case 'guard': resp.data = gGuard; break;
        case 'country': resp.data = gCountry; break;
        case 'activity': resp.data = gActivity; break;
        case 'hook': resp.data = gHook; break;
        case 'tavern': resp.data = gTavern; break;
        case 'tips': resp.data = gTips; break;
        case 'legionwar': resp.data = gLegionWar; break;
        break;
    }

    onReqHandled(res, resp, 1);
};

exports.sync_server_info = function (req, res, resp) {
    server.loadGlobalServerConf('world');
    gActivity.growFund = 0;
    gActivity.addUpdate('grow_fund', gActivity.growFund);

    onReqHandled(res, resp, 1);
};
