/* eslint no-unused-vars: 0 */
/* eslint eqeqeq: 0 */

const { expect, assert } = require('chai');
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  ether,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { ZERO, ONE, getMockTokenPrepared, processEventArgs } = require('./utils/common');

const Router = artifacts.require('Router');
const IERC20 = artifacts.require('IERC20');
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Library = artifacts.require('UniswapV2Library');

const MockContract = artifacts.require("MockContract");

contract('Router', (accounts) => {

  const owner = accounts[0];
  const teamAddress = accounts[1];
  const bob = accounts[2];
  const feeToSetter = accounts[3];
  const alice = accounts[4];

  var router;

  var mockFactory;
  var mockRouter;
  var mockToken;
  var mockEurXBToken;
  var mockPair;

  // const setUpDecimals = async (decimals, mockTokenInstance) => {
  //   const decimalsCalldata = (await IERC20.at(mockTokenInstance.address)).contracts
  //     .methods.decimals().encodeABI();
  //   await mockToken.givenMethodReturnUint(decimalsCalldata, decimals);
  // };

  const setupMockContractToken = async (balanceMock, transferStatusMock, mockTokenInstance) => {
    const balanceOfCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.balanceOf(ZERO_ADDRESS).encodeABI();
    const transferCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();
    await mockTokenInstance.givenMethodReturnUint(balanceOfCalldata, balanceMock);
    await mockTokenInstance.givenMethodReturnBool(transferCalldata, transferStatusMock);
  };

  describe('with mock contract', () => {
    beforeEach(async () => {
      router = await Router.new();
      mockRouter = await MockContract.new();
      mockToken = await MockContract.new();
      mockEurXBToken = await MockContract.new();
      mockFactory = await MockContract.new();

      const factoryCalldata = (await IUniswapV2Router02.at(mockRouter.address)).contract
        .methods.factory().encodeABI();

      await mockRouter.givenMethodReturnAddress(factoryCalldata, mockFactory.address);

      await router.configure(
        mockRouter.address,
        mockEurXBToken.address,
        mockToken.address,
        teamAddress
      );
    });

    it('should configure properly', async () => {
      expect(await router.uniswapLikeRouter()).to.be.equal(mockRouter.address);
      expect(await router.uniswapLikeFactory()).to.be.equal(mockFactory.address);
      expect(await router.teamAddress()).to.be.equal(teamAddress);
      expect(await router.eurxb()).to.be.equal(mockEurXBToken.address);
      expect(await router.token()).to.be.equal(mockToken.address);
    });

    it('should revert if already closed', async () => {
      await router.closeContract();
      await expectRevert(router.closeContract(), "closed");
    });

    it('should revert if transfer failed', async () => {
      await setupMockContractToken(ether('10'), false, mockEurXBToken);
      await expectRevert(router.closeContract(), "!transfer");
    });

    it('should close even if balance is zero', async () => {
      await setupMockContractToken(ZERO, true, mockEurXBToken);
      await router.closeContract();
      expect(await router.isClosedContract()).to.be.equal(true);
    });

    it('should close even if balance is greater than zero', async () => {
      await setupMockContractToken(ether('10'), true, mockEurXBToken);
      await router.closeContract();
      expect(await router.isClosedContract()).to.be.equal(true);
    });

    it('should revert if contract closed when adding liquidity', async () => {
      await setupMockContractToken(ether('10'), true, mockEurXBToken);
      await router.closeContract();
      await expectRevert(router.addLiquidity(mockToken.address, ether('10')), "closed");
    });

  });

  const setUpReserves = async (reserve1, reserve2) => {

    await mockToken.approve(mockPair.address, ether('100'), {from: bob});
    await mockToken.transfer(mockPair.address, ether('100'), {from: bob});

    await mockEurXBToken.approve(mockPair.address, ether('100'), {from: bob});
    await mockEurXBToken.transfer(mockPair.address, ether('100'), {from: bob});

    await mockPair.mint(bob, {from: bob});

    // const getPairCalldata = (await IUniswapV2Factory.at(mockFactory.address)).contract
    //   .methods.getPair(ZERO_ADDRESS, ZERO_ADDRESS).encodeABI();
    //
    // await mockFactory.givenMethodReturnAddress(getPairCalldata, mockPair.address);
    //
    // const createPairCalldata = (await IUniswapV2Factory.at(mockFactory.address)).contract
    //   .methods.createPair(ZERO_ADDRESS, ZERO_ADDRESS).encodeABI();
    //
    // await mockFactory.givenMethodReturnAddress(createPairCalldata, mockPair.address);
    //
    //
    // const getReservesCalldata = (await IUniswapV2Pair.at(mockPair.address)).contract
    //   .methods.getReserves().encodeABI();
    //
    // await mockPair.givenMethodReturn(getReservesCalldata,
    //   web3.eth.abi.encodeParameters(
    //     ["uint112", "uint112", "uint32"],
    //     [reserve1, reserve2, ZERO]
    //   )
    // );
  };

  describe('with real mock token', () => {

    beforeEach(async () => {
      router = await Router.new();
      mockRouter = await MockContract.new();
      mockToken = await getMockTokenPrepared(bob, ether('1000'), ether('1000'), owner);
      mockEurXBToken = await getMockTokenPrepared(bob, ether('1000'), ether('1000'), owner);;

      mockFactory = await UniswapV2Factory.new(feeToSetter);

      const factoryCalldata = (await IUniswapV2Router02.at(mockRouter.address)).contract
        .methods.factory().encodeABI();

      await mockRouter.givenMethodReturnAddress(factoryCalldata, mockFactory.address);

      const pairCreationReceipt = await mockFactory.createPair(mockToken.address, mockEurXBToken.address);

      await processEventArgs(pairCreationReceipt, 'PairCreated', async (args) => {
        mockPair = await IUniswapV2Pair.at(args.pair);
        console.log(await mockPair.factory(), mockFactory.address);
      });

      await router.configure(
        mockRouter.address,
        mockEurXBToken.address,
        mockToken.address,
        teamAddress
      );
    });

    it('should revert adding liquidity if balance eur lower than 1 token', async () => {
      await setUpReserves(ether('100'), ether('100'));
      const aliceBalance = ether('10');
      await mockToken.approve(alice, aliceBalance, {from: bob});
      await mockToken.transfer(alice, aliceBalance, {from: bob});
      await expectRevert(router.addLiquidity(aliceBalance, new BN((60 * 10).toString()), {from: alice}), "emptyEURxbBalance");
    });

    // it('should revert if sort tokens are equal', async () => {
    //   await setUpReserves(ether('100'), ether('100'));
    //   await setupMockContractToken(ether('1'), true, mockEurXBToken);
    //   await expectRevert(router.addLiquidity(mockEurXBToken.address, ether('10')), "identicalTokens");
    // });
    //
    // it('should revert if first in sorted tokens is zero address', async () => {
    //   await setUpReserves(ether('100'), ether('100'));
    //   await setupMockContractToken(ether('1'), true, mockEurXBToken);
    //   await expectRevert(router.addLiquidity(ZERO_ADDRESS, ether('10')), "zeroAddress");
    // });
    //
    // it('should add liquidity successfully', async () => {
    //   await setUpReserves(ether('100'), ether('100'), await time.latest());
    //
    //   await mockEurXBToken.approve(router.address, ether('100'), {from: bob});
    //   await mockEurXBToken.transfer(router.address, ether('100'), {from: bob});
    //
    //   await mockToken.approve(router.address, ether('100'), {from: bob});
    //   await mockToken.transfer(router.address, ether('100'), {from: bob});
    //
    //
    //   await mockToken.approve(router.address, ether('100'), {from: bob});
    //
    //   const pairTransferCalldata = (await IERC20.at(mockPair.address)).contract
    //     .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();
    //
    //   await mockPair.givenMethodReturnBool(pairTransferCalldata, true);
    //
    //   const addLiquidityCalldata = (await IUniswapV2Router02.at(mockRouter.address)).contract
    //     .methods.addLiquidity(
    //       ZERO_ADDRESS,
    //       ZERO_ADDRESS,
    //       ZERO,
    //       ZERO,
    //       ZERO,
    //       ZERO,
    //       ZERO_ADDRESS,
    //       ZERO
    //     ).encodeABI();
    //
    //   await mockRouter.givenMethodReturn(addLiquidityCalldata,
    //     web3.eth.abi.encodeParameters(
    //       ["uint256", "uint256", "uint256"],
    //       [ZERO, ZERO, ether('50')]
    //     )
    //   );
    //   await router.addLiquidity(mockToken.address, ether('100'), {from: bob});
    //   expect(await mockToken.balanceOf(teamAddress)).to.be.bignumber.equal(ether('200'));
    // });

  });

});
