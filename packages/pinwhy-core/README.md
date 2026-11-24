# pinwhy-core

Event-sourced Node.js SDK for Pinwhy. Requires Node.js >= 18; zero runtime dependencies.

## Install

```sh
npm install pinwhy-core
```

## Usage

```js
import { ensure, addNode, addEdge, replay, buildAgentContext } from 'pinwhy-core';

const cwd = '/path/to/project';
ensure(cwd);

const goal = addNode({ type: 'goal', title: 'Verify authorization boundary' }, cwd).node;
const obs = addNode({ type: 'observation', title: 'Anonymous GET returned 403' }, cwd).node;
addEdge({ from: obs.id, to: goal.id, kind: 'supports' }, cwd);

const context = buildAgentContext(replay(cwd), { budgetTokens: 4000 });
console.log(context);
```

## Subpath Exports

| Entry | Environment | Purpose |
| --- | --- | --- |
| `pinwhy-core` | Node.js | Primary facade (model, store, context, search, history, backup) |
| `pinwhy-core/model` | Browser & Node.js | Pure event reduction and graph model (zero imports) |
| `pinwhy-core/store` | Node.js | Locked event writes, receipts, and board state |
| `pinwhy-core/context` | Node.js | Budgeted read-only context projection |
| `pinwhy-core/search` | Node.js | Structured node filtering and text search |
| `pinwhy-core/history` | Node.js | Checkpoint diffs and historical replay |
| `pinwhy-core/backup` | Node.js | Backup creation, verification, and restore |
| `pinwhy-core/contracts` | Node.js | Schema identifiers and capability constants |

## Notes

- `.pinwhy/events.jsonl` is the single source of truth. Importing the package does not initialize `.pinwhy/` or start services; pass `cwd` explicitly to filesystem operations.
- Release tarballs are staged from the root `lib/` directory via `npm run pack:packages`.

## License

MIT
