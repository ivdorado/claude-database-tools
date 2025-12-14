import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class DeleteDataTool implements Tool {
  [key: string]: any;
  name = "delete_data";
  description = "Executes a physical DELETE operation on table records. WARNING: This database uses soft delete patterns (__deleted flag). Consider using update_data to set __deleted = 1 instead for most use cases.";

  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to delete from"
      },
      whereClause: {
        type: "string",
        description: "WHERE clause to identify which records to delete. REQUIRED for safety."
      },
      confirmDelete: {
        type: "boolean",
        description: "Must be set to true to confirm physical deletion. Physical deletes are permanent and bypass the soft delete pattern."
      }
    },
    required: ["tableName", "whereClause", "confirmDelete"],
  } as any;

  async run(params: any) {
    try {
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
