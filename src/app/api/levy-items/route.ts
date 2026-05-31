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

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId parameter is required' }, { status: 400 });
    }

    const res = await query(
      'SELECT id, category_id, name FROM levy_items_master WHERE category_id = $1 AND lg_id = $2 ORDER BY name ASC',
      [categoryId, user.lg_id]
    );
    return NextResponse.json({ items: res.rows });
  } catch (error: any) {
    console.error('GET levy items error:', error);
    return NextResponse.json({ error: 'Failed to retrieve levy items' }, { status: 500 });
  }
}
