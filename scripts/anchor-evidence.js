const hre = require("hardhat");
const fs = require("node:fs");
const {
  getEvidenceDigestDetails,
  loadEvidenceFromFile,
} = require("../lib/signature-digest");

async function main() {
  const evidenceFilePath = process.env.EVIDENCE_FILE || "samples/evidence-consent.json";
  const contractAddress = process.env.TRUST_ANCHOR_ADDRESS;

  if (!contractAddress) {
    console.error("❌ TRUST_ANCHOR_ADDRESS environment variable is not set.");
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(evidenceFilePath)) {
    console.error(`❌ Evidence file not found: ${evidenceFilePath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`📄 Evidence file: ${evidenceFilePath}`);

  const evidence = loadEvidenceFromFile(evidenceFilePath);
  const digestDetails = await getEvidenceDigestDetails(evidence);
  const digestBytes32 = `0x${digestDetails.digestHex}`;

  console.log(`📐 Canonicalization: ${digestDetails.canonicalization}`);
  console.log(`🔑 Digest (SHA-256, bytes32): ${digestBytes32}`);

  const TrustAnchor = await hre.ethers.getContractAt("TrustAnchor", contractAddress);

  // --- べき等性チェック ---
  const existing = await TrustAnchor.anchoredAt(digestBytes32);
  if (existing.toString() !== "0") {
    console.log("⚠️  This evidence has already been anchored.");
    console.log(`⏰ Previously anchored at (unix timestamp): ${existing.toString()}`);
    console.log(`🔗 https://sepolia.etherscan.io/address/${contractAddress}`);
    return;
  }

  // --- オンチェーン刻印 ---
  console.log("🚀 Anchoring evidence on-chain...");
  const tx = await TrustAnchor.anchor(digestBytes32);
  console.log(`⏳ Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

  // --- 自己検証（信頼のループ）---
  const timestamp = await TrustAnchor.anchoredAt(digestBytes32);
  if (timestamp.toString() === "0") {
    throw new Error("Self-verification failed: anchoredAt() returned 0 after anchoring.");
  }

  console.log("🔍 Self-verification passed.");
  console.log(`⏰ Recorded timestamp: ${timestamp.toString()}`);
  console.log(`🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
  console.log("🎉 Evidence successfully anchored on-chain!");
}

main().catch((error) => {
  console.error("❌ Anchoring failed:", error);
  process.exitCode = 1;
});
