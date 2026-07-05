import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './application/auth.service';
import { REFRESH_TOKEN_REPOSITORY, USER_REPOSITORY } from './domain/auth.repositories';
import {
  PrismaRefreshTokenRepository,
  PrismaUserRepository,
} from './infrastructure/prisma-auth.repositories';
import { AuthController } from './interface/auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
