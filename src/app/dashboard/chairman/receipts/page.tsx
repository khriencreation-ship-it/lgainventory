'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye
} from 'lucide-react';
import Link from 'next/link';

interface ReceiptRow {
  id: string;
  reference_number: string;
  payment_status: 'partially_paid' | 'paid';
  total_bill_amount: number;
  total_amount_paid: number;
  outstanding_balance: number;
  last_payment_date: string;
  last_payment_method: 'flutterwave' | 'bank_transfer' | null;
  generated_by: string;
  demand_bill_reference: string;
  demand_bill_id: string;
  client_name: string;
  client_id: string;
}

interface Officer {
  id: string;
  name: string;
}

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ChairmanReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState('last_payment_date'); // last_payment_date | total_amount_paid | payment_status
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Summary tallies
  const [summary, setSummary] = useState({ totalCollected: 0, totalOutstanding: 0 });

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all | partially_paid | paid
  const [officerId, setOfficerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active filter values used for fetching
  const [activeSearch, setActiveSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeOfficerId, setActiveOfficerId] = useState('');
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/chairman/receipts?page=${page}&limit=10&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
      if (activeStatus !== 'all') url += `&status=${activeStatus}`;
      if (activeOfficerId) url += `&officerId=${activeOfficerId}`;
      if (activeStartDate) url += `&startDate=${activeStartDate}`;
      if (activeEndDate) url += `&endDate=${activeEndDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load receipts ledger');
      const data = await res.json();

      setReceipts(data.receipts);
      setOfficers(data.officers);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, activeSearch, activeStatus, activeOfficerId, activeStartDate, activeEndDate]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
    setActiveStatus(status);
    setActiveOfficerId(officerId);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setOfficerId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActiveSearch('');
    setActiveStatus('all');
    setActiveOfficerId('');
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

  const getDisplayStatus = (status: 'partially_paid' | 'paid') => {
    if (status === 'paid') {
      return { label: 'Fully Paid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    }
    return { label: 'Partially Paid', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
  };

  // Exports
  const getExportData = async () => {
    let url = `/api/chairman/receipts?all=true&sortField=${sortField}&sortOrder=${sortOrder}`;
    if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
    if (activeStatus !== 'all') url += `&status=${activeStatus}`;
    if (activeOfficerId) url += `&officerId=${activeOfficerId}`;
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
      const list: ReceiptRow[] = data.receipts;

      const headers = [
        'Receipt Reference Number',
        'Demand Bill Reference',
        'Client Name',
        'Total Bill Amount (NGN)',
        'Total Paid (NGN)',
        'Outstanding Balance (NGN)',
        'Status',
        'Last Payment Date',
        'Last Payment Method',
        'Generated By'
      ];

      const rows = list.map(r => {
        const displayStatus = getDisplayStatus(r.payment_status).label;
        const lastDate = r.last_payment_date ? new Date(r.last_payment_date).toISOString().split('T')[0] : 'N/A';
        const lastMethod = r.last_payment_method === 'flutterwave' ? 'Online' : 'Manual';

        return [
          r.reference_number,
          r.demand_bill_reference,
          r.client_name,
          r.total_bill_amount,
          r.total_amount_paid,
          r.outstanding_balance,
          displayStatus,
          lastDate,
          lastMethod,
          r.generated_by
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute('href', urlBlob);
      link.setAttribute('download', `receipts_report_${new Date().toISOString().split('T')[0]}.csv`);
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
      const list: ReceiptRow[] = data.receipts;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Receipts Export</title>
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
            <h1 class="header-title">Receipts Directory</h1>
            <div class="header-sub">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Local Government platform</div>
            <table>
              <thead>
                <tr>
                  <th>Receipt Ref</th>
                  <th>Bill Ref</th>
                  <th>Client Name</th>
                  <th>Bill Amount</th>
                  <th>Total Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Last Payment Date</th>
                  <th>Last Payment Method</th>
                  <th>Generated By</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(r => {
                  const displayStatus = getDisplayStatus(r.payment_status).label;
                  const lastDate = r.last_payment_date ? formatDate(r.last_payment_date) : 'N/A';
                  const lastMethod = r.last_payment_method === 'flutterwave' ? 'Online' : 'Manual';

                  return `
                    <tr>
                      <td style="font-weight:700;">${r.reference_number}</td>
                      <td>${r.demand_bill_reference}</td>
                      <td style="font-weight:700;color:#0f172a;">${r.client_name}</td>
                      <td>₦${r.total_bill_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="font-weight:700;color:#10b981;">₦${r.total_amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="font-weight:700;color:${r.outstanding_balance > 0 ? '#e11d48' : '#10b981'};">₦${r.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td style="text-transform:uppercase;font-weight:700;">${displayStatus}</td>
                      <td>${lastDate}</td>
                      <td>${lastMethod}</td>
                      <td>${r.generated_by}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            <div class="summary-box">
              <div class="summary-row">
                <span>Total Receipts:</span>
                <strong>${data.pagination.totalCount}</strong>
              </div>
              <div class="summary-row">
                <span>Total Collected:</span>
                <strong style="color:#10b981;">₦${data.summary.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="summary-row total">
                <span>Outstanding Balance:</span>
                <strong style="color:${data.summary.totalOutstanding > 0 ? '#e11d48' : '#10b981'};">₦${data.summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
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

  const isFiltered = activeSearch || activeStatus !== 'all' || activeOfficerId || activeStartDate || activeEndDate;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Receipts Directory</h1>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
              Read-only ledger of confirmed payment receipts within Local Government
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Receipt ref, bill ref, or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
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
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>

          {/* Generated By Officer */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Generated By Officer</label>
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

          {/* Date Picker From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Last Payment Date (From)</label>
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

          {/* Date Picker To */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Last Payment Date (To)</label>
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
        ) : receipts.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Receipt className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No receipts found</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              No receipts matched the active filters.
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
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-5">Receipt Reference</th>
                  <th className="py-3.5 px-5">Demand Bill Reference</th>
                  <th className="py-3.5 px-5">Client Name</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('total_bill_amount')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Total Bill Amount</span>
                      {renderSortIcon('total_bill_amount')}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors text-right"
                    onClick={() => handleSort('total_amount_paid')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Total Paid</span>
                      {renderSortIcon('total_amount_paid')}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors text-right"
                    onClick={() => handleSort('outstanding_balance')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Outstanding Balance</span>
                      {renderSortIcon('outstanding_balance')}
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
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('last_payment_date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Last Payment Date</span>
                      {renderSortIcon('last_payment_date')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5">Last Method</th>
                  <th className="py-3.5 px-5">Generated By</th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((row) => {
                  const displayStatus = getDisplayStatus(row.payment_status);
                  
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-805">{row.reference_number}</td>
                      <td className="py-3.5 px-5 font-extrabold text-slate-900 hover:text-indigo-650 transition-colors">
                        <Link href={`/dashboard/chairman/demand-bills/${row.demand_bill_id}`}>
                          {row.demand_bill_reference}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 font-extrabold text-slate-900 hover:text-indigo-650 transition-colors">
                        <Link href={`/dashboard/chairman/clients/${row.client_id}`}>
                          {row.client_name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-slate-500">{formatNaira(row.total_bill_amount)}</td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-emerald-700">{formatNaira(row.total_amount_paid)}</td>
                      <td className={`py-3.5 px-5 text-right font-black ${row.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-750'}`}>
                        {formatNaira(row.outstanding_balance)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-black border rounded-md uppercase tracking-wider ${displayStatus.badgeClass}`}>
                          {displayStatus.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-655">
                        {row.last_payment_date ? formatDate(row.last_payment_date) : 'N/A'}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-500 capitalize">
                        {row.last_payment_method === 'flutterwave' ? 'online' : row.last_payment_method === 'bank_transfer' ? 'manual' : '—'}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-700">{row.generated_by}</td>
                      <td className="py-3.5 px-5 text-center">
                        <Link
                          href={`/dashboard/chairman/receipts/${row.id}`}
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
                    Summary (Visible Filtered Receipts)
                  </td>
                  <td className="py-4 px-5"></td>
                  <td className="py-4 px-5 text-right text-xs font-black text-emerald-600">
                    {formatNaira(summary.totalCollected)}
                  </td>
                  <td className={`py-4 px-5 text-right text-xs font-black ${summary.totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {formatNaira(summary.totalOutstanding)}
                  </td>
                  <td colSpan={4} className="py-4 px-5 text-center text-xs font-black text-slate-650">
                    {totalCount.toLocaleString()} receipt{totalCount !== 1 ? 's' : ''} shown
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
                  <span className="font-bold text-slate-850">{totalPages}</span> ({totalCount} total receipts)
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
                              : 'bg-white text-slate-655 border-slate-200/85 hover:border-indigo-350 hover:text-indigo-655'
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
