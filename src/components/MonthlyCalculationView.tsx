import React, { useState } from 'react';
import {
  Calculator,
  Plus,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Wrench,
  Zap,
  Users,
  Sparkles,
  MoreVertical,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';

const CATEGORIES: { name: ExpenseCategory; label: string; icon: React.FC<any>; color: string; bgColor: string; borderColor: string }[] = [
  { name: 'Groceries', label: 'Groceries & Kitchen', icon: ShoppingBag, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { name: 'Maintenance', label: 'Maintenance & Repairs', icon: Wrench, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { name: 'Utilities', label: 'Electricity, Water & Wi-Fi', icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { name: 'Staff Salary', label: 'Staff & Worker Salaries', icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { name: 'Housekeeping', label: 'Cleaning & Housekeeping', icon: Sparkles, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  { name: 'Other', label: 'General & Miscellaneous', icon: MoreVertical, color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
];

export const MonthlyCalculationView: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, payments, buildings, pgSettings } = usePG();

  // Helper to format date into YYYY-MM
  const getCurrentMonthStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [viewTab, setViewTab] = useState<'EXPENSES' | 'PROFIT_LOSS' | 'YEARLY'>('EXPENSES');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<ExpenseCategory>('Groceries');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [buildingId, setBuildingId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Confirmation Delete State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Filtered Expenses by Selected Month
  const monthlyExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    const itemMonth = e.date.slice(0, 7);
    return itemMonth === selectedMonth;
  });

  const filteredExpenses = monthlyExpenses.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate Monthly Financial Totals
  const totalMonthlyExpenses = monthlyExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  // Calculate Monthly Income from Payments recorded in selected month
  const monthlyPayments = payments.filter((p) => {
    if (p.paidAt && p.paidAt.slice(0, 7) === selectedMonth) return true;
    const [year, monthNum] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    const fullBillingName = `${monthName} ${year}`;
    return p.billingMonth === fullBillingName || p.billingMonth === monthName;
  });

  const totalMonthlyIncome = monthlyPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  const netMonthlyProfit = totalMonthlyIncome - totalMonthlyExpenses;
  const profitMarginPercent = totalMonthlyIncome > 0 ? ((netMonthlyProfit / totalMonthlyIncome) * 100).toFixed(1) : '0';

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setTitle('');
    setAmount('');
    setCategory('Groceries');
    const today = new Date().toISOString().split('T')[0];
    setExpenseDate(today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`);
    setBuildingId(buildings[0]?.id || '');
    setNotes('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmount(exp.amount);
    setCategory(exp.category);
    setExpenseDate(exp.date);
    setBuildingId(exp.buildingId || buildings[0]?.id || '');
    setNotes(exp.notes || '');
    setShowAddModal(true);
  };

  // Handle Save
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0 || !expenseDate) {
      alert('Please fill in valid expense details.');
      return;
    }

    const numericAmount = Number(amount);
    const itemMonth = expenseDate.slice(0, 7);
    const selectedBld = buildings.find((b) => b.id === buildingId);

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        title: title.trim(),
        amount: numericAmount,
        category,
        date: expenseDate,
        month: itemMonth,
        buildingId,
        buildingName: selectedBld?.name,
        notes: notes.trim(),
      });
    } else {
      addExpense({
        title: title.trim(),
        amount: numericAmount,
        category,
        date: expenseDate,
        month: itemMonth,
        buildingId,
        buildingName: selectedBld?.name,
        notes: notes.trim(),
      });
    }

    setSelectedMonth(itemMonth);
    setShowAddModal(false);
  };

  // Generate Year Options for Month Picker
  const availableMonths: { value: string; label: string }[] = [];
  const currYear = new Date().getFullYear();
  for (let y = currYear; y >= currYear - 2; y--) {
    for (let m = 12; m >= 1; m--) {
      const monthStr = String(m).padStart(2, '0');
      const val = `${y}-${monthStr}`;
      const dateObj = new Date(y, m - 1, 1);
      const label = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      availableMonths.push({ value: val, label });
    }
  }

  // Selected Month Display Label
  const getSelectedMonthLabel = () => {
    const [year, monthNum] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div id="monthly-calculation-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            <span>Monthly Calculation & Expenses</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track PG operational expenses, groceries, maintenance & calculate net monthly profit
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Month Selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {m.value === getCurrentMonthStr() ? '(Current Month)' : ''}
                </option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <button
            id="add-expense-btn"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Expense</span>
          </button>
        </div>
      </div>

      {/* Main KPI Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Rent Income */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Rent Income ({getSelectedMonthLabel()})
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(totalMonthlyIncome)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">From recorded tenant payments</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Expenses ({getSelectedMonthLabel()})
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">
              {formatCurrency(totalMonthlyExpenses)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{monthlyExpenses.length} expense items recorded</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Net Profit / Margin */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between ${
            netMonthlyProfit >= 0
              ? 'bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-indigo-800'
              : 'bg-gradient-to-br from-rose-950 to-slate-900 text-white border-rose-800'
          }`}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Net Profit ({getSelectedMonthLabel()})
            </span>
            <h3 className="text-xl sm:text-2xl font-bold mt-1 flex items-center gap-1">
              {formatCurrency(netMonthlyProfit)}
            </h3>
            <p className="text-[11px] text-indigo-200/80 mt-0.5">
              Profit Margin: <span className="font-bold text-emerald-400">{profitMarginPercent}%</span>
            </p>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('EXPENSES')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              viewTab === 'EXPENSES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Expense Items ({monthlyExpenses.length})
          </button>
          <button
            onClick={() => setViewTab('PROFIT_LOSS')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              viewTab === 'PROFIT_LOSS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Profit & Loss Analysis
          </button>
          <button
            onClick={() => setViewTab('YEARLY')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              viewTab === 'YEARLY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Yearly Overview ({selectedMonth.split('-')[0]})
          </button>
        </div>
      </div>

      {/* TAB 1: EXPENSES TRACKER */}
      {viewTab === 'EXPENSES' && (
        <div className="space-y-4">
          {/* Category Quick Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div
              onClick={() => setSelectedCategory('ALL')}
              className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-[11px] font-medium text-slate-500">All Categories</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {formatCurrency(totalMonthlyExpenses)}
                </span>
              </div>
            </div>

            {CATEGORIES.map((cat) => {
              const catTotal = monthlyExpenses
                .filter((e) => e.category === cat.name)
                .reduce((acc, e) => acc + e.amount, 0);
              const isSel = selectedCategory === cat.name;

              return (
                <div
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSel
                      ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-indigo-500/20`
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`text-[11px] font-semibold truncate ${cat.color}`}>{cat.name}</span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{formatCurrency(catTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search & Expense List Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Expense Log for {getSelectedMonthLabel()}
              </h3>

              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Search expense description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="p-12 text-center">
                <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700 mb-1">No Expense Records Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  No expenses have been logged for {getSelectedMonthLabel()}. Click below to add grocery, maintenance or utility bills.
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Expense
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] uppercase font-semibold text-slate-500">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Expense Title & Notes</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Building</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredExpenses.map((exp) => {
                      const catInfo = CATEGORIES.find((c) => c.name === exp.category) || CATEGORIES[5];
                      const Icon = catInfo.icon;

                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {formatDate(exp.date)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{exp.title}</span>
                            {exp.notes && <span className="text-[11px] text-slate-400">{exp.notes}</span>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${catInfo.bgColor} ${catInfo.color} ${catInfo.borderColor}`}>
                              <Icon className="w-3 h-3" />
                              <span>{exp.category}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {exp.buildingName || pgSettings.name || 'Main PG'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(exp)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Expense"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setExpenseToDelete(exp)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS ANALYSIS */}
      {viewTab === 'PROFIT_LOSS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income vs Expenses Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>Income vs Expenses Breakdown ({getSelectedMonthLabel()})</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {monthlyPayments.length} Payments • {monthlyExpenses.length} Expenses
                </span>
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" /> Total Rent Collected
                    </span>
                    <strong className="text-emerald-700 font-bold">{formatCurrency(totalMonthlyIncome)}</strong>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-rose-700 flex items-center gap-1">
                      <ArrowDownRight className="w-4 h-4 text-rose-600" /> Total Expenses Incurred
                    </span>
                    <strong className="text-rose-700 font-bold">{formatCurrency(totalMonthlyExpenses)}</strong>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${totalMonthlyIncome > 0 ? Math.min(100, (totalMonthlyExpenses / totalMonthlyIncome) * 100) : 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-500">Net Calculated Profit</span>
                    <h4 className={`text-lg font-bold ${netMonthlyProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(netMonthlyProfit)}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-500">Profit Margin</span>
                    <h4 className="text-lg font-bold text-indigo-600">{profitMarginPercent}%</h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Expenses Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                Category Expense Share ({getSelectedMonthLabel()})
              </h3>

              <div className="space-y-3">
                {CATEGORIES.map((cat) => {
                  const catTotal = monthlyExpenses
                    .filter((e) => e.category === cat.name)
                    .reduce((acc, e) => acc + e.amount, 0);
                  const percent = totalMonthlyExpenses > 0 ? ((catTotal / totalMonthlyExpenses) * 100).toFixed(1) : '0';

                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${cat.bgColor} ${cat.borderColor} border`} />
                          {cat.label}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(catTotal)} <span className="text-[11px] font-normal text-slate-400">({percent}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: YEARLY OVERVIEW */}
      {viewTab === 'YEARLY' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Yearly Financial Summary ({selectedMonth.split('-')[0]})
              </h3>
              <p className="text-xs text-slate-500">Month-by-month income, expense and net profit ledger</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase font-semibold text-slate-500">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Rent Income (₹)</th>
                  <th className="py-3 px-4 text-right">Expenses (₹)</th>
                  <th className="py-3 px-4 text-right">Net Profit / Loss (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 12 }, (_, idx) => {
                  const monthNum = String(12 - idx).padStart(2, '0');
                  const yearStr = selectedMonth.split('-')[0];
                  const mStr = `${yearStr}-${monthNum}`;

                  const mExps = expenses.filter((e) => e.date && e.date.slice(0, 7) === mStr);
                  const mExpTotal = mExps.reduce((acc, e) => acc + e.amount, 0);

                  const mPays = payments.filter((p) => p.paidAt && p.paidAt.slice(0, 7) === mStr);
                  const mIncTotal = mPays.reduce((acc, p) => acc + p.amountPaid, 0);

                  const netProf = mIncTotal - mExpTotal;
                  const dateObj = new Date(parseInt(yearStr), 11 - idx, 1);
                  const monthName = dateObj.toLocaleString('en-US', { month: 'long' });

                  return (
                    <tr
                      key={mStr}
                      onClick={() => {
                        setSelectedMonth(mStr);
                        setViewTab('EXPENSES');
                      }}
                      className="hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {monthName} {yearStr}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatCurrency(mIncTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">
                        {formatCurrency(mExpTotal)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${netProf >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                        {formatCurrency(netProf)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${netProf >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {netProf >= 0 ? 'Profitable' : 'Loss / Deficit'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExpense ? 'Edit Expense Item' : 'Record New Expense'}
                </h3>
                <p className="text-xs text-slate-500">Log PG maintenance, grocery, or bill payments</p>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expense Title / Description *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Vegetables & Grocery, Water Tanker repair..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount Spent (₹) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    step="any"
                    placeholder="e.g. 2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date of Expense *</label>
                  <input
                    required
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Building Branch</label>
                  <select
                    value={buildingId}
                    onChange={(e) => setBuildingId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Receipt Ref (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  {editingExpense ? 'Save Changes' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Expense Record?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{expenseToDelete.title}</strong> ({formatCurrency(expenseToDelete.amount)})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
