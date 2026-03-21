// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WellKOCCommission
 * @notice Handles automatic commission distribution for WellKOC platform
 * @dev Commission rates are configurable by admin, matching platform_policies DB table
 *
 * Commission flow:
 * 1. Buyer pays in USDT
 * 2. Vendor's discount (15-55%) → platform revenue
 * 3. Platform distributes:
 *    - T1 KOC (direct): 40%
 *    - T2 KOC (sponsor): 13%
 *    - Pool A (monthly ranking): 9%
 *    - Pool B (annual prizes): 5%
 *    - Pool C (global quarterly): 3%
 *    - Platform ops: 30%
 */
contract WellKOCCommission is Ownable, ReentrancyGuard, Pausable {

    // ── State ────────────────────────────────────────────────
    IERC20 public immutable usdt;

    struct CommissionRates {
        uint16 t1;        // basis points (4000 = 40%)
        uint16 t2;        // 1300 = 13%
        uint16 poolA;     //  900 = 9%
        uint16 poolB;     //  500 = 5%
        uint16 poolC;     //  300 = 3%
        uint16 platform;  // 3000 = 30%
    }

    CommissionRates public rates;

    address public platformWallet;
    address public poolAWallet;   // monthly pool accumulator
    address public poolBWallet;   // annual pool accumulator
    address public poolCWallet;   // quarterly pool accumulator

    mapping(bytes32 => bool) public processedOrders;

    // ── Events ───────────────────────────────────────────────
    event OrderProcessed(
        bytes32 indexed orderId,
        address indexed buyerWallet,
        address indexed kocT1,
        uint256 totalAmount,
        uint256 platformRevenue
    );
    event CommissionPaid(
        bytes32 indexed orderId,
        address indexed recipient,
        string tier,
        uint256 amount
    );
    event RatesUpdated(CommissionRates newRates);
    event EmergencyWithdraw(address token, uint256 amount);

    // ── Constructor ──────────────────────────────────────────
    constructor(
        address _usdt,
        address _platformWallet,
        address _poolAWallet,
        address _poolBWallet,
        address _poolCWallet
    ) Ownable(msg.sender) {
        usdt             = IERC20(_usdt);
        platformWallet   = _platformWallet;
        poolAWallet      = _poolAWallet;
        poolBWallet      = _poolBWallet;
        poolCWallet      = _poolCWallet;

        // Default rates (sum = 10000 basis points = 100%)
        rates = CommissionRates({
            t1:       4000,
            t2:       1300,
            poolA:     900,
            poolB:     500,
            poolC:     300,
            platform: 3000
        });
    }

    // ── Core: Process order payment ──────────────────────────
    /**
     * @notice Process a delivered order and distribute commissions
     * @param orderId     Unique order identifier (from backend)
     * @param amount      Total order amount in USDT (6 decimals)
     * @param discountBps Vendor discount in basis points (1500-5500)
     * @param kocT1       KOC T1 wallet (direct seller)
     * @param kocT2       KOC T2 wallet (sponsor) — address(0) if none
     */
    function processOrder(
        bytes32 orderId,
        uint256 amount,
        uint16  discountBps,
        address kocT1,
        address kocT2
    ) external nonReentrant whenNotPaused {
        require(!processedOrders[orderId], "Order already processed");
        require(discountBps >= 1500 && discountBps <= 5500, "Discount must be 15-55%");
        require(kocT1 != address(0), "KOC T1 required");
        require(amount > 0, "Amount must be > 0");

        // Pull payment from buyer
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );

        // Calculate platform revenue
        uint256 platformRevenue = (amount * discountBps) / 10000;
        uint256 vendorReceives  = amount - platformRevenue;

        // Distribute to vendor (not handled here — vendor is paid off-chain)
        // Platform revenue stays in contract for distribution below

        // T1: 40%
        uint256 t1Amount = (platformRevenue * rates.t1) / 10000;
        require(usdt.transfer(kocT1, t1Amount), "T1 transfer failed");
        emit CommissionPaid(orderId, kocT1, "T1", t1Amount);

        // T2: 13% (only if T2 exists)
        uint256 t2Amount = 0;
        if (kocT2 != address(0)) {
            t2Amount = (platformRevenue * rates.t2) / 10000;
            require(usdt.transfer(kocT2, t2Amount), "T2 transfer failed");
            emit CommissionPaid(orderId, kocT2, "T2", t2Amount);
        }

        // Pool A: 9%
        uint256 poolAAmount = (platformRevenue * rates.poolA) / 10000;
        require(usdt.transfer(poolAWallet, poolAAmount), "Pool A transfer failed");
        emit CommissionPaid(orderId, poolAWallet, "PoolA", poolAAmount);

        // Pool B: 5%
        uint256 poolBAmount = (platformRevenue * rates.poolB) / 10000;
        require(usdt.transfer(poolBWallet, poolBAmount), "Pool B transfer failed");
        emit CommissionPaid(orderId, poolBWallet, "PoolB", poolBAmount);

        // Pool C: 3%
        uint256 poolCAmount = (platformRevenue * rates.poolC) / 10000;
        require(usdt.transfer(poolCWallet, poolCAmount), "Pool C transfer failed");
        emit CommissionPaid(orderId, poolCWallet, "PoolC", poolCAmount);

        // Platform ops: remainder (30% or adjusted if no T2)
        uint256 distributed = t1Amount + t2Amount + poolAAmount + poolBAmount + poolCAmount;
        uint256 platformAmount = platformRevenue - distributed;
        require(usdt.transfer(platformWallet, platformAmount), "Platform transfer failed");
        emit CommissionPaid(orderId, platformWallet, "Platform", platformAmount);

        processedOrders[orderId] = true;

        emit OrderProcessed(orderId, msg.sender, kocT1, amount, platformRevenue);
    }

    // ── Admin functions ──────────────────────────────────────
    function updateRates(CommissionRates calldata newRates) external onlyOwner {
        uint256 total = newRates.t1 + newRates.t2 + newRates.poolA +
                        newRates.poolB + newRates.poolC + newRates.platform;
        require(total == 10000, "Rates must sum to 10000 bps");
        rates = newRates;
        emit RatesUpdated(newRates);
    }

    function updateWallets(
        address _platform,
        address _poolA,
        address _poolB,
        address _poolC
    ) external onlyOwner {
        platformWallet = _platform;
        poolAWallet    = _poolA;
        poolBWallet    = _poolB;
        poolCWallet    = _poolC;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Emergency withdraw
    function emergencyWithdraw(address token) external onlyOwner {
        IERC20 t = IERC20(token);
        uint256 bal = t.balanceOf(address(this));
        require(t.transfer(owner(), bal), "Transfer failed");
        emit EmergencyWithdraw(token, bal);
    }

    // View helpers
    function getRates() external view returns (CommissionRates memory) { return rates; }
    function isProcessed(bytes32 orderId) external view returns (bool) { return processedOrders[orderId]; }
}
