// Qualifier Specialist — descoberta + menu de produtos.
// 100% determinístico: sem LLM, sem latência.

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideQualifierStage, type QualifierStage } from "./stages.ts";
import {
  buildGreetOpenText, buildMenuText, buildMenuTextChunks, buildRouteGreenText,
  MENU_SHORT_TEXT,
  ROUTE_TELECOM_TEXT, ROUTE_EXPANSAO_TEXT,
} from "./prompt.ts";

export async function runQualifier(ctx: AgentContext): Promise<AgentResult> {
  const extras = (ctx.state.extras ?? {}) as Record<string, unknown>;
  const stage = decideQualifierStage(ctx.state, ctx.message);

  const events: AgentResult["events"] = [
    { type: "qualifier_stage_decided", priority: "low", source: "specialist", payload: { stage } },
  ];
  const tool_calls: AgentResult["tool_calls"] = [];
  const patch: AgentResult["suggested_state_patch"] = {};
  let text = "";
  let messages: string[] | null = null;

  switch (stage as QualifierStage) {
    case "greet_open": {
      // Envia saudação + menu juntos (em chunks separados).
      messages = [buildGreetOpenText(), ...buildMenuTextChunks(null)];
      patch.extras = { ...extras, greeted: true, menu_presented: true };
      break;
    }
    case "present_menu": {
      messages = buildMenuTextChunks(null);
      patch.extras = { ...extras, menu_presented: true };
      break;
    }
    case "menu_repeat": {
      const repeats = Number(extras.menu_repeats ?? 0);
      text = repeats >= 1
        ? "Pra te direcionar certo, me diz só o número: 1, 2 ou 3?"
        : MENU_SHORT_TEXT;
      patch.extras = { ...extras, menu_repeats: repeats + 1 };
      break;
    }
    case "route_green": {
      text = buildRouteGreenText(null);
      patch.produto = "green";
      (patch as any).specialist = "green";
      patch.etapa_funil = "qualificacao";
      patch.extras = {
        ...extras,
        greeted: true,
        menu_presented: extras.menu_presented ?? false,
        product_choice: "green",
        explained: true,
        solution_confirmed: true,
        estado_asked: true,
      };
      tool_calls.push({ name: "set_product", args: { produto: "green" } });
      tool_calls.push({ name: "set_stage", args: { etapa: "qualificacao" } });
      events.push({ type: "product_chosen", priority: "medium", source: "specialist", payload: { product: "green" } });
      break;
    }
    case "route_telecom": {
      text = ROUTE_TELECOM_TEXT;
      patch.produto = "telecom";
      (patch as any).specialist = "telecom";
      patch.extras = { ...extras, greeted: true, product_choice: "telecom" };
      tool_calls.push({ name: "set_product", args: { produto: "telecom" } });
      events.push({ type: "product_chosen", priority: "medium", source: "specialist", payload: { product: "telecom" } });
      break;
    }
    case "route_expansao": {
      text = ROUTE_EXPANSAO_TEXT;
      patch.produto = "expansao";
      (patch as any).specialist = "expansao";
      patch.extras = { ...extras, greeted: true, product_choice: "expansao" };
      tool_calls.push({ name: "set_product", args: { produto: "expansao" } });
      events.push({ type: "product_chosen", priority: "medium", source: "specialist", payload: { product: "expansao" } });
      break;
    }
    default: {
      messages = [buildGreetOpenText(), ...buildMenuTextChunks(null)];
      patch.extras = { ...extras, greeted: true, menu_presented: true };
    }
  }

  return {
    messages: messages ?? (text ? [text] : []),
    events,
    tool_calls,
    suggested_state_patch: patch,
  };
}