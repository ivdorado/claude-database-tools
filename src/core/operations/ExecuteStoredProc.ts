import sql from "mssql";
import { OperationResult } from "../types.js";

export interface ExecuteStoredProcParams {
  procedureName: string;
  parameters?: Record<string, any>;
}

export class ExecuteStoredProc {
  async execute(params: ExecuteStoredProcParams): Promise<OperationResult> {
    try {
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
