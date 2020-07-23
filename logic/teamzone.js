var ErrorCode = require('../teamzone/error.js').ErrorCode;

// 获取小队领地数据
exports.get = function (player, req, resp, onHandled) {
    do {
        // 检查是否有小队
        if (!player.memData.team_id) {
            resp.code = ErrorCode.ERROR_NO_TEAM; resp.desc = 'no team';
        }

        var user = player.user;
        var tmpData = mapObject(user, gInitWorldUser);
        var updateData = mapObject(tmpData, gTeamZoneUser);

        var teamZoneReq = {
            uid : req.uid,
            mod : 'teamzone',
            act : 'get',
            args : {
                team_id : player.memData.team_id,
                user : updateData,
                serverId : config.ServerId,
            }
        }

        requestTeamZone(teamZoneReq, resp, function () {
            if (resp.code == 0) {

            }

            onHandled();
        });

        return;
    } while (false);

    onHandled();
};

// 移动到指定格子
exports.move_to = function (player, req, resp, onHandled) {
    do {
        // 检查是否有小队
        if (!player.memData.team_id) {
            resp.code = ErrorCode.ERROR_NO_TEAM; resp.desc = 'no team';
        }
        
        requestTeamZone(req, resp, function() {
            if (resp.code == 0) {

            }
            onHandled();
        });

        return;
    } while (false);

    onHandled();
};