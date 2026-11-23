// Pinwhy Ultra Harness CLI parser, formatter, and command router.
import fs from 'node:fs';
import path from 'node:path';
import { defaultAgentId } from '../store.js';
import { findRoot, isInitialized } from '../storage/board.js';
import {
  addUltraProbes,
  buildUltraSnapshot,
  excludeUltraSlices,
  markUltraDone,
  nextUltraBatches,
  reopenUltraSlices,
  resetUltra,
  syncUltra,
} from './engine.js';
import { DEFAULT_MAX_SLICE_LINES } from './scanner.js';

const VALUE_FLAGS = new Set([
  '--cwd', '--target', '--scope', '--max-lines', '--budget-lines',
  '--max-slices', '--workers', '--sector', '--at', '--note', '--refs',
  '--depends-on', '--status', '--reason', '--agent',
]);
const REPEAT_FLAGS = new Set(['--refs', '--depends-on']);
const BOOL_FLAGS = new Set(['--json', '--yes', '--no-disk', '--include-aux', '--compact', '--help', '-h', '--version', '-v']);

function usageError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function parseUltraArgs(argv) {
  const positionals = [];
  const opts = { refs: [], dependsOn: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!token.startsWith('-') || token === '-') {
      positionals.push(token);
      continue;
    }
    if (BOOL_FLAGS.has(token)) {
      if (token === '-h') opts.help = true;
      else if (token === '-v') opts.version = true;
      else opts[token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
      continue;
    }
    const eq = token.indexOf('=');
    const flag = eq > 0 ? token.slice(0, eq) : token;
    if (!VALUE_FLAGS.has(flag)) {
      throw usageError('unknown_option', `Unknown option: ${flag}`);
    }
    const value = eq > 0 ? token.slice(eq + 1) : argv[++i];
    if (value === undefined) {
      throw usageError('missing_value', `Option ${flag} requires a value`);
    }
    const key = flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (REPEAT_FLAGS.has(flag)) {
      for (const part of String(value).split(',')) {
        const trimmed = part.trim();
        if (trimmed) opts[key].push(trimmed);
      }
    } else {
      opts[key] = value;
    }
  }
  return { command: positionals[0] || 'help', args: positionals.slice(1), opts };
}

function resolveBoardCwd(opts) {
  if (opts.cwd) return path.resolve(opts.cwd);
  if (process.env.PINWHY_CWD) return path.resolve(process.env.PINWHY_CWD);
  return findRoot(process.cwd()) || process.cwd();
}

function helpText(version) {
  return `pinwhy-ultra v${version} — Deterministic breadth coverage & gap harness for Pinwhy

Usage:
  pinwhy-ultra <command> [options]

Commands:
  sync                       Scan core source/config files, slice large files, track hashes
  add <title...>             Add enumerated check/test probes for Swarm workers
  exclude <target...>        Exclude out-of-scope slices, files, or sectors with --note
  next                       Pull deterministic non-overlapping slice/probe batches within budget
  done <slice|probe...>      Mark items reviewed with note, board refs, and cross-slice deps
  reopen <slice|probe...>    Reopen items back to pending for fresh inspection
  check | status             Read-only audit of breadth coverage, shallow notes, and board gaps
  reset --yes                Reset the Ultra slice ledger (keeps .pinwhy/events.jsonl intact)

Options:
  --cwd <dir>                Project directory owning .pinwhy/
  --target <dir>             Source tree root to scan (defaults to --cwd)
  --scope <relpath>          Restrict scan to a subdirectory or file inside --target
  --max-lines <n>            Max lines per source slice (default: ${DEFAULT_MAX_SLICE_LINES})
  --include-aux              Include tests, snapshots, and markdown docs in sync
  --budget-lines <n>         Line quota per worker batch in next (default: 420)
  --max-slices <n>           Max items per worker batch in next (default: 4)
  --workers <n>              Number of parallel worker batches in next (default: 1)
  --sector <name>            Restrict next or tag new probes to one module sector
  --at <path[:line]>         Optional file or line range anchor for add
  --note <text>              Evidence-backed review/exclusion summary for done or exclude
  --refs <id,...>            Main-board node IDs produced while inspecting this item
  --depends-on <slice,...>   Other slice IDs or paths providing relied-upon guards
  --status <status>          Explicit status: cleared | flagged | excluded
  --reason <text>            Reason for reopening items
  --agent <name>             Explicit agent identity (default: PINWHY_AGENT or agent:primary)
  --no-disk                  Skip disk comparison in check
  --compact                  Omit full slices array in sync/check --json output
  --json                     Emit machine-readable JSON output
`;
}

