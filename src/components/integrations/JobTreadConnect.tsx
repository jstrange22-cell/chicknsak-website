import { useState, useCallback, useEffect } from 'react';
import {
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  FolderOpen,
  Tag,
  Info,
  RotateCcw,
  Trash2,
  Clock,
  Activity,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  useIntegration,
  useDisconnectIntegration,
  useUpdateSyncTimestamp,
  useSyncQueue,
} from '@/hooks/useIntegrations';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { JobTreadClient } from '@/lib/integrations/jobtread';
import { syncJobsToProjects } from '@/lib/integrations/jobtreadSync';
import { formatRelativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIREBASE_AUTH_URL =
  'https://us-central1-projectworks-8b692.cloudfunctions.net/jobtreadAuth';

/** Predefined folder options for the JobTread default folder setting. */
const FOLDER_OPTIONS = [
  { value: '', label: 'None (root level)' },
  { value: 'Photos', label: 'Photos' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Plans', label: 'Plans' },
  { value: 'Inspections', label: 'Inspections' },
  { value: 'Progress Photos', label: 'Progress Photos' },
  { value: 'Site Documentation', label: 'Site Documentation' },
] as const;

/** Numbered steps describing how the integration works. */
const SYNC_STEPS = [
  {
    title: 'Project Creation Sync',
    description:
      'Creating a project in StructureWorks automatically syncs it to JobTread as a new job with contact info, location, and GPS coordinates.',
  },
  {
    title: 'File Push to JobTread',
    description:
      'All photos, documents, and videos uploaded in StructureWorks are automatically pushed to the corresponding JobTread job files.',
  },
  {
    title: 'Edit Sync',
    description:
      'File edits such as annotations and tag changes made in StructureWorks are automatically updated in JobTread.',
  },
  {
    title: 'Tag Matching',
    description:
      'File tags sync between both systems when the tag names match, keeping your organization consistent.',
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthorizeUrl(companyId: string): string {
  return `${FIREBASE_AUTH_URL}?action=authorize&companyId=${encodeURIComponent(companyId)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JobTreadConnect() {
  const { profile } = useAuthContext();
  const integration = useIntegration('jobtread');
  const disconnectMutation = useDisconnectIntegration();
  const updateSyncTimestamp = useUpdateSyncTimestamp();
  const { data: syncQueue } = useSyncQueue();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    errors: Array<{ jobId: string; message: string }>;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Configuration state
  const [defaultFolder, setDefaultFolder] = useState<string>('');
  const [defaultFileTag, setDefaultFileTag] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const isConnected = !!integration?.isActive;

  // Hydrate local config state from the integration document
  useEffect(() => {
    if (integration?.config) {
      setDefaultFolder((integration.config.defaultFolder as string) ?? '');
      setDefaultFileTag((integration.config.defaultFileTag as string) ?? '');
    }
  }, [integration?.config]);

  // Derive last-synced label
  let lastSyncedLabel = 'Never';
  if (integration?.lastSyncedAt) {
    try {
      const date =
        typeof (integration.lastSyncedAt as any).toDate === 'function'
          ? (integration.lastSyncedAt as any).toDate()
          : new Date(integration.lastSyncedAt as unknown as string);
      lastSyncedLabel = formatRelativeTime(date);
    } catch {
      lastSyncedLabel = 'Unknown';
    }
  }

  const totalSynced = syncQueue?.completed ?? 0;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleConnect = useCallback(() => {
    if (!profile?.companyId) return;
    window.location.href = getAuthorizeUrl(profile.companyId);
  }, [profile?.companyId]);

  const handleReconnect = useCallback(() => {
    if (!profile?.companyId) return;
    window.location.href = getAuthorizeUrl(profile.companyId);
  }, [profile?.companyId]);

  const handleDisconnect = useCallback(async () => {
    if (!integration?.id) return;
    try {
      await disconnectMutation.mutateAsync(integration.id);
      setSyncResult(null);
      setSyncError(null);
    } catch (err) {
      console.error('Failed to disconnect JobTread:', err);
    }
  }, [integration?.id, disconnectMutation]);

  const handleSyncNow = useCallback(async () => {
    if (!integration?.accessToken || !profile?.companyId || !integration.id) return;

    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const client = new JobTreadClient(integration.accessToken);
      const result = await syncJobsToProjects(client, profile.companyId);
      setSyncResult(result);

      await updateSyncTimestamp.mutateAsync(integration.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred during sync';
      setSyncError(message);
      console.error('JobTread sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [integration, profile?.companyId, updateSyncTimestamp]);

  const handleSaveConfig = useCallback(async () => {
    if (!integration?.id) return;

    setIsSavingConfig(true);
    setConfigSaved(false);

    try {
      await updateDoc(doc(db, 'integrations', integration.id), {
        'config.defaultFolder': defaultFolder,
        'config.defaultFileTag': defaultFileTag,
        updatedAt: serverTimestamp(),
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save integration config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  }, [integration?.id, defaultFolder, defaultFileTag]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Link2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>JobTread</CardTitle>
              <CardDescription>
                Sync projects, photos, and documents with JobTread
              </CardDescription>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-500">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isConnected ? (
          <div className="space-y-6">
            {/* ---- Sync Statistics ---- */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Activity className="h-4 w-4" />
                Sync Statistics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Last synced:</span>
                  <span className="font-medium text-slate-700">{lastSyncedLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Items synced:</span>
                  <span className="font-medium text-slate-700">{totalSynced}</span>
                </div>
              </div>
            </div>

            {/* ---- Configuration ---- */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700">Configuration</h4>

              {/* Default Folder */}
              <div className="space-y-1.5">
                <label
                  htmlFor="jt-default-folder"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Default Folder
                </label>
                <select
                  id="jt-default-folder"
                  value={defaultFolder}
                  onChange={(e) => setDefaultFolder(e.target.value)}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {FOLDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Files pushed to JobTread will be placed in this folder by default.
                </p>
              </div>

              {/* Default File Tag */}
              <div className="space-y-1.5">
                <label
                  htmlFor="jt-default-tag"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Default File Tag
                </label>
                <Input
                  id="jt-default-tag"
                  value={defaultFileTag}
                  onChange={(e) => setDefaultFileTag(e.target.value)}
                  placeholder="e.g. StructureWorks"
                />
                <p className="text-xs text-slate-400">
                  A tag automatically applied to every file synced to JobTread.
                </p>
              </div>

              {/* Save config button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  isLoading={isSavingConfig}
                >
                  {!isSavingConfig && 'Save Configuration'}
                </Button>
                {configSaved && (
                  <span className="text-xs font-medium text-green-600">Saved</span>
                )}
              </div>
            </div>

            {/* ---- Sync result feedback ---- */}
            {syncResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <p className="font-medium">Sync complete</p>
                <p>
                  {syncResult.created} project{syncResult.created !== 1 ? 's' : ''} created,{' '}
                  {syncResult.updated} updated
                  {syncResult.errors.length > 0 && (
                    <span className="text-amber-700">
                      , {syncResult.errors.length} error
                      {syncResult.errors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* ---- Sync error feedback ---- */}
            {syncError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Sync failed</p>
                <p>{syncError}</p>
              </div>
            )}

            {/* ---- How the Integration Works ---- */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Info className="h-4 w-4" />
                How the Integration Works
              </h4>
              <ol className="space-y-3">
                {SYNC_STEPS.map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-700">{step.title}</p>
                      <p className="text-slate-500">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ---- Action buttons ---- */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={isSyncing}
                isLoading={isSyncing}
              >
                {!isSyncing && <RefreshCw className="h-4 w-4" />}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                className="border-orange-300 text-orange-600 hover:bg-orange-50 active:bg-orange-100"
              >
                <RotateCcw className="h-4 w-4" />
                Reconnect
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                isLoading={disconnectMutation.isPending}
              >
                {!disconnectMutation.isPending && <Trash2 className="h-4 w-4" />}
                Disconnect
              </Button>

              <a
                href="https://app.jobtread.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 self-center text-sm text-slate-500 transition-colors hover:text-slate-700"
              >
                Open JobTread
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          /* ---- Disconnected state ---- */
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Connect your JobTread account to automatically sync projects, push
              photos and documents, and keep file tags in sync between
              StructureWorks and JobTread.
            </p>

            {/* How the Integration Works (shown before connecting too) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Info className="h-4 w-4" />
                How the Integration Works
              </h4>
              <ol className="space-y-3">
                {SYNC_STEPS.map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-700">{step.title}</p>
                      <p className="text-slate-500">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <Button onClick={handleConnect} size="sm">
              <Link2 className="h-4 w-4" />
              Connect JobTread
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
