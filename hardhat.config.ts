import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import * as dotenv from "dotenv"
dotenv.config()

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64)

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Polygon Amoy testnet
    amoy: {
      url:      process.env.POLYGON_RPC || "https://rpc-amoy.polygon.technology",
      chainId:  80002,
      accounts: [PRIVATE_KEY],
      gasPrice: 30_000_000_000, // 30 gwei
    },
    // Polygon mainnet
    polygon: {
      url:      "https://polygon-rpc.com",
      chainId:  137,
      accounts: [PRIVATE_KEY],
      gasPrice: 50_000_000_000, // 50 gwei
    },
    // Local hardhat for testing
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  etherscan: {
    apiKey: {
      polygon:     process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [{
      network:   "polygonAmoy",
      chainId:   80002,
      urls: {
        apiURL:     "https://api-amoy.polygonscan.com/api",
        browserURL: "https://amoy.polygonscan.com",
      },
    }],
  },
  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
  },
}

export default config
