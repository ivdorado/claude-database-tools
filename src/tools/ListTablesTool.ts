import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ListTablesTool implements Tool {
  [key: string]: any;
  name = "list_tables";
  description = "Lists tables in an MSSQL Database, or list tables in specific schemas";
  inputSchema = {
    type: "object",
    properties: {
      schemas: {
        type: "array",
        description: "Schemas to filter by (optional)",
        items: {
          type: "string"
        },
        minItems: 0
      },
    },
    required: [],
  } as any;

  async run(params: any) {
    try {
      const { schemas } = params;
      const request = new sql.Request();
      const schemaFilter = schemas && schemas.length > 0 ? `AND TABLE_SCHEMA IN (${schemas.map((s: string) => `'${s}'`).join(", ")})` : "";
      const query = `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ${schemaFilter} ORDER BY TABLE_SCHEMA, TABLE_NAME`;
      const result = await request.query(query);
      return {
        success: true,
        message: `List tables executed successfully. Found ${result.recordset.length} table(s)`,
        tables: result.recordset.map(r => r.tableName),
      };
    } catch (error) {
      console.error("Error listing tables:", error);
      return {
        success: false,
        message: `Failed to list tables: ${error}`,
      };
    }
  }
}
