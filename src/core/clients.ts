import { readFileSync, existsSync, writeFileSync } from 'fs';
import { ensureConfigDir, ensureMigratedConfig, getClientsFilePath } from './paths.js';

export interface ClientConnectionConfig {
  server: string;
  database: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  // 'sql' (default, requires user/password) or 'azure-ad-device-code' to force
  // an interactive Azure AD login with MFA (requires tenantId/clientId instead).
  authType?: 'sql' | 'azure-ad-device-code';
  user?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
}

let clientsCache: Record<string, ClientConnectionConfig> | null = null;

function loadClients(): Record<string, ClientConnectionConfig> {
  if (clientsCache) {
    return clientsCache;
  }

  ensureMigratedConfig();

  const file = getClientsFilePath();
  if (!existsSync(file)) {
    clientsCache = {};
    return clientsCache;
  }

  const raw = readFileSync(file, 'utf-8');
  clientsCache = JSON.parse(raw);
  return clientsCache!;
}

function persistClients(clients: Record<string, ClientConnectionConfig>): void {
  ensureConfigDir();
  writeFileSync(getClientsFilePath(), JSON.stringify(clients, null, 2) + '\n', 'utf-8');
  clientsCache = clients;
}

function validateClientConfig(config: ClientConnectionConfig): void {
  if (!config.server) {
    throw new Error("'server' is required");
  }
  if (!config.database) {
    throw new Error("'database' is required");
  }
  if (config.authType === 'azure-ad-device-code') {
    return;
  }
  if (!config.user || !config.password) {
    throw new Error("'user' and 'password' are required unless authType is 'azure-ad-device-code'");
  }
}

// Multi-client mode only activates when clients.json exists, so single-client
// setups configured via .env keep working exactly as before.
export function isMultiClientMode(): boolean {
  return Object.keys(loadClients()).length > 0;
}

export function listClientIds(): string[] {
  return Object.keys(loadClients());
}

export function getClientConnectionConfig(clientId: string): ClientConnectionConfig {
  const clients = loadClients();
  const config = clients[clientId];
  if (!config) {
    throw new Error(
      `Unknown client '${clientId}'. Configured clients: ${Object.keys(clients).join(', ') || '(none)'}`
    );
  }
  return config;
}

export function getClientsFileLocation(): string {
  return getClientsFilePath();
}

export function addClient(clientId: string, config: ClientConnectionConfig): void {
  const clients = loadClients();
  if (clients[clientId]) {
    throw new Error(`Client '${clientId}' already exists. Use 'client-update' to modify it.`);
  }
  validateClientConfig(config);
  persistClients({ ...clients, [clientId]: config });
}

// Shallow-merges patch onto the existing config. Keys in `unset` are deleted
// first, so switching auth modes (e.g. dropping tenantId/clientId when going
// back to SQL auth) doesn't leave stale fields behind.
export function updateClient(
  clientId: string,
  patch: Partial<ClientConnectionConfig>,
  unset: (keyof ClientConnectionConfig)[] = []
): ClientConnectionConfig {
  const clients = loadClients();
  const existing = clients[clientId];
  if (!existing) {
    throw new Error(`Unknown client '${clientId}'. Configured clients: ${Object.keys(clients).join(', ') || '(none)'}`);
  }
  const merged: ClientConnectionConfig = { ...existing };
  for (const key of unset) {
    delete merged[key];
  }
  Object.assign(merged, patch);
  validateClientConfig(merged);
  persistClients({ ...clients, [clientId]: merged });
  return merged;
}

export function removeClient(clientId: string): void {
  const clients = loadClients();
  if (!clients[clientId]) {
    throw new Error(`Unknown client '${clientId}'. Configured clients: ${Object.keys(clients).join(', ') || '(none)'}`);
  }
  const rest = { ...clients };
  delete rest[clientId];
  persistClients(rest);
}
