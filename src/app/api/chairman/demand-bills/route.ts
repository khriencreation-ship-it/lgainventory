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
    const status = searchParams.get('status') || 'all'; // all | paid | partially_paid | not_paid | overdue
    const officerId = searchParams.get('officerId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const clientId = searchParams.get('clientId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Sort parameters
    const sortField = searchParams.get('sortField') || 'created_at'; // created_at | grand_total | payment_status | balance_due
    const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC | DESC

    // Pagination
    const all = searchParams.get('all') === 'true'; // For export purposes
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // Fetch officers in this LGA
    const officersRes = await query(
      `SELECT id, name FROM users 
       WHERE lg_id = $1 AND role IN ('lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer') 
       ORDER BY name ASC`,
      [lgId]
    );

    // Fetch categories in this LGA (LGA-scoped only to avoid duplicates from templates)
    const categoriesRes = await query(
      `SELECT id, name FROM levy_categories 
       WHERE lg_id = $1 
       ORDER BY name ASC`,
      [lgId]
    );

    // Fetch clients in this LGA
    const clientsRes = await query(
      `SELECT id, full_name, reference_number FROM clients
       WHERE lg_id = $1
       ORDER BY full_name ASC`,
      [lgId]
    );

    // Build filters dynamically
    let queryParams: any[] = [lgId];
    let paramCounter = 2;
    let filterClauses = [];

    if (search.trim()) {
      filterClauses.push(`(reference_number ILIKE $${paramCounter} OR client_name ILIKE $${paramCounter})`);
      queryParams.push(`%${search.trim()}%`);
      paramCounter++;
    }

    if (status === 'paid') {
      filterClauses.push(`payment_status = 'paid'`);
    } else if (status === 'partially_paid') {
      filterClauses.push(`payment_status = 'partially_paid' AND due_date >= CURRENT_DATE`);
    } else if (status === 'not_paid') {
      filterClauses.push(`payment_status = 'unpaid' AND due_date >= CURRENT_DATE`);
    } else if (status === 'overdue') {
      filterClauses.push(`payment_status != 'paid' AND due_date < CURRENT_DATE`);
    }

    if (officerId) {
      filterClauses.push(`officer_id = $${paramCounter}`);
      queryParams.push(officerId);
      paramCounter++;
    }

    if (categoryId) {
      filterClauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(levy_items) elem WHERE elem->>'category_id' = $${paramCounter})`);
      queryParams.push(categoryId);
      paramCounter++;
    }

    if (clientId) {
      filterClauses.push(`client_id = $${paramCounter}`);
      queryParams.push(clientId);
      paramCounter++;
    }

    if (startDate) {
      filterClauses.push(`created_at >= $${paramCounter}`);
      queryParams.push(new Date(startDate));
      paramCounter++;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filterClauses.push(`created_at <= $${paramCounter}`);
      queryParams.push(end);
      paramCounter++;
    }

    const filterString = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

    // Main CTE query
    const baseQuery = `
      WITH bills_list AS (
        SELECT 
          db.id,
          db.reference_number,
          c.full_name as client_name,
          db.client_id,
          db.grand_total::float as grand_total,
          COALESCE(db.amount_paid, 0.00)::float as amount_paid,
          db.balance_due::float as balance_due,
          db.levy_items,
          db.payment_status,
          db.due_date,
          db.created_at,
          COALESCE(u.name, 'System') as generated_by,
          db.created_by as officer_id
        FROM demand_bills db
        JOIN clients c ON db.client_id = c.id
        LEFT JOIN users u ON db.created_by = u.id
        WHERE db.lg_id = $1
      )
    `;

    // 1. Get filtered total count and summary stats
    const summarySql = `
      ${baseQuery}
      SELECT 
        COUNT(*)::int as total_count,
        COALESCE(SUM(grand_total), 0)::float as total_billed,
        COALESCE(SUM(amount_paid), 0)::float as total_collected,
        COALESCE(SUM(balance_due), 0)::float as total_outstanding
      FROM bills_list
      ${filterString}
    `;

    const summaryRes = await query(summarySql, queryParams);
    const { total_count = 0, total_billed = 0, total_collected = 0, total_outstanding = 0 } = summaryRes.rows[0] || {};

    // Validate sort fields
    const validSortFields = ['created_at', 'grand_total', 'payment_status', 'balance_due'];
    const finalSortField = validSortFields.includes(sortField) ? sortField : 'created_at';
    const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 2. Get demand bills rows
    let dataSql = `
      ${baseQuery}
      SELECT * FROM bills_list
      ${filterString}
      ORDER BY ${finalSortField} ${finalSortOrder}
    `;

    let dataParams = [...queryParams];
    if (!all) {
      dataSql += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      dataParams.push(limit, offset);
    }

    const dataRes = await query(dataSql, dataParams);
    const bills = dataRes.rows;
    const totalPages = all ? 1 : Math.ceil(total_count / limit);

    return NextResponse.json({
      bills,
      officers: officersRes.rows,
      categories: categoriesRes.rows,
      clients: clientsRes.rows,
      pagination: {
        totalCount: total_count,
        totalPages,
        currentPage: page,
        limit
      },
      summary: {
        totalBilled: total_billed,
        totalCollected: total_collected,
        totalOutstanding: total_outstanding
      }
    });

  } catch (error: any) {
    console.error('Chairman demand bills GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve demand bills directory' }, { status: 500 });
  }
}