function formatCheckText(snap) {
  const s = snap.summary;
  const pct = Math.round((s.coverageRatio || 0) * 100);
  const lines = [
    `Pinwhy Ultra · ${snap.initialized ? `${s.coveredSlices}/${s.totalSlices} covered (${pct}%)` : 'not initialized (run pinwhy-ultra sync)'}`,
    `Pending: ${s.pending}  Stale: ${s.stale}  Shallow: ${s.shallow}  Flagged: ${s.flagged}  Cleared: ${s.cleared}  Excluded: ${s.excluded || 0}  Probes: ${s.pendingProbes || 0}/${s.probes || 0}`,
    `Commitments · breadthComplete=${snap.breadthComplete}  commitmentComplete=${snap.commitmentComplete}  unbackedVerdicts=${s.unbackedVerdicts}`,
    `Signals (retain if open boundary) · openThreads=${s.openThreads}  awakenedChains=${s.awakenedChains}  anomalies=${s.unresolvedAnomalies}  humanSignals=${s.humanSignals}  allClear=${snap.allClear}`,
  ];
  if (snap.gaps.untrackedFiles.length) {
    lines.push(`Untracked files on disk (${snap.gaps.untrackedFiles.length}): ${snap.gaps.untrackedFiles.slice(0, 8).join(', ')}`);
  }
  if (snap.gaps.shallowSlices.length) {
    lines.push('Shallow reviews bounced back:');
    for (const item of snap.gaps.shallowSlices.slice(0, 8)) {
      const followups = item.humanFollowups?.length ? ` -> ${item.humanFollowups.join(',')}` : '';
      lines.push(`  - [${item.id}] ${item.path}:${item.startLine}-${item.endLine} (${item.reason}${followups})`);
    }
  }
  return lines.join('\n');
}

function formatNextText(res) {
  if (!res.initialized) return 'Ultra ledger is not initialized. Run: pinwhy-ultra sync';
  if (!res.batches.length) return `No actionable slices or probes (remaining=${res.remainingSlices}).`;
  const lines = [`Remaining items: ${res.remainingSlices} (actionable: ${res.actionableSlices ?? res.remainingSlices})`];
  for (const batch of res.batches) {
    lines.push(`Batch #${batch.workerIndex} · sector=${batch.sector} · ${batch.totalLines} lines`);
    for (const item of batch.slices) {
      const followup = item.humanFollowups?.length ? ` -> ${item.humanFollowups.join(',')}` : '';
      const hint = item.shallowReason ? ` [${item.status}: ${item.shallowReason}${followup}]` : ` [${item.status}]`;
      const blocks = item.blockingFor?.length ? ` (blocks ${item.blockingFor.join(',')})` : '';
      if (item.kind === 'probe') {
        lines.push(`  - ${item.id} [probe] ${item.title} (${item.path}:${item.startLine})${hint}${blocks}`);
      } else {
        lines.push(`  - ${item.id} ${item.path}:${item.startLine}-${item.endLine} (${item.lines}L)${hint}${blocks}`);
      }
    }
  }
  return lines.join('\n');
}

