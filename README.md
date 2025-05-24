# 🦅 Starling

> A robust WebSocket client for real-time applications, designed for Helios servers

Starling is a powerful WebSocket client that provides automatic reconnection, method handling, and seamless peer-to-peer communication through Helios servers. Perfect for building resilient real-time applications, games, and distributed systems.

## ✨ Features

- 🔄 **Auto-Reconnection** - Intelligent reconnection with exponential backoff
- 🛡️ **Bulletproof Reliability** - Built-in message acknowledgments and retries
- 🎯 **Method System** - Define and call methods like RPC
- 🔀 **Peer-to-Peer** - Communicate with other clients through server proxy
- 📱 **Browser & Node** - Works everywhere WebSocket is supported
- 🚀 **Promise-Based** - Modern async/await API
- 🔧 **Type Safe** - Full TypeScript support with JSDoc

## 🚀 Quick Start

### Installation

```bash
bun add @killiandvcz/starling
# or
npm install @killiandvcz/starling
```

### Basic Client

```javascript
import { Starling } from "@killiandvcz/starling";

const starling = new Starling();

// Connect to Helios server
await starling.connect("ws://localhost:3000");

// Call server methods
const user = await starling.request("user:create", {
  name: "John Doe",
  email: "john@example.com"
});

console.log("User created:", user.data);
```

### With Auto-Reconnection

```javascript
const starling = new Starling();

// Connect with custom options
await starling.connect("ws://localhost:3000", {
  retries: 10,
  timeout: 15000,
  minTimeout: 1000,
  maxTimeout: 30000
});

// Handle connection events
starling.onconnected(() => {
  console.log("🔗 Connected to server");
});

starling.events.on("starling:disconnected", () => {
  console.log("🔌 Disconnected, will auto-reconnect...");
});
```

## 📚 Core Concepts

### Making Requests
Call server methods and get responses:

```javascript
// Simple request
const response = await starling.request("ping");
console.log(response.data); // { message: "pong", timestamp: ... }

// Request with payload
const user = await starling.request("user:create", {
  name: "Alice",
  email: "alice@example.com"
});

// Request with options
const result = await starling.request("slow-operation", data, {
  timeout: 30000  // 30 second timeout
});
```

### Handling Methods
Your client can also expose methods that others can call:

```javascript
// Define a method
starling.method("manifest", async (context) => {
  return context.success({
    name: "My App",
    version: "1.0.0",
    description: "A real-time application"
  });
});

// Handle incoming requests
starling.method("process-data", async (context) => {
  const { data } = context.request.payload;
  
  try {
    const result = await processData(data);
    return context.success(result);
  } catch (error) {
    return context.error(error.message);
  }
});
```

### Peer-to-Peer Communication
Communicate with other clients through the server:

```javascript
// Send message to specific client
const response = await starling.request("get-status", {}, {
  peer: { name: "OtherClient" }
});

// Send data to peer
const result = await starling.request("process-batch", batchData, {
  peer: { service: "DataProcessor" }
});
```

### Sending Messages
Send different types of messages:

```javascript
// JSON message
starling.json({ type: "notification", message: "Hello!" });

// Text message
starling.text("Simple text message");

// Binary message
const buffer = new Uint8Array([1, 2, 3, 4]);
starling.binary(buffer);

// With options
starling.json(data, {
  topic: "chat",
  tags: ["public", "general"]
});
```

## 🔌 API Reference

### Starling Class

#### `new Starling()`
Creates a new Starling client instance.

#### `starling.connect(url, options?)`
Connect to a Helios server.

