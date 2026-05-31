import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';


async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

// 1. GET: Fetch Specific LGA details + banking info + operator, client, and bill counts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch LGA details
    const lgResult = await query(
      `SELECT 
        lg.id, 
        lg.name, 
        lg.code, 
        lg.state_id, 
        s.name as state_name,
        lg.jurisdiction,
        lg.address,
        lg.phone,
        lg.email,
        lg.logo_url,
        lg.is_active,
        lg.created_at,
        lg.bank_name,
        lg.bank_account_number,
        lg.bank_account_name,
        lg.flutterwave_subaccount_id,
        lg.flutterwave_subaccount_code,
        lg.khrien_split_percentage,
        lg.payment_setup_status
      FROM local_governments lg
      JOIN states s ON lg.state_id = s.id
      WHERE lg.id = $1`,
      [id]
    );

    if (lgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Local Government not found' }, { status: 404 });
    }

    const lg = lgResult.rows[0];

    // Fetch aggregates
    const [userCountRes, clientCountRes, billCountRes] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM users WHERE lg_id = $1', [id]),
      query('SELECT COUNT(*)::int as count FROM clients WHERE lg_id = $1', [id]),
      query('SELECT COUNT(*)::int as count FROM demand_bills WHERE lg_id = $1', [id])
    ]);

    return NextResponse.json({
      lg: {
        ...lg,
        user_count: userCountRes.rows[0].count,
        client_count: clientCountRes.rows[0].count,
        bill_count: billCountRes.rows[0].count
      }
    });
  } catch (error: any) {
    console.error('GET LG detail error:', error);
    return NextResponse.json({ error: 'Failed to retrieve Local Government details' }, { status: 500 });
  }
}

