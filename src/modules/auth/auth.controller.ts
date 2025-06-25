import { Controller, Post, Get, Put, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../../shared/dto/auth.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
      features: ['cookingLevel', 'preferences', 'allergies']
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile with cooking preferences' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    const profile = await this.authService.getProfile(req.user.id);
    return {
      success: true,
      user: profile
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile and cooking preferences' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any,
  ) {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
  }

  // 새로운 요리 설정 전용 엔드포인트들
  @Put('cooking-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update only cooking level and preferences' })
  @ApiResponse({ status: 200, description: 'Cooking preferences updated successfully' })
  async updateCookingPreferences(
    @Body() body: { cookingLevel?: string; preferences?: string[] },
    @Request() req: any,
  ) {
    const { cookingLevel, preferences } = body;
    return this.authService.updateProfile(req.user.id, {
      cookingLevel,
      preferences
    });
  }

  @Put('allergies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user allergies' })
  @ApiResponse({ status: 200, description: 'Allergies updated successfully' })
  async updateAllergies(
    @Body() body: { allergies: string[] },
    @Request() req: any,
  ) {
    console.log(`💾 Updating allergies for user ${req.user.id}:`, body.allergies);
    const result = await this.authService.updateProfile(req.user.id, {
      allergies: body.allergies
    });
    console.log(`✅ Allergies updated successfully:`, result);
    return result;
  }

  @Get('allergies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user allergies' })
  @ApiResponse({ status: 200, description: 'Allergies retrieved successfully' })
  async getAllergies(@Request() req: any) {
    try {
      const profile = await this.authService.getProfile(req.user.id);
      
      return {
        success: true,
        message: '알레르기 정보를 성공적으로 조회했습니다.',
        data: {
          allergies: profile.allergies || [],
          userId: profile.id,
          userEmail: profile.email
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '알레르기 정보 조회 중 오류가 발생했습니다.',
        error: error.message
      };
    }
  }
}