# claude-database-tools

SQL Server CLI and MCP server for Claude Code.

## Why This Tool?

This project is an alternative to Microsoft's official [mssql MCP server](https://github.com/microsoft/mssql-mcp-server) with some key advantages:

- **SQL Server Authentication**: Supports SQL Server authentication (username/password), not just Windows/Entra authentication. Ideal for development environments, Docker containers, or scenarios where integrated auth isn't available.

- **CLI-First Design**: The CLI tools can be used directly from a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills), giving you database access without requiring MCP server setup. This is useful when you want simpler configuration or need to work in environments where MCP servers are problematic.

- **MCP Server Included**: Also provides an MCP server if you prefer that integration approach.

## Features

- **CLI Tool**: Command-line interface for SQL Server operations
- **MCP Server**: Model Context Protocol server for Claude integration (experimental)
- **Security**: Built-in SQL injection prevention and query validation
- **Operations**: List tables, describe schemas, query data, insert/update/delete records, DDL generation

## Installation

```bash
git clone https://github.com/cyronius/claude-database-tools.git
cd claude-database-tools
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure your database connection:

```bash
cp .env.example .env
```

Edit `.env` with your SQL Server credentials:

```
SQL_SERVER=localhost
SQL_DATABASE=your_database
SQL_USER=your_username
SQL_PASSWORD=your_password
SQL_PORT=1433
SQL_ENCRYPT=false
SQL_TRUST_SERVER_CERTIFICATE=true
```

## CLI Usage

After building, run commands with:

```bash
node dist/cli/index.js <command> [options]
```

Or install globally:

```bash
npm install -g .
sql-cli <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `list-tables [schemas...]` | List tables, optionally filtered by schema |
| `describe-table <tableName>` | Get table schema (columns, indexes, foreign keys) |
| `read-data <query>` | Execute a SELECT query |
| `insert-data <tableName> <jsonData>` | Insert records |
| `update-data <tableName> <updates> <whereClause>` | Update records |
| `delete-data <tableName> <whereClause> --confirm` | Delete records |
| `exec-proc <procedureName> [params]` | Execute stored procedure |
| `create-table <tableName> <columns>` | Create a new table |
| `drop-table <tableName>` | Drop a table |
| `create-index <tableName> <indexName> <columns>` | Create an index |
| `get-ddl <tableName>` | Generate CREATE TABLE DDL |
| `get-alter-ddl <tableName>` | Generate ALTER TABLE DDL |

### Examples

```bash
# List all tables
sql-cli list-tables

# List tables in specific schemas
sql-cli list-tables dbo sales

# Describe a table
sql-cli describe-table dbo.Users

# Query data
sql-cli read-data "SELECT TOP 10 * FROM dbo.Users"

# Insert data
sql-cli insert-data dbo.Users '{"name": "John", "email": "john@example.com"}'

# Update data
sql-cli update-data dbo.Users '{"name": "Jane"}' "id = 1"

# Delete data (requires --confirm flag)
sql-cli delete-data dbo.Users "id = 1" --confirm

# Get table DDL
sql-cli get-ddl dbo.Users
```

## MCP Server (Experimental)

> **Note**: The MCP server integration has not been fully tested. Use at your own risk.

The MCP server allows Claude Code to interact with your SQL Server database directly.

### Setup

Add to your `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["/path/to/claude-database-tools/dist/index.js"],
      "env": {
        "SQL_SERVER": "your-server",
        "SQL_DATABASE": "your-database",
        "SQL_USER": "your-username",
        "SQL_PASSWORD": "your-password",
        "SQL_ENCRYPT": "true",
        "READONLY": "true"
      }
    }
  }
}
```

Restart Claude Code to load the MCP server.

### Available MCP Tools

**Read-Only** (available when `READONLY=true`):
- `list_tables` - List tables
- `describe_table` - Get table schema
- `read_data` - Execute SELECT queries
- `get_table_ddl` - Generate CREATE TABLE DDL
- `get_table_alter_ddl` - Generate ALTER TABLE DDL

**Write** (requires `READONLY=false`):
- `insert_data` - Insert records
- `update_data` - Update records
- `delete_data` - Delete records
- `create_table` - Create tables
- `create_index` - Create indexes
- `drop_table` - Drop tables
- `execute_stored_proc` - Execute stored procedures

## Security

- **SQL Injection Prevention**: SELECT queries are validated against dangerous keywords and patterns
- **Parameterized Queries**: All INSERT/UPDATE/DELETE operations use parameterized queries
- **WHERE Clause Required**: UPDATE and DELETE operations require WHERE clauses
- **Query Limits**: Maximum query length of 10,000 characters, result sets limited to 10,000 records
- **Read-Only Mode**: Set `READONLY=true` to disable write operations

## License

MIT
