import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workflow } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { title, description, workflowData, isPublic = false } = await request.json();

    if (!title || !workflowData) {
      return NextResponse.json(
        { error: 'Titre et données du workflow requis' },
        { status: 400 }
      );
    }

    const newWorkflow = await db
      .insert(workflow)
      .values({
        userId: user.id,
        title,
        description,
        workflowData,
        isPublic,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newWorkflow[0]);
  } catch (error) {
    console.error('Erreur lors de la création du workflow:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const workflows = await db
      .select()
      .from(workflow)
      .where(eq(workflow.userId, user.id));

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Erreur lors de la récupération des workflows:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}