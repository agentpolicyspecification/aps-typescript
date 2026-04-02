import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ApsEngine } from "@agentpolicyspecification/core";
import type { AuditHandler } from "@agentpolicyspecification/core";
import { RegoInputPolicy } from "@agentpolicyspecification/rego";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLES = join(__dirname, "../../fixtures/rego");

/**
 * Rego/WASM policy: Rego rules compiled to WebAssembly, evaluated in-process.
 *
 * Prerequisites — compile the bundle before running:
 *   opa build --target=wasm --entrypoint=aps/input/decision \
 *     fixtures/rego/no-ssn-input.rego --output fixtures/rego/no-ssn-input.tar.gz
 */
export function createRegoEngine(onAudit: AuditHandler): ApsEngine {
  return new ApsEngine({
    policySet: {
      input: [new RegoInputPolicy("no-ssn", join(BUNDLES, "no-ssn-input.tar.gz"))],
    },
    onAudit,
  });
}
