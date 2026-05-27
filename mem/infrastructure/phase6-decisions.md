---
name: iGreen v2 Phase 6 Decisions (D22–D28)
description: Optimization, scalability and operational intelligence invariants for iGreen v2 (model router, compression, breaker, pressure, cost profiles, analytics)
type: feature
---
# D22 — Smart Model Router
Task-type → model mapping with cost profiles (balanced/economy/performance).
Flash-Lite for simple_confirm/small_talk/classification/summary; Flash for rag_synthesis; Pro for objection_handling/long_analysis.
Selector consults circuit-breaker + degradation-detector and walks the FALLBACK_CHAIN (pro → flash → flash-lite) before persisting decision in `igreen_model_routing`.

# D23 — Prompt Compression
Inviolables: last 2 conversation messages + guardrails string preserved verbatim.
Targets ≥35% token reduction (achieved 74% under stress). Metrics persisted in `igreen_prompt_compression`.

# D24 — Provider Health & Circuit Breaker
5 consecutive failures open the breaker for 60s cooldown; half_open tests one call.
Recorder updates `igreen_provider_health` (success/failure/timeout counts + latency).
Selector treats `open` OR `degraded` as fallback trigger.

# D25 — Queue Pressure & Shed Load
Thresholds (in_flight, 30s window): medium=10, high=25, critical=50.
Mode mapping: low/medium=normal, high=degraded, critical=shed_load.
`shouldShed`: hot always allowed; warm shed (5s retry) and cold shed (15s retry) under shed_load.
Degraded mode forces skip_rag=true and chunk_limit=3.

# D26 — Conversation Priority
Tier from score: hot ≥60, warm ≥20, cold <20.
Hot boosters: payment_stage(+50), invoice_validated(+25), recent_reply <2m (+30).
Penalty: stale >24h (−20). Persisted in `igreen_conversation_priority` (upsert by account_id,phone).

# D27 — Adaptive Cost Profiles
Per-account profile in `igreen_cost_profiles` (balanced/economy/performance) with optional `overrides` JSONB.
`adjustForPressure`: high → top_k/2, threshold+0.05, retries=1; critical → top_k=0, threshold=0.95, retries=0.

# D28 — Analytics & Operational Metrics
Every turn writes: `cost.turn_cents`, `cost.turn_savings_cents`, `latency.specialist.run`, `latency.rag.retrieve`, `latency.transport.send`, `turn.total_ms` into `igreen_operational_metrics` (correlation_id mandatory).
View `igreen_phase6_metrics` aggregates hourly p50/p95.
State-engine remains the single writer for `igreen_lead_data` (D13/D14/D15 preserved).
