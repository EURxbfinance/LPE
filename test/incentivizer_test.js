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

const Incentivizer = artifacts.require('Incentivizer');
const IERC20 = artifacts.require('IERC20');

// const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02');
// const IUniswapV2Pair = artifacts.require('IUniswapV2Pair');
// const UniswapV2Factory = artifacts.require('UniswapV2Factory');
// const UniswapV2Library = artifacts.require('UniswapV2Library');

const MockContract = artifacts.require("MockContract");

contract('Incentivizer', (accounts) => {

  const owner = accounts[0];
  const rewardsDistribution = accounts[1];
  const alice = accounts[2];
  const bob = accounts[3];

  const stakingTokenTotalSupply = ether('1000');
  const rewardsTokenTotalSupply = ether('1000');
  const stakingTokenAmount = ether('500');
  const rewardsTokenAmount = ZERO;

  const days = new BN('20');
  const rewardsDuration =
    (new BN('60'))
    .mul(new BN('60'))
    .mul(new BN('24'))
    .mul(days);

  var incentivizer;
  var stakingToken;
  var rewardsToken;

  beforeEach(async () => {
    incentivizer = await Incentivizer.new();
    stakingToken = await getMockTokenPrepared(
      bob,
      stakingTokenAmount,
      stakingTokenTotalSupply,
      alice
    );
    rewardsToken = await getMockTokenPrepared(
      rewardsDistribution,
      rewardsTokenAmount,
      rewardsTokenTotalSupply,
      rewardsDistribution
    );

    await incentivizer.configure(
      rewardsDistribution,
      rewardsToken.address,
      stakingToken.address,
      rewardsDuration
    );

  });

  it('should configure properly', async () => {
    expect(await incentivizer.rewardsToken()).to.be.equal(rewardsToken.address);
    expect(await incentivizer.stakingToken()).to.be.equal(stakingToken.address);
    expect(await incentivizer.rewardsDistribution()).to.be.equal(rewardsDistribution);
    expect(await incentivizer.rewardsDuration()).to.be.bignumber.equal(rewardsDuration);
  });

  const approveFunds = async (aliceAmount, bobAmount) => {
    await stakingToken.approve(incentivizer.address, aliceAmount, {from: alice});
    await stakingToken.approve(incentivizer.address, bobAmount, {from: bob});
  };

  const stakeFunds = async (aliceAmount, bobAmount) => {
    const bobReceipt = await incentivizer.stake(bobAmount, {from: bob});
    const aliceReceipt = await incentivizer.stake(aliceAmount, {from: alice});
    return [aliceReceipt, bobReceipt];
  };

  const provideReward = async (rewardAmount) => {
    await rewardsToken.approve(incentivizer.address, rewardAmount, {from: rewardsDistribution});
    await rewardsToken.transfer(incentivizer.address, rewardAmount, {from: rewardsDistribution});
    return await incentivizer.notifyRewardAmount(rewardAmount, {from: rewardsDistribution});
  };

  describe('views', () => {

    const aliceAmount = ether('10');
    const bobAmount = ether('10');
    const totalSupply = aliceAmount.add(bobAmount);
    const rewardAmount = ether('100');

    beforeEach(async () => {
      await provideReward(rewardAmount);
      await approveFunds(aliceAmount, bobAmount);
      await stakeFunds(aliceAmount, bobAmount);

      // var [bobReceipt, aliceReceipt] = await stakeFunds(aliceAmount, bobAmount);
      // processEventArgs(bobReceipt, 'Staked', (args) => {
      //   console.log(args.amount.toString());
      // });
      //
      // processEventArgs(aliceReceipt, 'Staked', (args) => {
      //   console.log(args.amount.toString());
      // });
      //
      // console.log((await incentivizer.totalSupply()).toString());
    });

    it('should get staked total supply', async () => {
      expect(await incentivizer.totalSupply()).to.be.bignumber.equal(totalSupply);
    });

    it('should get staked balance', async () => {
      expect(await incentivizer.balanceOf(alice, {from: alice})).to.be.bignumber.equal(aliceAmount);
    });

    it('should get last time reward applicable', async () => {
      const currentTime = await time.latest();
      const periodFinish = await incentivizer.periodFinish();
      expect(await incentivizer.lastTimeRewardApplicable()).to.be.bignumber.equal(currentTime);
      const hour = new BN('3600');
      await time.increase(rewardsDuration.add(hour));
      expect(await incentivizer.lastTimeRewardApplicable()).to.be.bignumber.equal(periodFinish);
    });

    it('should get reward per token', async () => {
      const rewardPerTokenStored = await incentivizer.rewardPerTokenStored();
      const lastTimeRewardApplicable = await incentivizer.lastTimeRewardApplicable();
      const lastUpdateTime = await incentivizer.lastUpdateTime();
      const rewardRate = await incentivizer.rewardRate();
      const totalSupply = await incentivizer.totalSupply();
    });

    it('should get earned tokens amount', async () => {

    });

    it('should get reward for duration', async () => {

    });

  });

});
