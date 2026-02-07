import { useState } from 'react';
import {
  Link2,
  ExternalLink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Zap,
  FileText,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useIntegrations, useDisconnectIntegration, useUpdateSyncTimestamp } from '@/hooks/useIntegrations';
import JobTreadConnect from '@/components/integrations/JobTreadConnect';
import type { IntegrationProvider } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrationStatus = 'connected' | 'disconnected' | 'coming_soon';

interface IntegrationCardConfig {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  externalUrl?: string;
  comingSoon?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    id: 'jobtread',
    name: 'JobTread',
    description: 'Sync projects, photos, and tasks with JobTread',
    icon: <Link2 className="h-5 w-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows with 5000+ apps',
    icon: <Zap className="h-5 w-5 text-orange-600" />,
    iconBg: 'bg-orange-100',
    externalUrl: 'https://zapier.com',
    comingSoon: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices and payments',
    icon: <FileText className="h-5 w-5 text-green-600" />,
    iconBg: 'bg-green-100',
    comingSoon: true,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Auto-backup photos to Google Drive',
    icon: <HardDrive className="h-5 w-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
    comingSoon: true,
  },
];

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case 'connected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          Connected
        </span>
      );
    case 'disconnected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          <XCircle className="h-3 w-3" />
          Not Connected
        </span>
      );
    case 'coming_soon':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
          Coming Soon
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Integration Card
// ---------------------------------------------------------------------------

function IntegrationCard({ config }: { config: IntegrationCardConfig }) {
  const { data: integrations } = useIntegrations();
  const disconnectMutation = useDisconnectIntegration();
  const syncMutation = useUpdateSyncTimestamp();
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeIntegration = integrations?.find(
    (i) => i.provider === config.id && i.isActive,
  );

  const status: IntegrationStatus = config.comingSoon
    ? 'coming_soon'
    : activeIntegration
      ? 'connected'
      : 'disconnected';

  const lastSyncedLabel = activeIntegration?.lastSyncedAt
    ? new Date(activeIntegration.lastSyncedAt.toDate()).toLocaleString()
    : undefined;

  const handleSync = async () => {
    if (!activeIntegration) return;
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync(activeIntegration.id);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeIntegration) return;
    await disconnectMutation.mutateAsync(activeIntegration.id);
    setExpanded(false);
  };

  // JobTread has a custom connect component
  const isJobTread = config.id === 'jobtread';

  return (
    <Card>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
              config.iconBg,
            )}
          >
            {config.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{config.name}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{config.description}</p>
          </div>
        </div>

        {/* Connected state */}
        {status === 'connected' && !isJobTread && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {lastSyncedLabel && (
              <span className="mr-auto text-xs text-slate-400">
                Last synced {lastSyncedLabel}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              Disconnect
            </Button>
          </div>
        )}

        {/* JobTread connected — expandable section */}
        {status === 'connected' && isJobTread && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <span>Manage Connection</span>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {expanded && (
              <div className="mt-3">
                <JobTreadConnect />
              </div>
            )}
          </div>
        )}

        {/* JobTread disconnected — show connect component directly */}
        {status === 'disconnected' && isJobTread && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <JobTreadConnect />
          </div>
        )}

        {/* Non-JobTread disconnected */}
        {status === 'disconnected' && !isJobTread && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            {config.externalUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(config.externalUrl, '_blank', 'noopener')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Connect via {config.name}
              </Button>
            ) : (
              <Button variant="default" size="sm">
                Connect
              </Button>
            )}
          </div>
        )}

        {/* Coming soon — no action buttons */}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Integrations</h1>
        <p className="text-slate-500 text-sm">
          Connect your tools to streamline your workflow
        </p>
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {INTEGRATION_CARDS.map((config) => (
          <IntegrationCard key={config.id} config={config} />
        ))}
      </div>
    </div>
  );
}
