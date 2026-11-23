// Claude Code hook settings manipulation, binary resolution, and launcher helpers.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Recovery hooks, installed by default: re-inject the digest and checkpoint before compaction. */
export const HOOK_EVENTS = ['SessionStart', 'PreCompact'];
/** Raw tool-call capture is opt-in (`hooks install --with-activity`): it records tool input and output. */
export const ACTIVITY_HOOK_EVENT = 'PostToolUse';
export const ALL_HOOK_EVENTS = [...HOOK_EVENTS, ACTIVITY_HOOK_EVENT];

export function isOurHook(entry, ev) {
  const raw = JSON.stringify(entry);
  return typeof raw === 'string' && raw.includes(`hook ${ev}`) && raw.includes('.pinwhy/events.jsonl');
}

export function withoutOurHooks(entries, event) {
  return entries.flatMap((entry) => {
    if (!isOurHook(entry, event)) return [entry];
    const hooks = (entry.hooks || []).filter((handler) => !isOurHook(handler, event));
    return hooks.length ? [{ ...entry, hooks }] : [];
  });
}

export function resolveNodeBinary(execPath = process.execPath, env = process.env) {
  // Two fnm paths go stale: the per-shell "fnm_multishells" path disappears with
  // the shell, and a pinned "node-versions/<v>" path disappears when that version
  // is uninstalled. In both cases swap in fnm's stable "default" alias; every
  // other install keeps the interpreter we are actually running under.
  const pinned = /^(.*)[\\/]node-versions[\\/][^\\/]+[\\/]installation(?:[\\/]bin)?[\\/]node(?:\.exe)?$/.exec(execPath);
  if (!pinned && !execPath.includes('fnm_multishells')) return execPath;
  const windows = /\.exe$/i.test(execPath);
  const paths = execPath.includes('\\') ? path.win32 : path;
  const data = windows ? env.APPDATA || paths.join(os.homedir(), 'AppData', 'Roaming')
    : env.XDG_DATA_HOME || paths.join(os.homedir(), '.local', 'share');
  const base = pinned?.[1] || env.FNM_DIR || paths.join(data, 'fnm');
  const stable = windows ? paths.join(base, 'aliases', 'default', 'node.exe')
    : paths.join(base, 'aliases', 'default', 'bin', 'node');
  try {
    if (fs.existsSync(stable)) return stable;
  } catch { /* fallback to current execPath if fnm alias check fails */ }
  return execPath;
}

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

// Claude shell-form hooks use Git Bash on Windows. Forward slashes work both
// in Git Bash and in the native Node process it launches.
function hookPath(value) {
  return process.platform === 'win32' ? value.replaceAll('\\', '/') : value;
}

export function hookCommand(cli, event) {
  // Two guards, both deliberate:
  //  - hooks run through a shell with a narrower PATH than an interactive one
  //    (node here comes from fnm), so pin the interpreter we are running under;
  //  - a globally installed hook fires in every project, so exit in the shell
  //    when this project has no graph, instead of paying node startup each tool call.
  // biome-ignore lint/suspicious/noTemplateCurlyInString: shell variable expansion runs in hook subshell
  const dir = '"${CLAUDE_PROJECT_DIR:-$PWD}"';
  const nativeDir = process.platform === 'win32' ? '"$(cygpath -m "$dir")"' : '"$dir"';
  return (
    `dir=${dir}; ` +
    // biome-ignore lint/suspicious/noTemplateCurlyInString: bash parameter substitution runs in hook subshell
    (process.platform === 'win32' ? "dir=\"${dir//'\\'//}\"; " : '') +
    '[ -f "$dir/.pinwhy/events.jsonl" ] && ' +
    `PINWHY_CWD=${nativeDir} exec ${shellQuote(hookPath(resolveNodeBinary()))} ${shellQuote(hookPath(cli))} hook ${event} || true`
  );
}

export function settingsPathFor({ scope, cwd }) {
  return scope === 'user'
    ? path.join(os.homedir(), '.claude', 'settings.json')
    : path.join(cwd, '.claude', 'settings.json');
}

export function editClaudeSettings({ scope, cwd, write }, mutate) {
  const file = settingsPathFor({ scope, cwd });
  let raw = null;
  try {
    raw = fs.readFileSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let settings = {};
  if (raw !== null) {
    try {
      settings = JSON.parse(raw.toString('utf8'));
    } catch (error) {
      throw new Error(`Cannot parse existing settings ${file}: ${error.message}`);
    }
  }
  settings.hooks = settings.hooks || {};
  const extra = mutate(settings.hooks) || {};
  const plan = JSON.stringify({ hooks: settings.hooks }, null, 2);
  if (write) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (raw !== null) fs.writeFileSync(`${file}.pinwhy-backup`, raw);
    fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  }
  return { file, plan, write, ...extra };
}

export function launcherBody(cli) {
  const node = resolveNodeBinary();
  if (process.platform !== 'win32') return `#!/bin/sh\nexec ${shellQuote(node)} ${shellQuote(cli)} "$@"\n`;
  // Quoted batch paths protect cmd metacharacters; percent escapes prevent
  // environment expansion, and delayed expansion must stay off for literal !.
  const quote = (value) => `"${value.replaceAll('%', '%%')}"`;
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    // Decode the UTF-8 paths below even on a legacy Windows console code page.
    'for /f "tokens=2 delims=:" %%p in (\'chcp\') do set "_pinwhy_codepage=%%p"',
    'chcp 65001 >nul',
    `${quote(node)} ${quote(cli)} %*`,
    'set "_pinwhy_exit=%errorlevel%"',
    'chcp %_pinwhy_codepage% >nul',
    'exit /b %_pinwhy_exit%',
    '',
  ].join('\r\n');
}

export function launcherDir(scope, cwd = process.cwd()) {
  return scope === 'user' ? path.join(os.homedir(), '.local', 'bin') : path.join(cwd, '.bin');
}

export function launcherName() {
  return process.platform === 'win32' ? 'pinwhy.cmd' : 'pinwhy';
}
