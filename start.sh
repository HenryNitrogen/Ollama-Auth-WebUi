#!/bin/bash

# Start Ollama service in the background
echo "Starting Ollama service..."
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
sleep 5

# Start the Node.js WebUI server
echo "Starting Ollama Proxy WebUI on port 924..."
cd /app
node server.js
