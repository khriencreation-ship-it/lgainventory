'use client';

import { useState, useEffect, Fragment } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Calendar,
  Building,
  FileText,
  TrendingUp,
  Loader2,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Receipt,
  ChevronRight,
  ExternalLink
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
  metadata?: {
    amount_paid?: number;
    balance_remaining?: number;
    payment_method?: string;
    teller_ref?: string;
    bank_name?: string;
  };
  created_at: string;
}

interface ReceiptSummary {
  id: string;
  reference_number: string;
  payment_status: string;
  total_amount_paid: number;
  outstanding_balance: number;
}

interface DemandBillDetail {
  id: string;
  reference_number: string;
  client_id: string;
  client_name: string;
  client_reference_number: string;
  client_phone: string;
  client_address: string;
  creator_name: string;
  levy_items: LevyItem[];
  subtotal: number;
  arrears: number;
  penalty: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  amount_in_words: string;
  year_of_billing: number;
  due_date: string;
  payment_status: 'paid' | 'unpaid' | 'partially_paid';
  payment_method: 'flutterwave' | 'bank_transfer' | null;
  flutterwave_transaction_id: string | null;
  manual_payment_bank: string | null;
  manual_payment_teller_ref: string | null;
  manual_payment_date: string | null;
  manual_payment_note: string | null;
  created_at: string;
  lg_name: string;
  lg_logo_url: string | null;
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

export default function ChairmanDemandBillDetailPage() {
  const { id: billId } = useParams();
  const [bill, setBill] = useState<DemandBillDetail | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dropdown states for print buttons
  const [billDropdownOpen, setBillDropdownOpen] = useState(false);
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);

  useEffect(() => {
    async function fetchBill() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/chairman/demand-bills/${billId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to retrieve demand bill details');
        }
        setBill(data.bill);
        setStatusLogs(data.statusLogs || []);
        setReceipt(data.receipt);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    if (billId) {
      fetchBill();
    }
  }, [billId]);

