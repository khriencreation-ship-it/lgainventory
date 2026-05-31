'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Printer, 
  CreditCard, 
  Clock, 
  User, 
  Building, 
  Calendar, 
  FileText, 
  TrendingUp, 
  Loader2,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import Toast from '@/components/Toast';

interface LevyItem {
  name: string;
  description: string;
  amount: number;
  category_id?: string;
  category_name?: string;
  levy_id?: string;
  levy_name?: string;
}

interface StatusLog {
  id: string;
  status: 'unpaid' | 'paid' | 'overdue' | 'partially_paid';
  changed_by_label: string;
  change_type: 'created' | 'manual_payment' | 'qr_payment' | 'overdue_flagged' | 'partial_payment_flutterwave' | 'partial_payment_manual' | 'payment_completed_flutterwave' | 'payment_completed_manual';
  note: string;
  metadata?: any;
  created_at: string;
}

interface ReceiptSummary {
  id: string;
  reference_number: string;
  payment_status: 'partially_paid' | 'paid';
  total_amount_paid: number;
  outstanding_balance: number;
  last_payment_date: string;
  created_at: string;
}

interface LgBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_primary: boolean;
}

interface DemandBillDetail {
  id: string;
  reference_number: string;
  client_id: string;
  client_name: string;
  client_reference_number: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  client_ward: string | null;
  created_by: string;
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
  lg_bank_name: string | null;
  lg_bank_account_number: string | null;
  lg_bank_account_name: string | null;
  lg_bank_accounts: LgBankAccount[];
  state_name: string;
  state_logo_url: string | null;
}

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'EcoBank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '090479', name: 'First Heritage Microfinance Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '000030', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '090267', name: 'Kuda Bank' },
  { code: '100004', name: 'Opay' },
  { code: '100033', name: 'PalmPay' },
  { code: '327', name: 'Paga' },
  { code: '090110', name: 'VFD Microfinance Bank' }
];

