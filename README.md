# Example code for mist-api on node.js

## Prerequisites

If you are running on Linux x64 or OSX x64 everything should work out of the box according to the instructions below. Windows is not supported yet.

Download and install node.js v6.x: https://nodejs.org/dist/latest-v6.x/. You may use Node Version Manager `nvm` (https://github.com/creationix/nvm).

You will need to have an appropriate wish-core (the peer-to-peer identity based communication layer mist is based on). The source is available at: https://github.com/ControlThings/wish-c99.

Install command line tools for Mist and Wish:

```sh
npm install -g mist-cli@latest wish-cli@latest
```


Create an identity.

```sh
wish-cli
identity.create('Demo Identity')
```

In the examples root directory run:

```sh
npm install
```

## Running examples

### Switch

A simplistic switch implementation.

```sh
node switch/run.js
```

### Parking

A parking service. 

```sh
node parking/run.js
```

## Accessing the examples from CLI

```sh
# run the command line tool
mist-cli
# shows help
help()
# shows list of peers available
list()
# show model
mist.control.model(peers[x])
# write to relay endpoint of switch
mist.control.write(peers[x], 'relay', true)
```
