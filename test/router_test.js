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

  const setupMockContractToken = async (balanceMock, transferStatusMock, mockTokenInstance) => {
    const balanceOfCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.balanceOf(ZERO_ADDRESS).encodeABI();
    const transferCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();
    await mockTokenInstance.givenMethodReturnUint(balanceOfCalldata, balanceMock);
    await mockTokenInstance.givenMethodReturnBool(transferCalldata, transferStatusMock);
  };

  describe('closing contracts tests', () => {
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

    it('should revert while trying reopen contract if contract is already opened', async () => {
      await expectRevert(router.reOpenContract(), "open");
    });

    it('should reopen contract successfully', async () => {
      await router.closeContract();
      expect(await router.isClosedContract()).to.be.equal(true);
      await router.reOpenContract();
      expect(await router.isClosedContract()).to.be.equal(false);
    });

  });

  const setUpReserves = async (reserve1, reserve2) => {
    await mockToken.approve(mockPair.address, ether('100'), {from: bob});
    await mockToken.transfer(mockPair.address, ether('100'), {from: bob});
    await mockEurXBToken.approve(mockPair.address, ether('100'), {from: bob});
    await mockEurXBToken.transfer(mockPair.address, ether('100'), {from: bob});
    await mockPair.mint(bob, {from: bob});
  };

  describe('adding liquidity tests', () => {

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
      const aliceTokenBalance = ether('10');
      await mockToken.approve(alice, aliceTokenBalance, {from: bob});
      await mockToken.transfer(alice, aliceTokenBalance, {from: bob});
      await expectRevert(
        router.addLiquidity(aliceTokenBalance, new BN((60 * 10).toString()), {from: alice}),
        "emptyEURxbBalance"
      );
    });

    it('should revert adding liquidity if contract closed', async () => {
      await setUpReserves(ether('100'), ether('100'));
      const aliceTokenBalance = ether('10');
      await mockToken.approve(alice, aliceTokenBalance, {from: bob});
      await mockToken.transfer(alice, aliceTokenBalance, {from: bob});
      await router.closeContract();
      await expectRevert(
        router.addLiquidity(aliceTokenBalance, new BN((60 * 10).toString()), {from: alice}),
        "closed"
      );
    });

    it('should add liquidity successfully', async () => {

      const reserve0 = ether('100');
      const reserve1 = ether('100');

      await setUpReserves(reserve0, reserve1);

      const eurxbBalance = ether('10');
      const tokenBalance = ether('10');
      const tokenBalanceToAddLiquidity = ether('10');

      await mockEurXBToken.approve(router.address, eurxbBalance, {from: bob});
      await mockEurXBToken.transfer(router.address, eurxbBalance, {from: bob});

      await mockToken.approve(router.address, tokenBalance, {from: bob});
      await mockToken.transfer(router.address, tokenBalance, {from: bob});

      await mockToken.approve(router.address, tokenBalanceToAddLiquidity, {from: bob});

      const addLiquidityCalldata = (await IUniswapV2Router02.at(mockRouter.address)).contract
        .methods.addLiquidity(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO,
          ZERO,
          ZERO,
          ZERO,
          ZERO_ADDRESS,
          ZERO
        ).encodeABI();

      await mockRouter.givenMethodReturn(addLiquidityCalldata,
        web3.eth.abi.encodeParameters(
          ["uint256", "uint256", "uint256"],
          [ZERO, ZERO, ZERO]
        )
      );

      await router.addLiquidity(tokenBalanceToAddLiquidity, new BN((60 * 10).toString()), {from: bob});
      expect(await mockToken.balanceOf(teamAddress)).to.be.bignumber.equal(ether('20'));
    });

  });

});
