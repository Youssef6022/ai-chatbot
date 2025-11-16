import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getWorkflowExecutionsByUserId,
  getWorkflowExecutionsByWorkflowId,
  saveWorkflowExecution,
  deleteWorkflowExecution,
} from '@/lib/db/queries';

// GET - Récupérer l'historique des exécutions
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);

    let executions;

    if (workflowId) {
      // Get executions for a specific workflow
      executions = await getWorkflowExecutionsByWorkflowId({
        workflowId,
        userId: user.id,
        limit,
      });
    } else {
      // Get all executions for the user
      executions = await getWorkflowExecutionsByUserId({
        userId: user.id,
        limit,
      });
    }

    return NextResponse.json({ executions });
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}

// POST - Sauvegarder une nouvelle exécution
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId, workflowTitle, executionData, status = 'success' } = body;

    if (!workflowId || !workflowTitle || !executionData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const execution = await saveWorkflowExecution({
      workflowId,
      userId: user.id,
      workflowTitle,
      executionData,
      status,
    });

    return NextResponse.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('Error saving workflow execution:', error);
    return NextResponse.json(
      { error: 'Failed to save execution' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une exécution
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing execution id' },
        { status: 400 }
      );
    }

    await deleteWorkflowExecution({
      id,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow execution:', error);
    return NextResponse.json(
      { error: 'Failed to delete execution' },
      { status: 500 }
    );
  }
}
