import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

let tmpHome: string;
const originalHome = process.env.CLAUDE_DB_TOOLS_HOME;

beforeEach(() => {
  vi.resetModules();
  tmpHome = mkdtempSync(path.join(os.tmpdir(), 'claude-database-tools-paths-'));
  process.env.CLAUDE_DB_TOOLS_HOME = tmpHome;
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) {
    delete process.env.CLAUDE_DB_TOOLS_HOME;
  } else {
    process.env.CLAUDE_DB_TOOLS_HOME = originalHome;
  }
});

describe('paths', () => {
  it('honors the CLAUDE_DB_TOOLS_HOME override for the config dir', async () => {
    const { getConfigDir } = await import('../../src/core/paths.js');
    expect(getConfigDir()).toBe(tmpHome);
  });

  it('resolves clients.json and .env inside the config dir', async () => {
    const { getClientsFilePath, getEnvFilePath } = await import('../../src/core/paths.js');
    expect(getClientsFilePath()).toBe(path.join(tmpHome, 'clients.json'));
    expect(getEnvFilePath()).toBe(path.join(tmpHome, '.env'));
  });

  it('ensureConfigDir creates the directory if missing', async () => {
    rmSync(tmpHome, { recursive: true, force: true });
    expect(existsSync(tmpHome)).toBe(false);
    const { ensureConfigDir } = await import('../../src/core/paths.js');
    ensureConfigDir();
    expect(existsSync(tmpHome)).toBe(true);
  });

  it('never touches an already-populated config dir on migration', async () => {
    mkdirSync(tmpHome, { recursive: true });
    writeFileSync(path.join(tmpHome, 'clients.json'), '{"kept":true}', 'utf-8');
    const { ensureMigratedConfig, getClientsFilePath } = await import('../../src/core/paths.js');
    ensureMigratedConfig();
    expect(JSON.parse(readFileSync(getClientsFilePath(), 'utf-8'))).toEqual({ kept: true });
  });
});
