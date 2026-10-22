import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const srcDir = join(root, 'src');

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = collect(srcDir);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch {
    failed++;
    console.error(`syntax error: ${relative(root, file)}`);
  }
}

if (failed) {
  console.error(`build check failed for ${failed} file(s)`);
  process.exit(1);
}

console.log(`build check passed for ${files.length} source file(s)`);
