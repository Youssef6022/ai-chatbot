import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folderId = params.id;

    // Fonction récursive pour obtenir tous les fichiers d'un dossier
    async function getAllFilesInFolder(folderId: string | null): Promise<any[]> {
      // Récupérer les fichiers directs du dossier
      const { data: files } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('folder_id', folderId);

      // Récupérer les sous-dossiers
      const { data: subfolders } = await supabase
        .from('user_folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('parent_folder_id', folderId);

      let allFiles = files || [];

      // Récursivement récupérer les fichiers des sous-dossiers
      if (subfolders) {
        for (const subfolder of subfolders) {
          const subFiles = await getAllFilesInFolder(subfolder.id);
          allFiles = allFiles.concat(subFiles);
        }
      }

      return allFiles;
    }

    const allFiles = await getAllFilesInFolder(folderId === 'root' ? null : folderId);

    return NextResponse.json({
      files: allFiles,
      count: allFiles.length,
    });

  } catch (error) {
    console.error('Get folder files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}