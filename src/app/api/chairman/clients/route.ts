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
    const officerId = searchParams.get('officerId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    
    // Sort parameters
    const sortField = searchParams.get('sortField') || 'created_at'; // created_at | total_paid | outstanding_balance
    const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC | DESC
    
    // Pagination parameters
    const all = searchParams.get('all') === 'true'; // For export purposes to get all matching rows
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // Fetch officers in this LGA for the filter dropdown
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
      filterClauses.push(`(full_name ILIKE $${paramCounter} OR phone_number ILIKE $${paramCounter} OR reference_number ILIKE $${paramCounter})`);
      queryParams.push(`%${search.trim()}%`);
      paramCounter++;
    }

    if (officerId) {
      filterClauses.push(`created_by = $${paramCounter}`);
      queryParams.push(officerId);
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
      WITH client_list AS (
        SELECT 
          c.id,
          c.reference_number,
          c.full_name,
          c.phone_number,
          c.address,
          c.ward,
          c.created_at,
          c.created_by,
          COALESCE(u.name, 'System') as added_by,
          (SELECT COUNT(*)::int FROM demand_bills db WHERE db.client_id = c.id) as total_bills,
          (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.client_id = c.id AND p.status = 'successful') as total_paid,
          (SELECT COALESCE(SUM(db.balance_due), 0)::float FROM demand_bills db WHERE db.client_id = c.id) as outstanding_balance
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.lg_id = $1
      )
    `;

    // 1. Get filtered total count and summary stats
    const summarySql = `
      ${baseQuery}
      SELECT 
        COUNT(*)::int as total_count,
        COALESCE(SUM(total_paid), 0)::float as total_revenue,
        COALESCE(SUM(outstanding_balance), 0)::float as total_outstanding
      FROM client_list
      ${filterString}
    `;

    const summaryRes = await query(summarySql, queryParams);
    const { total_count = 0, total_revenue = 0, total_outstanding = 0 } = summaryRes.rows[0] || {};

    // Validate sort fields
    const validSortFields = ['created_at', 'total_paid', 'outstanding_balance', 'reference_number', 'full_name'];
    const finalSortField = validSortFields.includes(sortField) ? sortField : 'created_at';
    const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 2. Get client data rows
    let dataSql = `
      ${baseQuery}
      SELECT * FROM client_list
      ${filterString}
      ORDER BY ${finalSortField} ${finalSortOrder}
    `;

    let dataParams = [...queryParams];
    if (!all) {
      dataSql += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      dataParams.push(limit, offset);
    }

    const dataRes = await query(dataSql, dataParams);
    const clients = dataRes.rows;
    const totalPages = all ? 1 : Math.ceil(total_count / limit);

    return NextResponse.json({
      clients,
      officers: officersRes.rows,
      pagination: {
        totalCount: total_count,
        totalPages,
        currentPage: page,
        limit
      },
      summary: {
        totalRevenue: total_revenue,
        totalOutstanding: total_outstanding
      }
    });

  } catch (error: any) {
    console.error('Chairman clients GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve clients directory' }, { status: 500 });
  }
}
