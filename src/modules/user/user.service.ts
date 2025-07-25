// src/modules/user/user.service.ts (최소화 버전)
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly cacheService: CacheService,
    ) {}

    // 🎯 핵심 기능만 MongoDB 사용

    async createUser(userData: {
        email: string;
        password: string;
        name?: string;
        cookingLevel?: string;
        preferences?: string[];
        settings?: {
            allergies?: string[];
            preferences?: string[];
            cookingLevel?: string;
            language?: string;
        };
    }): Promise<UserDocument> {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const user = new this.userModel({
                email: userData.email,
                password: hashedPassword,
                name: userData.name || userData.email.split('@')[0],
                settings: {
                    ...(userData.settings || {}),
                    cookingLevel: userData.cookingLevel,
                    preferences: userData.preferences,
                },
                loginCount: 0
            });

            const savedUser = await user.save();

            // 🎯 사용자 설정은 즉시 캐시로 이동
            const userSettings = savedUser.settings || {};
            const userId = String(savedUser._id);
            await this.cacheUserSettings(userId, userSettings as {
                allergies?: string[];
                preferences?: string[];
                cookingLevel?: string;
                language?: string;
            });

            this.logger.log(`✅ User created: ${userData.email}`);
            return savedUser;
        } catch (error) {
            this.logger.error(`User creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        try {
            return await this.userModel.findOne({ email }).lean();
        } catch (error) {
            this.logger.error(`Find by email failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    async findById(userId: string): Promise<UserDocument | null> {
        try {
            return await this.userModel.findById(userId).lean();
        } catch (error) {
            this.logger.error(`Find by ID failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    async validateUserById(userId: string): Promise<UserDocument | null> {
        try {
            // This method is used by AuthService to validate a user by ID.
            // It should return the user document if found, or null otherwise.
            return await this.userModel.findById(userId).lean();
        } catch (error) {
            this.logger.error(`Validate user by ID failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    async userExists(email: string): Promise<boolean> {
        try {
            const user = await this.userModel.findOne({ email }).lean();
            return !!user;
        } catch (error) {
            this.logger.error(`Check user existence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    // 🎯 사용자 프로필은 캐시 우선, MongoDB 백업
    async getProfile(userId: string) {
        try {
            // 1. 캐시에서 먼저 확인
            const cachedProfile = await this.getCachedProfile(userId);
            if (cachedProfile) {
                return cachedProfile;
            }

            // 2. MongoDB에서 조회
            const user = await this.userModel.findById(userId).select('-password').lean();
            if (!user) {
                throw new Error('User not found');
            }

            const profile = {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                allergies: user.settings?.allergies || [],
                cookingLevel: user.settings?.cookingLevel || '초급',
                preferences: user.settings?.preferences || [],
                loginCount: user.loginCount,
                lastLoginAt: user.lastLoginAt,
            };

            // 3. 캐시에 저장 (1시간)
            await this.cacheService.set(
                `profile:${userId}`,
                JSON.stringify(profile),
                3600
            );

            return profile;
        } catch (error) {
            this.logger.error(`Get profile failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // 🎯 설정 업데이트는 캐시 우선, MongoDB 비동기
    async updateSettings(userId: string, settings: {
        allergies?: string[];
        preferences?: string[];
        cookingLevel?: string;
        language?: string;
    }) {
        try {
            // 1. 캐시 즉시 업데이트
            await this.cacheUserSettings(userId, settings);

            // 2. MongoDB 비동기 업데이트 (await 안함)
            await this.userModel.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        'settings': settings as {
                            allergies?: string[];
                            preferences?: string[];
                            cookingLevel?: string;
                            language?: string;
                        },
                        updatedAt: new Date()
                    }
                }
            ).exec().catch(error => {
                this.logger.error(`MongoDB settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            });

            // 3. 프로필 캐시 무효화
            await this.cacheService.del(`profile:${userId}`);

            this.logger.log(`✅ Settings updated for user: ${userId}`);
            return { success: true };
        } catch (error) {
            this.logger.error(`Update settings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // 🎯 로그인 통계만 MongoDB에 저장
    async updateLoginStats(userId: string) {
        try {
            // MongoDB 업데이트 (비동기, 실패해도 무시)
            await this.userModel.findByIdAndUpdate(
                userId,
                {
                    $inc: { loginCount: 1 },
                    $set: { lastLoginAt: new Date() }
                }
            ).exec().catch(error => {
                this.logger.warn(`Login stats update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            });

            this.logger.log(`📊 Login stats updated: ${userId}`);
        } catch (error) {
            // 로그인 통계 실패는 무시
            this.logger.warn(`Login stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ================== 캐시 우선 메서드들 ==================

    private async getCachedProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        allergies: string[];
        cookingLevel: string;
        preferences: string[];
        loginCount: number;
        lastLoginAt?: Date;
    } | null> {
        try {
            const cached = await this.cacheService.get(`profile:${userId}`);
            if (!cached) return null;
            
            // CacheService가 이미 JSON.parse를 해주므로 추가 파싱 불필요
            if (typeof cached === 'string') {
                return JSON.parse(cached) as {
                    id: string;
                    email: string;
                    name: string;
                    allergies: string[];
                    cookingLevel: string;
                    preferences: string[];
                    loginCount: number;
                    lastLoginAt?: Date;
                };
            } else {
                return cached as {
                    id: string;
                    email: string;
                    name: string;
                    allergies: string[];
                    cookingLevel: string;
                    preferences: string[];
                    loginCount: number;
                    lastLoginAt?: Date;
                };
            }
        } catch (error: unknown) {
            this.logger.warn(`Failed to get cached profile: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    private async cacheUserSettings(userId: string, settings: {
        allergies?: string[];
        preferences?: string[];
        cookingLevel?: string;
        language?: string;
    }): Promise<void> {
        try {
            await this.cacheService.set(
                `settings:${userId}`,
                JSON.stringify(settings),
                7200 // 2시간
            );
        } catch (error) {
            this.logger.warn(`Settings cache failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getUserSettings(userId: string): Promise<{
        allergies?: string[];
        preferences?: string[];
        cookingLevel?: string;
        language?: string;
    }> {
        try {
            // 1. 캐시 우선
            const cached = await this.cacheService.get(`settings:${userId}`);
            if (cached) {
                return JSON.parse(cached) as {
                    allergies?: string[];
                    preferences?: string[];
                    cookingLevel?: string;
                    language?: string;
                };
            }

            // 2. MongoDB 백업
            const user = await this.userModel.findById(userId).select('settings').lean();
            const settings = user?.settings || {};

            // 3. 캐시에 저장
            await this.cacheUserSettings(userId, settings);

            return settings;
        } catch (error) {
            this.logger.error(`Get settings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {};
        }
    }


    // ================== Controller에서 요구하는 메서드들 ==================

    async updateProfile(userId: string, updateProfileDto: { name?: string; settings?: Record<string, unknown> }) {
        try {
            const updateData = {
                ...(updateProfileDto.name && { name: updateProfileDto.name }),
                ...(updateProfileDto.settings && { 'settings': updateProfileDto.settings }),
                updatedAt: new Date()
            };

            await this.userModel.findByIdAndUpdate(userId, { $set: updateData });
            
            // 프로필 캐시 무효화
            await this.cacheService.del(`profile:${userId}`);
            
            return { success: true, message: 'Profile updated successfully' };
        } catch (error) {
            this.logger.error(`Update profile failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async getAllergies(userId: string) {
        try {
            const settings = await this.getUserSettings(userId);
            return {
                success: true,
                allergies: settings.allergies || []
            };
        } catch (error) {
            this.logger.error(`Get allergies failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async updateAllergies(userId: string, allergiesDto: { allergies: string[] }) {
        try {
            const settings = await this.getUserSettings(userId);
            const updatedSettings = {
                ...settings,
                allergies: allergiesDto.allergies
            };
            
            await this.updateSettings(userId, updatedSettings);
            
            return {
                success: true,
                message: 'Allergies updated successfully',
                allergies: allergiesDto.allergies
            };
        } catch (error) {
            this.logger.error(`Update allergies failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async updateCookingPreferences(userId: string, preferencesDto: { cookingLevel?: string; preferences?: string[] }) {
        try {
            const settings = await this.getUserSettings(userId);
            const updatedSettings = {
                ...settings,
                cookingLevel: preferencesDto.cookingLevel || settings.cookingLevel,
                preferences: preferencesDto.preferences || settings.preferences
            };
            
            await this.updateSettings(userId, updatedSettings);
            
            return {
                success: true,
                message: 'Cooking preferences updated successfully',
                settings: updatedSettings
            };
        } catch (error) {
            this.logger.error(`Update cooking preferences failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

}