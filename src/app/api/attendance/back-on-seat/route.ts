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

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find active not_on_seat entry
    const activeRes = await query(
      `SELECT * FROM not_on_seat_logs 
       WHERE user_id = $1 AND end_time IS NULL 
       LIMIT 1`,
      [user.id]
    );

    const activeNos = activeRes.rows[0];
    if (!activeNos) {
      return NextResponse.json({ error: 'No active not on seat log found' }, { status: 400 });
    }

    // Start transaction
    await query('BEGIN');

    // Close the active not_on_seat entry
    const closeRes = await query(
      `UPDATE not_on_seat_logs 
       SET end_time = NOW(), 
           duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)) / 60)), 
           resolved_by = 'user' 
       WHERE id = $1 
       RETURNING duration_minutes`,
      [activeNos.id]
    );

    const durationMinutes = closeRes.rows[0].duration_minutes;

    // Update attendance status and aggregate total_time_not_on_seat
    await query(
      `UPDATE attendance_logs 
       SET status = 'clocked_in', 
           total_time_not_on_seat = COALESCE(total_time_not_on_seat, 0.00) + $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [durationMinutes, activeNos.attendance_log_id]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      durationMinutes
    });

  } catch (error: any) {
    try { await query('ROLLBACK'); } catch (_) {}
    console.error('Error marking back on seat:', error);
    return NextResponse.json({ error: 'Failed to mark back on seat' }, { status: 500 });
  }
}
