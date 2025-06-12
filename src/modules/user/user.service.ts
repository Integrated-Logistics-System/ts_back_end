import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdateAllergiesDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findByUserId(userId: string): Promise<User> {
    const user = await this.userModel.findOne({ userId }).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async updateAllergies(userId: string, updateAllergiesDto: UpdateAllergiesDto): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      { allergies: updateAllergiesDto.allergies },
      { new: true }
    ).exec();
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async updatePreferences(userId: string, preferences: any): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      { preferences },
      { new: true }
    ).exec();
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async addFavoriteRecipe(userId: string, recipeId: string): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      { $addToSet: { favoriteRecipes: recipeId } },
      { new: true }
    ).exec();
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async updateRecentIngredients(userId: string, ingredients: string[]): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      { 
        $push: { 
          recentIngredients: { 
            $each: ingredients, 
            $slice: -10 // 최근 10개만 유지
          } 
        } 
      },
      { new: true }
    ).exec();
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }
}