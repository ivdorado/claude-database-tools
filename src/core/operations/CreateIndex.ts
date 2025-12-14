import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface CreateIndexParams {
  tableName: string;
  indexName: string;
  columns: string[];
  isUnique?: boolean;
  isClustered?: boolean;
}

export class CreateIndex {
  async execute(params: CreateIndexParams): Promise<OperationResult> {
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName, indexName, columns, isUnique = false, isClustered = false } = params;

      let indexType = isClustered ? "CLUSTERED" : "NONCLUSTERED";
      if (isUnique) {
        indexType = `UNIQUE ${indexType}`;
      }

      const columnNames = columns.map((c: string) => `[${c}]`).join(", ");
      const request = new sql.Request();
      const query = `CREATE ${indexType} INDEX [${indexName}] ON ${tableName} (${columnNames})`;

      await request.query(query);

      return {
        success: true,
        message: `Index [${indexName}] created successfully on table [${tableName}]`,
        details: {
          tableName,
          indexName,
          columns,
          isUnique,
          isClustered
        }
      };
    } catch (error) {
      console.error("Error creating index:", error);
      return {
        success: false,
        message: `Failed to create index: ${error}`,
      };
    }
  }
}
