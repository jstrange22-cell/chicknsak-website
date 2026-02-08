import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Zap, ZapOff, SwitchCamera, Image, Loader2 } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { PhotoPreview, type SavePhotoData } from '@/components/camera/PhotoPreview';
import { uploadPhoto } from '@/lib/storage';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface CapturedPhoto {
  dataUrl: string;
  blob: Blob;
  timestamp: Date;
}

export default function Camera() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId') || searchParams.get('project') || undefined;
  
  const { profile, user } = useAuthContext();
  const { position } = useGeolocation();
  const camera = useCamera();
  
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Start camera on mount (web only)
  // Use a small delay to ensure the video element is mounted in the DOM
  useEffect(() => {
    if (!camera.isNative) {
      // Small delay to ensure video ref is attached to the DOM element
      const timer = setTimeout(() => {
        camera.openCamera();
      }, 100);
      return () => {
        clearTimeout(timer);
        camera.stopCamera();
      };
    }
    return () => {
      camera.stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    
    try {
      const photo = await camera.capturePhoto();
      if (photo) {
        setCapturedPhoto(photo);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    if (!camera.isNative) {
      camera.openCamera();
    }
  };


  const handleSavePhoto = async (data: SavePhotoData) => {
    if (!capturedPhoto || !profile?.companyId || !user?.uid) return;

    try {
      await uploadPhoto({
        file: capturedPhoto.blob,
        projectId: data.projectId,
        userId: user.uid,
        companyId: profile.companyId,
        description: data.description,
        latitude: position?.latitude,
        longitude: position?.longitude,
        capturedAt: capturedPhoto.timestamp,
        isBefore: data.isBefore,
        isAfter: data.isAfter,
        isInternal: data.isInternal,
      });

      // Navigate back to project or projects list
      if (preselectedProjectId) {
        navigate(`/projects/${preselectedProjectId}`);
      } else {
        navigate(`/projects/${data.projectId}`);
      }
    } catch (error) {
      console.error('Failed to save photo:', error);
      alert('Failed to save photo. Please try again.');
    }
  };

  const handleClose = () => {
    camera.stopCamera();
    navigate(-1);
  };

  // Show photo preview if captured
  if (capturedPhoto) {
    return (
      <PhotoPreview
        photoDataUrl={capturedPhoto.dataUrl}
        timestamp={capturedPhoto.timestamp}
        latitude={position?.latitude}
        longitude={position?.longitude}
        onRetake={handleRetake}
        onSave={handleSavePhoto}
        preselectedProjectId={preselectedProjectId}
      />
    );
  }

  // Camera viewfinder
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {camera.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : camera.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
            <p className="text-center mb-4">{camera.error}</p>
            <button
              onClick={() => camera.openCamera()}
              className="px-4 py-2 bg-blue-500 rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <video
              ref={camera.videoRef}
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(1)' }}
            />
            <canvas ref={camera.canvasRef} className="hidden" />
          </>
        )}


        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-black/50 text-white"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={camera.toggleFlash}
              className="p-2 rounded-full bg-black/50 text-white"
            >
              {camera.flashMode === 'off' ? (
                <ZapOff className="h-6 w-6" />
              ) : (
                <Zap className={cn("h-6 w-6", camera.flashMode === 'on' && "text-yellow-400")} />
              )}
            </button>
            <button
              onClick={camera.switchCamera}
              className="p-2 rounded-full bg-black/50 text-white"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* GPS indicator */}
        {position && (
          <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            📍 {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
          </div>
        )}

        {/* Timestamp */}
        <div className="absolute bottom-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex-shrink-0 h-32 bg-black flex items-center justify-between px-8">
        {/* Gallery button */}
        <button className="p-3 rounded-full bg-white/10 text-white">
          <Image className="h-6 w-6" />
        </button>

        {/* Capture button */}
        <button
          onClick={handleCapture}
          disabled={isCapturing || camera.isLoading || !!camera.error}
          className={cn(
            "w-18 h-18 rounded-full border-4 border-white flex items-center justify-center",
            isCapturing && "opacity-50"
          )}
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>

        {/* Placeholder for last photo thumbnail */}
        <div className="w-12 h-12 rounded-lg bg-white/10" />
      </div>
    </div>
  );
}
