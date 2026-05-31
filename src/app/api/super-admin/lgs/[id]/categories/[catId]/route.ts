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

// 1. PATCH: Update category details (name, description)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, catId } = await params;
    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Verify category exists and belongs to this LG
    const check = await query('SELECT name FROM levy_categories WHERE id = $1 AND lg_id = $2', [catId, id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const oldName = check.rows[0].name;

    // Check duplicate name within the same LG (excluding current category)
    const duplicate = await query(
      'SELECT id FROM levy_categories WHERE lg_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3',
      [id, name.trim(), catId]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'A category with this name already exists for this Local Government' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE levy_categories 
       SET name = $1, description = $2
       WHERE id = $3 AND lg_id = $4
       RETURNING id, name, description, is_seeded, created_at`,
      [name.trim(), description ? description.trim() : null, catId, id]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'update_lg_category', `Updated category "${oldName}" to "${name.trim()}" for LG ID: ${id}`]
    );

    return NextResponse.json({ category: updateRes.rows[0] });
  } catch (error: any) {
    console.error('PATCH category error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// 2. DELETE: Delete category
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, catId } = await params;

    // Verify category exists and belongs to this LG
    const check = await query('SELECT name FROM levy_categories WHERE id = $1 AND lg_id = $2', [catId, id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const categoryName = check.rows[0].name;

    // Check if any levy item of this category has been used in any demand bill
    const isUsedRes = await query(
      `SELECT EXISTS(
         SELECT 1 
         FROM demand_bills db, 
              jsonb_array_elements(db.levy_items) elem 
         WHERE db.lg_id = $1 
           AND elem->>'category_id' = $2
       ) as exists`,
      [id, catId]
    );

    if (isUsedRes.rows[0].exists) {
      return NextResponse.json({ 
        error: 'Cannot delete category. One or more levy items under this category have been used in active demand bills.' 
      }, { status: 400 });
    }

    // Delete category (cascade will delete items under it due to REFERENCES constraint on levy_items_master)
    await query('DELETE FROM levy_categories WHERE id = $1 AND lg_id = $2', [catId, id]);

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'delete_lg_category', `Deleted category "${categoryName}" for LG ID: ${id}`]
    );

    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('DELETE category error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
