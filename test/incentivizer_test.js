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

  const stakingTokenTotalSupply = ether('1000');
  const rewardsTokenTotalSupply = ether('1000');
  const stakingTokenAmount = ether('100');
  const rewardsTokenAmount = ether('100');

  var incentivizer;
  var stakingToken;
  var rewardsToken;

  beforeEach(async () => {
    incentivizer = await Incentivizer.new();
    stakingToken = await getMockTokenPrepared(
      rewardsDistribution,
      mockedAmount,
      totalSupply,
      from
    );
    rewardsToken = await getMockTokenPrepared(
      mintTo,
      mockedAmount,
      totalSupply,
      from
    );
  });

  it('should configure properly', async () => {

  });

});
