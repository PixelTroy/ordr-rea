export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message
    if (Array.isArray(message)) return message.join('; ')
    if (typeof message === 'string') return message
  }
  return `Request failed (${status})`
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.includes('/api/v1/auth/')) {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    if (refreshed.ok) return api<T>(path, init, false)
  }
  const text = await response.text()
  const body = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) throw new ApiError(messageFrom(body, response.status), response.status)
  return body as T
}
