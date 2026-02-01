import React, { useEffect, useState } from 'react';
import { fetchUsageLimits, fetchAnalyticsSummary, fetchAuditLogs, updatePlanLimits } from '../services/usageService';

const UsageAdminPage: React.FC = () => {
  const [usageInfo, setUsageInfo] = useState<any | null>(null);
  const [analyticsInfo, setAnalyticsInfo] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('sqlmind_admin_token') || '');
  const [planUpdate, setPlanUpdate] = useState({
    planId: 'free',
    monthly_query_limit: '',
    monthly_dashboard_limit: '',
    monthly_upload_limit: ''
  });

  const loadAll = async () => {
    setError(null);
    try {
      const [usageRes, analyticsRes, auditRes] = await Promise.all([
        fetchUsageLimits(),
        fetchAnalyticsSummary(),
        fetchAuditLogs()
      ]);
      if (usageRes.success) setUsageInfo(usageRes.data);
      if (analyticsRes.success) setAnalyticsInfo(analyticsRes.data);
      if (auditRes.success) setAuditLogs(auditRes.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load usage data.');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-10 pt-8 pb-4 shrink-0">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Usage & Admin</h3>
              <p className="text-xs text-slate-500 font-medium">Track usage, audit logs, and manage plan limits.</p>
            </div>
            <button
              onClick={loadAll}
              className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black"
            >
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-10 pb-10 grid grid-cols-12 gap-8">
            {error && (
              <div className="col-span-12 text-xs text-red-600 font-semibold">{error}</div>
            )}

            <div className="col-span-12 lg:col-span-6 bg-slate-50 border border-slate-200 rounded-3xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Usage & Plan</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Queries</p>
                  <p className="text-sm font-black text-slate-900">
                    {usageInfo?.usage?.queries ?? 0} / {usageInfo?.plan?.monthly_query_limit ?? '-'}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Dashboards</p>
                  <p className="text-sm font-black text-slate-900">
                    {usageInfo?.usage?.dashboards ?? 0} / {usageInfo?.plan?.monthly_dashboard_limit ?? '-'}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Uploads</p>
                  <p className="text-sm font-black text-slate-900">
                    {usageInfo?.usage?.uploads ?? 0} / {usageInfo?.plan?.monthly_upload_limit ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Analytics Summary</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total Events</p>
                  <p className="text-sm font-black text-slate-900">{analyticsInfo?.totalEvents ?? 0}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Failures</p>
                  <p className="text-sm font-black text-slate-900">{analyticsInfo?.failureEvents ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="col-span-12 bg-white border border-slate-200 rounded-3xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Audit Logs</p>
              <div className="max-h-[260px] overflow-y-auto space-y-2 text-xs">
                {auditLogs.length === 0 ? (
                  <div className="text-slate-400 italic">No audit logs yet.</div>
                ) : (
                  auditLogs.slice(0, 50).map((log: any) => (
                    <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400">{log.action}</p>
                      <p className="text-slate-700">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-12 bg-slate-50 border border-slate-200 rounded-3xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Admin: Plan Limits</p>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Admin Token</label>
                  <input
                    type="password"
                    value={adminToken}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAdminToken(value);
                      localStorage.setItem('sqlmind_admin_token', value);
                    }}
                    placeholder="admin token"
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Plan</label>
                  <select
                    value={planUpdate.planId}
                    onChange={(e) => setPlanUpdate(prev => ({ ...prev, planId: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="team">Team</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                <input
                  value={planUpdate.monthly_query_limit}
                  onChange={(e) => setPlanUpdate(prev => ({ ...prev, monthly_query_limit: e.target.value }))}
                  placeholder="Query limit"
                  className="p-3 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  value={planUpdate.monthly_dashboard_limit}
                  onChange={(e) => setPlanUpdate(prev => ({ ...prev, monthly_dashboard_limit: e.target.value }))}
                  placeholder="Dashboard limit"
                  className="p-3 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  value={planUpdate.monthly_upload_limit}
                  onChange={(e) => setPlanUpdate(prev => ({ ...prev, monthly_upload_limit: e.target.value }))}
                  placeholder="Upload limit"
                  className="p-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                onClick={async () => {
                  if (!adminToken) {
                    setError('Admin token is required.');
                    return;
                  }
                  const payload = {
                    monthly_query_limit: planUpdate.monthly_query_limit ? Number(planUpdate.monthly_query_limit) : undefined,
                    monthly_dashboard_limit: planUpdate.monthly_dashboard_limit ? Number(planUpdate.monthly_dashboard_limit) : undefined,
                    monthly_upload_limit: planUpdate.monthly_upload_limit ? Number(planUpdate.monthly_upload_limit) : undefined
                  };
                  try {
                    await updatePlanLimits(planUpdate.planId, payload, adminToken);
                    await loadAll();
                  } catch (err: any) {
                    setError(err?.message || 'Failed to update plan.');
                  }
                }}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black"
              >
                Update Plan Limits
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageAdminPage;
