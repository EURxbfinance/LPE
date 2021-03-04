// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

/**
 * @title Router
 * @dev Liquidity management contract
 */
contract Router is Ownable, Initializable {
    using SafeMath for uint256;

    /**
     * @dev informs that EURxb router balance is empty
     */
    event EmptyEURxbBalance();

    IERC20 public EURxb;
    IUniswapV2Router02 public uniswapLikeRouter;

    address public teamAddress;
    bool public isClosedContract;
    address public pairAddress;

    constructor(address _teamAddress) public {
        teamAddress = _teamAddress;
    }

    /**
     * @dev setup uniswapLike router
     */
    function configure(
        address _uniswapLikeRouter,
        address _EURxb,
        address _pairAddress
    ) external initializer {
        // set uniswapLike router contract address
        uniswapLikeRouter = IUniswapV2Router02(_uniswapLikeRouter);
        // set eurxb contract address
        EURxb = IERC20(_EURxb);
        pairAddress = _pairAddress;
    }

    /**
     * @dev Close contract
     */
    function closeContract() external onlyOwner {
        require(!isClosedContract, "closed");
        uint256 balance = EURxb.balanceOf(address(this));
        if (balance > 0) {
            require(EURxb.transfer(teamAddress, balance), "!transfer");
        }
        isClosedContract = true;
    }

    /**
     * @dev Adding liquidity
     * @param token address
     * @param amount number of tokens
     */
    function addLiquidity(address token, uint256 amount) external {
        require(!isClosedContract, "closed");
        _addLiquidity(_msgSender(), token, amount);
    }

    /**
     * @dev Adds liquidity for any of pairs
     * @param token address
     * @param amount number of tokens
     */
    function _addLiquidity(address sender, address token, uint256 amount) internal {
        uint256 exchangeAmount = amount.div(2);

        (uint256 tokenRatio, uint256 eurRatio) = _getReservesRatio(token);

        uint256 amountEUR = exchangeAmount.mul(eurRatio).div(tokenRatio);
        uint256 balanceEUR = EURxb.balanceOf(address(this));

        require(balanceEUR >= 10 ** 18, "emptyEURxbBalance"); // balance great then 1 EURxb token

        // check if we don't have enough eurxb tokens
        if (balanceEUR <= amountEUR) {
            amountEUR = balanceEUR;
            // we can take only that much
            exchangeAmount = amountEUR.mul(tokenRatio).div(eurRatio);
            emit EmptyEURxbBalance();
        }

        TransferHelper.safeTransferFrom(token, sender, address(this), exchangeAmount.mul(2));

        // approve transfer tokens and eurxbs to uniswapLike pair
        TransferHelper.safeApprove(token, address(uniswapLikeRouter), exchangeAmount);
        TransferHelper.safeApprove(address(EURxb), address(uniswapLikeRouter), amountEUR);

        (, , uint256 liquidityAmount) = uniswapLikeRouter
        .addLiquidity(
            address(EURxb),
            token,
            amountEUR, // token B
            exchangeAmount, // token A
            0, // min A amount
            0, // min B amount
            address(this), // mint liquidity to router, not user
            block.timestamp + 10 minutes // deadline 10 minutes
        );

        uint256 routerTokenBalance = IERC20(token).balanceOf(address(this));
        TransferHelper.safeTransfer(token, teamAddress, routerTokenBalance);
        TransferHelper.safeTransfer(pairAddress, sender, liquidityAmount);
    }

    /**
     * @dev returns uniswapLike pair reserves numbers or default numbers
     * used to get token/eurxb ratio
     */
    function _getReservesRatio(address token)
    internal
    returns (uint256 tokenRes, uint256 eurRes)
    {
        (uint112 res0, uint112 res1,) = IUniswapV2Pair(pairAddress).getReserves();
        if (res0 == 0 || res1 == 0) {
            (tokenRes, eurRes) = (
                (10 ** uint256(_getTokenDecimals(token))).mul(27),
                (10 ** uint256(_getTokenDecimals(address(EURxb)))).mul(23)
            );
        } else {
            (address token0,) = _sortTokens(token, address(EURxb));
            (tokenRes, eurRes) = (token == token0) ? (res0, res1) : (res1, res0);
        }
    }

    /**
     * @dev sorts token addresses just like uniswapLike router does
     */
    function _sortTokens(address tokenA, address tokenB)
    internal pure
    returns (address token0, address token1)
    {
        require(tokenA != tokenB, "identicalTokens");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'zeroAddress');
    }

    function _getTokenDecimals(address token) internal returns (uint8) {
        // bytes4(keccak256(bytes('decimals()')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x313ce567));
        require(success &&
            (data.length == 0 ||
            abi.decode(data, (uint8)) > 0 ||
            abi.decode(data, (uint8)) < 100), "DECIMALS_NOT_FOUND");
        return abi.decode(data, (uint8));
    }
}
