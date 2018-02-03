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

    // Directory flag 0x4000
    var S_IFDIR = 16384;
    
    var mountPath = process.platform !== 'win32' ? '/media/mist' : 'M:\\'

    var readme = new Buffer('There a re no peers available.\n');

    var files = {
        /*
        README: {
            data: readme,
            getattr: {
                mtime: new Date(),
                atime: new Date(),
                ctime: new Date(),
                nlink: 1,
                size: readme.length,
                mode: 33188,
                uid: process.getuid ? process.getuid() : 0,
                gid: process.getgid ? process.getgid() : 0
            }
        }
        */
    };

    function mkdir(path) {
        console.log('making local directory');
        files[path] = {
            data: Buffer.alloc(0),
            files: {},
            getattr: {
                mtime: new Date(),
                atime: new Date(),
                ctime: new Date(),
                nlink: 1,
                size: 4096,
                mode: 493 | S_IFDIR,
                uid: process.getuid ? process.getuid() : 0,
                gid: process.getgid ? process.getgid() : 0
            }                
        };
    }

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
                            
                            peer.l = data1.alias;
                            peer.r = data2.alias;
                            peer.name = peer.r+'-'+name;
                            
                            mkdir(peer.name);
                            
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
    
    function getRedirect(path) {
        var name = path.split('/')[1];
        //console.log('redirect to peer', name);

        for(var i in self.peers) {
            if(self.peers[i].peer.name === name) {
                var peer = self.peers[i].peer;
                var peerPath = '/' + path.slice(1).split('/').slice(1).join('/');

                //console.log('redirect:', peerPath);
                return { peer: peer, path: peerPath };
                break;
            }
        }
        return null;
    }
    
    fuse.mount(mountPath, {
        init: (cb) => {
            console.log('init fs');
            cb(0);
        },
        access: (path, mode, cb) => {
            console.log('Accessing', path, mode);
            cb(0);
        },
        readdir: function (path, cb) {
            //console.log('readdir(%s)', path);
            
            if (path.split('/').length === 2 ) {
                // is a local dir 
                if (path === '/') {
                    var l = [];
                    for(var i in files) { l.push(i); }
                    return cb(0, l);
                }
            }
            
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }

            self.node.request(redirect.peer, 'control.invoke', ['readdir', [redirect.path]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                //console.log('readdir response', data);

                cb(0, data);
            });
        },
        chown: (path, uid, gid, cb) => {
            console.log('chown', path, uid, gid);
            cb(0);
        },
        chmod: (path, mode, cb) => {
            console.log('chmod', path, mode);
            cb(0);
        },
        getattr: function (path, cb) {
            if (path.split('/').length === 2 ) {
                // is a local dir 
                if (path === '/') {
                    return cb(0, {
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
                
                //console.log('This is a local dir', path);
                if (!files[path.slice(1)]) { console.log('file not here:', path); return cb(fuse.ENOENT); }
                return cb(0, files[path.slice(1)].getattr);
            }
            
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            self.node.request(redirect.peer, 'control.invoke', ['getattr', [redirect.path]], (err, data) => {
                //console.log('fuse:getattrCb', err, data);
                if(err) { console.log('error remotely reading ', redirect.path, 'original path:', path); return cb(fuse.ENOENT); }
                cb(0, data);
            });
            return;
        },
        open: function (path, flags, cb) {
            console.log('open(%s, %d)', path, flags);
            cb(0, 42); // 42 is an fd
        },
        release: function(path, fd, cb) {
            console.log('release', path, fd);
            cb(0);
        },
        read: function (path, fd, buf, len, pos, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            console.log('read redirect', path, "=>", redirect.path);
            
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

            read(redirect.peer, redirect.path, fd, len, pos);
            return;
        },
        write: function (path, fd, buffer, length, position, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            console.log('write redirect', path, "=>", redirect.path);
            
            self.node.request(redirect.peer, 'control.invoke', ['write', [redirect.path, fd, buffer.slice(0, length), position]], (err, data) => {
                //console.log('fuse:writeCb', err, data);
                if(err) { return cb(fuse.ENOENT); }

                cb(data);
            });
        },
        create: function(path, mode, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            self.node.request(redirect.peer, 'control.invoke', ['create', [redirect.path, mode]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
        },
        rename: function(src, dest, cb) {
            var redirect = getRedirect(src);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            dest = '/' + dest.slice(1).split('/').slice(1).join('/');
            
            self.node.request(redirect.peer, 'control.invoke', ['rename', [redirect.path, dest]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
        },
        unlink: function(path, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            self.node.request(redirect.peer, 'control.invoke', ['unlink', [redirect.path]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
            return;
        },
        mkdir: function(path, mode, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            self.node.request(redirect.peer, 'control.invoke', ['mkdir', [redirect.path, mode]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
        },
        rmdir: function(path, cb) {
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }

            self.node.request(redirect.peer, 'control.invoke', ['rmdir', [redirect.path]], (err, data) => {
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
            return;
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
            var redirect = getRedirect(path);

            if (!redirect) { return cb(fuse.ENOENT); }
            
            self.node.request(redirect.peer, 'control.invoke', ['utimens', [redirect.path, atime, mtime]], (err, data) => {
                console.log('utimensCb', err, data);
                if(err) { return cb(fuse.ENOENT); }

                cb(0);
            });
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
    
    /*
    setInterval(() => {
        var cnt = 0;
        for(var i in self.peers) { cnt++; }
        console.log('Peers:', cnt);
    }, 5000);
    */
}

function toUrl(peer) {
    return peer.protocol +':'+ peer.luid.toString('base64')+peer.ruid.toString('base64')+peer.rhid.toString('base64')+peer.rsid.toString('base64');
}

File.prototype.addPeer = function(peer) {
    var url = toUrl(peer);
    
    this.peers[url] = { peer: peer };
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