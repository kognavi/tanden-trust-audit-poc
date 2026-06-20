const fs = require('node:fs');
const path = require('node:path');
const {
  loadEvidenceFromFile,
  signEvidence,
} = require('../lib/signature');

const evidenceFilePath = process.argv[2] || 'samples/evidence-consent.json';
const privateKeyPath = process.argv[3] || '.local-keys/private.pem';
const signatureOutputPath = process.argv[4] || 'signatures/evidence-consent.sig';

(async () => {
  try {
    if (!fs.existsSync(evidenceFilePath)) {
      console.error(`Evidence file not found: ${evidenceFilePath}`);
      process.exit(1);
    }

    if (!fs.existsSync(privateKeyPath)) {
      console.error(`Private key not found: ${privateKeyPath}`);
      console.error('Run `npm run generate:keys` first.');
      process.exit(1);
    }

    const evidence = loadEvidenceFromFile(evidenceFilePath);
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    const result = await signEvidence(evidence, privateKeyPem);

    fs.mkdirSync(path.dirname(signatureOutputPath), { recursive: true });
    fs.writeFileSync(signatureOutputPath, result.signature);

    console.log(`Evidence file: ${evidenceFilePath}`);
    console.log(`Canonicalization: ${result.canonicalization}`);
    console.log(`Hash algorithm: ${result.hashAlgorithm}`);
    console.log(`Digest: ${result.digestHex}`);
    console.log(`Signature algorithm: ${result.signatureAlgorithm}`);
    console.log(`Signature file: ${signatureOutputPath}`);
    console.log(`Signature base64: ${result.signatureBase64}`);
    console.log('Signing result: SIGNED');
  } catch (error) {
    console.error('Failed to sign evidence.');
    console.error(error.message);
    process.exit(1);
  }
})();
