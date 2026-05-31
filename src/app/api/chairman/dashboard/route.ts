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

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    
    // Permit both new and legacy chairman/treasurer roles
    if (!user || (
      user.role !== 'lg_chairman' && 
      user.role !== 'lg_admin' && 
      user.role !== 'treasurer' && 
      user.role !== 'lg_treasurer'
    )) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const chartPeriod = searchParams.get('period') || 'monthly'; // daily | weekly | monthly | yearly

    // --- ROW 1 METRICS ---
    
    // 1. Total Revenue Collected (All time sum of confirmed payments in this LGA)
    const totalRevRes = await query(
      `SELECT COALESCE(SUM(p.amount), 0)::float as total 
       FROM payments p
       JOIN demand_bills db ON p.bill_id = db.id
       WHERE db.lg_id = $1 AND p.status = 'successful'`,
      [lgId]
    );
    const totalRevenue = totalRevRes.rows[0]?.total || 0;

    // 2. Revenue This Month (Confirmed payments in the current calendar month)
    const monthlyRevRes = await query(
      `SELECT COALESCE(SUM(p.amount), 0)::float as total 
       FROM payments p
       JOIN demand_bills db ON p.bill_id = db.id
       WHERE db.lg_id = $1 
         AND p.status = 'successful' 
         AND DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', CURRENT_DATE)`,
      [lgId]
    );
    const revenueThisMonth = monthlyRevRes.rows[0]?.total || 0;

    // 3. Outstanding Balance (Sum of balance_due on unpaid/partially paid bills)
    const outstandingRes = await query(
      `SELECT COALESCE(SUM(balance_due), 0)::float as total 
       FROM demand_bills 
       WHERE lg_id = $1 AND payment_status IN ('unpaid', 'partially_paid')`,
      [lgId]
    );
    const outstandingBalance = outstandingRes.rows[0]?.total || 0;

    // 4. Total Clients Registered (Count of clients in LGA)
    const totalClientsRes = await query(
      `SELECT COUNT(*)::int as count FROM clients WHERE lg_id = $1`,
      [lgId]
    );
    const totalClients = totalClientsRes.rows[0]?.count || 0;


    // --- ROW 2 METRICS ---
    
    // 5. Total Demand Bills
    const totalBillsRes = await query(
      `SELECT COUNT(*)::int as count FROM demand_bills WHERE lg_id = $1`,
      [lgId]
    );
    const totalDemandBills = totalBillsRes.rows[0]?.count || 0;

    // 6. Paid Bills
    const paidBillsRes = await query(
      `SELECT COUNT(*)::int as count FROM demand_bills WHERE lg_id = $1 AND payment_status = 'paid'`,
      [lgId]
    );
    const paidBills = paidBillsRes.rows[0]?.count || 0;

    // 7. Unpaid / Overdue Bills
    const unpaidBillsRes = await query(
      `SELECT COUNT(*)::int as count 
       FROM demand_bills 
       WHERE lg_id = $1 
         AND (payment_status = 'unpaid' OR due_date < CURRENT_DATE)
         AND payment_status <> 'paid'`,
      [lgId]
    );
    const unpaidBills = unpaidBillsRes.rows[0]?.count || 0;


    // --- CHART DATA ---
    let chartQuery = '';

    if (chartPeriod === 'daily') {
      chartQuery = `
        SELECT 
          p.payment_date::date::text as date_label,
          COALESCE(SUM(p.amount), 0)::float as revenue
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.payment_date::date
        ORDER BY p.payment_date::date ASC
      `;
    } else if (chartPeriod === 'weekly') {
      chartQuery = `
        SELECT 
          DATE_TRUNC('week', p.payment_date)::date::text as date_label,
          COALESCE(SUM(p.amount), 0)::float as revenue
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= CURRENT_DATE - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', p.payment_date)::date
        ORDER BY date_label ASC
      `;
    } else if (chartPeriod === 'yearly') {
      chartQuery = `
        SELECT 
          DATE_TRUNC('year', p.payment_date)::date::text as date_label,
          COALESCE(SUM(p.amount), 0)::float as revenue
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= CURRENT_DATE - INTERVAL '5 years'
        GROUP BY DATE_TRUNC('year', p.payment_date)::date
        ORDER BY date_label ASC
      `;
    } else {
      // Monthly (Default)
      chartQuery = `
        SELECT 
          DATE_TRUNC('month', p.payment_date)::date::text as date_label,
          COALESCE(SUM(p.amount), 0)::float as revenue
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', p.payment_date)::date
        ORDER BY date_label ASC
      `;
    }

    const chartRes = await query(chartQuery, [lgId]);
    const rawChartData = chartRes.rows;

    // Generate continuous range of periods to guarantee data is never empty/sparse
    const periods = [];
    const now = new Date();

    if (chartPeriod === 'daily') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        periods.push({ key, label, revenue: 0 });
      }
    } else if (chartPeriod === 'weekly') {
      // Find Monday of current week
      const currentMonday = new Date(now);
      const day = currentMonday.getDay();
      const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
      currentMonday.setDate(diff);
      currentMonday.setHours(0, 0, 0, 0);

      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() - (i * 7));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        periods.push({ key, label, revenue: 0 });
      }
    } else if (chartPeriod === 'monthly') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-GB', { month: 'short' }) + " '" + d.getFullYear().toString().slice(-2);
        periods.push({ key, label, revenue: 0 });
      }
    } else if (chartPeriod === 'yearly') {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear() - i, 0, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.getFullYear().toString();
        periods.push({ key, label, revenue: 0 });
      }
    }

    const revenueMap = new Map();
    rawChartData.forEach((row: any) => {
      let key = '';
      if (row.date_label instanceof Date) {
        const d = row.date_label;
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (typeof row.date_label === 'string') {
        key = row.date_label.substring(0, 10);
      }
      revenueMap.set(key, row.revenue);
    });

    const chartData = periods.map((p) => {
      if (revenueMap.has(p.key)) {
        p.revenue = revenueMap.get(p.key);
      }
      return {
        label: p.label,
        revenue: p.revenue
      };
    });


    // --- OFFICER PERFORMANCE TABLE ---
    const officersRes = await query(
      `SELECT 
         u.id,
         u.name,
         u.role,
         (SELECT COUNT(*)::int FROM clients c WHERE c.created_by = u.id AND c.lg_id = u.lg_id) as clients_added,
         (SELECT COUNT(*)::int FROM demand_bills d WHERE d.created_by = u.id AND d.lg_id = u.lg_id) as bills_generated,
         (SELECT COUNT(*)::int FROM receipts r WHERE r.created_by = u.id AND r.lg_id = u.lg_id) as receipts_generated,
         (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.created_by = u.id AND db.lg_id = u.lg_id AND p.status = 'successful') as total_revenue,
         (SELECT MAX(created_at) FROM audit_logs WHERE user_id = u.id) as last_active_date
       FROM users u
       WHERE u.lg_id = $1 AND u.role IN ('lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer')
       ORDER BY total_revenue DESC`,
      [lgId]
    );


    // --- RECENT ACTIVITY FEED ---
    const activityRes = await query(
      `SELECT * FROM (
         SELECT 'client_created' as type, c.reference_number as ref, c.full_name as detail, NULL::float as amount, c.created_at, u.name as officer_name
         FROM clients c
         LEFT JOIN users u ON c.created_by = u.id
         WHERE c.lg_id = $1

         UNION ALL

         SELECT 'bill_created' as type, db.reference_number as ref, cl.full_name as detail, db.grand_total::float as amount, db.created_at, u.name as officer_name
         FROM demand_bills db
         JOIN clients cl ON db.client_id = cl.id
         LEFT JOIN users u ON db.created_by = u.id
         WHERE db.lg_id = $1

         UNION ALL

         SELECT 'payment_confirmed' as type, r.reference_number as ref, cl.full_name as detail, r.total_amount_paid::float as amount, r.created_at, u.name as officer_name
         FROM receipts r
         JOIN clients cl ON r.client_id = cl.id
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.lg_id = $1
       ) activity
       ORDER BY created_at DESC
       LIMIT 10`,
      [lgId]
    );

    return NextResponse.json({
      metrics: {
        totalRevenue,
        revenueThisMonth,
        outstandingBalance,
        totalClients,
        totalDemandBills,
        paidBills,
        unpaidBills
      },
      chartData,
      officers: officersRes.rows,
      recentActivity: activityRes.rows
    });

  } catch (error: any) {
    console.error('Chairman dashboard api error:', error);
    return NextResponse.json({ error: 'Failed to retrieve dashboard metrics' }, { status: 500 });
  }
}
