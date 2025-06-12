import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateAllergiesDto, UpdatePreferencesDto } from './dto/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get(':userId')
  async findOne(@Param('userId') userId: string) {
    return this.userService.findByUserId(userId);
  }

  @Put(':userId/allergies')
  async updateAllergies(
    @Param('userId') userId: string,
    @Body() updateAllergiesDto: UpdateAllergiesDto,
  ) {
    return this.userService.updateAllergies(userId, updateAllergiesDto);
  }

  @Put(':userId/preferences')
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.userService.updatePreferences(userId, updatePreferencesDto);
  }

  @Post(':userId/favorites/:recipeId')
  async addFavorite(
    @Param('userId') userId: string,
    @Param('recipeId') recipeId: string,
  ) {
    return this.userService.addFavoriteRecipe(userId, recipeId);
  }
}