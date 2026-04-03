import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '../', 'schemas');

const schemas = [
  'input-context.schema.json',
  'output-context.schema.json',
  'policy-decision.schema.json',
  'tool-call-context.schema.json',
  'dsl-policy.schema.json',
  'policy-set.schema.json',
  'base.schema.json'
];

const baseUrl = 'https://raw.githubusercontent.com/agentpolicyspecification/spec/refs/heads/main/schemas/v0.1.0';

await mkdir(schemasDir, { recursive: true });

for (const schema of schemas) {
  const url = `${baseUrl}/${schema}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  await writeFile(join(schemasDir, schema), content, 'utf-8');
  console.log(`Downloaded ${schema}`);
}
