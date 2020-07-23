function Server() {
    this.servers = {                    // 全部World服
        // sid: [ip, port],             // 服务器ID: [地址, 端口]
    };
}

Server.prototype = {
    init: function(callback) {
        setTimeout(function() {
            gCache.get('global_servers', function(err, result) {
                if (result) {
                    this.servers = JSON.parse(result);
                }
                DEBUG('servers: ')
                DEBUG(this.servers);
                callback && callback(true);
            }.bind(this));
        }.bind(this), 1000);
    },

    save: function(callback) {
        gCache.set('global_servers', util.format('%j', this.servers));
        callback(true);
    },
};

exports.register_server = function(req, res, resp) {
    var args = req.args;
    gServer.servers[args.sid] = [args.ip, args.port];
    onReqHandled(res, resp, 1);
};

exports.Server = Server;
