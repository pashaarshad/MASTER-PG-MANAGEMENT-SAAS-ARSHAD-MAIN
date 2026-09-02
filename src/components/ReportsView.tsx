import React, { useState } from 'react';
import {
  BarChart2,
  Download,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  CreditCard,
  Users,
  BedDouble,
  CheckCircle2,
  Calendar,
  Filter,
  DollarSign,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';

export const ReportsView: React.FC = () => {
  const { residents, rooms, payments, applications, pgSettings } = usePG();
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
  const [reportType, setReportType] = useState<'all' | 'financial' | 'occupancy' | 'residents'>('all');
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Financial calculations
  const totalCollectedAllTime = payments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  
  const monthPayments = payments.filter((p) => selectedMonth === 'All' || p.billingMonth === selectedMonth);
  const totalCollectedMonth = monthPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  const totalPendingMonth = monthPayments.reduce((acc, p) => acc + (p.remainingBalance || 0), 0);

  // Bed & Occupancy calculations
  const allBeds = rooms.flatMap((r) => r.beds);
  const totalBedsCount = allBeds.length;
  const occupiedBedsCount = allBeds.filter((b) => b.status === 'Occupied').length;
  const availableBedsCount = allBeds.filter((b) => b.status === 'Available').length;
  const maintenanceBedsCount = allBeds.filter((b) => b.status === 'Maintenance').length;
  const occupancyPercentage = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0;

  // Active residents
  const activeResidents = residents.filter((r) => r.status === 'ACTIVE');
  const noticeResidents = residents.filter((r) => r.status === 'NOTICE');
  const vacatedResidents = residents.filter((r) => r.status === 'VACATED');

  // Total Security Deposit Held
  const totalDepositHeld = residents
    .filter((r) => r.status === 'ACTIVE' || r.status === 'NOTICE')
    .reduce((acc, r) => acc + (r.securityDeposit || 0), 0);

  // Payment Methods Breakdown
  const methodCounts = payments.reduce((acc, p) => {
    acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amountPaid;
    return acc;
  }, {} as Record<string, number>);

  // Sharing types occupancy
  const sharingDistribution = rooms.reduce((acc, room) => {
    const occInRoom = room.beds.filter((b) => b.status === 'Occupied').length;
    acc[room.sharingType] = (acc[room.sharingType] || { total: 0, occupied: 0 });
    acc[room.sharingType].total += room.capacity;
    acc[room.sharingType].occupied += occInRoom;
    return acc;
  }, {} as Record<string, { total: number; occupied: number }>);

  // CSV Export Utility
  const downloadCSV = (filename: string, rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportFeedback(`Exported ${filename} successfully!`);
    setTimeout(() => setExportFeedback(null), 4000);
  };

  // 1. Export Payments Ledger
  const handleExportPayments = () => {
    const headers = [
      'Payment ID',
      'Resident Name',
      'Room & Bed',
      'Billing Month',
      'Payment Type',
      'Amount Paid (INR)',
      'Remaining Balance (INR)',
      'Payment Method',
      'Status',
      'Transaction Ref',
      'Paid Date',
      'Notes',
    ];
    const rows = payments.map((p) => [
      p.id,
      p.residentName,
      `${p.roomNumber}-${p.bedNumber}`,
      p.billingMonth,
      p.paymentType,
      p.amountPaid.toString(),
      p.remainingBalance.toString(),
      p.paymentMethod,
      p.status,
      p.transactionReference || '-',
      formatDateTime(p.paidAt),
      p.notes || '',
    ]);
    downloadCSV(`pg_payments_ledger_${Date.now()}.csv`, [headers, ...rows]);
  };

  // 2. Export Residents Directory
  const handleExportResidents = () => {
    const headers = [
      'Resident ID',
      'Full Name',
      'Mobile',
      'Email',
      'Gender',
      'Room Number',
      'Bed Number',
      'Sharing Type',
      'Monthly Rent (INR)',
      'Security Deposit (INR)',
      'Status',
      'Move-in Date',
      'Permanent Address',
      'Emergency Contact Name',
      'Emergency Contact Phone',
    ];
    const rows = residents.map((r) => [
      r.id,
      r.fullName,
      r.mobile,
      r.email,
      r.gender,
      r.roomNumber,
      r.bedNumber,
      r.sharingType,
      r.monthlyRent.toString(),
      r.securityDeposit.toString(),
      r.status,
      r.moveInDate,
      r.permanentAddress,
      r.emergencyContact.name,
      r.emergencyContact.phone,
    ]);
    downloadCSV(`pg_residents_directory_${Date.now()}.csv`, [headers, ...rows]);
  };

  // 3. Export Room & Bed Matrix
  const handleExportRooms = () => {
    const headers = [
      'Room Number',
      'Sharing Type',
      'Capacity',
      'Base Rent (INR)',
      'Bed Number',
      'Bed Status',
      'Occupant ID',
      'Occupant Name',
    ];
    const rows: string[][] = [];
    rooms.forEach((room) => {
      room.beds.forEach((bed) => {
        rows.push([
          room.roomNumber,
          room.sharingType,
          room.capacity.toString(),
          room.baseRent.toString(),
          bed.bedNumber,
          bed.status,
          bed.residentId || '-',
          bed.residentName || '-',
        ]);
      });
    });
    downloadCSV(`pg_rooms_and_beds_${Date.now()}.csv`, [headers, ...rows]);
  };

  // 4. Export Applications Log
  const handleExportApplications = () => {
    const headers = [
      'Application ID',
      'Applicant Name',
      'Mobile',
      'Email',
      'Gender',
      'Occupation',
      'Status',
      'Aadhaar Masked',
      'Submitted At',
      'Rejection Reason',
    ];
    const rows = applications.map((a) => [
      a.id,
      a.fullName,
      a.mobile,
      a.email,
      a.gender,
      a.occupation,
      a.status,
      a.aadharNumberMasked,
      formatDateTime(a.submittedAt),
      a.rejectionReason || a.correctionNote || '-',
    ]);
    downloadCSV(`pg_tenant_applications_${Date.now()}.csv`, [headers, ...rows]);
  };

  // Print Statement Handler
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial performance, occupancy metrics, and comprehensive data export
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="August 2026">August 2026</option>
              <option value="July 2026">July 2026</option>
              <option value="June 2026">June 2026</option>
              <option value="All">All Time</option>
            </select>
          </div>

          <button
            onClick={handlePrintSummary}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Export Feedback Toast */}
      {exportFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportFeedback}</span>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Revenue ({selectedMonth})</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(totalCollectedMonth)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            All-time collected: <span className="font-semibold text-slate-600">{formatCurrency(totalCollectedAllTime)}</span>
          </p>
        </div>

        {/* Total Outstanding Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Pending Dues ({selectedMonth})</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 tracking-tight">
            {formatCurrency(totalPendingMonth)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Across active PG residents
          </p>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Bed Occupancy Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-blue-600 tracking-tight">
              {occupancyPercentage}%
            </p>
            <span className="text-xs text-slate-500">({occupiedBedsCount}/{totalBedsCount} Beds)</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${occupancyPercentage}%` }} />
          </div>
        </div>

        {/* Security Deposits Held */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Security Deposits Held</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-700 tracking-tight">
            {formatCurrency(totalDepositHeld)}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Refundable deposits under management
          </p>
        </div>
      </div>

      {/* 1-Click Export Center */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">1-Click Data Export Center</h2>
            <p className="text-xs text-slate-500">Download formatted CSV reports for accounting, compliance, and backups</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
            CSV & Spreadsheet Ready
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Export Payments */}
          <div className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Payments Ledger</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Full transaction history with method, references, dues & balances.
            </p>
            <button
              onClick={handleExportPayments}
              className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Export Residents */}
          <div className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Residents Directory</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Active & notice tenants, contacts, rent rates, and room allocations.
            </p>
            <button
              onClick={handleExportResidents}
              className="w-full mt-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Export Rooms & Beds */}
          <div className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <BedDouble className="w-4 h-4 text-purple-600" />
              <span>Rooms & Beds Matrix</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Room-wise capacity, sharing types, occupancy status, and base rents.
            </p>
            <button
              onClick={handleExportRooms}
              className="w-full mt-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Export Applications */}
          <div className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Applications Log</span>
            </div>
            <p className="text-[11px] text-slate-500">
              New submissions, pending approvals, and KYC onboarding audits.
            </p>
            <button
              onClick={handleExportApplications}
              className="w-full mt-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Channels Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Payment Methods Breakdown
            </h3>
            <span className="text-xs text-slate-500 font-medium">All Time</span>
          </div>

          <div className="space-y-3">
            {Object.entries(methodCounts).map(([method, amount]) => {
              const pct = totalCollectedAllTime > 0 ? Math.round((amount / totalCollectedAllTime) * 100) : 0;
              return (
                <div key={method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{method}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {formatCurrency(amount)} <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        method === 'UPI'
                          ? 'bg-emerald-500'
                          : method === 'Bank Transfer'
                          ? 'bg-blue-500'
                          : method === 'Cash'
                          ? 'bg-amber-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sharing Type Occupancy Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Occupancy by Sharing Type
            </h3>
            <span className="text-xs text-slate-500 font-medium">{occupiedBedsCount} Beds Occupied</span>
          </div>

          <div className="space-y-3">
            {Object.entries(sharingDistribution).map(([type, stats]) => {
              const rate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{type}</span>
                    <span className="font-mono text-slate-900">
                      {stats.occupied} / {stats.total} beds ({rate}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
