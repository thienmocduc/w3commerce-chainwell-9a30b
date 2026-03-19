// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title W3CNFT
 * @notice ERC-721 for DPP (Digital Product Passport) + KOC Badges + ZKP Merkle verification
 * @dev Uses UUPS upgradeable pattern
 */
contract W3CNFT is
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 private _tokenIdCounter;

    enum NFTType {
        DPP,
        KOC_BADGE,
        CREATOR_TOKEN
    }

    struct NFTMetadata {
        NFTType nftType;
        bytes32 merkleRoot;
        uint256 issuedAt;
        address issuedBy;
        bool revoked;
    }

    mapping(uint256 => NFTMetadata) public nftMetadata;
    mapping(address => uint256[]) public userTokenIds;
    mapping(bytes32 => bytes32) public dppMerkleRoots; // productId => merkleRoot

    event NFTMinted(uint256 indexed tokenId, address indexed to, NFTType nftType);
    event NFTRevoked(uint256 indexed tokenId, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __ERC721_init("W3Commerce NFT", "W3CNFT");
        __ERC721URIStorage_init();
        __Ownable_init(initialOwner);
    }

    /**
     * @notice Mint DPP for a product
     * @param vendor Vendor address to receive the NFT
     * @param uri Token metadata URI (IPFS)
     * @param merkleRoot Root of verified claims tree
     * @param productId Unique product identifier
     */
    function mintDPP(
        address vendor,
        string memory uri,
        bytes32 merkleRoot,
        bytes32 productId
    ) external onlyOwner returns (uint256) {
        require(vendor != address(0), "Invalid vendor");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(vendor, tokenId);
        _setTokenURI(tokenId, uri);

        nftMetadata[tokenId] = NFTMetadata({
            nftType: NFTType.DPP,
            merkleRoot: merkleRoot,
            issuedAt: block.timestamp,
            issuedBy: msg.sender,
            revoked: false
        });

        dppMerkleRoots[productId] = merkleRoot;
        userTokenIds[vendor].push(tokenId);

        emit NFTMinted(tokenId, vendor, NFTType.DPP);
        return tokenId;
    }

    /**
     * @notice Mint KOC Badge for a user who completed course + exam
     * @param koc KOC address
     * @param uri Token metadata URI (IPFS)
     * @param merkleRoot Root of achievement claims tree
     */
    function mintKOCBadge(
        address koc,
        string memory uri,
        bytes32 merkleRoot
    ) external onlyOwner returns (uint256) {
        require(koc != address(0), "Invalid KOC address");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(koc, tokenId);
        _setTokenURI(tokenId, uri);

        nftMetadata[tokenId] = NFTMetadata({
            nftType: NFTType.KOC_BADGE,
            merkleRoot: merkleRoot,
            issuedAt: block.timestamp,
            issuedBy: msg.sender,
            revoked: false
        });

        userTokenIds[koc].push(tokenId);

        emit NFTMinted(tokenId, koc, NFTType.KOC_BADGE);
        return tokenId;
    }

    /**
     * @notice Verify a DPP claim using Merkle proof (ZKP-like verification)
     * @param productId Product to verify
     * @param claim Hashed claim (e.g., keccak256("organic_certified"))
     * @param proof Merkle proof array
     */
    function verifyDPPClaim(
        bytes32 productId,
        bytes32 claim,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 root = dppMerkleRoots[productId];
        require(root != bytes32(0), "Product not registered");
        return MerkleProof.verify(proof, root, claim);
    }

    /**
     * @notice Revoke an NFT — admin only
     */
    function revoke(uint256 tokenId, string calldata reason) external onlyOwner {
        require(nftMetadata[tokenId].issuedAt > 0, "Token does not exist");
        require(!nftMetadata[tokenId].revoked, "Already revoked");
        nftMetadata[tokenId].revoked = true;
        emit NFTRevoked(tokenId, reason);
    }

    /**
     * @notice Get all token IDs for a user
     */
    function getUserTokens(
        address user
    ) external view returns (uint256[] memory) {
        return userTokenIds[user];
    }

    /**
     * @notice Get current token counter
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ─── Override required by Solidity ──────────────────────
    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
