// Green Specialist — versão minimalista (Fase 3).
// Cobre: descoberta → vídeo → qualificação simples → solicitar fatura.
// LLM só preenche texto curto. Stage e tool_calls são decididos em código (D1).

import type { AgentContext, AgentResult } from "../_types.ts";
import { decideGreenStage, isAffirmation, detectFaqTopic, detectOutOfScope, isGenericObjection, detectVoiceVideoChannel } from "./stages.ts";
import { GREEN_SYSTEM, HOLDER_GUARD, buildGreenUserPrompt } from "./prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openAITextFallback, isProviderOutOfCredits, markProviderOutOfCredits } from "../../../_shared/ai-fallback/index.ts";

const LLM_TIMEOUT_MS = 8000;

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function listDistributors(state: string): Promise<Array<{distributor: string; min: number; max: number}>> {
  try {
    const { data } = await svc()
      .from("igreen_distributor_discounts")
      .select("distributor,discount_min_percent,discount_max_percent")
      .eq("state", state)
      .eq("enabled", true)
      .order("distributor");
    return (data ?? []).map((r: any) => ({
      distributor: r.distributor,
      min: Number(r.discount_min_percent ?? 0),
      max: Number(r.discount_max_percent ?? 0),
    }));
  } catch (e) {
    console.error("[green] listDistributors failed", e);
    return [];
  }
}

