import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ExecuteStoredProcTool implements Tool {
  [key: string]: any;
  name = "execute_stored_proc";
  description = "Executes a stored procedure with optional parameters. Supports input parameters and returns result sets, output parameters, and return values.";

  inputSchema = {
    type: "object",
    properties: {
      procedureName: {
        type: "string",
        description: "Name of the stored procedure to execute (can include schema: schema.procname)"
      },
      parameters: {
        type: "object",
        description: "Object with parameter name/value pairs. Example: { 'accountId': '123', 'groupId': '456' }",
        additionalProperties: true
      }
    },
    required: ["procedureName"],
  } as any;

  async run(params: any) {
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
