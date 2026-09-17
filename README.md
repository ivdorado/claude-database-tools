# claude-database-tools

SQL Server CLI and MCP server for Claude Code.

## Why This Tool?

This project is an alternative to Microsoft's official [mssql MCP server](https://github.com/microsoft/mssql-mcp-server) with some key advantages:

- **SQL Server Authentication**: Supports SQL Server authentication (username/password), not just Windows/Entra authentication. Ideal for development environments, Docker containers, or scenarios where integrated auth isn't available.

- **CLI-First Design**: The CLI tools can be used directly from a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills), giving you database access without requiring MCP server setup. This is useful when you want simpler configuration or need to work in environments where MCP servers are problematic.

- **MCP Server Included**: Also provides an MCP server if you prefer that integration approach.

### What This Fork Adds Over [`cyronius/claude-database-tools`](https://github.com/cyronius/claude-database-tools)

This repo started as a fork of the upstream project above. Since then it has diverged into:

| Area | Upstream | This fork |
|------|----------|-----------|
| Auth | SQL auth only (username/password) | + Azure AD/Entra ID login with MFA (`azure-ad-device-code`), per client, with device-code verification-URL host allowlisting against phishing |
| Connections | One connection via `.env` | Multi-client mode (`clients.json`): any number of SQL Server/Azure SQL connections, selected per tool call via a `client` argument, plus a `list_clients` discovery tool |
| Read-only default | `READONLY` — behavior when unset/misconfigured isn't specified | `READONLY_MODE` fails closed: writes are blocked unless it's explicitly set to `"false"`, checked both in tool advertisement and in each write operation |
| Credential storage | `.env` inside the cloned repo itself | Per-user config directory outside the plugin/repo (`%APPDATA%`, `~/Library/Application Support`, or `$XDG_CONFIG_HOME`), auto-migrated from the old location, locked to the OS user (`chmod`/`icacls`), with an optional `passwordEnv` indirection so `clients.json` never has to hold the literal password |
| Packaging | Manual clone + build + hand-edit `~/.claude/mcp.json` | Installable Claude Code plugin (`.claude-plugin/plugin.json` + `.mcp.json`) with a `database` skill and `/db-add-client`, `/db-edit-client`, `/db-remove-client`, `/db-list-clients` slash commands |
| Test coverage | Core CLI/MCP/security suite | + dedicated suites for multi-client config and config-directory permissions |

## Features

- **CLI Tool**: Command-line interface for SQL Server operations
- **MCP Server**: Model Context Protocol server for Claude integration (experimental)
- **Claude Code Plugin**: Installable plugin with a `database` skill and `/db-*` slash commands to manage connections
- **Multi-Client**: Add/edit/remove any number of SQL Server/Azure SQL connections, stored outside the plugin in a per-user config directory
- **Security**: Built-in SQL injection prevention and query validation
- **Operations**: List tables, describe schemas, query data, insert/update/delete records, DDL generation

## Installation

### As a Claude Code plugin (recommended)

This repo is itself a Claude Code plugin (`.claude-plugin/plugin.json` + `.mcp.json`), including the `database` skill and the `/db-add-client`, `/db-edit-client`, `/db-remove-client`, `/db-list-clients` slash commands.

```bash
git clone https://github.com/cyronius/claude-database-tools.git
cd claude-database-tools
npm install
npm run build
```

Then, from Claude Code:

```
/plugin marketplace add /path/to/claude-database-tools
/plugin install claude-database-tools
```

Restart Claude Code. The MCP server, skill, and slash commands are all discovered automatically — no manual `~/.claude/mcp.json` editing needed.

### As a standalone CLI

Same clone/install/build steps as above; then use `sql-cli` as documented below without installing it as a plugin.

## Configuration

Connection details are never stored inside this repo/plugin — they live in a per-user config directory, so reinstalling or updating the plugin never touches your credentials:

| OS | Config directory |
|----|-------------------|
| Windows | `%APPDATA%\claude-database-tools` |
| macOS | `~/Library/Application Support/claude-database-tools` |
| Linux | `$XDG_CONFIG_HOME/claude-database-tools` (or `~/.config/claude-database-tools`) |

Override with the `CLAUDE_DB_TOOLS_HOME` environment variable if you want a different location.

If you have an older `clients.json`/`.env` sitting at the project root from before this became a plugin, the first CLI/MCP invocation copies it into the new location automatically (and tells you where, on stderr) — the old file is no longer read afterwards and can be deleted.

The config directory and both files are locked down to the current OS user on every write (`chmod 700`/`600` on macOS/Linux, an `icacls` ACL reset on Windows) so other local accounts can't read your credentials. This is best-effort: it never blocks reading/writing config if it fails (e.g. an unusual ACL policy), and it doesn't protect against another process running as your own account.

### Single default connection

Manage it with the CLI instead of hand-editing a file:

```bash
node dist/cli/index.js default-set --server localhost --database your_database --user your_username --password your_password
node dist/cli/index.js default-show
```

