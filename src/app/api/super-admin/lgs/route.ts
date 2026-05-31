import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

export async function GET() {
  try {
    const lgsResult = await query(`
      SELECT 
        lg.id, 
        lg.name, 
        lg.code, 
        lg.is_active, 
        lg.created_at, 
        lg.state_id, 
        s.name as state_name,
        lg.jurisdiction,
        lg.address,
        lg.phone,
        lg.email,
        lg.logo_url,
        lg.payment_setup_status
      FROM local_governments lg 
      JOIN states s ON lg.state_id = s.id 
      ORDER BY s.name ASC, lg.name ASC
    `);
    return NextResponse.json({ lgs: lgsResult.rows });
  } catch (error: any) {
    console.error('GET LGs error:', error);
    return NextResponse.json({ error: 'Failed to retrieve local governments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    const {
      state_id,
      name,
      code,
      jurisdiction,
      address,
      phone,
      email,
      logo_url,
      bank_name,
      bank_account_number,
      bank_account_name,
      khrien_split_percentage,
    } = await request.json();

    if (!state_id || !name || !code) {
      return NextResponse.json({ error: 'State ID, LG name, and code are required' }, { status: 400 });
    }

    const nameStr = name.trim();
    const codeStr = code.trim().toLowerCase();
    const jurStr = jurisdiction ? jurisdiction.trim() : null;
    const addrStr = address ? address.trim() : null;
    const phoneStr = phone ? phone.trim() : null;
    const emailStr = email ? email.trim() : null;
    const logoUrlStr = logo_url ? logo_url.trim() : null;
    const bankNameStr = bank_name ? bank_name.trim() : null;
    const bankAccNum = bank_account_number ? bank_account_number.trim() : null;
    const bankAccName = bank_account_name ? bank_account_name.trim() : null;
    const splitPct = khrien_split_percentage ?? 5.00;

    // Verify parent state exists
    const stateCheck = await query('SELECT id, name FROM states WHERE id = $1', [state_id]);
    if (stateCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Selected state does not exist' }, { status: 404 });
    }
    const state = stateCheck.rows[0];

    // Check duplicate in this state
    const duplicateCheck = await query(
      'SELECT id FROM local_governments WHERE state_id = $1 AND (name = $2 OR code = $3)',
      [state_id, nameStr, codeStr]
    );
    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json({ error: 'A Local Government with this name or code already exists in this State' }, { status: 400 });
    }

    // Attempt Flutterwave subaccount creation (if banking details provided)
    let flwSubaccountId: string | null = null;
    let flwSubaccountCode: string | null = null;
    let paymentSetupStatus = 'not_configured';

    if (bankNameStr && bankAccNum && bankAccName) {
      const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (flwSecretKey && !flwSecretKey.includes('XXXX')) {
        const splitValue = Number(splitPct) / 100; // Convert 5.00% -> 0.05
        let retries = 2;
        while (retries >= 0) {
            try {
              const flwRes = await fetch('https://api.flutterwave.com/v3/subaccounts', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${flwSecretKey}`,
                },
                body: JSON.stringify({
                  account_bank: bankNameStr,
                  account_number: bankAccNum,
                  business_name: nameStr,
                  business_email: emailStr || `noreply@${codeStr}.lga.gov.ng`,
                  business_contact: nameStr,
                  business_contact_mobile: phoneStr || '00000000000',
                  business_mobile: phoneStr || '00000000000',
                  country: 'NG',
                  split_type: 'percentage',
                  split_value: splitValue,
                }),
                keepalive: false
              });

              const flwData = await flwRes.json();

              if (flwRes.ok && flwData.status === 'success') {
                flwSubaccountId = flwData.data?.id?.toString() || null;
                flwSubaccountCode = flwData.data?.subaccount_id || null;
                paymentSetupStatus = 'active';
                break;
              } else {
                console.error(`Flutterwave subaccount creation failed (Attempt ${3 - retries}/3):`, flwData);
                paymentSetupStatus = 'payment_setup_incomplete';
                if (flwRes.status === 400 || flwRes.status === 404) {
                  // Bad request details are invalid, no need to retry
                  break;
                }
              }
            } catch (flwErr: any) {
              console.error(`Flutterwave API call error (Attempt ${3 - retries}/3):`, flwErr.message);
              paymentSetupStatus = 'payment_setup_incomplete';
            }
            
            retries--;
            if (retries >= 0) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
      } else {
        // Flutterwave key not configured — mark as incomplete
        paymentSetupStatus = 'payment_setup_incomplete';
      }
    }

    // Insert
    const insertResult = await query(
      `INSERT INTO local_governments (
        state_id, name, code, jurisdiction, address, phone, email, logo_url, is_active,
        bank_name, bank_account_number, bank_account_name,
        flutterwave_subaccount_id, flutterwave_subaccount_code,
        khrien_split_percentage, payment_setup_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING id, state_id, name, code, jurisdiction, address, phone, email, logo_url, is_active, created_at,
                bank_name, bank_account_number, bank_account_name,
                flutterwave_subaccount_id, flutterwave_subaccount_code,
                khrien_split_percentage, payment_setup_status`,
      [
        state_id, nameStr, codeStr, jurStr, addrStr, phoneStr, emailStr, logoUrlStr,
        bankNameStr, bankAccNum, bankAccName,
        flwSubaccountId, flwSubaccountCode,
        splitPct, paymentSetupStatus
      ]
    );
    const newLg = insertResult.rows[0];

    // Create the first and primary bank account record in lg_bank_accounts if provided
    if (bankNameStr && bankAccNum && bankAccName) {
      await query(
        `INSERT INTO lg_bank_accounts (lg_id, bank_name, account_number, account_name, is_primary)
         VALUES ($1, $2, $3, $4, true)`,
        [newLg.id, bankNameStr, bankAccNum, bankAccName]
      );
    }

    // Automatically copy global seeds categories and items to the new LG
    const globalCats = await query('SELECT id, name, description FROM levy_categories WHERE lg_id IS NULL');
    const globalItems = await query('SELECT id, category_id, name FROM levy_items_master WHERE lg_id IS NULL');

    for (const cat of globalCats.rows) {
      const catInsert = await query(
        `INSERT INTO levy_categories (name, description, lg_id, is_seeded)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [cat.name, cat.description, newLg.id]
      );
      const newCatId = catInsert.rows[0].id;

      const catItems = globalItems.rows.filter((item: any) => item.category_id === cat.id);
      for (const item of catItems) {
        await query(
          `INSERT INTO levy_items_master (category_id, name, lg_id, is_seeded)
           VALUES ($1, $2, $3, true)`,
          [newCatId, item.name, newLg.id]
        );
      }
    }

    // Log action
    if (user) {
      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [user.id, 'create_lg', `Created Local Government: ${newLg.name} (${newLg.code.toUpperCase()}) in ${state.name} | Payment status: ${paymentSetupStatus}`]
      );
    }

    return NextResponse.json({ lg: { ...newLg, state_name: state.name } }, { status: 201 });
  } catch (error: any) {
    console.error('POST LG error:', error);
    return NextResponse.json({ error: 'Failed to create Local Government' }, { status: 500 });
  }
}
