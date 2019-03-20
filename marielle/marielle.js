var Api = require("../mist/api");

var name = "Marielle";
var coreIp = "127.0.0.1";
var corePort = 9095;

function friendRequestListener(api) {
  api.onFriendRequest(() => {
    api
      .listFriendRequests()
      .then(data => {
        // Accept all requests without thinking.
        for (var x = 0; x < data.length; x++) {
          api
            .acceptFriend(data[x].luid, data[x].ruid)
            .then(() => {
              console.log("I got a cool friend!");
            })
            .catch(err => {
              console.log("Getting friends ain't easy :/", err);
            });
        }
      })
      .catch(err => {
        console.log("Couldn't get list of friend requests.", err);
      });
  });
}

function Marielle() {
  var api = new Api(name, coreIp, corePort);

  api.onReady().then(() => {
    api.ensureIdentity(name).then(() => {
	
      console.log("Hello, world! I am Marielle.");

      /*
   * Start listener for automatically accepting friend requests.
   */
      friendRequestListener(api);

      /*
   * Set up an endpoint so that I can say my name.
   */

      var node = api.node();

      node.addEndpoint("mist", { type: "string" });
      node.addEndpoint("mist.name", {
        type: "string",
        read: function(args, peer, cb) {
          cb(null, name);
        }
      });

      /*
   * Set up an endpoint so that I can tell whether I'm happy or not.
   * Also add reactions if someone is smiling or frowning to me. 
   */

      var happy = true;

      node.addEndpoint("happy", {
        type: "bool",
        read: function(args, peer, cb) {
          cb(null, happy);
        }
      });

      node.addEndpoint("smile", {
        invoke: function(args, peer, cb) {
          console.log("Oh! That makes me happy!");
          happy = true;
          node.changed("happy");
          cb(null, ":)");
        }
      });

      node.addEndpoint("frown", {
        invoke: function(args, peer, cb) {
          console.log("Oh, REALLY?!");
          happy = false;
          node.changed("happy");
          cb(null, ":(");
        }
      });
    });
  });
}

// Start me up
var myMyselfAndI = new Marielle();
