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

    const { id: billId } = await params;

    // 1. Fetch Demand Bill Details
    const billRes = await query(
      `SELECT 
         db.*,
         c.full_name as client_name,
         c.reference_number as client_reference_number,
         c.phone_number as client_phone,
         c.address as client_address,
         COALESCE(u.name, 'System') as creator_name,
         lg.name as lg_name,
         lg.logo_url as lg_logo_url
       FROM demand_bills db
       JOIN clients c ON db.client_id = c.id
       JOIN local_governments lg ON db.lg_id = lg.id
       LEFT JOIN users u ON db.created_by = u.id
       WHERE db.id = $1 AND db.lg_id = $2`,
      [billId, lgId]
    );

    if (billRes.rows.length === 0) {
      return NextResponse.json({ error: 'Demand bill not found' }, { status: 404 });
    }
    const bill = billRes.rows[0];

    // 2. Fetch Status History Logs (Oldest to Newest)
    const logsRes = await query(
      `SELECT l.*, COALESCE(u.name, 'System') as changed_by_user
       FROM demand_bill_status_logs l
       LEFT JOIN users u ON l.changed_by_user_id = u.id
       WHERE l.demand_bill_id = $1
       ORDER BY l.created_at ASC`,
      [billId]
    );
    const statusLogs = logsRes.rows;

    // 3. Fetch Receipt if it exists
    const receiptRes = await query(
      `SELECT id, reference_number, payment_status::text as payment_status, total_amount_paid::float as total_amount_paid, outstanding_balance::float as outstanding_balance
       FROM receipts 
       WHERE demand_bill_id = $1 AND lg_id = $2`,
      [billId, lgId]
    );
    const receipt = receiptRes.rows[0] || null;

    return NextResponse.json({
      bill,
      statusLogs,
      receipt
    });

  } catch (error: any) {
    console.error('Chairman demand bill detail GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve demand bill details' }, { status: 500 });
  }
}