// 2. PATCH: Update LGA details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    const { id } = await params;
    const body = await request.json();
    const { 
      is_active, 
      name, 
      code, 
      state_id,
      jurisdiction, 
      address, 
      phone, 
      email, 
      logo_url,
      bank_name,
      bank_account_number,
      bank_account_name,
      khrien_split_percentage,
      retry_payment_setup,
    } = body;

    // Check if LG exists
    const lgCheck = await query(
      'SELECT id, name, code, is_active, state_id, jurisdiction, address, phone, email, logo_url, bank_name, bank_account_number, bank_account_name, flutterwave_subaccount_id, flutterwave_subaccount_code, khrien_split_percentage, payment_setup_status FROM local_governments WHERE id = $1',
      [id]
    );
    if (lgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Local Government not found' }, { status: 404 });
    }

    const currentLg = lgCheck.rows[0];

    // Handle Flutterwave retry payment setup
    if (retry_payment_setup) {
      const targetBankName = bank_name || currentLg.bank_name;
      const targetAccNum = bank_account_number || currentLg.bank_account_number;
      const targetAccName = bank_account_name || currentLg.bank_account_name;
      const targetSplit = khrien_split_percentage ?? currentLg.khrien_split_percentage ?? 5.00;
      const targetPhone = phone || currentLg.phone;
      const targetEmail = email || currentLg.email;
      const targetCode = code || currentLg.code;
      const targetName = name || currentLg.name;

      if (!targetBankName || !targetAccNum || !targetAccName) {
        return NextResponse.json({ error: 'Banking details (bank name, account number, account name) are required to retry payment setup' }, { status: 400 });
      }

      const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!flwSecretKey || flwSecretKey.includes('XXXX')) {
        return NextResponse.json({ error: 'Flutterwave is not configured on this server. Please add FLUTTERWAVE_SECRET_KEY to your environment variables.' }, { status: 503 });
      }

      let flwData: any = null;
      let flwResOk = false;
      let flwStatus = 200;
      let flwErrorMsg = '';
      let newSubaccountId: string | null = null;
      let newSubaccountCode: string | null = null;

      try {
        const splitValue = Number(targetSplit) / 100;
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
                account_bank: targetBankName,
                account_number: targetAccNum,
                business_name: targetName,
                business_email: targetEmail || `noreply@${targetCode}.lga.gov.ng`,
                business_contact: targetName,
                business_contact_mobile: targetPhone || '00000000000',
                business_mobile: targetPhone || '00000000000',
                country: 'NG',
                split_type: 'percentage',
                split_value: splitValue,
              }),
              keepalive: false
            });

            flwStatus = flwRes.status;
            flwData = await flwRes.json();
            flwResOk = flwRes.ok;

            if (flwResOk && flwData.status === 'success') {
              newSubaccountId = flwData.data?.id?.toString() || null;
              newSubaccountCode = flwData.data?.subaccount_id || null;
              break;
            } else {
              flwErrorMsg = flwData.message || 'Unknown Flutterwave error';
              console.error(`Flutterwave retry failed (Attempt ${3 - retries}/3):`, flwData);
              if (flwStatus === 400 || flwStatus === 404) {
                break;
              }
            }
          } catch (flwErr: any) {
            flwErrorMsg = flwErr.message;
            console.error(`Flutterwave API error during retry (Attempt ${3 - retries}/3):`, flwErr.message);
          }

          retries--;
          if (retries >= 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (flwResOk && flwData && flwData.status === 'success') {
          await query(
            `UPDATE local_governments SET 
              flutterwave_subaccount_id = $1,
              flutterwave_subaccount_code = $2,
              payment_setup_status = 'active',
              bank_name = $3,
              bank_account_number = $4,
              bank_account_name = $5,
              khrien_split_percentage = $6
            WHERE id = $7`,
            [newSubaccountId, newSubaccountCode, targetBankName, targetAccNum, targetAccName, targetSplit, id]
          );

          if (user) {
            await query(
              'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
              [user.id, 'retry_lg_payment_setup', `Retried payment setup for ${currentLg.name} — Flutterwave subaccount created: ${newSubaccountCode}`]
            );
          }

          const updatedResult = await query(
            `SELECT lg.*, s.name as state_name FROM local_governments lg JOIN states s ON lg.state_id = s.id WHERE lg.id = $1`,
            [id]
          );

          return NextResponse.json({ lg: updatedResult.rows[0], message: 'Payment setup completed successfully!' });
        } else {
          return NextResponse.json({ 
            error: `Flutterwave subaccount creation failed: ${flwErrorMsg || 'Unknown error'}. Please verify your banking details.` 
          }, { status: flwStatus === 200 ? 400 : flwStatus });
        }
      } catch (flwErr: any) {
        console.error('Flutterwave API error during retry:', flwErr.message);
        return NextResponse.json({ error: 'Failed to connect to Flutterwave API. Please try again later.' }, { status: 502 });
      }
    }

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let valIndex = 1;

    if (is_active !== undefined) {
      fieldsToUpdate.push(`is_active = $${valIndex++}`);
      values.push(is_active);
    }
    if (name !== undefined) {
      fieldsToUpdate.push(`name = $${valIndex++}`);
      values.push(name.trim());
    }
    if (code !== undefined) {
      fieldsToUpdate.push(`code = $${valIndex++}`);
      values.push(code.trim().toLowerCase());
    }
    if (state_id !== undefined) {
      fieldsToUpdate.push(`state_id = $${valIndex++}`);
      values.push(state_id);
    }
    if (jurisdiction !== undefined) {
      fieldsToUpdate.push(`jurisdiction = $${valIndex++}`);
      values.push(jurisdiction ? jurisdiction.trim() : null);
    }
    if (address !== undefined) {
      fieldsToUpdate.push(`address = $${valIndex++}`);
      values.push(address ? address.trim() : null);
    }
    if (phone !== undefined) {
      fieldsToUpdate.push(`phone = $${valIndex++}`);
      values.push(phone ? phone.trim() : null);
    }
    if (email !== undefined) {
      fieldsToUpdate.push(`email = $${valIndex++}`);
      values.push(email ? email.trim() : null);
    }
    if (logo_url !== undefined) {
      fieldsToUpdate.push(`logo_url = $${valIndex++}`);
      values.push(logo_url ? logo_url.trim() : null);
    }
    if (bank_name !== undefined) {
      fieldsToUpdate.push(`bank_name = $${valIndex++}`);
      values.push(bank_name ? bank_name.trim() : null);
    }
    if (bank_account_number !== undefined) {
      fieldsToUpdate.push(`bank_account_number = $${valIndex++}`);
      values.push(bank_account_number ? bank_account_number.trim() : null);
    }
    if (bank_account_name !== undefined) {
      fieldsToUpdate.push(`bank_account_name = $${valIndex++}`);
      values.push(bank_account_name ? bank_account_name.trim() : null);
    }
    if (khrien_split_percentage !== undefined) {
      fieldsToUpdate.push(`khrien_split_percentage = $${valIndex++}`);
      values.push(khrien_split_percentage);
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No update parameters provided' }, { status: 400 });
    }

    values.push(id);
    const updateQuery = `
      UPDATE local_governments 
      SET ${fieldsToUpdate.join(', ')} 
      WHERE id = $${valIndex} 
      RETURNING id, state_id, name, code, jurisdiction, address, phone, email, logo_url, is_active, created_at,
                bank_name, bank_account_number, bank_account_name,
                flutterwave_subaccount_id, flutterwave_subaccount_code,
                khrien_split_percentage, payment_setup_status
    `;

    const updateResult = await query(updateQuery, values);
    const updatedLg = updateResult.rows[0];

    // Log action
    if (user) {
      let logMsg = `Updated Local Government ${currentLg.name}: `;
      const changes: string[] = [];
      if (is_active !== undefined && is_active !== currentLg.is_active) {
        changes.push(`status to ${is_active ? 'active' : 'deactivated'}`);
      }
      if (name !== undefined && name.trim() !== currentLg.name) {
        changes.push(`name to "${name.trim()}"`);
      }
      if (code !== undefined && code.trim().toLowerCase() !== currentLg.code) {
        changes.push(`code to "${code.trim().toLowerCase()}"`);
      }
      if (state_id !== undefined && state_id !== currentLg.state_id) {
        changes.push(`state_id to "${state_id}"`);
      }
      logMsg += changes.join(', ') || 'field updates';

      await query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [user.id, 'update_lg', logMsg]
      );
    }

    // Return the updated item with its state name
    const stateNameResult = await query('SELECT name FROM states WHERE id = $1', [updatedLg.state_id]);
    const stateName = stateNameResult.rows[0]?.name || '';

    return NextResponse.json({ lg: { ...updatedLg, state_name: stateName } });
  } catch (error: any) {
    console.error('PATCH LG error:', error);
    return NextResponse.json({ error: 'Failed to update Local Government' }, { status: 500 });
  }
}

