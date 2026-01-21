# Pantheon User Guide

Welcome to Pantheon! This guide will help you get the most out of the platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Project](#creating-your-first-project)
3. [Using the AI Assistant](#using-the-ai-assistant)
4. [Managing Projects](#managing-projects)
5. [Collaboration](#collaboration)
6. [Settings and Configuration](#settings-and-configuration)
7. [Tips and Best Practices](#tips-and-best-practices)
8. [FAQ](#faq)

---

## Getting Started

### First Login

After installation, open http://localhost:3000 in your browser.

![Login Screen](../assets/login-screen.png)

1. Click **Sign Up** if you're new
2. Enter your email and password
3. Verify your email (check spam folder)
4. Log in with your credentials

### Dashboard Overview

![Main Interface](../assets/main-interface.png)

The Pantheon interface consists of:

- **Sidebar** (left): Projects, sessions, and navigation
- **Chat Area** (center): Conversation with AI
- **Terminal** (bottom): Command execution output
- **Windows Desktop** (right): Visual feedback from Windows

---

## Creating Your First Project

### Step 1: Click New Project

![Create Project Button](../assets/create-project.png)

Click the **+ New Project** button in the sidebar.

### Step 2: Configure Project

Fill in the project details:

- **Name**: Give your project a descriptive name
- **Description**: Optional description
- **OS Type**: Select **Windows** (currently only option)

### Step 3: Wait for Creation

Project creation takes 2-5 minutes:

1. Allocating resources
2. Starting Windows container
3. Initializing environment
4. Setting up tools

You'll see a progress indicator.

### Step 4: Project Ready

Once ready, you'll see:
- ✅ Project status: Running
- 🪟 Windows desktop view
- 💬 Chat interface ready
- 🖥️ Terminal connected

---

## Using the AI Assistant

### Basic Interaction

Simply type what you want the AI to do:

```
You: Open Notepad and type "Hello World"
```

The AI will:
1. Understand your request
2. Execute necessary commands
3. Show you the result
4. Explain what it did

### Example Tasks

#### File Management
```
You: Create a folder called "MyProject" on the desktop
You: List all files in C:\Users\
You: Delete the file test.txt
```

#### Application Control
```
You: Open Chrome and go to google.com
You: Take a screenshot of the current screen
You: Close all open windows
```

#### System Information
```
You: What's the current CPU usage?
You: Show me the installed programs
You: Check the Windows version
```

#### Automation
```
You: Create a PowerShell script that backs up my documents
You: Set up a scheduled task to run every day at 9 AM
You: Install Python and create a virtual environment
```

### Understanding AI Responses

The AI response includes:

1. **Explanation**: What the AI is going to do
2. **Tool Calls**: Commands being executed
3. **Results**: Output from commands
4. **Summary**: What was accomplished

Example:
```
AI: I'll open Notepad and type "Hello World" for you.

[Tool Call: execute_command]
Command: notepad.exe

[Tool Call: type_text]
Text: Hello World

✓ Done! Notepad is now open with "Hello World" typed in it.
```

---

## Managing Projects

### Switching Projects

Click on any project in the sidebar to switch to it.

Each project has:
- Independent Windows environment
- Separate chat history
- Isolated storage
- Own settings

### Project Settings

Click the ⚙️ icon next to project name to access:

- **General**: Name, description
- **AI Model**: Choose AI provider and model
- **Collaborators**: Invite team members
- **Danger Zone**: Delete project

### Stopping/Starting Projects

- **Stop**: Pauses the Windows container (saves resources)
- **Start**: Resumes the Windows container
- **Restart**: Restarts the Windows container

### Deleting Projects

⚠️ **Warning**: This permanently deletes all project data!

1. Go to Project Settings
2. Scroll to Danger Zone
3. Click **Delete Project**
4. Confirm deletion

---

## Collaboration

### Inviting Collaborators

1. Open Project Settings
2. Go to **Collaborators** tab
3. Click **Invite Collaborator**
4. Enter their email
5. Choose role:
   - **Owner**: Full control
   - **Editor**: Can chat and execute commands
   - **Viewer**: Can only view

### Real-time Collaboration

When multiple users are in the same project:

- See who's online (avatars in top-right)
- See what others are typing (cursor indicators)
- All see the same Windows desktop
- All see the same chat history

### Collaboration Etiquette

- Communicate before making major changes
- Use descriptive commit messages
- Don't interrupt ongoing tasks
- Respect others' work

---

## Settings and Configuration

### User Settings

Access via profile icon → Settings

#### Profile
- Update name and email
- Change password
- Upload avatar

#### AI Providers
- Add/remove API keys
- Set default provider
- Configure model preferences

#### Preferences
- Theme (light/dark)
- Language
- Notifications
- Keyboard shortcuts

### Project Settings

#### AI Configuration

Choose your AI model:

**OpenAI**:
- GPT-4o (recommended for complex tasks)
- GPT-4 Turbo (fast and capable)
- GPT-3.5 Turbo (economical)

**Anthropic**:
- Claude 3.5 Sonnet (excellent reasoning)
- Claude 3 Opus (most capable)
- Claude 3 Haiku (fast and economical)

**Google**:
- Gemini 1.5 Pro (multimodal)
- Gemini 1.5 Flash (fast)

**Parameters**:
- **Temperature**: 0.0 (focused) to 1.0 (creative)
- **Max Tokens**: Response length limit
- **Top P**: Nucleus sampling parameter

#### Windows Configuration

- **Screen Resolution**: Adjust Windows display
- **Keyboard Layout**: Change keyboard language
- **Time Zone**: Set Windows time zone

---

## Tips and Best Practices

### Getting Better Results

1. **Be Specific**: 
   - ❌ "Do something with files"
   - ✅ "Create a folder called 'Reports' and move all .xlsx files into it"

2. **Break Down Complex Tasks**:
   - Instead of: "Set up a complete development environment"
   - Try: "Install Python 3.11" → "Install VS Code" → "Create a virtual environment"

3. **Provide Context**:
   - "I'm working on a data analysis project. Install pandas and numpy."

4. **Verify Results**:
   - Ask AI to show you what it did
   - Check the Windows desktop visually
   - Review terminal output

### Saving Costs

1. **Choose Appropriate Models**:
   - Use GPT-3.5 or Claude Haiku for simple tasks
   - Reserve GPT-4 or Claude Opus for complex reasoning

2. **Be Concise**:
   - Shorter prompts = fewer tokens = lower cost

3. **Stop Projects When Not in Use**:
   - Stopped projects don't consume resources

4. **Monitor Usage**:
   - Check usage dashboard regularly
   - Set up budget alerts

### Security Best Practices

1. **Protect API Keys**:
   - Never share your API keys
   - Rotate keys regularly
   - Use environment variables

2. **Project Isolation**:
   - Don't store sensitive data in projects
   - Each project is isolated but not encrypted

3. **Collaborator Access**:
   - Only invite trusted collaborators
   - Use Viewer role when possible
   - Remove collaborators when done

4. **Regular Backups**:
   - Export important data regularly
   - Don't rely on projects for long-term storage

---

## FAQ

### General Questions

**Q: What can Pantheon do?**

A: Pantheon allows AI to control Windows computers. You can automate tasks, manage files, run applications, and more through natural language.

**Q: Is my data safe?**

A: Each project runs in an isolated container. However, don't store highly sensitive data. Use appropriate security measures.

**Q: How much does it cost?**

A: Pantheon itself is free. You pay for:
- AI provider API usage (OpenAI, Anthropic, etc.)
- Supabase (free tier available)
- Server hosting (if self-hosting)

**Q: Can I use it offline?**

A: No, Pantheon requires internet connection for:
- AI provider APIs
- Supabase database
- Docker image downloads

### Technical Questions

**Q: Which AI model should I use?**

A: Depends on your needs:
- **Complex tasks**: GPT-4o, Claude 3.5 Sonnet
- **General use**: GPT-4 Turbo, Claude 3 Sonnet
- **Simple tasks**: GPT-3.5 Turbo, Claude 3 Haiku
- **Cost-effective**: GPT-3.5 Turbo, Gemini 1.5 Flash

**Q: Why is my project slow?**

A: Common causes:
- Insufficient Docker resources
- Slow internet connection
- AI provider rate limits
- Windows container starting up

**Q: Can I run multiple projects simultaneously?**

A: Yes, but each project requires:
- 4 CPU cores
- 8GB RAM
- 20GB disk space

**Q: How do I backup my project?**

A: Currently, you need to manually export files from the Windows container. Automatic backup is planned for future releases.

### Troubleshooting

**Q: AI is not responding**

A: Check:
1. API key is valid
2. You have credits/billing set up
3. Backend is running: `docker ps`
4. Check logs: `docker logs pantheon-backend`

**Q: Windows desktop is black**

A: Try:
1. Wait 30 seconds (Windows may be starting)
2. Refresh the page
3. Restart the project
4. Check VNC connection

**Q: Commands are not executing**

A: Verify:
1. Windows Tools API is running
2. Project is in "Running" state
3. Check terminal for errors
4. Try a simple command first

**Q: I can't create a project**

A: Ensure:
1. Docker has enough resources
2. Ports are not in use
3. Disk space is available
4. Check backend logs

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Focus chat input |
| `Ctrl + Enter` | Send message |
| `Ctrl + /` | Toggle sidebar |
| `Ctrl + ,` | Open settings |
| `Ctrl + N` | New project |
| `Ctrl + P` | Switch project |
| `Esc` | Close modal |

---

## Getting Help

### Documentation

- [Installation Guide](./INSTALLATION_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)

### Community

- 💬 Discord: [Join our server](#)
- 🐛 GitHub Issues: [Report bugs](https://github.com/akilhassane/pantheon/issues)
- 📧 Email: support@pantheon.ai

### Video Tutorials

- [Getting Started](https://youtube.com/watch?v=xxx)
- [Advanced Features](https://youtube.com/watch?v=xxx)
- [Troubleshooting Common Issues](https://youtube.com/watch?v=xxx)

---

## What's Next?

Now that you know the basics:

1. **Explore**: Try different AI models and tasks
2. **Automate**: Create workflows for repetitive tasks
3. **Collaborate**: Invite team members
4. **Contribute**: Share feedback and suggestions

**Happy automating! 🚀**

[⬆ Back to Top](#pantheon-user-guide)
