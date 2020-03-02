# PoW Market

> A market for magic numbers

https://pow.market/

## Getting Started

To get the PoW market running, use the following commands

**Dependencies**
- MongoDB
- Bitcoin node

```bash
git clone https://github.com/synfonaut/pow.market.git
cd pow.market
npm i
RPC_HOST=XXX RPC_USER=XXX RPC_PASS=XXX PEER_HOST=XXX npm start


(in a new shell)
RPC_HOST=XXX RPC_USER=XXX RPC_PASS=XXX PEER_HOST=XXX npm run state_machine
```

Depends on MongoDB but could easily be switched out for another database. Pull requests welcome!

## 21e8miner

PoW Market is compatible with [21e8miner](https://github.com/deanmlittle/21e8miner).

## Contact

@synfonaut

## TODO

- Sort magic numbers by when they were mined
- Logo
