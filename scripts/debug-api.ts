#!/usr/bin/env tsx
import { MDocument } from '@mastra/rag';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  // 1. Тест MDocument.fromText() + chunk
  console.log('=== MDocument.fromText() + chunk ===');
  const doc = MDocument.fromText('Hello world. '.repeat(200), { source: 'test' });
  const result = await doc.chunk({ strategy: 'recursive', maxSize: 512, overlap: 50 });
  console.log('Result type:', typeof result, Array.isArray(result));
  console.log('Result length:', Array.isArray(result) ? result.length : 'N/A');
  if (Array.isArray(result) && result.length > 0) {
    console.log('First chunk:', JSON.stringify(result[0]).slice(0, 200));
  }

  // 2. Тест pdf-parse
  console.log('\n=== pdf-parse ===');
  const mod = await import('pdf-parse');
  console.log('typeof mod.default:', typeof mod.default);
  if (typeof mod.default === 'function') {
    console.log('default.name:', mod.default.name);
  } else if (typeof mod.default === 'object') {
    console.log('default keys:', Object.keys(mod.default));
  }
  // Может сама функция?
  console.log('mod keys:', Object.keys(mod));

  // 3. Тест mammoth
  console.log('\n=== mammoth ===');
  const mammoth = await import('mammoth');
  console.log('keys:', Object.keys(mammoth));
}

main().catch(console.error);
