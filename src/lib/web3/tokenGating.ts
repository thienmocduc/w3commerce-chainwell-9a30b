import { ethers } from 'ethers';
import { getContracts } from '@/lib/blockchain/contractService';

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

/**
 * Check if user holds minimum creator tokens to access gated content
 */
export async function checkTokenGate(
  userWallet: string,
  kocWallet: string,
  minimumBalance: bigint
): Promise<{ hasAccess: boolean; balance: bigint; tokenAddress: string }> {
  const { creatorFactory, provider } = getContracts();

  const tokenAddress = await creatorFactory.getTokenForKOC(kocWallet);

  if (tokenAddress === ethers.ZeroAddress) {
    return { hasAccess: false, balance: BigInt(0), tokenAddress: ethers.ZeroAddress };
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_BALANCE_ABI, provider);
  const balance = await tokenContract.balanceOf(userWallet);

  return {
    hasAccess: balance >= minimumBalance,
    balance,
    tokenAddress,
  };
}

/**
 * Check if user holds a KOC Badge NFT with minimum level
 */
export async function checkNFTGate(
  userWallet: string,
  _minLevel: number
): Promise<{ hasAccess: boolean; tokenId: number | null }> {
  const { w3cNFT } = getContracts();

  try {
    const tokens: bigint[] = await w3cNFT.getUserTokens(userWallet);

    for (const tokenId of tokens) {
      const metadata = await w3cNFT.nftMetadata(tokenId);
      // NFTType.KOC_BADGE = 1
      if (metadata.nftType === BigInt(1) && !metadata.revoked) {
        // In production: check level from merkle claims
        return { hasAccess: true, tokenId: Number(tokenId) };
      }
    }
  } catch {
    // Contract call failed — user has no tokens
  }

  return { hasAccess: false, tokenId: null };
}
