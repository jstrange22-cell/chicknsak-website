import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/Button';

// Google Maps types
interface GoogleMap {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  setZoom: (zoom: number) => void;
}

interface GoogleLatLngBounds {
  extend: (position: { lat: number; lng: number }) => void;
}

interface GoogleMarker {
  setMap: (map: GoogleMap | null) => void;
  addListener: (event: string, callback: () => void) => void;
}


interface ProjectMapProps {
  onCreateClick: () => void;
}

export function ProjectMap({ onCreateClick }: ProjectMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  const { data: projects, isLoading } = useProjects();

  // Load Google Maps script
  useEffect(() => {
    if ((window as any).google) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, // Center of US
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }, [isLoaded]);


  // Add markers for projects
  useEffect(() => {
    if (!mapInstanceRef.current || !projects) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new (window as any).google.maps.LatLngBounds();
    let hasValidLocations = false;

    projects.forEach((project) => {
      if (project.latitude && project.longitude) {
        hasValidLocations = true;
        const position = { lat: project.latitude, lng: project.longitude };
        bounds.extend(position);

        const marker = new (window as any).google.maps.Marker({
          position,
          map: mapInstanceRef.current!,
          title: project.name,
        });

        // Info window on click
        const infoWindow = new (window as any).google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 200px;">
              <h3 style="font-weight: 600; margin: 0 0 4px 0;">${project.name}</h3>
              <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">${project.addressFull || 'No address'}</p>
              <button 
                onclick="window.navigateToProject('${project.id}')"
                style="background: #3B82F6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;"
              >
                View Project
              </button>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current!, marker);
        });

        markersRef.current.push(marker);
      }
    });

    // Fit bounds if we have locations
    if (hasValidLocations && markersRef.current.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      if (markersRef.current.length === 1) {
        mapInstanceRef.current.setZoom(15);
      }
    }
  }, [projects, isLoaded]);

  // Global function for info window button clicks
  useEffect(() => {
    (window as any).navigateToProject = (id: string) => {
      navigate(`/projects/${id}`);
    };
    return () => {
      delete (window as any).navigateToProject;
    };
  }, [navigate]);

  if (!isLoaded || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-4">
        <MapPin className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">No projects on map</h3>
        <p className="text-slate-500 mb-4 text-center">Create a project with an address to see it here</p>
        <Button onClick={onCreateClick}>Create Project</Button>
      </div>
    );
  }

  return <div ref={mapRef} className="flex-1 w-full" />;
}
