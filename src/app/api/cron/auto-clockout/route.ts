import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function getNigeriaDateString(d: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET || 'attendance_cron_secret_2026';

    // Verify secret
    if (secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = getNigeriaDateString();

    // Find all attendance_logs where status is clocked_in or not_on_seat, and clock_out_time is null
    const activeLogsRes = await query(
      `SELECT * FROM attendance_logs 
       WHERE status IN ('clocked_in', 'not_on_seat') AND clock_out_time IS NULL`
    );

    const activeLogs = activeLogsRes.rows;
    const processedLogs = [];

    for (const log of activeLogs) {
      await query('BEGIN');
      try {
        let wasNotOnSeat = false;
        let notOnSeatReason = null;
        let additionalAwayMinutes = 0;

        // Construct 9pm WAT of the day the user clocked in
        // Note: log.date is returned as a Date object or string 'YYYY-MM-DD'
        let logDateStr = '';
        if (log.date instanceof Date) {
          logDateStr = log.date.toISOString().split('T')[0];
        } else {
          logDateStr = String(log.date).split('T')[0];
        }
        const ninePmLogDay = new Date(`${logDateStr}T20:00:00.000Z`); // 9pm WAT is 8pm UTC

        // If the user clocked in after 9pm WAT on their shift date, their auto-clock out time is 9pm WAT of the NEXT day
        const clockInTime = new Date(log.clock_in_time);
        let autoClockOutTime = ninePmLogDay;
        if (clockInTime > ninePmLogDay) {
          autoClockOutTime = new Date(ninePmLogDay.getTime() + 24 * 60 * 60 * 1000);
        }

        if (log.status === 'not_on_seat') {
          // Check for active not_on_seat log
          const nosRes = await query(
            `SELECT id, reason, start_time FROM not_on_seat_logs 
             WHERE attendance_log_id = $1 AND end_time IS NULL 
             LIMIT 1`,
            [log.id]
          );
          const activeNos = nosRes.rows[0];
          if (activeNos) {
            wasNotOnSeat = true;
            notOnSeatReason = activeNos.reason;

            // Close the not_on_seat_log setting end_time to autoClockOutTime
            const closeNosRes = await query(
              `UPDATE not_on_seat_logs 
               SET end_time = $1, 
                   duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ($1 - start_time)) / 60)), 
                   resolved_by = 'auto_clockout' 
               WHERE id = $2 
               RETURNING duration_minutes`,
              [autoClockOutTime, activeNos.id]
            );
            additionalAwayMinutes = closeNosRes.rows[0].duration_minutes || 0;
          }
        }

        // Update the attendance log
        await query(
          `UPDATE attendance_logs 
           SET clock_out_time = $1,
               clock_out_type = 'auto',
               status = 'clocked_out',
               was_not_on_seat_at_auto_clockout = $2,
               not_on_seat_reason_at_auto_clockout = $3,
               total_time_not_on_seat = COALESCE(total_time_not_on_seat, 0.00) + $4,
               total_hours_on_duty = GREATEST(0.00, ROUND(
                 (
                   (EXTRACT(EPOCH FROM ($1 - clock_in_time)) / 60) - 
                   (COALESCE(total_time_not_on_seat, 0.00) + $4)
                 ) / 60, 
                 4
               )),
               updated_at = NOW()
           WHERE id = $5`,
          [autoClockOutTime, wasNotOnSeat, notOnSeatReason, additionalAwayMinutes, log.id]
        );

        await query('COMMIT');
        processedLogs.push({ logId: log.id, userId: log.user_id, status: 'auto_clocked_out' });
      } catch (err: any) {
        await query('ROLLBACK');
        console.error(`Failed to auto clock out user ${log.user_id}:`, err);
        processedLogs.push({ logId: log.id, userId: log.user_id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      processedCount: processedLogs.length,
      logs: processedLogs
    });

  } catch (error: any) {
    console.error('Error running auto clock-out cron:', error);
    return NextResponse.json({ error: 'Failed to complete auto clock-out' }, { status: 500 });
  }
}
