import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 1. GET: Publicly load single demand bill details (unauthenticated)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const billRes = await query(
      `SELECT 
         db.id,
         db.reference_number,
         db.lg_id,
         db.levy_items,
         db.subtotal::float as subtotal,
         db.arrears::float as arrears,
         db.penalty::float as penalty,
         db.grand_total::float as grand_total,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         db.amount_in_words,
         db.year_of_billing,
         db.due_date,
         db.payment_status,
         db.payment_method,
         db.flutterwave_transaction_id,
         db.created_at,
         c.full_name as client_name,
         c.reference_number as client_reference_number,
         c.phone_number as client_phone,
         c.email_address as client_email,
         c.address as client_address,
         c.ward as client_ward,
         lg.name as lg_name,
         lg.logo_url as lg_logo_url,
         lg.bank_name as lg_bank_name,
         lg.bank_account_number as lg_bank_account_number,
         lg.bank_account_name as lg_bank_account_name,
         s.name as state_name,
         s.logo_url as state_logo_url
       FROM demand_bills db
       JOIN clients c ON db.client_id = c.id
       JOIN local_governments lg ON db.lg_id = lg.id
       JOIN states s ON lg.state_id = s.id
       WHERE db.id = $1`,
      [id]
    );

    if (billRes.rows.length === 0) {
      return NextResponse.json({ error: 'Demand bill not found' }, { status: 404 });
    }

    const bill = billRes.rows[0];

    // Check if the bill is unpaid and overdue
    const dueDate = new Date(bill.due_date);
    dueDate.setHours(23, 59, 59, 999);
    const today = new Date();
    const isOverdue = bill.payment_status === 'unpaid' && today > dueDate;

    // Fetch receipt details if one exists for this bill (any payment status)
    let receipt = null;
    if (bill.payment_status === 'paid' || bill.payment_status === 'partially_paid') {
      const receiptRes = await query(
        `SELECT 
           r.id,
           r.reference_number, 
           r.payment_status,
           r.total_bill_amount::float as total_bill_amount,
           r.total_amount_paid::float as total_amount_paid,
           r.outstanding_balance::float as outstanding_balance,
           r.last_payment_amount::float as last_payment_amount,
           r.last_payment_method,
           r.last_payment_date,
           r.last_payment_reference,
           r.payments_log,
           r.created_at,
           u.name as created_by_name,
           u.signature_url as created_by_signature_url
         FROM receipts r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.demand_bill_id = $1`,
        [id]
      );
      if (receiptRes.rows.length > 0) {
        receipt = receiptRes.rows[0];
      }
    }

    // Fetch all bank accounts for this local government
    const bankAccountsRes = await query(
      `SELECT id, bank_name, account_number, account_name, is_primary 
       FROM lg_bank_accounts 
       WHERE lg_id = $1 
       ORDER BY is_primary DESC, created_at ASC`,
      [bill.lg_id]
    );

    // Fetch treasurer and chairman signatures for dual-signature print
    const signaturesRes = await query(
      `SELECT u.name, u.signature_url, u.role
       FROM users u
       WHERE u.lg_id = $1
         AND u.role IN ('treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin')
         AND u.is_active = true
       ORDER BY 
         CASE WHEN u.role IN ('treasurer', 'lg_treasurer') THEN 0 ELSE 1 END ASC,
         u.created_at ASC`,
      [bill.lg_id]
    );

    const sigTreasurer = signaturesRes.rows.find((u: any) => u.role === 'treasurer' || u.role === 'lg_treasurer') || null;
    const sigChairman = signaturesRes.rows.find((u: any) => u.role === 'lg_chairman' || u.role === 'lg_admin') || null;

    return NextResponse.json({
      bill: {
        ...bill,
        is_overdue: isOverdue,
        lg_bank_accounts: bankAccountsRes.rows
      },
      receipt,
      signatures: {
        treasurer: sigTreasurer ? { name: sigTreasurer.name, signature_url: sigTreasurer.signature_url } : null,
        chairman: sigChairman ? { name: sigChairman.name, signature_url: sigChairman.signature_url } : null,
      }
    });

  } catch (error: any) {
    console.error('GET public bill details error:', error);
    return NextResponse.json({ error: 'Failed to retrieve invoice details' }, { status: 500 });
  }
}

