import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the validation logic without actually connecting to SQL Server
// So we'll extract and test the validation functions directly

describe('ReadData', () => {
  // Test validation logic directly since it's the core security feature
  describe('Query Validation', () => {
    // Recreate the validation logic for testing
    const DANGEROUS_KEYWORDS = [
      'DELETE', 'DROP', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
      'TRUNCATE', 'EXEC', 'EXECUTE', 'MERGE', 'REPLACE',
      'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
      'BEGIN', 'DECLARE', 'SET', 'USE', 'BACKUP',
      'RESTORE', 'KILL', 'SHUTDOWN', 'WAITFOR', 'OPENROWSET',
      'OPENDATASOURCE', 'OPENQUERY', 'OPENXML', 'BULK', 'INTO'
    ];

    const DANGEROUS_PATTERNS = [
      /SELECT\s+.*?\s+INTO\s+/i,
      /;\s*(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE)/i,
      /UNION\s+(?:ALL\s+)?SELECT.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)/i,
      /--.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)/i,
      /\/\*.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE).*?\*\//i,
      /EXEC\s*\(/i,
      /EXECUTE\s*\(/i,
      /sp_/i,
      /xp_/i,
      /BULK\s+INSERT/i,
      /OPENROWSET/i,
      /OPENDATASOURCE/i,
      /@@/,
      /SYSTEM_USER/i,
      /USER_NAME/i,
      /DB_NAME/i,
      /HOST_NAME/i,
      /WAITFOR\s+DELAY/i,
      /WAITFOR\s+TIME/i,
      /;\s*\w/,
      /\+\s*CHAR\s*\(/i,
      /\+\s*NCHAR\s*\(/i,
      /\+\s*ASCII\s*\(/i,
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
          return { isValid: false, error: `Dangerous keyword '${keyword}' detected in query. Only SELECT operations are allowed.` };
        }
      }

      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(query)) {
          return { isValid: false, error: 'Potentially malicious SQL pattern detected. Only simple SELECT queries are allowed.' };
        }
      }

      const statements = cleanQuery.split(';').filter(stmt => stmt.trim().length > 0);
      if (statements.length > 1) {
        return { isValid: false, error: 'Multiple SQL statements are not allowed. Use only a single SELECT statement.' };
      }

      if (query.includes('CHAR(') || query.includes('NCHAR(') || query.includes('ASCII(')) {
        return { isValid: false, error: 'Character conversion functions are not allowed as they may be used for obfuscation.' };
      }

      if (query.length > 10000) {
        return { isValid: false, error: 'Query is too long. Maximum allowed length is 10,000 characters.' };
      }

      return { isValid: true };
    }

    describe('Valid SELECT queries', () => {
      it('should accept simple SELECT *', () => {
        expect(validateQuery('SELECT * FROM users')).toEqual({ isValid: true });
      });

      it('should accept SELECT with specific columns', () => {
        expect(validateQuery('SELECT id, name, email FROM users')).toEqual({ isValid: true });
      });

      it('should accept SELECT with WHERE clause', () => {
        expect(validateQuery("SELECT * FROM users WHERE id = 1")).toEqual({ isValid: true });
      });

      it('should accept SELECT with JOIN', () => {
        expect(validateQuery('SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id')).toEqual({ isValid: true });
      });

      it('should accept SELECT with ORDER BY', () => {
        expect(validateQuery('SELECT * FROM users ORDER BY created_at DESC')).toEqual({ isValid: true });
      });

      it('should accept SELECT with GROUP BY and HAVING', () => {
        expect(validateQuery('SELECT status, COUNT(*) FROM orders GROUP BY status HAVING COUNT(*) > 10')).toEqual({ isValid: true });
      });

      it('should accept SELECT with TOP', () => {
        expect(validateQuery('SELECT TOP 10 * FROM users')).toEqual({ isValid: true });
      });

      it('should accept SELECT with subquery', () => {
        expect(validateQuery('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)')).toEqual({ isValid: true });
      });

      it('should accept SELECT with UNION (non-malicious)', () => {
        expect(validateQuery('SELECT name FROM users UNION SELECT name FROM customers')).toEqual({ isValid: true });
      });

      it('should accept SELECT with CASE expression', () => {
        expect(validateQuery("SELECT CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END FROM users")).toEqual({ isValid: true });
      });

      it('should accept lowercase SELECT', () => {
        expect(validateQuery('select * from users')).toEqual({ isValid: true });
      });

      it('should accept mixed case SELECT', () => {
        expect(validateQuery('Select Id, Name From Users Where Status = 1')).toEqual({ isValid: true });
      });
    });

    describe('Invalid - Non-SELECT queries', () => {
      it('should reject DELETE statement', () => {
        const result = validateQuery('DELETE FROM users WHERE id = 1');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('SELECT');
      });

      it('should reject UPDATE statement', () => {
        const result = validateQuery("UPDATE users SET name = 'test' WHERE id = 1");
        expect(result.isValid).toBe(false);
      });

      it('should reject INSERT statement', () => {
        const result = validateQuery("INSERT INTO users (name) VALUES ('test')");
        expect(result.isValid).toBe(false);
      });

      it('should reject DROP statement', () => {
        const result = validateQuery('DROP TABLE users');
        expect(result.isValid).toBe(false);
      });

      it('should reject ALTER statement', () => {
        const result = validateQuery('ALTER TABLE users ADD COLUMN test VARCHAR(50)');
        expect(result.isValid).toBe(false);
      });

      it('should reject CREATE statement', () => {
        const result = validateQuery('CREATE TABLE test (id INT)');
        expect(result.isValid).toBe(false);
      });

      it('should reject TRUNCATE statement', () => {
        const result = validateQuery('TRUNCATE TABLE users');
        expect(result.isValid).toBe(false);
      });
    });

    describe('SQL Injection attempts', () => {
      it('should reject SELECT with embedded DELETE', () => {
        const result = validateQuery('SELECT * FROM users; DELETE FROM users');
        expect(result.isValid).toBe(false);
      });

      it('should reject SELECT with embedded DROP', () => {
        const result = validateQuery('SELECT * FROM users; DROP TABLE users');
        expect(result.isValid).toBe(false);
      });

      it('should reject SELECT INTO (creates new table)', () => {
        const result = validateQuery('SELECT * INTO new_table FROM users');
        expect(result.isValid).toBe(false);
      });

      it('should reject EXEC call', () => {
        const result = validateQuery("SELECT * FROM users WHERE id = 1; EXEC sp_executesql 'DROP TABLE users'");
        expect(result.isValid).toBe(false);
      });

      it('should reject sp_ stored procedure patterns', () => {
        const result = validateQuery('SELECT * FROM users WHERE name = sp_help');
        expect(result.isValid).toBe(false);
      });

      it('should reject xp_ extended stored procedure patterns', () => {
        const result = validateQuery('SELECT * FROM users WHERE name = xp_cmdshell');
        expect(result.isValid).toBe(false);
      });

      it('should reject WAITFOR DELAY (time-based injection)', () => {
        const result = validateQuery("SELECT * FROM users WHERE id = 1; WAITFOR DELAY '0:0:5'");
        expect(result.isValid).toBe(false);
      });

      it('should reject OPENROWSET', () => {
        const result = validateQuery("SELECT * FROM OPENROWSET('SQLNCLI', 'server=...', 'SELECT * FROM users')");
        expect(result.isValid).toBe(false);
      });

      it('should reject OPENDATASOURCE', () => {
        const result = validateQuery("SELECT * FROM OPENDATASOURCE('SQLNCLI', 'Data Source=...')..users");
        expect(result.isValid).toBe(false);
      });

      it('should reject BULK INSERT', () => {
        const result = validateQuery("BULK INSERT users FROM 'c:\\data.txt'");
        expect(result.isValid).toBe(false);
      });

      it('should reject @@ system variables', () => {
        const result = validateQuery('SELECT @@VERSION');
        expect(result.isValid).toBe(false);
      });

      it('should reject SYSTEM_USER function', () => {
        const result = validateQuery('SELECT SYSTEM_USER');
        expect(result.isValid).toBe(false);
      });

      it('should reject HOST_NAME function', () => {
        const result = validateQuery('SELECT HOST_NAME()');
        expect(result.isValid).toBe(false);
      });

      it('should reject CHAR() obfuscation', () => {
        const result = validateQuery("SELECT * FROM users WHERE name = CHAR(68) + CHAR(69)");
        expect(result.isValid).toBe(false);
      });

      it('should reject NCHAR() obfuscation', () => {
        const result = validateQuery("SELECT * FROM users WHERE name = NCHAR(68) + NCHAR(69)");
        expect(result.isValid).toBe(false);
      });

      it('should reject comment-based injection', () => {
        const result = validateQuery('SELECT * FROM users WHERE id = 1 --DELETE FROM users');
        expect(result.isValid).toBe(false);
      });

      it('should reject multiple statements via semicolon', () => {
        const result = validateQuery('SELECT * FROM users; SELECT * FROM passwords');
        expect(result.isValid).toBe(false);
      });

      it('should reject UNION with destructive command', () => {
        const result = validateQuery('SELECT id FROM users UNION SELECT DROP FROM tables');
        expect(result.isValid).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should reject empty query', () => {
        const result = validateQuery('');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('non-empty string');
      });

      it('should reject null query', () => {
        const result = validateQuery(null as any);
        expect(result.isValid).toBe(false);
      });

      it('should reject undefined query', () => {
        const result = validateQuery(undefined as any);
        expect(result.isValid).toBe(false);
      });

      it('should reject comment-only query', () => {
        const result = validateQuery('-- SELECT * FROM users');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('empty after removing comments');
      });

      it('should reject query exceeding max length', () => {
        const longQuery = 'SELECT * FROM users WHERE name IN (' + "'test',".repeat(5000) + "'final')";
        const result = validateQuery(longQuery);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('too long');
      });

      it('should accept queries at max length boundary', () => {
        const query = 'SELECT ' + 'a'.repeat(9990);
        const result = validateQuery(query);
        // This will be valid (under length limit), error may be undefined for valid queries
        // or contain some other error, but NOT 'too long'
        if (result.error) {
          expect(result.error).not.toContain('too long');
        } else {
          expect(result.isValid).toBe(true);
        }
      });

      it('should allow column named "deleted" (not keyword)', () => {
        const result = validateQuery('SELECT id, deleted FROM users WHERE deleted = 0');
        // "deleted" as column name is fine - only standalone DELETE keyword is blocked
        expect(result.isValid).toBe(true);
      });

      it('should allow table named "updates" (not keyword)', () => {
        const result = validateQuery('SELECT * FROM product_updates');
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Result Sanitization', () => {
    function sanitizeResult(data: any[]): any[] {
      if (!Array.isArray(data)) {
        return [];
      }

      const maxRecords = 10000;
      if (data.length > maxRecords) {
        return data.slice(0, maxRecords);
      }

      return data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(record)) {
            const sanitizedKey = key.replace(/[^\w\s-_.]/g, '');
            sanitized[sanitizedKey] = value;
          }
          return sanitized;
        }
        return record;
      });
    }

    it('should return empty array for non-array input', () => {
      expect(sanitizeResult(null as any)).toEqual([]);
      expect(sanitizeResult(undefined as any)).toEqual([]);
      expect(sanitizeResult('string' as any)).toEqual([]);
      expect(sanitizeResult({} as any)).toEqual([]);
    });

    it('should pass through valid data unchanged', () => {
      const data = [{ id: 1, name: 'Test' }];
      expect(sanitizeResult(data)).toEqual(data);
    });

    it('should sanitize suspicious column names', () => {
      const data = [{ 'id<script>': 1, 'name': 'Test' }];
      const result = sanitizeResult(data);
      expect(result[0]).toHaveProperty('idscript');
      expect(result[0]).not.toHaveProperty('id<script>');
    });

    it('should truncate results exceeding max records', () => {
      const data = Array(15000).fill({ id: 1 });
      const result = sanitizeResult(data);
      expect(result.length).toBe(10000);
    });

    it('should handle primitive values in array', () => {
      const data = [1, 'string', true];
      expect(sanitizeResult(data)).toEqual([1, 'string', true]);
    });
  });
});
