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

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const todayStr = getNigeriaDateString();

    // Check if user has already clocked in today
    const existingLogRes = await query(
      `SELECT * FROM attendance_logs 
       WHERE user_id = $1 AND date = $2`,
      [user.id, todayStr]
    );

    const existingLog = existingLogRes.rows[0];

    if (existingLog) {
      if (existingLog.status === 'clocked_in' || existingLog.status === 'not_on_seat') {
        return NextResponse.json({ error: 'You are already clocked in' }, { status: 400 });
      }

      // If status is 'clocked_out', we let them clock back in by resuming today's shift!
      await query('BEGIN');
      try {
        const lastClockOut = existingLog.clock_out_time ? new Date(existingLog.clock_out_time) : new Date();
        
        // Calculate break duration in minutes
        const breakMinsRes = await query(
          `SELECT GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - $1::timestamp with time zone)) / 60))::int as minutes`,
          [lastClockOut]
        );
        const breakMinutes = breakMinsRes.rows[0].minutes || 0;

        // Insert an off-duty break record in not_on_seat_logs for audit trail
        if (breakMinutes > 0) {
          await query(
            `INSERT INTO not_on_seat_logs (
              attendance_log_id, user_id, lg_id, reason, start_time, end_time, duration_minutes, resolved_by
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'user')`,
            [
              existingLog.id,
              user.id,
              lgId,
              existingLog.clock_out_type === 'auto' ? 'Off-duty (Auto Clock Out gap)' : 'Off-duty break (Clock out/in)',
              lastClockOut,
              breakMinutes
            ]
          );
        }

        // Resume the shift
        const updateRes = await query(
          `UPDATE attendance_logs
           SET status = 'clocked_in',
               clock_out_time = NULL,
               clock_out_type = NULL,
               total_time_not_on_seat = COALESCE(total_time_not_on_seat, 0.00) + $1,
               was_not_on_seat_at_auto_clockout = FALSE,
               not_on_seat_reason_at_auto_clockout = NULL,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [breakMinutes, existingLog.id]
        );

        await query('COMMIT');

        return NextResponse.json({
          success: true,
          log: updateRes.rows[0]
        });
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
    }

    // Create new attendance log
    const insertRes = await query(
      `INSERT INTO attendance_logs (
        user_id, lg_id, date, clock_in_time, status, total_time_not_on_seat
      ) VALUES ($1, $2, $3, NOW(), 'clocked_in', 0.00)
      RETURNING *`,
      [user.id, lgId, todayStr]
    );

    const log = insertRes.rows[0];

    return NextResponse.json({
      success: true,
      log
    });

  } catch (error: any) {
    console.error('Error clocking in:', error);
    return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
  }
}
