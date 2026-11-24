import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openWebModules } from '../helpers/load-web-module.mjs';

const web = await openWebModules();
after(() => web.close());
const { endpoint } = await web.load('/src/api/endpoint.ts');
const { createGraphSubscription } = await web.load('/src/api/graph-stream.ts');

const PREFIX = 'http://127.0.0.1:4333/pinwhy-viewer/synthetic-token/';

/** A host serves the page under a token prefix; the document base carries it. */
function withDocument(baseURI, run) {
  Object.defineProperty(globalThis, 'document', { value: { baseURI }, configurable: true });
  try { return run(); } finally { delete globalThis.document; }
}

test('without a document every endpoint stays exactly as written for Node tests and static exports', () => {
  for (const request of ['/api/graph', '/events', '/api/status', '/api/receipt?requestId=a%2Fb']) {
    assert.equal(endpoint(request), request);
  }
});

test('with a document every endpoint resolves against its base and keeps the prefix', () => {
  withDocument(PREFIX, () => {
    assert.equal(endpoint('/api/graph'), `${PREFIX}api/graph`);
    assert.equal(endpoint('/events'), `${PREFIX}events`);
    assert.equal(endpoint('/api/status'), `${PREFIX}api/status`);
    assert.equal(endpoint('/api/receipt?requestId=a%2Fb'), `${PREFIX}api/receipt?requestId=a%2Fb`);
  });
});

test('a page served from a file or nested document directory resolves inside that directory', () => {
  withDocument('file:///tmp/pinwhy-export/index.html', () => {
    assert.equal(endpoint('/api/graph'), 'file:///tmp/pinwhy-export/api/graph');
  });
  withDocument('http://127.0.0.1:4333', () => {
    assert.equal(endpoint('/api/graph'), 'http://127.0.0.1:4333/api/graph');
  });
});

test('the graph subscription reads and streams through the prefixed document base', async () => {
  const calls = [];
  let streamUrl;
  const graph = { meta: { title: 'Synthetic' }, nodes: {}, edges: {} };
  Object.defineProperty(globalThis, 'document', { value: { baseURI: PREFIX }, configurable: true });
  const subscription = createGraphSubscription(() => {}, {
    ports: {
      async fetch(url) { calls.push(url); return { ok: true, status: 200, json: async () => graph }; },
      openStream(url) { streamUrl = url; return { addEventListener() {}, onerror: null, close() {} }; },
      now() { return 1; },
    },
  });
  try {
    await subscription.reload();
    assert.deepEqual([...new Set(calls)], [`${PREFIX}api/graph`]);
    assert.equal(streamUrl, `${PREFIX}events`);
    assert.equal(subscription.getState().snapshot.meta.title, 'Synthetic');
  } finally {
    subscription.dispose();
    delete globalThis.document;
  }
});
