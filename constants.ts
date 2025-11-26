import { LucideIcon, Zap, Image, Clock, Scissors } from 'lucide-react';

export const QUALITY_PRESETS = {
  low: { scale: 320, label: 'Low (Email friendly)' },
  medium: { scale: 480, label: 'Medium (Social Media)' },
  high: { scale: 600, label: 'High (Good Quality)' }, // Reduced max scale slightly for stability
};

export const STEPS = [
  { id: 1, title: 'Upload', icon: 'Upload' },
  { id: 2, title: 'Edit', icon: 'Scissors' },
  { id: 3, title: 'Preview', icon: 'Image' },
];

export const FF_MESSAGE_LOAD = 'Loading encoding engine...';
export const FF_MESSAGE_PROCESS = 'Rendering your GIF...';

// Lower limit to 20MB to ensure stability in single-threaded WASM environments
export const MAX_FILE_SIZE = 20 * 1024 * 1024;