function Friend() {
    this.users = {
        /*
        uid : {
            applied : {                 // 申请好友的玩家列表
                uid :
                {
                   time : 0,            // 申请时间
                }
            },
            friends : {                 // 玩家的好友列表
                uid :                   // 好友id
                {
                   gift_receiveid : 0,  // 赠送礼物信息
                   gift_sendid : 0,     // 赠送给好友礼物信息
                },
            },

            boss : {
                type  :   0,            // BOSS类型
                healths : [],           // 剩余血量
                deadtime : 0,           // 死亡时间(5分钟延迟清除)
            },

            dailygift_getnum  : 0,      // 每日领取礼物次数
            boss_score : 0,             // BOSS积分
        }
        */
    };

    this.messages = {
        /*
        uid : {
            friendid : [sendtime,sendmessage,sendvoiceUrl,sendvoicetime],   // 发送玩家Id : 发送时间，发送消息，发送语音url，发送语音长度
        },
        mailnum : 0,      //邮件总数
        */
    };

    this.ranks = new RankTree(              // 实时boss积分排行
        // 存储对象 [uid, bossScore]
        function(c1, c2) {
            if (c1[0] == c2[0]) return 0;

            // 不同人boss积分排先后, 战斗力相等uid排先后
            if (c1[1] > c2[1]) return -1;
            if (c1[1] < c2[1]) return 1;
            return c1[0] < c2[0] ? -1 : 1;
        }
    );

    this.updates = {};
};

Friend.create = function(callback) {
    gDBWorld.insert({_id:'friend', user:{}, message:{}}, function(err, result){callback && callback()});
};

