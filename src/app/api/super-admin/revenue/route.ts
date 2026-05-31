import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chartPeriod = searchParams.get('chart_period') || 'monthly';
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const search = searchParams.get('search') || '';
    const stateId = searchParams.get('state_id') || '';
    const lgId = searchParams.get('lg_id') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    // 1. Fetch Summary Stats
    const summaryRes = await query(`
      SELECT 
        COALESCE(SUM(khrien_share), 0.00)::float AS total_revenue,
        COUNT(*)::int AS total_transactions
      FROM platform_transactions
    `);
    const activeLgsRes = await query(`
      SELECT COUNT(*)::int AS total_active_lgs FROM local_governments WHERE is_active = true
    `);
    const summary = {
      total_revenue: summaryRes.rows[0].total_revenue,
      total_transactions: summaryRes.rows[0].total_transactions,
      total_active_lgs: activeLgsRes.rows[0].total_active_lgs
    };

    // 2. Fetch Chart Data grouped by period
    let chartGroupQuery = '';
    if (chartPeriod === 'daily') {
      chartGroupQuery = "TO_CHAR(transaction_date, 'YYYY-MM-DD')";
    } else if (chartPeriod === 'weekly') {
      chartGroupQuery = "TO_CHAR(transaction_date, 'IYYY-\"W\"IW')";
    } else if (chartPeriod === 'yearly') {
      chartGroupQuery = "TO_CHAR(transaction_date, 'YYYY')";
    } else {
      // monthly (default)
      chartGroupQuery = "TO_CHAR(transaction_date, 'YYYY-MM')";
    }

    const chartRes = await query(`
      SELECT 
        ${chartGroupQuery} AS period,
        COALESCE(SUM(khrien_share), 0.00)::float AS amount
      FROM platform_transactions
      GROUP BY period
      ORDER BY period ASC
      LIMIT 30
    `);

    // 3. Fetch State Breakdown
    const stateBreakdownRes = await query(`
      SELECT 
        s.id AS state_id, 
        s.name AS state_name,
        COALESCE((SELECT COUNT(*)::int FROM local_governments WHERE state_id = s.id), 0) AS lg_count,
        COALESCE(COUNT(pt.id)::int, 0) AS total_transactions,
        COALESCE(SUM(pt.khrien_share), 0.00)::float AS total_revenue
      FROM states s
      LEFT JOIN platform_transactions pt ON pt.state_id = s.id
      GROUP BY s.id, s.name
      ORDER BY total_revenue DESC, s.name ASC
    `);

    // 4. Fetch LGA Breakdown
    const lgBreakdownRes = await query(`
      SELECT 
        lg.id AS lg_id, 
        lg.name AS lg_name,
        s.name AS state_name,
        COALESCE(COUNT(pt.id)::int, 0) AS total_transactions,
        COALESCE(SUM(pt.khrien_share), 0.00)::float AS total_revenue,
        MAX(pt.transaction_date) AS last_transaction_date
      FROM local_governments lg
      JOIN states s ON lg.state_id = s.id
      LEFT JOIN platform_transactions pt ON pt.lg_id = lg.id
      GROUP BY lg.id, lg.name, s.name
      ORDER BY total_revenue DESC, lg.name ASC
    `);

    // 5. Fetch Paginated Transactions Log with dynamic filters
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (stateId) {
      whereClauses.push(`pt.state_id = $${paramIndex++}`);
      queryParams.push(stateId);
    }
    if (lgId) {
      whereClauses.push(`pt.lg_id = $${paramIndex++}`);
      queryParams.push(lgId);
    }
    if (startDate) {
      whereClauses.push(`pt.transaction_date >= $${paramIndex++}`);
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClauses.push(`pt.transaction_date <= $${paramIndex++}::timestamp + interval '1 day'`);
      queryParams.push(endDate);
    }
    if (search) {
      whereClauses.push(`(pt.client_name ILIKE $${paramIndex} OR lg.name ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`);
      paramIndex++;
      queryParams.push(`%${search}%`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT COUNT(*)::int as count 
      FROM platform_transactions pt
      JOIN local_governments lg ON pt.lg_id = lg.id
      JOIN states s ON pt.state_id = s.id
      ${whereString}
    `, queryParams);
    const totalCount = countRes.rows[0].count;

    const limitVal = parseInt(limit) || 10;
    const pageVal = parseInt(page) || 1;
    const offset = (pageVal - 1) * limitVal;

    queryParams.push(limitVal);
    const limitPlaceholder = `$${paramIndex++}`;
    queryParams.push(offset);
    const offsetPlaceholder = `$${paramIndex++}`;

    const transactionsQuery = `
      SELECT 
        pt.id,
        pt.transaction_date,
        lg.name as lg_name,
        s.name as state_name,
        pt.client_name,
        pt.total_amount_paid::float as total_amount_paid,
        pt.lg_share::float as lg_share,
        pt.khrien_share::float as khrien_share,
        pt.flutterwave_transaction_id
      FROM platform_transactions pt
      JOIN local_governments lg ON pt.lg_id = lg.id
      JOIN states s ON pt.state_id = s.id
      ${whereString}
      ORDER BY pt.transaction_date DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const dataRes = await query(transactionsQuery, queryParams);

    return NextResponse.json({
      summary,
      chart_data: chartRes.rows,
      breakdown_states: stateBreakdownRes.rows,
      breakdown_lgs: lgBreakdownRes.rows,
      transactions: {
        data: dataRes.rows,
        total_count: totalCount,
        page: pageVal,
        limit: limitVal,
        total_pages: Math.ceil(totalCount / limitVal)
      }
    });

  } catch (error: any) {
    console.error('Super Admin Revenue API Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve platform revenue analytics' }, { status: 500 });
  }
}
