const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const hre = require("hardhat");
const {
  readJsonFile,
} = require("../lib/schema-validation");
const {
  VerifiedAnchorService,
  TrustedKeyResolver,
} = require("../lib/verified-anchor-service");
const { PgSigningLogger } = require("../lib/pg-signing-logger");
const { PgInternalLedgerVerifier } = require("../lib/internal-ledger-verifier");

async function main() {
  const evidenceFilePath = requireEnvironment("EVIDENCE_FILE");
  const metadataFilePath = requireEnvironment("EVIDENCE_METADATA_FILE");
  const trustedKeyringFilePath = requireEnvironment("TRUSTED_KEYRING_FILE");
  const contractAddress = requireEnvironment("TRUST_ANCHOR_ADDRESS");
  const ledgerEventId = requireEnvironment("LEDGER_EVENT_ID");
  const databaseUrl = requireEnvironment("DATABASE_URL");
  const network = requireEnvironment("ANCHOR_NETWORK");
  const chainId = requireEnvironment("ANCHOR_CHAIN_ID");

  const evidence = readJsonFile(evidenceFilePath);
  const metadata = readJsonFile(metadataFilePath);
  const trustedKeyResolver = loadTrustedKeyResolver(trustedKeyringFilePath);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const anchorClient = createLazyAnchorClient({
      ethers: hre.ethers,
      contractAddress,
      network,
      chainId,
    });
    const internalLedgerVerifier = new PgInternalLedgerVerifier({
      pgLogger: new PgSigningLogger({ pool }),
    });
    const result = await new VerifiedAnchorService({
      anchorClient,
      trustedKeyResolver,
      internalLedgerVerifier,
    }).anchorVerifiedEvidence({ evidence, metadata, ledgerEventId });

    console.log(JSON.stringify(result.anchorVerification));
    console.log(
      "The recorded block number is transaction provenance, not a trusted timestamp authority."
    );
  } finally {
    await pool.end();
  }
}

function createLazyAnchorClient({ ethers, contractAddress, network, chainId }) {
  let contractPromise;
  const getContract = () => {
    contractPromise ??= ethers.getContractAt("TrustAnchor", contractAddress);
    return contractPromise;
  };
  return {
    provenance: { provider: "ethereum", network, chainId, contractAddress },
    async getAnchoredAt(digestBytes32) {
      return (await getContract()).anchoredAt(digestBytes32);
    },
    async anchorDigest(digestBytes32) {
      const transaction = await (await getContract()).anchor(digestBytes32);
      const receipt = await transaction.wait();
      return { transactionHash: transaction.hash, blockNumber: receipt.blockNumber };
    },
  };
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

if (require.main === module) {
  main().catch((error) => {
    console.error(`Anchoring failed [${error.code ?? error.name}]: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createLazyAnchorClient };
