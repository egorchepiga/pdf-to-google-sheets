// Service Worker for PDF to Sheet Extension (Manifest V3)

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service Worker received message:', message.action);

  switch (message.action) {
    case 'processPdf':
      handleProcessPdf(message.data).then(sendResponse);
      return true; // Indicates async response

    case 'exportToSheets':
      handleExportToSheets(message.data).then(sendResponse);
      return true;

    case 'exportToExcel':
      handleExportToExcel(message.data).then(sendResponse);
      return true;

    case 'exportToCsv':
      handleExportToCsv(message.data).then(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Process PDF file using Offscreen Document
 */
async function handleProcessPdf(base64Data: string) {
  try {
    console.log(`Service Worker received base64 data: ${base64Data.length} chars`);

    if (!base64Data || base64Data.length === 0) {
      return {
        success: false,
        error: 'The PDF file is empty, i.e. its size is zero bytes.'
      };
    }

    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    // Send base64 data directly to offscreen (don't convert here!)
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'parsePdf',
      data: base64Data
    });

    return response;
  } catch (error) {
    console.error('PDF processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF processing failed'
    };
  }
}

/**
 * Export data to Google Sheets
 */
async function handleExportToSheets(data: { title: string; tables: string[][] }) {
  try {
    // Get OAuth token
    const token = await getAuthToken();

    // Create spreadsheet
    const url = await createGoogleSheet(token, data.title, data.tables);

    return { success: true, url };
  } catch (error) {
    console.error('Sheets export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export to Sheets failed'
    };
  }
}

/**
 * Export data to Excel file
 */
async function handleExportToExcel(data: { filename: string; tables: string[][] }) {
  try {
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'generateExcel',
      data
    });

    if (response.success) {
      // Create data URL from base64
      const dataUrl = `data:${response.mimeType};base64,${response.base64}`;

      // Download using chrome.downloads API
      await chrome.downloads.download({
        url: dataUrl,
        filename: data.filename,
        saveAs: true
      });

      return { success: true };
    }

    return response;
  } catch (error) {
    console.error('Excel export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Excel export failed'
    };
  }
}

/**
 * Export data to CSV file
 */
async function handleExportToCsv(data: { filename: string; tables: string[][] }) {
  try {
    const csvContent = generateCSV(data.tables);

    // Convert to base64
    const base64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = `data:text/csv;charset=utf-8;base64,${base64}`;

    // Download using chrome.downloads API
    await chrome.downloads.download({
      url: dataUrl,
      filename: data.filename,
      saveAs: true
    });

    return { success: true };
  } catch (error) {
    console.error('CSV export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CSV export failed'
    };
  }
}

/**
 * Ensure Offscreen Document is created
 */
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'] as chrome.runtime.ContextType[]
  });

  if (contexts.length > 0) {
    return; // Already exists
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['DOM_PARSER', 'WORKERS'] as chrome.offscreen.Reason[],
    justification: 'PDF parsing and Excel generation require DOM access'
  });

  console.log('Offscreen document created');
}

/**
 * Get OAuth token for Google APIs
 */
async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (token) {
        resolve(token);
      } else {
        reject(new Error('No token received'));
      }
    });
  });
}

/**
 * Create Google Sheet with data
 */
async function createGoogleSheet(
  token: string,
  title: string,
  data: string[][]
): Promise<string> {
  // Create spreadsheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title }
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create spreadsheet: ${createResponse.statusText}`);
  }

  const { spreadsheetId } = await createResponse.json();

  // Write data
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: data })
    }
  );

  if (!updateResponse.ok) {
    throw new Error(`Failed to write data: ${updateResponse.statusText}`);
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

/**
 * Generate CSV content from table data
 */
function generateCSV(data: string[][]): string {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  const escapeValue = (val: string) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = data.map((row) => row.map(escapeValue).join(','));
  return BOM + rows.join('\n');
}

/**
 * Download blob as file
 */
async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

console.log('Service Worker initialized');
