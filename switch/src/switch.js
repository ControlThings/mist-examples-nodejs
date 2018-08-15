var MistNode = require('mist-api').MistNode;

var name = process.env.NAME || 'Switch';

if (!process.env.NAME) { console.log('Use: NAME="Switch Label" to run several instances.'); }

function Switch() {
    var relay = false;
    
    var node = new MistNode({ name: name }); // , coreIp: '127.0.0.1', corePort: 9094

    // add `mist` endpoint
    node.addEndpoint('mist', { type: 'string' });
    // add `mist.name` as subendpoint to mist
    node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { cb(null, name); } });
    
    // add readable and writable `number` endpoint
    node.addEndpoint('relay', {
        type: 'bool',
        read: function(args, peer, cb) {
            cb(null, relay);
        },
        write: function(value, peer, cb) {
            // write the internal state variable for `number` endpoint
            relay = !!value;
            // signal successful write
            cb();
            // signal `number` value changed
            node.changed('relay');
            
            console.log('relay set to:', relay);
        }
    });
}

module.exports = {
    Switch: Switch
};
