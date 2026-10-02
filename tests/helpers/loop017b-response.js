"use strict";

const { createHandler, TOOL_NAME, TARGET } = require("../../lambda/loop017b/handler");

const RUN_ID = "12345678-1234-4234-8234-123456789abc";
const LAMBDA_REQUEST_ID = "87654321-4321-4321-8321-cba987654321";
const CODE_SHA256 = "a".repeat(64);

function modelResponse() {
  return {
    stopReason: "tool_use",
    output: { message: { content: [{ toolUse: {
      name: TOOL_NAME,
      input: { target: TARGET, operation: "NO_OP" },
    } }] } },
    usage: { inputTokens: 34, outputTokens: 12, totalTokens: 46 },
    $metadata: { requestId: "bedrock-request-001", httpStatusCode: 200 },
    ignoredRawModelText: "RAW_MODEL_SENTINEL",
  };
}

async function lambdaResponse(overrides = {}) {
  const sent = [];
  const logs = [];
  const client = {
    async send(command) {
      sent.push(command);
      if (overrides.throwSend) throw new Error("RAW_SDK_SECRET_SENTINEL");
      return overrides.modelResponse ?? modelResponse();
    },
  };
  const handler = createHandler({
    client,
    logger: { info: (value) => logs.push(value) },
    now: () => new Date("2026-09-29T04:00:00Z"),
    codeSha256: CODE_SHA256,
  });
  const response = await handler(overrides.event ?? { runId: RUN_ID }, {
    awsRequestId: LAMBDA_REQUEST_ID,
  });
  return { response, sent, logs };
}

module.exports = { RUN_ID, LAMBDA_REQUEST_ID, CODE_SHA256, modelResponse, lambdaResponse };
