// test/WKToken.test.js
// Hardhat + ethers v6 + @nomicfoundation/hardhat-toolbox
"use strict";

const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

// ─── Constants mirrored from contract ────────────────────────────────────────
const MAX_SUPPLY     = ethers.parseEther("1000000000"); // 1 B WK
const INITIAL_MINT   = ethers.parseEther("100000000");  // 100 M WK
const APY_NUMERATOR  = 5n;
const APY_DENOM      = 100n;
const YEAR_SECONDS   = 365n * 24n * 3600n;

// Helper: compute expected staking reward (mirrors contract formula)
// reward = (amount * duration * 5) / (365 days * 100)
function expectedReward(amount, durationSeconds) {
  return (amount * BigInt(durationSeconds) * APY_NUMERATOR) /
    (YEAR_SECONDS * APY_DENOM);
}

// ─── Fixture ──────────────────────────────────────────────────────────────────
async function deployWKTokenFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  const WKToken = await ethers.getContractFactory("WKToken");
  const token = await WKToken.deploy(owner.address);
  await token.waitForDeployment();

  return { token, owner, alice, bob, carol };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("WKToken", function () {

  // ── 1. Deployment ─────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets the correct name and symbol", async function () {
      const { token } = await loadFixture(deployWKTokenFixture);
      expect(await token.name()).to.equal("WellKOC Token");
      expect(await token.symbol()).to.equal("WK");
    });

    it("mints 100 M WK to the initial owner", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_MINT);
    });

    it("reports correct totalSupply after deployment", async function () {
      const { token } = await loadFixture(deployWKTokenFixture);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT);
    });

    it("sets MAX_SUPPLY to 1 billion WK", async function () {
      const { token } = await loadFixture(deployWKTokenFixture);
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("sets the deployer as owner", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  // ── 2. Mint ────────────────────────────────────────────────────────────────
  describe("mint()", function () {
    it("allows owner to mint tokens to any address", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const amount = ethers.parseEther("1000");
      await expect(token.connect(owner).mint(alice.address, amount))
        .to.changeTokenBalance(token, alice, amount);
    });

    it("increases totalSupply after mint", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const amount = ethers.parseEther("500");
      await token.connect(owner).mint(alice.address, amount);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT + amount);
    });

    it("reverts when called by non-owner", async function () {
      const { token, alice } = await loadFixture(deployWKTokenFixture);
      await expect(
        token.connect(alice).mint(alice.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("reverts when mint would exceed MAX_SUPPLY", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      // Try to mint 1 token over the cap
      const overCap = MAX_SUPPLY - INITIAL_MINT + 1n;
      await expect(
        token.connect(owner).mint(alice.address, overCap)
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("allows minting exactly up to MAX_SUPPLY", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const remaining = MAX_SUPPLY - INITIAL_MINT;
      await expect(token.connect(owner).mint(alice.address, remaining)).not.to.be.reverted;
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });
  });

  // ── 3. Burn ────────────────────────────────────────────────────────────────
  describe("burn()", function () {
    it("allows a holder to burn their own tokens", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const burnAmount = ethers.parseEther("1000");
      await expect(token.connect(owner).burn(burnAmount))
        .to.changeTokenBalance(token, owner, -burnAmount);
    });

    it("reduces totalSupply after burn", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const burnAmount = ethers.parseEther("5000");
      await token.connect(owner).burn(burnAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_MINT - burnAmount);
    });

    it("reverts when burning more than balance", async function () {
      const { token, alice } = await loadFixture(deployWKTokenFixture);
      // alice has 0 tokens
      await expect(
        token.connect(alice).burn(1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("allows burnFrom with approval", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const amount = ethers.parseEther("200");
      await token.connect(owner).approve(alice.address, amount);
      await expect(token.connect(alice).burnFrom(owner.address, amount))
        .to.changeTokenBalance(token, owner, -amount);
    });
  });

  // ── 4. Stake ───────────────────────────────────────────────────────────────
  describe("stake()", function () {
    it("transfers tokens from user to contract", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const stakeAmt = ethers.parseEther("10000");
      await expect(token.connect(owner).stake(stakeAmt))
        .to.changeTokenBalance(token, owner, -stakeAmt);
      expect(await token.balanceOf(await token.getAddress())).to.equal(stakeAmt);
    });

    it("updates stakedBalance correctly", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const stakeAmt = ethers.parseEther("10000");
      await token.connect(owner).stake(stakeAmt);
      expect(await token.stakedBalance(owner.address)).to.equal(stakeAmt);
    });

    it("records stakeTimestamp as block.timestamp", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const stakeAmt = ethers.parseEther("1000");
      const tx = await token.connect(owner).stake(stakeAmt);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(await token.stakeTimestamp(owner.address)).to.equal(block.timestamp);
    });

    it("emits Staked event with correct arguments", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const stakeAmt = ethers.parseEther("1000");
      await expect(token.connect(owner).stake(stakeAmt))
        .to.emit(token, "Staked")
        .withArgs(owner.address, stakeAmt);
    });

    it("reverts when staking 0 tokens", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      await expect(token.connect(owner).stake(0n)).to.be.revertedWith("Cannot stake 0");
    });

    it("reverts when staking more than balance", async function () {
      const { token, alice } = await loadFixture(deployWKTokenFixture);
      // alice has 0 tokens
      await expect(
        token.connect(alice).stake(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("accumulates stakedBalance over multiple stakes", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      const first  = ethers.parseEther("5000");
      const second = ethers.parseEther("3000");
      await token.connect(owner).stake(first);
      await token.connect(owner).stake(second);
      // timestamp is reset to second stake's block; balance accumulates
      expect(await token.stakedBalance(owner.address)).to.equal(first + second);
    });
  });

  // ── 5. Unstake ─────────────────────────────────────────────────────────────
  describe("unstake()", function () {
    async function stakeFixture() {
      const base = await loadFixture(deployWKTokenFixture);
      const stakeAmt = ethers.parseEther("10000");
      await base.token.connect(base.owner).stake(stakeAmt);
      return { ...base, stakeAmt };
    }

    it("returns the staked principal to the user", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      const balBefore = await token.balanceOf(owner.address);
      await token.connect(owner).unstake(stakeAmt);
      expect(await token.balanceOf(owner.address)).to.be.gte(balBefore + stakeAmt);
    });

    it("decreases stakedBalance", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      const partial = stakeAmt / 2n;
      await token.connect(owner).unstake(partial);
      expect(await token.stakedBalance(owner.address)).to.equal(stakeAmt - partial);
    });

    it("emits Unstaked event", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      // advance 30 days so reward > 0
      await time.increase(30 * 24 * 3600);
      await expect(token.connect(owner).unstake(stakeAmt))
        .to.emit(token, "Unstaked")
        .withArgs(owner.address, stakeAmt, (reward) => reward >= 0n);
    });

    it("calculates 5% APY reward correctly after 1 year", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      const ONE_YEAR = Number(YEAR_SECONDS);

      await time.increase(ONE_YEAR);

      const supplyBefore = await token.totalSupply();
      const balBefore    = await token.balanceOf(owner.address);

      const tx = await token.connect(owner).unstake(stakeAmt);
      const receipt = await tx.wait();

      // Retrieve actual duration from timestamps
      const unstakeBlock  = await ethers.provider.getBlock(receipt.blockNumber);
      const stakeTs       = await token.stakeTimestamp(owner.address);
      // stakeTimestamp is now 0 because stakedBalance dropped to 0 — capture before
      // Instead, compute via emitted event
      const log = receipt.logs.find(l => {
        try { token.interface.parseLog(l); return true; } catch { return false; }
      });
      const parsed = token.interface.parseLog(log);
      const actualReward = parsed.args[2];

      // Expected reward: ~5% of stakeAmt for one year
      const expectedMin = (stakeAmt * 495n) / 10000n; // 4.95% — allows 1-2 block drift
      const expectedMax = (stakeAmt * 505n) / 10000n; // 5.05%

      expect(actualReward).to.be.gte(expectedMin);
      expect(actualReward).to.be.lte(expectedMax);
    });

    it("mints reward tokens (increases totalSupply)", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      await time.increase(Number(YEAR_SECONDS)); // 1 year for non-trivial reward
      const supplyBefore = await token.totalSupply();
      await token.connect(owner).unstake(stakeAmt);
      expect(await token.totalSupply()).to.be.gt(supplyBefore);
    });

    it("does NOT mint reward if it would exceed MAX_SUPPLY", async function () {
      // Mint right up to cap, stake a tiny amount, verify reward is silently skipped
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const remaining = MAX_SUPPLY - INITIAL_MINT;
      await token.connect(owner).mint(alice.address, remaining);
      // Now totalSupply == MAX_SUPPLY; owner stakes a tiny amount
      const tinyStake = ethers.parseEther("1");
      await token.connect(owner).stake(tinyStake);
      await time.increase(Number(YEAR_SECONDS));
      // Unstake — reward cannot be minted (would exceed MAX_SUPPLY)
      const supplyBefore = await token.totalSupply();
      await token.connect(owner).unstake(tinyStake);
      // Supply should not have increased (reward skipped)
      expect(await token.totalSupply()).to.equal(supplyBefore);
    });

    it("reverts when unstaking more than staked", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      await expect(
        token.connect(owner).unstake(stakeAmt + 1n)
      ).to.be.revertedWith("Insufficient staked");
    });

    it("reverts when caller has no stake", async function () {
      const { token, alice } = await stakeFixture();
      await expect(
        token.connect(alice).unstake(1n)
      ).to.be.revertedWith("Insufficient staked");
    });

    it("allows partial unstake", async function () {
      const { token, owner, stakeAmt } = await stakeFixture();
      const half = stakeAmt / 2n;
      await token.connect(owner).unstake(half);
      expect(await token.stakedBalance(owner.address)).to.equal(half);
    });
  });

  // ── 6. Governance (ERC20Votes) ─────────────────────────────────────────────
  describe("Governance (ERC20Votes)", function () {
    it("getVotes returns 0 before self-delegation", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      expect(await token.getVotes(owner.address)).to.equal(0n);
    });

    it("self-delegation activates voting power equal to balance", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      await token.connect(owner).delegate(owner.address);
      expect(await token.getVotes(owner.address)).to.equal(
        await token.balanceOf(owner.address)
      );
    });

    it("delegate transfers voting power to another address", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      await token.connect(owner).delegate(alice.address);
      expect(await token.getVotes(alice.address)).to.equal(
        await token.balanceOf(owner.address)
      );
      expect(await token.getVotes(owner.address)).to.equal(0n);
    });

    it("voting power tracks balance after transfer", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      await token.connect(owner).delegate(owner.address);
      const transfer = ethers.parseEther("1000");
      await token.connect(owner).transfer(alice.address, transfer);
      expect(await token.getVotes(owner.address)).to.equal(
        (await token.balanceOf(owner.address))
      );
    });

    it("re-delegating moves votes from old to new delegate", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployWKTokenFixture);
      const ownerBalance = await token.balanceOf(owner.address);
      await token.connect(owner).delegate(alice.address);
      expect(await token.getVotes(alice.address)).to.equal(ownerBalance);
      await token.connect(owner).delegate(bob.address);
      expect(await token.getVotes(alice.address)).to.equal(0n);
      expect(await token.getVotes(bob.address)).to.equal(ownerBalance);
    });

    it("getPastVotes reflects checkpoint at a past block", async function () {
      const { token, owner } = await loadFixture(deployWKTokenFixture);
      await token.connect(owner).delegate(owner.address);
      const checkpointBlock = await ethers.provider.getBlockNumber();

      // Mine some blocks then transfer tokens away
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");
      await token.connect(owner).transfer(
        (await ethers.getSigners())[1].address,
        ethers.parseEther("1000")
      );

      const pastVotes = await token.getPastVotes(owner.address, checkpointBlock);
      expect(pastVotes).to.equal(INITIAL_MINT);
    });
  });

  // ── 7. ERC-20 core behaviour ───────────────────────────────────────────────
  describe("ERC-20 core", function () {
    it("transfer moves tokens correctly", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      const amount = ethers.parseEther("500");
      await expect(token.connect(owner).transfer(alice.address, amount))
        .to.changeTokenBalances(token, [owner, alice], [-amount, amount]);
    });

    it("approve + transferFrom works correctly", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployWKTokenFixture);
      const amount = ethers.parseEther("300");
      await token.connect(owner).approve(alice.address, amount);
      await expect(
        token.connect(alice).transferFrom(owner.address, bob.address, amount)
      ).to.changeTokenBalances(token, [owner, bob], [-amount, amount]);
    });

    it("reverts transferFrom without allowance", async function () {
      const { token, owner, alice } = await loadFixture(deployWKTokenFixture);
      await expect(
        token.connect(alice).transferFrom(owner.address, alice.address, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });
});
