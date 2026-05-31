/**
 * receipt-helpers.ts
 *
 * Shared function to create or update a receipt whenever a payment is recorded.
 * Called by: Flutterwave verify route, Flutterwave webhook, manual payment route.
 *
 * IMPORTANT: Must be called WITHIN an active DB transaction (BEGIN/COMMIT handled
 * by the caller). This function issues only DML statements, no transaction control.
 */

import { query } from '@/lib/db';

export interface UpsertReceiptArgs {
  demandBillId: string;
  lgId: string;
  clientId: string;
  createdByUserId: string;    // officer or 'system' placeholder UUID — see note below
  officerName: string;        // human-readable label for logs
  totalBillAmount: number;
  paymentAmount: number;       // amount paid in THIS transaction
  newTotalPaid: number;        // cumulative total after this payment
  newBalance: number;          // outstanding balance after this payment
  paymentMethod: 'flutterwave' | 'bank_transfer';
  transactionRef: string;      // flw_ref or teller_ref
  bankName?: string | null;    // only for bank_transfer
  tellerRef?: string | null;   // only for bank_transfer
  paymentDate?: string | null; // ISO string; defaults to NOW() if null
}

/**
 * Generates the next receipt reference number for a given LG.
 * Format: {LG_CODE}-RCP-0001 (zero-padded to 4 digits, incrementing per LG)
 */
async function generateReceiptRefNumber(lgId: string): Promise<string> {
  // Count existing receipts for this LG to determine next number
  const countRes = await query(
    `SELECT COUNT(*)::int AS cnt FROM receipts WHERE lg_id = $1`,
    [lgId]
  );
  const nextNum = (countRes.rows[0].cnt || 0) + 1;

  // Fetch LG code
  const lgRes = await query(
    `SELECT UPPER(code) AS code FROM local_governments WHERE id = $1`,
    [lgId]
  );
  const lgCode = lgRes.rows[0]?.code || 'LGA';
  return `${lgCode}-RCP-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Upsert a receipt for the given demand bill.
 * - If no receipt exists yet: create one.
 * - If one exists: update totals and append to payments_log.
 *
 * Returns the receipt ID.
 */
export async function upsertReceipt(args: UpsertReceiptArgs): Promise<string> {
  const {
    demandBillId,
    lgId,
    clientId,
    createdByUserId,
    officerName,
    totalBillAmount,
    paymentAmount,
    newTotalPaid,
    newBalance,
    paymentMethod,
    transactionRef,
    bankName,
    tellerRef,
    paymentDate,
  } = args;

  const paymentStatus = newBalance <= 0 ? 'paid' : 'partially_paid';
  const effectivePaymentDate = paymentDate || new Date().toISOString();

  // Check if receipt already exists for this demand bill
  const existingRes = await query(
    `SELECT id, payments_log FROM receipts WHERE demand_bill_id = $1`,
    [demandBillId]
  );

  if (existingRes.rows.length === 0) {
    // ── CREATE new receipt ──────────────────────────────────────────────────
    const refNumber = await generateReceiptRefNumber(lgId);

    const paymentLogEntry = {
      payment_number: 1,
      amount: paymentAmount,
      method: paymentMethod,
      transaction_ref: transactionRef,
      bank_name: bankName || null,
      teller_ref: tellerRef || null,
      date: effectivePaymentDate,
      recorded_by: officerName,
      balance_after: newBalance,
    };

    const insertRes = await query(
      `INSERT INTO receipts (
         reference_number, lg_id, demand_bill_id, client_id,
         created_by, last_updated_by,
         total_bill_amount, total_amount_paid, outstanding_balance,
         last_payment_amount, last_payment_method, last_payment_date,
         last_payment_reference, payment_status, payments_log,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14::jsonb,
         NOW(), NOW()
       ) RETURNING id`,
      [
        refNumber, lgId, demandBillId, clientId,
        createdByUserId,
        totalBillAmount, newTotalPaid, newBalance,
        paymentAmount, paymentMethod, effectivePaymentDate,
        transactionRef, paymentStatus, JSON.stringify([paymentLogEntry]),
      ]
    );

    const receiptId = insertRes.rows[0].id;

    // Log: receipt_created
    await query(
      `INSERT INTO receipt_status_logs (
         receipt_id, change_type, amount_paid_this_transaction,
         total_paid_after, balance_remaining_after,
         payment_method, transaction_ref, changed_by_label, note
       ) VALUES ($1, 'receipt_created', $2, $3, $4, $5, $6, $7, $8)`,
      [
        receiptId, paymentAmount, newTotalPaid, newBalance,
        paymentMethod, transactionRef, officerName,
        `Receipt created on first payment of ₦${paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
      ]
    );

    return receiptId;

  } else {
    // ── UPDATE existing receipt ─────────────────────────────────────────────
    const existingReceipt = existingRes.rows[0];
    const receiptId: string = existingReceipt.id;
    const existingLog: any[] = existingReceipt.payments_log || [];
    const paymentNumber = existingLog.length + 1;

    const paymentLogEntry = {
      payment_number: paymentNumber,
      amount: paymentAmount,
      method: paymentMethod,
      transaction_ref: transactionRef,
      bank_name: bankName || null,
      teller_ref: tellerRef || null,
      date: effectivePaymentDate,
      recorded_by: officerName,
      balance_after: newBalance,
    };

    // Append to the JSONB array
    await query(
      `UPDATE receipts SET
         total_amount_paid     = $1,
         outstanding_balance   = $2,
         last_payment_amount   = $3,
         last_payment_method   = $4,
         last_payment_date     = $5,
         last_payment_reference = $6,
         payment_status        = $7,
         last_updated_by       = $8,
         payments_log          = payments_log || $9::jsonb,
         updated_at            = NOW()
       WHERE id = $10`,
      [
        newTotalPaid, newBalance,
        paymentAmount, paymentMethod, effectivePaymentDate,
        transactionRef, paymentStatus, createdByUserId,
        JSON.stringify([paymentLogEntry]),
        receiptId,
      ]
    );

    // Log: receipt_updated_partial or receipt_updated_final
    const changeType = newBalance <= 0 ? 'receipt_updated_final' : 'receipt_updated_partial';
    const logNote = newBalance <= 0
      ? `Final payment of ₦${paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} received. Bill fully settled.`
      : `Partial payment #${paymentNumber} of ₦${paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Remaining balance: ₦${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;

    await query(
      `INSERT INTO receipt_status_logs (
         receipt_id, change_type, amount_paid_this_transaction,
         total_paid_after, balance_remaining_after,
         payment_method, transaction_ref, changed_by_label, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        receiptId, changeType, paymentAmount, newTotalPaid, newBalance,
        paymentMethod, transactionRef, officerName, logNote,
      ]
    );

    return receiptId;
  }
}
