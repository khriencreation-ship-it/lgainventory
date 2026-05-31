import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c) => c.split('='))
  );
  const token = cookies['session'];
  return token ? await verifyJWT(token) : null;
}

// GET /api/officer/receipts/[id] — full receipt detail including linked demand bill
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

    // Fetch receipt with all joined details
    const receiptRes = await query(
      `SELECT
         r.id,
         r.reference_number,
         r.payment_status,
         r.total_bill_amount::float,
         r.total_amount_paid::float,
         r.outstanding_balance::float,
         r.last_payment_amount::float,
         r.last_payment_method,
         r.last_payment_date,
         r.last_payment_reference,
         r.payments_log,
         r.created_at,
         r.updated_at,
         r.demand_bill_id,
         r.client_id,
         c.full_name AS client_name,
         c.reference_number AS client_reference_number,
         c.phone_number AS client_phone,
         c.address AS client_address,
         c.ward AS client_ward,
         db.reference_number AS demand_bill_reference,
         db.grand_total::float AS demand_bill_grand_total,
         db.levy_items AS demand_bill_levy_items,
         db.subtotal::float AS demand_bill_subtotal,
         db.arrears::float AS demand_bill_arrears,
         db.penalty::float AS demand_bill_penalty,
         db.year_of_billing,
         db.due_date,
         db.amount_in_words,
         uc.name AS created_by_name,
         uc.signature_url AS created_by_signature_url,
         uu.name AS last_updated_by_name,
         lg.name AS lg_name,
         lg.logo_url AS lg_logo_url,
         lg.bank_name AS lg_bank_name,
         lg.bank_account_number AS lg_bank_account_number,
         lg.bank_account_name AS lg_bank_account_name,
         s.name AS state_name,
         s.logo_url AS state_logo_url
       FROM receipts r
       JOIN clients c ON r.client_id = c.id
       JOIN demand_bills db ON r.demand_bill_id = db.id
       JOIN local_governments lg ON r.lg_id = lg.id
       JOIN states s ON lg.state_id = s.id
       LEFT JOIN users uc ON r.created_by = uc.id
       LEFT JOIN users uu ON r.last_updated_by = uu.id
       WHERE r.id = $1 AND r.lg_id = $2`,
      [id, user.lg_id]
    );

    if (receiptRes.rows.length === 0) {
      return NextResponse.json({ error: 'Receipt not found or access denied' }, { status: 404 });
    }

    // Fetch audit logs for this receipt
    const auditRes = await query(
      `SELECT
         id,
         change_type,
         amount_paid_this_transaction::float,
         total_paid_after::float,
         balance_remaining_after::float,
         payment_method,
         transaction_ref,
         changed_by_label,
         note,
         created_at
       FROM receipt_status_logs
       WHERE receipt_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // Fetch treasurer and chairman signatures for dual-signature print
    const receipt = receiptRes.rows[0];
    const signaturesRes = await query(
      `SELECT u.name, u.signature_url, u.role
       FROM users u
       WHERE u.lg_id = $1
         AND u.role IN ('treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin')
         AND u.is_active = true
       ORDER BY 
         CASE WHEN u.role IN ('treasurer', 'lg_treasurer') THEN 0 ELSE 1 END ASC,
         u.created_at ASC`,
      [user.lg_id]
    );

    const treasurer = signaturesRes.rows.find((u: any) => u.role === 'treasurer' || u.role === 'lg_treasurer') || null;
    const chairman = signaturesRes.rows.find((u: any) => u.role === 'lg_chairman' || u.role === 'lg_admin') || null;

    return NextResponse.json({
      receipt,
      auditLogs: auditRes.rows,
      signatures: {
        treasurer: treasurer ? { name: treasurer.name, signature_url: treasurer.signature_url } : null,
        chairman: chairman ? { name: chairman.name, signature_url: chairman.signature_url } : null,
      }
    });

  } catch (error: any) {
    console.error('GET receipt detail error:', error);
    return NextResponse.json({ error: 'Failed to retrieve receipt details' }, { status: 500 });
  }
}
