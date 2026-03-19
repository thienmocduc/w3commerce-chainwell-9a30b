// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AffiliateRouter
 * @notice Multi-tier commission splitter with checks-effects-interactions
 * @dev Distributes W3C tokens among platform, vendors, and KOCs per order
 */
contract AffiliateRouter is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ORDER_PROCESSOR_ROLE = keccak256("ORDER_PROCESSOR_ROLE");

    IERC20 public immutable token;
    address public platformWallet;
    uint256 public platformFeeRate = 250; // 2.5% in basis points (10000 = 100%)

    struct CommissionSplit {
        address[] kocAddresses;
        uint256[] splitRatios;  // basis points per KOC (must sum to <= 10000)
        uint256 vendorRate;     // vendor's share in basis points
    }

    event CommissionPaid(
        bytes32 indexed orderId,
        address indexed vendor,
        address[] kocs,
        uint256[] amounts,
        uint256 platformFee
    );
    event PlatformFeeUpdated(uint256 newRate);

    constructor(address _token, address _platformWallet) {
        require(_token != address(0), "Invalid token");
        require(_platformWallet != address(0), "Invalid platform wallet");

        token = IERC20(_token);
        platformWallet = _platformWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Process commission distribution for a completed order
     * @param orderId bytes32 hash of order UUID for event tracking
     * @param vendor Vendor address receiving their share
     * @param totalAmount Total order value in W3C tokens
     * @param split Commission split configuration
     */
    function processCommission(
        bytes32 orderId,
        address vendor,
        uint256 totalAmount,
        CommissionSplit calldata split
    ) external onlyRole(ORDER_PROCESSOR_ROLE) nonReentrant {
        require(vendor != address(0), "Invalid vendor");
        require(totalAmount > 0, "Amount must be positive");
        require(
            split.kocAddresses.length == split.splitRatios.length,
            "Array mismatch"
        );
        require(split.kocAddresses.length <= 5, "Max 5 KOCs per split");

        // Validate ratios sum
        uint256 totalKocRatio = 0;
        for (uint256 i = 0; i < split.splitRatios.length; i++) {
            totalKocRatio += split.splitRatios[i];
        }
        require(
            totalKocRatio + split.vendorRate + platformFeeRate <= 10000,
            "Ratios exceed 100%"
        );

        // Calculate amounts
        uint256 platformAmount = (totalAmount * platformFeeRate) / 10000;
        uint256 vendorAmount = (totalAmount * split.vendorRate) / 10000;
        uint256[] memory kocAmounts = new uint256[](split.kocAddresses.length);

        for (uint256 i = 0; i < split.kocAddresses.length; i++) {
            kocAmounts[i] = (totalAmount * split.splitRatios[i]) / 10000;
        }

        // Emit event (effects)
        emit CommissionPaid(orderId, vendor, split.kocAddresses, kocAmounts, platformAmount);

        // Interactions — transfer from caller (must have approved this contract)
        if (platformAmount > 0) {
            token.safeTransferFrom(msg.sender, platformWallet, platformAmount);
        }
        if (vendorAmount > 0) {
            token.safeTransferFrom(msg.sender, vendor, vendorAmount);
        }
        for (uint256 i = 0; i < split.kocAddresses.length; i++) {
            if (kocAmounts[i] > 0 && split.kocAddresses[i] != address(0)) {
                token.safeTransferFrom(msg.sender, split.kocAddresses[i], kocAmounts[i]);
            }
        }
    }

    /**
     * @notice Update platform fee rate — admin only
     * @param newRate New rate in basis points (max 1000 = 10%)
     */
    function updatePlatformFee(
        uint256 newRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRate <= 1000, "Max 10% platform fee");
        platformFeeRate = newRate;
        emit PlatformFeeUpdated(newRate);
    }

    /**
     * @notice Update platform wallet — admin only
     */
    function updatePlatformWallet(
        address newWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid address");
        platformWallet = newWallet;
    }
}
