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

// 1. GET: List all bank accounts for the LG
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const res = await query(
      `SELECT id, bank_name, account_number, account_name, is_primary, created_at 
       FROM lg_bank_accounts 
       WHERE lg_id = $1 
       ORDER BY is_primary DESC, created_at ASC`,
      [id]
    );

    return NextResponse.json({ bankAccounts: res.rows });
  } catch (error: any) {
    console.error('GET LG bank accounts error:', error);
    return NextResponse.json({ error: 'Failed to retrieve bank accounts' }, { status: 500 });
  }
}

// 2. POST: Add a new bank account (always non-primary initially)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { bank_name, account_number, account_name } = await request.json();

    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: 'Bank name, account number, and account name are required' }, { status: 400 });
    }

    // Verify LG exists
    const lgCheck = await query('SELECT name FROM local_governments WHERE id = $1', [id]);
    if (lgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Local Government not found' }, { status: 404 });
    }

    // Check duplicate account number for this LG
    const duplicate = await query(
      'SELECT id FROM lg_bank_accounts WHERE lg_id = $1 AND account_number = $2',
      [id, account_number.trim()]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'This bank account is already registered for this Local Government' }, { status: 400 });
    }

    const insertResult = await query(
      `INSERT INTO lg_bank_accounts (lg_id, bank_name, account_number, account_name, is_primary)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, bank_name, account_number, account_name, is_primary, created_at`,
      [id, bank_name.trim(), account_number.trim(), account_name.trim()]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'add_lg_bank_account', 
        `Added bank account ${account_number.trim()} (${account_name.trim()}) in bank code ${bank_name.trim()} for LG: ${lgCheck.rows[0].name}`
      ]
    );

    return NextResponse.json({ bankAccount: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST LG bank account error:', error);
    return NextResponse.json({ error: 'Failed to add bank account' }, { status: 500 });
  }
}
