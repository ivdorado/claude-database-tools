import sql from 'mssql';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DeviceCodeCredential, type DeviceCodeInfo, type TokenCredential } from '@azure/identity';
import { isMultiClientMode, getClientConnectionConfig } from './clients.js';

// Get the directory where this file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (two levels up from core/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let globalSqlPool: sql.ConnectionPool | null = null;
// Identifies which client globalSqlPool is currently connected to. 'default'
// is used for the single-client (.env-based) mode.
let currentClientId: string | null = null;
// Keyed by `${tenantId}:${clientId}` so each Azure AD app registration/tenant
// combination (one per client in multi-client mode) gets its own cached
// credential and MSAL token cache, instead of clients clobbering each other.
const deviceCodeCredentials = new Map<string, DeviceCodeCredential>();
// The device/user code + verification URL for a flow that's mid-flight,
// resolved as soon as MSAL has requested it from Azure AD (fast — no wait for
// the user to actually complete the browser login). Cleared once that login
// settles (success or failure), so the next call starts a fresh flow.
const pendingDeviceFlows = new Map<string, Promise<DeviceCodeInfo>>();
const pendingDeviceFlowResolvers = new Map<string, { resolve: (info: DeviceCodeInfo) => void; reject: (err: unknown) => void }>();

// mssql deep-clones the connection config (via rfdc) before handing it to
// tedious. rfdc only copies own enumerable properties and doesn't preserve
// prototypes, so a bare DeviceCodeCredential instance loses its (prototype)
// getToken method in the clone. Wrapping getToken as an own property of a
// plain object survives the clone since functions are copied by reference.
const AZURE_SQL_SCOPE = 'https://database.windows.net/.default';

// Device-code phishing relies on a URL/code showing up that the victim didn't
// expect and can't verify. We can't fix "didn't expect" (that's inherent to
// an MCP tool call), but we can and do verify the URL: MSAL is the only thing
// that produces it, straight from Microsoft's own token endpoint, so pin it
// to Microsoft's known device-login hosts and refuse to surface anything else.
const TRUSTED_DEVICE_LOGIN_HOSTS = new Set([
  'microsoft.com',
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.windows.net',
]);

