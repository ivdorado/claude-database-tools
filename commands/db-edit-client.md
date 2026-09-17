---
description: Edit an existing SQL Server connection (clients.json)
argument-hint: [clientId]
allowed-tools: Bash(node:*), AskUserQuestion
---

Edit an existing multi-client SQL Server connection. The client id is `$1` if given, otherwise ask which one (run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-list` first to show the options).

Run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-show <clientId>` to show the user its current (password-masked) settings, then ask which fields to change. Only pass flags for fields that are actually changing — `client-update` leaves everything else untouched.

If the user is switching auth type (e.g. from `sql` to `azure-ad-device-code` or back), pass `--unset` for the fields that no longer apply so they don't linger in the stored config:
- Switching to `azure-ad-device-code`: `--unset user password passwordEnv`
- Switching to `sql`: `--unset authType tenantId clientId` and provide `--user` plus `--password` or `--password-env`
- Switching between `--password` and `--password-env` on an existing `sql` client: `--unset` whichever field is being dropped, since they're mutually exclusive (e.g. `--password-env NEW_VAR --unset password`)

Same password-in-conversation caveat as adding a client: warn once, briefly, before asking for a new `--password`; offer `--password-env <VAR>` as an alternative that keeps the actual value out of `clients.json` and this conversation, or the user can edit the JSON file directly instead if they'd rather not.

Run:
```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-update <clientId> [--server <server>] [--database <database>] [--user <user>] [--password <password>] [--password-env <var>] [--port <port>] [--encrypt] [--trust-server-certificate] [--auth-type <sql|azure-ad-device-code>] [--tenant-id <tenantId>] [--client-id <clientId>] [--unset <field> [<field>...]]
```

Report the result. On failure, show the error and ask what to change.
