function Register() {
    this.globalServer = null;
    this.countryWar = null;
    this.worldWar = null;
    this.legionWar = null;
    this.territoryWar = null;
    this.landgrabber = null;
    this.teamzone = null;
    this.arena = null;
}

Register.prototype = {
    init: function (callback) {
        this.registerAllServer();
        callback && callback(true);
    },

    getBalanceTime: function () {
        var dateStr = common.getDateString();
        var hour = 4;
        var mins = 0;

        return Date.parse(dateStr + " " + hour + ":" + mins + ":00") / 1000;
    },

    registerAllServer: function (balance) {
        this.registerGlobalServer();
        this.registerCountryWar();
        this.registerWorldWar();
        this.registerTerritoryWar();
        this.registerLegionWar();
        this.registerLandGrabber();
        this.registerArena();
        this.registerTeamZone();
    },

    registerGlobalServer: function () {
        if (this.globalServer) {
            clearInterval(this.globalServer);
            this.globalServer = null;
        }

        var self = this;
        this.globalServer = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestGlobalByModAndAct({ uid: 10000 }, 'server', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.globalServer);
                        self.globalServer = null;
                        INFO('REGISTER GLOBAL SERVER SUCCEED');
                    } else {
                        INFO('REGISTER GLOBAL SERVER FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerCountryWar: function () {
        if (this.countryWar) {
            clearInterval(this.countryWar);
            this.countryWar = null;
        }

        var self = this;
        this.countryWar = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestCountryWarByModAndAct({ uid: 10000 }, 'countrywar', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.countryWar);
                        self.countryWar = null;
                        INFO('REGISTER COUNTRYWAR SUCCEED');
                    } else {
                        INFO('REGISTER COUNTRYWAR FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerWorldWar: function () {
        if (this.worldWar) {
            clearInterval(this.worldWar);
            this.worldWar = null;
        }

        var self = this;
        this.worldWar = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestWorldWarByModAndAct({ uid: 1 }, 'worldwar', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.worldWar);
                        self.worldWar = null;
                        INFO('REGISTER WORLDWAR SUCCEED');
                    } else {
                        INFO('REGISTER WORLDWAR FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerLegionWar: function () {
        if (this.legionWar) {
            clearInterval(this.legionWar);
            this.legionWar = null;
        }

        var self = this;
        this.legionWar = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestLegionWarByModAndAct({ uid: 10000 }, 'api', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.legionWar);
                        self.legionWar = null;
                        INFO('REGISTER LEGIONWAR SUCCEED');
                    } else {
                        INFO('REGISTER LEGIONWAR FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerTerritoryWar: function () {
        if (this.territoryWar) {
            clearInterval(this.territoryWar);
            this.territoryWar = null;
        }

        var self = this;
        this.territoryWar = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestTerritoryWarByModAndAct({ uid: 10000 }, 'api', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.territoryWar);
                        self.territoryWar = null;
                        INFO('REGISTER TERRITORYWAR SUCCEED');
                    } else {
                        INFO('REGISTER TERRITORYWAR FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerLandGrabber: function () {
        if (this.landgrabber) {
            clearInterval(this.landgrabber);
            this.landgrabber = null;
        }

        var self = this;
        this.landgrabber = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestLandGrabberByModAndAct({ uid: 1 }, 'landgrabber', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.landgrabber);
                        self.landgrabber = null;
                        DEBUG('REGISTER LANDGRABBER SERVER SUCCEED');
                    } else {
                        DEBUG('REGISTER LANDGRABBER SERVER FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerTeamZone: function () {
        if (this.teamzone) {
            clearInterval(this.teamzone);
            this.teamzone = null;
        }

        var self = this
        this.teamzone = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestTeamZoneByModAndAct({ uid: 1 }, 'teamzone', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.teamzone);
                        self.teamzone = null;
                        DEBUG('REGISTER TEAMZONE SERVER SUCCEED');
                    } else {
                        DEBUG('REGISTER TEAMZONE SERVER FAILED');
                    }
                });
            }
        }, 5000);
    },

    registerArena: function () {
        if (this.arena) {
            clearInterval(this.arena);
            this.arena = null;
        }

        var self = this;
        this.arena = setInterval(function () {
            for (var i = 0; i < gConfGlobalServer.merge_list.length; i++) {
                var tServerID = gConfGlobalServer.merge_list[i];
                requestArenaServerByModAndAct({ uid: 1 }, 'arena', 'register_server', {
                    sid: tServerID,
                    ip: config.WorldHost,
                    port: config.WorldListen,
                    openTime: gConfGlobalServer.serverStartTime,
                }, function (resp) {
                    if (resp.code == 0) {
                        clearInterval(self.arena);
                        self.arena = null;
                        DEBUG('REGISTER ARENA SERVER SUCCEED');
                    } else {
                        DEBUG('REGISTER ARENA SERVER FAILED');
                    }
                });
            }
        }, 5000);
    },
};

exports.Register = Register;