# Pantheon - Required Media Assets

This document lists all images and videos needed for the Pantheon documentation.

---

## 📁 Directory Structure

Create an `assets/` folder in the root directory with the following structure:

```
pantheon/
├── assets/
│   ├── logo/
│   │   └── pantheon-logo.png
│   ├── screenshots/
│   │   ├── login-screen.png
│   │   ├── main-interface.png
│   │   ├── settings-icon.png
│   │   ├── ai-providers-settings.png
│   │   ├── fetch-models.png
│   │   ├── select-model.png
│   │   ├── create-project.png
│   │   ├── supabase-config.png
│   │   ├── service-status.png
│   │   ├── account-creation.png
│   │   ├── ai-settings.png
│   │   └── video-thumbnail.png
│   ├── gifs/
│   │   ├── demo.gif
│   │   ├── install-demo-linux.gif
│   │   └── install-demo-windows.gif
│   └── videos/
│       ├── installation-tutorial.mp4
│       └── demo-video.mp4
```

---

## 🎨 Logo & Branding

### 1. Pantheon Logo (`assets/logo/pantheon-logo.png`)

**Purpose**: Main logo for README and documentation headers

**Specifications**:
- Format: PNG with transparent background
- Dimensions: 800x200px (4:1 ratio)
- Resolution: 300 DPI
- File size: < 100KB
- Style: Modern, tech-focused, professional

**Design Guidelines**:
- Should represent "multi-agentic AI" and "OS interaction"
- Color scheme: Blue/purple gradient (tech colors)
- Include text "Pantheon" or just icon
- Should work on both light and dark backgrounds

**Used in**:
- `README.md` (top of page)
- `README_NEW.md` (top of page)
- `docs/INSTALLATION_GUIDE.md` (header)

---

## 📸 Screenshots

### 2. Login Screen (`assets/screenshots/login-screen.png`)

**Purpose**: Show the initial login/signup page

**What to capture**:
- Full browser window showing http://localhost:3000
- Login form with email and password fields
- "Sign Up" and "Sign In" buttons
- Clean, professional UI
- No personal information visible

**Specifications**:
- Format: PNG
- Dimensions: 1920x1080px (16:9)
- Resolution: 72 DPI
- File size: < 500KB
- Browser: Chrome or Firefox (clean UI)

**Used in**:
- `docs/USER_GUIDE.md` (Getting Started section)
- `docs/INSTALLATION_GUIDE.md` (Verification section)

---

### 3. Main Interface (`assets/screenshots/main-interface.png`)

**Purpose**: Show the complete Pantheon interface with all components

**What to capture**:
- Full browser window
- Sidebar (left) with projects list
- Chat area (center) with sample conversation
- Terminal (bottom) with some output
- Windows desktop view (right) showing Windows UI
- All UI elements clearly visible

**Specifications**:
- Format: PNG
- Dimensions: 1920x1080px (16:9)
- Resolution: 72 DPI
- File size: < 800KB
- Show a real working example (not empty)

**Annotations needed**:
- Label: "Sidebar" pointing to left panel
- Label: "Chat Area" pointing to center
- Label: "Terminal" pointing to bottom
- Label: "Windows Desktop" pointing to right

**Used in**:
- `docs/USER_GUIDE.md` (Dashboard Overview)
- `docs/INSTALLATION_GUIDE.md` (Quick Start section)
- `README.md` (Demo section)

---

### 4. Settings Icon (`assets/screenshots/settings-icon.png`)

**Purpose**: Show where to find the Settings button

**What to capture**:
- Close-up of top-right corner of interface
- Settings gear icon (⚙️) clearly visible
- Profile picture/avatar visible
- Clean crop, no unnecessary UI

**Specifications**:
- Format: PNG
- Dimensions: 400x300px
- Resolution: 72 DPI
- File size: < 100KB
- Highlight the settings icon with a red circle or arrow

**Used in**:
- `docs/USER_GUIDE.md` (Initial Setup section)

---

### 5. AI Providers Settings (`assets/screenshots/ai-providers-settings.png`)

**Purpose**: Show the AI Providers configuration page

**What to capture**:
- Settings modal/page open
- "AI Providers" section selected in sidebar
- List of providers: OpenAI, Anthropic, Google, OpenRouter
- "Add API Key" buttons visible
- Input fields for API keys (empty or with placeholder text)
- "Fetch Models" buttons visible
- Clean, organized layout

**Specifications**:
- Format: PNG
- Dimensions: 1600x1000px
- Resolution: 72 DPI
- File size: < 600KB
- Blur any actual API keys if present

