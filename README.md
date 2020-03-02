# PoW Market

<img src="./public/static/images/logo.png" alt="logo" style="zoom: 67%;" />

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

Pull requests welcome!



## API

The PoW Market API has 3 `HTTP` `GET` endpoints available that all return objects like this:

```javascript
{
  "bsvusd": 233.8,
  "magicnumbers": [
    {
      "txid": "192247cbdcb862146976b84773c68b3d3bbd1caafff25654188b746f9e4af9d5",
      "vout": 0,
      "from": "189GjWCxxfWnzoCiagi4fQ1m3VBDVbJhkm",
      "value": 939960,
      "confirmed": false,
      "magicnumber": "21e800",
      "target": "21e80096c21e2de52d741ac27607e251770c0b9f7e644f684cf37173e871820e",
      "mined": false,
      "created_at": 1583110006
    },
    ...
   ]
}
```

Objects will have `mined` set to `true` or `false`.



### `https://pow.market/api`

Return all magic numbers in the order they were created. Currently no paging is offered.



### `https://pow.market/api/unmined`

Return all unmined magic numbers.



### `https://pow.market/api/mined`

Return the last 500 mined magic numbers. Currently no paging is offered. Mined objects will have additional properties like `mined_address`, `mined_number` and `mined_txid`.

```js
{
  "bsvusd": 233.8,
  "magicnumbers": [
    {
      "txid": "45bccbfc54ebd965009c655158542f20860e3cb842764d711e4c0db43477cdb1",
      "vout": 0,
      "from": "1JhWWtdWJmaWLdpT2E2zqs7DNwEtzbwcLB",
      "value": 9427,
      "confirmed": true,
      "magicnumber": "21e8",
      "target": "21e80096c21e2de52d741ac27607e251770c0b9f7e644f684cf37173e871820e",
      "mined": true,
      "created_at": 1583109241,
      "mined_address": "1HBDCouZ5Fzo9LMp7SfVjVXDRguLyMoUWz",
      "mined_number": "21e8e01d4d51bc3fbd29b91e3e3034407b0c72b687d6853b13c4a49e19933238",
      "mined_txid": "e1a458d12429d4d3c96348e46da9f88601cc7942091d2558533d2738ca719a56"
    },
    ...
]}
```



## 21e8miner

PoW Market is compatible with [21e8miner](https://github.com/deanmlittle/21e8miner)



## Contact

@synfonaut
