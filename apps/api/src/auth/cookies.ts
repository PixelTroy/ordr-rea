import type { Response } from 'express'

const ACCESS_MS = 15 * 60 * 1000
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000

function base() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  }
}

export function setAuthCookies(res: Response, access: string, refresh: string) {
  const common = base()
  res.cookie('ordr_access', access, { ...common, maxAge: ACCESS_MS })
  res.cookie('ordr_refresh', refresh, { ...common, maxAge: REFRESH_MS })
}

export function clearAuthCookies(res: Response) {
  const common = base()
  res.clearCookie('ordr_access', common)
  res.clearCookie('ordr_refresh', common)
}
