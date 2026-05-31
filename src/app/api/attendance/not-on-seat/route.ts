import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c) => c.split('='))
  );
  const token = cookies['session'];
  return token ? await verifyJWT(token) : null;
}

function getNigeriaDateString(d: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await request.json();
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const todayStr = getNigeriaDateString();

    // Check if user is clocked in
    const attendanceRes = await query(
      `SELECT * FROM attendance_logs 
       WHERE user_id = $1 AND date = $2`,
      [user.id, todayStr]
    );

    const log = attendanceRes.rows[0];
    if (!log) {
      return NextResponse.json({ error: 'You are not clocked in today' }, { status: 400 });
    }

    if (log.status !== 'clocked_in') {
      return NextResponse.json({ error: `Cannot step out from status: ${log.status}` }, { status: 400 });
    }

    // Start transaction
    await query('BEGIN');

    // Create not_on_seat_log
    const insertRes = await query(
      `INSERT INTO not_on_seat_logs (
        attendance_log_id, user_id, lg_id, reason, start_time
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *`,
      [log.id, user.id, user.lg_id, reason.trim()]
    );

    // Update attendance status to not_on_seat
    await query(
      `UPDATE attendance_logs 
       SET status = 'not_on_seat', updated_at = NOW() 
       WHERE id = $1`,
      [log.id]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      notOnSeatLog: insertRes.rows[0]
    });

  } catch (error: any) {
    try { await query('ROLLBACK'); } catch (_) {}
    console.error('Error marking not on seat:', error);
    return NextResponse.json({ error: 'Failed to mark not on seat' }, { status: 500 });
  }
}