// 2. POST: Initialize Flutterwave split payment transaction
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { origin, amount, payment_type } = body;

    if (!origin) {
      return NextResponse.json({ error: 'Origin URL is required to set redirection callback' }, { status: 400 });
    }

    // Fetch bill details with LG banking config
    const billRes = await query(
      `SELECT 
         db.id,
         db.reference_number,
         db.grand_total::float as grand_total,
         COALESCE(db.amount_paid, 0.00)::float as amount_paid,
         CASE WHEN db.payment_status = 'unpaid' THEN db.grand_total WHEN db.payment_status = 'paid' THEN 0.00 ELSE COALESCE(NULLIF(db.balance_due, 0.00), db.grand_total - COALESCE(db.amount_paid, 0.00)) END::float as balance_due,
         c.full_name as client_name,
         c.phone_number as client_phone,
         c.email_address as client_email,
         lg.name as lg_name,
         lg.logo_url as lg_logo_url,
         lg.flutterwave_subaccount_code,
         COALESCE(lg.khrien_split_percentage, 5.00) as khrien_split_percentage
       FROM demand_bills db
       JOIN clients c ON db.client_id = c.id
       JOIN local_governments lg ON db.lg_id = lg.id
       WHERE db.id = $1`,
      [id]
    );

    if (billRes.rows.length === 0) {
      return NextResponse.json({ error: 'Demand bill not found' }, { status: 404 });
    }

    const bill = billRes.rows[0];

    const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!flwSecretKey) {
      return NextResponse.json({ error: 'Payment gateway configuration is missing' }, { status: 500 });
    }

    const selectedAmount = amount !== undefined ? parseFloat(amount) : bill.balance_due;
    const selectedPaymentType = payment_type || 'full';

    // Server-side validation
    if (selectedAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 });
    }
    if (selectedAmount > bill.balance_due + 0.01) {
      return NextResponse.json({ error: `Payment amount exceeds outstanding balance of ${bill.balance_due}` }, { status: 400 });
    }

    // Prepare Flutterwave request payload
    // Use unique transaction reference to avoid duplicate reference errors on partial payments
    const txRefUnique = `${bill.reference_number}_${Date.now()}`;
    
    // Split ratios: subaccount code splits transaction
    // If the split percent is 5.00%, subaccount gets 95.00%
    const splitPercentage = parseFloat(bill.khrien_split_percentage) || 5.00;
    const lgRatio = 100 - splitPercentage;

    const flwPayload: any = {
      tx_ref: txRefUnique,
      amount: selectedAmount,
      currency: 'NGN',
      redirect_url: `${origin}/pay/${bill.id}`,
      customer: {
        email: bill.client_email || 'revenue@khrien.gov.ng',
        phonenumber: bill.client_phone,
        name: bill.client_name
      },
      customizations: {
        title: `${bill.lg_name} Revenue`,
        description: `Payment for Demand Notice: ${bill.reference_number}`,
        logo: bill.lg_logo_url || 'https://raw.githubusercontent.com/google/material-design-icons/master/png/action/receipt/ios/production_res/3x/baseline_receipt_black_48pt_3x.png'
      },
      meta: {
        bill_reference: bill.reference_number,
        payment_type: selectedPaymentType
      }
    };

    // If subaccount exists, append splits
    if (bill.flutterwave_subaccount_code) {
      flwPayload.subaccounts = [
        {
          id: bill.flutterwave_subaccount_code,
          transaction_split_ratio: lgRatio,
          transaction_charge_type: 'percentage'
        }
      ];
    }

    console.log('Initializing Flutterwave Payment Standard redirect. Payload:', JSON.stringify(flwPayload));

    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${flwSecretKey}`
      },
      body: JSON.stringify(flwPayload)
    });

    const flwData = await flwRes.json();
    if (!flwRes.ok || flwData.status !== 'success') {
      console.error('Flutterwave initialization error:', flwData);
      throw new Error(flwData.message || 'Flutterwave payment gateway rejected session initialization');
    }

    // Return checkout payment link
    return NextResponse.json({ 
      success: true, 
      paymentLink: flwData.data.link 
    });

  } catch (error: any) {
    console.error('POST initialize checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize payment checkout session' }, { status: 550 });
  }
}
