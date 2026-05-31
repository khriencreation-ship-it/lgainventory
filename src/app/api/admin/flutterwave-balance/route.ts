import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

async function getUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((cookie) => cookie.split('='))
  );
  const sessionToken = cookies['session'];
  return sessionToken ? await verifyJWT(sessionToken) : null;
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!flwSecretKey || flwSecretKey.includes('XXXX')) {
      // Return a realistic mock balance for local sandbox development
      return NextResponse.json({ 
        available_balance: 754200.00,
        ledger_balance: 754200.00,
        is_mock: true
      });
    }

    let flwData: any = null;
    let flwResOk = false;
    let flwStatus = 200;
    let balanceErrorMsg = '';

    let retries = 2;
    while (retries >= 0) {
      try {
        const flwRes = await fetch('https://api.flutterwave.com/v3/balances/NGN', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${flwSecretKey}`,
          },
          keepalive: false
        });

        flwStatus = flwRes.status;
        flwData = await flwRes.json();
        flwResOk = flwRes.ok;

        if (flwResOk && flwData.status === 'success') {
          break;
        } else {
          balanceErrorMsg = flwData.message || 'Failed to fetch balance from Flutterwave';
          if (flwStatus === 400 || flwStatus === 404) {
            break;
          }
        }
      } catch (flwErr: any) {
        balanceErrorMsg = flwErr.message;
        console.error(`Balance fetch attempt error (Attempt ${3 - retries}/3):`, flwErr);
      }

      retries--;
      if (retries >= 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (flwResOk && flwData && flwData.status === 'success') {
      return NextResponse.json({ 
        available_balance: flwData.data?.available_balance || 0,
        ledger_balance: flwData.data?.ledger_balance || 0
      });
    } else {
      console.error('Flutterwave balance API returned error status:', flwData);
      return NextResponse.json({ 
        error: balanceErrorMsg || 'Failed to fetch balance from Flutterwave'
      }, { status: flwStatus === 200 ? 400 : flwStatus });
    }
  } catch (error: any) {
    console.error('Flutterwave balance API crash:', error);
    return NextResponse.json({ error: 'Failed to retrieve balance' }, { status: 500 });
  }
}
