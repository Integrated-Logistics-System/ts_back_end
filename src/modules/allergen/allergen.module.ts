// src/modules/allergen/allergen.module.ts (간단한 상수 데이터 제공용)
import { Module } from '@nestjs/common';
import { AllergenController } from './allergen.controller';

@Module({
  controllers: [AllergenController],
  providers: [],
  exports: [],
})
export class AllergenModule {}
