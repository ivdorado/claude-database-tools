---
description: Remove a SQL Server connection (clients.json)
argument-hint: [clientId]
allowed-tools: Bash(node:*)
---

Remove a multi-client SQL Server connection. The client id is `$1` if given, otherwise ask which one (run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-list` first to show the options).

Confirm with the user before deleting — this is destructive and there's no undo. Once confirmed, run:
```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-remove <clientId> --confirm
```

Report the result.
