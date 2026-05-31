// Force Next.js compiler re-evaluation
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { upsertReceipt } from '@/lib/receipt-helpers';

// POST: Verify payment status directly with Flutterwave and post to database
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { transaction_id } = body;

    if (!transaction_id) {
      return NextResponse.json({ error: 'Transaction ID is required for verification' }, { status: 400 });
    }

    // Begin database transaction
    await query('BEGIN');

    // 1. Fetch the demand bill by ID and check if it is already paid
    const billRes = await query(
      `SELECT 
         db.id AS demand_bill_id, 
         db.reference_number,
         db.lg_id, 
         db.client_id,
         db.grand_total::float as total_amount,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         db.payment_status,
         db.created_by,
         c.full_name as client_name,
         lg.state_id, 
         COALESCE(lg.khrien_split_percentage, 5.00) AS khrien_split_percentage,
         lg.code AS lg_code
       FROM demand_bills db
       JOIN clients c ON db.client_id = c.id
       JOIN local_governments lg ON db.lg_id = lg.id
       WHERE db.id = $1 FOR UPDATE`,
      [id]
    );

    if (billRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Demand bill not found' }, { status: 404 });
    }

    const bill = billRes.rows[0];

    // If already marked as paid, return success immediately
    if (bill.payment_status === 'paid') {
      await query('COMMIT');
      return NextResponse.json({ success: true, message: 'Payment already verified and marked as paid.' });
    }

    // 2. Query Flutterwave transaction verification API
    const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!flwSecretKey) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Payment gateway secret key configuration is missing' }, { status: 500 });
    }

    console.log(`Verifying Flutterwave transaction: ${transaction_id} for bill: ${bill.reference_number}`);
    
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${flwSecretKey}`
      }
    });

    const verifyData = await verifyRes.json();
    
    if (!verifyRes.ok || verifyData.status !== 'success') {
      await query('ROLLBACK');
      console.error('Flutterwave transaction verification error:', verifyData);
      return NextResponse.json({ error: verifyData.message || 'Failed to verify transaction with Flutterwave' }, { status: 400 });
    }

    const txDetails = verifyData.data;

    // 3. Match transaction details with our bill record
    if (txDetails.status !== 'successful') {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Flutterwave transaction is not successful' }, { status: 400 });
    }

    const baseTxRef = txDetails.tx_ref.split('_')[0];
    if (baseTxRef !== bill.reference_number) {
      await query('ROLLBACK');
      console.warn(`Reference mismatch: Flutterwave tx_ref (${txDetails.tx_ref}) !== Bill reference (${bill.reference_number})`);
      return NextResponse.json({ error: 'Transaction reference mismatch' }, { status: 400 });
    }

    const flwRef = txDetails.flw_ref || transaction_id.toString();
    const paymentAmount = parseFloat(txDetails.amount);

    // Check if this payment is already processed to prevent duplicate processing
    const paymentCheck = await query(
      `SELECT id FROM payments WHERE transaction_id = $1 OR transaction_id = $2`,
      [flwRef, transaction_id.toString()]
    );

    if (paymentCheck.rows.length > 0) {
      await query('COMMIT');
      console.log(`Payment already processed for transaction_id: ${transaction_id} / flwRef: ${flwRef}`);
      return NextResponse.json({ success: true, message: 'Payment already verified and recorded' });
    }

    // 4. Update the demand bill totals
    const newAmountPaid = bill.amount_paid + paymentAmount;
    const newBalanceDue = Math.max(0, bill.total_amount - newAmountPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    await query(
      `UPDATE demand_bills 
       SET payment_status = $1, 
           payment_method = 'flutterwave',
           flutterwave_transaction_id = $2,
           amount_paid = $3,
           balance_due = $4,
           updated_at = NOW() 
       WHERE id = $5`,
      [newStatus, flwRef, newAmountPaid, newBalanceDue, bill.demand_bill_id]
    );

    // 5. Create demand bill status log with metadata
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

    await query(
      `INSERT INTO demand_bill_status_logs (demand_bill_id, status, changed_by_label, change_type, note, metadata)
       VALUES ($1, $2, 'System (Flutterwave Callback)', $3, $4, $5)`,
      [bill.demand_bill_id, newStatus, logChangeType, logNote, JSON.stringify(logMetadata)]
    );

    // 6. Insert payments record
    await query(
      `INSERT INTO payments (bill_id, transaction_id, amount, currency, status, payment_date, raw_payload)
       VALUES ($1, $2, $3, 'NGN', 'successful', NOW(), $4)`,
      [bill.demand_bill_id, flwRef, paymentAmount, JSON.stringify(verifyData)]
    );

    // 7. Upsert receipt (on every payment, not just when fully paid)
    await upsertReceipt({
      demandBillId: bill.demand_bill_id,
      lgId: bill.lg_id,
      clientId: bill.client_id,
      createdByUserId: bill.created_by,
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

    // 8. Log split platform transactions
    const ptCheck = await query(
      `SELECT id FROM platform_transactions WHERE flutterwave_transaction_id = $1`,
      [flwRef]
    );

    if (ptCheck.rows.length === 0) {
      const splitPct = parseFloat(bill.khrien_split_percentage) || 5.00;
      const khrienShare = paymentAmount * (splitPct / 100);
      const lgShare = paymentAmount - khrienShare;

      await query(
        `INSERT INTO platform_transactions (
           lg_id, 
           state_id, 
           demand_bill_id, 
           client_name, 
           total_amount_paid, 
           lg_share, 
           khrien_share, 
           flutterwave_transaction_id, 
           transaction_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          bill.lg_id,
          bill.state_id,
          bill.demand_bill_id,
          bill.client_name,
          paymentAmount,
          lgShare,
          khrienShare,
          flwRef
        ]
      );
    }

    await query('COMMIT');
    console.log(`Successfully verified and posted payment for bill ${bill.reference_number}`);

    return NextResponse.json({ success: true, message: 'Payment successfully verified and posted' });

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Verify payment transaction rollback crash:', rbErr);
    }
    console.error('POST verify payment error:', error);
    return NextResponse.json({ error: error.message || 'Failed to verify payment' }, { status: 500 });
  }
}
