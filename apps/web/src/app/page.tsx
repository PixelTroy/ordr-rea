'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { Workspace } from '@/lib/types'

export default function IndexPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    api<{ workspaces: Workspace[] }>('/api/v1/workspaces')
      .then((data) => {
        if (data.workspaces[0]) router.replace(`/${data.workspaces[0].slug}`)
        else router.replace('/create-workspace')
      })
      .catch(() => router.replace('/login'))
  }, [loading, router, user])

  return (
    <div className="h-screen">
      <Spinner />
    </div>
  )
}
