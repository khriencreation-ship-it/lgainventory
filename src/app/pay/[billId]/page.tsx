'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  Building, 
  FileSpreadsheet,
  AlertTriangle,
  Printer
} from 'lucide-react';
import Link from 'next/link';

interface LevyItem {
  name: string;
  description: string;
  amount: number;
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
  created_at: string;
  lg_name: string;
  lg_logo_url: string | null;
  lg_bank_name: string | null;
  lg_bank_account_number: string | null;
  lg_bank_account_name: string | null;
  lg_bank_accounts: LgBankAccount[];
  state_name: string;
  state_logo_url: string | null;
  is_overdue: boolean;
}

interface ReceiptDetail {
  receipt_number: string;
  generated_at: string;
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

export default function PublicPayPage() {
  const { billId } = useParams();
  const searchParams = useSearchParams();

  const [copiedAcc, setCopiedAcc] = useState<string | null>(null);
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAcc(text);
    setTimeout(() => setCopiedAcc(null), 2000);
  };

  const [bill, setBill] = useState<DemandBillDetail | null>(null);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [paymentFormError, setPaymentFormError] = useState<string>('');

  // Polling states for redirect callbacks
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Check if URL parameters indicate a redirect from Flutterwave
  const statusParam = searchParams.get('status');

  const fetchBillDetails = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/pay/${billId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }
      setBill(data.bill);
      setReceipt(data.receipt);
      return data.bill;
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading');
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    const transactionIdParam = searchParams.get('transaction_id');

