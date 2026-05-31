'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';

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

interface LevyItem {
  name: string;
  description: string;
  amount: number;
  category_name?: string;
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
  amount_in_words: string;
  year_of_billing: number;
  due_date: string;
  payment_status: 'paid' | 'unpaid' | 'partially_paid';
  created_at: string;
  lg_name: string;
  lg_logo_url: string | null;
  state_name: string;
  state_logo_url: string | null;
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
  created_by_name: string | null;
  created_by_signature_url: string | null;
}

const formatNaira = (n: number) =>
  '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatDateLong = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function PrintReceiptContent() {
  const { billId } = useParams();
  const searchParams = useSearchParams();
  const copyParam = searchParams.get('copy'); // 'customer', 'lg', or null
  
  const [bill, setBill] = useState<DemandBillDetail | null>(null);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signatures, setSignatures] = useState<{
    treasurer: { name: string; signature_url: string | null } | null;
    chairman: { name: string; signature_url: string | null } | null;
  }>({ treasurer: null, chairman: null });
  const printedAt = new Date();

  useEffect(() => {
    if (!billId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pay/${billId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load details');
        
        setBill(data.bill);
        setReceipt(data.receipt);
        if (data.signatures) setSignatures(data.signatures);

        if (!data.receipt) {
          throw new Error('No receipt has been generated yet for this demand bill.');
        }

        // QR code points to public verification page
        const verifyUrl = `${window.location.origin}/verify/${data.receipt.id}`;
        const qr = await QRCode.toDataURL(verifyUrl, {
          width: 120, margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setQrUrl(qr);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [billId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Preparing receipt for print...</p>
        </div>
      </div>
    );
  }

  if (error || !bill || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 bg-white">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div className="text-center">
          <h2 className="text-sm font-black text-slate-800 uppercase">Receipt Not Available</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || 'This invoice has not been settled yet.'}</p>
        </div>
        <Link
          href={`/pay/${billId}`}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
        >
          Return to Checkout
        </Link>
      </div>
    );
  }

  const paymentsLog: PaymentLogEntry[] = Array.isArray(receipt.payments_log) ? receipt.payments_log : [];
  const uniqueCategories = Array.from(new Set(
    (bill.levy_items || []).map(i => i.category_name || 'General Levy')
  ));

  const ReceiptCopy = ({ copyType }: { copyType: 'customer' | 'lg' }) => (
    <div className="receipt-copy" style={{
      width: '180mm',
      minHeight: '120mm',
      margin: '0 auto',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '9pt',
      color: '#1e293b',
      background: '#ffffff',
      position: 'relative',
      padding: '0',
    }}>
      {/* Security Border Frame */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '3px double #1e293b',
        boxShadow: 'inset 0 0 0 2px #f59e0b, inset 0 0 0 4px #1e293b',
        pointerEvents: 'none',
        zIndex: 10,
        borderRadius: '2px',
      }} />

      {/* Corner Ornaments */}
      {[
        { top: 6, left: 6 },
        { top: 6, right: 6 },
        { bottom: 6, left: 6 },
        { bottom: 6, right: 6 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 14, height: 14,
          border: '2px solid #f59e0b',
          zIndex: 11,
          borderRadius: '1px',
        }} />
      ))}

      <div style={{ padding: '12mm 12mm 8mm 12mm', position: 'relative', zIndex: 1 }}>

        {/* Header: Logos + Org Name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
          {bill.state_logo_url && (
            <img src={bill.state_logo_url} alt="State" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          )}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '11pt', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              {bill.state_name}
            </div>
            <div style={{ fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              {bill.lg_name}
            </div>
            <div style={{ fontSize: '7pt', color: '#475569', marginTop: 1, fontFamily: 'Arial, sans-serif' }}>
              Revenue Authority
            </div>
          </div>
          {bill.lg_logo_url && (
            <img src={bill.lg_logo_url} alt="LG" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          )}
        </div>

        {/* Title Banner */}
        <div style={{
          background: '#1e293b',
          color: '#f59e0b',
          textAlign: 'center',
          padding: '3px 0',
          fontWeight: 900,
          fontSize: '11pt',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontFamily: 'Arial, sans-serif',
          marginBottom: '6px',
          marginTop: '4px',
        }}>
          REVENUE RECEIPT
        </div>

        {/* Copy label + Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, paddingRight: '6px', color: '#64748b', width: '90px' }}>Receipt No:</td>
                  <td style={{ fontWeight: 900, fontSize: '9pt' }}>{receipt.reference_number}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', paddingTop: 2 }}>Print Date:</td>
                  <td style={{ paddingTop: 2 }}>{formatDateLong(printedAt.toISOString())}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', paddingTop: 2 }}>Print Time:</td>
                  <td style={{ paddingTop: 2 }}>{formatTime(printedAt.toISOString())}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', paddingTop: 2 }}>Copy Type:</td>
                  <td style={{ paddingTop: 2, fontWeight: 700, color: copyType === 'customer' ? '#0369a1' : '#7c3aed' }}>
                    {copyType === 'customer' ? 'CUSTOMER COPY' : 'LGA OFFICE COPY'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* QR Code */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            {qrUrl && <img src={qrUrl} alt="QR Code" style={{ width: 80, height: 80, display: 'block' }} />}
            <div style={{ fontSize: '6pt', color: '#94a3b8', marginTop: 2, fontFamily: 'Arial, sans-serif' }}>Scan to verify</div>
          </div>
        </div>

        {/* Payer Details */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '2px', padding: '6px 8px', marginBottom: '6px', fontSize: '8pt' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700, color: '#64748b', width: '90px', paddingBottom: 2 }}>Payer Name:</td>
                <td style={{ fontWeight: 900, paddingBottom: 2 }}>{bill.client_name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, color: '#64748b', paddingBottom: 2 }}>Address:</td>
                <td style={{ paddingBottom: 2 }}>{bill.client_address}</td>
              </tr>
              {bill.client_ward && (
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', paddingBottom: 2 }}>Ward:</td>
                  <td style={{ paddingBottom: 2 }}>{bill.client_ward}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 700, color: '#64748b', paddingBottom: 2 }}>Client Ref:</td>
                <td style={{ paddingBottom: 2 }}>{bill.client_reference_number}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700, color: '#64748b' }}>Bill Ref:</td>
                <td style={{ fontWeight: 700 }}>{bill.reference_number}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* "Received the sum of" declaration */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '2px',
          padding: '5px 8px',
          marginBottom: '6px',
          fontSize: '8pt',
        }}>
          <span style={{ fontWeight: 700 }}>Received the sum of </span>
          <span style={{ fontWeight: 900, textTransform: 'uppercase', color: '#92400e' }}>
            {formatNaira(receipt.last_payment_amount)} NAIRA ONLY
          </span>
          <span style={{ fontWeight: 700 }}> being payment for levies as listed below.</span>
        </div>

        {/* Levy Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px', fontSize: '8pt' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#f8fafc' }}>
              <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700, width: '28px' }}>S/N</th>
              <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>Description</th>
              <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, width: '80px' }}>Amount (₦)</th>
            </tr>
          </thead>
          <tbody>
            {(bill.levy_items || []).map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ padding: '2px 6px', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '2px 6px' }}>
                  <span style={{ fontWeight: 700 }}>{item.name}</span>
                  {item.category_name && (
                    <span style={{ fontSize: '7pt', color: '#64748b', display: 'block' }}>{item.category_name}</span>
                  )}
                </td>
                <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>
                  {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {bill.arrears > 0 && (
              <tr style={{ borderTop: '1px solid #cbd5e1' }}>
                <td colSpan={2} style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Arrears / Past Debt:</td>
                <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>
                  {bill.arrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
            {bill.penalty > 0 && (
              <tr>
                <td colSpan={2} style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Penalty:</td>
                <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>
                  {bill.penalty.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
            <tr style={{ background: '#1e293b', color: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 900 }}>TOTAL BILL AMOUNT:</td>
              <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 900, color: '#fbbf24' }}>
                {bill.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ─── CUSTOMER COPY: payment section ─────────────────────────────── */}
        {copyType === 'customer' && (
          <div style={{ marginTop: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', border: '1px solid #cbd5e1', borderRadius: '2px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '3px 8px', fontWeight: 700, color: '#64748b' }}>Amount Paid (This Payment):</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, fontSize: '10pt', color: '#059669' }}>
                    {formatNaira(receipt.last_payment_amount)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '3px 8px', fontWeight: 700, color: '#64748b' }}>Total Paid So Far:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                    {formatNaira(receipt.total_amount_paid)}
                  </td>
                </tr>
                <tr style={{ background: receipt.outstanding_balance > 0 ? '#fef2f2' : '#f0fdf4' }}>
                  <td style={{ padding: '3px 8px', fontWeight: 900, color: receipt.outstanding_balance > 0 ? '#be123c' : '#065f46' }}>
                    Outstanding Balance:
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, fontSize: '10pt', color: receipt.outstanding_balance > 0 ? '#be123c' : '#065f46' }}>
                    {formatNaira(receipt.outstanding_balance)}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px', fontSize: '8pt' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', width: '100px', paddingBottom: 2 }}>Payment Method:</td>
                  <td style={{ paddingBottom: 2, fontWeight: 700 }}>
                    {receipt.last_payment_method === 'flutterwave' ? 'Online Payment (Flutterwave)' : 'Bank Transfer'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b', paddingBottom: 2 }}>Transaction Ref:</td>
                  <td style={{ paddingBottom: 2, fontFamily: 'Courier New', fontSize: '7pt' }}>
                    {receipt.last_payment_reference || '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#64748b' }}>Payment Date:</td>
                  <td style={{ fontWeight: 700 }}>{formatDateLong(receipt.last_payment_date)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ─── LG COPY: full payment history ──────────────────────────────── */}
        {copyType === 'lg' && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontWeight: 900, fontSize: '8pt', textTransform: 'uppercase', color: '#1e293b', marginBottom: '3px', letterSpacing: '0.05em' }}>
              Full Payment History:
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', border: '1px solid #cbd5e1' }}>
              <thead>
                <tr style={{ background: '#334155', color: '#f8fafc' }}>
                  <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 700 }}>Method</th>
                  <th style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 700 }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLog.map((entry) => (
                  <tr key={entry.payment_number} style={{ borderBottom: '1px solid #e2e8f0', background: entry.payment_number % 2 === 0 ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 900 }}>{entry.payment_number}</td>
                    <td style={{ padding: '2px 4px' }}>{formatDate(entry.date)}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      {formatNaira(entry.amount)}
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      {entry.method === 'flutterwave' ? 'FLW' : `Bank${entry.bank_name ? ` (${entry.bank_name})` : ''}`}
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 700, color: entry.balance_after > 0 ? '#be123c' : '#059669' }}>
                      {formatNaira(entry.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1e293b', color: '#f8fafc' }}>
                  <td colSpan={2} style={{ padding: '3px 4px', fontWeight: 900 }}>Total Paid:</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 900, color: '#fbbf24' }}>
                    {formatNaira(receipt.total_amount_paid)}
                  </td>
                  <td style={{ padding: '3px 4px', fontWeight: 700 }}>Outstanding:</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 900, color: receipt.outstanding_balance > 0 ? '#fca5a5' : '#86efac' }}>
                    {formatNaira(receipt.outstanding_balance)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Categories */}
            {uniqueCategories.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '7.5pt', color: '#64748b', marginRight: 2 }}>Categories:</span>
                {uniqueCategories.map((cat, i) => (
                  <span key={i} style={{
                    fontSize: '7pt', fontWeight: 700,
                    padding: '1px 6px',
                    background: '#eef2ff',
                    color: '#4338ca',
                    border: '1px solid #c7d2fe',
                    borderRadius: '99px',
                  }}>{cat}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Signature Section */}
        <div style={{ marginTop: '10px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', fontSize: '7.5pt' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '8px' }}>
            {/* Treasurer */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                {signatures.treasurer?.signature_url ? (
                  <img
                    src={signatures.treasurer.signature_url}
                    alt="Treasurer Signature"
                    style={{ maxHeight: '38px', maxWidth: '130px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ borderBottom: '1.2px solid #1e293b', width: '130px', height: '1px' }} />
                )}
              </div>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>{signatures.treasurer?.name || 'Treasurer'}</div>
              <div style={{ color: '#64748b', fontSize: '7pt' }}>Council Treasurer, {bill.lg_name} LGA</div>
            </div>
            {/* Chairman */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                {signatures.chairman?.signature_url ? (
                  <img
                    src={signatures.chairman.signature_url}
                    alt="Chairman Signature"
                    style={{ maxHeight: '38px', maxWidth: '130px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ borderBottom: '1.2px solid #1e293b', width: '130px', height: '1px' }} />
                )}
              </div>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>{signatures.chairman?.name || 'Chairman'}</div>
              <div style={{ color: '#64748b', fontSize: '7pt' }}>Local Government Chairman, {bill.lg_name}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6.5pt', color: '#94a3b8', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', fontFamily: 'Arial, sans-serif' }}>
            <div>Official Revenue Receipt · Printed: {formatDateLong(printedAt.toISOString())} {formatTime(printedAt.toISOString())}</div>
            <div style={{ fontFamily: 'monospace' }}>Verify: /verify/{receipt.id.slice(0, 8)}...</div>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .print-page { margin: 0; padding: 0; }
          .receipt-copy { page-break-inside: avoid; }
          .cut-line { page-break-before: avoid; }
          @page { size: A4; margin: 10mm 15mm; }
        }
        @media screen {
          body { background: #f1f5f9; }
        }
      `}</style>

      {/* Screen-only Print Controls */}
      <div className="no-print flex justify-between items-center px-6 py-4 bg-white border-b border-slate-200 shadow-sm w-full max-w-[210mm] mx-auto mt-6 rounded-2xl">
        <div>
          <h1 className="text-base font-black text-slate-800">Print Receipt — {receipt.reference_number}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{bill.client_name} · {bill.reference_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/pay/${billId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-650 hover:text-slate-900 transition mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Bill</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            🖨️ Print Receipt
          </button>
        </div>
      </div>

      {/* Print Content */}
      <div className="print-page py-6" style={{ background: 'white', padding: '0' }}>

        {/* === CUSTOMER COPY === */}
        {(!copyParam || copyParam === 'customer') && (
          <div style={{ padding: '10mm 15mm 6mm 15mm' }}>
            <ReceiptCopy copyType="customer" />
          </div>
        )}

        {/* === CUT LINE === */}
        {!copyParam && (
          <div className="cut-line" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0 15mm',
            margin: '0',
          }}>
            <div style={{ flex: 1, borderTop: '1.5px dashed #94a3b8' }} />
            <span style={{ fontSize: '12pt', color: '#94a3b8' }}>✂</span>
            <span style={{ fontSize: '7pt', color: '#94a3b8', fontFamily: 'Arial', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Cut Here · LGA Office Copy Below
            </span>
            <span style={{ fontSize: '12pt', color: '#94a3b8' }}>✂</span>
            <div style={{ flex: 1, borderTop: '1.5px dashed #94a3b8' }} />
          </div>
        )}

        {/* === LG COPY === */}
        {(!copyParam || copyParam === 'lg') && (
          <div style={{ padding: '6mm 15mm 10mm 15mm' }}>
            <ReceiptCopy copyType="lg" />
          </div>
        )}

      </div>
    </>
  );
}

export default function PrintReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Preparing receipt for print...</p>
        </div>
      </div>
    }>
      <PrintReceiptContent />
    </Suspense>
  );
}
