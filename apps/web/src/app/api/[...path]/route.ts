export const dynamic = 'force-dynamic'

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const incoming = new URL(request.url)
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000'
  const target = `${base}/api/${path.filter(Boolean).join('/')}${incoming.search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  const method = request.method.toUpperCase()
  const response = await fetch(target, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer()),
    redirect: 'manual',
  })
  const out = new Headers()
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === 'set-cookie' || lower === 'content-encoding' || lower === 'content-length') return
    out.append(key, value)
  })
  for (const cookie of response.headers.getSetCookie?.() ?? []) out.append('set-cookie', cookie)
  return new Response(response.body, { status: response.status, headers: out })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
