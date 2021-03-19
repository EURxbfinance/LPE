$XBE Liquidity Provider Event Contract
=================

XBE Liquidity event – UNISWAP and SUSHISWAP

This event will run over 10 days and distribute 1000 XBE split evenly between the USDT/XBE pools on Sushiswap and Uniswap respectively (500 XBE to each pool).  That means that over 10 days, every day a total of 100 XBE tokens will be awarded across the Uniswap and Sushiswap LPs (50 XBE per pool per day). Also note that LPs will be able to withdraw their rewards at any time during the event, even though liquidity will be locked till the end.

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

