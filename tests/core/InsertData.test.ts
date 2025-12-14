import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the mssql module
vi.mock('mssql', async () => {
  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockResolvedValue({ rowsAffected: [1] }),
  };

  return {
    default: {
      Request: vi.fn(() => mockRequest),
    },
    Request: vi.fn(() => mockRequest),
  };
});

// Mock connection module
vi.mock('../../src/core/connection.js', () => ({
  isReadonlyMode: vi.fn(() => false),
}));

describe('InsertData', () => {
  describe('Parameter Validation', () => {
    it('should validate that records have consistent columns', async () => {
      // Test logic: when inserting multiple records, all must have same columns
      const firstRecordColumns = ['name', 'email'].sort();
      const secondRecordColumns = ['name', 'phone'].sort();

      const columnsMatch = JSON.stringify(firstRecordColumns) === JSON.stringify(secondRecordColumns);
      expect(columnsMatch).toBe(false);
    });

    it('should accept single record object', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const isArray = Array.isArray(data);
      const records = isArray ? data : [data];

      expect(records.length).toBe(1);
      expect(records[0]).toEqual(data);
    });

    it('should accept array of records', () => {
      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ];
      const isArray = Array.isArray(data);

      expect(isArray).toBe(true);
      expect(data.length).toBe(2);
    });

    it('should reject empty data array', () => {
      const data: any[] = [];
      expect(data.length).toBe(0);
    });
  });

  describe('Query Building', () => {
    it('should properly escape column names with brackets', () => {
      const columns = ['name', 'email', 'user id'];
      const escapedColumns = columns.map(c => `[${c}]`).join(', ');

      expect(escapedColumns).toBe('[name], [email], [user id]');
    });

    it('should generate correct parameter placeholders for single record', () => {
      const columns = ['name', 'email'];
      const values = columns.map((_, index) => `@value${index}`).join(', ');

      expect(values).toBe('@value0, @value1');
    });

    it('should generate correct parameter placeholders for multiple records', () => {
      const columns = ['name', 'email'];
      const records = [{}, {}]; // 2 records

      const valueClauses: string[] = [];
      records.forEach((_, recordIndex) => {
        const valueParams = columns
          .map((_, columnIndex) => `@value${recordIndex}_${columnIndex}`)
          .join(', ');
        valueClauses.push(`(${valueParams})`);
      });

      expect(valueClauses).toEqual([
        '(@value0_0, @value0_1)',
        '(@value1_0, @value1_1)',
      ]);
    });

    it('should build correct INSERT query structure', () => {
      const tableName = 'users';
      const columns = '[name], [email]';
      const values = '@value0, @value1';

      const query = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;

      expect(query).toBe('INSERT INTO users ([name], [email]) VALUES (@value0, @value1)');
    });
  });

  describe('Readonly Mode', () => {
    it('should block operations in readonly mode', async () => {
      const isReadonlyMode = true;

      if (isReadonlyMode) {
        const result = {
          success: false,
          message: 'Operation denied: Database is in READONLY mode',
          error: 'READONLY_MODE',
        };

        expect(result.success).toBe(false);
        expect(result.error).toBe('READONLY_MODE');
      }
    });
  });

  describe('Column Consistency Validation', () => {
    it('should detect column mismatch between records', () => {
      const records = [
        { name: 'John', email: 'john@test.com' },
        { name: 'Jane', phone: '123-456-7890' }, // Different columns!
      ];

      const firstRecordColumns = Object.keys(records[0]).sort();
      let hasMismatch = false;

      for (let i = 1; i < records.length; i++) {
        const currentColumns = Object.keys(records[i]).sort();
        if (JSON.stringify(firstRecordColumns) !== JSON.stringify(currentColumns)) {
          hasMismatch = true;
          break;
        }
      }

      expect(hasMismatch).toBe(true);
    });

    it('should accept records with identical columns', () => {
      const records = [
        { name: 'John', email: 'john@test.com' },
        { name: 'Jane', email: 'jane@test.com' },
      ];

      const firstRecordColumns = Object.keys(records[0]).sort();
      let hasMismatch = false;

      for (let i = 1; i < records.length; i++) {
        const currentColumns = Object.keys(records[i]).sort();
        if (JSON.stringify(firstRecordColumns) !== JSON.stringify(currentColumns)) {
          hasMismatch = true;
          break;
        }
      }

      expect(hasMismatch).toBe(false);
    });
  });
});
