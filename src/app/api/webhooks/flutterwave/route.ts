import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { upsertReceipt } from '@/lib/receipt-helpers';

export async function POST(request: Request) {
  try {
    // Verify webhook signature
    const flutterwaveHash = request.headers.get('verif-hash');
    const secretHash = process.env.FLUTTERWAVE_ENCRYPTION_KEY;

    if (!flutterwaveHash || flutterwaveHash !== secretHash) {
      console.warn('Invalid webhook signature — request rejected');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('Ingested Flutterwave Webhook Payload:', payload);

    const { event, data } = payload;

    if (event !== 'charge.completed' || data?.status !== 'successful') {
      return NextResponse.json({ message: 'Ignored non-success event' }, { status: 200 });
    }

    const { tx_ref, flw_ref, amount } = data;
    const clientName = data.customer?.name || 'Unknown Client';

    if (!tx_ref) {
      return NextResponse.json({ error: 'Missing transaction reference (tx_ref)' }, { status: 400 });
    }

    await query('BEGIN');

    const baseTxRef = tx_ref.split('_')[0];
    const billRes = await query(`
      SELECT 
        db.id AS demand_bill_id, 
        db.lg_id,
        db.client_id,
        db.created_by,
        db.grand_total::float AS total_amount,
        COALESCE(db.amount_paid, 0.00)::float AS amount_paid,
        CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float AS balance_due,
        db.payment_status,
        lg.state_id, 
        COALESCE(lg.khrien_split_percentage, 5.00) AS khrien_split_percentage,
        lg.code AS lg_code
      FROM demand_bills db
      JOIN local_governments lg ON db.lg_id = lg.id
      WHERE db.reference_number = $1
    `, [baseTxRef]);

    if (billRes.rows.length === 0) {
      await query('ROLLBACK');
      console.warn(`Demand bill with reference ${baseTxRef} (derived from ${tx_ref}) not found`);
      return NextResponse.json({ error: 'Demand bill not found' }, { status: 200 });
    }

    const bill = billRes.rows[0];
    const { demand_bill_id, lg_id, client_id, created_by, state_id, khrien_split_percentage } = bill;

    if (bill.payment_status === 'paid') {
      await query('COMMIT');
      return NextResponse.json({ status: 'success', message: 'Bill already fully paid.' }, { status: 200 });
    }

    const flwRef = flw_ref || tx_ref;

    const paymentCheck = await query(`
      SELECT id FROM payments WHERE transaction_id = $1
    `, [flwRef]);

    if (paymentCheck.rows.length > 0) {
      await query('COMMIT');
      return NextResponse.json({ status: 'success', message: 'Payment already processed.' }, { status: 200 });
    }

    const paymentAmount = parseFloat(amount);
    const newAmountPaid = bill.amount_paid + paymentAmount;
    const newBalanceDue = Math.max(0, bill.total_amount - newAmountPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    await query(`
      UPDATE demand_bills 
      SET payment_status = $1, 
          payment_method = 'flutterwave',
          flutterwave_transaction_id = $2,
          amount_paid = $3,
          balance_due = $4,
          updated_at = NOW() 
      WHERE id = $5
    `, [newStatus, flwRef, newAmountPaid, newBalanceDue, demand_bill_id]);

    const logChangeType = newBalanceDue === 0 ? 'payment_completed_flutterwave' : 'partial_payment_flutterwave';
    const logNote = newBalanceDue === 0
      ? `Full payment settled via Flutterwave. Transaction ID: ${flwRef}`
      : `Partial payment of ₦${paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} verified. Remaining balance: ₦${newBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const logMetadata = {
      amount_paid: paymentAmount,
      balance_remaining: newBalanceDue,
      payment_method: 'flutterwave',
      teller_ref: null
    };

    await query(`
      INSERT INTO demand_bill_status_logs (demand_bill_id, status, changed_by_label, change_type, note, metadata)
      VALUES ($1, $2, 'System (Flutterwave)', $3, $4, $5)
    `, [demand_bill_id, newStatus, logChangeType, logNote, JSON.stringify(logMetadata)]);

    await query(`
      INSERT INTO payments (bill_id, transaction_id, amount, currency, status, payment_date, raw_payload)
      VALUES ($1, $2, $3, 'NGN', 'successful', NOW(), $4)
    `, [demand_bill_id, flwRef, paymentAmount, JSON.stringify(payload)]);

    await upsertReceipt({
      demandBillId: demand_bill_id,
      lgId: lg_id,
      clientId: client_id,
      createdByUserId: created_by,
      officerName: 'System (Flutterwave)',
      totalBillAmount: bill.total_amount,
      paymentAmount,
      newTotalPaid: newAmountPaid,
      newBalance: newBalanceDue,
      paymentMethod: 'flutterwave',
      transactionRef: flwRef,
      bankName: null,
      tellerRef: null,
      paymentDate: new Date().toISOString(),
    });

    const ptCheck = await query(`
      SELECT id FROM platform_transactions WHERE flutterwave_transaction_id = $1
    `, [flwRef]);

    if (ptCheck.rows.length === 0) {
      const splitPct = parseFloat(khrien_split_percentage) || 5.00;
      const khrienShare = paymentAmount * (splitPct / 100);
      const lgShare = paymentAmount - khrienShare;

      await query(`
        INSERT INTO platform_transactions (
          lg_id, 
          state_id, 
          demand_bill_id, 
          client_name, 
          total_amount_paid, 
          lg_share, 
          khrien_share, 
          flutterwave_transaction_id, 
          transaction_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        lg_id,
        state_id,
        demand_bill_id,
        clientName,
        paymentAmount,
        lgShare,
        khrienShare,
        flwRef
      ]);
    }

    await query('COMMIT');

    return NextResponse.json({ status: 'success', message: 'Webhook processed, split recorded.' }, { status: 200 });

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    console.error('Webhook processing crashed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}