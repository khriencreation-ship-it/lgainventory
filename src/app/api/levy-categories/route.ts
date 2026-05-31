import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      'SELECT id, name, description FROM levy_categories WHERE lg_id = $1 ORDER BY name ASC',
      [user.lg_id]
    );
    return NextResponse.json({ categories: res.rows });
  } catch (error: any) {
    console.error('GET levy categories error:', error);
    return NextResponse.json({ error: 'Failed to retrieve levy categories' }, { status: 500 });
  }
}
