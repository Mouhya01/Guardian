import type { HttpService } from '@nestjs/axios';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { defer, map, of, throwError, timer } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { GeminiService } from './gemini.service.js';

function makeAppConfig(overrides: Partial<AppConfigService> = {}): AppConfigService {
  return {
    geminiApiKey: 'test-key',
    geminiApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    geminiModel: 'gemini-flash-latest',
    geminiTimeoutMs: 5000,
    geminiMaxRetries: 1,
    ...overrides,
  } as AppConfigService;
}

const validGeminiPayload = {
  summary: 'One hardcoded secret found.',
  overallRiskLevel: 'HIGH',
  findings: [
    {
      severity: 'HIGH',
      filePath: 'src/config.js',
      title: 'Hardcoded API key',
      description: 'An API key is committed in plaintext.',
      remediation: 'Move the key to an environment variable.',
    },
  ],
};

function successResponse(payload: unknown) {
  return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } };
}

describe('GeminiService', () => {
  let httpService: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpService = { post: vi.fn() };
  });

  it('fails fast without calling the API when no key is configured', async () => {
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig({ geminiApiKey: undefined }));

    await expect(service.analyze([])).rejects.toThrow(ServiceUnavailableException);
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('returns a validated result on a successful call', async () => {
    httpService.post.mockReturnValue(of(successResponse(validGeminiPayload)));
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig());

    const result = await service.analyze([{ path: 'src/config.js', content: 'const key = "AKIA...";', sizeBytes: 20 }]);

    expect(result.summary).toBe(validGeminiPayload.summary);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].filePath).toBe('src/config.js');
  });

  it('sends the API key in a header, not the URL', async () => {
    httpService.post.mockReturnValue(of(successResponse(validGeminiPayload)));
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig());

    await service.analyze([]);

    const [url, , config] = httpService.post.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect(config.headers['x-goog-api-key']).toBe('test-key');
  });

  it('throws BadGatewayException when Gemini returns invalid JSON', async () => {
    httpService.post.mockReturnValue(
      of({ data: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] } }),
    );
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig());

    await expect(service.analyze([])).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when the JSON does not match the expected schema', async () => {
    httpService.post.mockReturnValue(of(successResponse({ summary: 'ok' })));
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig());

    await expect(service.analyze([])).rejects.toThrow(BadGatewayException);
  });

  it('does not retry a 401 auth error', async () => {
    let attempts = 0;
    httpService.post.mockReturnValue(
      defer(() => {
        attempts++;
        return throwError(() => ({ response: { status: 401 } }));
      }),
    );
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig({ geminiMaxRetries: 2 }));

    await expect(service.analyze([])).rejects.toThrow(ServiceUnavailableException);
    expect(attempts).toBe(1);
  });

  it('retries a transient 500 error up to the configured limit, then fails', async () => {
    let attempts = 0;
    httpService.post.mockReturnValue(
      defer(() => {
        attempts++;
        return throwError(() => ({ response: { status: 500 } }));
      }),
    );
    const service = new GeminiService(httpService as unknown as HttpService, makeAppConfig({ geminiMaxRetries: 1 }));

    await expect(service.analyze([])).rejects.toThrow(ServiceUnavailableException);
    expect(attempts).toBe(2);
  }, 10000);

  it('throws ServiceUnavailableException when the call exceeds the configured timeout', async () => {
    httpService.post.mockReturnValue(timer(200).pipe(map(() => successResponse(validGeminiPayload))));
    const service = new GeminiService(
      httpService as unknown as HttpService,
      makeAppConfig({ geminiTimeoutMs: 20, geminiMaxRetries: 0 }),
    );

    await expect(service.analyze([])).rejects.toThrow(ServiceUnavailableException);
  }, 10000);
});
