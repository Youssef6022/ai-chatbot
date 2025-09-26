import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createClient } from '@/lib/supabase/server';
import { generateUUID } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validation du fichier
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    const allowedTypes = [
      'image/*',
      'text/*', 
      'application/pdf',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/html',
      'text/markdown'
    ];

    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    // Vérifier si le token Blob est configuré
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel Blob Storage non configuré. Ajoutez BLOB_READ_WRITE_TOKEN dans .env.local' 
      }, { status: 500 });
    }

    // Upload vers Vercel Blob
    const filename = `${user.id}/${generateUUID()}-${file.name}`;
    const blob = await put(filename, file, {
      access: 'public',
    });

    // Sauvegarder les métadonnées en base
    const { data: fileRecord, error } = await supabase
      .from('user_files')
      .insert({
        user_id: user.id,
        filename: filename,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        blob_url: blob.url,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save file metadata' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      file: fileRecord
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}