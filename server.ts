// server.ts
console.log("Starting Woody's Wild Guess MCP App server...");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

const server = new McpServer({
  name: "Woody's Wild Guess - LIRR Estimator",
  version: "1.0.0",
});

// The ui:// scheme tells hosts this is an MCP App resource.
const resourceUri = "ui://woodys-wild-guess/mcp-app.html";

// Register the LIRR estimator tool
registerAppTool(
  server,
  "lirr-estimator",
  {
    title: "Woody's Wild Guess - LIRR Estimator",
    description:
      "Opens Woody's Wild Guess, an interactive LIRR capital project estimator. Browse real MTA capital program projects, get cost estimates, and learn about Long Island Rail Road infrastructure investments. Optionally provide a project name or category to search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional search query to filter projects (e.g., 'Grand Central', 'electrification', 'accessibility')",
        },
      },
      additionalProperties: false,
    } as const,
    _meta: { ui: { resourceUri } },
  },
  async (args: Record<string, unknown>) => {
    const query = (args.query as string) || "";
    return {
      content: [
        {
          type: "text",
          text: query
            ? `Woody's Wild Guess initialized. Searching for: ${query}`
            : "Woody's Wild Guess initialized. Browse LIRR capital projects and get Woody's estimates!",
        },
      ],
    };
  }
);

// Register the resource that serves the bundled HTML
registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(
      path.join(import.meta.dirname, "dist", "mcp-app.html"),
      "utf-8"
    );
    return {
      contents: [
        { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  }
);

// Expose the MCP server over HTTP
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

expressApp.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = 3001;
expressApp.listen(PORT, (err?: Error) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`Server listening on http://localhost:${PORT}/mcp`);
  console.log("Use this URL to add as a custom connector in Claude.");
});
