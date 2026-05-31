'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Loader2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface DemandBillRow {
  id: string;
  reference_number: string;
  client_name: string;
  client_id: string;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  levy_items: { name: string; category_name?: string }[];
  payment_status: 'paid' | 'unpaid' | 'partially_paid';
  due_date: string;
  created_at: string;
  generated_by: string;
}

interface Officer {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Client {
  id: string;
  full_name: string;
  reference_number: string;
}

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ChairmanDemandBillsPage() {
  const [bills, setBills] = useState<DemandBillRow[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState('created_at'); // created_at | grand_total | payment_status | balance_due
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Summary tallies
  const [summary, setSummary] = useState({ totalBilled: 0, totalCollected: 0, totalOutstanding: 0 });

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all | paid | partially_paid | not_paid | overdue
  const [officerId, setOfficerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active filter values used for fetching
  const [activeSearch, setActiveSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeOfficerId, setActiveOfficerId] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [activeClientId, setActiveClientId] = useState('');
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/chairman/demand-bills?page=${page}&limit=10&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
      if (activeStatus !== 'all') url += `&status=${activeStatus}`;
      if (activeOfficerId) url += `&officerId=${activeOfficerId}`;
      if (activeCategoryId) url += `&categoryId=${activeCategoryId}`;
      if (activeClientId) url += `&clientId=${activeClientId}`;
      if (activeStartDate) url += `&startDate=${activeStartDate}`;
      if (activeEndDate) url += `&endDate=${activeEndDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load demand bills ledger');
      const data = await res.json();

      setBills(data.bills);
      setOfficers(data.officers);
      setCategories(data.categories);
      if (data.clients) {
        setClients(data.clients);
      }
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, activeSearch, activeStatus, activeOfficerId, activeCategoryId, activeClientId, activeStartDate, activeEndDate]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
    setActiveStatus(status);
    setActiveOfficerId(officerId);
    setActiveCategoryId(categoryId);
    setActiveClientId(clientId);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setOfficerId('');
    setCategoryId('');
    setClientId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActiveSearch('');
    setActiveStatus('all');
    setActiveOfficerId('');
    setActiveCategoryId('');
    setActiveClientId('');
    setActiveStartDate('');
    setActiveEndDate('');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 shrink-0" />;
    }
    return sortOrder === 'ASC' ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-650 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-650 shrink-0" />
    );
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Status mapping
  const getBillStatus = (bill: DemandBillRow) => {
    if (bill.payment_status === 'paid') return 'paid';
    if (bill.payment_status === 'partially_paid') return 'partially_paid';
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(23, 59, 59, 999);
    if (new Date() > dueDate) return 'overdue';
    return 'unpaid'; // Not Paid
  };

  const getDisplayStatus = (billStatus: string) => {
    if (billStatus === 'paid') {
      return { label: 'Paid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    }
    if (billStatus === 'partially_paid') {
      return { label: 'Partially Paid', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    }
    if (billStatus === 'overdue') {
      return { label: 'Overdue', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    return { label: 'Not Paid', badgeClass: 'bg-rose-50 text-rose-700 border-rose-100' };
  };

  // Exports
  const getExportData = async () => {
    let url = `/api/chairman/demand-bills?all=true&sortField=${sortField}&sortOrder=${sortOrder}`;
    if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
    if (activeStatus !== 'all') url += `&status=${activeStatus}`;
    if (activeOfficerId) url += `&officerId=${activeOfficerId}`;
    if (activeCategoryId) url += `&categoryId=${activeCategoryId}`;
    if (activeClientId) url += `&clientId=${activeClientId}`;
    if (activeStartDate) url += `&startDate=${activeStartDate}`;
    if (activeEndDate) url += `&endDate=${activeEndDate}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Export failed');
    return await res.json();
  };

  const exportToCSV = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await getExportData();
      const list: DemandBillRow[] = data.bills;

      const headers = [
        'Bill Reference Number',
        'Client Name',
        'Levy Categories',
        'Total Amount (NGN)',
        'Amount Paid (NGN)',
        'Balance Due (NGN)',
        'Status',
        'Due Date',
        'Generated By',
        'Date Generated'
      ];

      const rows = list.map(b => {
        const billStatus = getBillStatus(b);
        const displayStatus = getDisplayStatus(billStatus).label;
        const uniqueCats = b.levy_items
          ? Array.from(new Set(b.levy_items.map(item => item.category_name || 'General Levy'))).join('; ')
          : 'General Levy';

        return [
          b.reference_number,
          b.client_name,
          uniqueCats,
          b.grand_total,
          b.amount_paid,
          b.balance_due,
          displayStatus,
          b.due_date.split('T')[0],
          b.generated_by,
          new Date(b.created_at).toISOString().split('T')[0]
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute('href', urlBlob);
      link.setAttribute('download', `demand_bills_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await getExportData();
      const list: DemandBillRow[] = data.bills;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Demand Bills Export</title>
            <style>
              body { font-family: sans-serif; padding: 24px; color: #1e293b; background-color: #ffffff; }
              .header-title { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
              .header-sub { font-size: 10px; font-weight: 700; color: #64748b; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px; }
              table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 10px; }
              th { border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: 800; background-color: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 8px; }
              td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; color: #475569; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .summary-box { margin-top: 30px; float: right; width: 280px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 11px; background-color: #f8fafc; }
              .summary-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
              .summary-row.total { font-weight: 800; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 4px; color: #0f172a; font-size: 12px; }
            </style>
          </head>
          <body>
            <h1 class="header-title">Demand Bills Directory</h1>
            <div class="header-sub">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Local Government platform</div>
            <table>
              <thead>
                <tr>
                  <th>Bill Ref</th>
                  <th>Client Name</th>
                  <th>Levy Categories</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Generated By</th>
                  <th>Date Generated</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(b => {
                  const billStatus = getBillStatus(b);
                  const displayStatus = getDisplayStatus(billStatus).label;
                  const uniqueCats = b.levy_items
                    ? Array.from(new Set(b.levy_items.map(item => item.category_name || 'General Levy'))).join(', ')
                    : 'General Levy';

                  return `
                    <tr>
                      <td style="font-weight:700;">${b.reference_number}</td>
                      <td style="font-weight:700;color:#0f172a;">${b.client_name}</td>
                      <td>${uniqueCats}</td>
                      <td style="font-weight:700;color:#0f172a;">₦${b.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="font-weight:700;color:#10b981;">₦${b.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="font-weight:700;color:#e11d48;">₦${b.balance_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="text-transform:uppercase;font-weight:700;">${displayStatus}</td>
                      <td>${formatDate(b.due_date)}</td>
                      <td>${b.generated_by}</td>
                      <td>${formatDate(b.created_at)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            <div class="summary-box">
              <div class="summary-row">
                <span>Total Bills:</span>
                <strong>${data.pagination.totalCount}</strong>
              </div>
              <div class="summary-row">
                <span>Total Billed:</span>
                <strong>₦${data.summary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="summary-row">
                <span>Total Collected:</span>
                <strong style="color:#10b981;">₦${data.summary.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="summary-row total">
                <span>Outstanding Balance:</span>
                <strong style="color:#e11d48;">₦${data.summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const isFiltered = activeSearch || activeStatus !== 'all' || activeOfficerId || activeCategoryId || activeClientId || activeStartDate || activeEndDate;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Demand Bills Directory</h1>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
              Read-only view of all demand notices issued within Local Government
            </p>
          </div>
        </div>

        {/* Export Button */}
        <div className="relative self-start sm:self-center">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export Data</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 py-1">
              <button
                onClick={exportToCSV}
                className="w-full px-4 py-2.5 text-xs text-slate-650 hover:bg-slate-50 flex items-center gap-2 text-left font-bold cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export as CSV
              </button>
              <button
                onClick={exportToPDF}
                className="w-full px-4 py-2.5 text-xs text-slate-650 hover:bg-slate-50 flex items-center gap-2 text-left font-bold cursor-pointer"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h3 className="font-extrabold text-slate-800 text-sm">Filters &amp; Search</h3>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-100/50 transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Bill reference or client name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Taxpayer / Client */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Taxpayer / Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.reference_number})</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="not_paid">Not Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Generated By Officer */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Generated By Officer</label>
            <select
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
            >
              <option value="">All Officers</option>
              {officers.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Levy Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Added From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Generated Date (From)</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Date Added To */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Generated Date (To)</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100/50">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-650" />
            </div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Loading ledger...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No demand bills found</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              No demand notices matched the active filters.
            </p>
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg border border-indigo-100/50 transition-all cursor-pointer inline-block"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-450 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-5">Bill Reference</th>
                  <th className="py-3.5 px-5">Client Name</th>
                  <th className="py-3.5 px-5">Levy Categories</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('grand_total')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Total Billed</span>
                      {renderSortIcon('grand_total')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 text-right">Collected</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('balance_due')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Outstanding</span>
                      {renderSortIcon('balance_due')}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                    onClick={() => handleSort('payment_status')}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>Status</span>
                      {renderSortIcon('payment_status')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5">Due Date</th>
                  <th className="py-3.5 px-5">Generated By</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date Generated</span>
                      {renderSortIcon('created_at')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill) => {
                  const billStatus = getBillStatus(bill);
                  const displayStatus = getDisplayStatus(billStatus);
                  
                  const uniqueCats = bill.levy_items
                    ? Array.from(new Set(bill.levy_items.map(item => item.category_name || 'General Levy')))
                    : ['General Levy'];

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-805">{bill.reference_number}</td>
                      <td className="py-3.5 px-5 font-extrabold text-slate-900 hover:text-indigo-650 transition-colors">
                        <Link href={`/dashboard/chairman/clients/${bill.client_id}`}>
                          {bill.client_name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap gap-1 max-w-[130px]">
                          {uniqueCats.map((cat, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">{formatNaira(bill.grand_total)}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-emerald-700">{formatNaira(bill.amount_paid)}</td>
                      <td className="py-3.5 px-5 text-right font-black text-rose-600">{formatNaira(bill.balance_due)}</td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-black border rounded-md uppercase tracking-wider ${displayStatus.badgeClass}`}>
                          {displayStatus.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {billStatus === 'overdue' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {formatDate(bill.due_date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-650">{bill.generated_by}</td>
                      <td className="py-3.5 px-5 font-medium text-slate-500">{formatDate(bill.created_at)}</td>
                      <td className="py-3.5 px-5 text-center">
                        <Link
                          href={`/dashboard/chairman/demand-bills/${bill.id}`}
                          className="px-3 py-1.5 text-[11px] font-extrabold text-indigo-650 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100/50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Row */}
                <tr className="bg-slate-50/80 font-black text-slate-800 border-t border-slate-200">
                  <td colSpan={3} className="py-4 px-5 text-left text-xs uppercase tracking-wider text-slate-500 font-black">
                    Summary (Visible Filtered Bills)
                  </td>
                  <td className="py-4 px-5 text-right text-xs font-black text-slate-800">
                    {formatNaira(summary.totalBilled)}
                  </td>
                  <td className="py-4 px-5 text-right text-xs font-black text-emerald-600">
                    {formatNaira(summary.totalCollected)}
                  </td>
                  <td className="py-4 px-5 text-right text-xs font-black text-rose-600">
                    {formatNaira(summary.totalOutstanding)}
                  </td>
                  <td colSpan={4} className="py-4 px-5 text-center text-xs font-black text-slate-650">
                    {totalCount.toLocaleString()} demand bills
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold">
                  Showing page <span className="font-bold text-slate-850">{page}</span> of{' '}
                  <span className="font-bold text-slate-850">{totalPages}</span> ({totalCount} total bills)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-slate-500 hover:text-indigo-650 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - page) <= 1) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            page === pageNum
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-650 border-slate-200/85 hover:border-indigo-350 hover:text-indigo-650'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} className="text-slate-400 text-xs px-1 select-none">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 text-slate-500 hover:text-indigo-650 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
