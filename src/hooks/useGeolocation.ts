import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeolocationState {
  position: Position | null;
  isLoading: boolean;
  error: string | null;
}

export function useGeolocation(autoFetch = true) {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    isLoading: false,
    error: null,
  });

  const isNative = Capacitor.isNativePlatform();

  const getCurrentPosition = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (isNative) {
        // Use Capacitor Geolocation
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          await Geolocation.requestPermissions();
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        setState({
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          isLoading: false,
          error: null,
        });
      } else {
        // Use Web Geolocation API
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        setState({
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      }));
    }
  }, [isNative]);

  const refresh = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  useEffect(() => {
    if (autoFetch) {
      getCurrentPosition();
    }
  }, [autoFetch, getCurrentPosition]);

  return {
    ...state,
    refresh,
  };
}
