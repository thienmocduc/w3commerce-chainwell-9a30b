import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const hasPrivateKey = PRIVATE_KEY && PRIVATE_KEY.length === 66 && PRIVATE_KEY.startsWith('0x');
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL ?? 'https://rpc-mumbai.maticvigil.com';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'cancun',
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygonMumbai: {
      url: MUMBAI_RPC_URL,
      accounts: hasPrivateKey ? [PRIVATE_KEY!] : [],
      chainId: 80001,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
      accounts: hasPrivateKey ? [PRIVATE_KEY!] : [],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY ?? '',
      polygon: process.env.POLYGONSCAN_API_KEY ?? '',
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  typechain: {
    outDir: '../src/lib/web3/typechain',
    target: 'ethers-v6',
  },
};

export default config;
