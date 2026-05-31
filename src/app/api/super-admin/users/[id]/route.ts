import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT, hashPassword } from '@/lib/auth';

async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Retrieve User Details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch user
    const userResult = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at, u.lg_id
       FROM users u
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userObj = userResult.rows[0];
    let lgName = null;
    let stateName = null;
    let stateId = null;

    if (userObj.lg_id) {
      const lgCheck = await query(
        `SELECT lg.name as lg_name, lg.state_id, s.name as state_name
         FROM local_governments lg
         JOIN states s ON lg.state_id = s.id
         WHERE lg.id = $1`,
        [userObj.lg_id]
      );
      if (lgCheck.rows.length > 0) {
        lgName = lgCheck.rows[0].lg_name;
        stateName = lgCheck.rows[0].state_name;
        stateId = lgCheck.rows[0].state_id;
      }
    }

    return NextResponse.json({
      user: {
        ...userObj,
        lg_name: lgName,
        state_name: stateName,
        state_id: stateId
      }
    });
  } catch (error: any) {
    console.error('GET User detail error:', error);
    return NextResponse.json({ error: 'Failed to retrieve user details' }, { status: 500 });
  }
}

// 2. PATCH: Update User Details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getUser(request);
    const { id } = await params;
    const { is_active, name, email, phone, role, lg_id, password } = await request.json();

    // Check if user exists
    const userCheck = await query('SELECT id, name, email, phone, role, lg_id, is_active FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUser = userCheck.rows[0];

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
    if (phone !== undefined) {
      fieldsToUpdate.push(`phone = $${valIndex++}`);
      values.push(phone ? phone.trim() : null);
    }
    if (email !== undefined) {
      const emailStr = email.toLowerCase().trim();
      // Check duplicate
      const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [emailStr, id]);
      if (emailCheck.rows.length > 0) {
        return NextResponse.json({ error: 'A user with this email address already exists' }, { status: 400 });
      }
      fieldsToUpdate.push(`email = $${valIndex++}`);
      values.push(emailStr);
    }
    if (role !== undefined) {
      if (!['super_admin', 'lg_admin', 'lg_account_officer', 'treasurer', 'lg_chairman', 'lg_treasurer', 'lg_officer'].includes(role)) {
        return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
      }
      fieldsToUpdate.push(`role = $${valIndex++}`);
      values.push(role);
    }
    if (lg_id !== undefined) {
      // If role is super_admin, we must set lg_id to NULL
      const targetRole = role !== undefined ? role : currentUser.role;
      if (targetRole === 'super_admin') {
        fieldsToUpdate.push(`lg_id = NULL`);
      } else {
        if (!lg_id) {
          return NextResponse.json({ error: 'Local Government association is required for this role' }, { status: 400 });
        }
        // Verify lg_id exists
        const lgCheck = await query('SELECT id FROM local_governments WHERE id = $1', [lg_id]);
        if (lgCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Selected Local Government does not exist' }, { status: 404 });
        }
        fieldsToUpdate.push(`lg_id = $${valIndex++}`);
        values.push(lg_id);
      }
    } else {
      // If role is updated to super_admin and lg_id is not provided, clear lg_id
      if (role === 'super_admin') {
        fieldsToUpdate.push(`lg_id = NULL`);
      }
    }
    if (password !== undefined && password.trim() !== '') {
      const passwordHash = await hashPassword(password);
      fieldsToUpdate.push(`password_hash = $${valIndex++}`);
      values.push(passwordHash);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No update parameters provided' }, { status: 400 });
    }

    values.push(id);
    const updateQuery = `
      UPDATE users 
      SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${valIndex} 
      RETURNING id, name, email, phone, role, lg_id, is_active, created_at
    `;

    const updateResult = await query(updateQuery, values);
    const updatedUser = updateResult.rows[0];

    // Log action
    if (adminUser) {
      let logMsg = `Updated User ${currentUser.name} (${currentUser.email}): `;
      const changes: string[] = [];
      if (is_active !== undefined && is_active !== currentUser.is_active) {
        changes.push(`status to ${is_active ? 'active' : 'revoked (deactivated)'}`);
      }
      if (name !== undefined && name.trim() !== currentUser.name) {
        changes.push(`name to "${name.trim()}"`);
      }
      if (email !== undefined && email.toLowerCase().trim() !== currentUser.email) {
        changes.push(`email to "${email.toLowerCase().trim()}"`);
      }
      if (phone !== undefined && phone !== currentUser.phone) {
        changes.push(`phone to "${phone}"`);
      }
      if (role !== undefined && role !== currentUser.role) {
        changes.push(`role to "${role}"`);
      }
      if (password !== undefined && password.trim() !== '') {
        changes.push(`password reset`);
      }
      logMsg += changes.join(', ');

      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [adminUser.id, 'update_user', logMsg]
      );
    }

    // Fetch lg and state names for updated response
    let lgName = null;
    let stateName = null;
    if (updatedUser.lg_id) {
      const lgCheck = await query(
        `SELECT lg.name as lg_name, s.name as state_name
         FROM local_governments lg
         JOIN states s ON lg.state_id = s.id
         WHERE lg.id = $1`,
        [updatedUser.lg_id]
      );
      if (lgCheck.rows.length > 0) {
        lgName = lgCheck.rows[0].lg_name;
        stateName = lgCheck.rows[0].state_name;
      }
    }

    return NextResponse.json({
      user: {
        ...updatedUser,
        lg_name: lgName,
        state_name: stateName
      }
    });
  } catch (error: any) {
    console.error('PATCH User error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// 3. DELETE: Remove User (must be deactivated first)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getUser(request);
    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if user exists
    const userCheck = await query('SELECT id, name, email, is_active FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = userCheck.rows[0];

    // Check that admin is not deleting themselves
    if (targetUser.id === adminUser.id) {
      return NextResponse.json({ error: 'You cannot delete your own user account.' }, { status: 400 });
    }

    // PREVENTIVE RULE: Access must be revoked first
    if (targetUser.is_active) {
      return NextResponse.json({ 
        error: `Cannot delete active user "${targetUser.name}". You must revoke their access first to pause account privileges.` 
      }, { status: 400 });
    }

    // Delete user row
    await query('DELETE FROM users WHERE id = $1', [id]);

    // Log action
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [adminUser.id, 'delete_user', `Deleted user account: ${targetUser.name} (${targetUser.email})`]
    );

    return NextResponse.json({ success: true, message: 'User account deleted successfully' });
  } catch (error: any) {
    console.error('DELETE User error:', error);
    return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 });
  }
}
