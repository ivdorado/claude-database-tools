---
description: List configured SQL Server connections (clients.json)
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js client-list:*), Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js client-show:*), Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js default-show:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-list` and show the user the configured client ids and where the file lives.

If the user asks for details on one client, run
`node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" client-show <clientId>` (password is masked in the output, never ask for or print the real value).

Also run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" default-show` and mention the single-client default connection if one is configured, since it's used whenever no client id is given.