function assertTrustedVerificationHost(info: DeviceCodeInfo): void {
  let hostname: string;
  try {
    hostname = new URL(info.verificationUri).hostname.toLowerCase();
  } catch {
    throw new Error(`Device-code flow returned an unparseable verification URL: ${info.verificationUri}`);
  }
  if (!TRUSTED_DEVICE_LOGIN_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to surface this device-code login: verification URL host '${hostname}' is not a ` +
      `recognized Microsoft identity domain (expected one of ${[...TRUSTED_DEVICE_LOGIN_HOSTS].join(', ')}). ` +
      `Do not open the URL or enter the code. This may indicate a compromised dependency.`
    );
  }
}

// Thrown instead of blocking a tool call for the whole MFA login. The MCP
// tool handler surfaces this message as the tool's result text so Claude can
// show the login URL/code directly in the chat; the caller is expected to
// retry the same operation once they've completed the browser login.
export class AuthPendingError extends Error {
  constructor(info: DeviceCodeInfo, label: string) {
    super(
      `Autenticación con MFA (Azure AD) requerida para el cliente '${label}'. ` +
      `Este código y URL provienen directamente del endpoint oficial de device-code de Microsoft Entra ID ` +
      `(vía el SDK @azure/identity, llamado en el propio proceso del servidor MCP local) — no los genera ` +
      `este servidor MCP, y ya se ha verificado que el dominio de la URL pertenece a Microsoft antes de mostrarlo. ` +
      `Abre ${info.verificationUri} e introduce el código: ${info.userCode}. ` +
      `Vuelve a intentar esta misma operación en cuanto termines de iniciar sesión.`
    );
    this.name = 'AuthPendingError';
  }
}

function getOrCreateDeviceCodeCredential(key: string, tenantId?: string, clientId?: string): DeviceCodeCredential {
  let credential = deviceCodeCredentials.get(key);
  if (!credential) {
    credential = new DeviceCodeCredential({
      tenantId: tenantId || undefined,
      clientId: clientId || undefined,
      // Never let getToken() silently block on interactive login: a cache
      // miss should fail fast so we can hand control back to the caller
      // instead of hanging the whole MCP tool call on a human completing MFA.
      disableAutomaticAuthentication: true,
      userPromptCallback: (info: DeviceCodeInfo) => {
        const pending = pendingDeviceFlowResolvers.get(key);
        try {
          assertTrustedVerificationHost(info);
        } catch (err) {
          console.error(`[azure-ad] ${err instanceof Error ? err.message : err}`);
          pending?.reject(err);
          return;
        }
        // Written to stderr: stdout is the MCP JSON-RPC channel.
        console.error(`\n[azure-ad] Autenticación con MFA requerida.`);
        console.error(`[azure-ad] Abre ${info.verificationUri} e introduce el código: ${info.userCode}\n`);
        pending?.resolve(info);
      }
    });
    deviceCodeCredentials.set(key, credential);
  }
  return credential;
}

async function getDeviceCodeCredential(tenantId?: string, clientId?: string, label = 'default'): Promise<TokenCredential> {
  const key = `${tenantId ?? ''}:${clientId ?? ''}`;
  const credential = getOrCreateDeviceCodeCredential(key, tenantId, clientId);

  // Fast path: a token is already cached from a previously completed login.
  try {
    await credential.getToken(AZURE_SQL_SCOPE);
    return { getToken: credential.getToken.bind(credential) };
  } catch {
    // No cached token (or it's expired) — fall through to the interactive
    // flow below instead of throwing this generic cache-miss error.
  }

  let infoPromise = pendingDeviceFlows.get(key);
  if (!infoPromise) {
    infoPromise = new Promise<DeviceCodeInfo>((resolve, reject) => {
      pendingDeviceFlowResolvers.set(key, { resolve, reject });
    });
    pendingDeviceFlows.set(key, infoPromise);

    // authenticate() always allows the interactive prompt (unlike getToken(),
    // which we've configured to never do so). Deliberately not awaited here:
    // it runs in the background for as long as the user takes to complete
    // the browser login, and this function returns as soon as the code/URL
    // themselves are available.
    credential.authenticate(AZURE_SQL_SCOPE)
      .catch(() => {
        // Surfaced to the caller on their next retry: getToken()'s cache
        // check above will simply miss again and restart the flow.
      })
      .finally(() => {
        pendingDeviceFlows.delete(key);
        pendingDeviceFlowResolvers.delete(key);
      });
  }

  const info = await infoPromise;
  throw new AuthPendingError(info, label);
}

export async function getSqlConfig(clientId?: string): Promise<sql.config> {
  if (clientId) {
    const client = getClientConnectionConfig(clientId);
    const clientBaseConfig = {
      server: client.server,
      database: client.database,
      port: client.port ?? 1433,
      options: {
        // Azure SQL requires TLS regardless of the configured encrypt flag.
        encrypt: client.authType === 'azure-ad-device-code' ? true : client.encrypt ?? false,
        trustServerCertificate: client.trustServerCertificate ?? false,
        enableArithAbort: true
      },
      connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30') * 1000,
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '60') * 1000
    };

    if (client.authType === 'azure-ad-device-code') {
      return {
        ...clientBaseConfig,
        authentication: {
          type: 'token-credential',
          options: { credential: await getDeviceCodeCredential(client.tenantId, client.clientId, clientId) }
        }
      } as sql.config;
    }

    return {
      ...clientBaseConfig,
      user: client.user,
      password: client.password
    } as sql.config;
  }

  const authType = process.env.SQL_AUTH_TYPE || 'sql';

  const baseConfig = {
    server: process.env.SQL_SERVER!,
    database: process.env.SQL_DATABASE!,
    port: parseInt(process.env.SQL_PORT || '1433'),
    options: {
      // Azure SQL requires TLS regardless of SQL_ENCRYPT.
      encrypt: authType === 'azure-ad-device-code' ? true : process.env.SQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true
    },
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30') * 1000,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '60') * 1000
  };

  if (authType === 'azure-ad-device-code') {
    return {
      ...baseConfig,
      authentication: {
        type: 'token-credential',
        options: { credential: await getDeviceCodeCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID) }
      }
    } as sql.config;
  }

  return {
    ...baseConfig,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!
  };
}

export async function ensureSqlConnection(clientId?: string): Promise<sql.ConnectionPool> {
  const targetClientId = clientId ?? 'default';

  if (globalSqlPool && globalSqlPool.connected && currentClientId === targetClientId) {
    return globalSqlPool;
  }

  if (globalSqlPool) {
    await globalSqlPool.close();
    globalSqlPool = null;
  }

  const config = await getSqlConfig(clientId);
  globalSqlPool = await sql.connect(config);
  currentClientId = targetClientId;
  return globalSqlPool;
}

export function getSqlPool(): sql.ConnectionPool {
  if (!globalSqlPool) {
    throw new Error('SQL connection not initialized');
  }
  return globalSqlPool;
}

export async function closeSqlConnection(): Promise<void> {
  if (globalSqlPool) {
    await globalSqlPool.close();
    globalSqlPool = null;
    currentClientId = null;
  }
}

// Secure by default: writes are blocked unless READONLY_MODE is explicitly
// set to 'false'. An unset/misspelled/missing env var must never accidentally
// enable writes.
export function isReadonlyMode(): boolean {
  return process.env.READONLY_MODE !== 'false';
}
