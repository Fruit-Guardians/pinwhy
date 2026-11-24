# Changelog

## 0.5.0 (2026-11-24)

- **Ultra Harness & Workspace (`pinwhy-ultra`)**: Added deterministic file-slice and probe coverage ledger (`.pinwhy/ultra/ledger.jsonl`), parallel worker batch scheduling (`next --workers`), and cognitive gap diagnostics (`unverified-dependency`, `unbacked-conclusion`, `dangling-contradiction`, `dependency-cycle` with shortest-cycle path and break hints). Unified Ultra lenses (Constellation, Treemap, Gates) into the main workspace `Topbar`, inheriting light/dark themes, card palettes, density, and motion preferences. Exposed `pinwhy-ultra` in `pinwhy-cli`.
- **Security Audit Workspace**: Added collapsible `Issue ▸ Candidate` outline, orthogonal `severity × confidence × status` candidate matrix, Two-Wing Dialectical Dossier (`Supports & tethered premises` vs `Contradictions & required conditions`), `Dossier ⇄ Argument graph` view toggle, and factual multi-actor provenance cues (`Open dispute`, `Cross-verified`, `Single-source`).
- **CLI, Queries & Exports**: Added multi-value `--type` filtering (`--type finding,vuln,hypothesis` or repeatable `--type`, advertised via `capabilities.features.multiTypeFilter`), `--as-of <checkpoint>` historical replay (`context`, `show`, `ls`, `search`, `changes`, `export`), `--group-by`, `--related-to`, `--no-truncate`, `--clear`, multi-target `--to`, and atomic `pinwhy batch`; offline HTML, Markdown, Mermaid, SARIF 2.1.0, and canvas PNG exports; interactive 7-host `pinwhy skill install`.
- **DeepSeek Harness Adapter (`dsh-pinwhy@0.5.0`)**: Upgraded all 11 native tools to full `0.5.0` CLI parity (`clear`, multi-target `to`, `relateHere`, `types`, `groupBy`, `relatedTo`, `depth`, `asOf`, `requestId`, `rejectTruncation`), and verified embedded read-only viewer (`General | Audit | Ultra`) and `/api/ultra` proxy routing.

## 0.2.0

- Initial public release of `pinwhy`, `pinwhy-core`, and `pinwhy-cli`: append-only `.pinwhy/events.jsonl` store, non-prescriptive `pinwhy.context.v2` recovery packets, local loopback Web workspace, and `skills/pinwhy`.
