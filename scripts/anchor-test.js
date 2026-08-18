const hre = require("hardhat");

async function main() {
  const address = process.env.TRUST_ANCHOR_ADDRESS;
  const TrustAnchor = await hre.ethers.getContractAt("TrustAnchor", address);

  // ✅ タイムスタンプを含めてユニークな値にする
  const uniqueMessage = `Hello Tanden Trust! - Key Rotation Test - ${Date.now()}`;
  const testHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(uniqueMessage));

  console.log("📌 Anchoring message:", uniqueMessage);
  console.log("📌 Anchoring hash:", testHash);

  const tx = await TrustAnchor.anchor(testHash);
  await tx.wait();

  console.log("✅ Anchored! Tx hash:", tx.hash);

  const timestamp = await TrustAnchor.anchoredAt(testHash);
  console.log("⏰ Recorded timestamp:", timestamp.toString());
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exitCode = 1;
});

