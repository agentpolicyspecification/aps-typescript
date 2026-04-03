import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '../../../schemas');
const outDir = join(__dirname, '../src/generated');

await mkdir(outDir, { recursive: true });

const files = (await readdir(schemasDir)).filter(f => f.endsWith('.schema.json'));

for (const file of files) {
  const schema = JSON.parse(await readFile(join(schemasDir, file), 'utf-8'));
  const ts = await compile(schema, schema.title ?? basename(file, '.schema.json'), {
    bannerComment: `/* eslint-disable */\n// This file is auto-generated from ${file}. Do not edit manually.`,
    cwd: schemasDir,
  });

  const outFile = join(outDir, basename(file, '.schema.json') + '.ts');
  await writeFile(outFile, ts, 'utf-8');
  console.log(`Generated ${outFile}`);
}
