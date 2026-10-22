import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })
  app.setGlobalPrefix('api')
  app.use(json({ limit: '5mb' }))
  app.use(urlencoded({ extended: true, limit: '5mb' }))
  app.use(cookieParser())
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    next()
  })
  const origin = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')
  app.enableCors({ origin, credentials: true })
  const port = Number(process.env.PORT || 4000)
  await app.listen(port)
  console.log(`Ordr API listening on ${port}`)
}

void bootstrap()
