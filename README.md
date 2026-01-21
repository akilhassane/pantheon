# Pantheon AI Platform

<div align="center">

![Pantheon Logo](./assets/pantheon-logo.png)
<!-- TODO: Add Pantheon logo -->

**A Multi-Agentic AI Platform for OS Interaction**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/akilhassane/pantheon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/akilhassane/pantheon?style=for-the-badge)](https://github.com/akilhassane/pantheon/stargazers)

[🚀 Quick Start](#quick-start) • [📖 Documentation](#documentation) • [🎥 Demo](#demo) • [💬 Community](#community)

</div>

---

## 🎯 What is Pantheon?

**Pantheon** is a revolutionary multi-agentic AI platform that enables AI models to interact directly with operating systems. Think of it as giving AI assistants hands to actually perform tasks on your computer, not just suggest commands.

### Key Capabilities

- 🤖 **Multi-AI Support**: Works with OpenAI, Anthropic Claude, Google Gemini, and more
- 🪟 **Windows Automation**: Full Windows OS control and automation (Linux/macOS coming soon)
- 👥 **Real-time Collaboration**: Multiple users can work on the same project simultaneously
- 🔐 **Secure & Isolated**: Each project runs in its own isolated environment
- 🌐 **Web-Based**: Access from anywhere via your browser
- 📊 **Usage Tracking**: Monitor API usage and costs in real-time

---

## 🎥 Demo

![Pantheon Demo](./assets/demo.gif)
<!-- TODO: Add demo GIF showing Pantheon in action -->

### Watch the Full Demo

[![Pantheon Demo Video](./assets/video-thumbnail.png)](https://youtube.com/watch?v=YOUR_VIDEO_ID)
<!-- TODO: Record and upload demo video -->

---

## ✨ Features

### For Users

- **Natural Language Control**: Tell AI what you want, it figures out how to do it
- **Visual Feedback**: See exactly what's happening on the Windows desktop
- **Collaborative Workspaces**: Work together with your team in real-time
- **Project Management**: Organize work into isolated projects
- **Multi-Model Support**: Switch between different AI models seamlessly

### For Developers

- **RESTful API**: Integrate Pantheon into your applications
- **WebSocket Support**: Real-time updates and collaboration
- **Docker-Based**: Easy deployment and scaling
- **Extensible**: Add support for new OS types and tools
- **Well-Documented**: Comprehensive API documentation

---

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 20GB free disk space
- Supabase account (free tier works)
- At least one AI provider API key

### Installation (5 minutes)

#### Linux/macOS

```bash
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh
chmod +x install-pantheon.sh
bash install-pantheon.sh
```

#### Windows

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"
powershell -ExecutionPolicy Bypass -File install-pantheon.ps1
```

### Configuration

1. Edit the `.env` file with your credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   OPENAI_API_KEY=sk-...
   # or
   ANTHROPIC_API_KEY=sk-ant-...
   # or
   GEMINI_API_KEY=AIza...
   ```

2. Restart services:
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

3. Open http://localhost:3000 in your browser

**That's it!** 🎉

For detailed installation instructions, see [Installation Guide](./docs/INSTALLATION_GUIDE.md).

---

## 📖 Documentation

### Getting Started

- 📘 [Installation Guide](./docs/INSTALLATION_GUIDE.md) - Complete installation instructions
- 📗 [User Guide](./docs/USER_GUIDE.md) - Learn how to use Pantheon
- 📙 [Quick Start Tutorial](./docs/QUICK_START.md) - Get up and running in 10 minutes

### Advanced

- 🔧 [API Reference](./docs/API_REFERENCE.md) - Complete API documentation
- 🏗️ [Architecture](./docs/ARCHITECTURE.md) - System architecture and design
- 🔌 [Integration Guide](./docs/INTEGRATION.md) - Integrate Pantheon with your apps
- 🐛 [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions

### Development

- 🛠️ [Development Guide](./docs/DEVELOPMENT.md) - Set up development environment
- 🧪 [Testing Guide](./docs/TESTING.md) - Run tests and contribute
- 📦 [Deployment Guide](./docs/DEPLOYMENT.md) - Deploy to production

---

## 🏗️ Architecture

Pantheon consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                    (Next.js + React)                        │
│                   http://localhost:3000                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│                    (Node.js + Express)                      │
│                   http://localhost:3002                     │
│                                                             │
│  • AI Provider Integration (OpenAI, Anthropic, etc.)       │
│  • Project Management                                       │
│  • Session Management                                       │
│  • WebSocket Server                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Windows Tools API                        │
│                    (Node.js + Python)                       │
│                   http://localhost:3003                     │
│                                                             │
│  • Windows Automation Tools                                 │
│  • Screenshot & OCR                                         │
│  • Mouse & Keyboard Control                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Windows Projects                         │
│              (Docker containers with Windows)               │
│                                                             │
│  • Isolated Windows environments                            │
│  • Per-project storage                                      │
│  • VNC access for visual feedback                           │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture documentation, see [Architecture Guide](./docs/ARCHITECTURE.md).

---

## 🎯 Use Cases

### Automation & Testing

- Automate repetitive Windows tasks
- Test Windows applications
- Create automated workflows
- Perform system administration tasks

### Development & DevOps

- Set up development environments
- Deploy applications
- Run automated tests
- Monitor system health

### Research & Education

- Study AI-OS interaction
- Learn about system automation
- Experiment with different AI models
- Build custom automation tools

### Business & Productivity

- Automate data entry
- Generate reports
- Process documents
- Manage multiple systems

---

## 🛠️ Technology Stack

### Frontend

- **Framework**: Next.js 14 (React 18)
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: React Context + Hooks
- **Real-time**: WebSocket
- **Terminal**: xterm.js

### Backend

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Native SDKs for each provider
- **Container Management**: Dockerode

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **OS Virtualization**: Windows containers (QEMU/KVM)
- **Networking**: Docker bridge networks
- **Storage**: Docker volumes

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the repository
- 📢 Spread the word

### Development Setup

```bash
# Clone the repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development servers
docker-compose up -d
```

For detailed development instructions, see [Development Guide](./docs/DEVELOPMENT.md).

---

## 📊 Project Status

### Current Status

- ✅ Windows OS support (fully functional)
- ✅ Multi-AI provider support
- ✅ Real-time collaboration
- ✅ Project management
- ✅ Web-based interface
- ✅ Docker deployment

### Roadmap

- 🚧 Linux OS support (Q2 2025)
- 🚧 macOS support (Q3 2025)
- 📋 Mobile app (Q4 2025)
- 📋 Plugin system (Q4 2025)
- 📋 Marketplace for automation scripts (2026)

---

## 💬 Community

Join our growing community:

- 🐛 **GitHub Issues**: [Report bugs](https://github.com/akilhassane/pantheon/issues)
- 📚 **Documentation**: Check the `docs/` folder for guides

---

## 📄 License

Pantheon is open-source software licensed under the [MIT License](./LICENSE).

```
MIT License

Copyright (c) 2025 Akil Hassane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- Thanks to all contributors who have helped build Pantheon
- Inspired by the Model Context Protocol (MCP)
- Built with amazing open-source technologies

---

## ⚠️ Disclaimer

Pantheon provides powerful automation capabilities. Users are responsible for:

- Using the platform ethically and legally
- Securing their API keys and credentials
- Complying with AI provider terms of service
- Ensuring proper authorization for automated tasks
- Backing up important data

**Use at your own risk. The authors are not liable for any damages or misuse.**

---

## 📈 Stats

![GitHub stars](https://img.shields.io/github/stars/akilhassane/pantheon?style=social)
![GitHub forks](https://img.shields.io/github/forks/akilhassane/pantheon?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/akilhassane/pantheon?style=social)

![GitHub issues](https://img.shields.io/github/issues/akilhassane/pantheon)
![GitHub pull requests](https://img.shields.io/github/issues-pr/akilhassane/pantheon)
![GitHub last commit](https://img.shields.io/github/last-commit/akilhassane/pantheon)

---

<div align="center">

**Built with ❤️ by [Akil Hassane](https://github.com/akilhassane)**

[⬆ Back to Top](#pantheon-ai-platform)

</div>
