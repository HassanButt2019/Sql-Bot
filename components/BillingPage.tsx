import React, { useEffect, useState } from 'react';
import { createCheckoutSession, createPortalSession, getBillingStatus } from '../services/billingService';

const PLAN_OPTIONS = [
  { id: 'free', name: 'Free', description: 'Basic usage with limits', price: '$0' },
  { id: 'pro', name: 'Pro', description: 'Advanced analytics and higher limits', price: '$49' },
  { id: 'team', name: 'Team', description: 'Collaboration and admin controls', price: '$199' }
];

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ plan_id?: string; status?: string; interval?: string; current_period_end?: number; cancel_at_period_end?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getBillingStatus();
      if (res.success) {
        setStatus(res.data.subscription);
      } else {
        setError(res.error || 'Failed to load billing status.');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleCheckout = async (planId: string) => {
    setError(null);
    const res = await createCheckoutSession(planId, interval);
    if (!res.success || !res.data?.url) {
      setError(res.error || 'Failed to start checkout.');
      return;
    }
    window.location.href = res.data.url;
  };

  const handlePortal = async () => {
    setError(null);
    const res = await createPortalSession();
    if (!res.success || !res.data?.url) {
      setError(res.error || 'Failed to open billing portal.');
      return;
    }
    window.location.href = res.data.url;
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
        <div className="px-10 pt-10 pb-6 border-b border-slate-100">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Billing & Subscription</h2>
          <p className="text-sm text-slate-500 mt-2">
            Manage your plan, billing details, and subscription lifecycle.
          </p>
        </div>

        <div className="px-10 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setInterval('month')}
              className={`px-4 py-2 rounded-full text-xs font-semibold border ${interval === 'month' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`px-4 py-2 rounded-full text-xs font-semibold border ${interval === 'year' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              Yearly
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading billing status…</p>
          ) : (
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Current plan: <span className="font-semibold text-slate-900">{status?.plan_id || 'free'}</span>
                {status?.status ? ` • ${status.status}` : ''}
              </p>
              {status?.current_period_end && (
                <p className="text-xs text-slate-400 mt-1">
                  Renews on {new Date(status.current_period_end * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLAN_OPTIONS.map(plan => (
              <div key={plan.id} className="border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                <p className="text-2xl font-black text-slate-900 mt-4">{plan.price}<span className="text-xs font-medium text-slate-400">/mo</span></p>
                <button
                  onClick={() => handleCheckout(plan.id)}
                  className="mt-4 w-full py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-black"
                  disabled={plan.id === 'free'}
                >
                  {plan.id === 'free' ? 'Included' : 'Choose Plan'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={handlePortal}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Manage in Billing Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
