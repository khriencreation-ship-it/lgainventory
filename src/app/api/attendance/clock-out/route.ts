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

    const todayStr = getNigeriaDateString();

    // Check if user has clocked in today and is not already clocked out
    const attendanceRes = await query(
      `SELECT * FROM attendance_logs 
       WHERE user_id = $1 AND date = $2`,
      [user.id, todayStr]
    );

    const log = attendanceRes.rows[0];
    if (!log) {
      return NextResponse.json({ error: 'You are not clocked in today' }, { status: 400 });
    }

    if (log.status === 'clocked_out') {
      return NextResponse.json({ error: 'You have already clocked out today' }, { status: 400 });
    }

    // Start transaction
    await query('BEGIN');

    let additionalAwayMinutes = 0;
    if (log.status === 'not_on_seat') {
      // Find active not_on_seat entry
      const activeRes = await query(
        `SELECT id FROM not_on_seat_logs 
         WHERE attendance_log_id = $1 AND end_time IS NULL 
         LIMIT 1`,
        [log.id]
      );
      const activeNos = activeRes.rows[0];
      if (activeNos) {
        const closeRes = await query(
          `UPDATE not_on_seat_logs 
           SET end_time = NOW(), 
               duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)) / 60)), 
               resolved_by = 'user' 
           WHERE id = $1 
           RETURNING duration_minutes`,
          [activeNos.id]
        );
        additionalAwayMinutes = closeRes.rows[0].duration_minutes || 0;
      }
    }

    // Clock out and calculate hours on duty
    await query(
      `UPDATE attendance_logs 
       SET clock_out_time = NOW(),
           clock_out_type = 'manual',
           status = 'clocked_out',
           total_time_not_on_seat = COALESCE(total_time_not_on_seat, 0.00) + $1,
           total_hours_on_duty = GREATEST(0.00, ROUND(
             (
               (EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 60) - 
               (COALESCE(total_time_not_on_seat, 0.00) + $1)
             ) / 60, 
             4
           )),
           updated_at = NOW()
       WHERE id = $2`,
      [additionalAwayMinutes, log.id]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true
    });

  } catch (error: any) {
    try { await query('ROLLBACK'); } catch (_) {}
    console.error('Error clocking out:', error);
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
  }
}
