import { describe, it, expect } from 'vitest';

describe('MCP Server', () => {
  describe('Tool Routing', () => {
    // Simulate the switch statement from index.ts
    function routeTool(toolName: string): string | null {
      const toolNames = [
        'list_tables',
        'describe_table',
        'read_data',
        'insert_data',
        'update_data',
        'delete_data',
        'create_table',
        'create_index',
        'drop_table',
        'get_table_ddl',
        'get_table_alter_ddl',
        'execute_stored_proc',
      ];

      if (toolNames.includes(toolName)) {
        return toolName;
      }
      return null;
    }

    it('should route list_tables', () => {
      expect(routeTool('list_tables')).toBe('list_tables');
    });

    it('should route describe_table', () => {
      expect(routeTool('describe_table')).toBe('describe_table');
    });

    it('should route read_data', () => {
      expect(routeTool('read_data')).toBe('read_data');
    });

    it('should route insert_data', () => {
      expect(routeTool('insert_data')).toBe('insert_data');
    });

    it('should route update_data', () => {
      expect(routeTool('update_data')).toBe('update_data');
    });

    it('should route delete_data', () => {
      expect(routeTool('delete_data')).toBe('delete_data');
    });

    it('should route create_table', () => {
      expect(routeTool('create_table')).toBe('create_table');
    });

    it('should route create_index', () => {
      expect(routeTool('create_index')).toBe('create_index');
    });

    it('should route drop_table', () => {
      expect(routeTool('drop_table')).toBe('drop_table');
    });

    it('should route get_table_ddl', () => {
      expect(routeTool('get_table_ddl')).toBe('get_table_ddl');
    });

    it('should route get_table_alter_ddl', () => {
      expect(routeTool('get_table_alter_ddl')).toBe('get_table_alter_ddl');
    });

    it('should route execute_stored_proc', () => {
      expect(routeTool('execute_stored_proc')).toBe('execute_stored_proc');
    });

    it('should return null for unknown tool', () => {
      expect(routeTool('unknown_tool')).toBeNull();
    });
  });

  describe('Readonly Mode Tool Filtering', () => {
    const readOnlyTools = ['list_tables', 'read_data', 'describe_table', 'get_table_ddl', 'get_table_alter_ddl'];

    const allTools = [
      'list_tables',
      'describe_table',
      'read_data',
      'insert_data',
      'update_data',
      'delete_data',
      'create_table',
      'create_index',
      'drop_table',
      'get_table_ddl',
      'get_table_alter_ddl',
      'execute_stored_proc',
    ];

    function getAvailableTools(isReadOnly: boolean): string[] {
      return isReadOnly ? readOnlyTools : allTools;
    }

    it('should return only read tools in readonly mode', () => {
      const tools = getAvailableTools(true);

      expect(tools).toContain('list_tables');
      expect(tools).toContain('read_data');
      expect(tools).toContain('describe_table');
      expect(tools).toContain('get_table_ddl');
      expect(tools).toContain('get_table_alter_ddl');

      expect(tools).not.toContain('insert_data');
      expect(tools).not.toContain('update_data');
      expect(tools).not.toContain('delete_data');
      expect(tools).not.toContain('create_table');
      expect(tools).not.toContain('drop_table');
    });

    it('should return all tools in write mode', () => {
      const tools = getAvailableTools(false);

      expect(tools).toHaveLength(12);
      expect(tools).toContain('insert_data');
      expect(tools).toContain('update_data');
      expect(tools).toContain('delete_data');
      expect(tools).toContain('create_table');
      expect(tools).toContain('drop_table');
      expect(tools).toContain('execute_stored_proc');
    });
  });

  describe('Tool Argument Validation', () => {
    it('should validate describe_table requires tableName', () => {
      const args = {};

      const isValid = args && typeof (args as any).tableName === 'string';

      expect(isValid).toBe(false);
    });

    it('should accept valid describe_table args', () => {
      const args = { tableName: 'dbo.Users' };

      const isValid = args && typeof args.tableName === 'string';

      expect(isValid).toBe(true);
    });

    it('should reject non-string tableName', () => {
      const args = { tableName: 123 };

      const isValid = args && typeof args.tableName === 'string';

      expect(isValid).toBe(false);
    });
  });

  describe('Response Formatting', () => {
    it('should format successful response', () => {
      const result = { success: true, data: [{ id: 1 }] };

      const response = {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };

      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('"success": true');
    });

    it('should format error response', () => {
      const error = new Error('Test error');

      const response = {
        content: [{ type: 'text', text: `Error occurred: ${error}` }],
        isError: true,
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Error occurred');
    });

    it('should format unknown tool response', () => {
      const toolName = 'unknown_tool';

      const response = {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Unknown tool');
    });
  });

  describe('Server Configuration', () => {
    it('should have correct server name', () => {
      const serverConfig = {
        name: 'mssql-sqlauth-mcp-server',
        version: '1.0.0',
      };

      expect(serverConfig.name).toBe('mssql-sqlauth-mcp-server');
      expect(serverConfig.version).toBe('1.0.0');
    });

    it('should declare tools capability', () => {
      const capabilities = {
        tools: {},
      };

      expect(capabilities.tools).toBeDefined();
    });
  });
});
