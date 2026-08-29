/* global describe, it */

const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("TrustAnchor", function () {
  async function deploy() {
    const factory = await ethers.getContractFactory("TrustAnchor");
    return factory.deploy();
  }

  it("anchors a digest, emits the event, and stores the block timestamp", async function () {
    const contract = await deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("verified evidence"));
    const transaction = await contract.anchor(digest);
    const receipt = await transaction.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);

    const event = receipt.logs
      .map((log) => contract.interface.parseLog(log))
      .find((log) => log?.name === "Anchored");
    assert.ok(event);
    assert.equal(event.args.hash, digest);
    assert.equal(event.args.timestamp, BigInt(block.timestamp));
    assert.equal(await contract.anchoredAt(digest), BigInt(block.timestamp));
  });

  it("rejects duplicate anchoring", async function () {
    const contract = await deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("duplicate"));
    await contract.anchor(digest);
    await assert.rejects(contract.anchor(digest), /Already anchored/);
  });

  it("rejects the zero digest", async function () {
    const contract = await deploy();
    await assert.rejects(contract.anchor(ethers.ZeroHash), /Zero digest/);
  });
});
