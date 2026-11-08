import type { Workspace, WorkspacesState } from '@/util/workspaceData'
import { getWorkspaceId, validWorkspaceId } from '@/util/workspaceData'
import { useEffect, useState } from 'react'
import { db } from './supabase'

export function useWorkspaces(userId: string) {
  const workspaceId = getWorkspaceId()
  const [state, setState] = useState<WorkspacesState>({ status: 'loading' })

  useEffect(() => {
    if (workspaceId !== null && !validWorkspaceId.test(workspaceId)) {
      setState({ status: 'ready', rows: [] })
      return
    }

    const controller = new AbortController()
    const query = db.from('workspaces').select(`
        id, therapist_id, client_id,
        therapist:profiles!workspaces_therapist_id_fkey(display_name),
        client:profiles!workspaces_client_id_fkey(display_name)
      `)

    async function load() {
      try {
        const request = workspaceId === null ? query : query.eq('id', workspaceId)
        const { data, error } = await request.abortSignal(controller.signal)
        if (controller.signal.aborted) return
        // supabase-js infers embedded-relation cardinality from the select
        // string without generated Database types, and can't tell a to-one
        // foreign key embed (therapist_id/client_id -> profiles.id) from a
        // to-many one — it defaults to typing both as arrays. PostgREST
        // still returns a single object per row here, so the cast reflects
        // actual runtime shape rather than the generic inferred type.
        setState(
          error ? { status: 'error' } : { status: 'ready', rows: data as unknown as Workspace[] },
        )
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [db, workspaceId])

  const singleWorkspace =
    state.status === 'ready' && workspaceId !== null && state.rows.length === 1
      ? state.rows[0]
      : null

  return { state, singleWorkspace, workspaceId }
}
