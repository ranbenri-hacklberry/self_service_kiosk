
import fetch from 'node-fetch';

const API_KEY = 'af8e1af12588e6e075528afc7a292f8b1e1b9e24468da9128dd962d0ae6e77df';
const BASE_URL = 'https://ai.hacklberryfinn.com';

async function main() {
    console.log("🔌 Connecting to MCP at", BASE_URL);

    try {
        // 1. Start SSE to establish session
        const response = await fetch(`${BASE_URL}/sse`, {
            headers: {
                'X-MCP-API-Key': API_KEY,
                'Accept': 'text/event-stream'
            }
        });

        if (!response.ok) {
            console.error("Failed to connect SSE:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }

        console.log("✅ SSE Connected. Listening for session endpoint...");

        // Primitive stream reader for Node-fetch
        let endpoint = null;

        // We'll peek at the first chunk of data to find the endpoint
        for await (const chunk of response.body) {
            const text = chunk.toString();
            console.log("📥 Received Chunk:", text);

            // Look for endpoint URL (it might be relative or absolute)
            // It often comes as `event: endpoint\ndata: ...` or just data if simplified.
            // Based on my previous `mcpClient.js` heuristic, let's look for "sessionId="

            // Typical MCP SSE initial payload:
            // event: endpoint
            // data: /message?sessionId=xyz

            const match = text.match(/data: (.*session.*)/);
            if (match) {
                endpoint = match[1].trim();
                // Fix relative URL
                if (endpoint.startsWith('/')) {
                    endpoint = BASE_URL + endpoint;
                }
                console.log("🔗 Found Endpoint:", endpoint);
                break; // We have what we need
            }
        }

        if (!endpoint) {
            console.error("❌ Could not find session endpoint in initial stream data.");
            return;
        }

        // 2. Now we can call tools!
        console.log("\n🕵️ Inspecting Schema...");

        // List Tables
        await callTool(endpoint, 'query_supa', {
            sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

async function callTool(endpoint, tool, args) {
    const payload = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
            name: tool,
            arguments: args
        },
        id: Date.now()
    };

    console.log(`\n🔧 Calling ${tool}...`);
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-MCP-API-Key': API_KEY
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        console.error("Tool call failed:", res.status);
        console.error(await res.text());
        return;
    }

    const json = await res.json();

    // MCP Result structure: { result: { content: [ { type: 'text', text: '...' } ] } }
    if (json.result && json.result.content) {
        json.result.content.forEach(c => {
            console.log("📄 RESULT:");
            // Try to parse if it's JSON string inside
            try {
                const inner = JSON.parse(c.text);
                console.log(JSON.stringify(inner, null, 2));
            } catch (e) {
                console.log(c.text);
            }
        });
    } else {
        console.log("Raw Response:", JSON.stringify(json, null, 2));
    }
}

main();
