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
    if (!user || (user.role !== 'lg_chairman' && user.role !== 'lg_admin' && user.role !== 'treasurer' && user.role !== 'lg_treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lgId = user.lg_id;
    if (!lgId) {
      return NextResponse.json({ error: 'User is not associated with any Local Government' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'revenue'; // revenue | demand-bills | clients | officers | levies
    const startDateStr = searchParams.get('startDate') || '';
    const endDateStr = searchParams.get('endDate') || '';

    // Parse date range
    let startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), 0, 1); // default Jan 1st of current year
    let endDate = endDateStr ? new Date(endDateStr) : new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Common lookups
    const officersRes = await query(
      `SELECT id, name FROM users 
       WHERE lg_id = $1 AND role IN ('lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer') 
       ORDER BY name ASC`,
      [lgId]
    );

    const categoriesRes = await query(
      `SELECT id, name FROM levy_categories 
       WHERE lg_id = $1 
       ORDER BY name ASC`,
      [lgId]
    );

    // Fetch LG and State metadata for PDF headers
    const lgRes = await query(
      `SELECT lg.name as lg_name, lg.logo_url as lg_logo_url, s.name as state_name, s.logo_url as state_logo_url
       FROM local_governments lg
       JOIN states s ON lg.state_id = s.id
       WHERE lg.id = $1`,
      [lgId]
    );
    const lgDetails = lgRes.rows[0] || null;

    const responseData: any = {
      officers: officersRes.rows,
      categories: categoriesRes.rows,
      lgDetails,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };


    if (type === 'revenue') {
      const groupBy = searchParams.get('groupBy') || 'monthly'; // daily | weekly | monthly | yearly
      const paymentMethod = searchParams.get('paymentMethod') || 'all'; // all | flutterwave | bank_transfer
      const officerId = searchParams.get('officerId') || '';

      // Filters
      let queryParams: any[] = [lgId, startDate, endDate];
      let paramIndex = 4;
      let filterClauses = [];

      if (paymentMethod === 'flutterwave') {
        filterClauses.push(`p.raw_payload->>'teller_ref' IS NULL`);
      } else if (paymentMethod === 'bank_transfer') {
        filterClauses.push(`p.raw_payload->>'teller_ref' IS NOT NULL`);
      }

      if (officerId) {
        filterClauses.push(`db.created_by = $${paramIndex}`);
        queryParams.push(officerId);
        paramIndex++;
      }

      const filterString = filterClauses.length > 0 ? `AND ${filterClauses.join(' AND ')}` : '';

      // Summary Cards query
      const summarySql = `
        SELECT 
          COALESCE(SUM(p.amount), 0)::float as total_revenue,
          COALESCE(SUM(CASE WHEN p.raw_payload->>'teller_ref' IS NULL THEN p.amount ELSE 0 END), 0)::float as flw_revenue,
          COALESCE(SUM(CASE WHEN p.raw_payload->>'teller_ref' IS NOT NULL THEN p.amount ELSE 0 END), 0)::float as bt_revenue,
          COUNT(*)::int as transaction_count
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= $2 AND p.payment_date <= $3
          ${filterString}
      `;
      const summaryRes = await query(summarySql, queryParams);
      const summary = summaryRes.rows[0];

      // Time series data points
      let dateTrunc = 'month';
      if (groupBy === 'daily') dateTrunc = 'day';
      else if (groupBy === 'weekly') dateTrunc = 'week';
      else if (groupBy === 'yearly') dateTrunc = 'year';

      const chartSql = `
        SELECT 
          DATE_TRUNC('${dateTrunc}', p.payment_date)::date::text as period_label,
          COALESCE(SUM(CASE WHEN p.raw_payload->>'teller_ref' IS NULL THEN p.amount ELSE 0 END), 0)::float as flw_revenue,
          COALESCE(SUM(CASE WHEN p.raw_payload->>'teller_ref' IS NOT NULL THEN p.amount ELSE 0 END), 0)::float as bt_revenue,
          COALESCE(SUM(p.amount), 0)::float as total_revenue,
          COUNT(*)::int as transaction_count
        FROM payments p
        JOIN demand_bills db ON p.bill_id = db.id
        WHERE db.lg_id = $1 
          AND p.status = 'successful'
          AND p.payment_date >= $2 AND p.payment_date <= $3
          ${filterString}
        GROUP BY DATE_TRUNC('${dateTrunc}', p.payment_date)::date
        ORDER BY DATE_TRUNC('${dateTrunc}', p.payment_date)::date ASC
      `;
      const chartRes = await query(chartSql, queryParams);
      
      // Generate continuous range of periods in JS to avoid empty period holes
      const periods = [];
      const tempDate = new Date(startDate);
      const limitSafety = 366; // safety limit to prevent infinite loops
      let iterations = 0;

      while (tempDate <= endDate && iterations < limitSafety) {
        iterations++;
        let key = '';
        let label = '';

        if (groupBy === 'daily') {
          key = tempDate.toISOString().substring(0, 10);
          label = tempDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          tempDate.setDate(tempDate.getDate() + 1);
        } else if (groupBy === 'weekly') {
          // get start of week
          const day = tempDate.getDay();
          const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(tempDate);
          monday.setDate(diff);
          key = monday.toISOString().substring(0, 10);
          label = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          tempDate.setDate(tempDate.getDate() + 7);
        } else if (groupBy === 'monthly') {
          key = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-01`;
          label = tempDate.toLocaleDateString('en-GB', { month: 'short' }) + " '" + tempDate.getFullYear().toString().slice(-2);
          tempDate.setMonth(tempDate.getMonth() + 1);
        } else {
          // yearly
          key = `${tempDate.getFullYear()}-01-01`;
          label = tempDate.getFullYear().toString();
          tempDate.setFullYear(tempDate.getFullYear() + 1);
        }

        periods.push({ key, label, flw_revenue: 0, bt_revenue: 0, total_revenue: 0, transaction_count: 0 });
      }

      // Map rows
      const dataMap = new Map();
      chartRes.rows.forEach((row: any) => {
        let key = '';
        if (row.period_label) {
          const d = new Date(row.period_label);
          if (groupBy === 'daily' || groupBy === 'weekly') {
            key = d.toISOString().substring(0, 10);
          } else if (groupBy === 'monthly') {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
          } else {
            key = `${d.getFullYear()}-01-01`;
          }
        }
        dataMap.set(key, row);
      });

      const finalReportData = periods.map((p) => {
        const match = dataMap.get(p.key);
        if (match) {
          p.flw_revenue = match.flw_revenue;
          p.bt_revenue = match.bt_revenue;
          p.total_revenue = match.total_revenue;
          p.transaction_count = match.transaction_count;
        }
        return p;
      });

      responseData.summary = {
        totalRevenue: summary?.total_revenue || 0,
        flwRevenue: summary?.flw_revenue || 0,
        btRevenue: summary?.bt_revenue || 0,
        transactionCount: summary?.transaction_count || 0
      };
      responseData.data = finalReportData;

    } else if (type === 'demand-bills') {
      const status = searchParams.get('status') || 'all';
      const officerId = searchParams.get('officerId') || '';
      const categoryId = searchParams.get('categoryId') || '';

      // Filters
      let queryParams: any[] = [lgId, startDate, endDate];
      let paramIndex = 4;
      let filterClauses = [];

      if (status === 'paid') {
        filterClauses.push(`db.payment_status = 'paid'`);
      } else if (status === 'partially_paid') {
        filterClauses.push(`db.payment_status = 'partially_paid' AND db.due_date >= CURRENT_DATE`);
      } else if (status === 'not_paid') {
        filterClauses.push(`db.payment_status = 'unpaid' AND db.due_date >= CURRENT_DATE`);
      } else if (status === 'overdue') {
        filterClauses.push(`db.payment_status != 'paid' AND db.due_date < CURRENT_DATE`);
      }

      if (officerId) {
        filterClauses.push(`db.created_by = $${paramIndex}`);
        queryParams.push(officerId);
        paramIndex++;
      }

      if (categoryId) {
        filterClauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(db.levy_items) elem WHERE elem->>'category_id' = $${paramIndex})`);
        queryParams.push(categoryId);
        paramIndex++;
      }

      const filterString = filterClauses.length > 0 ? `AND ${filterClauses.join(' AND ')}` : '';

      // 1. Summary details query
      const summarySql = `
        SELECT 
          COUNT(*)::int as total_bills,
          COALESCE(SUM(db.grand_total), 0)::float as total_billed,
          COALESCE(SUM(db.amount_paid), 0)::float as total_collected,
          COALESCE(SUM(db.balance_due), 0)::float as total_outstanding
        FROM demand_bills db
        WHERE db.lg_id = $1 
          AND db.created_at >= $2 AND db.created_at <= $3
          ${filterString}
      `;
      const summaryRes = await query(summarySql, queryParams);
      const summ = summaryRes.rows[0];

      // 2. Data rows query (sortable, non-paginated since report requires full dataset download/print)
      const dataSql = `
        SELECT 
          db.id,
          db.reference_number,
          c.full_name as client_name,
          db.grand_total::float as grand_total,
          COALESCE(db.amount_paid, 0.00)::float as amount_paid,
          db.balance_due::float as balance_due,
          db.payment_status,
          COALESCE(u.name, 'System') as generated_by,
          db.created_at,
          db.due_date,
          db.levy_items
        FROM demand_bills db
        JOIN clients c ON db.client_id = c.id
        LEFT JOIN users u ON db.created_by = u.id
        WHERE db.lg_id = $1 
          AND db.created_at >= $2 AND db.created_at <= $3
          ${filterString}
        ORDER BY db.created_at DESC
      `;
      const dataRes = await query(dataSql, queryParams);

      const billed = summ?.total_billed || 0;
      const collected = summ?.total_collected || 0;
      const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;

      responseData.summary = {
        totalBills: summ?.total_bills || 0,
        totalBilled: billed,
        totalCollected: collected,
        totalOutstanding: summ?.total_outstanding || 0,
        collectionRate: rate
      };
      responseData.data = dataRes.rows;

    } else if (type === 'clients') {
      const officerId = searchParams.get('officerId') || '';

      // Filters
      let queryParams: any[] = [lgId, startDate, endDate];
      let paramIndex = 4;
      let filterClauses = [];

      if (officerId) {
        filterClauses.push(`c.created_by = $${paramIndex}`);
        queryParams.push(officerId);
        paramIndex++;
      }

      const filterString = filterClauses.length > 0 ? `AND ${filterClauses.join(' AND ')}` : '';

      // 1. Data rows query
      const dataSql = `
        SELECT 
          c.id,
          c.reference_number,
          c.full_name,
          c.phone_number,
          c.ward,
          COALESCE(u.name, 'System') as added_by,
          c.created_at,
          (SELECT COUNT(*)::int FROM demand_bills db WHERE db.client_id = c.id) as total_bills,
          (SELECT COALESCE(SUM(db.grand_total), 0)::float FROM demand_bills db WHERE db.client_id = c.id) as total_billed,
          (SELECT COALESCE(SUM(db.amount_paid), 0)::float FROM demand_bills db WHERE db.client_id = c.id) as total_paid,
          (SELECT COALESCE(SUM(db.balance_due), 0)::float FROM demand_bills db WHERE db.client_id = c.id) as outstanding_balance
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.lg_id = $1 
          AND c.created_at >= $2 AND c.created_at <= $3
          ${filterString}
        ORDER BY c.created_at DESC
      `;
      const dataRes = await query(dataSql, queryParams);
      const list = dataRes.rows;

      // 2. Compute Summary from list
      const totalClients = list.length;
      let totalRevenue = 0;
      let totalOutstanding = 0;
      list.forEach((row: any) => {
        totalRevenue += row.total_paid;
        totalOutstanding += row.outstanding_balance;
      });

      const avgRevenue = totalClients > 0 ? totalRevenue / totalClients : 0;

      responseData.summary = {
        totalClients,
        totalRevenue,
        totalOutstanding,
        averageRevenue: avgRevenue
      };
      responseData.data = list;

    } else if (type === 'officers') {
      const officerId = searchParams.get('officerId') || '';

      let queryParams: any[] = [lgId, startDate, endDate];
      let filterClause = '';
      if (officerId) {
        queryParams.push(officerId);
        filterClause = 'AND u.id = $4';
      }

      // Query officer activity details
      const officersSql = `
        SELECT 
          u.id,
          u.name,
          (SELECT COUNT(*)::int FROM clients c WHERE c.created_by = u.id AND c.lg_id = u.lg_id AND c.created_at >= $2 AND c.created_at <= $3) as clients_added,
          (SELECT COUNT(*)::int FROM demand_bills db WHERE db.created_by = u.id AND db.lg_id = u.lg_id AND db.created_at >= $2 AND db.created_at <= $3) as bills_generated,
          (SELECT COUNT(*)::int FROM receipts r WHERE r.created_by = u.id AND r.lg_id = u.lg_id AND r.created_at >= $2 AND r.created_at <= $3) as receipts_generated,
          (SELECT COUNT(*)::int FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.created_by = u.id AND p.status = 'successful' AND p.raw_payload->>'teller_ref' IS NULL AND p.payment_date >= $2 AND p.payment_date <= $3) as flw_payments_count,
          (SELECT COUNT(*)::int FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.created_by = u.id AND p.status = 'successful' AND p.raw_payload->>'teller_ref' IS NOT NULL AND p.payment_date >= $2 AND p.payment_date <= $3) as manual_payments_count,
          (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p JOIN demand_bills db ON p.bill_id = db.id WHERE db.created_by = u.id AND p.status = 'successful' AND p.payment_date >= $2 AND p.payment_date <= $3) as total_revenue,
          (SELECT MAX(created_at) FROM audit_logs WHERE user_id = u.id) as last_active_date
        FROM users u
        WHERE u.lg_id = $1 
          AND u.role IN ('lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer')
          ${filterClause}
        ORDER BY total_revenue DESC
      `;
      const officersRes = await query(officersSql, queryParams);
      const list = officersRes.rows;

      // Query officer bills generated in this period
      const billsRes = await query(
        `SELECT 
           db.id,
           db.reference_number,
           c.full_name as client_name,
           db.grand_total::float as grand_total,
           db.payment_status,
           db.created_at,
           db.created_by as officer_id
         FROM demand_bills db
         JOIN clients c ON db.client_id = c.id
         WHERE db.lg_id = $1 
           AND db.created_at >= $2 AND db.created_at <= $3`,
        [lgId, startDate, endDate]
      );

      const groupedBills = new Map<string, any[]>();
      billsRes.rows.forEach((bill: any) => {
        const offId = bill.officer_id;
        if (!groupedBills.has(offId)) {
          groupedBills.set(offId, []);
        }
        groupedBills.get(offId)!.push({
          id: bill.id,
          reference_number: bill.reference_number,
          client_name: bill.client_name,
          grand_total: bill.grand_total,
          payment_status: bill.payment_status,
          created_at: bill.created_at
        });
      });

      const listWithBills = list.map((officer: any) => {
        officer.bills = groupedBills.get(officer.id) || [];
        return officer;
      });

      // Extract high performers
      let highestRevenueOfficerName = 'None';
      let highestRevenueOfficerAmount = 0;
      let totalBills = 0;
      let totalRevenue = 0;

      listWithBills.forEach((row: any) => {
        totalBills += row.bills_generated;
        totalRevenue += row.total_revenue;
        if (row.total_revenue > highestRevenueOfficerAmount) {
          highestRevenueOfficerAmount = row.total_revenue;
          highestRevenueOfficerName = row.name;
        }
      });

      responseData.summary = {
        totalActiveOfficers: listWithBills.filter((r: any) => r.clients_added > 0 || r.bills_generated > 0 || r.total_revenue > 0).length,
        highestRevenueOfficer: {
          name: highestRevenueOfficerName,
          amount: highestRevenueOfficerAmount
        },
        totalBillsGenerated: totalBills,
        totalRevenueCollected: totalRevenue
      };
      responseData.data = listWithBills;


    } else if (type === 'levies') {
      const categoryId = searchParams.get('categoryId') || '';
      
      let queryParams: any[] = [lgId, startDate, endDate];
      let filterClause = '';
      if (categoryId) {
        queryParams.push(categoryId);
        filterClause = `AND (elem->>'category_id') = $4`;
      }

      // Proportional split calculation query for category performance
      const leviesSql = `
        WITH payment_items AS (
          SELECT
            db.id as bill_id,
            p.amount as payment_amount,
            elem->>'category_id' as category_id,
            elem->>'category_name' as category_name,
            elem->>'name' as levy_name,
            (elem->>'amount')::float as item_amount,
            db.grand_total::float as bill_total
          FROM payments p
          JOIN demand_bills db ON p.bill_id = db.id
          CROSS JOIN LATERAL jsonb_array_elements(db.levy_items) elem
          WHERE db.lg_id = $1 
            AND p.status = 'successful'
            AND p.payment_date >= $2 AND p.payment_date <= $3
            ${filterClause}
        )
        SELECT
          category_id,
          COALESCE(category_name, 'General Levy') as category_name,
          levy_name,
          COUNT(DISTINCT bill_id)::int as number_of_bills,
          SUM(payment_amount * (CASE WHEN bill_total > 0 THEN item_amount / bill_total ELSE 0 END))::float as total_revenue
        FROM payment_items
        GROUP BY category_id, category_name, levy_name
        ORDER BY total_revenue DESC
      `;
      const leviesRes = await query(leviesSql, queryParams);
      const rawRows = leviesRes.rows;

      // Group rows into categories with sub-items
      const categoriesMap = new Map<string, any>();
      let totalRevenue = 0;
      let totalTransactions = 0;

      rawRows.forEach((row: any) => {
        const catId = row.category_id || 'general';
        const catName = row.category_name;
        
        totalRevenue += row.total_revenue;
        totalTransactions += row.number_of_bills;

        if (!categoriesMap.has(catId)) {
          categoriesMap.set(catId, {
            id: catId,
            name: catName,
            number_of_bills: 0,
            total_revenue: 0,
            items: []
          });
        }

        const catData = categoriesMap.get(catId);
        catData.number_of_bills += row.number_of_bills;
        catData.total_revenue += row.total_revenue;
        catData.items.push({
          name: row.levy_name,
          number_of_bills: row.number_of_bills,
          total_revenue: row.total_revenue
        });
      });

      // Format category performance array
      const categoriesList = Array.from(categoriesMap.values()).map((cat: any) => {
        cat.percentage_of_total = totalRevenue > 0 ? Math.round((cat.total_revenue / totalRevenue) * 100) : 0;
        
        // Compute item-level percentages relative to category total
        cat.items = cat.items.map((item: any) => {
          item.percentage_of_category = cat.total_revenue > 0 ? Math.round((item.total_revenue / cat.total_revenue) * 100) : 0;
          return item;
        }).sort((a: any, b: any) => b.total_revenue - a.total_revenue);

        return cat;
      }).sort((a: any, b: any) => b.total_revenue - a.total_revenue);

      // Find top performers
      const topCat = categoriesList[0] || null;
      
      let topLevyName = 'None';
      let topLevyAmount = 0;
      rawRows.forEach((row: any) => {
        if (row.total_revenue > topLevyAmount) {
          topLevyAmount = row.total_revenue;
          topLevyName = row.levy_name;
        }
      });

      responseData.summary = {
        totalRevenue,
        topCategory: topCat ? { name: topCat.name, amount: topCat.total_revenue } : { name: 'None', amount: 0 },
        topLevy: { name: topLevyName, amount: topLevyAmount },
        totalTransactions
      };
      responseData.data = categoriesList;
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Chairman GET reports error:', error);
    return NextResponse.json({ error: 'Failed to compile reports' }, { status: 500 });
  }
}
