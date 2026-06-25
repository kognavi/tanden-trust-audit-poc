'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

const sourceEvidencePath = path.join(projectRoot, 'samples', 'evidence-consent.json');
const expectedHashPath = path.join(projectRoot, 'samples', 'evidence-consent.expected.sha256');
const outputDir = path.join(projectRoot, 'tmp');
const tamperedEvidencePath = path.join(outputDir, 'evidence-consent.tampered.json');
const verifyScriptPath = path.join(projectRoot, 'scripts', 'verify-evidence.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runVerification() {
  return spawnSync(
    process.execPath,
    [verifyScriptPath, tamperedEvidencePath, expectedHashPath],
    {
      cwd: projectRoot,
      encoding: 'utf8'
    }
  );
}

function main() {
  const evidence = readJson(sourceEvidencePath);

  if (!evidence.consent || evidence.consent.status !== 'granted') {
    throw new Error('Expected sample evidence consent.status to be "granted" before tampering.');
  }

  const tamperedEvidence = {
    ...evidence,
    consent: {
      ...evidence.consent,
      status: 'revoked'
    }
  };

  writeJson(tamperedEvidencePath, tamperedEvidence);

  console.log(`Source evidence file: ${path.relative(projectRoot, sourceEvidencePath)}`);
  console.log(`Tampered evidence file: ${path.relative(projectRoot, tamperedEvidencePath)}`);
  console.log('Tamper operation: consent.status changed from "granted" to "revoked"');
  console.log('');

  const result = runVerification();

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;

  if (combinedOutput.includes('Verification result: INVALID')) {
    console.log('Tamper demo result: PASS');
    console.log('Tampering was detected as expected.');
    return;
  }

  console.error('Tamper demo result: FAIL');
  console.error('Expected verification to report INVALID for the tampered evidence file.');
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`Tamper demo failed: ${error.message}`);
  process.exit(1);
}
