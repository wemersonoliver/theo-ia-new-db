// Qualifier Specialist — descoberta + menu de produtos.
// 100% determinístico: sem LLM, sem latência.

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideQualifierStage, extractFirstName, detectProductMention, type QualifierStage } from "./stages.ts";
import {
  buildGreetOpenText, buildMenuText, buildRouteGreenText,
  MENU_SHORT_TEXT,
  ROUTE_TELECOM_TEXT, ROUTE_EXPANSAO_TEXT,
  ASK_NAME_TEXT, ASK_NAME_AFTER_PRODUCT_TEXT,
} from "./prompt.ts";

export async function runQualifier(ctx: AgentContext): Promise<AgentResult> {
  const extras = (ctx.state.extras ?? {}) as Record<string, unknown>;
  let stage = decideQualifierStage(ctx.state, ctx.message);

  const events: AgentResult["events"] = [
    { type: "qualifier_stage_decided", priority: "low", source: "specialist", payload: { stage } },
  ];
  const tool_calls: AgentResult["tool_calls"] = [];
  const patch: AgentResult["suggested_state_patch"] = {};
  let text = "";

  // Captura espontânea de nome em qualquer turno do qualifier.
  const capturedName = !extras.client_name ? extractFirstName(ctx.message) : null;
  if (capturedName) {
    patch.extras = { ...extras, client_name: capturedName };
    tool_calls.push({
      name: "save_green_lead_field",
      args: { field: "nome_cliente", value: capturedName },
    });
    // Se capturamos nome E o cliente já citou um produto, podemos rotear direto.
    if (stage === "ask_name") {
      const hint = detectProductMention(ctx.message);
      if (hint === "green") stage = "route_green";
      else if (hint === "telecom") stage = "route_telecom";
      else if (hint === "expansao") stage = "route_expansao";
      else stage = "present_menu";
    }
  }

  switch (stage as QualifierStage) {
    case "greet_open": {
      text = buildGreetOpenText();
      patch.extras = { ...extras, greeted: true };
      break;
    }
    case "ask_name": {
      // Se cliente já citou produto sem nome, usa template com reconhecimento.
      const hint = detectProductMention(ctx.message);
      text = hint ? ASK_NAME_AFTER_PRODUCT_TEXT : ASK_NAME_TEXT;
      patch.extras = { ...extras, name_asked: true };
      break;
    }
    case "present_menu": {
      // Usa nome capturado nesta rodada (capturedName) ou já em extras.
      const nome = (patch.extras as Record<string, unknown> | undefined)?.client_name
        ?? extras.client_name
        ?? null;
      text = buildMenuText(typeof nome === "string" ? nome : null);
      patch.extras = { ...(patch.extras as object ?? extras), menu_presented: true };
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
      const nome = (patch.extras as Record<string, unknown> | undefined)?.client_name
        ?? extras.client_name
        ?? null;
      text = buildRouteGreenText(typeof nome === "string" ? nome : null);
      patch.produto = "green";
      (patch as any).specialist = "green";
      patch.extras = {
        ...(patch.extras as object ?? extras),
        greeted: true,
        menu_presented: extras.menu_presented ?? false,
        product_choice: "green",
        explained: true,
      };
      tool_calls.push({ name: "set_product", args: { produto: "green" } });
      events.push({ type: "product_chosen", priority: "standard", source: "specialist", payload: { product: "green" } });
      break;
    }
    case "route_telecom": {
      text = ROUTE_TELECOM_TEXT;
      patch.produto = "telecom";
      (patch as any).specialist = "telecom";
      patch.extras = { ...(patch.extras as object ?? extras), greeted: true, product_choice: "telecom" };
      tool_calls.push({ name: "set_product", args: { produto: "telecom" } });
      events.push({ type: "product_chosen", priority: "standard", source: "specialist", payload: { product: "telecom" } });
      break;
    }
    case "route_expansao": {
      text = ROUTE_EXPANSAO_TEXT;
      patch.produto = "expansao";
      (patch as any).specialist = "expansao";
      patch.extras = { ...(patch.extras as object ?? extras), greeted: true, product_choice: "expansao" };
      tool_calls.push({ name: "set_product", args: { produto: "expansao" } });
      events.push({ type: "product_chosen", priority: "standard", source: "specialist", payload: { product: "expansao" } });
      break;
    }
    default: {
      text = buildGreetOpenText();
      patch.extras = { ...extras, greeted: true };
    }
  }

  return {
    messages: text ? [text] : [],
    events,
    tool_calls,
    suggested_state_patch: patch,
  };
}