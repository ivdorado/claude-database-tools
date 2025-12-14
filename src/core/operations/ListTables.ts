import sql from "mssql";
import { OperationResult } from "../types.js";

export interface ListTablesParams {
  schemas?: string[];
}

export class ListTables {
  async execute(params: ListTablesParams): Promise<OperationResult> {
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
