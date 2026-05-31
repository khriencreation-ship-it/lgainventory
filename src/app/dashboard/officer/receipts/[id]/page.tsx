'use client';

import { useState, useEffect } from 'react';
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
  created_by_name: string;
  last_updated_by_name: string | null;
  lg_name: string;
  lg_logo_url: string | null;
  state_name: string;
}

const formatNaira = (n: number) =>
  '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/officer/receipts/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch receipt');
        setReceipt(data.receipt);
        setAuditLogs(data.auditLogs || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Loading receipt...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">{error || 'Receipt not found'}</h3>
        <Link href="/dashboard/officer/receipts" className="mt-4 inline-block text-xs font-bold text-amber-600 hover:underline">
          ← Back to Receipts
        </Link>
      </div>
    );
  }

  const isPaid = receipt.payment_status === 'paid';
  const paymentsLog: PaymentLogEntry[] = Array.isArray(receipt.payments_log) ? receipt.payments_log : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/officer/receipts"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Receipts Ledger</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Detail</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight text-slate-900">{receipt.reference_number}</h1>
            <span className={`px-2.5 py-0.5 text-[10px] font-black border rounded-lg uppercase tracking-wider ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {isPaid ? 'Fully Paid' : 'Partially Paid'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href={`/dashboard/officer/demand-bills/${receipt.demand_bill_id}/print?copy=customer`}
            target="_blank"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Print Demand Bill
          </Link>
          
          {/* Print Receipt Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setReceiptDropdownOpen(!receiptDropdownOpen)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Receipt</span>
            </button>

            {receiptDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 shadow-lg rounded-xl z-20 py-1.5 animate-fade-in">
                <Link
                  href={`/dashboard/officer/receipts/${receipt.id}/print?copy=customer`}
                  target="_blank"
                  onClick={() => setReceiptDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print Customer Copy
                </Link>
                <Link
                  href={`/dashboard/officer/receipts/${receipt.id}/print?copy=lg`}
                  target="_blank"
                  onClick={() => setReceiptDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print LG Office Copy
                </Link>
                <div className="border-t border-slate-100 my-1" />
                <Link
                  href={`/dashboard/officer/receipts/${receipt.id}/print`}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column — Receipt Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Receipt Info Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-emerald-500" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Left: Client + Bill */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Client</span>
                  <Link
                    href={`/dashboard/officer/clients/${receipt.client_id}`}
                    className="text-base font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline block mt-0.5"
                  >
                    {receipt.client_name}
                  </Link>
                  <span className="text-xs font-mono text-slate-500 block">{receipt.client_reference_number}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Linked Demand Bill</span>
                  <Link
                    href={`/dashboard/officer/demand-bills/${receipt.demand_bill_id}`}
                    className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    {receipt.demand_bill_reference}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Billing Year</span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5">{receipt.year_of_billing}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Due Date</span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5">{formatDate(receipt.due_date)}</span>
                  </div>
                </div>
              </div>

              {/* Right: Payment Summary */}
              <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Payment Summary</span>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, (receipt.total_amount_paid / receipt.total_bill_amount) * 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/50">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Billed</span>
                    <span className="text-xs font-black text-slate-800 block mt-0.5">{formatNaira(receipt.total_bill_amount)}</span>
                  </div>
                  <div className="border-l border-r border-slate-200 px-2 text-center">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block">Paid</span>
                    <span className="text-xs font-black text-emerald-700 block mt-0.5">{formatNaira(receipt.total_amount_paid)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-rose-500 uppercase block">Balance</span>
                    <span className={`text-xs font-black block mt-0.5 ${receipt.outstanding_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatNaira(receipt.outstanding_balance)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Last Payment</span>
                    <span className="font-bold text-slate-800 block mt-0.5">{formatNaira(receipt.last_payment_amount)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Last Date</span>
                    <span className="font-bold text-slate-800 block mt-0.5">{formatDate(receipt.last_payment_date)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Method</span>
                    <span className="font-bold text-slate-800 block mt-0.5">
                      {receipt.last_payment_method === 'flutterwave' ? 'Online / Flutterwave' : 'Manual Bank Transfer'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Payment History</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">{paymentsLog.length} transaction{paymentsLog.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-5">#</th>
                    <th className="py-2.5 px-5">Date & Time</th>
                    <th className="py-2.5 px-5 text-right">Amount Paid</th>
                    <th className="py-2.5 px-5">Method</th>
                    <th className="py-2.5 px-5">Reference</th>
                    <th className="py-2.5 px-5">Recorded By</th>
                    <th className="py-2.5 px-5 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paymentsLog.map((entry) => (
                    <tr key={entry.payment_number} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-3 px-5">
                        <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black flex items-center justify-center">
                          {entry.payment_number}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-600 font-semibold">
                        {formatDateTime(entry.date)}
                      </td>
                      <td className="py-3 px-5 text-right text-sm font-black text-emerald-700">
                        {formatNaira(entry.amount)}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          entry.method === 'flutterwave'
                            ? 'bg-violet-50 text-violet-700 border border-violet-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {entry.method === 'flutterwave' ? 'Flutterwave' : 'Bank Transfer'}
                        </span>
                        {entry.bank_name && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">{entry.bank_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <span className="font-mono text-xs text-slate-600 font-semibold break-all">
                          {entry.transaction_ref || entry.teller_ref || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-500 font-medium">{entry.recorded_by}</td>
                      <td className="py-3 px-5 text-right">
                        <span className={`text-xs font-black ${entry.balance_after > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatNaira(entry.balance_after)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receipt Audit Log */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-5 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Receipt Audit Log
            </h3>

            <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
              {auditLogs.map((log) => {
                let dotColor = 'border-slate-400';
                let badgeBg = 'bg-slate-50 text-slate-600 border-slate-200';
                if (log.change_type === 'receipt_created') { dotColor = 'border-amber-500'; badgeBg = 'bg-amber-50 text-amber-700 border-amber-200'; }
                else if (log.change_type === 'receipt_updated_partial') { dotColor = 'border-indigo-500'; badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200'; }
                else if (log.change_type === 'receipt_updated_final') { dotColor = 'border-emerald-500'; badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }

                return (
                  <div key={log.id} className="relative">
                    <div className={`absolute -left-[24.5px] top-1.5 w-3 h-3 rounded-full border-2 bg-white ${dotColor}`} />
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTime(log.created_at)}</span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${badgeBg}`}>
                          {log.change_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{log.note}</p>
                      <div className="flex flex-wrap gap-4 mt-1 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-semibold text-slate-600">
                        <span>Paid: <strong className="text-slate-800">{formatNaira(log.amount_paid_this_transaction)}</strong></span>
                        <span>Total After: <strong className="text-emerald-700">{formatNaira(log.total_paid_after)}</strong></span>
                        <span>Balance: <strong className={log.balance_remaining_after > 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatNaira(log.balance_remaining_after)}</strong></span>
                        <span>By: <strong className="text-slate-700">{log.changed_by_label}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column — Demand Bill Preview */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden sticky top-4">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Demand Bill Preview</span>
              </div>
              <Link
                href={`/dashboard/officer/demand-bills/${receipt.demand_bill_id}/print?copy=customer`}
                target="_blank"
                className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"
              >
                Print <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="p-5 space-y-4">
              {/* Client info */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Taxpayer</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{receipt.client_name}</span>
                <span className="text-xs text-slate-500 block">{receipt.client_address}</span>
                {receipt.client_ward && (
                  <span className="text-[10px] text-slate-400 font-medium block">Ward: {receipt.client_ward}</span>
                )}
              </div>

              {/* Bill ref */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <span className="text-[9px] font-black text-amber-600 uppercase block">Bill Reference</span>
                <span className="font-mono text-sm font-black text-amber-800 block mt-0.5">{receipt.demand_bill_reference}</span>
                <span className="text-[10px] text-amber-600/80 font-medium mt-1 block">Year: {receipt.year_of_billing}</span>
              </div>

              {/* Levy items */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Levy Items</span>
                <div className="space-y-1.5">
                  {(receipt.demand_bill_levy_items || []).map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-700 block truncate">{item.name}</span>
                        {item.category_name && (
                          <span className="text-[9px] text-slate-400 font-medium">{item.category_name}</span>
                        )}
                      </div>
                      <span className="font-black text-slate-800 shrink-0">{formatNaira(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Subtotal:</span>
                  <span>{formatNaira(receipt.demand_bill_subtotal)}</span>
                </div>
                {receipt.demand_bill_arrears > 0 && (
                  <div className="flex justify-between text-slate-500 font-semibold">
                    <span>Arrears:</span>
                    <span>{formatNaira(receipt.demand_bill_arrears)}</span>
                  </div>
                )}
                {receipt.demand_bill_penalty > 0 && (
                  <div className="flex justify-between text-slate-500 font-semibold">
                    <span>Penalty:</span>
                    <span>{formatNaira(receipt.demand_bill_penalty)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-800 text-sm border-t border-slate-100 pt-2">
                  <span>Grand Total:</span>
                  <span className="text-amber-700">{formatNaira(receipt.demand_bill_grand_total)}</span>
                </div>
                {receipt.total_amount_paid > 0 && (
                  <>
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Total Paid:</span>
                      <span>{formatNaira(receipt.total_amount_paid)}</span>
                    </div>
                    <div className={`flex justify-between font-black text-sm ${receipt.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      <span>Balance:</span>
                      <span>{formatNaira(receipt.outstanding_balance)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Bill status badge */}
              <div className="flex items-center justify-between pt-1">
                <span className={`px-2.5 py-1 text-[10px] font-black border rounded-lg uppercase tracking-wider flex items-center gap-1 ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {isPaid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {isPaid ? 'Fully Paid' : 'Partially Paid'}
                </span>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-semibold block">Receipt</span>
                  <span className="text-[10px] font-mono font-bold text-amber-700">{receipt.reference_number}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
