import { runScenario } from "./supabase/functions/_igreen_v2/testing/conversation-runner.ts";
import { SCENARIOS } from "./supabase/functions/_igreen_v2/testing/scenarios/index.ts";

let pass = 0, fail = 0;
for (const sc of SCENARIOS) {
  try {
    const turns = await runScenario(sc.steps, { mockGreen: true, initialState: sc.initialState });
    const results = sc.run(turns);
    const allOk = results.every((r) => r.ok);
    if (allOk) { pass++; console.log(`✅ ${sc.id}`); }
    else {
      fail++;
      console.log(`❌ ${sc.id} — ${sc.title}`);
      for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.name}: ${r.reason}`);
      console.log(`   stages: ${turns.map((t) => `${t.specialist}:${t.stage}`).join(" → ")}`);
    }
  } catch (e) {
    fail++; console.log(`💥 ${sc.id} — ${(e as Error).message}`);
  }
}
console.log(`\nTotal: ${pass} PASS / ${fail} FAIL`);
