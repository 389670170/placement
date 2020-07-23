exports.war_college_challenge = function(player, req, resp, onHandled) {
    var user = player.user;
    do {
        if (!isModuleOpen_new(player, 'war_college')) {
           resp.code =1; resp.desc = 'not open' ; break;
        }

        var challenge = req.args.challenge;
        var conf = gConfWarCollege[challenge];
        if (!conf) {
            resp.code =1; resp.desc = 'invalid type' ; break;
        }

        var star = Math.floor(req.args.star);
        var warCollege = user.war_college;
        if (challenge > warCollege.challenge + 1) {
            resp.code =1; resp.desc = 'can not challenge'; break;
        }

        if (star > 0 && challenge == warCollege.challenge + 1) {
            warCollege.challenge = challenge;
            player.markDirty('war_college.challenge');

            resp.data.awards = player.addAwards(conf.award,req.mod,req.act);
        }

        player.doGuideTask('war_college', challenge);
     } while (false);

    onHandled();
}



