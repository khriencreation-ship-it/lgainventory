import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { upsertReceipt } from '@/lib/receipt-helpers';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Retrieve detailed demand bill with dynamic overdue tracking, logs, and receipt info
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    const allowedRoles = ['lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin'];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the demand bill with joined client, LG, state, and user creator details
    const billRes = await query(
      `SELECT 
         db.id,
         db.reference_number,
         db.lg_id,
         db.client_id,
         db.created_by,
         db.levy_items,
         db.subtotal::float as subtotal,
         db.arrears::float as arrears,
         db.penalty::float as penalty,
         db.grand_total::float as grand_total,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         db.amount_in_words,
         db.year_of_billing,
         db.due_date,
         db.payment_status,
         db.payment_method,
         db.flutterwave_transaction_id,
         db.manual_payment_bank,
         db.manual_payment_teller_ref,
         db.manual_payment_date,
         db.manual_payment_note,
         db.created_at,
         c.full_name as client_name,
         c.reference_number as client_reference_number,
         c.phone_number as client_phone,
         c.email_address as client_email,
         c.address as client_address,
         c.ward as client_ward,
         u.name as creator_name,
         u.signature_url as creator_signature_url,
         lg.name as lg_name,
         lg.logo_url as lg_logo_url,
         lg.bank_name as lg_bank_name,
         lg.bank_account_number as lg_bank_account_number,
         lg.bank_account_name as lg_bank_account_name,
         s.name as state_name,
         s.logo_url as state_logo_url
       FROM demand_bills db
       JOIN clients c ON db.client_id = c.id
       JOIN local_governments lg ON db.lg_id = lg.id
       JOIN states s ON lg.state_id = s.id
       LEFT JOIN users u ON db.created_by = u.id
       WHERE db.id = $1 AND db.lg_id = $2`,
      [id, user.lg_id]
    );

    if (billRes.rows.length === 0) {
      return NextResponse.json({ error: 'Demand bill not found or access denied' }, { status: 404 });
    }

    const bill = billRes.rows[0];

    // Dynamic Overdue Checking
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(23, 59, 59, 999);
    const today = new Date();

    if (bill.payment_status !== 'paid' && today > dueDate) {
      const overdueLogCheck = await query(
        `SELECT id FROM demand_bill_status_logs 
         WHERE demand_bill_id = $1 AND change_type = 'overdue_flagged'`,
        [id]
      );

      if (overdueLogCheck.rows.length === 0) {
        await query(
          `INSERT INTO demand_bill_status_logs (
             demand_bill_id, status, changed_by_label, change_type, note
           ) VALUES ($1, 'overdue', 'System', 'overdue_flagged', 'Bill flagged as overdue because due date has passed.')`,
          [id]
        );
      }
    }

    // Fetch full history logs for timeline audit trail
    const logsRes = await query(
      `SELECT 
         id, 
         status, 
         changed_by_label, 
         change_type, 
         note, 
         metadata,
         created_at 
       FROM demand_bill_status_logs 
       WHERE demand_bill_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    // Fetch receipt for this demand bill (if exists)
    const receiptRes = await query(
      `SELECT 
         id,
         reference_number,
         payment_status,
         total_amount_paid::float as total_amount_paid,
         outstanding_balance::float as outstanding_balance,
         last_payment_date,
         created_at
       FROM receipts
       WHERE demand_bill_id = $1`,
      [id]
    );

    // Fetch all bank accounts for this local government
    const bankAccountsRes = await query(
      `SELECT id, bank_name, account_number, account_name, is_primary 
       FROM lg_bank_accounts 
       WHERE lg_id = $1 
       ORDER BY is_primary DESC, created_at ASC`,
      [bill.lg_id]
    );

    // Fetch treasurer and chairman signatures for dual-signature print
    const signaturesRes = await query(
      `SELECT u.name, u.signature_url, u.role
       FROM users u
       WHERE u.lg_id = $1
         AND u.role IN ('treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin')
         AND u.is_active = true
       ORDER BY 
         CASE WHEN u.role IN ('treasurer', 'lg_treasurer') THEN 0 ELSE 1 END ASC,
         u.created_at ASC`,
      [bill.lg_id]
    );

    const treasurer = signaturesRes.rows.find((u: any) => u.role === 'treasurer' || u.role === 'lg_treasurer') || null;
    const chairman = signaturesRes.rows.find((u: any) => u.role === 'lg_chairman' || u.role === 'lg_admin') || null;

    return NextResponse.json({
      bill: {
        ...bill,
        lg_bank_accounts: bankAccountsRes.rows
      },
      logs: logsRes.rows,
      receipt: receiptRes.rows[0] || null,
      signatures: {
        treasurer: treasurer ? { name: treasurer.name, signature_url: treasurer.signature_url } : null,
        chairman: chairman ? { name: chairman.name, signature_url: chairman.signature_url } : null,
      }
    });

  } catch (error: any) {
    console.error('GET demand bill details error:', error);
    return NextResponse.json({ error: 'Failed to retrieve demand bill details' }, { status: 500 });
  }
}

// 2. POST: Record manual bank payment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { bank_name, teller_ref, payment_date, note, amount, payment_type } = body;

    // Validation
    if (!bank_name || !teller_ref || !payment_date) {
      return NextResponse.json({ error: 'Bank name, teller reference number, and payment date are required' }, { status: 400 });
    }

    // Begin transaction
    await query('BEGIN');

    // Verify bill is unpaid and belongs to this LG
    const billCheck = await query(
      `SELECT 
         db.reference_number, 
         db.payment_status, 
         db.grand_total::float as grand_total,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         db.client_id,
         db.created_by,
         db.lg_id,
         lg.code as lg_code
       FROM demand_bills db
       JOIN local_governments lg ON db.lg_id = lg.id
       WHERE db.id = $1 AND db.lg_id = $2 FOR UPDATE`,
      [id, user.lg_id]
    );

    if (billCheck.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Demand bill not found or access denied' }, { status: 404 });
    }

    const bill = billCheck.rows[0];

    if (bill.payment_status === 'paid') {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'This demand bill has already been paid.' }, { status: 400 });
    }

    // Check if this manual teller reference has already been used
    const paymentCheck = await query(
      `SELECT id FROM payments WHERE transaction_id = $1`,
      [teller_ref.trim()]
    );

    if (paymentCheck.rows.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'This payment teller reference has already been recorded.' }, { status: 400 });
    }

    const selectedPaymentType = payment_type || 'full';
    const selectedAmount = selectedPaymentType === 'partial' ? parseFloat(amount) : bill.balance_due;

    if (isNaN(selectedAmount) || selectedAmount <= 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    if (selectedAmount > bill.balance_due + 0.01) {
      await query('ROLLBACK');
      return NextResponse.json({ error: `Payment amount exceeds outstanding balance of ₦${bill.balance_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}` }, { status: 400 });
    }

    const newAmountPaid = bill.amount_paid + selectedAmount;
    const newBalanceDue = Math.max(0, bill.grand_total - newAmountPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    // 1. Update bill details
    await query(
      `UPDATE demand_bills SET 
         payment_status = $1,
         payment_method = 'bank_transfer',
         amount_paid = $2,
         balance_due = $3,
         manual_payment_bank = $4,
         manual_payment_teller_ref = $5,
         manual_payment_date = $6,
         manual_payment_note = $7,
         updated_at = NOW()
       WHERE id = $8`,
      [
        newStatus,
        newAmountPaid,
        newBalanceDue,
        bank_name.trim(), 
        teller_ref.trim(), 
        payment_date, 
        note ? note.trim() : null, 
        id
      ]
    );

    // 2. Create payment confirmation audit status log with metadata
    const logChangeType = newBalanceDue === 0 ? 'payment_completed_manual' : 'partial_payment_manual';
    const logNote = newBalanceDue === 0
      ? `Manual payment settled. Bank: ${bank_name.trim()} | Teller: ${teller_ref.trim()}`
      : `Manual partial payment of ₦${selectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Remaining balance: ₦${newBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const logMetadata = {
      amount_paid: selectedAmount,
      balance_remaining: newBalanceDue,
      payment_method: 'manual',
      teller_ref: teller_ref.trim(),
      bank_name: bank_name.trim(),
      note: note ? note.trim() : null
    };

    await query(
      `INSERT INTO demand_bill_status_logs (
         demand_bill_id, status, changed_by_user_id, changed_by_label, change_type, note, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id, 
        newStatus, 
        user.id, 
        user.name, 
        logChangeType, 
        logNote, 
        JSON.stringify(logMetadata)
      ]
    );

    // 3. Insert payments record
    await query(
      `INSERT INTO payments (bill_id, transaction_id, amount, currency, status, payment_date, raw_payload)
       VALUES ($1, $2, $3, 'NGN', 'successful', $4, $5)`,
      [
        id, 
        teller_ref.trim(), 
        selectedAmount, 
        payment_date, 
        JSON.stringify({ bank_name, teller_ref, note, officer_id: user.id })
      ]
    );

    // 4. Upsert receipt (on every payment)
    await upsertReceipt({
      demandBillId: id,
      lgId: bill.lg_id,
      clientId: bill.client_id,
      createdByUserId: user.id,
      officerName: user.name,
      totalBillAmount: bill.grand_total,
      paymentAmount: selectedAmount,
      newTotalPaid: newAmountPaid,
      newBalance: newBalanceDue,
      paymentMethod: 'bank_transfer',
      transactionRef: teller_ref.trim(),
      bankName: bank_name.trim(),
      tellerRef: teller_ref.trim(),
      paymentDate: payment_date,
    });

    // 5. Create platform audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'record_manual_payment', 
        `Recorded manual ${selectedPaymentType} payment of ₦${selectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Bank: ${bank_name}, Teller: ${teller_ref}) for Bill: ${bill.reference_number}`
      ]
    );

    await query('COMMIT');

    return NextResponse.json({ success: true, message: 'Manual payment recorded successfully' });

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Manual payment rollback crash:', rbErr);
    }
    console.error('POST record manual payment error:', error);
    return NextResponse.json({ error: 'Failed to record manual payment' }, { status: 500 });
  }
}
