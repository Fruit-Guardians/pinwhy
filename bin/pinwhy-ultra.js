#!/usr/bin/env node
// Pinwhy Ultra Harness CLI — deterministic breadth coverage & cognitive gap checks
// layered cleanly over the Pinwhy core without altering the core schema or events.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUltraCli } from '../lib/ultra/cli.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

try {
  runUltraCli({ argv: process.argv.slice(2), version: VERSION });
} catch (error) {
  if (process.argv.includes('--json')) {
    process.stderr.write(`${JSON.stringify({
      schema: 'pinwhy.error.v1',
      code: error.code || 'error',
      message: error.message || String(error),
    })}\n`);
  } else {
    process.stderr.write(`pinwhy-ultra: ${error.message || String(error)}\n`);
  }
  process.exitCode = 1;
}
