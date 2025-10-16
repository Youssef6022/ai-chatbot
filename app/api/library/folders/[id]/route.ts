import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folderId = params.id;

    // Fonction récursive pour supprimer un dossier et tout son contenu
    async function deleteFolderRecursively(folderId: string): Promise<void> {
      // Supprimer tous les fichiers du dossier
      const { error: filesError } = await supabase
        .from('user_files')
        .delete()
        .eq('user_id', user.id)
        .eq('folder_id', folderId);

      if (filesError) {
        throw filesError;
      }

      // Récupérer tous les sous-dossiers
      const { data: subfolders, error: subfoldersError } = await supabase
        .from('user_folders')
        .select('id')
        .eq('user_id', user.id)
        .eq('parent_folder_id', folderId);

      if (subfoldersError) {
        throw subfoldersError;
      }

      // Supprimer récursivement tous les sous-dossiers
      if (subfolders) {
        for (const subfolder of subfolders) {
          await deleteFolderRecursively(subfolder.id);
        }
      }

      // Supprimer le dossier lui-même
      const { error: folderError } = await supabase
        .from('user_folders')
        .delete()
        .eq('user_id', user.id)
        .eq('id', folderId);

      if (folderError) {
        throw folderError;
      }
    }

    // Vérifier que le dossier appartient à l'utilisateur
    const { data: folder, error: verifyError } = await supabase
      .from('user_folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', folderId)
      .single();

    if (verifyError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Supprimer le dossier et tout son contenu
    await deleteFolderRecursively(folderId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}