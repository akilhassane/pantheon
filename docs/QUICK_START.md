# Quick Start Tutorial

Get up and running with Pantheon in 10 minutes.

## Prerequisites

Before starting, ensure you have:
- ✅ Docker installed and running
- ✅ Supabase account created
- ✅ At least one AI provider API key

## Step 1: Install Pantheon (2 minutes)

### Linux/macOS
```bash
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh
chmod +x install-pantheon.sh
bash install-pantheon.sh
```

### Windows
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"
powershell -ExecutionPolicy Bypass -File install-pantheon.ps1
```

Wait for Docker images to download and containers to start.

## Step 2: Configure Environment (2 minutes)

1. Open the `.env` file in your favorite editor
2. Add your credentials:

```env
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GOOGLE_API_KEY=...
```

3. Save the file
4. Restart services:
```bash
docker-compose -f docker-compose.production.yml restart
```

## Step 3: Access Pantheon (1 minute)

1. Open your browser
2. Navigate to `http://localhost:3000`
3. You should see the Pantheon interface

## Step 4: Create Your First Project (1 minute)

1. Click **"New Project"** in the sidebar
2. Enter a name: `My First Project`
3. Select OS: `Windows`
4. Click **"Create"**

Wait a few seconds for the project to initialize.

## Step 5: Configure AI Model (2 minutes)

1. Click the **Settings** icon (⚙️)
2. Go to **"AI Models"** tab
3. Your API key should be detected automatically
4. Select your preferred model (e.g., GPT-4)
5. Click **"Save"**

## Step 6: Your First AI Command (2 minutes)

Now let's test the AI automation:

### Example 1: Open Notepad
```
Open Notepad
```

The AI will:
1. Understand your request
2. Click the Start menu
3. Search for Notepad
4. Open the application

### Example 2: Take a Screenshot
```
Take a screenshot of the desktop
```

The AI will:
1. Capture the screen
2. Show you the image
3. Save it to the project

### Example 3: Create a File
```
Create a new text file called "hello.txt" with the content "Hello, Pantheon!"
```

The AI will:
1. Open Notepad
2. Type the content
3. Save the file with the specified name

## What's Next?

### Learn More

- 📘 [User Guide](./USER_GUIDE.md) - Comprehensive usage guide
- 🔧 [API Reference](./API_REFERENCE.md) - Integrate with your apps
- 🏗️ [Architecture](./ARCHITECTURE.md) - Understand how it works

### Try These Commands

```
"Open Chrome and go to github.com"
"Create a folder called Projects on the desktop"
"Search for Python in the start menu"
"Open Calculator and compute 123 * 456"
"Take a screenshot and describe what you see"
```

### Advanced Features

- **Collaboration**: Share projects with team members
- **Multiple Models**: Switch between different AI providers
- **Usage Tracking**: Monitor costs and token usage
- **Custom Modes**: Create specialized AI assistants

## Troubleshooting

### Can't Access http://localhost:3000

```bash
# Check if containers are running
docker ps

# View logs
docker-compose -f docker-compose.production.yml logs -f frontend
```

### AI Not Responding

1. Verify API key in Settings
2. Check internet connection
3. Try a different AI model
4. Check browser console for errors

### Project Won't Create

1. Ensure Docker has enough resources
2. Check disk space (need 64GB free)
3. View backend logs:
```bash
docker-compose -f docker-compose.production.yml logs -f backend
```

## Getting Help

- 📚 [Full Documentation](./INSTALLATION_GUIDE.md)
- 🐛 [Report Issues](https://github.com/akilhassane/pantheon/issues)
- 🔍 [Troubleshooting Guide](./TROUBLESHOOTING.md)

## Success! 🎉

You're now ready to use Pantheon AI Platform. Start automating tasks, building workflows, and exploring the possibilities of AI-OS interaction.

---

[← Back to README](../README.md)
