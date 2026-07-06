import { Injectable } from '@nestjs/common';
import { LlmProvider, LlmRequest, LlmResult } from './llm-provider';

/**
 * Adapter Google Gemini (free tier — docs/00). REST puro, sem SDK.
 * Modelo: gemini-2.0-flash (function calling + português excelente).
 */
@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  async complete(request: LlmRequest): Promise<LlmResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      tools: [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ],
      generationConfig: { temperature: request.temperature ?? 0.1, maxOutputTokens: 1024 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      candidates?: {
        content?: {
          parts?: {
            text?: string;
            functionCall?: { name: string; args: Record<string, unknown> };
          }[];
        };
      }[];
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return {
      text:
        parts
          .map((p) => p.text)
          .filter(Boolean)
          .join('\n') || undefined,
      toolCalls: parts
        .filter((p) => p.functionCall)
        .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
    };
  }
}
