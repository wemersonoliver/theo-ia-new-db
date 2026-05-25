// Contrato obrigatório de qualquer specialist (Fase 3+).
// Proibido `return string`. Mesmo "olá" passa pelo AgentResult.

import type { IgreenConversationState, IgreenEvent } from "../types.ts";

export interface AgentToolCall {
  name: string;
  args: unknown;
}

export interface AgentResult {
  messages: string[];
  events: IgreenEvent[];
  tool_calls: AgentToolCall[];
  suggested_state_patch: Partial<IgreenConversationState>;
}

export interface AgentContext {
  account_id: string;
  phone: string;
  state: IgreenConversationState;
  message: string;
  intent?: string;
  correlation_id?: string | null;
  media?: { url: string; mime_type: string; byte_size: number } | null;
}

export type AgentRunner = (ctx: AgentContext) => Promise<AgentResult>;

export const EMPTY_RESULT: AgentResult = {
  messages: [],
  events: [],
  tool_calls: [],
  suggested_state_patch: {},
};