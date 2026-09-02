import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  FileText,
  Megaphone,
  HardDrive,
  Send,
  Trash2,
  ExternalLink,
  Plus,
  X,
  Filter,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { formatDateTime } from '../utils/helpers';
import { NotificationItem } from '../types';

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    addNotification,
    triggerPaymentReminders,
    setActiveView,
    residents,
  } = usePG();

  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'APPLICATION' | 'PAYMENT' | 'ANNOUNCEMENT'>('ALL');
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastChannel, setBroadcastChannel] = useState<'IN_APP' | 'WHATSAPP' | 'EMAIL'>('IN_APP');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'UNREAD') return !n.read;
    if (activeTab === 'APPLICATION') return n.type === 'APPLICATION' || n.type === 'APPROVAL';
    if (activeTab === 'PAYMENT') return n.type === 'PAYMENT_DUE' || n.type === 'PAYMENT_RECORDED';
    if (activeTab === 'ANNOUNCEMENT') return n.type === 'ANNOUNCEMENT';
    return true;
  });

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    addNotification({
      recipientType: 'ADMIN',
      title: `[Announcement] ${broadcastTitle.trim()}`,
      message: broadcastMessage.trim(),
      channel: broadcastChannel,
      type: 'ANNOUNCEMENT',
    });

    setBroadcastSuccess(`Broadcast sent to all residents via ${broadcastChannel}!`);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setShowBroadcastModal(false);
    setTimeout(() => setBroadcastSuccess(null), 4000);
  };

  const handleTriggerReminders = () => {
    const count = triggerPaymentReminders();
    setReminderToast(`Triggered automated rent reminder notifications to ${count} residents with pending dues!`);
    setTimeout(() => setReminderToast(null), 4000);
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'APPLICATION':
      case 'APPROVAL':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'PAYMENT_DUE':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'PAYMENT_RECORDED':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'STORAGE_ALERT':
        return <HardDrive className="w-4 h-4 text-rose-600" />;
      case 'ANNOUNCEMENT':
      default:
        return <Megaphone className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center relative shrink-0">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications & Broadcasts</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live alerts for applications, payment transactions, and tenant broadcasts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerReminders}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold rounded-xl text-xs transition active:scale-95 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Broadcast Rent Due Alerts</span>
          </button>

          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Announcement</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition active:scale-95 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Feedback Toasts */}
      {broadcastSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{broadcastSuccess}</span>
        </div>
      )}
      {reminderToast && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>{reminderToast}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        {[
          { id: 'ALL', label: 'All Alerts', count: notifications.length },
          { id: 'UNREAD', label: 'Unread', count: unreadCount },
          { id: 'APPLICATION', label: 'Applications', count: notifications.filter((n) => n.type === 'APPLICATION' || n.type === 'APPROVAL').length },
          { id: 'PAYMENT', label: 'Payments', count: notifications.filter((n) => n.type === 'PAYMENT_DUE' || n.type === 'PAYMENT_RECORDED').length },
          { id: 'ANNOUNCEMENT', label: 'Announcements', count: notifications.filter((n) => n.type === 'ANNOUNCEMENT').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                activeTab === tab.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Notification Items List */}
      <div className="space-y-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-400 mt-1">
              You are completely up to date.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (!item.read) markNotificationAsRead(item.id);
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                item.read
                  ? 'bg-white border-slate-200/80 hover:bg-slate-50/70'
                  : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50/80 shadow-2xs'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    item.read ? 'bg-slate-100 text-slate-500' : 'bg-white border border-blue-200 shadow-2xs'
                  }`}
                >
                  {getNotificationIcon(item.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 leading-none">{item.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.channel}
                    </span>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{formatDateTime(item.timestamp)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {item.linkUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!item.read) markNotificationAsRead(item.id);
                      setActiveView(item.linkUrl!);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition"
                  >
                    <span>View Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                {!item.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationAsRead(item.id);
                    }}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    title="Mark as read"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Broadcast Announcement</h3>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Announcement Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. PG Water Tank Cleaning Tomorrow"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write clear instructions or notices for all PG tenants..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Broadcast Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'IN_APP', label: 'In-App Portal' },
                    { id: 'WHATSAPP', label: 'WhatsApp' },
                    { id: 'EMAIL', label: 'Email' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setBroadcastChannel(ch.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-center cursor-pointer ${
                        broadcastChannel === ch.id
                          ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
