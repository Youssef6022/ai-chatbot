import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { userQuota } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer les quotas de l'utilisateur
    let quota = await db
      .select()
      .from(userQuota)
      .where(eq(userQuota.userId, user.id))
      .limit(1);

    // Créer les quotas par défaut si ils n'existent pas
    if (quota.length === 0) {
      const newQuota = await db
        .insert(userQuota)
        .values({
          userId: user.id,
          smallUsed: 0,
          smallLimit: 5000,
          mediumUsed: 0,
          mediumLimit: 2000,
          largeUsed: 0,
          largeLimit: 500,
        })
        .returning();
      
      quota = newQuota;
    }

    return Response.json(quota[0]);
  } catch (error) {
    console.error('Error fetching quota:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { modelSize } = await request.json();
    
    if (!['small', 'medium', 'large'].includes(modelSize)) {
      return Response.json({ error: 'Invalid model size' }, { status: 400 });
    }

    // Récupérer les quotas actuels
    let quota = await db
      .select()
      .from(userQuota)
      .where(eq(userQuota.userId, user.id))
      .limit(1);

    // Créer les quotas par défaut si ils n'existent pas
    if (quota.length === 0) {
      const newQuota = await db
        .insert(userQuota)
        .values({
          userId: user.id,
          smallUsed: 0,
          smallLimit: 5000,
          mediumUsed: 0,
          mediumLimit: 2000,
          largeUsed: 0,
          largeLimit: 500,
        })
        .returning();
      
      quota = newQuota;
    }

    const currentQuota = quota[0];
    
    // Vérifier si l'utilisateur a dépassé sa limite
    const usedField = `${modelSize}Used` as keyof typeof currentQuota;
    const limitField = `${modelSize}Limit` as keyof typeof currentQuota;
    
    if (currentQuota[usedField] >= currentQuota[limitField]) {
      return Response.json({ error: 'Quota exceeded' }, { status: 429 });
    }

    // Incrémenter l'usage
    const updateData = {
      [`${modelSize}Used`]: currentQuota[usedField] + 1,
      updatedAt: new Date(),
    };

    const updatedQuota = await db
      .update(userQuota)
      .set(updateData)
      .where(eq(userQuota.userId, user.id))
      .returning();

    return Response.json(updatedQuota[0]);
  } catch (error) {
    console.error('Error updating quota:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}