**Annotations needed**:
- Arrow pointing to "Add API Key" button
- Arrow pointing to "Fetch Models" button
- Label: "Provider list"

**Used in**:
- `docs/USER_GUIDE.md` (Initial Setup section)

---

### 6. Fetch Models Button (`assets/screenshots/fetch-models.png`)

**Purpose**: Show the Fetch Models button and model list

**What to capture**:
- AI Providers settings page
- One provider expanded (e.g., OpenAI)
- "Fetch Models" button clearly visible
- Dropdown showing available models (gpt-4o, gpt-4-turbo, etc.)
- Model selection interface

**Specifications**:
- Format: PNG
- Dimensions: 1200x800px
- Resolution: 72 DPI
- File size: < 400KB
- Highlight the "Fetch Models" button

**Used in**:
- `docs/USER_GUIDE.md` (Initial Setup section)

---

### 7. Select Model (`assets/screenshots/select-model.png`)

**Purpose**: Show how to select a default model

**What to capture**:
- Model dropdown menu open
- List of available models visible
- One model highlighted/selected
- "Set as Default" button visible
- Model descriptions if available

**Specifications**:
- Format: PNG
- Dimensions: 1000x700px
- Resolution: 72 DPI
- File size: < 300KB
- Show a realistic model list

**Used in**:
- `docs/USER_GUIDE.md` (Initial Setup section)

---

### 8. Create Project Button (`assets/screenshots/create-project.png`)

**Purpose**: Show the "New Project" button in sidebar

**What to capture**:
- Left sidebar with projects list
- "+ New Project" button clearly visible
- Existing projects (if any) in the list
- Clean, focused crop

**Specifications**:
- Format: PNG
- Dimensions: 400x600px
- Resolution: 72 DPI
- File size: < 200KB
- Highlight the "+ New Project" button with arrow or circle

**Used in**:
- `docs/USER_GUIDE.md` (Creating Your First Project)
- `docs/INSTALLATION_GUIDE.md` (Quick Start section)

---

### 9. Supabase Configuration (`assets/screenshots/supabase-config.png`)

**Purpose**: Show where to find Supabase credentials

**What to capture**:
- Supabase dashboard (https://supabase.com/dashboard)
- Project Settings page open
- API section showing:
  - Project URL
  - anon/public key
  - service_role key (partially blurred)
- Clear labels for each credential

**Specifications**:
- Format: PNG
- Dimensions: 1600x1000px
- Resolution: 72 DPI
- File size: < 500KB
- Blur actual credentials (show format only)

**Annotations needed**:
- Red box around "Project URL"
- Red box around "anon public key"
- Red box around "service_role key"
- Labels explaining what each is

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Configuration section)

---

### 10. Service Status (`assets/screenshots/service-status.png`)

**Purpose**: Show healthy Docker containers running

**What to capture**:
- Terminal window showing `docker ps` output
- All Pantheon containers visible:
  - pantheon-frontend (healthy)
  - pantheon-backend (healthy)
  - pantheon-windows-tools (healthy)
- Status showing "Up" and "healthy"
- Ports clearly visible

**Specifications**:
- Format: PNG
- Dimensions: 1400x600px
- Resolution: 72 DPI
- File size: < 300KB
- Use a clean terminal theme (dark or light)

**Annotations needed**:
- Highlight "healthy" status in green
- Label: "All services running"

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Verification section)

---

### 11. Account Creation (`assets/screenshots/account-creation.png`)

**Purpose**: Show the signup form

**What to capture**:
- Sign up page/modal
- Email input field
- Password input field
- Confirm password field
- "Create Account" button
- Link to "Already have an account? Sign in"

**Specifications**:
- Format: PNG
- Dimensions: 1200x800px
- Resolution: 72 DPI
- File size: < 300KB
- Use placeholder email (user@example.com)

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Quick Start section)

---

### 12. AI Settings (`assets/screenshots/ai-settings.png`)

**Purpose**: Show project-level AI configuration

**What to capture**:
- Project settings modal/page
- AI Configuration section
- Model selection dropdown
- Temperature slider
- Max tokens input
- Top P parameter
- Provider selection

**Specifications**:
- Format: PNG
- Dimensions: 1400x900px
- Resolution: 72 DPI
- File size: < 400KB
- Show realistic settings values

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Quick Start section)

---

### 13. Video Thumbnail (`assets/screenshots/video-thumbnail.png`)

**Purpose**: Thumbnail for video tutorials

