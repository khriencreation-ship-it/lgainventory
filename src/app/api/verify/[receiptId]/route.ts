import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/verify/[receiptId] — public receipt verification, no auth required
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { receiptId } = await params;

    const receiptRes = await query(
      `SELECT
         r.id,
         r.reference_number,
         r.payment_status,
         r.total_bill_amount::float,
         r.total_amount_paid::float,
         r.outstanding_balance::float,
         r.last_payment_date,
         r.payments_log,
         r.created_at,
         c.full_name AS client_name,
         c.address AS client_address,
         c.ward AS client_ward,
         db.reference_number AS demand_bill_reference,
         lg.name AS lg_name,
         lg.logo_url AS lg_logo_url,
         s.name AS state_name
       FROM receipts r
       JOIN clients c ON r.client_id = c.id
       JOIN demand_bills db ON r.demand_bill_id = db.id
       JOIN local_governments lg ON r.lg_id = lg.id
       JOIN states s ON lg.state_id = s.id
       WHERE r.id = $1`,
      [receiptId]
    );

    if (receiptRes.rows.length === 0) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json({ found: true, receipt: receiptRes.rows[0] });

  } catch (error: any) {
    console.error('GET public verify receipt error:', error);
    return NextResponse.json({ error: 'Failed to verify receipt' }, { status: 500 });
  }
}
