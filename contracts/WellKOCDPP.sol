// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title WellKOCDPP
 * @notice Digital Product Passport — ERC-721 NFT on Polygon
 * @dev Each product gets a unique DPP token with metadata on IPFS
 *
 * Metadata includes:
 * - Product name, category, origin
 * - Manufacturer, certifications
 * - Carbon footprint score
 * - Supply chain steps (with ZK proofs in v2)
 */
contract WellKOCDPP is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    Counters.Counter private _tokenIdCounter;

    struct ProductInfo {
        string  productId;      // WellKOC internal product UUID
        string  vendorId;       // Vendor ID
        address vendorWallet;   // Vendor's wallet
        uint256 mintedAt;
        bool    isActive;       // Can be deactivated if product recalled
    }

    mapping(uint256 => ProductInfo) public products;
    mapping(string  => uint256)     public productToToken;   // productId → tokenId

    event DPPMinted(
        uint256 indexed tokenId,
        string  productId,
        address vendorWallet,
        string  tokenURI
    );
    event DPPDeactivated(uint256 indexed tokenId, string reason);
    event DPPUpdated(uint256 indexed tokenId, string newURI);

    constructor() ERC721("WellKOC DPP", "WDPP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @notice Mint a DPP token for a product
     * @param to           Vendor wallet address
     * @param productId    WellKOC product UUID
     * @param vendorId     WellKOC vendor UUID
     * @param uri          IPFS URI with product metadata
     */
    function mintDPP(
        address to,
        string calldata productId,
        string calldata vendorId,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(productToToken[productId] == 0, "DPP already minted for this product");
        require(to != address(0), "Invalid vendor address");
        require(bytes(productId).length > 0, "Product ID required");
        require(bytes(uri).length > 0, "URI required");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        products[tokenId] = ProductInfo({
            productId:    productId,
            vendorId:     vendorId,
            vendorWallet: to,
            mintedAt:     block.timestamp,
            isActive:     true
        });

        productToToken[productId] = tokenId;

        emit DPPMinted(tokenId, productId, to, uri);
        return tokenId;
    }

    /**
     * @notice Update DPP metadata (e.g. new certification received)
     */
    function updateURI(
        uint256 tokenId,
        string calldata newURI
    ) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, newURI);
        emit DPPUpdated(tokenId, newURI);
    }

    /**
     * @notice Deactivate a DPP (product recall, fraud, etc.)
     */
    function deactivateDPP(
        uint256 tokenId,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        products[tokenId].isActive = false;
        emit DPPDeactivated(tokenId, reason);
    }

    // ── View functions ───────────────────────────────────────
    function getProductInfo(uint256 tokenId) external view returns (ProductInfo memory) {
        return products[tokenId];
    }

    function getTokenByProduct(string calldata productId) external view returns (uint256) {
        return productToToken[productId];
    }

    function isValid(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0) && products[tokenId].isActive;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
