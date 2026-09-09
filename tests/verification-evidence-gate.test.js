const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createEvidenceDocument,
  parseSecurityReview,
  validateVerificationEvidenceGate,
  verifyEvidenceDocument
} = require("../scripts/run-verification-evidence-gate");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verification-evidence-"));
  try {
    const specDir = path.join(root, ".kiro", "specs", "feature");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(
      path.join(specDir, "agent-delegation.json"),
      JSON.stringify({
        schemaVersion: 1,
        feature: "feature",
        generatedAt: "2026-09-09T00:00:00.000Z",
        roles: {
          builder: "builder-agent",
          reviewer: "reviewer-agent",
          securityReviewer: null
        }
      }, null, 2) + "\n"
    );
    fs.writeFileSync(
      path.join(specDir, "reviewer-review.md"),
      "# Reviewer Review\n\n- Status: PASS\n- Reviewed by: reviewer-agent\n"
    );
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function conformant(overrides = {}) {
  return {
    conformant: true,
    errors: [],
    changedFiles: ["lib/feature.js", "tests/feature.test.js"],
    sensitiveFiles: [],
    sourceContext: "knowledge/20-research/context-packs/feature-context.md",
    contextId: "context-pack-feature",
    specDir: ".kiro/specs/feature",
    ...overrides
  };
}

test("evidence document digest verifies and detects tamper", () => {
  const document = createEvidenceDocument({ feature: "feature", status: "PASS" });
  assert.equal(verifyEvidenceDocument(document), true);
  document.payload.status = "FAIL";
  assert.equal(verifyEvidenceDocument(document), false);
});

test("parseSecurityReview reads PASS and reviewer", () => {
  const review = parseSecurityReview([
    "# Security Review",
    "",
    "- Status: PASS",
    "- Reviewed by: codex-security"
  ].join("\n"));

  assert.deepEqual(review, {
    status: "PASS",
    reviewedBy: "codex-security"
  });
});

test("conformance and structure PASS generate evidence pack", () =>
  fixture((root) => {
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant(),
      structureResult: {
        passed: true,
        command: "npm run check:structure",
        output: "ok"
      },
      now: "2026-09-09T00:00:00.000Z"
    });

    assert.equal(result.verified, true);
    assert.equal(fs.existsSync(result.outputPath), true);
    assert.equal(result.evidence.payload.status, "PASS");
    assert.equal(result.evidence.payload.checks.implementationConformance, "PASS");
    assert.equal(result.evidence.payload.checks.structureValidation, "PASS");
    assert.equal(result.evidence.payload.checks.reviewerReview, "PASS");
    assert.equal(result.evidence.payload.roles.builder, "builder-agent");
    assert.equal(result.evidence.payload.roles.reviewer, "reviewer-agent");
    assert.equal(verifyEvidenceDocument(result.evidence), true);
  }));

test("conformance failure blocks verification before structure validation", () =>
  fixture((root) => {
    let structureCalled = false;
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: {
        conformant: false,
        errors: ["out of scope"]
      },
      structureRunner: () => {
        structureCalled = true;
        return { passed: true };
      }
    });

    assert.equal(result.verified, false);
    assert.equal(structureCalled, false);
    assert.ok(result.errors.some((error) => error.includes("Conformance")));
  }));

test("structure failure blocks evidence pack", () =>
  fixture((root) => {
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant(),
      structureResult: {
        passed: false,
        command: "npm run check:structure",
        output: "failed"
      }
    });

    assert.equal(result.verified, false);
    assert.ok(result.errors.some((error) => error.includes("check:structure")));
    assert.equal(
      fs.existsSync(path.join(root, ".kiro", "specs", "feature", "verification-evidence.json")),
      false
    );
  }));

test("sensitive changes require security review evidence", () =>
  fixture((root) => {
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant({
        changedFiles: ["infra/main.tf"],
        sensitiveFiles: ["infra/main.tf"]
      }),
      structureResult: { passed: true, command: "npm run check:structure", output: "ok" }
    });

    assert.equal(result.verified, false);
    assert.ok(result.errors.some((error) => error.includes("security-review.md")));
  }));

test("sensitive changes pass with explicit security review", () =>
  fixture((root) => {
    const specDir = path.join(root, ".kiro", "specs", "feature");
    fs.writeFileSync(
      path.join(specDir, "agent-delegation.json"),
      JSON.stringify({
        schemaVersion: 1,
        feature: "feature",
        generatedAt: "2026-09-09T00:00:00.000Z",
        roles: {
          builder: "builder-agent",
          reviewer: "reviewer-agent",
          securityReviewer: "codex-security"
        }
      }, null, 2) + "\n"
    );
    fs.writeFileSync(
      path.join(specDir, "security-review.md"),
      "# Security Review\n\n- Status: PASS\n- Reviewed by: codex-security\n"
    );

    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant({
        changedFiles: ["infra/main.tf"],
        sensitiveFiles: ["infra/main.tf"]
      }),
      structureResult: { passed: true, command: "npm run check:structure", output: "ok" },
      now: "2026-09-09T00:00:00.000Z"
    });

    assert.equal(result.verified, true);
    assert.equal(result.evidence.payload.checks.securityReview, "PASS");
    assert.equal(result.evidence.payload.securityReview.reviewedBy, "codex-security");
  }));


test("missing reviewer review blocks verification", () =>
  fixture((root) => {
    fs.unlinkSync(path.join(root, ".kiro", "specs", "feature", "reviewer-review.md"));
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant(),
      structureResult: { passed: true, command: "npm run check:structure", output: "ok" }
    });
    assert.equal(result.verified, false);
    assert.ok(result.errors.some((error) => error.includes("reviewer-review.md is missing")));
  }));

test("reviewer identity mismatch blocks verification", () =>
  fixture((root) => {
    fs.writeFileSync(
      path.join(root, ".kiro", "specs", "feature", "reviewer-review.md"),
      "# Reviewer Review\n\n- Status: PASS\n- Reviewed by: builder-agent\n"
    );
    const result = validateVerificationEvidenceGate(root, "feature", {
      conformanceResult: conformant(),
      structureResult: { passed: true, command: "npm run check:structure", output: "ok" }
    });
    assert.equal(result.verified, false);
    assert.ok(result.errors.some((error) => error.includes("delegated reviewer identity")));
  }));
