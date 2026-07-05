// Porta da IA (Strategy — docs/07). O domínio nunca vê SDK de provedor.

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDef[];
  temperature?: number;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LlmResult {
  text?: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
