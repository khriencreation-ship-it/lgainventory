'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Receipt,
  User,
  FileText,
  Calendar,
} from 'lucide-react';

interface PaymentLogEntry {
  payment_number: number;
  amount: number;
  method: 'flutterwave' | 'bank_transfer';
  transaction_ref: string;
  bank_name: string | null;
  date: string;
  recorded_by: string;
  balance_after: number;
}

interface VerifiedReceipt {
  id: string;
  reference_number: string;
  payment_status: 'partially_paid' | 'paid';
  total_bill_amount: number;
  total_amount_paid: number;
  outstanding_balance: number;
  last_payment_date: string;
  payments_log: PaymentLogEntry[];
  created_at: string;
  client_name: string;
  client_address: string;
  client_ward: string | null;
  demand_bill_reference: string;
  lg_name: string;
  lg_logo_url: string | null;
  state_name: string;
}

const formatNaira = (n: number) =>
  '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export default function PublicVerifyPage() {
  const { receiptId } = useParams();
  const [receipt, setReceipt] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (!receiptId) return;
    (async () => {
      try {
        const res = await fetch(`/api/verify/${receiptId}`);
        const data = await res.json();
        setFound(data.found === true);
        if (data.found && data.receipt) setReceipt(data.receipt);
      } catch {
        setFound(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [receiptId]);

  const paymentsLog: PaymentLogEntry[] = receipt && Array.isArray(receipt.payments_log)
    ? receipt.payments_log : [];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '24px 16px 48px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* Top LG Brand Bar */}
        {receipt && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '12px', marginBottom: '24px',
          }}>
            {receipt.lg_logo_url && (
              <img src={receipt.lg_logo_url} alt={receipt.lg_name}
                style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: 'white', padding: 4 }} />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#f1f5f9', letterSpacing: '0.03em' }}>
                {receipt.state_name}
              </div>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#f59e0b' }}>
                {receipt.lg_name} · Revenue Authority
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>

          {loading ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Loader2 style={{ width: 40, height: 40, color: '#f59e0b', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Verifying receipt...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>

          ) : !found ? (
            <>
              {/* NOT FOUND STATE */}
              <div style={{ background: '#fef2f2', padding: '32px 24px 16px', textAlign: 'center' }}>
                <div style={{
                  width: 72, height: 72, background: '#fee2e2', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <AlertTriangle style={{ width: 36, height: 36, color: '#dc2626' }} />
                </div>
                <h1 style={{ fontWeight: 900, fontSize: '20px', color: '#991b1b', margin: '0 0 8px' }}>
                  Receipt Not Found
                </h1>
                <p style={{ color: '#b91c1c', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                  ⚠ This receipt could not be verified. The reference ID may be invalid or the receipt may not exist in our system.
                </p>
              </div>
              <div style={{ padding: '16px 24px 24px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
                  If you believe this is an error, please contact the LGA Revenue Authority office with your receipt details.
                </p>
              </div>
            </>

          ) : receipt ? (
            <>
              {/* VERIFIED STATE */}
              <div style={{
                background: receipt.payment_status === 'paid'
                  ? 'linear-gradient(135deg, #065f46, #047857)'
                  : 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
                padding: '28px 24px 20px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Glow circle */}
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

                <div style={{
                  width: 72, height: 72, background: 'rgba(255,255,255,0.15)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                }}>
                  {receipt.payment_status === 'paid'
                    ? <CheckCircle style={{ width: 36, height: 36, color: '#a7f3d0' }} />
                    : <Clock style={{ width: 36, height: 36, color: '#bfdbfe' }} />
                  }
                </div>

                <h1 style={{ fontWeight: 900, fontSize: '20px', color: '#ffffff', margin: '0 0 4px' }}>
                  {receipt.payment_status === 'paid' ? '✓ Receipt Verified' : '✓ Partial Payment Verified'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', margin: 0 }}>
                  {receipt.payment_status === 'paid'
                    ? 'This receipt has been fully settled and is authentic.'
                    : 'This receipt has partial payments on record and is authentic.'}
                </p>

                <div style={{
                  marginTop: '16px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  display: 'inline-block',
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}>Receipt No: </span>
                  <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 900, fontFamily: 'monospace' }}>
                    {receipt.reference_number}
                  </span>
                </div>
              </div>

              {/* Receipt Details */}
              <div style={{ padding: '20px 24px' }}>

                {/* Row: Client */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 32, height: 32, background: '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User style={{ width: 16, height: 16, color: '#d97706' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taxpayer</div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', marginTop: 2 }}>{receipt.client_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: 1 }}>{receipt.client_address}</div>
                    {receipt.client_ward && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Ward: {receipt.client_ward}</div>}
                  </div>
                </div>

                {/* Row: Demand Bill */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 32, height: 32, background: '#ede9fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText style={{ width: 16, height: 16, color: '#7c3aed' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demand Bill Reference</div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', marginTop: 2, fontFamily: 'monospace' }}>{receipt.demand_bill_reference}</div>
                  </div>
                </div>

                {/* Payment Summary Boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { label: 'Total Billed', value: formatNaira(receipt.total_bill_amount), color: '#1e293b' },
                    { label: 'Total Paid', value: formatNaira(receipt.total_amount_paid), color: '#059669' },
                    { label: 'Balance', value: formatNaira(receipt.outstanding_balance), color: receipt.outstanding_balance > 0 ? '#dc2626' : '#059669' },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{stat.label}</div>
                      <div style={{ fontWeight: 900, fontSize: '11px', color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Payment Status Badge */}
                <div style={{
                  textAlign: 'center', marginBottom: '16px',
                  padding: '6px', borderRadius: '10px',
                  background: receipt.payment_status === 'paid' ? '#dcfce7' : '#e0e7ff',
                  border: `1px solid ${receipt.payment_status === 'paid' ? '#86efac' : '#a5b4fc'}`,
                }}>
                  <span style={{
                    fontWeight: 900, fontSize: '11px',
                    color: receipt.payment_status === 'paid' ? '#065f46' : '#1e40af',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {receipt.payment_status === 'paid' ? '✓ Fully Paid & Settled' : '⏳ Partially Paid — Balance Outstanding'}
                  </span>
                </div>

                {/* Payment History Table */}
                {paymentsLog.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                      Payment History
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      {paymentsLog.map((entry, i) => (
                        <div key={entry.payment_number} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px',
                          borderBottom: i < paymentsLog.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                          gap: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: '#fef3c7', color: '#92400e',
                              fontSize: '10px', fontWeight: 900,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>{entry.payment_number}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                                {entry.method === 'flutterwave' ? 'Flutterwave' : `Bank${entry.bank_name ? ` — ${entry.bank_name}` : ''}`}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 1 }}>{formatDate(entry.date)}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: '12px', color: '#059669' }}>{formatNaira(entry.amount)}</div>
                            <div style={{ fontSize: '9px', color: entry.balance_after > 0 ? '#dc2626' : '#059669', marginTop: 1 }}>
                              Balance: {formatNaira(entry.balance_after)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issue Date */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Calendar style={{ width: 14, height: 14, color: '#94a3b8', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    Receipt issued: {formatDate(receipt.created_at)} · Last updated: {formatDateTime(receipt.last_payment_date)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                padding: '12px 24px', textAlign: 'center',
              }}>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#1e293b' }}>{receipt.lg_name}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2 }}>
                  Official Revenue Receipt · {receipt.state_name}
                </div>
                <div style={{ fontSize: '9px', color: '#cbd5e1', marginTop: 4, fontFamily: 'monospace' }}>
                  ID: {receipt.id}
                </div>
              </div>
            </>
          ) : null}

        </div>

        {/* Bottom disclaimer */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(148,163,184,0.7)', marginTop: '20px', lineHeight: 1.5 }}>
          This page verifies the authenticity of LGA revenue receipts.<br />
          Scan the QR code on your printed receipt to access this page.
        </p>
      </div>
    </div>
  );
}
