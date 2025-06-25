import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
    name?: string,
    cookingLevel?: string,
    preferences?: string[]
  ) {
    this.logger.log(`Register attempt for email: ${email}`);

    try {
      // 중복 이메일 체크
      const existingUser = await this.userModel.findOne({ email });
      if (existingUser) {
        throw new ConflictException('이미 존재하는 이메일입니다');
      }

      // 비밀번호 암호화
      const hashedPassword = await bcrypt.hash(password, 10);

      // 사용자 생성
      const user = new this.userModel({
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        allergies: [],
        cookingLevel: cookingLevel || '초급',
        preferences: preferences || [],
      });

      const savedUser = await user.save();
      const userId = savedUser._id.toString();

      // JWT 토큰 생성
      const token = this.jwtService.sign({
        sub: userId,
        email: savedUser.email
      });

      this.logger.log(`Registration successful for ${email}`);
      return {
        success: true,
        message: '회원가입 성공',
        token,
        user: {
          id: userId,
          email: savedUser.email,
          name: savedUser.name,
          cookingLevel: savedUser.cookingLevel,
          preferences: savedUser.preferences,
          allergies: savedUser.allergies
        }
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Registration error for ${email}:`, error.message);
      throw error;
    }
  }

  async login(email: string, password: string) {
    this.logger.log(`Login attempt for email: ${email}`);

    try {
      // 사용자 조회
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
      }

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
      }

      const userId = user._id.toString();

      // JWT 토큰 생성
      const token = this.jwtService.sign({
        sub: userId,
        email: user.email
      });

      this.logger.log(`Login successful for ${email}`);
      return {
        success: true,
        message: '로그인 성공',
        token,
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          allergies: user.allergies,
          cookingLevel: user.cookingLevel,
          preferences: user.preferences
        }
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login error for ${email}:`, error.message);
      throw new UnauthorizedException('로그인 처리 중 오류가 발생했습니다');
    }
  }

  async getProfile(userId: string) {
    try {
      const user = await this.userModel.findById(userId).select('-password');
      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        allergies: user.allergies,
        cookingLevel: user.cookingLevel,
        preferences: user.preferences,
        createdAt: user.createdAt,
      };
    } catch (error) {
      this.logger.error(`Get profile error for ${userId}:`, error.message);
      throw new UnauthorizedException('프로필 조회 중 오류가 발생했습니다');
    }
  }

  async updateProfile(userId: string, updateData: {
    name?: string;
    allergies?: string[];
    cookingLevel?: string;
    preferences?: string[];
  }) {
    try {
      this.logger.log(`Updating profile for user ${userId}:`, updateData);
      
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password');

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      this.logger.log(`Profile updated successfully for user ${userId}:`, {
        allergies: user.allergies,
        cookingLevel: user.cookingLevel,
        preferences: user.preferences
      });

      return {
        success: true,
        message: '프로필 업데이트 성공',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          allergies: user.allergies,
          cookingLevel: user.cookingLevel,
          preferences: user.preferences,
        }
      };
    } catch (error) {
      this.logger.error(`Update profile error for ${userId}:`, error.message);
      throw error;
    }
  }

  async validateUserById(userId: string) {
    try {
      const user = await this.userModel.findById(userId).select('-password');
      return user;
    } catch (error) {
      this.logger.error(`Validate user error for ${userId}:`, error.message);
      return null;
    }
  }

  async findById(userId: string) {
    try {
      const user = await this.userModel.findById(userId).select('-password');
      if (!user) return null;

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        allergies: user.allergies,
        cookingLevel: user.cookingLevel,
        preferences: user.preferences,
      };
    } catch (error) {
      this.logger.error(`Find by ID error for ${userId}:`, error.message);
      return null;
    }
  }
}