# User Guide

Learn how to use Pantheon AI Platform effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Projects](#creating-projects)
- [Working with AI](#working-with-ai)
- [Collaboration](#collaboration)
- [Managing Settings](#managing-settings)

## Getting Started

### First Login

1. Open `http://localhost:3000` in your browser
2. The system will automatically create a session
3. You'll see the main dashboard

### Dashboard Overview

The dashboard consists of:
- **Sidebar**: Project list and navigation
- **Chat Area**: Interact with AI
- **Settings**: Configure AI models and preferences
- **Usage Tracker**: Monitor API usage and costs

## Creating Projects

### New Project

1. Click the **"New Project"** button in the sidebar
2. Enter a project name
3. Select the OS type (currently Windows only)
4. Click **"Create"**

### Project Structure

Each project includes:
- Isolated Windows environment
- Dedicated storage
- Separate chat history
- Independent settings

### Switching Projects

- Click on any project in the sidebar to switch
- Your current project is highlighted
- Each project maintains its own state

## Working with AI

### Selecting an AI Model

1. Click the **Settings** icon
2. Go to **"AI Models"** tab
3. Add your API keys
4. Select your preferred model

### Supported Models

- **OpenAI**: GPT-4, GPT-3.5
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)
- **Google**: Gemini Pro

### Chatting with AI

1. Type your request in the chat input
2. Press Enter or click Send
3. AI will respond and can execute actions

### Example Commands

```
"Open Notepad and write a hello world program"
"Take a screenshot of the desktop"
"Create a new folder called 'Projects'"
"Search for Python in the start menu"
```

### AI Capabilities

The AI can:
- Control mouse and keyboard
- Open applications
- Read screen content (OCR)
- Execute commands
- Manage files and folders
- Take screenshots

## Collaboration

### Real-time Collaboration

Multiple users can work on the same project simultaneously.

### Sharing Projects

1. Open project settings
2. Click **"Share"**
3. Copy the project ID
4. Share with team members

### Collaborative Features

- See other users' cursors
- Real-time chat updates
- Shared command history
- Synchronized state

## Managing Settings

### AI Model Settings

Configure which AI models to use:
1. Go to Settings → AI Models
2. Add API keys for providers
3. Select default model
4. Set model-specific parameters

### System Preferences

- **Theme**: Light/Dark mode
- **Notifications**: Enable/disable alerts
- **Auto-save**: Automatic session saving
- **Language**: Interface language

### Usage Tracking

Monitor your API usage:
- View costs per model
- Track token usage
- Set spending limits
- Export usage reports

## Best Practices

### Effective Prompts

✅ **Good**: "Open Chrome and navigate to github.com"
❌ **Bad**: "Do something with the browser"

✅ **Good**: "Create a Python script that prints hello world"
❌ **Bad**: "Make a program"

### Security

- Never share API keys in chat
- Review AI actions before confirming
- Use separate projects for different tasks
- Regularly backup important data

### Performance

- Close unused projects
- Clear chat history periodically
- Monitor resource usage
- Use appropriate AI models for tasks

## Keyboard Shortcuts

- `Ctrl/Cmd + N`: New project
- `Ctrl/Cmd + K`: Focus chat input
- `Ctrl/Cmd + ,`: Open settings
- `Esc`: Close modals

## Troubleshooting

### AI Not Responding

1. Check API key is valid
2. Verify internet connection
3. Check usage limits
4. Try a different model

### Project Won't Load

1. Refresh the page
2. Check Docker containers are running
3. View logs for errors
4. Restart the project

### Performance Issues

1. Close unused projects
2. Clear browser cache
3. Restart Docker containers
4. Check system resources

## Next Steps

- Explore [API Reference](./API_REFERENCE.md) for integration
- Read [Architecture](./ARCHITECTURE.md) to understand the system
- Check [Troubleshooting](./TROUBLESHOOTING.md) for common issues

---

[← Back to README](../README.md)
