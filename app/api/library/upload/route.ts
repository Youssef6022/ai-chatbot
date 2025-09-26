import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUUID } from '@/lib/utils';

// Nettoyer le nom de fichier pour Supabase Storage
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplacer les caractères spéciaux par _
    .replace(/_{2,}/g, '_') // Remplacer les multiples _ par un seul
    .replace(/^_|_$/g, ''); // Supprimer les _ au début et à la fin
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string | null;
    
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

    // Upload vers Supabase Storage
    const sanitizedName = sanitizeFilename(file.name);
    const filename = `${user.id}/${generateUUID()}-${sanitizedName}`;
    console.log('Uploading file:', filename, 'Size:', file.size, 'Type:', file.type);
    
    const fileBuffer = await file.arrayBuffer();
    console.log('File buffer length:', fileBuffer.byteLength);
    
    // Utiliser le client admin pour bypasser RLS sur le Storage
    const adminSupabase = createAdminClient();
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('user-files')
      .upload(filename, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error details:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload file', 
        details: uploadError.message 
      }, { status: 500 });
    }
    
    console.log('Upload successful:', uploadData);

    // Récupérer l'URL publique
    const { data: urlData } = adminSupabase.storage
      .from('user-files')
      .getPublicUrl(filename);
      
    const publicUrl = urlData.publicUrl;

    // Sauvegarder les métadonnées en base
    const { data: fileRecord, error } = await supabase
      .from('user_files')
      .insert({
        user_id: user.id,
        filename: filename,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        blob_url: publicUrl,
        folder_id: folderId || null,
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