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
const { ZERO, ONE, getMockTokenPrepared } = require('./utils/common');

const Router = artifacts.require('Router');
const IERC20 = artifacts.require('IERC20');
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');

const MockContract = artifacts.require("MockContract");

contract('Router', (accounts) => {

  const owner = accounts[0];
  const teamAddress = accounts[1];
  const bob = accounts[2];

  var router;
  var mockRouter;
  var mockPair;
  var mockToken;
  var mockEurXBToken;

  beforeEach(async () => {
    router = await Router.new(teamAddress);
    mockRouter = await MockContract.new();
    mockPair = await MockContract.new();
    mockToken = await MockContract.new();
    mockEurXBToken = await MockContract.new();
    await router.configure(
      mockRouter.address,
      mockEurXBToken.address,
      mockPair.address
    );
  });

  it('should configure properly', async () => {
    expect(await router.uniswapRouter()).to.be.equal(mockRouter.address);
    expect(await router.teamAddress()).to.be.equal(teamAddress);
    expect(await router.EURxb()).to.be.equal(mockEurXBToken.address);
    expect(await router.pairAddress()).to.be.equal(mockPair.address);
  });

  it('should revert if already closed', async () => {
    await router.closeContract();
    await expectRevert(router.closeContract(), "closed");
  });

  const setupMockToken = async (balanceMock, transferStatusMock, mockTokenInstance) => {
    const balanceOfCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.balanceOf(ZERO_ADDRESS).encodeABI();
    const transferCalldata = (await IERC20.at(mockTokenInstance.address)).contract
      .methods.transfer(ZERO_ADDRESS, ZERO).encodeABI();
    await mockToken.givenMethodReturnUint(balanceOfCalldata, balanceMock);
    await mockToken.givenMethodReturnBool(transferCalldata, transferStatusMock);
  };

  it('should revert if transfer failed', async () => {
    await setupMockToken(ether('10'), false, mockEurXBToken);
    await expectRevert(router.closeContract(), "!transfer");
  });

  it('should close even if balance is zero', async () => {
    await setupMockToken(ZERO, true, mockEurXBToken);
    await router.closeContract();
    expect(await router.isClosedContract()).to.be.equal(true);
  });

  it('should close even if balance is greater than zero', async () => {
    await setupMockToken(ether('10'), true, mockEurXBToken);
    await router.closeContract();
    expect(await router.isClosedContract()).to.be.equal(true);
  });

  it('should revert if contract closed when adding liquidity', async () => {
    await setupMockToken(ether('10'), true, mockEurXBToken);
    await router.closeContract();
    await expectRevert(router.addLiquidity(mockToken.address, ether('10')), "closed");
  });

  const setUpDecimals = async (decimals, mockTokenInstance) => {
    const decimalsCalldata = (await IERC20.at(mockTokenInstance.address)).contracts
      .methods.decimals().encodeABI();
    await mockToken.givenMethodReturnUint(decimalsCalldata, decimals);
  };

  const setUpReserves = async (reserve1, reserve2, blockTimestampLast) => {
    const getReservesCalldata = (await IUniswapV2Pair.at(mockPair.address)).contract
      .methods.getReserves().encodeABI();
    await mockPair.givenMethodReturn(getReservesCalldata, [reserve1, reserve2, blockTimestampLast]);
  };

  it('should revert adding liquidity of balance eur gt 1 eurxb token', async () => {
    await setUpReserves(ether('100'), ether('100'), time.latest());
    await setupMockToken(ether('10'), true, mockEurXBToken);
    await expectRevert(router.addLiquidity(mockToken.address, ether('10')), "emptyEURxbBalance");
  });

  it('should revert if sort tokens are equal', async () => {

  });

  it('should revert if first in sorted tokens is zero address', async () => {

  });
});
