import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, itemType, targetFolderId } = await request.json();

    if (!itemId || !itemType || !['file', 'folder'].includes(itemType)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (itemType === 'file') {
      // Déplacer un fichier
      const { error } = await supabase
        .from('user_files')
        .update({ folder_id: targetFolderId || null })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error moving file:', error);
        return NextResponse.json({ error: 'Failed to move file' }, { status: 500 });
      }
    } else {
      // Déplacer un dossier
      // Vérifier qu'on ne déplace pas un dossier dans lui-même ou ses sous-dossiers
      if (itemId === targetFolderId) {
        return NextResponse.json({ error: 'Cannot move folder into itself' }, { status: 400 });
      }

      const { error } = await supabase
        .from('user_folders')
        .update({ parent_folder_id: targetFolderId || null })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error moving folder:', error);
        return NextResponse.json({ error: 'Failed to move folder' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Move item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}