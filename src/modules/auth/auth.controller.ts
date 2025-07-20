import { Controller, Post, Get, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from '../../shared/dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Server is healthy' })
  healthCheck() {
    return {
      success: true,
      message: 'AI Chat API with LangChain is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: ['cookingLevel', 'preferences', 'allergies'],
      note: 'Profile management moved to /users endpoint'
    };
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user with cooking preferences' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
        registerDto.email,
        registerDto.password,
        registerDto.name,
        registerDto.cookingLevel,
        registerDto.preferences
    );
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Valid refresh token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      },
      required: ['refreshToken']
    }
  })
  async refreshToken(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 필요합니다');
    }

    try {
      const result = await this.authService.refreshAccessToken(body.refreshToken);
      return {
        success: true,
        message: '토큰 갱신 성공',
        ...result
      };
    } catch (error) {
      throw new UnauthorizedException('리프레시 토큰이 유효하지 않거나 만료되었습니다');
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to logout',
          example: '507f1f77bcf86cd799439011'
        }
      },
      required: ['userId']
    }
  })
  async logout(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new UnauthorizedException('사용자 ID가 필요합니다');
    }

    const result = await this.authService.logout(body.userId);
    return result;
  }

  @Post('revoke-refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token for security purposes' })
  @ApiResponse({ status: 200, description: 'Refresh token revoked successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to revoke refresh token',
          example: '507f1f77bcf86cd799439011'
        }
      },
      required: ['userId']
    }
  })
  async revokeRefreshToken(@Body() body: { userId: string }) {
    if (!body.userId) {
      throw new UnauthorizedException('사용자 ID가 필요합니다');
    }

    const result = await this.authService.revokeRefreshToken(body.userId);
    return result;
  }
}