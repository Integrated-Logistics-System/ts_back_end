import { MongooseModuleOptions } from '@nestjs/mongoose';

export interface DatabaseOptionsInterface {
    uri?: string;
    retryWrites?: boolean;
    retryReads?: boolean;
    connectTimeoutMS?: number;
    socketTimeoutMS?: number;
    mongooseOptions?: Partial<MongooseModuleOptions>;
}