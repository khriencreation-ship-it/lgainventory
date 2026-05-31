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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_chairman' && user.role !== 'lg_admin' && user.role !== 'treasurer' && user.role !== 'lg_treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const { id: receiptId } = await params;

    // Fetch receipt with all joined details
    const receiptRes = await query(
      `SELECT
         r.id,
         r.reference_number,
         r.payment_status,
         r.total_bill_amount::float as total_bill_amount,
         r.total_amount_paid::float as total_amount_paid,
         r.outstanding_balance::float as outstanding_balance,
         r.last_payment_amount::float as last_payment_amount,
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
         db.payment_status AS demand_bill_payment_status,
         uc.name AS created_by_name,
         uu.name AS last_updated_by_name,
         lg.name AS lg_name,
         lg.logo_url AS lg_logo_url,
         s.name AS state_name
       FROM receipts r
       JOIN clients c ON r.client_id = c.id
       JOIN demand_bills db ON r.demand_bill_id = db.id
       JOIN local_governments lg ON r.lg_id = lg.id
       JOIN states s ON lg.state_id = s.id
       LEFT JOIN users uc ON r.created_by = uc.id
       LEFT JOIN users uu ON r.last_updated_by = uu.id
       WHERE r.id = $1 AND r.lg_id = $2`,
      [receiptId, lgId]
    );

    if (receiptRes.rows.length === 0) {
      return NextResponse.json({ error: 'Receipt not found or access denied' }, { status: 404 });
    }

    const receipt = receiptRes.rows[0];

    // Fetch audit logs for this receipt
    const auditRes = await query(
      `SELECT
         id,
         change_type,
         amount_paid_this_transaction::float as amount_paid_this_transaction,
         total_paid_after::float as total_paid_after,
         balance_remaining_after::float as balance_remaining_after,
         payment_method,
         transaction_ref,
         changed_by_label,
         note,
         created_at
       FROM receipt_status_logs
       WHERE receipt_id = $1
       ORDER BY created_at ASC`,
      [receiptId]
    );

    return NextResponse.json({
      receipt,
      auditLogs: auditRes.rows
    });

  } catch (error: any) {
    console.error('Chairman GET receipt detail error:', error);
    return NextResponse.json({ error: 'Failed to retrieve receipt details' }, { status: 500 });
  }
}
