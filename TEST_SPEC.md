# Test Specification for PDF to Sheet Extension

## Overview
This document describes the test structure and specifications for the PDF parsing and table extraction functionality.

## Test Structure

```
tests/
├── unit/
│   ├── pdf-parsing.test.js      # PDF.js integration tests
│   ├── table-extraction.test.js # Table detection algorithm
│   ├── data-validation.test.js  # Type checking and data validation
│   └── export.test.js            # Export functionality
├── integration/
│   ├── full-workflow.test.js    # End-to-end PDF processing
│   └── ui-interaction.test.js   # User interaction flows
└── fixtures/
    ├── sample-table.pdf          # Simple table PDF
    ├── multi-page.pdf            # Multiple pages with tables
    ├── complex-layout.pdf        # Complex table structures
    ├── scanned-image.pdf         # Image-only PDF (should fail gracefully)
    └── empty.pdf                 # Empty PDF
```

---

## Unit Test Specifications

### 1. PDF Parsing (`parsePdf`)

**Function Signature:**
```typescript
parsePdf(arrayBuffer: ArrayBuffer, method?: ExtractionMethod): Promise<string[][]>
```

**Return Type:**
```typescript
type TableData = string[][]; // 2D array of strings
```

**Test Cases:**

#### 1.1 Valid Text PDF
```javascript
describe('parsePdf - Valid Text PDF', () => {
  test('should return 2D array', async () => {
    const result = await parsePdf(validPdfBuffer);
    expect(Array.isArray(result)).toBe(true);
    expect(Array.isArray(result[0])).toBe(true);
  });

  test('should extract correct number of rows', async () => {
    // PDF with known 5 rows
    const result = await parsePdf(fiveRowPdf);
    expect(result.length).toBe(5);
  });

  test('should extract correct number of columns', async () => {
    // PDF with known 3 columns
    const result = await parsePdf(threeColumnPdf);
    expect(result[0].length).toBe(3);
  });

  test('should return strings in cells', async () => {
    const result = await parsePdf(validPdfBuffer);
    expect(typeof result[0][0]).toBe('string');
  });
});
```

#### 1.2 Empty/Invalid PDFs
```javascript
describe('parsePdf - Error Handling', () => {
  test('should throw error for invalid ArrayBuffer', async () => {
    await expect(parsePdf(null)).rejects.toThrow();
  });

  test('should return empty array for PDF without tables', async () => {
    const result = await parsePdf(emptyPdfBuffer);
    expect(result).toEqual([]);
  });

  test('should handle scanned PDFs gracefully', async () => {
    await expect(parsePdf(scannedPdfBuffer, ExtractionMethod.TEXT))
      .rejects.toThrow('No tables found');
  });
});
```

#### 1.3 Multi-page PDFs
```javascript
describe('parsePdf - Multi-page', () => {
  test('should combine tables from all pages', async () => {
    // PDF with 3 rows on page 1, 2 rows on page 2
    const result = await parsePdf(multiPagePdf);
    expect(result.length).toBe(5);
  });

  test('should maintain table structure across pages', async () => {
    const result = await parsePdf(multiPagePdf);
    expect(result[0].length).toBe(result[1].length);
  });
});
```

---

### 2. Table Extraction (`extractTable`)

