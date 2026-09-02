import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BedDouble,
  CreditCard,
  MoreHorizontal,
  FileCheck,
  BookOpen,
  BarChart3,
  Settings,
  Bell,
  Calculator,
  HardDrive,
  X,
  Share2,
} from 'lucide-react';
import { usePG } from '../context/PGContext';

interface MobileBottomNavProps {
  onOpenInviteModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenInviteModal }) => {
  const { activeView, setActiveView, applications, notifications } = usePG();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const pendingAppsCount = applications.filter((a) => a.status === 'PENDING').length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const primaryItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'residents', label: 'Residents', icon: Users },
    { id: 'rooms', label: 'Rooms', icon: BedDouble },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  const moreItems = [
    { id: 'applications', label: 'Applications', icon: FileCheck, badge: pendingAppsCount },
    { id: 'rules', label: 'Rules & Regs', icon: BookOpen },
    { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { id: 'expenses', label: 'Monthly Calculation', icon: Calculator },
    { id: 'settings', label: 'PG Settings', icon: Settings },
  ];

  const handleSelectView = (viewId: string) => {
    setActiveView(viewId);
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* More menu drawer on mobile */}
      {showMoreMenu && (
        <div
          id="mobile-more-drawer-backdrop"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden animate-in fade-in"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            id="mobile-more-drawer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl p-5 border-t border-slate-200 shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">More Menus</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectView(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenInviteModal?.();
                }}
                className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Share2 className="w-4 h-4" /> Share Onboarding Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden pb-safe"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id && !showMoreMenu;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectView(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition ${
                  isActive ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] mt-1">{item.label}</span>
              </button>
            );
          })}

          {/* More trigger button */}
          <button
            id="mobile-more-btn"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 relative transition ${
              showMoreMenu || ['applications', 'rules', 'reports', 'notifications', 'settings'].includes(activeView)
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-1">More</span>
            {(pendingAppsCount > 0 || unreadNotifs > 0) && (
              <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-red-500"></span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
