var MistNode = require('mist-api').MistNode;

var cls = 'fi.controlthings.db';

function Db() {
    var self = this;
    this.node = new MistNode('FileDb');
    this.peers = {};
    this.peerCount = 0;

    self.node.addEndpoint('mist.name', { type: 'string', read: (args, peer, cb) => { cb(null, 'FileDb'); } });
    self.node.addEndpoint('mist.class', { type: 'string', read: (args, peer, cb) => { cb(null, cls); } });

    var files = {
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
    };

    self.node.addEndpoint('readdir', {
        invoke: (args, peer, cb) => {
            console.log('readdir:', args);
            var path = args[0];
            
            if (path === '/') {
                var l = [];
                for(var i in files) { l.push(i); }
                return cb(null, l);
            }
            
            cb(null, []);
        }
    });

    self.node.addEndpoint('getattr', {
        invoke: (args, peer, cb) => {
            console.log('getattr:', args);
            
            var path = args[0];
            
            if (path === '/') {
                return cb(null, {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 100,
                    mode: 16877,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0
                });
            }

            if (files[path.substr(1)]) {
                console.log('here... A');
                return cb(null, files[path.substr(1)].getattr);
            } else {
                console.log('here... B');
                cb(null, { yo: 'man' });
                //cb(true, { code: 1, msg: 'ENOENT' });
            }
        }
    });

    self.node.addEndpoint('open', {
        invoke: (args, peer, cb) => {
            console.log('open:', args);
            var path = args[0];
            var flags = args[1];
            
            if (files[path.substr(1)]) {
                return cb(null, 42);
            } else {
                cb(true, { code: 1, msg: 'ENOENT' });
            }
        }
    });

    self.node.addEndpoint('release', {
        invoke: (args, peer, cb) => {
            console.log('release:', args);
            var path = args[0];
            var fd = args[1];
            
            if (files[path.substr(1)]) {
                return cb();
            } else {
                return cb(true, { code: 1, msg: 'ENOENT' });
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
            
            if (!files[path.substr(1)]) { return cb(true, { code: 2, msg: 'File not found.' }); }
            
            if (pos >= files[path.substr(1)].data.length) { return cb(null, Buffer.alloc(0)); }

            
            var str = files[path.substr(1)].data.slice(pos, pos + len);
            cb(null, str);
        }
    });

    self.node.addEndpoint('write', {
        invoke: (args, peer, cb) => {
            //console.log('write:', args);
            var path = args[0];
            var fd = args[1];
            var buffer = args[2];
            var length = buffer.length;
            var position = args[3];

            if(!files[path.substr(1)]) { return cb(true, { code: 3, msg: 'ENOENT' }); }
            
            if(position !== 0) {
                if (position === files[path.substr(1)].data.length) {
                    files[path.substr(1)].data = Buffer.concat([files[path.substr(1)].data, buffer]);
                    files[path.substr(1)].getattr.size = files[path.substr(1)].data.length;
                    return cb(null, length);
                } else {
                    console.log('checked data', position, files[path.substr(1)].data.length);
                    return cb(null, length);
                }
            }

            console.log('writing at 0', path.substr(1), fd, position, length, buffer);
            
            var data = Buffer.allocUnsafe(length);
            buffer.slice(0, length).copy(data, 0, 0, length);
            
            files[path.substr(1)].data = data;
            files[path.substr(1)].getattr.size = length;
            
            console.log('data at 0', path.substr(1), files[path.substr(1)].data, files[path.substr(1)].data.length);
            
            //console.log('files', files[path.substr(1)]);
            
            cb(null, length); // we handled all the data
        }
    });

    self.node.addEndpoint('create', {
        invoke: (args, peer, cb) => {
            console.log('create:', args);
            var path = args[0];
            var mode = args[1];
            
            console.log('create file:', path.substr(1), mode);
            files[path.substr(1)] = {
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
            cb();
        }
    });

    self.node.addEndpoint('rename', {
        invoke: (args, peer, cb) => {
            var src = args[0];
            var dest = args[1];

            console.log('rename', src, '=>', dest);
            if(files[src.substr(1)]) {
                files[dest.substr(1)] = files[src.substr(1)];
                delete files[src.substr(1)];
                return cb();
            }
            
            cb(true, { code: 4, msg: 'ENOENT' });
        }
    });

    self.node.addEndpoint('unlink', {
        invoke: (args, peer, cb) => {
            console.log('unlink', args);
            var path = args[0];

            if(!files[path.substr(1)]) { return cb(true, { code: 7, msg: 'ENOENT' }); }
            
            delete files[path.substr(1)];
            cb();
        }
    });

    self.node.addEndpoint('utimens', {
        invoke: (args, peer, cb) => {
            console.log('utimens', args);
            var path = args[0];
            var atime = args[1];
            var mtime = args[2];

            if(!files[path.substr(1)]) { return cb(true, { code: 7, msg: 'ENOENT' }); }
            
            files[path.substr(1)].getattr.atime = atime;
            files[path.substr(1)].getattr.mtime = mtime;
            cb();
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