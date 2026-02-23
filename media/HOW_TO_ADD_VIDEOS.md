# How to Add Videos to GitHub README

GitHub has specific ways to embed videos in README files. Here are the best methods:

## Method 1: GitHub Assets (Recommended - Auto-playing)

This is the **best method** for auto-playing videos in GitHub READMEs.

### Steps:

1. **Create a new GitHub Issue** in your repository (you can close it after)
2. **Drag and drop your video** into the issue comment box
3. **Wait for upload** - GitHub will generate a URL like:
   ```
   https://github.com/user-attachments/assets/abc123-def456-ghi789.mp4
   ```
4. **Copy the full URL** (including the video player embed)
5. **Paste directly in README.md**:
   ```markdown
   https://github.com/user-attachments/assets/abc123-def456-ghi789.mp4
   ```

GitHub will automatically convert this to an embedded video player that:
- ✅ Auto-plays on loop
- ✅ Is muted by default
- ✅ Has playback controls
- ✅ Works on mobile

### Example:

```markdown
## 🎥 Demo

https://github.com/user-attachments/assets/your-video-id-here
```

## Method 2: GIF Files (Alternative)

If you prefer GIFs or have file size concerns:

### Steps:

1. **Convert video to GIF**:
   ```bash
   ffmpeg -i input.mp4 -vf "fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 output.gif
   ```

2. **Add to media/ folder**:
   ```bash
   git add media/demo.gif
   git commit -m "Add demo GIF"
   git push
   ```

3. **Embed in README**:
   ```markdown
   ![Demo](https://github.com/akilhassane/pantheon/raw/main/media/demo.gif)
   ```

### GIF Optimization Tips:

- Keep resolution around 800px width
- Use 15-20 fps (not 30)
- Limit duration to 10-15 seconds
- Use palette optimization for better quality
- Target file size under 10MB

## Method 3: External Hosting

Host videos on:
- YouTube (embed with thumbnail)
- Vimeo
- Streamable
- Imgur (for GIFs)

### YouTube Embed:

```markdown
[![Watch the video](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://youtu.be/VIDEO_ID)
```

## Video Requirements

### For GitHub Assets:
- **Max size**: 100MB
- **Formats**: MP4, MOV, WEBM
- **Recommended**: MP4 with H.264 codec
- **Resolution**: 1920x1080 or 1280x720
- **Duration**: Keep under 2 minutes

### Compression Command:

```bash
ffmpeg -i input.mp4 -vcodec h264 -acodec aac -b:v 2M -maxrate 2M -bufsize 4M output.mp4
```

## Current README Structure

Your README is set up to use Method 1 (GitHub Assets). To add your videos:

1. Upload each video to a GitHub issue
2. Copy the generated URLs
3. Replace the placeholder URLs in README.md:
   - `https://github.com/user-attachments/assets/your-video-id-here`

## Example Workflow

```bash
# 1. Record your video
# 2. Compress it
ffmpeg -i raw-demo.mp4 -vcodec h264 -acodec aac -b:v 2M demo.mp4

# 3. Upload to GitHub issue and get URL
# 4. Update README.md with the URL
# 5. Commit and push
git add README.md
git commit -m "docs: Add demo video"
git push
```

## Tips for Great Demo Videos

1. **Keep it short** - 30-60 seconds is ideal
2. **Show key features** - Focus on what makes your project unique
3. **Use smooth transitions** - No jarring cuts
4. **Add text overlays** - Explain what's happening
5. **High quality** - Record at 1080p minimum
6. **Good lighting** - If showing UI, use high contrast
7. **No audio needed** - Videos auto-play muted
8. **Loop-friendly** - Make sure the end flows to the beginning

## Troubleshooting

### Video not showing?
- Make sure URL is on its own line
- Don't wrap in markdown image syntax
- Check file size is under 100MB

### Video not auto-playing?
- Use GitHub Assets method (Method 1)
- Make sure it's a direct GitHub asset URL
- GIFs always auto-play

### File too large?
- Compress with ffmpeg
- Reduce resolution to 720p
- Shorten duration
- Convert to GIF
