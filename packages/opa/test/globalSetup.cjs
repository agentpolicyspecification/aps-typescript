"use strict";

const { GenericContainer, Wait } = require("testcontainers");
const { readdir, readFile } = require("node:fs/promises");
const { join, basename } = require("node:path");

const REGO_DIR = join(__dirname, "fixtures/rego");
const OPA_PORT = 8181;

async function uploadPolicy(baseUrl, policyId, regoFile) {
  const content = await readFile(regoFile, "utf8");
  const res = await fetch(`${baseUrl}/v1/policies/${policyId}`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: content,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload policy '${policyId}': HTTP ${res.status} — ${text}`);
  }
}

module.exports = async function globalSetup() {
  const container = await new GenericContainer("openpolicyagent/opa:latest")
    .withCommand(["run", "--server", "--addr=:8181"])
    .withExposedPorts(OPA_PORT)
    .withWaitStrategy(Wait.forHttp("/health", OPA_PORT).forStatusCode(200))
    .start();

  const mappedPort = container.getMappedPort(OPA_PORT);
  const baseUrl = `http://localhost:${mappedPort}`;

  process.env.OPA_BASE_URL = baseUrl;
  global.__OPA_CONTAINER__ = container;

  const regoFiles = (await readdir(REGO_DIR))
    .filter((f) => f.endsWith(".rego"))
    .map((f) => ({ id: basename(f, ".rego"), path: join(REGO_DIR, f) }));

  await Promise.all(regoFiles.map(({ id, path }) => uploadPolicy(baseUrl, id, path)));
  console.log(`[opa-server] Running on ${baseUrl}, uploaded ${regoFiles.length} policies`);
};
