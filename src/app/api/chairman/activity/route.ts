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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || ''; // 'client_created' | 'bill_created' | 'payment_confirmed'
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Build the query dynamically
    let queryParams: any[] = [lgId];
    let paramCounter = 2;

    let filterClauses = [];

    if (type) {
      filterClauses.push(`type = $${paramCounter}`);
      queryParams.push(type);
      paramCounter++;
    }

    if (search) {
      filterClauses.push(`(detail ILIKE $${paramCounter} OR ref ILIKE $${paramCounter} OR officer_name ILIKE $${paramCounter})`);
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    if (startDate) {
      filterClauses.push(`created_at >= $${paramCounter}`);
      queryParams.push(new Date(startDate));
      paramCounter++;
    }

    if (endDate) {
      // Add 23:59:59 to make end date inclusive
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filterClauses.push(`created_at <= $${paramCounter}`);
      queryParams.push(end);
      paramCounter++;
    }

    const filterString = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM (
        SELECT 'client_created' as type, c.reference_number as ref, c.full_name as detail, NULL::float as amount, c.created_at, u.name as officer_name
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.lg_id = $1

        UNION ALL

        SELECT 'bill_created' as type, db.reference_number as ref, cl.full_name as detail, db.grand_total::float as amount, db.created_at, u.name as officer_name
        FROM demand_bills db
        JOIN clients cl ON db.client_id = cl.id
        LEFT JOIN users u ON db.created_by = u.id
        WHERE db.lg_id = $1

        UNION ALL

        SELECT 'payment_confirmed' as type, r.reference_number as ref, cl.full_name as detail, r.total_amount_paid::float as amount, r.created_at, u.name as officer_name
        FROM receipts r
        JOIN clients cl ON r.client_id = cl.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.lg_id = $1
      ) activity
      ${filterString}
    `;

    const countRes = await query(countSql, queryParams);
    const totalRecords = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Data query
    const dataSql = `
      SELECT * FROM (
        SELECT 'client_created' as type, c.reference_number as ref, c.full_name as detail, NULL::float as amount, c.created_at, u.name as officer_name
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.lg_id = $1

        UNION ALL

        SELECT 'bill_created' as type, db.reference_number as ref, cl.full_name as detail, db.grand_total::float as amount, db.created_at, u.name as officer_name
        FROM demand_bills db
        JOIN clients cl ON db.client_id = cl.id
        LEFT JOIN users u ON db.created_by = u.id
        WHERE db.lg_id = $1

        UNION ALL

        SELECT 'payment_confirmed' as type, r.reference_number as ref, cl.full_name as detail, r.total_amount_paid::float as amount, r.created_at, u.name as officer_name
        FROM receipts r
        JOIN clients cl ON r.client_id = cl.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.lg_id = $1
      ) activity
      ${filterString}
      ORDER BY created_at DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    queryParams.push(limit);
    queryParams.push(offset);

    const dataRes = await query(dataSql, queryParams);

    return NextResponse.json({
      activities: dataRes.rows,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    });

  } catch (error: any) {
    console.error('Chairman activity api error:', error);
    return NextResponse.json({ error: 'Failed to retrieve activity log' }, { status: 500 });
  }
}
