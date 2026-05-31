import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// Helper to resolve session user
async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Fetch paginated clients with real-time search
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT id, reference_number, full_name, phone_number, email_address, address, ward, created_at 
      FROM clients 
      WHERE lg_id = $1
    `;
    let countText = `
      SELECT COUNT(*)::int as count 
      FROM clients 
      WHERE lg_id = $1
    `;
    
    const queryParams: any[] = [user.lg_id];

    if (search.trim()) {
      const searchVal = `%${search.trim()}%`;
      queryText += ` AND (full_name ILIKE $2 OR phone_number ILIKE $2 OR reference_number ILIKE $2)`;
      countText += ` AND (full_name ILIKE $2 OR phone_number ILIKE $2 OR reference_number ILIKE $2)`;
      queryParams.push(searchVal);
    }

    queryText += ` ORDER BY reference_number DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    
    const finalQueryParams = [...queryParams, limit, offset];

    const [clientsRes, countRes] = await Promise.all([
      query(queryText, finalQueryParams),
      query(countText, queryParams)
    ]);

    const clients = clientsRes.rows;
    const totalCount = countRes.rows[0].count;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      clients,
      totalCount,
      totalPages,
      currentPage: page
    });

  } catch (error: any) {
    console.error('GET clients error:', error);
    return NextResponse.json({ error: 'Failed to retrieve clients directory' }, { status: 500 });
  }
}

// 2. POST: Create a new client portfolio with atomic sequential ID generation
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone_number, email_address, address, ward } = body;

    // Validation
    if (!full_name || !phone_number || !address) {
      return NextResponse.json({ error: 'Full name, phone number, and address are required fields' }, { status: 400 });
    }

    // Begin atomic transaction to handle sequential reference number generation safely
    await query('BEGIN');

    // 1. Lock the Local Government record for UPDATE to queue any concurrent creations in the same LGA
    const lgRes = await query(
      'SELECT code FROM local_governments WHERE id = $1 FOR UPDATE',
      [user.lg_id]
    );

    if (lgRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Associated Local Government not found' }, { status: 404 });
    }

    const lgCode = lgRes.rows[0].code.toUpperCase();

    // 2. Find the highest sequence number client record in this Local Government
    const searchPattern = `${lgCode}-CLT-%`;
    const latestRes = await query(
      `SELECT reference_number FROM clients 
       WHERE lg_id = $1 AND reference_number LIKE $2 
       ORDER BY reference_number DESC 
       LIMIT 1`,
      [user.lg_id, searchPattern]
    );

    let nextSequence = 1;
    if (latestRes.rows.length > 0) {
      const latestRef = latestRes.rows[0].reference_number;
      const refParts = latestRef.split('-CLT-');
      if (refParts.length >= 2) {
        const lastSeqNum = parseInt(refParts[refParts.length - 1], 10);
        if (!isNaN(lastSeqNum)) {
          nextSequence = lastSeqNum + 1;
        }
      }
    }

    // Format new reference number: e.g. IBN-CLT-0001
    const sequencePadded = String(nextSequence).padStart(4, '0');
    const referenceNumber = `${lgCode}-CLT-${sequencePadded}`;

    // 3. Insert the client record
    const insertRes = await query(
      `INSERT INTO clients (lg_id, reference_number, full_name, phone_number, email_address, address, ward, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, reference_number, full_name`,
      [
        user.lg_id, 
        referenceNumber, 
        full_name.trim(), 
        phone_number.trim(), 
        email_address ? email_address.trim() : null, 
        address.trim(), 
        ward ? ward.trim() : null,
        user.id
      ]
    );

    const newClient = insertRes.rows[0];

    // 4. Log the audit activity
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'create_client', 
        `Created client "${newClient.full_name}" with Reference: ${newClient.reference_number}`
      ]
    );

    await query('COMMIT');

    return NextResponse.json({ client: newClient }, { status: 201 });

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Transaction rollback crash:', rbErr);
    }
    console.error('POST client error:', error);
    return NextResponse.json({ error: 'Failed to create client portfolio' }, { status: 500 });
  }
}
