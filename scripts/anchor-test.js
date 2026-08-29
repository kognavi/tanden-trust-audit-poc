const hre = require("hardhat");

async function main() {
  if (process.env.ALLOW_UNSAFE_DEMO_ANCHOR !== "true") {
    throw new Error(
      "Demo-only raw anchoring is disabled. Use scripts/anchor-evidence.js for verified Evidence, or explicitly set ALLOW_UNSAFE_DEMO_ANCHOR=true for contract smoke testing."
    );
  }
  const address = process.env.TRUST_ANCHOR_ADDRESS;
  if (!address) {
    throw new Error("TRUST_ANCHOR_ADDRESS environment variable is required.");
  }
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    throw new Error(
      `Demo-only raw anchoring is restricted to Hardhat local chainId 31337; received ${network.chainId}.`
    );
  }
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
  console.log("Recorded block timestamp (not a trusted timestamp):", timestamp.toString());
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exitCode = 1;
});
