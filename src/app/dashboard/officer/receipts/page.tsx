'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface ReceiptRow {
  id: string;
  reference_number: string;
  payment_status: 'partially_paid' | 'paid';
  total_bill_amount: number;
  total_amount_paid: number;
  outstanding_balance: number;
  last_payment_date: string;
  last_payment_method: 'flutterwave' | 'bank_transfer';
  client_name: string;
  demand_bill_reference: string;
}

const formatNaira = (n: number) =>
  '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ReceiptsListPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'partially_paid' | 'paid'>('all');

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/officer/receipts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch receipts');
      setReceipts(data.receipts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchReceipts(), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [fetchReceipts, search]);

  const tabs = [
    { key: 'all' as const, label: 'All Receipts', icon: Receipt },
    { key: 'partially_paid' as const, label: 'Partial', icon: Clock },
    { key: 'paid' as const, label: 'Fully Paid', icon: CheckCircle },
  ];

  const totalBilled = receipts.reduce((s, r) => s + r.total_bill_amount, 0);
  const totalCollected = receipts.reduce((s, r) => s + r.total_amount_paid, 0);
  const totalOutstanding = receipts.reduce((s, r) => s + r.outstanding_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/officer"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Receipts Ledger</h1>
          <p className="text-xs text-slate-500 font-medium">
            Auto-generated on every confirmed payment · Updated in real time
          </p>
        </div>

        {/* Summary Stat Pills */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <div className="bg-white border border-slate-200/60 rounded-2xl px-4 py-2 shadow-sm text-center min-w-[100px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Billed</span>
            <span className="text-sm font-black text-slate-800 block mt-0.5">{formatNaira(totalBilled)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 shadow-sm text-center min-w-[100px]">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Collected</span>
            <span className="text-sm font-black text-emerald-700 block mt-0.5">{formatNaira(totalCollected)}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 shadow-sm text-center min-w-[100px]">
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider block">Outstanding</span>
            <span className="text-sm font-black text-rose-700 block mt-0.5">{formatNaira(totalOutstanding)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex bg-white border border-slate-200/60 rounded-xl p-1 gap-0.5 shadow-sm">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt, bill ref, client..."
            className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition shadow-sm"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              {receipts.length} Receipt{receipts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">
            Sorted by most recent payment
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loading receipts...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">{error}</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Receipt className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">No receipts found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Receipts are automatically generated when a payment is confirmed. They will appear here once a demand bill receives its first payment.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5">Receipt Ref</th>
                  <th className="py-3 px-5">Bill Ref</th>
                  <th className="py-3 px-5">Client</th>
                  <th className="py-3 px-5 text-right">Total Billed</th>
                  <th className="py-3 px-5 text-right">Total Paid</th>
                  <th className="py-3 px-5 text-right">Balance</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5">Last Payment</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        {receipt.reference_number}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-slate-600 font-semibold">
                        {receipt.demand_bill_reference}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-sm font-bold text-slate-800 block">
                        {receipt.client_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-xs font-bold text-slate-700">
                        {formatNaira(receipt.total_bill_amount)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-xs font-bold text-emerald-700">
                        {formatNaira(receipt.total_amount_paid)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={`text-xs font-black ${receipt.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatNaira(receipt.outstanding_balance)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {receipt.payment_status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg uppercase tracking-wide">
                          <CheckCircle className="h-3 w-3" /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg uppercase tracking-wide">
                          <Clock className="h-3 w-3" /> Partial
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-xs text-slate-500 font-semibold">
                        {formatDate(receipt.last_payment_date)}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-medium mt-0.5 capitalize">
                        {receipt.last_payment_method === 'flutterwave' ? 'Flutterwave' : 'Bank Transfer'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <Link
                        href={`/dashboard/officer/receipts/${receipt.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-800 text-xs font-bold rounded-xl transition-all group-hover:shadow-sm"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
