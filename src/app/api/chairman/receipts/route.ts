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

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_chairman' && user.role !== 'lg_admin' && user.role !== 'treasurer' && user.role !== 'lg_treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all | partially_paid | paid
    const officerId = searchParams.get('officerId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Sort parameters
    const sortField = searchParams.get('sortField') || 'last_payment_date'; // last_payment_date | total_amount_paid | payment_status
    const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC | DESC

    // Pagination
    const all = searchParams.get('all') === 'true'; // For export purposes
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // Fetch officers in this LGA to populate filter dropdown
    const officersRes = await query(
      `SELECT id, name FROM users 
       WHERE lg_id = $1 AND role IN ('lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer') 
       ORDER BY name ASC`,
      [lgId]
    );

    // Build filters dynamically
    let queryParams: any[] = [lgId];
    let paramCounter = 2;
    let filterClauses = [];

    if (search.trim()) {
      filterClauses.push(
        `(r.reference_number ILIKE $${paramCounter} OR c.full_name ILIKE $${paramCounter} OR db.reference_number ILIKE $${paramCounter})`
      );
      queryParams.push(`%${search.trim()}%`);
      paramCounter++;
    }

    if (status === 'partially_paid') {
      filterClauses.push(`r.payment_status = 'partially_paid'`);
    } else if (status === 'paid') {
      filterClauses.push(`r.payment_status = 'paid'`);
    }

    if (officerId) {
      filterClauses.push(`r.created_by = $${paramCounter}`);
      queryParams.push(officerId);
      paramCounter++;
    }

    if (startDate) {
      filterClauses.push(`r.last_payment_date >= $${paramCounter}`);
      queryParams.push(new Date(startDate));
      paramCounter++;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filterClauses.push(`r.last_payment_date <= $${paramCounter}`);
      queryParams.push(end);
      paramCounter++;
    }

    const filterString = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

    // Main CTE query
    const baseQuery = `
      WITH receipts_list AS (
        SELECT 
          r.id,
          r.reference_number,
          r.payment_status,
          r.total_bill_amount::float as total_bill_amount,
          r.total_amount_paid::float as total_amount_paid,
          r.outstanding_balance::float as outstanding_balance,
          r.last_payment_date,
          r.last_payment_method,
          COALESCE(u.name, 'System') as generated_by,
          r.created_by as officer_id,
          db.reference_number as demand_bill_reference,
          r.demand_bill_id,
          c.full_name as client_name,
          r.client_id,
          r.lg_id
        FROM receipts r
        JOIN clients c ON r.client_id = c.id
        JOIN demand_bills db ON r.demand_bill_id = db.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.lg_id = $1
      )
    `;

    // 1. Get filtered total count and summary stats
    const summarySql = `
      ${baseQuery}
      SELECT 
        COUNT(*)::int as total_count,
        COALESCE(SUM(total_amount_paid), 0)::float as total_collected,
        COALESCE(SUM(outstanding_balance), 0)::float as total_outstanding
      FROM receipts_list
      ${filterString}
    `;

    const summaryRes = await query(summarySql, queryParams);
    const { total_count = 0, total_collected = 0, total_outstanding = 0 } = summaryRes.rows[0] || {};

    // Validate sort fields
    const validSortFields = ['last_payment_date', 'total_amount_paid', 'payment_status', 'total_bill_amount', 'outstanding_balance'];
    const finalSortField = validSortFields.includes(sortField) ? sortField : 'last_payment_date';
    const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 2. Get receipts rows
    let dataSql = `
      ${baseQuery}
      SELECT * FROM receipts_list
      ${filterString}
      ORDER BY ${finalSortField} ${finalSortOrder}
    `;

    let dataParams = [...queryParams];
    if (!all) {
      dataSql += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      dataParams.push(limit, offset);
    }

    const dataRes = await query(dataSql, dataParams);
    const receipts = dataRes.rows;
    const totalPages = all ? 1 : Math.ceil(total_count / limit);

    return NextResponse.json({
      receipts,
      officers: officersRes.rows,
      pagination: {
        totalCount: total_count,
        totalPages,
        currentPage: page,
        limit
      },
      summary: {
        totalCollected: total_collected,
        totalOutstanding: total_outstanding
      }
    });

  } catch (error: any) {
    console.error('Chairman receipts GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve receipts directory' }, { status: 500 });
  }
}
