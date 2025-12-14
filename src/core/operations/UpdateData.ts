import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface UpdateDataParams {
  tableName: string;
  updates: Record<string, any>;
  whereClause: string;
}

export class UpdateData {
  async execute(params: UpdateDataParams): Promise<OperationResult> {
    let query: string | undefined;
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName, updates, whereClause } = params;

      // Basic validation: ensure whereClause is not empty
      if (!whereClause || whereClause.trim() === '') {
        throw new Error("WHERE clause is required for security reasons");
      }

      const request = new sql.Request();

      // Build SET clause with parameterized queries for security
      const setClause = Object.keys(updates)
        .map((key, index) => {
          const paramName = `update_${index}`;
          request.input(paramName, updates[key]);
          return `[${key}] = @${paramName}`;
        })
        .join(", ");

      query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
      const result = await request.query(query);

      return {
        success: true,
        message: `Update completed successfully. ${result.rowsAffected[0]} row(s) affected`,
        rowsAffected: result.rowsAffected[0],
      };
    } catch (error) {
      console.error("Error updating data:", error);
      return {
        success: false,
        message: `Failed to update data ${query ? ` with '${query}'` : ''}: ${error}`,
      };
    }
  }
}
