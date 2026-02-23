# Media Assets

This folder contains demo videos and media assets for the Pantheon project.

## Video Files

Place your demo videos here:

- `platform-demo.mp4` - Main platform overview video
- `add-models.mp4` - Tutorial on adding AI models
- `custom-modes.mp4` - Tutorial on creating custom modes

## Video Requirements

- **Format**: MP4 (H.264 codec recommended)
- **Resolution**: 1920x1080 or 1280x720
- **Frame Rate**: 30fps or 60fps
- **File Size**: Keep under 50MB for GitHub
- **Duration**: 30 seconds to 2 minutes per video

## Recording Tips

1. Use screen recording software (OBS, Camtasia, etc.)
2. Record at 1920x1080 resolution
3. Keep videos concise and focused
4. Add captions if possible
5. Compress videos to reduce file size

## Compression

To compress videos for GitHub:

```bash
# Using ffmpeg
ffmpeg -i input.mp4 -vcodec h264 -acodec aac -b:v 2M output.mp4
```

## Alternative: Use GIFs

For smaller file sizes, convert to GIF:

```bash
# Convert MP4 to GIF
ffmpeg -i input.mp4 -vf "fps=15,scale=800:-1:flags=lanczos" output.gif
```

Then update README.md to use:
```html
<img src="https://github.com/akilhassane/pantheon/raw/main/media/demo.gif" alt="Demo" width="100%">
```
