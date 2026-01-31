# Woody's Wild Guess - LIRR Capital Project Estimator

An interactive MCP App that provides cost estimates for Long Island Rail Road (LIRR) capital projects based on verified historical data from MTA reports, NY State Comptroller audits, and Federal Railroad Administration records.

## Overview

Woody's Wild Guess is a Model Context Protocol (MCP) application that helps estimate costs for LIRR infrastructure projects by analyzing historical cost overruns and project characteristics. The app features a searchable database of real LIRR capital projects with actual vs. estimated costs, allowing users to browse completed projects and understand historical cost patterns.

## Features

- **Real Historical Data**: All project costs verified from official MTA documents, government audits, and Federal records
- **Interactive Project Browser**: Search and filter LIRR capital projects by name, category, status, or location
- **Cost Variance Analysis**: View original estimates vs. actual final costs with percentage variance
- **Woody's Estimation Algorithm**: Generate cost estimates for new projects based on historical overrun patterns
- **Project Categories**: Expansion, Rolling Stock, Bridges, Signals, Capacity, Stations, and more
- **Confidence Levels**: Risk-based confidence ratings (High, Moderate, Low, Speculative)
- **Beautiful UI**: Modern interface with LIRR branding and Woody's Wild Guess logo
- **Seamless MCP Integration**: Works with Claude Desktop and other MCP-compatible hosts

## Data Sources

All project costs are verified from official sources:

- **Grand Central Madison (East Side Access)**: $4.3B estimate → $11.1B actual (158% overrun)
  - Sources: Wikipedia (citing federal records), Mass Transit Magazine, Gothamist
- **Main Line Third Track**: $2.6B estimate → $2.5B actual (4% under budget)
  - Sources: Governor Hochul press release, Railway Track & Structures, amNewYork
- **M9 Railcars**: $723.6M estimate → $735.7M actual (1.7% overrun)
  - Sources: NY State Comptroller audit reports 2022 & 2023
- **Positive Train Control (PTC)**: $428M estimate → $967.1M actual (126% overrun)
  - Sources: FRA RRIF loan documents, MTA press releases
- **Jamaica Station (1987)**: $213M estimate → $342.5M actual (61% overrun)
  - Source: Wikipedia "Jamaica station"

**No synthetic data** - all figures come from verified official records.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the UI:
   ```bash
   npm run build
   ```

3. Start the server:
   ```bash
   npm run serve
   ```

   Or run both build and serve in one command:
   ```bash
   npm start
   ```

The server will be available at `http://localhost:3001/mcp`.

## Testing

### Testing with Claude Desktop (Recommended)

1. **Add to your Claude Desktop config** at:
   `~/Library/Application Support/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "woodys-wild-guess": {
         "command": "node",
         "args": ["/path/to/mcp-apps-color-picker/server.js"]
       }
     }
   }
   ```

2. **Restart Claude Desktop** to load the server

3. **Test the estimator**:
   - Start a new chat in Claude Desktop
   - Ask: "Show me Woody's Wild Guess" or "Estimate LIRR project costs"
   - Browse projects, view historical data, and get Woody's estimates

### Testing with Claude Web (via Custom Connector)

1. **Start the HTTP server**:
   ```bash
   npm start
   ```

2. **Expose your local server** using `cloudflared`:
   ```bash
   npx cloudflared tunnel --url http://localhost:3001
   ```

3. **Copy the generated URL** (e.g., `https://random-name.trycloudflare.com`)

4. **Add as a custom connector in Claude**:
   - Go to claude.ai
   - Click on your profile
   - Go to **Settings** → **Connectors** → **Add custom connector**
   - Paste your cloudflared URL
   - Save the connector

5. **Test the estimator** (same as Claude Desktop)

## Usage

Once connected, ask Claude to use Woody's Wild Guess:

