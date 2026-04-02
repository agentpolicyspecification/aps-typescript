import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ApsEngine } from "@agentpolicyspecification/core";
import { DslInputPolicy, DslOutputPolicy } from "@agentpolicyspecification/dsl";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "../../fixtures/dsl");

export function createDslEngine(): ApsEngine {
  return new ApsEngine({
    policySet: {
      input: [new DslInputPolicy("no-pii-input", FIXTURES)],
      output: [new DslOutputPolicy("no-blocked-word-output", FIXTURES)],
    },
  });
}
