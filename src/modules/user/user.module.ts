import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserSchema } from './user.schema';
import { TrialChef, TrialChefSchema } from './trial-chef.schema';
import { TrialChefService } from './trial-chef.service';
import { UserStatus, UserStatusSchema } from './user-status.schema';
import { UserStatusService } from './user-status.service';
import { UserStatusController } from './user-status.controller';
import { UserBehavior, UserBehaviorSchema } from './user-behavior.schema';
import { UserPersonalizationService } from './user-personalization.service';
import { PersonalizationController } from './personalization.controller';
import { CacheModule } from '../cache/cache.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: TrialChef.name, schema: TrialChefSchema },
            { name: UserStatus.name, schema: UserStatusSchema },
            { name: UserBehavior.name, schema: UserBehaviorSchema }
        ]),
        CacheModule,
        ElasticsearchModule,
    ],
    controllers: [UserController, UserStatusController, PersonalizationController],
    providers: [UserService, TrialChefService, UserStatusService, UserPersonalizationService],
    exports: [UserService, TrialChefService, UserStatusService, UserPersonalizationService, MongooseModule],
})
export class UserModule {}