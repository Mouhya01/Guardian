import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service.js';

@Module({
  imports: [HttpModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
