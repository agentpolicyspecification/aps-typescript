"use strict";

const { execFile, exec } = require("node:child_process");
const { createWriteStream, existsSync } = require("node:fs");
const { chmod, readdir } = require("node:fs/promises");
const { join, basename } = require("node:path");
const { promisify } = require("node:util");
const { get } = require("node:https");

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const OPA_VERSION = "v0.70.0";
const REGO_DIR = join(__dirname, "fixtures/rego");
const WASM_DIR = join(__dirname, "fixtures/wasm");
const OPA_BIN = join(WASM_DIR, "opa");

function opaDownloadUrl() {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64_static" : "amd64_static";
  return `https://github.com/open-policy-agent/opa/releases/download/${OPA_VERSION}/opa_${platform}_${arch}`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);

    function request(location) {
      get(location, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${location}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      }).on("error", reject);
    }

    request(url);
  });
}

async function ensureOpa() {
  try {
    const { stdout } = await execAsync("which opa");
    return stdout.trim();
  } catch {
    // Fall through to download
  }

  if (!existsSync(OPA_BIN)) {
    console.log(`[opa] Downloading OPA ${OPA_VERSION}...`);
    await download(opaDownloadUrl(), OPA_BIN);
    await chmod(OPA_BIN, 0o755);
    console.log(`[opa] Downloaded to ${OPA_BIN}`);
  }

  return OPA_BIN;
}

async function compileRego(opaBin, regoFile) {
  const name = basename(regoFile, ".rego");
  const out = join(WASM_DIR, `${name}.tar.gz`);

  const { stdout } = await execFileAsync(opaBin, ["inspect", "--format=json", regoFile]);
  const info = JSON.parse(stdout);
  // namespaces keys look like "data.aps.input" — strip "data." and replace dots with slashes
  const namespace = Object.keys(info.namespaces ?? {})[0] ?? "data.aps.input";
  const pkg = namespace.replace(/^data\./, "").replace(/\./g, "/");
  const entrypoint = `${pkg}/decision`;

  await execFileAsync(opaBin, [
    "build",
    "--target=wasm",
    `--entrypoint=${entrypoint}`,
    regoFile,
    "--output",
    out,
  ]);
}

module.exports = async function globalSetup() {
  const opaBin = await ensureOpa();

  const regoFiles = (await readdir(REGO_DIR))
    .filter((f) => f.endsWith(".rego"))
    .map((f) => join(REGO_DIR, f));

  await Promise.all(regoFiles.map((f) => compileRego(opaBin, f)));

  console.log(`[opa] Compiled ${regoFiles.length} Rego policies to ${WASM_DIR}`);
};
