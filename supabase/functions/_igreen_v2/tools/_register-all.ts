// Importa e registra todas as tools no boot da edge.
// Registro duplicado = erro (D4).

import { registerTool } from "../tool-router/registry.ts";
import { noopTool } from "./noop.ts";
import { setProductTool } from "./set-product.ts";
import { sendDiscoveryVideoTool } from "./send-discovery-video.ts";
import { requestInvoiceTool } from "./request-invoice.ts";
import { setStageTool } from "./set-stage.ts";

let _registered = false;

export function registerAllTools(): void {
  if (_registered) return;
  registerTool(noopTool);
  registerTool(setProductTool);
  registerTool(sendDiscoveryVideoTool);
  registerTool(requestInvoiceTool);
  registerTool(setStageTool);
  _registered = true;
}