Friend.prototype = {
    init : function(callback) {
        // 读取好友数据和离线消息数据
        gDBWorld.findOne({_id : 'friend'}, {}, function(err, doc){
            if (doc) {
                this.users = doc.user || doc.users || {};
                this.messages = doc.message || doc.messages || {};

                this.initBossRank();
                callback && callback(true);
            } else {
                callback && callback(false);
            }
        }.bind(this));
    },

    markDirty : function(type, uid, name) {
        if (type == 'user') {
            this.updates[util.format('%s.%d.%s', type ,uid, name)] = this.users[uid][name];
        } else if (type == 'message') {
            this.updates[util.format('%s.%d',type, uid)] = this.messages[uid];
        }
    },

    save : function(force, callback) {
        if (!force &&  Object.keys(this.updates).length < 10 ||  Object.keys(this.updates).length == 0){
            callback && callback(true);
            return;
        }

        var updates = this.updates;
        this.updates = {};

        gDBWorld.update({_id :'friend'}, {$set:updates}, function(err, result){
            if (err) {
                ERROR(util.format('SAVE INVITE: %j %j', updates, err));
                callback && callback(false);
            } else {
                callback && callback(true);
            }
        });
    },

    getUser : function(uid) {
        var user = this.users[uid];

        if (!user) {
            user = {
                'applied' : {},
                'friends' : {},
                'boss'    : {},
                'dailygift_getnum' : 0,
                'boss_score': 0,
            }
            if (uid in gUserInfo.users) {
                this.users[uid] = user;
                this.markDirty('user', uid, 'applied');
                this.markDirty('user', uid, 'friends');
                this.markDirty('user', uid, 'dailygift_getnum');
                this.markDirty('user', uid, 'boss');
                this.markDirty('user', uid, 'boss_score');
            }
        }

        return user;
    },

    getUserFriend : function(uid,friendId) {
        var user = this.users[uid];
        var friend = user.friends[friendId];
        if (!friend){
            friend = {
                'gift_sendid' : 0,
                'gift_receiveid' : 0,
            }
            this.users[uid] = this.users[uid] || {};
            this.users[uid].friend = this.users[uid].friend || {};
            this.users[uid].friend[friendId] = friend;
            this.markDirty('user', uid, 'friends');
        }
        return friend;
    },

    deleteApply : function(uid, friendId) {
        var userInfo = this.users[uid];
        if (friendId in userInfo.applied) {
            delete userInfo.applied[friendId];
            this.markDirty('user', uid, 'applied');
        }
    },

    deleteAllApply : function(uid) {
        var userInfo = this.users[uid];
        userInfo.applied = {};
        this.markDirty('user', uid, 'applied');
    },

    addFriend : function(uid, friendId) {
        this.users[uid].friends[friendId] = {};
        this.markDirty('user', uid, 'friends');

        this.users[friendId].friends[uid] = {};
        this.markDirty('user', friendId, 'friends');
    },

    applyFriend : function(uid, friendId) {
        var friendInfo = this.getUser(friendId);
        var appliedUid = friendInfo.applied[uid];
        if (!appliedUid) {
            appliedUid = friendInfo.applied[uid] = {};
        }
        appliedUid['time'] = common.getTime();
        this.markDirty('user', friendId, 'applied');
    },

    checkFriend : function(uid, checkId){
        var userInfo = this.users[uid];
        if (!userInfo) {
            return false;
        }

        if (checkId in userInfo.friends) {
            return true;
        }
        return false;
    },

    deleteFriend : function(uid, friendId) {
        var userInfo = this.users[uid];
        if (friendId in userInfo.friends) {
            delete userInfo.friends[friendId];
            this.markDirty('user', uid, 'friends');
        }

        var friendInfo = this.users[friendId];
        if (uid in friendInfo.friends) {
            delete friendInfo.friends[uid];
            this.markDirty('user', friendId, 'friends');
        }
    },

    getUserMessageInfo : function(uid){
        var userMessageInfo = this.messages[uid];
        if (!userMessageInfo) {
            userMessageInfo = {};
            if (uid in gUserInfo.users) {
                this.messages[uid] = userMessageInfo;
                this.markDirty('message', uid);
            }

            return userMessageInfo;
        }
    },

    getUserFriendMessageInfo : function(uid, friendId){
        var userMessageInfo = this.messages[uid];
        if (!userMessageInfo){
            userMessageInfo = {};
            this.messages[uid] = userMessageInfo;
            this.markDirty('message', uid);
        }

        var friendOffMessage = userMessageInfo[friendId];
        if (!friendOffMessage) {
            friendOffMessage = [];
            userMessageInfo[friendId] = friendOffMessage;
            this.markDirty('message', uid);
        }

        return friendOffMessage;
    },

    getMessageInfoToClient : function(uid ,friendId){
        var data = [];
        var userMessageInfo = this.messages[uid];
        if (!userMessageInfo) {
            return data;
        }

        var friendOffMessage = userMessageInfo[friendId];
        if (!friendOffMessage) {
            return data;
        }

        for(var i=0,length = friendOffMessage.length; i<length ; i++){
            var messagedata ={};
            messagedata.senduid = friendId;
            messagedata.receiveuid = uid;
            messagedata.time = friendOffMessage[i][0];
            messagedata.content = friendOffMessage[i][1];
            if (friendOffMessage[i][2] != '') {
                messagedata.voice_url = friendOffMessage[i][2];
                messagedata.voice_time = friendOffMessage[i][3];
            }
            data.push(messagedata);
        }
        return data;
    },

    removeOverTimeMessage : function(){
        var removeMailNum = 0;
        for (var uid in this.messages){
            for (var friendId in this.messages[uid]){
                 this.messages[uid][friendId].forEach(function(value, index, array){
                    if (value[0] + gConfGlobalNew.friendOverTime*3600  < common.getTime()){
                        array.splice(index,1);
                        removeMailNum++;
                    }
                });
            }
            this.markDirty('message',uid);
        }

        if (removeMailNum) {
            this.messages.mailnum -= removeMailNum;
            this.updates['message.mailnum'] = this.messages.mailnum;
        }
    },

    checkNewMessage : function(uid){
        if (!this.messages[uid])
            return false;
        for (var friendMessage in this.messages[uid]){
            if (friendMessage.length){
                this.sendTips(uid,'friend_message');
                return true
            }
        }
        return false;
    },

    removeMessage : function(uid, friendId, needMarkDirty){
        var userMessageInfo = this.messages[uid];
        if (!userMessageInfo) {
            return;
        }

        var friendOffMessage = userMessageInfo[friendId];
        if (!friendOffMessage) {
            return;
        }

        if (!friendOffMessage.length) {
            return;
        }

        this.messages.mailnum = this.messages.mailnum - friendOffMessage.length;
        this.updates['message.mailnum'] = this.messages.mailnum;
        this.messages[uid].friendId = [];
        if (needMarkDirty) {
            this.markDirty('message', uid);
        }
    },

    deleteMessage : function(uid){
        delete this.messages[uid];
        this.markDirty('message', uid);
    },

    generateBaseDate : function (uid){
        var userInfo = gUserInfo.getUser(uid);
        // 获取阵容信息
        var hids = [];
        for (var i in userInfo.pos) {
            hids.push(userInfo.pos[i].rid);
        }

        var combatConf = getHeroCombatConf(userInfo.pos[1].rid);
        var lid = gNewLegion.userLegion[uid];
        var data = {
            'uid' : uid,
            'vip' : userInfo.status.vip,
            'quality': combatConf ? combatConf.quality : 1,
            'name' : userInfo.info.un,
            'fight_force' : userInfo.fight_force,
            'level' : userInfo.status.level,
            'headpic' : userInfo.info.headpic,
            'headframe' : userInfo.info.headframe,
            'last_active' : userInfo.mark.active_time,
            'legion_name' : lid ? gNewLegion.legions[lid].name : "",
            'legion_icon' : lid ? gNewLegion.legions[lid].icon : 0,
            'offlineMessage': [],
            'hasGiftSend' : 0,
            'hasGiftReceive':0,
            'hasfightboss': this.checkVisualBoss(uid),
            'fightforcerank' : gUserInfo.ranks.rankById(uid),
            'levelrank' : gUserInfo.lvRanks.rankById(uid),
            'hids' : hids,
            'custom_king' : userInfo.custom_king,
        };
        return data;
    },

    generateRankData : function(uid){
        var userInfo = gUserInfo.getUser(uid);

        var combatConf = getHeroCombatConf(userInfo.pos[1].hid);
        var lid = gNewLegion.userLegion[uid];
        var data = {
            'uid' : uid,
            'vip' : userInfo.status.vip,
            'quality': combatConf ? combatConf.quality : 1,
            'name' : userInfo.info.un,
            'fight_force' : userInfo.fight_force,
            'level' : userInfo.status.level,
            'headpic' : userInfo.info.headpic,
            'headframe' : userInfo.info.headframe,
            'last_active' : userInfo.mark.active_time,
            'legion_name' : lid ? gNewLegion.legions[lid].name : "",
            'boss_score'  : this.getBossScore(uid),
            'custom_king' : userInfo.custom_king,
        };
        return data;
    },

    getBoss : function(uid){
        var userInfo = this.getUser(uid);
        return userInfo.boss;
    },

    checkBoss : function(uid){
        var userInfo = this.getUser(uid);
        var bossInfo = userInfo.boss;

        if (Object.isEmpty(bossInfo)) {
            return false;
        }

        if (!bossInfo.deadtime) {
            return true;
        }

        return true;
    },

    checkFightBoss : function(uid){
        var userInfo = this.getUser(uid);
        var bossInfo = userInfo.boss;

        if (Object.isEmpty(bossInfo)) {
            return false;
        }

        return true;
    },

    addBossScore : function(uid, score){
        var userInfo = this.getUser(uid);
        userInfo.boss_score += Math.ceil(score);
        if (userInfo.boss_score) {
            this.ranks.update([uid, userInfo.boss_score]);
        }

        this.markDirty('user', uid, 'boss_score');
    },

    getBossScore : function(uid) {
        var userInfo = this.getUser(uid);
        return  Math.floor(userInfo.boss_score);
    },

    transBossHeaths : function(heaths) {
        var perHeath = 0.0;
        var max = heaths.length;
        var totalheath = 0.0;
        for (var i = 0; i < max;i++) {
            totalheath += heaths[i];
        }
        if (max != 0) {
            perHeath = (totalheath/max).toFixed(2);
        }
        return perHeath;
    },

    sendTips : function(uid,tipsInfo) {
        gTips.addTip(uid,tipsInfo);
    },

    checkVisualBoss : function(uid) {
        return false;
    },

    checkBossDeath : function(uid){
        var userInfo = this.getUser(uid);
        var bossInfo = userInfo.boss;

        if (Object.isEmpty(bossInfo)) {
            return true;
        }

        if (bossInfo.deadtime) {
            return true;
        }

        return false;
    },

    creatBoss: function(uid, type, formationId){
        var userInfo = this.getUser(uid);
        if (!userInfo.boss) {
            userInfo.boss = {};
        }

        var bossInfo = userInfo.boss;
        bossInfo.type = type;
        bossInfo.deadtime = 0;
        bossInfo.healths = [];
        var formationConf = gConfFormation[formationId];
        for (var i = 1; i <= 9; i++) {
            var monsterId = formationConf['pos' + i];
            if (monsterId) {
                bossInfo.healths.push(100);
            }
        }
        this.markDirty('user', uid, 'boss');
    },

    killBoss : function(uid){
        var bossInfo = this.getBoss(uid);
        if (Object.isEmpty(bossInfo)) {
            return false;
        }

        if (!bossInfo.deadtime) {
            bossInfo.deadtime = common.getTime();
            this.markDirty('user', uid, 'boss');
            return true;
        }

        return false;
    },

    pushUserBoss : function(uid){
        var userInfo  = this.getUser(uid);
        var hasFriend = false;
        var uids = [];
        for (var friendId in userInfo.friends){
            uids.push(friendId);
            hasFriend = true;
        }

        if (hasFriend){
            var data = this.generateBaseDate(uid);
            data.mod = 'chat';
            data.act = 'friend_boss';
        }
        pushToGroupUser(uids,'self',data);
    },

    initBossRank : function(){
        for (var id in this.users){
            var bossScore = Math.floor(this.getUser(id).boss_score);
            if (!bossScore) {
                continue;
            }
            this.ranks.insert([+id, bossScore]);
        }
    },

    getBossScoreRank : function(uid){
        var score = this.getBossScore(uid);
        if (!score) {
            return 0;
        }
        return this.ranks.rankById(uid);
    },

    transGiftInfo : function(uid ,friendId){
        // 1可发送没有接受, 2可发送可接受 ，3不能发送没有接受, 4不能发送可接受
        var status = 0;
        var giftInfo = gFriend.getUserFriend(uid, friendId);
        if (!giftInfo.gift_sendid) {
            if (!giftInfo.gift_receiveid) {
                status = 1;
            } else {
                status = 2;
            }
        } else {
            if (!giftInfo.gift_receiveid) {
                status = 3;
            } else {
                status = 4;
            }
        }
        return status;
    },

    updateFigthBossToCli : function(uid,resp){
        resp.data.hasfightboss =  this.checkVisualBoss(uid);
    },

    resetByDay : function(){
        for(var uid in this.users){
            var userInfo = this.users[uid];

            if(userInfo.dailygift_getnum){
                userInfo.dailygift_getnum = 0;
                this.markDirty('user', uid, 'dailygift_getnum');
            }

            for(var friendId in userInfo.friends){
                var giftInfo = this.getUserFriend(uid, friendId);
                if (giftInfo.gift_sendid || giftInfo.gift_receiveid){
                    giftInfo.gift_sendid = 0;
                    giftInfo.gift_receiveid = 0;
                    this.markDirty('user', uid, 'friends');
                }
            }
        }

        this.removeOverTimeMessage();
    },

    resetByWeek : function(){
        gSysMail.addBossScoreAwardMail();
        for (var uid in this.users) {
            var userInfo = this.users[uid];
            if (userInfo.boss_score) {
               userInfo.boss_score = 0;
               this.markDirty('user', uid, 'boss_score');
            }
        }
        this.ranks.erase();
    },
};

