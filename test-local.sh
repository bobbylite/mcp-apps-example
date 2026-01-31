#!/bin/bash

# Color Picker MCP App - Local Testing Script

echo "🎨 Color Picker MCP App - Local Test"
echo "===================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if dist exists
if [ ! -d "dist" ] || [ ! -f "dist/mcp-app.html" ]; then
    echo "🔨 Building the app..."
    npm run build
    echo ""
fi

echo "🚀 Starting the MCP server on http://localhost:3001/mcp"
echo ""
echo "To test with Claude Desktop:"
echo "  1. Run: npx cloudflared tunnel --url http://localhost:3001"
echo "  2. Copy the generated URL"
echo "  3. Add it as a custom connector in Claude Desktop"
echo "  4. Ask Claude: 'Show me a color picker'"
echo ""
echo "To test with basic-host:"
echo "  1. Clone: git clone https://github.com/modelcontextprotocol/ext-apps.git"
echo "  2. cd ext-apps/examples/basic-host && npm install"
echo "  3. SERVERS='[\"http://localhost:3001\"]' npm start"
echo "  4. Open: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run serve
