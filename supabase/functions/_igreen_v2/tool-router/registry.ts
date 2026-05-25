import type { ToolDefinition } from "./types.ts";

// D4 — registro central. Nomes duplicados quebram o boot da edge (sem override silencioso).
const REGISTRY = new Map<string, ToolDefinition<any>>();

export function registerTool<A>(tool: ToolDefinition<A>): void {
  if (REGISTRY.has(tool.name)) {
    throw new Error(`[tool-router] tool já registrada: ${tool.name}`);
  }
  REGISTRY.set(tool.name, tool as ToolDefinition<any>);
}

export function getTool(name: string): ToolDefinition<any> | undefined {
  return REGISTRY.get(name);
}

export function listTools(): string[] {
  return Array.from(REGISTRY.keys());
}