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

  const stakingTokenTotalSupply = ether('10');
  const rewardsTokenTotalSupply = ether('10');
  const stakingTokenAmountToTransfer = ether('5');
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

  const aliceAmount = ether('1');
  const bobAmount = ether('1');
  const totalSupply = aliceAmount.add(bobAmount);
  const rewardAmount = ether('5');

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

  const provideReward = async (rewardAmount, otherFrom=null) => {
    const txParams = {from: !otherFrom ? rewardsDistribution : otherFrom};
    await rewardsToken.approve(incentivizer.address, rewardAmount, txParams);
    await rewardsToken.transfer(incentivizer.address, rewardAmount, txParams);
    return await incentivizer.notifyRewardAmount(rewardAmount, txParams);
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

  const expectedEarned = async (user) => {
    var rewardPerToken = await incentivizer.rewardPerToken();
    var userRewardPerTokenPaid = await incentivizer.userRewardPerTokenPaid(user);
    var rewards = await incentivizer.rewards(user);
    var balance = await incentivizer.balanceOf(user);
    var expected = balance.mul(rewardPerToken.sub(userRewardPerTokenPaid))
      .div(ether('1')).add(rewards);

    return expected;
  };

  describe('with real mock tokens', () => {

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
        expect(await incentivizer.earned(alice)).to.be.bignumber.equal(
          await expectedEarned(alice)
        );
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
        await expectRevert(stakeFundsOf(bob, ZERO), "stake0");
      });

    });

    describe('withdrawing and setters', () => {

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
        await expectRevert(withdrawFundsOf(bob, ZERO), "withdraw0");
      });

      it('should revert if staking is not stopeed', async () => {
        await expectRevert(withdrawFundsOf(bob, bobAmount), "notFinished");
      });

      it('should set rewards duration when staking stopped', async () => {
        await increaseTimeToStakingsEnd();
        await incentivizer.setRewardsDuration(ZERO);
        expect(await incentivizer.rewardsDuration()).to.be.bignumber.equal(ZERO);
      });

      it('should revert setting rewards duration if staking is not stopped', async () => {
        await expectRevert(incentivizer.setRewardsDuration(ZERO), "notFinished");
      });
    });

    describe('getting rewards', () => {

      var receipt;
      var rewardToPay;

      beforeEach(async () => {
        await provideReward(rewardAmount);
        await approveFunds(aliceAmount, bobAmount);

        await stakeFundsOf(bob, bobAmount.div(new BN('2')));

        await time.increase(new BN('3600'));
        await stakeFundsOf(bob, bobAmount.div(new BN('2')));
        receipt = await incentivizer.getReward({from: bob});
      });

      it('should emit RewardPaid event and transfer rewards', async () => {
        const balanceOfBob = await rewardsToken.balanceOf(bob);
        processEventArgs(receipt, 'RewardPaid', (args) => {
          expect(args.user).to.be.equal(bob);
          expect(args.reward).to.be.bignumber.equal(balanceOfBob);
        });
      });

    });

    describe('rewards management without mock contract', () => {

      it('should calculate reward rate properly when notify reward amount at start', async () => {
        await provideReward(rewardAmount);
        const actualRewardsDuration = await incentivizer.rewardsDuration();
        var expected = rewardAmount.div(actualRewardsDuration);
        expect(await incentivizer.rewardRate()).to.be.bignumber.equal(expected);
      });

      it('should calculate reward rate properly when notify reward amount in process', async () => {
        const rewardPart = rewardAmount.div(new BN('2'));
        await provideReward(rewardPart);
        await time.increase(new BN('3600'));

        const currentTime = await time.latest();
        const actualRewardsDuration = await incentivizer.rewardsDuration();
        const oldRewardRate = await incentivizer.rewardRate();
        const periodFinish = await incentivizer.periodFinish();

        const remaining = periodFinish.sub(currentTime);
        const leftover = remaining.mul(oldRewardRate);
        const expectedRate = rewardPart.add(leftover).div(actualRewardsDuration);

        await provideReward(rewardPart);

        // Formula debugging logs
        // console.log('---');
        // console.log('periodFinish', periodFinish.toString());
        // console.log('currentTime', currentTime.toString());
        // console.log('remaining', remaining.toString());
        // console.log('oldRewardRate', oldRewardRate.toString());
        // console.log('leftover', leftover.toString());
        // console.log('reward', rewardPart.toString());
        // console.log('rewardsDuration', actualRewardsDuration.toString());
        // console.log('rewardRate', expectedRate.toString());
        // console.log('---');

        const actualRate = await incentivizer.rewardRate();
        // its an error that created by difference in block.timestamp and currentTime in 1 second
        const oneSecondError = new BN('837245');
        expect(actualRate.sub(expectedRate).abs()).to.be.bignumber.at.most(oneSecondError)
      });

      it('should revert if msg.sender is not in rewards distribution role', async () => {
        await rewardsToken.approve(bob, rewardAmount, {from: rewardsDistribution});
        await rewardsToken.transfer(bob, rewardAmount, {from: rewardsDistribution});
        await expectRevert(provideReward(rewardAmount, bob), "!rewardsDistribution");
      });

      it('should emit RewardAdded event', async () => {
        const receipt = await provideReward(rewardAmount);
        processEventArgs(receipt, 'RewardAdded', (args) => {
          expect(args.reward).to.be.bignumber.equal(rewardAmount);
        });
      });

      it('should initialize time interval', async () => {
        await provideReward(rewardAmount);
        expect(await incentivizer.lastUpdateTime()).to.be.bignumber.equal(
          await time.latest()
        );
        expect(await incentivizer.periodFinish()).to.be.bignumber.equal(
          (await time.latest()).add(await incentivizer.rewardsDuration())
        );
      });
    });
  });

  describe('rewards management with mock contract', () => {

    var receipt;

    beforeEach(async () => {
      incentivizer = await Incentivizer.new();
      rewardsToken = await MockContract.new();
      stakingToken = rewardsToken;
      await incentivizer.configure(
        rewardsDistribution,
        rewardsToken.address,
        stakingToken.address,
        rewardsDuration
      );
    });

    it('should revert if reward rate lt its intended to be', async () => {
      const balanceOfCalldata = (await IERC20.at(rewardsToken.address)).contract
        .methods.balanceOf(ZERO_ADDRESS).encodeABI();
      await rewardsToken.givenMethodReturnUint(balanceOfCalldata, ether('0.5'));
      await expectRevert(incentivizer.notifyRewardAmount(rewardAmount, {from: rewardsDistribution}),
        "tooHighReward");
    });

  });

});
