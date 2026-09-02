import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { compressImageFile } from '../utils/helpers';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, dataUrl: string) => void;
  title?: string;
  preferredFacingMode?: 'user' | 'environment';
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Take Photo',
  preferredFacingMode = 'user',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(preferredFacingMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !capturedDataUrl) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported on this browser/environment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(err.message || 'Camera permission denied or camera device unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera for natural mirror selfie feel
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!capturedDataUrl) return;

    try {
      // Convert dataUrl to File and optimize under 500 KB
      const res = await fetch(capturedDataUrl);
      const blob = await res.blob();
      const rawFile = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImageFile(rawFile, 480000);
      onCapture(compressed.compressedFile, compressed.dataUrl);
      handleClose();
    } catch (err) {
      console.error('Error creating file from capture:', err);
      // Fallback
      fetch(capturedDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file, capturedDataUrl);
          handleClose();
        });
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedDataUrl(null);
    setCameraError(null);
    onClose();
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onCapture(file, dataUrl);
      handleClose();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div id="camera-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div id="camera-modal-container" className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          </div>
          <button
            id="close-camera-modal-btn"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Content */}
        <div className="p-4 flex-1 flex flex-col items-center justify-center bg-slate-950 relative min-h-[300px]">
          {capturedDataUrl ? (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <img src={capturedDataUrl} alt="Captured" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                <Check className="w-3.5 h-3.5" /> Photo Captured
              </div>
            </div>
          ) : cameraError ? (
            <div className="text-center p-6 text-slate-300 flex flex-col items-center max-w-xs">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <p className="text-sm text-slate-200 font-medium mb-1">Camera Not Accessible</p>
              <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
              <button
                id="gallery-fallback-btn"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow"
              >
                <ImageIcon className="w-4 h-4" /> Upload from Gallery
              </button>
            </div>
          ) : (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
                  Starting camera...
                </div>
              )}
              {/* Flip camera button */}
              <button
                id="flip-camera-btn"
                type="button"
                onClick={handleToggleCamera}
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleGallerySelect}
          />
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          {capturedDataUrl ? (
            <>
              <button
                id="retake-photo-btn"
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retake
              </button>
              <button
                id="confirm-photo-btn"
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 shadow"
              >
                <Check className="w-4 h-4" /> Use Photo
              </button>
            </>
          ) : (
            <>
              <button
                id="upload-gallery-fallback-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-xl text-sm transition flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Gallery</span>
              </button>
              <button
                id="snap-photo-btn"
                type="button"
                disabled={Boolean(cameraError) || isLoading}
                onClick={handleSnap}
                className="flex-1 py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow"
              >
                <Camera className="w-4 h-4" /> Capture Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
