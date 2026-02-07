import { useState, useEffect } from 'react';
import { MapPin, Shield, ShieldOff, Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Project, Geofence } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GeofenceSetupProps {
  project: Project;
  onSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeofenceSetup({ project, onSaved }: GeofenceSetupProps) {
  const [radius, setRadius] = useState<string>(
    String(project.geofence?.radiusMeters ?? 200),
  );
  const [isEnabled, setIsEnabled] = useState(project.geofence?.isEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset success message after 3 seconds.
  useEffect(() => {
    if (!saveSuccess) return;
    const t = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [saveSuccess]);

  const hasCoordinates = project.latitude != null && project.longitude != null;

  const handleSave = async () => {
    if (!hasCoordinates) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const radiusMeters = Math.max(50, Math.min(5000, parseInt(radius, 10) || 200));

      const geofence: Geofence = {
        latitude: project.latitude!,
        longitude: project.longitude!,
        radiusMeters,
        isEnabled,
      };

      await updateDoc(doc(db, 'projects', project.id), {
        geofence,
        updatedAt: serverTimestamp(),
      });

      setSaveSuccess(true);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save geofence:', err);
      setSaveError('Failed to save geofence settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Project has no coordinates — cannot configure a geofence.
  if (!hasCoordinates) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No project coordinates
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Add a project address with GPS coordinates before configuring a geofence.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Shield className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-slate-400" />
          )}
          <h4 className="text-sm font-semibold text-slate-800">Geofence</h4>
        </div>

        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => setIsEnabled((v) => !v)}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
            border-2 border-transparent transition-colors duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            ${isEnabled ? 'bg-emerald-500' : 'bg-slate-200'}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full
              bg-white shadow ring-0 transition duration-200
              ${isEnabled ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>

      {/* Coordinates display */}
      <div className="text-xs text-slate-500">
        Center: {project.latitude!.toFixed(5)}, {project.longitude!.toFixed(5)}
      </div>

      {/* Radius input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Radius (meters)
        </label>
        <Input
          type="number"
          min="50"
          max="5000"
          step="50"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="200"
        />
        <p className="mt-1 text-xs text-slate-400">
          Workers must clock in within this distance of the project location (50 – 5,000m).
        </p>
      </div>

      {/* Visual radius indicator */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span
            className={`
              absolute rounded-full border-2 border-dashed
              ${isEnabled ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}
            `}
            style={{
              width: `${Math.min(80, Math.max(32, (parseInt(radius, 10) || 200) / 30))}px`,
              height: `${Math.min(80, Math.max(32, (parseInt(radius, 10) || 200) / 30))}px`,
            }}
          />
          <MapPin
            className={`relative h-4 w-4 ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}
          />
        </div>
        <span className="text-xs text-slate-500">
          {parseInt(radius, 10) || 200}m radius
          {isEnabled ? ' (active)' : ' (disabled)'}
        </span>
      </div>

      {/* Error / success */}
      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}
      {saveSuccess && (
        <p className="text-sm text-emerald-600">Geofence settings saved.</p>
      )}

      {/* Save button */}
      <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Geofence Settings'
        )}
      </Button>
    </div>
  );
}
