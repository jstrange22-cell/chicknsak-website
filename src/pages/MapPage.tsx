import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Map,
  MapPin,
  List,
  Loader2,
  Search,
  Building2,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Project, ProjectStatus, ProjectType } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  deck: 'Deck',
  remodel: 'Remodel',
  new_construction: 'New Construction',
  repair: 'Repair',
  inspection: 'Inspection',
  real_estate: 'Real Estate',
  other: 'Other',
};

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

// ---------------------------------------------------------------------------
// Google Maps loader
// ---------------------------------------------------------------------------

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProjectAddress(project: Project): string {
  if (project.addressFull) return project.addressFull;
  const parts = [
    project.addressStreet,
    project.addressCity,
    project.addressState,
    project.addressZip,
  ].filter(Boolean);
  return parts.join(', ') || 'No address';
}

// ---------------------------------------------------------------------------
// Project Card (sidebar)
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  isSelected,
  onClick,
}: {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[project.status];
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900 truncate">{project.name}</h4>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{getProjectAddress(project)}</p>
          {project.customerName && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{project.customerName}</p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            status.color
          )}
        >
          {status.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {project.projectType && (
          <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {PROJECT_TYPE_LABELS[project.projectType] || project.projectType}
          </span>
        )}
        {project.latitude && project.longitude && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
            <MapPin className="h-2.5 w-2.5" />
            GPS
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MapPage() {
  const { profile } = useAuthContext();

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);

  const hasApiKey = Boolean(GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY.length > 0);

  // ------ Load projects from Firestore ------
  useEffect(() => {
    if (!profile?.companyId) return;

    let cancelled = false;

    async function fetchProjects() {
      setIsLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'projects'),
          where('companyId', '==', profile!.companyId)
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
        setProjects(data);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load projects:', err);
        setError('Failed to load projects. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchProjects();
    return () => { cancelled = true; };
  }, [profile?.companyId]);

  // ------ Filtered projects ------
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesAddress = getProjectAddress(p).toLowerCase().includes(q);
        const matchesCustomer = p.customerName?.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesCustomer) return false;
      }
      return true;
    });
  }, [projects, statusFilter, searchQuery]);

  const projectsWithCoords = useMemo(
    () => filteredProjects.filter((p) => p.latitude && p.longitude),
    [filteredProjects]
  );

  // ------ Stats ------
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const p of projects) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }
    return {
      total: projects.length,
      withCoords: projects.filter((p) => p.latitude && p.longitude).length,
      active: byStatus['active'] || 0,
      completed: byStatus['completed'] || 0,
      onHold: byStatus['on_hold'] || 0,
    };
  }, [projects]);

  // ------ Initialize Google Maps ------
  const initMap = useCallback(() => {
    const gmaps = (window as any).google?.maps;
    if (!mapRef.current || !gmaps) return;

    const center = projectsWithCoords.length > 0
      ? { lat: projectsWithCoords[0].latitude!, lng: projectsWithCoords[0].longitude! }
      : { lat: 39.8283, lng: -98.5795 }; // Center of US

    const map = new gmaps.Map(mapRef.current, {
      center,
      zoom: projectsWithCoords.length > 0 ? 10 : 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    googleMapRef.current = map;
    infoWindowRef.current = new gmaps.InfoWindow();

    updateMarkers();

    // Fit bounds if multiple markers
    if (projectsWithCoords.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      projectsWithCoords.forEach((p: Project) => {
        bounds.extend({ lat: p.latitude!, lng: p.longitude! });
      });
      map.fitBounds(bounds, 60);
    }
  }, [projectsWithCoords]);

  const updateMarkers = useCallback(() => {
    const gmaps = (window as any).google?.maps;
    if (!googleMapRef.current || !gmaps) return;

    // Clear old markers
    markersRef.current.forEach((m: any) => m.setMap(null));
    markersRef.current = [];

    const map = googleMapRef.current;
    const infoWindow = infoWindowRef.current!;

    projectsWithCoords.forEach((project) => {
      const statusCfg = STATUS_CONFIG[project.status];
      const marker = new gmaps.Marker({
        position: { lat: project.latitude!, lng: project.longitude! },
        map,
        title: project.name,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: project.status === 'active' ? '#10b981' : project.status === 'completed' ? '#3b82f6' : project.status === 'on_hold' ? '#f59e0b' : '#94a3b8',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        setSelectedProjectId(project.id);
        const address = getProjectAddress(project);
        infoWindow.setContent(`
          <div style="min-width:180px;max-width:260px;padding:4px 0;">
            <h3 style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:#0f172a;">${project.name}</h3>
            <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;">${address}</p>
            <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;${
              project.status === 'active' ? 'background:#d1fae5;color:#047857;' :
              project.status === 'completed' ? 'background:#dbeafe;color:#1d4ed8;' :
              project.status === 'on_hold' ? 'background:#fef3c7;color:#b45309;' :
              'background:#f1f5f9;color:#475569;'
            }">${statusCfg.label}</span>
            ${project.customerName ? `<p style="margin:6px 0 0 0;font-size:11px;color:#94a3b8;">${project.customerName}</p>` : ''}
          </div>
        `);
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });
  }, [projectsWithCoords]);

  useEffect(() => {
    if (!hasApiKey) return;

    let cancelled = false;

    loadGoogleMaps(GOOGLE_MAPS_KEY!)
      .then(() => {
        if (cancelled) return;
        setMapLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMapError(true);
      });

    return () => { cancelled = true; };
  }, [hasApiKey]);

  useEffect(() => {
    if (mapLoaded && !isLoading) {
      initMap();
    }
  }, [mapLoaded, isLoading, initMap]);

  // Update markers when filtered projects change (after initial load)
  useEffect(() => {
    if (mapLoaded && googleMapRef.current) {
      updateMarkers();
    }
  }, [mapLoaded, updateMarkers]);

  // ------ Pan to selected project ------
  const panToProject = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
    if (googleMapRef.current && project.latitude && project.longitude) {
      googleMapRef.current.panTo({ lat: project.latitude, lng: project.longitude });
      googleMapRef.current.setZoom(15);
    }
  }, []);

  // ------ Render ------
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-48px)]">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Map</h1>
        <p className="text-slate-500 text-sm mb-6">Visualize your projects and job sites on an interactive map.</p>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-48px)]">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Map</h1>
        <p className="text-slate-500 text-sm mb-6">Visualize your projects and job sites on an interactive map.</p>
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const showMap = hasApiKey && !mapError;

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Map</h1>
          <p className="text-slate-500 text-sm">
            {stats.total} project{stats.total !== 1 ? 's' : ''} total
            {stats.withCoords > 0 && ` \u00B7 ${stats.withCoords} with coordinates`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-500">Active</p>
            <p className="text-xl font-bold text-slate-900">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-500">Completed</p>
            <p className="text-xl font-bold text-slate-900">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-500">On Hold</p>
            <p className="text-xl font-bold text-slate-900">{stats.onHold}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by name, address, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {(['all', 'active', 'completed', 'on_hold', 'archived'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s === 'all' ? 'All' : s === 'on_hold' ? 'On Hold' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 340px)' }}>
        {/* Left panel - project list */}
        <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <List className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {filteredProjects.length} Project{filteredProjects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No projects found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjectId === project.id}
                  onClick={() => panToProject(project)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel - map or fallback */}
        <div className="flex-1 min-w-0 rounded-lg overflow-hidden border border-slate-200">
          {showMap ? (
            <div ref={mapRef} className="h-full w-full" />
          ) : (
            /* Fallback: visual region grid */
            <div className="h-full w-full bg-slate-50 overflow-y-auto p-6">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="h-5 w-5 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Project Locations
                </h3>
                {!hasApiKey && (
                  <span className="text-xs text-slate-400 ml-auto">
                    Add VITE_GOOGLE_MAPS_KEY to enable map view
                  </span>
                )}
              </div>

              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Map className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">No projects to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group by state */}
                  {Object.entries(
                    filteredProjects.reduce<Record<string, Project[]>>((acc, p) => {
                      const state = p.addressState || 'Unknown';
                      if (!acc[state]) acc[state] = [];
                      acc[state].push(p);
                      return acc;
                    }, {})
                  )
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([state, stateProjects]) => (
                      <div key={state} className="rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-semibold text-slate-800">{state}</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {stateProjects.length} project{stateProjects.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {stateProjects.map((p) => {
                            const statusCfg = STATUS_CONFIG[p.status];
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                              >
                                <div
                                  className={cn('h-2 w-2 rounded-full flex-shrink-0', statusCfg.dot)}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-700 truncate">
                                    {p.name}
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {p.addressCity
                                      ? `${p.addressCity}, ${p.addressState || ''}`
                                      : getProjectAddress(p)}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0',
                                    statusCfg.color
                                  )}
                                >
                                  {statusCfg.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
