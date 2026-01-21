# Pantheon AI Platform - Quick Start Guide

**Get up and running in 10 minutes!**

---

## ⚡ Prerequisites (2 minutes)

### Required
- [ ] **Docker Desktop** installed and running
- [ ] **16GB RAM** (8GB minimum)
- [ ] **50GB free disk space** (100GB recommended)
- [ ] **Internet connection** for downloading images

### Accounts Needed
- [ ] **Supabase account** (free) - [Sign up here](https://supabase.com)
- [ ] **OpenAI API key** (paid) - [Get key here](https://platform.openai.com/api-keys)
  - OR **Anthropic API key** - [Get key here](https://console.anthropic.com)
  - OR **OpenRouter API key** - [Get key here](https://openrouter.ai)

---

## 🚀 Installation (5 minutes)

### Step 1: Run Installer

**Windows (PowerShell as Administrator):**
```powershell
irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install.sh | bash
```

The installer will:
- ✅ Check system requirements
- ✅ Verify Docker installation
- ✅ Create project directory
- ✅ Download configuration files
- ✅ Pull Docker images (~5GB)
- ✅ Create helper scripts

### Step 2: Configure Environment

Navigate to the project directory:
```bash
cd pantheon-ai
```

Edit the `.env` file with your API keys:

**Windows:**
```powershell
notepad .env
```

**macOS:**
```bash
open -e .env
```

**Linux:**
```bash
nano .env
```

Replace these values:
```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Public Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider API Keys (at least one required)
OPENAI_API_KEY=sk-...
```

**Where to find Supabase keys:**
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **Project URL**, **anon public** key, and **service_role** key

### Step 3: Initialize Database

**Windows:**
```powershell
.\init-database.ps1
```

**macOS/Linux:**
```bash
./init-database.sh
```

This creates all necessary database tables in your Supabase project.

### Step 4: Start the Platform

**Windows:**
```powershell
.\start.ps1
```

**macOS/Linux:**
```bash
./start.sh
```

Wait 30-60 seconds for services to start.

### Step 5: Access the Platform

Open your browser and go to:
```
http://localhost:3000
```

---

## 🎯 First Project (3 minutes)

### 1. Create Account

1. Click "**Sign Up**"
2. Enter email and password
3. Check email for verification link
4. Click verification link
5. Log in

### 2. Create Project

1. Click "**+ New Project**" button
2. Choose **Ubuntu 24** (fastest to start)
3. Enter project name: `my-first-project`
4. Click "**Create Project**"
5. Wait 30-60 seconds for container to start

### 3. Access Your Project

**Option A: Desktop Access**
1. Click "**Open Desktop**" button
2. Wait 2-3 seconds for VNC to connect
3. You'll see Ubuntu desktop in your browser!

**Option B: Terminal Access**
1. Click "**Open Terminal**" button
2. Terminal opens in browser
3. Try a command: `ls -la`

**Option C: AI Chat**
1. Type in chat: `"Show me system information"`
2. AI executes command and shows results
3. Try: `"Create a file called hello.txt with 'Hello World'"`

---

## 💡 Quick Commands to Try

### System Information
```
"Show me the system information"
"What's the current disk usage?"
"List all running processes"
```

### File Operations
```
"Create a new file called test.py"
"Show me the contents of /etc/os-release"
"List all files in the current directory"
```

### Development
```
"Install Node.js"
"Create a simple Express.js server"
"Show me the Node.js version"
```

### AI Assistance
```
"Help me set up a Python development environment"
"Write a Python script to calculate fibonacci numbers"
"Debug this error: [paste error message]"
```

---

## 🛠️ Useful Commands

### Managing the Platform

**Start:**
```bash
./start.sh  # or start.ps1 on Windows
```

**Stop:**
```bash
./stop.sh  # or stop.ps1 on Windows
```

**View Logs:**
```bash
./logs.sh  # or logs.ps1 on Windows
```

**View Specific Service Logs:**
```bash
./logs.sh backend  # or logs.ps1 backend on Windows
```

**Update to Latest Version:**
```bash
./update.sh  # or update.ps1 on Windows
```

### Docker Commands

**Check Status:**
```bash
docker-compose ps
```

**Restart Services:**
```bash
docker-compose restart
```

**Stop and Remove:**
```bash
docker-compose down
```

**View Resource Usage:**
```bash
docker stats
```

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:**
- **Windows/macOS:** Start Docker Desktop application
- **Linux:** `sudo systemctl start docker`

### Issue: "Port already in use"

**Solution:**
Edit `docker-compose.yml` and change the port:
```yaml
ports:
  - "3001:3000"  # Changed from 3000:3000
```

### Issue: "Failed to pull image"

**Solution:**
1. Check internet connection
2. Try pulling manually:
   ```bash
   docker pull akilhassane/pantheon:frontend
   docker pull akilhassane/pantheon:backend
   ```

### Issue: "Database connection failed"

**Solution:**
1. Verify Supabase credentials in `.env`
2. Check Supabase project is active
3. Run database initialization again:
   ```bash
   ./init-database.sh  # or init-database.ps1
   ```

### Issue: "Frontend shows API Error"

**Solution:**
1. Check backend is running:
   ```bash
   docker-compose ps backend
   ```
2. View backend logs:
   ```bash
   docker-compose logs backend
   ```
3. Restart backend:
   ```bash
   docker-compose restart backend
   ```

---

## 📚 Next Steps

### Learn More
- **[User Guide](USER_GUIDE.md)** - Complete user manual
- **[Installation Guide](INSTALL.md)** - Detailed installation
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

### Try Different OS Types
- **Kali Linux** - Security testing tools
- **Windows 11** - Full Windows desktop
- **macOS** - macOS environment (experimental)

### Explore Features
- Create multiple projects
- Use AI for complex tasks
- Share files between host and container
- Configure AI models and settings

### Join Community
- **GitHub:** [github.com/akilhassane/pantheon](https://github.com/akilhassane/pantheon)
- **Discord:** [Join our community](https://discord.gg/pantheon)
- **Twitter:** [@PantheonAI](https://twitter.com/PantheonAI)

---

## 🎓 Video Tutorials

[**📹 INSERT: Installation Walkthrough (5 min)**]

[**📹 INSERT: Creating Your First Project (3 min)**]

[**📹 INSERT: Using the AI Assistant (10 min)**]

[**📹 INSERT: Desktop Access Tutorial (5 min)**]

---

## ❓ Common Questions

**Q: How much does it cost?**
A: Pantheon is free and open-source. You only pay for:
- AI provider API usage (OpenAI, Anthropic, etc.)
- Supabase (free tier available)
- Cloud hosting (if deploying to cloud)

**Q: Can I use it offline?**
A: No, you need internet for:
- AI provider API calls
- Supabase database connection
- Initial image downloads

**Q: How many projects can I create?**
A: Unlimited! Limited only by your system resources.

**Q: Can I access projects from different computers?**
A: Yes, if you deploy to a server with a public IP or domain.

**Q: Is my data secure?**
A: Yes, all data is stored in your Supabase project and containers run locally on your machine.

**Q: Can I contribute?**
A: Absolutely! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📞 Get Help

**Having issues?**
1. Check [Troubleshooting](#troubleshooting) section above
2. Read [Installation Guide](INSTALL.md#troubleshooting)
3. Search [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
4. Ask on [Discord](https://discord.gg/pantheon)
5. Create a [new issue](https://github.com/akilhassane/pantheon/issues/new)

---

**🎉 Congratulations! You're now ready to use Pantheon AI Platform!**

**⭐ If you find this useful, please star the repo on GitHub!**

---

**Last Updated:** January 21, 2025
