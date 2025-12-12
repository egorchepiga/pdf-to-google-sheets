// Offscreen Document for PDF processing and Excel generation
// This runs in a hidden document with DOM access (required for PDF.js and canvas)

import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

// Listen for messages from Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  console.log('Offscreen received:', message.action);

  switch (message.action) {
    case 'parsePdf':
      handleParsePdf(message.data).then(sendResponse);
      return true;

    case 'generateExcel':
      handleGenerateExcel(message.data).then(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Parse PDF and extract tables
 */
async function handleParsePdf(base64Data: string) {
  try {
    console.log(`Offscreen received base64 data: ${base64Data.length} chars`);

    if (!base64Data || base64Data.length === 0) {
      return {
        success: false,
        error: 'The PDF file is empty, i.e. its size is zero bytes.'
      };
    }

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`Converted to Uint8Array: ${bytes.length} bytes`);

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({
      data: bytes
    }).promise;

    console.log(`PDF loaded: ${pdf.numPages} pages`);

    // Extract tables from all pages
    const allTables: string[][] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      // Extract text items with coordinates
      const items = textContent.items.map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width,
        height: item.transform[0]
      }));

      // Extract table from text items
      const table = extractTable(items);

      if (table.length > 0) {
        allTables.push(...table);
      }
    }

    if (allTables.length === 0) {
      return {
        success: false,
        error: 'No tables found in PDF. The document may contain images or scanned content.'
      };
    }

    return {
      success: true,
      tables: allTables
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF parsing failed'
    };
  }
}

/**
 * Extract table from text items based on coordinates
 */
function extractTable(items: Array<{
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>) {
  if (items.length === 0) return [];

  const rowThreshold = 5; // Max Y difference for same row
  const colThreshold = 10; // Min X difference for different column

  // Sort by Y coordinate (top to bottom)
  const sortedItems = [...items].sort((a, b) => a.y - b.y);

  // Group items into rows
  const rows: Array<typeof items> = [];
  let currentRow: typeof items = [];
  let lastY: number | null = null;

  for (const item of sortedItems) {
    if (lastY !== null && Math.abs(item.y - lastY) > rowThreshold) {
      // New row
      rows.push(currentRow.sort((a, b) => a.x - b.x));
      currentRow = [];
    }
    currentRow.push(item);
    lastY = item.y;
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.sort((a, b) => a.x - b.x));
  }

  // Detect column positions
  const allX = rows.flat().map((item) => item.x).sort((a, b) => a - b);
  const columns: number[] = [];

  for (const x of allX) {
    if (columns.length === 0 || x - columns[columns.length - 1] > colThreshold) {
      columns.push(x);
    }
  }

  // Build table
  return rows.map((row) => {
    const tableRow: string[] = new Array(columns.length).fill('');

    for (const item of row) {
      // Find closest column
      let colIdx = 0;
      let minDist = Math.abs(item.x - columns[0]);

      for (let i = 1; i < columns.length; i++) {
        const dist = Math.abs(item.x - columns[i]);
        if (dist < minDist) {
          minDist = dist;
          colIdx = i;
        }
      }

      // Append text to cell (handle multiple text items in same cell)
      tableRow[colIdx] += (tableRow[colIdx] ? ' ' : '') + item.text;
    }

    return tableRow;
  });
}

/**
 * Generate Excel file from table data
 */
async function handleGenerateExcel(data: { filename: string; tables: string[][] }) {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(data.tables);

    // Auto-size columns
    const maxWidths = data.tables[0]?.map((_, colIdx) =>
      Math.max(...data.tables.map((row) => String(row[colIdx] || '').length))
    ) || [];

    ws['!cols'] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 50) }));

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate Excel file
    const wbout = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      compression: true
    });

    // Convert to base64
    const base64 = btoa(
      new Uint8Array(wbout).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return {
      success: true,
      base64: base64,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } catch (error) {
    console.error('Excel generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Excel generation failed'
    };
  }
}

console.log('Offscreen document initialized');
