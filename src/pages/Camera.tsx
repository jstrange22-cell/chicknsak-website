import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera as CameraIcon, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
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
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Use Capacitor Camera plugin on native devices for the best experience
  const handleNativeCamera = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (!photo.dataUrl) return;

      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();

      setCapturedPhoto({
        dataUrl: photo.dataUrl,
        blob,
        timestamp: new Date(),
      });
    } catch (error) {
      console.log('Camera cancelled or failed:', error);
    }
  };

  // On web, use file input with capture attribute
  const handleWebCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleTakePhoto = () => {
    if (isNative) {
      handleNativeCamera();
    } else {
      handleWebCamera();
    }
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPhoto({
        dataUrl: reader.result as string,
        blob: file,
        timestamp: new Date(),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleSavePhoto = async (data: SavePhotoData) => {
    if (!capturedPhoto || !profile?.companyId || !user?.uid) {
      setSaveError('Missing account information. Please sign out and sign back in.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);

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

      if (preselectedProjectId) {
        navigate(`/projects/${preselectedProjectId}`);
      } else {
        navigate(`/projects/${data.projectId}`);
      }
    } catch (error) {
      console.error('Failed to save photo:', error);
      const message = error instanceof Error
        ? error.message
        : 'An unexpected error occurred. Please try again.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
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
        saveError={saveError}
      />
    );
  }

  // Camera action screen
  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-white font-medium">Take Photo</h1>
      </div>

      {/* Hidden inputs for web camera/gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileCapture}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={false}
        className="hidden"
        onChange={handleFileCapture}
      />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center mb-6">
          <CameraIcon className="h-12 w-12 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2 text-center">
          Capture a Photo
        </h2>
        <p className="text-sm text-slate-400 text-center max-w-[300px] mb-8">
          Take a photo using your device camera or choose from your gallery.
        </p>

        {/* Primary action: Take Photo */}
        <button
          onClick={handleTakePhoto}
          className="w-full max-w-[280px] h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base flex items-center justify-center gap-3 transition-colors mb-3"
        >
          <CameraIcon className="h-5 w-5" />
          Open Camera
        </button>

        {/* Secondary: Gallery */}
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="w-full max-w-[280px] h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <ImageIcon className="h-4 w-4" />
          Choose from Gallery
        </button>
      </div>

      {/* Cancel at bottom */}
      <div className="px-6 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-full h-10 text-slate-400 hover:text-white text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
