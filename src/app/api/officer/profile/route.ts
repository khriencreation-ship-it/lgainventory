import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT, verifyPassword, hashPassword } from '@/lib/auth';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c) => c.split('='))
  );
  const token = cookies['session'];
  return token ? await verifyJWT(token) : null;
}

// 1. GET: Load current account officer's profile details
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    const allowedRoles = ['lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin'];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRes = await query(
      `SELECT 
         u.id,
         u.name,
         u.email,
         u.role,
         u.phone_number,
         u.signature_url,
         lg.name as lg_name
       FROM users u
       LEFT JOIN local_governments lg ON u.lg_id = lg.id
       WHERE u.id = $1`,
      [user.id]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: userRes.rows[0] });
  } catch (error: any) {
    console.error('GET profile error:', error);
    return NextResponse.json({ error: 'Failed to retrieve profile details' }, { status: 500 });
  }
}

// 2. POST: Handle profile action updates (phone update or password update)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    const allowedRoles = ['lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin'];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // A. Update Phone Number Action
    if (action === 'update_phone') {
      const { phone_number } = body;
      
      if (typeof phone_number !== 'string') {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }

      const cleanPhone = phone_number.trim();
      
      // Update both u.phone_number and u.phone for backwards compatibility
      await query(
        `UPDATE users 
         SET phone_number = $1, phone = $1, updated_at = NOW() 
         WHERE id = $2`,
        [cleanPhone, user.id]
      );

      // Write audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, details) 
         VALUES ($1, 'update_profile_phone', 'Updated account phone number.')`,
        [user.id]
      );

      return NextResponse.json({ success: true, phone_number: cleanPhone });
    }

    // B. Change Password Action
    if (action === 'change_password') {
      const { currentPassword, newPassword, confirmPassword } = body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return NextResponse.json({ error: 'All password fields are required' }, { status: 400 });
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      // Fetch current password hash from database
      const passRes = await query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [user.id]
      );

      if (passRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const { password_hash } = passRes.rows[0];

      // Verify current password
      const isCorrect = await verifyPassword(currentPassword, password_hash);
      if (!isCorrect) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      // Hash and update to new password
      const newHash = await hashPassword(newPassword);
      await query(
        `UPDATE users 
         SET password_hash = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newHash, user.id]
      );

      // Write audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, details) 
         VALUES ($1, 'change_password', 'Updated password credentials.')`,
        [user.id]
      );

      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('POST profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile settings' }, { status: 500 });
  }
}
