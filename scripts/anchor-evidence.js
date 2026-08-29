const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const {
  readJsonFile,
} = require("../lib/schema-validation");
const {
  VerifiedAnchorService,
  TrustedKeyResolver,
} = require("../lib/verified-anchor-service");

async function main() {
  const evidenceFilePath = requireEnvironment("EVIDENCE_FILE");
  const metadataFilePath = requireEnvironment("EVIDENCE_METADATA_FILE");
  const trustedKeyringFilePath = requireEnvironment("TRUSTED_KEYRING_FILE");
  const contractAddress = requireEnvironment("TRUST_ANCHOR_ADDRESS");

  const evidence = readJsonFile(evidenceFilePath);
  const metadata = readJsonFile(metadataFilePath);
  const trustedKeyResolver = loadTrustedKeyResolver(trustedKeyringFilePath);

  const contract = await hre.ethers.getContractAt("TrustAnchor", contractAddress);
  const anchorClient = {
    getAnchoredAt: (digestBytes32) => contract.anchoredAt(digestBytes32),
    async anchorDigest(digestBytes32) {
      const transaction = await contract.anchor(digestBytes32);
      const receipt = await transaction.wait();
      return {
        transactionHash: transaction.hash,
        blockNumber: receipt.blockNumber,
      };
    },
  };

  const result = await new VerifiedAnchorService({
    anchorClient,
    trustedKeyResolver,
  }).anchorVerifiedEvidence({ evidence, metadata });

  console.log(`Verified digest anchored: ${result.digestBytes32}`);
  console.log(`Transaction: ${result.transactionResult.transactionHash}`);
  console.log(`Block: ${result.transactionResult.blockNumber}`);
  console.log(
    "The recorded block timestamp is ordering evidence, not a trusted timestamp authority."
  );
}

function loadTrustedKeyResolver(keyringFilePath) {
  const keyring = readJsonFile(keyringFilePath);
  if (!keyring || typeof keyring !== "object" || Array.isArray(keyring)) {
    throw new Error("TRUSTED_KEYRING_FILE must contain a JSON object.");
  }
  const baseDirectory = path.dirname(path.resolve(keyringFilePath));
  const entries = Object.entries(keyring).map(([keyId, publicKeyFile]) => {
    if (typeof publicKeyFile !== "string" || publicKeyFile.length === 0) {
      throw new Error(`Trusted key ${keyId} must reference a public key file.`);
    }
    const publicKeyPath = path.resolve(baseDirectory, publicKeyFile);
    return [keyId, fs.readFileSync(publicKeyPath, "utf8")];
  });
  return new TrustedKeyResolver(new Map(entries));
}

function requireEnvironment(name) {
  // eslint-disable-next-line security/detect-object-injection -- `name` is always a developer-defined literal at this local CLI boundary.
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} environment variable is required.`);
  }
  return value;
}

main().catch((error) => {
  console.error(`Anchoring failed [${error.code ?? error.name}]: ${error.message}`);
  process.exitCode = 1;
});
