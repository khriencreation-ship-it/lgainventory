import { NextResponse } from 'next/server';
import path from 'path';
import { verifyJWT } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename to avoid naming conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.name) || '.png';
    const filename = `logo-${uniqueSuffix}${ext}`;

    // Upload to Supabase bucket "logos"
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filename, buffer, {
        contentType: file.type || 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: `Supabase upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public url
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

