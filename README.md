# MCP-Pentest-Forge 🔒⚡

## Overview

**MCP-Pentest-Forge** is a powerful Model Context Protocol (MCP) tool designed for ethical hacking and cybersecurity research. This tool empowers security professionals, penetration testers, and researchers to enhance their workflow through intelligent automation and contextual assistance.

## Features

- 🔍 **Intelligent Reconnaissance**: Automated information gathering with contextual analysis
- 🛡️ **Vulnerability Assessment**: Smart scanning and analysis of security weaknesses
- 📊 **Reporting & Analytics**: Generate comprehensive security reports with actionable insights
- 🤖 **AI-Powered Analysis**: Leverage machine learning for pattern recognition and anomaly detection
- 🔗 **Multi-Protocol Support**: Compatible with various security tools and frameworks

## Ethical Hacking Focus

This tool is designed exclusively for **authorized security testing and research purposes**. It promotes responsible disclosure practices and helps organizations strengthen their defenses through proactive security assessments.

## Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git

# Navigate to the directory
cd mcp-pentest-forge

# Build and run with Docker Compose (recommended)
docker-compose up --build

# Or build and run manually
docker build -t mcp-pentest-forge .
docker run -it --rm mcp-pentest-forge
```

### Option 2: Local Node.js Installation

```bash
# Clone the repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git

# Navigate to the directory
cd mcp-pentest-forge

# Install dependencies
npm install

# Configure your environment (optional)
cp .env.example .env
# Edit .env with your configuration
```

## Usage

### Docker Usage

```bash
# Start the MCP server with Docker Compose
docker-compose up

# Run in detached mode
docker-compose up -d

# Stop the server
docker-compose down

# View logs
docker-compose logs -f

# Manual Docker commands
docker run -it --rm mcp-pentest-forge
```

### Local Usage

```bash
# Start the MCP server
npm start

# Or with custom configuration
npm run dev -- --config ./config/security.json
```

### Available Tools

The MCP server provides the following pentesting tools:

- **port_scan**: Scan ports on a target host
- **dns_lookup**: Perform DNS lookup for a domain
- **web_headers**: Get HTTP headers from a web server
- **ssl_info**: Get SSL certificate information

### Integration with MCP Clients

This server communicates via stdio using the Model Context Protocol. Connect it to MCP-compatible clients like Claude Desktop or other MCP-enabled applications.

## Contributing

We welcome contributions from the security research community. Please ensure all contributions align with ethical hacking principles and responsible disclosure practices.

## Disclaimer

This tool is intended for educational and authorized security research purposes only. Users are responsible for complying with applicable laws and obtaining proper authorization before conducting any security assessments.

## License

MIT License - See LICENSE file for details

---

**Built with ❤️ for the cybersecurity community**
