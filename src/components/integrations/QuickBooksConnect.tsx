import { useState } from 'react';
import {
  CheckCircle,
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useConnectIntegration, useIntegration, useDisconnectIntegration } from '@/hooks/useIntegrations';
import { testQBOConnection } from '@/lib/integrations/quickbooksSync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QBOConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  environment: 'sandbox' | 'production';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function QuickBooksConnect() {
  const existingIntegration = useIntegration('quickbooks');
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [realmId, setRealmId] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isConnected = !!existingIntegration?.isActive;

  const handleTestConnection = async () => {
    if (!clientId || !clientSecret || !realmId) {
      setTestResult({ success: false, message: 'All fields are required' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testQBOConnection({
        clientId,
        clientSecret,
        realmId,
        environment,
      });

      setTestResult({
        success: result.success,
        message: result.success
          ? 'Connection successful! QuickBooks Online is ready.'
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
    if (!clientId || !clientSecret || !realmId) return;

    try {
      await connectMutation.mutateAsync({
        provider: 'quickbooks',
        accessToken: clientId, // Store client ID as access token for now
        refreshToken: clientSecret,
        config: {
          clientId,
          clientSecret,
          realmId,
          environment,
        } satisfies QBOConfig,
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
    const config = existingIntegration?.config as unknown as QBOConfig | undefined;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">QuickBooks Online Connected</p>
            <p className="text-xs text-green-600">
              Realm: {config?.realmId || 'N/A'} &bull; {config?.environment === 'sandbox' ? 'Sandbox' : 'Production'}
            </p>
          </div>
        </div>

        {/* Sync capabilities */}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Sync Capabilities
          </p>
          <div className="space-y-1.5">
            {[
              { label: 'Invoices', desc: 'Push estimates as QBO invoices' },
              { label: 'Payments', desc: 'Sync payment status with Payments page' },
              { label: 'Customers', desc: 'Sync project customers to QBO' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                <DollarSign className="h-3 w-3 text-green-500" />
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
          Connect QuickBooks Online to sync invoices, payments, and customers between
          ProjectWorks and QBO.
        </p>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => setShowForm(true)}>
            <FileText className="h-3.5 w-3.5" />
            Connect QuickBooks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://developer.intuit.com/app/developer/qbo/docs/get-started', '_blank', 'noopener')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            QBO Docs
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Connection Form ----------
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Enter your QuickBooks Online API credentials. You can find these in the
        <a
          href="https://developer.intuit.com/app/developer/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline ml-1"
        >
          Intuit Developer Dashboard
        </a>.
      </p>

      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-slate-700 mb-1 block">Client ID</label>
          <Input
            type="text"
            placeholder="ABc123..."
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
          <label className="text-xs font-medium text-slate-700 mb-1 block">Company ID (Realm ID)</label>
          <Input
            type="text"
            placeholder="123456789"
            value={realmId}
            onChange={(e) => setRealmId(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 mb-1 block">Environment</label>
          <div className="flex gap-2">
            <button
              onClick={() => setEnvironment('production')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                environment === 'production'
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              Production
            </button>
            <button
              onClick={() => setEnvironment('sandbox')}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                environment === 'sandbox'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              Sandbox
            </button>
          </div>
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
          disabled={isTesting || !clientId || !clientSecret || !realmId}
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
          disabled={connectMutation.isPending || !clientId || !clientSecret || !realmId}
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
