Liquidity-Event Contract
=================

XBE Liquidity event – UNISWAP and SUSHISWAP

We are proud to announce the first liquidity event for EURxb’s governance token $XBE. This event will run over 10 days by distribution 1000 XBE split evenly between Sushiswap and Uniswap (500 each pool). Every day, 100 tokens will be distributed to LPs on both Uniswap and Sushiswap (50 XBE each pool, each day) for a total of 10 days. LPs can withdraw their rewards at anytime during the event.  

Uniswap Pool address: https://info.uniswap.org/pair/0x5551c4812a89bf840e3da6debd4cb1a2d5322e3a

Sushiswap Pool Address: https://app.sushi.com/pair/0x73b1183940297cE6ecb772ae9CEdaCa7fCDc30a5


**Requirements** 

 - nodeJS v12.19.0 or later
- npm 7.5.4 or later
- Truffle v5.0.17 (core: 5.0.16) or later

**Installation**

- npm i
- create `.secret` file and paste there seed phrase (12 words you got while creating eth acc) (for deploy only)
- create `.env` file:
```
INFURA_ID=<infura api key>
ETHERSCAN_API_KEY=<etherscan api key>
DEPLOYER_ACCOUNT=<your address of account from .secret>
... and other keys
```

**Run tests**

- npm run lint
- npm run test

**Make Flattened contract file**

- npm run flatten

