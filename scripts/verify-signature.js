const fs = require('node:fs');
const {
  loadEvidenceFromFile,
  verifyEvidenceSignature,
} = require('../lib/signature');

const evidenceFilePath = process.argv[2] || 'samples/evidence-consent.json';
const signaturePath = process.argv[3] || 'signatures/evidence-consent.sig';
const publicKeyPath = process.argv[4] || '.local-keys/public.pem';

(async () => {
  try {
    if (!fs.existsSync(evidenceFilePath)) {
      console.error(`Evidence file not found: ${evidenceFilePath}`);
      process.exit(1);
    }

    if (!fs.existsSync(signaturePath)) {
      console.error(`Signature file not found: ${signaturePath}`);
      console.error('Run `npm run sign` first.');
      process.exit(1);
    }

    if (!fs.existsSync(publicKeyPath)) {
      console.error(`Public key not found: ${publicKeyPath}`);
      console.error('Run `npm run generate:keys` first.');
      process.exit(1);
    }

    const evidence = loadEvidenceFromFile(evidenceFilePath);
    const signature = fs.readFileSync(signaturePath);
    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');

    const result = await verifyEvidenceSignature(evidence, signature, publicKeyPem);

    console.log(`Evidence file: ${evidenceFilePath}`);
    console.log(`Signature file: ${signaturePath}`);
    console.log(`Canonicalization: ${result.canonicalization}`);
    console.log(`Hash algorithm: ${result.hashAlgorithm}`);
    console.log(`Digest: ${result.digestHex}`);
    console.log(`Signature algorithm: ${result.signatureAlgorithm}`);
    console.log(`Verification result: ${result.valid ? 'VALID' : 'INVALID'}`);

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('Failed to verify evidence signature.');
    console.error(error.message);
    process.exit(1);
  }
})();