This writes `SQL_SERVER`/`SQL_DATABASE`/`SQL_USER`/`SQL_PASSWORD`/etc. to `<config dir>/.env`. `.env.example` at the repo root documents every supported key if you'd rather edit that file by hand at `<config dir>/.env` directly. `READONLY_MODE` and the timeout settings live in the same file.

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
| `client-list` | List configured multi-client connection ids |
| `client-show <clientId>` | Show a client's config (password masked) |
| `client-add <clientId> [options]` | Add a multi-client connection ([Multi-Client Mode](#multi-client-mode)) |
| `client-update <clientId> [options]` | Update fields on an existing multi-client connection |
| `client-remove <clientId> --confirm` | Remove a multi-client connection |
| `default-show` | Show the single default connection (password masked) |
| `default-set [options]` | Set the single default connection ([Configuration](#configuration)) |

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

If installed as a plugin (see [Installation](#installation)), the server starts automatically from this repo's own `.mcp.json` — nothing to configure. Credentials come from the config directory described above (`default-set`/`client-add`), not from `.mcp.json`.

To wire it up manually instead (e.g. without the plugin), add to your `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["/path/to/claude-database-tools/dist/index.js"]
    }
  }
}
```

Restart Claude Code to load the MCP server. `READONLY_MODE` and connection settings are still read from `<config dir>/.env` (see [Configuration](#configuration)); set them there rather than in `mcp.json`'s `env` block, or override in the `env` block if you'd rather not manage a separate file for this one variable.

### Available MCP Tools

**Read-Only** (always available, and the only tools available by default — see [Security](#security)):
- `list_tables` - List tables
- `describe_table` - Get table schema
- `read_data` - Execute SELECT queries
- `get_table_ddl` - Generate CREATE TABLE DDL
- `get_table_alter_ddl` - Generate ALTER TABLE DDL

**Write** (only available when `READONLY_MODE` is explicitly set to `"false"`):
- `insert_data` - Insert records
- `update_data` - Update records
- `delete_data` - Delete records
- `create_table` - Create tables
- `create_index` - Create indexes
- `drop_table` - Drop tables
- `execute_stored_proc` - Execute stored procedures

### Multi-Client Mode

By default the MCP server connects to a single SQL Server instance configured via the default `.env`/environment variables. To let one MCP server multiplex between several clients' SQL Server/Azure SQL instances, add entries to `clients.json` — via the CLI or, if installed as a plugin, the `/db-add-client`, `/db-edit-client`, `/db-remove-client`, `/db-list-clients` slash commands, rather than hand-editing the file:

```bash
# SQL auth
node dist/cli/index.js client-add clientA --server clienta-sqlserver.database.windows.net --database ClientA_DB --user clienta_user --password clienta_password --port 1433 --encrypt

# Azure AD with MFA (device code), default tenant/app registration
node dist/cli/index.js client-add clientC --server clientc-sqlserver.database.windows.net --database ClientC_DB --auth-type azure-ad-device-code

# Azure AD with MFA, explicit tenant/app registration
node dist/cli/index.js client-add clientD --server clientd-sqlserver.database.windows.net --database ClientD_DB --auth-type azure-ad-device-code --tenant-id clientd-azure-tenant-id --client-id clientd-app-registration-client-id

node dist/cli/index.js client-list
node dist/cli/index.js client-show clientA
node dist/cli/index.js client-update clientA --database ClientA_DB_v2
node dist/cli/index.js client-remove clientA --confirm
```

`clients.example.json` at the repo root still documents the on-disk shape if you'd rather edit `<config dir>/clients.json` (see [Configuration](#configuration)) by hand.

When `clients.json` exists and is non-empty, every SQL-facing tool gains a required `client` argument, and a new `list_clients` tool is exposed so Claude can discover which clients are configured. Claude will ask (or you can tell it) which client's database to query before running a tool.

A client can force Azure AD login with MFA instead of SQL auth via `--auth-type azure-ad-device-code` instead of `--user`/`--password` (`clientC`/`clientD` above); `encrypt` is then forced to `true` regardless of the configured value. `--tenant-id`/`--client-id` are optional — omitted, `@azure/identity` falls back to the multi-tenant `organizations` endpoint and the public Azure CLI client ID, which works out of the box for most tenants. Set them explicitly (`clientD` above) when the signed-in user belongs to more than one tenant, or when Conditional Access policies require sign-in through your own Azure AD app registration. The server prints a verification URL and code to stderr the first time a given client is queried, same as the single-client `.env` flow (see `SQL_AUTH_TYPE` below). Each client's device-code login is cached independently, so switching between an MFA client and a SQL-auth client doesn't force a re-login.

`clients.json` lives outside the repo/plugin entirely (see [Configuration](#configuration)) and holds plaintext credentials for every configured client, same as `.env`. This is a v1: the server keeps a single active connection and reconnects when the `client` argument changes, so it's meant for one conversation at a time, not concurrent multi-client traffic. A future iteration should move credentials to a secret store (e.g. Azure Key Vault) instead of a local file.

To avoid putting a password in `clients.json` at all, set `--password-env <VAR>` instead of `--password` when adding/updating a client — the config then stores only the variable's name, and the actual value is read from that environment variable at connection time:

```bash
node dist/cli/index.js client-add clientA --server clienta-sqlserver.database.windows.net --database ClientA_DB --user clienta_user --password-env CLIENTA_SQL_PASSWORD --port 1433 --encrypt
```

`--password` and `--password-env` are mutually exclusive. Switching a client from one to the other requires `--unset` for whichever field you're dropping (e.g. `client-update clientA --password-env CLIENTA_SQL_PASSWORD --unset password`).

## Security

- **SQL Injection Prevention**: SELECT queries are validated against dangerous keywords and patterns
- **Parameterized Queries**: All INSERT/UPDATE/DELETE operations use parameterized queries
- **WHERE Clause Required**: UPDATE and DELETE operations require WHERE clauses
- **Query Limits**: Maximum query length of 10,000 characters, result sets limited to 10,000 records
- **Read-Only by Default**: Writes (`insert_data`, `update_data`, `delete_data`, `create_table`, `create_index`, `drop_table`, `execute_stored_proc`) are blocked unless `READONLY_MODE` is explicitly set to `"false"` — an unset, misspelled, or missing value always means read-only, both in which tools are advertised to Claude and in each write operation's own check (so a direct tool call can't bypass it either)

## License

MIT
