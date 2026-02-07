import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  flashMode: 'off' | 'on' | 'auto';
}

interface CapturedPhoto {
  dataUrl: string;
  blob: Blob;
  timestamp: Date;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    isActive: false,
    isLoading: false,
    error: null,
    facingMode: 'environment',
    flashMode: 'off',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Start camera stream (web only)
  const startWebCamera = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: state.facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState(prev => ({ ...prev, isActive: true, isLoading: false }));
    } catch (error) {
      console.error('Camera error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to access camera',
      }));
    }
  }, [state.facingMode]);


  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Capture photo (web)
  const captureWebPhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Convert to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return {
      dataUrl,
      blob,
      timestamp: new Date(),
    };
  }, []);

  // Capture photo (native)
  const captureNativePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (!photo.dataUrl) return null;

      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();

      return {
        dataUrl: photo.dataUrl,
        blob,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Native camera error:', error);
      return null;
    }
  }, []);

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    const newFacing = state.facingMode === 'user' ? 'environment' : 'user';
    setState(prev => ({ ...prev, facingMode: newFacing }));
    
    if (!isNative && state.isActive) {
      stopCamera();
      // Will restart with new facing mode
      setTimeout(startWebCamera, 100);
    }
  }, [state.facingMode, state.isActive, isNative, stopCamera, startWebCamera]);


  // Toggle flash
  const toggleFlash = useCallback(() => {
    const modes: Array<'off' | 'on' | 'auto'> = ['off', 'on', 'auto'];
    const currentIndex = modes.indexOf(state.flashMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setState(prev => ({ ...prev, flashMode: modes[nextIndex] }));
    
    // Apply flash to web stream if supported
    if (!isNative && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (capabilities?.torch) {
        track.applyConstraints({
          advanced: [{ torch: state.flashMode === 'on' } as MediaTrackConstraintSet]
        });
      }
    }
  }, [state.flashMode, isNative]);

  // Open camera
  const openCamera = useCallback(async () => {
    if (isNative) {
      // On native, we directly capture
      return captureNativePhoto();
    } else {
      await startWebCamera();
      return null;
    }
  }, [isNative, captureNativePhoto, startWebCamera]);

  // Capture photo (unified)
  const capturePhoto = useCallback(async () => {
    if (isNative) {
      return captureNativePhoto();
    } else {
      return captureWebPhoto();
    }
  }, [isNative, captureNativePhoto, captureWebPhoto]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    ...state,
    isNative,
    videoRef,
    canvasRef,
    openCamera,
    capturePhoto,
    stopCamera,
    switchCamera,
    toggleFlash,
  };
}
