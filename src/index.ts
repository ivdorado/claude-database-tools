#!/usr/bin/env node

// External imports
import * as dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Internal imports
import { ensureSqlConnection } from "./core/connection.js";
import { ListTablesTool } from "./tools/ListTablesTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
import { DeleteDataTool } from "./tools/DeleteDataTool.js";
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { GetTableDdlTool } from "./tools/GetTableDdlTool.js";
import { GetTableAlterDdlTool } from "./tools/GetTableAlterDdlTool.js";
import { ExecuteStoredProcTool } from "./tools/ExecuteStoredProcTool.js";

// Load environment variables
dotenv.config();

// Initialize tools
const listTablesTool = new ListTablesTool();
const describeTableTool = new DescribeTableTool();
const readDataTool = new ReadDataTool();
const insertDataTool = new InsertDataTool();
const updateDataTool = new UpdateDataTool();
const deleteDataTool = new DeleteDataTool();
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const dropTableTool = new DropTableTool();
const getTableDdlTool = new GetTableDdlTool();
const getTableAlterDdlTool = new GetTableAlterDdlTool();
const executeStoredProcTool = new ExecuteStoredProcTool();

// Initialize MCP server
const server = new Server(
  {
    name: "mssql-sqlauth-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Read READONLY env variable
const isReadOnly = process.env.READONLY === "true";

// Request handlers

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: isReadOnly
    ? [listTablesTool, readDataTool, describeTableTool, getTableDdlTool, getTableAlterDdlTool]
    : [
        listTablesTool,
        describeTableTool,
        readDataTool,
        insertDataTool,
        updateDataTool,
        deleteDataTool,
        createTableTool,
        createIndexTool,
        dropTableTool,
        getTableDdlTool,
        getTableAlterDdlTool,
        executeStoredProcTool
      ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case listTablesTool.name:
        result = await listTablesTool.run(args);
        break;
      case describeTableTool.name:
        if (!args || typeof args.tableName !== "string") {
          return {
            content: [{ type: "text", text: `Missing or invalid 'tableName' argument for describe_table tool.` }],
            isError: true,
          };
        }
        result = await describeTableTool.run(args as { tableName: string });
        break;
      case readDataTool.name:
        result = await readDataTool.run(args);
        break;
      case insertDataTool.name:
        result = await insertDataTool.run(args);
        break;
      case updateDataTool.name:
        result = await updateDataTool.run(args);
        break;
      case deleteDataTool.name:
        result = await deleteDataTool.run(args);
        break;
      case createTableTool.name:
        result = await createTableTool.run(args);
        break;
      case createIndexTool.name:
        result = await createIndexTool.run(args);
        break;
      case dropTableTool.name:
        result = await dropTableTool.run(args);
        break;
      case getTableDdlTool.name:
        result = await getTableDdlTool.run(args);
        break;
      case getTableAlterDdlTool.name:
        result = await getTableAlterDdlTool.run(args);
        break;
      case executeStoredProcTool.name:
        result = await executeStoredProcTool.run(args);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error occurred: ${error}` }],
      isError: true,
    };
  }
});

// Server startup
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr that the server is ready (required by MCP protocol)
    console.error("MCP server running on stdio");
  } catch (error) {
    console.error("Fatal error running server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});

// Wrap all tool handlers to ensure SQL connection before running
function wrapToolRun(tool: { run: (...args: any[]) => Promise<any> }) {
  const originalRun = tool.run.bind(tool);
  tool.run = async function (...args: any[]) {
    await ensureSqlConnection();
    return originalRun(...args);
  };
}

[
  listTablesTool,
  describeTableTool,
  readDataTool,
  insertDataTool,
  updateDataTool,
  deleteDataTool,
  createTableTool,
  createIndexTool,
  dropTableTool,
  getTableDdlTool,
  getTableAlterDdlTool,
  executeStoredProcTool
].forEach(wrapToolRun);
