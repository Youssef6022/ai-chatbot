import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workflow } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    
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

    const workflowResult = await db
      .select()
      .from(workflow)
      .where(
        and(
          eq(workflow.id, id),
          eq(workflow.userId, user.id)
        )
      );

    if (workflowResult.length === 0) {
      return NextResponse.json(
        { error: 'Workflow non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(workflowResult[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du workflow:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    
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

    const { title, description, workflowData, isPublic } = await request.json();

    const updatedWorkflow = await db
      .update(workflow)
      .set({
        title,
        description,
        workflowData,
        isPublic,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflow.id, id),
          eq(workflow.userId, user.id)
        )
      )
      .returning();

    if (updatedWorkflow.length === 0) {
      return NextResponse.json(
        { error: 'Workflow non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedWorkflow[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du workflow:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    
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

    const deletedWorkflow = await db
      .delete(workflow)
      .where(
        and(
          eq(workflow.id, id),
          eq(workflow.userId, user.id)
        )
      )
      .returning();

    if (deletedWorkflow.length === 0) {
      return NextResponse.json(
        { error: 'Workflow non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du workflow:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}