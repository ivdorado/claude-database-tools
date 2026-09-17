import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR_NAME = 'claude-database-tools';

// This package's own root (two levels up from dist/core, or src/core when
// running unbuilt). Only used to locate pre-plugin-conversion clients.json/
// .env files left at the project root, for one-time migration below.
// Overridable so tests never touch this checkout's own clients.json/.env.
function getLegacyRoot(): string {
  return process.env.CLAUDE_DB_TOOLS_LEGACY_ROOT || path.join(__dirname, '..', '..');
}

// Per-user, per-machine config directory — deliberately outside the plugin's
// own install path, since a plugin's directory is reinstallable/overwritable
// and shouldn't hold credentials. Overridable for tests and for users who
// want to point multiple installs at a shared config.
export function getConfigDir(): string {
  const override = process.env.CLAUDE_DB_TOOLS_HOME;
  if (override) {
    return override;
  }

  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, APP_DIR_NAME);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }

  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, APP_DIR_NAME);
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  restrictToOwner(dir, true);
}

// Best-effort lockdown of a config file/dir to the current OS user, since
// clients.json/.env hold plaintext credentials. POSIX: a plain chmod. On
// Windows, chmod only flips the read-only attribute rather than touching
// ACLs, so icacls is used instead to drop inherited permissions and grant
// only the current account. Never throws — a restrictive umask, a locked-
// down icacls policy, or running as a user icacls can't resolve shouldn't
// block reading/writing config, so failures are just logged to stderr.
export function restrictToOwner(targetPath: string, isDirectory = false): void {
  try {
    if (process.platform === 'win32') {
      const username = os.userInfo().username;
      execFileSync('icacls', [targetPath, '/inheritance:r', '/grant:r', `${username}:F`], { stdio: 'ignore' });
    } else {
      chmodSync(targetPath, isDirectory ? 0o700 : 0o600);
    }
  } catch (error) {
    console.error(`[claude-database-tools] Could not restrict permissions on '${targetPath}': ${error}`);
  }
}

export function getClientsFilePath(): string {
  return path.join(getConfigDir(), 'clients.json');
}

export function getEnvFilePath(): string {
  return path.join(getConfigDir(), '.env');
}

let migrationChecked = false;

function migrateLegacyFile(oldPath: string, newPath: string, label: string): void {
  if (existsSync(newPath) || !existsSync(oldPath)) {
    return;
  }
  ensureConfigDir();
  copyFileSync(oldPath, newPath);
  restrictToOwner(newPath);
  console.error(
    `[claude-database-tools] Migrated ${label} from '${oldPath}' to '${newPath}'. ` +
    `The old file is no longer read from here and can be deleted.`
  );
}

// Copies clients.json/.env from the package root (where they lived before
// this project became a plugin) into the per-user config directory, once per
// process, the first time either file is looked up. No-op once the new files
// exist, or if there was never a legacy file to begin with.
export function ensureMigratedConfig(): void {
  if (migrationChecked) {
    return;
  }
  migrationChecked = true;
  try {
    const legacyRoot = getLegacyRoot();
    migrateLegacyFile(path.join(legacyRoot, 'clients.json'), getClientsFilePath(), 'clients.json');
    migrateLegacyFile(path.join(legacyRoot, '.env'), getEnvFilePath(), '.env');
  } catch (error) {
    console.error(`[claude-database-tools] Config migration check failed: ${error}`);
  }
}
