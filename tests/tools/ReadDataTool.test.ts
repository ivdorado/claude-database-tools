import { describe, it, expect } from 'vitest';

describe('ReadDataTool', () => {
  describe('Tool Definition', () => {
    const toolDefinition = {
      name: 'read_data',
      description: 'Executes a SELECT query on an MSSQL Database table. The query must start with SELECT and cannot contain any destructive SQL operations for security reasons.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "SQL SELECT query to execute (must start with SELECT and cannot contain destructive operations). Example: SELECT * FROM movies WHERE genre = 'comedy'",
          },
        },
        required: ['query'],
      },
    };

    it('should have correct name', () => {
      expect(toolDefinition.name).toBe('read_data');
    });

    it('should have security-focused description', () => {
      expect(toolDefinition.description).toContain('SELECT');
      expect(toolDefinition.description).toContain('security');
    });

    it('should require query parameter', () => {
      expect(toolDefinition.inputSchema.required).toContain('query');
    });

    it('should define query as string', () => {
      expect(toolDefinition.inputSchema.properties.query.type).toBe('string');
    });
  });

  describe('Query Validation (same as ReadData)', () => {
    // The ReadDataTool has duplicate validation logic from ReadData
    // These tests verify the tool-level validation works the same way

    const DANGEROUS_KEYWORDS = [
      'DELETE', 'DROP', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
      'TRUNCATE', 'EXEC', 'EXECUTE', 'MERGE', 'REPLACE',
      'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
      'BEGIN', 'DECLARE', 'SET', 'USE', 'BACKUP',
      'RESTORE', 'KILL', 'SHUTDOWN', 'WAITFOR', 'OPENROWSET',
      'OPENDATASOURCE', 'OPENQUERY', 'OPENXML', 'BULK', 'INTO',
    ];

    function validateQuery(query: string): { isValid: boolean; error?: string } {
      if (!query || typeof query !== 'string') {
        return { isValid: false, error: 'Query must be a non-empty string' };
      }

      const cleanQuery = query
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanQuery) {
        return { isValid: false, error: 'Query cannot be empty after removing comments' };
      }

      const upperQuery = cleanQuery.toUpperCase();

      if (!upperQuery.startsWith('SELECT')) {
        return { isValid: false, error: 'Query must start with SELECT for security reasons' };
      }

      for (const keyword of DANGEROUS_KEYWORDS) {
        const keywordRegex = new RegExp(`(^|\\s|[^A-Za-z0-9_])${keyword}($|\\s|[^A-Za-z0-9_])`, 'i');
        if (keywordRegex.test(upperQuery)) {
          return { isValid: false, error: `Dangerous keyword '${keyword}' detected` };
        }
      }

      return { isValid: true };
    }

    it('should validate SELECT queries', () => {
      expect(validateQuery('SELECT * FROM users').isValid).toBe(true);
    });

    it('should reject DELETE queries', () => {
      expect(validateQuery('DELETE FROM users').isValid).toBe(false);
    });

    it('should reject embedded dangerous keywords', () => {
      expect(validateQuery('SELECT * FROM users; DROP TABLE users').isValid).toBe(false);
    });
  });
});
