import React from 'react';
import {
  LayoutGrid,
  BedDouble,
  Users,
  FileText,
  CreditCard,
  BookOpen,
  BarChart2,
  Bell,
  Calculator,
  Settings,
  HardDrive,
  Share2,
  LogOut,
} from 'lucide-react';
import { usePG } from '../context/PGContext';

interface DesktopSidebarProps {
  onOpenInviteModal?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ onOpenInviteModal }) => {
  const {
    activeView,
    setActiveView,
    applications,
    notifications,
    totalStorageMb,
    pgSettings,
    logoutAdmin,
  } = usePG();

  const pendingAppsCount = applications.filter((a) => a.status === 'PENDING').length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const navItems: { id: string; label: string; icon: React.FC<any>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'rooms', label: 'Rooms & Beds', icon: BedDouble },
    { id: 'residents', label: 'Residents', icon: Users },
    { id: 'applications', label: 'Applications', icon: FileText, badge: pendingAppsCount },
    { id: 'payments', label: 'Fees & Payments', icon: CreditCard },
    { id: 'rules', label: 'Rules & Regulations', icon: BookOpen },
    { id: 'reports', label: 'Reports & Export', icon: BarChart2 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { id: 'expenses', label: 'Monthly Calculation', icon: Calculator },
    { id: 'settings', label: 'PG Settings', icon: Settings },
  ];

  return (
    <aside
      id="main-desktop-sidebar"
      className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-screen sticky top-0 h-screen shrink-0 z-20 select-none"
    >
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div
          className="cursor-pointer flex items-center gap-3"
          onClick={() => setActiveView('dashboard')}
        >
          {pgSettings.logo ? (
            <img
              src={pgSettings.logo}
              alt={pgSettings.name}
              className="w-8 h-8 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shrink-0"
            />
          ) : null}
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none truncate max-w-[170px]">
              {pgSettings.name || 'ABC DEF PG'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Management Portal</p>
          </div>
        </div>
      </div>

      {/* Top Invite Button (as shown in user design) */}
      <div className="px-4 pt-3.5 pb-1">
        <button
          id="sidebar-top-invite-btn"
          onClick={onOpenInviteModal}
          className="w-full py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>+ Invite New Resident</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#edf5ff] text-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600 stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 ? (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Storage & Quick Logout at Bottom */}
      <div className="p-3 border-t border-slate-100 bg-white space-y-2">
        <div
          onClick={() => setActiveView('settings')}
          className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-2.5 border border-slate-200/70 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Storage Quota</span>
            </span>
            <span className="font-semibold text-slate-900">
              {totalStorageMb}/{pgSettings.storageLimitMb || 500} MB
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  (totalStorageMb / (pgSettings.storageLimitMb || 500)) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        <button
          onClick={logoutAdmin}
          className="w-full py-2 px-3 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
          title="Sign out of admin portal"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