**What to capture**:
- Eye-catching image from Pantheon interface
- Large text overlay: "Pantheon Installation Tutorial"
- Play button icon in center
- Professional, YouTube-style thumbnail

**Specifications**:
- Format: PNG
- Dimensions: 1280x720px (16:9, YouTube standard)
- Resolution: 72 DPI
- File size: < 200KB
- High contrast, readable text
- Include Pantheon logo

**Design elements**:
- Bold title text
- Subtitle: "Complete Setup Guide"
- Duration indicator (e.g., "10:30")
- Play button overlay
- Pantheon branding

**Used in**:
- `README.md` (Demo section)
- `README_NEW.md` (Demo section)
- `docs/INSTALLATION_GUIDE.md` (Video Tutorial section)

---

## 🎬 GIFs (Animated)

### 14. Demo GIF (`assets/gifs/demo.gif`)

**Purpose**: Show Pantheon in action - AI controlling Windows

**What to record**:
1. User types message: "Open Notepad and type Hello World"
2. AI responds with explanation
3. Windows desktop shows Notepad opening
4. Text "Hello World" appears in Notepad
5. AI confirms task completion
6. Total duration: 10-15 seconds

**Specifications**:
- Format: GIF (optimized)
- Dimensions: 1200x800px
- Frame rate: 15 fps
- Duration: 10-15 seconds
- File size: < 5MB
- Loop: Yes
- Quality: High (use tools like ScreenToGif or LICEcap)

**Recording tips**:
- Use a clean, simple example
- Show the full workflow
- Keep it short and impactful
- No personal information visible
- Use a fast, impressive task

**Used in**:
- `README.md` (Demo section)
- `README_NEW.md` (Demo section)

---

### 15. Linux/macOS Installation GIF (`assets/gifs/install-demo-linux.gif`)

**Purpose**: Show the installation process on Linux/macOS

**What to record**:
1. Terminal opens
2. User runs: `curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh`
3. User runs: `chmod +x install-pantheon.sh`
4. User runs: `bash install-pantheon.sh`
5. Installation progress shows (sped up)
6. Success message appears
7. Browser opens to http://localhost:3000
8. Total duration: 15-20 seconds (sped up 4x)

**Specifications**:
- Format: GIF (optimized)
- Dimensions: 1400x800px
- Frame rate: 10 fps
- Duration: 15-20 seconds
- File size: < 8MB
- Loop: Yes
- Speed up boring parts (downloading, building)

**Recording tips**:
- Use a clean terminal theme
- Show actual installation (not simulated)
- Speed up slow parts (2x-4x)
- End with success screen

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Installation section)

---

### 16. Windows Installation GIF (`assets/gifs/install-demo-windows.gif`)

**Purpose**: Show the installation process on Windows

**What to record**:
1. PowerShell opens (as Administrator)
2. User runs: `Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"`
3. User runs: `powershell -ExecutionPolicy Bypass -File install-pantheon.ps1`
4. Installation progress shows (sped up)
5. Success message appears
6. Browser opens to http://localhost:3000
7. Total duration: 15-20 seconds (sped up 4x)

**Specifications**:
- Format: GIF (optimized)
- Dimensions: 1400x800px
- Frame rate: 10 fps
- Duration: 15-20 seconds
- File size: < 8MB
- Loop: Yes
- Speed up boring parts (downloading, building)

**Recording tips**:
- Use PowerShell (not CMD)
- Show "Run as Administrator"
- Use a clean PowerShell theme
- Speed up slow parts (2x-4x)
- End with success screen

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Installation section)

---

## 🎥 Videos

### 17. Installation Tutorial Video (`assets/videos/installation-tutorial.mp4`)

**Purpose**: Complete step-by-step installation guide

**Content outline**:
1. **Introduction** (0:00-0:30)
   - What is Pantheon
   - What you'll learn
   - Prerequisites

2. **Prerequisites Check** (0:30-1:30)
   - Docker installation verification
   - Disk space check
   - System requirements

3. **Download Installer** (1:30-2:30)
   - Show download command
   - Explain what it does
   - Run the command

4. **Run Installation** (2:30-5:00)
   - Execute installer
   - Explain each step
   - Show progress

5. **Verify Installation** (5:00-6:30)
   - Check Docker containers
   - Access web interface
   - Test basic functionality

6. **Create Account** (6:30-7:30)
   - Sign up process
   - Email verification
   - First login

7. **Configure API Keys** (7:30-9:00)
   - Go to Settings
   - Add OpenAI/Anthropic key
   - Fetch models
   - Select default model

8. **Create First Project** (9:00-10:00)
   - Click New Project
   - Configure project
   - Wait for creation
   - Project ready

