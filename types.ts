export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GifSettings {
  fps: number;
  speed: number;
  quality: 'low' | 'medium' | 'high';
  crop: CropArea | null;
  startTime: number;
  endTime: number;
}

export type ProcessingStatus = 'idle' | 'loading_ffmpeg' | 'processing' | 'completed' | 'error';

export interface GeneratedGif {
  url: string;
  blob: Blob;
  size: number; // in bytes
}

export interface AiCaptionResult {
  caption: string;
  hashtags: string[];
}
