import { NextResponse } from 'next/server';
import path from 'path';
import { query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c) => c.split('='))
  );
  const token = cookies['session'];
  return token ? await verifyJWT(token) : null;
}

// 1. POST: Upload or replace officer's signature
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    const allowedRoles = ['lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin'];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file selected' }, { status: 400 });
    }

    // Validate size: max 2MB
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'Image exceeds maximum 2MB size limit' }, { status: 400 });
    }

    // Validate formats: PNG, JPG, JPEG only
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const ext = path.extname(file.name).toLowerCase();
    const isAllowedExt = ['.png', '.jpg', '.jpeg'].includes(ext);
    
    if (!allowedMimeTypes.includes(file.type) && !isAllowedExt) {
      return NextResponse.json({ error: 'Invalid file format. Only PNG, JPG, and JPEG are accepted.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename in a signatures folder
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `signatures/sig-${user.id}-${uniqueSuffix}${ext || '.png'}`;

    // Upload signature to Supabase logos bucket
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filename, buffer, {
        contentType: file.type || 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Fetch the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filename);

    // Save signature url in the database
    await query(
      `UPDATE users 
       SET signature_url = $1, updated_at = NOW() 
       WHERE id = $2`,
      [publicUrl, user.id]
    );

    // Write audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, details) 
       VALUES ($1, 'upload_signature', 'Uploaded new signature image.')`,
      [user.id]
    );

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Signature upload error:', error);
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 });
  }
}

// 2. DELETE: Remove the officer's signature
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request);
    const allowedRoles = ['lg_account_officer', 'lg_officer', 'treasurer', 'lg_treasurer', 'lg_chairman', 'lg_admin'];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current signature to delete if needed (optional but good practice)
    const currentRes = await query(
      `SELECT signature_url FROM users WHERE id = $1`,
      [user.id]
    );

    if (currentRes.rows.length > 0 && currentRes.rows[0].signature_url) {
      const oldUrl = currentRes.rows[0].signature_url;
      try {
        // Extract filename from URL to delete from storage if desired
        const urlObj = new URL(oldUrl);
        const pathParts = urlObj.pathname.split('/logos/');
        if (pathParts.length > 1) {
          const filepath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from('logos').remove([filepath]);
        }
      } catch (err) {
        console.warn('Failed to delete old signature image from storage:', err);
      }
    }

    // Clear signature_url from database
    await query(
      `UPDATE users 
       SET signature_url = NULL, updated_at = NOW() 
       WHERE id = $1`,
      [user.id]
    );

    // Write audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, details) 
       VALUES ($1, 'delete_signature', 'Removed signature image.')`,
      [user.id]
    );

    return NextResponse.json({ success: true, message: 'Signature removed successfully' });
  } catch (error: any) {
    console.error('Signature delete error:', error);
    return NextResponse.json({ error: 'Failed to remove signature' }, { status: 500 });
  }
}
