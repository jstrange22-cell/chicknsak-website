import { useState, useEffect } from 'react';
import { Building2, Camera, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Company } from '@/types';

export function CompanySettings() {
  const { profile, user, refreshProfile } = useAuthContext();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');

  // Setup form state (for creating a new company)
  const [setupName, setSetupName] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupWebsite, setSetupWebsite] = useState('');
  const [setupAddress, setSetupAddress] = useState('');

  useEffect(() => {
    async function loadCompany() {
      if (!profile?.companyId) {
        setIsLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'companies', profile.companyId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Company;
          setCompany(data);
          setName(data.name || '');
          setPhone(data.phone || '');
          setEmail(data.email || '');
          setWebsite(data.website || '');
          setAddress(data.address || '');
        }
      } catch (err) {
        console.error('Error loading company:', err);
      }
      setIsLoading(false);
    }
    loadCompany();
  }, [profile?.companyId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/${company.id}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, 'companies', company.id), {
        logoUrl: url,
        updatedAt: serverTimestamp(),
      });

      setCompany({ ...company, logoUrl: url });
    } catch (err) {
      console.error('Logo upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'companies', company.id), {
        name,
        phone,
        email,
        website,
        address,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Company save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!setupName.trim() || !user) return;
    setIsCreating(true);
    try {
      const companyRef = await addDoc(collection(db, 'companies'), {
        name: setupName.trim(),
        phone: setupPhone.trim(),
        email: setupEmail.trim(),
        website: setupWebsite.trim(),
        address: setupAddress.trim(),
        ownerId: user.uid,
        settings: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update the current user doc with the new companyId
      await updateDoc(doc(db, 'users', user.uid), {
        companyId: companyRef.id,
        updatedAt: serverTimestamp(),
      });

      // Refresh the profile in auth context so the rest of the app picks up the change
      await refreshProfile?.();

      // Load the newly created company into local state
      const snap = await getDoc(doc(db, 'companies', companyRef.id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Company;
        setCompany(data);
        setName(data.name || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setWebsite(data.website || '');
        setAddress(data.address || '');
      }
    } catch (err) {
      console.error('Error creating company:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Set Up Your Company</h3>
            <p className="text-sm text-slate-500">Create your company profile to get started.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="Enter your company name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <Input
              value={setupPhone}
              onChange={(e) => setSetupPhone(e.target.value)}
              type="tel"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input
              value={setupEmail}
              onChange={(e) => setSetupEmail(e.target.value)}
              type="email"
              placeholder="info@yourcompany.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
            <Input
              value={setupWebsite}
              onChange={(e) => setSetupWebsite(e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <Input
              value={setupAddress}
              onChange={(e) => setSetupAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
        </div>

        <Button
          onClick={handleCreateCompany}
          disabled={isCreating || !setupName.trim()}
          isLoading={isCreating}
        >
          {isCreating ? 'Creating Company...' : 'Create Company'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50">
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-slate-500" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
        <div>
          <p className="font-medium text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">StructureWorks Field</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