function parseValor(msg: string): number | null {
  if (!msg) return null;
  const cleaned = msg.replace(/r\$/gi, "").replace(/reais?/gi, "");
  const m = cleaned.match(/(\d{2,6}(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const num = Number.parseFloat(m[1].replace(".", "").replace(",", "."));
  if (!Number.isFinite(num) || num <= 0 || num > 100000) return null;
  return num;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function runGreen(ctx: AgentContext): Promise<AgentResult> {
  // Normaliza rajadas coalescidas pelo process-pending-ai
  // ("[O cliente enviou várias mensagens em sequência:]\n1) X\n2) Y").
  // Todos os extratores/detectores rodam sobre essa versão limpa para que
  // funcionem mesmo quando o cliente manda várias mensagens em sequência.
  const cleanedMsg = cleanBurst(ctx.message);
  const burstLines = splitBurstLines(ctx.message);
  const initialStage = decideGreenStage(
    ctx.state, cleanedMsg,
    !!ctx.media, (ctx.state as any).document_status ?? null,
  );
  const tool_calls: AgentResult["tool_calls"] = [];
  const events: AgentResult["events"] = [
    { type: "green_stage_decided", priority: "low", source: "specialist", payload: { stage: initialStage } },
  ];
  const patch: AgentResult["suggested_state_patch"] = {};

  const currentExtras = (ctx.state.extras ?? {}) as Record<string, unknown>;
  let stage = initialStage;
  let deterministicText: string | null = null;

  // ---------- Captura oportunista de campos ----------
  // O cliente costuma entregar dados (estado, valor da fatura) em mensagens
  // antes do stage que pergunta esse dado (ex.: "Estou em SC" enquanto a IA
  // ainda estava enviando o vídeo). Sem isso, o slot fica vazio e a IA
  // pergunta de novo mais tarde, parecendo robótica.
  const SKIP_OPPORTUNISTIC = new Set<string>([
    "validate_invoice", "validate_identity", "handoff_human",
    "objection_security", "invoice_rejected_reply", "send_autocadastro_link",
    "waiting_invoice", "waiting_identity", "request_identity",
  ]);
  if (!ctx.media && !SKIP_OPPORTUNISTIC.has(stage)) {
    const captures: Record<string, unknown> = {};
    if (!hasExtraValue(currentExtras.estado)) {
      const uf = firstHit(burstLines, extractEstado);
      if (uf) {
        captures.estado = uf;
        tool_calls.push({
          name: "save_green_lead_field",
          args: { field: "estado", value: uf },
        });
      }
    }
    if (!hasExtraValue(currentExtras.valor_fatura)) {
      const etapaAtual = (ctx.state.etapa_funil ?? "").toLowerCase();
      const moneyContext = burstLines.some((l) =>
        /\b(r\$|reais?|conta|fatura|luz|m[eê]s|mensal|m[eê]dia)\b/i.test(l));
      if (etapaAtual === "qualificacao" || moneyContext) {
        const v = firstHit(burstLines, parseValor);
        if (v) {
          captures.valor_fatura = v;
          tool_calls.push({
            name: "save_green_lead_field",
            args: { field: "valor_fatura", value: String(v) },
          });
        }
      }
    }
    if (Object.keys(captures).length > 0) {
      Object.assign(currentExtras, captures);
      patch.extras = { ...currentExtras };
      const afterCapture = decideGreenStage(
        { ...ctx.state, extras: currentExtras },
        cleanedMsg,
        !!ctx.media,
        (ctx.state as any).document_status ?? null,
      );
      if (afterCapture !== stage) {
        events.push({
          type: "green_opportunistic_capture",
          priority: "low",
          source: "specialist",
          payload: { captured: Object.keys(captures), from: stage, to: afterCapture },
        });
        stage = afterCapture;
      } else {
        events.push({
          type: "green_opportunistic_capture",
          priority: "low",
          source: "specialist",
          payload: { captured: Object.keys(captures), from: stage, to: stage },
        });
      }
    }
  }

  if (stage === "greet") {
    // Nova abertura determinística: 2 ÁUDIOS em sequência (slot 1 e slot 2).
    // O slot 2 já espera 10s internamente (delay_after_ms da tabela).
    // Mostra "gravando áudio" antes de cada um.
    // Fallback de segurança: se os áudios não estiverem configurados, volta
    // para o texto antigo para nunca deixar o cliente sem resposta.
    patch.produto = "green";
    patch.etapa_funil = "qualificacao";
    patch.extras = {
      ...currentExtras,
      greeted: true,
      explained: true,
      intro_sent: true,
      intro_sent_at: new Date().toISOString(),
      atendimento_started: true,
    };
    tool_calls.push({ name: "set_product", args: { produto: "green" } });
    tool_calls.push({ name: "set_stage", args: { etapa: "qualificacao" } });
    if (!currentExtras.atendimento_started) {
      tool_calls.push({ name: "add_contact_tag", args: { tag: "em atendimento" } });
    }

    // Feature opt-in por conta: só usa áudios se o toggle estiver ligado E
    // os 2 slots estiverem configurados para a conta. Caso contrário, mantém
    // o comportamento antigo (5 bolhas de texto).
    let audiosConfigured = false;
    try {
      const accountId = ctx.account_id ?? null;
      if (accountId) {
        const { data: acc } = await svc()
          .from("accounts")
          .select("igreen_greeting_audio_enabled")
          .eq("id", accountId)
          .maybeSingle();
        const toggleOn = !!(acc as { igreen_greeting_audio_enabled?: boolean } | null)
          ?.igreen_greeting_audio_enabled;
        if (toggleOn) {
          const { data: audios } = await svc()
            .from("igreen_account_greeting_audios")
            .select("slot, storage_path, enabled")
            .eq("account_id", accountId)
            .in("slot", [1, 2]);
          const slot1 = (audios ?? []).find((a: { slot: number }) => a.slot === 1) as
            { storage_path?: string | null; enabled?: boolean } | undefined;
          const slot2 = (audios ?? []).find((a: { slot: number }) => a.slot === 2) as
            { storage_path?: string | null; enabled?: boolean } | undefined;
          audiosConfigured = !!(slot1?.enabled && slot1?.storage_path
            && slot2?.enabled && slot2?.storage_path);
        }
      }
    } catch (e) {
      console.error("[green/greet] erro carregando greeting audios", e);
    }

    if (audiosConfigured) {
      events.push(
        { type: "greeting_audio_dispatch", priority: "high", source: "specialist", payload: { slot: 1 } },
        { type: "greeting_audio_dispatch", priority: "high", source: "specialist", payload: { slot: 2 } },
      );
      return {
        messages: [], // Nenhum texto — só áudios
        events,
        tool_calls,
        suggested_state_patch: patch,
      };
    }

    // Fallback (áudios não configurados): mantém o texto antigo
    return {
      messages: [
        "Olá! 👋 Seja muito bem-vindo(a)! É um prazer falar com você.",
        "A energia por assinatura é uma forma simples de economizar na conta de luz sem precisar instalar placas solares ou fazer qualquer obra no seu imóvel. ☀️",
        "Você continua recebendo energia normalmente da distribuidora da sua região, mas passa a aproveitar créditos de energia gerados por usinas parceiras, reduzindo o valor da sua fatura.",
        "E o melhor: posso fazer uma simulação personalizada para mostrar quanto você pode economizar de verdade. 💰",
        "Para isso, me informe apenas em qual estado você mora. Assim, consigo calcular uma estimativa da sua economia mensal e anual de forma mais precisa.",
      ],
      events,
      tool_calls,
      suggested_state_patch: patch,
    };
  }

  if (stage === "explain_solution") {
    // Marca que já explicamos para o stage-engine progredir no próximo turno
    // mesmo se set_product retornar skipped.
    patch.produto = "green";
    patch.extras = { ...currentExtras, explained: true };
    tool_calls.push({ name: "set_product", args: { produto: "green" } });
    if (burstLines.some((l) => isAffirmation(l))) {
      patch.extras = { ...(patch.extras as object), solution_confirmed: true };
    }
  }

  // Promoção determinística novo → qualificacao quando entramos em send_video
  // ainda em etapa "novo". Não dependemos mais de set_product(skipped:false).
  if (stage === "send_video" && (ctx.state.etapa_funil ?? "novo").toLowerCase() === "novo") {
    patch.etapa_funil = "qualificacao";
    tool_calls.push({ name: "set_stage", args: { etapa: "qualificacao" } });
  }

  if (stage === "ask_consumo") {
    // tenta capturar consumo na mensagem atual (números seguidos de kwh/r$/reais)
    const consumo = firstHit(burstLines, extractConsumo);
    if (consumo) {
      patch.extras = { ...currentExtras, consumo_medio: consumo };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "consumo_medio", value: consumo },
      });
    }
    // O prompt deste stage pergunta valor médio em reais. Então uma resposta
    // numérica simples como "500" já deve preencher valor_fatura também;
    // caso contrário o fluxo pergunta praticamente a mesma coisa de novo.
    const v = firstHit(burstLines, parseValor);
    if (v) {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        consumo_medio: consumo ?? String(v),
        valor_fatura: v,
      };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "valor_fatura", value: String(v) },
      });
    }
  }

  if (stage === "engage_check") {
    // Marca engaged=true para destravar coleta de dados no próximo turno,
    // independentemente da resposta — o objetivo é dar respiro humano entre
    // o vídeo e o início da qualificação.
    patch.extras = { ...currentExtras, engaged: true };
    // Resposta do cliente APÓS o vídeo → adiciona tag "em atendimento",
    // o que move o card no CRM de "Novo Lead" para "Iniciou atendimento".
    if (!currentExtras.atendimento_started) {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        atendimento_started: true,
      };
      tool_calls.push({
        name: "add_contact_tag",
        args: { tag: "em atendimento" },
      });
    }
    // Se o cliente perguntou "qual meu desconto?" logo após o vídeo,
    // não devolvemos pergunta vazia: pedimos direto o valor da fatura.
    if (burstLines.some((l) => isDiscountQuestion(l))) {
      const nome = (currentExtras.client_name as string | undefined) ?? "";
      const estado = (currentExtras.estado as string | undefined) ?? "";
      deterministicText = estado
        ? `Boa${nome ? `, ${nome}` : ""}! Pra te passar o número exato em ${estado}, me diz o valor médio da sua conta de luz por mês.`
        : `Boa${nome ? `, ${nome}` : ""}! Pra te passar o número exato, me diz o valor médio da sua conta de luz por mês e em qual estado você está.`;
    }
  }

  if (stage === "ask_estado") {
    const uf = firstHit(burstLines, extractEstado);
    if (uf) patch.extras = { ...currentExtras, estado: uf };
  }

  if (stage === "present_distributors") {
    const estado = (currentExtras.estado as string | undefined) ?? "";
    const list = estado ? await listDistributors(estado) : [];
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Estado fora da nossa cobertura — informa e encerra com leveza.
    if (estado && list.length === 0) {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        distributors_presented: true,
        distributors_options: [],
        state_unsupported: true,
        state_unsupported_uf: estado,
        soft_closed: true,
        soft_closed_at: new Date().toISOString(),
      };
      tool_calls.push({ name: "add_contact_tag", args: { tag: "estado_nao_atendido" } });
      deterministicText = `${nome ? nome + ", " : ""}poxa, hoje a iGreen ainda não atende o estado de ${estado}. 😕 Estamos expandindo aos poucos — assim que liberar pra sua região eu te aviso por aqui. Obrigado pelo interesse!`;
      stage = "soft_close";
    } else if (list.length > 1) {
      const opts = list.map((d, i) => `${i + 1} - ${d.distributor}`).join("\n");
      deterministicText = `No seu estado trabalhamos com:\n\n${opts}\n\nQual dessas é a sua?`;
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        distributors_presented: true,
        distributors_options: list.map((d) => d.distributor),
      };
    } else {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        distributors_presented: true,
        distributors_options: list.map((d) => d.distributor),
      };
    }
    // Apenas uma distribuidora atende o estado → assume direto e pula confirmação.
    if (list.length === 1 && !(currentExtras.state_unsupported)) {
      const chosen = list[0].distributor;
      patch.extras = { ...(patch.extras as object), distribuidora: chosen };
      Object.assign(currentExtras, patch.extras as Record<string, unknown>);
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "distribuidora", value: chosen },
      });
      // Com apenas uma distribuidora cadastrada, nunca pedir confirmação:
      // assume a opção única e segue direto para a simulação no mesmo turno.
      deterministicText = null;
      stage = "simulate_discount_concreto";
    }
  }

  if (stage === "ask_distribuidora") {
    const opts = (currentExtras.distributors_options as string[] | undefined) ?? [];
    const msg = cleanedMsg.trim();
    let chosen: string | null = null;
    // Se o sistema só tem uma distribuidora cadastrada para o estado, não
    // pergunta nem confirma: assume automaticamente e segue para a simulação.
    if (opts.length === 1) chosen = opts[0];
    // 1) resposta numérica (1, 2, 3…)
    const numMatch = msg.match(/^\s*(\d{1,2})\b/);
    if (!chosen && numMatch && opts.length > 0) {
      const idx = Number(numMatch[1]) - 1;
      if (idx >= 0 && idx < opts.length) chosen = opts[idx];
    }
    // 2) match parcial pelo nome
    if (!chosen && opts.length > 0) {
      const low = msg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      chosen = opts.find((o) => {
        const ol = o.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return low.includes(ol) || ol.includes(low);
      }) ?? null;
    }
    // 3) lista de 1 + afirmação → assume essa
    if (!chosen && opts.length === 1 && burstLines.some((l) => isAffirmation(l))) chosen = opts[0];
    // 4) fallback: texto livre
    if (!chosen) {
      const d = firstHit(burstLines, extractDistribuidora);
      if (d && opts.length === 0) chosen = d;
    }
    // Guard: nunca salvar a distribuidora se ela bater com o estado já
    // informado (cliente está respondendo "Bahia" enquanto a IA já está
    // perguntando outra coisa, por exemplo).
    if (chosen) {
      const estadoSalvo = (currentExtras.estado as string | undefined) ?? "";
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (extractEstado(chosen) || (estadoSalvo && norm(chosen) === norm(estadoSalvo))) {
        chosen = null;
      }
    }
    if (chosen) {
      patch.extras = { ...(patch.extras as object ?? currentExtras), distribuidora: chosen };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "distribuidora", value: chosen },
      });
    }
  }

  if (stage === "ask_valor_fatura") {
    const valor = firstHit(burstLines, parseValor);
    if (valor) {
      patch.extras = { ...(patch.extras as object ?? currentExtras), valor_fatura: valor };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "valor_fatura", value: String(valor) },
      });
    }
  }

  if (stage === "simulate_discount_concreto") {
    const estado = (currentExtras.estado as string | undefined) ?? "";
    let distribuidora = (currentExtras.distribuidora as string | undefined) ?? "";
    // Guard: se a distribuidora salva não está na lista oficial de
    // distributors_options do estado, é lixo (ex.: nome do estado entrou
    // como distribuidora). Não simula com valor inválido — volta a perguntar.
    const optsCheck = (currentExtras.distributors_options as string[] | undefined) ?? [];
    if (distribuidora && optsCheck.length > 0) {
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const valid = optsCheck.some((o) => norm(o) === norm(distribuidora) || norm(o).includes(norm(distribuidora)) || norm(distribuidora).includes(norm(o)));
      if (!valid) {
        if (optsCheck.length === 1) {
          distribuidora = optsCheck[0];
          patch.extras = { ...(patch.extras as object ?? currentExtras), distribuidora };
          Object.assign(currentExtras, { distribuidora });
          tool_calls.push({
            name: "save_green_lead_field",
            args: { field: "distribuidora", value: distribuidora },
          });
        } else {
          // Limpa o valor inválido para o próximo turno cair em ask_distribuidora.
          patch.extras = { ...(patch.extras as object ?? currentExtras), distribuidora: null };
          const nome = (currentExtras.client_name as string | undefined) ?? "";
          const optsList = optsCheck.map((d, i) => `${i + 1} - ${d}`).join("\n");
          deterministicText = `${nome ? nome + ", " : ""}só pra confirmar qual é a sua distribuidora no seu estado:\n\n${optsList}\n\nQual dessas é a sua?`;
          return {
            messages: [deterministicText],
            events,
            tool_calls,
            suggested_state_patch: patch,
          };
        }
      }
    }
    const valor = Number(currentExtras.valor_fatura ?? 0);
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Busca faixa oficial
    let min = 0, max = 0;
    if (estado && distribuidora) {
      const list = await listDistributors(estado);
      const found = list.find((d) =>
        d.distributor.toLowerCase().includes(distribuidora.toLowerCase()) ||
        distribuidora.toLowerCase().includes(d.distributor.toLowerCase()));
      if (found) { min = found.min; max = found.max; }
    }
    if (min > 0 && max > 0 && valor > 0) {
      const economia = (valor * max) / 100;
      deterministicText =
`Olha só${nome ? `, ${nome}` : ""}! Pra ${distribuidora} a média de desconto fica entre ${min}% e ${max}%. Numa conta de R$ ${formatBRL(valor)}, seu desconto pode chegar a R$ ${formatBRL(economia)} todo mês. 🤑

E não é só isso: depois do seu cadastro, você ainda pode chegar a zerar sua conta de luz indicando novos assinantes pelo nosso programa de cashback.

Quer que eu já comece seu cadastro agora? 😉`;
    } else {
      deterministicText = `${nome ? nome + ", " : ""}com a ${distribuidora || "sua distribuidora"} a iGreen tem uma faixa oficial de economia. Quer que eu já comece seu cadastro agora? 😊`;
    }
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      discount_lookup_done: true,
      discount_min_percent: min || null,
      discount_max_percent: max || null,
      signup_pitch_sent: true,
    };
    // Log oficial via tool (mantém compat)
    if (estado && distribuidora) {
      tool_calls.push({
        name: "get_distributor_discount",
        args: { state: estado, distributor: distribuidora },
      });
    }
  }

  if (stage === "early_discount_tease") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const estado = (currentExtras.estado as string | undefined) ?? "";
    const valor = Number(currentExtras.valor_fatura ?? 0);
    let ask = "Em qual estado você está?";
    if (estado && !valor) ask = `Qual o valor médio da sua conta de luz em ${estado}? Assim te passo o número exato.`;
    if (!estado && valor) ask = "Em qual estado você está? Assim te passo o número exato.";
    deterministicText = `${nome ? nome + ", " : ""}a média de desconto da iGreen costuma ficar entre 10% e 20% na sua fatura todo mês — varia conforme o estado e a distribuidora. ${ask}`;
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      early_discount_tease_sent: true,
      // Marca engaged para não disparar engage_check no próximo turno após
      // o cliente responder o estado/valor.
      engaged: true,
    };
  }

  if (stage === "clarify_discount_estimate") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const distribuidora = (currentExtras.distribuidora as string | undefined) ?? "sua distribuidora";
    const valor = Number(currentExtras.valor_fatura ?? 0);
    const min = Number(currentExtras.discount_min_percent ?? 0);
    const max = Number(currentExtras.discount_max_percent ?? 0);
    const msgs: string[] = [];
    msgs.push(
      `${nome ? nome + ", " : ""}esse valor é uma **estimativa**, viu? O desconto real **depende do seu consumo no mês** — pode variar dentro da faixa oficial da ${distribuidora}.`,
    );
    if (min > 0 && max > 0 && valor > 0) {
      const eMin = (valor * min) / 100;
      const eMax = (valor * max) / 100;
      msgs.push(
        `Pra ${distribuidora} a faixa fica entre ${min}% e ${max}%. Na sua conta de R$ ${formatBRL(valor)}, normalmente o desconto cai entre R$ ${formatBRL(eMin)} e R$ ${formatBRL(eMax)} todo mês. 💰`,
      );
    } else if (min > 0 && max > 0) {
      msgs.push(`Pra ${distribuidora} a faixa fica entre ${min}% e ${max}% da sua fatura todo mês.`);
    }
    msgs.push("Quer que eu já comece seu cadastro agora pra você travar esse desconto? 😉");
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      discount_clarified: true,
      discount_clarified_at: new Date().toISOString(),
      // Limpa flag de declínio caso tenha sido marcada erroneamente em turno anterior.
      signup_declined_at: null,
      soft_closed: false,
      soft_closed_at: null,
      // Mantém signup_pitch_sent=true mas NÃO marca soft_closed.
    };
    return {
      messages: msgs,
      events,
      tool_calls,
      suggested_state_patch: patch,
    };
  }

  if (stage === "confirm_signup") {
    // Guarda extra: se a mensagem é dúvida sobre custo, NUNCA tratar como
    // declínio. Redireciona para objection_cost (caso o decideGreenStage
    // não tenha pego — defesa em profundidade).
    if (burstLines.some((l) => isCostQuestion(l)) && !currentExtras.cost_clarified) {
      stage = "objection_cost";
    }
  }

  if (stage === "objection_cost") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const msgs: string[] = [
      `${nome ? nome + ", " : ""}ótima pergunta! 🙌 Com a iGreen você **não paga nenhuma taxa extra, mensalidade ou adesão**. Não tem instalação, não tem obra, não tem fidelidade e nem multa.`,
      `O que muda é só isso: no lugar (ou junto) da sua fatura da distribuidora, você passa a receber a fatura da iGreen **já com o desconto aplicado**. Ou seja, você continua pagando sua energia normalmente — só que mais barato. 💡`,
      `Posso seguir com seu cadastro agora? É rapidinho — só preciso de uma foto da sua última fatura pra começar.`,
    ];
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      cost_clarified: true,
      cost_clarified_at: new Date().toISOString(),
      // Limpa qualquer flag de declínio aplicada erroneamente em turno anterior.
      signup_declined_at: null,
      soft_closed: false,
      soft_closed_at: null,
      // Mantém pitch enviado para não repetir.
      signup_pitch_sent: true,
    };
    return {
      messages: msgs,
      events,
      tool_calls,
      suggested_state_patch: patch,
    };
  }

  if (stage === "confirm_signup") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Resposta afirmativa → confirma e o redecide abaixo joga em request_invoice.
    if (burstLines.some((l) => isAffirmation(l))) {
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        signup_confirmed: true,
        signup_confirmed_at: new Date().toISOString(),
      };
    } else if (!currentExtras.signup_pitch_sent) {
      // Primeira vez: pede confirmação.
      deterministicText = `${nome ? nome + ", " : ""}quer que eu já comece seu cadastro agora? É rapidinho — só preciso de uma foto da sua última fatura pra começar.`;
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        signup_pitch_sent: true,
      };
    } else {
      // Pitch já enviado e cliente não confirmou (negou, mudou de assunto, etc.).
      // NÃO repete o pedido — encerra com leveza e marca o lead como frio.
      patch.extras = {
        ...(patch.extras as object ?? currentExtras),
        signup_declined_at: new Date().toISOString(),
        soft_closed: true,
        soft_closed_at: new Date().toISOString(),
      };
      tool_calls.push({ name: "add_contact_tag", args: { tag: "lead_frio" } });
      deterministicText = `Tranquilo${nome ? `, ${nome}` : ""}! Fico à disposição quando quiser dar uma olhada. Qualquer dúvida é só me chamar por aqui. 😊`;
      stage = "soft_close";
    }
  }

  if (stage === "intent_send_invoice_ack") {
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      intent_send_invoice: true,
      invoice_search_ack: true,
      invoice_search_ack_at: new Date().toISOString(),
    };
    // Adiciona tag CRM "vai enviar fatura" se a tool estiver disponível.
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "vai enviar fatura" },
    });
  }

  if (stage === "objection_security") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), objection_security_handled: true };
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "objecao_seguranca" },
    });
    const nomeObj = (currentExtras as any)?.client_name as string | undefined;
    deterministicText =
      `${nomeObj ? nomeObj + ", " : ""}entendo perfeitamente sua preocupação — hoje em dia é essencial ter cuidado, e fico feliz que você tenha levantado isso.\n\n` +
      `Só pra te trazer mais tranquilidade: a iGreen Energy faz parte do GRUPO BR, o mesmo grupo dos postos de gasolina BR espalhados pelo Brasil inteiro. É uma empresa sólida, consolidada no mercado de energia limpa, regulamentada pela ANEEL, parceira oficial das principais distribuidoras e com milhares de clientes ativos. Nosso modelo é assinatura de energia por compensação: sem obra, sem trocar de distribuidora e sem custo de adesão — você continua recebendo a mesma fatura da sua distribuidora, só que com desconto.\n\n` +
      `E pra você ficar 100% à vontade, você pode fazer todo o cadastro VOCÊ MESMO, direto pelo nosso app oficial da iGreen, sem precisar passar nenhum dado por aqui. Quer que eu te envie agora o link oficial pra você fazer com calma?`;
  }

  if (stage === "request_identity") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), identity_requested: true };
  }

  // family_authorization_check — DEPRECADO (jun/2026). Não validamos mais
  // titularidade da fatura; o cliente é responsável por mandar o RG/CNH
  // do titular quando a IA pedir.

  if (stage === "send_autocadastro_link") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), autocadastro_sent: true };
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "autocadastro_enviado" },
    });
    tool_calls.push({
      name: "save_green_lead_field",
      args: { field: "auto_cadastro_enviado", value: "true" },
    });
    // Busca o link de auto-cadastro configurado pelo usuário (por conta),
    // com fallback para o produto global "green".
    let signupUrl: string | null = null;
    try {
      const { data: acctRow } = await svc()
        .from("igreen_account_products")
        .select("signup_url, enabled")
        .eq("account_id", (ctx as any).account_id)
        .eq("key", "green")
        .maybeSingle();
      if (acctRow && (acctRow as any).enabled !== false) {
        const u = (acctRow as any).signup_url;
        if (typeof u === "string" && u.trim()) signupUrl = u.trim();
      }
      if (!signupUrl) {
        const { data: globalRow } = await svc()
          .from("igreen_products")
          .select("signup_url, enabled")
          .eq("key", "green")
          .maybeSingle();
        if (globalRow && (globalRow as any).enabled !== false) {
          const u = (globalRow as any).signup_url;
          if (typeof u === "string" && u.trim()) signupUrl = u.trim();
        }
      }
    } catch (e) {
      console.error("[green] lookup signup_url failed", e);
    }
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    if (signupUrl) {
      deterministicText = `${nome ? nome + ", " : ""}aqui está o link oficial de auto-cadastro: ${signupUrl}\n\nQualquer dúvida no preenchimento, é só me chamar que eu te ajudo. 😉`;
    } else {
      deterministicText = `${nome ? nome + ", " : ""}deixa eu te chamar um especialista pra te enviar o link oficial de auto-cadastro com segurança. Já estou transferindo, ok?`;
      tool_calls.push({ name: "handoff_to_human", args: { reason: "signup_url_not_configured" } });
    }
  }

  if (stage === "soft_close") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      soft_closed: true,
      soft_closed_at: new Date().toISOString(),
    };
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "lead_frio" },
    });
    deterministicText = `Tranquilo${nome ? `, ${nome}` : ""}! Fico à disposição quando quiser dar uma olhada. Qualquer dúvida é só me chamar por aqui. 😊`;
  }

  if (stage === "out_of_scope_clarify") {
    const topic = firstHit(burstLines, detectOutOfScope);
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const handled = ((currentExtras.out_of_scope_handled_topics as string[] | undefined) ?? []).slice();
    if (topic && !handled.includes(topic)) handled.push(topic);
    let body = "";
    switch (topic) {
      case "emprestimo":
        body = "a Igreen não trabalha com empréstimo nem crédito na conta de luz. O que a gente faz é aplicar um desconto da energia limpa direto na sua fatura todo mês, sem trocar de distribuidora.";
        break;
      case "placa_propria":
        body = "a Igreen não vende nem instala placa solar. A gente faz assinatura de energia limpa: o desconto cai direto na sua fatura, sem obra e sem placa em casa.";
        break;
      case "segunda_via":
        body = "a Igreen não emite segunda via da sua conta de luz — isso é direto com a distribuidora. O que a gente faz é dar desconto na sua fatura todo mês.";
        break;
      case "religar":
        body = "religação de energia é feita direto com a distribuidora, a Igreen não atua nessa parte. A gente faz assinatura de energia limpa que dá desconto na sua fatura.";
        break;
      case "troca_titular":
        body = "troca de titularidade da conta de luz é feita direto na distribuidora, a Igreen não faz isso. A gente entra dando desconto na fatura, no nome do titular atual.";
        break;
      default:
        body = "esse tipo de serviço não é com a Igreen. A gente trabalha com assinatura de energia limpa que dá desconto direto na sua fatura.";
    }
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      out_of_scope_handled_topics: handled,
      last_out_of_scope_topic: topic ?? null,
    };
    if (topic) {
      tool_calls.push({
        name: "add_contact_tag",
        args: { tag: `interesse_${topic}` },
      });
    }
    deterministicText = `${nome ? nome + ", " : ""}${body} Mesmo assim, quer que eu te mostre rapidinho como funciona essa economia na conta de luz?`;
  }

  if (stage === "objection_reply") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const m = (cleanedMsg ?? "").toLowerCase();
    let topic = "geral";
    let body = "";
    if (/\b(aluguel|alugada?|n[aã]o\s+(?:é|eh)\s+(?:minha|meu)|(?:é|eh)\s+do\s+(?:meu|minha)\s+(?:pai|m[aã]e|marido|esposa|irm[aã]o?|filh[oa]|sogr[oa]))\b/.test(m)) {
        topic = "titular_terceiro";
        body = "tranquilo, dá pra contratar mesmo a conta estando no nome de outra pessoa da família — basta a autorização do titular.";
    } else if (/\bconta\s+baixa|minha\s+conta\s+(?:é|eh)\s+baixa\b/.test(m)) {
        topic = "conta_baixa";
        body = "entendo. Pra Igreen, geralmente a economia faz mais diferença em faturas acima de R$ 200, mas posso te mostrar como fica no seu caso antes de você decidir.";
    } else if (/\bt[aá]\s+caro|muito\s+caro\b/.test(m)) {
        topic = "preco";
        body = "olha, a Igreen não cobra nada a mais — o que entra na sua conta é a sua fatura JÁ COM desconto aplicado. Você só paga, todo mês, menos do que pagaria pra distribuidora sozinha.";
    } else if (/\bn[aã]o\s+confio|n[aã]o\s+acredito\b/.test(m)) {
        topic = "confianca";
        body = "faz sentido você ter pé atrás, qualquer um teria. A Igreen é uma empresa registrada, com mais de 200 mil clientes ativos, e seus dados são usados só pra aplicar o desconto na sua conta.";
    } else if (/\bsem\s+tempo|t[aá]\s+complicado|t[aá]\s+dif[ií]cil|n[aã]o\s+pode\s+agora\b/.test(m)) {
        topic = "tempo";
        body = "tranquilo, é rapidinho — em uns 2 minutos a gente já consegue ver quanto dá pra você economizar.";
    } else {
        body = "entendi seu ponto.";
    }
    const lastTopic = (currentExtras.last_objection_topic as string | undefined) ?? null;
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      last_objection_topic: topic,
      last_objection_at: new Date().toISOString(),
    };
    // Se a mesma objeção já foi tratada no turno anterior, encerra com leveza
    // em vez de insistir.
    if (lastTopic === topic) {
      deterministicText = `${nome ? nome + ", " : ""}${body} Sem problema se quiser pensar com calma — fico à disposição quando você quiser seguir. 😊`;
      patch.extras = { ...(patch.extras as object), soft_closed: true };
      tool_calls.push({ name: "add_contact_tag", args: { tag: "lead_frio" } });
    } else {
      deterministicText = `${nome ? nome + ", " : ""}${body} Posso continuar te mostrando a economia ou prefere que eu pare por aqui?`;
    }
  }

  if (stage === "handoff_human") {
    patch.extras = { ...(patch.extras as object ?? currentExtras), handoff_done: true };
    (patch as any).handoff_ativo = true;
    tool_calls.push({
      name: "request_human_handoff",
      args: { reason: "explicit_user_request" },
    });
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "handoff_humano" },
    });
  }

  if (stage === "handoff_voice_video") {
    const channel = detectVoiceVideoChannel(ctx.message ?? "");
    const msgs: string[] = [
      "Entendi! Eu sou uma assistente virtual e por aqui só consigo te atender por mensagens de texto. 🤖",
      `Mas sem problema — já estou chamando um(a) atendente humano(a) da equipe pra continuar com você por ${channel}. Em instantes alguém te responde por aqui. 🙌`,
    ];
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      handoff_done: true,
      handoff_reason: "voice_video_call_requested",
      requested_channel: channel,
    };
    (patch as any).handoff_ativo = true;
    tool_calls.push({
      name: "request_human_handoff",
      args: { reason: "voice_video_call_requested" },
    });
    tool_calls.push({
      name: "add_contact_tag",
      args: { tag: "pediu_canal_humano" },
    });
    return {
      messages: msgs,
      events,
      tool_calls,
      suggested_state_patch: patch,
    };
  }

  if (stage === "validate_identity" && ctx.media) {
    tool_calls.push({
      name: "validate_green_identity",
      args: {
        media_url: ctx.media.url,
        mime_type: ctx.media.mime_type,
        byte_size: ctx.media.byte_size,
        // Não passamos mais expected_name — a validação agora só checa que é
        // RG/CNH legível; o cliente garante que é do titular.
        expected_name: null,
      },
    });
    // Texto final é gerado pelo orquestrador APÓS o resultado da tool
    // (aprovação inicia cadastro + handoff, rejeição pede reenvio).
    deterministicText = "";
  }

  if (stage === "ask_name") {
    patch.produto = "green";
    patch.extras = { ...(patch.extras as object ?? currentExtras), greeted: true };
    const nome = extractFirstName(ctx.message);
    if (nome) {
      patch.extras = { ...(patch.extras as object), client_name: nome, explained: true };
      tool_calls.push({
        name: "save_green_lead_field",
        args: { field: "nome_cliente", value: nome },
      });
      tool_calls.push({ name: "set_product", args: { produto: "green" } });
      // Se na MESMA rajada o cliente já mandou uma FAQ (ex.: "qual o percentual
      // de economia?") ou algo fora do escopo, respondemos a dúvida em vez de
      // repetir "quer saber como funciona?".
      const faq = firstHit(burstLines, detectFaqTopic);
      const oos = firstHit(burstLines, detectOutOfScope);
      const askedDiscount = burstLines.some((l) =>
        /\b(percentual|porcentagem|quanto.{0,15}(desconto|economia|economizo|economizar)|qual.{0,10}desconto)\b/i.test(l));
      if (askedDiscount) {
        deterministicText = `Prazer, ${nome}! O desconto da iGreen varia por estado e distribuidora, geralmente entre 10% e 20% na sua fatura todo mês — sem obra, sem trocar de distribuidora. Pra eu te dar o número exato, em qual estado você está?`;
      } else if (faq === "cashback") {
        deterministicText = `Prazer, ${nome}! Sobre o cashback: cada novo assinante que entrar pela sua indicação te devolve uma parte da fatura dele, e isso pode até zerar sua conta de luz. Antes disso, me conta: em qual estado você está?`;
      } else if (faq === "instalacao" || faq === "como_funciona" || faq) {
        deterministicText = `Prazer, ${nome}! Funciona simples: a iGreen aplica um desconto da faixa oficial da sua distribuidora direto na sua fatura, sem obra e sem trocar de distribuidora. Em qual estado você está pra eu te mostrar a economia?`;
      } else if (oos) {
        deterministicText = `Prazer, ${nome}! Sobre o que você perguntou, a iGreen trabalha especificamente com desconto na conta de luz via assinatura de energia limpa. Quer que eu te mostre rapidinho como funciona essa economia?`;
      } else {
        deterministicText = `Prazer, ${nome}! Com a Igreen você economiza na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Quer saber como funciona?`;
      }
    }
  }

  if (stage === "send_video") {
    // NÃO marcar video_sent aqui — a tool send_discovery_video é quem define
    // esse flag APÓS o envio efetivo. Marcar antes faz a tool pular com
    // skip_reason="state_unchanged" e o vídeo nunca chega ao cliente.
    tool_calls.push({
      name: "send_discovery_video",
      args: { produto: "green" },
    });
  }

  if (stage === "request_invoice") {
    tool_calls.push({
      name: "request_invoice",
      args: { reason: "calculo_economia" },
    });
  }

  if (stage === "validate_invoice" && ctx.media) {
    tool_calls.push({
      name: "validate_green_invoice",
      args: {
        media_url: ctx.media.url,
        mime_type: ctx.media.mime_type,
        byte_size: ctx.media.byte_size,
      },
    });
    // IA silencia neste turno — o texto final (aprovação/pedido de RG OU rejeição)
    // é gerado pelo orquestrador APÓS o resultado da tool, evitando "tô conferindo".
    deterministicText = "";
  }

  if (stage === "invoice_rejected_reply") {
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    // Mensagem por motivo conhecido (último evento). Fallback genérico.
    const lastReason = (ctx.state as any).last_media_reject_reason
      ?? (currentExtras.last_media_reject_reason as string | undefined)
      ?? null;
    let body = "Não consegui abrir o arquivo da fatura aqui. Pode reenviar como PDF ou foto nítida da última conta?";
    if (lastReason === "invalid_mime") {
      body = "Esse formato não abre aqui. Pode mandar a fatura como PDF ou foto (jpg/png)?";
    } else if (lastReason === "too_small") {
      body = "O arquivo chegou muito pequeno e não consegui ler. Pode mandar a fatura em PDF ou uma foto nítida?";
    } else if (lastReason === "too_large") {
      body = "O arquivo ficou muito pesado. Pode reenviar uma foto da fatura ou um PDF menor (até 10MB)?";
    } else if (lastReason === "reject_unreadable" || lastReason === "reject_low_confidence") {
      body = "A foto da fatura ficou um pouco baixa. Pode mandar de novo mostrando o nome do titular e o consumo, por favor?";
    } else if (lastReason === "reject_not_invoice") {
      body = "O arquivo que recebi não parece ser a fatura de energia. Pode me enviar a última conta de luz (PDF ou foto)?";
    }
    deterministicText = `${nome ? nome + ", " : ""}${body}`;
    // Reseta document_status para destravar próxima validação e marca que já avisamos.
    (patch as any).document_status = null;
    patch.extras = {
      ...(patch.extras as object ?? currentExtras),
      invoice_rejected_notified: true,
      invoice_rejected_notified_at: new Date().toISOString(),
    };
  }

  if (stage === "faq_answer") {
    const topic = firstHit(burstLines, detectFaqTopic);
    const nome = (currentExtras.client_name as string | undefined) ?? "";
    const valor = Number(currentExtras.valor_fatura ?? 0);
    const distribuidora = (currentExtras.distribuidora as string | undefined) ?? "";
    // Determina o CTA pendente para amarrar a resposta da FAQ ao próximo passo.
    const faturaPedida = !!currentExtras.discount_lookup_done || (ctx.state.etapa_funil ?? "") === "fatura_enviada";
    const cta = faturaPedida
      ? "Pra eu iniciar a verificação do seu cadastro, me manda uma foto ou PDF da sua última fatura, pode ser?"
      : "Quer que eu te mostre quanto dá pra economizar?";
    let answer = "";
    switch (topic) {
      case "cashback":
        answer = "Funciona assim: cada novo assinante que entrar pela sua indicação te devolve uma parte da fatura dele em cashback todo mês. Quanto mais indicações ativas, mais sua própria conta de luz vai pra perto de zero.";
        break;
      case "cancelar":
        answer = "Você pode sair quando quiser, sem multa nem burocracia. É só avisar a iGreen e o cancelamento é feito.";
        break;
      case "fidelidade":
        answer = "Não tem fidelidade nem multa. Você fica enquanto for bom pra você.";
        break;
      case "instalacao":
        answer = "Não precisa de obra nem instalar nada. A energia continua chegando pela mesma distribuidora, só que com desconto da iGreen aplicado direto na fatura.";
        break;
      case "prazo":
        answer = "Depois do cadastro aprovado, o desconto costuma aparecer já na próxima fatura ou na seguinte, dependendo do ciclo da distribuidora.";
        break;
      case "seguro":
        answer = "É 100% seguro. A iGreen é uma empresa registrada, com mais de 200 mil clientes, e seus dados são usados só pra aplicar o desconto na sua conta.";
        break;
      case "como_funciona":
      default:
        answer = distribuidora
          ? `Funciona simples${nome ? `, ${nome}` : ""}: a iGreen aplica um desconto da faixa oficial da ${distribuidora} direto na sua fatura, sem obra e sem trocar de distribuidora.`
          : "Funciona simples: a iGreen aplica um desconto da faixa oficial da sua distribuidora direto na fatura, sem obra e sem trocar de distribuidora.";
    }
    const prefix = nome && topic !== "como_funciona" ? `${nome}, ` : "";
    deterministicText = valor > 0 && topic === "cashback"
      ? `${prefix}${answer}\n\n${cta}`
      : `${prefix}${answer}\n\n${cta}`;
    // FAQ não muda etapa/extras de qualificação.
  }

  // Post-capture re-decision: se acabamos de capturar um dado em extras,
  // re-decidimos o stage para evitar repetir a pergunta no próximo turno.
  // Não aplicamos para stages que disparam tool_calls (send_video/validate_invoice/request_invoice)
  // — esses precisam manter o stage original.
  const STAGES_REDECIDABLE = new Set([
    "ask_consumo", "ask_estado", "ask_distribuidora", "ask_valor_fatura",
    "confirm_signup",
  ]);
  if (STAGES_REDECIDABLE.has(stage)) {
    const mergedExtras = (patch.extras as Record<string, unknown>) ?? currentExtras;
    const mergedState = { ...ctx.state, extras: mergedExtras, etapa_funil: patch.etapa_funil ?? ctx.state.etapa_funil };
    const nextStage = decideGreenStage(mergedState, cleanedMsg, !!ctx.media, (ctx.state as any).document_status ?? null);
    if (nextStage !== stage) {
      events.push({ type: "green_stage_advanced", priority: "low", source: "specialist",
        payload: { from: stage, to: nextStage } });
      stage = nextStage;
      // Tool wiring para os stages alcançados por redecide.
      if (stage === "present_distributors") {
        const estado = (mergedExtras.estado as string | undefined) ?? "";
        const list = estado ? await listDistributors(estado) : [];
        const nome = (mergedExtras.client_name as string | undefined) ?? "";
        if (list.length === 0) {
          deterministicText = `${nome ? nome + ", " : ""}me confirma só uma coisa: qual é a sua distribuidora de energia?`;
        } else if (list.length > 1) {
          const opts = list.map((d, i) => `${i + 1} - ${d.distributor}`).join("\n");
          deterministicText = `No seu estado trabalhamos com:\n\n${opts}\n\nQual dessas é a sua?`;
        }
        patch.extras = {
          ...(patch.extras as object ?? mergedExtras),
          distributors_presented: true,
          distributors_options: list.map((d) => d.distributor),
        };
        // Única distribuidora → assume e avança direto pra simulação (ou ask_valor_fatura).
        if (list.length === 1) {
          const chosen = list[0].distributor;
          patch.extras = { ...(patch.extras as object), distribuidora: chosen };
          tool_calls.push({
            name: "save_green_lead_field",
            args: { field: "distribuidora", value: chosen },
          });
          deterministicText = null;
          const mergedExtras2 = patch.extras as Record<string, unknown>;
          const mergedState2 = { ...mergedState, extras: mergedExtras2 };
          const after = decideGreenStage(mergedState2, cleanedMsg, !!ctx.media, (ctx.state as any).document_status ?? null);
          if (after === "simulate_discount_concreto") {
            const valor = Number(mergedExtras2.valor_fatura ?? 0);
            const nome2 = (mergedExtras2.client_name as string | undefined) ?? "";
            const list2 = await listDistributors(estado);
            const found = list2.find((d) =>
              d.distributor.toLowerCase().includes(chosen.toLowerCase()) ||
              chosen.toLowerCase().includes(d.distributor.toLowerCase()));
            const min = found?.min ?? 0;
            const max = found?.max ?? 0;
            if (min > 0 && max > 0 && valor > 0) {
              const economia = (valor * max) / 100;
              deterministicText =
`Olha só${nome2 ? `, ${nome2}` : ""}! Pra ${chosen} a média de desconto fica entre ${min}% e ${max}%. Numa conta de R$ ${formatBRL(valor)}, seu desconto pode chegar a R$ ${formatBRL(economia)} todo mês. 🤑

E não é só isso: depois do seu cadastro, você ainda pode chegar a zerar sua conta de luz indicando novos assinantes pelo nosso programa de cashback.

Quer que eu já comece seu cadastro agora? 😉`;
            } else {
              deterministicText = `${nome2 ? nome2 + ", " : ""}com a ${chosen} a iGreen tem uma faixa oficial de economia. Quer que eu já comece seu cadastro agora? 😊`;
            }
            patch.extras = {
              ...(patch.extras as object),
              discount_lookup_done: true,
              discount_min_percent: min || null,
              discount_max_percent: max || null,
              signup_pitch_sent: true,
            };
            tool_calls.push({
              name: "get_distributor_discount",
              args: { state: estado, distributor: chosen },
            });
            stage = "simulate_discount_concreto";
          } else {
            stage = after;
          }
        }
      }
      else if (stage === "simulate_discount_concreto") {
        const estado = (mergedExtras.estado as string | undefined) ?? "";
        let distribuidora = (mergedExtras.distribuidora as string | undefined) ?? "";
        const valor = Number(mergedExtras.valor_fatura ?? 0);
        const nome = (mergedExtras.client_name as string | undefined) ?? "";
        // Guard: distribuidora precisa estar entre as oficiais do estado.
        const optsCheck2 = (mergedExtras.distributors_options as string[] | undefined) ?? [];
        if (distribuidora && optsCheck2.length > 0) {
          const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const valid = optsCheck2.some((o) => norm(o) === norm(distribuidora) || norm(o).includes(norm(distribuidora)) || norm(distribuidora).includes(norm(o)));
          if (!valid) {
            if (optsCheck2.length === 1) {
              const chosen = optsCheck2[0];
              distribuidora = chosen;
              patch.extras = { ...(patch.extras as object ?? mergedExtras), distribuidora: chosen };
              tool_calls.push({
                name: "save_green_lead_field",
                args: { field: "distribuidora", value: chosen },
              });
            } else {
              patch.extras = { ...(patch.extras as object ?? mergedExtras), distribuidora: null };
              const optsList = optsCheck2.map((d, i) => `${i + 1} - ${d}`).join("\n");
              deterministicText = `${nome ? nome + ", " : ""}só pra confirmar qual é a sua distribuidora no seu estado:\n\n${optsList}\n\nQual dessas é a sua?`;
              stage = "ask_distribuidora";
              return {
                messages: [deterministicText],
                events,
                tool_calls,
                suggested_state_patch: patch,
              };
            }
          }
        }
        let min = 0, max = 0;
        if (estado && distribuidora) {
          const list = await listDistributors(estado);
          const found = list.find((d) =>
            d.distributor.toLowerCase().includes(distribuidora.toLowerCase()) ||
            distribuidora.toLowerCase().includes(d.distributor.toLowerCase()));
          if (found) { min = found.min; max = found.max; }
        }
        if (min > 0 && max > 0 && valor > 0) {
          const economia = (valor * max) / 100;
          deterministicText =
`Olha só${nome ? `, ${nome}` : ""}! Pra ${distribuidora} a média de desconto fica entre ${min}% e ${max}%. Numa conta de R$ ${formatBRL(valor)}, seu desconto pode chegar a R$ ${formatBRL(economia)} todo mês. 🤑

E não é só isso: depois do seu cadastro, você ainda pode chegar a zerar sua conta de luz indicando novos assinantes pelo nosso programa de cashback.

Quer que eu já comece seu cadastro agora? 😉`;
        } else {
          deterministicText = `${nome ? nome + ", " : ""}com a ${distribuidora || "sua distribuidora"} a iGreen tem uma faixa oficial de economia. Quer que eu já comece seu cadastro agora? 😊`;
        }
        patch.extras = {
          ...(patch.extras as object ?? mergedExtras),
          discount_lookup_done: true,
          discount_min_percent: min || null,
          discount_max_percent: max || null,
          signup_pitch_sent: true,
        };
        if (estado && distribuidora) {
          tool_calls.push({
            name: "get_distributor_discount",
            args: { state: estado, distributor: distribuidora },
          });
        }
      }
      else if (stage === "request_invoice") {
        // Alcançado via redecide depois que cliente confirmou o cadastro
        // em confirm_signup. Dispara a tool e zera o texto pra IA gerar.
        tool_calls.push({ name: "request_invoice", args: { reason: "calculo_economia" } });
        deterministicText = null;
      }
    }
  }

  // Handoff humano: IA silencia (sem texto).
  const text = stage === "handoff_human"
    ? ""
    : deterministicText ?? await generateText(ctx, stage);

  return {
    messages: text ? [text] : [],
    events,
    tool_calls,
    suggested_state_patch: patch,
  };
}

