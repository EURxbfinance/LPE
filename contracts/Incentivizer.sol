// SPDX-License-Identifier: MIT
pragma solidity >= 0.7.6 <0.9.0;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./libraries/RewardsDistributionRecipient.sol";
import "./interfaces/IStakingRewards.sol";
import "./libraries/UniswapV2Library.sol";

contract Incentivizer is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard, Initializable, Context {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public baseToken;
    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    IUniswapV2Pair public pairAddress; // pair XBE-eurxb

    uint256 public globalRewardsDuration;
    uint256 public buyOnScheduleRate;
    uint256 public globalPeriodFinish;
    uint256 public lastBuyOnScheduleTime;

    uint256 public rewardRate;
    uint256 public periodFinish;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;

    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // mapping(address => uint256) public lastTimeBalanceChanged;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    IUniswapV2Router02 public uniswapRouter;

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            // lastTimeBalanceChanged[msg.sender] = block.timestamp;
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== INITIALIZER ========== */

    function configure(
        address _rewardsDistribution,
        address _uniswapRouter,
        address _eurxbAddress,
        address _xbeAddress,
        address _lpTokenAddress,
        uint256 _rewardsDuration, // 1 days
        uint256 _globalRewardsDuration // 25 days
    ) external initializer {
        rewardsDistribution = _rewardsDistribution;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter); // 0x7a250d5630b4cf539739df2c5dacb4c659f2488d
        pairAddress = IUniswapV2Pair(UniswapV2Library.pairFor(uniswapRouter.factory(), _eurxbAddress, _xbeAddress));
        stakingToken = IERC20(_lpTokenAddress);
        rewardsToken = IERC20(_xbeAddress);
        baseToken = IERC20(_eurxbAddress);
        globalRewardsDuration = _globalRewardsDuration;
        rewardsDuration = _rewardsDuration;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view override returns(uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns(uint256) {
        return _balances[account];
    }

    function chooseMinTime(uint256 otherTime) internal view returns(uint256) {
        return Math.min(block.timestamp, otherTime);
    }

    function lastTimeRewardApplicable() public view override returns(uint256) {
        return chooseMinTime(periodFinish);
    }

    function rewardPerToken() public view override returns(uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored.add(
            lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
        );
    }

    function earned(address account) public view override returns(uint256) {
        // uint256 lastTimeStaked = lastTimeBalanceChanged[account];
        return _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    function getRewardForDuration() external view override returns(uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    function budget() public view returns(uint256) {
        return IERC20(baseToken).balanceOf(address(this));
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function buyOnSchedule() external onlyRewardsDistribution {
        require(rewardsDuration < globalRewardsDuration, "!rewardRatesInvalid");

        buyOnScheduleRate = calculateRate(globalPeriodFinish, globalRewardsDuration, budget(), buyOnScheduleRate);
        checkRate(baseToken, globalRewardsDuration, buyOnScheduleRate);

        uint256 baseTokensToSpend = chooseMinTime(globalPeriodFinish)
            .sub(lastBuyOnScheduleTime).mul(buyOnScheduleRate);

        require(baseToken.transferFrom(_msgSender(), address(this), baseTokensToSpend), "!transfer");
        require(baseToken.approve(address(uniswapRouter), baseTokensToSpend), "!approve");

        address[] memory path = new address[](2);
        path[0] = address(baseToken);
        path[1] = address(rewardsToken);
        uint256 reward = UniswapV2Library.getAmountsOut(uniswapRouter.factory(), baseTokensToSpend, path)[1];
        uniswapRouter.swapExactTokensForETH(baseTokensToSpend, reward, path, _msgSender(), block.timestamp);

        lastBuyOnScheduleTime = block.timestamp;

        notifyRewardAmount(reward);
    }

    function calculateRate(uint256 _timeFinish, uint256 _duration, uint256 _rewardAmount, uint256 _oldRate)
        internal
        view
        returns(uint256 rate)
    {
      if (block.timestamp >= _timeFinish) {
          rate = _rewardAmount.div(_duration);
      } else {
          uint256 remaining = _timeFinish.sub(block.timestamp);
          uint256 leftover = remaining.mul(_oldRate);
          rate = _rewardAmount.add(leftover).div(_duration);
      }
    }

    function checkRate(IERC20 _token, uint256 _duration, uint256 _rate) internal {
        uint256 balance = _token.balanceOf(address(this));
        require(_rate <= balance.div(_duration), "rateTooHigh");
    }

    function notifyRewardAmount(uint256 reward)
        public
        override
        onlyRewardsDistribution
        updateReward(address(0))
    {
        rewardRate = calculateRate(periodFinish, rewardsDuration, reward, rewardRate);

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        checkRate(rewardsToken, rewardsDuration, rewardRate);

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);

        emit RewardAdded(reward);
    }
}
