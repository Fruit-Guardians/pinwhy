// Append-only write locking, buffered batch transactions, idempotent receipt recovery,
// and disposable state-cache synchronization.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { applyAll, EVENT_VERSION } from '../domain/model.js';
import { projectReceipts, requestFingerprint, validateRequestId } from '../domain/receipts.js';
import { isStateCacheFresh, readState, writeState } from './board.js';
import { appendRecords, readEvents, replay } from './event-log.js';
import { withFileLock } from './file-lock.js';
import { paths } from './layout.js';

/**
 * @typedef {{ events: Record<string, any>[], corrupt: number, future: number, invalidRecords: number, invalidUtf8: boolean, corruptAt: number[], futureAt: number[], invalidAt: number[], invalidUtf8At: number[], truncated: boolean, incompleteTailBytes: number }} EventLogReadResult
 * @typedef {{ line: number, op: string, ref?: string, eventId?: string, edgeEventIds?: string[], node?: Record<string, any>, truncated?: string[] }} BatchEntry
 * @typedef {{ cwd: string, events: Record<string, any>[], state: Record<string, any> | null, batchEntries?: BatchEntry[] | null, graph?: Record<string, any> }} ActiveTransaction
 * @typedef {{ eventCount: () => number, sliceEvents: (start: number) => Record<string, any>[], setBatchEntries: (entries: BatchEntry[]) => void }} BatchWorkingHandle
 * @typedef {import('../domain/receipts.js').ReceiptRecord} ReceiptRecord
 */

// Only synchronous mutation callbacks run here, under the cross-process lock.
// Buffering lets the first ordinary event carry a complete recovery plan while
// preserving the old event operations for older readers.
/** @type {ActiveTransaction | null} */
let activeRequest = null;

