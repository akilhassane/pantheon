# Video Upload Instructions

## How to Add the Platform Demo Video to README

The README.md currently has a placeholder for the platform demo video. Follow these steps to upload and embed the video on GitHub.

## Step-by-Step Instructions

### Method 1: Direct Upload to README (Recommended)

1. **Navigate to GitHub Repository**
   - Go to https://github.com/akilhassane/pantheon
   - Make sure you're on the main branch

2. **Edit README.md**
   - Click on `README.md` file
   - Click the pencil icon (Edit this file) in the top right

3. **Upload Video**
   - Scroll to the "Platform Demo" section
   - You'll see this placeholder:
     ```markdown
     https://github.com/user-attachments/assets/your-video-id-here
     ```
   - Click in the editor below that line
   - Drag and drop `media/platform-demo-compressed.mp4` into the editor
   - Wait for upload to complete (may take 1-2 minutes)

4. **Get Video URL**
   - GitHub will automatically generate a URL like:
     ```
     https://github.com/user-attachments/assets/abc123-def456-ghi789.mp4
     ```
   - Copy this entire URL

5. **Replace Placeholder**
   - Delete the placeholder line:
     ```markdown
     https://github.com/user-attachments/assets/your-video-id-here
     ```
   - Paste the new URL in its place
   - Keep it on its own line (no markdown formatting needed)

6. **Update Instructions**
   - Delete or update the instruction line:
     ```markdown
     > Upload `media/platform-demo-compressed.mp4` to GitHub and replace the URL above.
     ```
   - You can replace it with:
     ```markdown
     > The video demonstrates the complete Pantheon platform including project creation, Windows VM management, and AI model integration.
     ```

7. **Commit Changes**
   - Scroll to bottom
   - Add commit message: "docs: Add platform demo video"
   - Click "Commit changes"

8. **Verify**
   - View README.md on GitHub
   - Video should auto-play on loop
   - Video should be muted by default
   - Playback controls should be visible

### Method 2: Upload via Issue (Alternative)

If Method 1 doesn't work:

1. **Create New Issue**
   - Go to Issues tab
   - Click "New Issue"
   - Title: "Video Upload" (you'll close this after)

2. **Upload Video**
   - In the comment box, drag and drop `media/platform-demo-compressed.mp4`
   - Wait for upload
   - GitHub generates URL automatically

3. **Copy URL**
   - Right-click the uploaded video
   - Copy the URL (should be like `https://github.com/user-attachments/assets/...`)

4. **Update README**
   - Go back to README.md
   - Edit file
   - Replace placeholder with copied URL
   - Commit changes

5. **Close Issue**
   - Go back to the issue
   - Close it (no longer needed)

## Video Specifications

The compressed video is optimized for GitHub:
- **File**: `media/platform-demo-compressed.mp4`
- **Size**: ~10MB (under GitHub's 100MB limit)
- **Resolution**: 1280x720
- **Format**: MP4 (H.264 codec)
- **Duration**: 2-3 minutes

## Expected Result

After uploading, the README will display:
- Auto-playing video (muted)
- Looping playback
- Playback controls (play/pause, volume, fullscreen)
- Responsive sizing
- Works on mobile and desktop

## Troubleshooting

### Video Not Showing
- Make sure URL is on its own line
- Don't wrap in markdown image syntax `![]()`
- Don't wrap in markdown link syntax `[]()`
- Just paste the raw URL

### Video Not Auto-Playing
- This is normal on some browsers
- Users can click play button
- Video will auto-play on most modern browsers

### File Too Large
- Use `media/platform-demo-compressed.mp4` (already compressed)
- If still too large, use `media/platform-demo-small.mp4`
- Or use the GIF version: `media/platform-demo.gif`

### Upload Failed
- Check internet connection
- Try smaller file
- Try Method 2 (via Issue)
- Or use external hosting (YouTube, Vimeo)

## Alternative: Use GIF

If video upload doesn't work, you can use the GIF version:

1. Edit README.md
2. Replace the video section with:
   ```markdown
   ## Platform Demo
   
   ![Platform Demo](https://github.com/akilhassane/pantheon/raw/main/media/platform-demo.gif)
   
   > The demo shows the complete Pantheon platform including project creation, Windows VM management, and AI model integration.
   ```
3. Commit changes

The GIF will auto-play and loop automatically.

## Other Videos

The other videos are already embedded as GIFs:
- ✓ `docs/KEYCLOAK_SETUP.md` uses `media/custom-modes.gif`
- ✓ `docs/MODEL_CONFIGURATION.md` uses `media/add-models.gif`

These will work automatically once pushed to GitHub.

## Need Help?

If you encounter issues:
1. Check `media/HOW_TO_ADD_VIDEOS.md` for detailed instructions
2. Check `media/README.md` for video specifications
3. Open an issue on GitHub
4. Check GitHub's documentation on embedding videos

## Summary

1. Go to GitHub repository
2. Edit README.md
3. Drag and drop `media/platform-demo-compressed.mp4`
4. Copy generated URL
5. Replace placeholder with URL
6. Commit changes
7. Verify video plays

That's it! The video will be embedded and auto-playing on your README.
