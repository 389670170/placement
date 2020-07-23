var RED = true;
var BLACK = false;

var Node = function Node(parent, data) {
    this.data = data ? data : null;
    this.parent = parent ? parent : null;
    this.left = null;
    this.right = null;
    this.color = RED;
    this.size = 1;
};

function isRed(node) {
    return node && node.color == RED;
}

function getSize(node) {
    if (!node) {
        return 0;
    }

    return node.size;
}

function rolateLeft(node) {
    var oldRight = node.right;
    node.right = oldRight.left;
    if (oldRight.left) {
        oldRight.left.parent = node;
    }

    oldRight.left = node;
    var parent = node.parent;
    oldRight.parent = parent;
    node.parent = oldRight;

    if (parent) {
        if (parent.left == node) {
            parent.left = oldRight;
        } else {
            parent.right = oldRight;
        }
    }

    node.color = RED;
    oldRight.color = BLACK;

    oldRightSize = oldRight.size;
    oldSize = node.size;
    oldRight.size = oldSize;
    node.size += getSize(node.right) - oldRightSize;
}

function rolateRight(node) {
    var oldLeft = node.left;
    node.left = oldLeft.right;
    if (oldLeft.right) {
        oldLeft.right.parent = node;
    }

    oldLeft.right = node;
    var parent = node.parent;
    oldLeft.parent = parent;
    node.parent = oldLeft;

    if (parent) {
        if (parent.left == node) {
            parent.left = oldLeft;
        } else {
            parent.right = oldLeft;
        }
    }

    node.color = RED;
    oldLeft.color = BLACK;

    oldLeftSize = oldLeft.size;
    oldSize = node.size;
    oldLeft.size = oldSize;
    node.size += getSize(node.left) - oldLeftSize;

    return oldLeft;
}

function doubleRolateLeft(node) {
    rolateRight(node.right);
    rolateLeft(node);
}

function doubleRolateRight(node) {
    rolateLeft(node.left);
    rolateRight(node);
}

var Iterator = function(node) {
    this.cursor = null;
    this.root = node;
};

function findMin(iter) {
    var cursor = iter.cursor;
    if (!cursor) {
        return;
    }

    while (cursor.left) {
        cursor = cursor.left;
    }
    iter.cursor = cursor;
}

function findMax(iter) {
    var cursor = iter.cursor;
    if (!cursor) {
        return;
    }

    while (cursor.right) {
        cursor = cursor.right;
    }
    iter.cursor = cursor;
}

Iterator.prototype.data = function(data) {
    if (!this.cursor) {
        return null;
    }

    return this.cursor.data;
};

Iterator.prototype.next = function(data) {
    if (!this.cursor) {
        this.cursor = this.root;
        findMin(this);
    } else {
        if (this.cursor.right) {
            this.cursor = this.cursor.right;
            findMin(this);
        } else {
            var cursor;
            do {
                cursor = this.cursor;
                if (cursor.parent) {
                    this.cursor = cursor.parent
                } else {
                    this.cursor = null;
                    break;
                }
            } while (this.cursor.right == cursor);
        }
    }

    return this.cursor ? this.cursor.data : null;
};

Iterator.prototype.prev = function(data) {
    if (!this.cursor) {
        return null;
    }

    if (this.cursor.left) {
        findMax(this);
    } else {
        var cursor;
        do {
            cursor = this.cursor;
            if (cursor.parent) {
                this.cursor = cursor.parent;
            } else {
                this.cursor = null;
                break;
            }
        } while (this.cursor.left == cursor);
    }

    return this.cursor;
};

var RBTree = function(comparator) {
    this.root = null;
    this.comparator = comparator;
};

RBTree.prototype.iterator = function() {
    return new Iterator(this.root);
};

