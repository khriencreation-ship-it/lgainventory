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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const staffId = searchParams.get('staffId') || '';
    const status = searchParams.get('status') || 'all'; // all | complete | incomplete | auto_clockout
    const role = searchParams.get('role') || 'all'; // all | officer | treasurer
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    const all = searchParams.get('all') === 'true'; // For export purposes

    // Setup date defaults (current month in WAT)
    const now = new Date();
    const lagosYear = parseInt(now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', year: 'numeric' }), 10);
    const lagosMonth = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: '2-digit' });
    const defaultStart = `${lagosYear}-${lagosMonth}-01`;
    const defaultEnd = getNigeriaDateString(now);

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    // First day of current month (for current month tallies)
    const monthStart = `${lagosYear}-${lagosMonth}-01`;
    const monthEnd = defaultEnd;

    // 1. Fetch Summary Stats
    // a. Total Staff
    const totalStaffRes = await query(
      `SELECT COUNT(*)::int as count FROM users 
       WHERE lg_id = $1 AND role IN ('lg_account_officer', 'treasurer', 'lg_officer', 'lg_treasurer')`,
      [lgId]
    );
    const totalStaff = totalStaffRes.rows[0]?.count || 0;

    // b. Present Today (clocked in / not on seat today)
    const presentTodayRes = await query(
      `SELECT COUNT(*)::int as count FROM attendance_logs 
       WHERE lg_id = $1 AND date = $2 AND status IN ('clocked_in', 'not_on_seat')`,
      [lgId, defaultEnd]
    );
    const presentToday = presentTodayRes.rows[0]?.count || 0;

    // c. Auto Clock Outs this Month
    const autoClockoutsRes = await query(
      `SELECT COUNT(*)::int as count FROM attendance_logs 
       WHERE lg_id = $1 AND clock_out_type = 'auto' AND date >= $2 AND date <= $3`,
      [lgId, monthStart, monthEnd]
    );
    const autoClockoutsMonth = autoClockoutsRes.rows[0]?.count || 0;

    // d. Average hours on duty this month (clocked out logs only)
    const avgHoursRes = await query(
      `SELECT COALESCE(AVG(total_hours_on_duty), 0)::float as avg_hours FROM attendance_logs 
       WHERE lg_id = $1 AND status = 'clocked_out' AND date >= $2 AND date <= $3`,
      [lgId, monthStart, monthEnd]
    );
    const avgHoursMonth = Math.round((avgHoursRes.rows[0]?.avg_hours || 0) * 10) / 10;

    // 2. Build filtered query for logs list
    let queryParams: any[] = [lgId];
    let paramCounter = 2;
    let filterClauses = [];

    // Date range filter
    filterClauses.push(`al.date >= $${paramCounter}`);
    queryParams.push(start);
    paramCounter++;

    filterClauses.push(`al.date <= $${paramCounter}`);
    queryParams.push(end);
    paramCounter++;

    // Staff filter
    if (staffId) {
      filterClauses.push(`al.user_id = $${paramCounter}`);
      queryParams.push(staffId);
      paramCounter++;
    }

    // Status filter
    if (status === 'complete') {
      filterClauses.push(`al.status = 'clocked_out' AND al.clock_out_type = 'manual'`);
    } else if (status === 'incomplete') {
      filterClauses.push(`al.status IN ('clocked_in', 'not_on_seat')`);
    } else if (status === 'auto_clockout') {
      filterClauses.push(`al.clock_out_type = 'auto'`);
    }

    // Role filter
    if (role === 'officer') {
      filterClauses.push(`u.role IN ('lg_account_officer', 'lg_officer')`);
    } else if (role === 'treasurer') {
      filterClauses.push(`u.role IN ('treasurer', 'lg_treasurer')`);
    }

    const filterString = filterClauses.length > 0 ? `AND ${filterClauses.join(' AND ')}` : '';

    // Count query
    const countRes = await query(
      `SELECT COUNT(*)::int as count 
       FROM attendance_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.lg_id = $1 ${filterString}`,
      queryParams
    );
    const totalCount = countRes.rows[0]?.count || 0;

    // Data query
    let dataSql = `
      SELECT 
        al.id,
        al.user_id,
        al.date,
        al.clock_in_time,
        al.clock_out_time,
        al.clock_out_type,
        al.status,
        al.total_hours_on_duty::float as total_hours_on_duty,
        al.total_time_not_on_seat::float as total_time_not_on_seat,
        al.was_not_on_seat_at_auto_clockout,
        al.not_on_seat_reason_at_auto_clockout,
        al.created_at,
        al.updated_at,
        u.name as staff_name,
        u.role as staff_role
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.lg_id = $1 ${filterString}
      ORDER BY al.date DESC, al.clock_in_time DESC
    `;

    let dataParams = [...queryParams];
    if (!all) {
      dataSql += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      dataParams.push(limit, offset);
    }

    const dataRes = await query(dataSql, dataParams);
    const logs = dataRes.rows;

    // Fetch not_on_seat_logs for these logs
    let notOnSeatLogs: any[] = [];
    if (logs.length > 0) {
      const logIds = logs.map(r => r.id);
      const nosRes = await query(
        `SELECT * FROM not_on_seat_logs 
         WHERE attendance_log_id = ANY($1) 
         ORDER BY start_time ASC`,
        [logIds]
      );
      notOnSeatLogs = nosRes.rows;
    }

    // Attach not_on_seat_logs to each attendance log
    const logsWithAwayDetails = logs.map(l => {
      const awayDetails = notOnSeatLogs.filter(nos => nos.attendance_log_id === l.id);
      return {
        ...l,
        awayDetails
      };
    });

    const totalPages = all ? 1 : Math.ceil(totalCount / limit);

    // Also return a list of active staff members for the dropdown filter
    const staffListRes = await query(
      `SELECT id, name, role FROM users 
       WHERE lg_id = $1 AND role IN ('lg_account_officer', 'treasurer', 'lg_officer', 'lg_treasurer')
       ORDER BY name ASC`,
      [lgId]
    );

    // Fetch local government name
    const lgNameQuery = await query(
      `SELECT name FROM local_governments WHERE id = $1`,
      [lgId]
    );
    const lgName = lgNameQuery.rows[0]?.name || 'Local Government Authority';

    return NextResponse.json({
      success: true,
      logs: logsWithAwayDetails,
      staffList: staffListRes.rows,
      lgName,
      chairmanName: user.name,
      summary: {
        totalStaff,
        presentToday,
        autoClockoutsMonth,
        avgHoursMonth
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit
      }
    });

  } catch (error: any) {
    console.error('Error fetching attendance logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve attendance logs' }, { status: 500 });
  }
}
