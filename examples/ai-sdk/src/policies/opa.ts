import { ApsEngine } from "@agentpolicyspecification/core";
import type { AuditHandler } from "@agentpolicyspecification/core";
import { OpaInputPolicy } from "@agentpolicyspecification/opa";

const OPA_BASE_URL = process.env["OPA_URL"] ?? "http://localhost:8181";

/**
 * OPA REST policy: policies evaluated by a running OPA server via HTTP.
 *
 * Prerequisites — start OPA and load the policy:
 *   opa run --server --addr=:8181
 *   curl -X PUT http://localhost:8181/v1/policies/no-ssn \
 *     --data-binary @fixtures/rego/no-ssn-input.rego
 *
 * Override the server URL with the OPA_URL environment variable.
 */
export function createOpaEngine(onAudit: AuditHandler): ApsEngine {
  return new ApsEngine({
    policySet: {
      input: [new OpaInputPolicy("no-ssn", { baseUrl: OPA_BASE_URL }, "aps/input")],
    },
    onAudit,
  });
}
