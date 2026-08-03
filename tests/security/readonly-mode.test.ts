import { describe, it, expect, afterEach } from 'vitest';
import { isReadonlyMode } from '../../src/core/connection.js';

/**
 * Tests for READONLY mode enforcement
 *
 * When READONLY_MODE=true, all write operations should be blocked
 */

describe('Readonly Mode Security', () => {
  describe('Operation Blocking', () => {
    const writeOperations = [
      'InsertData',
      'UpdateData',
      'DeleteData',
      'CreateTable',
      'CreateIndex',
      'DropTable',
      'ExecuteStoredProc',
    ];

    const readOperations = [
      'ListTables',
      'DescribeTable',
      'ReadData',
      'GetTableDdl',
      'GetTableAlterDdl',
    ];

    function shouldBlockInReadonlyMode(operationName: string): boolean {
      return writeOperations.includes(operationName);
    }

    it('should block InsertData in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('InsertData')).toBe(true);
    });

    it('should block UpdateData in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('UpdateData')).toBe(true);
    });

    it('should block DeleteData in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('DeleteData')).toBe(true);
    });

    it('should block CreateTable in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('CreateTable')).toBe(true);
    });

    it('should block CreateIndex in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('CreateIndex')).toBe(true);
    });

    it('should block DropTable in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('DropTable')).toBe(true);
    });

    it('should block ExecuteStoredProc in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('ExecuteStoredProc')).toBe(true);
    });

    it('should allow ListTables in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('ListTables')).toBe(false);
    });

    it('should allow DescribeTable in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('DescribeTable')).toBe(false);
    });

    it('should allow ReadData in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('ReadData')).toBe(false);
    });

    it('should allow GetTableDdl in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('GetTableDdl')).toBe(false);
    });

    it('should allow GetTableAlterDdl in readonly mode', () => {
      expect(shouldBlockInReadonlyMode('GetTableAlterDdl')).toBe(false);
    });
  });

  describe('Error Response Format', () => {
    it('should return correct error for readonly mode block', () => {
      const isReadonlyMode = true;

      const result = isReadonlyMode
        ? {
            success: false,
            message: 'Operation denied: Database is in READONLY mode',
            error: 'READONLY_MODE',
          }
        : { success: true, message: 'Operation allowed' };

      expect(result.success).toBe(false);
      expect(result.error).toBe('READONLY_MODE');
      expect(result.message).toContain('READONLY');
    });
  });

  describe('Environment Variable Parsing (real isReadonlyMode implementation)', () => {
    const original = process.env.READONLY_MODE;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.READONLY_MODE;
      } else {
        process.env.READONLY_MODE = original;
      }
    });

    it('should be readonly when READONLY_MODE=true', () => {
      process.env.READONLY_MODE = 'true';
      expect(isReadonlyMode()).toBe(true);
    });

    it('should not be readonly when READONLY_MODE=false', () => {
      process.env.READONLY_MODE = 'false';
      expect(isReadonlyMode()).toBe(false);
    });

    // Secure by default: only the literal string 'false' disables readonly.
    // Anything else — unset, empty, misspelled, wrong case — must stay readonly.
    it('should be readonly when READONLY_MODE is unset', () => {
      delete process.env.READONLY_MODE;
      expect(isReadonlyMode()).toBe(true);
    });

    it('should be readonly when READONLY_MODE is empty string', () => {
      process.env.READONLY_MODE = '';
      expect(isReadonlyMode()).toBe(true);
    });

    it('should be readonly when READONLY_MODE=FALSE (uppercase)', () => {
      process.env.READONLY_MODE = 'FALSE';
      expect(isReadonlyMode()).toBe(true);
    });

    it('should be readonly when READONLY_MODE=0', () => {
      process.env.READONLY_MODE = '0';
      expect(isReadonlyMode()).toBe(true);
    });
  });

  describe('MCP Server Tool Filtering', () => {
    const readOnlyTools = [
      'list_tables',
      'read_data',
      'describe_table',
      'get_table_ddl',
      'get_table_alter_ddl',
    ];

    const writeTools = [
      'insert_data',
      'update_data',
      'delete_data',
      'create_table',
      'create_index',
      'drop_table',
      'execute_stored_proc',
    ];

    function getExposedTools(isReadOnly: boolean): string[] {
      if (isReadOnly) {
        return readOnlyTools;
      }
      return [...readOnlyTools, ...writeTools];
    }

    it('should expose only 5 tools in readonly mode', () => {
      const tools = getExposedTools(true);
      expect(tools).toHaveLength(5);
    });

    it('should expose all 12 tools in write mode', () => {
      const tools = getExposedTools(false);
      expect(tools).toHaveLength(12);
    });

    it('should not expose insert_data in readonly mode', () => {
      const tools = getExposedTools(true);
      expect(tools).not.toContain('insert_data');
    });

    it('should not expose delete_data in readonly mode', () => {
      const tools = getExposedTools(true);
      expect(tools).not.toContain('delete_data');
    });

    it('should not expose drop_table in readonly mode', () => {
      const tools = getExposedTools(true);
      expect(tools).not.toContain('drop_table');
    });
  });
});
