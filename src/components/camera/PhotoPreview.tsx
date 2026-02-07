import { useState } from 'react';
import { X, RotateCcw, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface PhotoPreviewProps {
  photoDataUrl: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  onRetake: () => void;
  onSave: (data: SavePhotoData) => Promise<void>;
  preselectedProjectId?: string;
}

export interface SavePhotoData {
  projectId: string;
  description: string;
  isBefore: boolean;
  isAfter: boolean;
  isInternal: boolean;
}

export function PhotoPreview({
  photoDataUrl,
  timestamp,
  latitude,
  longitude,
  onRetake,
  onSave,
  preselectedProjectId,
}: PhotoPreviewProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [isBefore, setIsBefore] = useState(false);
  const [isAfter, setIsAfter] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: projects } = useProjects();

  const handleUsePhoto = () => {
    setShowForm(true);
    // Auto-select preselected project if provided
    if (preselectedProjectId && projects) {
      const project = projects.find(p => p.id === preselectedProjectId);
      if (project) setSelectedProject(project);
    }
  };

  const handleSave = async () => {
    if (!selectedProject) return;
    
    setIsSaving(true);
    try {
      await onSave({
        projectId: selectedProject.id,
        description,
        isBefore,
        isAfter,
        isInternal,
      });
    } finally {
      setIsSaving(false);
    }
  };


  if (showForm) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Photo (smaller) */}
        <div className="relative flex-shrink-0 h-1/2 bg-black">
          <img 
            src={photoDataUrl} 
            alt="Captured" 
            className="w-full h-full object-contain"
          />
          <button
            onClick={() => setShowForm(false)}
            className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 bg-white overflow-y-auto p-4 space-y-4">
          {/* Project Selector */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Project <span className="text-red-500">*</span>
            </label>
            <button
              onClick={() => setShowProjectPicker(true)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-slate-300 bg-white text-left"
            >
              <span className={selectedProject ? 'text-slate-900' : 'text-slate-400'}>
                {selectedProject?.name || 'Select project...'}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 resize-none h-20"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setIsBefore(!isBefore); if (!isBefore) setIsAfter(false); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                isBefore 
                  ? "bg-blue-500 text-white border-blue-500" 
                  : "bg-white text-slate-600 border-slate-300"
              )}
            >
              Before
            </button>
            <button
              onClick={() => { setIsAfter(!isAfter); if (!isAfter) setIsBefore(false); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                isAfter 
                  ? "bg-emerald-500 text-white border-emerald-500" 
                  : "bg-white text-slate-600 border-slate-300"
              )}
            >
              After
            </button>
            <button
              onClick={() => setIsInternal(!isInternal)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                isInternal 
                  ? "bg-amber-500 text-white border-amber-500" 
                  : "bg-white text-slate-600 border-slate-300"
              )}
            >
              Internal Only
            </button>
          </div>

          {/* Location info */}
          {latitude && longitude && (
            <p className="text-xs text-slate-400">
              📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!selectedProject || isSaving}
            isLoading={isSaving}
            className="w-full"
          >
            Save Photo
          </Button>
        </div>


        {/* Project Picker Modal */}
        {showProjectPicker && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
            <div className="w-full bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold">Select Project</h3>
                <button onClick={() => setShowProjectPicker(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {projects?.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project);
                      setShowProjectPicker(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-3 rounded-lg mb-1",
                      selectedProject?.id === project.id 
                        ? "bg-blue-50 text-blue-600" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <p className="font-medium">{project.name}</p>
                    {project.addressCity && (
                      <p className="text-sm text-slate-500">{project.addressCity}, {project.addressState}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Initial preview (before form)
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Full photo preview */}
      <div className="flex-1 relative">
        <img 
          src={photoDataUrl} 
          alt="Captured" 
          className="w-full h-full object-contain"
        />
        
        {/* Timestamp overlay */}
        <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
          {timestamp.toLocaleTimeString()}
        </div>

        {/* Location overlay */}
        {latitude && longitude && (
          <div className="absolute bottom-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
            📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 p-4 bg-black flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onRetake} className="flex-1 bg-transparent border-white text-white hover:bg-white/10">
          <RotateCcw className="h-4 w-4 mr-2" />
          Retake
        </Button>
        <Button onClick={handleUsePhoto} className="flex-1">
          <Check className="h-4 w-4 mr-2" />
          Use Photo
        </Button>
      </div>
    </div>
  );
}
