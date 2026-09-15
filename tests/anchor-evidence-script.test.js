"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLazyAnchorClient } = require("../scripts/anchor-evidence");
const { VerifiedAnchorService } = require("../lib/verified-anchor-service");

const contractAddress = `0x${"1".repeat(40)}`;

test("invalid input cannot trigger contract, signer, or provider acquisition", async () => {
  let acquisitions = 0;
  const anchorClient = createLazyAnchorClient({
    ethers: {
      async getContractAt() {
        acquisitions += 1;
        throw new Error("must not be acquired");
      },
    },
    contractAddress,
    network: "local-test",
    chainId: "31337",
  });
  const service = new VerifiedAnchorService({
    anchorClient,
    trustedKeyResolver: { resolvePublicKey: () => "unused" },
    internalLedgerVerifier: { verifyRecordedEvidence: () => ({ confirmed: false }) },
  });

  await assert.rejects(
    () => service.anchorVerifiedEvidence({ valid: true, digestHex: "a".repeat(64) }),
    (error) => error.code === "INVALID_SIDECAR_METADATA"
  );
  assert.equal(acquisitions, 0);
});

test("lazy client acquires and caches the contract only on the first external operation", async () => {
  let acquisitions = 0;
  const calls = [];
  const contract = {
    anchoredAt: async (digest) => {
      calls.push(["anchoredAt", digest]);
      return 0n;
    },
    anchor: async (digest) => {
      calls.push(["anchor", digest]);
      return {
        hash: `0x${"2".repeat(64)}`,
        wait: async () => ({ blockNumber: 5 }),
      };
    },
  };
  const client = createLazyAnchorClient({
    ethers: {
      async getContractAt(name, address) {
        acquisitions += 1;
        assert.deepEqual([name, address], ["TrustAnchor", contractAddress]);
        return contract;
      },
    },
    contractAddress,
    network: "local-test",
    chainId: "31337",
  });
  assert.equal(acquisitions, 0);
  await client.getAnchoredAt(`0x${"a".repeat(64)}`);
  await client.anchorDigest(`0x${"a".repeat(64)}`);
  assert.equal(acquisitions, 1);
  assert.deepEqual(calls.map(([method]) => method), ["anchoredAt", "anchor"]);
});
