import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import {
  addClient,
  getClientConnectionConfig,
  getClientsFileLocation,
  listClientIds,
  removeClient,
  updateClient,
  type ClientConnectionConfig,
} from '../core/clients.js';
import { ensureConfigDir, ensureMigratedConfig, getEnvFilePath } from '../core/paths.js';
import { formatOutput } from './formatters.js';

// Command names handled in this file — the CLI's preAction hook skips
// connecting to a database for these, since they only read/write local
// config files.
export const CONFIG_COMMAND_NAMES = [
  'client-list',
  'client-show',
  'client-add',
  'client-update',
  'client-remove',
  'default-show',
  'default-set',
];

interface ConnectionOptions {
  server?: string;
  database?: string;
  user?: string;
  password?: string;
  port?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  authType?: string;
  tenantId?: string;
  clientId?: string;
  unset?: string[];
}

function addConnectionOptions(cmd: Command): Command {
  return cmd
    .option('--server <server>', 'SQL Server host name or IP')
    .option('--database <database>', 'Database name')
    .option('--user <user>', 'SQL auth username')
    .option('--password <password>', 'SQL auth password')
    .option('--port <port>', 'TCP port (default 1433)')
    .option('--encrypt', 'Enable TLS encryption')
    .option('--trust-server-certificate', 'Trust a self-signed/untrusted server certificate')
    .option('--auth-type <type>', "'sql' (default) or 'azure-ad-device-code'")
    .option('--tenant-id <tenantId>', 'Azure AD tenant id (azure-ad-device-code only)')
    .option('--client-id <clientId>', 'Azure AD app registration client id (azure-ad-device-code only)');
}

