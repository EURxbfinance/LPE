Liquidity-Event Contract
=================

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

