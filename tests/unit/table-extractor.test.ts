import {
  extractTable,
  normalizeTableData,
  validateTableData,
  TextItem
} from '../../src/lib/table-extractor';

describe('Table Extractor', () => {
  describe('extractTable', () => {
    describe('Basic functionality', () => {
      test('should return empty array for empty input', () => {
        expect(extractTable([])).toEqual([]);
      });

      test('should return empty array for null input', () => {
        expect(extractTable(null as any)).toEqual([]);
      });

      test('should handle single item', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 10, width: 10, height: 12 }
        ];
        const result = extractTable(items);
        expect(result).toEqual([['A']]);
      });

      test('should extract simple 2x2 table', () => {
        const items: TextItem[] = [
          // Row 1
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 100, width: 10, height: 12 },
          // Row 2
          { text: 'C', x: 10, y: 110, width: 10, height: 12 },
          { text: 'D', x: 50, y: 110, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toEqual([
          ['A', 'B'],
          ['C', 'D']
        ]);
      });

      test('should extract 3x3 table correctly', () => {
        const items: TextItem[] = [
          // Header row
          { text: 'Name', x: 10, y: 100, width: 30, height: 12 },
          { text: 'Age', x: 50, y: 100, width: 20, height: 12 },
          { text: 'City', x: 80, y: 100, width: 30, height: 12 },
          // Row 1
          { text: 'John', x: 10, y: 110, width: 30, height: 12 },
          { text: '30', x: 50, y: 110, width: 20, height: 12 },
          { text: 'NYC', x: 80, y: 110, width: 30, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(['Name', 'Age', 'City']);
        expect(result[1]).toEqual(['John', '30', 'NYC']);
      });
    });

    describe('Row detection', () => {
      test('should group items with similar Y coordinates', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 102, width: 10, height: 12 }, // Y diff: 2px (< threshold)
          { text: 'C', x: 10, y: 120, width: 10, height: 12 }  // New row (Y diff: 18px)
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(2); // 2 rows
        expect(result[0]).toHaveLength(2); // First row has 2 cells
        expect(result[1]).toHaveLength(2); // Second row has 2 cells (normalized)
        expect(result[0]).toEqual(['A', 'B']);
        expect(result[1]).toEqual(['C', '']);  // Second column is empty
      });

      test('should respect custom row threshold', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 107, width: 10, height: 12 }, // Y diff: 7px
          { text: 'C', x: 10, y: 120, width: 10, height: 12 }
        ];

        // With default threshold (5px), B should be in new row
        const result1 = extractTable(items);
        expect(result1).toHaveLength(3);

        // With larger threshold (10px), B should be in same row as A
        const result2 = extractTable(items, { rowThreshold: 10 });
        expect(result2).toHaveLength(2);
        expect(result2[0]).toHaveLength(2);
      });

      test('should handle items with same Y coordinate', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 100, width: 10, height: 12 },
          { text: 'C', x: 90, y: 100, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(['A', 'B', 'C']);
      });
    });

    describe('Column detection', () => {
      test('should detect columns from X coordinates', () => {
        const items: TextItem[] = [
          { text: 'A1', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B1', x: 50, y: 100, width: 10, height: 12 },
          { text: 'C1', x: 90, y: 100, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result[0]).toHaveLength(3); // 3 columns
      });

      test('should merge text in same cell', () => {
        const items: TextItem[] = [
          { text: 'Hello', x: 10, y: 100, width: 10, height: 12 },
          { text: 'World', x: 12, y: 100, width: 10, height: 12 } // Same cell (X diff: 2px)
        ];

        const result = extractTable(items);
        expect(result[0][0]).toBe('Hello World');
      });

      test('should respect custom column threshold', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 18, y: 100, width: 10, height: 12 } // X diff: 8px
        ];

        // With default threshold (10px), should be same column
        const result1 = extractTable(items);
        expect(result1[0]).toHaveLength(1);
        expect(result1[0][0]).toBe('A B');

        // With smaller threshold (5px), should be different columns
        const result2 = extractTable(items, { colThreshold: 5 });
        expect(result2[0]).toHaveLength(2);
      });
    });

    describe('Edge cases', () => {
      test('should handle items with empty text', () => {
        const items: TextItem[] = [
          { text: '', x: 10, y: 10, width: 10, height: 12 },
          { text: 'B', x: 50, y: 10, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result[0][0]).toBe('');
        expect(result[0][1]).toBe('B');
      });

      test('should handle missing coordinates gracefully', () => {
        const items: TextItem[] = [
          { text: 'A', x: undefined as any, y: 10, width: 10, height: 12 }
        ];

        // Should not throw error
        expect(() => extractTable(items)).not.toThrow();
      });

      test('should handle negative coordinates', () => {
        const items: TextItem[] = [
          { text: 'A', x: -10, y: -5, width: 10, height: 12 },
          { text: 'B', x: 10, y: -5, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveLength(2);
      });

      test('should handle large coordinate values', () => {
        const items: TextItem[] = [
          { text: 'A', x: 1000000, y: 2000000, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toEqual([['A']]);
      });

      test('should preserve item order within rows', () => {
        const items: TextItem[] = [
          { text: 'C', x: 90, y: 100, width: 10, height: 12 },
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 100, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result[0]).toEqual(['A', 'B', 'C']); // Should be sorted by X
      });
    });

    describe('Complex layouts', () => {
      test('should handle irregular column widths', () => {
        const items: TextItem[] = [
          // Row 1: Wide first column
          { text: 'Very Long Header', x: 10, y: 100, width: 80, height: 12 },
          { text: 'Short', x: 100, y: 100, width: 30, height: 12 },
          // Row 2
          { text: 'Short', x: 10, y: 110, width: 30, height: 12 },
          { text: 'Long Value Here', x: 100, y: 110, width: 70, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(2);
        expect(result[0][0]).toContain('Very Long Header');
        expect(result[1][1]).toContain('Long Value Here');
      });

      test('should handle tables with varying row heights', () => {
        const items: TextItem[] = [
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 10, y: 115, width: 10, height: 18 }, // Taller row
          { text: 'C', x: 10, y: 135, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(3);
        expect(result.map(r => r[0])).toEqual(['A', 'B', 'C']);
      });

      test('should handle sparse tables (missing cells)', () => {
        const items: TextItem[] = [
          // Row 1: All columns
          { text: 'A', x: 10, y: 100, width: 10, height: 12 },
          { text: 'B', x: 50, y: 100, width: 10, height: 12 },
          { text: 'C', x: 90, y: 100, width: 10, height: 12 },
          // Row 2: Missing middle column
          { text: 'D', x: 10, y: 110, width: 10, height: 12 },
          { text: 'F', x: 90, y: 110, width: 10, height: 12 }
        ];

        const result = extractTable(items);
        expect(result).toHaveLength(2);
        expect(result[1]).toHaveLength(3);
        expect(result[1][1]).toBe(''); // Middle cell should be empty
      });
    });
  });

  describe('normalizeTableData', () => {
    test('should return empty array for empty input', () => {
      expect(normalizeTableData([])).toEqual([]);
    });

    test('should return empty array for null input', () => {
      expect(normalizeTableData(null as any)).toEqual([]);
    });

    test('should pad short rows', () => {
      const input = [
        ['A', 'B', 'C'],
        ['X', 'Y']
      ];

      const result = normalizeTableData(input);
      expect(result[1]).toEqual(['X', 'Y', '']);
    });

    test('should handle all rows same length', () => {
      const input = [
        ['A', 'B'],
        ['C', 'D']
      ];

      const result = normalizeTableData(input);
      expect(result).toEqual(input);
    });

    test('should convert non-strings to strings', () => {
      const input = [
        [1, 2, null, undefined],
        [true, false, {}, []]
      ] as any;

      const result = normalizeTableData(input);
      expect(result[0][0]).toBe('1');
      expect(result[0][2]).toBe('');
      expect(result[0][3]).toBe('');
      expect(typeof result[1][0]).toBe('string');
    });
  });

  describe('validateTableData', () => {
    test('should return true for valid 2D string array', () => {
      const data = [
        ['A', 'B'],
        ['C', 'D']
      ];
      expect(validateTableData(data)).toBe(true);
    });

    test('should return true for empty array', () => {
      expect(validateTableData([])).toBe(true);
    });

    test('should return false for non-array', () => {
      expect(validateTableData(null)).toBe(false);
      expect(validateTableData(undefined)).toBe(false);
      expect(validateTableData('string')).toBe(false);
      expect(validateTableData(123)).toBe(false);
    });

    test('should return false for 1D array', () => {
      expect(validateTableData(['A', 'B', 'C'])).toBe(false);
    });

    test('should return false if rows contain non-strings', () => {
      const data = [
        ['A', 'B'],
        ['C', 123 as any]
      ];
      expect(validateTableData(data)).toBe(false);
    });

    test('should return false if rows are not arrays', () => {
      const data = [
        ['A', 'B'],
        'not an array' as any
      ];
      expect(validateTableData(data)).toBe(false);
    });
  });
});
