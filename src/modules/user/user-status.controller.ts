import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  UserStatusService, 
  CreateUserStatusDto, 
  UpdateUserStatusDto,
  UserStatusResponse 
} from './user-status.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@Controller('user-status')
@UseGuards(JwtAuthGuard)
export class UserStatusController {
  constructor(private readonly userStatusService: UserStatusService) {}

  /**
   * 나의 상태 설정/업데이트
   */
  @Post()
  async setStatus(
    @Body() dto: CreateUserStatusDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: UserStatusResponse;
    message: string;
  }> {
    const userId = req.user.id;

    // 유효성 검증
    const validation = this.userStatusService.validateStatus(dto.status);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const userStatus = await this.userStatusService.createOrUpdateStatus(userId, dto);

    return {
      success: true,
      data: userStatus,
      message: '나의 상태가 설정되었습니다!',
    };
  }

  /**
   * 나의 상태 조회
   */
  @Get()
  async getStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: UserStatusResponse | null;
    message: string;
  }> {
    const userId = req.user.id;
    const userStatus = await this.userStatusService.getUserStatus(userId);

    return {
      success: true,
      data: userStatus,
      message: userStatus ? '상태를 조회했습니다.' : '설정된 상태가 없습니다.',
    };
  }

  /**
   * 나의 상태 업데이트
   */
  @Put()
  async updateStatus(
    @Body() dto: UpdateUserStatusDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: UserStatusResponse;
    message: string;
  }> {
    const userId = req.user.id;

    // 유효성 검증
    const validation = this.userStatusService.validateStatus(dto.status);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const userStatus = await this.userStatusService.createOrUpdateStatus(userId, dto);

    return {
      success: true,
      data: userStatus,
      message: '나의 상태가 업데이트되었습니다!',
    };
  }

  /**
   * 나의 상태 삭제
   */
  @Delete()
  async deleteStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const userId = req.user.id;
    const success = await this.userStatusService.deactivateStatus(userId);

    return {
      success,
      message: success ? '나의 상태가 삭제되었습니다.' : '삭제할 상태가 없습니다.',
    };
  }

  /**
   * LangGraph용 컨텍스트 조회 (내부 API)
   */
  @Get('context')
  async getContextForLangGraph(
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    context: string;
  }> {
    const userId = req.user.id;
    const context = await this.userStatusService.getContextForLangGraph(userId);

    return {
      success: true,
      context,
    };
  }

  /**
   * 상태 검증 (프론트엔드용)
   */
  @Post('validate')
  async validateStatus(
    @Body() dto: { status: string },
  ): Promise<{
    isValid: boolean;
    error?: string;
    suggestions?: string[];
  }> {
    const validation = this.userStatusService.validateStatus(dto.status);
    
    // 간단한 제안 제공
    const suggestions = !validation.isValid && dto.status.length > 50 
      ? ['더 간단하게 표현해보세요', '핵심 키워드만 사용해보세요']
      : undefined;

    return {
      ...validation,
      suggestions,
    };
  }
}