// 3. DELETE: Remove LGA (must be deactivated first)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if LG exists
    const lgCheck = await query(
      'SELECT id, name, code, is_active, logo_url, flutterwave_subaccount_id, flutterwave_subaccount_code FROM local_governments WHERE id = $1',
      [id]
    );
    if (lgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Local Government not found' }, { status: 404 });
    }
    const targetLg = lgCheck.rows[0];

    // PREVENTIVE RULE: Must be deactivated first
    if (targetLg.is_active) {
      return NextResponse.json({ 
        error: `Cannot delete Local Government "${targetLg.name}" because it is currently Active. Please deactivate it first to temporarily pause operations before deleting.` 
      }, { status: 400 });
    }

    // Check child constraints to prevent raw SQL crashes
    const [userCountRes, clientCountRes, billCountRes] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM users WHERE lg_id = $1', [id]),
      query('SELECT COUNT(*)::int as count FROM clients WHERE lg_id = $1', [id]),
      query('SELECT COUNT(*)::int as count FROM demand_bills WHERE lg_id = $1', [id])
    ]);

    const usersCount = userCountRes.rows[0].count;
    const clientsCount = clientCountRes.rows[0].count;
    const billsCount = billCountRes.rows[0].count;

    if (usersCount > 0 || clientsCount > 0 || billsCount > 0) {
      const issues: string[] = [];
      if (usersCount > 0) issues.push(`${usersCount} operator user(s)`);
      if (clientsCount > 0) issues.push(`${clientsCount} client portfolio(s)`);
      if (billsCount > 0) issues.push(`${billsCount} demand bill(s)`);

      return NextResponse.json({
        error: `Cannot delete Local Government "${targetLg.name}" because it has existing related records: ${issues.join(', ')}. Please remove or reassign these dependency records first.`
      }, { status: 400 });
    }

    // Delete logo file from Supabase storage or disk if it exists
    const logoUrl = targetLg.logo_url;
    if (logoUrl) {
      if (logoUrl.includes('/storage/v1/object/public/logos/')) {
        const parts = logoUrl.split('/storage/v1/object/public/logos/');
        const filename = parts[parts.length - 1];
        if (filename) {
          try {
            const { error: delErr } = await supabase.storage
              .from('logos')
              .remove([filename]);
            if (delErr) {
              console.error(`Failed to delete logo from Supabase: ${delErr.message}`);
            }
          } catch (err: any) {
            console.error(`Supabase storage deletion error: ${err.message}`);
          }
        }
      } else if (logoUrl.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', logoUrl);
        try {
          await unlink(filePath);
        } catch (err: any) {
          console.error(`Failed to delete local LGA logo file: ${err.message}`);
        }
      }
    }

    // Attempt Flutterwave subaccount deletion if it exists
    const subaccountId = targetLg.flutterwave_subaccount_id;
    let flwDeleteSuccess = false;
    let flwDeleteErrorMsg = '';

    if (subaccountId) {
      const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (flwSecretKey && !flwSecretKey.includes('XXXX')) {
        let retries = 2;
        while (retries >= 0) {
          try {
            const flwRes = await fetch(`https://api.flutterwave.com/v3/subaccounts/${subaccountId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${flwSecretKey}`,
                'Content-Type': 'application/json'
              },
              keepalive: false
            });
            const flwData = await flwRes.json();
            if (flwRes.ok && flwData.status === 'success') {
              flwDeleteSuccess = true;
              break;
            } else {
              flwDeleteErrorMsg = flwData.message || 'Unknown Flutterwave error';
              console.error(`Flutterwave subaccount deletion failed for subaccount ${subaccountId} (Attempt ${3 - retries}/3):`, flwData);
              if (flwRes.status === 400 || flwRes.status === 404) {
                // If subaccount does not exist or invalid request, do not retry
                break;
              }
            }
          } catch (flwErr: any) {
            flwDeleteErrorMsg = flwErr.message;
            console.error(`Flutterwave subaccount deletion API call error (Attempt ${3 - retries}/3):`, flwErr);
          }
          
          retries--;
          if (retries >= 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Delete LG row
    await query('DELETE FROM local_governments WHERE id = $1', [id]);

    // Log action
    let auditDetails = `Deleted Local Government: ${targetLg.name} (${targetLg.code.toUpperCase()})`;
    if (subaccountId) {
      auditDetails += flwDeleteSuccess 
        ? ` | Flutterwave subaccount ${targetLg.flutterwave_subaccount_code} deleted successfully` 
        : ` | Warning: Failed to delete Flutterwave subaccount ${targetLg.flutterwave_subaccount_code} (${flwDeleteErrorMsg})`;
    }

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'delete_lg', auditDetails]
    );

    return NextResponse.json({ 
      success: true, 
      message: flwDeleteSuccess 
        ? 'Local Government and its Flutterwave subaccount deleted successfully' 
        : subaccountId
        ? `Local Government deleted successfully. Warning: Flutterwave subaccount could not be deleted automatically (${flwDeleteErrorMsg}).`
        : 'Local Government deleted successfully'
    });
  } catch (error: any) {
    console.error('DELETE LG error:', error);
    return NextResponse.json({ error: 'Failed to delete Local Government' }, { status: 500 });
  }
}
