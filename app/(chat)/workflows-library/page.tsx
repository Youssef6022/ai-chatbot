import { Workflow, workflow } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { WorkflowLibraryClient } from './workflow-library-client';

async function getWorkflows(userId: string): Promise<Workflow[]> {
  return await db
    .select()
    .from(workflow)
    .where(eq(workflow.userId, userId))
    .orderBy(desc(workflow.createdAt));
}

export default async function WorkflowsLibraryPage() {
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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Connectez-vous</h1>
        <p className="text-muted-foreground">
          Vous devez être connecté pour accéder à votre bibliothèque de workflows.
        </p>
      </div>
    );
  }

  const workflows = await getWorkflows(user.id);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bibliothèque de Workflows</h1>
        <p className="text-muted-foreground">
          Gérez et organisez tous vos workflows sauvegardés.
        </p>
      </div>
      
      <WorkflowLibraryClient workflows={workflows} />
    </div>
  );
}