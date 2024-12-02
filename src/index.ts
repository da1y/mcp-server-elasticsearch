#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListResourcesRequestSchema, 
  ListToolsRequestSchema, 
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from '@elastic/elasticsearch';

interface IndexInfo {
  index: string;
  [key: string]: unknown;
}

const server = new Server(
  {
    name: "example-servers/elasticsearch",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide an Elasticsearch URL as a command-line argument");
  process.exit(1);
}

const esUrl = args[0];
const resourceBaseUrl = new URL(esUrl);
resourceBaseUrl.protocol = "elasticsearch:";
resourceBaseUrl.password = "";

const client = new Client({
  node: esUrl,
});

const SCHEMA_PATH = "schema";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const indices = await client.cat.indices({ format: 'json' }) as IndexInfo[];
    const resources = indices.map(index => ({
      uri: new URL(`${index.index}/${SCHEMA_PATH}`, resourceBaseUrl).href,
      mimeType: "application/json",
      name: `"${index.index}" index schema`,
    }));
    return { resources };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to list indices: ${errorMessage}`);
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const indexName = pathComponents.pop();

  if (!indexName || schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  try {
    const response = await client.indices.getMapping({
      index: indexName,
    });
    
    const mappingData = (response as Record<string, any>)[indexName];
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(mappingData, null, 2),
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get mapping: ${errorMessage}`);
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Run an Elasticsearch query",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "string" },
            query: { type: "object" },
          },
          required: ["index", "query"],
        },
      },
      {
        name: "create_index",
        description: "Create a new Elasticsearch index",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "string" },
            mappings: { 
              type: "object",
              description: "Index mappings configuration",
              default: {}
            },
            settings: {
              type: "object",
              description: "Index settings configuration",
              default: {}
            }
          },
          required: ["index"],
        },
      },
      {
        name: "list_indices",
        description: "List all Elasticsearch indices",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "index_document",
        description: "Index a document in Elasticsearch",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "string" },
            id: { 
              type: "string",
              description: "Optional document ID. If not provided, Elasticsearch will generate one"
            },
            document: { 
              type: "object",
              description: "Document to index"
            },
          },
          required: ["index", "document"],
        },
      }
    ],
  };
});

type SearchArguments = {
  index: string;
  query: Record<string, unknown>;
}

type CreateIndexArguments = {
  index: string;
  mappings?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

type IndexDocumentArguments = {
  index: string;
  id?: string;
  document: Record<string, unknown>;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments as unknown;
  
  switch (request.params.name) {
    case "search": {
      const { index, query } = args as SearchArguments;
      try {
        const result = await client.search({
          index,
          body: query,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result.hits, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Search failed: ${errorMessage}`);
      }
    }

    case "create_index": {
      const { index, mappings = {}, settings = {} } = args as CreateIndexArguments;
      try {
        const result = await client.indices.create({
          index,
          body: {
            mappings,
            settings
          }
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create index: ${errorMessage}`);
      }
    }

    case "list_indices": {
      try {
        const indices = await client.cat.indices({ format: 'json' });
        return {
          content: [{ type: "text", text: JSON.stringify(indices, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to list indices: ${errorMessage}`);
      }
    }

    case "index_document": {
      const { index, id, document } = args as IndexDocumentArguments;
      try {
        const result = await client.index({
          index,
          id,
          document,
          refresh: true  // Make document immediately available for search
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to index document: ${errorMessage}`);
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);