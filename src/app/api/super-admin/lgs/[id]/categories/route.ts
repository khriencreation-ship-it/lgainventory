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

// 1. GET: List all categories for a specific LG
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
      `SELECT 
         c.id, 
         c.name, 
         c.description, 
         c.is_seeded,
         c.created_at,
         COUNT(i.id)::int as item_count,
         EXISTS(
           SELECT 1 
           FROM demand_bills db, 
                jsonb_array_elements(db.levy_items) elem 
           WHERE db.lg_id = $1 
             AND elem->>'category_id' = c.id::text
         ) as is_used
       FROM levy_categories c
       LEFT JOIN levy_items_master i ON c.id = i.category_id
       WHERE c.lg_id = $1
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [id]
    );

    return NextResponse.json({ categories: res.rows });
  } catch (error: any) {
    console.error('GET LG categories error:', error);
    return NextResponse.json({ error: 'Failed to retrieve categories' }, { status: 500 });
  }
}

// 2. POST: Create a new category for a specific LG
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
    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check duplicate name within the same LG
    const duplicate = await query(
      'SELECT id FROM levy_categories WHERE lg_id = $1 AND LOWER(name) = LOWER($2)',
      [id, name.trim()]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists for this Local Government' }, { status: 400 });
    }

    const insertResult = await query(
      `INSERT INTO levy_categories (name, description, lg_id, is_seeded)
       VALUES ($1, $2, $3, false)
       RETURNING id, name, description, is_seeded, created_at`,
      [name.trim(), description ? description.trim() : null, id]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'create_lg_category', `Created category "${name.trim()}" for LG ID: ${id}`]
    );

    return NextResponse.json({ category: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('POST LG category error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
