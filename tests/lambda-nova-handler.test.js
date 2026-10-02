"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { createHandler, createBedrockClient, FIXED_INPUT_SHA256, MODEL_ID, TARGET } = require("../lambda/loop017b/handler");
const { RUN_ID, LAMBDA_REQUEST_ID, CODE_SHA256, modelResponse, lambdaResponse } = require("./helpers/loop017b-response");

test("fixed synthetic request sends one Converse command and returns only wrapper facts", async () => {
  const { response, sent, logs } = await lambdaResponse();
  assert.equal(sent.length, 1);
  assert.ok(sent[0] instanceof ConverseCommand);
  assert.equal(sent[0].input.modelId, MODEL_ID);
  assert.deepEqual(sent[0].input.toolConfig.toolChoice, { tool: { name: "record_synthetic_noop" } });
  assert.equal(sent[0].input.inferenceConfig.maxTokens, 128);
  assert.equal(response.fixedInputSha256, FIXED_INPUT_SHA256);
  assert.equal(response.bedrockRequestId, "bedrock-request-001");
  assert.equal(response.auditEvent.sideEffect.category, "NONE");
  assert.equal(response.auditEvent.action.target, TARGET);
  assert.equal(response.auditEvent.execution.sessionId, RUN_ID);
  assert.equal(response.auditEvent.execution.taskId, `lambda-${LAMBDA_REQUEST_ID}`);
  assert.equal(response.auditEvent.metadata.containsPersonalData, false);
  assert.equal(response.auditEvent.metadata.containsSecrets, false);
  assert.equal(JSON.stringify(response).includes("RAW_MODEL_SENTINEL"), false);
  assert.equal(logs.join(" ").includes("RAW_MODEL_SENTINEL"), false);
  assert.equal(logs.join(" ").includes(TARGET), false);
  assert.deepEqual(logs.map((line) => JSON.parse(line).status), ["ATTEMPTING", "SUCCESS"]);
  assert.equal(JSON.parse(logs[0]).runId, RUN_ID);
  assert.equal(JSON.parse(logs[0]).lambdaRequestId, LAMBDA_REQUEST_ID);
});

test("production Bedrock client disables SDK retries", async () => {
  const client = createBedrockClient();
  assert.equal(await client.config.maxAttempts(), 1);
  assert.equal(await client.config.region(), "ap-northeast-1");
  client.destroy();
});

test("arbitrary prompt, PII, or secret fields fail before model call", async () => {
  for (const extra of [
    { prompt: "different prompt" },
    { customerEmail: "person@example.test" },
    { secret: "secret-sentinel" },
  ]) {
    let calls = 0;
    const handler = createHandler({
      client: { async send() { calls += 1; return modelResponse(); } },
      codeSha256: CODE_SHA256,
    });
    await assert.rejects(() => handler({ runId: RUN_ID, ...extra }, { awsRequestId: LAMBDA_REQUEST_ID }),
      (error) => error.code === "INVALID_FIXED_INVOCATION");
    assert.equal(calls, 0);
  }
});

test("wrong, multiple, malformed, or drifting tool use fails closed after one call", async () => {
  const variants = [
    (r) => { r.output.message.content[0].toolUse.name = "dangerous_tool"; },
    (r) => { r.output.message.content[0].toolUse.input.target = "real://customer/1"; },
    (r) => { r.output.message.content[0].toolUse.input.secret = "raw-secret"; },
    (r) => { r.output.message.content.push(structuredClone(r.output.message.content[0])); },
    (r) => { r.output.message.content = [{ text: "no tool" }]; },
    (r) => { r.stopReason = "end_turn"; },
  ];
  for (const mutate of variants) {
    const model = modelResponse();
    mutate(model);
    let calls = 0;
    const handler = createHandler({
      client: { async send() { calls += 1; return model; } },
      logger: { info() {} },
      codeSha256: CODE_SHA256,
    });
    await assert.rejects(() => handler({ runId: RUN_ID }, { awsRequestId: LAMBDA_REQUEST_ID }),
      (error) => ["EXPECTED_ONE_TOOL_USE", "UNEXPECTED_TOOL_USE"].includes(error.code));
    assert.equal(calls, 1);
  }
});

test("SDK error is sanitized and never retried", async () => {
  let calls = 0;
  const logs = [];
  const handler = createHandler({
    client: { async send() { calls += 1; throw new Error("RAW_SDK_SECRET_SENTINEL"); } },
    logger: { info(line) { logs.push(JSON.parse(line)); } },
    codeSha256: CODE_SHA256,
  });
  await assert.rejects(() => handler({ runId: RUN_ID }, { awsRequestId: LAMBDA_REQUEST_ID }),
    (error) => error.code === "BEDROCK_RESULT_INDETERMINATE" &&
      error.message.includes(RUN_ID) && error.message.includes(LAMBDA_REQUEST_ID) &&
      !error.message.includes("RAW_SDK_SECRET_SENTINEL"));
  assert.equal(calls, 1);
  assert.deepEqual(logs.map((line) => line.status), ["ATTEMPTING", "INDETERMINATE"]);
  assert.equal(logs[1].runId, RUN_ID);
  assert.equal(logs[1].lambdaRequestId, LAMBDA_REQUEST_ID);
  assert.equal(JSON.stringify(logs).includes("RAW_SDK_SECRET_SENTINEL"), false);
});

test("correlation logging failure stops before inference", async () => {
  let calls = 0;
  const handler = createHandler({
    client: { async send() { calls += 1; return modelResponse(); } },
    logger: { info() { throw new Error("RAW_LOGGER_SECRET_SENTINEL"); } },
    codeSha256: CODE_SHA256,
  });
  await assert.rejects(() => handler({ runId: RUN_ID }, { awsRequestId: LAMBDA_REQUEST_ID }),
    (error) => error.code === "PRECALL_CORRELATION_LOG_FAILED" &&
      error.message.includes(RUN_ID) && error.message.includes(LAMBDA_REQUEST_ID) &&
      !error.message.includes("RAW_LOGGER_SECRET_SENTINEL"));
  assert.equal(calls, 0);
});

test("post-inference logging failure never causes another Converse call", async () => {
  let calls = 0;
  let logs = 0;
  const handler = createHandler({
    client: { async send() { calls += 1; return modelResponse(); } },
    logger: { info() { logs += 1; if (logs === 2) throw new Error("logger unavailable"); } },
    codeSha256: CODE_SHA256,
  });
  const response = await handler({ runId: RUN_ID }, { awsRequestId: LAMBDA_REQUEST_ID });
  assert.equal(response.runId, RUN_ID);
  assert.equal(calls, 1);
  assert.equal(logs, 2);
});
