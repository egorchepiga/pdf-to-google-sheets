// Convert .pem private key to base64 for manifest.json
const fs = require('fs');
const path = require('path');

// Usage: node scripts/convert-key.js path/to/key.pem

const pemPath = process.argv[2];

if (!pemPath) {
  console.error('Usage: node scripts/convert-key.js path/to/key.pem');
  process.exit(1);
}

try {
  const pemContent = fs.readFileSync(pemPath, 'utf8');

  // Remove header/footer and newlines
  const base64Key = pemContent
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  console.log('\n✅ Add this to manifest.json:\n');
  console.log(JSON.stringify({ key: base64Key }, null, 2));

  console.log('\n📋 Or copy just the value:\n');
  console.log(base64Key);

} catch (error) {
  console.error('❌ Error reading .pem file:', error.message);
  process.exit(1);
}
