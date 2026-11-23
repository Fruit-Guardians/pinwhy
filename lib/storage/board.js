// Board discovery, configuration and the disposable state cache.
import fs from 'node:fs';
import path from 'node:path';
import { NODE_TYPES, TYPE_PREFIX } from '../domain/model.js';
import { paths } from './layout.js';
import { readEvents } from './event-log.js';

export function isInitialized(cwd = process.cwd()) {
  return fs.existsSync(paths(cwd).events);
}

/**
 * The board that owns `start`: the nearest directory at or above it holding
 * `.pinwhy/events.jsonl`, like git finds its repository. Null when there is none.
 */
export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (isInitialized(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The board holds raw agent text (and, with activity capture, tool output), so a
 * new one keeps itself out of version control until someone chooses otherwise.
 */
export function protectBoard(cwd = process.cwd()) {
  const file = path.join(paths(cwd).root, '.gitignore');
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, '# pinwhy data may contain sensitive text; remove this file to track it\n*\n');
  return true;
}

function eventsSize(cwd) {
  try {
    return fs.statSync(paths(cwd).events).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

export function isStateCacheFresh(cwd, logSize = eventsSize(cwd)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(paths(cwd).state, 'utf8'));
    return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._logSize === logSize);
  } catch {
    return false;
  }
}

export function ensure(cwd = process.cwd()) {
  const p = paths(cwd);
  if (!fs.existsSync(p.root)) {
    fs.mkdirSync(p.root, { recursive: true });
    protectBoard(cwd);
  }
  if (!fs.existsSync(p.events)) fs.writeFileSync(p.events, '');
  if (!fs.existsSync(p.state)) writeState(eventsSize(cwd) > 0 ? recoverState(cwd) : defaultState(), cwd);
  if (!fs.existsSync(p.config)) fs.writeFileSync(p.config, JSON.stringify(defaultConfig(), null, 2));
  return p;
}

export function defaultState() {
  const seq = {};
  for (const t of NODE_TYPES) seq[TYPE_PREFIX[t]] = 0;
  return {
    session: `session_${Date.now().toString(36)}`,
    title: '',
    started: new Date().toISOString(),
    focus: null,
    cursors: {},
    seq, // retained only so older installations remain readable
    hooks: true,
  };
}

export function defaultConfig() {
  return {
    // Only honored when optional hooks are explicitly installed. The normal
    // path remains direct Agent read/write calls.
    autoRecord: true,
    autoTools: ['Bash', 'WebFetch', 'WebSearch', 'Write', 'Edit', 'Read', 'Grep', 'Glob'],
    maxActivities: 4000,
    maxAutoFacts: 4000, // legacy alias
    detailLimit: 1200,
    redact: true,
    digest: {
      maxNeighbors: 16,
      maxTrail: 10,
      maxOpenNodes: 16,
      maxCheckpoints: 6,
    },
  };
}

/** Derive the canonical post-reset session ID from a `reset` event record. */
export function resetSessionId(ev) {
  const recorded = ev?.request?.result?.session;
  if (typeof recorded === 'string' && recorded) return recorded;
  if (typeof ev?.eventId === 'string' && ev.eventId) {
    return `session_${ev.eventId.replace(/^event_/, '')}`;
  }
  return null;
}

/** The cache a log implies: what state.json holds once rebuilt from `events`. */
export function stateFromEvents(events, base = null) {
  const state = base ? { ...defaultState(), ...base, title: '', focus: null, cursors: {} } : defaultState();
  for (const ev of events) {
    if (ev?.op === 'reset') {
      const fresh = defaultState();
      const resetSession = resetSessionId(ev);
      if (resetSession) fresh.session = resetSession;
      const recordedStarted = ev.request?.result?.started;
      if (typeof recordedStarted === 'string' && recordedStarted) fresh.started = recordedStarted;
      Object.assign(state, fresh);
    } else if (ev?.op === 'meta' && ev.set) {
      if (ev.set.title !== undefined) state.title = ev.set.title;
      if (ev.set.session !== undefined) state.session = ev.set.session;
      if (ev.set.focus !== undefined) state.focus = ev.set.focus;
    } else if (ev?.op === 'cursor' && ev.cursor?.agentId) {
      state.cursors[ev.cursor.agentId] = ev.cursor.to || null;
      if (ev.cursor.agentId === 'agent:primary') state.focus = ev.cursor.to || null;
    }
  }
  return state;
}

export function recoverState(cwd) {
  return stateFromEvents(readEvents(cwd, 0).events);
}

export function readState(cwd = process.cwd(), source = undefined) {
  const p = paths(cwd);
  try {
    const parsed = JSON.parse(fs.readFileSync(p.state, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid state cache');
    const { _logSize, ...rest } = parsed;
    const cached = { ...defaultState(), ...rest, cursors: rest.cursors || {} };
    const currentSize = eventsSize(cwd);
    if ((typeof _logSize === 'number' && _logSize === currentSize)
      || (currentSize === 0 && !source?.events?.length)) {
      return cached;
    }
    const events = source?.events ?? readEvents(cwd, 0).events;
    return stateFromEvents(events, cached);
  } catch {
    return source?.events ? stateFromEvents(source.events) : recoverState(cwd);
  }
}

export function writeState(state, cwd = process.cwd()) {
  const p = paths(cwd);
  const { _logSize: _drop, ...clean } = state;
  const tmp = `${p.state}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...clean, _logSize: eventsSize(cwd) }, null, 2));
  fs.renameSync(tmp, p.state);
  return clean;
}

export function readConfig(cwd = process.cwd()) {
  const defaults = defaultConfig();
  const p = paths(cwd);
  try {
    const parsed = JSON.parse(fs.readFileSync(p.config, 'utf8'));
    return { ...defaults, ...parsed, digest: { ...defaults.digest, ...(parsed.digest || {}) } };
  } catch {
    return defaults;
  }
}
