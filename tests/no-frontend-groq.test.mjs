import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const frontendRoots = [
  'App.tsx',
  'constants.tsx',
  'index.tsx',
  'types.ts',
  'components',
  'services',
  'src',
  'public',
  'vite.config.ts',
  'package.json',
  'tsconfig.json',
];
const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.html',
  '.json',
]);
const forbiddenPatterns = [
  {
    name: 'legacy aiService import or re-export',
    pattern: /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)(["'])(?:[^"']*\/)?aiService(?:\.ts)?\1/,
  },
  {
    name: 'direct Groq endpoint',
    pattern: /api\.groq\.com/i,
  },
  {
    name: 'frontend Groq API key reference',
    pattern: /VITE_GROQ_API_KEY/,
  },
];

async function collectFrontendSourceFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  let metadata;
  try {
    metadata = await stat(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (metadata.isFile()) {
    const extension = path.extname(relativePath);
    return sourceExtensions.has(extension) ? [absolutePath] : [];
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childRelativePath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFrontendSourceFiles(childRelativePath));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(root, childRelativePath));
    }
  }
  return files;
}

test('frontend contains no legacy Groq client, direct endpoint, or exposed key reference', async () => {
  const files = (await Promise.all(
    frontendRoots.map(collectFrontendSourceFiles)
  )).flat();
  const violations = [];

  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(contents)) {
        violations.push(`${path.relative(root, file)}: ${forbidden.name}`);
      }
      forbidden.pattern.lastIndex = 0;
    }
  }

  assert.deepEqual(violations, []);
});

test('Vite does not inject Gemini API keys into the frontend bundle', async () => {
  const viteConfig = await readFile(path.join(root, 'vite.config.ts'), 'utf8');
  assert.doesNotMatch(viteConfig, /GEMINI_API_KEY|process\.env\.API_KEY/);
});
