import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { TEST_MONGODB_URI, useTestDatabase } from './test-env.js';

useTestDatabase();

// AppModule now hard-depends on a real MongoDB connection (Better Auth + audit
// history persistence) — see test-env.ts for how to enable this suite.
describe.skipIf(!TEST_MONGODB_URI)('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
