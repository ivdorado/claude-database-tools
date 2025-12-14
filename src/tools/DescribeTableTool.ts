import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { TableSchema, ColumnInfo, IndexInfo, ForeignKeyInfo, PrimaryKeyInfo } from "../types.js";

export class DescribeTableTool implements Tool {
  [key: string]: any;
  name = "describe_table";
  description = "Describes the complete schema of a specified MSSQL Database table, including columns, types, constraints, indexes, and foreign keys.";

  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to describe (can include schema: schema.table)"
      },
    },
    required: ["tableName"],
  } as any;

  async run(params: { tableName: string }) {
    try {
      const { tableName } = params;

      // Parse schema and table name
      const parts = tableName.split('.');
      const schemaName = parts.length === 2 ? parts[0] : 'dbo';
      const tableOnly = parts.length === 2 ? parts[1] : tableName;

      const request = new sql.Request();

      // Get column information
      const columnsQuery = `
        SELECT
          c.name AS name,
          t.name AS dataType,
          c.max_length AS maxLength,
          c.precision,
          c.scale,
          c.is_nullable AS isNullable,
          c.is_identity AS isIdentity,
          c.is_computed AS isComputed,
          dc.definition AS defaultValue,
          cc.definition AS computedDefinition,
          c.collation_name AS collationName
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
        WHERE c.object_id = OBJECT_ID(@schemaTable)
        ORDER BY c.column_id
      `;

      request.input("schemaTable", `${schemaName}.${tableOnly}`);
      const columnsResult = await request.query(columnsQuery);

      const columns: ColumnInfo[] = columnsResult.recordset.map((col: any) => ({
        name: col.name,
        dataType: col.dataType,
        maxLength: col.maxLength === -1 ? null : col.maxLength,
        precision: col.precision,
        scale: col.scale,
        isNullable: col.isNullable,
        defaultValue: col.defaultValue,
        isIdentity: col.isIdentity,
        isComputed: col.isComputed,
        computedDefinition: col.computedDefinition,
        collationName: col.collationName
      }));

      // Get primary key
      const pkQuery = `
        SELECT
          kc.name AS constraintName,
          COL_NAME(ic.object_id, ic.column_id) AS columnName
        FROM sys.key_constraints kc
        INNER JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
        WHERE kc.type = 'PK' AND kc.parent_object_id = OBJECT_ID(@schemaTable)
        ORDER BY ic.key_ordinal
      `;

      const pkRequest = new sql.Request();
      pkRequest.input("schemaTable", `${schemaName}.${tableOnly}`);
      const pkResult = await pkRequest.query(pkQuery);

      let primaryKey: PrimaryKeyInfo | null = null;
      if (pkResult.recordset.length > 0) {
        primaryKey = {
          name: pkResult.recordset[0].constraintName,
          columns: pkResult.recordset.map((r: any) => r.columnName)
        };

        // Mark PK columns
        columns.forEach(col => {
          if (primaryKey && primaryKey.columns.includes(col.name)) {
            col.isPrimaryKey = true;
          }
        });
      }

      // Get foreign keys
      const fkQuery = `
        SELECT
          fk.name AS constraintName,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS columnName,
          OBJECT_SCHEMA_NAME(fkc.referenced_object_id) + '.' + OBJECT_NAME(fkc.referenced_object_id) AS referencedTable,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referencedColumn
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE fk.parent_object_id = OBJECT_ID(@schemaTable)
      `;

      const fkRequest = new sql.Request();
      fkRequest.input("schemaTable", `${schemaName}.${tableOnly}`);
      const fkResult = await fkRequest.query(fkQuery);

      const foreignKeys: ForeignKeyInfo[] = fkResult.recordset.map((fk: any) => ({
        name: fk.constraintName,
        column: fk.columnName,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn
      }));

      // Mark FK columns
      columns.forEach(col => {
        const fk = foreignKeys.find(f => f.column === col.name);
        if (fk) {
          col.isForeignKey = true;
          col.foreignKeyRef = {
            table: fk.referencedTable,
            column: fk.referencedColumn
          };
        }
      });

      // Get indexes
      const indexQuery = `
        SELECT
          i.name AS indexName,
          i.type_desc AS indexType,
          i.is_unique AS isUnique,
          COL_NAME(ic.object_id, ic.column_id) AS columnName,
          ic.key_ordinal
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        WHERE i.object_id = OBJECT_ID(@schemaTable) AND i.type > 0
        ORDER BY i.name, ic.key_ordinal
      `;

      const indexRequest = new sql.Request();
      indexRequest.input("schemaTable", `${schemaName}.${tableOnly}`);
      const indexResult = await indexRequest.query(indexQuery);

      // Group indexes by name
      const indexMap = new Map<string, IndexInfo>();
      indexResult.recordset.forEach((row: any) => {
        if (!indexMap.has(row.indexName)) {
          indexMap.set(row.indexName, {
            name: row.indexName,
            type: row.indexType,
            isUnique: row.isUnique,
            columns: []
          });
        }
        indexMap.get(row.indexName)!.columns.push(row.columnName);
      });

      const indexes: IndexInfo[] = Array.from(indexMap.values());

      const tableSchema: TableSchema = {
        schema: schemaName,
        table: tableOnly,
        columns,
        primaryKey,
        indexes,
        foreignKeys
      };

      return {
        success: true,
        message: `Table schema retrieved successfully for ${schemaName}.${tableOnly}`,
        schema: tableSchema
      };

    } catch (error) {
      console.error("Error describing table:", error);
      return {
        success: false,
        message: `Failed to describe table: ${error}`,
      };
    }
  }
}
