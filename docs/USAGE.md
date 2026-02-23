# Usage Guide

Complete guide for using Pantheon.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Projects](#creating-projects)
- [Managing Windows VMs](#managing-windows-vms)
- [Using AI Models](#using-ai-models)
- [Collaboration](#collaboration)
- [Project Management](#project-management)

## Getting Started

### First Login

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. Click "Sign in with Google" or "Sign in with Microsoft"
3. Complete OAuth authentication
4. You'll be redirected to the dashboard

### Dashboard Overview

The dashboard displays:
- Active projects
- Recent activity
- Model usage statistics
- Quick actions

## Creating Projects

### Step 1: Create New Project

1. Click "New Project" button
2. Enter project details:
   - Project name
   - Description (optional)
   - Operating system: Windows 11
3. Click "Create Project"

### Step 2: Wait for Provisioning

The system will:
1. Create isolated network (172.30.x.0/24)
2. Provision Windows 11 VM
3. Set up shared folder
4. Configure tools API access

Provisioning takes 2-3 minutes.

### Step 3: Access Project

Once ready:
1. Click on project card
2. View project details
3. Access Windows VM
4. Start using AI agents

## Managing Windows VMs

### Accessing Windows VM

1. Open project
2. Click "Connect to VM"
3. RDP connection opens automatically
4. Default credentials displayed in UI

### VM Features

- Full Windows 11 Pro environment
- Pre-installed development tools
- Shared folder for file transfer
- Network isolation from other projects
- Automatic snapshots

### Shared Folder

Access shared files:
- Windows VM: `\\172.30.x.1:8888\shared`
- Host: Project shared folder volume
- Automatic synchronization

### VM Management

Available actions:
- Start/Stop VM
- Restart VM
- Take snapshot
- Restore snapshot
- Delete VM

## Using AI Models

### Selecting Model

1. Navigate to Settings → Models
2. Browse available models
3. Click "Select" on preferred model
4. Configure parameters (optional)
5. Click "Save"

For detailed model configuration, see [Model Configuration Guide](MODEL_CONFIGURATION.md).

### Chat Interface

1. Open project
2. Click "AI Chat"
3. Type message
4. AI responds using selected model

### AI Features

- Multi-turn conversations
- Code generation
- File analysis
- Windows automation
- Screen capture analysis

### Model Parameters

Adjust in Settings:
- Temperature: Creativity level
- Max tokens: Response length
- Top P: Diversity
- Frequency penalty: Repetition control

## Collaboration

### Inviting Collaborators

1. Open project
2. Click "Share"
3. Enter collaborator email
4. Select permissions:
   - View only
   - Edit
   - Admin
5. Click "Invite"

### Real-time Collaboration

Features:
- Shared AI chat
- Synchronized VM access
- Live cursor tracking
- Activity notifications

### Managing Access

1. Open project settings
2. Navigate to "Collaborators"
3. View active collaborators
4. Modify permissions
5. Remove access

## Project Management

### Project Settings

Configure:
- Project name and description
- Default AI model
- VM configuration
- Network settings
- Backup schedule

### Monitoring

View metrics:
- VM uptime
- Resource usage
- AI token consumption
- Collaboration activity

### Backup and Restore

Automatic backups:
- Daily VM snapshots
- Shared folder backups
- Configuration backups

Manual backup:
1. Open project
2. Click "Backup"
3. Wait for completion
4. Download backup (optional)

Restore:
1. Open project
2. Click "Restore"
3. Select backup point
4. Confirm restoration

### Deleting Projects

1. Open project settings
2. Click "Delete Project"
3. Confirm deletion
4. All resources removed:
   - Windows VM
   - Shared folder
   - Network
   - Backups

## Best Practices

### Resource Management

- Stop VMs when not in use
- Clean up old projects
- Monitor token usage
- Use appropriate models for tasks

### Security

- Use strong passwords
- Enable 2FA on OAuth providers
- Review collaborator access regularly
- Don't share API keys

### Performance

- Use GPT-3.5 for simple tasks
- Close unused projects
- Clear chat history periodically
- Optimize VM resources

## Troubleshooting

### Cannot Connect to VM

**Solution:**
1. Check VM status (should be "Running")
2. Verify network connectivity
3. Restart VM if needed
4. Check firewall settings

### AI Not Responding

**Solution:**
1. Check API key validity
2. Verify model selection
3. Check usage limits
4. Try different model

### Shared Folder Not Accessible

**Solution:**
1. Verify VM is running
2. Check network configuration
3. Restart shared folder service
4. Check file permissions

For more troubleshooting, see [Troubleshooting Guide](TROUBLESHOOTING.md).

## Next Steps

- [Configure AI Models](MODEL_CONFIGURATION.md)
- [API Documentation](API.md)
- [Network Architecture](NETWORK.md)

## Support

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)
- [Documentation](https://github.com/akilhassane/pantheon/wiki)

[Back to README](../README.md)
