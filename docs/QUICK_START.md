# Pantheon AI Platform - Quick Start Guide

Get up and running with Pantheon in 10 minutes!

---

## Prerequisites

- Docker Desktop installed and running
- Internet connection
- Web browser

---

## Step 1: Install Pantheon (2 minutes)

### Linux/macOS
```bash
curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh | bash
```

### Windows (PowerShell - Run as Administrator)
```powershell
irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1 | iex
```

The script will:
- Check prerequisites
- Download configuration
- Pull Docker images (~1.4GB)
- Start all services
- Display access URLs

**Wait for the installation to complete** (~5-10 minutes depending on internet speed)

---

## Step 2: Configure Keycloak Authentication (5 minutes)

Pantheon uses Keycloak for secure authentication. You need to set up an identity provider (Google or Microsoft).

### 2.1 Access Keycloak Admin Console

1. Open your browser and go to: **http://localhost:8080**
2. Click on **"Administration Console"**
3. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin`

### 2.2 Configure Google Identity Provider

#### Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted
6. Select **Application type**: Web application
7. Add **Authorized redirect URIs**:
   ```
   http://localhost:8080/realms/master/broker/google/endpoint
   ```
8. Click **Create**
9. Copy the **Client ID** and **Client Secret**

#### Configure in Keycloak

1. In Keycloak Admin Console, click **Identity Providers** in the left menu
2. Click **Add provider** → Select **Google**
3. Fill in the form:
   - **Client ID**: Paste your Google Client ID
   - **Client Secret**: Paste your Google Client Secret
   - **Enabled**: ON
4. Click **Save**

### 2.3 Configure Microsoft Identity Provider (Alternative)

#### Get Microsoft OAuth Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: Pantheon AI Platform
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Web → `http://localhost:8080/realms/master/broker/microsoft/endpoint`
5. Click **Register**
6. Copy the **Application (client) ID**
7. Go to **Certificates & secrets** → **New client secret**
8. Add a description and expiration, click **Add**
9. Copy the **Client Secret Value** (you won't see it again!)

#### Configure in Keycloak

1. In Keycloak Admin Console, click **Identity Providers** in the left menu
2. Click **Add provider** → Select **Microsoft**
3. Fill in the form:
   - **Client ID**: Paste your Microsoft Application ID
   - **Client Secret**: Paste your Microsoft Client Secret
   - **Enabled**: ON
4. Click **Save**

---

## Step 3: Access Pantheon (1 minute)

1. Open your browser and go to: **http://localhost:3000**
2. Click **Sign In**
3. Choose your identity provider (Google or Microsoft)
4. Authorize the application
5. You'll be redirected back to Pantheon

**Congratulations!** You're now logged into Pantheon! 🎉

---

## Step 4: Create Your First Project (2 minutes)

1. Click **Create New Project** on the dashboard
2. Fill in the project details:
   - **Project Name**: My First Project
   - **Description**: Testing Pantheon AI Platform
   - **Operating System**: Windows 11 (or your preference)
3. Click **Create Project**
4. Wait for the project to initialize (~30 seconds)

---

## Step 5: Start Using AI (1 minute)

1. Select your project from the dashboard
2. Choose an AI model from the dropdown (e.g., GPT-4, Claude, Gemini)
3. Type a message in the chat:
   ```
   Hello! Can you help me automate tasks on Windows?
   ```
4. Press Enter and watch the AI respond!

---

## What's Next?

### Add Your AI Provider API Keys

To use AI features, you need to add your API keys:

1. Stop the containers:
   ```bash
   docker compose -f docker-compose.production.yml stop
   ```

2. Edit the `.env` file in the installation directory:
   ```bash
   # Add your API keys
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   OPENROUTER_API_KEY=sk-or-v1-...
   GEMINI_API_KEY=...
   ```

3. Restart the containers:
   ```bash
   docker compose -f docker-compose.production.yml start
   ```

### Explore Features

- **Windows Automation**: Let AI control Windows applications
- **Real-time Collaboration**: Invite team members to your projects
- **Multiple AI Models**: Switch between different AI providers
- **Project Management**: Organize your work into isolated projects

### Learn More

- [User Guide](./USER_GUIDE.md) - Complete feature documentation
- [API Reference](./API_REFERENCE.md) - Integrate Pantheon with your apps
- [Architecture](./ARCHITECTURE.md) - Understand how Pantheon works
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

---

## Common Issues

### Keycloak Not Starting

If Keycloak keeps restarting:
1. Wait 2-3 minutes for initial database setup
2. Check logs: `docker logs pantheon-keycloak`
3. Restart if needed: `docker compose -f docker-compose.production.yml restart keycloak`

### Can't Access Frontend

If http://localhost:3000 doesn't work:
1. Check if containers are running: `docker compose -f docker-compose.production.yml ps`
2. Check frontend logs: `docker logs pantheon-frontend`
3. Restart frontend: `docker compose -f docker-compose.production.yml restart frontend`

### Authentication Fails

If you can't sign in:
1. Verify Keycloak is running: http://localhost:8080
2. Check identity provider configuration in Keycloak
3. Verify redirect URIs match exactly
4. Clear browser cookies and try again

---

## Need Help?

- **Documentation**: https://github.com/akilhassane/pantheon
- **Issues**: https://github.com/akilhassane/pantheon/issues
- **Discussions**: https://github.com/akilhassane/pantheon/discussions

---

## Security Notes

- **Change default Keycloak password** in production
- **Use HTTPS** in production environments
- **Keep API keys secure** - never commit them to version control
- **Review Keycloak security settings** before deploying to production

---

**Total Time**: ~10 minutes  
**Difficulty**: Easy  
**Prerequisites**: Docker Desktop

Enjoy using Pantheon AI Platform! 🚀
