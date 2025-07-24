// 고급 에러 처리 모듈
import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AdvancedErrorHandlerService } from './advanced-error-handler.service';
import { ErrorMonitoringService } from './error-monitoring.service';
import { GlobalExceptionFilter } from './global-exception.filter';
import { CacheModule } from '../../modules/cache/cache.module';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CacheModule,
  ],
  providers: [
    AdvancedErrorHandlerService,
    ErrorMonitoringService,
    GlobalExceptionFilter,
  ],
  exports: [
    AdvancedErrorHandlerService,
    ErrorMonitoringService,
  ],
})
export class ErrorHandlingModule {}