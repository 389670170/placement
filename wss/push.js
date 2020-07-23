// push服务只接受由本地发来的http请求，resp为http的响应, 没有ws响应
exports.push = function(req, resp, onHandled) {
    do {
        DEBUG('-----------------------------');
        if (req.conn) {
            resp.code = 1; resp.desc = 'not support for ws'; break;
        }

        var respData = {
            code : 0,
            mod : req.args.mod,
            act : req.args.act,
            data : {},
        };
        for (var key in req.args) {
            if (key != 'mod' && key != 'act') {
                respData.data[key] = req.args[key];
            }
        }

        // type 为self是push给自己，all是push给所有在线的人，都没有则根据flag push
        if (req.type == "self") {
            broadcastEx([req.uid], respData);
        } else if (req.type == "all") {
            broadcast(respData);
        } else if (req.flag){
            var uids = [];
            for (var uid in gUsers) {
                for (var flag in gUsers[uid].flags) {
                    if (flag == req.flag) {
                        uids.push(uid);
                        break;
                    }
                }
            }
            broadcastEx(uids, respData);
        }
    }while(false);

    onHandled();
}