export default function DemandBillDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [bill, setBill] = useState<DemandBillDetail | null>(null);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  
  // Manual payment form fields
  const [bankName, setBankName] = useState('');
  const [tellerRef, setTellerRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [manualAmount, setManualAmount] = useState('');

  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Dropdowns for printing
  const [billDropdownOpen, setBillDropdownOpen] = useState(false);
  const [receiptDropdownOpen, setReceiptDropdownOpen] = useState(false);

  const fetchBillDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/officer/demand-bills/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch demand bill');
      }
      setBill(data.bill);
      setLogs(data.logs || []);
      setReceipt(data.receipt || null);
    } catch (err: any) {
      setToastType('error');
      setToastMessage(err.message || 'Failed to load demand bill details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchBillDetails();
    }
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !tellerRef.trim() || !paymentDate || !bill) {
      setToastType('error');
      setToastMessage('Please fill all required manual payment fields.');
      return;
    }

    const amt = paymentType === 'partial' ? parseFloat(manualAmount) : bill.balance_due;
    if (paymentType === 'partial') {
      if (isNaN(amt) || amt <= 0) {
        setToastType('error');
        setToastMessage('Please enter a valid amount greater than zero.');
        return;
      }
      if (amt > bill.balance_due + 0.01) {
        setToastType('error');
        setToastMessage(`Payment amount cannot exceed outstanding balance of ${formatNaira(bill.balance_due)}.`);
        return;
      }
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch(`/api/officer/demand-bills/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: bankName,
          teller_ref: tellerRef,
          payment_date: paymentDate,
          note: paymentNote,
          amount: amt,
          payment_type: paymentType
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record manual payment');
      }
      setToastType('success');
      setToastMessage('Manual payment has been recorded successfully!');
      setModalOpen(false);
      
      // Clear inputs
      setBankName('');
      setTellerRef('');
      setPaymentNote('');
      setPaymentType('full');
      setManualAmount('');
      
      // Refresh details
      await fetchBillDetails();
    } catch (err: any) {
      setToastType('error');
      setToastMessage(err.message || 'Failed to submit manual payment confirmation.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getDisplayStatus = () => {
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

  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading && !bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Loading bill detail dossier...</p>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center text-slate-450 mx-auto mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Demand Bill Not Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
          This demand bill record could not be loaded. It may not exist, or you may not have authorization to view invoices outside your LG workspace.
        </p>
        <Link
          href="/dashboard/officer/demand-bills"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Return to Bills Ledger
        </Link>
      </div>
    );
  }

  const statusInfo = getDisplayStatus();

  const uniqueCategories = bill.levy_items
    ? Array.from(new Set(bill.levy_items.map(item => item.category_name || 'General Levy')))
    : [];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Header section with back & print triggers */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/officer/demand-bills" 
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Demand Bills Ledger</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Details</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{bill.reference_number}</h1>
            <span className={`px-2.5 py-0.5 text-[10px] font-black border rounded-lg uppercase tracking-wider ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
          </div>
          {uniqueCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {uniqueCategories.map((cat, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          
          {/* Print Demand Bill Dropdown Button */}
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
              <div className="absolute left-0 mt-1.5 w-44 bg-white border border-slate-200 shadow-lg rounded-xl z-20 py-1.5 animate-fade-in">
                <Link
                  href={`/dashboard/officer/demand-bills/${bill.id}/print?copy=customer`}
                  target="_blank"
                  onClick={() => setBillDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print Customer Copy
                </Link>
                <Link
                  href={`/dashboard/officer/demand-bills/${bill.id}/print?copy=lg`}
                  target="_blank"
                  onClick={() => setBillDropdownOpen(false)}
                  className="block px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Print LG Copy
                </Link>
              </div>
            )}
          </div>

          {/* Print Receipt Dropdown Button — appears as soon as a receipt exists */}
          {receipt && (
            <div className="relative">
              <button
                onClick={() => {
                  setReceiptDropdownOpen(!receiptDropdownOpen);
                  setBillDropdownOpen(false);
                }}
                className={`px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  receipt.payment_status === 'paid'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Receipt className="h-4 w-4" />
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
          )}

          {bill.payment_status !== 'paid' && (
            <button
              onClick={() => {
                setModalOpen(true);
                setPaymentType('full');
                setManualAmount(bill.balance_due.toString());
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          )}

          <Link
            href={`/pay/${bill.id}`}
            target="_blank"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Public Checkout</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Invoice Summary + Items Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Summary Overview Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            {/* Top color strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-indigo-500" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Client Details</span>
                  <Link 
                    href={`/dashboard/officer/clients/${bill.client_id}`}
                    className="text-base font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline transition block mt-0.5"
                  >
                    {bill.client_name}
                  </Link>
                  <span className="text-xs text-slate-500 font-mono font-medium block mt-0.5">{bill.client_reference_number}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Phone Number</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{bill.client_phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ward</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{bill.client_ward || 'Not Assigned'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Billing Address</span>
                  <span className="text-xs text-slate-600 block mt-0.5 leading-relaxed">{bill.client_address}</span>
                </div>
              </div>

              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">Payment Progress</span>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (bill.amount_paid / bill.grand_total) * 100)}%` }}
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
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Due Date</span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {new Date(bill.due_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Billing Year</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{bill.year_of_billing}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-slate-400" />
                <span>LG Workspace: <strong className="text-slate-700">{bill.lg_name}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span>Generated By: <strong className="text-slate-700">{bill.creator_name || 'System'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Created Date: <strong className="text-slate-700">{new Date(bill.created_at).toLocaleDateString('en-GB')}</strong></span>
              </div>
            </div>
          </div>

          {/* Levy Table Breakdown Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-850">Levy Breakdown Matrix</span>
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Levy Item Name</th>
                  <th className="py-3 px-6">Description / Subhead</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
                {bill.levy_items && bill.levy_items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                    <td className="py-3 px-6 font-semibold text-slate-600 text-xs">{item.category_name || 'General Levy'}</td>
                    <td className="py-3 px-6 font-bold text-slate-800">{item.name}</td>
                    <td className="py-3 px-6 text-slate-500 text-xs">{item.description}</td>
                    <td className="py-3 px-6 font-bold text-slate-900 text-right">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations Panel */}
            <div className="bg-slate-50/60 border-t border-slate-100 p-6 flex flex-col items-end space-y-2">
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-500">
                <span>Subtotal Levies:</span>
                <span className="text-slate-700 font-bold">{formatNaira(bill.subtotal)}</span>
              </div>
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-500">
                <span>Arrears / Past Debts:</span>
                <span className="text-slate-750 font-bold">{formatNaira(bill.arrears)}</span>
              </div>
              <div className="w-full max-w-xs flex justify-between text-xs font-semibold text-slate-500">
                <span>Accrued Penalty:</span>
                <span className="text-slate-750 font-bold">{formatNaira(bill.penalty)}</span>
              </div>
              <div className="w-full max-w-xs border-t border-slate-200/80 pt-2 flex justify-between text-sm font-black text-slate-800">
                <span>Grand Total:</span>
                <span className="text-amber-800 text-base">{formatNaira(bill.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Payment Info & Timeline Audit */}
        <div className="space-y-6">
          
          {/* Payment Info Card (If Paid or Partially Paid) */}
          {(bill.payment_status === 'paid' || bill.payment_status === 'partially_paid') && (bill.payment_method || bill.manual_payment_bank) && (
            <div className={`bg-gradient-to-br ${bill.payment_status === 'paid' ? 'from-emerald-600 to-teal-700 border-emerald-500/20' : 'from-indigo-600 to-indigo-700 border-indigo-500/20'} text-white rounded-3xl p-6 shadow-md relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
              
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-6 w-6 text-emerald-250 shrink-0" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {bill.payment_status === 'paid' ? 'Payment Settled' : 'Partial Payment Posted'}
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="pb-2.5 border-b border-white/10">
                  <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Payment Method</span>
                  <span className="text-sm font-bold block mt-0.5">
                    {bill.payment_method === 'flutterwave' ? 'Online Card / QR Splitted Payment' : 'Manual Bank Transfer Posting'}
                  </span>
                </div>

                {bill.payment_method === 'flutterwave' ? (
                  <div>
                    <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Flutterwave Transaction ID</span>
                    <span className="font-mono text-white/95 block mt-0.5 tracking-tight break-all">{bill.flutterwave_transaction_id}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    <div>
                      <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Receiving Bank</span>
                      <span className="font-bold block mt-0.5">{bill.manual_payment_bank}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Teller / Slip Ref</span>
                      <span className="font-mono block mt-0.5 font-bold">{bill.manual_payment_teller_ref}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Post Date</span>
                      <span className="block mt-0.5">
                        {bill.manual_payment_date ? new Date(bill.manual_payment_date).toLocaleDateString('en-GB') : 'Unknown'}
                      </span>
                    </div>
                    {bill.manual_payment_note && (
                      <div>
                        <span className="text-[10px] text-emerald-200 font-semibold block uppercase">Notes</span>
                        <p className="text-white/85 text-xs italic mt-0.5 font-medium leading-relaxed">{bill.manual_payment_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Designated Remittance Bank Accounts */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Building className="h-4 w-4 text-slate-400" />
              <span>settlement account for online payment</span>
            </h3>
            
            <div className="space-y-3">
              {(() => {
                const primaryAccount = bill.lg_bank_accounts?.find(acc => acc.is_primary);
                if (primaryAccount) {
                  const bankName = NIGERIAN_BANKS.find(b => b.code === primaryAccount.bank_name)?.name || primaryAccount.bank_name;
                  return (
                    <div className="p-3 border rounded-2xl relative text-xs border-amber-500/30 bg-amber-50/10">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800">{bankName}</span>
                      </div>
                      <div className="mt-1.5 font-mono text-sm font-black text-slate-900 flex items-center justify-between">
                        <span className="select-all">{primaryAccount.account_number}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(primaryAccount.account_number);
                            setToastType('success');
                            setToastMessage('Account number copied to clipboard!');
                          }}
                          className="text-[9px] font-bold text-indigo-650 hover:text-indigo-855 hover:underline cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-505 font-bold mt-1.5">
                        Account Name: <span className="text-slate-700">{primaryAccount.account_name}</span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 border border-slate-150 rounded-2xl bg-slate-50/50 text-xs">
                      <div className="flex justify-between font-bold text-slate-855">
                        <span>{NIGERIAN_BANKS.find(b => b.code === bill.lg_bank_name)?.name || bill.lg_bank_name || 'Designated Partner Bank'}</span>
                        <span className="font-mono">{bill.lg_bank_account_number || '----------'}</span>
                      </div>
                      <div className="text-[10px] text-slate-505 font-bold mt-1.5">
                        Account Name: <span className="text-slate-700">{bill.lg_bank_account_name || `${bill.lg_name} LG Revenue`}</span>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          {/* Receipt Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span>Receipt</span>
            </h3>

            {!receipt ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                  <Receipt className="h-5 w-5 text-slate-350" />
                </div>
                <p className="text-xs font-semibold text-slate-400 max-w-[200px] leading-relaxed">
                  No receipt generated yet — receipt will appear once the first payment is confirmed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Ref + Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    {receipt.reference_number}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-black border rounded-lg uppercase tracking-wide ${
                    receipt.payment_status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {receipt.payment_status === 'paid' ? 'Fully Paid' : 'Partially Paid'}
                  </span>
                </div>

                {/* Balance */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Total Paid</span>
                    <span className="text-sm font-black text-emerald-700 block mt-0.5">
                      {'₦' + receipt.total_amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className={`border rounded-xl p-2.5 ${
                    receipt.outstanding_balance > 0
                      ? 'bg-rose-50/60 border-rose-100'
                      : 'bg-emerald-50/60 border-emerald-100'
                  }`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                      receipt.outstanding_balance > 0 ? 'text-rose-500' : 'text-emerald-600'
                    }`}>Balance</span>
                    <span className={`text-sm font-black block mt-0.5 ${
                      receipt.outstanding_balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {'₦' + receipt.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/dashboard/officer/receipts/${receipt.id}`}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-1"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    View Receipt
                  </Link>
                  <Link
                    href={`/dashboard/officer/receipts/${receipt.id}/print`}
                    target="_blank"
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Audit History Logs Timeline */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-850 mb-5 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Status Audit Trails</span>
            </h3>

            <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-6">
              {logs.map((log) => {
                let badgeColor = 'bg-slate-100 text-slate-655 border-slate-200';
                if (log.status === 'paid') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                else if (log.status === 'partially_paid') badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                else if (log.status === 'overdue') badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                else if (log.status === 'unpaid') badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';

                return (
                  <div key={log.id} className="relative">
                    {/* Circle Dot Marker */}
                    <div className={`absolute -left-[24.5px] top-1.5 w-3 h-3 rounded-full border-2 bg-white ${
                      log.status === 'paid' ? 'border-emerald-500' : log.status === 'partially_paid' ? 'border-indigo-500' : log.status === 'overdue' ? 'border-amber-500' : 'border-rose-450'
                    }`} />
                    
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(log.created_at).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-black rounded border uppercase tracking-wider ${badgeColor}`}>
                          {log.status === 'partially_paid' ? 'partially paid' : log.status}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{log.note}</p>

                      {log.metadata && (
                        <div className="mt-1.5 p-2 bg-slate-50 border border-slate-150 rounded-lg space-y-0.5 text-[10px] font-medium text-slate-600 font-sans">
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
                              <span className="text-slate-400">Teller ID:</span>
                              <span className="font-mono text-slate-800">{log.metadata.teller_ref}</span>
                            </div>
                          )}
                          {log.metadata.bank_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Bank:</span>
                              <span className="font-bold text-slate-700">{log.metadata.bank_name}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-[10px] text-slate-455 font-bold">
                        Actor: <span className="text-slate-600">{log.changed_by_label}</span> 
                        <span className="mx-1 text-slate-300">•</span>
                        Type: <span className="text-slate-600 capitalize">{log.change_type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Payment Submission Modal/Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Record Bank Transfer Payment</h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {/* Full vs Partial Selection */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Payment Settlement Option *
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all ${paymentType === 'full' ? 'border-amber-500 bg-amber-50/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="modalPaymentType" 
                      value="full" 
                      checked={paymentType === 'full'}
                      onChange={() => setPaymentType('full')}
                      className="accent-amber-600"
                    />
                    <span className="text-xs font-bold text-slate-805">Full ({formatNaira(bill.balance_due)})</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all ${paymentType === 'partial' ? 'border-amber-500 bg-amber-50/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="modalPaymentType" 
                      value="partial" 
                      checked={paymentType === 'partial'}
                      onChange={() => {
                        setPaymentType('partial');
                        setManualAmount('');
                      }}
                      className="accent-amber-600"
                    />
                    <span className="text-xs font-bold text-slate-805">Partial</span>
                  </label>
                </div>
              </div>

              {/* Partial Amount Input */}
              {paymentType === 'partial' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                    Amount to Pay (₦) *
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-black text-sm font-bold" style={{ color: '#000000' }}>₦</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={bill.balance_due}
                      placeholder={`Max: ${bill.balance_due}`}
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      style={{ color: '#000000', colorScheme: 'light' }}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Deposit Bank Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Access Bank, First Bank, Wema Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  style={{ color: '#000000', colorScheme: 'light' }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Teller / Transaction reference ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. POST-1882881-A2"
                  value={tellerRef}
                  onChange={(e) => setTellerRef(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  style={{ color: '#000000', colorScheme: 'light' }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Date of Payment *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  style={{ color: '#000000', colorScheme: 'light' }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add any details like depositor's name or branch details..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  style={{ color: '#000000', colorScheme: 'light' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/60 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <span>Confirm Settlement</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
