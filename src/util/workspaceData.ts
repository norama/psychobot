import type { Role } from '@/util/roleRoute'

export type Workspace = {
  id: string
  therapist_id: string
  client_id: string
  therapist: { display_name: string } | null
  client: { display_name: string } | null
}

export type WorkspacesState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: Workspace[] }

export const validWorkspaceId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

// Read at call time, not module load, so a redirect in roleRoute.ts is seen.
export function getWorkspaceId(): string | null {
  return new URLSearchParams(window.location.search).get('workspace')
}

export type LastWorkspace = { id: string; role: Role }

const lastWorkspaceKey = 'lastWorkspace'

export function getStoredWorkspace(): LastWorkspace | null {
  try {
    const value = JSON.parse(localStorage.getItem(lastWorkspaceKey) ?? 'null')
    const valid =
      typeof value?.id === 'string' &&
      validWorkspaceId.test(value.id) &&
      (value.role === 'therapist' || value.role === 'client')
    return valid ? (value as LastWorkspace) : null
  } catch {
    return null
  }
}

export function storeWorkspace(workspace: LastWorkspace) {
  localStorage.setItem(lastWorkspaceKey, JSON.stringify(workspace))
}

export function clearStoredWorkspace() {
  localStorage.removeItem(lastWorkspaceKey)
}
