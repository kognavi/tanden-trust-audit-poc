"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { runAgentCoreLiveDemo } = require("../lib/agentcore-live-demo");

async function main() {
  const [responseFile, outputFile = "demo-output/agentcore-live-demo-result.json"] = process.argv.slice(2);
  if (!responseFile) {
    throw new Error(
      "Usage: node scripts/process-agentcore-live-response.js <runtime-response.json> [output.json]"
    );
  }

  const absoluteResponsePath = path.resolve(responseFile);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit manual-demo CLI path.
  const runtimeResponse = fs.readFileSync(absoluteResponsePath, "utf8");

  const summary = await runAgentCoreLiveDemo({
    runtimeResponse,
    runtimeArn: process.env.AGENTCORE_RUNTIME_ARN,
    runtimeSessionId: process.env.AGENTCORE_RUNTIME_SESSION_ID,
    traceId: process.env.AGENTCORE_TRACE_ID,
    qualifier: process.env.AGENTCORE_QUALIFIER || "DEFAULT",
    region: process.env.AWS_REGION || "ap-northeast-1",
  });

  const absoluteOutputPath = path.resolve(outputFile);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit manual-demo CLI path.
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit manual-demo CLI path.
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.name || "Error"}: ${error.message}\n`);
  if (error.code) process.stderr.write(`code=${error.code}\n`);
  process.exitCode = 1;
});
