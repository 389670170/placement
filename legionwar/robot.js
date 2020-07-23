// 军团战机器人军团
var Robot = {
    defUidGen: 1000000,
    uidGen: 0,

    defConf: {
        sid: 0,              // 机器人军团服务器编号
        lid: 110,            // 机器人军团编号
        name: 'RobotLegion',   // 机器人军团名字
        icon: 3,              // 机器人军团图标
        level: 6,              // 机器人军团等级
        score: 0,              // 机器人军团积分
        members: {},             // 机器人军团成员
        fight_force: 0,              // 机器人军团战力
    },

    conf: {},

    init: function (config, enemyLegion) {
        // 清理数据
        this.uidGen = this.defUidGen;
        this.conf = this.defConf;

        // 生成新数据
        this.conf.icon = enemyLegion.icon;
        this.conf.level = enemyLegion.level;
        this.conf.fight_force = enemyLegion.fight_force;

        // 配置
        for (var key in config) {
            if (!config.hasOwnProperty(key)) {
                continue;
            }

            this.conf[key] = config[key];
        }

        // 生成军团成员数据
        for (var mid in enemyLegion.members) {
            if (!enemyLegion.members.hasOwnProperty(mid)) {
                continue;
            }
            this.genMember(enemyLegion.members[mid]);
        }
    },

    genMember: function (member) {
        // 生成阵容数据
        var fightInfo = generateRobot(
            7,
            member.level,
            member.fight_force
        );

        // 设定小兵等级
        var mPos = 1;
        for (var pos in member.fight_info.pos) {
            if (!member.fight_info.pos.hasOwnProperty(pos)) {
                continue;
            }

            if (fightInfo[mPos]) {
                fightInfo[mPos].soldier_level = member.fight_info.pos[pos].soldier_level;
                mPos += 1;
            }
        }

        // 计算模型编号
        var maxFF = 0;
        var model = 0;
        for (var pos in fightInfo) {
            if (!fightInfo.hasOwnProperty(pos)) {
                continue;
            }

            if (fightInfo[pos].fight_force > maxFF) {
                maxFF = +fightInfo[pos].fight_force;
                model = +fightInfo[pos].rid;
            }
        }

        var maxId = Object.keys(gConfName).max();
        var firstId = common.randRange(1, maxId);
        var secondId = common.randRange(1, maxId);
        var male = common.randArray([0, 1]);
        var name = gConfName[firstId].first + gConfName[secondId][male ? "male" : "female"]

        // 生成机器人数据
        var uid = ++this.uidGen;
        var member = {
            uid: uid,
            un: name,
            headpic: member.headpic,
            headframe: member.headframe,
            level: member.level,
            vip: member.vip,
            fight_force: member.fight_force,
            fight_info: {
                name: name,
                pos: fightInfo
            },
            model: model,
            quality: 2,
        };

        this.conf.members[member.uid] = member;
    }
};

exports.Robot = Robot;