9. **Test Pantheon** (10:00-11:00)
   - Send first message
   - AI responds
   - Show Windows interaction
   - Success!

10. **Troubleshooting Tips** (11:00-12:00)
    - Common issues
    - Where to get help
    - Resources

11. **Conclusion** (12:00-12:30)
    - Recap
    - Next steps
    - Call to action

**Specifications**:
- Format: MP4 (H.264)
- Resolution: 1920x1080px (1080p)
- Frame rate: 30 fps
- Duration: 12-15 minutes
- File size: < 100MB
- Audio: Clear voiceover with background music
- Subtitles: English (SRT file)

**Production quality**:
- Professional voiceover (clear, friendly)
- Background music (subtle, non-distracting)
- Screen annotations (arrows, highlights)
- Smooth transitions
- Chapter markers
- End screen with links

**Upload to**:
- YouTube (primary)
- Vimeo (backup)
- Link in documentation

**Used in**:
- `docs/INSTALLATION_GUIDE.md` (Video Tutorial section)
- `README.md` (Demo section)

---

### 18. Demo Video (`assets/videos/demo-video.mp4`)

**Purpose**: Showcase Pantheon's capabilities

**Content outline**:
1. **Introduction** (0:00-0:30)
   - What is Pantheon
   - Key features
   - Who it's for

2. **Interface Tour** (0:30-1:30)
   - Show main interface
   - Explain components
   - Navigation

3. **Example 1: File Management** (1:30-2:30)
   - "Create a folder and organize files"
   - AI executes commands
   - Show Windows desktop

4. **Example 2: Application Control** (2:30-3:30)
   - "Open Chrome and search for something"
   - AI controls browser
   - Show results

5. **Example 3: Automation** (3:30-4:30)
   - "Create a PowerShell script"
   - AI writes and executes script
   - Show output

6. **Example 4: Multi-step Task** (4:30-5:30)
   - Complex task with multiple steps
   - AI breaks it down
   - Executes sequentially

7. **Collaboration Feature** (5:30-6:30)
   - Show multiple users
   - Real-time updates
   - Shared workspace

8. **AI Model Switching** (6:30-7:00)
   - Show different AI providers
   - Compare responses
   - Model selection

9. **Conclusion** (7:00-7:30)
   - Recap features
   - Call to action
   - Links

**Specifications**:
- Format: MP4 (H.264)
- Resolution: 1920x1080px (1080p)
- Frame rate: 30 fps
- Duration: 7-8 minutes
- File size: < 80MB
- Audio: Voiceover + background music
- Subtitles: English (SRT file)

**Production quality**:
- Professional editing
- Smooth transitions
- Text overlays
- Feature highlights
- Engaging pace
- Call to action

**Upload to**:
- YouTube (primary)
- Vimeo (backup)
- Link in documentation

**Used in**:
- `README.md` (Demo section)
- `README_NEW.md` (Demo section)

---

## 📋 Image Creation Checklist

### Before Taking Screenshots:

- [ ] Clean browser (no extensions, bookmarks bar hidden)
- [ ] Use incognito/private mode
- [ ] Set browser zoom to 100%
- [ ] Use consistent browser (Chrome recommended)
- [ ] Clear any personal information
- [ ] Use placeholder data (user@example.com, etc.)
- [ ] Ensure good lighting (for screen recording)
- [ ] Close unnecessary applications
- [ ] Disable notifications
- [ ] Use a clean desktop background

### Screenshot Quality:

- [ ] High resolution (at least 1920x1080)
- [ ] Clear, readable text
- [ ] No compression artifacts
- [ ] Proper cropping (no unnecessary whitespace)
- [ ] Consistent styling across all screenshots
- [ ] Annotations are clear and professional
- [ ] File size optimized (use TinyPNG or similar)

### GIF Quality:

- [ ] Smooth animation (15+ fps)
- [ ] Optimized file size (< 5-8MB)
- [ ] Loops seamlessly
- [ ] Shows complete workflow
- [ ] No lag or stuttering
- [ ] Clear and readable
- [ ] Appropriate duration (10-20 seconds)

### Video Quality:

- [ ] 1080p resolution minimum
- [ ] Clear audio (no background noise)
- [ ] Professional voiceover
- [ ] Subtitles included
- [ ] Chapter markers
- [ ] Smooth editing
- [ ] Engaging pace
- [ ] Call to action at end
- [ ] Uploaded to YouTube
- [ ] Video description with links

---

## 🛠️ Recommended Tools

