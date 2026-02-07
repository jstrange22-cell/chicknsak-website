import { useMemo } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useLocationHistory } from '@/hooks/useLocationTracking';
import type { LocationPoint } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LocationMapProps {
  /** Time entry ID to load location history for. */
  entryId: string;
  /** If true, shows a current-position marker (blue). */
  isLiveTracking?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Encode a polyline path using Google's Encoded Polyline Algorithm.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodePolyline(points: { lat: number; lng: number }[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeSignedNumber(lat - prevLat);
    encoded += encodeSignedNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgn = num << 1;
  if (num < 0) {
    sgn = ~sgn;
  }

  let encoded = '';
  while (sgn >= 0x20) {
    encoded += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  encoded += String.fromCharCode(sgn + 63);
  return encoded;
}

/**
 * Build a Google Maps Static API URL showing the location trail.
 * Falls back to a simple centered map if there are no path points.
 */
function buildStaticMapUrl(points: LocationPoint[], isLive: boolean): string | null {
  if (!MAPS_API_KEY || points.length === 0) return null;

  const base = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams({
    size: '600x300',
    scale: '2',
    maptype: 'roadmap',
    key: MAPS_API_KEY,
  });

  // Build the polyline path
  const coords = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const encoded = encodePolyline(coords);
  params.append('path', `enc:${encoded}|color:0x4285F4ff|weight:3`);

  // Start marker (green)
  const first = points[0];
  params.append(
    'markers',
    `color:green|label:S|${first.latitude},${first.longitude}`,
  );

  // End / current marker
  const last = points[points.length - 1];
  if (points.length > 1) {
    if (isLive) {
      params.append(
        'markers',
        `color:blue|label:C|${last.latitude},${last.longitude}`,
      );
    } else {
      params.append(
        'markers',
        `color:red|label:E|${last.latitude},${last.longitude}`,
      );
    }
  }

  return `${base}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LocationMap({ entryId, isLiveTracking = false }: LocationMapProps) {
  const { data: points, isLoading, isError } = useLocationHistory(entryId);

  const mapUrl = useMemo(() => {
    if (!points || points.length === 0) return null;
    return buildStaticMapUrl(points, isLiveTracking);
  }, [points, isLiveTracking]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading location data...</span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        Failed to load location history.
      </div>
    );
  }

  // No data state
  if (!points || points.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <MapPin className="h-4 w-4" />
        No location data recorded for this entry.
      </div>
    );
  }

  // No API key — show a text-based summary
  if (!mapUrl) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">
          Location Trail ({points.length} point{points.length !== 1 ? 's' : ''})
        </p>
        <div className="space-y-1 text-xs text-slate-500">
          <p>
            Start: {points[0].latitude.toFixed(5)}, {points[0].longitude.toFixed(5)}
          </p>
          {points.length > 1 && (
            <p>
              End: {points[points.length - 1].latitude.toFixed(5)},{' '}
              {points[points.length - 1].longitude.toFixed(5)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Map image
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <img
        src={mapUrl}
        alt="Location trail map"
        className="w-full h-auto"
        loading="lazy"
      />
      <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
        <span>
          {points.length} location point{points.length !== 1 ? 's' : ''} recorded
        </span>
        {isLiveTracking && (
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Live
          </span>
        )}
      </div>
    </div>
  );
}
