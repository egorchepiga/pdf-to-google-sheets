/**
 * Table Extraction Module
 * Extracts tables from PDF text items based on spatial coordinates
 */

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractionConfig {
  rowThreshold?: number;  // Max Y difference for same row (default: 5)
  colThreshold?: number;  // Min X difference for different column (default: 10)
}

/**
 * Extract table from text items based on coordinates
 * @param items - Array of text items with coordinates
 * @param config - Optional configuration for thresholds
 * @returns 2D array of table data
 */
export function extractTable(
  items: TextItem[],
  config: ExtractionConfig = {}
): string[][] {
  if (!items || items.length === 0) {
    return [];
  }

  const rowThreshold = config.rowThreshold ?? 5;
  const colThreshold = config.colThreshold ?? 10;

  // Sort by Y coordinate (top to bottom)
  const sortedItems = [...items].sort((a, b) => a.y - b.y);

  // Group items into rows
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [];
  let lastY: number | null = null;

  for (const item of sortedItems) {
    if (lastY !== null && Math.abs(item.y - lastY) > rowThreshold) {
      // New row
      if (currentRow.length > 0) {
        rows.push(currentRow.sort((a, b) => a.x - b.x));
        currentRow = [];
      }
    }
    currentRow.push(item);
    lastY = item.y;
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.sort((a, b) => a.x - b.x));
  }

  // Detect column positions
  const allX = rows.flat().map(item => item.x).sort((a, b) => a - b);
  const columns: number[] = [];

  for (const x of allX) {
    if (columns.length === 0 || x - columns[columns.length - 1] > colThreshold) {
      columns.push(x);
    }
  }

  // Build table
  return rows.map(row => {
    const tableRow = new Array(columns.length).fill('');

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
 * Normalize table data (ensure all rows have same column count)
 * @param data - Raw table data
 * @returns Normalized 2D array with consistent column count
 */
export function normalizeTableData(data: any[][]): string[][] {
  if (!data || data.length === 0) {
    return [];
  }

  // Find max column count
  const maxCols = Math.max(...data.map(row => row.length));

  // Normalize each row
  return data.map(row => {
    const normalized = new Array(maxCols).fill('');
    row.forEach((cell, i) => {
      normalized[i] = String(cell ?? '');
    });
    return normalized;
  });
}

/**
 * Validate table data structure
 * @param data - Table data to validate
 * @returns True if valid, false otherwise
 */
export function validateTableData(data: unknown): data is string[][] {
  if (!Array.isArray(data)) {
    return false;
  }

  if (data.length === 0) {
    return true; // Empty array is valid
  }

  // Check if all elements are arrays
  if (!data.every(row => Array.isArray(row))) {
    return false;
  }

  // Check if all cells are strings
  return data.every(row =>
    row.every(cell => typeof cell === 'string')
  );
}
