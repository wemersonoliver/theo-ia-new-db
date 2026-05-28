import type { AssertionResult, Turn } from "./assertions.ts";

export interface ScenarioReport {
  id: string;
  title: string;
  pass: boolean;
  results: AssertionResult[];
  turns: Turn[];
}

export function renderMarkdown(reports: ScenarioReport[], meta: { mode: string }): string {
  const total = reports.length;
  const passed = reports.filter((r) => r.pass).length;
  const failed = total - passed;
  const lines: string[] = [];
  lines.push(`# Igreen Behavioral Validation Report`);
  lines.push("");
  lines.push(`- Modo: **${meta.mode}**`);
  lines.push(`- Gerado em: ${new Date().toISOString()}`);
  lines.push(`- Score: **${passed}/${total}** (${failed} falhas)`);
  lines.push("");
  lines.push(`## Resumo`);
  lines.push("");
  lines.push("| Cenário | Resultado | Falhas |");
  lines.push("|---|---|---|");
  for (const r of reports) {
    const fails = r.results.filter((x) => !x.ok).length;
    lines.push(`| ${r.id} — ${r.title} | ${r.pass ? "✅ PASS" : "❌ FAIL"} | ${fails} |`);
  }
  lines.push("");
  lines.push(`## Detalhes`);
  for (const r of reports) {
    lines.push("");
    lines.push(`### ${r.pass ? "✅" : "❌"} ${r.id} — ${r.title}`);
    const failed = r.results.filter((x) => !x.ok);
    if (failed.length) {
      lines.push("");
      lines.push(`**Assertions falhas:**`);
      for (const f of failed) lines.push(`- \`${f.name}\` — ${f.reason}`);
    }
    lines.push("");
    lines.push(`**Turnos:**`);
    for (let i = 0; i < r.turns.length; i++) {
      const t = r.turns[i];
      lines.push(`- ${i}. **user**: "${t.user}" → **stage**=${t.stage} **etapa**=${t.etapa_funil_before}→${t.etapa_funil_after}`);
      for (const m of t.messages) lines.push(`  - ai: "${m.slice(0, 200)}"`);
    }
  }
  return lines.join("\n");
}