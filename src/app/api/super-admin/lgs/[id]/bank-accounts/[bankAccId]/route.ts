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

// 1. PATCH: Set bank account as primary (updates Flutterwave subaccount and local_governments table)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; bankAccId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, bankAccId } = await params;

    // Fetch the bank account details
    const bankCheck = await query(
      'SELECT bank_name, account_number, account_name, is_primary FROM lg_bank_accounts WHERE id = $1 AND lg_id = $2',
      [bankAccId, id]
    );

    if (bankCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const account = bankCheck.rows[0];
    if (account.is_primary) {
      return NextResponse.json({ message: 'This account is already the primary account' });
    }

    // Fetch LG details (specifically Flutterwave subaccount info)
    const lgCheck = await query(
      'SELECT name, flutterwave_subaccount_id, flutterwave_subaccount_code, khrien_split_percentage FROM local_governments WHERE id = $1',
      [id]
    );

    if (lgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Local Government not found' }, { status: 404 });
    }

    const lg = lgCheck.rows[0];

    // If there is an active Flutterwave subaccount, update it
    if (lg.flutterwave_subaccount_id) {
      const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!flwSecretKey || flwSecretKey.includes('XXXX')) {
        return NextResponse.json({ 
          error: 'Flutterwave secret key is not configured. Cannot synchronize settlement account with Flutterwave.' 
        }, { status: 503 });
      }

      console.log(`Synchronizing primary bank account with Flutterwave subaccount ${lg.flutterwave_subaccount_id}...`);
      
      let flwSuccess = false;
      let flwErrorMsg = '';

      let retries = 2;
      while (retries >= 0) {
        try {
          const splitValue = Number(lg.khrien_split_percentage || 5.00) / 100;
          const flwRes = await fetch(`https://api.flutterwave.com/v3/subaccounts/${lg.flutterwave_subaccount_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${flwSecretKey}`,
            },
            body: JSON.stringify({
              account_bank: account.bank_name,
              account_number: account.account_number,
              business_name: lg.name,
              split_type: 'percentage',
              split_value: splitValue
            }),
            keepalive: false
          });

          const flwData = await flwRes.json();
          if (flwRes.ok && flwData.status === 'success') {
            flwSuccess = true;
            break;
          } else {
            flwErrorMsg = flwData.message || 'Unknown Flutterwave error';
            console.error(`Flutterwave update failed (Attempt ${3 - retries}/3):`, flwData);
            if (flwRes.status === 400 || flwRes.status === 404) {
              break;
            }
          }
        } catch (err: any) {
          flwErrorMsg = err.message;
          console.error(`Flutterwave API update call error (Attempt ${3 - retries}/3):`, err);
        }

        retries--;
        if (retries >= 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!flwSuccess) {
        return NextResponse.json({ 
          error: `Failed to update Flutterwave subaccount settlement details: ${flwErrorMsg}. The primary account change has been aborted.` 
        }, { status: 400 });
      }
    }

    // Begin DB update transaction
    await query('BEGIN');
    try {
      // 1. Reset all accounts for this LG to non-primary
      await query(
        'UPDATE lg_bank_accounts SET is_primary = false WHERE lg_id = $1',
        [id]
      );

      // 2. Set chosen account as primary
      await query(
        'UPDATE lg_bank_accounts SET is_primary = true WHERE id = $1 AND lg_id = $2',
        [bankAccId, id]
      );

      // 3. Update main local_governments table primary bank account fields
      await query(
        `UPDATE local_governments 
         SET bank_name = $1, bank_account_number = $2, bank_account_name = $3
         WHERE id = $4`,
        [account.bank_name, account.account_number, account.account_name, id]
      );

      await query('COMMIT');
    } catch (dbErr: any) {
      await query('ROLLBACK');
      console.error('Database transaction error setting primary bank account:', dbErr);
      return NextResponse.json({ error: 'Failed to update bank account in database' }, { status: 500 });
    }

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'set_primary_lg_bank_account', 
        `Set bank account ${account.account_number} (${account.account_name}) as primary for LG: ${lg.name}`
      ]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Primary account updated. Flutterwave settlement account has been updated.' 
    });
  } catch (error: any) {
    console.error('PATCH set primary bank account error:', error);
    return NextResponse.json({ error: 'Failed to update primary bank account' }, { status: 500 });
  }
}

// 2. DELETE: Remove bank account (only allowed for non-primary accounts)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; bankAccId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, bankAccId } = await params;

    // Verify bank account exists and belongs to this LG
    const bankCheck = await query(
      'SELECT account_number, account_name, is_primary FROM lg_bank_accounts WHERE id = $1 AND lg_id = $2',
      [bankAccId, id]
    );

    if (bankCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const account = bankCheck.rows[0];

    // Enforce primary account deletion rule
    if (account.is_primary) {
      return NextResponse.json({ 
        error: 'Cannot delete the primary bank account. Please designate another account as primary first.' 
      }, { status: 400 });
    }

    // Delete the account
    await query(
      'DELETE FROM lg_bank_accounts WHERE id = $1 AND lg_id = $2',
      [bankAccId, id]
    );

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [
        user.id, 
        'delete_lg_bank_account', 
        `Deleted non-primary bank account ${account.account_number} (${account.account_name}) for LG ID: ${id}`
      ]
    );

    return NextResponse.json({ success: true, message: 'Bank account deleted successfully' });
  } catch (error: any) {
    console.error('DELETE bank account error:', error);
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}
