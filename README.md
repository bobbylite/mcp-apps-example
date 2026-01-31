# Color Picker MCP App

An interactive color picker extension for the Model Context Protocol (MCP) that renders a beautiful UI in Claude Desktop and other MCP-compatible hosts.

## Features

- Interactive color picker with live preview
- Multiple color format support (HEX, RGB, HSL)
- Click-to-copy color values
- Random color generator
- Beautiful gradient UI design
- Seamless integration with Claude Desktop

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

The color picker is already configured in your Claude Desktop config at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

1. **Restart Claude Desktop** to load the new server

2. **Test the color picker**:
   - Start a new chat in Claude Desktop
   - Ask: "Show me a color picker" or "I need to pick a color"
   - The interactive color picker will render in the chat
   - Select colors, copy values, and send your selection back to Claude

### Testing with Claude Web (via Custom Connector)

1. **Start the HTTP server**:
   ```bash
   npm start
   ```

2. **Expose your local server to the internet** using `cloudflared`:
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

5. **Test the color picker** (same as Claude Desktop)

### Testing with the basic-host

1. Clone the ext-apps repository:
   ```bash
   git clone https://github.com/modelcontextprotocol/ext-apps.git
   cd ext-apps/examples/basic-host
   npm install
   ```

2. Start the basic-host with your color picker server:
   ```bash
   SERVERS='["http://localhost:3001"]' npm start
   ```

3. Navigate to `http://localhost:8080` and test the color picker tool.

## Usage

Once connected, you can ask Claude to use the color picker:

- "Show me a color picker"
- "I need to pick a color for my website"
- "Open the color picker tool"
- "Help me choose a color starting with #FF5733"

The color picker supports:
- **Visual selection**: Click and drag on the color picker
- **Manual input**: Type hex values directly
- **Random colors**: Generate random colors with one click
- **Multiple formats**: View and copy HEX, RGB, and HSL formats
- **Context updates**: Send selected colors back to the conversation

## Project Structure

```
mcp-apps-color-picker/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite bundler configuration
├── server.ts             # MCP server (HTTP) for web testing
├── server-stdio.ts       # MCP server (stdio) for Claude Desktop
├── mcp-app.html          # UI entry point
├── src/
│   └── mcp-app.ts        # UI logic and MCP App client
└── dist/                 # Build output (generated)
    └── mcp-app.html      # Bundled single-file HTML
```

### Server Files

- **`server.ts`**: HTTP-based server for testing with Claude web (via cloudflared) or basic-host
- **`server-stdio.ts`**: Stdio-based server for Claude Desktop integration

## How It Works

1. **Server Registration**: The server registers a `color-picker` tool with UI metadata pointing to a `ui://` resource
2. **UI Resource**: When called, the server serves the bundled HTML containing the color picker interface
3. **Sandboxed Rendering**: Claude renders the UI in a secure sandboxed iframe
4. **Bidirectional Communication**: The app communicates with Claude through the MCP Apps protocol
5. **Context Updates**: Selected colors are sent back to the conversation for use in subsequent interactions

## Development

To modify the color picker:

1. Edit `mcp-app.html` for UI structure and styling
2. Edit `src/mcp-app.ts` for functionality and MCP communication
3. Edit `server.ts` to change tool behavior or add new features
4. Rebuild with `npm run build`
5. Restart the server with `npm run serve`

## Learn More

- [MCP Apps Documentation](https://modelcontextprotocol.io/docs/extensions/apps)
- [MCP Apps API Reference](https://modelcontextprotocol.github.io/ext-apps/api/)
- [MCP Apps GitHub Repository](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Specification](https://github.com/modelcontextprotocol/specification)

## License

MIT
