# GifSmith

A professional-grade, client-side video-to-GIF converter built with React and TypeScript. Convert your videos to high-quality GIFs with precise cropping, speed control, and frame rate adjustments - all processed locally in your browser for maximum privacy.

## Features

- **100% Client-Side Processing** - Your videos never leave your device. All conversion happens locally using FFmpeg WebAssembly
- **Precise Cropping** - Interactive crop tool with preset aspect ratios (16:9, 9:16, 1:1, or free-form)
- **Quality Control** - Three output presets (Low/Medium/High) optimized for different use cases
- **Speed Adjustment** - Create slow-motion (0.5x) or sped-up (2x) GIFs
- **Frame Rate Control** - Adjustable FPS (5-30) for smooth animations or smaller file sizes
- **Optimized Output** - Two-pass encoding with palette generation for vibrant, compact GIFs

## Tech Stack

- **React 19** with TypeScript
- **FFmpeg WASM** (0.10.1) - Video processing in the browser
- **Vite** - Fast build tooling
- **Tailwind CSS** - Styling
- **react-easy-crop** - Video cropping interface

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gifsmith.git
   cd gifsmith
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/gifsmith)

### Manual Deployment

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. For production deployment:
   ```bash
   vercel --prod
   ```

### Important: Cross-Origin Headers

For FFmpeg WASM to work properly, your deployment needs specific security headers. The project includes a `vercel.json` file that configures these automatically:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

> Note: The app includes a SharedArrayBuffer polyfill for environments without these headers, but performance may vary.

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 92+ | Full support |
| Firefox 89+ | Full support |
| Edge 92+ | Full support |
| Safari 15.2+ | Partial (may need headers) |

**Requirements:**
- Modern browser with WebAssembly support
- JavaScript enabled
- At least 2GB available RAM recommended

## File Limitations

- **Maximum file size:** 20MB (browser memory constraint)
- **Supported formats:** MP4, MOV, M4V
- **Recommended:** MP4 with H.264 encoding for best compatibility

## Troubleshooting

### "Browser security blocked the engine"
This occurs when SharedArrayBuffer is not available. Solutions:
- Use Chrome or Firefox on desktop
- If self-hosting, add COOP/COEP headers (see Vercel section above)

### "Video is too complex for browser memory"
The video file is too large or complex for browser processing:
- Try a smaller video file (under 15MB recommended)
- Use lower quality settings
- Trim the video before uploading

### "Video format not supported"
The video codec may not be compatible:
- Convert your video to MP4 (H.264) format using tools like HandBrake
- Avoid videos with uncommon codecs (HEVC/H.265 may not work)

### GIF quality is poor
- Increase the quality preset to "High"
- Increase the frame rate (higher FPS = smoother but larger)
- For best results, use videos with good lighting and minimal fast motion

## How It Works

1. **Upload** - Select a video file (validated for type and size)
2. **Edit** - Crop, adjust speed, set quality and frame rate
3. **Process** - Three-step FFmpeg pipeline:
   - Pre-process video (apply filters, crop, scale)
   - Generate optimized 256-color palette
   - Render final GIF with dithering
4. **Download** - Get your optimized GIF

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with FFmpeg WASM for client-side video processing.
