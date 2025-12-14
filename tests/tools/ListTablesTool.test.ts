import { describe, it, expect } from 'vitest';

describe('ListTablesTool', () => {
  describe('Tool Definition', () => {
    const toolDefinition = {
      name: 'list_tables',
      description: 'Lists tables in an MSSQL Database, or list tables in specific schemas',
      inputSchema: {
        type: 'object',
        properties: {
          schemas: {
            type: 'array',
            description: 'Schemas to filter by (optional)',
            items: {
              type: 'string',
            },
            minItems: 0,
          },
        },
        required: [],
      },
    };

    it('should have correct name', () => {
      expect(toolDefinition.name).toBe('list_tables');
    });

    it('should have description', () => {
      expect(toolDefinition.description).toBeTruthy();
      expect(toolDefinition.description).toContain('tables');
    });

    it('should define schemas as optional array', () => {
      expect(toolDefinition.inputSchema.properties.schemas.type).toBe('array');
      expect(toolDefinition.inputSchema.required).toEqual([]);
    });

    it('should define schema items as strings', () => {
      expect(toolDefinition.inputSchema.properties.schemas.items.type).toBe('string');
    });
  });

  describe('Input Validation', () => {
    it('should accept empty params', () => {
      const params = {};

      const schemas = params as { schemas?: string[] };

      expect(schemas.schemas).toBeUndefined();
    });

    it('should accept schemas array', () => {
      const params = { schemas: ['dbo', 'sales'] };

      expect(params.schemas).toEqual(['dbo', 'sales']);
    });

    it('should accept empty schemas array', () => {
      const params = { schemas: [] };

      expect(params.schemas).toEqual([]);
    });
  });
});
