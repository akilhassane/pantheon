# Client Agent Packaging Guide

## Overview

Package the Pantheon client agent as a Windows installer so users can easily install and run it on their machines.

## Option 1: Electron App (Recommended)

Create a system tray app with Electron:

### Setup

```bash
cd client-agent
npm install electron electron-builder --save-dev
```

### Create Electron Wrapper

**File: `client-agent/electron-main.js`**

```javascript
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let tray = null;
let agentProcess = null;

app.whenReady().then(() => {
  // Create system tray icon
  tray = new Tray(path.join(__dirname, 'icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Pantheon Agent', enabled: false },
    { type: 'separator' },
    { label: 'Status: Running', enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: openDashboard },
    { label: 'View Logs', click: viewLogs },
    { type: 'separator' },
    { label: 'Quit', click: quitApp }
  ]);
  
  tray.setToolTip('Pantheon Agent');
  tray.setContextMenu(contextMenu);
  
  // Start agent process
  startAgent();
});

function startAgent() {
  agentProcess = spawn('node', ['agent.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  agentProcess.on('exit', (code) => {
    console.log(`Agent exited with code ${code}`);
    // Restart on crash
    setTimeout(startAgent, 5000);
  });
}

function openDashboard() {
  require('electron').shell.openExternal('https://frontend-beryl-beta-62.vercel.app');
}

function viewLogs() {
  // Open logs window
  const logWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });
  logWindow.loadFile('logs.html');
}

function quitApp() {
  if (agentProcess) {
    agentProcess.kill();
  }
  app.quit();
}

app.on('window-all-closed', () => {
  // Keep running in background
});
```

### Package Configuration

**File: `client-agent/package.json`**

```json
{
  "name": "pantheon-agent",
  "version": "1.0.0",
  "description": "Pantheon Client Agent for Windows Containers",
  "main": "electron-main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --windows",
    "build:msi": "electron-builder --windows --x64 --ia32"
  },
  "build": {
    "appId": "com.pantheon.agent",
    "productName": "Pantheon Agent",
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "msi",
          "arch": ["x64"]
        }
      ],
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Pantheon Agent"
    }
  },
  "dependencies": {
    "ws": "^8.18.3",
    "dockerode": "^4.0.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  }
}
```

### Build Installer

```bash
cd client-agent
npm run build
```

Output: `dist/Pantheon Agent Setup 1.0.0.exe`

## Option 2: Node.js Service (Simpler)

Run as Windows service using node-windows:

### Setup

```bash
cd client-agent
npm install node-windows --save
```

### Create Service Installer

**File: `client-agent/install-service.js`**

```javascript
const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Pantheon Agent',
  description: 'Pantheon Client Agent for Windows Containers',
  script: path.join(__dirname, 'agent.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
});

// Listen for the "install" event
svc.on('install', () => {
  console.log('✅ Pantheon Agent installed as Windows service');
  svc.start();
});

// Install the service
svc.install();
```

### Install as Service

```bash
node install-service.js
```

### Uninstall Service

**File: `client-agent/uninstall-service.js`**

```javascript
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Pantheon Agent',
  script: path.join(__dirname, 'agent.js')
});

svc.on('uninstall', () => {
  console.log('✅ Pantheon Agent uninstalled');
});

svc.uninstall();
```

## Option 3: Simple Batch Script (Quick Start)

For testing and development:

**File: `client-agent/start-agent.bat`**

```batch
@echo off
echo ========================================
echo Pantheon Client Agent
echo ========================================
echo.
echo Starting agent...
echo Backend: %BACKEND_URL%
echo.

node agent.js

pause
```

**File: `client-agent/install.bat`**

```batch
@echo off
echo ========================================
echo Pantheon Client Agent - Installation
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed!
    echo Please install Docker Desktop from https://docker.com
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the agent, run: start-agent.bat
echo.
pause
```

## Recommended Approach

**For MVP/Testing:** Use Option 3 (Batch Script)
- Quick to implement
- Easy to debug
- Good for early users

**For Production:** Use Option 1 (Electron App)
- Professional appearance
- System tray integration
- Auto-start on boot
- Better user experience

## Distribution

### 1. GitHub Releases

```bash
# Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Upload installer to GitHub Releases
# Users download: Pantheon-Agent-Setup-1.0.0.exe
```

### 2. Direct Download from Frontend

Add download link in frontend:

```typescript
// frontend/app/download/page.tsx
export default function DownloadPage() {
  return (
    <div>
      <h1>Download Pantheon Agent</h1>
      <a href="https://github.com/your-repo/releases/latest/download/Pantheon-Agent-Setup.exe">
        Download for Windows (64-bit)
      </a>
    </div>
  );
}
```

### 3. Auto-Update

Use electron-updater for automatic updates:

```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

## User Installation Flow

1. **Download Installer**
   - User visits https://frontend-beryl-beta-62.vercel.app/download
   - Downloads `Pantheon-Agent-Setup.exe`

2. **Install**
   - Run installer
   - Choose installation directory
   - Installer checks for Docker Desktop
   - Creates desktop shortcut

3. **Configure**
   - First run opens configuration wizard
   - User enters Supabase credentials
   - Agent connects to backend server

4. **Run**
   - Agent runs in system tray
   - Auto-starts on Windows boot
   - Shows status notifications

## Next Steps

1. Choose packaging approach (recommend Electron for production)
2. Create installer
3. Test on clean Windows machine
4. Add download page to frontend
5. Document installation process for users

---

**Current Status:** Agent code ready, needs packaging
**Recommended:** Start with batch script, upgrade to Electron later
