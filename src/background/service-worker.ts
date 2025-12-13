// Service Worker for PDF to Sheet Extension (Manifest V3)

// Development mode check (replaced at build time)
const isDev = import.meta.env.DEV;

// Utility function for conditional error logging
function logError(context: string, error: unknown) {
  if (isDev) {
    console.error(`[DEV] ${context}:`, error);
  }
  // In production, errors are only returned to user in sanitized form
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender origin
  if (!sender.id || sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Invalid sender' });
    return;
  }

  // Validate message structure
  if (!message || typeof message.action !== 'string') {
    sendResponse({ success: false, error: 'Invalid message format' });
    return;
  }

  switch (message.action) {
    case 'processPdf':
      // Validate data type
      if (typeof message.data !== 'string' || !message.data) {
        sendResponse({ success: false, error: 'Invalid PDF data' });
        return;
      }
      handleProcessPdf(message.data).then(sendResponse);
      return true; // Indicates async response

    case 'exportToSheets':
      // Validate data structure
      if (!message.data ||
          typeof message.data.title !== 'string' ||
          !Array.isArray(message.data.tables)) {
        sendResponse({ success: false, error: 'Invalid export data' });
        return;
      }
      handleExportToSheets(message.data).then(sendResponse);
      return true;

    case 'exportToExcel':
      // Validate data structure
      if (!message.data ||
          typeof message.data.filename !== 'string' ||
          !Array.isArray(message.data.tables)) {
        sendResponse({ success: false, error: 'Invalid export data' });
        return;
      }
      handleExportToExcel(message.data).then(sendResponse);
      return true;

    case 'exportToCsv':
      // Validate data structure
      if (!message.data ||
          typeof message.data.filename !== 'string' ||
          !Array.isArray(message.data.tables)) {
        sendResponse({ success: false, error: 'Invalid export data' });
        return;
      }
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
    logError('PDF processing error', error);
    return {
      success: false,
      error: 'Unable to process PDF. Please try a different file.'
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

    // Get or create folder in Drive
    const folderId = await getOrCreateFolder(token, 'PDF to Sheet Converter');

    // Create spreadsheet in folder
    const url = await createGoogleSheet(token, data.title, data.tables, folderId);

    return { success: true, url };
  } catch (error) {
    logError('Sheets export error', error);
    return {
      success: false,
      error: 'Unable to export to Google Sheets. Please check your Google account permissions and try again.'
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
    logError('Excel export error', error);
    return {
      success: false,
      error: 'Unable to export to Excel. Please try again.'
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
    logError('CSV export error', error);
    return {
      success: false,
      error: 'Unable to export to CSV. Please try again.'
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
}

/**
 * Get OAuth token for Google APIs
 */
async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result && typeof result === 'string') {
        // Legacy callback signature (string)
        resolve(result);
      } else if (result && typeof result === 'object' && 'token' in result && result.token) {
        // New callback signature (GetAuthTokenResult)
        resolve(result.token);
      } else {
        reject(new Error('No token received'));
      }
    });
  });
}

/**
 * Get or create folder in Google Drive
 */
async function getOrCreateFolder(token: string, folderName: string): Promise<string> {
  // Escape single quotes in folderName to prevent injection
  const escapedName = folderName.replace(/'/g, "\\'");

  // Build query with escaped folder name
  const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const params = new URLSearchParams({ q: query });

  // Search for existing folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Failed to search for folder: ${searchResponse.statusText} - ${errorText}`);
  }

  const searchResult = await searchResponse.json();

  // Return existing folder if found
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  // Create new folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create folder: ${createResponse.statusText} - ${errorText}`);
  }

  const folder = await createResponse.json();
  return folder.id;
}

/**
 * Create Google Sheet with data in specified folder
 */
async function createGoogleSheet(
  token: string,
  title: string,
  data: string[][],
  folderId?: string
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
    const errorText = await createResponse.text();
    throw new Error(`Failed to create spreadsheet: ${createResponse.statusText} - ${errorText}`);
  }

  const { spreadsheetId } = await createResponse.json();

  // Move spreadsheet to folder if folderId provided
  if (folderId) {
    const moveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!moveResponse.ok) {
      logError('Failed to move spreadsheet to folder', moveResponse.statusText);
      // Don't throw - spreadsheet is created, just not in folder
    }
  }

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
    const errorText = await updateResponse.text();
    throw new Error(`Failed to write data: ${updateResponse.statusText} - ${errorText}`);
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
