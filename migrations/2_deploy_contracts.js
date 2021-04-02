const jsonUniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const jsonUniswapV2Router02 = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const jsonWETH9 = require('@uniswap/v2-periphery/build/WETH9.json');

const contract = require('@truffle/contract');

const UniswapV2Factory = contract(jsonUniswapV2Factory);
const UniswapV2Router02 = contract(jsonUniswapV2Router02);
const WETH9 = contract(jsonWETH9);

const ERC20 = artifacts.require('ERC20');

const Router = artifacts.require('Router');
const Incentivizer = artifacts.require('Incentivizer');

// const ether = (n) => web3.utils.toWei(n, 'ether');

module.exports = function (deployer, network) {
  UniswapV2Factory.setProvider(this.web3._provider);
  UniswapV2Router02.setProvider(this.web3._provider);
  WETH9.setProvider(this.web3._provider);

  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network.startsWith('rinkeby')) {
      const sushiswapFactory = await deployer.deploy(UniswapV2Factory, process.env.DEPLOYER_ACCOUNT, { from: process.env.DEPLOYER_ACCOUNT });
      const uniswapFactory = await UniswapV2Factory.at('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
      const weth = await WETH9.at('0xc778417E063141139Fce010982780140Aa0cD5Ab');
      const xbeAddress = '0xfaC2D38F064A35b5C0636a7eDB4B6Cc13bD8D278'; // XBE rinkeby
      const usdtAddress = '0x909f156198674167a8D42B6453179A26871Fbc96'; // usdt rinkeby

      const sushiRouter = await deployer.deploy(
        UniswapV2Router02,
        sushiswapFactory.address,
        weth.address,
        { from: process.env.DEPLOYER_ACCOUNT },
      );

      const xbe = await ERC20.at(xbeAddress);
      const usdt = await ERC20.at(usdtAddress);

      //await xbe.approve(sushiRouter.address, '1000000000000000000', { from: process.env.DEPLOYER_ACCOUNT });
      //await usdt.approve(sushiRouter.address, '1000000000000000000000', { from: process.env.DEPLOYER_ACCOUNT });
      // const now = new Date() / 1000 | 0;
      // await sushiRouter.addLiquidity(
      //   xbeAddress,
      //   usdtAddress,
      //   '1000000000000000000',
      //   '1000000000000000000000',
      //   0,
      //   0,
      //   process.env.DEPLOYER_ACCOUNT,
      //   now + 6000,
      //   { from: process.env.DEPLOYER_ACCOUNT },
      // );
      await sushiswapFactory.createPair(xbeAddress, usdtAddress, { from: process.env.DEPLOYER_ACCOUNT });

      const usdtUniPoolAddress = await uniswapFactory.getPair.call(xbeAddress, usdtAddress);
      const usdtSushiPoolAddress = await sushiswapFactory.getPair.call(xbeAddress, usdtAddress);

      // deploy router
      // const router = await deployer.deploy(Router);
      // // configure router
      // await router.configure(
      //   '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap router
      //   eurxbAddress,
      //   usdtAddress,
      //   process.env.TEAM_RINKEBY_ACCOUNT,
      // );
      // await router.setStartWeights('27000000', '23000000000000000000');
      // const eurxb = await ERC20.at(eurxbAddress);
      // const eurxbToRouter = '100000000000000000000000'; // 100 000 eurxb
      // await eurxb.transfer(router.address, eurxbToRouter);
      // deploy incentivizer
      const incentivizerUni = await deployer.deploy(Incentivizer, { from: process.env.DEPLOYER_ACCOUNT });
      // configure incentivizer
      await incentivizerUni.configure(
        process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT,
        xbeAddress,
        usdtUniPoolAddress,
        process.env.RINKEBY_REWARDS_DURATION,
        { from: process.env.DEPLOYER_ACCOUNT },
      );
      // deploy incentivizer
      const incentivizerSushi = await deployer.deploy(Incentivizer, { from: process.env.DEPLOYER_ACCOUNT });
      // configure incentivizer
      await incentivizerSushi.configure(
        process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT,
        xbeAddress,
        usdtSushiPoolAddress,
        process.env.RINKEBY_REWARDS_DURATION,
        { from: process.env.DEPLOYER_ACCOUNT },
      );
      const xbeReward = '100000000000000000000'; // 100 xbe
      await xbe.transfer(incentivizerUni.address, xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
      await xbe.transfer(incentivizerSushi.address, xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
      await incentivizerUni.notifyRewardAmount(xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
      await incentivizerSushi.notifyRewardAmount(xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
    } else if (network.startsWith('mainnet')) {
      const xbeAddress = '0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16'; // XBE
      const usdtUniPoolAddress = '0x5551c4812a89bf840e3da6debd4cb1a2d5322e3a'; // XBE-USDT uniswap pair
      const usdtSushiPoolAddress = '0x73b1183940297cE6ecb772ae9CEdaCa7fCDc30a5'; // XBE-USDT sushiswap pair
      // // deploy router
      // const router = await deployer.deploy(Router);
      // // configure router
      // await router.configure(
      //   '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap router
      //   eurxbAddress,
      //   usdtAddress,
      //   process.env.TEAM_MAINNET_ACCOUNT,
      // );
      // await router.setStartWeights('27000000', '23000000000000000000');

      // deploy incentivizer for Uniswap pair
      const incentivizerUni = await deployer.deploy(Incentivizer, { from: process.env.DEPLOYER_ACCOUNT });
      // configure incentivizer
      await incentivizerUni.configure(
        process.env.REWARD_DISTRIBUTION_MAINNET_ACCOUNT,
        xbeAddress,
        usdtUniPoolAddress,
        process.env.MAINNET_REWARDS_DURATION,
        { from: process.env.DEPLOYER_ACCOUNT },
      );
      // deploy incentivizer for Sushiswap pair
      const incentivizerSushi = await deployer.deploy(Incentivizer, { from: process.env.DEPLOYER_ACCOUNT });
      // configure incentivizer
      await incentivizerSushi.configure(
        process.env.REWARD_DISTRIBUTION_MAINNET_ACCOUNT,
        xbeAddress,
        usdtSushiPoolAddress,
        process.env.MAINNET_REWARDS_DURATION,
        { from: process.env.DEPLOYER_ACCOUNT },
      );
      const xbe = await ERC20.at(xbeAddress);
      const xbeReward = '500000000000000000000'; // 500 xbe
      await xbe.transfer(incentivizerUni.address, xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
      await xbe.transfer(incentivizerSushi.address, xbeReward, { from: process.env.DEPLOYER_ACCOUNT });
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
