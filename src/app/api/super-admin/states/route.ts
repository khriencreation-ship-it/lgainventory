import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// Helper to get user context from cookies
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
    const statesResult = await query(
      'SELECT id, name, code, logo_url, is_active, created_at FROM states ORDER BY name ASC'
    );
    return NextResponse.json({ states: statesResult.rows });
  } catch (error: any) {
    console.error('GET States error:', error);
    return NextResponse.json({ error: 'Failed to retrieve states' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    const { name, code, logo_url } = await request.json();

    if (!name || !code) {
      return NextResponse.json({ error: 'State name and code are required' }, { status: 400 });
    }

    const nameStr = name.trim();
    const codeStr = code.trim().toUpperCase();
    const logoUrlStr = logo_url ? logo_url.trim() : null;

    // Check if name or code already exists
    const duplicateCheck = await query(
      'SELECT id FROM states WHERE name = $1 OR code = $2',
      [nameStr, codeStr]
    );

    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json({ error: 'A state with this name or code already exists' }, { status: 400 });
    }

    // Insert
    const insertResult = await query(
      'INSERT INTO states (name, code, logo_url, is_active) VALUES ($1, $2, $3, true) RETURNING id, name, code, logo_url, is_active, created_at',
      [nameStr, codeStr, logoUrlStr]
    );

    const newState = insertResult.rows[0];

    // Log action
    if (user) {
      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [user.id, 'create_state', `Created state: ${newState.name} (${newState.code})`]
      );
    }

    return NextResponse.json({ state: newState }, { status: 201 });
  } catch (error: any) {
    console.error('POST State error:', error);
    return NextResponse.json({ error: 'Failed to create state' }, { status: 500 });
  }
}
