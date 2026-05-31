'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import Toast from '@/components/Toast';

interface DemandBillRecord {
  id: string;
  reference_number: string;
  client_name: string;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  levy_items: { name: string; description: string; amount: number }[];
  payment_status: 'paid' | 'unpaid' | 'partially_paid';
  due_date: string;
  created_at: string;
}

export default function DemandBillsPage() {
  const [bills, setBills] = useState<DemandBillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'unpaid' | 'partially_paid' | 'overdue' | 'paid'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const limit = 10;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch bills
  useEffect(() => {
    async function fetchBills() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          search: debouncedSearch,
          status: statusTab,
          page: String(currentPage),
          limit: String(limit)
        });

        const res = await fetch(`/api/officer/demand-bills?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch demand bills');
        }

        setBills(data.bills || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      } catch (err: any) {
        setToastType('error');
        setToastMessage(err.message || 'Failed to retrieve demand bills.');
      } finally {
        setLoading(false);
      }
    }

    fetchBills();
  }, [debouncedSearch, statusTab, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Status mapping logic
  const getDisplayStatus = (paymentStatus: string, dueDateStr: string) => {
    if (paymentStatus === 'paid') {
      return { label: 'Paid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    }
    if (paymentStatus === 'partially_paid') {
      return { label: 'Partially Paid', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    }
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(23, 59, 59, 999);
    const today = new Date();
    if (today > dueDate) {
      return { label: 'Overdue', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    return { label: 'Not Paid', badgeClass: 'bg-rose-50 text-rose-700 border-rose-100' };
  };

  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const tabs: { key: typeof statusTab; label: string }[] = [
    { key: 'all', label: 'All Bills' },
    { key: 'unpaid', label: 'Not Paid' },
    { key: 'partially_paid', label: 'Partially Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'paid', label: 'Paid' }
  ];

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link 
            href="/dashboard/officer" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <p className="text-xs text-slate-400 font-medium">Create, track, and manage all demand notices issued under your LG.</p>
        </div>
        
        <Link
          href="/dashboard/officer/demand-bills/new"
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Demand Bill</span>
        </Link>
      </div>

      {/* Filter Tabs & Search bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-4 space-y-4">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {tabs.map((tab) => {
            const isActive = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusTab(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-amber-50 border border-amber-200/80 text-amber-800' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            type="text"
            placeholder="Search by client name or bill reference number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                <th className="py-4 px-6">Bill Reference</th>
                <th className="py-4 px-6">Client Name</th>
                <th className="py-4 px-6">Billed</th>
                <th className="py-4 px-6">Paid</th>
                <th className="py-4 px-6">Balance Due</th>
                <th className="py-4 px-6">Levy Items Summary</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 text-slate-400">
                      <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Fetching demand bills ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">No Demand Bills Found</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          {searchTerm || statusTab !== 'all' 
                            ? 'No invoices match your current search or status filter criteria.' 
                            : 'No demand bills have been generated in this Local Government workspace yet.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const statusInfo = getDisplayStatus(bill.payment_status, bill.due_date);
                  const itemsSummary = bill.levy_items && Array.isArray(bill.levy_items)
                    ? bill.levy_items.map(item => item.name).join(', ')
                    : 'No items';

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/30 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-800 tracking-tight">
                        {bill.reference_number}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-700">
                        {bill.client_name}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-slate-900">
                        {formatNaira(bill.grand_total)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-emerald-700">
                        {formatNaira(bill.amount_paid)}
                      </td>
                      <td className="py-4 px-6 font-bold text-indigo-700">
                        {formatNaira(bill.balance_due)}
                      </td>
                      <td className="py-4 px-6 text-slate-500 max-w-[150px] truncate" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium text-xs">
                        <span className="inline-flex items-center gap-1">
                          {statusInfo.label === 'Overdue' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          {new Date(bill.due_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/officer/demand-bills/${bill.id}`}
                          className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 text-xs font-bold rounded-xl transition-colors inline-block cursor-pointer"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Showing page <span className="text-slate-800">{currentPage}</span> of <span className="text-slate-800">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
