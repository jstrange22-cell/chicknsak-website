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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import JobTreadConnect from '@/components/integrations/JobTreadConnect';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrationStatus = 'connected' | 'disconnected' | 'coming_soon';

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  status: IntegrationStatus;
  lastSynced?: string;
  externalUrl?: string;
  /** When true the card body is replaced by a custom component. */
  custom?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZAPIER_URL = 'https://zapier.com';

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'jobtread',
    name: 'JobTread',
    description: 'Sync projects, photos, and tasks with JobTread',
    icon: <Link2 className="h-5 w-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
    status: 'disconnected',
    custom: true,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5,000+ apps through Zapier',
    icon: <Zap className="h-5 w-5 text-orange-600" />,
    iconBg: 'bg-orange-100',
    status: 'disconnected',
    externalUrl: ZAPIER_URL,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices and payments',
    icon: <FileText className="h-5 w-5 text-green-600" />,
    iconBg: 'bg-green-100',
    status: 'coming_soon',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Auto-backup photos to Google Drive',
    icon: <HardDrive className="h-5 w-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
    status: 'coming_soon',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
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

interface StandardCardProps {
  integration: IntegrationConfig;
  isSyncing: boolean;
  onSync: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

function StandardIntegrationCard({
  integration,
  isSyncing,
  onSync,
  onConnect,
  onDisconnect,
}: StandardCardProps) {
  const { name, description, icon, iconBg, status, lastSynced, externalUrl } =
    integration;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
              iconBg
            )}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        {/* Actions */}
        {status === 'connected' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {lastSynced && (
              <span className="mr-auto text-xs text-slate-400">
                Last synced {lastSynced}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          </div>
        )}

        {status === 'disconnected' && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            {externalUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(externalUrl, '_blank', 'noopener')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Connect via {name}
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={onConnect}>
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
// Main component
// ---------------------------------------------------------------------------

export function IntegrationSettings() {
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const handleSync = (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    // Simulate sync — replace with real sync logic.
    setTimeout(() => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  const handleConnect = (id: string) => {
    // Placeholder: wire up real OAuth / connection flow per integration.
    console.log(`Connect integration: ${id}`);
  };

  const handleDisconnect = (id: string) => {
    // Placeholder: wire up real disconnection logic.
    console.log(`Disconnect integration: ${id}`);
  };

  return (
    <section>
      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Connect your favorite tools to streamline your workflow.
        </p>
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          // JobTread has its own dedicated component.
          if (integration.custom && integration.id === 'jobtread') {
            return (
              <Card key={integration.id}>
                <CardContent className="p-4">
                  {/* Card header kept consistent with other cards */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                        integration.iconBg
                      )}
                    >
                      {integration.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {integration.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {integration.description}
                      </p>
                    </div>
                  </div>

                  {/* Delegate connection UI to JobTreadConnect */}
                  <JobTreadConnect />
                </CardContent>
              </Card>
            );
          }

          return (
            <StandardIntegrationCard
              key={integration.id}
              integration={integration}
              isSyncing={syncingIds.has(integration.id)}
              onSync={() => handleSync(integration.id)}
              onConnect={() => handleConnect(integration.id)}
              onDisconnect={() => handleDisconnect(integration.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
