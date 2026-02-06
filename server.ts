// server.ts
console.log("Starting Woody's Wild Guess MCP App server...");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getSession,
  saveSession,
  clearSession,
  type AuthSession,
} from "./src/session-store.js";

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
      query: z
        .string()
        .describe(
          "Optional search query to filter projects (e.g., 'Grand Central', 'electrification', 'accessibility')"
        )
        .optional(),
    },
    _meta: { ui: { resourceUri } },
  },
  async ({ query }) => {
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

// DaVinci configuration (API key kept server-side for security)
const DAVINCI_CONFIG = {
  companyId: "5ba551c1-a8e9-45c7-a75e-2893f8761cee",
  policyId: "4d8c0d254050175a84014620e0ce789e",
  apiKey: "435dcb31c41a196c75d8e3f4314385d07b677a5dca9e4848b70bdf687e989208c091114dc6ccb797f3241d6014cc8f013d91291fa60d56596e33cbfff2b26a18fb9cd5ad42fadc6570b6dd1dd64bdc2b5ca2534e9e89a85d3590a39518209a0abf09e35a7abda3870248499edebe56d8e758d52da11b142282b6c14973890f4f",
};

// Expose the MCP server over HTTP
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

// DaVinci SDK token endpoint - securely fetches token using API key
// Returns token + apiRoot for the widget to use
expressApp.post("/dvtoken", async (req, res) => {
  try {
    const policyId = req.body?.policyId || DAVINCI_CONFIG.policyId;

    const body: Record<string, unknown> = { policyId };

    // Include flow parameters if provided
    if (req.body?.flowParameters) {
      body.parameters = req.body.flowParameters;
    }

    const response = await fetch(
      `https://orchestrate-api.pingone.com/v1/company/${DAVINCI_CONFIG.companyId}/sdktoken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SK-API-KEY": DAVINCI_CONFIG.apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!data.success) {
      console.error("Failed to get SDK token:", data);
      res.status(500).json({ error: "Failed to get SDK token", details: data });
      return;
    }

    // Return token and apiRoot like BXIndustry does
    res.json({
      token: data.access_token,
      companyId: DAVINCI_CONFIG.companyId,
      apiRoot: "https://auth.pingone.com/",
    });
  } catch (err) {
    console.error("SDK token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DaVinci API proxy - proxies all DaVinci/PingOne API requests to bypass CORS
// Handles /auth/*, /v1/*, /davinci/*, and other PingOne SDK paths
expressApp.all(["/auth/*", "/v1/*", "/davinci/*"], async (req, res) => {
  try {
    // Forward the path to PingOne's API (add /v1 prefix for /auth paths)
    const targetPath = req.path.startsWith("/auth/") ? `/v1${req.path}` : req.path;
    const targetUrl = `https://orchestrate-api.pingone.com${targetPath}`;

    console.log(`Proxying ${req.method} ${targetUrl}`);

    // Forward the request headers (excluding browser/host-specific ones)
    const headers: Record<string, string> = {};
    const skipHeaders = [
      "host", "connection", "content-length", "accept-encoding",
      "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site",
      "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"
    ];
    // Note: Keep 'origin' and 'referer' - PingOne may need them for validation

    for (const [key, value] of Object.entries(req.headers)) {
      if (!skipHeaders.includes(key.toLowerCase()) && typeof value === "string") {
        headers[key] = value;
      }
    }

    // Ensure content-type is set
    if (!headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    // Debug: log headers being sent
    console.log("Forwarding headers:", JSON.stringify(headers, null, 2));

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Include body for POST/PUT/PATCH requests
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward response status and headers
    res.status(response.status);

    // Forward relevant response headers
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    // Return the response body
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error("DaVinci proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// Proxy the DaVinci SDK - allows loading via fetch+eval in sandboxed iframes
expressApp.get("/davinci-sdk.js", async (_req, res) => {
  try {
    const sdkResponse = await fetch("https://assets.pingone.com/davinci/latest/davinci.js");
    const sdkCode = await sdkResponse.text();
    res.type("application/javascript").send(sdkCode);
  } catch (err) {
    console.error("Failed to fetch DaVinci SDK:", err);
    res.status(500).send("// Failed to load DaVinci SDK");
  }
});

// Auth status endpoint - check if user is authenticated (server-side session)
expressApp.get("/auth/status", async (_req, res) => {
  const session = await getSession();
  res.json({
    authenticated: session.authenticated,
    user: session.user,
  });
});

// Auth save endpoint - save auth data after DaVinci login completes
expressApp.post("/auth/save", async (req, res) => {
  try {
    const { accessToken, idToken } = req.body;

    if (!accessToken) {
      res.status(400).json({ error: "Missing access token" });
      return;
    }

    // Parse user info from ID token if provided
    let user: AuthSession["user"];
    if (idToken) {
      try {
        const parts = idToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
          );
          user = {
            sub: payload.sub,
            name: payload.name,
            email: payload.email,
            given_name: payload.given_name,
            family_name: payload.family_name,
          };
        }
      } catch (e) {
        console.error("Failed to parse ID token:", e);
      }
    }

    // Save session with 24-hour expiry
    const session: AuthSession = {
      authenticated: true,
      accessToken,
      idToken,
      user,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    await saveSession(session);

    console.log("Auth session saved for user:", user?.name || user?.email || "unknown");
    res.json({ success: true, user });
  } catch (err) {
    console.error("Failed to save auth session:", err);
    res.status(500).json({ error: "Failed to save session" });
  }
});

// Auth logout endpoint - clear the session
expressApp.post("/auth/logout", async (_req, res) => {
  await clearSession();
  console.log("Auth session cleared");
  res.json({ success: true });
});

// Serve the app HTML for browser access (for auth flow testing)
expressApp.get("/", async (_req, res) => {
  try {
    const html = await fs.readFile(
      path.join(import.meta.dirname, "dist", "mcp-app.html"),
      "utf-8"
    );
    res.type("html").send(html);
  } catch (err) {
    res.status(500).send("Error loading app. Did you run 'npm run build' first?");
  }
});

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
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`  - Browser: http://localhost:${PORT}/`);
  console.log(`  - MCP endpoint: http://localhost:${PORT}/mcp`);
});
