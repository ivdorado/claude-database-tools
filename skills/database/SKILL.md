---
name: database
description: Use this skill when working with SQL Server databases, creating tables, writing queries, or modifying database schema. Triggers on database work, SQL queries, table creation, or schema modifications.
---

# SQL Server Database Skill

This skill provides SQL Server database operations through CLI tools.

All examples below use `sql-cli` for brevity. When running as an installed
plugin, invoke the same commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" <command>...`
instead, since `sql-cli` is only on PATH if it was separately `npm install -g`'d.

## Available Operations

### Read Operations
- **list-tables**: List all tables in the database, optionally filtered by schema
- **describe-table**: Get comprehensive table schema including columns, indexes, and foreign keys
- **read-data**: Execute SELECT queries with built-in SQL injection prevention
- **get-ddl**: Generate CREATE TABLE DDL for existing tables
- **get-alter-ddl**: Generate ALTER TABLE DDL for modifying tables

### Write Operations
- **insert-data**: Insert single or multiple records
- **update-data**: Update records with required WHERE clause
- **delete-data**: Delete records (requires confirmation flag)
- **create-table**: Create new tables with column definitions
- **create-index**: Create indexes on tables
- **drop-table**: Drop tables from the database
- **exec-proc**: Execute stored procedures with parameters

## Usage Examples

### Listing Tables
```bash
# List all tables
sql-cli list-tables

# List tables in specific schemas
sql-cli list-tables dbo sales
```

### Describing Table Structure
```bash
sql-cli describe-table dbo.Users
```

### Querying Data
```bash
sql-cli read-data "SELECT * FROM dbo.Users WHERE active = 1"
```

### Inserting Data
```bash
# Single record
sql-cli insert-data dbo.Users '{"name": "John", "email": "john@example.com"}'

# Multiple records
sql-cli insert-data dbo.Users '[{"name": "John"}, {"name": "Jane"}]'
```

### Updating Data
```bash
sql-cli update-data dbo.Users '{"status": "active"}' "id = 123"
```

### Deleting Data
```bash
sql-cli delete-data dbo.Users "id = 123" --confirm
```

### Creating Tables
```bash
sql-cli create-table dbo.NewTable '[
  {"name": "id", "type": "INT", "nullable": false, "primaryKey": true, "identity": true},
  {"name": "name", "type": "NVARCHAR(100)", "nullable": false},
  {"name": "created_at", "type": "DATETIME2", "nullable": false, "default": "GETUTCDATE()"}
]'
```

### Creating Indexes
```bash
sql-cli create-index dbo.Users IX_Users_Email '["email"]' --unique
```

### Generating DDL
```bash
# Get CREATE TABLE script
sql-cli get-ddl dbo.Users

# Get ALTER TABLE script
sql-cli get-alter-ddl dbo.Users
```

## Managing Connections

Connections are never stored inside the plugin — they live in a per-user
config directory (Windows: `%APPDATA%\claude-database-tools`; macOS:
`~/Library/Application Support/claude-database-tools`; Linux:
`$XDG_CONFIG_HOME/claude-database-tools` or `~/.config/claude-database-tools`).
Prefer the `/db-add-client`, `/db-edit-client`, `/db-remove-client`, and
`/db-list-clients` slash commands over editing that JSON by hand — they wrap
the CLI subcommands below and validate input before writing.

### Multi-client connections (`clients.json`)
```bash
sql-cli client-list
sql-cli client-show <clientId>
sql-cli client-add <clientId> --server <server> --database <database> --user <user> --password <password>
sql-cli client-add <clientId> --server <server> --database <database> --auth-type azure-ad-device-code [--tenant-id <id>] [--client-id <id>]
sql-cli client-update <clientId> --database <newDatabase>
sql-cli client-update <clientId> --unset tenantId clientId --user <user> --password <password>
sql-cli client-remove <clientId> --confirm
```
When `clients.json` has at least one entry, every SQL-facing tool/command
requires a `--client <clientId>` (CLI) or `client` (MCP tool) argument.

### Single default connection (`.env`)
Only used when no `--client`/`client` argument is given:
```bash
sql-cli default-show
sql-cli default-set --server <server> --database <database> --user <user> --password <password>
```

## Security Notes

- SELECT queries are validated for dangerous SQL patterns
- All write operations use parameterized queries
- UPDATE and DELETE require WHERE clauses
- Query results are limited to 10,000 records
- Set `READONLY_MODE=true` in .env (or as an env var) to disable write operations
- Connection credentials are stored in plaintext in the config directory above, same as before — never inside the plugin's own files
