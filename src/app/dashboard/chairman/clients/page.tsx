'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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

interface ClientRow {
  id: string;
  reference_number: string;
  full_name: string;
  phone_number: string;
  address: string;
  ward: string | null;
  created_at: string;
  added_by: string;
  total_bills: number;
  total_paid: number;
  outstanding_balance: number;
}

interface Officer {
  id: string;
  name: string;
}

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ChairmanClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState('created_at'); // created_at | total_paid | outstanding_balance
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Summary row states
  const [summary, setSummary] = useState({ totalRevenue: 0, totalOutstanding: 0 });

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active filter values used for requests
  const [activeSearch, setActiveSearch] = useState('');
  const [activeOfficerId, setActiveOfficerId] = useState('');
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/chairman/clients?page=${page}&limit=10&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
      if (activeOfficerId) url += `&officerId=${activeOfficerId}`;
      if (activeStartDate) url += `&startDate=${activeStartDate}`;
      if (activeEndDate) url += `&endDate=${activeEndDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load clients directory');
      const data = await res.json();
      
      setClients(data.clients);
      setOfficers(data.officers);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, activeSearch, activeOfficerId, activeStartDate, activeEndDate]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
    setActiveOfficerId(officerId);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
  };

  const handleClearFilters = () => {
    setSearch('');
    setOfficerId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActiveSearch('');
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
      <ArrowUp className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
    );
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Exports
  const getExportData = async () => {
    let url = `/api/chairman/clients?all=true&sortField=${sortField}&sortOrder=${sortOrder}`;
    if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
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
      const list: ClientRow[] = data.clients;

      const headers = [
        'Client Reference Number',
        'Full Name',
        'Phone Number',
        'Address',
        'Ward',
        'Added By',
        'Date Added',
        'Total Bills',
        'Total Paid (NGN)',
        'Outstanding Balance (NGN)'
      ];

      const rows = list.map(c => [
        c.reference_number,
        c.full_name,
        c.phone_number,
        c.address,
        c.ward || '',
        c.added_by,
        new Date(c.created_at).toISOString().split('T')[0],
        c.total_bills,
        c.total_paid,
        c.outstanding_balance
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute('href', urlBlob);
      link.setAttribute('download', `clients_report_${new Date().toISOString().split('T')[0]}.csv`);
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
      const list: ClientRow[] = data.clients;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Clients List Export</title>
            <style>
              body { font-family: sans-serif; padding: 24px; color: #1e293b; background-color: #ffffff; }
              .header-title { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
              .header-sub { font-size: 10px; font-weight: 700; color: #64748b; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
              th { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 800; background-color: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 9px; }
              td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #475569; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .summary-box { margin-top: 30px; float: right; width: 280px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 11px; background-color: #f8fafc; }
              .summary-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
              .summary-row.total { font-weight: 800; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 4px; color: #0f172a; font-size: 12px; }
            </style>
          </head>
          <body>
            <h1 class="header-title">Clients Directory Export</h1>
            <div class="header-sub">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Local Government platform</div>
            <table>
              <thead>
                <tr>
                  <th>Ref Number</th>
                  <th>Full Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Ward</th>
                  <th>Added By</th>
                  <th>Date Added</th>
                  <th>Bills</th>
                  <th>Total Paid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(c => `
                  <tr>
                    <td style="font-weight:700;">${c.reference_number}</td>
                    <td style="font-weight:700;color:#0f172a;">${c.full_name}</td>
                    <td>${c.phone_number}</td>
                    <td>${c.address}</td>
                    <td>${c.ward || '-'}</td>
                    <td>${c.added_by}</td>
                    <td>${formatDate(c.created_at)}</td>
                    <td style="text-align:center;">${c.total_bills}</td>
                    <td style="font-weight:700;color:#0f172a;">₦${c.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style="font-weight:700;color:#e11d48;">₦${c.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="summary-box">
              <div class="summary-row">
                <span>Total Clients Shown:</span>
                <strong>${data.pagination.totalCount}</strong>
              </div>
              <div class="summary-row">
                <span>Total Revenue Collected:</span>
                <strong style="color:#10b981;">₦${data.summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
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

  const isFiltered = activeSearch || activeOfficerId || activeStartDate || activeEndDate;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Clients Portfolio</h1>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
              Read-only index of all registered clients in Local Government
            </p>
          </div>
        </div>

        {/* Export Dropdown */}
        <div className="relative self-start sm:self-center">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer"
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
            <h3 className="font-extrabold text-slate-800 text-sm">Search &amp; Filters</h3>
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
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Search Clients</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Name, Phone, or Reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Filter by Officer */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Added By Officer</label>
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

          {/* Date Added From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Date Registered (From)</label>
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
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Date Registered (To)</label>
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
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Main clients Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No clients found</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              No clients matched the current active filters.
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
                  <th className="py-3.5 px-5">Ref Number</th>
                  <th className="py-3.5 px-5">Full Name</th>
                  <th className="py-3.5 px-5">Phone Number</th>
                  <th className="py-3.5 px-5">Ward</th>
                  <th className="py-3.5 px-5">Added By</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date Added</span>
                      {renderSortIcon('created_at')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 text-center">Bills</th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('total_paid')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Total Paid</span>
                      {renderSortIcon('total_paid')}
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('outstanding_balance')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Outstanding</span>
                      {renderSortIcon('outstanding_balance')}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-800">{client.reference_number}</td>
                    <td className="py-3.5 px-5">
                      <div className="font-extrabold text-slate-900">{client.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]" title={client.address}>
                        {client.address}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-600">{client.phone_number}</td>
                    <td className="py-3.5 px-5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {client.ward || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-650">{client.added_by}</td>
                    <td className="py-3.5 px-5 font-medium text-slate-500">{formatDate(client.created_at)}</td>
                    <td className="py-3.5 px-5 text-center font-bold text-slate-700">{client.total_bills}</td>
                    <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">{formatNaira(client.total_paid)}</td>
                    <td className="py-3.5 px-5 text-right font-extrabold text-rose-600">{formatNaira(client.outstanding_balance)}</td>
                    <td className="py-3.5 px-5 text-center">
                      <Link
                        href={`/dashboard/chairman/clients/${client.id}`}
                        className="px-3 py-1.5 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100/50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}

                {/* Summary Row */}
                <tr className="bg-slate-50/80 font-black text-slate-800 border-t border-slate-200">
                  <td colSpan={6} className="py-4 px-5 text-left text-xs uppercase tracking-wider text-slate-500 font-black">
                    Summary (Visible Filtered Clients)
                  </td>
                  <td className="py-4 px-5 text-center text-xs font-black text-slate-800">
                    {totalCount.toLocaleString()} clients
                  </td>
                  <td className="py-4 px-5 text-right text-xs font-black text-emerald-600">
                    {formatNaira(summary.totalRevenue)}
                  </td>
                  <td className="py-4 px-5 text-right text-xs font-black text-rose-600">
                    {formatNaira(summary.totalOutstanding)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold">
                  Showing page <span className="font-bold text-slate-850">{page}</span> of{' '}
                  <span className="font-bold text-slate-850">{totalPages}</span> ({totalCount} total clients)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
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
                              : 'bg-white text-slate-650 border-slate-200/85 hover:border-indigo-300 hover:text-indigo-600'
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
                    className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
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
