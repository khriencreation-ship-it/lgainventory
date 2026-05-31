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

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = getNigeriaDateString();

    // Find attendance log for today
    const attendanceRes = await query(
      `SELECT * FROM attendance_logs 
       WHERE user_id = $1 AND date = $2`,
      [user.id, todayStr]
    );

    const log = attendanceRes.rows[0] || null;

    if (!log) {
      return NextResponse.json({
        status: 'clocked_out',
        hasLogToday: false,
        log: null,
        activeNotOnSeat: null
      });
    }

    let activeNotOnSeat = null;
    if (log.status === 'not_on_seat') {
      const nosRes = await query(
        `SELECT * FROM not_on_seat_logs 
         WHERE attendance_log_id = $1 AND end_time IS NULL 
         LIMIT 1`,
        [log.id]
      );
      activeNotOnSeat = nosRes.rows[0] || null;
    }

    return NextResponse.json({
      status: log.status,
      hasLogToday: true,
      log,
      activeNotOnSeat
    });

  } catch (error: any) {
    console.error('Error fetching attendance status:', error);
    return NextResponse.json({ error: 'Failed to retrieve attendance status' }, { status: 500 });
  }
}
