# Trying out Mist and Wish on Node.js

## Prerequisites

When running Linux x64 or macOS x64 everything should work swimmingly if you follow the instructions below. Windows isn't supported (yet).

Install:

1. [Node.js v6](https://nodejs.org/dist/latest-v6.x/). Note that v6.x is _required_. You can use [nvm](https://github.com/creationix/nvm) to run multiple Node versions on the same computer.  

2. *Wish*, the p2p communication layer Mist is using. Download the [Wish binaries](https://www.controlthings.fi/dev/) for Linux/macOS, or build it from [the Wish source code](https://github.com/ControlThings/wish-c99). Copy the `wish-core` binary into the examples root folder.

3. Install Mist and Wish command line tools for further testing and tweaking (optional):

```sh
$ npm install -g mist-cli@latest wish-cli@latest
```

## Me and Marielle
In this example we'll create two entities (or _things_) and do our best to make them communicate with each other. 

1. **Marielle** (```marielle/```) is a person looking for friends and reacting whenever someone is smiling or frowning at her. 
2. **Me** (```me/```) is _just me_, a simple app for my own interactions with Marielle. 

So here we go! 

To lessen the confusion, it might be smart to use two seperate terminal windows (one for each entity),  and to further create two tabs within each terminal (one for the Wish server, one for running the Node.js app).

But, first, in the examples root folder, run: 

```sh
$ npm install
```


### Marielle Terminal - Wish Tab

Assuming you have the Wish binary installed in the root folder and named ```wish-core```:

```sh
$ ./wish-core -a 9094 -p 37200
```

- *-a* specifies which port Wish will use to listen for app communication. Marielle will talk to Wish over this port. 

- *-p* is the port used for global communication with other Wish cores.  

### Marielle Terminal - Application Tab

```sh
$ cd marielle
$ node marielle.js
```

Marielle ensures she has an identity (private and public key) and boots up. If everything is ok, she says:

```
Hello, world. I am Marielle.
```

### Me Terminal - Wish Tab

```sh
$ ./wish-core -a 9095 -p 37300
```
_Note_ that the ports are different. When we are running two cores on the same computer, they have to run on different ports.

### Me Terminal - Application Tab

```sh
$ cd me
$ node me.js
```

Running _me_ without arguments will show the usage instructions: 

```
usage: node me.js [who | hello | smile | frown]

who	    List who is present
hello   Become friends with everyone
smile   Smile broadly!
frown   Frown angrily
```

- *who* lists all the entities that are present on the local broadcast network. If both entities are running, you should se yourself and Marielle. 

- *hello* sends friend requests to all other entities on the local network. Marielle is listening for these and will automatically become friends with anyone interested (check for this happening in the Marielle application tab). 

- *smile* sends a smile to all your friends. Remember to say *hello* first, otherwise you won't have any friends.

- *frown* sends an angry smile to all our friends. 

### Example Output

Show a list of anyone present.

```sh
$ node me.js who
I'm here!
Marielle is here.
```

Say hello (make a friend request).

```sh
$ node me.js hello
Saying hello to Marielle

On Marielle's terminal (with Marielle running):
I got a cool friend!
```

Try who again.

```
$ node me.js who
I'm here!
Your friend Marielle is here.
```

Smile to Marielle.

```sh
$ node me.js smile
:)

On Marielle's terminal:
Oh! That makes me happy!
```

(The smiley above in the _me_ terminal is Marielle's return value.)

## Long Distance Relationship

Once the friend connection has been made using the local broadcast network, you can freely move yourself or Marielle elsewhere. 

As long as both entities have working internet connections, they will be able to communicate with each other securely using built-in relay connectivity. 

## Further Reading

Check out the READMEs in the subfolders for more information about the actual code.

## The CLIs

If you installed the optional command line tools, you can interact with the Wish and Mist APIs without using Node.js. *Note* that you have to set the core port number using an environment variable.

Show the internal help and list all known identities:

```sh
$ export CORE=9094
$ wish-cli
wish> help()
...
wish> identity.list()
...
```

Show the internal help, list all peers (friends) and smile to Marielle, who happens to be peers[0]: 

```sh
$ export CORE=9094
$ mist-cli
mist> help()
...
mist> list()
Known peers:
  peers[0]: Marielle (Marielle) 
mist> mist.control.invoke(peers[0], "smile")
reqId: 7
mist> 
':)'
mist> 

```
