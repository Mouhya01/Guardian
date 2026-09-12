import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AxiosError } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { catchError, firstValueFrom, retry, throwError, timeout, timer } from 'rxjs';
import { AppConfigService } from '../config/app-config.service.js';
import type { NormalizedFile } from '../audit/audit.types.js';
import { GEMINI_RESPONSE_SCHEMA, GEMINI_SYSTEM_PROMPT } from './gemini.constants.js';
import { GeminiAnalysisResultDto } from './dto/gemini-analysis-result.dto.js';
import type { GeminiGenerateContentRequest, GeminiGenerateContentResponse } from './gemini.types.js';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfigService,
  ) {}

  async analyze(files: NormalizedFile[]): Promise<GeminiAnalysisResultDto> {
    const apiKey = this.appConfig.geminiApiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Gemini API key is not configured. Set GEMINI_API_KEY in backend/.env and restart the server.',
      );
    }

    const requestBody = this.buildRequest(files);
    const url = `${this.appConfig.geminiApiEndpoint}/models/${this.appConfig.geminiModel}:generateContent`;
    const maxRetries = this.appConfig.geminiMaxRetries;
    const timeoutMs = this.appConfig.geminiTimeoutMs;

    const response = await firstValueFrom(
      this.httpService
        .post<GeminiGenerateContentResponse>(url, requestBody, {
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          timeout: timeoutMs,
        })
        .pipe(
          timeout(timeoutMs),
          retry({
            count: maxRetries,
            delay: (error: unknown, retryCount: number) => {
              if (!this.isRetryable(error)) {
                return throwError(() => error);
              }
              const backoffMs = 500 * 2 ** (retryCount - 1);
              this.logger.warn(`Gemini call failed (attempt ${retryCount}/${maxRetries}) — retrying in ${backoffMs}ms`);
              return timer(backoffMs);
            },
          }),
          catchError((error: unknown) => throwError(() => this.toHttpException(error))),
        ),
    );

    return this.parseResponse(response.data);
  }

  private buildRequest(files: NormalizedFile[]): GeminiGenerateContentRequest {
    const intro = {
      text: `Analyze the following ${files.length} file(s) from a single project, collectively.`,
    };
    // Each file is its own content part, clearly delimited, so its contents are
    // never confused with the surrounding instructions (see system prompt).
    const fileParts = files.map((file) => ({
      text: `--- FILE: ${file.path} ---\n${file.content}\n--- END FILE: ${file.path} ---`,
    }));

    return {
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [intro, ...fileParts] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    };
  }

  /** Network errors and Gemini's own rate-limit/5xx responses are worth retrying; bad requests and auth failures are not. */
  private isRetryable(error: unknown): boolean {
    const status = (error as AxiosError)?.response?.status;
    if (status === undefined) {
      return true;
    }
    return status === 429 || status >= 500;
  }

  private toHttpException(error: unknown): Error {
    const axiosError = error as AxiosError<{ error?: { message?: string } }>;
    const status = axiosError?.response?.status;
    const upstreamMessage = axiosError?.response?.data?.error?.message;

    this.logger.error(`Gemini API call failed${status ? ` (status ${status})` : ''}: ${axiosError?.message ?? String(error)}`);

    if (status === 400 || status === 401 || status === 403) {
      return new ServiceUnavailableException(
        'Gemini API rejected the request — check that GEMINI_API_KEY is valid and has access to the configured model.',
      );
    }
    if (status === 429) {
      return new ServiceUnavailableException('Gemini API rate limit reached. Please retry shortly.');
    }
    return new ServiceUnavailableException(upstreamMessage ?? 'Gemini API is currently unavailable. Please retry shortly.');
  }

  private async parseResponse(data: GeminiGenerateContentResponse): Promise<GeminiAnalysisResultDto> {
    if (data.promptFeedback?.blockReason) {
      throw new BadGatewayException(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new BadGatewayException('Gemini returned an empty response.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadGatewayException('Gemini returned a response that was not valid JSON.');
    }

    const result = plainToInstance(GeminiAnalysisResultDto, parsed);
    const errors = await validate(result, { whitelist: true });
    if (errors.length > 0) {
      this.logger.error(`Gemini response failed schema validation: ${JSON.stringify(errors)}`);
      throw new BadGatewayException('Gemini returned a response that did not match the expected report structure.');
    }

    return result;
  }
}
