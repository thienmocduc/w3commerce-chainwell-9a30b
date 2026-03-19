// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title W3CToken
 * @notice ERC-20 utility token for W3Commerce with dynamic pricing oracle
 * @dev Includes role-based minting, burning, and oracle price updates
 */
contract W3CToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Token price in USDC (6 decimals)
    uint256 public tokenPriceUSDC;

    /// @notice Maximum supply: 1 billion tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event TokensBurned(address indexed burner, uint256 amount);

    constructor(address admin) ERC20("W3Commerce Token", "W3C") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Calculate tokens required for a fixed USDC amount
     * @param fixedUSDCAmount Amount in USDC (6 decimals)
     * @return tokensRequired Number of tokens needed (18 decimals)
     */
    function calculateTokensRequired(
        uint256 fixedUSDCAmount
    ) public view returns (uint256 tokensRequired) {
        require(tokenPriceUSDC > 0, "Price not set");
        tokensRequired = (fixedUSDCAmount * 10 ** 18) / tokenPriceUSDC;
    }

    /**
     * @notice Update token price — oracle only
     * @param newPriceUSDC New price in USDC (6 decimals)
     */
    function updatePrice(
        uint256 newPriceUSDC
    ) external onlyRole(ORACLE_ROLE) {
        require(newPriceUSDC > 0, "Price must be positive");
        tokenPriceUSDC = newPriceUSDC;
        emit PriceUpdated(newPriceUSDC, block.timestamp);
    }

    /**
     * @notice Mint new tokens — minter only
     */
    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from caller's balance
     */
    function burn(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
