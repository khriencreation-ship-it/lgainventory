import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// Helper to resolve session user
async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Retrieve a single client's profile details along with historical demand bills and receipts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the client's core record (strictly scoped to officer's lg_id)
    const clientRes = await query(
      `SELECT id, lg_id, reference_number, full_name, phone_number, email_address, address, ward, created_at 
       FROM clients 
       WHERE id = $1 AND lg_id = $2`,
      [id, user.lg_id]
    );

    if (clientRes.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    const clientData = clientRes.rows[0];

    // Fetch all demand bills ever generated for this client by any officer in the LG
    const billsRes = await query(
      `SELECT 
         db.id,
         db.reference_number as bill_number,
         db.grand_total::float as total_amount,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         db.payment_status as status,
         db.created_at,
         db.due_date,
         u.name as generated_by_name,
         db.levy_items
       FROM demand_bills db
       LEFT JOIN users u ON db.created_by = u.id
       WHERE db.client_id = $1 AND db.lg_id = $2
       ORDER BY db.created_at DESC`,
      [id, user.lg_id]
    );

    // Fetch all receipts generated for this client
    const receiptsRes = await query(
      `SELECT 
         r.id as receipt_id,
         r.receipt_number,
         p.amount::float as amount_paid,
         p.payment_date as date_paid,
         u.name as generated_by_name
       FROM receipts r
       JOIN payments p ON r.payment_id = p.id
       JOIN demand_bills db ON r.bill_id = db.id
       LEFT JOIN users u ON db.created_by = u.id
       WHERE db.client_id = $1 AND db.lg_id = $2
       ORDER BY r.generated_at DESC`,
      [id, user.lg_id]
    );

    return NextResponse.json({
      client: clientData,
      demandBills: billsRes.rows,
      receipts: receiptsRes.rows
    });

  } catch (error: any) {
    console.error('GET client details error:', error);
    return NextResponse.json({ error: 'Failed to retrieve client details' }, { status: 500 });
  }
}

// 2. PATCH: Update client details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user || (user.role !== 'lg_account_officer' && user.role !== 'treasurer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { full_name, phone_number, email_address, address, ward } = body;

    // Validation
    if (!full_name || !phone_number || !address) {
      return NextResponse.json({ error: 'Full name, phone number, and address are required' }, { status: 400 });
    }

    // Perform the update (strictly scoped by lg_id for multi-tenant boundary checks)
    const updateRes = await query(
      `UPDATE clients 
       SET full_name = $1, 
           phone_number = $2, 
           email_address = $3, 
           address = $4, 
           ward = $5,
           updated_at = NOW() 
       WHERE id = $6 AND lg_id = $7
       RETURNING id, reference_number, full_name, phone_number, email_address, address, ward, created_at`,
      [
        full_name.trim(), 
        phone_number.trim(), 
        email_address ? email_address.trim() : null, 
        address.trim(), 
        ward ? ward.trim() : null,
        id, 
        user.lg_id
      ]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    const updatedClient = updateRes.rows[0];

    // Log the audit activity
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'update_client', 
        `Updated client "${updatedClient.full_name}" (Reference: ${updatedClient.reference_number})`
      ]
    );

    return NextResponse.json({ client: updatedClient });

  } catch (error: any) {
    console.error('PATCH client details error:', error);
    return NextResponse.json({ error: 'Failed to update client profile' }, { status: 500 });
  }
}
