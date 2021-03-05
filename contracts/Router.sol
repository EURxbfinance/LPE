// SPDX-License-Identifier: MIT
pragma solidity >= 0.7.6 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./libraries/UniswapV2Library.sol";

/**
 * @title Router
 * @dev Liquidity management contract
 */
contract Router is Ownable, Initializable {
    using SafeMath for uint256;

    address public eurxb;
    address public token;
    IUniswapV2Router02 public uniswapLikeRouter;
    address public uniswapLikeFactory;

    address public teamAddress;

    uint256 public startWeightToken;
    uint256 public startWeightEurxb;

    bool public isClosedContract;

    /**
     * @dev informs that EURxb router balance is empty
     */
    event EmptyEURxbBalance();

    constructor() public {
        startWeightToken = 27 * 10 ** 18;
        startWeightEurxb = 23 * 10 ** 18;
    }

    /**
     * @dev setup uniswapLike router
     */
    function configure(
        address _uniswapLikeRouter,
        address _eurxb,
        address _token,
        address _teamAddress
    ) external initializer {
        uniswapLikeRouter = IUniswapV2Router02(_uniswapLikeRouter);
        uniswapLikeFactory = uniswapLikeRouter.factory();
        eurxb = _eurxb;
        token = _token;
        teamAddress = _teamAddress;
    }

    function setStartWeights(uint256 tokenWeight, uint256 eurxbWeight) external onlyOwner {
        startWeightToken = tokenWeight;
        startWeightEurxb = eurxbWeight;
    }

    /**
     * @dev Close contract
     */
    function closeContract() external onlyOwner {
        require(!isClosedContract, "closed");
        IERC20 eurxbContract = IERC20(eurxb);
        uint256 balance = eurxbContract.balanceOf(address(this));
        if (balance > 0) {
            require(eurxbContract.transfer(teamAddress, balance), "!transfer");
        }
        isClosedContract = true;
    }

    /**
     * @dev open contract
     */
    function reOpenContract() external onlyOwner {
        require(isClosedContract, "already open");
        isClosedContract = false;
    }

    /**
     * @dev Adding liquidity
     * @param amount number of tokens
     * @param deadline max timestamp for add liquidity to uniswap
     */
    function addLiquidity(uint256 amount, uint256 deadline) external {
        require(!isClosedContract, "closed");
        uint256 exchangeAmount = amount.div(2);
        address sender = _msgSender();
        address selfAddress = address(this);
        address uniswapLikeRouterAddress = address(uniswapLikeRouter);

        uint256 amountEUR;

        {
            (uint256 tokenRatio, uint256 eurRatio) = _getReservesRatio();

            amountEUR = exchangeAmount.mul(eurRatio).div(tokenRatio);
            uint256 balanceEUR = IERC20(eurxb).balanceOf(selfAddress);

            require(balanceEUR >= 10 ** 18, "emptyEURxbBalance"); // balance great then 1 EURxb token

            // check if we don't have enough eurxb tokens
            if (balanceEUR <= amountEUR) {
                amountEUR = balanceEUR;
                // we can take only that much
                exchangeAmount = amountEUR.mul(tokenRatio).div(eurRatio);
                emit EmptyEURxbBalance();
            }

            TransferHelper.safeTransferFrom(token, sender, selfAddress, exchangeAmount.mul(2));

            // approve transfer tokens and eurxbs to uniswapLike pair
            TransferHelper.safeApprove(token, uniswapLikeRouterAddress, exchangeAmount);
            TransferHelper.safeApprove(eurxb, uniswapLikeRouterAddress, amountEUR);
        }

        uniswapLikeRouter.addLiquidity(
            eurxb,
            token,
            amountEUR, // token B
            exchangeAmount, // token A
            0, // min A amount
            0, // min B amount
            sender, // mint liquidity to user address
            deadline
        );

        uint256 routerTokenBalance = IERC20(token).balanceOf(selfAddress);
        TransferHelper.safeTransfer(token, teamAddress, routerTokenBalance);

        TransferHelper.safeApprove(token, uniswapLikeRouterAddress, 0);
    }

    /**
     * @dev returns uniswapLike pair reserves numbers or default numbers
     * used to get token/eurxb ratio
     */
    function _getReservesRatio() internal view returns (uint256 tokenRes, uint256 eurRes) {
        (uint res0, uint res1) = UniswapV2Library.getReserves(
            uniswapLikeFactory,
            eurxb,
            token
        );
        if (res0 == 0 || res1 == 0) {
            (tokenRes, eurRes) = (startWeightToken, startWeightEurxb);
        } else {
            (address token0,) = UniswapV2Library.sortTokens(token, eurxb);
            (tokenRes, eurRes) = (token == token0) ? (res0, res1) : (res1, res0);
        }
    }
}
