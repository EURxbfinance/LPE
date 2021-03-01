pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

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

    mapping(address => EnumerableSet.AddressSet) public sharesHolders;
    mapping(address => mapping(address => uint256)) public sharesBalances;

    address public scheduler;
    address public provider;

    address public providerToken;
    address public incentivizeToken;
    address public providerIncentivizeTokensPairAddress;

    EnumerableSet.UintSet public startTimes;
    EnumerableSet.UintSet public endTimes;
    EnumerableSet.UintSet public timesToAmounts;

    modifier onlyScheduler {
        require(msg.sender == scheduler, "!scheduler");
        _;
    }

    modifier onlyProvider {
        require(msg.sender == provider, "!scheduler");
        _;
    }

    function configure(
        address _providerIncentivizeTokensPairAddress
        address _eurxbAddress,
        address _scheduler,
        address _provider,
        uint256[] calldata _startTimes,
        uint256[] calldata _endTimes,
        uint256[] calldata _timesToAmounts
    ) external initializer {
        require(_startTimes.length == _endTimes.length, "!startEnd");
        require(_startTimes.length == _timesToAmounts.length, "!startTimes");
        require(_endTimes.length == _timesToAmounts.length, "!endTimes");
        providerIncentivizeTokensPairAddress = _providerIncentivizeTokensPairAddress;
        providerToken = _eurxbAddress;
        scheduler = _scheduler;
        provider = _provider;
        for (uint256 i = 0; i < _startTimes.length; i++) {
            startTimes.add(_startTimes[i]);
            endTimes.add(_endTimes[i]);
            timesToAmounts.add(_timesToAmounts[i]);
        }
    }

    function buyOnSchedule(address _lpTokenAddress) external onlyScheduler {
        uint256 _providerTokenAmountToSpend = getAmountFromTime(block.timestamp);
        require(_providerTokenAmountToSpend > 0, "!scheduled");
        uint256 _boughtIncentivizeToken = 0; //TODO: buy from pair
        incentivize(_lpTokenAddress, _boughtIncentivizeToken);
    }

    function provide(uint256 _amount) external onlyProvider {
        IERC20(providerToken).safeTransfer(address(this), _amount);
    }

    function stake(address _lpTokenAddress, uint256 _amount) external {
        IERC20(_lpTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        setShare(_lpTokenAddress, sharesBalances[_lpTokenAddress][msg.sender].add(_amount));
    }

    function withdraw(address _lpTokenAddress, uint256 _amount) external {
        IERC20(_lpTokenAddress).safeTransfer(msg.sender, _amount);
        setShare(_lpTokenAddress, sharesBalances[_lpTokenAddress][msg.sender].sub(_amount));
    }

    function budget() view external returns(uint256) {
        return IERC20(providerToken).balanceOf(address(this));
    }

    function addSchedule(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _amount
    ) onlyScheduler external {
        startTimes.add(_startTime);
        endTimes.add(_endTime);
        timesToAmounts.add(_amount);
    }

    function removeSchedule(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _amount
    ) onlyScheduler external {
        startTimes.remove(_startTime);
        endTimes.remove(_endTime);
        timesToAmounts.remove(_amount);
    }

    function getAmountFromTime(uint256 _timestamp) internal view returns(uint256) {
        for (uint256 i = 0; i < startTimes.length(); i++) {
          if (startTimes.at(i) < _timestamp && endTimes.at(i) > _timestamp) {
              return timesToAmounts.at(i);
          }
        }
        return 0;
    }

    function incentivize(
        address _lpTokenAddress,
        uint256 _incentivizeTokenAmount
    ) internal {
        for (uint256 i = 0; i < sharesHolders[_lpTokenAddress].length(); i++) {
            address _shareHolder = sharesHolders[_lpTokenAddress].at(i);
            uint256 _holderBalance = sharesBalances[_lpTokenAddress][_shareHolder];
            if (_holderBalance > 0) {
                // TODO: use shareBalance as rank in distribution
                uint256 _amountIncetivizeTokens = 0;
                IERC20(incentivizeToken).transfer(_shareHolder, _amountIncetivizeTokens);
            }
        }
    }

    function setShare(address _lpTokenAddress, uint256 _amount) internal {
        if (_amount > 0) {
          sharesHolders[_lpTokenAddress].add(msg.sender);
        } else {
          sharesHolders[_lpTokenAddress].remove(msg.sender);
        }
        sharesBalances[_lpTokenAddress][msg.sender] = _amount;
    }

}
