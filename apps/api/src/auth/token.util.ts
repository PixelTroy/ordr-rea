import { createHash, randomBytes } from 'crypto'

const COLORS = ['#4f46e5', '#0f766e', '#b45309', '#be123c', '#1d4ed8', '#6d28d9', '#047857', '#9a3412']

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function colorFor(email: string): string {
  let hash = 0
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function accessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me'
}

export function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me'
}
