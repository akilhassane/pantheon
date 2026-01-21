# Pantheon User Guide

Welcome to Pantheon! This guide will help you get the most out of the platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Initial Setup: Configure API Keys](#initial-setup-configure-api-keys)
3. [Creating Your First Project](#creating-your-first-project)
4. [Using the AI Assistant](#using-the-ai-assistant)
5. [Managing Projects](#managing-projects)
6. [Collaboration](#collaboration)
7. [Settings and Configuration](#settings-and-configuration)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [FAQ](#faq)

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

## Initial Setup: Configure API Keys

⚠️ **IMPORTANT**: Before you can chat with the AI, you must configure at least one AI provider API key.

### Why Do I Need API Keys?

Pantheon uses AI models from providers like OpenAI, Anthropic, Google, and OpenRouter. These providers require API keys to authenticate and bill usage. Without an API key, the AI cannot respond to your messages.

### Step 1: Get API Keys from Providers

Choose one or more providers and obtain API keys:

#### OpenAI (GPT-4, GPT-3.5)
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click **Create new secret key**
4. Copy the key (starts with `sk-...`)
5. Add billing information at [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)

**Recommended for**: General purpose, complex reasoning, coding tasks

#### Anthropic (Claude)
1. Go to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Sign up or log in
3. Click **Create Key**
4. Copy the key (starts with `sk-ant-...`)
5. Add billing information in account settings

**Recommended for**: Long conversations, analysis, writing tasks

#### Google AI (Gemini)
1. Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click **Create API Key**
4. Copy the key
5. Enable billing if needed

**Recommended for**: Multimodal tasks, fast responses, cost-effective

#### OpenRouter (Multiple Models)
1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Click **Create Key**
4. Copy the key (starts with `sk-or-...`)
5. Add credits at [https://openrouter.ai/credits](https://openrouter.ai/credits)

**Recommended for**: Access to multiple models, flexible pricing, experimentation

### Step 2: Add API Keys to Pantheon

![Settings Icon](../assets/settings-icon.png)

1. Click the **⚙️ Settings** icon in the top-right corner (or click your profile picture → Settings)
2. Navigate to **AI Providers** section in the left sidebar

![AI Providers Settings](../assets/ai-providers-settings.png)

3. For each provider you want to use:
   - Click the **Add API Key** button next to the provider name
   - Paste your API key in the input field
   - Click **Save**

4. You should see a ✅ success message confirming the key was saved

### Step 3: Fetch Available Models

After adding an API key, you need to fetch the list of available models:

![Fetch Models Button](../assets/fetch-models.png)

1. Click the **Fetch Models** button next to the provider
2. Wait a few seconds while Pantheon retrieves the model list
3. You'll see a list of available models appear

**Available Models by Provider**:

**OpenAI**:
- `gpt-4o` - Most capable, multimodal
- `gpt-4-turbo` - Fast and powerful
- `gpt-4` - Reliable and capable
- `gpt-3.5-turbo` - Fast and economical

**Anthropic**:
- `claude-3-5-sonnet-20241022` - Latest, most capable
- `claude-3-opus-20240229` - Most intelligent
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast and economical

**Google**:
- `gemini-1.5-pro` - Most capable, multimodal
- `gemini-1.5-flash` - Fast and efficient
- `gemini-1.0-pro` - Reliable

**OpenRouter**:
- Access to 100+ models from various providers
- Models from OpenAI, Anthropic, Google, Meta, and more

### Step 4: Select a Default Model

![Select Model](../assets/select-model.png)

1. From the model dropdown, select your preferred model
2. Click **Set as Default**
3. This model will be used for all new projects

**Model Selection Tips**:
- **For complex tasks**: GPT-4o, Claude 3.5 Sonnet
- **For general use**: GPT-4 Turbo, Claude 3 Sonnet
- **For simple tasks**: GPT-3.5 Turbo, Claude 3 Haiku
- **For cost savings**: GPT-3.5 Turbo, Gemini 1.5 Flash

### Step 5: Verify Configuration

To verify your setup is working:

1. Go back to the main dashboard
2. Create a test project (see next section)
3. Try sending a simple message like "Hello, can you help me?"
4. If the AI responds, your setup is complete! ✅

### Troubleshooting API Key Issues

**Error: "No API key configured"**
- Make sure you added at least one API key in Settings → AI Providers
- Verify the key was saved (you should see a ✅ confirmation)
- Try refreshing the page

**Error: "Invalid API key"**
- Double-check you copied the entire key (no spaces or extra characters)
- Verify the key is active in your provider's dashboard
- Try generating a new key

**Error: "No models available"**
- Click the **Fetch Models** button after adding your API key
- Check your internet connection
- Verify your API key has proper permissions

**Error: "Insufficient credits" or "Rate limit exceeded"**
- Add billing information to your provider account
- Check your usage limits in the provider's dashboard
- Wait a few minutes and try again

**Still having issues?**
- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review backend logs: `docker logs pantheon-backend`
- Report issues on [GitHub](https://github.com/akilhassane/pantheon/issues)

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

Access via profile icon → Settings (or click ⚙️ icon in top-right)

#### Profile
- **Name**: Update your display name
- **Email**: Change your email address (requires verification)
- **Password**: Change your password
- **Avatar**: Upload a profile picture (JPG, PNG, max 2MB)

#### AI Providers

This is where you manage your AI provider API keys and models.

**Adding a New API Key**:
1. Click **Add API Key** next to the provider name
2. Paste your API key
3. Click **Save**
4. Wait for ✅ confirmation

**Fetching Models**:
1. After adding an API key, click **Fetch Models**
2. Wait for the model list to load
3. Models will appear in the dropdown

**Setting Default Model**:
1. Select a model from the dropdown
2. Click **Set as Default**
3. This model will be used for new projects

**Removing an API Key**:
1. Click the **🗑️ Delete** icon next to the API key
2. Confirm deletion
3. All models from that provider will be removed

**Updating an API Key**:
1. Delete the old key
2. Add the new key
3. Fetch models again

**Managing Multiple Keys**:
- You can add keys for multiple providers
- Each provider's models will be available
- Switch between models per project

**API Key Security**:
- Keys are stored encrypted in the database
- Never share your API keys
- Rotate keys regularly for security
- If a key is compromised, delete it immediately and generate a new one

#### Preferences
- **Theme**: Light or dark mode
- **Language**: Interface language (English, Spanish, French, etc.)
- **Notifications**: Enable/disable notifications
- **Keyboard Shortcuts**: Customize shortcuts
- **Auto-save**: Automatically save chat history

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

**Q: Do I need to pay for Pantheon?**

A: Pantheon itself is free and open-source. However, you need to pay for:
- **AI provider API usage** (OpenAI, Anthropic, Google, OpenRouter) - This is the main cost
- **Supabase** (free tier available for small projects)
- **Server hosting** (if self-hosting instead of running locally)

**Q: Which AI provider should I choose?**

A: It depends on your needs and budget:
- **OpenAI**: Best for general purpose, widely supported, good documentation
- **Anthropic**: Excellent for long conversations and analysis
- **Google**: Cost-effective, good for multimodal tasks
- **OpenRouter**: Access to many models, flexible pricing

You can add multiple providers and switch between them.

**Q: How much will API usage cost?**

A: Costs vary by provider and model:
- **GPT-3.5 Turbo**: ~$0.002 per 1K tokens (very cheap)
- **GPT-4 Turbo**: ~$0.01-0.03 per 1K tokens (moderate)
- **GPT-4o**: ~$0.005-0.015 per 1K tokens (moderate)
- **Claude 3 Haiku**: ~$0.00025 per 1K tokens (very cheap)
- **Claude 3.5 Sonnet**: ~$0.003-0.015 per 1K tokens (moderate)

A typical conversation might use 1,000-5,000 tokens, costing $0.01-0.15.

**Q: Can I use Pantheon without an API key?**

A: No, you must configure at least one AI provider API key to use Pantheon. The AI needs to connect to a model provider to function.

**Q: Is my data safe?**

A: Each project runs in an isolated container. However, don't store highly sensitive data. Use appropriate security measures. API keys are stored encrypted.

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
- 64GB disk space

**Q: How do I backup my project?**

A: Currently, you need to manually export files from the Windows container. Automatic backup is planned for future releases.

### Troubleshooting

**Q: AI is not responding**

A: Check:
1. **API key is configured**: Go to Settings → AI Providers and verify you have at least one API key added
2. **Model is selected**: Make sure you've fetched models and selected a default model
3. **API key is valid**: Test the key in the provider's dashboard
4. **You have credits**: Check your billing status with the provider
5. **Backend is running**: Run `docker ps` to verify containers are up
6. **Check logs**: Run `docker logs pantheon-backend` for error messages

**Q: "No API key configured" error**

A: This means you haven't added an API key yet:
1. Go to Settings (⚙️ icon in top-right)
2. Click **AI Providers** in the sidebar
3. Click **Add API Key** next to your chosen provider
4. Paste your API key and click **Save**
5. Click **Fetch Models** to load available models
6. Select a model from the dropdown

**Q: "Invalid API key" error**

A: Your API key is not being accepted:
1. Verify you copied the entire key (no spaces or line breaks)
2. Check the key is active in your provider's dashboard
3. Make sure you're using the correct provider (OpenAI keys won't work for Anthropic)
4. Try generating a new key from the provider
5. Delete the old key in Pantheon and add the new one

**Q: "No models available" error**

A: You need to fetch models after adding an API key:
1. Go to Settings → AI Providers
2. Find the provider you added a key for
3. Click the **Fetch Models** button
4. Wait for the models to load (5-10 seconds)
5. If it fails, check your internet connection and try again

**Q: "Rate limit exceeded" error**

A: You've hit the provider's rate limit:
1. Wait a few minutes before trying again
2. Check your rate limits in the provider's dashboard
3. Consider upgrading your plan with the provider
4. Switch to a different provider temporarily

**Q: "Insufficient credits" or "Quota exceeded" error**

A: You need to add billing/credits to your provider account:
1. Go to your provider's billing page
2. Add a payment method
3. Add credits (for OpenRouter) or enable billing (for OpenAI/Anthropic)
4. Wait a few minutes for the changes to take effect
5. Try again in Pantheon

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

- 🐛 **GitHub Issues**: [Report bugs](https://github.com/akilhassane/pantheon/issues)

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