- `url` (string): WebSocket URL (ws:// or wss://)
- `options` (object, optional):
  - `retries` (number): Max retry attempts (default: 5)
  - `timeout` (number): Connection timeout in ms (default: 10000)
  - `minTimeout` (number): Min retry delay in ms (default: 1000)
  - `maxTimeout` (number): Max retry delay in ms (default: 10000)

#### `starling.request(method, payload?, options?)`
Make a request to the server or peer.

- `method` (string): Method name
- `payload` (any, optional): Request data
- `options` (object, optional):
  - `timeout` (number): Request timeout in ms
  - `peer` (object): Peer routing information

Returns: `Promise<Response>`

#### `starling.method(name, handler)`
Register a method that can be called by server or peers.

- `name` (string): Method name
- `handler` (function): Async function that receives `RequestContext`

#### `starling.json(data, options?)`
Send JSON message.

#### `starling.text(data, options?)`
Send text message.

#### `starling.binary(data, options?)`
Send binary message.

#### `starling.close()`
Close the connection.

#### `starling.onconnected(callback)`
Listen for successful connections.

### Events

Listen to connection events:

```javascript
// Connection established
starling.events.on("starling:connected", (event) => {
  console.log("Connected!", event.data);
});

// Connection lost
starling.events.on("starling:disconnected", (event) => {
  console.log("Disconnected:", event.data);
});

// Connection error
starling.events.on("starling:error", (event) => {
  console.error("Connection error:", event.data);
});

// Message acknowledged
starling.events.on("message:ack", (event) => {
  console.log("Message delivered:", event.data.message.id);
});
```

## 🎮 Real-World Examples

### Chat Client
```javascript
const starling = new Starling();
await starling.connect("ws://localhost:3000");

// Join a room
await starling.request("room:join", { roomId: "general" });

// Send messages
document.getElementById("send").onclick = async () => {
  const message = document.getElementById("message").value;
  await starling.request("message:send", { message });
  document.getElementById("message").value = "";
};

// Listen for incoming messages
starling.on("message", (msg) => {
  const messageDiv = document.createElement("div");
  messageDiv.textContent = msg.data.message;
  document.getElementById("messages").appendChild(messageDiv);
});
```

### Game Client
```javascript
const starling = new Starling();
await starling.connect("ws://localhost:3000");

// Join the game
const player = await starling.request("game:join", {
  playerName: "Alice"
});

// Handle player movement
document.addEventListener("keydown", async (e) => {
  const movement = getMovementFromKey(e.key);
  if (movement) {
    await starling.request("player:move", {
      position: movement
    });
  }
});

// Listen for game state updates
starling.on("gameState", (msg) => {
  updateGameDisplay(msg.data);
});
```

### Service Client
```javascript
const starling = new Starling();
await starling.connect("ws://localhost:3000");

// Register as a service
starling.method("manifest", async (context) => {
  return context.success({
    name: "ImageProcessor",
    version: "2.1.0",
    capabilities: ["resize", "crop", "filter"]
  });
});

// Handle image processing requests
starling.method("image:process", async (context) => {
  const { image, operations } = context.request.payload;
  
  try {
    const result = await processImage(image, operations);
    return context.success({
      processedImage: result,
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    return context.error(`Processing failed: ${error.message}`);
  }
});
```

### Microservice Communication
```javascript
const dataService = new Starling();
await dataService.connect("ws://localhost:3000");

// Register as data service
dataService.method("manifest", async (context) => {
  return context.success({ name: "DataService" });
});

// Another service can now call this one
const apiService = new Starling();
await apiService.connect("ws://localhost:3000");

// Call the data service through the server
const userData = await apiService.request("user:get", { id: 123 }, {
  peer: { name: "DataService" }
});
```

### React Integration
```javascript
import { Starling } from "@killiandvcz/starling";
import { useEffect, useState } from "react";

function useStarling(url) {
  const [starling, setStarling] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const client = new Starling();
    
    client.connect(url).then(() => {
      setStarling(client);
      setConnected(true);
    });
    
    client.onconnected(() => setConnected(true));
    client.events.on("starling:disconnected", () => setConnected(false));
    
    return () => client.close();
  }, [url]);
  
  return { starling, connected };
}

function ChatApp() {
  const { starling, connected } = useStarling("ws://localhost:3000");
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    if (!starling) return;
    
    starling.on("message", (msg) => {
      setMessages(prev => [...prev, msg.data]);
    });
  }, [starling]);
  
  const sendMessage = async (text) => {
    if (starling && connected) {
      await starling.request("message:send", { text });
    }
  };
  
  return (
    <div>
      <div>Status: {connected ? "Connected" : "Disconnected"}</div>
      {/* Chat UI */}
    </div>
  );
}
```

## 🔧 Advanced Usage

### Custom Message Handling
```javascript
// Listen to specific message topics
starling.on("notifications", (message) => {
  showNotification(message.data);
});

// Pattern matching
starling.on("user:*", (message) => {
  console.log("User event:", message);
});

// Send with topics
starling.json(data, {
  topic: "notifications",
  tags: ["urgent", "user"]
});
```

### Error Handling
```javascript
try {
  const result = await starling.request("risky-operation", data);
} catch (error) {
  if (error.message === "Request timed out") {
    // Handle timeout
  } else {
    // Handle other errors
  }
}

// Global error handling
starling.events.on("starling:error", (event) => {
  console.error("Connection error:", event.data);
  // Implement custom error handling
});
```

### Connection State Management
```javascript
class ConnectionManager {
  constructor(url) {
    this.starling = new Starling();
    this.url = url;
    this.reconnectAttempts = 0;
  }
  
  async connect() {
    try {
      await this.starling.connect(this.url, {
        retries: Infinity, // Never give up
        timeout: 10000
      });
      this.reconnectAttempts = 0;
    } catch (error) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts} failed`);
      throw error;
    }
  }
  
  isConnected() {
    return this.starling.websocket?.readyState === WebSocket.OPEN;
  }
}
```

## 🤝 Related

- **[@killiandvcz/helios](https://github.com/killiandvcz/helios)** - WebSocket server for Starling clients
- **[@killiandvcz/pulse](https://github.com/killiandvcz/pulse)** - Event system used internally

## 📄 License

MIT

## 🙋‍♂️ Support

- Create an issue on [GitHub](https://github.com/killiandvcz/starling/issues)
- Follow [@killiandvcz](https://github.com/killiandvcz) for updates

---

Built with ❤️ by [killiandvcz](https://github.com/killiandvcz)