import React, { useState, useEffect } from 'react';
import { Upload, X, Download, Wand2, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { ffmpegService } from './services/ffmpegService';
import { geminiService } from './services/geminiService';
import { VideoEditor } from './components/VideoEditor';
import { Button } from './components/Button';
import { GifSettings, ProcessingStatus, AiCaptionResult } from './types';
import { QUALITY_PRESETS, MAX_FILE_SIZE } from './constants';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifSize, setGifSize] = useState<number>(0);
  
  // AI Features
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCaption, setAiCaption] = useState<AiCaptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup URLs to avoid memory leaks
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate Type
      if (!selectedFile.type.startsWith('video/')) {
        setError('Please upload a valid video file (.mp4, .mov)');
        return;
      }

      // Validate Size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File too large (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Max size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
        return;
      }

      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setStatus('idle');
      setGifUrl(null);
      setAiCaption(null);
      setError(null);
    }
  };

  const handleGenerate = async (settings: GifSettings) => {
    if (!file) return;

    setStatus('loading_ffmpeg');
    setError(null);
    setProgress(0);

    try {
      // Ensure service is loaded before processing
      await ffmpegService.load();
      setStatus('processing');

      const gifBlob = await ffmpegService.convertToGif(file, settings, (p) => {
        setProgress(p);
      });

      const url = URL.createObjectURL(gifBlob);
      setGifUrl(url);
      setGifSize(gifBlob.size);
      setStatus('completed');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to convert video. Please try a smaller file or different format.');
      setStatus('error');
    }
  };

  const handleMagicCaption = async () => {
    if (!file) return;
    setIsAiLoading(true);
    try {
      // 1. Extract frame
      const frameBlob = await ffmpegService.extractFrame(file);
      // 2. Ask Gemini
      const result = await geminiService.generateCaption(frameBlob);
      setAiCaption(result);
    } catch (err) {
      console.error(err);
      // Fallback
      setAiCaption({ caption: "Look at this!", hashtags: ["#wow"] });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setVideoUrl(null);
    setGifUrl(null);
    setStatus('idle');
    setAiCaption(null);
    setProgress(0);
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    setStatus('idle');
    // If we have a file, we are effectively just clearing the error state so they can try again
    // If the error was fatal initialization, trying again will re-trigger the load() call
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 text-center max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/30">
            <span className="text-xl font-bold text-white">G</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">GifSmith</h1>
        </div>
        <p className="text-slate-400">Forge high-quality GIFs from your videos instantly. No uploads to server.</p>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl flex-1">
        
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-lg flex flex-col md:flex-row items-center gap-3 text-red-200">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm flex-1">{error}</p>
            <div className="flex gap-2">
               <Button size="sm" variant="secondary" onClick={handleRetry} className="h-8 border-red-700 hover:bg-red-800/50 text-red-100">
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Retry
               </Button>
               <button onClick={() => setError(null)} className="hover:text-white p-1">
                 <X className="w-4 h-4"/>
               </button>
            </div>
          </div>
        )}

        {/* State 1: Upload */}
        {!file && (
          <div className="w-full h-80 border-2 border-dashed border-slate-700 hover:border-brand-500 hover:bg-slate-800/30 rounded-2xl transition-all flex flex-col items-center justify-center gap-4 cursor-pointer group relative bg-slate-900/50">
             <input 
              type="file" 
              accept="video/mp4,video/quicktime,video/x-m4v"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-8 h-8 text-brand-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-white">Drop your video here</h3>
              <p className="text-slate-500 text-sm mt-1">MP4, MOV (Max {Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)</p>
            </div>
          </div>
        )}

        {/* State 2: Editor */}
        {file && videoUrl && !gifUrl && status !== 'processing' && status !== 'loading_ffmpeg' && (
          <div className="h-[600px]">
            <VideoEditor 
              videoUrl={videoUrl}
              onConfirm={handleGenerate}
              onCancel={handleReset}
            />
          </div>
        )}

        {/* State 3: Processing */}
        {(status === 'processing' || status === 'loading_ffmpeg') && (
           <div className="w-full h-80 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-8">
              <div className="relative w-24 h-24 mb-6">
                <svg className="animate-spin w-full h-full text-brand-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {progress}%
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {status === 'loading_ffmpeg' ? 'Initializing Engine...' : 'Forging GIF...'}
              </h3>
              <p className="text-slate-400 text-center max-w-sm">
                We are processing this locally. Larger or higher quality files may take longer.
              </p>
           </div>
        )}

        {/* State 4: Result */}
        {gifUrl && status === 'completed' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
             <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
               
               {/* Left: Result Image */}
               <div className="flex-1 flex flex-col items-center gap-4">
                 <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black/50 shadow-inner">
                   <img src={gifUrl} alt="Generated GIF" className="max-h-[500px] w-auto object-contain" />
                 </div>
                 <div className="text-slate-500 text-sm font-mono">
                    Size: {formatBytes(gifSize)}
                 </div>
               </div>

               {/* Right: Actions */}
               <div className="w-full md:w-80 flex flex-col gap-6">
                 <div>
                   <h2 className="text-2xl font-bold text-white mb-1">It's Ready!</h2>
                   <p className="text-slate-400 text-sm">Your GIF has been successfully generated.</p>
                 </div>

                 {/* Magic Caption Section */}
                 <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-purple-200">AI Magic Caption</h3>
                    </div>
                    
                    {!aiCaption ? (
                      <div className="text-center py-2">
                        <Button 
                          onClick={handleMagicCaption} 
                          isLoading={isAiLoading}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none"
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate Caption
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">Uses Gemini Vision to write a funny caption.</p>
                      </div>
                    ) : (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-white font-medium text-lg italic mb-2">"{aiCaption.caption}"</p>
                        <div className="flex flex-wrap gap-1">
                          {aiCaption.hashtags.map(tag => (
                            <span key={tag} className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>

                 <div className="flex flex-col gap-3 mt-auto">
                    <a 
                      href={gifUrl} 
                      download={`gifsmith-${Date.now()}.gif`}
                      className="w-full"
                    >
                      <Button className="w-full" size="lg">
                        <Download className="w-4 h-4 mr-2" />
                        Download GIF
                      </Button>
                    </a>
                    <Button variant="secondary" onClick={handleReset}>
                      Create Another
                    </Button>
                 </div>
               </div>

             </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-8 text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} GifSmith. Local processing powered by FFmpeg WASM.</p>
      </footer>
    </div>
  );
}