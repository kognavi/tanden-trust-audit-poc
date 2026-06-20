const fs = require('node:fs');
const path = require('node:path');
const { generateEcKeyPair } = require('../lib/signature');

const keyDir = path.join(process.cwd(), '.local-keys');
const privateKeyPath = path.join(keyDir, 'private.pem');
const publicKeyPath = path.join(keyDir, 'public.pem');

fs.mkdirSync(keyDir, { recursive: true });

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.error('Local keys already exist.');
  console.error(`Private key: ${privateKeyPath}`);
  console.error(`Public key: ${publicKeyPath}`);
  console.error('Delete them manually if you want to regenerate keys.');
  process.exit(1);
}

const { privateKey, publicKey } = generateEcKeyPair();

fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

console.log('Local ECDSA P-256 key pair generated.');
console.log(`Private key: ${privateKeyPath}`);
console.log(`Public key: ${publicKeyPath}`);
console.log('');
console.log('Important: .local-keys/ is for local demonstration only and must not be committed.');