function extractConsumo(msg: string): string | null {
  if (!msg) return null;
  const m = msg.match(/(\d{2,5})\s*(kwh|kw|reais|r\$|\$|conta)?/i);
  return m ? m[0].trim() : null;
}

const UF_SET = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);
const ESTADO_NOMES: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amapá":"AP","amazonas":"AM","bahia":"BA",
  "ceara":"CE","ceará":"CE","distrito federal":"DF","espirito santo":"ES","espírito santo":"ES",
  "goias":"GO","goiás":"GO","maranhao":"MA","maranhão":"MA","mato grosso":"MT",
  "mato grosso do sul":"MS","minas gerais":"MG","para":"PA","pará":"PA","paraiba":"PB",
  "paraíba":"PB","parana":"PR","paraná":"PR","pernambuco":"PE","piaui":"PI","piauí":"PI",
  "rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS",
  "rondonia":"RO","rondônia":"RO","roraima":"RR","santa catarina":"SC",
  "sao paulo":"SP","são paulo":"SP","sergipe":"SE","tocantins":"TO",
};
function extractEstado(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim();
  if (!t) return null;
  const upper = t.toUpperCase().replace(/[^A-Z]/g, "");
  if (upper.length === 2 && UF_SET.has(upper)) return upper;
  // Procura UF como token isolado dentro de frases tipo "Estou em SC".
  const tokens = t.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok.length === 2 && UF_SET.has(tok)) return tok;
  }
  const lower = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [name, uf] of Object.entries(ESTADO_NOMES)) {
    if (lower.includes(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return uf;
  }
  return null;
}

function extractDistribuidora(msg: string): string | null {
  if (!msg) return null;
  const t = msg.trim();
  if (t.length < 2 || t.length > 60) return null;
  // Aceita nome livre da distribuidora (texto sem números longos).
  if (/^\d+$/.test(t)) return null;
  // Rejeita se a mensagem inteira for um nome/UF de estado — cliente
  // está respondendo a `ask_estado`, não a `ask_distribuidora`.
  if (extractEstado(t)) return null;
  return t;
}

function extractFirstName(msg: string): string | null {
  if (!msg) return null;
  // Remove prefixos de transcrição automática (áudio/imagem).
  let raw = msg
    .replace(/\[Áudio transcrito\]/gi, "")
    .replace(/\[Áudio\]/gi, "")
    .replace(/\[Documento.*?\]/gi, "")
    .replace(/\[Imagem.*?\]/gi, "")
    .trim();
  if (!raw) return null;

  // Rajada coalescida pelo process-pending-ai
  // ("[O cliente enviou várias mensagens em sequência:]\n1) X\n2) Y").
  // Tenta cada linha em ordem e devolve o primeiro nome válido.
  const lines = splitBurstLines(raw);
  if (lines.length > 1) {
    for (const line of lines) {
      const found = extractFirstName(line);
      if (found) return found;
    }
    return null;
  }
  raw = lines[0] ?? raw;
  if (/\?$/.test(raw)) return null;

  const blocked = new Set([
    "o","a","e","é","eh","ah","oi","ola","olá","sim","nao","não","ok","okay","beleza","blz",
    "mesmo","tudo","bem","tá","ta","obrigado","obrigada","valeu","tchau","bom","boa",
    "quero","saber","como","funciona","tenho","interesse","conexao","conexão","green",
    "energia","luz","conta","fatura","economizar","economia","internet","telecom",
    "qual","quanto","porcentagem","percentual","desconto",
  ]);
  const cleanToken = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const format = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const accept = (value: string | undefined): string | null => {
    const cand = (value ?? "").trim().replace(/[^\p{L}]/gu, "");
    const low = cleanToken(cand);
    if (cand.length < 2 || cand.length > 30 || blocked.has(low)) return null;
    return format(cand);
  };

  const patterns = [
    /\bmeu nome[\s\S]{0,5}(?:é|eh)?\s+([A-Za-zÀ-ÿ]{2,30})/i,
    /\b(?:sou|aqui é|aqui eh)\s+(?:o|a|do|da|de)?\s*([A-Za-zÀ-ÿ]{2,30})/i,
    /\bme chamo\s+([A-Za-zÀ-ÿ]{2,30})/i,
    /\bchamo\s+([A-Za-zÀ-ÿ]{2,30})/i,
  ];
  for (const rx of patterns) {
    const found = accept(raw.match(rx)?.[1]);
    if (found) return found;
  }

  const tokens = raw.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return accept(tokens[0]);
  return null;
}

// ---------- Burst helpers (rajada coalescida) ----------
// O process-pending-ai junta múltiplas mensagens em sequência num único texto:
//   "[O cliente enviou várias mensagens em sequência, considere todas juntas:]
//    1) Walter
//    2) Qual percentual de economia"
// Esses helpers normalizam essa entrada para que extratores e detectores
// que esperam uma mensagem por linha funcionem corretamente.
function splitBurstLines(msg: string | null | undefined): string[] {
  const raw = (msg ?? "").trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*\[[^\]]*\]\s*/, ""))           // remove cabeçalho [..]
    .map((l) => l.replace(/^\s*\d{1,2}[\).\-:]\s*/, ""))     // remove "1) ", "2.", "3-"
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [raw];
}

