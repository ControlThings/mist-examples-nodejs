var MistNode = require('mist-api').MistNode;

var cls = 'fi.controlthings.db';

function Db() {
    var self = this;
    this.name = process.env.NAME || 'FileDb';
    this.node = new MistNode(this.name);
    this.peers = {};
    this.peerCount = 0;

    // Directory flag 0x4000
    var S_IFDIR = 16384;

    self.node.addEndpoint('mist.name', { type: 'string', read: (args, peer, cb) => { cb(null, self.name); } });
    self.node.addEndpoint('mist.class', { type: 'string', read: (args, peer, cb) => { cb(null, cls); } });

    var db = {
        data: Buffer.alloc(0),
        getattr: {
            mtime: new Date(),
            atime: new Date(),
            ctime: new Date(),
            nlink: 1,
            size: 100,
            mode: 16877,
            uid: process.getuid ? process.getuid() : 0,
            gid: process.getgid ? process.getgid() : 0
        },
        files: {
            test: {
                data: new Buffer('hello world\n'),
                getattr: {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 12,
                    mode: 33188,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0
                }
            }
        }
    };

    function getNodeParent(path) {
        if (path === '/') { return null; }
        path = path.slice(1);
        var dir = path.split('/');
        var file = dir.pop();
        
        var cursor = db;
        
        while (dir.length > 0) {
            var next = dir.shift();
            if(!cursor.files[next]) {
                return null;
            }
            
            cursor = cursor.files[next];
        }
        
        return cursor;
    }

    function getNode(path) {
        if (path === '/') { return db; }
        path = path.slice(1);
        var dir = path.split('/');
        var file = dir.pop();
        
        var cursor = db;
        
        while (dir.length > 0) {
            var next = dir.shift();
            if(!cursor.files[next]) {
                return null;
            }
            
            cursor = cursor.files[next];
        }
        
        if (!cursor.files[file]) { return null; }
        
        return cursor.files[file];
    }

    self.node.addEndpoint('getNode', {
        invoke: (args, peer, cb) => {
            cb(null, getNode(args[0]));
        }
    });

    self.node.addEndpoint('getNodeParent', {
        invoke: (args, peer, cb) => {
            cb(null, getNodeParent(args[0]));
        }
    });
    
    self.node.addEndpoint('readdir', {
        invoke: (args, peer, cb) => {
            console.log('readdir:', args);
            var path = args[0];
            
            var node = getNode(path);
            
            console.log('readdir node:', node);
            
            if (node) {
                if (node.getattr.mode & 16384) {
                    var l = [];
                    for(var i in node.files) { l.push(i); }
                    return cb(null, l);
                }
            }
            
            cb(null, []);
        }
    });

    self.node.addEndpoint('getattr', {
        invoke: (args, peer, cb) => {
            console.log('getattr:', args);
            
            var path = args[0];
            
            console.log('getNode:', getNode(path));
            
            var node = getNode(path);
            
            if (node) {
                console.log('returning attrs', node.getattr);
                return cb(null, node.getattr);
            } else {
                console.log('node is null looking for ', path, 'in', db);
                cb({ code: 6, msg: 'Not found: '+path });
            }
        }
    });

    self.node.addEndpoint('open', {
        invoke: (args, peer, cb) => {
            console.log('open:', args);
            var path = args[0];
            var flags = args[1];
            
            var node = getNode(path);
            
            if (node) {
                return cb(null, 42);
            } else {
                cb({ code: 1, msg: 'ENOENT' });
            }
        }
    });

    self.node.addEndpoint('release', {
        invoke: (args, peer, cb) => {
            console.log('release:', args);
            var path = args[0];
            var fd = args[1];
            
            var node = getNode(path);
            
            if (node) {
                return cb();
            } else {
                return cb({ code: 1, msg: 'ENOENT' });
            }
        }
    });

    self.node.addEndpoint('read', {
        invoke: (args, peer, cb) => {
            console.log('read:', args);
            var path = args[0];
            var fd = args[1];
            var len = args[2];
            var pos = args[3];
            
            if (len > 4096) { len = 4096; }
            
            var node = getNode(path);
            
            if (!node) { console.log('read: File not found.'); return cb({ code: 2, msg: 'File not found.' }); }
            
            if (pos >= node.data.length) { return cb(null, Buffer.alloc(0)); }

            
            var str = node.data.slice(pos, pos + len);
            
            console.log('read going to respond:', str);
            
            cb(null, str);
        }
    });

    self.node.addEndpoint('write', {
        invoke: (args, peer, cb) => {
            console.log('write:', args);
            var path = args[0];
            var fd = args[1];
            var buffer = args[2];
            var length = buffer.length;
            var position = args[3];

            var node = getNode(path);
            
            if (node) {
                if(position === 0) {
                    var data = Buffer.allocUnsafe(length);
                    buffer.slice(0, length).copy(data, 0, 0, length);

                    node.data = data;
                    node.getattr.size = length;
                    cb(null, length);
                } else {
                    if (position === node.data.length) {
                        node.data = Buffer.concat([node.data, buffer]);
                        node.getattr.size = node.data.length;
                        return cb(null, length);
                    } else {
                        console.log('Failed writing position:', position, node.data.length);
                        return cb(null, length);
                    }
                }
                return;
            }

            console.log('failed, but said we did it...!');
            cb(null, length); // we handled all the data
        }
    });

    self.node.addEndpoint('create', {
        invoke: (args, peer, cb) => {
            console.log('create:', args);
            var path = args[0];
            var mode = args[1];
            
            var node = getNodeParent(path);
            
            if (node) {
                console.log('create found parent', node);
                var filename = path.split('/').pop();
                node.files[filename] = {
                    data: new Buffer(0),
                    getattr: {
                        mtime: new Date(),
                        atime: new Date(),
                        ctime: new Date(),
                        nlink: 1,
                        size: 0,
                        mode: mode,
                        uid: process.getuid ? process.getuid() : 0,
                        gid: process.getgid ? process.getgid() : 0
                    }
                };
                return cb();
            }
            cb();
        }
    });

    self.node.addEndpoint('rename', {
        invoke: (args, peer, cb) => {
            var src = args[0];
            var dest = args[1];

            var node = getNode(src);
            var srcParent = getNodeParent(src);
            var parent = getNodeParent(dest);
            var src_filename = src.split('/').pop();
            var dest_filename = dest.split('/').pop();

            console.log('rename', src, '=>', dest);
            if(node && parent) {
                parent.files[dest_filename] = node;
                delete srcParent.files[src_filename];
                console.log('Going out here', db, 'asdasdasdasdasdasd\n\n', srcParent, src_filename);
                return cb();
            }
            
            console.log('erroring out here');
            
            cb({ code: 4, msg: 'ENOENT' });
        }
    });

    self.node.addEndpoint('unlink', {
        invoke: (args, peer, cb) => {
            console.log('unlink', args);
            var path = args[0];

            var node = getNodeParent(path);
            var filename = path.split('/').pop();
            delete node.files[filename];

            cb();
        }
    });

    self.node.addEndpoint('mkdir', {
        invoke: (args, peer, cb) => {
            console.log('mkdir', args);
            var path = args[0];
            var mode = args[1];

            var node = getNode(path);

            if(node) { return cb({ code: 7, msg: 'ENOENT' }); }
            
            console.log('mode', mode, mode | S_IFDIR);
            
            node = getNodeParent(path);
            
            if(!node) { console.log('mkdir failed, no parent found'+ path); return cb({ code: 99 }); }
            
            var name = path.split('/').pop();
            
            console.log('going to set name', name, 'in', node);
            
            node.files[name] = {
                data: Buffer.alloc(0),
                files: {},
                getattr: {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 0,
                    mode: mode | S_IFDIR,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0
                }                
            };
            cb();
        }
    });

    self.node.addEndpoint('rmdir', {
        invoke: (args, peer, cb) => {
            console.log('rmdir', args);
            var path = args[0];

            var node = getNode(path);

            if(!node) { console.log('yoyoyoyo', path); return cb({ code: 7, msg: 'ENOENT' }); }
            
            if ( !(node.getattr.mode & S_IFDIR)) {
                console.log('ended up here.', node.getattr, node.getattr.mode & S_IFDIR);
                return cb({ code: 8, msg: 'ENODIR' });
            }
            
            var parent = getNodeParent(path);
            delete parent.files[path.split('/').pop()];
            
            cb();
        }
    });

    self.node.addEndpoint('utimens', {
        invoke: (args, peer, cb) => {
            console.log('utimens', args);
            var path = args[0];
            var atime = args[1];
            var mtime = args[2];

            var node = getNode(path);

            if(!node) { return cb({ code: 7, msg: 'ENOENT' }); }
            
            node.getattr.atime = atime;
            node.getattr.mtime = mtime;
            cb();
        }
    });

    self.node.addEndpoint('files', {
        invoke: (args, peer, cb) => {
            console.log('files', args);
            cb(null, db);
        }
    });

    self.node.addEndpoint('peerCount', {
        type: 'int',
        read: (args, peer, cb) => { cb(null, self.peerCount); }
    });

    self.node.on('online', (peer) => {
        console.log('online');
        self.node.request(peer, 'control.read', ['mist.class'], (err, type) => {
            if (type === cls) {
                self.node.wish.request('identity.get', [peer.luid], (err, data1) => {
                    self.node.wish.request('identity.get', [peer.ruid], (err, data2) => {
                        //console.log('peer:alias', data1.alias, data2.alias);
                        self.node.request(peer, 'control.read', ['mist.name'], (err, name) => {
                            //console.log('peer:alias', data1.alias, data2.alias, data);
                            console.log('peer:alias', data1.alias, data2.alias, name, type);
                            
                            // start "spamming"
                            //self.startBeacon(peer);
                        });
                    });
                });
            }
        });
    });
    
    self.node.on('offline', (peer) => {
        // stop "spamming"
        //self.stopBeacon(peer);
    });
}

function toUrl(peer) {
    return peer.protocol +':'+ peer.luid.toString('base64')+peer.ruid.toString('base64')+peer.rhid.toString('base64')+peer.rsid.toString('base64');
}

Db.prototype.startBeacon = function(peer) {
    var url = toUrl(peer);
    
    console.log('beacon ', typeof bacon);
    
    this.peers[url] = { 
        interval: setTimeout(bacon(this, peer, url), 30),
        peer: peer,
        cnt: this.peers[url] ? this.peers[url].cnt : 0
    };
    
    this.updatePeerCount();
};

Db.prototype.stopBeacon = function(peer) {
    var url = toUrl(peer);
    if (!this.peers[url]) { return; };
    clearInterval(this.peers[url].interval);
    delete this.peers[url];
    this.updatePeerCount();
};

Db.prototype.updatePeerCount = function() {
    var count = 0;
    for(var i in this.peers) { count++; }
    
    console.log('peerCount:', count);
    
    this.peerCount = count;
    this.node.changed('peerCount');
};

var db = new Db();