  const getBillStatus = () => {
    if (!bill) return { label: 'Unknown', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (bill.payment_status === 'paid') {
      return { label: 'Paid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (bill.payment_status === 'partially_paid') {
      return { label: 'Partially Paid', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(23, 59, 59, 999);
    if (new Date() > dueDate) {
      return { label: 'Overdue', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Not Paid', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const getChangeTypeLabel = (type: string) => {
    if (type === 'created') return 'Bill Created';
    if (type === 'manual_payment' || type === 'partial_payment_manual') return 'Partial Payment (Manual)';
    if (type === 'qr_payment' || type === 'partial_payment_flutterwave') return 'Partial Payment (Online)';
    if (type === 'payment_completed_manual') return 'Payment Completed (Manual)';
    if (type === 'payment_completed_flutterwave') return 'Payment Completed (Online)';
    if (type === 'overdue_flagged') return 'Overdue Flagged';
    return 'Status Update';
  };

  const getLogBadgeColor = (status: string) => {
    if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (status === 'partially_paid') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (status === 'overdue') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-700 border-rose-100';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading demand bill detail...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-semibold text-slate-655">{error || 'Failed to load demand bill.'}</p>
        <Link
          href="/dashboard/chairman/demand-bills"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Return to Demand Bills Directory
        </Link>
      </div>
    );
  }

  const statusInfo = getBillStatus();
  const completionPercentage = Math.min(100, Math.round((bill.amount_paid / bill.grand_total) * 100));

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/chairman/demand-bills"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-4 w-4" /> Demand Bills Directory
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-450">{bill.reference_number}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{bill.reference_number}</h1>
            <span className={`px-2.5 py-0.5 text-[10px] font-black border rounded-lg uppercase tracking-wider ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Read-only Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Print Demand Bill copy selector dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setBillDropdownOpen(!billDropdownOpen);
                setReceiptDropdownOpen(false);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Demand Bill</span>
            </button>
            {billDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-44 bg-white border border-slate-200 shadow-lg rounded-xl z-20 py-1.5">
                <Link
                  href={`/dashboard/chairman/demand-bills/${bill.id}/print?copy=customer`}
                  target="_blank"
                  onClick={() => setBillDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print Customer Copy
                </Link>
                <Link
                  href={`/dashboard/chairman/demand-bills/${bill.id}/print?copy=lg`}
                  target="_blank"
                  onClick={() => setBillDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print LG Copy
                </Link>
              </div>
            )}
          </div>

          {/* Print Receipt Copy selector dropdown (only if receipt exists) */}
          {receipt && (
            <div className="relative">
              <button
                onClick={() => {
                  setReceiptDropdownOpen(!receiptDropdownOpen);
                  setBillDropdownOpen(false);
                }}
                className="px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
              >
                <Receipt className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              {receiptDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 shadow-lg rounded-xl z-20 py-1.5">
                  <Link
                    href={`/dashboard/chairman/receipts/${receipt.id}/print?copy=customer`}
                    target="_blank"
                    onClick={() => setReceiptDropdownOpen(false)}
                    className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    Print Customer Copy
                  </Link>
                  <Link
                    href={`/dashboard/chairman/receipts/${receipt.id}/print?copy=lg`}
                    target="_blank"
                    onClick={() => setReceiptDropdownOpen(false)}
                    className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    Print LG Copy
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <Link
                    href={`/dashboard/chairman/receipts/${receipt.id}/print`}
                    target="_blank"
                    onClick={() => setReceiptDropdownOpen(false)}
                    className="block px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    Print Both Copies (A4)
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side Info & Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill Info Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-indigo-500" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Client Details</span>
                  <Link
                    href={`/dashboard/chairman/clients/${bill.client_id}`}
                    className="text-base font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline transition block mt-0.5"
                  >
                    {bill.client_name}
                  </Link>
                  <span className="text-xs text-slate-505 font-mono font-medium block mt-0.5">{bill.client_reference_number}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Phone Number</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{bill.client_phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Billing Year</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{bill.year_of_billing}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Billing Address</span>
                  <span className="text-xs text-slate-600 block mt-0.5 leading-relaxed">{bill.client_address}</span>
                </div>
              </div>

              {/* Remittance Progress Summary */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">Payment Progress</span>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/50">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Billed</span>
                      <span className="text-xs font-black text-slate-805 block mt-0.5">{formatNaira(bill.grand_total)}</span>
                    </div>
                    <div className="border-l border-r border-slate-200 px-2 text-center">
                      <span className="text-[9px] font-bold text-emerald-650 uppercase tracking-wider block">Paid</span>
                      <span className="text-xs font-black text-emerald-705 block mt-0.5">{formatNaira(bill.amount_paid)}</span>
                    </div>
                    <div className="pl-1 text-right">
                      <span className="text-[9px] font-bold text-indigo-650 uppercase tracking-wider block">Balance</span>
                      <span className="text-xs font-black text-indigo-705 block mt-0.5">{formatNaira(bill.balance_due)}</span>
                    </div>
                  </div>
                  
                  <span className="text-[9px] text-slate-400 font-medium italic block mt-1 leading-snug">{bill.amount_in_words}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-3 mt-4 text-xs font-medium">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase font-mono">Due Date</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{formatDate(bill.due_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase font-mono">LG Workspace</span>
                    <span className="text-slate-800 font-bold block mt-0.5 truncate" title={bill.lg_name}>{bill.lg_name}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span>Generated By Officer: <strong className="text-slate-700">{bill.creator_name}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Generated On Date: <strong className="text-slate-700">{formatDate(bill.created_at)}</strong></span>
              </div>
            </div>
          </div>

          {/* Levy Breakdown Matrix Table */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-850">Levy Breakdown Matrix</span>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Levy Item Name</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
                {bill.levy_items && bill.levy_items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                    <td className="py-3 px-6">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.category_name || 'General Levy'}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-bold text-slate-800">{item.name}</td>
                    <td className="py-3 px-6 text-slate-500 text-xs">{item.description}</td>
                    <td className="py-3 px-6 font-bold text-slate-900 text-right">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations matrix summary */}
            <div className="bg-slate-50/60 border-t border-slate-100 p-6 flex flex-col items-end space-y-2">
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-505">
                <span>Subtotal Levies:</span>
                <span className="text-slate-700 font-bold">{formatNaira(Number(bill.subtotal))}</span>
              </div>
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-505">
                <span>Arrears / Past Debts:</span>
                <span className="text-slate-750 font-bold">{formatNaira(Number(bill.arrears))}</span>
              </div>
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-505">
                <span>Accrued Penalty:</span>
                <span className="text-slate-750 font-bold">{formatNaira(Number(bill.penalty))}</span>
              </div>
              <div className="w-full max-w-xs border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-800">
                <span>Grand Total:</span>
                <span className="text-amber-800 text-base">{formatNaira(Number(bill.grand_total))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Info blocks */}
        <div className="space-y-6">
          {/* Payment Progress Section */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-indigo-650" />
              <span>Remittance Overview</span>
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-450 font-semibold">Original Billed:</span>
                <span className="font-bold text-slate-800">{formatNaira(bill.grand_total)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-450 font-semibold">Amount Paid So Far:</span>
                <span className="font-bold text-emerald-700">{formatNaira(bill.amount_paid)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-450 font-semibold">Balance Remaining:</span>
                <span className="font-extrabold text-indigo-750">{formatNaira(bill.balance_due)}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  <span>Settlement Progress</span>
                  <span>{completionPercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 border border-slate-200/50 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2.5 rounded-full"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info Section (If any payments posted) */}
          {(bill.payment_status === 'paid' || bill.payment_status === 'partially_paid') && (bill.payment_method || bill.manual_payment_bank) && (
            <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-650" />
                <span>Payment Settlement Details</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="pb-2 border-b border-slate-100">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Payment Method</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {bill.payment_method === 'flutterwave' ? 'Online Card/QR (Flutterwave)' : 'Manual Teller Bank Deposit'}
                  </span>
                </div>

                {bill.payment_method === 'flutterwave' ? (
                  <>
                    <div className="pb-2 border-b border-slate-100">
                      <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Transaction Ref</span>
                      <span className="font-mono font-bold text-slate-700 block mt-0.5 break-all select-all">{bill.flutterwave_transaction_id}</span>
                    </div>
                    {bill.manual_payment_date && (
                      <div>
                        <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider block">Payment Date</span>
                        <span className="font-bold text-slate-750 block mt-0.5">{formatDate(bill.manual_payment_date)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-slate-450 font-bold uppercase block">Bank Name</span>
                        <span className="font-bold text-slate-850 block mt-0.5">{bill.manual_payment_bank}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-450 font-bold uppercase block">Slip Reference</span>
                        <span className="font-mono font-bold text-slate-850 block mt-0.5 break-all select-all">{bill.manual_payment_teller_ref}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-slate-455 font-bold uppercase block">Deposit Date</span>
                        <span className="font-bold text-slate-750 block mt-0.5">
                          {bill.manual_payment_date ? formatDate(bill.manual_payment_date) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    {bill.manual_payment_note && (
                      <div className="border-t border-slate-100 pt-2 mt-2">
                        <span className="text-[9px] text-slate-450 font-bold uppercase block">Payment Note</span>
                        <p className="text-slate-600 mt-0.5 italic leading-relaxed text-xs">{bill.manual_payment_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chronological Status History Audit Trail Timeline */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Status History</span>
            </h3>

            {statusLogs.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-400 italic">No status history found.</div>
            ) : (
              <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
                {statusLogs.map((log) => {
                  const logBadge = getLogBadgeColor(log.status);
                  const isSystem = log.changed_by_label?.toLowerCase().includes('flutterwave') || log.changed_by_label?.toLowerCase() === 'system';
                  
                  return (
                    <div key={log.id} className="relative text-xs">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full border bg-white ${
                        log.status === 'paid' ? 'border-emerald-500' : log.status === 'partially_paid' ? 'border-indigo-500' : log.status === 'overdue' ? 'border-amber-500' : 'border-rose-450'
                      }`} />
                      
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">{formatDateTime(log.created_at)}</span>
                          <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${logBadge}`}>
                            {log.status === 'partially_paid' ? 'partially paid' : log.status}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-800">{getChangeTypeLabel(log.change_type)}</h4>
                        <p className="text-slate-655 font-medium leading-relaxed">{log.note}</p>
                        <span className="text-[9px] text-slate-400 italic font-semibold">
                          Done by: {isSystem ? 'System (Flutterwave)' : log.changed_by_user}
                        </span>

                        {log.metadata && (
                          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-150 rounded-lg space-y-0.5 text-[10px] font-medium text-slate-600 font-mono max-w-xs">
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
                                <span className="font-bold text-slate-750 truncate max-w-[120px]">{log.metadata.teller_ref}</span>
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

          {/* Receipt Section */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span>Receipt Overview</span>
            </h3>

            {!receipt ? (
              <p className="text-xs font-bold text-slate-400 italic text-center py-2">No receipt generated yet</p>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] text-slate-405 font-bold uppercase tracking-wide block">Receipt Ref</span>
                    <span className="font-mono font-black text-amber-705 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">
                      {receipt.reference_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-405 font-bold uppercase tracking-wide block text-right">Status</span>
                    <span className="inline-flex px-1.5 py-0.5 text-[9px] font-black border rounded bg-emerald-50 text-emerald-700 border-emerald-100 uppercase tracking-wider mt-0.5">
                      {receipt.payment_status === 'paid' ? 'Fully Paid' : 'Partially Paid'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-emerald-50/50 border border-emerald-100/70 rounded-xl">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase block">Total Paid</span>
                    <span className="font-black text-emerald-700 mt-0.5 block">{formatNaira(receipt.total_amount_paid)}</span>
                  </div>
                  <div className={`p-2 border rounded-xl ${receipt.outstanding_balance > 0 ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100/70'}`}>
                    <span className={`text-[9px] font-bold uppercase block ${receipt.outstanding_balance > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Outstanding</span>
                    <span className={`font-black mt-0.5 block ${receipt.outstanding_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatNaira(receipt.outstanding_balance)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 text-xs">
                  <Link
                    href={`/dashboard/chairman/receipts/${receipt.id}`}
                    className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl transition text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    View Receipt
                  </Link>
                  <Link
                    href={`/dashboard/chairman/receipts/${receipt.id}/print`}
                    target="_blank"
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
