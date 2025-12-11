// Automated build verification test
const fs = require('fs');
const path = require('path');

console.log('🧪 Running build verification tests...\n');

const distPath = path.join(__dirname, 'dist');
const requiredFiles = [
  'manifest.json',
  'pdf.worker.min.js',
  'service-worker-loader.js',
  'src/popup/popup.html',
  'src/offscreen/offscreen.html'
];

let passed = 0;
let failed = 0;

// Test 1: Check dist directory exists
console.log('📁 Test 1: Checking dist/ directory...');
if (fs.existsSync(distPath)) {
  console.log('✅ PASS: dist/ directory exists\n');
  passed++;
} else {
  console.log('❌ FAIL: dist/ directory not found\n');
  failed++;
  process.exit(1);
}

// Test 2: Check required files
console.log('📄 Test 2: Checking required files...');
requiredFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ PASS: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${file} not found`);
    failed++;
  }
});
console.log('');

// Test 3: Check manifest.json is valid JSON
console.log('🔍 Test 3: Validating manifest.json...');
try {
  const manifestPath = path.join(distPath, 'manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  if (manifest.manifest_version === 3) {
    console.log('✅ PASS: Manifest V3 detected');
    passed++;
  } else {
    console.log('❌ FAIL: Wrong manifest version');
    failed++;
  }

  if (manifest.background && manifest.background.service_worker) {
    console.log('✅ PASS: Service worker configured');
    passed++;
  } else {
    console.log('❌ FAIL: Service worker not configured');
    failed++;
  }

  console.log('');
} catch (error) {
  console.log(`❌ FAIL: ${error.message}\n`);
  failed++;
}

// Test 4: Check assets directory
console.log('🎨 Test 4: Checking compiled assets...');
const assetsPath = path.join(distPath, 'assets');
if (fs.existsSync(assetsPath)) {
  const assetFiles = fs.readdirSync(assetsPath);
  const jsFiles = assetFiles.filter(f => f.endsWith('.js'));
  const cssFiles = assetFiles.filter(f => f.endsWith('.css'));

  console.log(`✅ PASS: Found ${jsFiles.length} JS files`);
  console.log(`✅ PASS: Found ${cssFiles.length} CSS files`);
  passed += 2;
} else {
  console.log('❌ FAIL: assets/ directory not found');
  failed++;
}
console.log('');

// Summary
console.log('═══════════════════════════════════════');
console.log(`📊 Test Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total:  ${passed + failed}`);
console.log('═══════════════════════════════════════\n');

if (failed === 0) {
  console.log('🎉 All tests passed! Extension is ready for testing in Chrome.');
  console.log('\nNext steps:');
  console.log('1. Open chrome://extensions');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select the dist/ folder');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the build.');
  process.exit(1);
}