### Screenshot Tools:
- **Windows**: Snipping Tool, ShareX, Greenshot
- **macOS**: Screenshot app (Cmd+Shift+4), CleanShot X
- **Linux**: Flameshot, Shutter, GNOME Screenshot

### GIF Recording:
- **Windows**: ScreenToGif, LICEcap
- **macOS**: Kap, GIPHY Capture, LICEcap
- **Linux**: Peek, Gifine

### Video Recording:
- **All platforms**: OBS Studio (free, professional)
- **Windows**: Camtasia, Bandicam
- **macOS**: ScreenFlow, Camtasia
- **Linux**: SimpleScreenRecorder, Kazam

### Image Editing:
- **Professional**: Adobe Photoshop, Affinity Photo
- **Free**: GIMP, Photopea (web-based)
- **Quick edits**: Paint.NET (Windows), Preview (macOS)

### Image Optimization:
- **Online**: TinyPNG, Squoosh
- **Desktop**: ImageOptim (macOS), FileOptimizer (Windows)

### Video Editing:
- **Professional**: Adobe Premiere Pro, Final Cut Pro
- **Free**: DaVinci Resolve, Shotcut
- **Simple**: iMovie (macOS), Windows Video Editor

### Annotation Tools:
- **All platforms**: Snagit, Skitch
- **Windows**: ShareX (built-in annotations)
- **macOS**: CleanShot X, Annotate

---

## 📤 Delivery Format

Once you have all the media assets ready, organize them as follows:

```
pantheon-media-assets/
├── README.md (this file)
├── logo/
│   └── pantheon-logo.png
├── screenshots/
│   ├── 01-login-screen.png
│   ├── 02-main-interface.png
│   ├── 03-settings-icon.png
│   ├── 04-ai-providers-settings.png
│   ├── 05-fetch-models.png
│   ├── 06-select-model.png
│   ├── 07-create-project.png
│   ├── 08-supabase-config.png
│   ├── 09-service-status.png
│   ├── 10-account-creation.png
│   ├── 11-ai-settings.png
│   └── 12-video-thumbnail.png
├── gifs/
│   ├── demo.gif
│   ├── install-demo-linux.gif
│   └── install-demo-windows.gif
└── videos/
    ├── installation-tutorial.mp4
    ├── installation-tutorial.srt (subtitles)
    ├── demo-video.mp4
    └── demo-video.srt (subtitles)
```

### Naming Convention:
- Use lowercase with hyphens
- Be descriptive
- Include numbers for ordering
- Match the names in documentation

### File Size Limits:
- Screenshots: < 500KB each
- GIFs: < 8MB each
- Videos: < 100MB each
- Total assets: < 250MB

---

## ✅ Priority Order

If you need to create assets incrementally, follow this priority:

### High Priority (Must Have):
1. ✅ Pantheon Logo
2. ✅ Main Interface screenshot
3. ✅ Login Screen screenshot
4. ✅ AI Providers Settings screenshot
5. ✅ Demo GIF

### Medium Priority (Should Have):
6. ✅ Settings Icon screenshot
7. ✅ Fetch Models screenshot
8. ✅ Select Model screenshot
9. ✅ Create Project screenshot
10. ✅ Installation GIFs (Linux & Windows)

### Low Priority (Nice to Have):
11. ✅ Supabase Config screenshot
12. ✅ Service Status screenshot
13. ✅ Account Creation screenshot
14. ✅ AI Settings screenshot
15. ✅ Video Thumbnail
16. ✅ Installation Tutorial video
17. ✅ Demo video

---

## 📝 Notes

- All screenshots should be taken from a **working Pantheon installation**
- Use **realistic data** (not Lorem Ipsum)
- Ensure **consistency** in UI theme (light or dark mode)
- **Blur sensitive information** (API keys, emails, etc.)
- Add **annotations** where specified (arrows, labels, highlights)
- Optimize all images for web (use compression)
- Test all images in documentation before finalizing
- Keep source files (PSD, XCF) for future edits

---

## 🎯 Success Criteria

Your media assets are ready when:

- [ ] All 18 assets are created
- [ ] All files are properly named
- [ ] All files meet size requirements
- [ ] All files meet quality standards
- [ ] All annotations are clear
- [ ] All sensitive data is removed/blurred
- [ ] All images are optimized
- [ ] All videos have subtitles
- [ ] All assets are organized in correct folders
- [ ] Documentation references are updated
- [ ] Assets are tested in documentation

---

**Questions?** Open an issue on GitHub or contact the maintainers.

**Ready to start?** Begin with the High Priority assets and work your way down!
