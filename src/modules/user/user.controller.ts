import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    const user = await this.userService.findById(req.user.id);
    const { password, ...result } = user.toObject();
    return result;
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.userService.update(req.user.id, updateUserDto);
    const { password, ...result } = user.toObject();
    return result;
  }

  @Post('favorites/:recipeId')
  @ApiOperation({ summary: 'Add recipe to favorites' })
  async addToFavorites(@Request() req, @Param('recipeId') recipeId: string) {
    return this.userService.addToFavorites(req.user.id, recipeId);
  }

  @Patch('favorites/:recipeId')
  @ApiOperation({ summary: 'Remove recipe from favorites' })
  async removeFromFavorites(
    @Request() req,
    @Param('recipeId') recipeId: string,
  ) {
    return this.userService.removeFromFavorites(req.user.id, recipeId);
  }
}
