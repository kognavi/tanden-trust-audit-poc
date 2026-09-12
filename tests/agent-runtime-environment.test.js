const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeCodexEnvironment
} = require("../scripts/agent-runtime-adapter");

test("Codex reviewer environment keeps only allowlisted process variables", () => {
  const sanitized = sanitizeCodexEnvironment({
    PATH: "/usr/bin",
    HOME: "/tmp/home",
    USERPROFILE: "C:\\Users\\tester",
    TMPDIR: "/tmp",
    TMP: "/tmp",
    TEMP: "/tmp",
    LANG: "en_US.UTF-8",
    LC_ALL: "C.UTF-8",
    AWS_SECRET_ACCESS_KEY: "do-not-forward",
    GITHUB_TOKEN: "do-not-forward",
    DATABASE_URL: "do-not-forward",
    SOME_SECRET: "do-not-forward"
  });

  assert.deepEqual(sanitized, {
    PATH: "/usr/bin",
    HOME: "/tmp/home",
    USERPROFILE: "C:\\Users\\tester",
    TMPDIR: "/tmp",
    TMP: "/tmp",
    TEMP: "/tmp",
    LANG: "en_US.UTF-8",
    LC_ALL: "C.UTF-8"
  });

  assert.equal(Object.hasOwn(sanitized, "AWS_SECRET_ACCESS_KEY"), false);
  assert.equal(Object.hasOwn(sanitized, "GITHUB_TOKEN"), false);
  assert.equal(Object.hasOwn(sanitized, "DATABASE_URL"), false);
  assert.equal(Object.hasOwn(sanitized, "SOME_SECRET"), false);
});
