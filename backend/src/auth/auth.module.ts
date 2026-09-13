import { Global, Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppConfigService } from '../config/app-config.service.js';
import { AUTH_INSTANCE } from './auth.constants.js';
import { AuthGuard } from './auth.guard.js';
import { createAuthInstance } from './auth.instance.js';

@Global()
@Module({
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [getConnectionToken(), AppConfigService],
      useFactory: (connection: Connection, appConfig: AppConfigService) =>
        createAuthInstance(connection.getClient().db(), appConfig),
    },
    AuthGuard,
  ],
  exports: [AUTH_INSTANCE, AuthGuard],
})
export class AuthModule {}
