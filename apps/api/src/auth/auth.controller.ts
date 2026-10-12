import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AuthUser } from '../common/auth.types';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});
const pinSchema = z.object({
  staffCode: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/),
  deviceId: z.string().optional(),
});
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) b: z.infer<typeof loginSchema>, @Ip() ip: string) {
    return this.auth.loginWithPassword(b.email, b.password, ip, b.deviceId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pin-login')
  @HttpCode(200)
  pinLogin(@Body(new ZodPipe(pinSchema)) b: z.infer<typeof pinSchema>, @Ip() ip: string) {
    return this.auth.loginWithPin(b.staffCode, b.pin, ip, b.deviceId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) b: z.infer<typeof refreshSchema>, @Ip() ip: string) {
    return this.auth.refresh(b.refreshToken, ip);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) b: z.infer<typeof refreshSchema>) {
    await this.auth.logout(b.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
