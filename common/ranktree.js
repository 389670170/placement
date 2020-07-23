var util = require('util');
var RBTree = require('./rbtree.js').RBTree;

/*
 * 用于游戏内排行榜
 * 存储数据为数组
 * 且数组第一位为uid
 * 结构上保留uid对数据的映射
 */
var RankTree = function(comparator, capacity) {
    RBTree.call(this, comparator);

    this.idMap = {
        // uid: data,
    };
    this.capacity = capacity || 0;
}

util.inherits(RankTree, RBTree);

RankTree.prototype.insert = function(data) {
    var insert = RankTree.super_.prototype.insert;
    RankTree.prototype.insert = function(data) {
        if (this.idMap[data[0]]) {
            return false;
        } else {
            if (insert.call(this, data)) {
                this.idMap[data[0]] = data;
                if (this.capacity && this.size() > this.capacity) {
                    this.removeMax();
                }
                return true;
            }
            return false;
        }
    }
    return this.insert(data);
};

RankTree.prototype.removeById = function(id) {
    var data = this.idMap[id];
    if (!data) {
        return true;
    }

    delete this.idMap[id];
    return this.remove(data);
};

RankTree.prototype.update = function(data) {
    this.removeById(data[0]);
    this.insert(data);
};

RankTree.prototype.rankById = function(id) {
    var data = this.idMap[id];
    if (!data) {
        return 0;
    }

    return this.rank(data);
};

exports.RankTree = RankTree;
