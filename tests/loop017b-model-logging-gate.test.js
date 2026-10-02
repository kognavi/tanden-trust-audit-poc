"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runbook = readFileSync(path.join(root, "docs/loop-017b-lambda-nova-live-demo.md"), "utf8");
const gate = path.join(root, "scripts/check-loop017b-model-logging.sh");

test("both runbook prechecks use the same fail-closed logging script", () => {
  assert.equal((runbook.match(/bash scripts\/check-loop017b-model-logging\.sh "\$RUN_DIR"/g) || []).length, 2);
  const standalone = runbook.split("### Required read-only pre-Nova logging gate\n")[1]
    .split("### Future one-shot `RequestResponse` procedure\n")[0];
  assert.ok(standalone.indexOf('RUN_DIR="$(mktemp -d ') < standalone.indexOf('bash scripts/check-loop017b-model-logging.sh "$RUN_DIR"'));
  assert.match(standalone, /set -euo pipefail/);
  assert.match(standalone, /umask 077/);
});

const fakeAws = `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *"bedrock get-model-invocation-logging-configuration"* ]] || exit 9
if [[ "$*" == *"to_string(@)"* ]]; then
  printf 'serialized\\n' >> "$MOCK_TRACE"
  printf '%s' "$MOCK_SERIALIZED_OUTPUT"
  exit "$MOCK_SERIALIZED_STATUS"
fi
printf 'primary\\n' >> "$MOCK_TRACE"
printf '%s' "$MOCK_PRIMARY_OUTPUT"
exit "$MOCK_PRIMARY_STATUS"
`;

function runFixture({ primary = "", primaryStatus = 0, serialized = "{}", serializedStatus = 0 }) {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "loop017b-logging-gate-"));
  const runDir = path.join(fixtureDir, "run");
  const trace = path.join(fixtureDir, "trace");
  const aws = path.join(fixtureDir, "aws");
  try {
    mkdirSync(runDir, { mode: 0o700 });
    writeFileSync(aws, fakeAws);
    chmodSync(aws, 0o700);
    const result = spawnSync("bash", [gate, runDir], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fixtureDir}:${process.env.PATH}`,
        MOCK_TRACE: trace,
        MOCK_PRIMARY_OUTPUT: primary,
        MOCK_PRIMARY_STATUS: String(primaryStatus),
        MOCK_SERIALIZED_OUTPUT: serialized,
        MOCK_SERIALIZED_STATUS: String(serializedStatus),
      },
    });
    assert.ifError(result.error);
    return {
      status: result.status,
      stderr: result.stderr,
      trace: readFileSync(trace, "utf8").trim().split("\n"),
    };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

test("successful empty CLI stdout is GO only after a second successful read proves {}", () => {
  const result = runFixture({ primary: "", serialized: "{}\n" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.trace, ["primary", "serialized", "primary", "serialized"]);
});

test("command failure is NO-GO even when stdout is empty", () => {
  const result = runFixture({ primary: "", primaryStatus: 8 });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.trace, ["primary"]);
});

test("logging gate rejects ambiguous and populated responses", () => {
  const fixtures = [
    ["empty object", "{}", "{}", true],
    ["empty loggingConfig", '{"loggingConfig":{}}', "{}", true],
    ["unknown response field", '{"otherResponseField":true}', "{}", false],
    ["null response", "null", "{}", false],
    ["false response", "false", "{}", false],
    ["string response", '"response"', "{}", false],
    ["number response", "1", "{}", false],
    ["array response", "[]", "{}", false],
    ["null loggingConfig", '{"loggingConfig":null}', "{}", false],
    ["false loggingConfig", '{"loggingConfig":false}', "{}", false],
    ["array loggingConfig", '{"loggingConfig":[]}', "{}", false],
    ["string loggingConfig", '{"loggingConfig":"enabled"}', "{}", false],
    ["number loggingConfig", '{"loggingConfig":1}', "{}", false],
    ["enabled loggingConfig", '{"loggingConfig":{"textDataDeliveryEnabled":true}}', "{}", false],
    ["disabled but nonempty loggingConfig", '{"loggingConfig":{"textDataDeliveryEnabled":false}}', "{}", false],
    ["multiple JSON values", '{}\n{"loggingConfig":{}}', "{}", false],
    ["malformed JSON", "{", "{}", false],
    ["empty stdout with populated confirmation", "", '{"loggingConfig":{"textDataDeliveryEnabled":true}}', false],
    ["empty stdout with malformed confirmation", "", "{", false],
    ["empty stdout with multiple confirmations", "", "{}\n{}", false],
    ["empty stdout with null confirmation", "", "null", false],
    ["empty stdout with empty confirmation", "", "", false],
  ];
  for (const [name, primary, serialized, allowed] of fixtures) {
    const result = runFixture({ primary, serialized });
    assert.equal(result.status === 0, allowed, `${name}: ${result.stderr}`);
  }
  assert.notEqual(runFixture({ primary: "", serializedStatus: 8 }).status, 0);
});
