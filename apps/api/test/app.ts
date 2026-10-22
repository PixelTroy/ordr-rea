import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication({ bodyParser: true })
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  await app.init()
  const prisma = app.get(PrismaService)
  return { app, prisma }
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `)
}

export function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie']
  if (!raw) return ''
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((cookie) => cookie.split(';')[0]).join('; ')
}

export async function signup(
  app: INestApplication,
  overrides?: Partial<{ email: string; password: string; displayName: string }>,
): Promise<{
  res: request.Response
  email: string
  password: string
  displayName: string
  cookies: string
}> {
  const email = overrides?.email ?? `user-${Math.random().toString(16).slice(2)}@example.com`
  const password = overrides?.password ?? 'password123'
  const displayName = overrides?.displayName ?? 'Test User'
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .send({ email, password, displayName })
  return { res, email, password, displayName, cookies: cookieHeader(res) }
}