function cleanBurst(msg: string | null | undefined): string {
  return splitBurstLines(msg).join("\n");
}

function firstHit<T>(lines: string[], fn: (s: string) => T | null | undefined | false): T | null {
  for (const l of lines) {
    const r = fn(l);
    if (r) return r as T;
  }
  return null;
}

function hasExtraValue(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function isDiscountQuestion(msg: string): boolean {
  if (!msg) return false;
  return /\b(qual[\s\S]{0,15}(percentual|porcentagem|desconto|economia)|quanto[\s\S]{0,20}(desconto|economiz)|qual[\s\S]{0,20}minha[\s\S]{0,15}economia|meu[\s\S]{0,10}desconto|meu[\s\S]{0,10}percentual)\b/i.test(msg);
}

async function generateText(ctx: AgentContext, stage: string): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  const userPrompt = buildGreenUserPrompt({
    stage: stage as any,
    message: ctx.message,
    produto: ctx.state.produto,
    extras: (ctx.state.extras ?? {}) as Record<string, unknown>,
    last_ai_question: (ctx.state as any).last_ai_question ?? null,
    turn_index: (ctx.state as any).turn_index ?? undefined,
  });

  const tryOpenAI = async (reason: string): Promise<string | null> => {
    const fb = await openAITextFallback({
      systemPrompt: GREEN_SYSTEM + "\n" + HOLDER_GUARD,
      userPrompt,
      model: "gpt-4o-mini",
      maxTokens: 600,
      temperature: 0.4,
      ctx: { reason, phone: (ctx as any).phone, account_id: (ctx as any).account_id },
    });
    return fb?.text?.trim() || null;
  };

  if (!apiKey) {
    return (await tryOpenAI("gemini_no_api_key")) || fallbackText(stage);
  }
  // Se Gemini estiver marcado como sem créditos, pula direto.
  if (isProviderOutOfCredits("gemini")) {
    return (await tryOpenAI("gemini_circuit_open_credits")) || fallbackText(stage);
  }

  // Modelo: usa lite (mais barato e sem thinking pesado). Sempre desliga
  // thinkingBudget para evitar que tokens de raciocínio consumam o
  // maxOutputTokens e produzam texto truncado nas respostas curtas.
  const model = (ctx as any).selected_model || "gemini-2.5-flash-lite";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: GREEN_SYSTEM + "\n" + HOLDER_GUARD }] },
          contents: [{
            role: "user",
            parts: [{ text: userPrompt }],
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    clearTimeout(timer);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const low = errBody.toLowerCase();
      // 429 quota_exceeded ou 403 com mensagem de billing → trata como sem crédito
      if ((res.status === 429 && /quota/.test(low)) || res.status === 402 || /billing|quota.*exceed/.test(low)) {
        markProviderOutOfCredits("gemini");
      }
      const txt = await tryOpenAI(`gemini_${res.status}`);
      return txt || fallbackText(stage);
    }
    const json = await res.json();
    const txt = (json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    if (txt) return txt;
    const fbTxt = await tryOpenAI("gemini_empty");
    return fbTxt || fallbackText(stage);
  } catch (e) {
    clearTimeout(timer);
    const reason = (e as Error)?.name === "AbortError" ? "gemini_timeout" : "gemini_error";
    const fbTxt = await tryOpenAI(reason);
    return fbTxt || fallbackText(stage);
  }
}

