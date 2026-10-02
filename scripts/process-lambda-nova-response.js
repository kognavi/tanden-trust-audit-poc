#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { runLambdaNovaLiveDemo } = require("../lib/lambda-nova-live-demo");

async function main(args = process.argv.slice(2)) {
  if (args.length !== 3) {
    throw new Error("Usage: process-lambda-nova-response.js <sanitized-response.json> <summary.json> <run-id>");
  }
  const [responseFile, summaryFile, expectedRunId] = args;
  // The input is the already-sanitized Lambda wrapper response, never a raw model response.
  const lambdaResponse = fs.readFileSync(path.resolve(responseFile), "utf8");
  const summary = await runLambdaNovaLiveDemo({ lambdaResponse, expectedRunId });
  const outputPath = path.resolve(summaryFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.name || "Error"}: ${error.code || "PROCESS_FAILED"}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
