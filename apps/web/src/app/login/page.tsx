'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { AuthFrame } from '@/components/auth-frame'
import { useAuth } from '@/components/auth-provider'
import { Button, ErrorText, TextField } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useAuth()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      await refresh()
      router.replace(params.get('next') || '/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame
      title="Log in to Ordr"
      subtitle="Pick up work items, cycles, and pages for your workspace."
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-ink underline" href="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Email"
          type="email"
          data-testid="login-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          data-testid="login-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button className="w-full" type="submit" data-testid="login-submit" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthFrame>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
