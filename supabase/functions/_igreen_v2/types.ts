// Igreen V2 — tipos compartilhados
// Contratos centrais usados por tools, automações, state-engine e specialists.

export type EventPriority = "low" | "medium" | "high" | "critical";
export type TraceLevel = "minimal" | "standard" | "debug";

export interface IgreenEvent {
  type: string;
  priority?: EventPriority;
  payload?: Record<string, unknown>;
  source?: "supervisor" | "specialist" | "tool" | "automation" | "fast_path" | "state_engine";
}

/**
 * D14: nenhuma tool altera estado diretamente.
 * Toda tool retorna ToolResult; apenas state-engine/update.ts aplica suggested_state_patch.
 */
export interface ToolResult {
  success: boolean;
  events?: IgreenEvent[];
  suggested_state_patch?: Partial<IgreenConversationState>;
  data?: Record<string, unknown>;
  error?: string | null;
  skipped?: boolean;
  skip_reason?: string;
}

/**
 * D15: toda automação retorna AutomationResult.
 * Idempotência é garantida via automations/_idempotency.ts.
 */
export interface AutomationResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  events?: IgreenEvent[];
  suggested_state_patch?: Partial<IgreenConversationState>;
  error?: string | null;
}

export interface IgreenConversationState {
  id?: string;
  account_id: string;
  phone: string;
  produto?: string | null;
  etapa_funil?: string | null;
  specialist?: string | null;
  intent?: string | null;
  handoff_ativo?: boolean;
  fatura_valida?: boolean | null;
  identidade_validada?: boolean | null;
  holder_match?: boolean | null;
  lead_score?: number;
  lead_temperature?: string | null;
  extras?: Record<string, unknown>;
  version?: number;
  last_event_at?: string;
  created_at?: string;
  updated_at?: string;
}