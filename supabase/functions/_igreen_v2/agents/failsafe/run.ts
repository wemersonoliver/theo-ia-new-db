// Failsafe specialist (D10). Acionado em supervisor:failsafe, timeout,
// throw do specialist ou guardrail catastrófico.

import type { AgentContext, AgentResult } from "../_types.ts";

export async function runFailsafe(ctx: AgentContext): Promise<AgentResult> {
  // Failsafe técnico (timeout/erro/exception do specialist) NÃO deve ativar
  // handoff humano automático — isso travava a conversa em bypass eterno
  // no fast-path (handoff_ativo=true). Só faz handoff real quando o supervisor
  // pediu explicitamente (intent !== "error"/"timeout") ou quando não há intent
  // (chamada legada direta).
  const intent = (ctx?.intent ?? "").toLowerCase();
  const isTechnical = intent === "error" || intent === "timeout";

  if (isTechnical) {
    return {
      // Resposta neutra para o cliente; sem disparar handoff_triggered automation.
      messages: [
        "Tive uma instabilidade rápida aqui. Pode repetir sua última mensagem, por favor?",
      ],
      events: [],
      tool_calls: [],
      // Limpa o specialist para a próxima mensagem ser re-roteada normalmente.
      suggested_state_patch: {
        specialist: null as unknown as undefined,
      },
    };
  }

  return {
    messages: [
      "Só um instante, vou te transferir para um atendente humano para continuar o seu atendimento.",
    ],
    events: [
      {
        type: "failsafe_triggered",
        priority: "critical",
        source: "specialist",
        payload: {},
      },
    ],
    tool_calls: [],
    suggested_state_patch: {
      handoff_ativo: true,
      specialist: "failsafe",
    },
  };
}