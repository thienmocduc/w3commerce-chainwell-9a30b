// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreatorToken
 * @notice Individual KOC creator token — minimal ERC-20
 */
contract CreatorToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;
    address public immutable creator;

    constructor(
        string memory name_,
        string memory symbol_,
        address _creator
    ) ERC20(name_, symbol_) Ownable(_creator) {
        require(_creator != address(0), "Invalid creator");
        creator = _creator;
        // 10% to creator on launch
        _mint(_creator, 1_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds supply");
        _mint(to, amount);
    }
}

/**
 * @title CreatorTokenFactory
 * @notice Factory that deploys one CreatorToken per KOC
 */
contract CreatorTokenFactory {
    mapping(address => address) public kocToToken;
    address[] public allTokens;

    event CreatorTokenDeployed(
        address indexed koc,
        address indexed tokenContract,
        string symbol
    );

    /**
     * @notice Deploy a new Creator Token for the caller
     * @param name_ Token name (e.g., "NGUYEN Token")
     * @param symbol_ Token symbol (e.g., "NGT")
     */
    function deployToken(
        string memory name_,
        string memory symbol_
    ) external returns (address) {
        require(
            kocToToken[msg.sender] == address(0),
            "Token already deployed"
        );
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");

        CreatorToken newToken = new CreatorToken(name_, symbol_, msg.sender);
        address tokenAddress = address(newToken);

        kocToToken[msg.sender] = tokenAddress;
        allTokens.push(tokenAddress);

        emit CreatorTokenDeployed(msg.sender, tokenAddress, symbol_);
        return tokenAddress;
    }

    function getTokenForKOC(address koc) external view returns (address) {
        return kocToToken[koc];
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function totalTokensDeployed() external view returns (uint256) {
        return allTokens.length;
    }
}
