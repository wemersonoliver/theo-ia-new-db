// Failsafe specialist (D10). Acionado em supervisor:failsafe, timeout,
// throw do specialist ou guardrail catastrófico.

import type { AgentContext, AgentResult } from "../_types.ts";

export async function runFailsafe(_ctx: AgentContext): Promise<AgentResult> {
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