**Function Signature:**
```typescript
extractTable(items: TextItem[]): string[][]

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Return Type:**
```typescript
type TableRow = string[];
type TableData = TableRow[];
```

**Test Cases:**

#### 2.1 Row Detection
```javascript
describe('extractTable - Row Detection', () => {
  test('should group items with similar Y coordinates', () => {
    const items = [
      { text: 'A', x: 10, y: 100, width: 10, height: 12 },
      { text: 'B', x: 50, y: 102, width: 10, height: 12 }, // Same row (Y ≈ 100)
      { text: 'C', x: 10, y: 120, width: 10, height: 12 }  // New row
    ];
    const result = extractTable(items);
    expect(result.length).toBe(2); // 2 rows
    expect(result[0].length).toBe(2); // First row has 2 cells
  });

  test('should handle varying row heights', () => {
    // Items with different Y coordinates but close enough
    const items = createItemsWithVaryingY();
    const result = extractTable(items);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

#### 2.2 Column Detection
```javascript
describe('extractTable - Column Detection', () => {
  test('should detect columns from X coordinates', () => {
    const items = [
      { text: 'A1', x: 10, y: 100, width: 10, height: 12 },
      { text: 'B1', x: 50, y: 100, width: 10, height: 12 },
      { text: 'C1', x: 90, y: 100, width: 10, height: 12 }
    ];
    const result = extractTable(items);
    expect(result[0].length).toBe(3); // 3 columns
  });

  test('should merge text in same cell', () => {
    const items = [
      { text: 'Hello', x: 10, y: 100, width: 10, height: 12 },
      { text: 'World', x: 12, y: 100, width: 10, height: 12 } // Same cell
    ];
    const result = extractTable(items);
    expect(result[0][0]).toBe('Hello World');
  });
});
```

#### 2.3 Edge Cases
```javascript
describe('extractTable - Edge Cases', () => {
  test('should handle empty input', () => {
    expect(extractTable([])).toEqual([]);
  });

  test('should handle single item', () => {
    const items = [{ text: 'A', x: 10, y: 10, width: 10, height: 12 }];
    const result = extractTable(items);
    expect(result).toEqual([['A']]);
  });

  test('should handle items with empty text', () => {
    const items = [{ text: '', x: 10, y: 10, width: 10, height: 12 }];
    const result = extractTable(items);
    expect(result[0][0]).toBe('');
  });

  test('should handle missing coordinates', () => {
    const items = [{ text: 'A', x: undefined, y: 10 }];
    expect(() => extractTable(items)).not.toThrow();
  });
});
```

---

### 3. Data Validation (`data-validation.test.js`)

**Test Cases:**

#### 3.1 Type Checking
```javascript
describe('Data Validation - Types', () => {
  test('exportedData should always be 2D string array', () => {
    expect(Array.isArray(exportedData)).toBe(true);
    expect(exportedData.every(row => Array.isArray(row))).toBe(true);
    expect(
      exportedData.every(row =>
        row.every(cell => typeof cell === 'string')
      )
    ).toBe(true);
  });

  test('should handle non-string values gracefully', () => {
    const input = [[1, 2], [null, undefined]];
    const normalized = normalizeTableData(input);
    expect(normalized).toEqual([['1', '2'], ['', '']]);
  });
});
```

#### 3.2 Data Consistency
```javascript
describe('Data Validation - Consistency', () => {
  test('all rows should have same column count', () => {
    const colCount = exportedData[0].length;
    expect(
      exportedData.every(row => row.length === colCount)
    ).toBe(true);
  });

  test('should pad short rows', () => {
    const input = [['A', 'B', 'C'], ['X', 'Y']];
    const normalized = normalizeTableData(input);
    expect(normalized[1]).toEqual(['X', 'Y', '']);
  });
});
```

---

### 4. Export Functionality (`export.test.js`)

**Test Cases:**

#### 4.1 CSV Export
```javascript
describe('Export - CSV', () => {
  test('should generate valid CSV string', () => {
    const data = [['A', 'B'], ['C', 'D']];
    const csv = generateCSV(data);
    expect(csv).toBe('A,B\nC,D');
  });

  test('should escape commas in values', () => {
    const data = [['A,B', 'C']];
    const csv = generateCSV(data);
    expect(csv).toContain('"A,B"');
  });

  test('should escape quotes', () => {
    const data = [['A"B', 'C']];
    const csv = generateCSV(data);
    expect(csv).toContain('A""B');
  });

  test('should add UTF-8 BOM', () => {
    const data = [['А', 'Б']]; // Cyrillic
    const csv = generateCSV(data);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});
```

#### 4.2 Excel Export
```javascript
describe('Export - Excel', () => {
  test('should create valid Blob', () => {
    const blob = generateExcelBlob(exportedData);
    expect(blob instanceof Blob).toBe(true);
    expect(blob.type).toContain('spreadsheet');
  });

  test('should preserve column widths', () => {
    const data = [['Short', 'Very Long Column Name']];
    // Would need SheetJS integration to test
  });
});
```

---

## Integration Test Specifications

### 5. Full Workflow (`full-workflow.test.js`)

```javascript
describe('Integration - Full PDF Processing', () => {
  test('should process PDF from upload to export', async () => {
    // 1. Upload PDF
    const file = createMockPdfFile();
    await handleFile(file);

    // 2. Verify data extracted
    expect(exportedData.length).toBeGreaterThan(0);

    // 3. Export to CSV
    exportFormat = 'csv';
    const csv = generateCSV(exportedData);
    expect(csv).toBeTruthy();

    // 4. Verify downloadable
    expect(() => downloadFile()).not.toThrow();
  });

  test('should handle errors gracefully throughout workflow', async () => {
    const invalidFile = createInvalidFile();
    await expect(handleFile(invalidFile))
      .rejects.toThrow();

    // UI should reset
    expect(uploadSection.style.display).not.toBe('none');
  });
});
```

---

## Mock Data Specifications

### PDF Mock Data
```javascript
// Mock PDF with 3x3 table
const mockPdf3x3 = {
  numPages: 1,
  getPage: () => ({
    getTextContent: () => ({
      items: [
        { str: 'Name', transform: [12, 0, 0, 12, 10, 100], width: 30 },
        { str: 'Age', transform: [12, 0, 0, 12, 50, 100], width: 20 },
        { str: 'City', transform: [12, 0, 0, 12, 80, 100], width: 30 },
        { str: 'John', transform: [12, 0, 0, 12, 10, 80], width: 30 },
        { str: '30', transform: [12, 0, 0, 12, 50, 80], width: 20 },
        { str: 'NYC', transform: [12, 0, 0, 12, 80, 80], width: 30 }
      ]
    }),
    getViewport: () => ({ height: 200 })
  })
};
```

### Expected Outputs
```javascript
const expectedTable3x3 = [
  ['Name', 'Age', 'City'],
  ['John', '30', 'NYC']
];
```

---

## Test Coverage Requirements

### Minimum Coverage
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 85%
- **Lines**: 80%

### Critical Paths (100% coverage required)
- PDF parsing (`parsePdf`, `parsePdfText`)
- Table extraction (`extractTable`)
- Export generation (`generateCSV`, `downloadFile`)
- Error handling (all catch blocks)

---

## Testing Tools Recommendations

- **Framework**: Jest or Mocha
- **Assertions**: Chai or Jest matchers
- **Mocking**: Sinon.js for PDF.js
- **Coverage**: Istanbul/NYC
- **E2E**: Playwright or Cypress

---

## Performance Benchmarks

### Expected Performance
- **Small PDF** (1 page, <100 rows): < 500ms
- **Medium PDF** (5 pages, <1000 rows): < 2s
- **Large PDF** (20 pages, <5000 rows): < 10s

### Memory Limits
- **Peak memory**: < 100MB for typical PDFs
- **Leak detection**: No memory increase after reset()

---

## Future Test Additions (OCR Support)

```javascript
describe('OCR Integration - Future', () => {
  test('should detect scanned PDFs', async () => {
    const result = await detectPdfType(scannedPdf);
    expect(result).toBe('scanned');
  });

  test('should fallback to OCR for image-only PDFs', async () => {
    const result = await parsePdf(scannedPdf, ExtractionMethod.HYBRID);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should prefer text over OCR when available', async () => {
    const startTime = Date.now();
    await parsePdf(textPdf, ExtractionMethod.HYBRID);
    const duration = Date.now() - startTime;

    // Text extraction should be faster than OCR
    expect(duration).toBeLessThan(1000);
  });
});
```

---

## Notes

1. **Type Safety**: Use TypeScript for better type checking in tests
2. **Fixtures**: Keep PDF fixtures small (<1MB) for fast CI/CD
3. **Flakiness**: Avoid timing-dependent assertions
4. **Isolation**: Each test should be independent
5. **Documentation**: Update this spec when adding new features
