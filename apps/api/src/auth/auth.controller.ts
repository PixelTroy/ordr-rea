import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentUser } from './current-user.decorator'
import { Public } from './public.decorator'
import { AuthService } from './auth.service'
import { User } from '@prisma/client'

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  signup(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.signup(body, res, req.header('user-agent') ?? undefined)
  }

  @Public()
  @Post('login')
  login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(body, res, req.header('user-agent') ?? undefined)
  }

  @Public()
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req.cookies?.ordr_refresh || body?.refreshToken, res)
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies?.ordr_refresh, res)
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.me(user)
  }
}
