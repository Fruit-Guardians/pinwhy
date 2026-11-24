# Pinwhy Web Workspace UI

Technical overview of the browser workspace in `web/src/`. General, Security Audit, and Ultra modes are read-only projections over the same board snapshot unless the user explicitly submits an edit.

## Layout & Chrome

- **Top bar (`48px` on desktop, two rows below `1024px`)**: sidebar toggle, brand/about trigger, board title, mode switch (`General` / `Audit` / `Ultra`), view switch (`Context` / `Logic` / `Global`), Agent perspective selector (shown when multiple perspectives exist), `⌘K` search, optional activity log, timeline, new-node dialog, digest dialog, preferences (`⌘,`), and theme toggle.
- **Preferences (`⌘,`)**: browser-local settings stored in `localStorage` (theme, locale, font scales, node card palette, grid backdrop, edge style, layout direction, Inspector width `340–560px`, audit provenance display, motion preference, JSON preset import/export, and About panel). Changing preferences never writes board events.
- **Sidebar (`256px`, collapsible)**: groups records into current focus, goals, open items, findings, and unconnected nodes, with independent badges for `status`, `severity`, and `confidence`, plus facet filtering.
- **2D Canvas (`web/src/canvas/`)**: React Flow + ELK layered layout (`gridLayout` fallback on error).
  - Semantic zoom: `< 65%` headline only; `65–90%` headline + type/status; `>= 90%` detail excerpt and source path.
  - Selecting or hovering a node highlights explicit 1-hop neighbors and edges; `Escape` clears selection, arrow keys traverse 1-hop edges, `Z` frames the 1-hop neighborhood, `F` fits all visible nodes, `C` centers the current cursor.
  - Floating bottom-left toolbar provides framing, layout direction, legend, minimap (`M`), preferences, PNG export (`<= 8000px`), `2.5D` toggle, and zoom controls.
- **Inspector (`web/src/panels/`)**: floating right-hand panel (`340–560px` resizable on desktop, bottom sheet on narrow viewports) showing orthogonal metadata, copyable node ID and source location, grouped incoming/outgoing relations, and conflict-checked edit forms.
- **Host Embedding**: embedded mode uses a single compact toolbar and adopts validated host theme, locale, and font tokens without overwriting standalone `localStorage` preferences.

## Workspace Modes

- **General**: 2D canvas (`Context`, `Logic`, `Global`) and optional lazy-loaded `2.5D` WebGL view (`web/src/scene3d/`). If WebGL or chunk loading fails (including offline exports), it falls back to the 2D canvas.
- **Security Audit (`web/src/workspace/shells/audit/`)**:
  - Collapsible Issue -> Candidate outline, `severity × confidence × status` overview matrix, and candidate dossier (`Supports` vs `Contradictions` & `Conditions`) plus routed argument graph toggle.
  - Second-hop premises attach under the support card they back; local counterarguments and conditions stay scoped to their target card rather than being promoted to root counterevidence.
  - Shared nodes preserve a single identity and render cross-references instead of duplicating mutations; multi-author boards display factual provenance indicators (`Open dispute`, `Cross-verified`, `Single-source`).
- **Ultra (`web/src/workspace/shells/ultra/`)**: read-only coverage, probe, and dependency-gap view backed by `.pinwhy/ultra/ledger.jsonl`.

## Mutation & Recovery Rules

- Navigation state (mode, view, selected node, Agent perspective, timeline point) is URL/client state and never writes events or moves an Agent cursor.
- Explicit user edits carry a unique `requestId` and expected field baseline. Uncertain network outcomes check event receipts before retrying so retries remain idempotent; conflicts preserve the user's draft in session state without overwriting concurrent changes.

## Verification

```sh
npm run check:types
npm test
npm run build
npm run verify:viewer
npm run verify:audit
```