function fallbackText(stage: string): string {
  switch (stage) {
    case "greet": return "Olá! Como posso te ajudar hoje?";
    case "explain_solution": return "A Igreen te dá economia na conta de luz com energia limpa, sem obra e sem trocar de distribuidora. Quer entender melhor como funciona?";
    case "send_video": return "Vou te mandar um vídeo curtinho explicando como funciona, dá uma olhada quando puder.";
    case "engage_check": return "Faz sentido pra você, quer que eu te mostre quanto dá pra economizar?";
    case "ask_consumo": return "Show! Pra te mostrar a economia, quanto vem em média na sua conta de luz por mês?";
    case "ask_estado": return "Perfeito. E em qual estado você está?";
    case "ask_distribuidora": return "Beleza. Qual é a sua distribuidora de energia?";
    case "ask_name": return "Pra ficar mais fácil, como posso te chamar?";
    case "request_invoice": return "Agora me manda sua última fatura (PDF ou foto)? Assim eu já inicio a verificação do seu cadastro.";
    case "waiting_invoice": return "Perfeito, fico no aguardo da fatura.";
    case "ask_full_name_cpf": return "Pra preparar seu contrato, me passa por favor seu nome completo e CPF?";
    case "simulate_discount": return "Com base na sua distribuidora e estado, conseguimos aplicar a faixa oficial de economia da iGreen. Posso seguir com o cálculo exato a partir da sua última fatura?";
    case "ask_valor_fatura": return "Qual o valor médio da sua fatura mensal? Assim posso te mostrar quanto seria sua economia.";
    case "intent_send_invoice_ack": return "Combinado, fico no aguardo da sua fatura.";
    case "request_identity": return "Sua fatura foi validada com sucesso. Para concluirmos, por favor me envie uma foto do RG ou CNH do titular da conta.";
    case "validate_identity": return "Recebi seu documento, estou conferindo aqui.";
    case "waiting_identity": return "Tô no aguardo da foto do RG ou CNH do titular da fatura pra prosseguir, viu?";
    case "family_authorization_check": return "Notei que a conta está em nome de outra pessoa. O titular é alguém da sua família e você tem autorização para seguir com a contratação?";
    case "objection_security": return "Entendo perfeitamente sua preocupação, e é muito importante essa cautela hoje em dia.\n\nSó pra te tranquilizar: a iGreen Energy faz parte do GRUPO BR, o mesmo grupo dos postos de gasolina BR espalhados pelo Brasil inteiro. É uma empresa consolidada no mercado de energia limpa, regulamentada pela ANEEL, parceira oficial das principais distribuidoras e com milhares de clientes ativos. Nosso modelo é assinatura de energia por compensação, sem obra, sem troca de distribuidora e sem custo de adesão — você continua recebendo a mesma fatura da sua distribuidora, só que com desconto.\n\nE pra você ficar ainda mais à vontade, você pode fazer todo o cadastro VOCÊ MESMO, direto pelo nosso app oficial da iGreen, sem precisar passar nenhum dado por aqui. Quer que eu te envie agora o link oficial?";
    case "send_autocadastro_link": return "Perfeito. Aqui está o link oficial do app iGreen para você fazer o cadastro com calma:\n\nhttps://app.igreen.com.br/autocadastro\n\nFico à disposição caso precise de ajuda em qualquer etapa.";
    case "handoff_human": return "";
    default: return "Beleza!";
  }
}