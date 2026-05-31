import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Read session cookie from request headers
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((cookie) => cookie.split('='))
    );
    const sessionToken = cookies['session'];

    if (!sessionToken) {
      return NextResponse.json({ user: null });
    }

    const user = await verifyJWT(sessionToken);
    
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
