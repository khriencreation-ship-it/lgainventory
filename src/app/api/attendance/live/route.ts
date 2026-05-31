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
    if (!user || (user.role !== 'lg_chairman' && user.role !== 'lg_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const todayStr = getNigeriaDateString();

    const liveRes = await query(
      `SELECT 
        u.id as user_id,
        u.name,
        u.role,
        al.id as attendance_log_id,
        al.clock_in_time,
        al.clock_out_time,
        al.clock_out_type,
        al.status as attendance_status,
        al.total_time_not_on_seat::float as total_time_not_on_seat,
        al.total_hours_on_duty::float as total_hours_on_duty,
        al.was_not_on_seat_at_auto_clockout,
        al.not_on_seat_reason_at_auto_clockout,
        nos.reason as active_not_on_seat_reason,
        nos.start_time as active_not_on_seat_start_time
      FROM users u
      LEFT JOIN attendance_logs al ON u.id = al.user_id AND al.date = $1
      LEFT JOIN not_on_seat_logs nos ON al.id = nos.attendance_log_id AND nos.end_time IS NULL
      WHERE u.lg_id = $2 
        AND u.role IN ('lg_account_officer', 'treasurer', 'lg_officer', 'lg_treasurer')
      ORDER BY u.name ASC`,
      [todayStr, lgId]
    );

    return NextResponse.json({
      success: true,
      staff: liveRes.rows
    });

  } catch (error: any) {
    console.error('Error fetching live attendance:', error);
    return NextResponse.json({ error: 'Failed to retrieve live attendance' }, { status: 500 });
  }
}
