import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// Simple self-contained English number-to-Naira conversion helper
function numberToNairaWords(amount: number): string {
  const integerPart = Math.floor(amount);
  
  if (integerPart === 0) {
    return "Zero Naira Only";
  }

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                 "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];

  function convertLessThanThousand(num: number): string {
    let str = "";
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      str += ones[num] + " ";
    }
    return str.trim();
  }

  let num = integerPart;
  let words = "";
  let scaleIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkStr = convertLessThanThousand(chunk);
      words = chunkStr + (scales[scaleIndex] ? " " + scales[scaleIndex] : "") + " " + words;
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return words.trim().replace(/\s+/g, ' ') + " Naira Only";
}

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Fetch paginated bills with filters & search
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, unpaid, paid, overdue
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT 
        db.id,
        db.reference_number,
        c.full_name as client_name,
        db.grand_total::float as grand_total,
        COALESCE(db.amount_paid, 0.00)::float as amount_paid,
        CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
        db.levy_items,
        db.payment_status,
        db.due_date,
        db.created_at
      FROM demand_bills db
      JOIN clients c ON db.client_id = c.id
      WHERE db.lg_id = $1
    `;
    let countText = `
      SELECT COUNT(*)::int as count
      FROM demand_bills db
      JOIN clients c ON db.client_id = c.id
      WHERE db.lg_id = $1
    `;

    const queryParams: any[] = [user.lg_id];
    let paramIndex = 2;

    // Filter by search (reference number or client name)
    if (search.trim()) {
      const searchVal = `%${search.trim()}%`;
      queryText += ` AND (db.reference_number ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex})`;
      countText += ` AND (db.reference_number ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex})`;
      queryParams.push(searchVal);
      paramIndex++;
    }

    // Filter by payment status tab
    if (status === 'paid') {
      queryText += ` AND db.payment_status = 'paid'`;
      countText += ` AND db.payment_status = 'paid'`;
    } else if (status === 'partially_paid') {
      queryText += ` AND db.payment_status = 'partially_paid' AND db.due_date >= CURRENT_DATE`;
      countText += ` AND db.payment_status = 'partially_paid' AND db.due_date >= CURRENT_DATE`;
    } else if (status === 'unpaid') { // "Not Paid"
      queryText += ` AND db.payment_status = 'unpaid' AND db.due_date >= CURRENT_DATE`;
      countText += ` AND db.payment_status = 'unpaid' AND db.due_date >= CURRENT_DATE`;
    } else if (status === 'overdue') {
      queryText += ` AND db.payment_status != 'paid' AND db.due_date < CURRENT_DATE`;
      countText += ` AND db.payment_status != 'paid' AND db.due_date < CURRENT_DATE`;
    }

    queryText += ` ORDER BY db.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalQueryParams = [...queryParams, limit, offset];

    const [billsRes, countRes] = await Promise.all([
      query(queryText, finalQueryParams),
      query(countText, queryParams)
    ]);

    return NextResponse.json({
      bills: billsRes.rows,
      totalCount: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
      currentPage: page
    });

  } catch (error: any) {
    console.error('GET demand bills error:', error);
    return NextResponse.json({ error: 'Failed to retrieve demand bills ledger' }, { status: 500 });
  }
}

// 2. POST: Create a new demand bill
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { client_id, levy_items, arrears, penalty, due_date } = body;

    // Validations
    if (!client_id || !levy_items || !Array.isArray(levy_items) || levy_items.length === 0 || !due_date) {
      return NextResponse.json({ error: 'Client, at least one levy item, and due date are required' }, { status: 400 });
    }

    const parsedArrears = parseFloat(arrears) || 0;
    const parsedPenalty = parseFloat(penalty) || 0;
    const dueDateObj = new Date(due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDateObj < today) {
      return NextResponse.json({ error: 'Due date must be today or in the future' }, { status: 400 });
    }

    // Begin atomic transaction
    await query('BEGIN');

    // 1. Lock the LGA row to guarantee serial sequence integrity
    const lgRes = await query(
      'SELECT code FROM local_governments WHERE id = $1 FOR UPDATE',
      [user.lg_id]
    );

    if (lgRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Associated Local Government not found' }, { status: 404 });
    }

    const lgCode = lgRes.rows[0].code.toUpperCase();

    // 2. Query the highest existing sequence number for this LGA
    const searchPattern = `${lgCode}-DB-%`;
    const latestRes = await query(
      `SELECT reference_number FROM demand_bills 
       WHERE lg_id = $1 AND reference_number LIKE $2 
       ORDER BY reference_number DESC 
       LIMIT 1`,
      [user.lg_id, searchPattern]
    );

    let nextSequence = 1;
    if (latestRes.rows.length > 0) {
      const latestRef = latestRes.rows[0].reference_number;
      const refParts = latestRef.split('-DB-');
      if (refParts.length >= 2) {
        const lastSeqNum = parseInt(refParts[refParts.length - 1], 10);
        if (!isNaN(lastSeqNum)) {
          nextSequence = lastSeqNum + 1;
        }
      }
    }

    const sequencePadded = String(nextSequence).padStart(4, '0');
    const referenceNumber = `${lgCode}-DB-${sequencePadded}`;

    // 3. Totals Calculations
    let subtotal = 0;
    const formattedLevyItems = levy_items.map((item: any) => {
      const amt = parseFloat(item.amount) || 0;
      subtotal += amt;
      return {
        category_id: item.category_id,
        category_name: item.category_name.trim(),
        levy_id: item.levy_id,
        levy_name: item.levy_name.trim(),
        name: item.levy_name.trim(), // Retained for backwards compatibility with checkout/print pages
        description: (item.description || item.levy_name).trim(),
        amount: amt
      };
    });

    const grandTotal = subtotal + parsedArrears + parsedPenalty;
    const amountInWords = numberToNairaWords(grandTotal);
    const yearOfBilling = new Date().getFullYear();

    // 4. Insert the Demand Bill
    const insertBillRes = await query(
      `INSERT INTO demand_bills (
         reference_number, lg_id, client_id, created_by, levy_items, 
         subtotal, arrears, penalty, grand_total, balance_due, amount_in_words, 
         year_of_billing, due_date, payment_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'unpaid')
       RETURNING id`,
      [
        referenceNumber, 
        user.lg_id, 
        client_id, 
        user.id, 
        JSON.stringify(formattedLevyItems), 
        subtotal, 
        parsedArrears, 
        parsedPenalty, 
        grandTotal, 
        grandTotal, 
        amountInWords, 
        yearOfBilling, 
        due_date
      ]
    );

    const billId = insertBillRes.rows[0].id;

    // 5. Create the Initial Status Log
    await query(
      `INSERT INTO demand_bill_status_logs (
         demand_bill_id, status, changed_by_user_id, changed_by_label, change_type, note
       ) VALUES ($1, 'unpaid', $2, $3, 'created', 'Demand bill created.')`,
      [billId, user.id, user.name]
    );

    // 6. Create general audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'create_demand_bill', `Created Demand Bill: ${referenceNumber} for client: ${client_id}`]
    );

    await query('COMMIT');

    return NextResponse.json({ success: true, billId }, { status: 201 });

  } catch (error: any) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Transaction rollback crash:', rbErr);
    }
    console.error('POST demand bill error:', error);
    return NextResponse.json({ error: 'Failed to generate demand bill' }, { status: 500 });
  }
}
export { numberToNairaWords };
