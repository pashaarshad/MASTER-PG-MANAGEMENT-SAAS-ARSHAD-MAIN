import React, { useState } from 'react';
import {
  Building2,
  User,
  Share2,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Database,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { usePG } from '../context/PGContext';

interface NavbarProps {
  onOpenInviteModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenInviteModal }) => {
  const {
    pgSettings,
    rooms,
    activeView,
    setActiveView,
    resetToDemoData,
    isDbOnline,
    isSyncing,
    lastSyncedAt,
    realtimeConnected,
    refreshData,
    setPublicPortalMode,
    logoutAdmin,
  } = usePG();

  const [showQuickMenu, setShowQuickMenu] = useState(false);

  // Total beds & occupancy
  const allBeds = rooms.flatMap((r) => r.beds);
  const occupiedBeds = allBeds.filter((b) => b.status === 'Occupied').length;
  const totalBeds = allBeds.length;
  const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & PG Title (shown on mobile, hidden on desktop where sidebar has brand) */}
          <div
            className="flex items-center gap-3 cursor-pointer md:hidden"
            onClick={() => setActiveView('dashboard')}
          >
            {pgSettings.logo ? (
              <img
                src={pgSettings.logo}
                alt={pgSettings.name}
                className="w-9 h-9 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                {pgSettings.name || 'ABC DEF PG'}
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5">{pgSettings.type} PG</p>
            </div>
          </div>

          {/* Desktop Left: Live Status & Real-Time Sync Indicator */}
          <div className="hidden md:flex items-center gap-3">
            {isDbOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Database Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Database className="w-3.5 h-3.5 text-rose-600" />
                <span>Database Disconnected</span>
              </span>
            )}

            <button
              onClick={() => refreshData(true)}
              disabled={isSyncing}
              title="Click to sync latest data from Database"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Live Sync'}</span>
            </button>

            <span className="text-xs text-slate-400 font-medium">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {pgSettings.type} PG System
            </span>
          </div>

          {/* Center / Right quick badges & actions */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Live Occupancy Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-full text-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-600 font-medium">
                {occupiedBeds}/{totalBeds} Beds
              </span>
              <span className="text-slate-400 font-mono">({occupancyPercent}%)</span>
            </div>

            {/* Quick Invite Link */}
            <button
              id="navbar-invite-btn"
              onClick={onOpenInviteModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invite Tenant</span>
            </button>

            {/* View Switcher / Quick Demo Portal */}
            <div className="relative">
              <button
                id="portal-switch-dropdown-btn"
                onClick={() => setShowQuickMenu(!showQuickMenu)}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>

              {showQuickMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={() => setShowQuickMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Role Switcher
                    </p>
                    <p className="text-xs font-bold text-slate-800">Admin Control Panel</p>
                  </div>

                  <button
                    onClick={() => {
                      setPublicPortalMode(false);
                      setActiveView('dashboard');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg flex items-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Admin Dashboard</span>
                  </button>

                  <button
                    onClick={() => setPublicPortalMode(true)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg flex items-center gap-2 transition"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    <span>Tenant Onboarding Portal</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => {
                      logoutAdmin();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out (Admin)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
