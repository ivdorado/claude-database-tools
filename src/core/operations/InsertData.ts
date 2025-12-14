import sql from "mssql";
import { OperationResult } from "../types.js";
import { isReadonlyMode } from "../connection.js";

export interface InsertDataParams {
  tableName: string;
  data: Record<string, any> | Record<string, any>[];
}

export class InsertData {
  async execute(params: InsertDataParams): Promise<OperationResult> {
    try {
      if (isReadonlyMode()) {
        return {
          success: false,
          message: "Operation denied: Database is in READONLY mode",
          error: "READONLY_MODE"
        };
      }

      const { tableName, data } = params;

      // Check if data is an array (multiple records) or single object
      const isMultipleRecords = Array.isArray(data);
      const records = isMultipleRecords ? data : [data];

      if (records.length === 0) {
        return {
          success: false,
          message: "No data provided for insertion",
        };
      }

      // Validate that all records have the same columns
      const firstRecordColumns = Object.keys(records[0]).sort();
      for (let i = 1; i < records.length; i++) {
        const currentColumns = Object.keys(records[i]).sort();
        if (JSON.stringify(firstRecordColumns) !== JSON.stringify(currentColumns)) {
          return {
            success: false,
            message: `Column mismatch: Record ${i + 1} has different columns than the first record. Expected columns: [${firstRecordColumns.join(', ')}], but got: [${currentColumns.join(', ')}]`,
          };
        }
      }

      const columns = firstRecordColumns.map(c => `[${c}]`).join(", ");
      const request = new sql.Request();

      if (isMultipleRecords) {
        // Multiple records insert using VALUES clause
        const valueClauses: string[] = [];
        records.forEach((record, recordIndex) => {
          const valueParams = firstRecordColumns
            .map((column, columnIndex) => `@value${recordIndex}_${columnIndex}`)
            .join(", ");
          valueClauses.push(`(${valueParams})`);

          // Add parameters for this record
          firstRecordColumns.forEach((column, columnIndex) => {
            request.input(`value${recordIndex}_${columnIndex}`, record[column]);
          });
        });

        const query = `INSERT INTO ${tableName} (${columns}) VALUES ${valueClauses.join(", ")}`;
        await request.query(query);

        return {
          success: true,
          message: `Successfully inserted ${records.length} record${records.length > 1 ? 's' : ''} into ${tableName}`,
          recordsInserted: records.length,
        };
      } else {
        // Single record insert
        const values = firstRecordColumns
          .map((column, index) => `@value${index}`)
          .join(", ");

        firstRecordColumns.forEach((column, index) => {
          request.input(`value${index}`, records[0][column]);
        });

        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
        await request.query(query);

        return {
          success: true,
          message: `Successfully inserted 1 record into ${tableName}`,
          recordsInserted: 1,
        };
      }
    } catch (error) {
      console.error("Error inserting data:", error);
      return {
        success: false,
        message: `Failed to insert data: ${error}`,
      };
    }
  }
}
