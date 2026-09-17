import { readFileSync, existsSync, writeFileSync } from 'fs';
import { ensureConfigDir, ensureMigratedConfig, getClientsFilePath, restrictToOwner } from './paths.js';

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
  // Name of an environment variable holding the password instead — an
  // alternative to storing it in clients.json directly. Mutually exclusive
  // with `password`. Resolved at connection time via resolveClientPassword().
  passwordEnv?: string;
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
  const file = getClientsFilePath();
  writeFileSync(file, JSON.stringify(clients, null, 2) + '\n', 'utf-8');
  restrictToOwner(file);
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
  if (config.password && config.passwordEnv) {
    throw new Error("Specify only one of 'password' or 'passwordEnv', not both");
  }
  if (!config.user || (!config.password && !config.passwordEnv)) {
    throw new Error("'user' and either 'password' or 'passwordEnv' are required unless authType is 'azure-ad-device-code'");
  }
}

// Resolves the actual password to connect with: the literal `password` if
// set, otherwise the value of the env var named by `passwordEnv`. Kept out of
// validateClientConfig since that runs at add/update time (before the env var
// necessarily exists) while this runs at connection time.
export function resolveClientPassword(config: ClientConnectionConfig): string | undefined {
  if (config.password !== undefined) {
    return config.password;
  }
  if (config.passwordEnv) {
    const value = process.env[config.passwordEnv];
    if (!value) {
      throw new Error(`Environment variable '${config.passwordEnv}' referenced by passwordEnv is not set`);
    }
    return value;
  }
  return undefined;
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
