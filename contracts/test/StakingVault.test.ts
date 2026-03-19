import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('W3Commerce Contracts', function () {
  async function deployFixture() {
    const [admin, vendor, koc, user, rewardPool] = await ethers.getSigners();

    // Deploy W3CToken
    const W3CToken = await ethers.getContractFactory('W3CToken');
    const token = await W3CToken.deploy(admin.address);
    await token.waitForDeployment();

    // Deploy StakingVault
    const StakingVault = await ethers.getContractFactory('StakingVault');
    const vault = await StakingVault.deploy(
      await token.getAddress(),
      rewardPool.address
    );
    await vault.waitForDeployment();

    // Grant SLASH_ROLE to admin
    const SLASH_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SLASH_ROLE'));
    await vault.grantRole(SLASH_ROLE, admin.address);

    // Mint tokens for testing
    const mintAmount = ethers.parseEther('100000');
    await token.mint(vendor.address, mintAmount);
    await token.mint(koc.address, mintAmount);
    await token.mint(user.address, mintAmount);

    // Approve StakingVault to spend tokens
    const vaultAddress = await vault.getAddress();
    await token.connect(vendor).approve(vaultAddress, ethers.MaxUint256);
    await token.connect(koc).approve(vaultAddress, ethers.MaxUint256);

    return { token, vault, admin, vendor, koc, user, rewardPool };
  }

  describe('W3CToken', function () {
    it('should have correct name and symbol', async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal('W3Commerce Token');
      expect(await token.symbol()).to.equal('W3C');
    });

    it('should calculate tokens required correctly', async function () {
      const { token, admin } = await loadFixture(deployFixture);

      // Set price: 1 W3C = 0.10 USDC (100000 in 6 decimals)
      await token.connect(admin).updatePrice(100000);

      // For 100 USDC (100_000_000 in 6 decimals)
      const tokensRequired = await token.calculateTokensRequired(100_000_000);
      // Expected: 100 USDC / 0.10 per token = 1000 tokens
      expect(tokensRequired).to.equal(ethers.parseEther('1000'));
    });

    it('should not exceed max supply', async function () {
      const { token, admin } = await loadFixture(deployFixture);
      const overMax = ethers.parseEther('1000000001');
      await expect(token.mint(admin.address, overMax)).to.be.revertedWith('Exceeds max supply');
    });
  });

  describe('StakingVault', function () {
    it('vendor can stake 1000 W3C and gets approved', async function () {
      const { vault, vendor } = await loadFixture(deployFixture);
      const stakeAmount = ethers.parseEther('1000');

      await expect(vault.connect(vendor).stake(stakeAmount, true))
        .to.emit(vault, 'Staked')
        .withArgs(vendor.address, stakeAmount, true);

      expect(await vault.isVendorApproved(vendor.address)).to.be.true;
      const info = await vault.getStakeInfo(vendor.address);
      expect(info.amount).to.equal(stakeAmount);
      expect(info.isVendor).to.be.true;
      expect(info.isActive).to.be.true;
    });

    it('vendor cannot unstake before 7 days', async function () {
      const { vault, vendor } = await loadFixture(deployFixture);
      await vault.connect(vendor).stake(ethers.parseEther('1000'), true);

      await expect(vault.connect(vendor).unstake()).to.be.revertedWith('Lock period not ended');
    });

    it('vendor can unstake after 7 days', async function () {
      const { vault, vendor, token } = await loadFixture(deployFixture);
      const stakeAmount = ethers.parseEther('1000');
      await vault.connect(vendor).stake(stakeAmount, true);

      // Fast-forward 7 days + 1 second
      await time.increase(7 * 24 * 60 * 60 + 1);

      const balanceBefore = await token.balanceOf(vendor.address);
      await vault.connect(vendor).unstake();
      const balanceAfter = await token.balanceOf(vendor.address);

      expect(balanceAfter - balanceBefore).to.equal(stakeAmount);
      expect(await vault.isVendorApproved(vendor.address)).to.be.false;
    });

    it('slash removes correct proportion and splits burn/pool', async function () {
      const { vault, vendor, admin, token, rewardPool } = await loadFixture(deployFixture);
      const stakeAmount = ethers.parseEther('1000');
      await vault.connect(vendor).stake(stakeAmount, true);

      const rewardPoolBalBefore = await token.balanceOf(rewardPool.address);
      const burnBalBefore = await token.balanceOf('0x000000000000000000000000000000000000dEaD');

      // Slash 50% of stake
      await vault.connect(admin).slash(vendor.address, 50, 'Fake product');

      const slashAmount = stakeAmount / 2n; // 500 W3C
      const burnAmount = slashAmount / 2n;  // 250 W3C (50% of slash)
      const poolAmount = slashAmount - burnAmount; // 250 W3C

      // Check burn address received tokens
      const burnBalAfter = await token.balanceOf('0x000000000000000000000000000000000000dEaD');
      expect(burnBalAfter - burnBalBefore).to.equal(burnAmount);

      // Check reward pool received tokens
      const rewardPoolBalAfter = await token.balanceOf(rewardPool.address);
      expect(rewardPoolBalAfter - rewardPoolBalBefore).to.equal(poolAmount);

      // Check remaining stake
      const info = await vault.getStakeInfo(vendor.address);
      expect(info.amount).to.equal(stakeAmount - slashAmount);
    });

    it('slash fails if no active stake', async function () {
      const { vault, admin, user } = await loadFixture(deployFixture);
      await expect(
        vault.connect(admin).slash(user.address, 50, 'No stake')
      ).to.be.revertedWith('No stake to slash');
    });

    it('KOC can stake with lower minimum', async function () {
      const { vault, koc } = await loadFixture(deployFixture);
      const stakeAmount = ethers.parseEther('100');

      await expect(vault.connect(koc).stake(stakeAmount, false))
        .to.emit(vault, 'Staked')
        .withArgs(koc.address, stakeAmount, false);

      expect(await vault.isVendorApproved(koc.address)).to.be.false;
    });

    it('KOC cannot stake below minimum', async function () {
      const { vault, koc } = await loadFixture(deployFixture);
      await expect(
        vault.connect(koc).stake(ethers.parseEther('50'), false)
      ).to.be.revertedWith('Insufficient stake amount');
    });
  });
});
