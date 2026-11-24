// Deterministic, read-only retrieval over the replayed graph. No filesystem reads,
// inferred evidence, embeddings, or changes to cursors/relations.
import { projectNode } from '../domain/model.js';
import { OUTPUTS } from '../domain/contracts.js';

/** @typedef {{ query?: string, type?: string | string[], tags?: string | string[], status?: string, severity?: string, confidence?: string, relation?: string, relatedTo?: string }} SearchFilters */

/**
 * Parse single, comma-separated, or repeated node type filters.
 * Custom node types are allowed and deduplicated in order; empty segments fail.
 * @param {string | string[]} [type]
 * @returns {string[]}
 */
export function parseTypes(type = []) {
  if (type === undefined || type === null) return [];
  const rawList = Array.isArray(type) ? type : [type];
  if (rawList.length === 0) return [];
  const result = [];
  const seen = new Set();
  for (const item of rawList) {
    if (typeof item !== 'string') {
      throw Object.assign(new Error('--type must contain non-empty type names'), { code: 'invalid_value' });
    }
    for (const segment of item.split(',')) {
      const trimmed = segment.trim();
      if (!trimmed) {
        throw Object.assign(new Error('--type cannot contain empty type names'), { code: 'invalid_value' });
      }
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  return result;
}

/**
 * @param {any} graph
 * @param {SearchFilters & { limit?: number | string, groupBy?: string | string[] }} [options]
 */
export function searchGraph(graph, { limit = 30, groupBy = [], ...filters } = {}) {
  const normalizedLimit = Number(limit);
  if (!Number.isSafeInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 1000) throw new Error('search limit must be an integer from 1 to 1000');
  const parsedGroupBy = parseGroupBy(groupBy);
  const items = selectGraphItems(graph, filters);
  return {
    schema: OUTPUTS.search.schema, readOnly: true, prescriptive: false, query: filters.query ?? '',
    total: items.length, items: items.slice(0, normalizedLimit), truncated: items.length > normalizedLimit,
    ...(parsedGroupBy.length ? { groupBy: parsedGroupBy, groups: groupMatches(items, parsedGroupBy) } : {}),
  };
}

/** @param {string | string[]} [groupBy] */
export function parseGroupBy(groupBy = []) {
  const fields = typeof groupBy === 'string' ? groupBy.split(',') : groupBy;
  if (!Array.isArray(fields) || fields.some((field) =>
    typeof field !== 'string' || (field !== 'severity' && field !== 'status' && !(field.startsWith('tag:') && field.length > 4))) ||
    new Set(fields).size !== fields.length) {
    throw new Error('group-by must name severity, status or tag:<key>, without empty or repeated fields');
  }
  return fields;
}

/** Exact recorded-field filters; callers control ordering, limits and graph traversal. */
export function matchesNodeFields(node, { type, tags = [], status, severity, confidence }) {
  const types = parseTypes(type);
  return (!types.length || types.includes(node.type)) && (!status || node.status === status)
    && (!severity || node.severity === severity) && (!confidence || node.confidence === confidence)
    && tags.every((tag) => (node.tags || []).includes(tag));
}

/**
 * Complete matching set; only searchGraph applies a detail limit.
 * @param {any} graph
 * @param {SearchFilters} [filtersInput]
 */
export function selectGraphItems(graph, {
  query = '', type, tags = [], status, severity, confidence, relation, relatedTo,
} = {}) {
  if (typeof query !== 'string') throw new Error('search query must be a string');
  const types = parseTypes(type);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const tagList = [].concat(tags || []).map(String);
  const filters = { type: types, tags: tagList, status, severity, confidence };
  // One disposable adjacency projection, rather than rescanning all edges for
  // each node. Nothing is persisted or made authoritative.
  const adjacent = new Map();
  for (const edge of Object.values(graph.edges || {})) {
    for (const id of [edge.from, edge.to]) {
      if (!adjacent.has(id)) adjacent.set(id, []);
      adjacent.get(id).push(edge);
    }
  }
  const items = [];
  for (const node of Object.values(graph.nodes || {})) {
    if (!matchesNodeFields(node, filters)) continue;
    const linked = adjacent.get(node.id) || [];
    const relations = linked.filter((edge) => (!relation || edge.kind === relation) &&
      (!relatedTo || (edge.from === relatedTo && edge.to === node.id) || (edge.to === relatedTo && edge.from === node.id)));
    if ((relation || relatedTo) && !relations.length) continue;
    const fields = { id: node.id, type: node.type, title: node.title, detail: node.detail,
      status: node.status, confidence: node.confidence, severity: node.severity,
      tags: (node.tags || []).join(' '), 'loc.path': node.loc?.path, author: node.author,
    };
    const entries = Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.length);
    if (!terms.every((term) => entries.some(([, value]) => value.toLowerCase().includes(term)))) continue;
    const matches = entries.filter(([, value]) => terms.some((term) => value.toLowerCase().includes(term)))
      .map(([field, value]) => ({ field, value }));
    items.push({ id: node.id, node: projectNode(node), matches, relations });
  }
  items.sort((a, b) => ((b.node.updated || b.node.ts || 0) - (a.node.updated || a.node.ts || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return items;
}

export function groupMatches(items, dimensions, { includeNodeIds = false } = {}) {
  const groups = new Map();
  for (const { node } of items) {
    let combinations = [{}];
    for (const dimension of dimensions) {
      let values;
      if (dimension.startsWith('tag:')) {
        const prefix = `${dimension.slice(4)}=`;
        values = [...new Set((node.tags || [])
          .filter((tag) => tag.startsWith(prefix) && tag.length > prefix.length)
          .map((tag) => tag.slice(prefix.length)))];
        if (!values.length) values.push(null);
      } else values = [node[dimension] ?? null];
      combinations = combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [dimension]: value })));
    }
    // A node contributes once per distinct value combination, including each
    // explicit site when it belongs to more than one. Missing values stay null.
    for (const values of combinations) {
      const key = JSON.stringify(values);
      const group = groups.get(key);
      if (group) {
        group.count++;
        if (includeNodeIds) group.nodeIds.push(node.id);
      } else groups.set(key, { values, count: 1, ...(includeNodeIds ? { nodeIds: [node.id] } : {}) });
    }
  }
  return [...groups.values()].sort((a, b) => {
    for (const dimension of dimensions) {
      const av = a.values[dimension], bv = b.values[dimension];
      if (av === bv) continue;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av < bv ? -1 : 1;
    }
    return 0;
  });
}
