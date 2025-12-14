import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface DropTableParams {
  tableName: string;
}

export class DropTable {
  async execute(params: DropTableParams): Promise<OperationResult> {
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName } = params;

      // Basic validation to prevent SQL injection
      if (!/^[\w\d_\.]+$/.test(tableName)) {
        throw new Error("Invalid table name.");
      }

      const query = `DROP TABLE ${tableName}`;
      await new sql.Request().query(query);

      return {
        success: true,
        message: `Table '${tableName}' dropped successfully.`
      };
    } catch (error) {
      console.error("Error dropping table:", error);
      return {
        success: false,
        message: `Failed to drop table: ${error}`
      };
    }
  }
}
