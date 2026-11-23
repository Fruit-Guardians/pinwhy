// Claude Code hook execution and opt-in redacted tool activity capture.

import path from 'node:path';
import { buildDigest } from '../queries/digest.js';
import { isInitialized, readConfig } from '../storage/board.js';
import { replay } from '../storage/event-log.js';
import { addActivity, addCheckpoint, defaultAgentId } from '../store.js';

/** A hook must never hold up the Agent: if another writer has the lock this long, give up. */
const HOOK_LOCK_MS = 1000;

const fileSummary = (prefix, tag) => (input) => {
  const file = String(input.file_path || input.filePath || '');
  return { title: `${prefix} ${path.basename(file)}`, tag, at: file };
};

// Read/Grep/Glob are how a code audit actually moves: the file and the query
// are the evidence, and the file is a jump target.
const TOOL_SUMMARIZERS = {
  Bash: (input) => ({ title: `$ ${String(input.command || '').slice(0, 240)}`, tag: 'bash' }),
  WebFetch: (input) => ({ title: `GET ${String(input.url || '')}`.slice(0, 300), tag: 'http' }),
  WebSearch: (input) => ({ title: `search: ${String(input.query || '')}`.slice(0, 300), tag: 'search' }),
  Write: fileSummary('Write', 'file'),
  Edit: fileSummary('Edit', 'file'),
  Read: fileSummary('read', 'read'),
  Grep: (input) => {
    const where = input.path ? ` in ${path.basename(String(input.path))}` : '';
    // A search has no single line; the query is the evidence.
    return { title: `grep ${String(input.pattern || '')}`.slice(0, 200) + where, tag: 'grep', at: null };
  },
  Glob: (input) => ({ title: `glob ${String(input.pattern || '')}`.slice(0, 200), tag: 'glob' }),
};

/** Tools whose calls become raw activity events. */
export const TOOL_MATCHER = Object.keys(TOOL_SUMMARIZERS).join('|');

function summarizeTool(payload) {
  const tool = payload.tool_name || payload.tool || 'tool';
  const input = payload.tool_input || payload.toolInput || {};
  return Object.hasOwn(TOOL_SUMMARIZERS, tool)
    ? TOOL_SUMMARIZERS[tool](input)
    : { title: `${tool}`, tag: 'tool' };
}

function toolResultText(payload) {
  const r = payload.tool_response ?? payload.tool_result ?? payload.result;
  if (r == null) return '';
  if (typeof r === 'string') return r;
  if (typeof r === 'object') {
    if (typeof r.stdout === 'string' || typeof r.stderr === 'string') {
      return [r.stdout, r.stderr].filter(Boolean).join('\n');
    }
    if (Array.isArray(r.content)) {
      return r.content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('\n');
    }
    if (typeof r.output === 'string') return r.output;
  }
  return '';
}

// A secret name is a whole word run ([\w.-]) containing a keyword. The match starts only where a run
// starts and the lookahead finds the keyword once: unanchored, or with the keyword between two
// backtracking stars, the engine rescans the run per start or per keyword hit, which is quadratic and
// stalls the hook on large tool output. What gets redacted is unchanged.
const SECRET_NAME = '(?<![\\w.-])(?=[\\w.-]*?(?:secret|token|passw(?:or)?d|pwd|api[_-]?key|access[_-]?key|private[_-]?key|credential|cookie))[\\w.-]+';

/** Best-effort scrubbing of what the opt-in activity capture stores. */
export function redactSensitive(value) {
  return String(value || '')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/(authorization["']?\s*[:=]\s*["']?(?:bearer|basic)\s+)[^\s"']+/gi, '$1[REDACTED]')
    // user:password@host in connection strings and URLs. Anchored at "://" with the scheme checked
    // behind it, so a long dotted word run without "://" is not rescanned from every letter.
    .replace(/(:\/\/(?<=\b[a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:)[^\s@/]+@/gi, '$1[REDACTED]@')
    // JSON / env / header style: password: x, "api_key":"x", AWS_SECRET_ACCESS_KEY=x
    .replace(new RegExp(`(${SECRET_NAME}["']?\\s*[:=]\\s*["']?)(?!\\[REDACTED)[^\\s,;"'&}]+`, 'gi'), '$1[REDACTED]')
    .replace(/([?&](?:access_token|api_key|token)=)[^&\s]+/gi, '$1[REDACTED]')
    // well-known token shapes, wherever they appear
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED JWT]');
}

/** Write/Edit carry whole file contents; the activity log only needs to know which file changed. */
function recordedInput(tool, input) {
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const file = input.file_path || input.filePath || input.notebook_path;
    return file ? { file_path: file } : {};
  }
  return input;
}

/** The pinwhy's own CLI calls are already the record; capturing them would only duplicate node text. */
function isPinwhyCall(tool, input) {
  if (tool !== 'Bash') return false;
  const command = String(input.command || '');
  return /(?:^|[;&|(]\s*)(?:\w+=\S*\s+)*(?:\S*\/)?pinwhy(?:\s|$)/.test(command)
    || /\bpinwhy\.js\b/.test(command);
}

export function runHook({ event, payload, cwd = process.cwd(), args = [] }) {
  if (!isInitialized(cwd)) return null;
  const cfg = readConfig(cwd);
  const agentId = defaultAgentId();

  switch (event) {
    case 'SessionStart': {
      // Reinject the digest so a resumed/compacted session starts from the graph.
      const g = replay(cwd);
      if (!Object.keys(g.nodes).length) return null;
      const md = buildDigest(g, cwd, agentId);
      return {
        stdout: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: md,
          },
        }),
        digest: md,
        digestFile: true,
      };
    }

    case 'PreCompact': {
      const summary = payload.summary || payload.compact_summary || args.join(' ');
      const before = buildDigest(replay(cwd), cwd, agentId);
      addCheckpoint({
        summary: summary || before.slice(0, 8000),
        trigger: payload.trigger || 'auto',
        agentId,
      }, cwd, { lockTimeoutMs: HOOK_LOCK_MS * 3 });
      const md = buildDigest(replay(cwd), cwd, agentId);
      return { digest: md, digestFile: true };
    }

    case 'PostToolUse': {
      if (!cfg.autoRecord) return null;
      const name = payload.tool_name || payload.tool || '';
      if (cfg.autoTools && !cfg.autoTools.includes(name)) return null;
      const toolInput = payload.tool_input || payload.toolInput || {};
      if (isPinwhyCall(name, toolInput)) return null;
      const { title, at } = summarizeTool(payload);
      if (!title || title === '$ ' || title === 'GET ') return null;
      const rawInput = JSON.stringify(recordedInput(name, toolInput));
      const scrub = cfg.redact === false ? (x) => String(x || '') : redactSensitive;
      // Scrub first, then truncate: a secret cut in half by the detail limit no
      // longer matches its key name or token shape and would slip through.
      const detailLimit = cfg.detailLimit || 1200;
      const result = scrub(toolResultText(payload)).slice(0, detailLimit);
      const g = replay(cwd);
      const count = Object.keys(g.activities || {}).length;
      if (count >= (cfg.maxActivities || cfg.maxAutoFacts || 4000)) return null;
      addActivity({
        agentId,
        tool: name,
        summary: scrub(title).slice(0, 500),
        input: scrub(rawInput).slice(0, 4000),
        output: result,
        location: at || null,
      }, cwd, { lockTimeoutMs: HOOK_LOCK_MS });
      return null;
    }

    case 'Stop':
      return null;

    default:
      return null;
  }
}
