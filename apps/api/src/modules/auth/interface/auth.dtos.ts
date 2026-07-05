import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha precisa ter pelo menos 8 caracteres.' })
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
