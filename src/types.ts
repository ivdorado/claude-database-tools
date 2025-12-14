export interface ColumnInfo {
  name: string;
  dataType: string;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  isNullable: boolean;
  defaultValue: string | null;
  isIdentity: boolean;
  isComputed: boolean;
  computedDefinition: string | null;
  collationName: string | null;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyRef?: { table: string; column: string } | null;
}

export interface IndexInfo {
  name: string;
  type: string;
  isUnique: boolean;
  columns: string[];
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface PrimaryKeyInfo {
  name: string;
  columns: string[];
}

export interface TableSchema {
  schema: string;
  table: string;
  columns: ColumnInfo[];
  primaryKey: PrimaryKeyInfo | null;
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
}
