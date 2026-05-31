'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Receipt,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  FileText,
  User,
  Calendar,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';

interface PaymentLogEntry {
  payment_number: number;
  amount: number;
  method: 'flutterwave' | 'bank_transfer';
  transaction_ref: string;
  bank_name: string | null;
  teller_ref: string | null;
  date: string;
  recorded_by: string;
  balance_after: number;
}

interface AuditLog {
  id: string;
  change_type: 'receipt_created' | 'receipt_updated_partial' | 'receipt_updated_final';
  amount_paid_this_transaction: number;
  total_paid_after: number;
  balance_remaining_after: number;
  payment_method: 'flutterwave' | 'bank_transfer';
  transaction_ref: string | null;
  changed_by_label: string;
  note: string | null;
  created_at: string;
}

interface LevyItem {
  name: string;
  description: string;
  amount: number;
  category_name?: string;
}

interface ReceiptDetail {
  id: string;
  reference_number: string;
  payment_status: 'partially_paid' | 'paid';
  total_bill_amount: number;
  total_amount_paid: number;
  outstanding_balance: number;
  last_payment_amount: number;
  last_payment_method: 'flutterwave' | 'bank_transfer';
  last_payment_date: string;
  last_payment_reference: string | null;
  payments_log: PaymentLogEntry[];
  created_at: string;
  demand_bill_id: string;
  client_id: string;
  client_name: string;
  client_reference_number: string;
  client_phone: string;
  client_address: string;
  client_ward: string | null;
  demand_bill_reference: string;
  demand_bill_grand_total: number;
  demand_bill_levy_items: LevyItem[];
  demand_bill_subtotal: number;
  demand_bill_arrears: number;
  demand_bill_penalty: number;
  year_of_billing: number;
  due_date: string;
  amount_in_words: string;
  demand_bill_payment_status: 'paid' | 'unpaid' | 'partially_paid';
  created_by_name: string;
  last_updated_by_name: string | null;
  lg_name: string;
  lg_logo_url: string | null;
  state_name: string;
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

export default function ChairmanReceiptDetailPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchReceipt() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/chairman/receipts/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to retrieve receipt details');
        setReceipt(data.receipt);
        setAuditLogs(data.auditLogs || []);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    fetchReceipt();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading receipt details...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-semibold text-slate-655">{error || 'Failed to load receipt.'}</p>
        <Link
          href="/dashboard/treasurer/receipts"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Return to Receipts Directory
        </Link>
      </div>
    );
  }

  const isPaid = receipt.payment_status === 'paid';
  const paymentsLog: PaymentLogEntry[] = Array.isArray(receipt.payments_log) ? receipt.payments_log : [];

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/treasurer/receipts"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-4 w-4" /> Receipts Directory
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-450">{receipt.reference_number}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{receipt.reference_number}</h1>
            <span className={`px-2.5 py-0.5 text-[10px] font-black border rounded-lg uppercase tracking-wider ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {isPaid ? 'Fully Paid' : 'Partially Paid'}
            </span>
          </div>
        </div>

        {/* Read-only Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/treasurer/demand-bills/${receipt.demand_bill_id}/print?copy=customer`}
            target="_blank"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Print Demand Bill</span>
          </Link>

          {/* Print Receipt Copy selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setReceiptDropdownOpen(!receiptDropdownOpen)}
              className="px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
            >
              <Printer className="h-4 w-4" />
              <span>Print Receipt</span>
            </button>
            {receiptDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 shadow-lg rounded-xl z-20 py-1.5">
                <Link
                  href={`/dashboard/treasurer/receipts/${receipt.id}/print?copy=customer`}
                  target="_blank"
                  onClick={() => setReceiptDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print Customer Copy
                </Link>
                <Link
                  href={`/dashboard/treasurer/receipts/${receipt.id}/print?copy=lg`}
                  target="_blank"
                  onClick={() => setReceiptDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print LG Copy
                </Link>
                <div className="border-t border-slate-100 my-1" />
                <Link
                  href={`/dashboard/treasurer/receipts/${receipt.id}/print`}
                  target="_blank"
                  onClick={() => setReceiptDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Print Both Copies (A4)
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Receipt Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt Info Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-emerald-500" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Client Details</span>
                  <Link
                    href={`/dashboard/treasurer/clients/${receipt.client_id}`}
                    className="text-base font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline block mt-0.5"
                  >
                    {receipt.client_name}
                  </Link>
                  <span className="text-xs text-slate-505 font-mono font-medium block mt-0.5">{receipt.client_reference_number}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Linked Demand Bill</span>
                  <Link
                    href={`/dashboard/treasurer/demand-bills/${receipt.demand_bill_id}`}
                    className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{receipt.demand_bill_reference}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Last Payment Date</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{formatDate(receipt.last_payment_date)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Last Payment Method</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5 capitalize">
                      {receipt.last_payment_method === 'flutterwave' ? 'Online' : 'Manual'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remittance Progress Summary */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">Remittance Balance</span>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-600' : 'bg-indigo-650'}`}
                      style={{ width: `${Math.min(100, Math.round((receipt.total_amount_paid / receipt.total_bill_amount) * 100))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/50">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Billed</span>
                      <span className="text-xs font-black text-slate-850 block mt-0.5">{formatNaira(receipt.total_bill_amount)}</span>
                    </div>
                    <div className="border-l border-r border-slate-200 px-2 text-center">
                      <span className="text-[9px] font-bold text-emerald-650 uppercase tracking-wider block">Paid</span>
                      <span className="text-xs font-black text-emerald-705 block mt-0.5">{formatNaira(receipt.total_amount_paid)}</span>
                    </div>
                    <div className="pl-1 text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${receipt.outstanding_balance > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {receipt.outstanding_balance > 0 ? 'Balance' : 'Settled'}
                      </span>
                      <span className={`text-xs font-black block mt-0.5 ${receipt.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-705'}`}>
                        {formatNaira(receipt.outstanding_balance)}
                      </span>
                    </div>
                  </div>
                  
                  <span className="text-[9px] text-slate-400 font-medium italic block mt-1 leading-snug">{receipt.amount_in_words}</span>
                </div>

                <div className="border-t border-slate-200/60 pt-3 mt-4 text-xs font-medium grid grid-cols-1 gap-1 text-slate-500">
                  <div>
                    <span>Generated By Account Officer: <strong className="text-slate-700">{receipt.created_by_name}</strong></span>
                  </div>
                  {receipt.last_updated_by_name && (
                    <div>
                      <span>Last Updated By: <strong className="text-slate-700">{receipt.last_updated_by_name}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Section */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-850">Payment History</span>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-2.5 px-5">Payment #</th>
                  <th className="py-2.5 px-5">Date &amp; Time</th>
                  <th className="py-2.5 px-5 text-right">Amount Paid</th>
                  <th className="py-2.5 px-5">Method</th>
                  <th className="py-2.5 px-5">Reference</th>
                  <th className="py-2.5 px-5">Recorded By</th>
                  <th className="py-2.5 px-5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-655">
                {paymentsLog.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold italic">No transaction records found.</td>
                  </tr>
                ) : (
                  paymentsLog.map((entry) => (
                    <tr key={entry.payment_number} className="hover:bg-slate-50/20 transition-colors">
                      <td className="py-3 px-5">
                        <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center justify-center">
                          {entry.payment_number}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-semibold text-slate-600">{formatDateTime(entry.date)}</td>
                      <td className="py-3 px-5 text-right font-black text-emerald-700">{formatNaira(entry.amount)}</td>
                      <td className="py-3 px-5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          entry.method === 'flutterwave'
                            ? 'bg-violet-50 text-violet-700 border border-violet-100'
                            : 'bg-sky-50 text-sky-700 border border-sky-100'
                        }`}>
                          {entry.method === 'flutterwave' ? 'Flutterwave' : 'Bank Transfer'}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-600 truncate max-w-[120px]" title={entry.transaction_ref || entry.teller_ref || ''}>
                        {entry.transaction_ref || entry.teller_ref || '—'}
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-500">{entry.recorded_by}</td>
                      <td className="py-3 px-5 text-right font-black text-slate-700">{formatNaira(entry.balance_after)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Receipt Audit Log Section */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-5 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <span>Receipt Audit Log</span>
            </h3>

            <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
              {auditLogs.map((log) => {
                let dotClass = 'border-slate-350';
                let badgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
                if (log.change_type === 'receipt_created') {
                  dotClass = 'border-amber-500';
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                } else if (log.change_type === 'receipt_updated_partial') {
                  dotClass = 'border-indigo-500';
                  badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                } else if (log.change_type === 'receipt_updated_final') {
                  dotClass = 'border-emerald-500';
                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                }

                return (
                  <div key={log.id} className="relative text-xs">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[24.5px] top-1.5 w-3 h-3 rounded-full border-2 bg-white ${dotClass}`} />
                    
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTime(log.created_at)}</span>
                        <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${badgeClass}`}>
                          {log.change_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-655 font-medium leading-relaxed">{log.note}</p>
                      
                      <div className="mt-1.5 p-2 bg-slate-50 border border-slate-100 rounded-lg flex flex-wrap gap-4 text-[10px] font-mono font-medium text-slate-600">
                        <span>Paid: <strong className="text-slate-800">{formatNaira(log.amount_paid_this_transaction)}</strong></span>
                        <span>Total Paid: <strong className="text-emerald-700">{formatNaira(log.total_paid_after)}</strong></span>
                        <span>Balance: <strong className={log.balance_remaining_after > 0 ? 'text-rose-600' : 'text-emerald-750'}>{formatNaira(log.balance_remaining_after)}</strong></span>
                        <span>By: <strong className="text-slate-700">{log.changed_by_label}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column — Linked Demand Bill Preview */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden sticky top-4">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Linked Demand Bill</span>
              </div>
              <Link
                href={`/dashboard/treasurer/demand-bills/${receipt.demand_bill_id}/print?copy=customer`}
                target="_blank"
                className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5"
              >
                <span>Print</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Taxpayer info */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Taxpayer Details</span>
                <span className="text-sm font-bold text-slate-850 block mt-0.5">{receipt.client_name}</span>
                <span className="text-slate-500 block leading-relaxed">{receipt.client_address}</span>
                {receipt.client_ward && (
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Ward: {receipt.client_ward}</span>
                )}
              </div>

              {/* Bill Details */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3.5 space-y-1">
                <span className="text-[9px] font-black text-amber-600 uppercase block">Bill Reference</span>
                <span className="font-mono text-sm font-black text-amber-800 block">{receipt.demand_bill_reference}</span>
                <div className="flex justify-between text-[10px] text-amber-605 font-bold uppercase tracking-wider pt-1 border-t border-amber-100/50 mt-1">
                  <span>Year: {receipt.year_of_billing}</span>
                  <span>Due: {formatDate(receipt.due_date)}</span>
                </div>
              </div>

              {/* Levy Items breakdown */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Levy Items</span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                  {(receipt.demand_bill_levy_items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-3 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-750 block truncate">{item.name}</span>
                        {item.category_name && (
                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide block">{item.category_name}</span>
                        )}
                      </div>
                      <span className="font-black text-slate-850 shrink-0">{formatNaira(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals calculations */}
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Subtotal Levies:</span>
                  <span>{formatNaira(receipt.demand_bill_subtotal)}</span>
                </div>
                {receipt.demand_bill_arrears > 0 && (
                  <div className="flex justify-between text-slate-500 font-semibold">
                    <span>Arrears / Past Debts:</span>
                    <span>{formatNaira(receipt.demand_bill_arrears)}</span>
                  </div>
                )}
                {receipt.demand_bill_penalty > 0 && (
                  <div className="flex justify-between text-slate-500 font-semibold">
                    <span>Accrued Penalty:</span>
                    <span>{formatNaira(receipt.demand_bill_penalty)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-800 text-sm border-t border-slate-100 pt-2">
                  <span>Grand Total Notice:</span>
                  <span className="text-amber-800">{formatNaira(receipt.demand_bill_grand_total)}</span>
                </div>
              </div>

              {/* Bill Status */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className={`px-2 py-0.5 text-[9px] font-black border rounded uppercase tracking-wider ${
                  receipt.demand_bill_payment_status === 'paid'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : receipt.demand_bill_payment_status === 'partially_paid'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {receipt.demand_bill_payment_status === 'partially_paid' ? 'partially paid' : receipt.demand_bill_payment_status || 'unpaid'}
                </span>
                
                <div className="text-right">
                  <span className="text-[8px] text-slate-400 font-bold uppercase block">Bill Status</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href={`/dashboard/treasurer/demand-bills/${receipt.demand_bill_id}`}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100/50 text-indigo-700 font-extrabold rounded-xl transition text-center flex items-center justify-center gap-1 cursor-pointer"
                >
                  View Full Bill
                </Link>
                <Link
                  href={`/dashboard/treasurer/demand-bills/${receipt.demand_bill_id}/print?copy=customer`}
                  target="_blank"
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-extrabold rounded-xl transition text-center flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Demand Bill
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
