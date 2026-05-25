import type { AutomationResult } from "../types.ts";
import { withIdempotency } from "./_idempotency.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;
function svc() {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _client;
}

export async function taggingAutomation(args: {
  account_id: string;
  phone: string;
  tag: string;
  correlation_id?: string | null;
}): Promise<AutomationResult> {
  return withIdempotency(
    {
      account_id: args.account_id,
      phone: args.phone,
      automation: "tagging",
      idempotency_key: `tag:${args.account_id}:${args.phone}:${args.tag}`,
      correlation_id: args.correlation_id ?? null,
    },
    async () => {
      try {
        await svc().rpc("tag_contact_reserved", {
          _account_id: args.account_id,
          _phone: args.phone,
          _tag: args.tag,
          _add: true,
        });
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
      return {
        success: true,
        events: [{
          type: "contact_tagged", priority: "low", source: "automation",
          payload: { tag: args.tag },
        }],
      };
    },
  );
}