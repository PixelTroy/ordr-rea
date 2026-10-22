import { BadRequestException } from '@nestjs/common'
import { ZodSchema } from 'zod'

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return path ? `${path}: ${issue.message}` : issue.message
      })
      .join('; ')
    throw new BadRequestException(message || 'Invalid request')
  }
  return result.data
}
