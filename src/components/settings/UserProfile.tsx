import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, getInitials } from '@/lib/utils';

export function UserProfile() {
  const { user, profile } = useAuthContext();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, 'users', user.uid), {
        avatarUrl: url,
        updatedAt: serverTimestamp(),
      });

      setAvatarUrl(url);
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName,
        phone,
        jobTitle,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-medium">
              {getInitials(fullName || 'U')}
            </div>
          )}
          <label
            className={cn(
              "absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50",
              isUploading && "opacity-50"
            )}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <Camera className="w-4 h-4 text-slate-500" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
        <div>
          <p className="font-medium text-slate-900">{fullName || 'Your Name'}</p>
          <p className="text-sm text-slate-500">{profile?.email}</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <Input value={profile?.email || ''} disabled className="bg-slate-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Project Manager"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
