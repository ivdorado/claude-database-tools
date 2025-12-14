#!/usr/bin/env node
import { Command } from 'commander';
import { ensureSqlConnection, closeSqlConnection } from '../core/connection.js';
import { registerCommands } from './commands.js';

const program = new Command();

program
  .name('sql-cli')
  .description('SQL Server database operations CLI')
  .version('1.0.0');

// Register all commands
registerCommands(program);

// Connect to database before execution
program.hook('preAction', async () => {
  try {
    await ensureSqlConnection();
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      message: `Failed to connect to database: ${error}`,
      error: 'CONNECTION_FAILED'
    }, null, 2));
    process.exit(2);
  }
});

// Close connection after execution
program.hook('postAction', async () => {
  try {
    await closeSqlConnection();
  } catch (error) {
    console.error(`Warning: Failed to close database connection: ${error}`);
  }
});

program.parse();
