import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateProject } from '@/hooks/useProjects';
import type { ProjectType } from '@/types';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  addressFull: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  projectType: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const projectTypes: { value: ProjectType; label: string }[] = [
  { value: 'deck', label: 'Deck' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'new_construction', label: 'New Construction' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
];

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [isGeocoding, setIsGeocoding] = useState(false);


  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
  });

  // addressFull watch used to trigger location found indicator

  // Geocode address using Google Maps Geocoding API
  const geocodeAddress = async (address: string) => {
    if (!address) return;
    setIsGeocoding(true);
    
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.results && data.results[0]) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        
        setValue('latitude', lat);
        setValue('longitude', lng);
        setValue('addressFull', result.formatted_address);
        
        // Parse address components
        const components = result.address_components;
        const getComponent = (type: string) => 
          components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || '';
        
        setValue('addressStreet', `${getComponent('street_number')} ${getComponent('route')}`.trim());
        setValue('addressCity', getComponent('locality') || getComponent('sublocality'));
        setValue('addressState', getComponent('administrative_area_level_1'));
        setValue('addressZip', getComponent('postal_code'));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const [createError, setCreateError] = useState<string | null>(null);

  const onSubmit = async (data: ProjectForm) => {
    setCreateError(null);
    try {
      const project = await createProject.mutateAsync({
        name: data.name,
        addressFull: data.addressFull,
        addressStreet: data.addressStreet,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressZip: data.addressZip,
        latitude: data.latitude,
        longitude: data.longitude,
        customerName: data.customerName,
        customerEmail: data.customerEmail || undefined,
        customerPhone: data.customerPhone,
        projectType: data.projectType as ProjectType,
        status: 'active',
      });

      onClose();
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      setCreateError(
        error instanceof Error
          ? error.message
          : 'Failed to create project. Please try again.'
      );
    }
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen md:min-h-0 md:max-w-lg md:my-8 md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Smith Residence Deck"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Address</label>
            <div className="relative">
              <Input
                placeholder="Enter address..."
                {...register('addressFull')}
                onBlur={(e) => geocodeAddress(e.target.value)}
              />
              {isGeocoding && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
            {watch('latitude') && watch('longitude') && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <MapPin className="h-3 w-3" />
                Location found
              </div>
            )}
          </div>

          {/* Project Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Project Type</label>
            <select
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('projectType')}
            >
              <option value="">Select type...</option>
              {projectTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>


          {/* Customer Info Section */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Customer Information</h3>
            
            <div className="space-y-3">
              <Input
                placeholder="Customer name"
                {...register('customerName')}
              />
              <Input
                type="email"
                placeholder="Customer email"
                error={errors.customerEmail?.message}
                {...register('customerEmail')}
              />
              <Input
                type="tel"
                placeholder="Customer phone"
                {...register('customerPhone')}
              />
            </div>
          </div>

          {/* Error Display */}
          {createError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              isLoading={createProject.isPending}
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
