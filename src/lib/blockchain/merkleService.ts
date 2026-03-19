import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';

/**
 * Build a Merkle tree from DPP claims
 * Claims are hashed with keccak256 before adding to tree
 */
export function buildDPPMerkleTree(dppClaims: string[]): {
  root: string;
  tree: MerkleTree;
  leaves: string[];
} {
  const leaves = dppClaims.map((claim) =>
    ethers.keccak256(ethers.toUtf8Bytes(claim))
  );

  const tree = new MerkleTree(leaves, keccak256Hash, { sortPairs: true });
  const root = tree.getHexRoot();

  return { root, tree, leaves };
}

/**
 * Get Merkle proof for a specific claim
 */
export function getProof(tree: MerkleTree, claim: string): string[] {
  const leaf = ethers.keccak256(ethers.toUtf8Bytes(claim));
  return tree.getHexProof(leaf);
}

/**
 * Verify a claim against a Merkle root
 */
export function verifyClaim(
  root: string,
  claim: string,
  proof: string[]
): boolean {
  const leaf = ethers.keccak256(ethers.toUtf8Bytes(claim));
  return MerkleTree.verify(proof, leaf, root, keccak256Hash, { sortPairs: true });
}

/**
 * Build claims array from DPP data
 */
export function buildDPPClaims(dppData: {
  origin?: string;
  certifications?: string[];
  carbonFootprint?: string;
  ingredients?: string[];
  expiryDate?: string;
}): string[] {
  const claims: string[] = [];

  if (dppData.origin) claims.push(`origin:${dppData.origin}`);
  if (dppData.carbonFootprint) claims.push(`carbon:${dppData.carbonFootprint}`);
  if (dppData.expiryDate) claims.push(`expiry:${dppData.expiryDate}`);

  if (dppData.certifications) {
    for (const cert of dppData.certifications) {
      claims.push(`cert:${cert}`);
    }
  }

  if (dppData.ingredients) {
    for (const ing of dppData.ingredients) {
      claims.push(`ingredient:${ing}`);
    }
  }

  return claims;
}

function keccak256Hash(data: Buffer): Buffer {
  return Buffer.from(ethers.keccak256(data).slice(2), 'hex');
}
