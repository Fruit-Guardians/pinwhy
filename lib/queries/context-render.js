// Markdown rendering for bounded agent context packets.

export function recordedInputTruncation(record) {
  const value = record.inputTruncation;
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length ? value : null;
}

export function compactInputTruncation(record) {
  const value = recordedInputTruncation(record);
  return value ? { inputTruncation: structuredClone(value) } : {};
}

function inputTruncationMarkdown(record) {
  const value = recordedInputTruncation(record);
  return value ? [`  - Note: input was truncated at write time: ${JSON.stringify(value)}`] : [];
}

function nodeMarkdown(item) {
  const fields = ['status', 'severity', 'confidence', 'author', 'updatedBy', 'at']
    .filter((key) => item[key] !== undefined)
    .map((key) => `${key}=${item[key]}`);
  const lines = [`- [${item.id}] ${item.type}: ${item.title}${fields.length ? ` (${fields.join('; ')})` : ''}`];
  lines.push(...inputTruncationMarkdown(item));
  if (item.detail) lines.push(`  - Detail: ${item.detail}`);
  if (item.location) lines.push(`  - Location: ${JSON.stringify(item.location)}`);
  if (item.tags?.length) lines.push(`  - Tags: ${item.tags.join(', ')}`);
  return lines;
}

/** `asOf` (a checkpoint from readEventsAsOf) is stated, not hidden: the packet then shows the past. */
export function renderAgentContext(packet, { asOf = null } = {}) {
  const lines = [];
  lines.push(`# Agent Context${packet.board.title ? ` — ${packet.board.title}` : ''}`);
  lines.push('');
  lines.push(`- Agent: ${packet.request.agentId}`);
  if (asOf) lines.push(`- As of checkpoint: ${asOf.id}${Number.isFinite(asOf.at) ? ` (${new Date(asOf.at).toISOString()})` : ''}; later records are not included`);
  lines.push(`- Focus: ${packet.currentFocus?.id || packet.request.focus || 'none'}`);
  if (packet.omitted.currentFocus) {
    lines.push(`- Focus body omitted (budget); source: pinwhy show ${packet.request.focus} --json`);
  }
  if (packet.request.cursorReason) lines.push(`- Cursor reason: ${packet.request.cursorReason}`);
  if (packet.request.sinceSource) lines.push(`- Since: ${packet.request.sinceSource}`);
  lines.push(`- Budget: ~${packet.estimatedTokens}/${packet.request.budgetTokens} tokens`);
  lines.push(`- Policy: read-only, non-prescriptive, next step selected by Agent`);
  const sections = [
    ['Objectives', packet.objectives],
    ['Open threads', packet.openThreads],
    ['Findings (authored claims; see confidence)', packet.findings],
    ['Confirmed facts', packet.confirmedFacts],
    ['Retired / refuted nodes (not current facts)', packet.retiredNodes || []],
    ['Notes', packet.notes],
    ['Other authored nodes (not classified as confirmed facts)', packet.otherNodes || []],
    ['Recent changes', packet.recentChanges],
  ];
  if (packet.currentFocus) sections.splice(1, 0, ['Current focus', [packet.currentFocus]]);
  for (const [title, items] of sections) {
    lines.push('', `## ${title}`);
    if (!items.length) lines.push('_none_');
    else for (const item of items) lines.push(...nodeMarkdown(item));
  }
  lines.push('', '## Current neighborhood');
  if (!packet.neighborhood.length) lines.push('_none_');
  for (const item of packet.neighborhood) {
    lines.push(...nodeMarkdown(item.node));
    lines.push(`  - Traversal: depth=${item.depth}; direction=${item.direction}; relation=${item.relation}`);
  }
  lines.push('', '## Relations (explicit direction)');
  if (!packet.relations.length) lines.push('_none_');
  for (const relation of packet.relations) {
    lines.push(`- [${relation.id}] [${relation.from}] --${relation.kind}--> [${relation.to}]${relation.label ? `: ${relation.label}` : ''}`);
    lines.push(...inputTruncationMarkdown(relation));
  }
  lines.push('', '## Structural changes');
  if (!packet.changes.length) lines.push('_none_');
  for (const change of packet.changes) {
    lines.push(`- ${change.kind} [${change.id}]${change.kind === 'relation-added' ? `: ${change.from} ${change.relation} ${change.to}` : ''}${change.eventId ? ` (event=${change.eventId})` : ''}`);
    lines.push(...inputTruncationMarkdown(change));
  }
  lines.push('', '## Checkpoints');
  if (!packet.checkpoints.length) lines.push('_none_');
  for (const checkpoint of packet.checkpoints) {
    lines.push(`- [${checkpoint.id}] agent=${checkpoint.agentId || packet.request.agentId}; at=${checkpoint.at}; cursor=${checkpoint.cursorNodeId || 'none'}: ${checkpoint.summary}`);
    lines.push(...inputTruncationMarkdown(checkpoint));
  }
  lines.push('', '## Recent activity');
  if (!packet.recentActivity.length) lines.push('_none_');
  for (const activity of packet.recentActivity) {
    lines.push(`- [${activity.id}] tool=${activity.tool || 'none'}; status=${activity.status || 'unspecified'}; at=${activity.at}: ${activity.summary}`);
    if (activity.linkedNodeIds.length) lines.push(`  - Linked nodes: ${activity.linkedNodeIds.join(', ')}`);
  }
  if (packet.truncated) lines.push('', `Truncated: ${JSON.stringify(packet.omitted)}`);
  return lines.join('\n');
}
