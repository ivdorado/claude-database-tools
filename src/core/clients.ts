import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENTS_FILE = path.join(__dirname, '..', '..', 'clients.json');

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

  if (!existsSync(CLIENTS_FILE)) {
    clientsCache = {};
    return clientsCache;
  }

  const raw = readFileSync(CLIENTS_FILE, 'utf-8');
  clientsCache = JSON.parse(raw);
  return clientsCache!;
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
