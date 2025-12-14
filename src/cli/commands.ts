import { Command } from 'commander';
import { ListTables } from '../core/operations/ListTables.js';
import { ReadData } from '../core/operations/ReadData.js';
import { DescribeTable } from '../core/operations/DescribeTable.js';
import { InsertData } from '../core/operations/InsertData.js';
import { UpdateData } from '../core/operations/UpdateData.js';
import { DeleteData } from '../core/operations/DeleteData.js';
import { ExecuteStoredProc } from '../core/operations/ExecuteStoredProc.js';
import { CreateTable } from '../core/operations/CreateTable.js';
import { DropTable } from '../core/operations/DropTable.js';
import { CreateIndex } from '../core/operations/CreateIndex.js';
import { GetTableDdl } from '../core/operations/GetTableDdl.js';
import { GetTableAlterDdl } from '../core/operations/GetTableAlterDdl.js';
import { formatOutput } from './formatters.js';

export function registerCommands(program: Command): void {
  // List Tables
  program
    .command('list-tables [schemas...]')
    .description('List tables in database')
    .action(async (schemas: string[]) => {
      const op = new ListTables();
      const result = await op.execute({ schemas: schemas && schemas.length > 0 ? schemas : undefined });
      formatOutput(result);
    });

  // Describe Table
  program
    .command('describe-table <tableName>')
    .description('Describe table schema including columns, indexes, and foreign keys')
    .action(async (tableName: string) => {
      const op = new DescribeTable();
      const result = await op.execute({ tableName });
      formatOutput(result);
    });

  // Read Data
  program
    .command('read-data <query>')
    .description('Execute SELECT query')
    .action(async (query: string) => {
      const op = new ReadData();
      const result = await op.execute({ query });
      formatOutput(result);
    });

  // Insert Data
  program
    .command('insert-data <tableName> <jsonData>')
    .description('Insert data into table (single record or array of records as JSON)')
    .action(async (tableName: string, jsonData: string) => {
      try {
        const data = JSON.parse(jsonData);
        const op = new InsertData();
        const result = await op.execute({ tableName, data });
        formatOutput(result);
      } catch (error) {
        formatOutput({
          success: false,
          message: `Failed to parse JSON data: ${error}`,
          error: 'INVALID_JSON'
        });
      }
    });

  // Update Data
  program
    .command('update-data <tableName> <updates> <whereClause>')
    .description('Update data in table with WHERE clause')
    .action(async (tableName: string, updates: string, whereClause: string) => {
      try {
        const updateData = JSON.parse(updates);
        const op = new UpdateData();
        const result = await op.execute({ tableName, updates: updateData, whereClause });
        formatOutput(result);
      } catch (error) {
        formatOutput({
          success: false,
          message: `Failed to parse updates JSON: ${error}`,
          error: 'INVALID_JSON'
        });
      }
    });

  // Delete Data
  program
    .command('delete-data <tableName> <whereClause>')
    .option('--confirm', 'Confirm deletion (required for safety)')
    .description('Delete data from table (requires --confirm flag)')
    .action(async (tableName: string, whereClause: string, options: { confirm?: boolean }) => {
      const op = new DeleteData();
      const result = await op.execute({
        tableName,
        whereClause,
        confirmDelete: options.confirm === true
      });
      formatOutput(result);
    });

  // Execute Stored Procedure
  program
    .command('exec-proc <procedureName> [params]')
    .description('Execute stored procedure with optional JSON parameters')
    .action(async (procedureName: string, params?: string) => {
      try {
        const parameters = params ? JSON.parse(params) : undefined;
        const op = new ExecuteStoredProc();
        const result = await op.execute({ procedureName, parameters });
        formatOutput(result);
      } catch (error) {
        formatOutput({
          success: false,
          message: `Failed to parse parameters JSON: ${error}`,
          error: 'INVALID_JSON'
        });
      }
    });

  // Create Table
  program
    .command('create-table <tableName> <columns>')
    .description('Create new table with column definitions (JSON array)')
    .action(async (tableName: string, columns: string) => {
      try {
        const columnDefs = JSON.parse(columns);
        const op = new CreateTable();
        const result = await op.execute({ tableName, columns: columnDefs });
        formatOutput(result);
      } catch (error) {
        formatOutput({
          success: false,
          message: `Failed to parse columns JSON: ${error}`,
          error: 'INVALID_JSON'
        });
      }
    });

  // Drop Table
  program
    .command('drop-table <tableName>')
    .description('Drop table from database')
    .action(async (tableName: string) => {
      const op = new DropTable();
      const result = await op.execute({ tableName });
      formatOutput(result);
    });

  // Create Index
  program
    .command('create-index <tableName> <indexName> <columns>')
    .option('--unique', 'Create unique index')
    .option('--clustered', 'Create clustered index')
    .description('Create index on table (columns as JSON array)')
    .action(async (tableName: string, indexName: string, columns: string, options: { unique?: boolean, clustered?: boolean }) => {
      try {
        const columnList = JSON.parse(columns);
        const op = new CreateIndex();
        const result = await op.execute({
          tableName,
          indexName,
          columns: columnList,
          isUnique: options.unique === true,
          isClustered: options.clustered === true
        });
        formatOutput(result);
      } catch (error) {
        formatOutput({
          success: false,
          message: `Failed to parse columns JSON: ${error}`,
          error: 'INVALID_JSON'
        });
      }
    });

  // Get Table DDL
  program
    .command('get-ddl <tableName>')
    .option('--no-indexes', 'Exclude indexes from DDL')
    .option('--no-constraints', 'Exclude constraints from DDL')
    .description('Get CREATE TABLE DDL for table')
    .action(async (tableName: string, options: { indexes?: boolean, constraints?: boolean }) => {
      const op = new GetTableDdl();
      const result = await op.execute({
        tableName,
        includeIndexes: options.indexes !== false,
        includeConstraints: options.constraints !== false
      });
      formatOutput(result);
    });

  // Get Alter DDL
  program
    .command('get-alter-ddl <tableName>')
    .description('Get ALTER TABLE DDL for modifying table')
    .action(async (tableName: string) => {
      const op = new GetTableAlterDdl();
      const result = await op.execute({ tableName });
      formatOutput(result);
    });
}
