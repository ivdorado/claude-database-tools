---
description: Add a new SQL Server connection (clients.json)
argument-hint: [clientId]
allowed-tools: Bash(node:*), AskUserQuestion
---

Add a new multi-client SQL Server connection. The client id is `$1` if given, otherwise ask the user for a short identifier (e.g. `clientA`, `acme-prod`).

Before running anything, check the id isn't already taken by running:
`node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-list`

Collect the connection details from the user (ask directly in chat, or use AskUserQuestion for the auth-type choice):
1. `server` (host name or IP) — required
2. `database` (database name) — required
3. Auth type: `sql` (username/password) or `azure-ad-device-code` (interactive MFA login, no password stored)
   - If `sql`: ask for `user`, then either `password` or an env var name to use instead (`passwordEnv`) — see below
   - If `azure-ad-device-code`: `tenantId`/`clientId` are optional — only ask if the user mentions a specific Azure AD tenant or app registration; otherwise omit them
4. `port` (default 1433), `encrypt`, `trustServerCertificate` — only ask if the user wants non-default values, otherwise use CLI defaults

Warn the user once, briefly, that a password given directly (`--password`) will pass through this conversation and be stored in plaintext at the per-user config path the CLI reports back — same as if they'd hand-edited the file themselves. If they'd rather not type it here, offer `--password-env <VAR>` instead: `clients.json` then stores only the variable's name and the CLI never sees the actual value, which the user sets in their own environment. They can also edit the JSON file directly instead (the CLI's output/`client-show` reports its exact path).

Then run exactly one of:
```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-add <clientId> --server <server> --database <database> --user <user> --password <password> [--port <port>] [--encrypt] [--trust-server-certificate]
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-add <clientId> --server <server> --database <database> --user <user> --password-env <VAR> [--port <port>] [--encrypt] [--trust-server-certificate]
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-add <clientId> --server <server> --database <database> --auth-type azure-ad-device-code [--tenant-id <tenantId>] [--client-id <clientId>] [--port <port>]
```

Report the result (the command's JSON output already masks the password). On failure, show the error message and ask what to change rather than retrying blindly.
