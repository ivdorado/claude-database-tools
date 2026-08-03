import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface ExecuteStoredProcParams {
  procedureName: string;
  parameters?: Record<string, any>;
}

export class ExecuteStoredProc {
  async execute(params: ExecuteStoredProcParams): Promise<OperationResult> {
    try {
      // A stored procedure's body is opaque to us here — it can write, delete
      // or drop just as easily as a raw INSERT/DELETE/DROP statement, so it
      // must respect the same readonly gate as the other write operations.
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { procedureName, parameters } = params;

      // Validate procedure name format
      if (!/^[\w\d_\.]+$/.test(procedureName)) {
        throw new Error("Invalid procedure name format");
      }

      const request = new sql.Request();

      // Add input parameters if provided
      if (parameters && typeof parameters === 'object') {
        for (const [key, value] of Object.entries(parameters)) {
          request.input(key, value);
        }
      }

      // Execute stored procedure
      const result = await request.execute(procedureName);

      return {
        success: true,
        message: `Stored procedure '${procedureName}' executed successfully`,
        recordsets: result.recordsets,
        recordsetCount: result.recordsets.length,
        rowsAffected: result.rowsAffected,
        returnValue: result.returnValue,
        output: result.output
      };

    } catch (error) {
      console.error("Error executing stored procedure:", error);
      return {
        success: false,
        message: `Failed to execute stored procedure: ${error}`,
      };
    }
  }
}
