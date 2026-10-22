'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { AuthFrame } from '@/components/auth-frame'
import { useAuth } from '@/components/auth-provider'
import { Button, ErrorText, TextField } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useAuth()
  const invite = params.get('invite')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/api/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      })
      await refresh()
      if (invite) router.replace(`/invite/${invite}`)
      else router.replace('/create-workspace')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame
      title="Create your account"
      subtitle={invite ? 'Then accept the workspace invite.' : 'Start a workspace for your team.'}
      footer={
        <>
          Already have an account?{' '}
          <Link
            className="font-medium text-ink underline"
            href={invite ? `/login?next=/invite/${invite}&email=${encodeURIComponent(email)}` : '/login'}
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Display name"
          data-testid="signup-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
        <TextField
          label="Email"
          type="email"
          data-testid="signup-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          readOnly={Boolean(invite && params.get('email'))}
        />
        <TextField
          label="Password"
          type="password"
          data-testid="signup-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button className="w-full" type="submit" data-testid="signup-submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthFrame>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