- "Show me Woody's Wild Guess"
- "What LIRR projects have the worst cost overruns?"
- "Estimate costs for Grand Central Madison"
- "Search for accessibility projects"
- "Show me completed station renovations"

The app supports:
- **Project Search**: Filter by name, location, or category
- **Status Filters**: View completed, in-progress, planned, or under-study projects
- **Cost Variance Analysis**: See original estimate vs. actual final cost
- **Historical Patterns**: Woody's estimates based on verified overrun data
- **Send Estimates**: Export project details back to the conversation

## Project Structure

```
mcp-apps-color-picker/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite bundler configuration (publicDir: src/public)
├── server.ts                 # MCP server (HTTP) for web testing
├── mcp-app.html              # UI entry point with LIRR styling
├── src/
│   ├── mcp-app.ts            # UI logic and MCP App client
│   ├── lirr-projects.ts      # Verified project data and estimation algorithms
│   ├── vite-env.d.ts         # TypeScript declarations for assets
│   ├── assets/
│   │   └── woody-logo.png    # Woody's Wild Guess logo (inlined in build)
│   └── public/
│       └── img/
│           └── woody-logo.png # Original logo file
└── dist/                     # Build output (generated)
    └── mcp-app.html          # Bundled single-file HTML with inlined assets
```

## How It Works

1. **Server Registration**: Registers `lirr-estimator` tool with UI metadata pointing to `ui://woodys-wild-guess/mcp-app.html`
2. **Project Database**: `lirr-projects.ts` contains verified historical data with actual costs
3. **Estimation Algorithm**: `calculateWoodyEstimate()` uses category multipliers, risk factors, and historical overrun patterns
4. **UI Rendering**: Claude renders the bundled HTML in a secure sandboxed iframe
5. **Bidirectional Communication**: App sends project estimates back to the conversation via `app.updateModelContext()`
6. **Asset Inlining**: `vite-plugin-singlefile` inlines all assets (CSS, JS, images) as base64 data URIs

## Estimation Methodology

Woody's Wild Guess uses a weighted algorithm:

```typescript
woodyGuess =
  (adjustedBase * 0.3) +           // 30% weight on base estimate
  (historicalAverage * 0.6) +      // 60% weight on historical category average
  (adjustedBase * random(±10%))    // ±10% randomness
```

**Category Multipliers** (complexity-based):
- Expansion: 1.5x
- Capacity: 1.35x
- Electrification: 1.4x
- Signals: 1.25x
- Stations: 1.2x
- Rolling Stock: 1.1x

**Historical Category Overruns** (verified):
- Expansion: 2.58x (Grand Central Madison)
- Signals: 2.26x (PTC)
- Stations: 1.61x (Jamaica Station 1987)
- Rolling Stock: 1.02x (M9 Cars)
- Capacity: 0.96x (Third Track - under budget!)

## Development

To modify Woody's Wild Guess:

1. **Edit UI**: `mcp-app.html` for structure and styling
2. **Edit Logic**: `src/mcp-app.ts` for functionality and MCP communication
3. **Add Projects**: `src/lirr-projects.ts` for new verified project data
4. **Edit Server**: `server.ts` to change tool behavior
5. **Rebuild**: `npm run build`
6. **Restart**: `npm run serve`

### Adding New Projects

When adding projects to `src/lirr-projects.ts`:
- Only use verified data from official sources
- Include source citations in comments
- Add both `estimatedCost` and `actualCost` (if completed)
- Update `historicalOverruns.averageByCategory` if adding a new category

## Learn More

- [MCP Apps Documentation](https://modelcontextprotocol.io/docs/extensions/apps)
- [MCP Apps API Reference](https://modelcontextprotocol.github.io/ext-apps/api/)
- [MCP Apps GitHub Repository](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Specification](https://github.com/modelcontextprotocol/specification)
- [MTA Capital Program](https://new.mta.info/capital)
- [NY State Comptroller MTA Audits](https://www.osc.state.ny.us/)

## License

MIT
