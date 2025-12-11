// Generate test PDF files with various table structures
const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');

// Ensure fixtures directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

/**
 * Generate simple 3x3 table PDF
 */
function generateSimple3x3() {
  const doc = new jsPDF();

  doc.setFontSize(12);
  doc.text('Simple 3x3 Table', 20, 20);

  // Table data
  const headers = ['Name', 'Age', 'City'];
  const data = [
    ['John Doe', '30', 'New York'],
    ['Jane Smith', '25', 'Los Angeles'],
    ['Bob Johnson', '35', 'Chicago']
  ];

  // Draw table
  let y = 40;
  const colWidths = [60, 30, 60];
  const rowHeight = 10;

  // Header row
  let x = 20;
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Data rows
  data.forEach(row => {
    x = 20;
    row.forEach((cell, i) => {
      doc.text(cell, x, y);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.save(path.join(fixturesDir, 'simple-3x3.pdf'));
  console.log('✓ Generated: simple-3x3.pdf');
}

/**
 * Generate table with many columns (10 columns)
 */
function generateWideTable() {
  const doc = new jsPDF({
    orientation: 'landscape'
  });

  doc.setFontSize(10);
  doc.text('Wide Table (10 Columns)', 20, 20);

  const headers = ['ID', 'Name', 'Email', 'Phone', 'City', 'State', 'Zip', 'Country', 'Age', 'Status'];
  const data = [
    ['1', 'John', 'john@email.com', '555-0123', 'NYC', 'NY', '10001', 'USA', '30', 'Active'],
    ['2', 'Jane', 'jane@email.com', '555-0456', 'LA', 'CA', '90001', 'USA', '25', 'Active'],
    ['3', 'Bob', 'bob@email.com', '555-0789', 'Chicago', 'IL', '60601', 'USA', '35', 'Inactive']
  ];

  let y = 40;
  const colWidth = 25;
  const rowHeight = 8;

  // Header
  let x = 20;
  headers.forEach(header => {
    doc.text(header, x, y);
    x += colWidth;
  });

  y += rowHeight;

  // Data
  data.forEach(row => {
    x = 20;
    row.forEach(cell => {
      doc.text(cell, x, y);
      x += colWidth;
    });
    y += rowHeight;
  });

  doc.save(path.join(fixturesDir, 'wide-table.pdf'));
  console.log('✓ Generated: wide-table.pdf');
}

/**
 * Generate table with many rows (50 rows)
 */
function generateLongTable() {
  const doc = new jsPDF();

  doc.setFontSize(10);
  doc.text('Long Table (50 Rows)', 20, 20);

  const headers = ['ID', 'Product', 'Price', 'Quantity'];
  const colWidths = [20, 80, 30, 30];
  const rowHeight = 6;
  let y = 35;

  // Header
  let x = 20;
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Generate 50 rows
  for (let i = 1; i <= 50; i++) {
    // Add new page if needed
    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    x = 20;
    const row = [
      String(i),
      `Product ${i}`,
      `$${(Math.random() * 100).toFixed(2)}`,
      String(Math.floor(Math.random() * 100))
    ];

    row.forEach((cell, idx) => {
      doc.text(cell, x, y);
      x += colWidths[idx];
    });

    y += rowHeight;
  }

  doc.save(path.join(fixturesDir, 'long-table.pdf'));
  console.log('✓ Generated: long-table.pdf');
}

/**
 * Generate table with special characters
 */
function generateSpecialChars() {
  const doc = new jsPDF();

  doc.setFontSize(12);
  doc.text('Special Characters Table', 20, 20);

  const headers = ['Name', 'Description', 'Price'];
  const data = [
    ['Product A', 'High-quality, eco-friendly', '$99.99'],
    ['Product "B"', 'Contains: milk, eggs', '$49.50'],
    ['Product C', 'Size: 10" x 12"', '$75.00'],
    ['Product D', 'Rating: 4.5★', '$120.00']
  ];

  let y = 40;
  const colWidths = [40, 80, 30];
  const rowHeight = 10;

  // Header
  let x = 20;
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Data
  data.forEach(row => {
    x = 20;
    row.forEach((cell, i) => {
      doc.text(cell, x, y);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.save(path.join(fixturesDir, 'special-chars.pdf'));
  console.log('✓ Generated: special-chars.pdf');
}

/**
 * Generate multi-page table
 */
function generateMultiPage() {
  const doc = new jsPDF();

  doc.setFontSize(12);

  // Page 1
  doc.text('Multi-Page Table - Page 1', 20, 20);

  const headers = ['ID', 'Name', 'Value'];
  const colWidths = [20, 80, 40];
  const rowHeight = 10;

  let y = 40;
  let x = 20;

  // Header on page 1
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Rows on page 1
  for (let i = 1; i <= 10; i++) {
    x = 20;
    [`${i}`, `Item ${i}`, `$${i * 10}`].forEach((cell, idx) => {
      doc.text(cell, x, y);
      x += colWidths[idx];
    });
    y += rowHeight;
  }

  // Page 2
  doc.addPage();
  doc.text('Multi-Page Table - Page 2', 20, 20);

  y = 40;
  x = 20;

  // Header on page 2
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Rows on page 2
  for (let i = 11; i <= 20; i++) {
    x = 20;
    [`${i}`, `Item ${i}`, `$${i * 10}`].forEach((cell, idx) => {
      doc.text(cell, x, y);
      x += colWidths[idx];
    });
    y += rowHeight;
  }

  doc.save(path.join(fixturesDir, 'multi-page.pdf'));
  console.log('✓ Generated: multi-page.pdf');
}

/**
 * Generate empty PDF (no tables)
 */
function generateEmpty() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Empty PDF', 20, 20);
  doc.setFontSize(12);
  doc.text('This PDF contains no tables.', 20, 40);
  doc.text('It should return an empty result.', 20, 50);

  doc.save(path.join(fixturesDir, 'empty.pdf'));
  console.log('✓ Generated: empty.pdf');
}

/**
 * Generate table with varying column alignment
 */
function generateMisaligned() {
  const doc = new jsPDF();

  doc.setFontSize(12);
  doc.text('Misaligned Table (Testing Column Detection)', 20, 20);

  // Intentionally misalign columns slightly
  const data = [
    { x: 20, y: 40, text: 'Name' },
    { x: 70, y: 40, text: 'Age' },
    { x: 120, y: 40, text: 'City' },

    { x: 22, y: 50, text: 'John' },    // Slightly offset
    { x: 68, y: 50, text: '30' },      // Slightly offset
    { x: 118, y: 50, text: 'NYC' },    // Slightly offset

    { x: 20, y: 60, text: 'Jane' },
    { x: 72, y: 60, text: '25' },      // Slightly offset
    { x: 122, y: 60, text: 'LA' }      // Slightly offset
  ];

  data.forEach(item => {
    doc.text(item.text, item.x, item.y);
  });

  doc.save(path.join(fixturesDir, 'misaligned.pdf'));
  console.log('✓ Generated: misaligned.pdf');
}

/**
 * Generate table with numeric data
 */
function generateNumeric() {
  const doc = new jsPDF();

  doc.setFontSize(12);
  doc.text('Numeric Data Table', 20, 20);

  const headers = ['Month', 'Revenue', 'Expenses', 'Profit'];
  const data = [
    ['January', '125,000.50', '85,000.25', '39,999.75'],
    ['February', '132,500.00', '88,250.50', '44,249.50'],
    ['March', '145,750.25', '92,100.00', '53,650.25'],
    ['April', '138,900.75', '89,500.75', '49,400.00']
  ];

  let y = 40;
  const colWidths = [40, 40, 40, 40];
  const rowHeight = 10;

  // Header
  let x = 20;
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  y += rowHeight;

  // Data
  data.forEach(row => {
    x = 20;
    row.forEach((cell, i) => {
      doc.text(cell, x, y);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.save(path.join(fixturesDir, 'numeric.pdf'));
  console.log('✓ Generated: numeric.pdf');
}

// Generate all test PDFs
console.log('Generating test PDF files...\n');

generateSimple3x3();
generateWideTable();
generateLongTable();
generateSpecialChars();
generateMultiPage();
generateEmpty();
generateMisaligned();
generateNumeric();

console.log('\n✅ All test PDFs generated successfully!');
console.log(`Location: ${fixturesDir}`);