function uniqueId(prefix) {
  const time = Date.now().toString(36);
  const pid = process.pid.toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${time}_${pid}${random}`;
}

function eventRecord(ev) {
  return { eventVersion: ev.eventVersion || EVENT_VERSION, eventId: ev.eventId || uniqueId('event'), ...ev };
}

/**
 * A release that skips newer events cannot see the ids they hold, so writing
 * next to them could hand out a duplicate id. Reading stays available.
 */
function assertWritableLog(cwd) {
  const log = readEvents(cwd, 0);
  const { future } = log;
  if (!future) return log;
  throw new Error(
    `The event log contains ${future} events with eventVersion > ${EVENT_VERSION}; this version cannot replay them. `
    + 'Writes are disabled to prevent ID conflicts; reads remain available. Switch to a newer version: pinwhy release ls / pinwhy release use <version>',
  );
}

/** Cross-process lock. A live lock is never deleted merely because we waited. */
export function withLock(fn, cwd = process.cwd(), timeoutMs = null, { readOnly = false } = {}) {
  const p = paths(cwd);
  if (!fs.existsSync(p.root)) fs.mkdirSync(p.root, { recursive: true });
  // Callers that must never hold up the Agent (hooks) pass a short limit.
  const waitMs = timeoutMs || Number(process.env.PINWHY_LOCK_TIMEOUT_MS) || 10000;
  return withFileLock(p.lock, () => {
    // Every acquisition validates the source afresh while holding the lock.
    const log = readOnly ? undefined : assertWritableLog(cwd);
    return fn(log);
  }, waitMs);
}

/**
 * state.json is a disposable cache. Once the event is appended the action has
 * happened, so a failed cache write must not surface as a failed command
 * (the caller would retry and duplicate the event); readState recovers instead.
 */
export function saveState(state, cwd) {
  if (activeRequest?.cwd === cwd) {
    activeRequest.state = state;
    return;
  }
  try {
    writeState(state, cwd);
  } catch {
    try { fs.unlinkSync(paths(cwd).state); } catch { /* ignore: cache may not exist */ }
  }
}

export function appendEvent(ev, cwd = process.cwd()) {
  const record = eventRecord(ev);
  if (activeRequest?.cwd === cwd) {
    activeRequest.events.push(record);
    // A batch reads its own uncommitted writes; nothing reaches the log until it all succeeds.
    // Replay patches nodes in place, so the graph gets a copy: a later edit in the same batch
    // must not rewrite an earlier buffered event or the result already returned for it.
    if (activeRequest.graph) activeRequest.graph = applyAll(activeRequest.graph, [JSON.parse(JSON.stringify(record))]);
  } else appendRecords([record], cwd);
  return record;
}

/** The graph a write sees: a batch's buffered state, otherwise the log. */
export function workingGraph(cwd, source) {
  return activeRequest?.cwd === cwd && activeRequest.graph ? activeRequest.graph : replay(cwd, source);
}

/**
 * @param {string} cwd
 * @param {EventLogReadResult} [source]
 * @returns {BatchWorkingHandle}
 */
export function prepareWorkingGraph(cwd, source) {
  activeRequest.graph = replay(cwd, source);
  return {
    eventCount: () => activeRequest.events.length,
    sliceEvents: (start) => activeRequest.events.slice(start),
    setBatchEntries: (entries) => { activeRequest.batchEntries = entries; },
  };
}

/**
 * @param {ReceiptRecord | null | undefined} receipt
 * @returns {Omit<ReceiptRecord, '_events'> | null}
 */
function publicReceipt(receipt) {
  if (!receipt) return null;
  const { _events, ...result } = receipt;
  return result;
}

/**
 * A query never completes or otherwise changes an interrupted request.
 * @param {string} requestId
 * @param {string} [cwd]
 */
export function getReceipt(requestId, cwd = process.cwd()) {
  const id = validateRequestId(requestId);
  if (!id) throw new Error('requestId is required');
  return publicReceipt(projectReceipts(readEvents(cwd).events).get(id));
}

function receiptMarker(request) {
  return eventRecord({
    op: 'receipt', requestId: request.requestId, command: request.command,
    fingerprint: request.fingerprint, eventIds: request.eventIds || request.events.map((ev) => ev.eventId),
    at: Date.now(),
  });
}

/**
 * A requested mutation is a recoverable complete-line prefix, not a filesystem
 * transaction: the node, relation and cursor retain their ordinary operations.
 * Its first event embeds the exact plan/result. A commit marker means the whole
 * plan landed. A matching explicit retry resumes a partial plan; unrelated new
 * mutations stop until it is resolved. IDs stay deduplicated across reset.
 * @template T
 * @param {string} command
 * @param {Record<string, any>} payload
 * @param {string | null | undefined} requestId
 * @param {(log: EventLogReadResult) => T} fn
 * @param {string} [cwd]
 * @param {number | null} [timeoutMs]
 * @returns {T}
 */
export function withMutation(command, payload, requestId, fn, cwd, timeoutMs = null) {
  const id = validateRequestId(requestId);
  const fingerprint = id ? requestFingerprint(command, payload) : null;
  return withLock((log) => {
    const receipts = projectReceipts(log.events);
    const previous = id ? receipts.get(id) : null;
    if (previous) {
      if (previous.command !== command || previous.fingerprint !== fingerprint) {
        throw Object.assign(new Error(`request_id_conflict: ${id} was used for a different command or payload`), { code: 'request_id_conflict', status: 409 });
      }
      if (previous.status === 'pending') {
        if (!previous.recoverable) {
          throw Object.assign(new Error(`request_recovery_conflict: ${id} has later unrelated events; inspect the receipt before recovery`), { code: 'request_recovery_conflict', status: 409 });
        }
        const committed = new Set(previous.committedEventIds);
        appendRecords([...previous._events.filter((ev) => !committed.has(ev.eventId)), receiptMarker(previous)], cwd);
        saveState(readState(cwd), cwd);
      } else if (!isStateCacheFresh(cwd)) {
        saveState(readState(cwd, log), cwd);
      }
      return previous.result;
    }
    const pending = [...receipts.values()].find((receipt) => receipt.status === 'pending');
    if (pending) {
      throw Object.assign(new Error(`pending_request: ${pending.requestId}; retry that exact request before a new mutation`), { code: 'pending_request', status: 409, requestId: pending.requestId });
    }
    if (!id) return fn(log);
    const transaction = { cwd, events: [], state: null, batchEntries: null };
    activeRequest = transaction;
    let result;
    try { result = fn(log); } finally { activeRequest = null; }
    if (!transaction.events.length) throw new Error('requested mutation did not produce an event');
    // Clone through JSON so a later caller mutation cannot alter the result
    // preserved in the log, and return exactly what a future retry will read.
    const storedResult = JSON.parse(JSON.stringify(result));
    // Store only tail events and lightweight plan metadata rather than duplicating
    // ev0 or the full result tree on every receipted write.
    const tailEvents = transaction.events.slice(1);
    const requestBase = { requestId: id, command, fingerprint, tailEvents, at: Date.now() };
    const request = command === 'batch' && transaction.batchEntries
      ? { ...requestBase, batchPlan: { refs: storedResult.refs, counts: storedResult.counts, entries: transaction.batchEntries } }
      : command === 'addNode'
        ? { ...requestBase, ...(storedResult.truncated ? { truncated: storedResult.truncated } : {}) }
        : { ...requestBase, result: storedResult };
    const eventIds = transaction.events.map((ev) => ev.eventId);
    const records = transaction.events.map((ev, index) => index === 0 ? { ...ev, request } : ev);
    try {
      appendRecords([...records, receiptMarker({ requestId: id, command, fingerprint, eventIds })], cwd);
    } catch (error) {
      // A failed/ambiguous append may have committed a cursor. Never leave a
      // pre-commit cache that conceals that log state from recovery.
      try { fs.unlinkSync(paths(cwd).state); } catch { /* ignore: cache cleanup best-effort */ }
      throw error;
    }
    if (transaction.state) saveState(transaction.state, cwd);
    return storedResult;
  }, cwd, timeoutMs);
}

/**
 * Buffer writes against the current log under lock and discard them when done.
 * @template T
 * @param {(log: EventLogReadResult) => T} fn
 * @param {string} [cwd]
 * @returns {T}
 */
export function withDryTransaction(fn, cwd = process.cwd()) {
  return withLock((log) => {
    activeRequest = { cwd, events: [], state: null };
    try { return fn(log); } finally { activeRequest = null; }
  }, cwd);
}

export function transactionUniqueId(prefix) {
  return uniqueId(prefix);
}
