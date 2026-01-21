# 🏛️ Pantheon AI Platform

**Multi-OS AI Assistant with Visual Desktop Access**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/akilhassane/pantheon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

---

## 🎯 What is Pantheon?

Pantheon is an AI-powered platform that provides **isolated, containerized operating system environments** with full desktop and terminal access. Think of it as having multiple computers running different operating systems, all controlled by AI, accessible through your web browser.

### Key Features

✨ **Multi-OS Support**
- Windows 11 (Full desktop environment)
- Ubuntu 24.04 LTS (GNOME desktop)
- Kali Linux (Security testing tools)
- macOS (Experimental)

🤖 **AI-Powered Control**
- Natural language commands
- Autonomous task execution
- Multiple AI providers (OpenAI, Anthropic, Google, etc.)
- Context-aware assistance

🖥️ **Visual Desktop Access**
- Full GUI access via VNC in browser
- No additional software needed
- Mouse and keyboard support
- Copy/paste functionality

💻 **Terminal Access**
- Web-based terminal
- Multiple concurrent sessions
- Command history and tab completion
- File upload/download

🔒 **Isolated Environments**
- Each project runs in its own container
- Dedicated resources
- Secure file sharing
- Network isolation

📁 **File Management**
- Shared folders between host and container
- Drag-and-drop file upload
- Real-time synchronization
- Version control integration

---

## 🎬 Demo

[**📹 INSERT VIDEO DEMO HERE**]

### Screenshots

[**🖼️ INSERT SCREENSHOT: Main Dashboard**]
*Caption: Main dashboard showing project list and chat interface*

[**🖼️ INSERT SCREENSHOT: Windows 11 Desktop**]
*Caption: Windows 11 desktop running in browser via VNC*

[**🖼️ INSERT SCREENSHOT: Kali Linux Terminal**]
*Caption: Kali Linux terminal with security tools*

[**🖼️ INSERT SCREENSHOT: AI Chat Interface**]
*Caption: AI assistant helping with development tasks*

[**🖼️ INSERT SCREENSHOT: Project Creation**]
*Caption: Creating a new Ubuntu project*

---

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** installed
- **16GB+ RAM** (8GB minimum)
- **100GB+ free disk space**
- **Supabase account** (free tier works)
- **AI provider API key** (OpenAI, Anthropic, or OpenRouter)

### Installation (5 minutes)

#### Windows (PowerShell as Administrator)
```powershell
irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install.ps1 | iex
```

#### macOS/Linux
```bash
curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install.sh | bash
```

### Configuration (2 minutes)

1. **Edit `.env` file** with your API keys:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=sk-...
   ```

2. **Initialize database:**
   ```bash
   ./init-database.sh  # or init-database.ps1 on Windows
   ```

3. **Start the platform:**
   ```bash
   ./start.sh  # or start.ps1 on Windows
   ```

4. **Open browser:** http://localhost:3000

### First Project (3 minutes)

1. Click "**New Project**"
2. Choose **Ubuntu 24** (fastest to start)
3. Enter project name
4. Click "**Create Project**"
5. Wait 30-60 seconds
6. Click "**Open Desktop**" or "**Open Terminal**"

**Total time from zero to running:** ~10 minutes

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](INSTALL.md)** - Detailed installation instructions
- **[User Guide](USER_GUIDE.md)** - Complete user manual
- **[Quick Start Video](#)** - 5-minute video tutorial

### Advanced
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment
- **[API Reference](API_REFERENCE.md)** - REST API documentation
- **[Architecture](ARCHITECTURE.md)** - System architecture

### Troubleshooting
- **[Common Issues](INSTALL.md#troubleshooting)** - Solutions to common problems
- **[FAQ](FAQ.md)** - Frequently asked questions
- **[GitHub Issues](https://github.com/akilhassane/pantheon/issues)** - Report bugs

---

## 🎯 Use Cases

### 1. Development Environments
Create isolated development environments for different projects:
- **Web Development:** Node.js, Python, Ruby, PHP
- **Mobile Development:** Android Studio, React Native
- **Data Science:** Jupyter, pandas, TensorFlow
- **DevOps:** Docker, Kubernetes, Terraform

### 2. Security Testing
Use Kali Linux for ethical hacking and penetration testing:
- Network scanning and enumeration
- Vulnerability assessment
- Web application testing
- Wireless security testing

### 3. Cross-Platform Testing
Test applications across different operating systems:
- Windows desktop applications
- Linux server applications
- macOS applications
- Browser compatibility testing

### 4. Learning & Education
Safe environments for learning:
- Programming tutorials
- System administration
- Cybersecurity training
- Software testing

### 5. Demonstrations & Presentations
Show software running on different platforms:
- Product demos
- Training sessions
- Conference presentations
- Client demonstrations

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Chat UI    │  │  VNC Viewer  │  │   Terminal   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│                    Port: 3000                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  AI Service  │  │   Docker     │  │   Database   │     │
│  │              │  │   Manager    │  │   (Supabase) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                    Port: 3002                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Engine                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Ubuntu     │  │  Kali Linux  │  │  Windows 11  │     │
│  │   Project    │  │   Project    │  │   Project    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 14 (React framework)
- TypeScript
- Tailwind CSS
- Radix UI components
- noVNC (VNC client)
- xterm.js (Terminal emulator)

**Backend:**
- Node.js 18+
- Express.js
- Dockerode (Docker API)
- WebSocket (real-time communication)
- Supabase (Database & Auth)

**Infrastructure:**
- Docker & Docker Compose
- Ubuntu 24.04 (base OS)
- Kali Linux (security testing)
- Windows 11 (via KVM/QEMU)
- VNC (desktop access)
- ttyd (web terminal)

**AI Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- Google (Gemini)
- OpenRouter (multiple models)

---

## 🔧 Configuration

### Environment Variables

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Provider Keys (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...

# Optional: Additional AI Providers
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Server Configuration
PORT=3002
NODE_ENV=production
DEBUG=false
```

