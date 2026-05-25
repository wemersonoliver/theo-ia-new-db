import type { IgreenConversationState, ToolResult } from "../types.ts";

export interface ToolContext {
  account_id: string;
  phone: string;
  state: IgreenConversationState;
  message?: string;
  correlation_id?: string | null;
  media?: { url: string; mime_type: string; byte_size: number } | null;
}

export interface ToolDefinition<Args = Record<string, unknown>> {
  name: string;
  description: string;
  /** Chave de idempotência derivada dos args (D4). */
  idempotencyKey: (args: Args, ctx: ToolContext) => string;
  /** Validação leve (lança Error se inválido). */
  validate?: (args: unknown) => Args;
  execute: (ctx: ToolContext, args: Args) => Promise<ToolResult>;
}