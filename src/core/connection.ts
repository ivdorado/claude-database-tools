import sql from 'mssql';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DeviceCodeCredential, type DeviceCodeInfo, type TokenCredential } from '@azure/identity';

// Get the directory where this file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (two levels up from core/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let globalSqlPool: sql.ConnectionPool | null = null;
let deviceCodeCredential: DeviceCodeCredential | null = null;

// mssql deep-clones the connection config (via rfdc) before handing it to
// tedious. rfdc only copies own enumerable properties and doesn't preserve
// prototypes, so a bare DeviceCodeCredential instance loses its (prototype)
// getToken method in the clone. Wrapping getToken as an own property of a
// plain object survives the clone since functions are copied by reference.
const AZURE_SQL_SCOPE = 'https://database.windows.net/.default';

async function getDeviceCodeCredential(): Promise<TokenCredential> {
  if (!deviceCodeCredential) {
    deviceCodeCredential = new DeviceCodeCredential({
      tenantId: process.env.AZURE_TENANT_ID || undefined,
      clientId: process.env.AZURE_CLIENT_ID || undefined,
      userPromptCallback: (info: DeviceCodeInfo) => {
        // Written to stderr: stdout is the MCP JSON-RPC channel.
        console.error(`\n[azure-ad] Autenticación con MFA requerida.`);
        console.error(`[azure-ad] Abre ${info.verificationUri} e introduce el código: ${info.userCode}\n`);
      }
    });
  }
  const credential = deviceCodeCredential;

  // tedious's connectionTimeout wraps the whole connection attempt,
  // including the credential's getToken() call. A human completing a
  // device-code + MFA login can easily take longer than that, so acquire
  // (and let MSAL cache) the token here, unconstrained by connectionTimeout.
  // The getToken() call tedious makes afterwards then resolves from cache.
  await credential.getToken(AZURE_SQL_SCOPE);

  return { getToken: credential.getToken.bind(credential) };
}

export async function getSqlConfig(): Promise<sql.config> {
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
        options: { credential: await getDeviceCodeCredential() }
      }
    } as sql.config;
  }

  return {
    ...baseConfig,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!
  };
}

export async function ensureSqlConnection(): Promise<sql.ConnectionPool> {
  if (globalSqlPool && globalSqlPool.connected) {
    return globalSqlPool;
  }

  if (globalSqlPool && !globalSqlPool.connected) {
    await globalSqlPool.close();
  }

  const config = await getSqlConfig();
  globalSqlPool = await sql.connect(config);
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
  }
}

export function isReadonlyMode(): boolean {
  return process.env.READONLY_MODE === 'true';
}
