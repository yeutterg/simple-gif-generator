import { createFFmpeg, fetchFile, FFmpeg } from '@ffmpeg/ffmpeg';
import { GifSettings } from '../types';
import { QUALITY_PRESETS } from '../constants';

class FFmpegService {
  private ffmpeg: FFmpeg;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    // 0.10.1 Initialization
    // We explicitly point to the 0.10.0 core on unpkg which is the most stable version for non-isolated environments
    this.ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
    });
  }

  async load() {
    if (this.ffmpeg.isLoaded()) return;

    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = (async () => {
      try {
        console.log("Loading FFmpeg Core (0.10.0)...");
        await this.ffmpeg.load();
        console.log("FFmpeg loaded successfully.");
      } catch (e: any) {
        console.error("FFmpeg Load Error:", e);
        this.loadingPromise = null;
        // Even with the polyfill, actual load might fail if something else is wrong
        if (e.message && (e.message.includes('SharedArrayBuffer') || e.message.includes('insecure'))) {
          throw new Error("Browser security blocked the engine. Please try Chrome/Firefox on Desktop or check browser settings.");
        }
        throw new Error("Failed to initialize video engine. Please reload the page.");
      }
    })();

    await this.loadingPromise;
  }

  async convertToGif(
    videoFile: File,
    settings: GifSettings,
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    await this.load();
    const ffmpeg = this.ffmpeg;

    // Reset progress listener
    ffmpeg.setProgress(({ ratio }) => {
      // 0.10 provides ratio 0-1
      if (ratio >= 0 && ratio <= 1) {
        onProgress(10 + Math.floor(ratio * 80));
      }
    });

    const inputName = 'input.mp4';
    const intermediateName = 'intermediate.mp4';
    const paletteName = 'palette.png';
    const outputName = 'output.gif';

    // Cleanup Helper for 0.10 FS
    const safeUnlink = (fileName: string) => {
      try {
        // Check if file exists before unlinking to avoid errors in console
        ffmpeg.FS('stat', fileName);
        ffmpeg.FS('unlink', fileName);
      } catch (e) {
        // Ignore unlink errors (file not found)
      }
    };

    const cleanup = () => {
      safeUnlink(inputName);
      safeUnlink(intermediateName);
      safeUnlink(paletteName);
      safeUnlink(outputName);
    };

    try {
      cleanup();

      // 0. Write Input
      ffmpeg.FS('writeFile', inputName, await fetchFile(videoFile));

      // 1. Build Filter Chain
      const filters: string[] = [];

      // FPS
      filters.push(`fps=${settings.fps}`);

      // Crop
      if (settings.crop) {
        const { width, height, x, y } = settings.crop;
        const w = Math.floor(width / 2) * 2;
        const h = Math.floor(height / 2) * 2;
        filters.push(`crop=${w}:${h}:${x}:${y}`);
      }

      // Scale
      const targetWidth = QUALITY_PRESETS[settings.quality].scale;
      filters.push(`scale=${targetWidth}:-2:flags=lanczos`);

      // Speed
      if (settings.speed !== 1) {
        filters.push(`setpts=${(1 / settings.speed).toFixed(2)}*PTS`);
      }

      const filterString = filters.join(',');

      // --- STEP 1: Pre-process video ---
      console.log("Step 1/3: Processing video...");
      onProgress(10);

      await ffmpeg.run(
        '-i', inputName,
        '-vf', filterString,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-an',
        '-pix_fmt', 'yuv420p',
        intermediateName
      );
      
      onProgress(50);

      // --- STEP 2: Generate Palette ---
      console.log("Step 2/3: Generating palette...");

      await ffmpeg.run(
        '-i', intermediateName,
        '-vf', 'palettegen=stats_mode=diff', 
        paletteName
      );
      
      onProgress(75);

      // --- STEP 3: Render GIF ---
      console.log("Step 3/3: Rendering GIF...");

      await ffmpeg.run(
        '-i', intermediateName,
        '-i', paletteName,
        '-lavfi', 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-f', 'gif',
        outputName
      );

      onProgress(100);

      // Read result
      const data = ffmpeg.FS('readFile', outputName);
      const resultBlob = new Blob([data.buffer], { type: 'image/gif' });

      cleanup();
      return resultBlob;

    } catch (error: any) {
      console.error("FFmpeg conversion error:", error);
      cleanup();
      
      if (error.message && error.message.includes('memory')) {
        throw new Error("Video is too complex for browser memory. Try a smaller file.");
      }
      throw new Error("Conversion failed. Please try a different video file.");
    }
  }

  async extractFrame(videoFile: File): Promise<Blob> {
    await this.load();
    const ffmpeg = this.ffmpeg;
    const inputName = 'input_analysis.mp4';
    const outputName = 'frame.jpg';

    const safeUnlink = (fileName: string) => {
      try { ffmpeg.FS('unlink', fileName); } catch(e){}
    };

    try {
      safeUnlink(inputName);
      safeUnlink(outputName);

      ffmpeg.FS('writeFile', inputName, await fetchFile(videoFile));
      
      await ffmpeg.run(
        '-i', inputName, 
        '-ss', '00:00:01', 
        '-frames:v', '1', 
        '-q:v', '5', 
        outputName
      );
      
      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: 'image/jpeg' });
      
      safeUnlink(inputName);
      safeUnlink(outputName);
      
      return blob;
    } catch (e) {
      safeUnlink(inputName);
      safeUnlink(outputName);
      throw e;
    }
  }
}

export const ffmpegService = new FFmpegService();