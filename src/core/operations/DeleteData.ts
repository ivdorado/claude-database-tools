import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface DeleteDataParams {
  tableName: string;
  whereClause: string;
  confirmDelete: boolean;
}

export class DeleteData {
  async execute(params: DeleteDataParams): Promise<OperationResult> {
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName, whereClause, confirmDelete } = params;

      // Require explicit confirmation
      if (!confirmDelete || confirmDelete !== true) {
        return {
          success: false,
          message: "Physical DELETE operations require confirmDelete: true. Consider using update_data tool to set __deleted = 1 instead (soft delete).",
          warning: "This database uses soft delete patterns. Physical deletes should be rare."
        };
      }

      // Require WHERE clause
      if (!whereClause || whereClause.trim() === '') {
        throw new Error("WHERE clause is required for DELETE operations");
      }

      // Validate table name format
      if (!/^[\w\d_\.]+$/.test(tableName)) {
        throw new Error("Invalid table name format");
      }

      const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
      const request = new sql.Request();
      const result = await request.query(query);

      return {
        success: true,
        message: `DELETE completed. ${result.rowsAffected[0]} row(s) deleted`,
        rowsAffected: result.rowsAffected[0],
        warning: "Physical delete performed. This database uses soft delete patterns (__deleted = 1)."
      };

    } catch (error) {
      console.error("Error deleting data:", error);
      return {
        success: false,
        message: `Failed to delete data: ${error}`,
      };
    }
  }
}
