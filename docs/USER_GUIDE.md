# Pantheon AI Platform - User Guide

Complete guide to using Pantheon AI Platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Projects](#projects)
4. [AI Models](#ai-models)
5. [Windows Automation](#windows-automation)
6. [Collaboration](#collaboration)
7. [Settings](#settings)
8. [Best Practices](#best-practices)

---

## Getting Started

### First Time Setup

1. **Install Pantheon** - Follow the [Quick Start Guide](./QUICK_START.md)
2. **Configure Keycloak** - Set up Google or Microsoft authentication
3. **Add API Keys** - Configure your AI provider API keys
4. **Create Project** - Start your first project

### Dashboard Overview

The dashboard shows:
- **Your Projects**: All projects you own or collaborate on
- **Recent Activity**: Latest actions and updates
- **Quick Actions**: Create project, invite collaborators
- **System Status**: Service health indicators

---

## Authentication

### Supported Identity Providers

- **Google**: OAuth 2.0 authentication
- **Microsoft**: Azure AD authentication
- **Email/Password**: Coming soon

### Sign In Process

1. Click **Sign In** on the homepage
2. Choose your identity provider
3. Authorize Pantheon to access your profile
4. You'll be redirected back to the dashboard

### Sign Out

Click your profile picture → **Sign Out**

---

## Projects

### Creating a Project

1. Click **Create New Project**
2. Fill in details:
   - **Name**: Project identifier
   - **Description**: What this project is for
   - **Operating System**: Windows 11, Linux, macOS
3. Click **Create**
4. Wait for initialization (~30 seconds)

### Project Types

- **Windows Projects**: Full Windows 11 environment with GUI
- **Linux Projects**: Ubuntu/Debian containers (coming soon)
- **macOS Projects**: macOS virtualization (coming soon)

### Managing Projects

- **Open**: Click on a project to open it
- **Share**: Invite collaborators
- **Settings**: Configure project options
- **Delete**: Remove project and all data

---

## AI Models

### Supported Providers

- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3 Opus, Sonnet, Haiku
- **Google**: Gemini Pro, Gemini Ultra
- **OpenRouter**: Access to 100+ models
- **Mistral**: Mistral Large, Medium, Small
- **Cohere**: Command, Command Light

### Selecting a Model

1. Open a project
2. Click the model dropdown at the top
3. Choose your preferred model
4. Start chatting!

### Model Comparison

| Provider | Best For | Speed | Cost |
|----------|----------|-------|------|
| GPT-4 | Complex reasoning | Medium | High |
| Claude 3 | Long context, coding | Fast | Medium |
| Gemini Pro | Multimodal tasks | Fast | Low |
| OpenRouter | Variety, cost-effective | Varies | Varies |

---

## Windows Automation

### How It Works

Pantheon AI can:
- **See your screen**: Takes screenshots to understand context
- **Control mouse**: Click, drag, scroll
- **Type text**: Enter data into applications
- **Press keys**: Keyboard shortcuts and commands
- **Open applications**: Launch programs
- **Navigate UI**: Find and interact with elements

### Example Tasks

**Open a browser and search:**
```
Open Google Chrome and search for "Python tutorials"
```

**Automate data entry:**
```
Open Excel and create a spreadsheet with sales data for Q1 2024
```

**System administration:**
```
Check disk space and clean up temporary files
```

### Best Practices

- **Be specific**: Clear instructions get better results
- **Break down complex tasks**: Step-by-step is more reliable
- **Verify results**: Always check AI actions
- **Use screenshots**: AI can see what you see

---

## Collaboration

### Inviting Collaborators

1. Open your project
2. Click **Share** button
3. Enter collaborator's email
4. Choose permission level:
   - **Viewer**: Read-only access
   - **Editor**: Can make changes
   - **Admin**: Full control
5. Click **Send Invitation**

### Real-time Collaboration

- **Live updates**: See changes as they happen
- **Shared sessions**: Multiple users can work together
- **Chat history**: All conversations are saved
- **Activity log**: Track who did what

### Managing Collaborators

- **View list**: See all project collaborators
- **Change permissions**: Update access levels
- **Remove access**: Revoke collaboration
- **Transfer ownership**: Make someone else the owner

---

## Settings

### User Settings

- **Profile**: Update name, avatar
- **Preferences**: Theme, language, notifications
- **API Keys**: Manage AI provider keys
- **Security**: Password, 2FA (coming soon)

### Project Settings

- **General**: Name, description, visibility
- **Resources**: CPU, RAM allocation
- **Network**: Port forwarding, firewall
- **Backup**: Automatic snapshots

### System Settings

- **Models**: Default AI model
- **Modes**: Custom automation modes
- **Integrations**: Connect external services
- **Advanced**: Debug mode, logging

---

## Best Practices

### Security

- **Use strong passwords** for Keycloak
- **Enable 2FA** when available
- **Review permissions** regularly
- **Keep API keys secure**
- **Use HTTPS** in production

### Performance

- **Close unused projects** to free resources
- **Limit concurrent AI requests**
- **Use appropriate model** for the task
- **Monitor resource usage**

### Cost Optimization

- **Choose cost-effective models** for simple tasks
- **Use OpenRouter** for variety and savings
- **Set usage limits** on API keys
- **Monitor spending** in provider dashboards

### Collaboration

- **Communicate clearly** with team members
- **Document workflows** for repeatability
- **Use descriptive project names**
- **Regular backups** of important data

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New project |
| `Ctrl+K` | Focus chat input |
| `Ctrl+Enter` | Send message |
| `Ctrl+/` | Show shortcuts |
| `Esc` | Close modal |

---

## Tips & Tricks

### Getting Better Results

1. **Be specific**: "Open Chrome and go to github.com" vs "Open browser"
2. **Provide context**: "I need to create a report" vs "Create report"
3. **Use examples**: "Format like this: Name | Email | Phone"
4. **Iterate**: Refine instructions based on results

### Advanced Features

- **Custom modes**: Create specialized AI behaviors
- **Batch operations**: Automate repetitive tasks
- **Scheduled tasks**: Run automation on schedule
- **API integration**: Connect to external services

---

## Troubleshooting

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues and solutions.

---

## Support

- **Documentation**: https://github.com/akilhassane/pantheon
- **Issues**: https://github.com/akilhassane/pantheon/issues
- **Discussions**: https://github.com/akilhassane/pantheon/discussions
- **Email**: support@pantheon.ai (coming soon)

---

**Last Updated**: February 20, 2026  
**Version**: 1.0.0
