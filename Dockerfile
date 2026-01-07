# Use Ubuntu as base image
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV WEBUI_PASSWORD=admin

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create app directory
WORKDIR /app

# Create data directory for persistent storage
RUN mkdir -p /app/data /app/public

# Copy package files
COPY package.json ./

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY server.js ./
COPY public ./public/

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose ports
# 11434 for Ollama API
# 924 for WebUI
EXPOSE 11434 924

# Start services
CMD ["/start.sh"]
