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

// 1. PATCH: Update levy item name
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Levy item name is required' }, { status: 400 });
    }

    // Verify item exists and belongs to this LG
    const check = await query('SELECT category_id, name FROM levy_items_master WHERE id = $1 AND lg_id = $2', [itemId, id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Levy item not found' }, { status: 404 });
    }

    const item = check.rows[0];

    // Check duplicate name within the same category for this LG (excluding current item)
    const duplicate = await query(
      'SELECT id FROM levy_items_master WHERE lg_id = $1 AND category_id = $2 AND LOWER(name) = LOWER($3) AND id <> $4',
      [id, item.category_id, name.trim(), itemId]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'A levy item with this name already exists in this category' }, { status: 400 });
    }

    const updateRes = await query(
      `UPDATE levy_items_master 
       SET name = $1
       WHERE id = $2 AND lg_id = $3
       RETURNING id, category_id, name, is_seeded, created_at`,
      [name.trim(), itemId, id]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'update_lg_levy_item', `Updated levy item "${item.name}" to "${name.trim()}" for LG ID: ${id}`]
    );

    return NextResponse.json({ item: updateRes.rows[0] });
  } catch (error: any) {
    console.error('PATCH levy item error:', error);
    return NextResponse.json({ error: 'Failed to update levy item' }, { status: 500 });
  }
}

// 2. DELETE: Delete levy item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;

    // Verify item exists and belongs to this LG
    const check = await query('SELECT name FROM levy_items_master WHERE id = $1 AND lg_id = $2', [itemId, id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Levy item not found' }, { status: 404 });
    }

    const itemName = check.rows[0].name;

    // Check if this levy item has been used in any demand bill
    const isUsedRes = await query(
      `SELECT EXISTS(
         SELECT 1 
         FROM demand_bills db, 
              jsonb_array_elements(db.levy_items) elem 
         WHERE db.lg_id = $1 
           AND elem->>'levy_id' = $2
       ) as exists`,
      [id, itemId]
    );

    if (isUsedRes.rows[0].exists) {
      return NextResponse.json({ 
        error: 'Cannot delete levy item. It has been used in active demand bills.' 
      }, { status: 400 });
    }

    // Delete item
    await query('DELETE FROM levy_items_master WHERE id = $1 AND lg_id = $2', [itemId, id]);

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'delete_lg_levy_item', `Deleted levy item "${itemName}" for LG ID: ${id}`]
    );

    return NextResponse.json({ success: true, message: 'Levy item deleted successfully' });
  } catch (error: any) {
    console.error('DELETE levy item error:', error);
    return NextResponse.json({ error: 'Failed to delete levy item' }, { status: 500 });
  }
}
