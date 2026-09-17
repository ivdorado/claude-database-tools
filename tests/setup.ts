import { mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';

// Point the config-dir resolver at a throwaway directory for the whole test
// run, so importing src/core/connection.ts or src/core/clients.ts never
// reads from or writes to the developer's real AppData/config directory.
process.env.CLAUDE_DB_TOOLS_HOME = mkdtempSync(path.join(os.tmpdir(), 'claude-database-tools-test-'));

// Also point the one-time legacy-migration source at an empty throwaway
// directory, so tests never pick up this checkout's own clients.json/.env
// (which may hold the developer's real, already-migrated config).
process.env.CLAUDE_DB_TOOLS_LEGACY_ROOT = mkdtempSync(path.join(os.tmpdir(), 'claude-database-tools-test-legacy-'));
