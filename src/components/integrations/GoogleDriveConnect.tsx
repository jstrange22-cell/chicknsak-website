import { useState } from 'react';
import {
  CheckCircle,
  Loader2,
  RefreshCw,
  HardDrive,
  ExternalLink,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useConnectIntegration, useIntegration, useDisconnectIntegration } from '@/hooks/useIntegrations';
import { testDriveConnection } from '@/lib/integrations/googleDriveSync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriveConfig {
  clientId: string;
  clientSecret: string;
  rootFolderId?: string;
  autoBackup: boolean;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GoogleDriveConnect() {
  const existingIntegration = useIntegration('google_drive');
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isConnected = !!existingIntegration?.isActive;

  const handleTestConnection = async () => {
    if (!clientId || !clientSecret) {
      setTestResult({ success: false, message: 'Client ID and Secret are required' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testDriveConnection({
        clientId,
        clientSecret,
        rootFolderId: rootFolderId || undefined,
      });

      setTestResult({
        success: result.success,
        message: result.success
          ? 'Google Drive API connection verified!'
          : result.error || 'Connection test failed',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    }
    setIsTesting(false);
  };

  const handleConnect = async () => {
    if (!clientId || !clientSecret) return;

    try {
      await connectMutation.mutateAsync({
        provider: 'google_drive',
        accessToken: clientId,
        refreshToken: clientSecret,
        config: {
          clientId,
          clientSecret,
          rootFolderId: rootFolderId || undefined,
          autoBackup: true,
        } satisfies DriveConfig,
      });
      setShowForm(false);
      setTestResult(null);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!existingIntegration) return;
    await disconnectMutation.mutateAsync(existingIntegration.id);
  };

  // ---------- Connected State ----------
  if (isConnected) {
    const config = existingIntegration?.config as unknown as DriveConfig | undefined;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
          <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-800">Google Drive Connected</p>
            <p className="text-xs text-blue-600">
              Auto-backup: {config?.autoBackup ? 'Enabled' : 'Disabled'}
              {config?.rootFolderId ? ` • Folder: ${config.rootFolderId}` : ''}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Sync Features
          </p>
          <div className="space-y-1.5">
            {[
              { label: 'Photo Backup', desc: 'Auto-upload project photos to Drive' },
              { label: 'Documents', desc: 'Sync reports and scopes to project folders' },
              { label: 'Organization', desc: 'Auto-create folders per project' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                <FolderOpen className="h-3 w-3 text-blue-500" />
                <span className="font-medium">{item.label}</span>
                <span className="text-slate-400">— {item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Disconnected State ----------
  if (!showForm) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Connect Google Drive to automatically backup project photos and documents
          to organized folders.
        </p>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => setShowForm(true)}>
            <HardDrive className="h-3.5 w-3.5" />
            Connect Google Drive
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://console.cloud.google.com/apis/library/drive.googleapis.com', '_blank', 'noopener')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            API Console
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Connection Form ----------
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Enter your Google Cloud OAuth credentials. Enable the Drive API in your
        <a
          href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline ml-1"
        >
          Google Cloud Console
        </a>.
      </p>

      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-slate-700 mb-1 block">Client ID</label>
          <Input
            type="text"
            placeholder="123456789.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 mb-1 block">Client Secret</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 mb-1 block">
            Root Folder ID <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <Input
            type="text"
            placeholder="Leave blank to use root"
            value={rootFolderId}
            onChange={(e) => setRootFolderId(e.target.value)}
            className="text-sm"
          />
          <p className="text-[10px] text-slate-400 mt-0.5">
            Specify a Drive folder ID where all project folders will be created.
          </p>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border p-2.5 text-xs',
            testResult.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700',
          )}
        >
          {testResult.success ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting || !clientId || !clientSecret}
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Test Connection
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleConnect}
          disabled={connectMutation.isPending || !clientId || !clientSecret}
        >
          {connectMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Save & Connect
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