function parsePort(port?: string): number | undefined {
  if (port === undefined) return undefined;
  const parsed = parseInt(port, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid --port value: '${port}'`);
  }
  return parsed;
}

function buildFullConfig(opts: ConnectionOptions): ClientConnectionConfig {
  if (!opts.server || !opts.database) {
    throw new Error("'--server' and '--database' are required");
  }
  const config: ClientConnectionConfig = {
    server: opts.server,
    database: opts.database,
    port: parsePort(opts.port),
    encrypt: opts.encrypt === true,
    trustServerCertificate: opts.trustServerCertificate === true,
  };
  if (opts.authType === 'azure-ad-device-code') {
    config.authType = 'azure-ad-device-code';
    if (opts.tenantId) config.tenantId = opts.tenantId;
    if (opts.clientId) config.clientId = opts.clientId;
  } else {
    if (!opts.user || !opts.password) {
      throw new Error("'--user' and '--password' are required unless '--auth-type azure-ad-device-code' is set");
    }
    config.user = opts.user;
    config.password = opts.password;
  }
  return config;
}

function buildPatch(opts: ConnectionOptions): Partial<ClientConnectionConfig> {
  const patch: Partial<ClientConnectionConfig> = {};
  if (opts.server !== undefined) patch.server = opts.server;
  if (opts.database !== undefined) patch.database = opts.database;
  if (opts.user !== undefined) patch.user = opts.user;
  if (opts.password !== undefined) patch.password = opts.password;
  if (opts.port !== undefined) patch.port = parsePort(opts.port);
  if (opts.encrypt !== undefined) patch.encrypt = opts.encrypt;
  if (opts.trustServerCertificate !== undefined) patch.trustServerCertificate = opts.trustServerCertificate;
  if (opts.authType !== undefined) patch.authType = opts.authType as ClientConnectionConfig['authType'];
  if (opts.tenantId !== undefined) patch.tenantId = opts.tenantId;
  if (opts.clientId !== undefined) patch.clientId = opts.clientId;
  return patch;
}

function maskClient(config: ClientConnectionConfig): Record<string, unknown> {
  return {
    ...config,
    password: config.password ? '***' : undefined,
  };
}

export function registerClientCommands(program: Command): void {
  program
    .command('client-list')
    .description('List configured multi-client connection ids')
    .action(() => {
      const clients = listClientIds();
      formatOutput({
        success: true,
        message: `Found ${clients.length} configured client(s) in ${getClientsFileLocation()}.`,
        clients,
      });
    });

  program
    .command('client-show <clientId>')
    .description('Show a configured client (password masked)')
    .action((clientId: string) => {
      try {
        const config = getClientConnectionConfig(clientId);
        formatOutput({ success: true, message: `Client '${clientId}'.`, client: maskClient(config) });
      } catch (error) {
        formatOutput({ success: false, message: `${error}`, error: 'UNKNOWN_CLIENT' });
      }
    });

  addConnectionOptions(
    program
      .command('client-add <clientId>')
      .description('Add a new multi-client connection')
  ).action((clientId: string, opts: ConnectionOptions) => {
    try {
      const config = buildFullConfig(opts);
      addClient(clientId, config);
      formatOutput({
        success: true,
        message: `Added client '${clientId}' to ${getClientsFileLocation()}.`,
        client: maskClient(config),
      });
    } catch (error) {
      formatOutput({ success: false, message: `${error}`, error: 'CLIENT_ADD_FAILED' });
    }
  });

  addConnectionOptions(
    program
      .command('client-update <clientId>')
      .description('Update fields on an existing multi-client connection (only given flags change)')
      .option('--unset <fields...>', 'Field names to remove before applying other changes (e.g. tenantId clientId)')
  ).action((clientId: string, opts: ConnectionOptions) => {
    try {
      const patch = buildPatch(opts);
      const unset = (opts.unset ?? []) as (keyof ClientConnectionConfig)[];
      const merged = updateClient(clientId, patch, unset);
      formatOutput({
        success: true,
        message: `Updated client '${clientId}' in ${getClientsFileLocation()}.`,
        client: maskClient(merged),
      });
    } catch (error) {
      formatOutput({ success: false, message: `${error}`, error: 'CLIENT_UPDATE_FAILED' });
    }
  });

  program
    .command('client-remove <clientId>')
    .option('--confirm', 'Confirm removal (required for safety)')
    .description('Remove a multi-client connection (requires --confirm)')
    .action((clientId: string, options: { confirm?: boolean }) => {
      if (options.confirm !== true) {
        formatOutput({
          success: false,
          message: `Refusing to remove client '${clientId}' without --confirm.`,
          error: 'CONFIRMATION_REQUIRED',
        });
        return;
      }
      try {
        removeClient(clientId);
        formatOutput({ success: true, message: `Removed client '${clientId}' from ${getClientsFileLocation()}.` });
      } catch (error) {
        formatOutput({ success: false, message: `${error}`, error: 'CLIENT_REMOVE_FAILED' });
      }
    });

  program
    .command('default-show')
    .description('Show the single-client default connection (password masked)')
    .action(() => {
      ensureMigratedConfig();
      const file = getEnvFilePath();
      if (!existsSync(file)) {
        formatOutput({ success: true, message: `No default connection configured at ${file}.`, connection: null });
        return;
      }
      const vars = dotenv.parse(readFileSync(file));
      formatOutput({
        success: true,
        message: `Default connection from ${file}.`,
        connection: {
          server: vars.SQL_SERVER,
          database: vars.SQL_DATABASE,
          user: vars.SQL_USER,
          password: vars.SQL_PASSWORD ? '***' : undefined,
          port: vars.SQL_PORT,
          encrypt: vars.SQL_ENCRYPT,
          trustServerCertificate: vars.SQL_TRUST_SERVER_CERTIFICATE,
          authType: vars.SQL_AUTH_TYPE,
          tenantId: vars.AZURE_TENANT_ID,
          clientId: vars.AZURE_CLIENT_ID,
        },
      });
    });

  addConnectionOptions(
    program
      .command('default-set')
      .description('Set the single-client default connection (used when no --client is given)')
  ).action((opts: ConnectionOptions) => {
    try {
      const config = buildFullConfig(opts);
      ensureMigratedConfig();
      ensureConfigDir();
      const file = getEnvFilePath();
      const existing = existsSync(file) ? dotenv.parse(readFileSync(file)) : {};
      const updated: Record<string, string> = {
        ...existing,
        SQL_SERVER: config.server,
        SQL_DATABASE: config.database,
      };
      if (config.port !== undefined) updated.SQL_PORT = String(config.port);
      updated.SQL_ENCRYPT = config.encrypt ? 'true' : 'false';
      updated.SQL_TRUST_SERVER_CERTIFICATE = config.trustServerCertificate ? 'true' : 'false';
      if (config.authType === 'azure-ad-device-code') {
        updated.SQL_AUTH_TYPE = 'azure-ad-device-code';
        delete updated.SQL_USER;
        delete updated.SQL_PASSWORD;
        if (config.tenantId) updated.AZURE_TENANT_ID = config.tenantId; else delete updated.AZURE_TENANT_ID;
        if (config.clientId) updated.AZURE_CLIENT_ID = config.clientId; else delete updated.AZURE_CLIENT_ID;
      } else {
        delete updated.SQL_AUTH_TYPE;
        delete updated.AZURE_TENANT_ID;
        delete updated.AZURE_CLIENT_ID;
        updated.SQL_USER = config.user!;
        updated.SQL_PASSWORD = config.password!;
      }
      const lines = Object.entries(updated).map(([key, value]) => `${key}=${value}`);
      writeFileSync(file, lines.join('\n') + '\n', 'utf-8');
      formatOutput({
        success: true,
        message: `Wrote default connection to ${file}.`,
        connection: { ...config, password: config.password ? '***' : undefined },
      });
    } catch (error) {
      formatOutput({ success: false, message: `${error}`, error: 'DEFAULT_SET_FAILED' });
    }
  });
}
