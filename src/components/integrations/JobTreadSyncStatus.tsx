import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useIntegration, useSyncQueue } from '@/hooks/useIntegrations';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact dashboard widget showing the current JobTread sync status.
 *
 * Displays:
 * - Connection status indicator (green / red dot)
 * - Last sync timestamp
 * - Pending and failed sync queue counts
 */
export default function JobTreadSyncStatus() {
  const integration = useIntegration('jobtread');
  const { data: syncQueue, isLoading: isQueueLoading } = useSyncQueue();

  const isConnected = !!integration?.isActive;

  // Derive last synced display string
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

  const pendingCount = syncQueue?.pending ?? 0;
  const failedCount = syncQueue?.failed ?? 0;
  const hasIssues = failedCount > 0;
  const hasPending = pendingCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">JobTread Sync</CardTitle>
          </div>

          {/* Connection status dot */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-400'
              )}
            />
            <span className="text-xs font-medium text-slate-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!isConnected ? (
          <p className="text-sm text-slate-400">
            Connect JobTread in Settings to enable sync.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Last synced */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Last synced: {lastSyncedLabel}</span>
            </div>

            {/* Sync queue stats */}
            <div className="flex items-center gap-4">
              {/* Pending */}
              <div className="flex items-center gap-1.5 text-sm">
                {hasPending ? (
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    hasPending ? 'text-amber-600' : 'text-green-600'
                  )}
                >
                  {isQueueLoading ? '--' : pendingCount}
                </span>
                <span className="text-slate-400">pending</span>
              </div>

              {/* Failed */}
              <div className="flex items-center gap-1.5 text-sm">
                {hasIssues ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    hasIssues ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {isQueueLoading ? '--' : failedCount}
                </span>
                <span className="text-slate-400">failed</span>
              </div>
            </div>

            {/* Warning banner for failures */}
            {hasIssues && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span className="font-medium">{failedCount}</span>{' '}
                sync item{failedCount !== 1 ? 's' : ''} failed. Check the sync queue
                for details or retry the sync.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
