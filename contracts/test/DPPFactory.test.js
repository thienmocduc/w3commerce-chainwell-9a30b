// test/DPPFactory.test.js
// Hardhat + ethers v6 + @nomicfoundation/hardhat-toolbox
"use strict";

const { expect }      = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers }      = require("hardhat");

// ─── Role constants (keccak256 of role strings — mirrors contract) ────────────
const MINTER_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const UPDATER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPDATER_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // bytes32(0)

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Produce a deterministic bytes32 productId from a human-readable string
function productId(name) {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

const SAMPLE_URI  = "ipfs://QmSampleDPPHash001";
const SAMPLE_URI2 = "ipfs://QmSampleDPPHash002Updated";

// ─── Fixture ──────────────────────────────────────────────────────────────────
async function deployDPPFixture() {
  const [admin, minter, vendor, alice, bob, attacker] = await ethers.getSigners();

  const DPPFactory = await ethers.getContractFactory("DPPFactory");
  const dpp = await DPPFactory.deploy(admin.address, minter.address);
  await dpp.waitForDeployment();

  return { dpp, admin, minter, vendor, alice, bob, attacker };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("DPPFactory", function () {

  // ── 1. Deployment ─────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets ERC-721 name and symbol", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      expect(await dpp.name()).to.equal("WellKOC DPP");
      expect(await dpp.symbol()).to.equal("DPP");
    });

    it("grants DEFAULT_ADMIN_ROLE to admin", async function () {
      const { dpp, admin } = await loadFixture(deployDPPFixture);
      expect(await dpp.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("grants MINTER_ROLE to minter", async function () {
      const { dpp, minter } = await loadFixture(deployDPPFixture);
      expect(await dpp.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("grants UPDATER_ROLE to minter (constructor grants both)", async function () {
      const { dpp, minter } = await loadFixture(deployDPPFixture);
      expect(await dpp.hasRole(UPDATER_ROLE, minter.address)).to.be.true;
    });

    it("starts with totalMinted = 0", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      expect(await dpp.totalMinted()).to.equal(0n);
    });
  });

  // ── 2. mintDPP() ──────────────────────────────────────────────────────────
  describe("mintDPP()", function () {
    it("minter can mint a DPP NFT", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-alpha");
      await expect(
        dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI)
      ).to.not.be.reverted;
    });

    it("mints token with id = 1 on first mint", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-beta");
      const tx  = await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      const receipt = await tx.wait();
      const event   = receipt.logs
        .map(l => { try { return dpp.interface.parseLog(l); } catch { return null; } })
        .find(e => e && e.name === "DPPMinted");
      expect(event.args.tokenId).to.equal(1n);
    });

    it("assigns token ownership to vendor", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-gamma");
      await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      expect(await dpp.ownerOf(1n)).to.equal(vendor.address);
    });

    it("stores correct tokenURI (ipfsURI)", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-delta");
      await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      expect(await dpp.tokenURI(1n)).to.equal(SAMPLE_URI);
    });

    it("stores correct DPPMetadata", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-epsilon");
      const tx  = await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      const receipt   = await tx.wait();
      const block     = await ethers.provider.getBlock(receipt.blockNumber);
      const meta      = await dpp.dppData(1n);

      expect(meta.productId).to.equal(pid);
      expect(meta.vendor).to.equal(vendor.address);
      expect(meta.mintedAt).to.equal(block.timestamp);
      expect(meta.updatedAt).to.equal(block.timestamp);
      expect(meta.active).to.be.true;
    });

    it("maps productId to tokenId in productToDPP", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-zeta");
      await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      expect(await dpp.productToDPP(pid)).to.equal(1n);
    });

    it("increments totalMinted after each mint", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      await dpp.connect(minter).mintDPP(productId("p1"), vendor.address, SAMPLE_URI);
      await dpp.connect(minter).mintDPP(productId("p2"), vendor.address, SAMPLE_URI);
      expect(await dpp.totalMinted()).to.equal(2n);
    });

    it("emits DPPMinted event with correct args", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-eta");
      await expect(dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI))
        .to.emit(dpp, "DPPMinted")
        .withArgs(1n, pid, vendor.address, SAMPLE_URI);
    });

    it("reverts when called by address without MINTER_ROLE", async function () {
      const { dpp, attacker, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-theta");
      await expect(
        dpp.connect(attacker).mintDPP(pid, vendor.address, SAMPLE_URI)
      ).to.be.revertedWithCustomError(dpp, "AccessControlUnauthorizedAccount");
    });

    it("reverts with zero-address vendor", async function () {
      const { dpp, minter } = await loadFixture(deployDPPFixture);
      const pid = productId("product-iota");
      await expect(
        dpp.connect(minter).mintDPP(pid, ethers.ZeroAddress, SAMPLE_URI)
      ).to.be.revertedWith("Invalid vendor");
    });

    it("reverts with empty URI", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-kappa");
      await expect(
        dpp.connect(minter).mintDPP(pid, vendor.address, "")
      ).to.be.revertedWith("Empty URI");
    });

    it("reverts when DPP already exists for a productId", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("product-lambda");
      await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);
      // Attempt to mint again for the same productId
      await expect(
        dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI2)
      ).to.be.revertedWith("DPP already exists");
    });

    it("allows two different productIds to each get their own token", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid1 = productId("product-mu");
      const pid2 = productId("product-nu");
      await dpp.connect(minter).mintDPP(pid1, vendor.address, SAMPLE_URI);
      await dpp.connect(minter).mintDPP(pid2, vendor.address, SAMPLE_URI2);
      expect(await dpp.productToDPP(pid1)).to.equal(1n);
      expect(await dpp.productToDPP(pid2)).to.equal(2n);
    });
  });

  // ── 3. Soulbound: transfers are blocked ───────────────────────────────────
  describe("Soulbound (non-transferable)", function () {
    async function mintedFixture() {
      const base = await loadFixture(deployDPPFixture);
      const pid  = productId("soulbound-product");
      await base.dpp.connect(base.minter).mintDPP(pid, base.vendor.address, SAMPLE_URI);
      return { ...base, pid, tokenId: 1n };
    }

    it("reverts safeTransferFrom after mint", async function () {
      const { dpp, vendor, alice, tokenId } = await mintedFixture();
      await expect(
        dpp.connect(vendor)["safeTransferFrom(address,address,uint256)"](
          vendor.address, alice.address, tokenId
        )
      ).to.be.revertedWith("DPP NFT is soulbound and non-transferable");
    });

    it("reverts transferFrom after mint", async function () {
      const { dpp, vendor, alice, tokenId } = await mintedFixture();
      await expect(
        dpp.connect(vendor).transferFrom(vendor.address, alice.address, tokenId)
      ).to.be.revertedWith("DPP NFT is soulbound and non-transferable");
    });

    it("reverts transfer even with approval", async function () {
      const { dpp, vendor, alice, bob, tokenId } = await mintedFixture();
      await dpp.connect(vendor).approve(alice.address, tokenId);
      await expect(
        dpp.connect(alice).transferFrom(vendor.address, bob.address, tokenId)
      ).to.be.revertedWith("DPP NFT is soulbound and non-transferable");
    });

    it("reverts setApprovalForAll-based transfer", async function () {
      const { dpp, vendor, alice, bob, tokenId } = await mintedFixture();
      await dpp.connect(vendor).setApprovalForAll(alice.address, true);
      await expect(
        dpp.connect(alice).transferFrom(vendor.address, bob.address, tokenId)
      ).to.be.revertedWith("DPP NFT is soulbound and non-transferable");
    });

    it("token remains owned by original vendor after blocked transfer attempt", async function () {
      const { dpp, vendor, alice, tokenId } = await mintedFixture();
      await expect(
        dpp.connect(vendor).transferFrom(vendor.address, alice.address, tokenId)
      ).to.be.reverted;
      expect(await dpp.ownerOf(tokenId)).to.equal(vendor.address);
    });
  });

  // ── 4. getDPPByProduct() ──────────────────────────────────────────────────
  describe("getDPPByProduct()", function () {
    it("returns correct tokenId and metadata for a minted product", async function () {
      const { dpp, minter, vendor } = await loadFixture(deployDPPFixture);
      const pid = productId("query-product-001");
      await dpp.connect(minter).mintDPP(pid, vendor.address, SAMPLE_URI);

      const [tokenId, meta] = await dpp.getDPPByProduct(pid);
      expect(tokenId).to.equal(1n);
      expect(meta.productId).to.equal(pid);
      expect(meta.vendor).to.equal(vendor.address);
      expect(meta.active).to.be.true;
    });

    it("returns tokenId = 0 and empty metadata for unknown productId", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      const unknown = productId("never-minted");
      const [tokenId, meta] = await dpp.getDPPByProduct(unknown);
      expect(tokenId).to.equal(0n);
      expect(meta.vendor).to.equal(ethers.ZeroAddress);
      expect(meta.active).to.be.false;
    });

    it("returns distinct results for two different products", async function () {
      const { dpp, minter, vendor, alice } = await loadFixture(deployDPPFixture);
      const pid1 = productId("query-a");
      const pid2 = productId("query-b");
      await dpp.connect(minter).mintDPP(pid1, vendor.address, SAMPLE_URI);
      await dpp.connect(minter).mintDPP(pid2, alice.address,  SAMPLE_URI2);

      const [id1, meta1] = await dpp.getDPPByProduct(pid1);
      const [id2, meta2] = await dpp.getDPPByProduct(pid2);

      expect(id1).to.equal(1n);
      expect(id2).to.equal(2n);
      expect(meta1.vendor).to.equal(vendor.address);
      expect(meta2.vendor).to.equal(alice.address);
    });
  });

  // ── 5. updateDPP() ────────────────────────────────────────────────────────
  describe("updateDPP()", function () {
    async function mintedFixture() {
      const base = await loadFixture(deployDPPFixture);
      const pid  = productId("update-product");
      await base.dpp.connect(base.minter).mintDPP(pid, base.vendor.address, SAMPLE_URI);
      return { ...base, pid, tokenId: 1n };
    }

    it("UPDATER_ROLE can update the token URI", async function () {
      const { dpp, minter, tokenId } = await mintedFixture();
      await dpp.connect(minter).updateDPP(tokenId, SAMPLE_URI2);
      expect(await dpp.tokenURI(tokenId)).to.equal(SAMPLE_URI2);
    });

    it("updates dppData.updatedAt timestamp", async function () {
      const { dpp, minter, tokenId } = await mintedFixture();
      const tx      = await dpp.connect(minter).updateDPP(tokenId, SAMPLE_URI2);
      const receipt = await tx.wait();
      const block   = await ethers.provider.getBlock(receipt.blockNumber);
      const meta    = await dpp.dppData(tokenId);
      expect(meta.updatedAt).to.equal(block.timestamp);
    });

    it("emits DPPUpdated event with tokenId and newURI", async function () {
      const { dpp, minter, tokenId } = await mintedFixture();
      await expect(dpp.connect(minter).updateDPP(tokenId, SAMPLE_URI2))
        .to.emit(dpp, "DPPUpdated")
        .withArgs(tokenId, SAMPLE_URI2);
    });

    it("reverts when called without UPDATER_ROLE", async function () {
      const { dpp, attacker, tokenId } = await mintedFixture();
      await expect(
        dpp.connect(attacker).updateDPP(tokenId, SAMPLE_URI2)
      ).to.be.revertedWithCustomError(dpp, "AccessControlUnauthorizedAccount");
    });

    it("reverts when token does not exist", async function () {
      const { dpp, minter } = await loadFixture(deployDPPFixture);
      await expect(
        dpp.connect(minter).updateDPP(999n, SAMPLE_URI2)
      ).to.be.revertedWith("Token does not exist");
    });

    it("admin can grant UPDATER_ROLE to another address", async function () {
      const { dpp, admin, alice, tokenId } = await mintedFixture();
      await dpp.connect(admin).grantRole(UPDATER_ROLE, alice.address);
      await expect(dpp.connect(alice).updateDPP(tokenId, SAMPLE_URI2)).to.not.be.reverted;
    });
  });

  // ── 6. scanVerify() ───────────────────────────────────────────────────────
  describe("scanVerify()", function () {
    async function mintedFixture() {
      const base = await loadFixture(deployDPPFixture);
      const pid  = productId("scan-product");
      await base.dpp.connect(base.minter).mintDPP(pid, base.vendor.address, SAMPLE_URI);
      return { ...base, pid, tokenId: 1n };
    }

    it("anyone can call scanVerify on an existing token", async function () {
      const { dpp, attacker, tokenId } = await mintedFixture();
      await expect(dpp.connect(attacker).scanVerify(tokenId)).to.not.be.reverted;
    });

    it("emits DPPVerified event with tokenId and scanner address", async function () {
      const { dpp, alice, tokenId } = await mintedFixture();
      await expect(dpp.connect(alice).scanVerify(tokenId))
        .to.emit(dpp, "DPPVerified")
        .withArgs(tokenId, alice.address);
    });

    it("reverts when token does not exist", async function () {
      const { dpp, alice } = await loadFixture(deployDPPFixture);
      await expect(dpp.connect(alice).scanVerify(999n))
        .to.be.revertedWith("Token does not exist");
    });

    it("multiple scanners can verify the same token independently", async function () {
      const { dpp, alice, bob, tokenId } = await mintedFixture();
      await expect(dpp.connect(alice).scanVerify(tokenId))
        .to.emit(dpp, "DPPVerified").withArgs(tokenId, alice.address);
      await expect(dpp.connect(bob).scanVerify(tokenId))
        .to.emit(dpp, "DPPVerified").withArgs(tokenId, bob.address);
    });
  });

  // ── 7. Access Control: role management ────────────────────────────────────
  describe("Access Control", function () {
    it("admin can grant MINTER_ROLE to new address", async function () {
      const { dpp, admin, alice } = await loadFixture(deployDPPFixture);
      await dpp.connect(admin).grantRole(MINTER_ROLE, alice.address);
      expect(await dpp.hasRole(MINTER_ROLE, alice.address)).to.be.true;
    });

    it("admin can revoke MINTER_ROLE", async function () {
      const { dpp, admin, minter } = await loadFixture(deployDPPFixture);
      await dpp.connect(admin).revokeRole(MINTER_ROLE, minter.address);
      expect(await dpp.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("after revoking MINTER_ROLE, ex-minter cannot mint", async function () {
      const { dpp, admin, minter, vendor } = await loadFixture(deployDPPFixture);
      await dpp.connect(admin).revokeRole(MINTER_ROLE, minter.address);
      await expect(
        dpp.connect(minter).mintDPP(productId("revoked"), vendor.address, SAMPLE_URI)
      ).to.be.revertedWithCustomError(dpp, "AccessControlUnauthorizedAccount");
    });

    it("non-admin cannot grant roles", async function () {
      const { dpp, attacker, alice } = await loadFixture(deployDPPFixture);
      await expect(
        dpp.connect(attacker).grantRole(MINTER_ROLE, alice.address)
      ).to.be.revertedWithCustomError(dpp, "AccessControlUnauthorizedAccount");
    });
  });

  // ── 8. supportsInterface ──────────────────────────────────────────────────
  describe("supportsInterface()", function () {
    it("reports ERC-721 interface support", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      // ERC721 interfaceId = 0x80ac58cd
      expect(await dpp.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("reports AccessControl interface support", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      // IAccessControl = 0x7965db0b
      expect(await dpp.supportsInterface("0x7965db0b")).to.be.true;
    });

    it("reports ERC-721 Metadata interface support", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      // ERC721Metadata = 0x5b5e139f
      expect(await dpp.supportsInterface("0x5b5e139f")).to.be.true;
    });

    it("returns false for unsupported interfaces", async function () {
      const { dpp } = await loadFixture(deployDPPFixture);
      expect(await dpp.supportsInterface("0xdeadbeef")).to.be.false;
    });
  });
});
