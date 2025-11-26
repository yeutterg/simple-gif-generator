import { createFFmpeg, fetchFile, FFmpeg } from '@ffmpeg/ffmpeg';
import { GifSettings } from '../types';
import { QUALITY_PRESETS } from '../constants';

class FFmpegService {
  private ffmpeg: FFmpeg;
  private loadingPromise: Promise<void> | null = null;
  private isProcessing: boolean = false;

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
        if (e.message && e.message.includes('network')) {
          throw new Error("Failed to load video engine. Please check your internet connection and reload.");
        }
        throw new Error("Failed to initialize video engine. Please reload the page.");
      }
    })();

    await this.loadingPromise;
  }

  // Helper to check if a file exists in the virtual filesystem
  private fileExists(fileName: string): boolean {
    try {
      this.ffmpeg.FS('stat', fileName);
      return true;
    } catch {
      return false;
    }
  }

  // Helper to get file size in virtual filesystem
  private getFileSize(fileName: string): number {
    try {
      const stat = this.ffmpeg.FS('stat', fileName);
      return stat.size;
    } catch {
      return 0;
    }
  }

  async convertToGif(
    videoFile: File,
    settings: GifSettings,
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    // Prevent concurrent processing which can cause memory issues
    if (this.isProcessing) {
      throw new Error("A conversion is already in progress. Please wait for it to complete.");
    }

    this.isProcessing = true;

    try {
      await this.load();
    } catch (loadError) {
      this.isProcessing = false;
      throw loadError;
    }

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
      console.log("Loading video file into memory...");
      try {
        ffmpeg.FS('writeFile', inputName, await fetchFile(videoFile));
      } catch (writeError: any) {
        console.error("Failed to write input file:", writeError);
        if (writeError.message && writeError.message.includes('memory')) {
          throw new Error("Video file is too large for browser memory. Try a smaller file (under 15MB recommended).");
        }
        throw new Error("Failed to load video file. The file may be corrupted or too large.");
      }

      // 1. Build Filter Chain
      const filters: string[] = [];

      // FPS - validate range
      const fps = Math.max(5, Math.min(30, settings.fps));
      filters.push(`fps=${fps}`);

      // Crop - with validation
      if (settings.crop) {
        const { width, height, x, y } = settings.crop;
        // Ensure dimensions are even numbers (required by many codecs)
        const w = Math.max(2, Math.floor(width / 2) * 2);
        const h = Math.max(2, Math.floor(height / 2) * 2);
        // Ensure x,y are non-negative
        const cropX = Math.max(0, Math.floor(x));
        const cropY = Math.max(0, Math.floor(y));

        if (w > 0 && h > 0) {
          filters.push(`crop=${w}:${h}:${cropX}:${cropY}`);
        }
      }

      // Scale - validate quality preset
      const qualityKey = settings.quality in QUALITY_PRESETS ? settings.quality : 'medium';
      const targetWidth = QUALITY_PRESETS[qualityKey].scale;
      filters.push(`scale=${targetWidth}:-2:flags=lanczos`);

      // Speed - validate range
      const speed = Math.max(0.25, Math.min(4, settings.speed));
      if (speed !== 1) {
        filters.push(`setpts=${(1 / speed).toFixed(2)}*PTS`);
      }

      const filterString = filters.join(',');
      console.log("Filter chain:", filterString);

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
        '-movflags', '+faststart',
        intermediateName
      );

      // Verify intermediate file was created
      if (!this.fileExists(intermediateName) || this.getFileSize(intermediateName) === 0) {
        throw new Error("Video preprocessing failed. The video format may not be supported. Try converting to MP4 first.");
      }

      onProgress(50);

      // --- STEP 2: Generate Palette ---
      console.log("Step 2/3: Generating palette...");

      await ffmpeg.run(
        '-i', intermediateName,
        '-vf', 'palettegen=stats_mode=diff:max_colors=256',
        paletteName
      );

      // Verify palette was created
      if (!this.fileExists(paletteName) || this.getFileSize(paletteName) === 0) {
        throw new Error("Failed to generate color palette. The video may be too short or have no valid frames.");
      }

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

      // Verify GIF was created
      if (!this.fileExists(outputName) || this.getFileSize(outputName) === 0) {
        throw new Error("GIF rendering failed. Try reducing quality settings or using a shorter video.");
      }

      onProgress(100);

      // Read result
      const data = ffmpeg.FS('readFile', outputName);
      const resultBlob = new Blob([data.buffer], { type: 'image/gif' });

      // Verify blob is valid
      if (resultBlob.size === 0) {
        throw new Error("Generated GIF is empty. Please try with different settings.");
      }

      cleanup();
      this.isProcessing = false;
      return resultBlob;

    } catch (error: any) {
      console.error("FFmpeg conversion error:", error);
      cleanup();
      this.isProcessing = false;

      // Categorize errors for better user feedback
      const errorMsg = error.message?.toLowerCase() || '';

      if (errorMsg.includes('memory') || errorMsg.includes('oom') || errorMsg.includes('allocation')) {
        throw new Error("Video is too complex for browser memory. Try a smaller file or lower quality settings.");
      }
      if (errorMsg.includes('codec') || errorMsg.includes('decoder') || errorMsg.includes('demuxer')) {
        throw new Error("Video format not supported. Please convert to MP4 (H.264) format first.");
      }
      if (errorMsg.includes('no such file') || errorMsg.includes('not found')) {
        throw new Error("Processing error occurred. Please try again or use a different video.");
      }
      if (error.message && !errorMsg.includes('conversion failed')) {
        // Re-throw with the original message if it's already a user-friendly error
        throw error;
      }
      throw new Error("Conversion failed. Try a smaller file, lower quality, or different video format.");
    }
  }

  async extractFrame(videoFile: File): Promise<Blob> {
    await this.load();
    const ffmpeg = this.ffmpeg;
    const inputName = 'input_analysis.mp4';
    const outputName = 'frame.jpg';

    const safeUnlink = (fileName: string) => {
      try {
        ffmpeg.FS('stat', fileName);
        ffmpeg.FS('unlink', fileName);
      } catch (e) {
        // Ignore errors
      }
    };

    try {
      safeUnlink(inputName);
      safeUnlink(outputName);

      ffmpeg.FS('writeFile', inputName, await fetchFile(videoFile));

      // Try to extract a frame at different timestamps in case video is short
      // First try at 0.5 seconds (works for most videos including short ones)
      const timestamps = ['00:00:00.5', '00:00:00.1', '00:00:00'];

      for (const timestamp of timestamps) {
        try {
          await ffmpeg.run(
            '-i', inputName,
            '-ss', timestamp,
            '-frames:v', '1',
            '-q:v', '5',
            '-y', // Overwrite output
            outputName
          );

          // Check if frame was extracted successfully
          if (this.fileExists(outputName) && this.getFileSize(outputName) > 0) {
            const data = ffmpeg.FS('readFile', outputName);
            const blob = new Blob([data.buffer], { type: 'image/jpeg' });

            if (blob.size > 0) {
              safeUnlink(inputName);
              safeUnlink(outputName);
              return blob;
            }
          }
        } catch (frameError) {
          console.log(`Frame extraction at ${timestamp} failed, trying next...`);
          // Continue to next timestamp
        }
      }

      // If all timestamps failed, throw an error
      throw new Error("Could not extract a frame from the video.");
    } catch (e: any) {
      safeUnlink(inputName);
      safeUnlink(outputName);

      console.error("Frame extraction error:", e);
      throw new Error("Failed to extract frame for AI caption. The video format may not be supported.");
    }
  }
}

export const ffmpegService = new FFmpegService();