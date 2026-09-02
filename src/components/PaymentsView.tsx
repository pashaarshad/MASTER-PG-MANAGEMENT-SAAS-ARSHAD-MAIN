import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  X,
  Check,
  Send,
  Bell,
  Share2,
  Copy,
  ExternalLink,
  MailCheck,
  MessageSquare,
  Loader2,
  Mail,
  RefreshCw,
  QrCode,
  Edit2,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { PaymentRecord, PaymentMethod, PaymentType } from '../types';
import { formatCurrency, formatDate, exportToCsv } from '../utils/helpers';
import { Avatar } from './Avatar';
import { api } from '../services/api';

interface PaymentsViewProps {
  initialResidentIdForPayment?: string | null;
  onClearInitialResidentId?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  initialResidentIdForPayment,
  onClearInitialResidentId,
}) => {
  const { residents, payments, recordPayment, pgSettings, addNotification, logAudit } = usePG() as any;

  const [activeTab, setActiveTab] = useState<'DUES' | 'HISTORY'>('DUES');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notification Modal State (Mail auto-triggered, WhatsApp manual share)
  const [notifyingResidentData, setNotifyingResidentData] = useState<{
    resident: any;
    monthlyRent: number;
    amountPaid: number;
    remainingDue: number;
  } | null>(null);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);
  const [customMsgNotes, setCustomMsgNotes] = useState<string>('');
  const [customWaPhone, setCustomWaPhone] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customUpiId, setCustomUpiId] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [showUpiEdit, setShowUpiEdit] = useState<boolean>(false);
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailFeedback, setEmailFeedback] = useState<string>('');

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(Boolean(initialResidentIdForPayment));
  const [selectedResidentId, setSelectedResidentId] = useState<string>(
    initialResidentIdForPayment || residents[0]?.id || ''
  );
  const [billingMonth, setBillingMonth] = useState<string>('August 2026');
  const [paymentType, setPaymentType] = useState<PaymentType>('Rent');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [txnRef, setTxnRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showDeskQr, setShowDeskQr] = useState<boolean>(true);
  const [copiedDeskUpi, setCopiedDeskUpi] = useState<boolean>(false);

  const currentMonth = 'August 2026';
  const activeResidents = residents.filter((r) => r.status === 'ACTIVE');

  // Compute stats
  const expectedCollection = activeResidents.reduce((sum, r) => sum + r.monthlyRent, 0);
  const monthlyRentPayments = payments.filter(
    (p) => p.billingMonth === currentMonth && p.paymentType === 'Rent'
  );
  const collectedAmount = monthlyRentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalDue = Math.max(0, expectedCollection - collectedAmount);

  // Build dues roster
  const duesRoster = activeResidents.map((res) => {
    const resPayments = monthlyRentPayments.filter((p) => p.residentId === res.id);
    const paid = resPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const due = Math.max(0, res.monthlyRent - paid);
    let status: 'PAID' | 'PARTIAL' | 'DUE' = 'DUE';
    if (due === 0) status = 'PAID';
    else if (paid > 0) status = 'PARTIAL';

    return {
      resident: res,
      monthlyRent: res.monthlyRent,
      amountPaid: paid,
      remainingDue: due,
      status,
      paymentsCount: resPayments.length,
    };
  });

  // Selected resident for modal
  const targetResident = residents.find((r) => r.id === selectedResidentId) || residents[0];
  const targetMonthlyRent = targetResident?.monthlyRent || 8500;

  // Active UPI ID for Notification Modal
  const activeUpiId = (customUpiId.trim() || pgSettings?.upiId || 'srisaigentspg78@oksbi').trim();
  const notifyingDueAmount = notifyingResidentData
    ? notifyingResidentData.remainingDue > 0
      ? notifyingResidentData.remainingDue
      : notifyingResidentData.monthlyRent
    : 0;

  const notifyingUpiPayUrl = notifyingResidentData
    ? `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(
        pgSettings?.name || 'Sri Sai Gents PG'
      )}&am=${encodeURIComponent(notifyingDueAmount.toString())}&tn=${encodeURIComponent(
        `Rent ${currentMonth} - ${notifyingResidentData.resident.fullName}`
      )}&cu=INR`
    : '';

  const notifyingQrCodeUrl = notifyingUpiPayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
        notifyingUpiPayUrl
      )}`
    : '';

  // Active UPI ID for Record Payment Desk Scanner
  const deskUpiId = (pgSettings?.upiId || 'srisaigentspg78@oksbi').trim();
  const deskDueAmount = customAmount > 0 ? customAmount : targetMonthlyRent;
  const deskUpiPayUrl = `upi://pay?pa=${encodeURIComponent(deskUpiId)}&pn=${encodeURIComponent(
    pgSettings?.name || 'Sri Sai Gents PG'
  )}&am=${encodeURIComponent(deskDueAmount.toString())}&tn=${encodeURIComponent(
    `Rent ${billingMonth} - ${targetResident?.fullName || 'Resident'}`
  )}&cu=INR`;
  const deskQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
    deskUpiPayUrl
  )}`;

  // Initialize custom amount when opening modal
  const handleOpenPaymentFor = (resId: string) => {
    const res = residents.find((r) => r.id === resId);
    if (res) {
      setSelectedResidentId(resId);
      const paidAlready = monthlyRentPayments
        .filter((p) => p.residentId === res.id)
        .reduce((sum, p) => sum + p.amountPaid, 0);
      const due = Math.max(0, res.monthlyRent - paidAlready);
      setCustomAmount(due > 0 ? due : res.monthlyRent);
      setShowPaymentModal(true);
    }
  };

  const triggerEmailReminder = async (
    targetEmail: string,
    itemData: typeof notifyingResidentData,
    forcedUpiId?: string
  ) => {
    if (!itemData || !targetEmail || !targetEmail.includes('@')) {
      setEmailSendStatus('error');
      setEmailFeedback('Please provide a valid resident email address to dispatch notification.');
      return;
    }

    setEmailSendStatus('sending');
    setEmailFeedback(`Dispatching payment due notice & QR invoice to ${targetEmail}...`);

    try {
      const due = itemData.remainingDue > 0 ? itemData.remainingDue : itemData.monthlyRent;
      const upiToPass = (forcedUpiId || activeUpiId || pgSettings?.upiId || 'srisaigentspg78@oksbi').trim();

      const res = await api.sendRentDueReminder({
        residentEmail: targetEmail.trim(),
        residentName: itemData.resident.fullName,
        roomNumber: itemData.resident.roomNumber,
        bedNumber: itemData.resident.bedNumber,
        billingMonth: currentMonth,
        dueAmount: due,
        totalRent: itemData.monthlyRent,
        dueDate: '5th of this month',
        pgName: pgSettings?.name,
        pgContact: pgSettings?.contactNumber || pgSettings?.phone,
        upiId: upiToPass,
        adminEmail: pgSettings?.email,
      });

      if (res && res.success) {
        setEmailSendStatus('success');
        setEmailFeedback(
          res.message ||
            `Official rent due notice with scan-and-pay QR code for ${upiToPass} delivered to ${targetEmail}!`
        );
        if (addNotification) {
          addNotification({
            recipientType: 'TENANT',
            title: `Rent Due Notice Sent - ${itemData.resident.fullName}`,
            message: `Official invoice email with QR code (₹${due}) sent to ${targetEmail}.`,
            channel: 'EMAIL',
            type: 'PAYMENT',
          });
        }
      } else {
        setEmailSendStatus('error');
        setEmailFeedback(res?.error || 'Failed to dispatch email. Please check internet connection.');
      }
    } catch (err: any) {
      setEmailSendStatus('error');
      setEmailFeedback(err.message || 'An error occurred while sending the email.');
    }
  };

  // Open notification modal & auto-dispatch email
  const handleOpenNotify = (item: (typeof duesRoster)[0]) => {
    const data = {
      resident: item.resident,
      monthlyRent: item.monthlyRent,
      amountPaid: item.amountPaid,
      remainingDue: item.remainingDue,
    };
    setNotifyingResidentData(data);
    const emailToUse = item.resident.email || '';
    setCustomEmail(emailToUse);
    setCustomWaPhone(item.resident.mobile || '');
    setCustomUpiId(pgSettings?.upiId || 'srisaigentspg78@oksbi');
    setCustomMsgNotes('');
    setCopiedMsg(false);
    setCopiedUpi(false);
    setShowUpiEdit(false);

    // 1. Mail automatically triggers in background via API
    if (emailToUse && emailToUse.includes('@')) {
      triggerEmailReminder(emailToUse, data, pgSettings?.upiId || 'srisaigentspg78@oksbi');
    } else {
      setEmailSendStatus('idle');
      setEmailFeedback('No email on record. Enter an email below and click Send.');
    }
  };

  const getWhatsAppMessageText = () => {
    if (!notifyingResidentData) return '';
    const res = notifyingResidentData.resident;
    const dueAmt =
      notifyingResidentData.remainingDue > 0
        ? notifyingResidentData.remainingDue
        : notifyingResidentData.monthlyRent;
    const upi = activeUpiId || pgSettings?.upiId || 'srisaigentspg78@oksbi';
    const pgName = pgSettings?.name || 'Sri Sai Gents PG';

    return `Hello ${res.fullName},\n\nThis is an official rent due reminder from *${pgName}* for *${currentMonth}*.\n\n🏠 *Room & Bed:* Room ${res.roomNumber} (Bed ${res.bedNumber})\n💰 *Amount Pending:* ₹${dueAmt.toLocaleString('en-IN')}\n\n⚡ *Quick UPI ID:* ${upi}\n📲 *Direct UPI Pay Link:* ${notifyingUpiPayUrl}\n${customMsgNotes ? `📝 *Note:* ${customMsgNotes}\n` : ''}\nPlease scan the QR code or transfer to the UPI ID above, then share the UTR reference / screenshot.\n\nThank you! 🙏`;
  };

  const handleShareWhatsApp = () => {
    const rawPhone = (customWaPhone || notifyingResidentData?.resident?.mobile || '').replace(/\D/g, '');
    const phoneWithCountry = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const text = encodeURIComponent(getWhatsAppMessageText());
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${text}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(getWhatsAppMessageText());
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const handleCopyUpiId = (idToCopy: string) => {
    navigator.clipboard.writeText(idToCopy);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleCopyDeskUpiId = (idToCopy: string) => {
    navigator.clipboard.writeText(idToCopy);
    setCopiedDeskUpi(true);
    setTimeout(() => setCopiedDeskUpi(false), 2500);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResident || customAmount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      recordPayment({
        residentId: targetResident.id,
        billingMonth,
        totalDueForMonth: targetMonthlyRent,
        amountPaid: customAmount,
        paymentType,
        paymentMethod,
        transactionReference: txnRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setShowPaymentModal(false);
      setTxnRef('');
      setNotes('');
      onClearInitialResidentId?.();
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Payment ID',
      'Resident ID',
      'Resident Name',
      'Room',
      'Bed',
      'Billing Month',
      'Type',
      'Amount Paid',
      'Remaining Balance',
      'Method',
      'Status',
      'Transaction Ref',
      'Date',
    ];

    const rows = payments.map((p) => [
      p.id,
      p.residentId,
      p.residentName,
      p.roomNumber,
      p.bedNumber,
      p.billingMonth,
      p.paymentType,
      p.amountPaid,
      p.remainingBalance,
      p.paymentMethod,
      p.status,
      p.transactionReference || '',
      formatDate(p.paidAt),
    ]);

    exportToCsv(`abc_def_pg_payments_${Date.now()}`, headers, rows);
  };

  return (
    <div id="payments-view-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fees & Payments
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Full, partial & custom payment collection for {currentMonth}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-payments-csv-btn"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-2xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            id="record-payment-btn"
            onClick={() => {
              const firstDue = duesRoster.find((d) => d.status !== 'PAID');
              if (firstDue) handleOpenPaymentFor(firstDue.resident.id);
              else if (residents[0]) handleOpenPaymentFor(residents[0].id);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Payment</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Expected Rent ({currentMonth})
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
            {formatCurrency(expectedCollection)}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">{activeResidents.length} active residents</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-1">
            Collected Amount
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-emerald-700">
            {formatCurrency(collectedAmount)}
          </span>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">
            {expectedCollection > 0 ? Math.round((collectedAmount / expectedCollection) * 100) : 0}% cleared
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block mb-1">
            Total Outstanding Due
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-rose-700">
            {formatCurrency(totalDue)}
          </span>
          <p className="text-[11px] text-rose-600 mt-1 font-medium">
            {duesRoster.filter((d) => d.remainingDue > 0).length} residents pending
          </p>
        </div>
      </div>

      {/* Tabs: Dues Roster vs History */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('DUES')}
            className={`py-1.5 px-4 rounded-lg text-xs font-semibold transition ${
              activeTab === 'DUES'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Resident Dues ({duesRoster.filter((d) => d.remainingDue > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-1.5 px-4 rounded-lg text-xs font-semibold transition ${
              activeTab === 'HISTORY'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Payment History Ledger ({payments.length})
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search resident or txn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Tab Content: Dues Roster */}
      {activeTab === 'DUES' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Resident</th>
                  <th className="p-3.5">Room & Bed</th>
                  <th className="p-3.5">Monthly Fee</th>
                  <th className="p-3.5">Paid So Far</th>
                  <th className="p-3.5">Balance Due</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duesRoster
                  .filter((d) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      d.resident.fullName.toLowerCase().includes(q) ||
                      d.resident.roomNumber.toLowerCase().includes(q) ||
                      d.resident.id.toLowerCase().includes(q)
                    );
                  })
                  .map((item) => (
                    <tr key={item.resident.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={item.resident.photoUrl}
                            name={item.resident.fullName}
                            size="xs"
                          />
                          <div>
                            <p className="font-semibold text-slate-800">{item.resident.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.resident.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-700">
                        Room {item.resident.roomNumber} • Bed {item.resident.bedNumber}
                      </td>

                      <td className="p-3.5 font-bold text-slate-800">
                        {formatCurrency(item.monthlyRent)}
                      </td>

                      <td className="p-3.5 font-medium text-emerald-700">
                        {formatCurrency(item.amountPaid)}
                      </td>

                      <td className="p-3.5 font-bold text-rose-600">
                        {formatCurrency(item.remainingDue)}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.status === 'PAID'
                            ? 'Paid'
                            : item.status === 'PARTIAL'
                            ? 'Partially Paid'
                            : 'Unpaid / Due'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenNotify(item)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-xs transition flex items-center gap-1 border border-emerald-200"
                            title="Send Notification (Mail & WhatsApp)"
                          >
                            <Send className="w-3 h-3 text-emerald-600" />
                            <span>Notify</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentFor(item.resident.id)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition"
                          >
                            {item.status === 'PAID' ? 'Record Extra' : 'Collect Fee'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab Content: History Ledger */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Payment ID</th>
                  <th className="p-3.5">Resident</th>
                  <th className="p-3.5">Billing Month</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount Paid</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments
                  .filter((p) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.residentName.toLowerCase().includes(q) ||
                      p.id.toLowerCase().includes(q) ||
                      (p.transactionReference && p.transactionReference.toLowerCase().includes(q))
                    );
                  })
                  .map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{payment.id}</td>

                      <td className="p-3.5 font-medium text-slate-800">
                        <div>
                          <p>{payment.residentName}</p>
                          <p className="text-[10px] text-slate-400">
                            Room {payment.roomNumber} ({payment.bedNumber})
                          </p>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-700">{payment.billingMonth}</td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {payment.paymentType}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-emerald-700 text-sm">
                        {formatCurrency(payment.amountPaid)}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700">
                          {payment.paymentMethod}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-500">{formatDate(payment.paidAt)}</td>

                      <td className="p-3.5 text-slate-500 font-mono text-[11px] max-w-xs truncate">
                        {payment.transactionReference || payment.notes || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal (Supports Full, Partial, or Custom Amount) */}
      {showPaymentModal && targetResident && (
        <div
          id="record-payment-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200/60">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Fee Payment</h3>
                <p className="text-xs text-slate-500">Supports Full, Partial & Custom Amounts</p>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              {/* Resident selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Resident</label>
                <select
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                >
                  {activeResidents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName} — Room {r.roomNumber} ({r.bedNumber}) • {formatCurrency(r.monthlyRent)}/mo
                    </option>
                  ))}
                </select>
              </div>

              {/* Billing Month & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Billing Period</label>
                  <select
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="August 2026">August 2026</option>
                    <option value="September 2026">September 2026</option>
                    <option value="October 2026">October 2026</option>
                    <option value="Security Deposit">Security Deposit</option>
                    <option value="Maintenance / Other">Maintenance / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Category</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Rent">Monthly Rent</option>
                    <option value="Security Deposit">Security Deposit</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other Charge</option>
                  </select>
                </div>
              </div>

              {/* Fee Breakdown Box with Dynamic Remaining calculation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Standard Monthly Fee:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(targetMonthlyRent)}</span>
                </div>

                {/* Amount Received Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Amount Received (₹)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={customAmount === 0 ? '' : customAmount}
                      onChange={(e) => setCustomAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-base text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomAmount(targetMonthlyRent)}
                    className="flex-1 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700"
                  >
                    Full ({formatCurrency(targetMonthlyRent)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomAmount(Math.round(targetMonthlyRent / 2))}
                    className="flex-1 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700"
                  >
                    Half ({formatCurrency(Math.round(targetMonthlyRent / 2))})
                  </button>
                </div>

                {/* Remaining Balance Indicator */}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600">Remaining Balance:</span>
                  <span
                    className={`font-bold ${
                      Math.max(0, targetMonthlyRent - customAmount) === 0
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                    }`}
                  >
                    {Math.max(0, targetMonthlyRent - customAmount) === 0
                      ? '₹0 (Paid in Full ✓)'
                      : formatCurrency(Math.max(0, targetMonthlyRent - customAmount))}
                  </span>
                </div>
              </div>

              {/* Payment Method & Ref */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    UPI Ref / Txn ID (Optional)
                  </label>
                  <input
                    placeholder="e.g. UPI-9812401"
                    value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Desk UPI QR Code for instant scanning when method is UPI */}
              {paymentMethod === 'UPI' && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Desk Collection UPI QR (₹{formatCurrency(deskDueAmount)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeskQr(!showDeskQr)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      {showDeskQr ? 'Hide QR' : 'Show QR'}
                    </button>
                  </div>

                  {showDeskQr && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs shrink-0">
                        <img
                          src={deskQrCodeUrl}
                          alt="Desk UPI QR"
                          className="w-20 h-20 rounded"
                        />
                      </div>
                      <div className="space-y-1 text-xs flex-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">UPI ID</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 text-[11px] truncate">
                            {deskUpiId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyDeskUpiId(deskUpiId)}
                            className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-600 shrink-0"
                            title="Copy UPI ID"
                          >
                            {copiedDeskUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">Scan with GPay / PhonePe / Paytm to pay instantly</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Note (Optional)</label>
                <input
                  placeholder="e.g. Balance promised by 20th August"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Save & Send Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fee Notification Modal (Mail Automatic + WhatsApp Direct Share) */}
      {notifyingResidentData && (
        <div
          id="fee-notification-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[92vh] flex flex-col">
            <button
              onClick={() => setNotifyingResidentData(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Send Payment Notification</h3>
                <p className="text-xs text-slate-500">
                  {notifyingResidentData.resident.fullName} • Room {notifyingResidentData.resident.roomNumber} (Bed {notifyingResidentData.resident.bedNumber})
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
              {/* Mail Auto-Sent / Dispatch Status Box */}
              <div
                className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                  emailSendStatus === 'sending'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : emailSendStatus === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {emailSendStatus === 'sending' ? (
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : emailSendStatus === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <MailCheck className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>
                      {emailSendStatus === 'sending'
                        ? 'Dispatching Official Email...'
                        : emailSendStatus === 'error'
                        ? 'Email Dispatch Failed'
                        : 'Official Email Notification Sent'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                    SMTP / Resend
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed">
                  {emailFeedback || `The rent invoice, payment instructions, and dynamic QR code have been dispatched to ${customEmail || notifyingResidentData.resident.email}.`}
                </p>

                {/* Email address field & Resend button */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="resident@gmail.com"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={emailSendStatus === 'sending'}
                    onClick={() => triggerEmailReminder(customEmail, notifyingResidentData, activeUpiId)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition shrink-0"
                  >
                    {emailSendStatus === 'sending' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{emailSendStatus === 'error' ? 'Retry Email' : 'Resend Email'}</span>
                  </button>
                </div>
              </div>

              {/* Resident Summary Banner */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Monthly Rent</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(notifyingResidentData.monthlyRent)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Amount Due</span>
                  <span className="font-bold text-rose-600 text-sm">
                    {formatCurrency(notifyingDueAmount)}
                  </span>
                </div>
              </div>

              {/* Quick UPI Scan & Pay QR Code Card with Visible UPI ID Below */}
              <div className="p-4 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-slate-50 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>Instant UPI Scan & Pay QR</span>
                        <span className="text-[9px] font-semibold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded-full">
                          Auto-Generated
                        </span>
                      </h4>
                      <p className="text-[10px] text-emerald-700">
                        Encoded with exact due amount: <strong>{formatCurrency(notifyingDueAmount)}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUpiEdit(!showUpiEdit)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-lg border border-emerald-200 hover:bg-white transition"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{showUpiEdit ? 'Hide Edit' : 'Edit UPI ID'}</span>
                  </button>
                </div>

                {/* Optional UPI ID override field */}
                {showUpiEdit && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-1 text-xs">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      UPI ID for this Payment Notice
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customUpiId}
                        onChange={(e) => setCustomUpiId(e.target.value)}
                        placeholder="e.g. srisaigentspg78@oksbi"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowUpiEdit(false);
                          if (customEmail && customEmail.includes('@')) {
                            triggerEmailReminder(customEmail, notifyingResidentData, customUpiId);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                      >
                        Update QR
                      </button>
                    </div>
                  </div>
                )}

                {/* Centered QR Code and Prominently Visible UPI ID Card */}
                <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  {/* QR Image with scanner frame styling */}
                  <div className="relative p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs shrink-0 group">
                    <img
                      src={notifyingQrCodeUrl}
                      alt={`UPI QR Code - ${activeUpiId}`}
                      className="w-32 h-32 rounded-lg object-contain"
                    />
                    {/* Visual scan corner highlights */}
                    <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-600 rounded-tl-sm pointer-events-none" />
                    <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-600 rounded-tr-sm pointer-events-none" />
                    <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-600 rounded-bl-sm pointer-events-none" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-600 rounded-br-sm pointer-events-none" />
                  </div>

                  {/* Payment Details & Prominently Visible UPI ID */}
                  <div className="flex-1 space-y-2 w-full">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Scan & Pay Direct to UPI ID
                      </span>

                      {/* Prominent UPI ID Box with 1-click Copy */}
                      <div className="mt-1 flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {activeUpiId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyUpiId(activeUpiId)}
                          className="px-2 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition flex items-center gap-1 shrink-0 shadow-2xs"
                        >
                          {copiedUpi ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Amount & Supported Apps Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-700">Amount:</span>
                        <span className="font-bold text-rose-600">{formatCurrency(notifyingDueAmount)}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-600">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">GPay</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">PhonePe</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">Paytm</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">BHIM</span>
                      </div>
                    </div>

                    {/* Direct Mobile UPI App Payment Link */}
                    <div className="pt-1">
                      <a
                        href={notifyingUpiPayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tap to Pay in UPI App (Mobile)</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Notification Section */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Share on WhatsApp</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">Direct Chat</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">WhatsApp Mobile Number</label>
                  <input
                    type="tel"
                    value={customWaPhone}
                    onChange={(e) => setCustomWaPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Custom Note (Optional)</label>
                  <input
                    type="text"
                    value={customMsgNotes}
                    onChange={(e) => setCustomMsgNotes(e.target.value)}
                    placeholder="e.g. Please pay before 10th to avoid late fee"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600">WhatsApp Message Preview</label>
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {copiedMsg ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Text</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto border border-slate-800">
                    {getWhatsAppMessageText()}
                  </pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNotifyingResidentData(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Open WhatsApp & Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
