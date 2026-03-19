import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. Deploy W3CToken
  console.log('\n--- Deploying W3CToken ---');
  const W3CToken = await ethers.getContractFactory('W3CToken');
  const w3cToken = await W3CToken.deploy(deployer.address);
  await w3cToken.waitForDeployment();
  const w3cTokenAddress = await w3cToken.getAddress();
  console.log('W3CToken deployed to:', w3cTokenAddress);

  // 2. Deploy StakingVault
  console.log('\n--- Deploying StakingVault ---');
  const rewardPool = deployer.address; // Deployer acts as reward pool initially
  const StakingVault = await ethers.getContractFactory('StakingVault');
  const stakingVault = await StakingVault.deploy(w3cTokenAddress, rewardPool);
  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();
  console.log('StakingVault deployed to:', stakingVaultAddress);

  // 3. Deploy AffiliateRouter
  console.log('\n--- Deploying AffiliateRouter ---');
  const AffiliateRouter = await ethers.getContractFactory('AffiliateRouter');
  const affiliateRouter = await AffiliateRouter.deploy(w3cTokenAddress, deployer.address);
  await affiliateRouter.waitForDeployment();
  const affiliateRouterAddress = await affiliateRouter.getAddress();
  console.log('AffiliateRouter deployed to:', affiliateRouterAddress);

  // 4. Deploy W3CNFT via UUPS Proxy
  console.log('\n--- Deploying W3CNFT (UUPS Proxy) ---');
  const W3CNFT = await ethers.getContractFactory('W3CNFT');
  const w3cNFTImpl = await W3CNFT.deploy();
  await w3cNFTImpl.waitForDeployment();
  const implAddress = await w3cNFTImpl.getAddress();
  console.log('W3CNFT implementation at:', implAddress);

  // Deploy ERC1967Proxy
  const initData = W3CNFT.interface.encodeFunctionData('initialize', [deployer.address]);
  const ERC1967Proxy = await ethers.getContractFactory(
    '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy'
  );
  const proxy = await ERC1967Proxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log('W3CNFT proxy deployed to:', proxyAddress);

  // 5. Deploy CreatorTokenFactory
  console.log('\n--- Deploying CreatorTokenFactory ---');
  const CreatorTokenFactory = await ethers.getContractFactory('CreatorTokenFactory');
  const creatorFactory = await CreatorTokenFactory.deploy();
  await creatorFactory.waitForDeployment();
  const creatorFactoryAddress = await creatorFactory.getAddress();
  console.log('CreatorTokenFactory deployed to:', creatorFactoryAddress);

  // 6. Grant roles
  console.log('\n--- Setting up roles ---');
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const SLASH_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SLASH_ROLE'));
  const ORDER_PROCESSOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORDER_PROCESSOR_ROLE'));

  await w3cToken.grantRole(MINTER_ROLE, stakingVaultAddress);
  console.log('Granted MINTER_ROLE to StakingVault');

  await stakingVault.grantRole(SLASH_ROLE, deployer.address);
  console.log('Granted SLASH_ROLE to deployer');

  await affiliateRouter.grantRole(ORDER_PROCESSOR_ROLE, deployer.address);
  console.log('Granted ORDER_PROCESSOR_ROLE to deployer');

  // 7. Save deployment addresses
  const network = (await ethers.provider.getNetwork()).name;
  const networkName = network === 'unknown' ? 'localhost' : network;
  const deployment = {
    network: networkName,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      W3CToken: w3cTokenAddress,
      StakingVault: stakingVaultAddress,
      AffiliateRouter: affiliateRouterAddress,
      W3CNFT_Implementation: implAddress,
      W3CNFT_Proxy: proxyAddress,
      CreatorTokenFactory: creatorFactoryAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to: ${filePath}`);

  console.log('\n✅ All contracts deployed successfully!');
  console.log(JSON.stringify(deployment.contracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
