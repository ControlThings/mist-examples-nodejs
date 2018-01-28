var MistNode = require('mist-api').MistNode;
var fuse = require('fuse-bindings')

var cls = 'fi.controlthings.file';

function File() {
    var self = this;
    this.node = new MistNode('FileFile');
    this.peers = {};
    this.peerCount = 0;

    self.node.addEndpoint('mist.name', { type: 'string', read: (args, peer, cb) => { cb(null, 'File'); } });
    self.node.addEndpoint('mist.class', { type: 'string', read: (args, peer, cb) => { cb(null, cls); } });
    self.node.addEndpoint('dummy', { type: 'string', read: true });

    self.node.on('online', (peer) => {
        console.log('online');
        self.node.request(peer, 'control.read', ['mist.class'], (err, type) => {
            if (type === 'fi.controlthings.db') {
                self.node.wish.request('identity.get', [peer.luid], (err, data1) => {
                    self.node.wish.request('identity.get', [peer.ruid], (err, data2) => {
                        //console.log('peer:alias', data1.alias, data2.alias);
                        self.node.request(peer, 'control.read', ['mist.name'], (err, name) => {
                            //console.log('peer:alias', data1.alias, data2.alias, data);
                            console.log('peer:alias', data1.alias, data2.alias, name, type);
                            
                            self.addPeer(peer);
                        });
                    });
                });
            }
        });
    });
    
    self.node.on('offline', (peer) => {
        // peer went offline
        self.removePeer(peer);
    });
    
    var mountPath = process.platform !== 'win32' ? '/media/mist' : 'M:\\'

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

    fuse.mount(mountPath, {
        readdir: function (path, cb) {
            console.log('readdir(%s)', path);
            
            var peer = self.getPeer();

            if(!peer) {
                if (path === '/') {
                    var l = [];
                    for(var i in files) { l.push(i); }
                    return cb(0, l);
                }
                cb(0)
                return;
            }
            
            self.node.request(peer, 'control.invoke', ['readdir', [path]], (err, data) => {
                if(err) { return cb(0); }
                cb(0, data);
            });
        },
        getattr: function (path, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['getattr', [path]], (err, data) => {
                    console.log('fuse:getattrCb', err, data);
                    if(err || (data && data.yo)) { return cb(fuse.ENOENT); }
                    cb(0, data);
                });
                return;
            }
            
            
            console.log('getattr(%s)', path)
            if (path === '/') {
                cb(0, {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 100,
                    mode: 16877,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0
                })
                return
            }

            if (files[path.substr(1)]) {
                return cb(0, files[path.substr(1)].getattr);
            }

            cb(fuse.ENOENT)
        },
        open: function (path, flags, cb) {
            console.log('open(%s, %d)', path, flags)
            cb(0, 42) // 42 is an fd
        },
        release: function(path, fd, cb) {
            console.log('release', path, fd);
            cb(0);
        },
        read: function (path, fd, buf, len, pos, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                
                var tmp = Buffer.allocUnsafe(len);
                var cursor = 0;
                
                function read(peer, path, fd, len, pos) {
                    self.node.request(peer, 'control.invoke', ['read', [path, fd, len, pos]], (err, data) => {
                        if(err) { return cb(fuse.ENOENT); }

                        if(data.length === 0) {
                            tmp.copy(buf, 0, 0, cursor);
                            console.log('EOF', path, cursor,'bytes');
                            return cb(cursor);
                        }

                        console.log('received data', err, data);

                        data.copy(tmp, cursor);
                        cursor += data.length;
                        
                        console.log('received data:', data.length, 'cursor:', cursor);


                        if (cursor < len) {
                            console.log('need more', cursor, '/', len, 'read from pos+data.length:', (pos+data.length));
                            setTimeout(() => { read(peer, path, fd, len, pos+data.length); });
                            return;
                        }

                        console.log('all we need %i / %i', cursor, len);

                        // got all we need
                        tmp.copy(buf);

                        console.log('file:readCb', err, data, data.length, pos, len);

                        cb(tmp.length);
                    });
                }

                read(peer, path, fd, len, pos);
                return;
            }
            
            
            if (len > 4096) { len = 4096; }
            
            console.log('read(%s, %d, %d, %d)', path, fd, len, pos);
            
            console.log('looking for '+path.substr(1), 'in', files);
            if (!files[path.substr(1)]) { return cb(0); }
            
            var str = files[path.substr(1)].data.slice(pos, pos + len);
            console.log('str is now', str, str.length);
            str.copy(buf);
            console.log('buf', buf.slice(0, str.length));
            cb(str.length);
        },
        write: function (path, fd, buffer, length, position, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['write', [path, fd, buffer.slice(0, length), position]], (err, data) => {
                    //console.log('fuse:writeCb', err, data);
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(data);
                });
                return;
            }
            
            
            if(!files[path.substr(1)]) { cb(fuse.ENOENT); }
            
            if(position !== 0) {
                if (position === files[path.substr(1)].data.length) {
                    files[path.substr(1)].data = Buffer.concat([files[path.substr(1)].data, buffer]);
                    files[path.substr(1)].getattr.size = files[path.substr(1)].data.length;
                    return cb(length);
                } else {
                    console.log('checked data', position, files[path.substr(1)].data.length);
                    return cb(length);
                }
            }

            console.log('writing at 0', path.substr(1), fd, position, length, buffer)
            
            var data = Buffer.allocUnsafe(length);
            buffer.slice(0, length).copy(data, 0, 0, length);
            
            files[path.substr(1)].data = data;
            files[path.substr(1)].getattr.size = length;
            
            console.log('data at 0', path.substr(1), files[path.substr(1)].data, files[path.substr(1)].data.length);
            
            console.log('files', files[path.substr(1)]);
            
            cb(length) // we handled all the data
        },
        create: function(path, mode, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['create', [path, mode]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }            
            
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
            cb(0);
        },
        rename: function(src, dest, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['rename', [src, dest]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }
            
            console.log('rename', src, '=>', dest);
            if(files[src.substr(1)]) {
                files[dest.substr(1)] = files[src.substr(1)];
                delete files[src.substr(1)];
            }
            cb(0);
        },
        unlink: function(path, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['unlink', [path]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }            
            
            if(!files[path.substr(1)]) { cb(fuse.ENOENT); }
            
            delete files[path.substr(1)];
            cb(0);
        },
        mkdir: function(path, mode, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['mkdir', [path, mode]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }            
        },
        rmdir: function(path, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['rmdir', [path]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }            
        },
        statfs: function(path, cb) {
            console.log('statfs');
            cb(0, {
                bsize: 1000000,
                frsize: 1000000,
                blocks: 1000000,
                bfree: 1000000,
                bavail: 1000000,
                files: 1000000,
                ffree: 1000000,
                favail: 1000000,
                fsid: 1000000,
                flag: 1000000,
                namemax: 1000000
            });
        },
        utimens: function(path, atime, mtime, cb) {
            var peer = self.getPeer();
            
            if(peer) {
                self.node.request(peer, 'control.invoke', ['utimens', [path, atime, mtime]], (err, data) => {
                    if(err) { return cb(fuse.ENOENT); }
                    
                    cb(0);
                });
                return;
            }            
            
            if(!files[path.substr(1)]) { cb(fuse.ENOENT); }

            files[path.substr(1)].getattr.atime = atime;
            files[path.substr(1)].getattr.mtime = mtime;
            cb(0);
        }
    }, function (err) {
        if (err) { throw err; }
        console.log('filesystem mounted on ' + mountPath);
    });

    process.on('SIGINT', function () {
        fuse.unmount(mountPath, function (err) {
            if (err) {
                console.log('filesystem at ' + mountPath + ' not unmounted', err);
            } else {
                console.log('filesystem at ' + mountPath + ' unmounted');
            }
            process.exit(0);
        });
    });
    
    setInterval(() => {
        var cnt = 0;
        for(var i in self.peers) { cnt++; }
        console.log('Peers:', cnt);
    }, 5000);
}

function toUrl(peer) {
    return peer.protocol +':'+ peer.luid.toString('base64')+peer.ruid.toString('base64')+peer.rhid.toString('base64')+peer.rsid.toString('base64');
}

File.prototype.addPeer = function(peer) {
    var url = toUrl(peer);
    
    this.peers[url] = { peer: peer };
    
    this.node.request(peer, 'control.invoke', ['readdir', '/'], (err, data) => {
        console.log('readdir from remote node:', err, data);
    });
};

File.prototype.removePeer = function(peer) {
    var url = toUrl(peer);
    
    if (!this.peers[url]) { return; };
    delete this.peers[url];
};

File.prototype.getPeer = function() {
    for(var i in this.peers) { return this.peers[i].peer; }

    return null;
};

var beacon = new File();