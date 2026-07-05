import { Injectable } from '@nestjs/common';
import { LlmProvider, LlmRequest, LlmResult } from './llm-provider';

/**
 * Adapter Groq (grátis, ultrarrápido — docs/00). API compatível com OpenAI.
 * Modelo: llama-3.3-70b-versatile.
 */
@Injectable()
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  private readonly model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

  async complete(request: LlmRequest): Promise<LlmResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY não configurada');

    const body = {
      model: this.model,
      temperature: request.temperature ?? 0.1,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: request.system },
        ...request.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      tools: request.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
          tool_calls?: { function: { name: string; arguments: string } }[];
        };
      }[];
    };

    const message = data.choices?.[0]?.message;
    return {
      text: message?.content || undefined,
      toolCalls: (message?.tool_calls ?? []).map((tc) => ({
        name: tc.function.name,
        args: safeParse(tc.function.arguments),
      })),
    };
  }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
