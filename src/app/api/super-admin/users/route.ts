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

export async function GET() {
  try {
    const usersResult = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone,
        u.role, 
        u.is_active, 
        u.created_at, 
        u.lg_id, 
        lg.name as lg_name, 
        lg.state_id, 
        s.name as state_name 
      FROM users u 
      LEFT JOIN local_governments lg ON u.lg_id = lg.id 
      LEFT JOIN states s ON lg.state_id = s.id 
      ORDER BY u.role ASC, u.name ASC
    `);
    return NextResponse.json({ users: usersResult.rows });
  } catch (error: any) {
    console.error('GET Users error:', error);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getUser(request);
    const { name, email, phone, password, role, lg_id } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password, and role are required' }, { status: 400 });
    }

    const emailStr = email.toLowerCase().trim();
    const nameStr = name.trim();
    const phoneStr = phone ? phone.trim() : null;
    const roleStr = role.trim();

    // Check valid roles
    if (!['super_admin', 'lg_admin', 'lg_account_officer', 'treasurer', 'lg_chairman', 'lg_treasurer', 'lg_officer'].includes(roleStr)) {
      return NextResponse.json({ error: 'Invalid user role specified' }, { status: 400 });
    }

    // Non-super-admin users must be associated with an LG
    if (roleStr !== 'super_admin' && !lg_id) {
      return NextResponse.json({ error: 'Local Government association is required for this role' }, { status: 400 });
    }

    // Check email uniqueness
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [emailStr]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'A user with this email address already exists' }, { status: 400 });
    }

    // If there is an LG association, verify it exists and get names
    let lgName = null;
    let stateName = null;
    if (roleStr !== 'super_admin' && lg_id) {
      const lgCheck = await query(`
        SELECT lg.name as lg_name, s.name as state_name 
        FROM local_governments lg 
        JOIN states s ON lg.state_id = s.id 
        WHERE lg.id = $1
      `, [lg_id]);
      
      if (lgCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Selected Local Government does not exist' }, { status: 404 });
      }
      lgName = lgCheck.rows[0].lg_name;
      stateName = lgCheck.rows[0].state_name;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const insertResult = await query(`
      INSERT INTO users (name, email, phone, password_hash, role, lg_id, is_active) 
      VALUES ($1, $2, $3, $4, $5, $6, true) 
      RETURNING id, name, email, phone, role, lg_id, is_active, created_at
    `, [nameStr, emailStr, phoneStr, passwordHash, roleStr, roleStr === 'super_admin' ? null : lg_id]);

    const newUser = insertResult.rows[0];

    // Log action
    if (adminUser) {
      const associationDesc = roleStr === 'super_admin' ? 'Khrien Super Admin' : `${lgName} (${stateName})`;
      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [adminUser.id, 'create_user', `Created user: ${newUser.name} (${newUser.email}) as ${newUser.role} associated with ${associationDesc}`]
      );
    }

    return NextResponse.json({ 
      user: { 
        ...newUser, 
        lg_name: lgName, 
        state_name: stateName 
      } 
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST User error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
