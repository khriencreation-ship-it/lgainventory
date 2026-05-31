'use client';

import { useState, useEffect, Fragment } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  DollarSign,
  FileText,
  Receipt,
  Loader2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface LevyItem {
  name: string;
  description: string;
  amount: number;
  category_name?: string;
}

interface StatusLog {
  id: string;
  status: 'unpaid' | 'paid' | 'overdue' | 'partially_paid';
  changed_by_label: string;
  changed_by_user: string;
  change_type: string;
  note: string;
  metadata?: any;
  created_at: string;
}

interface DemandBillRecord {
  id: string;
  reference_number: string;
  levy_items: LevyItem[];
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: 'paid' | 'unpaid' | 'partially_paid';
  due_date: string;
  officer_name: string;
  created_at: string;
  status_logs: StatusLog[];
}

interface ReceiptRecord {
  id: string;
  reference_number: string;
  bill_ref: string;
  total_bill_amount: number;
  total_amount_paid: number;
  outstanding_balance: number;
  payment_status: string;
  last_payment_date: string;
}

interface ClientDetails {
  id: string;
  reference_number: string;
  full_name: string;
  phone_number: string;
  email_address: string | null;
  address: string;
  ward: string | null;
  added_by: string;
  created_at: string;
}

interface FinancialStats {
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
  total_bills: number;
  paid_bills: number;
  unpaid_bills: number;
}

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formattedDate} at ${formattedTime}`;
};

export default function ChairmanClientDetailPage() {
  const { id: clientId } = useParams();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [demandBills, setDemandBills] = useState<DemandBillRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'partially_paid' | 'not_paid' | 'overdue'>('all');
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/chairman/clients/${clientId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to retrieve client details');
        }
        setClient(data.client);
        setStats(data.stats);
        setDemandBills(data.demandBills);
        setReceipts(data.receipts);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      fetchDetails();
    }
  }, [clientId]);

  const toggleBillExpand = (billId: string) => {
    setExpandedBills(prev => ({ ...prev, [billId]: !prev[billId] }));
  };

  const getBillStatus = (bill: DemandBillRecord) => {
    if (bill.payment_status === 'paid') return 'paid';
    if (bill.payment_status === 'partially_paid') return 'partially_paid';
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(23, 59, 59, 999);
    if (new Date() > dueDate) return 'overdue';
    return 'unpaid'; // Not Paid
  };

  const getDisplayStatus = (status: string) => {
    if (status === 'paid') {
      return { label: 'Paid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    }
    if (status === 'partially_paid') {
      return { label: 'Partially Paid', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    }
    if (status === 'overdue') {
      return { label: 'Overdue', badgeClass: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    return { label: 'Not Paid', badgeClass: 'bg-rose-50 text-rose-700 border-rose-100' };
  };

  const filteredBills = demandBills.filter(bill => {
    if (statusTab === 'all') return true;
    const status = getBillStatus(bill);
    if (statusTab === 'not_paid') return status === 'unpaid';
    return status === statusTab;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading client dossier...</p>
      </div>
    );
  }

  if (error || !client || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-semibold text-slate-655">{error || 'Failed to load client details.'}</p>
        <Link
          href="/dashboard/treasurer/clients"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Return to Clients Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/treasurer/clients"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-550 hover:text-indigo-600 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" /> Clients Directory
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-400">{client.full_name}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2">
          Portfolio: {client.reference_number}
        </h1>
      </div>

      {/* Client Info Card */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <h3 className="font-extrabold text-slate-800 text-sm mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
          <User className="h-4.5 w-4.5 text-indigo-600" /> General Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Reference Number</span>
            <span className="font-mono text-sm font-black text-slate-800 bg-slate-50 px-2 py-1 rounded-lg border border-slate-150 inline-block">
              {client.reference_number}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Full Name</span>
            <span className="font-black text-slate-800 text-sm block mt-0.5">{client.full_name}</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Phone Number</span>
            <span className="font-bold text-slate-700 block mt-0.5 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" /> {client.phone_number}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Email Address</span>
            <span className="font-bold text-slate-700 block mt-0.5 flex items-center gap-1.5 truncate" title={client.email_address || 'No email registered'}>
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {client.email_address || 'No email registered'}
            </span>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Physical Address</span>
            <span className="font-semibold text-slate-650 block mt-0.5 flex items-start gap-1.5 leading-relaxed">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" /> {client.address}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ward</span>
            <span className="font-bold text-slate-700 block mt-0.5">
              <span className="bg-slate-100 text-slate-750 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border border-slate-200">
                {client.ward || 'General Ward'}
              </span>
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Date Registered</span>
            <span className="font-semibold text-slate-600 block mt-0.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> {formatDate(client.created_at)}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 mt-6 flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-semibold text-slate-450 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-slate-400" />
            <span>Added By Officer: <strong className="text-slate-800 normal-case">{client.added_by}</strong></span>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Billed</span>
            <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl">
              <FileText className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight truncate">
              {formatNaira(stats.total_billed)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">
              {stats.total_bills} Total Notice Bills
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Revenue Paid</span>
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-850 tracking-tight truncate">
              {formatNaira(stats.total_paid)}
            </h3>
            <p className="text-[10px] text-emerald-650 mt-1 font-semibold uppercase tracking-wider">
              {stats.paid_bills} Fully Paid Bills
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Outstanding Balance</span>
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight truncate">
              {formatNaira(stats.outstanding_balance)}
            </h3>
            <p className="text-[10px] text-rose-500 mt-1 font-semibold uppercase tracking-wider">
              {stats.unpaid_bills} Unpaid / Partial Bills
            </p>
          </div>
        </div>
      </div>

      {/* Demand Bills Section */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Demand Bills Ledger</h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                Demand notices issued to this client
              </p>
            </div>
          </div>

          {/* Filters tabs */}
          <div className="flex flex-wrap gap-1">
            {([
              { key: 'all', label: 'All Bills' },
              { key: 'paid', label: 'Paid' },
              { key: 'partially_paid', label: 'Partially Paid' },
              { key: 'not_paid', label: 'Not Paid' },
              { key: 'overdue', label: 'Overdue' }
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                  statusTab === tab.key
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">
            No demand bills match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5"></th>
                  <th className="py-3 px-5">Bill Ref</th>
                  <th className="py-3 px-5">Levy Items Summary</th>
                  <th className="py-3 px-5">Categories</th>
                  <th className="py-3 px-5 text-right">Total Amount</th>
                  <th className="py-3 px-5 text-right">Amount Paid</th>
                  <th className="py-3 px-5 text-right">Balance Due</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5">Due Date</th>
                  <th className="py-3 px-5">Officer</th>
                  <th className="py-3 px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((bill) => {
                  const billStatus = getBillStatus(bill);
                  const displayStatus = getDisplayStatus(billStatus);
                  const isExpanded = !!expandedBills[bill.id];
                  
                  const levySummary = bill.levy_items
                    ? bill.levy_items.map(i => i.name).join(', ')
                    : 'No items';
                  
                  const uniqueCategories = bill.levy_items
                    ? Array.from(new Set(bill.levy_items.map(i => i.category_name || 'General Levy')))
                    : [];

                  return (
                    <Fragment key={bill.id}>
                      {/* Row */}
                      <tr className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleBillExpand(bill.id)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-505 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-805">{bill.reference_number}</td>
                        <td className="py-3.5 px-5 text-slate-500 font-medium truncate max-w-[150px]" title={levySummary}>
                          {levySummary}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                            {uniqueCategories.map((cat, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">{formatNaira(Number(bill.grand_total))}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-emerald-700">{formatNaira(Number(bill.amount_paid))}</td>
                        <td className="py-3.5 px-5 text-right font-black text-indigo-700">{formatNaira(Number(bill.balance_due))}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-black border rounded-md uppercase tracking-wider ${displayStatus.badgeClass}`}>
                            {displayStatus.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-500">{formatDate(bill.due_date)}</td>
                        <td className="py-3.5 px-5 font-semibold text-slate-650">{bill.officer_name}</td>
                        <td className="py-3.5 px-5">
                          <Link
                            href={`/dashboard/treasurer/demand-bills/${bill.id}`}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all inline-block cursor-pointer"
                          >
                            View
                          </Link>
                        </td>
                      </tr>

                      {/* Expandable Status logs */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40">
                          <td colSpan={11} className="py-5 px-8">
                            <div className="max-w-2xl border border-slate-150 rounded-2xl bg-white p-5 shadow-sm space-y-4">
                              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                                <Clock className="h-4 w-4 text-slate-400" /> Status Audit Trail Log
                              </h4>

                              {bill.status_logs.length === 0 ? (
                                <p className="text-xs font-semibold text-slate-400 italic">No audit trail records found.</p>
                              ) : (
                                <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
                                  {bill.status_logs.map(log => {
                                    let badgeColor = 'bg-slate-50 text-slate-600 border-slate-200';
                                    if (log.status === 'paid') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                    else if (log.status === 'partially_paid') badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                    else if (log.status === 'overdue') badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                                    else if (log.status === 'unpaid') badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';

                                    return (
                                      <div key={log.id} className="relative text-xs">
                                        <div className={`absolute -left-[22.5px] top-1 w-2 h-2 rounded-full border bg-white ${
                                          log.status === 'paid' ? 'border-emerald-500' : log.status === 'partially_paid' ? 'border-indigo-500' : log.status === 'overdue' ? 'border-amber-500' : 'border-rose-500'
                                        }`} />
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">{formatDateTime(log.created_at)}</span>
                                            <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${badgeColor}`}>
                                              {log.status === 'partially_paid' ? 'partially paid' : log.status}
                                            </span>
                                            <span className="text-[9px] font-semibold text-slate-450 italic">by {log.changed_by_label}</span>
                                          </div>
                                          <p className="text-slate-655 font-medium leading-relaxed">{log.note}</p>

                                          {log.metadata && (
                                            <div className="mt-1 p-2 bg-slate-50 border border-slate-150 rounded-lg space-y-0.5 text-[10px] font-medium text-slate-600 font-mono max-w-xs">
                                              {log.metadata.amount_paid !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Amount Paid:</span>
                                                  <span className="font-bold text-slate-800">{formatNaira(log.metadata.amount_paid)}</span>
                                                </div>
                                              )}
                                              {log.metadata.balance_remaining !== undefined && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Balance Remaining:</span>
                                                  <span className="font-bold text-indigo-700">{formatNaira(log.metadata.balance_remaining)}</span>
                                                </div>
                                              )}
                                              {log.metadata.payment_method && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Method:</span>
                                                  <span className="font-bold text-slate-700 capitalize">{log.metadata.payment_method}</span>
                                                </div>
                                              )}
                                              {log.metadata.teller_ref && (
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Teller Ref:</span>
                                                  <span className="font-bold text-slate-700">{log.metadata.teller_ref}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipts Section */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Receipts Ledger</h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
              Settled/confirmed payment receipts
            </p>
          </div>
        </div>

        {receipts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">
            No receipts generated for this client.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                  <th className="py-3 px-5">Receipt Ref</th>
                  <th className="py-3 px-5">Linked Bill Ref</th>
                  <th className="py-3 px-5 text-right">Total Bill Amount</th>
                  <th className="py-3 px-5 text-right">Total Amount Paid</th>
                  <th className="py-3 px-5 text-right">Outstanding Balance</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5">Last Payment Date</th>
                  <th className="py-3 px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => {
                  const isFullyPaid = Number(receipt.outstanding_balance) <= 0.01;
                  return (
                    <tr key={receipt.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-amber-700 bg-amber-50/30">{receipt.reference_number}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-800">{receipt.bill_ref}</td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-slate-800">{formatNaira(Number(receipt.total_bill_amount))}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-emerald-700">{formatNaira(Number(receipt.total_amount_paid))}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-indigo-700">{formatNaira(Number(receipt.outstanding_balance))}</td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-black border rounded-md uppercase tracking-wider ${
                          isFullyPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-500">{formatDate(receipt.last_payment_date)}</td>
                      <td className="py-3.5 px-5">
                        <Link
                          href={`/dashboard/treasurer/receipts/${receipt.id}`}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all inline-block cursor-pointer"
                        >
                          View
                        </Link>
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
  );
}
