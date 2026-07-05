import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dtos';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Criar conta' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti brute-force — docs/09
  @ApiOperation({ summary: 'Entrar' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar sessão (rotaciona o refresh token)' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sair (revoga o refresh token)' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
