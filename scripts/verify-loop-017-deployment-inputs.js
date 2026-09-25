#!/usr/bin/env node
'use strict';

// Read-only, offline verification of files downloaded by separately approved
// `aws s3api get-object` commands. This script never invokes AWS.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const SPEC = '.kiro/specs/loop-017-live-ai-agent-collector-completion/deployment-authorization';
const MANIFEST = `${SPEC}/authorization-provenance.json`;
const POLICY = `${SPEC}/one-shot-role-permissions-policy.json`;
const TEMPLATE = `${SPEC}/loop-017-agentcore-initial-create.template.yaml`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertDigest(label, bytes, expected) {
  const actual = sha256(bytes);
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expected}, got ${actual}`);
  }
  return actual;
}

function versionFromReceipt(bytes, label) {
  const receipt = JSON.parse(bytes);
  if (typeof receipt.VersionId !== 'string' ||
      !receipt.VersionId.trim() || receipt.VersionId === 'null') {
    throw new Error(`${label} S3 get-object receipt has no non-null VersionId`);
  }
  return receipt.VersionId;
}

function committedFile(repoRoot, relativePath) {
  return execFileSync('git', ['-C', repoRoot, 'show', `HEAD:${relativePath}`], {
    maxBuffer: 8 * 1024 * 1024,
  });
}

function verify(options, repoRoot = join(__dirname, '..')) {
  const status = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' });
  if (status.trim()) throw new Error('Git working tree must be clean before pre-deploy verification');
  const gitCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(options.expectedCommit) || gitCommit !== options.expectedCommit) {
    throw new Error('Git HEAD differs from the independently reviewed commit SHA-1');
  }

  const manifestBytes = committedFile(repoRoot, MANIFEST);
  const manifest = JSON.parse(manifestBytes);
  const expected = manifest.sha256FirstDeployment;
  if (!expected || expected.readyForApplication !== false) {
    throw new Error('Reviewed SHA-256-first deployment provenance is missing or approval boundary changed');
  }
  assertDigest('local provenance', readFileSync(join(repoRoot, MANIFEST)), sha256(manifestBytes));

  const template = committedFile(repoRoot, TEMPLATE);
  assertDigest('committed template', template, expected.templateSha256);
  assertDigest('local template', readFileSync(join(repoRoot, TEMPLATE)), expected.templateSha256);
  const policyBytes = committedFile(repoRoot, POLICY);
  assertDigest('local IAM policy', readFileSync(join(repoRoot, POLICY)), sha256(policyBytes));
  const policy = JSON.parse(policyBytes);
  const create = policy.Statement.find((statement) => statement.Sid === 'CreateOnlyFrozenRuntimeStack');
  if (create?.Condition?.StringEquals?.['cloudformation:TemplateUrl'] !== expected.templateUrl ||
      create?.Condition?.['ForAllValues:StringEquals']?.['cloudformation:ResourceTypes']?.join(',') !==
        'AWS::BedrockAgentCore::Runtime') {
    throw new Error('IAM TemplateUrl or ResourceTypes diverges from committed review');
  }
  if (template.includes(Buffer.from('VersionId:')) || expected.templateUrl.includes('?')) {
    throw new Error('Version-specific deployment input reintroduced');
  }

  const codeZipSha256 = assertDigest('downloaded CodeZip', readFileSync(options.codezipFile), expected.codeZipSha256);
  const templateSha256 = assertDigest('downloaded template', readFileSync(options.templateFile), expected.templateSha256);
  const codeZipVersionId = versionFromReceipt(readFileSync(options.codezipReceipt), 'CodeZip');
  const templateVersionId = versionFromReceipt(readFileSync(options.templateReceipt), 'template');

  return {
    result: 'PASS',
    gitCommit,
    bucket: expected.artifactBucket,
    codeZip: { key: expected.codeZipKey, versionId: codeZipVersionId, sha256: codeZipSha256 },
    template: { key: expected.templateKey, versionId: templateVersionId, sha256: templateSha256 },
    templateUrl: expected.templateUrl,
  };
}

function parseArgs(argv) {
  const names = new Map([
    ['--codezip-file', 'codezipFile'],
    ['--codezip-receipt', 'codezipReceipt'],
    ['--template-file', 'templateFile'],
    ['--template-receipt', 'templateReceipt'],
    ['--expected-commit', 'expectedCommit'],
  ]);
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = names.get(argv[i]);
    if (!name || !argv[i + 1] || options[name]) throw new Error('Provide four file/receipt paths and independently reviewed commit exactly once');
    options[name] = argv[i + 1];
  }
  if (Object.keys(options).length !== names.size) throw new Error('Provide four file/receipt paths and independently reviewed commit');
  return options;
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(verify(parseArgs(process.argv.slice(2)), join(__dirname, '..')), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Loop 017 pre-deploy verification FAIL: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertDigest, parseArgs, verify, versionFromReceipt };
