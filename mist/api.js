var Mist = require("mist-api").Mist;

module.exports = class Api {
  constructor(name, coreIp, corePort) {
    this.api = new Mist({ name: name, coreIp: coreIp, corePort: corePort });
  }

  node() {
   return this.api.node;
  }

  onReady() {
    return new Promise(
      function(resolve, reject) {
        this.api.on("ready", () => {
          resolve();
        });
      }.bind(this)
    );
  }

  /* 
   * Make requests to the Wish API. 
   */

  wishRequest(cmd, args) {
    return new Promise((resolve, reject) => {
      this.api.wish.request(cmd, args, (err, data) => {
        if (err) {
          // If we are failing in identiy creation because we already have
          // an identity, all is well.
          if (cmd == "identity.create" && data.code == 304) {
            resolve(data);
          } else {
            reject(data);
          }
        } else {
          resolve(data);
        }
      });
    });
  }

  ensureIdentity(name) {
    return this.wishRequest("identity.create", [name]);
  }

  listEveryone() {
    return this.wishRequest("wld.list", []);
  }

  friendRequest(luid, ruid, rhid) {
    return this.wishRequest("wld.friendRequest", [luid, ruid, rhid]);
  }

  listFriendRequests() {
    return this.wishRequest("identity.friendRequestList", []);
  }

  acceptFriend(luid, ruid) {
    return this.wishRequest("identity.friendRequestAccept", [luid, ruid]);
  }

  /*
   * Make requests to the Mist API
   */

  mistRequest(cmd, args) {
    return new Promise((resolve, reject) => {
      this.api.request(cmd, args, (err, data) => {
        if (err) {
          reject(data);
        } else {
          resolve(data);
        }
      });
    });
  }

  listFriends() {
    return this.mistRequest("listPeers", []);
  }

  invoke(friend, action) {
    return this.mistRequest("mist.control.invoke", [friend, action]);
  }

  onFriendRequest(cb) {
    this.api.request("signals", [], (err, data) => {
      if (!err) {
       if (data == "friendRequest") {
         cb();
       }
      }
    });
  }
};
