import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, RefreshCwIcon } from 'lucide-react';
import { fetchSemanticProfile, upsertSemanticMappings } from '../services/semanticService';

interface SemanticReviewPanelProps {
  schemaContext: string;
  sourceId?: string;
}

const CONFIDENCE_AUTO_APPLY = 0.85;

const SemanticReviewPanel: React.FC<SemanticReviewPanelProps> = ({ schemaContext, sourceId }) => {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!schemaContext || !schemaContext.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchSemanticProfile({ schemaContext, sourceId });
      if (result.success) {
        setProfile(result.data || null);
      } else {
        setError(result.error || 'Failed to load semantic profile.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load semantic profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [schemaContext, sourceId]);

  const proposedMappings = useMemo(() => {
    const raw = profile?.proposedMappings || [];
    return raw.filter((mapping: any) => {
      const confidence = typeof mapping.confidence === 'number' ? mapping.confidence : 0;
      return mapping.status === 'proposed' && confidence < CONFIDENCE_AUTO_APPLY;
    });
  }, [profile]);

  const handleApprove = async (mapping: any) => {
    if (!schemaContext) return;
    const term = mapping.concept;
    if (!term || !mapping.table || !mapping.column) return;
    setIsApplying(`${mapping.table}:${term}`);
    try {
      await upsertSemanticMappings({
        schemaContext,
        sourceId,
        table: mapping.table,
        mappings: {
          [term]: mapping.column
        }
      });
      await loadProfile();
    } catch {
      setError('Failed to apply mapping.');
    } finally {
      setIsApplying(null);
    }
  };

  const handleApproveAll = async () => {
    if (!schemaContext || proposedMappings.length === 0) return;
    setIsApplying('all');
    try {
      for (const mapping of proposedMappings) {
        const term = mapping.concept;
        if (!term || !mapping.table || !mapping.column) continue;
        await upsertSemanticMappings({
          schemaContext,
          sourceId,
          table: mapping.table,
          mappings: {
            [term]: mapping.column
          }
        });
      }
      await loadProfile();
    } catch {
      setError('Failed to apply mappings.');
    } finally {
      setIsApplying(null);
    }
  };

  const autoAppliedCount = profile?.confirmedMappings?.filter((m: any) => m.source === 'agent')?.length || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Semantic Review</h4>
          <p className="text-xs text-slate-500 mt-1">Approve low-confidence mappings before they are applied.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProfile}
            className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black flex items-center gap-2"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
          {proposedMappings.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={isApplying === 'all'}
              className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Approve All
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-xs font-semibold text-red-600 mb-3">{error}</div>}

      <div className="text-xs text-slate-500 mb-3">
        Auto-applied (confidence ≥ {CONFIDENCE_AUTO_APPLY}): <span className="font-bold text-slate-900">{autoAppliedCount}</span>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-400 italic">Loading semantic mappings...</div>
      ) : proposedMappings.length === 0 ? (
        <div className="text-xs text-slate-400 italic">No pending mappings to review.</div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
          {proposedMappings.map((mapping: any, idx: number) => {
            const term = mapping.concept || 'term';
            return (
              <div key={`${mapping.table}-${term}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">{mapping.table}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{term} → {mapping.column}</p>
                  <p className="text-[10px] text-slate-400">Confidence: {Math.round((mapping.confidence || 0) * 100)}%</p>
                </div>
                <button
                  onClick={() => handleApprove(mapping)}
                  disabled={isApplying === `${mapping.table}:${term}`}
                  className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2 shrink-0"
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  Approve
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SemanticReviewPanel;