export function runUltraCli({ argv = process.argv.slice(2), version }) {
  const { command, args, opts } = parseUltraArgs(argv);
  if (opts.version) {
    if (opts.json) console.log(JSON.stringify({ schema: 'pinwhy.ultra-version.v1', version }));
    else console.log(version);
    return;
  }
  if (opts.help || command === 'help') {
    process.stdout.write(helpText(version));
    return;
  }

  const cwd = resolveBoardCwd(opts);
  const agent = defaultAgentId({ PINWHY_AGENT: opts.agent || process.env.PINWHY_AGENT || '' });

  if (command === 'sync') {
    const result = syncUltra(cwd, {
      target: opts.target || cwd,
      scope: opts.scope || '',
      maxSliceLines: opts.maxLines ?? DEFAULT_MAX_SLICE_LINES,
      includeAux: Boolean(opts.includeAux),
      compact: Boolean(opts.compact),
      agent,
    });
    if (opts.json) console.log(JSON.stringify(result));
    else {
      const sectorList = (result.snapshot?.sectors || [])
        .map((s) => `${s.sector}(${s.totalSlices})`)
        .join(', ') || 'none';
      console.log(`Synced ${result.stats.totalActive} slices across ${result.stats.filesScanned} files (added ${result.stats.added}, stale ${result.stats.stale}, unchanged ${result.stats.unchanged}, removed ${result.stats.removed}, skippedAux ${result.stats.skippedAux}).`);
      console.log(`Sectors: ${sectorList}`);
    }
    return;
  }

  if (command === 'add') {
    if (!args.length) throw usageError('invalid_usage', 'add requires at least one probe title');
    const result = addUltraProbes(cwd, {
      titles: args,
      sector: opts.sector || '',
      at: opts.at || '',
      dependsOn: opts.dependsOn,
      agent,
    });
    if (opts.json) console.log(JSON.stringify(result));
    else {
      for (const item of result.added) {
        console.log(`+ ${item.id} [${item.sector}] ${item.title}`);
      }
    }
    return;
  }

  if (command === 'exclude') {
    if (!args.length) throw usageError('invalid_usage', 'exclude requires at least one slice ID, path, or sector');
    const result = excludeUltraSlices(cwd, {
      sliceIds: args,
      note: opts.note ?? '',
      agent,
    });
    if (opts.json) console.log(JSON.stringify(result));
    else {
      for (const item of result.excluded) {
        console.log(`${item.id} -> ${item.effectiveStatus}${item.shallowReason ? ` (${item.shallowReason})` : ''} · ${item.path}:${item.startLine}-${item.endLine}`);
      }
    }
    return;
  }

  if (command === 'next') {
    const result = nextUltraBatches(cwd, {
      budgetLines: opts.budgetLines ?? 420,
      maxSlices: opts.maxSlices ?? 4,
      workers: opts.workers ?? 1,
      sector: opts.sector || null,
    });
    if (opts.json) console.log(JSON.stringify(result));
    else console.log(formatNextText(result));
    return;
  }

  if (command === 'done') {
    if (!args.length) throw usageError('invalid_usage', 'done requires at least one slice ID or path');
    const result = markUltraDone(cwd, {
      sliceIds: args,
      note: opts.note ?? '',
      refs: opts.refs,
      dependsOn: opts.dependsOn,
      status: opts.status || null,
      agent,
    });
    if (opts.json) console.log(JSON.stringify(result));
    else {
      for (const item of result.updated) {
        console.log(`${item.id} -> ${item.effectiveStatus}${item.shallowReason ? ` (${item.shallowReason})` : ''} · ${item.path}:${item.startLine}-${item.endLine}`);
      }
    }
    return;
  }

  if (command === 'reopen') {
    if (!args.length) throw usageError('invalid_usage', 'reopen requires at least one slice ID or path');
    const result = reopenUltraSlices(cwd, { sliceIds: args, reason: opts.reason ?? '', agent });
    if (opts.json) console.log(JSON.stringify(result));
    else console.log(`Reopened ${result.reopened.length} slice(s).`);
    return;
  }

  if (command === 'check' || command === 'status') {
    if (!isInitialized(cwd) && opts.cwd && !fs.existsSync(cwd)) {
      throw usageError('invalid_usage', `Project directory does not exist: ${cwd}`);
    }
    const result = buildUltraSnapshot(cwd, {
      target: opts.target || cwd,
      checkDisk: !opts.noDisk,
      compact: Boolean(opts.compact),
    });
    if (opts.json) console.log(JSON.stringify(result));
    else console.log(formatCheckText(result));
    return;
  }

  if (command === 'reset') {
    if (!opts.yes) throw usageError('invalid_usage', 'reset requires --yes confirmation');
    const result = resetUltra(cwd, { agent });
    if (opts.json) console.log(JSON.stringify(result));
    else console.log('Reset Ultra slice ledger.');
    return;
  }

  throw usageError('unknown_command', `Unknown command: ${command}`);
}
