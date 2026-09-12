/** Minimal typings for the subset of the Gemini generateContent REST API we use. */

export interface GeminiSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';
  description?: string;
  enum?: string[];
  nullable?: boolean;
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
}

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

export interface GeminiGenerateContentRequest {
  systemInstruction: { parts: GeminiContentPart[] };
  contents: GeminiContent[];
  generationConfig: {
    responseMimeType: 'application/json';
    responseSchema: GeminiSchema;
    temperature?: number;
  };
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: GeminiContentPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}
