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

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_number, account_bank } = await request.json();

    if (!account_number || !account_bank) {
      return NextResponse.json({ error: 'Account number and bank code are required' }, { status: 400 });
    }

    const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!flwSecretKey || flwSecretKey.includes('XXXX')) {
      return NextResponse.json({ error: 'Flutterwave is not configured' }, { status: 503 });
    }

    let flwData: any = null;
    let flwResOk = false;
    let flwStatus = 200;
    let resolveErrorMsg = '';

    let retries = 2;
    while (retries >= 0) {
      try {
        const flwRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${flwSecretKey}`,
          },
          body: JSON.stringify({
            account_number,
            account_bank,
          }),
          keepalive: false
        });

        flwStatus = flwRes.status;
        flwData = await flwRes.json();
        flwResOk = flwRes.ok;


        if (flwResOk && flwData.status === 'success') {
          break; // Success, exit retry loop
        } else {
          resolveErrorMsg = flwData.message || 'Could not verify account details';
          if (flwStatus === 400 || flwStatus === 404) {
            // Bad request/Not found doesn't require retry
            break;
          }
        }
      } catch (flwErr: any) {
        resolveErrorMsg = flwErr.message;
        console.error(`Account resolution attempt error (Attempt ${3 - retries}/3):`, flwErr);
      }

      retries--;
      if (retries >= 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (flwResOk && flwData && flwData.status === 'success') {
      return NextResponse.json({ account_name: flwData.data?.account_name });
    } else {
      return NextResponse.json({ error: resolveErrorMsg || 'Could not verify account details' }, { status: flwStatus === 200 ? 400 : flwStatus });
    }
  } catch (error: any) {
    console.error('Account resolution proxy error:', error);
    return NextResponse.json({ error: 'Failed to resolve account' }, { status: 500 });
  }
}
