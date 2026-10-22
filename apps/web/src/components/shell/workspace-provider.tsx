'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { Membership, Workspace } from '@/lib/types'
import { useAuth } from '@/components/auth-provider'
import { Spinner } from '@/components/ui'

type WorkspaceState = {
  slug: string
  workspace: Workspace
  membership: Membership
  workspaces: Workspace[]
  reload: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function WorkspaceProvider({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [state, setState] = useState<Omit<WorkspaceState, 'reload'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const [current, list] = await Promise.all([
      api<{ workspace: Workspace; membership: Membership }>(`/api/v1/workspaces/${slug}`),
      api<{ workspaces: Workspace[] }>('/api/v1/workspaces'),
    ])
    setState({
      slug,
      workspace: current.workspace,
      membership: current.membership,
      workspaces: list.workspaces,
    })
    document.title = `${current.workspace.name} · Ordr`
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?next=/${slug}`)
      return
    }
    let cancel = false
    setError(null)
    reload()
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof ApiError ? err.message : 'Could not open this workspace')
      })
    return () => {
      cancel = true
    }
  }, [slug, user, loading])

  if (loading || (!state && !error)) return <Spinner />
  if (!user) return <Spinner />
  if (error || !state) {
    return (
      <div className="grid h-screen place-items-center bg-canvas px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceContext.Provider value={{ ...state, reload }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('WorkspaceProvider is missing')
  return value
}
