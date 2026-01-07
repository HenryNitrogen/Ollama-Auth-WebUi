# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2024-12-31

### Added
- 🎨 Modern WebUI with dark theme
- 💬 Interactive chat interface with streaming support
- 📦 Model management (download/delete) with progress tracking
- 🔑 API token management system
- 🔒 Password-protected login system
- 🔄 OpenAI-compatible API endpoint (`/v1/chat/completions`)
- 📱 Responsive design for mobile devices

### Changed
- Removed hardcoded API keys
- Changed from environment-based tokens to dynamic token management
- Updated port from 925 to 924 for WebUI
- Removed default model auto-download

### Security
- Session-based authentication for WebUI
- Bearer token authentication for API
- Persistent token storage with Docker volumes

## [1.0.0] - Initial Release

### Added
- Basic Ollama proxy server
- Simple API key authentication
- Docker support