RBTree.prototype.insert = function(data) {
    if (!this.root) {
        this.root = new Node(null, data);
        this.root.color = BLACK;
        return true;
    }

    var ret = false;

    var head = new Node();
    head.right = this.root;
    this.root.parent = head;

    var great = head;
    var grand = null;
    var parent = null;

    var node = this.root;
    var isLeft = true;

    while (true) {
        if (node == null) {
            node = new Node(parent, data);
            if (isLeft) {
                parent.left = node;
            } else {
                parent.right = node;
            }
            ret = true;

            var ancestor = parent;
            while (ancestor) {
                ancestor.size++;
                ancestor = ancestor.parent;
            }
        } else if (isRed(node.left) && isRed(node.right)) {
            node.color = RED;
            node.left.color = BLACK;
            node.right.color = BLACK;
        }

        if (isRed(node) && isRed(parent)) {
            if (parent.left == node) {
                if (grand.left == parent) {
                    rolateRight(grand);
                } else {
                    doubleRolateLeft(grand);
                }
            } else {
                if (grand.left == parent) {
                    doubleRolateRight(grand);
                } else {
                    rolateLeft(grand);
                }
            }
        }

        var cmp = this.comparator(node.data, data);
        isLeft = cmp > 0;
        if (!cmp) {
            break;
        }

        if (grand) {
            great = grand;
        }
        grand = parent;
        parent = node;
        if (isLeft) {
            node = node.left;
        } else {
            node = node.right;
        }
    }

    this.root = head.right;
    this.root.parent = null;
    this.root.color = BLACK;
    return ret;
};

RBTree.prototype.remove = function(data) {
    if (!this.root) {
        return false;
    }

    if (!data) {
        return true;
    }

    var head = new Node();
    head.right = this.root;
    this.root.parent = head;

    var node = head;
    var parent = null;
    var grand = null;
    var found = null;
    var isLeft = false;

    while (true) {
        grand = parent;
        parent = node;

        if (isLeft) {
            node = node.left;
        } else {
            node = node.right;
        }

        if (!node) {
            break;
        }

        var cmp = this.comparator(data, node.data);
        isLeft = cmp <= 0;

        if (!cmp) {
            found = node;
        }

        var next = null;
        var another = null;
        if (isLeft) {
            next = node.left;
            another = node.right;
        } else {
            next = node.right;
            another = node.left;
        }

        if (!isRed(node) && !isRed(next)) {
            if (isRed(another)) {
                if (isLeft) {
                    rolateLeft(node);
                } else {
                    rolateRight(node);
                }
                parent = node.parent;
            } else {
                var sibling = parent.left == node ? parent.right : parent.left;
                if (sibling) {
                    if (!isRed(sibling.left) && !isRed(sibling.right)) {
                        parent.color = BLACK;
                        node.color = RED;
                        sibling.color = RED;
                    } else {
                        var tmpRight = grand.right == parent;

                        if (isRed(sibling.left)) {
                            if (parent.left == node) {
                                doubleRolateLeft(parent);
                            } else {
                                rolateRight(parent);
                            }
                        } else {
                            if (parent.left == node) {
                                rolateLeft(parent);
                            } else {
                                doubleRolateRight(parent);
                            }
                        }

                        var newParent;
                        if (!tmpRight) {
                            newParent = grand.left;
                        } else {
                            newParent = grand.right;
                        }
                        newParent.color = RED;
                        newParent.left.color = BLACK;
                        newParent.right.color = BLACK;
                        node.color = RED;
                    }
                }
            }
        }
    }

    if (found) {
        found.data = parent.data;

        var newNode = parent.left ? parent.left : parent.right;
        if (newNode) {
            newNode.parent = grand;
        }

        if (grand.right == parent) {
            grand.right = newNode;
        } else {
            grand.left = newNode;
        }

        while (grand) {
            grand.size--;
            grand = grand.parent;
        }
    }

    this.root = head.right;
    if (this.root) {
        this.root.parent = null;
        this.root.color = BLACK;
    }

    return found;
};

RBTree.prototype.size = function() {
    if (this.root) {
        return this.root.size;
    }

    return 0;
};

RBTree.prototype.rank = function(data) {
    var node = this.root;
    var retRank = getSize(node);
    while (node) {
        var cmp = this.comparator(node.data, data);
        if (!cmp) {
            retRank -= getSize(node.right);
            break;
        } else if (cmp < 0) {
            node = node.right;
        } else {
            retRank -= getSize(node.right) + 1;
            node = node.left;
        }
    }

    if (!node) {
        return 0;
    }

    return retRank;
};

RBTree.prototype.each = function(callback) {
    var iter = this.iterator();
    while (iter.next()) {
        callback && callback(iter.data());
    }
};

RBTree.prototype.erase = function() {
    this.root = null;
};

RBTree.prototype.removeMin = function() {
    this.remove(this.iterator().next());
};

RBTree.prototype.removeMax = function() {
    this.remove(this.iterator().prev());
};

exports.RBTree = RBTree;
