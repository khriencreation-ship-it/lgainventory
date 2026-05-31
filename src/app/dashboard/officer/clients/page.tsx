'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  FileText
} from 'lucide-react';
import Toast from '@/components/Toast';

interface ClientRecord {
  id: string;
  reference_number: string;
  full_name: string;
  phone_number: string;
  email_address?: string | null;
  address: string;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const limit = 10;

  // Debounce search term to avoid hammering the API
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // reset to page 1 on search
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch clients
  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          search: debouncedSearch,
          page: String(currentPage),
          limit: String(limit)
        });

        const res = await fetch(`/api/officer/clients?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch clients');
        }

        setClients(data.clients || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      } catch (err: any) {
        setToastType('error');
        setToastMessage(err.message || 'Something went wrong while retrieving clients.');
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [debouncedSearch, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Top Header Operations */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link 
            href="/dashboard/officer" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <p className="text-xs text-slate-400 font-medium">Manage and view all registered portfolios within your LGA.</p>
        </div>
        
        <Link
          href="/dashboard/officer/clients/new"
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Client</span>
        </Link>
      </div>

      {/* Search Bar & Stats summary */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            type="text"
            placeholder="Search by full name, phone number, or reference number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
          />
        </div>

        <div className="text-xs text-slate-500 font-bold shrink-0">
          Total Registered: <span className="text-amber-750 text-sm font-black">{totalCount}</span> clients
        </div>
      </div>

      {/* Main Clients Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                <th className="py-4 px-6">Client Ref No</th>
                <th className="py-4 px-6">Full Name</th>
                <th className="py-4 px-6">Phone Number</th>
                <th className="py-4 px-6">Address</th>
                <th className="py-4 px-6">Date Added</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 text-slate-400">
                      <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Fetching client directory...</span>
                    </div>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Users className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">No Clients Found</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          {searchTerm ? 'No clients match your current search criteria.' : 'No clients are registered in this Local Government workspace yet.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/30 transition-colors duration-150">
                    <td className="py-4 px-6 font-bold text-slate-800 tracking-tight">
                      {client.reference_number}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      {client.full_name}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {client.phone_number}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 max-w-[200px] truncate" title={client.address}>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {client.address}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400 text-xs font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {new Date(client.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/dashboard/officer/clients/${client.id}`}
                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 text-xs font-bold rounded-xl transition-colors inline-block cursor-pointer"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
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
