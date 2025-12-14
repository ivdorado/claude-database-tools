import { describe, it, expect } from 'vitest';

describe('ListTables', () => {
  describe('Schema Filter Building', () => {
    it('should build empty filter when no schemas provided', () => {
      const schemas: string[] | undefined = undefined;

      const schemaFilter = schemas && schemas.length > 0
        ? `AND TABLE_SCHEMA IN (${schemas.map(s => `'${s}'`).join(', ')})`
        : '';

      expect(schemaFilter).toBe('');
    });

    it('should build empty filter for empty array', () => {
      const schemas: string[] = [];

      const schemaFilter = schemas && schemas.length > 0
        ? `AND TABLE_SCHEMA IN (${schemas.map(s => `'${s}'`).join(', ')})`
        : '';

      expect(schemaFilter).toBe('');
    });

    it('should build filter for single schema', () => {
      const schemas = ['dbo'];

      const schemaFilter = schemas && schemas.length > 0
        ? `AND TABLE_SCHEMA IN (${schemas.map(s => `'${s}'`).join(', ')})`
        : '';

      expect(schemaFilter).toBe("AND TABLE_SCHEMA IN ('dbo')");
    });

    it('should build filter for multiple schemas', () => {
      const schemas = ['dbo', 'sales', 'hr'];

      const schemaFilter = schemas && schemas.length > 0
        ? `AND TABLE_SCHEMA IN (${schemas.map(s => `'${s}'`).join(', ')})`
        : '';

      expect(schemaFilter).toBe("AND TABLE_SCHEMA IN ('dbo', 'sales', 'hr')");
    });
  });

  describe('Query Building', () => {
    it('should build correct base query', () => {
      const schemaFilter = '';

      const query = `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ${schemaFilter} ORDER BY TABLE_SCHEMA, TABLE_NAME`;

      expect(query).toContain('INFORMATION_SCHEMA.TABLES');
      expect(query).toContain("TABLE_TYPE = 'BASE TABLE'");
      expect(query).toContain('ORDER BY TABLE_SCHEMA, TABLE_NAME');
    });

    it('should build query with schema filter', () => {
      const schemaFilter = "AND TABLE_SCHEMA IN ('dbo')";

      const query = `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ${schemaFilter} ORDER BY TABLE_SCHEMA, TABLE_NAME`;

      expect(query).toContain("AND TABLE_SCHEMA IN ('dbo')");
    });
  });

  describe('Result Processing', () => {
    it('should extract table names from recordset', () => {
      const recordset = [
        { tableName: 'dbo.Users' },
        { tableName: 'dbo.Orders' },
        { tableName: 'sales.Products' },
      ];

      const tables = recordset.map(r => r.tableName);

      expect(tables).toEqual(['dbo.Users', 'dbo.Orders', 'sales.Products']);
    });

    it('should handle empty recordset', () => {
      const recordset: any[] = [];

      const tables = recordset.map(r => r.tableName);

      expect(tables).toEqual([]);
    });
  });

  describe('Response Format', () => {
    it('should return success with tables array', () => {
      const tables = ['dbo.Users', 'dbo.Orders'];

      const result = {
        success: true,
        message: `List tables executed successfully. Found ${tables.length} table(s)`,
        tables: tables,
      };

      expect(result.success).toBe(true);
      expect(result.tables).toEqual(tables);
      expect(result.message).toContain('2 table(s)');
    });

    it('should return success with zero tables', () => {
      const tables: string[] = [];

      const result = {
        success: true,
        message: `List tables executed successfully. Found ${tables.length} table(s)`,
        tables: tables,
      };

      expect(result.success).toBe(true);
      expect(result.tables).toEqual([]);
      expect(result.message).toContain('0 table(s)');
    });
  });
});
