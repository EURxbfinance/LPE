const UniswapV2Factory = artifacts.require('UniswapV2Factory'); // Uniswap Factory
const ERC20 = artifacts.require('ERC20');


const Router = artifacts.require('Router');
const Incentivizer = artifacts.require('Incentivizer');

// const ether = (n) => web3.utils.toWei(n, 'ether');

module.exports = function (deployer, network) {
  deployer.then(async () => {
    if (network === 'test' || network === 'soliditycoverage') {
      // do nothing
    } else if (network.startsWith('rinkeby')) {
      const uniswapFactory = await UniswapV2Factory.at('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
      const eurxbAddress = '0x49Fdb5C0DC55195b5f7AC731e5f5d389925C8c03'; // eurxb rinkeby
      const xbeAddress = '0xfaC2D38F064A35b5C0636a7eDB4B6Cc13bD8D278'; // XBE rinkeby
      const usdtAddress = '0x909f156198674167a8D42B6453179A26871Fbc96'; // usdt rinkeby
      const usdtPoolAddress = await uniswapFactory.getPair.call(eurxbAddress, usdtAddress);
      // deploy router
      const router = await deployer.deploy(Router);
      // configure router
      await router.configure(
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap router
        eurxbAddress,
        usdtAddress,
        process.env.TEAM_RINKEBY_ACCOUNT,
      );
      await router.setStartWeights('27000000', '23000000000000000000');
      const eurxb = ERC20.at(eurxbAddress);
      const eurxbToRouter = '100000000000000000000000'; // 100 000 eurxb
      eurxb.transfer(router.address, eurxbToRouter);
      // deploy incentivizer
      const incentivizer = await deployer.deploy(Incentivizer);
      // configure incentivizer
      await incentivizer.configure(
        process.env.REWARD_DISTRIBUTION_RINKEBY_ACCOUNT,
        xbeAddress,
        usdtPoolAddress,
        process.env.RINKEBY_REWARDS_DURATION,
      );
      const xbe = ERC20.at(xbeAddress);
      const xbeReward = '100000000000000000000'; // 100 xbe
      xbe.transfer(incentivizer.address, xbeReward);
      incentivizer.notifyRewardAmount(xbeReward);
    } else if (network.startsWith('mainnet')) {
      const uniswapFactory = await UniswapV2Factory.at('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
      const eurxbAddress = '0x0beAD9a1bcc1b84D06E3f2df67E3549Fd55aB054'; // eurxb mainnet
      const xbeAddress = '0x5DE7Cc4BcBCa31c473F6D2F27825Cfb09cc0Bb16'; // XBE mainnet
      const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // usdt mainnet
      const usdtPoolAddress = await uniswapFactory.getPair.call(eurxbAddress, usdtAddress);
      // deploy router
      const router = await deployer.deploy(Router);
      // configure router
      await router.configure(
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap router
        eurxbAddress,
        usdtAddress,
        process.env.TEAM_MAINNET_ACCOUNT,
      );
      await router.setStartWeights('27000000', '23000000000000000000');
      // deploy incentivizer
      const incentivizer = await deployer.deploy(Incentivizer);
      // configure incentivizer
      await incentivizer.configure(
        process.env.REWARD_DISTRIBUTION_MAINNET_ACCOUNT,
        xbeAddress,
        usdtPoolAddress,
        process.env.MAINNET_REWARDS_DURATION,
      );
    } else {
      console.error(`Unsupported network: ${network}`);
    }
  });
};
