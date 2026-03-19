import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.MUMBAI_RPC_URL ?? 'https://rpc-mumbai.maticvigil.com';
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

function getWallet(): ethers.Wallet {
  if (!_wallet) {
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');
    _wallet = new ethers.Wallet(pk, getProvider());
  }
  return _wallet;
}

interface DeploymentAddresses {
  W3CToken: string;
  StakingVault: string;
  AffiliateRouter: string;
  W3CNFT_Proxy: string;
  CreatorTokenFactory: string;
}

function loadDeployment(): DeploymentAddresses {
  const network = process.env.NEXT_PUBLIC_CONTRACT_NETWORK ?? 'localhost';
  const filePath = path.join(process.cwd(), 'contracts', 'deployments', `${network}.json`);

  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.contracts;
  }

  // Fallback: use env vars
  return {
    W3CToken: process.env.W3C_TOKEN_ADDRESS ?? ethers.ZeroAddress,
    StakingVault: process.env.STAKING_VAULT_ADDRESS ?? ethers.ZeroAddress,
    AffiliateRouter: process.env.AFFILIATE_ROUTER_ADDRESS ?? ethers.ZeroAddress,
    W3CNFT_Proxy: process.env.W3CNFT_PROXY_ADDRESS ?? ethers.ZeroAddress,
    CreatorTokenFactory: process.env.CREATOR_FACTORY_ADDRESS ?? ethers.ZeroAddress,
  };
}

// Minimal ABIs for server-side interaction
const W3C_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function calculateTokensRequired(uint256 fixedUSDCAmount) view returns (uint256)',
  'function tokenPriceUSDC() view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function updatePrice(uint256 newPriceUSDC)',
];

const STAKING_VAULT_ABI = [
  'function stakes(address) view returns (uint256 amount, uint256 stakedAt, bool isVendor, bool isActive)',
  'function isVendorApproved(address) view returns (bool)',
  'function slash(address target, uint256 slashRatio, string reason)',
  'function getStakeInfo(address staker) view returns (tuple(uint256 amount, uint256 stakedAt, bool isVendor, bool isActive))',
];

const AFFILIATE_ROUTER_ABI = [
  'function processCommission(bytes32 orderId, address vendor, uint256 totalAmount, tuple(address[] kocAddresses, uint256[] splitRatios, uint256 vendorRate) split)',
  'function platformFeeRate() view returns (uint256)',
];

const W3CNFT_ABI = [
  'function mintDPP(address vendor, string uri, bytes32 merkleRoot, bytes32 productId) returns (uint256)',
  'function mintKOCBadge(address koc, string uri, bytes32 merkleRoot) returns (uint256)',
  'function verifyDPPClaim(bytes32 productId, bytes32 claim, bytes32[] proof) view returns (bool)',
  'function dppMerkleRoots(bytes32) view returns (bytes32)',
  'function totalMinted() view returns (uint256)',
];

const CREATOR_FACTORY_ABI = [
  'function kocToToken(address) view returns (address)',
  'function deployToken(string name, string symbol) returns (address)',
  'function getTokenForKOC(address koc) view returns (address)',
  'function totalTokensDeployed() view returns (uint256)',
];

export function getContracts() {
  const addresses = loadDeployment();
  const wallet = getWallet();

  return {
    w3cToken: new ethers.Contract(addresses.W3CToken, W3C_TOKEN_ABI, wallet),
    stakingVault: new ethers.Contract(addresses.StakingVault, STAKING_VAULT_ABI, wallet),
    affiliateRouter: new ethers.Contract(addresses.AffiliateRouter, AFFILIATE_ROUTER_ABI, wallet),
    w3cNFT: new ethers.Contract(addresses.W3CNFT_Proxy, W3CNFT_ABI, wallet),
    creatorFactory: new ethers.Contract(addresses.CreatorTokenFactory, CREATOR_FACTORY_ABI, wallet),
    addresses,
    provider: getProvider(),
    wallet,
  };
}

export async function waitForTx(txHash: string, confirmations = 2, timeoutMs = 60000) {
  const provider = getProvider();
  const receipt = await provider.waitForTransaction(txHash, confirmations, timeoutMs);
  if (!receipt) throw new Error(`Transaction ${txHash} timed out`);
  if (receipt.status === 0) throw new Error(`Transaction ${txHash} reverted`);
  return receipt;
}