    async function verifyAndLoad() {
      if (statusParam === 'successful' || statusParam === 'success' || statusParam === 'completed') {
        if (transactionIdParam) {
          setVerifying(true);
          try {
            const verifyRes = await fetch(`/api/pay/${billId}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transaction_id: transactionIdParam })
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setVerificationSuccess(true);
            } else {
              setError(verifyData.error || 'Failed to verify payment with the gateway');
            }
          } catch (err: any) {
            console.error('Error verifying payment:', err);
            setError('An error occurred during payment verification.');
          } finally {
            setVerifying(false);
          }
        }
      }
      // Load latest bill details to update screen view
      await fetchBillDetails();
    }

    if (billId) {
      verifyAndLoad();
    }
  }, [billId, statusParam, searchParams]);

  const handlePayNow = async () => {
    if (!bill) return;
    setPaymentLoading(true);
    setError('');
    setPaymentFormError('');
    
    const amtToPay = paymentType === 'partial' ? parseFloat(partialAmount) : bill.balance_due;
    
    if (paymentType === 'partial') {
      if (isNaN(amtToPay) || amtToPay <= 0) {
        setPaymentFormError('Please enter a valid amount greater than zero.');
        setPaymentLoading(false);
        return;
      }
      if (amtToPay > bill.balance_due + 0.01) {
        setPaymentFormError(`Payment amount cannot exceed outstanding balance of ${formatNaira(bill.balance_due)}.`);
        setPaymentLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/pay/${billId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: window.location.origin,
          amount: amtToPay,
          payment_type: paymentType
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Initialization failed');
      }
      
      // Redirect user to Flutterwave hosted checkout link
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        throw new Error('Payment link not returned by checkout server');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize checkout session. Please try again.');
      setPaymentLoading(false);
    }
  };

  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (loading && !verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-50">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Retrieving demand bill details...</p>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50 p-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-emerald-600 animate-spin" />
          <CheckCircle2 className="h-5 w-5 text-emerald-500 absolute bottom-0 right-0 bg-white rounded-full" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Verifying Settlement Posting</h2>
          <p className="text-xs text-slate-450 max-w-xs leading-normal">
            We are confirming your payment with Flutterwave and posting the transaction to the local government registry. Please do not close this window.
          </p>
        </div>
      </div>
    );
  }

  if (error && !bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 bg-slate-50">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h2 className="text-sm font-black text-slate-800 uppercase">Error Retrieving Bill</h2>
          <p className="text-xs text-slate-455 mt-1 max-w-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 bg-slate-50">
        <AlertCircle className="h-12 w-12 text-slate-400" />
        <h2 className="text-sm font-black text-slate-800 uppercase">Bill not found</h2>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          The requested invoice does not exist or has been deleted from the registry.
        </p>
      </div>
    );
  }

  const parsedAmount = parseFloat(partialAmount);
  const amountExceeded = paymentType === 'partial' && !isNaN(parsedAmount) && parsedAmount > bill.balance_due + 0.01;
  const amountZeroOrLess = paymentType === 'partial' && !isNaN(parsedAmount) && parsedAmount <= 0;
  const isInvalidPartialAmount = paymentType === 'partial' && (
    isNaN(parsedAmount) || 
    parsedAmount <= 0 || 
    parsedAmount > bill.balance_due + 0.01
  );
  const isPayButtonDisabled = paymentLoading || isInvalidPartialAmount;

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 flex flex-col items-center justify-center">
      
      {/* Standalone print style to allow taxpayers to print this page directly as their online receipt */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-receipt-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="print-receipt-card w-full max-w-2xl bg-white text-slate-900 border border-slate-200 rounded-3xl shadow-lg overflow-hidden transition-all duration-300 relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-600" />

        {/* Brand / Logo header section */}
        <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {bill.state_logo_url ? (
              <img 
                src={bill.state_logo_url} 
                alt={bill.state_name} 
                className="w-12 h-12 object-contain bg-slate-50 border border-slate-200 p-0.5 rounded-xl shrink-0" 
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-black text-[9px] text-center p-1 leading-tight shrink-0">
                {bill.state_name.substring(0, 3).toUpperCase()} GOV
              </div>
            )}
            <div>
              <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest block">State Government Portal</span>
              <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">{bill.state_name}</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{bill.lg_name} Local Government</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Bill Reference</span>
            <span className="font-black text-slate-800 font-mono tracking-tight text-sm block mt-0.5">{bill.reference_number}</span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Success banner if paid */}
          {bill.payment_status === 'paid' && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-800">
                <h3 className="text-sm font-black uppercase text-emerald-800 tracking-wider">Payment Confirmed</h3>
                <p className="text-xs leading-relaxed text-emerald-700">
                  This demand notice has been fully settled and updated in the {bill.state_name} Local Government Revenue ledger. Thank you for your remittance.
                </p>
                {receipt && (
                  <div className="pt-2 text-[10px] font-bold text-emerald-800">
                    Receipt Ref: <span className="font-mono">{receipt.receipt_number}</span>
                    <span className="mx-2 text-emerald-300">•</span>
                    Settled Date: {new Date(receipt.generated_at).toLocaleString('en-GB')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Banner for partial payment success confirmation */}
          {bill.payment_status === 'partially_paid' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4 animate-fade-in">
              <CheckCircle2 className="h-6 w-6 text-indigo-650 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-800">
                <h3 className="text-sm font-black uppercase text-indigo-850 tracking-wider">Partial Payment Confirmed</h3>
                <p className="text-xs leading-relaxed text-indigo-700">
                  Your partial payment has been successfully recorded. An outstanding balance of <strong>{formatNaira(bill.balance_due)}</strong> remains on this demand notice. You can settle the remaining balance below.
                </p>
              </div>
            </div>
          )}

          {/* Warning banner if overdue and unpaid/partially paid */}
          {bill.is_overdue && bill.payment_status !== 'paid' && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-0.5">
                <h4 className="font-black uppercase tracking-wider text-amber-900">Overdue Bill Notice</h4>
                <p className="leading-relaxed">
                  This bill has passed its due date of <strong>{new Date(bill.due_date).toLocaleDateString('en-GB')}</strong>. Please settle this demand notice immediately to avoid enforcement actions or accrued penalties.
                </p>
              </div>
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 border border-slate-100 rounded-2xl p-5 text-xs">
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Client Details</span>
                <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">{bill.client_name}</strong>
                <span className="text-[10px] text-slate-500 font-mono font-medium block mt-0.5">ID: {bill.client_reference_number}</span>
              </div>
              
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tax Location Address</span>
                <p className="text-slate-650 leading-relaxed mt-0.5">{bill.client_address}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Remittance Summary</span>
                <div className="grid grid-cols-3 gap-2 border border-slate-200/60 rounded-xl p-3 bg-white shadow-sm">
                  <div className="text-center">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
                    <span className="text-[10px] font-black text-slate-800 block mt-0.5">{formatNaira(bill.grand_total)}</span>
                  </div>
                  <div className="text-center border-l border-r border-slate-105">
                    <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider block">Paid</span>
                    <span className="text-[10px] font-black text-emerald-700 block mt-0.5">{formatNaira(bill.amount_paid)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-wider block">Balance</span>
                    <span className="text-[10px] font-black text-indigo-700 block mt-0.5">{formatNaira(bill.balance_due)}</span>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 italic font-medium block mt-1 leading-snug">{bill.amount_in_words}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-200/50 pt-3 mt-4 text-[10px] font-bold text-slate-500">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Due Date</span>
                  <span className="text-slate-800 block mt-0.5">
                    {new Date(bill.due_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Fiscal Period</span>
                  <span className="text-slate-800 block mt-0.5">Year {bill.year_of_billing}</span>
                </div>
              </div>
            </div>
          </div>



          {/* Assessment Breakdown Table */}
          <div className="border border-slate-200/60 rounded-2xl overflow-hidden text-xs">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Official Assessment Breakdown</span>
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-5">Levy Description</th>
                  <th className="py-2.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {bill.levy_items && bill.levy_items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/10 transition-colors">
                    <td className="py-2.5 px-5 leading-normal">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-450 mt-0.5">{item.description}</div>
                    </td>
                    <td className="py-2.5 px-5 font-bold text-slate-900 text-right">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Assessment calculations */}
            <div className="bg-slate-50/40 border-t border-slate-150 p-4 flex flex-col items-end space-y-1">
              <div className="w-56 flex justify-between text-[10px] font-bold text-slate-500">
                <span>Subtotal Levies:</span>
                <span className="text-slate-700">{formatNaira(bill.subtotal)}</span>
              </div>
              {bill.arrears > 0 && (
                <div className="w-56 flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Arrears:</span>
                  <span className="text-slate-700">{formatNaira(bill.arrears)}</span>
                </div>
              )}
              {bill.penalty > 0 && (
                <div className="w-56 flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Penalty:</span>
                  <span className="text-slate-700">{formatNaira(bill.penalty)}</span>
                </div>
              )}
              <div className="w-56 border-t border-slate-200/80 pt-1.5 flex justify-between text-xs font-black text-slate-900 uppercase">
                <span>Total Remittance:</span>
                <span>{formatNaira(bill.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer payment trigger panel (hidden if paid) */}
        {bill.payment_status !== 'paid' && !verificationSuccess ? (
          <div className="px-6 sm:px-8 py-6 bg-slate-50 border-t border-slate-150 space-y-4 no-print">
            
            {/* Full vs Partial Selection */}
            <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Choose Settlement Method</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Full Payment Option */}
                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentType === 'full' ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="paymentType" 
                    value="full" 
                    checked={paymentType === 'full'}
                    onChange={() => {
                      setPaymentType('full');
                      setPaymentFormError('');
                    }}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Full Settlement</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Pay outstanding balance of {formatNaira(bill.balance_due)}</span>
                  </div>
                </label>

                {/* Partial Payment Option */}
                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentType === 'partial' ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="paymentType" 
                    value="partial" 
                    checked={paymentType === 'partial'}
                    onChange={() => {
                      setPaymentType('partial');
                      setPartialAmount('');
                      setPaymentFormError('');
                    }}
                    className="mt-0.5 accent-indigo-650"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Partial Settlement</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Pay a custom amount towards your balance</span>
                  </div>
                </label>
              </div>

              {/* Partial Amount Input Form */}
              {paymentType === 'partial' && (
                <div className="pt-2">
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Enter Amount to Pay (₦)</label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-black text-xs font-bold" style={{ color: '#000000' }}>₦</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={bill.balance_due}
                      value={partialAmount}
                      onChange={(e) => {
                        setPartialAmount(e.target.value);
                        setPaymentFormError('');
                      }}
                      placeholder="e.g. 5000"
                      className={`block w-full pl-7 pr-3 py-2.5 border rounded-xl text-xs font-bold text-black focus:outline-none bg-white ${
                        amountExceeded ? 'border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      style={{ color: '#000000', colorScheme: 'light' }}
                    />
                  </div>
                  {amountExceeded && (
                    <p className="text-[10px] text-red-655 font-extrabold mt-1.5 animate-pulse">
                      ⚠️ Amount cannot exceed the remaining balance of {formatNaira(bill.balance_due)}
                    </p>
                  )}
                  {amountZeroOrLess && (
                    <p className="text-[10px] text-red-655 font-extrabold mt-1.5 animate-pulse">
                      ⚠️ Please enter an amount greater than zero
                    </p>
                  )}
                </div>
              )}

              {paymentFormError && (
                <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[10px] font-semibold text-red-650 flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{paymentFormError}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Building className="h-5 w-5 text-indigo-600" />
                <span>Secured Online Settlement via Flutterwave</span>
              </div>
              
              <button
                onClick={handlePayNow}
                disabled={isPayButtonDisabled}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-650/60 text-white text-xs font-black rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider shrink-0"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading payment gateway...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Pay {formatNaira(paymentType === 'partial' ? parseFloat(partialAmount || '0') : bill.balance_due)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Footer printable receipt actions (shown if paid) */
          <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
            <span className="text-xs text-slate-500 font-semibold leading-relaxed">
              This invoice has been cleared. You can print or download this confirmation sheet as your official proof of payment.
            </span>
            
            <Link
              href={`/pay/${bill.id}/receipt`}
              target="_blank"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Print Receipt</span>
            </Link>
          </div>
        )}
      </div>

      {/* Official Legal Compliance note */}
      <div className="w-full max-w-2xl text-[10px] text-slate-400 leading-normal text-center mt-6 space-y-0.5 no-print px-4">
        <p>© 2026 {bill.state_name} Local Government Revenue Administration. All rights reserved.</p>
        <p className="italic">This portal operates under strict security and encryption parameters in compliance with public revenue administration laws.</p>
      </div>
    </div>
  );
}
