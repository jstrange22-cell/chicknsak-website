import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera as CameraIcon, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { PhotoPreview, type SavePhotoData } from '@/components/camera/PhotoPreview';
import { uploadPhoto } from '@/lib/storage';
import { useAuthContext } from '@/components/auth/AuthProvider';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Automatically trigger native camera on mount
  useEffect(() => {
    if (!hasTriggered) {
      setHasTriggered(true);
      // Small delay to ensure the input is mounted
      const timer = setTimeout(() => {
        cameraInputRef.current?.click();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [hasTriggered]);

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled — go back
      navigate(-1);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPhoto({
        dataUrl: reader.result as string,
        blob: file,
        timestamp: new Date(),
      });
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-captured
    e.target.value = '';
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    // Re-trigger native camera
    setTimeout(() => cameraInputRef.current?.click(), 100);
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

  // Waiting for native camera — show minimal loading state
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Hidden file input that triggers native device camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileCapture}
      />

      <Loader2 className="h-8 w-8 animate-spin text-white mb-4" />
      <p className="text-white text-sm mb-6">Opening camera...</p>

      {/* Fallback button if auto-trigger doesn't work */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
      >
        <CameraIcon className="h-5 w-5" />
        Open Camera
      </button>

      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-white/60 hover:text-white text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
