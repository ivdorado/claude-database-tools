import sql from "mssql";
import { OperationResult } from "../types.js";
import { DescribeTable } from "./DescribeTable.js";

export interface GetTableDdlParams {
  tableName: string;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
}

export class GetTableDdl {
  async execute(params: GetTableDdlParams): Promise<OperationResult> {
    try {
      const { tableName, includeIndexes = true, includeConstraints = true } = params;

      // Use DescribeTable to get table schema
      const describeTool = new DescribeTable();
      const schemaResult = await describeTool.execute({ tableName });

      if (!schemaResult.success || !schemaResult.schema) {
        return {
          success: false,
          message: `Failed to retrieve table schema: ${schemaResult.message}`
        };
      }

      const schema = schemaResult.schema;
      const fullTableName = `[${schema.schema}].[${schema.table}]`;

      // Build column definitions
      const columnDefs: string[] = [];

      for (const col of schema.columns) {
        let colDef = `    [${col.name}] ${this.formatDataType(col)}`;

        // Add collation if present
        if (col.collationName && (col.dataType === 'nvarchar' || col.dataType === 'varchar' || col.dataType === 'char' || col.dataType === 'nchar')) {
          colDef += ` COLLATE ${col.collationName}`;
        }

        // Add default constraint inline if present
        if (col.defaultValue && !col.isComputed) {
          colDef += ` DEFAULT ${col.defaultValue}`;
        }

        // Add computed column definition
        if (col.isComputed && col.computedDefinition) {
          colDef += ` AS ${col.computedDefinition}`;
        }

        // Add nullability (except for computed columns and identity columns with defaults)
        if (!col.isComputed && !col.isIdentity) {
          colDef += col.isNullable ? ' NULL' : ' NOT NULL';
        } else if (!col.isComputed) {
          colDef += ' NOT NULL';
        }

        columnDefs.push(colDef);
      }

      // Add primary key constraint
      if (schema.primaryKey) {
        const pkColumns = schema.primaryKey.columns.map((c: string) => `[${c}]`).join(', ');
        columnDefs.push(`    CONSTRAINT [${schema.primaryKey.name}] PRIMARY KEY (${pkColumns})`);
      }

      // Add foreign key constraints if requested
      if (includeConstraints && schema.foreignKeys.length > 0) {
        for (const fk of schema.foreignKeys) {
          columnDefs.push(`    CONSTRAINT [${fk.name}] FOREIGN KEY ([${fk.column}]) REFERENCES ${fk.referencedTable}([${fk.referencedColumn}])`);
        }
      }

      // Build CREATE TABLE statement
      let ddl = `CREATE TABLE ${fullTableName} (\n`;
      ddl += columnDefs.join(',\n');
      ddl += '\n);';

      // Add index statements if requested
      const indexStatements: string[] = [];
      if (includeIndexes && schema.indexes.length > 0) {
        for (const idx of schema.indexes) {
          // Skip primary key index (already defined as constraint)
          if (schema.primaryKey && idx.name === schema.primaryKey.name) {
            continue;
          }

          const indexType = idx.isUnique ? 'UNIQUE ' + idx.type : idx.type;
          const columns = idx.columns.map((c: string) => `[${c}]`).join(', ');
          indexStatements.push(`CREATE ${indexType} INDEX [${idx.name}] ON ${fullTableName} (${columns});`);
        }
      }

      if (indexStatements.length > 0) {
        ddl += '\n\n' + indexStatements.join('\n');
      }

      return {
        success: true,
        message: `DDL generated successfully for table ${fullTableName}`,
        ddl: ddl
      };

    } catch (error) {
      console.error("Error generating table DDL:", error);
      return {
        success: false,
        message: `Failed to generate table DDL: ${error}`,
      };
    }
  }

  private formatDataType(col: any): string {
    const dataType = col.dataType;

    // Handle special types
    if (dataType === 'timestamp' || dataType === 'rowversion') {
      return dataType;
    }

    // Handle identity columns
    if (col.isIdentity) {
      return `${dataType} IDENTITY(1,1)`;
    }

    // Handle types with max length
    if (dataType === 'nvarchar' || dataType === 'varchar' || dataType === 'char' || dataType === 'nchar' || dataType === 'binary' || dataType === 'varbinary') {
      if (col.maxLength === -1 || col.maxLength === null) {
        return `${dataType}(max)`;
      }
      // For nvarchar/nchar, divide by 2 (SQL Server stores length in bytes)
      const length = (dataType === 'nvarchar' || dataType === 'nchar') ? col.maxLength / 2 : col.maxLength;
      return `${dataType}(${length})`;
    }

    // Handle decimal/numeric types with precision and scale
    if (dataType === 'decimal' || dataType === 'numeric') {
      if (col.precision && col.scale !== null) {
        return `${dataType}(${col.precision}, ${col.scale})`;
      }
    }

    // Handle datetime2, datetimeoffset, time with scale
    if (dataType === 'datetime2' || dataType === 'datetimeoffset' || dataType === 'time') {
      if (col.scale !== null && col.scale !== undefined) {
        return `${dataType}(${col.scale})`;
      }
    }

    return dataType;
  }
}
