# Pantheon AI Platform - User Guide

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [User Interface Overview](#user-interface-overview)
3. [Creating Projects](#creating-projects)
4. [Using the AI Assistant](#using-the-ai-assistant)
5. [Desktop Access (VNC)](#desktop-access-vnc)
6. [Terminal Access](#terminal-access)
7. [File Management](#file-management)
8. [Project Settings](#project-settings)
9. [AI Model Configuration](#ai-model-configuration)
10. [Tips & Best Practices](#tips--best-practices)

---

## 🚀 Getting Started

### First Login

1. Navigate to http://localhost:3000
2. Click "Sign Up" if you don't have an account
3. Enter your email and password
4. Verify your email (check spam folder)
5. Log in with your credentials

### Dashboard Overview

After logging in, you'll see:
- **Sidebar:** Navigation and project list
- **Main Area:** Chat interface or project view
- **Top Bar:** User menu and settings

---

## 🖥️ User Interface Overview

### Sidebar

The sidebar contains:

#### Navigation
- **Home** - Dashboard and overview
- **Projects** - List of all your projects
- **Settings** - Platform configuration
- **Profile** - User account settings

#### Project List
- Shows all active projects
- Click to switch between projects
- Color-coded by OS type:
  - 🟦 **Blue** - Windows
  - 🟧 **Orange** - Ubuntu
  - 🟥 **Red** - Kali Linux
  - 🟪 **Purple** - macOS

#### Quick Actions
- **+ New Project** - Create new project
- **🔍 Search** - Find projects
- **⚙️ Settings** - Quick settings access

### Main Chat Interface

The chat interface includes:

#### Message Area
- **User messages** - Your prompts (right side)
- **AI responses** - Assistant replies (left side)
- **Tool calls** - Actions performed by AI
- **Code blocks** - Syntax-highlighted code
- **Images** - Screenshots and visual content

#### Input Area
- **Text input** - Type your messages
- **Attach files** - Upload files to share
- **Voice input** - Speech-to-text (if enabled)
- **Send button** - Submit message

#### Toolbar
- **Stop** - Stop AI generation
- **Clear** - Clear chat history
- **Export** - Export conversation
- **Settings** - Chat settings

---

## 📦 Creating Projects

### Step-by-Step Project Creation

1. **Click "New Project"** button in sidebar

2. **Choose OS Type:**

   #### Ubuntu 24.04 LTS
   - **Best for:** General development, web apps, Python, Node.js
   - **Desktop:** GNOME desktop environment
   - **Size:** ~2GB
   - **Boot time:** 30-45 seconds
   - **Recommended RAM:** 4GB

   #### Kali Linux
   - **Best for:** Security testing, penetration testing, ethical hacking
   - **Desktop:** XFCE desktop environment
   - **Size:** ~3GB
   - **Boot time:** 30-45 seconds
   - **Recommended RAM:** 4GB
   - **Includes:** 200+ security tools (nmap, metasploit, burpsuite, etc.)

   #### Windows 11 (25H2)
   - **Best for:** Windows development, .NET, PowerShell, Windows apps
   - **Desktop:** Full Windows 11 desktop
   - **Size:** ~38GB
   - **Boot time:** 2-3 minutes
   - **Recommended RAM:** 8GB+
   - **Includes:** PowerShell, Windows Terminal, development tools

   #### macOS (Experimental)
   - **Best for:** macOS development, iOS development
   - **Desktop:** macOS interface
   - **Size:** ~15GB
   - **Boot time:** 3-5 minutes
   - **Recommended RAM:** 8GB+
   - **Note:** Requires manual setup, see documentation

3. **Configure Project:**
   - **Name:** Give your project a descriptive name
   - **Description:** Optional description
   - **AI Mode:** Choose AI behavior mode:
     - **Autonomous** - AI acts independently
     - **Collaborative** - AI asks for confirmation
     - **Guided** - AI provides suggestions only

4. **Click "Create Project"**

5. **Wait for initialization:**
   - Container creation: 10-20 seconds
   - OS boot: 30 seconds - 3 minutes (depending on OS)
   - Service startup: 10-20 seconds

6. **Project Ready!**
   - Green indicator shows project is running
   - Access desktop, terminal, or chat

### Project Templates

Pre-configured templates for common use cases:

#### Web Development
- Node.js, npm, yarn
- Python, pip, virtualenv
- Git, Docker
- VS Code (optional)

#### Security Testing
- Kali Linux with all tools
- Metasploit Framework
- Burp Suite
- Wireshark, nmap, etc.

#### Data Science
- Python 3.11+
- Jupyter Notebook
- pandas, numpy, scikit-learn
- TensorFlow, PyTorch

#### DevOps
- Docker, Kubernetes
- Terraform, Ansible
- AWS CLI, Azure CLI
- Jenkins, GitLab CI

---

## 🤖 Using the AI Assistant

### Basic Commands

The AI assistant can help you with various tasks:

#### System Commands
```
"Show me the system information"
"What's the current disk usage?"
"List all running processes"
"Check network connectivity"
```

#### File Operations
```
"Create a new file called app.py"
"Show me the contents of config.json"
"Delete the old-data folder"
"Find all Python files in this directory"
```

#### Development Tasks
```
"Install Node.js and npm"
"Create a React app called my-app"
"Run the development server"
"Build the production bundle"
```

#### Security Testing (Kali Linux)
```
"Scan my network for devices"
"Check if port 80 is open on 192.168.1.1"
"Run a vulnerability scan on example.com"
"Test this website for SQL injection"
```

### AI Modes

#### Autonomous Mode
- AI executes commands automatically
- Best for: Experienced users, repetitive tasks
- Example: "Set up a complete MERN stack development environment"

#### Collaborative Mode (Default)
- AI asks for confirmation before executing
- Best for: Learning, critical operations
- Example: "Install Docker" → AI shows command → You approve

#### Guided Mode
- AI provides instructions without executing
- Best for: Learning, manual control
- Example: "How do I install Python?" → AI explains steps

### Advanced Features

#### Multi-Step Workflows
```
"Create a Python web scraper that:
1. Fetches data from example.com
2. Parses the HTML
3. Saves results to CSV
4. Schedules to run daily"
```

#### Context Awareness
The AI remembers:
- Previous commands in the session
- Files you've created or modified
- Installed packages and tools
- Project structure and configuration

#### Code Generation
```
"Write a Python function to calculate fibonacci numbers"
"Create a REST API with Express.js"
"Generate a Dockerfile for this Node.js app"
```

#### Debugging
```
"Why is this Python script failing?"
"Debug this error: [paste error message]"
"Optimize this SQL query"
```

---

## 🖥️ Desktop Access (VNC)

### Opening Desktop View

1. Click "Open Desktop" button in project view
2. Wait for VNC connection (2-3 seconds)
3. Desktop appears in browser window

### Desktop Features

#### Mouse & Keyboard
- **Click:** Normal mouse clicks work
- **Right-click:** Context menus
- **Keyboard:** All keys work including shortcuts
- **Copy/Paste:** Use browser clipboard

#### Window Management
- **Maximize:** Double-click title bar
- **Minimize:** Click minimize button
- **Close:** Click X button
- **Move:** Drag title bar

#### Applications

**Ubuntu/Kali:**
- **Terminal:** Click terminal icon or press Ctrl+Alt+T
- **File Manager:** Click files icon
- **Web Browser:** Firefox pre-installed
- **Text Editor:** gedit or nano

**Windows:**
- **PowerShell:** Click Start → PowerShell
- **File Explorer:** Click folder icon
- **Edge Browser:** Pre-installed
- **Notepad:** Start → Notepad

### VNC Settings

#### Display Quality
- **High Quality:** Best visual experience, more bandwidth
- **Balanced:** Good quality, moderate bandwidth
- **Low Quality:** Faster on slow connections

#### Scaling
- **Fit to Window:** Scale to fit browser window
- **Native Resolution:** Show actual resolution
- **Custom:** Set specific scale percentage

#### Clipboard
- **Enable Clipboard Sync:** Share clipboard between host and container
- **Auto-paste:** Automatically paste copied text

### Troubleshooting Desktop

#### Black Screen
- Wait 30 seconds for desktop to load
- Refresh browser page
- Check container logs: `docker logs <container-name>`

#### Slow Performance
- Reduce display quality
- Close unnecessary applications
- Increase container resources

#### Keyboard Not Working
- Click inside VNC window to focus
- Check browser doesn't have conflicting shortcuts
- Try different browser

---

## 💻 Terminal Access

### Opening Terminal

1. Click "Open Terminal" button
2. Terminal opens in browser
3. Full bash/PowerShell access

### Terminal Features

#### Command History
- **Up/Down arrows:** Navigate history
- **Ctrl+R:** Search history
- **history:** Show all commands

#### Tab Completion
- Press **Tab** to autocomplete
- Double **Tab** to show options

#### Copy/Paste
- **Copy:** Ctrl+Shift+C (Linux) or Ctrl+C (Windows)
- **Paste:** Ctrl+Shift+V (Linux) or Ctrl+V (Windows)

#### Multiple Sessions
- Open multiple terminal tabs
- Each tab is independent session
- Share same filesystem

### Common Terminal Commands

#### Navigation
```bash
pwd                 # Print working directory
ls                  # List files
cd /path/to/dir     # Change directory
cd ..               # Go up one level
cd ~                # Go to home directory
```

#### File Operations
```bash
cat file.txt        # View file contents
nano file.txt       # Edit file
cp source dest      # Copy file
mv source dest      # Move/rename file
rm file.txt         # Delete file
mkdir dirname       # Create directory
```

#### System Information
```bash
uname -a            # System information
df -h               # Disk usage
free -h             # Memory usage
top                 # Process monitor
ps aux              # List processes
```

#### Package Management

**Ubuntu/Kali:**
```bash
sudo apt update                 # Update package list
sudo apt install package-name   # Install package
sudo apt remove package-name    # Remove package
sudo apt search keyword         # Search packages
```

**Windows (PowerShell):**
```powershell
choco install package-name      # Install with Chocolatey
winget install package-name     # Install with winget
Get-Command                     # List commands
Get-Help command-name           # Get help
```

---

## 📁 File Management

### Shared Folders

Each project has a shared folder accessible from:
- **Host machine:** `./projects/<project-id>/shared`
- **Container:** `/workspace` (Linux) or `C:\workspace` (Windows)

### Uploading Files

#### Via Web Interface
1. Click "Upload" button
2. Select files from your computer
3. Files appear in shared folder

#### Via Drag & Drop
1. Drag files from your computer
2. Drop onto file manager area
3. Files automatically upload

#### Via Terminal
```bash
# From host machine, copy to shared folder
cp myfile.txt ./projects/<project-id>/shared/

# File is immediately available in container at /workspace/myfile.txt
```

### Downloading Files

#### Via Web Interface
1. Right-click file in file manager
2. Click "Download"
3. File downloads to your computer

#### Via Terminal
```bash
# Copy from container to shared folder
cp /path/to/file /workspace/

# Then access from host at ./projects/<project-id>/shared/
```

### File Permissions

Files in shared folders maintain permissions:
- **Linux:** Standard Unix permissions (chmod, chown)
- **Windows:** NTFS permissions

### File Synchronization

Changes are synchronized in real-time:
- Edit file on host → Immediately visible in container
- Edit file in container → Immediately visible on host

---

## ⚙️ Project Settings

### Accessing Settings

1. Click project name in sidebar
2. Click "Settings" tab
3. Configure options

### General Settings

#### Project Information
- **Name:** Change project name
- **Description:** Update description
- **Tags:** Add organizational tags

#### Resource Limits
- **CPU:** Limit CPU cores (1-8)
- **Memory:** Limit RAM (2GB-32GB)
- **Disk:** Set disk quota (10GB-500GB)

### AI Configuration

#### AI Mode
- **Autonomous:** AI acts independently
- **Collaborative:** AI asks for confirmation
- **Guided:** AI provides instructions only

#### Model Selection
- **OpenAI GPT-4:** Best overall performance
- **Claude 3 Opus:** Best for coding
- **GPT-3.5 Turbo:** Faster, cheaper
- **Custom:** Use specific model

#### Temperature
- **0.0:** Deterministic, focused
- **0.5:** Balanced (default)
- **1.0:** Creative, varied

### Network Settings

#### Port Forwarding
Expose container ports to host:
```yaml
Container Port → Host Port
80            → 8080
3000          → 3000
5432          → 5432
```

#### DNS Configuration
- **Use host DNS:** Use host machine DNS
- **Custom DNS:** Specify DNS servers
- **No DNS:** Disable DNS resolution

### Backup & Restore

#### Create Backup
1. Click "Create Backup"
2. Wait for backup to complete
3. Download backup file

#### Restore from Backup
1. Click "Restore"
2. Select backup file
3. Confirm restoration
4. Wait for restore to complete

---

## 🎨 AI Model Configuration

### Supported Providers

#### OpenAI
- **GPT-4 Turbo:** Latest, most capable
- **GPT-4:** Stable, reliable
- **GPT-3.5 Turbo:** Fast, economical

#### Anthropic
- **Claude 3 Opus:** Most capable
- **Claude 3 Sonnet:** Balanced
- **Claude 3 Haiku:** Fast, efficient

#### Google
- **Gemini Pro:** Multimodal
- **Gemini Ultra:** Most capable

#### OpenRouter
- Access to 100+ models
- Automatic fallback
- Cost optimization

### Configuring Models

1. Go to **Settings** → **AI Models**
2. Select provider
3. Enter API key
4. Choose default model
5. Set fallback models

### Model Comparison

| Model | Speed | Cost | Coding | Reasoning | Context |
|-------|-------|------|--------|-----------|---------|
| GPT-4 Turbo | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 128K |
| Claude 3 Opus | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 200K |
| GPT-3.5 Turbo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 16K |
| Gemini Pro | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 32K |

### Cost Optimization

#### Tips to Reduce Costs
1. Use GPT-3.5 for simple tasks
2. Enable caching for repeated queries
3. Set token limits
4. Use streaming for long responses
5. Implement rate limiting

#### Budget Alerts
1. Go to **Settings** → **Billing**
2. Set monthly budget limit
3. Enable email alerts
4. View usage dashboard

---

## 💡 Tips & Best Practices

### Performance Optimization

#### Container Resources
- Allocate sufficient RAM (4GB+ for Linux, 8GB+ for Windows)
- Use SSD storage for better I/O
- Limit concurrent projects (2-3 active)

#### Network Performance
- Use wired connection for VNC
- Reduce VNC quality on slow connections
- Enable compression in terminal

### Security Best Practices

#### API Keys
- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Use separate keys for development/production

#### Container Security
- Keep images updated
- Don't run as root (Linux)
- Use network isolation
- Enable firewall rules

#### Data Protection
- Backup important projects regularly
- Use encryption for sensitive data
- Don't store passwords in plain text
- Enable 2FA on Supabase account

### Workflow Tips

#### Organizing Projects
- Use descriptive names
- Add tags for categorization
- Archive inactive projects
- Document project purpose

#### Efficient AI Usage
- Be specific in prompts
- Provide context
- Use examples
- Break complex tasks into steps

#### Collaboration
- Share project exports
- Document setup steps
- Use version control (git)
- Create project templates

### Troubleshooting Tips

#### General Issues
1. Check container logs first
2. Verify environment variables
3. Restart container if needed
4. Check disk space
5. Review recent changes

#### Performance Issues
1. Check resource usage
2. Close unnecessary applications
3. Restart Docker
4. Clear Docker cache
5. Increase resource limits

#### Connection Issues
1. Verify network connectivity
2. Check firewall settings
3. Test with different browser
4. Disable VPN if active
5. Check Docker network

---

## 📚 Additional Resources

### Documentation
- **Installation Guide:** INSTALL.md
- **API Reference:** API_REFERENCE.md
- **Architecture:** ARCHITECTURE.md
- **Contributing:** CONTRIBUTING.md

### Community
- **GitHub:** [github.com/akilhassane/pantheon](https://github.com/akilhassane/pantheon)
- **Issues:** Report bugs and request features
- **Discussions:** Ask questions and share ideas

### Support
- **Email:** support@pantheon.ai
- **Discord:** [Join our community](https://discord.gg/pantheon)
- **Twitter:** [@PantheonAI](https://twitter.com/PantheonAI)

---

## 🎓 Learning Resources

### Tutorials
1. **Getting Started** - 10 minutes
2. **Creating Your First Project** - 15 minutes
3. **Using the AI Assistant** - 20 minutes
4. **Advanced Workflows** - 30 minutes

### Video Guides
- **Installation Walkthrough** - [Watch on YouTube](#)
- **Project Creation Demo** - [Watch on YouTube](#)
- **AI Assistant Tutorial** - [Watch on YouTube](#)
- **Security Testing with Kali** - [Watch on YouTube](#)

### Example Projects
- **Web Development Setup** - Full MERN stack
- **Python Data Science** - Jupyter + pandas
- **Security Lab** - Kali Linux pentesting
- **Windows Development** - .NET + PowerShell

---

**Happy Building! 🚀**

For questions or issues, visit our [GitHub repository](https://github.com/akilhassane/pantheon) or join our [Discord community](https://discord.gg/pantheon).
