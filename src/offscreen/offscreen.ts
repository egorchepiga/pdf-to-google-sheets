// Offscreen Document for PDF processing and Excel generation
// This runs in a hidden document with DOM access (required for PDF.js and canvas)

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import * as XLSX from 'xlsx';
import { extractTable } from '../lib/table-extractor';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

// Development mode check (replaced at build time)
const isDev = import.meta.env.DEV;

// Utility function for conditional error logging
function logError(context: string, error: unknown) {
  if (isDev) {
    console.error(`[DEV] ${context}:`, error);
  }
  // In production, errors are only returned to user in sanitized form
}

// Listen for messages from Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender origin
  if (!sender.id || sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Invalid sender' });
    return;
  }

  // Only process messages targeted to offscreen
  if (message.target !== 'offscreen') return;

  // Validate message structure
  if (!message || typeof message.action !== 'string') {
    sendResponse({ success: false, error: 'Invalid message format' });
    return;
  }

  switch (message.action) {
    case 'parsePdf':
      // Validate data type
      if (typeof message.data !== 'string' || !message.data) {
        sendResponse({ success: false, error: 'Invalid PDF data' });
        return;
      }
      handleParsePdf(message.data).then(sendResponse);
      return true;

    case 'generateExcel':
      // Validate data structure
      if (!message.data ||
          typeof message.data.filename !== 'string' ||
          !Array.isArray(message.data.tables)) {
        sendResponse({ success: false, error: 'Invalid export data' });
        return;
      }
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

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({
      data: bytes
    }).promise;

    // Extract tables from all pages
    const allTables: string[][] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      // Extract text items with coordinates
      type ExtractedItem = {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };

      const items: ExtractedItem[] = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => ({
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
    logError('PDF parsing error', error);
    return {
      success: false,
      error: 'Unable to parse PDF. The file may be corrupted or contain unsupported content.'
    };
  }
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
    logError('Excel generation error', error);
    return {
      success: false,
      error: 'Unable to generate Excel file. Please try again.'
    };
  }
}
