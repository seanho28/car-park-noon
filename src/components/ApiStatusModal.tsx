import React from 'react';
import { CheckCircle2, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import { getConfiguredAdaptersStatus } from '../config/apiConfig';

interface ApiStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMode: 'LIVE_DATA_GOV_SG' | 'FALLBACK_SNAPSHOT';
  totalHdbPolledCount: number;
  liveHdbMatchedCount: number;
  apiTimestamp: string;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const ApiStatusModal: React.FC<ApiStatusModalProps> = ({
  isOpen,
  onClose,
  sourceMode,
  totalHdbPolledCount,
  liveHdbMatchedCount,
  apiTimestamp,
  onManualRefresh,
  isRefreshing,
}) => {
  if (!isOpen) return null;

  const { ltaDataMall: hasLtaKey, uraSpace: hasUraKey } =
    getConfiguredAdaptersStatus();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Singapore Carpark Data Feeds &amp; API Readiness
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Frontend adapters are pre-wired for Singapore government transport datasets. Add your LTA DataMall or URA keys into environment secrets anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          {/* 1. Data.gov.sg HDB Feed */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-900">
                  Data.gov.sg — HDB Carpark Availability API
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Public keyless endpoint polling real-time HDB Electronic Parking System (EPS) gantry counters across Singapore every 60 seconds.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1 tabular-nums">
                Status:{' '}
                {sourceMode === 'LIVE_DATA_GOV_SG'
                  ? `Active (${totalHdbPolledCount.toLocaleString()} islandwide HDB carparks polled, ${liveHdbMatchedCount} directory stations synced)`
                  : 'Offline Snapshot Mode'}
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-700 whitespace-nowrap">
              Connected
            </span>
          </div>

          {/* 2. LTA DataMall Carpark Availability v2 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hasLtaKey ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-900">
                  LTA DataMall — Commercial &amp; Orchard/Marina Malls
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Tracks major commercial shopping malls (ION Orchard, Suntec City, Marina Bay Sands, Ngee Ann City, VivoCity). Reads from{' '}
                <code className="font-mono text-[11px] bg-slate-200/70 px-1 py-0.5 rounded">
                  VITE_LTA_DATAMALL_API_KEY
                </code>
                .
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-amber-700 whitespace-nowrap">
              {hasLtaKey ? 'Key Configured' : 'Ready for Key'}
            </span>
          </div>

          {/* 3. URA Car Park Available Lots API */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hasUraKey ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-900">
                  URA Space — Off-Street &amp; Curbside Parking Lots
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Covers URA heritage precincts (Club Street, Armenian Street, Tiong Bahru). Reads from{' '}
                <code className="font-mono text-[11px] bg-slate-200/70 px-1 py-0.5 rounded">
                  VITE_URA_ACCESS_KEY
                </code>
                .
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-amber-700 whitespace-nowrap">
              {hasUraKey ? 'Key Configured' : 'Ready for Key'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            Last sync: {new Date(apiTimestamp).toLocaleTimeString('en-SG')} SGT
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>Poll Data.gov.sg Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
