'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { assertDigest, parseArgs, verify, versionFromReceipt } = require('../scripts/verify-loop-017-deployment-inputs');

test('pre-deploy digest rejects substituted S3 bytes even when the filename is unchanged', () => {
  const approved = Buffer.from('reviewed CodeZip or template bytes');
  const digest = createHash('sha256').update(approved).digest('hex');
  assert.equal(assertDigest('downloaded artifact', approved, digest), digest);
  assert.throws(() => assertDigest('downloaded artifact', Buffer.from('replaced bytes'), digest), /SHA-256 mismatch/);
});

test('pre-deploy provenance requires a concrete S3 version from the same download receipt', () => {
  assert.equal(versionFromReceipt(Buffer.from('{"VersionId":"version123"}'), 'template'), 'version123');
  assert.throws(() => versionFromReceipt(Buffer.from('{"VersionId":"null"}'), 'template'), /non-null VersionId/);
  assert.throws(() => versionFromReceipt(Buffer.from('{}'), 'CodeZip'), /non-null VersionId/);
  assert.throws(() => parseArgs(['--template-file', '/tmp/file']), /reviewed commit/);
});

test('pre-deploy gate binds downloaded S3 bytes to a clean reviewed Git commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'loop017-preflight-'));
  try {
    const spec = join(root, '.kiro/specs/loop-017-live-ai-agent-collector-completion/deployment-authorization');
    mkdirSync(spec, { recursive: true });
    const template = Buffer.from('Runtime-only template without S3 VersionId\n');
    const codeZip = Buffer.from('reviewed ZIP bytes');
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const templateUrl = 'https://s3.ap-northeast-1.amazonaws.com/test-bucket/only-template.yaml';
    writeFileSync(join(spec, 'loop-017-agentcore-initial-create.template.yaml'), template);
    writeFileSync(join(spec, 'one-shot-role-permissions-policy.json'), JSON.stringify({
      Statement: [{ Sid: 'CreateOnlyFrozenRuntimeStack', Condition: {
        StringEquals: { 'cloudformation:TemplateUrl': templateUrl },
        'ForAllValues:StringEquals': { 'cloudformation:ResourceTypes': ['AWS::BedrockAgentCore::Runtime'] },
      } }],
    }));
    writeFileSync(join(spec, 'authorization-provenance.json'), JSON.stringify({ sha256FirstDeployment: {
      readyForApplication: false, templateSha256: digest(template), codeZipSha256: digest(codeZip),
      templateUrl, artifactBucket: 'test-bucket', codeZipKey: 'codezip.zip', templateKey: 'only-template.yaml',
    } }));
    execFileSync('git', ['-C', root, 'init', '-q']);
    execFileSync('git', ['-C', root, 'add', '.']);
    execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'reviewed']);
    const expectedCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const files = {
      codezipFile: join(root, '..', `${root.split('/').pop()}-codezip`),
      templateFile: join(root, '..', `${root.split('/').pop()}-template`),
      codezipReceipt: join(root, '..', `${root.split('/').pop()}-codezip-receipt`),
      templateReceipt: join(root, '..', `${root.split('/').pop()}-template-receipt`),
      expectedCommit,
    };
    try {
      writeFileSync(files.codezipFile, codeZip);
      writeFileSync(files.templateFile, template);
      writeFileSync(files.codezipReceipt, '{"VersionId":"zip-version"}');
      writeFileSync(files.templateReceipt, '{"VersionId":"template-version"}');
      assert.equal(verify(files, root).result, 'PASS');
      assert.throws(() => verify({ ...files, expectedCommit: '0'.repeat(40) }, root), /reviewed commit/);
      writeFileSync(files.templateFile, Buffer.from('substituted S3 template'));
      assert.throws(() => verify(files, root), /downloaded template SHA-256 mismatch/);
      writeFileSync(files.templateFile, template);
      writeFileSync(join(spec, 'one-shot-role-permissions-policy.json'), '{}');
      assert.throws(() => verify(files, root), /working tree must be clean/);
    } finally {
      for (const path of [files.codezipFile, files.templateFile, files.codezipReceipt, files.templateReceipt]) {
        rmSync(path, { force: true });
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
