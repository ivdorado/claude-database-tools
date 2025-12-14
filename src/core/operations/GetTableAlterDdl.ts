import sql from "mssql";
import { OperationResult } from "../types.js";
import { DescribeTable } from "./DescribeTable.js";

export interface GetTableAlterDdlParams {
  tableName: string;
}

export class GetTableAlterDdl {
  async execute(params: GetTableAlterDdlParams): Promise<OperationResult> {
    try {
      const { tableName } = params;

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

      const alterStatements: string[] = [];

      // Generate ALTER TABLE ADD statements for each column
      for (const col of schema.columns) {
        // Skip identity and computed columns (can't be added via simple ALTER)
        if (col.isIdentity || col.isComputed) {
          alterStatements.push(`-- Note: ${col.name} is ${col.isIdentity ? 'an IDENTITY' : 'a COMPUTED'} column and requires special handling`);
          continue;
        }

        let stmt = `ALTER TABLE ${fullTableName} ADD [${col.name}] ${this.formatDataType(col)}`;

        // Add collation if present
        if (col.collationName && (col.dataType === 'nvarchar' || col.dataType === 'varchar' || col.dataType === 'char' || col.dataType === 'nchar')) {
          stmt += ` COLLATE ${col.collationName}`;
        }

        // Add default constraint
        if (col.defaultValue) {
          stmt += ` DEFAULT ${col.defaultValue}`;
        }

        // Add nullability
        stmt += col.isNullable ? ' NULL' : ' NOT NULL';

        stmt += ';';
        alterStatements.push(stmt);
      }

      // Add primary key constraint if exists
      if (schema.primaryKey) {
        const pkColumns = schema.primaryKey.columns.map((c: string) => `[${c}]`).join(', ');
        alterStatements.push(`ALTER TABLE ${fullTableName} ADD CONSTRAINT [${schema.primaryKey.name}] PRIMARY KEY (${pkColumns});`);
      }

      // Add foreign key constraints
      for (const fk of schema.foreignKeys) {
        alterStatements.push(`ALTER TABLE ${fullTableName} ADD CONSTRAINT [${fk.name}] FOREIGN KEY ([${fk.column}]) REFERENCES ${fk.referencedTable}([${fk.referencedColumn}]);`);
      }

      // Add index statements
      for (const idx of schema.indexes) {
        // Skip primary key index
        if (schema.primaryKey && idx.name === schema.primaryKey.name) {
          continue;
        }

        const indexType = idx.isUnique ? 'UNIQUE ' + idx.type : idx.type;
        const columns = idx.columns.map((c: string) => `[${c}]`).join(', ');
        alterStatements.push(`CREATE ${indexType} INDEX [${idx.name}] ON ${fullTableName} (${columns});`);
      }

      const ddl = alterStatements.join('\n');

      return {
        success: true,
        message: `ALTER DDL generated successfully for table ${fullTableName}`,
        ddl: ddl
      };

    } catch (error) {
      console.error("Error generating ALTER TABLE DDL:", error);
      return {
        success: false,
        message: `Failed to generate ALTER TABLE DDL: ${error}`,
      };
    }
  }

  private formatDataType(col: any): string {
    const dataType = col.dataType;

    // Handle special types
    if (dataType === 'timestamp' || dataType === 'rowversion') {
      return dataType;
    }

    // Handle types with max length
    if (dataType === 'nvarchar' || dataType === 'varchar' || dataType === 'char' || dataType === 'nchar' || dataType === 'binary' || dataType === 'varbinary') {
      if (col.maxLength === -1 || col.maxLength === null) {
        return `${dataType}(max)`;
      }
      const length = (dataType === 'nvarchar' || dataType === 'nchar') ? col.maxLength / 2 : col.maxLength;
      return `${dataType}(${length})`;
    }

    // Handle decimal/numeric types
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
