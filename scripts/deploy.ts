import { ethers } from "hardhat"
import fs from "fs"

/**
 * Deploy WellKOC smart contracts to Polygon Amoy testnet
 *
 * Run:
 *   npx hardhat run scripts/deploy.ts --network amoy
 *
 * Config (.env):
 *   PRIVATE_KEY=your_deployer_private_key
 *   POLYGON_RPC=https://rpc-amoy.polygon.technology
 *   PLATFORM_WALLET=0x...
 *   POOL_A_WALLET=0x...
 *   POOL_B_WALLET=0x...
 *   POOL_C_WALLET=0x...
 */
async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying with:", deployer.address)
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC")

  const addresses: Record<string, string> = {}

  // ── 1. W3C Token ─────────────────────────────────────────
  console.log("\n1. Deploying W3C Token...")
  const W3C = await ethers.getContractFactory("W3CToken")
  const w3c = await W3C.deploy()
  await w3c.waitForDeployment()
  addresses.W3CToken = await w3c.getAddress()
  console.log("   W3C Token:", addresses.W3CToken)

  // ── 2. Mock USDT (testnet only) ───────────────────────────
  // On mainnet, use: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F
  console.log("\n2. Deploying Mock USDT (testnet)...")
  // For testnet, we deploy a simple ERC20 mock
  const MockUSDT = await ethers.getContractFactory("MockERC20")
  const usdt = await MockUSDT.deploy("Tether USD", "USDT", 6)
  await usdt.waitForDeployment()
  addresses.USDT = await usdt.getAddress()
  console.log("   Mock USDT:", addresses.USDT)

  // ── 3. Commission Contract ────────────────────────────────
  console.log("\n3. Deploying Commission Contract...")
  const platformWallet = process.env.PLATFORM_WALLET || deployer.address
  const poolAWallet    = process.env.POOL_A_WALLET    || deployer.address
  const poolBWallet    = process.env.POOL_B_WALLET    || deployer.address
  const poolCWallet    = process.env.POOL_C_WALLET    || deployer.address

  const Commission = await ethers.getContractFactory("WellKOCCommission")
  const commission = await Commission.deploy(
    addresses.USDT,
    platformWallet,
    poolAWallet,
    poolBWallet,
    poolCWallet
  )
  await commission.waitForDeployment()
  addresses.Commission = await commission.getAddress()
  console.log("   Commission:", addresses.Commission)

  // ── 4. DPP Contract ───────────────────────────────────────
  console.log("\n4. Deploying DPP NFT...")
  const DPP = await ethers.getContractFactory("WellKOCDPP")
  const dpp = await DPP.deploy()
  await dpp.waitForDeployment()
  addresses.DPP = await dpp.getAddress()
  console.log("   DPP NFT:", addresses.DPP)

  // Grant backend minter role to platform wallet
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"))
  await dpp.grantRole(MINTER_ROLE, platformWallet)
  console.log("   Minter role granted to:", platformWallet)

  // ── 5. Save addresses ────────────────────────────────────
  const deploymentInfo = {
    network:     "polygon-amoy",
    chainId:     80002,
    deployedAt:  new Date().toISOString(),
    deployer:    deployer.address,
    contracts:   addresses,
    envVars:     Object.entries(addresses).map(([name, addr]) =>
      `NEXT_PUBLIC_${name.toUpperCase()}_ADDRESS=${addr}`
    ).join("\n"),
  }

  fs.writeFileSync(
    "./deployments/polygon-amoy.json",
    JSON.stringify(deploymentInfo, null, 2)
  )

  console.log("\n✅ All contracts deployed!")
  console.log("\nAdd to .env.local:")
  console.log(deploymentInfo.envVars)
  console.log("\nVerify contracts:")
  Object.entries(addresses).forEach(([name, addr]) => {
    console.log(`npx hardhat verify --network amoy ${addr}`)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
