import React from 'react';
import { HardDrive, AlertTriangle, AlertOctagon, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePG } from '../context/PGContext';

interface StorageCardProps {
  onOpenDetails?: () => void;
}

export const StorageCard: React.FC<StorageCardProps> = ({ onOpenDetails }) => {
  const { totalStorageMb, storagePercentage, storageStatus, pgSettings } = usePG();
  const maxMb = pgSettings.storageLimitMb || 500;
  const remainingMb = Math.max(0, Number((maxMb - totalStorageMb).toFixed(1)));

  let statusConfig = {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    label: 'Storage Healthy',
    barColor: 'bg-emerald-500',
  };

  if (storageStatus === 'FULL') {
    statusConfig = {
      badge: 'bg-red-50 text-red-700 border-red-200',
      icon: <AlertOctagon className="w-3.5 h-3.5 text-red-600" />,
      label: 'Storage Limit Reached',
      barColor: 'bg-red-600',
    };
  } else if (storageStatus === 'CRITICAL') {
    statusConfig = {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      label: `Only ${remainingMb} MB remaining`,
      barColor: 'bg-amber-500',
    };
  } else if (storageStatus === 'WARNING') {
    statusConfig = {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      label: 'Storage is almost full',
      barColor: 'bg-amber-400',
    };
  }

  return (
    <div
      id="dashboard-storage-card"
      onClick={onOpenDetails}
      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-slate-300 transition cursor-pointer relative group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Storage Usage</h4>
            <p className="text-xs text-slate-400">Application File Quota</p>
          </div>
        </div>

        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusConfig.badge}`}
        >
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </span>
      </div>

      {/* Main Metric numbers */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalStorageMb} MB</span>
          <span className="text-sm font-medium text-slate-400">/ {maxMb} MB</span>
        </div>
        <span className="text-sm font-semibold text-slate-700">{storagePercentage}% Used</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${statusConfig.barColor}`}
          style={{ width: `${Math.min(100, Math.max(2, storagePercentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{remainingMb} MB Available</span>
        <span className="text-indigo-600 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
          Manage Files <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
