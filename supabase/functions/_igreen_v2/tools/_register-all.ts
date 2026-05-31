// Importa e registra todas as tools no boot da edge.
// Registro duplicado = erro (D4).

import { registerTool } from "../tool-router/registry.ts";
import { noopTool } from "./noop.ts";
import { setProductTool } from "./set-product.ts";
import { sendDiscoveryVideoTool } from "./send-discovery-video.ts";
import { requestInvoiceTool } from "./request-invoice.ts";
import { setStageTool } from "./set-stage.ts";
import { validateGreenInvoiceTool } from "./validate-green-invoice.ts";
import { saveGreenLeadFieldTool } from "./save-green-lead-field.ts";
import { getDistributorDiscountTool } from "./get-distributor-discount.ts";
import { validateGreenIdentityTool } from "./validate-green-identity.ts";
import { addContactTagTool } from "./add-contact-tag.ts";
import { requestHumanHandoffTool } from "./request-human-handoff.ts";

let _registered = false;

export function registerAllTools(): void {
  if (_registered) return;
  registerTool(noopTool);
  registerTool(setProductTool);
  registerTool(sendDiscoveryVideoTool);
  registerTool(requestInvoiceTool);
  registerTool(setStageTool);
  registerTool(validateGreenInvoiceTool);
  registerTool(saveGreenLeadFieldTool);
  registerTool(getDistributorDiscountTool);
  registerTool(validateGreenIdentityTool);
  registerTool(addContactTagTool);
  registerTool(requestHumanHandoffTool);
  _registered = true;
}