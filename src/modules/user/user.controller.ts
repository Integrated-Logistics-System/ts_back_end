import { Controller, Get, Put, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto, UpdateAllergiesDto, UpdateCookingPreferencesDto } from './dto/user.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
    private readonly logger = new Logger(UserController.name);

    constructor(private readonly userService: UserService) {}

    @Get('profile')
    @ApiOperation({ summary: 'Get user profile with cooking preferences' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getProfile(@Request() req: { user: { id: string; }; }) {
        const profile = await this.userService.getProfile(req.user.id);
        return {
            success: true,
            user: profile
        };
    }

    @Put('profile')
    @ApiOperation({ summary: 'Update user profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateProfile(
        @Body() updateProfileDto: UpdateProfileDto,
        @Request() req: { user: { id: string; }; },
    ) {
        return this.userService.updateProfile(req.user.id, updateProfileDto);
    }

    @Get('allergies')
    @ApiOperation({ summary: 'Get user allergies' })
    @ApiResponse({ status: 200, description: 'Allergies retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getAllergies(@Request() req: { user: { id: string; }; }) {
        return this.userService.getAllergies(req.user.id);
    }

    @Put('allergies')
    @ApiOperation({ summary: 'Update user allergies' })
    @ApiResponse({ status: 200, description: 'Allergies updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateAllergies(
        @Body() allergiesDto: UpdateAllergiesDto,
        @Request() req: { user: { id: string; }; },
    ) {
        this.logger.log(`💾 Updating allergies for user ${req.user.id}:`, allergiesDto.allergies);
        const result = await this.userService.updateAllergies(req.user.id, allergiesDto);
        this.logger.log(`✅ Allergies updated successfully:`, result);
        return result;
    }

    @Put('cooking-preferences')
    @ApiOperation({ summary: 'Update cooking level and preferences' })
    @ApiResponse({ status: 200, description: 'Cooking preferences updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateCookingPreferences(
        @Body() preferencesDto: UpdateCookingPreferencesDto,
        @Request() req: { user: { id: string; }; },
    ) {
        return this.userService.updateCookingPreferences(req.user.id, preferencesDto);
    }
}