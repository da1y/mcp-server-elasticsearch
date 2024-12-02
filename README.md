# Elasticsearch
A Model Context Protocol server for Elasticsearch clusters. Enables LLMs to manage indices and execute queries.

## Components

### Tools
- **search**
  - Execute search queries against indices
  - Input: 
    - `index` (string): Target index name
    - `query` (object): Elasticsearch query DSL
  - Returns search hits

- **create_index**
  - Create new Elasticsearch indices
  - Input:
    - `index` (string): Index name
    - `mappings` (object, optional): Index mappings configuration
    - `settings` (object, optional): Index settings configuration

- **list_indices**
  - List all available indices
  - No input required
  - Returns array of index information

- **index_document**
  - Index a document
  - Input:
    - `index` (string): Target index name
    - `id` (string, optional): Document ID
    - `document` (object): Document content
  - Returns indexing operation result

### Resources
The server provides mapping information for each index:
- **Index Mappings** (`elasticsearch://<host>/<index>/schema`)
  - JSON mapping information
  - Field names, types and configurations
  - Automatically discovered from metadata

## Usage with Claude Desktop
Add to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-elasticsearch",
        "http://localhost:9200"
      ]
    }
  }
}
```

Replace the URL with your Elasticsearch endpoint.

## License
Licensed under MIT License. Free to use, modify, and distribute. See LICENSE file for details.