'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import Link from 'next/link';

interface LevyItem {
  name: string;
  description: string;
  amount: number;
  category_id?: string;
  category_name?: string;
  levy_id?: string;
  levy_name?: string;
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
  creator_signature_url: string | null;
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

function PrintDemandBillContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const copyType = searchParams.get('copy') || 'customer'; // customer or lg

  const [bill, setBill] = useState<DemandBillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [signatures, setSignatures] = useState<{
    treasurer: { name: string; signature_url: string | null } | null;
    chairman: { name: string; signature_url: string | null } | null;
  }>({ treasurer: null, chairman: null });

  useEffect(() => {
    async function fetchDetails() {
      if (!id) return;
      try {
        const res = await fetch(`/api/officer/demand-bills/${id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch details');
        }
        setBill(data.bill);
        if (data.signatures) setSignatures(data.signatures);

        // Generate QR code for the public checkout page
        const publicUrl = `${window.location.origin}/pay/${id}`;
        const qrDataUrl = await QRCode.toDataURL(publicUrl, {
          width: 140,
          margin: 1.5,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        });
        setQrCodeUrl(qrDataUrl);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading');
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 bg-white z-55">
        <Loader2 className="h-9 w-9 text-amber-600 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assembling printable layout...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 bg-white">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div className="text-center">
          <h2 className="text-sm font-black text-slate-800 uppercase">Error Loading Bill</h2>
          <p className="text-xs text-slate-455 mt-1 max-w-sm">{error || 'Demand bill data could not be retrieved.'}</p>
        </div>
        <Link
          href="/dashboard/chairman/demand-bills"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Back to Ledger
        </Link>
      </div>
    );
  }

  const copyLabelFormatted = copyType === 'lg' ? 'LOCAL GOVERNMENT COPY' : 'CUSTOMER COPY';

  return (
    <div className="min-h-screen bg-slate-100/35 p-0 sm:py-8 flex flex-col items-center relative">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          aside, header:not(.bill-doc-header), #chairman-sidebar, #chairman-header {
            display: none !important;
          }
          .md\\:ml-64 {
            margin-left: 0 !important;
          }
          main {
            padding: 0 !important;
          }
        }
        @media print {
          aside, header, #chairman-sidebar, #chairman-header, .no-print {
            display: none !important;
          }
          .md\\:ml-64 {
            margin-left: 0 !important;
          }
          main {
            padding: 0 !important;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
          }
          @page {
            size: A4;
            margin: 1.0cm 1.0cm 1.0cm 1.0cm;
          }
        }
      `}} />

      {/* Control bar */}
      <div className="no-print w-full max-w-[210mm] bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/chairman/demand-bills/${bill.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Details</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-455 font-bold uppercase tracking-wider mr-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
            Rendering: {copyLabelFormatted}
          </span>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Copy</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 dimensions: 210mm x 297mm) */}
      <div className="print-container w-full max-w-[210mm] bg-white border border-slate-300/80 rounded-none shadow-lg p-[15mm] flex flex-col justify-between text-slate-800 leading-snug font-sans min-h-[265mm] relative overflow-hidden">
        
        {/* Large Faded Background Logo Watermark */}
        {(bill.lg_logo_url || bill.state_logo_url) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] select-none z-0">
            <img 
              src={bill.lg_logo_url || bill.state_logo_url || ''} 
              alt="Watermark Logo" 
              className="w-[520px] h-[520px] object-contain grayscale"
            />
          </div>
        )}

        {/* Repeating Text Watermark Pattern */}
        <div className="absolute inset-0 pointer-events-none z-0 select-none overflow-hidden">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="demand-bill-pattern" width="240" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                <text x="0" y="30" fontFamily="sans-serif" fontSize="10" fontWeight="900" fill="#1e293b" opacity="0.025" letterSpacing="1.5">
                  DEMAND BILL      DEMAND BILL
                </text>
                <text x="120" y="70" fontFamily="sans-serif" fontSize="10" fontWeight="900" fill="#1e293b" opacity="0.025" letterSpacing="1.5">
                  DEMAND BILL      DEMAND BILL
                </text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#demand-bill-pattern)" />
          </svg>
        </div>

        <div className="space-y-6 z-10 relative">
          {/* Header block with logos */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-3">
              {bill.state_logo_url ? (
                <img 
                  src={bill.state_logo_url} 
                  alt={bill.state_name} 
                  className="w-14 h-14 object-contain bg-slate-50 border border-slate-200 p-0.5 rounded-lg" 
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-black text-[9px] text-center p-1 leading-tight">
                  {bill.state_name.toUpperCase()} STATE
                </div>
              )}
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-emerald-755 tracking-widest block leading-none">Republic of Nigeria</span>
                <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none">{bill.state_name}</h1>
                <p className="text-[9px] text-slate-500 font-bold uppercase">{bill.lg_name} Local Government</p>
                <p className="text-[7.5px] text-slate-400 font-medium">Headquarters, Revenue Administration Division</p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              {bill.lg_logo_url && (
                <img 
                  src={bill.lg_logo_url} 
                  alt={bill.lg_name} 
                  className="w-10 h-10 object-contain bg-slate-50 border border-slate-100 rounded-lg p-0.5 mb-1.5" 
                />
              )}
              <div className="px-3 py-1 bg-slate-950 text-white rounded font-black text-[10px] uppercase tracking-wider text-center">
                Demand Notice / Bill
                <span className="block text-[7.5px] font-bold text-amber-400 tracking-normal mt-0.5">{copyLabelFormatted}</span>
              </div>
              {bill.payment_status === 'partially_paid' && (
                <div className="mt-1.5 px-2 py-0.5 border border-indigo-500 bg-indigo-50 text-indigo-700 rounded text-[8.5px] font-black uppercase tracking-wider text-center">
                  Partially Paid
                </div>
              )}
              {bill.payment_status === 'paid' && (
                <div className="mt-1.5 px-2 py-0.5 border border-emerald-500 bg-emerald-50 text-emerald-700 rounded text-[8.5px] font-black uppercase tracking-wider text-center">
                  Paid In Full
                </div>
              )}
            </div>
          </div>

          {/* Bill Reference Info Box */}
          <div className="grid grid-cols-3 border border-slate-350 rounded-lg overflow-hidden text-[10px]">
            <div className="p-2 border-r border-slate-350 bg-slate-50/70">
              <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider block">Demand Notice Ref</span>
              <strong className="text-xs font-black text-slate-900 tracking-tight block mt-0.5">{bill.reference_number}</strong>
            </div>
            <div className="p-2 border-r border-slate-350">
              <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider block">Date of Assessment</span>
              <strong className="text-slate-800 font-bold block mt-0.5">
                {new Date(bill.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </strong>
            </div>
            <div className="p-2 bg-red-50/30">
              <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider block">Due Date (Final)</span>
              <strong className="text-red-755 font-black block mt-0.5">
                {new Date(bill.due_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </strong>
            </div>
          </div>

          {/* Client Details Section */}
          <div className="grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
            <div>
              <h3 className="text-[9px] font-black uppercase text-slate-455 tracking-wider mb-1 border-b border-slate-200 pb-0.5">
                Taxpayer / Debtor Details
              </h3>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">{bill.client_name}</p>
              <p className="text-slate-500 font-bold font-mono text-[9px] mt-0.5">ID: {bill.client_reference_number}</p>
              <p className="text-slate-655 mt-1 max-w-sm leading-snug">{bill.client_address}</p>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase text-slate-455 tracking-wider mb-1 border-b border-slate-200 pb-0.5">
                Tax Location / Jurisdiction
              </h3>
              <div className="grid grid-cols-2 gap-2 text-slate-650">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
                  <strong className="text-slate-850 font-bold block mt-0.5">{bill.client_phone}</strong>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Ward</span>
                  <strong className="text-slate-850 font-bold block mt-0.5">{bill.client_ward || 'Not Assigned'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Billing Period</span>
                  <strong className="text-slate-850 font-bold block mt-0.5">Fiscal Year {bill.year_of_billing} Assessment</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Assessment Breakdown Table */}
          <div className="border border-slate-350 rounded-lg overflow-hidden text-[10px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-350 text-[8.5px] font-black text-slate-455 uppercase tracking-wider">
                  {copyType === 'lg' && <th className="py-2 px-4 w-1/4">Category</th>}
                  <th className="py-2 px-4 w-1/3">Levy Name / Description</th>
                  <th className="py-2 px-4 w-1/2">Subhead / Revenue Details</th>
                  <th className="py-2 px-4 text-right">Amount Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-250 text-slate-700">
                {bill.levy_items && bill.levy_items.map((item, idx) => (
                  <tr key={idx}>
                    {copyType === 'lg' && (
                      <td className="py-2 px-4 font-bold text-slate-500 leading-tight text-[9px]">
                        {item.category_name || 'General Levy'}
                      </td>
                    )}
                    <td className="py-2 px-4 font-bold text-slate-900 leading-tight">{item.name}</td>
                    <td className="py-2 px-4 text-[9px] text-slate-500 leading-snug">{item.description}</td>
                    <td className="py-2 px-4 text-right font-bold text-slate-900">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Assessment Subtotals */}
            <div className="bg-slate-50/30 border-t border-slate-300 p-3 flex flex-col items-end space-y-1">
              <div className="w-64 flex justify-between text-[9px] font-bold text-slate-500">
                <span>Subtotal Levies:</span>
                <span className="text-slate-800 font-bold">{formatNaira(bill.subtotal)}</span>
              </div>
              {bill.arrears > 0 && (
                <div className="w-64 flex justify-between text-[9px] font-bold text-slate-500">
                  <span>Arrears / Past Debts:</span>
                  <span className="text-slate-800 font-bold">{formatNaira(bill.arrears)}</span>
                </div>
              )}
              {bill.penalty > 0 && (
                <div className="w-64 flex justify-between text-[9px] font-bold text-slate-500">
                  <span>Accrued Penalties:</span>
                  <span className="text-slate-800 font-bold">{formatNaira(bill.penalty)}</span>
                </div>
              )}
              <div className="w-64 border-t border-slate-350 pt-1 flex justify-between text-[10px] font-black text-slate-900 uppercase">
                <span>Grand Total Billed:</span>
                <span className="text-[11px] font-black text-slate-900">{formatNaira(bill.grand_total)}</span>
              </div>
              {bill.amount_paid > 0 && (
                <>
                  <div className="w-64 flex justify-between text-[9px] font-bold text-emerald-700">
                    <span>Total Amount Paid:</span>
                    <span className="font-extrabold">{formatNaira(bill.amount_paid)}</span>
                  </div>
                  <div className="w-64 border-t border-slate-250 pt-1 flex justify-between text-[10px] font-black text-indigo-700 uppercase">
                    <span>Outstanding Balance Due:</span>
                    <span className="text-xs font-black">{formatNaira(bill.balance_due)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Amount in words */}
          <div className="p-2.5 bg-slate-50 border border-slate-250 rounded-lg text-[10px] leading-normal">
            <span className="text-[8px] font-black text-slate-455 uppercase block tracking-wider">Total Amount in Words</span>
            <span className="font-extrabold text-slate-800 block mt-0.5 italic">{bill.amount_in_words}</span>
          </div>

          {/* Bank details and QR instructions */}
          <div className="grid grid-cols-3 gap-4 text-[10px] leading-relaxed pt-1">
            <div className="col-span-2 space-y-1.5">
              <h4 className="text-[8.5px] font-black text-slate-455 uppercase tracking-widest border-b border-slate-200 pb-0.5">
                Remittance Bank Accounts
              </h4>
              <p className="text-[9px] text-slate-500 leading-tight">
                You can make payment directly to any of the designated accounts. Please state the <strong>Bill Reference Number</strong> as the payment description.
              </p>
              <div className="bg-slate-50 p-2.5 border border-slate-200 rounded-lg space-y-1.5 mt-0.5 text-[10px] text-slate-700">
                {bill.lg_bank_accounts && bill.lg_bank_accounts.length > 0 ? (
                  <ol className="list-decimal list-inside space-y-1.5 font-bold">
                    {bill.lg_bank_accounts.map((acc, index) => {
                      const bankName = NIGERIAN_BANKS.find(b => b.code === acc.bank_name)?.name || acc.bank_name;
                      return (
                        <li key={acc.id} className="leading-relaxed border-b border-slate-200/50 pb-1 last:border-0 last:pb-0">
                          <span className="text-slate-900 font-extrabold">{bankName}</span> - <span className="font-mono text-slate-900 font-black">{acc.account_number}</span> <span className="text-slate-500 font-medium">({bill.lg_name})</span>
                          <div className="text-[9px] text-slate-500 font-medium pl-4">
                            Account Name: <span className="font-bold text-slate-700">{acc.account_name}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="space-y-0.5 font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Bank Name:</span>
                      <span>{NIGERIAN_BANKS.find(b => b.code === bill.lg_bank_name)?.name || bill.lg_bank_name || 'Designated Partner Bank'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Account Name:</span>
                      <span className="max-w-[180px] truncate text-right">{bill.lg_bank_account_name || `${bill.lg_name} LG Revenue`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Account Number:</span>
                      <span className="font-mono text-slate-955 font-black">{bill.lg_bank_account_number || '----------'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-between border-l border-slate-250 pl-3 text-center">
              <div className="space-y-0.5">
                <h4 className="text-[8.5px] font-black text-slate-455 uppercase tracking-wider leading-none">
                  Instant QR Payment
                </h4>
                <p className="text-[7.5px] text-slate-400 font-medium leading-tight">
                  Scan to settle online with Card / Transfer instantly
                </p>
              </div>

              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="Payment QR Code" 
                  className="w-20 h-20 object-contain border border-slate-200 rounded-md p-1 mt-1" 
                />
              ) : (
                <div className="w-20 h-20 border border-dashed border-slate-350 rounded flex items-center justify-center text-[8px] text-slate-400 mt-1">
                  [QR Code]
                </div>
              )}

              <span className="text-[7px] font-mono text-slate-500 mt-1 block tracking-wider leading-none">PAY.KHRIEN.GOV.NG</span>
            </div>
          </div>
        </div>

        {/* Bottom portion of page: Signatures, Warnings, Tear-off */}
        <div className="space-y-4 pt-4 z-10 relative">
          <div className="grid grid-cols-2 gap-10 text-[9px] text-slate-500 font-semibold pt-4">
            {/* Treasurer Signature */}
            <div className="text-center flex flex-col items-center justify-end">
              <div className="h-14 flex items-end justify-center mb-1">
                {signatures.treasurer?.signature_url ? (
                  <img
                    src={signatures.treasurer.signature_url}
                    alt="Treasurer Signature"
                    className="max-h-12 max-w-[140px] object-contain"
                  />
                ) : (
                  <div style={{ borderBottom: '1px solid #cbd5e1', width: '120px', height: '1px' }} />
                )}
              </div>
              <div className="border-t border-slate-400 pt-1 w-36 mx-auto">
                <span className="block font-bold text-slate-700">{signatures.treasurer?.name || 'Treasurer'}</span>
                <span className="block text-[7.5px] text-slate-400">Council Treasurer, {bill.lg_name} LGA</span>
              </div>
            </div>

            {/* Chairman Signature */}
            <div className="text-center flex flex-col items-center justify-end">
              <div className="h-14 flex items-end justify-center mb-1">
                {signatures.chairman?.signature_url ? (
                  <img
                    src={signatures.chairman.signature_url}
                    alt="Chairman Signature"
                    className="max-h-12 max-w-[140px] object-contain"
                  />
                ) : (
                  <div style={{ borderBottom: '1px solid #cbd5e1', width: '120px', height: '1px' }} />
                )}
              </div>
              <div className="border-t border-slate-400 pt-1 w-36 mx-auto">
                <span className="block font-bold text-slate-700">{signatures.chairman?.name || 'Chairman'}</span>
                <span className="block text-[7.5px] text-slate-400">Local Government Chairman, {bill.lg_name}</span>
              </div>
            </div>
          </div>

          <div className="p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-[8.5px] text-slate-505 leading-snug text-center italic">
            <strong>Legal Warning:</strong> In accordance with the {bill.state_name} Local Government Revenue Administration Law, payment of this demand notice must be made on or before the due date. Failure to comply will attract a penalty of 10% per annum on the outstanding amount and may trigger enforcement proceedings.
          </div>

          {/* Tear-off slip */}
          <div className="border-t border-dashed border-slate-400 pt-3 flex flex-col gap-1.5 relative">
            <div className="absolute -top-3 left-4 text-[9px] text-slate-450 font-bold bg-white px-2">
              ✂ Tear Here
            </div>

            <div className="flex justify-between items-center text-[9px] font-black text-slate-900 uppercase tracking-widest pb-0.5 border-b border-slate-100">
              <span>Payment Remittance Slip ({copyLabelFormatted})</span>
              <span>Ref: {bill.reference_number}</span>
            </div>

            <div className="grid grid-cols-4 gap-4 text-[10px] font-semibold leading-tight pt-0.5">
              <div>
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Taxpayer Name</span>
                <span className="text-slate-800 font-bold block mt-0.5 truncate">{bill.client_name}</span>
              </div>
              <div>
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Bill Reference</span>
                <span className="text-slate-800 font-mono block mt-0.5">{bill.reference_number}</span>
              </div>
              <div>
                {bill.amount_paid > 0 ? (
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Payment Summary</span>
                    <div className="text-[9px] text-slate-700 font-medium">
                      <div>Billed: <span className="font-bold text-slate-900">{formatNaira(bill.grand_total)}</span></div>
                      <div>Paid: <span className="font-bold text-emerald-700">{formatNaira(bill.amount_paid)}</span></div>
                      <div className="border-t border-slate-200 mt-0.5 pt-0.5">Balance: <span className="font-black text-indigo-750">{formatNaira(bill.balance_due)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Grand Total Due</span>
                    <span className="text-slate-950 font-black block mt-0.5">{formatNaira(bill.grand_total)}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Due Date</span>
                <span className="text-red-755 font-black block mt-0.5 font-mono">
                  {new Date(bill.due_date).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintDemandBillPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-white z-55">
        <Loader2 className="h-9 w-9 text-amber-600 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading print layout wrapper...</p>
      </div>
    }>
      <PrintDemandBillContent />
    </Suspense>
  );
}
