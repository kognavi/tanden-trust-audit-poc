const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying TrustAnchor contract to Sepolia...");

  const TrustAnchor = await hre.ethers.getContractFactory("TrustAnchor");
  const trustAnchor = await TrustAnchor.deploy();

  await trustAnchor.waitForDeployment();

  const address = await trustAnchor.getAddress();
  console.log("✅ TrustAnchor deployed to:", address);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
