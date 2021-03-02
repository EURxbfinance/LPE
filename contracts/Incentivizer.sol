pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "./templates/Initializable.sol";


/**
 * @title Incentivizer
 * @dev This contract allows users to incentivize their LP profits in XBE.
 */
contract Incentivizer is Initializable {

    using SafeMath for uint256;
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public sharesBalances;

    address public scheduler;
    address public rewardDistribution;

    IERC20 public providerToken; // eurxb token
    IERC20 public incentivizeToken; // XBE token
    IERC20 public providerIncentivizeTokensPairAddress; // pair XBE-eurxb
    IUniswapV2Router02 public uniswapRouter;

//    EnumerableSet.UintSet public startTimes;
//    EnumerableSet.UintSet public endTimes;
//    EnumerableSet.UintSet public timesToAmounts;

    event Staked(address indexed user, address indexed stakingToken, uint256 amount);
    event Withdrawn(address indexed user, address indexed stakingToken, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward);

    modifier onlyScheduler {
        require(_msgSender() == scheduler, "!scheduler");
        _;
    }

    modifier onlyRewardDistribution {
        require(_msgSender() == rewardDistribution, "Caller is not reward distribution.");
        _;
    }

    function configure(
        address _scheduler,
        address _rewardDistribution,
        address _uniswapRouter,
        address _eurxbAddress,
        address _xbeAddress
//        uint256[] calldata _startTimes,
//        uint256[] calldata _endTimes,
//        uint256[] calldata _timesToAmounts
    ) external initializer {
//        require(_startTimes.length == _endTimes.length, "!startEnd");
//        require(_startTimes.length == _timesToAmounts.length, "!startTimes");
//        require(_endTimes.length == _timesToAmounts.length, "!endTimes");
        scheduler = _scheduler;
        rewardDistribution = _rewardDistribution;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter); // 0x7a250d5630b4cf539739df2c5dacb4c659f2488d
        providerIncentivizeTokensPairAddress = UniswapV2Library.pairFor(uniswapRouter.factory(), _eurxbAddress, _xbeAddress);
        providerToken = IERC20(_eurxbAddress);
        incentivizeToken = IERC20(_xbeAddress);
//        for (uint256 i = 0; i < _startTimes.length; i++) {
//            startTimes.add(_startTimes[i]);
//            endTimes.add(_endTimes[i]);
//            timesToAmounts.add(_timesToAmounts[i]);
//        }
    }

    function budget() view external returns(uint256) {
        return providerToken.balanceOf(address(this));
    }

    function buyOnSchedule(address _lpTokenAddress) external onlyScheduler {
//        uint256 _providerTokenAmountToSpend = getAmountFromTime(block.timestamp);
//        require(_providerTokenAmountToSpend > 0, "!scheduled");
//        uint256 _boughtIncentivizeToken = 0; //TODO: buy from pair
//        incentivize(_lpTokenAddress, _boughtIncentivizeToken);
    }

    function notifyRewardAmount(uint256 _reward)
        external
        onlyRewardDistribution
    {
        providerToken.safeTransferFrom(_msgSender(), address(this), _reward);
//        if (block.timestamp >= periodFinish) {
//            rewardRate = _reward.div(DURATION);
//        } else {
//            uint256 remaining = periodFinish.sub(block.timestamp);
//            uint256 leftover = remaining.mul(rewardRate);
//            rewardRate = _reward.add(leftover).div(DURATION);
//        }
//        lastUpdateTime = block.timestamp;
//        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(_reward);
    }

    function stake(address _lpTokenAddress, uint256 _amount) external {
        require(_amount > 0, "Cannot stake 0");
        address user = _msgSender();
        IERC20(_lpTokenAddress).safeTransferFrom(user, address(this), _amount);
        sharesBalances[_lpTokenAddress][user] = sharesBalances[user][_msgSender()].add(_amount);
        emit Staked(user, _lpTokenAddress, _amount);
    }

    function withdraw(address _lpTokenAddress, uint256 _amount) external {
        require(_amount > 0, "Cannot withdraw 0");
        address user = _msgSender();
        IERC20(_lpTokenAddress).safeTransfer(user, _amount);
        sharesBalances[_lpTokenAddress][user] = sharesBalances[_lpTokenAddress][user].sub(_amount);
        emit Withdrawn(user, _lpTokenAddress, _amount);
    }

//    function addSchedule(
//        uint256 _startTime,
//        uint256 _endTime,
//        uint256 _amount
//    ) onlyScheduler external {
//        startTimes.add(_startTime);
//        endTimes.add(_endTime);
//        timesToAmounts.add(_amount);
//    }
//
//    function removeSchedule(
//        uint256 _startTime,
//        uint256 _endTime,
//        uint256 _amount
//    ) onlyScheduler external {
//        startTimes.remove(_startTime);
//        endTimes.remove(_endTime);
//        timesToAmounts.remove(_amount);
//    }
//
//    function getAmountFromTime(uint256 _timestamp) internal view returns(uint256) {
//        for (uint256 i = 0; i < startTimes.length(); i++) {
//          if (startTimes.at(i) < _timestamp && endTimes.at(i) > _timestamp) {
//              return timesToAmounts.at(i);
//          }
//        }
//        return 0;
//    }

    function incentivize(
        address _lpTokenAddress,
        uint256 _incentivizeTokenAmount
    ) internal {
//        for (uint256 i = 0; i < sharesHolders[_lpTokenAddress].length(); i++) {
//            address _shareHolder = sharesHolders[_lpTokenAddress].at(i);
//            uint256 _holderBalance = sharesBalances[_lpTokenAddress][_shareHolder];
//            if (_holderBalance > 0) {
//                // TODO: use shareBalance as rank in distribution
//                uint256 _amountIncetivizeTokens = 0;
//                IERC20(incentivizeToken).transfer(_shareHolder, _amountIncetivizeTokens);
//            }
//        }
    }
}
