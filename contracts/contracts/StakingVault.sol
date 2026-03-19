// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title StakingVault
 * @notice Staking with slash mechanism for quality enforcement
 * @dev Follows checks-effects-interactions pattern throughout
 */
contract StakingVault is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant SLASH_ROLE = keccak256("SLASH_ROLE");

    IERC20 public immutable token;

    uint256 public constant VENDOR_MIN_STAKE = 1000 * 10 ** 18;
    uint256 public constant KOC_MIN_STAKE = 100 * 10 ** 18;
    uint256 public constant LOCK_PERIOD = 7 days;

    address public rewardPool;
    address public constant BURN_ADDRESS = address(0xdEaD);
    uint256 public burnRatio = 50; // 50% burned, 50% to reward pool

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        bool isVendor;
        bool isActive;
    }

    mapping(address => StakeInfo) public stakes;
    mapping(address => bool) public isVendorApproved;

    event Staked(address indexed user, uint256 amount, bool isVendor);
    event Unstaked(address indexed user, uint256 amount);
    event Slashed(address indexed target, uint256 amount, string reason);
    event BurnRatioUpdated(uint256 newRatio);

    constructor(address _token, address _rewardPool) {
        require(_token != address(0), "Invalid token");
        require(_rewardPool != address(0), "Invalid reward pool");

        token = IERC20(_token);
        rewardPool = _rewardPool;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Stake tokens as vendor or KOC
     * @param amount Amount of W3C tokens to stake
     * @param asVendor True if staking as vendor (higher minimum)
     */
    function stake(uint256 amount, bool asVendor) external nonReentrant {
        uint256 minRequired = asVendor ? VENDOR_MIN_STAKE : KOC_MIN_STAKE;
        require(amount >= minRequired, "Insufficient stake amount");
        require(!stakes[msg.sender].isActive, "Already staked");

        // Effects first
        stakes[msg.sender] = StakeInfo({
            amount: amount,
            stakedAt: block.timestamp,
            isVendor: asVendor,
            isActive: true
        });

        if (asVendor) {
            isVendorApproved[msg.sender] = true;
        }

        // Interactions last
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, asVendor);
    }

    /**
     * @notice Unstake tokens after lock period
     */
    function unstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.isActive, "No active stake");
        require(
            block.timestamp >= info.stakedAt + LOCK_PERIOD,
            "Lock period not ended"
        );

        uint256 amount = info.amount;

        // Effects first
        info.isActive = false;
        info.amount = 0;
        if (info.isVendor) {
            isVendorApproved[msg.sender] = false;
        }

        // Interactions last
        token.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Slash a staker's tokens for fraud/quality violations
     * @param target Address to slash
     * @param slashRatio Percentage of stake to slash (1-100)
     * @param reason Human-readable reason for the slash
     */
    function slash(
        address target,
        uint256 slashRatio,
        string calldata reason
    ) external onlyRole(SLASH_ROLE) nonReentrant {
        require(slashRatio > 0 && slashRatio <= 100, "Invalid ratio");

        StakeInfo storage info = stakes[target];
        require(info.isActive && info.amount > 0, "No stake to slash");

        uint256 slashAmount = (info.amount * slashRatio) / 100;
        uint256 burnAmount = (slashAmount * burnRatio) / 100;
        uint256 poolAmount = slashAmount - burnAmount;

        // Effects
        info.amount -= slashAmount;

        // If fully slashed, deactivate
        if (info.amount == 0) {
            info.isActive = false;
            if (info.isVendor) {
                isVendorApproved[target] = false;
            }
        }

        // Interactions
        if (burnAmount > 0) {
            token.safeTransfer(BURN_ADDRESS, burnAmount);
        }
        if (poolAmount > 0) {
            token.safeTransfer(rewardPool, poolAmount);
        }

        emit Slashed(target, slashAmount, reason);
    }

    /**
     * @notice Update burn ratio — admin only
     * @param newRatio New burn ratio (0-100)
     */
    function updateBurnRatio(
        uint256 newRatio
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRatio <= 100, "Ratio exceeds 100%");
        burnRatio = newRatio;
        emit BurnRatioUpdated(newRatio);
    }

    /**
     * @notice Update reward pool address — admin only
     */
    function updateRewardPool(
        address newPool
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPool != address(0), "Invalid address");
        rewardPool = newPool;
    }

    /**
     * @notice Get stake info for an address
     */
    function getStakeInfo(
        address staker
    ) external view returns (StakeInfo memory) {
        return stakes[staker];
    }
}
