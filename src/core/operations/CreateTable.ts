import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface ColumnDefinition {
  name: string;
  type: string;
}

export interface CreateTableParams {
  tableName: string;
  columns: ColumnDefinition[];
}

export class CreateTable {
  async execute(params: CreateTableParams): Promise<OperationResult> {
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName, columns } = params;

      if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error("'columns' must be a non-empty array");
      }

      const columnDefs = columns.map((col: any) => `[${col.name}] ${col.type}`).join(", ");
      const query = `CREATE TABLE ${tableName} (${columnDefs})`;

      await new sql.Request().query(query);

      return {
        success: true,
        message: `Table '${tableName}' created successfully.`
      };
    } catch (error) {
      console.error("Error creating table:", error);
      return {
        success: false,
        message: `Failed to create table: ${error}`
      };
    }
  }
}
