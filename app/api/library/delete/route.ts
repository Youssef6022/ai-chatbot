import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Récupérer les infos du fichier
    const { data: file, error: fetchError } = await supabase
      .from('user_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id) // Sécurité : seul le propriétaire peut supprimer
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Supprimer de Vercel Blob
    try {
      await del(file.blob_url);
    } catch (blobError) {
      console.error('Blob deletion error:', blobError);
      // Continue même si la suppression blob échoue
    }

    // Supprimer de la base de données
    const { error: deleteError } = await supabase
      .from('user_files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}