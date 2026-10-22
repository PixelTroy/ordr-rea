'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Button, ErrorText, Spinner } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

type Preview = {
  email: string
  role: string
  workspaceName: string
  workspaceSlug: string
  accepted: boolean
  expired: boolean
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api<Preview>(`/api/v1/invites/${token}`)
      .then(setPreview)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Invite not found'))
  }, [token])

  async function accept() {
    setPending(true)
    setError('')
    try {
      const result = await api<{ workspace: { slug: string } }>(`/api/v1/invites/${token}/accept`, {
        method: 'POST',
      })
      router.replace(`/${result.workspace.slug}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept the invite')
    } finally {
      setPending(false)
    }
  }

  if (!preview && !error) {
    return (
      <div className="h-screen">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-pop">
        <p className="text-xs font-semibold tracking-wide text-muted">WORKSPACE INVITE</p>
        {preview ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold">{preview.workspaceName}</h1>
            <p className="mt-2 text-sm text-muted">
              Join as <span className="font-medium text-ink">{preview.role.toLowerCase()}</span> with{' '}
              <span className="font-medium text-ink">{preview.email}</span>.
            </p>
            {preview.expired ? <p className="mt-3 text-sm text-red-600">This invite has expired.</p> : null}
            {preview.accepted ? <p className="mt-3 text-sm text-muted">This invite was already accepted.</p> : null}
            <div className="mt-5 space-y-2">
              {!loading && user && !preview.expired && !preview.accepted ? (
                <Button data-testid="accept-invite" className="w-full" onClick={accept} disabled={pending}>
                  {pending ? 'Joining…' : 'Accept invite'}
                </Button>
              ) : null}
              {!loading && !user ? (
                <Link
                  data-testid="invite-signup"
                  href={`/signup?invite=${token}&email=${encodeURIComponent(preview.email)}`}
                  className="inline-flex h-8 w-full items-center justify-center rounded-md bg-ink text-sm font-medium text-white"
                >
                  Sign up to accept
                </Link>
              ) : null}
              {!loading && !user ? (
                <Link
                  href={`/login?next=/invite/${token}&email=${encodeURIComponent(preview.email)}`}
                  className="inline-flex h-8 w-full items-center justify-center rounded-md border border-line text-sm"
                >
                  Log in
                </Link>
              ) : null}
              <ErrorText>{error}</ErrorText>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
