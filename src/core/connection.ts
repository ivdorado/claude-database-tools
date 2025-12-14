import sql from 'mssql';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory where this file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (two levels up from core/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let globalSqlPool: sql.ConnectionPool | null = null;

export async function getSqlConfig(): Promise<sql.config> {
  return {
    server: process.env.SQL_SERVER!,
    database: process.env.SQL_DATABASE!,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    port: parseInt(process.env.SQL_PORT || '1433'),
    options: {
      encrypt: process.env.SQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true
    },
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30') * 1000,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '60') * 1000
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
