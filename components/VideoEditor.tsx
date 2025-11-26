import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';
import { CropArea, GifSettings } from '../types';
import { RESOLUTION_PRESETS, MIN_OUTPUT_WIDTH, MAX_OUTPUT_WIDTH, DEFAULT_OUTPUT_WIDTH } from '../constants';
import { Button } from './Button';
import { Sliders, Check, Monitor, Smartphone, Square, Scan } from 'lucide-react';

interface VideoEditorProps {
  videoUrl: string;
  onConfirm: (settings: GifSettings) => void;
  onCancel: () => void;
}

const ASPECT_RATIOS = [
  { label: 'Free', value: undefined, icon: Scan },
  { label: '16:9', value: 16 / 9, icon: Monitor },
  { label: '9:16', value: 9 / 16, icon: Smartphone },
  { label: '1:1', value: 1, icon: Square },
];

export const VideoEditor: React.FC<VideoEditorProps> = ({ videoUrl, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Settings State
  const [fps, setFps] = useState(15);
  const [speed, setSpeed] = useState(1);
  const [outputWidth, setOutputWidth] = useState(DEFAULT_OUTPUT_WIDTH);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleGenerate = () => {
    // If no crop area selected, use null (will process full video)
    let cropData: CropArea | null = null;

    if (croppedAreaPixels && croppedAreaPixels.width > 0 && croppedAreaPixels.height > 0) {
      // Convert pixel crop to our generic type
      cropData = {
        x: Math.max(0, croppedAreaPixels.x),
        y: Math.max(0, croppedAreaPixels.y),
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height
      };
    }

    onConfirm({
      crop: cropData,
      fps,
      speed,
      quality: 'medium', // Keep for backwards compatibility
      outputWidth,
      startTime: 0,
      endTime: 0 // Not implemented UI for timeline trimming yet for simplicity
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Editor Main Area - Split into Preview and Controls */}
      <div className="flex flex-col lg:flex-row h-full">
        
        {/* Left: Cropper / Video Preview */}
        <div className="relative flex-1 bg-black min-h-[400px] lg:min-h-0">
          <Cropper
            video={videoUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            classes={{
              containerClassName: "bg-black",
            }}
          />
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full flex gap-4 pointer-events-none">
             <span className="text-xs text-slate-300 font-mono">Drag to Pan • Scroll to Zoom</span>
           </div>
        </div>

        {/* Right: Controls Sidebar */}
        <div className="w-full lg:w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto z-20">
          
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              <Sliders className="w-5 h-5 text-brand-500" />
              Settings
            </h2>
            <p className="text-sm text-slate-400">Configure your output GIF.</p>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Crop Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((ratio) => {
                const Icon = ratio.icon;
                const isSelected = aspectRatio === ratio.value;
                return (
                  <button
                    key={ratio.label}
                    onClick={() => setAspectRatio(ratio.value)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-md border transition-all ${
                      isSelected
                        ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/20'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-semibold">{ratio.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Selector */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-300">Output Width</label>
              <span className="text-xs font-mono text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded">{outputWidth}px</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {RESOLUTION_PRESETS.map((preset) => (
                <button
                  key={preset.width}
                  onClick={() => setOutputWidth(preset.width)}
                  className={`px-2 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                    outputWidth === preset.width
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/20'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={MIN_OUTPUT_WIDTH}
              max={MAX_OUTPUT_WIDTH}
              step="10"
              value={outputWidth}
              onChange={(e) => setOutputWidth(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-xs text-slate-500">Higher resolution = better quality but larger file size.</p>
          </div>

          {/* FPS Slider */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-300">Frame Rate</label>
              <span className="text-xs font-mono text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded">{fps} FPS</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-xs text-slate-500">Higher FPS = smoother but larger file size.</p>
          </div>

          {/* Speed Control */}
          <div className="space-y-3">
             <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-300">Speed</label>
              <span className="text-xs font-mono text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded">{speed}x</span>
            </div>
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border ${
                     speed === s
                      ? 'bg-brand-600/20 border-brand-500 text-brand-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-3">
            <Button onClick={handleGenerate} size="lg" className="w-full">
              <Check className="w-4 h-4 mr-2" />
              Generate GIF
            </Button>
            <Button onClick={onCancel} variant="ghost" size="sm" className="w-full">
              Cancel
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};