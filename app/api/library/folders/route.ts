import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentFolderId = searchParams.get('parent') || null;

    // Récupérer les dossiers
    let foldersQuery = supabase
      .from('user_folders')
      .select('*')
      .eq('user_id', user.id);
    
    if (parentFolderId) {
      foldersQuery = foldersQuery.eq('parent_folder_id', parentFolderId);
    } else {
      foldersQuery = foldersQuery.is('parent_folder_id', null);
    }
    
    const { data: folders, error: foldersError } = await foldersQuery.order('name');

    // Récupérer les fichiers
    let filesQuery = supabase
      .from('user_files')
      .select('*')
      .eq('user_id', user.id);
    
    if (parentFolderId) {
      filesQuery = filesQuery.eq('folder_id', parentFolderId);
    } else {
      filesQuery = filesQuery.is('folder_id', null);
    }
    
    const { data: files, error: filesError } = await filesQuery.order('original_name');

    if (foldersError || filesError) {
      console.error('Database error:', foldersError || filesError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({
      folders: folders || [],
      files: files || [],
    });

  } catch (error) {
    console.error('Fetch items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, parentFolderId } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // Vérifier que le nom n'existe pas déjà dans ce dossier
    let existingQuery = supabase
      .from('user_folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name.trim());
    
    if (parentFolderId) {
      existingQuery = existingQuery.eq('parent_folder_id', parentFolderId);
    } else {
      existingQuery = existingQuery.is('parent_folder_id', null);
    }
    
    const { data: existing } = await existingQuery.single();

    if (existing) {
      return NextResponse.json({ error: 'Folder name already exists' }, { status: 400 });
    }

    // Créer le dossier
    const { data: folder, error } = await supabase
      .from('user_folders')
      .insert({
        user_id: user.id,
        name: name.trim(),
        parent_folder_id: parentFolderId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });

  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}