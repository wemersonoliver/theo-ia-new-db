// Stub do transport (Fase 3). Único ponto que falaria com WhatsApp.
// Nesta fase apenas loga e retorna o que seria enviado.

import type { PreparedMessage } from "../behavior-engine/prepare.ts";
import { humanize, type HumanizationHint } from "../behavior-engine/humanize.ts";

export interface SendResult {
  delivered: boolean;
  chunks: Array<PreparedMessage & HumanizationHint>;
}

export async function send(args: {
  account_id: string;
  phone: string;
  messages: PreparedMessage[];
}): Promise<SendResult> {
  const chunks = args.messages.map((m) => ({ ...m, ...humanize(m.text) }));
  console.log("[igreen_v2:transport] (stub) would send", {
    account_id: args.account_id,
    phone: args.phone,
    count: chunks.length,
  });
  return { delivered: true, chunks };
}