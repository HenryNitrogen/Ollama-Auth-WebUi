// Ollama Proxy Server with WebUI
// Features:
// - Authenticated API proxy for Ollama
// - WebUI for model management (download/delete)
// - Chat interface with model selection
// - Custom API token management
// - User authentication via environment variables

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const WEBUI_PORT = 924;

// Get credentials from environment variables
const WEBUI_PASSWORD = process.env.WEBUI_PASSWORD || "admin";

// Persistent storage file
const DATA_FILE = "/app/data/tokens.json";

// Load tokens from file
const loadTokens = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load tokens:", e);
  }
  return [];
};

// Save tokens to file
const saveTokens = (tokens) => {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.error("Failed to save tokens:", e);
  }
};

// In-memory storage for API tokens and sessions
let apiTokens = loadTokens();
let sessions = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session middleware
const generateSessionId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const isAuthenticated = (req) => {
  const sessionId = req.headers["x-session-id"];
  return sessions.has(sessionId);
};

// ================== Auth Routes ==================

// Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  
  if (password === WEBUI_PASSWORD) {
    const sessionId = generateSessionId();
    sessions.set(sessionId, { createdAt: Date.now() });
    return res.json({ success: true, sessionId });
  }
  
  return res.status(401).json({ error: "Invalid password" });
});

// Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  sessions.delete(sessionId);
  return res.json({ success: true });
});

// Check session
app.get("/api/auth/check", (req, res) => {
  if (isAuthenticated(req)) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false });
});

// ================== API Token Management ==================

// Get all tokens
app.get("/api/tokens", (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Return tokens with masked values
  const maskedTokens = apiTokens.map(t => ({
    ...t,
    token: t.token.substring(0, 8) + "..." + t.token.substring(t.token.length - 4)
  }));
  return res.json(maskedTokens);
});

// Create new token
app.post("/api/tokens", (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { name } = req.body;
  const token = "sk-" + Math.random().toString(36).substring(2) + 
                Math.random().toString(36).substring(2) +
                Math.random().toString(36).substring(2);
  
  const newToken = {
    id: Date.now().toString(),
    name: name || "Unnamed Token",
    token,
    createdAt: new Date().toISOString()
  };
  
  apiTokens.push(newToken);
  saveTokens(apiTokens);
  return res.json(newToken);
});

// Delete token
app.delete("/api/tokens/:id", (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { id } = req.params;
  apiTokens = apiTokens.filter(t => t.id !== id);
  saveTokens(apiTokens);
  return res.json({ success: true });
});

// ================== Model Management ==================

// List all models
app.get("/api/models", async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch models" });
  }
});

// Pull/Download a model
app.post("/api/models/pull", async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Model name is required" });
  }
  
  try {
    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stream: true })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      res.write(`data: ${chunk}\n\n`);
    }
    
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Delete a model
app.delete("/api/models/:name", async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { name } = req.params;
  
  try {
    const response = await fetch("http://localhost:11434/api/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    
    if (response.ok) {
      return res.json({ success: true });
    } else {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete model" });
  }
});

// ================== Chat Endpoint (WebUI) ==================

app.post("/api/chat", async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { model, messages, stream } = req.body;
  
  if (!model || !messages) {
    return res.status(400).json({ error: "Model and messages are required" });
  }
  
  try {
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        res.write(`data: ${chunk}\n\n`);
      }
      
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false })
      });
      
      const data = await response.json();
      return res.json(data);
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to chat with model" });
  }
});

// ================== External API Proxy ==================

// External API endpoint (token-based auth) - OpenAI compatible
app.post("/v1/chat/completions", async (req, res) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace("Bearer ", "");
  
  // Check if token is valid
  const validToken = apiTokens.find(t => t.token === token);
  if (!validToken) {
    return res.status(401).json({ error: "Invalid API token" });
  }
  
  const { model, messages, stream } = req.body;
  
  try {
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        // Convert to OpenAI-compatible format
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.message?.content) {
            const openaiChunk = {
              id: "chatcmpl-" + Date.now(),
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { content: parsed.message.content },
                finish_reason: parsed.done ? "stop" : null
              }]
            };
            res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false })
      });
      
      const data = await response.json();
      
      // Convert to OpenAI-compatible format
      const openaiResponse = {
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: data.message,
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      };
      
      return res.json(openaiResponse);
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to process request" });
  }
});

// Serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(WEBUI_PORT, "0.0.0.0", () => {
  console.log(`Ollama Proxy WebUI running on port ${WEBUI_PORT}`);
  console.log(`API endpoint available at port ${WEBUI_PORT}`);
});
