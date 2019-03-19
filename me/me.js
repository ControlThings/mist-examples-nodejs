var Api = require("../mist/api");

var name = "Me";
var coreIp = "127.0.0.1";
var corePort = 9094;

function usage() {
  console.log("");
  console.log("usage: node me.js [who | hello | smile | frown]");
  console.log("");
  console.log("who\tList who is present");
  console.log("hello\tBecome friends with everyone");
  console.log("smile\tSmile broadly!");
  console.log("frown\tFrown angrily");
}

function Me() {
  var api = new Api(name, coreIp, corePort);

  api.onReady().then(() => {
    api
      .ensureIdentity(name)
      .then(() => {
        if (process.argv.length <= 2) {
          usage();
          process.exit(0);
        } else {
          var cmd = process.argv[2];

          if (cmd == "who") {
            api
              .listEveryone()
              .then(everyone => {
                api
                  .listFriends()
                  .then(friends => {
                    for (var x = 0; x < everyone.length; x++) {
                      if (everyone[x].alias == name) {
                        console.log("I'm here!");
                      } else {
                        var isFriend = false;

                        for (var k in friends) {
                          if (
                            Buffer.compare(everyone[x].ruid, friends[k].ruid) ==
                            0
                          ) {
                            isFriend = true;
                          }
                        }
                        console.log(
                          (isFriend ? "Your friend " : "") +
                            everyone[x].alias +
                            " is here."
                        );
                      }
                    }
                    process.exit(0);
                  })
                  .catch(err => {
                    console.log("Failed to get list", err);
                    process.exit(1);
                  });
              })
              .catch(err => {
                console.log("Failed to get list", err);
                process.exit(1);
              });
          } else if (cmd == "hello") {
            api
              .listEveryone()
              .then(everyone => {
                // Get my id
                var luid;
                for (var x = 0; x < everyone.length; x++) {
                  if (everyone[x].alias == name) {
                    luid = everyone[x].ruid;
                  }
                }

                // Put out friendRequests to anyone else present.
                for (var x = 0; x < everyone.length; x++) {
                  if (Buffer.compare(everyone[x].ruid, luid) != 0) {
                    console.log("Saying hello to " + everyone[x].alias);
                    api
                      .friendRequest(luid, everyone[x].ruid, everyone[x].rhid)
                      .catch(err => {
                        console.log("Failed.", err);
                      });
                  }
                }

                // Give friend requests 5 seconds to complete.
                setTimeout(() => {
                  process.exit(0);
                }, 5000);
              })
              .catch(err => {
                process.exit(1);
              });
          } else if (cmd == "smile" || cmd == "frown") {
            api
              .listFriends()
              .then(friends => {
                for (var k in friends) {
                  api
                    .invoke(friends[k], cmd)
                    .then(data => {
                      console.log(data);
                      process.exit(0);
                    })
                    .catch(err => {
                      console.log("Failed to smile.", err);
                      process.exit(0);
                    });
                }
              })
              .catch(err => {
                console.log("Failed to smile.", err);
                process.exit(0);
              });
          }
        }
      })
      .catch(err => {
        console.log("Failed to create identity", err);
      });
  });
}

var me = new Me();
