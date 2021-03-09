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

const MockContract = artifacts.require("MockContract");

contract('Incentivizer', (accounts) => {

  const owner = accounts[0];
  const rewardsDistribution = accounts[1];
  const alice = accounts[2];
  const bob = accounts[3];

  const stakingTokenTotalSupply = ether('1000');
  const rewardsTokenTotalSupply = ether('1000');
  const stakingTokenAmountToTransfer = ether('500');
  const rewardsTokenAmountToTransfer = ZERO;

  const days = new BN('20');
  const rewardsDuration =
    (new BN('60'))
    .mul(new BN('60'))
    .mul(new BN('24'))
    .mul(days);

  var incentivizer;
  var stakingToken;
  var rewardsToken;

  const aliceAmount = ether('10');
  const bobAmount = ether('10');
  const totalSupply = aliceAmount.add(bobAmount);
  const rewardAmount = ether('100');

  const approveFunds = async (aliceAmount, bobAmount) => {
    await stakingToken.approve(incentivizer.address, aliceAmount, {from: alice});
    await stakingToken.approve(incentivizer.address, bobAmount, {from: bob});
  };

  const transferFundsOf = async (user, userAmount, operation) => {
    return await incentivizer.methods[operation](userAmount, {from: user});
  };

  const stakeFundsOf = async (user, userAmount) => {
    return await transferFundsOf(user, userAmount, "stake(uint256)");
  };

  const withdrawFundsOf = async (user, userAmount) => {
    return await transferFundsOf(user, userAmount, "withdraw(uint256)");;
  };

  const stakeFunds = async (aliceAmount, bobAmount) => {
    const bobReceipt = await stakeFundsOf(bob, bobAmount);
    const aliceReceipt = await stakeFundsOf(alice, aliceAmount);
    return [aliceReceipt, bobReceipt];
  };

  const withdrawFunds = async (aliceAmount, bobAmount) => {
    const bobReceipt = await withdrawFundsOf(bob, bobAmount);
    const aliceReceipt = await withdrawFundsOf(alice, aliceAmount);;
    return [aliceReceipt, bobReceipt];
  };

  const provideReward = async (rewardAmount) => {
    await rewardsToken.approve(incentivizer.address, rewardAmount, {from: rewardsDistribution});
    await rewardsToken.transfer(incentivizer.address, rewardAmount, {from: rewardsDistribution});
    return await incentivizer.notifyRewardAmount(rewardAmount, {from: rewardsDistribution});
  };

  const increaseTimeToStakingsEnd = async () => {
    const timeOffset = new BN('3600'); // 1 hour
    await time.increase(rewardsDuration.add(timeOffset));
  };

  const transfersEventCheck = (user, userAmount) => {
    return (args) => {
      expect(args.amount).to.be.bignumber.equal(userAmount);
      expect(args.user).to.be.equal(user);
    };
  };

  beforeEach(async () => {
    incentivizer = await Incentivizer.new();
    stakingToken = await getMockTokenPrepared(
      bob,
      stakingTokenAmountToTransfer,
      stakingTokenTotalSupply,
      alice
    );
    rewardsToken = await getMockTokenPrepared(
      rewardsDistribution,
      rewardsTokenAmountToTransfer,
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

  describe('views', () => {

    beforeEach(async () => {
      await provideReward(rewardAmount);
      await approveFunds(aliceAmount, bobAmount);
      await stakeFunds(aliceAmount, bobAmount);
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
      await increaseTimeToStakingsEnd();
      expect(await incentivizer.lastTimeRewardApplicable()).to.be.bignumber.equal(periodFinish);
    });

    it('should get reward per token', async () => {
      const rewardPerTokenStored = await incentivizer.rewardPerTokenStored();
      const lastTimeRewardApplicable = await incentivizer.lastTimeRewardApplicable();
      const lastUpdateTime = await incentivizer.lastUpdateTime();
      const rewardRate = await incentivizer.rewardRate();
      const totalSupply = await incentivizer.totalSupply();

      var expected = rewardPerTokenStored.add(
        lastTimeRewardApplicable.sub(lastUpdateTime)
          .mul(rewardRate).mul(ether('1')).div(totalSupply)
      );

      expect(await incentivizer.rewardPerToken()).to.be.bignumber.equal(expected);

      await increaseTimeToStakingsEnd();
      await withdrawFunds(aliceAmount, bobAmount);

      expected = await incentivizer.rewardPerTokenStored();
      expect(await incentivizer.rewardPerToken()).to.be.bignumber.equal(expected);
    });

    it('should get earned tokens amount', async () => {
      const rewardPerToken = await incentivizer.rewardPerToken();
      const userRewardPerTokenPaid = await incentivizer.userRewardPerTokenPaid(alice);
      const rewards = await incentivizer.rewards(alice);
      const balance = await incentivizer.balanceOf(alice);
      const expected = balance.mul(rewardPerToken.sub(userRewardPerTokenPaid))
        .div(ether('1')).add(rewards);
      expect(await incentivizer.earned(alice)).to.be.bignumber.equal(expected);
    });

    it('should get reward for duration', async () => {
      const rewardRate = await incentivizer.rewardRate();
      const actualRewardsDuration = await incentivizer.rewardsDuration();
      expect(await incentivizer.getRewardForDuration()).to.be.bignumber.equal(rewardRate.mul(actualRewardsDuration));
    });

  });

  describe('staking', () => {

    var bobReceipt, aliceReceipt;

    beforeEach(async () => {
      await provideReward(rewardAmount);
      await approveFunds(aliceAmount, bobAmount);
    });

    it('should emit Staked event', async () => {
      [aliceReceipt, bobReceipt] = await stakeFunds(aliceAmount, bobAmount);
      processEventArgs(bobReceipt, 'Staked', transfersEventCheck(bob, bobAmount));
      processEventArgs(aliceReceipt, 'Staked', transfersEventCheck(alice, aliceAmount));
    });

    it('should reject if trying to stake zero', async () => {
      expectRevert(stakeFundsOf(bob, ZERO), "stake0");
    });

  });

  describe('withdrawing', () => {

    var bobReceipt, aliceReceipt;

    beforeEach(async () => {
      await provideReward(rewardAmount);
      await approveFunds(aliceAmount, bobAmount);
      await stakeFunds(aliceAmount, bobAmount);
    });

    it('should emit Withdrawn event', async () => {
      await increaseTimeToStakingsEnd();
      [aliceReceipt, bobReceipt] = await withdrawFunds(aliceAmount, bobAmount);
      processEventArgs(bobReceipt, 'Withdrawn', transfersEventCheck(bob, bobAmount));
      processEventArgs(aliceReceipt, 'Withdrawn', transfersEventCheck(alice, aliceAmount));
    });

    it('should revert if withdrawing 0', async () => {
      await increaseTimeToStakingsEnd();
      expectRevert(withdrawFundsOf(bob, ZERO), "withdraw0");
    });

    it('should revert if staking is not stopeed', async () => {
      expectRevert(withdrawFundsOf(bob, bobAmount), "notFinished");
    });
  });

  describe('rewards movement', () => {

  });

});
