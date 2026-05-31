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

    const { id: clientId } = await params;

    // 1. Fetch Client Details
    const clientRes = await query(
      `SELECT c.*, COALESCE(u.name, 'System') as added_by 
       FROM clients c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1 AND c.lg_id = $2`,
      [clientId, lgId]
    );

    if (clientRes.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientRes.rows[0];

    // 2. Fetch Financial Summary Card stats
    // Total Billed, Total Paid, Outstanding Balance, Counts
    const statsRes = await query(
      `SELECT 
         COALESCE(SUM(grand_total), 0)::float as total_billed,
         (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.client_id = $1 AND p.status = 'successful') as total_paid,
         COALESCE(SUM(balance_due), 0)::float as outstanding_balance,
         COUNT(*)::int as total_bills,
         COUNT(*) FILTER (WHERE payment_status = 'paid')::int as paid_bills,
         COUNT(*) FILTER (WHERE payment_status <> 'paid')::int as unpaid_bills
       FROM demand_bills
       WHERE client_id = $1 AND lg_id = $2`,
      [clientId, lgId]
    );
    const stats = statsRes.rows[0];

    // 3. Fetch Demand Bills with Officer attribution
    const billsRes = await query(
      `SELECT db.*, COALESCE(u.name, 'System') as officer_name 
       FROM demand_bills db
       LEFT JOIN users u ON db.created_by = u.id
       WHERE db.client_id = $1 AND db.lg_id = $2
       ORDER BY db.created_at DESC`,
      [clientId, lgId]
    );
    const bills = billsRes.rows;

    // 4. Fetch Status Logs for all these bills
    // Querying all at once is much faster than running queries in a loop
    let logs: any[] = [];
    if (bills.length > 0) {
      const billIds = bills.map(b => b.id);
      const logsRes = await query(
        `SELECT l.*, COALESCE(u.name, 'System') as changed_by_user
         FROM demand_bill_status_logs l
         LEFT JOIN users u ON l.changed_by_user_id = u.id
         WHERE l.demand_bill_id = ANY($1)
         ORDER BY l.created_at DESC`,
        [billIds]
      );
      logs = logsRes.rows;
    }

    // Group logs by demand_bill_id
    const logsByBillId: { [key: string]: any[] } = {};
    logs.forEach(log => {
      if (!logsByBillId[log.demand_bill_id]) {
        logsByBillId[log.demand_bill_id] = [];
      }
      logsByBillId[log.demand_bill_id].push(log);
    });

    // Nest logs inside each bill
    const billsWithLogs = bills.map(bill => ({
      ...bill,
      status_logs: logsByBillId[bill.id] || []
    }));

    // 5. Fetch Receipts
    const receiptsRes = await query(
      `SELECT r.*, db.reference_number as bill_ref 
       FROM receipts r
       JOIN demand_bills db ON r.demand_bill_id = db.id
       WHERE r.client_id = $1 AND r.lg_id = $2
       ORDER BY r.created_at DESC`,
      [clientId, lgId]
    );
    const receipts = receiptsRes.rows;

    return NextResponse.json({
      client,
      stats,
      demandBills: billsWithLogs,
      receipts
    });

  } catch (error: any) {
    console.error('Chairman client detail GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve client details' }, { status: 500 });
  }
}
