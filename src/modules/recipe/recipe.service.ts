import { Injectable } from '@nestjs/common';

@Injectable()
export class RecipeService {
  // 현재는 사용하지 않지만 향후 확장을 위해 유지
  async getBasicInfo() {
    return {
      message: 'Recipe service is running',
      version: '1.0.0'
    };
  }
}
