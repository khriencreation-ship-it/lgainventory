import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';


async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Fetch Specific State details, LGAs and counts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Fetch state metadata and counts
    const stateResult = await query(
      `SELECT 
        s.id, 
        s.name, 
        s.code, 
        s.logo_url, 
        s.is_active, 
        s.created_at,
        COUNT(DISTINCT lg.id)::int as lg_count,
        COUNT(DISTINCT u.id)::int as user_count
      FROM states s 
      LEFT JOIN local_governments lg ON s.id = lg.state_id 
      LEFT JOIN users u ON lg.id = u.lg_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.code, s.logo_url, s.is_active, s.created_at`,
      [id]
    );

    if (stateResult.rows.length === 0) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    // Fetch LGAs onboarded in this state
    const lgsResult = await query(
      'SELECT id, name, code, is_active, created_at FROM local_governments WHERE state_id = $1 ORDER BY name ASC',
      [id]
    );

    return NextResponse.json({ 
      state: stateResult.rows[0],
      lgs: lgsResult.rows 
    });
  } catch (error: any) {
    console.error('GET State detail error:', error);
    return NextResponse.json({ error: 'Failed to retrieve state details' }, { status: 500 });
  }
}

// 2. PATCH: Update State details (is_active, name, code, logo_url)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    const { id } = await params;
    const { is_active, name, code, logo_url } = await request.json();

    // Check if state exists
    const stateCheck = await query('SELECT id, name, code, logo_url, is_active FROM states WHERE id = $1', [id]);
    if (stateCheck.rows.length === 0) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    const currentState = stateCheck.rows[0];

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let valIndex = 1;

    if (is_active !== undefined) {
      fieldsToUpdate.push(`is_active = $${valIndex++}`);
      values.push(is_active);
    }
    if (name !== undefined) {
      fieldsToUpdate.push(`name = $${valIndex++}`);
      values.push(name.trim());
    }
    if (code !== undefined) {
      fieldsToUpdate.push(`code = $${valIndex++}`);
      values.push(code.trim().toUpperCase());
    }
    if (logo_url !== undefined) {
      fieldsToUpdate.push(`logo_url = $${valIndex++}`);
      values.push(logo_url ? logo_url.trim() : null);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No update parameters provided' }, { status: 400 });
    }

    values.push(id);
    const updateQuery = `
      UPDATE states 
      SET ${fieldsToUpdate.join(', ')} 
      WHERE id = $${valIndex} 
      RETURNING id, name, code, logo_url, is_active, created_at
    `;

    const updateResult = await query(updateQuery, values);
    const updatedState = updateResult.rows[0];

    // Log action
    if (user) {
      let logMsg = `Updated state ${currentState.name}: `;
      const changes: string[] = [];
      if (is_active !== undefined && is_active !== currentState.is_active) {
        changes.push(`status to ${is_active ? 'active' : 'deactivated'}`);
      }
      if (name !== undefined && name.trim() !== currentState.name) {
        changes.push(`name to "${name.trim()}"`);
      }
      if (code !== undefined && code.trim().toUpperCase() !== currentState.code) {
        changes.push(`code to "${code.trim().toUpperCase()}"`);
      }
      if (logo_url !== undefined && logo_url !== currentState.logo_url) {
        changes.push(`logo_url to "${logo_url}"`);
      }
      logMsg += changes.join(', ');
      
      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [user.id, 'update_state', logMsg]
      );
    }

    return NextResponse.json({ state: updatedState });
  } catch (error: any) {
    console.error('PATCH State error:', error);
    return NextResponse.json({ error: 'Failed to update state' }, { status: 500 });
  }
}

// 3. DELETE: Remove state from platform (if restriction check passes)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if state exists
    const stateCheck = await query('SELECT id, name, code, logo_url FROM states WHERE id = $1', [id]);
    if (stateCheck.rows.length === 0) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }
    const targetState = stateCheck.rows[0];

    // Check for associated local government tenants
    const lgCheck = await query('SELECT COUNT(*)::int as count FROM local_governments WHERE state_id = $1', [id]);
    if (lgCheck.rows[0].count > 0) {
      return NextResponse.json({ 
        error: `Cannot delete state "${targetState.name}" because it has ${lgCheck.rows[0].count} onboarded Local Governments. Remove them first to prevent orphaned records.`
      }, { status: 400 });
    }

    // Delete logo file from Supabase storage or disk if it exists
    const logoUrl = targetState.logo_url;
    if (logoUrl) {
      if (logoUrl.includes('/storage/v1/object/public/logos/')) {
        const parts = logoUrl.split('/storage/v1/object/public/logos/');
        const filename = parts[parts.length - 1];
        if (filename) {
          try {
            const { error: delErr } = await supabase.storage
              .from('logos')
              .remove([filename]);
            if (delErr) {
              console.error(`Failed to delete logo from Supabase: ${delErr.message}`);
            }
          } catch (err: any) {
            console.error(`Supabase storage deletion error: ${err.message}`);
          }
        }
      } else if (logoUrl.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', logoUrl);
        try {
          await unlink(filePath);
        } catch (err: any) {
          console.error(`Failed to delete local state logo file: ${err.message}`);
        }
      }
    }

    // Delete state
    await query('DELETE FROM states WHERE id = $1', [id]);

    // Log action
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'delete_state', `Deleted state: ${targetState.name} (${targetState.code})`]
    );

    return NextResponse.json({ success: true, message: 'State deleted successfully' });
  } catch (error: any) {
    console.error('DELETE State error:', error);
    return NextResponse.json({ error: 'Failed to delete state' }, { status: 500 });
  }
}
