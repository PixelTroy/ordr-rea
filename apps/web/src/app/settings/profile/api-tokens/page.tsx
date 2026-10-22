'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

export default function ApiTokensPlaceholder() {
  const { user, loading } = useAuth()
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-semibold tracking-wide text-muted">PROFILE</p>
      <h1 className="mt-2 text-2xl font-semibold">Personal access tokens</h1>
      <p className="mt-2 text-sm text-muted">
        {loading ? 'Loading…' : user ? `Signed in as ${user.email}. ` : 'Log in to manage tokens. '}
        Tokens are created in a workspace at /{'{workspace}'}/settings/access-tokens, with a title, description, and an expiration date. That screen arrives with the developer milestone.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
        Back to Ordr
      </Link>
    </div>
  )
}