exports.get = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var friendInfo = gFriend.getUser(uid);
        resp.data.applied = [];
        resp.data.friends = [];

        for (var id in friendInfo.applied) {
            var data = gFriend.generateBaseDate(id);
            data.time = friendInfo.applied[id].time;
            resp.data.applied.push(data);
        }

        for(var id in friendInfo.friends) {
            var userInfo = gUserInfo.getUser(id);
            var userOffineMessage = gFriend.getMessageInfoToClient(uid,id);
            var giftInfo = gFriend.getUserFriend(uid, id);
            var data = gFriend.generateBaseDate(id);
            data.offlineMessage = userOffineMessage;
            data.hasGiftSend = giftInfo.gift_sendid ? 1:0;
            data.hasGiftReceive = giftInfo.gift_receiveid ? 1:0;
            resp.data.friends.push(data);

            gFriend.removeMessage(uid,id);
            userOffineMessage = gFriend.getUserFriendMessageInfo(uid,id);
        }
        gFriend.deleteMessage(uid);
        resp.data.dailyGiftGetNum = friendInfo.dailygift_getnum;
        resp.data.hasfightboss = gFriend.checkFightBoss(uid);
        gTips.resetTipType(uid,'friend_message');
        gTips.resetTipType(uid,'friend_gift');
        gTips.resetTipType(uid,'friend_apply');
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.apply = function(req, res, resp) {
    // status: 0 正常 1 已经是好友 2 已经发送过申请 3 自己好友列表已满 4 对方好友列表已满 5 对方已经发送过申请
    var uid = +req.uid;
    var friendId = parseInt(req.args.id);
    var userInfo = gFriend.getUser(uid);
    var friendInfo = gFriend.getUser(friendId);
    var status = 0;

    do {
        //自己不能加自己为好友
        if (uid == friendId){
            status = 10; break;
        }

        // 该玩家不纯在
        if (!(friendId in gUserInfo.users)) {
            status = 6; break;
        }

        // 该玩家等级不足
        if (!isModuleOpenByWorld(gUserInfo.users[friendId], 'friend')){
            status = 7;  break;
        }
        // 已经是自己的好友
        if (friendId in userInfo.friends) {
            status = 1; break;
        }

        // 已经发送过申请
        if (uid in friendInfo.applied) {
            status = 2; break;
        }

        var userCount = Object.keys(userInfo.applied).length + Object.keys(userInfo.friends).length;
        // 自己好友列表已满
        if (userCount >= gConfGlobalNew.friendNumLimit) {
            status = 3; break;
        }

        // 对方好友申请已满
        var friendApplyCount = Object.keys(friendInfo.applied).length;
        if (friendApplyCount >= gConfGlobalNew.friendApplyNumLimit){
            status = 9; break;
        }

        var friendCount = Object.keys(friendInfo.friends).length;
        // 对方好友列表已满
        if (friendCount >= gConfGlobalNew.friendNumLimit) {
            status = 4; break;
        }

        // 对方已经申请过自己，则申请通过
        if (friendId in userInfo.applied) {
            gFriend.addFriend(uid, friendId);
            gFriend.deleteApply(uid, friendId);
            var data = gFriend.generateBaseDate(friendId);
            resp.data = data;
            status = 5; break;
        }

        // 向对方发申请消息
        if (friendId > 10000) {
            gFriend.applyFriend(uid, friendId);
        }

        gFriend.sendTips(friendId, 'friend_apply');
    } while (false);

    resp.data.status = status;

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

// 一键申请
exports.apply_all = function (req, res, resp) {
    var uid = +req.uid;
    var friendIds = req.args.ids;
    var userInfo = gFriend.getUser(uid);
    var friendInfo = gFriend.getUser(friendId);
    var status = 0;

    do {
        for (var i = 0; i < friendIds.length; i++) {
            var friendId = parseInt(friendIds[i]);

            //自己不能加自己为好友
            if (uid == friendId){
                status = 10; continue;
            }

            // 该玩家不纯在
            if (!(friendId in gUserInfo.users)) {
                status = 6; continue;
            }

            // 该玩家等级不足
            if (!isModuleOpenByWorld(gUserInfo.users[friendId], 'friend')){
                status = 7;  continue;
            }
            // 已经是自己的好友
            if (friendId in userInfo.friends) {
                status = 1; continue;
            }

            // 已经发送过申请
            if (uid in friendInfo.applied) {
                status = 2; continue;
            }

            var userCount = Object.keys(userInfo.applied).length + Object.keys(userInfo.friends).length;
            // 自己好友列表已满
            if (userCount >= gConfGlobalNew.friendNumLimit) {
                status = 3; continue;
            }

            // 对方好友申请已满
            var friendApplyCount = Object.keys(friendInfo.applied).length;
            if (friendApplyCount >= gConfGlobalNew.friendApplyNumLimit){
                status = 9; continue;
            }

            var friendCount = Object.keys(friendInfo.friends).length;
            // 对方好友列表已满
            if (friendCount >= gConfGlobalNew.friendNumLimit) {
                status = 4; continue;
            }

            // 对方已经申请过自己，则申请通过
            if (friendId in userInfo.applied) {
                gFriend.addFriend(uid, friendId);
                gFriend.deleteApply(uid, friendId);
                var data = gFriend.generateBaseDate(friendId);
                resp.data = data;
                status = 5; continue;
            }

            // 向对方发申请消息
            if (friendId > 10000) {
                gFriend.applyFriend(uid, friendId);
            }

            gFriend.sendTips(friendId, 'friend_apply');
        }
    } while (false);

    resp.data.status = 0;
    onReqHandled(res, resp, 1);
};

exports.applyByName = function(req, res, resp) {
    // status: 0 正常 1 已经是好友 2 已经发送过申请 3 自己好友列表已满 4 对方好友列表已满 5 对方已经发送过申请
    var uid = +req.uid;
    var friendName = req.args.name;
    var userInfo = gFriend.getUser(uid);
    var friendId = gUserInfo.userName[friendName];
    if (!friendId) {
        friendId = parseInt(friendName);
    }

    var friendInfo = gFriend.getUser(friendId);

    var status = 0;
    do {
        if (friendName == ''){
            resp.code = 1; resp.desc = "invalid name"; break;
        }

        if (friendId == uid){
            status = 10; break;
        }

        // 该玩家不存在
        if (!(friendId in gUserInfo.users)) {
            DEBUG('#### friendId = ' + friendId);
            status = 6;  break;
        }

        // 该玩家等级不足
        if (!isModuleOpenByWorld(gUserInfo.users[friendId], 'friend')){
            status = 7;  break;
        }

        // 已经是自己的好友
        if (friendId in userInfo.friends) {
            status = 1; break;
        }

        // 已经发送过申请
        if (uid in friendInfo.applied) {
            status = 2; break;
        }

        var userCount = Object.keys(userInfo.applied).length + Object.keys(userInfo.friends).length;
        // 自己好友列表已满
        if (userCount >= gConfGlobalNew.friendNumLimit) {
            status = 3; break;
        }

        // 对方好友申请已满
        var friendApplyCount = Object.keys(friendInfo.applied).length;
        if (friendApplyCount >= gConfGlobalNew.friendApplyNumLimit){
            status = 9; break;
        }

        var friendCount =  Object.keys(friendInfo.friends).length;
        // 对方好友列表已满
        if (friendCount >= gConfGlobalNew.friendNumLimit) {
            status = 4; break;
        }

        // 对方已经申请过自己，则申请通过
        if (friendId in userInfo.applied) {
            gFriend.addFriend(uid, friendId);
            var data = gFriend.generateBaseDate(friendId);
            resp.data.basedata = data;
            gFriend.deleteApply(uid, friendId);
            status = 5; break;
        }

        // 向对方发申请消息
        gFriend.applyFriend(uid, friendId);

        gFriend.sendTips(friendId,'friend_apply');

    }while (false);

    resp.data.status = status;

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.handle_apply = function(req, res, resp) {
    var uid = + req.uid;
    do{
        var friendId = req.args.id;
        var userInfo = gFriend.getUser(uid);

        if (!(friendId in gUserInfo.users)) {
            resp.code = 1; resp.desc = "invalid id"; break;
        }

        // 已经是自己的好友，这种情况不应该出现
        if (friendId in userInfo.friends) {
            gFriend.deleteApply(uid, friendId);
            resp.data.succ = 1; break;
        }

        if (!(friendId in userInfo.applied)) {
            resp.code = 1; resp.desc = "not in applied"; break;
        }

        var agree = req.args.agree ? true : false;
        gFriend.deleteApply(uid, friendId);

        var friendInfo = gFriend.getUser(friendId);
        if (agree) {
            var friendCount =  Object.keys(userInfo.friends).length;
            if (friendCount >= gConfGlobalNew.friendNumLimit) {
                var status = 11;
                resp.data.status = status;
                break;
            }

            // 对方好友列表已满
            var friendCount =  Object.keys(friendInfo.friends).length;
            if (friendCount >= gConfGlobalNew.friendNumLimit) {
                resp.data.status = 4;
                break;
            }

            if (uid in friendInfo.applied) {
                gFriend.deleteApply(friendId, uid);
            }

            gFriend.addFriend(uid, friendId);
            var data = gFriend.generateBaseDate(friendId);
            resp.data.basedata = data;
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

// 一键同意所有申请
exports.agree_all_apply = function (req, res, resp) {
    var uid = +req.uid;
    do{
        resp.data.basedata = {};
        var friendIds = req.args.ids;
        for (var i = 0; i < friendIds.length; i++) {
            var friendId = friendIds[i];

            var userInfo = gFriend.getUser(uid);

            if (!(friendId in gUserInfo.users)) {
                continue;
            }

            // 已经是自己的好友，这种情况不应该出现
            if (friendId in userInfo.friends) {
                gFriend.deleteApply(uid, friendId);
                resp.data.succ = 1; continue;
            }

            // 不在申请列表
            if (!(friendId in userInfo.applied)) {
                continue;
            }

            var agree = req.args.agree ? true : false;
            gFriend.deleteApply(uid, friendId);

            var friendInfo = gFriend.getUser(friendId);
            if (agree) {
                var friendCount = Object.keys(userInfo.friends).length;
                if (friendCount >= gConfGlobalNew.friendNumLimit) {
                    var status = 11;
                    resp.data.status = status;
                    continue;
                }

                // 对方好友列表已满
                var friendCount = Object.keys(friendInfo.friends).length;
                if (friendCount >= gConfGlobalNew.friendNumLimit) {
                    resp.data.status = 4;
                    continue;
                }

                if (uid in friendInfo.applied) {
                    gFriend.deleteApply(friendId, uid);
                }

                gFriend.addFriend(uid, friendId);
                var data = gFriend.generateBaseDate(friendId);
                resp.data.basedata[friendId] = data;
            }
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.remove_apply = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gFriend.getUser(uid);
        for(var friendId in userInfo.applied) {
            gFriend.deleteApply(uid, friendId);
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

// 一键删除所有申请
exports.remove_all_apply = function (req, res, resp) {
    var uid = +req.uid;
    do {
        gFriend.deleteAllApply(uid);
    } while (false);

    gFriend.save(false);
    onReqHandled(res, resp, 1);
};

// 删除好友
// 支持批量删除
exports.remove = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var uids = req.args.ids;
        for (var i = 0; i < uids.length; i++) {
            var friendId = Math.floor(uids[i]);
            var userInfo = gFriend.getUser(uid);

            if (!(friendId in userInfo.friends)) {
                resp.data.status = 8; break;
            }

            gFriend.removeMessage(uid, friendId, true);
            gFriend.deleteFriend(uid, friendId);
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.give_gift = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var friendId = Math.floor(req.args.id);
        var userInfo = gFriend.getUser(uid);
        var friendInfo = gFriend.getUser(friendId);

        if (!(friendId in userInfo.friends)) {
            resp.code = 1; resp.desc = ' not friend'; break;
        }
        var userGiftInfo = gFriend.getUserFriend(uid, friendId);
        if (userGiftInfo.gift_sendid){
            resp.code = 1; resp.desc = ' already sendGift'; break;
        }

        var friendGiftInfo = gFriend.getUserFriend(friendId, uid);

        var giftConf = parseAwardsConfig(gConfGlobalNew.friendGift);
        userGiftInfo.gift_sendid = giftConf[0][1];
        friendGiftInfo.gift_receiveid = giftConf[0][1];

        gFriend.markDirty('user', friendId, 'friends');
        gFriend.markDirty('user', uid, 'friends');

        gFriend.sendTips(friendId,'friend_gift');

    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.giveall_gift = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gFriend.getUser(uid);

        var isSend = false;
        for (var friendId in userInfo.friends) {
            var userGiftInfo = gFriend.getUserFriend(uid, friendId);
            if (!userGiftInfo.gift_sendid) {
                var giftConf = parseAwardsConfig(gConfGlobalNew.friendGift);
                userGiftInfo.gift_sendid = giftConf[0][1];
                var friendGiftInfo = gFriend.getUserFriend(friendId, uid);
                friendGiftInfo.gift_receiveid = giftConf[1];
                isSend = true;
            }
        }

        if (isSend){
            gFriend.markDirty('user', friendId, 'friends');
            gFriend.markDirty('user', uid, 'friends');
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.deal_gift = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gFriend.getUser(uid);

        var isSend = false;
        for (var friendId in userInfo.friends) {
            var userGiftInfo = gFriend.getUserFriend(uid, friendId);
            if (!userGiftInfo.gift_sendid) {
                var giftConf = parseAwardsConfig(gConfGlobalNew.friendGift);
                userGiftInfo.gift_sendid = giftConf[0][1];
                var friendGiftInfo = gFriend.getUserFriend(friendId, uid);
                friendGiftInfo.gift_receiveid = giftConf[0][1];
                isSend = true;
            }
        }

        if (isSend){
            gFriend.markDirty('user', friendId, 'friends');
            gFriend.markDirty('user', uid, 'friends');
        }

        var userInfo = gFriend.getUser(uid);
        if (userInfo.dailygift_getnum >= gConfGlobalNew.friendDailyGiftGetLimit){
            resp.code = 0; resp.desc = 'daily get gift limit '; break;
        }

        var getNum = 0;
        var uids = [];
        for (var friendId in userInfo.friends){
            var userGiftInfo = gFriend.getUserFriend(uid, friendId);
            if (userGiftInfo.gift_receiveid) {
                userInfo.dailygift_getnum++;
                userGiftInfo.gift_receiveid = 0;
                getNum++;
                uids.push(parseInt(friendId));
                gFriend.sendTips(friendId, 'friend_gift');
                if (userInfo.dailygift_getnum >= gConfGlobalNew.friendDailyGiftGetLimit) {
                    break;
                }
            }
        }

        if (getNum) {
            resp.data.getNum = getNum;
            resp.data.uids = uids;  // 接受了哪些玩家的礼物
            gFriend.markDirty('user', uid, 'friends');
            gFriend.markDirty('user', uid, 'dailygift_getnum');
        }

        gTips.resetTipType(uid,'friend_gift');
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);

}

exports.get_gift = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var friendId = Math.floor(req.args.id);
        var userInfo = gFriend.getUser(uid);

        if (!(friendId in userInfo.friends)) {
            resp.code = 103; resp.desc = ' not friend'; break;
        }

        if (userInfo.dailygift_getnum >= gConfGlobalNew.friendDailyGiftGetLimit){
            resp.code = 1; resp.desc = 'daily get gift limit '; break;
        }

        var userGiftInfo = gFriend.getUserFriend(uid, friendId);

        if (!userGiftInfo.gift_receiveid) {
            resp.code = 1; resp.desc = 'already get gift '; break
        }

        userGiftInfo.gift_receiveid = 0;
        userInfo.dailygift_getnum++;

        gFriend.markDirty('user', uid, 'friends');
        gFriend.markDirty('user', uid, 'dailygift_getnum');
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.getall_gift = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var userInfo = gFriend.getUser(uid);
        if (userInfo.dailygift_getnum >= gConfGlobalNew.friendDailyGiftGetLimit){
            resp.code = 1; resp.desc = 'daily get gift limit '; break;
        }

        var getNum = 0;
        var uids = [];
        for (var friendId in userInfo.friends) {
            var userGiftInfo = gFriend.getUserFriend(uid, friendId);
            if (userGiftInfo.gift_receiveid) {
                userInfo.dailygift_getnum++;
                userGiftInfo.gift_receiveid = 0;
                getNum++;
                uids.push(parseInt(friendId));
                if (userInfo.dailyGiftGetNum >= gConfGlobalNew.friendDailyGiftGetLimit) {
                    break;
                }
            }
        }

        if (getNum) {
            resp.data.getNum = getNum;
            resp.data.uids = uids;  // 接受了哪些玩家的礼物
            gFriend.markDirty('user', uid, 'friends');
            gFriend.markDirty('user', uid, 'dailygift_getnum');
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.get_user = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var name = req.args.name;
        var users = gUserInfo.users;
        var isGetName = false;
        for (var id  in users) {
            var  userInfo = users[id];
            if (userInfo.info.un == name) {
                //var userInfo = gUserInfo.getUser(id);
                var lid = gNewLegion.userLegion[id];
                resp.data.fight_force = userInfo.fight_force;
                resp.data.id = id;
                resp.data.vip = userInfo.status.vip;
                resp.data.quality = gConfHero[userInfo.pos[1].hid].quality;
                resp.data.level = userInfo.status.level;
                resp.data.headpic = userInfo.info.headpic;
                resp.data.headframe = userInfo.info.headframe;
                resp.data.last_active = userInfo.mark.active_time;
                resp.data.legion_name = lid ? gNewLegion.legions[lid].name : "";

                if (id in gFriend.getUser(uid).friends) {
                    resp.data.friended = 1;
                } else if (uid in gFriend.getUser(id).applied) {
                    resp.data.friended = 2;
                } else {
                    resp.data.friended = 0;
                }
                isGetName = true;
                break;
            }
        }

        if (!isGetName) {
            resp.code = 1; resp.desc = 'no this user'; break;
        }
    }while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.recommend = function(req, res, resp) {
    var uid = +req.uid;
    do {
        var candidateIds = [];
        var users = gUserInfo.users;
        var userInfo = gFriend.getUser(uid);
        var applyedUids = [];

        for (var id in users) {
            if (id == uid) {
                // 自己
                continue;
            }

            if (!isModuleOpenByWorld(users[id], 'friend')) {
                // 对方还没有开好友系统
                continue;
            }

            if (id in userInfo.friends) {
                // 已经是好友的不推荐
                continue;
            }

            var friendInfo = gFriend.getUser(id);
            if (uid in friendInfo.applied) {
                // 已经向对方发过申请了
                applyedUids.push(id);
                continue;
            }

            candidateIds.push(id);
        }

        if (candidateIds.length < gConfGlobalNew.friendRecommendCount) {
            for (var i = candidateIds.length; i < gConfGlobalNew.friendRecommendCount; i++) {
                if (applyedUids.length > 0) {
                    candidateIds.push(applyedUids[0]);
                    applyedUids.splice(0, 1);
                }
            }
        }

        candidateIds.sort(function(a, b){ return (Math.random() > 0.5) ? 1 : -1;});
        var recommend = [];
        var count = 0;
        for (var i = 0, len = candidateIds.length; i < len && count < gConfGlobalNew.friendRecommendCount; i++) {
            var id = candidateIds[i];
            var userInfo = users[id];
            var lid = gNewLegion.userLegion[id];
            var data = gFriend.generateBaseDate(id);
            recommend.push(data);
            count++;
        }
        resp.data.recommend = recommend;
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.friend_chat = function(req, res, resp) {
    var uid = +req.uid;
    do {

        var friendId = Math.floor(req.args.friendId);
        var userInfo = gFriend.getUser(uid);
        var friendInfo = gFriend.getUser(friendId);

        if (!(friendId in userInfo.friends)) {
            resp.code = 102; resp.desc = ' not friend'; break;
        }

        if (gFriend.messages.mailnum >= gConfGlobalNew.friendMessageMax) {
            resp.code = 1; resp.desc = 'message already Max'; break;
        }

        var friendOffline = req.args.friendOffline ;
        if (friendOffline){
            var userOffineMessage = gFriend.getUserFriendMessageInfo(friendId,uid);
            var time = common.getTime();
            var message = req.args.content;
            var voiceUrl = req.args.voice_url;
            var voiceTime = req.args.voice_time;

            userOffineMessage.push([time, message, voiceUrl, voiceTime]);
            gFriend.markDirty('message', friendId);
            gFriend.messages.mailnum++;
            gFriend.updates['message.mailnum'] = gFriend.messages.mailnum;
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.get_message = function(req, res, resp){
    var uid = req.uid;
    do {
        var friendId = Math.floor(req.args.friendId);
        var userInfo = gFriend.getUser(uid);
        var friendInfo = gFriend.getUser(friendId);

        if (!(friendId in userInfo.friends)) {
            resp.code = 1; resp.desc = ' not friend'; break;
        }

        var userOffineMessage = gFriend.getUserFriendMessageInfo(uid, friendId);
        gFriend.messages.mailnum = gFriend.messages.mailnum - userOffineMessage.length;
        resp.date.messageInfo = userOffineMessage;
        userOffineMessage[friendId] = [];
        gFriend.markDirty('message', uid);
        gFriend.updates['message.mailnum'] = gFriend.messages.mailnum;
    } while (false);

    gFriend.save(false);
    onReqHandled(res,resp,1);
};

exports.check_newMessage = function(uid) {
    for (var uid in this.messages[uid]) {
        for (var friendMessage in uid) {
            if (friendMessage.length) {
                return true;
            }
        }
    }
    return false;
};

exports.challenge = function(req, res, resp) {
    var uid = req.uid;
    do {
        var enemyId = req.args.enemy;
        var userInfo = gFriend.getUser(uid);
        if (!(enemyId in userInfo.friends)) {
            resp.code = 103; resp.desc = ' not friend'; break;
        }

        var enemy = gUserInfo.getUserFightInfo(enemyId);

        var replay = {
            enemy: enemy,
            rand1: common.randRange(0, 99999),
            rand2: common.randRange(0, 99999),
        }

        resp.data = replay;
    } while (false);

    onReqHandled(res, resp, 1);
};

exports.get_enemy = function(req, res, resp) {
    var uid = req.uid;
    var bossOwnerId = req.args.bossOwnerId;
    do {
        if (uid!=bossOwnerId &&  !gFriend.checkFriend(uid , bossOwnerId)) {
            resp.code = 1; resp.desc = 'no friend'; break;
        }

        if (!gFriend.checkFightBoss(bossOwnerId)) {
            resp.code = 100; resp.desc = 'no fight boss '; break;
        }

        var enemy = gUserInfo.getUserFightInfo(bossOwnerId);
        var promote = {};
        for (var id in enemy.pos) {
            promote[id] = enemy.pos[id].promote;
        }

        var boss = gFriend.getBoss(bossOwnerId);
        resp.data.promote = promote;
        resp.data.healths = boss.healths;
        resp.data.bossId = boss.type;
    } while (false);

    gFriend.save(false);
    onReqHandled(res, resp, 1);
};

exports.get_boss = function(req, res, resp) {
    var uid = req.uid;
    var bossOwnerId = req.args.bossOwnerId;
    do {
        if (uid!=bossOwnerId && !gFriend.checkFriend(uid , bossOwnerId)) {
            resp.code = 1; resp.desc = 'no friend'; break;
        }

        if (!gFriend.checkFightBoss(bossOwnerId)) {
            resp.code = 100; resp.desc = 'no fight boss '; break;
        }

        var boss = gFriend.getBoss(bossOwnerId);
        resp.data.healths = gFriend.transBossHeaths(boss.healths);
        resp.data.bossId = boss.type;
    } while (false);

    gFriend.save(false);
    onReqHandled(res, resp, 1);
};

exports.before_fight = function(req, res, resp) {
    var uid = req.uid;
    var bossOwnerId = req.args.bossOwnerId;
    do {
        if (uid!=bossOwnerId && !gFriend.checkFriend(uid , bossOwnerId)) {
            resp.code = 1; resp.desc = 'no friend'; break;
        }

        if (!gFriend.checkFightBoss(bossOwnerId)) {
            resp.code = 100; resp.desc = 'no fight boss '; break;
        }
    } while (false);

    gFriend.save(false);
    onReqHandled(res, resp, 1);
};

exports.rank_list = function(req, res, resp) {
    var uid = +req.uid;
    var rankList = [];
    var iter = gFriend.ranks.iterator();
    var item = null;

    var rankCnt = gConfGlobal.bossScoreRankListLimit;
    while (rankList.length != rankCnt && (item = iter.next()) != null) {
        var id = item[0];
        if (!gUserInfo.users[id]) { continue; }
        var rank = gFriend.generateRankData(id);
        rankList.push(rank);
    }

    resp.data.rank = gFriend.getBossScoreRank(uid);
    resp.data.rank_list = rankList;
    resp.data.score = gFriend.getBossScore(uid);

    onReqHandled(res, resp, 1);
};

exports.Friend = Friend;
