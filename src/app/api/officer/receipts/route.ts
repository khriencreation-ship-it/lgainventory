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

// GET /api/officer/receipts — list receipts for this LG with search + status filter
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all'; // all | partially_paid | paid
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    let whereClause = `WHERE r.lg_id = $1`;
    const queryParams: any[] = [user.lg_id];

    if (status === 'partially_paid') {
      whereClause += ` AND r.payment_status = 'partially_paid'`;
    } else if (status === 'paid') {
      whereClause += ` AND r.payment_status = 'paid'`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const p = queryParams.length;
      whereClause += ` AND (
        LOWER(r.reference_number) LIKE $${p}
        OR LOWER(c.full_name) LIKE $${p}
        OR LOWER(db.reference_number) LIKE $${p}
      )`;
    }

    const receiptsRes = await query(
      `SELECT
         r.id,
         r.reference_number,
         r.payment_status,
         r.total_bill_amount::float,
         r.total_amount_paid::float,
         r.outstanding_balance::float,
         r.last_payment_date,
         r.last_payment_method,
         r.created_at,
         c.full_name AS client_name,
         db.reference_number AS demand_bill_reference
       FROM receipts r
       JOIN clients c ON r.client_id = c.id
       JOIN demand_bills db ON r.demand_bill_id = db.id
       ${whereClause}
       ORDER BY r.updated_at DESC`,
      queryParams
    );

    return NextResponse.json({ receipts: receiptsRes.rows });

  } catch (error: any) {
    console.error('GET receipts list error:', error);
    return NextResponse.json({ error: 'Failed to retrieve receipts' }, { status: 500 });
  }
}
