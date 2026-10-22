'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { PublicUser } from '@/lib/types'

type AuthState = {
  user: PublicUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const data = await api<{ user: PublicUser }>('/api/v1/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      logout: async () => {
        await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined)
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
