// server-stdio.ts - Claude Desktop compatible version using stdio transport
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSession } from "./src/session-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");

// Login URL for browser authentication
const LOGIN_URL = "http://127.0.0.1:3001";

// Create a new MCP server instance
const server = new McpServer({
  name: "Woody's Wild Guess - LIRR Estimator",
  version: "1.0.0",
});

// The ui:// scheme tells hosts this is an MCP App resource.
const resourceUri = "ui://woodys-wild-guess/mcp-app.html";

// Register the LIRR estimator tool with UI metadata
registerAppTool(
  server,
  "lirr-estimator",
  {
    title: "Woody's Wild Guess - LIRR Estimator",
    description:
      "Opens Woody's Wild Guess, an interactive LIRR capital project estimator. Browse real MTA capital program projects, get cost estimates, and learn about Long Island Rail Road infrastructure investments. Optionally provide a project name or category to search.",
    inputSchema: {}, // Empty schema - no input parameters
    _meta: { ui: { resourceUri } },
  },
  async () => {
    // Check if user is authenticated
    const session = await getSession();

    if (!session.authenticated) {
      // Not authenticated - prompt user to login in browser
      return {
        content: [
          {
            type: "text",
            text: `🔐 Authentication Required\n\nPlease login first by opening this URL in your browser:\n${LOGIN_URL}\n\nAfter completing login, invoke this tool again.`,
          },
        ],
      };
    }

    // Authenticated - return success message
    const userName = session.user?.name || session.user?.given_name || "User";
    return {
      content: [
        {
          type: "text",
          text: `Welcome back, ${userName}! Woody's Wild Guess is ready. Browse LIRR capital projects and get Woody's estimates!`,
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
      path.join(DIST_DIR, "mcp-app.html"),
      "utf-8"
    );
    return {
      contents: [
        { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  }
);

// Use stdio transport for Claude Desktop
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Woody's Wild Guess MCP Server running on stdio");
