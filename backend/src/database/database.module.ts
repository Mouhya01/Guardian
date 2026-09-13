import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../config/app-config.service.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        if (!appConfig.mongodbUri) {
          throw new Error('MONGODB_URI is not configured. Set it in backend/.env before starting the server.');
        }
        return { uri: appConfig.mongodbUri };
      },
    }),
  ],
})
export class DatabaseModule {}
