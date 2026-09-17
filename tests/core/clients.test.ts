import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import type * as ClientsModule from '../../src/core/clients.js';

let tmpHome: string;
const originalHome = process.env.CLAUDE_DB_TOOLS_HOME;
let clients: typeof ClientsModule;

beforeEach(async () => {
  vi.resetModules();
  tmpHome = mkdtempSync(path.join(os.tmpdir(), 'claude-database-tools-clients-'));
  process.env.CLAUDE_DB_TOOLS_HOME = tmpHome;
  clients = await import('../../src/core/clients.js');
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) {
    delete process.env.CLAUDE_DB_TOOLS_HOME;
  } else {
    process.env.CLAUDE_DB_TOOLS_HOME = originalHome;
  }
});

describe('clients', () => {
  it('reports single-client mode when no clients.json exists yet', () => {
    expect(clients.isMultiClientMode()).toBe(false);
    expect(clients.listClientIds()).toEqual([]);
  });

  it('adds a SQL-auth client and reads it back', () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p' });
    expect(clients.isMultiClientMode()).toBe(true);
    expect(clients.listClientIds()).toEqual(['acme']);
    expect(clients.getClientConnectionConfig('acme')).toEqual({ server: 's', database: 'd', user: 'u', password: 'p' });
  });

  it('rejects a SQL-auth client missing user/password', () => {
    expect(() => clients.addClient('acme', { server: 's', database: 'd' })).toThrow(/user.*password/i);
  });

  it('accepts an azure-ad-device-code client without user/password', () => {
    clients.addClient('acme', { server: 's', database: 'd', authType: 'azure-ad-device-code' });
    expect(clients.getClientConnectionConfig('acme').authType).toBe('azure-ad-device-code');
  });

  it('rejects adding a client id that already exists', () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p' });
    expect(() => clients.addClient('acme', { server: 's2', database: 'd2', user: 'u', password: 'p' }))
      .toThrow(/already exists/);
  });

  it('throws for an unknown client id', () => {
    expect(() => clients.getClientConnectionConfig('missing')).toThrow(/Unknown client/);
  });

  it('updates only the given fields, leaving the rest untouched', () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p', port: 1433 });
    const updated = clients.updateClient('acme', { database: 'd2' });
    expect(updated).toEqual({ server: 's', database: 'd2', user: 'u', password: 'p', port: 1433 });
  });

  it('unsets fields before applying the patch', () => {
    clients.addClient('acme', { server: 's', database: 'd', authType: 'azure-ad-device-code', tenantId: 't', clientId: 'c' });
    const updated = clients.updateClient('acme', { user: 'u', password: 'p' }, ['authType', 'tenantId', 'clientId']);
    expect(updated).toEqual({ server: 's', database: 'd', user: 'u', password: 'p' });
  });

  it('throws when updating an unknown client', () => {
    expect(() => clients.updateClient('missing', { database: 'x' })).toThrow(/Unknown client/);
  });

  it('re-validates the merged config on update', () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p' });
    expect(() => clients.updateClient('acme', {}, ['user', 'password'])).toThrow(/user.*password/i);
  });

  it('removes a client', () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p' });
    clients.removeClient('acme');
    expect(clients.listClientIds()).toEqual([]);
    expect(clients.isMultiClientMode()).toBe(false);
  });

  it('throws when removing an unknown client', () => {
    expect(() => clients.removeClient('missing')).toThrow(/Unknown client/);
  });

  it('persists across a fresh module load (survives process restart)', async () => {
    clients.addClient('acme', { server: 's', database: 'd', user: 'u', password: 'p' });
    vi.resetModules();
    const reloaded = await import('../../src/core/clients.js');
    expect(reloaded.listClientIds()).toEqual(['acme']);
  });
});
