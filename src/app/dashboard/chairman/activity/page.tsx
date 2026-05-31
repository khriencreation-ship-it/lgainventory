'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Users,
  CheckSquare,
  Loader2,
  X,
  TrendingUp,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  type: 'client_created' | 'bill_created' | 'payment_confirmed';
  ref: string;
  detail: string;
  amount: number | null;
  created_at: string;
  officer_name: string | null;
}

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formattedDate} at ${formattedTime}`;
};

const getActivityStyles = (type: string) => {
  if (type === 'client_created') {
    return {
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100/70',
      tag: 'New Client',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-150'
    };
  }
  if (type === 'bill_created') {
    return {
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-100/70',
      tag: 'Bill Created',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-150'
    };
  }
  return {
    icon: CheckSquare,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100/70',
    tag: 'Payment Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-150'
  };
};

export default function ChairmanActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter states
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active filter values used for requests
  const [activeSearch, setActiveSearch] = useState('');
  const [activeType, setActiveType] = useState('');
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/chairman/activity?page=${page}&limit=15`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;
      if (activeType) url += `&type=${activeType}`;
      if (activeStartDate) url += `&startDate=${activeStartDate}`;
      if (activeEndDate) url += `&endDate=${activeEndDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load activities');
      
      const data = await res.json();
      setActivities(data.activities);
      setTotalPages(data.pagination.totalPages);
      setTotalRecords(data.pagination.totalRecords);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [page, activeSearch, activeType, activeStartDate, activeEndDate]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
    setActiveType(type);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
  };

  const handleClearFilters = () => {
    setSearch('');
    setType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActiveSearch('');
    setActiveType('');
    setActiveStartDate('');
    setActiveEndDate('');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      // Scroll to top of table/container
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isFiltered = activeSearch || activeType || activeStartDate || activeEndDate;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/chairman"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Full Activity Log</h1>
              <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
                Audit trail of all administrative activities
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchActivities}
          disabled={loading}
          className="self-start sm:self-center px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters form */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h3 className="font-extrabold text-slate-800 text-sm">Filter Activity</h3>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg transition-all border border-rose-100/50 flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Text Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Client, Ref, or Officer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Activity Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Activity Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
            >
              <option value="">All Types</option>
              <option value="client_created">New Clients</option>
              <option value="bill_created">Bills Generated</option>
              <option value="payment_confirmed">Payments Confirmed</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Start Date</label>
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

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">End Date</label>
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

      {/* Activities Feed container */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No activities found</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              Try adjusting your search query, filter types, or dates to find matching records.
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
          <div>
            {/* Feed List */}
            <div className="divide-y divide-slate-100">
              {activities.map((item, i) => {
                const styles = getActivityStyles(item.type);
                const Icon = styles.icon;

                return (
                  <div
                    key={i}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 hover:bg-slate-50/40 transition-colors"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${styles.bg}`}>
                        <Icon className={`h-5 w-5 ${styles.color}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badgeClass}`}>
                            {styles.tag}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {item.ref}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-xs md:text-sm">{item.detail}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Recorded by: <span className="font-bold text-slate-650">{item.officer_name || 'System'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0 gap-1.5">
                      <span className="text-[10px] font-bold text-slate-450 md:order-2">{formatDateTime(item.created_at)}</span>
                      {item.amount != null && item.amount > 0 && (
                        <div className="flex items-center gap-1 font-black text-slate-900 text-sm md:order-1">
                          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{formatNaira(item.amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination footer */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs font-semibold text-slate-500 text-center sm:text-left">
                Showing <span className="font-black text-slate-700">{(page - 1) * 15 + 1}</span> to{' '}
                <span className="font-black text-slate-700">
                  {Math.min(page * 15, totalRecords)}
                </span>{' '}
                of <span className="font-black text-slate-700">{totalRecords}</span> entries
              </p>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 self-center">
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200/80 rounded-lg hover:border-indigo-300 disabled:opacity-40 disabled:hover:text-slate-50 disabled:hover:border-slate-200 cursor-pointer transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    // Show truncated page numbers if too many
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      Math.abs(pageNum - page) <= 1
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            page === pageNum
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100'
                              : 'bg-white text-slate-600 border-slate-200/80 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (
                      pageNum === 2 ||
                      pageNum === totalPages - 1
                    ) {
                      return <span key={pageNum} className="text-slate-400 text-xs px-1 select-none">...</span>;
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200/80 rounded-lg hover:border-indigo-300 disabled:opacity-40 disabled:hover:text-slate-550 disabled:hover:border-slate-200 cursor-pointer transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
