import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { listClientIds } from "../core/clients.js";

export class ListClientsTool implements Tool {
  [key: string]: any;
  name = "list_clients";
  description = "Lists the configured client identifiers. Use one of these values as the 'client' argument on other tools to target that client's SQL Server instance.";

  inputSchema = {
    type: "object",
    properties: {},
    required: [],
  } as any;

  async run(_params: any) {
    const clients = listClientIds();
    return {
      success: true,
      message: `Found ${clients.length} configured client(s).`,
      clients,
    };
  }
}