### Docker Compose

The platform uses Docker Compose for orchestration. See `docker-compose.production.yml` for the full configuration.

### Resource Limits

Configure resource limits per project:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 4G
    reservations:
      cpus: '1.0'
      memory: 2G
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

1. **Report Bugs** - Open an issue with details
2. **Suggest Features** - Share your ideas
3. **Improve Documentation** - Fix typos, add examples
4. **Submit Pull Requests** - Fix bugs or add features
5. **Share Feedback** - Tell us what you think

### Development Setup

```bash
# Clone repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Start development servers
cd backend && npm run dev
cd frontend && npm run dev
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📊 Project Status

### Current Version: 1.0.0

### Supported Operating Systems

| OS | Status | Desktop | Terminal | AI Control |
|----|--------|---------|----------|------------|
| Ubuntu 24.04 | ✅ Stable | ✅ | ✅ | ✅ |
| Kali Linux | ✅ Stable | ✅ | ✅ | ✅ |
| Windows 11 | ✅ Stable | ✅ | ✅ | ✅ |
| macOS | ⚠️ Experimental | ⚠️ | ✅ | ✅ |

### Roadmap

#### Version 1.1 (Q1 2025)
- [ ] Improved macOS support
- [ ] Project templates
- [ ] Collaborative editing
- [ ] Mobile app

#### Version 1.2 (Q2 2025)
- [ ] Kubernetes support
- [ ] Multi-user projects
- [ ] Advanced monitoring
- [ ] Plugin system

#### Version 2.0 (Q3 2025)
- [ ] Cloud deployment wizard
- [ ] Marketplace for templates
- [ ] Enterprise features
- [ ] Advanced security features

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

- **Docker** - Apache License 2.0
- **Next.js** - MIT License
- **Node.js** - MIT License
- **Supabase** - Apache License 2.0
- **noVNC** - MPL 2.0
- **xterm.js** - MIT License

---

## 🙏 Acknowledgments

- **Docker** - For containerization technology
- **Supabase** - For backend infrastructure
- **OpenAI, Anthropic, Google** - For AI capabilities
- **noVNC** - For browser-based VNC
- **xterm.js** - For terminal emulation
- **The open-source community** - For countless tools and libraries

---

## 📞 Support

### Getting Help

- **Documentation:** Start with [INSTALL.md](INSTALL.md) and [USER_GUIDE.md](USER_GUIDE.md)
- **GitHub Issues:** [Report bugs or request features](https://github.com/akilhassane/pantheon/issues)
- **Discord:** [Join our community](https://discord.gg/pantheon)
- **Email:** support@pantheon.ai

### Commercial Support

For enterprise deployments, custom features, or priority support:
- **Email:** enterprise@pantheon.ai
- **Website:** https://pantheon.ai/enterprise

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=akilhassane/pantheon&type=Date)](https://star-history.com/#akilhassane/pantheon&Date)

---

## 📈 Statistics

- **Docker Pulls:** [INSERT BADGE]
- **GitHub Stars:** [INSERT BADGE]
- **Contributors:** [INSERT BADGE]
- **Open Issues:** [INSERT BADGE]

---

**Built with ❤️ by the Pantheon Team**

**⭐ Star this repo if you find it useful!**

---

## 🔗 Links

- **Website:** https://pantheon.ai
- **Documentation:** https://docs.pantheon.ai
- **GitHub:** https://github.com/akilhassane/pantheon
- **Docker Hub:** https://hub.docker.com/r/akilhassane/pantheon
- **Discord:** https://discord.gg/pantheon
- **Twitter:** [@PantheonAI](https://twitter.com/PantheonAI)
- **YouTube:** [Pantheon AI Channel](https://youtube.com/@pantheonai)

---

**Last Updated:** January 21, 2025
