import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskLevel } from '../src/audit/dto/risk-level.enum.js';
import { Severity } from '../src/audit/dto/severity.enum.js';
import { GeminiService } from '../src/gemini/gemini.service.js';
import { AppModule } from '../src/app.module.js';

const mockAnalysis = {
  summary: 'Mocked analysis for e2e testing.',
  overallRiskLevel: RiskLevel.LOW,
  findings: [
    {
      severity: Severity.LOW,
      filePath: 'a.js',
      title: 'Mock finding',
      description: 'Mock description.',
      remediation: 'Mock remediation.',
    },
  ],
};

/** Boots a full app from AppModule (real middleware, filters, pipes) with GeminiService stubbed. */
async function buildApp(geminiOverride: Partial<GeminiService>): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GeminiService)
    .useValue(geminiOverride)
    .compile();

  const app = moduleFixture.createNestApplication<App>();
  app.use(helmet());
  app.enableCors({ origin: ['http://localhost:3001'], credentials: true });
  await app.init();
  return app;
}

describe('Audit (e2e)', () => {
  let app: INestApplication<App>;
  let geminiService: { analyze: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    geminiService = { analyze: vi.fn().mockResolvedValue(mockAnalysis) };
    app = await buildApp(geminiService as unknown as Partial<GeminiService>);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an empty upload with the standardized error shape', async () => {
    const res = await request(app.getHttpServer()).post('/audit').expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', path: '/audit' });
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('rejects a binary file', async () => {
    const res = await request(app.getHttpServer())
      .post('/audit')
      .attach('files', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), 'image.png')
      .expect(400);

    expect(res.body.message).toContain('binary content is not supported');
  });

  it('runs a full audit for a valid file and returns 200 with the report shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/audit')
      .attach('files', Buffer.from('console.log(1);'), 'a.js')
      .expect(200);

    expect(res.body.summary).toBe(mockAnalysis.summary);
    expect(res.body.filesAnalyzed).toEqual(['a.js']);
    expect(geminiService.analyze).toHaveBeenCalledTimes(1);
  });

  it('maps an unexpected failure to a generic 500 without leaking internal details', async () => {
    geminiService.analyze.mockRejectedValueOnce(new Error('ENOENT: C:/Guardian/backend/.env'));

    const res = await request(app.getHttpServer())
      .post('/audit')
      .attach('files', Buffer.from('x'), 'a.js')
      .expect(500);

    expect(res.body.message).not.toContain('ENOENT');
    expect(res.body.message).not.toContain('.env');
    expect(res.body).toMatchObject({ statusCode: 500, error: 'Internal Server Error' });
  });

  it('sends restrictive security headers on every response', async () => {
    const res = await request(app.getHttpServer()).get('/');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('only allows the configured CORS origin', async () => {
    const allowed = await request(app.getHttpServer()).get('/').set('Origin', 'http://localhost:3001');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    const blocked = await request(app.getHttpServer()).get('/').set('Origin', 'http://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits repeated /audit requests and sets Retry-After', async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await request(app.getHttpServer()).post('/audit');
    }

    expect(last?.status).toBe(429);
    expect(last?.headers['retry-after']).toBeDefined();
    expect(last?.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
  }, 20000);
});

describe('Audit (e2e) — configurable limits', () => {
  it('rejects a request with more files than AUDIT_MAX_FILES_PER_REQUEST', async () => {
    process.env.AUDIT_MAX_FILES_PER_REQUEST = '2';
    let app: INestApplication<App> | undefined;
    try {
      app = await buildApp({ analyze: vi.fn().mockResolvedValue(mockAnalysis) } as unknown as Partial<GeminiService>);
      let req = request(app.getHttpServer()).post('/audit');
      for (let i = 0; i < 3; i++) {
        req = req.attach('files', Buffer.from('x'), `file${i}.js`);
      }
      const res = await req;
      expect(res.status).toBe(400);
    } finally {
      delete process.env.AUDIT_MAX_FILES_PER_REQUEST;
      await app?.close();
    }
  });

  it('rejects a request whose aggregate size exceeds AUDIT_MAX_TOTAL_PAYLOAD_BYTES', async () => {
    process.env.AUDIT_MAX_TOTAL_PAYLOAD_BYTES = '100';
    let app: INestApplication<App> | undefined;
    try {
      app = await buildApp({ analyze: vi.fn().mockResolvedValue(mockAnalysis) } as unknown as Partial<GeminiService>);
      const res = await request(app.getHttpServer())
        .post('/audit')
        .attach('files', Buffer.alloc(80, 'a'), 'a.js')
        .attach('files', Buffer.alloc(80, 'b'), 'b.js');
      expect(res.status).toBe(413);
    } finally {
      delete process.env.AUDIT_MAX_TOTAL_PAYLOAD_BYTES;
      await app?.close();
    }
  });
});
