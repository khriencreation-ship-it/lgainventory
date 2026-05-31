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

// 1. GET: List all items under a specific category for an LG
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, catId } = await params;

    const res = await query(
      `SELECT 
         id, 
         category_id, 
         name, 
         is_seeded, 
         created_at,
         EXISTS(
           SELECT 1 
           FROM demand_bills db, 
                jsonb_array_elements(db.levy_items) elem 
           WHERE db.lg_id = $1 
             AND elem->>'levy_id' = i.id::text
         ) as is_used
       FROM levy_items_master i
       WHERE category_id = $2 AND lg_id = $1
       ORDER BY name ASC`,
      [id, catId]
    );

    return NextResponse.json({ items: res.rows });
  } catch (error: any) {
    console.error('GET category items error:', error);
    return NextResponse.json({ error: 'Failed to retrieve category items' }, { status: 500 });
  }
}

// 2. POST: Add a new levy item to this category
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, catId } = await params;
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Levy item name is required' }, { status: 400 });
    }

    // Verify category exists and belongs to this LG
    const catCheck = await query('SELECT name FROM levy_categories WHERE id = $1 AND lg_id = $2', [catId, id]);
    if (catCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check duplicate name within the same category for this LG
    const duplicate = await query(
      'SELECT id FROM levy_items_master WHERE lg_id = $1 AND category_id = $2 AND LOWER(name) = LOWER($3)',
      [id, catId, name.trim()]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'A levy item with this name already exists in this category' }, { status: 400 });
    }

    const insertResult = await query(
      `INSERT INTO levy_items_master (category_id, name, lg_id, is_seeded)
       VALUES ($1, $2, $3, false)
       RETURNING id, category_id, name, is_seeded, created_at`,
      [catId, name.trim(), id]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'create_lg_levy_item', `Created levy item "${name.trim()}" in category "${catCheck.rows[0].name}" for LG ID: ${id}`]
    );

    return NextResponse.json({ item: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST LG category item error:', error);
    return NextResponse.json({ error: 'Failed to create levy item' }, { status: 500 });
  }
}
