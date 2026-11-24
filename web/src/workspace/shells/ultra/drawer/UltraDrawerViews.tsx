import { type ReactNode } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { SeverityBadge } from '../../../../SeverityBadge';
import { formatTime, relationLabel, typeLabel } from '../../../../canvas/graph';
import { t } from '../../../../i18n';
import { confidenceLabel, statusLabel } from '../../../../presentation';
import { sourceLocation } from '../../../../research-state';
import type { BoardNode, UltraSlice } from '../../../../types';
import {
  buildSliceMicroGraph,
  shortSectorLabel,
  type UltraModel,
  type UltraOrbitalBar,
  type UltraSectorView,
} from '../../../ultra';
import type { NodeChange } from '../../../use-workspace-presentation';
import { DependencyMicroGraph } from './DependencyMicroGraph';
import { HumanInjectionForm } from './HumanInjectionForm';

function nodeChangeClass(changes: ReadonlyMap<string, NodeChange> | null | undefined, id: string): string {
  const kind = changes?.get(id)?.kind;
  return kind === 'added' ? ' change-added' : kind === 'updated' ? ' change-updated' : '';
}

const SLICE_DOT_TONE: Record<string, string> = {
  pending: 'border-[var(--u-tick)] bg-transparent',
  stale: 'border-[var(--u-crimson)] bg-[var(--u-crimson)]/25',
  shallow: 'border-[var(--u-amber)] bg-[var(--u-amber)]/35',
  cleared: 'border-[var(--u-mint)] bg-[var(--u-mint)]',
  flagged: 'border-[var(--u-crimson)] bg-[var(--u-crimson)]',
  excluded: 'border-[var(--u-dim)] bg-[var(--u-dim)]/30',
};

const WAFER_SEG_TONE: Record<string, string> = {
  pending: 'var(--u-tick)',
  stale: 'var(--u-crimson)',
  shallow: 'var(--u-amber)',
  cleared: 'var(--u-mint)',
  flagged: 'var(--u-crimson)',
  excluded: 'var(--u-dim)',
};

function renderInlineCode(text: string): ReactNode {
  if (!text.includes('`')) return text;
  const parts = text.split(/(`[^`\n]+`)/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    part.length >= 3 && part.startsWith('`') && part.endsWith('`')
      ? <code key={index} className="ultra-mono rounded border border-[var(--u-line)] bg-[var(--u-raise)] px-1 py-0.5 text-[11.5px] text-[var(--u-ink)]">{part.slice(1, -1)}</code>
      : part
  ));
}

function shallowReasonText(reason: string | null | undefined, unverifiedDeps?: string[], humanFollowups?: string[]): string {
  if (reason === 'unverified-dependency') {
    return `${t('ultra.drawer.reasonUnverifiedDep')} (${(unverifiedDeps || []).join(', ')})`;
  }
  if (reason === 'human-followup') {
    const suffix = humanFollowups?.length ? ` (${humanFollowups.join(', ')})` : '';
    return `${t('ultra.drawer.reasonHumanFollowup')}${suffix}`;
  }
  return t('ultra.drawer.reasonInsufficient');
}

export function SliceDrawerView({
  bar,
  model,
  changes,
  preferMicroGraph,
  copiedLoc,
  writable,
  onCopyLoc,
  onBackToSector,
  onSelectBar,
  onSelectNode,
  onReload,
}: {
  bar: UltraOrbitalBar;
  model: UltraModel;
  changes?: ReadonlyMap<string, NodeChange> | null;
  preferMicroGraph: boolean;
  copiedLoc: string | null;
  writable: boolean;
  onCopyLoc: (loc: string) => void;
  onBackToSector: (sectorName: string) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
  onReload: () => Promise<void>;
}) {
  const slice = bar.slice;
  const isZeroNodes = bar.status === 'cleared' && bar.nodeIds.length === 0;
  const linkedNodes = bar.nodeIds.map((id) => model.byId.get(id)).filter((n): n is BoardNode => Boolean(n));
  const micro = buildSliceMicroGraph(model, bar.id);
  const hasDeps = Boolean(micro && (micro.callers.length > 0 || micro.callees.length > 0));
  const statusBadgeClass =
    bar.status === 'cleared'
      ? 'border-[var(--u-mint)]/35 bg-[var(--u-mint)]/12 text-[var(--u-mint)]'
      : bar.status === 'flagged' || bar.status === 'stale'
        ? 'border-[var(--u-crimson)]/40 bg-[var(--u-crimson)]/12 text-[var(--u-crimson)]'
        : bar.status === 'shallow'
          ? 'border-[var(--u-amber)]/40 bg-[var(--u-amber)]/12 text-[var(--u-amber)]'
          : 'border-[var(--u-line)] bg-[var(--u-raise)] text-[var(--u-dim)]';

  return (
    <div className="flex flex-col">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onBackToSector(bar.sector)}
          className="ultra-mono inline-flex items-center gap-1 text-[11px] text-[var(--u-dim)] hover:text-[var(--u-cyan)]"
        >
          <ArrowLeft className="size-3" />
          <span>{shortSectorLabel(bar.sector)}</span>
        </button>
        <span className="ultra-mono text-[10.5px] text-[var(--u-dim)]">
          {bar.id}{slice?.hash ? ` · #${slice.hash.slice(0, 8)}` : ''}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className={`ultra-mono rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass}`}>
          {isZeroNodes ? t('ultra.inspector.zeroNodesBadge') : t(`ultra.sliceStatus.${bar.status}`)}
        </span>
        {slice?.kind === 'probe' && (
          <span className="ultra-mono rounded border border-[var(--u-cyan)]/35 bg-[var(--u-cyan)]/10 px-2 py-0.5 text-[10.5px] text-[var(--u-cyan)]">
            probe
          </span>
        )}
        {bar.lines > 0 && (
          <span className="ultra-mono rounded border border-[var(--u-line)] bg-[var(--u-raise)] px-2 py-0.5 text-[10.5px] text-[var(--u-dim)]">
            {bar.lines}L
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <h2 className="ultra-mono m-0 min-w-0 break-all text-[14px] font-bold leading-snug text-[var(--u-ink)]">
          {slice ? (slice.kind === 'probe' && slice.title ? slice.title : slice.path) : bar.shortLabel}
        </h2>
        {slice && !slice.path.startsWith('[probe]/') && (
          <button
            type="button"
            onClick={() => onCopyLoc(`${slice.path}:${slice.startLine}-${slice.endLine}`)}
            title={t('ultra.inspector.copyLoc')}
            aria-label={t('ultra.inspector.copyLoc')}
            data-ultra-copy-loc="true"
            className="ultra-btn h-6 shrink-0 px-1.5 text-[10.5px]"
          >
            {copiedLoc === `${slice.path}:${slice.startLine}-${slice.endLine}` ? (
              <Check className="size-3 text-[var(--u-mint)]" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        )}
      </div>
      <div className="ultra-mono mt-0.5 text-[11px] text-[var(--u-dim)]">
        {slice ? (slice.kind === 'probe' ? bar.rangeLabel : `${slice.startLine} – ${slice.endLine}`) : bar.rangeLabel} · sector: {bar.sector}
      </div>

      {(preferMicroGraph || hasDeps) && (
        <div className="mt-3">
          <DependencyMicroGraph model={model} sliceId={bar.id} onSelectBar={onSelectBar} />
        </div>
      )}

      <div className="mt-3 rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-3">
        <div className="ultra-mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--u-dim)]">
          {isZeroNodes ? t('ultra.inspector.receiptLedger') : t('ultra.inspector.receiptNote')}
        </div>
        <p className="m-0 text-xs leading-relaxed text-[var(--u-ink-2)]">
          {slice?.note ? renderInlineCode(slice.note) : bar.sublabel || t(`ultra.sliceStatus.${bar.status}`)}
        </p>
        {slice?.shallowReason && (
          <p className="mt-2 mb-0 rounded border border-[var(--u-amber)]/35 bg-[var(--u-amber)]/10 px-2 py-1.5 text-[11px] text-[var(--u-amber)]">
            {t('ultra.drawer.shallowReason')}: {shallowReasonText(slice.shallowReason, slice.unverifiedDependencies, slice.humanFollowups)}
          </p>
        )}
        {slice?.dependencyCycle?.length ? (
          <div className="mt-2 rounded border border-[var(--u-amber)]/35 bg-[var(--u-amber)]/10 px-2 py-1.5 text-[11px] text-[var(--u-amber)]">
            <div className="ultra-mono font-medium">{t('ultra.drawer.cycleNotice', { cycle: slice.dependencyCycle.join(' → ') })}</div>
            <div className="mt-0.5 text-[10.5px] text-[var(--u-ink-2)]">{t('ultra.drawer.cycleBreakHint')}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-3">
        <div className="ultra-mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--u-dim)]">
          {t('ultra.drawer.nodes')} ({linkedNodes.length})
        </div>
        {linkedNodes.length === 0 ? (
          <p className="m-0 text-xs leading-relaxed text-[var(--u-dim)]">{t('ultra.drawer.noNodes')}</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {linkedNodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id, bar.sector)}
                  className={`flex w-full items-start gap-2 rounded border border-[var(--u-line-soft)] bg-[var(--u-raise)] px-2.5 py-2 text-left transition-colors hover:border-[var(--u-tick)]${nodeChangeClass(changes, node.id)}`}
                >
                  <span className="ultra-mono shrink-0 text-[11px]" style={{ color: ['finding', 'vuln'].includes(node.type) ? 'var(--u-crimson)' : 'var(--u-cyan)' }}>
                    {node.id}
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-[var(--u-ink)]">{node.title}</span>
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[var(--u-dim)]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HumanInjectionForm
        lockedSlice={slice ?? null}
        sector={model.displaySectorMap.get(bar.sector) ?? model.sectorMap.get(bar.sector)}
        goalId={model.goal?.id ?? null}
        writable={writable}
        onReload={onReload}
        onSelectNode={onSelectNode}
      />
    </div>
  );
}

export function NodeDrawerView({
  node,
  model,
  changes,
  sector,
  selectedBar,
  writable,
  onBackToSector,
  onBackToSlice,
  onSelectNode,
  onInspectFullNode,
  onReload,
}: {
  node: BoardNode;
  model: UltraModel;
  changes?: ReadonlyMap<string, NodeChange> | null;
  sector: UltraSectorView | null;
  selectedBar: UltraOrbitalBar | null;
  writable: boolean;
  onBackToSector: (sectorName: string) => void;
  onBackToSlice?: () => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
  onInspectFullNode: (nodeId: string) => void;
  onReload: () => Promise<void>;
}) {
  const loc = sourceLocation(node);
  const edges = model.allEdges.filter((e) => e.from === node.id || e.to === node.id);
  const tags = Array.isArray(node.tags) ? node.tags.filter((item): item is string => typeof item === 'string') : [];
  const nodeSec = model.nodeDisplaySectorMap.get(node.id) || model.nodeSectorMap.get(node.id);
  const isHuman = node.author === 'human' || node.updatedBy === 'human';

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {selectedBar && onBackToSlice ? (
          <button
            type="button"
            onClick={onBackToSlice}
            className="ultra-mono inline-flex items-center gap-1 text-[11px] text-[var(--u-dim)] hover:text-[var(--u-cyan)]"
          >
            <ArrowLeft className="size-3" />
            <span>{t('ultra.inspector.backSlice')} ({selectedBar.id})</span>
          </button>
        ) : (sector || nodeSec) ? (
          <button
            type="button"
            onClick={() => onBackToSector(sector?.sector || nodeSec!)}
            className="ultra-mono inline-flex items-center gap-1 text-[11px] text-[var(--u-dim)] hover:text-[var(--u-cyan)]"
          >
            <ArrowLeft className="size-3" />
            <span>{shortSectorLabel(sector?.sector || nodeSec || '')}</span>
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={() => onInspectFullNode(node.id)}
          className="ultra-btn h-7 px-2 text-[11px]"
        >
          <ExternalLink className="size-3" />
          <span>{t('ultra.drawer.inspectFull')}</span>
        </button>
      </div>

      <div className={`rounded-md${nodeChangeClass(changes, node.id)}`}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="ultra-mono rounded border border-[var(--u-cyan)]/40 bg-[var(--u-cyan)]/10 px-1.5 py-0.5 text-[var(--u-cyan)]">{node.id}</span>
          <span className="rounded border border-[var(--u-line)] px-1.5 py-0.5 text-[var(--u-ink)]">{typeLabel(node.type)}</span>
          {node.status && <span className="rounded border border-[var(--u-line)] px-1.5 py-0.5 text-[var(--u-dim)]">{statusLabel(node.status)}</span>}
          {node.severity && <SeverityBadge severity={node.severity} />}
          {node.confidence && <span className="rounded border border-[var(--u-line)] px-1.5 py-0.5 text-[var(--u-amber)]">{confidenceLabel(node.confidence)}</span>}
          {isHuman && <span className="ultra-mono rounded border border-[var(--u-cyan)]/45 bg-[var(--u-cyan)]/10 px-1.5 py-0.5 text-[10px] text-[var(--u-cyan)]">HUMAN</span>}
        </div>

        <h2 className="m-0 text-[15px] font-medium leading-snug text-[var(--u-ink)]">{node.title}</h2>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--u-line)] pt-3 text-xs">
        <div>
          <dt className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('source.location')}</dt>
          <dd className="ultra-mono mt-0.5 break-all text-[11px] text-[var(--u-ink)]">{loc || '—'}</dd>
        </div>
        <div>
          <dt className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">Author</dt>
          <dd className="ultra-mono mt-0.5 text-[11px] text-[var(--u-ink)]">{String(node.updatedBy || node.author || 'agent:primary')}</dd>
        </div>
        {tags.length > 0 && (
          <div className="col-span-2">
            <dt className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('source.tags')}</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="ultra-mono rounded border border-[var(--u-line)] bg-[var(--u-raise)] px-1.5 py-0.5 text-[10.5px] text-[var(--u-dim)]">{tag}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {node.detail && (
        <div className="mt-3 border-t border-[var(--u-line)] pt-3">
          <div className="ultra-section-title mb-2">Detail</div>
          <p className="m-0 whitespace-pre-wrap border-l-2 border-[var(--u-cyan)] pl-3 text-xs leading-relaxed text-[var(--u-ink-2)] [overflow-wrap:anywhere]">
            {renderInlineCode(node.detail)}
          </p>
        </div>
      )}

      {edges.length > 0 && (
        <div className="mt-3 border-t border-[var(--u-line)] pt-3">
          <div className="ultra-section-title mb-2">{t('ultra.drawer.chords')} ({edges.length})</div>
          <ul className="m-0 list-none p-0">
            {edges.map((edge) => {
              const incoming = edge.to === node.id;
              const peerId = incoming ? edge.from : edge.to;
              const peer = model.byId.get(peerId);
              const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={edge.id} className="ultra-row py-2">
                  <button
                    type="button"
                    onClick={() => onSelectNode(peerId, model.nodeDisplaySectorMap.get(peerId) || model.nodeSectorMap.get(peerId))}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--u-cyan)]" />
                    <span className="min-w-0 flex-1">
                      <span className="ultra-mono flex items-center gap-1.5 text-[10.5px] text-[var(--u-dim)]">
                        <span className="text-[var(--u-cyan)]">{relationLabel(edge.kind)}</span>
                        <span>·</span>
                        <span>{peerId}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--u-ink)]">{peer?.title || peerId}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <HumanInjectionForm targetNode={node} writable={writable} onReload={onReload} onSelectNode={(id) => onSelectNode(id)} />
    </div>
  );
}

export function SectorDrawerView({
  sector,
  model,
  changes,
  sectorSlices,
  sectorNodes,
  writable,
  onSelectBar,
  onSelectNode,
  onReload,
}: {
  sector: UltraSectorView;
  model: UltraModel;
  changes?: ReadonlyMap<string, NodeChange> | null;
  sectorSlices: UltraSlice[];
  sectorNodes: BoardNode[];
  writable: boolean;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
  onReload: () => Promise<void>;
}) {
  const ratio = sector.totalSlices > 0 ? Math.round((sector.coveredSlices / sector.totalSlices) * 100) : 0;
  const blindCount = sector.pendingSlices + sector.staleSlices + sector.shallowSlices;

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="ultra-mono text-[10.5px] uppercase tracking-wider text-[var(--u-dim)]">Sector #{String(sector.index + 1).padStart(2, '0')}</span>
        <span className="ultra-mono text-xs text-[var(--u-mint)]">{ratio}%</span>
      </div>
      <h2 className="ultra-mono m-0 break-all text-sm font-semibold text-[var(--u-ink)]">{sector.sector}</h2>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--u-dim)]">
          <span>{t('ultra.drawer.coverage')}</span>
          <span className="ultra-mono">{sector.coveredSlices}/{sector.totalSlices}</span>
        </div>
        <div className="ultra-wafer-strip h-2.5">
          {sector.bars.map((bar) => (
            <button
              key={bar.id}
              type="button"
              title={`${bar.label} · ${t(`ultra.sliceStatus.${bar.status}`)}`}
              onClick={() => onSelectBar(bar)}
              className="ultra-wafer-seg cursor-pointer border-0 p-0"
              style={{
                background: WAFER_SEG_TONE[bar.status] || 'var(--u-tick)',
                opacity: bar.status === 'pending' ? 0.45 : 0.9,
              }}
            />
          ))}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2">
        {[
          [t('ultra.metric.slices'), sector.totalSlices, 'var(--u-ink)'],
          [t('ultra.metric.cleared'), sector.coveredSlices, 'var(--u-mint)'],
          [t('ultra.metric.blind'), blindCount, blindCount > 0 ? 'var(--u-amber)' : 'var(--u-dim)'],
          [t('ultra.metric.findings'), sector.findingsCount, sector.findingsCount > 0 ? 'var(--u-crimson)' : 'var(--u-dim)'],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="border-t border-[var(--u-line)] pt-2">
            <dt className="text-[10px] text-[var(--u-dim)]">{label}</dt>
            <dd className="ultra-mono mt-0.5 text-sm font-semibold" style={{ color: String(color) }}>{val}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="ultra-section-title mb-2">{t('ultra.drawer.slices')} ({sectorSlices.length})</div>
        {sectorSlices.length === 0 ? (
          <p className="m-0 py-2 text-xs text-[var(--u-dim)]">{t('ultra.drawer.noSlices')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sectorSlices.map((slice) => {
              const barForSlice = sector.bars.find((b) => b.id === slice.id);
              return (
                <li key={slice.id} className="ultra-row py-2">
                  <button
                    type="button"
                    onClick={() => barForSlice && onSelectBar(barForSlice)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full border ${SLICE_DOT_TONE[slice.effectiveStatus] || SLICE_DOT_TONE.pending}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="ultra-mono truncate text-xs text-[var(--u-ink)]">{slice.path}:{slice.startLine}-{slice.endLine}</span>
                        <span className="ultra-mono shrink-0 text-[10px] text-[var(--u-dim)]">{slice.id} · {slice.lines}L</span>
                      </span>
                      {slice.note && <span className="mt-0.5 line-clamp-2 block text-[11px] text-[var(--u-dim)]">{slice.note}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <HumanInjectionForm
        sector={sector}
        sectorSlices={sectorSlices}
        goalId={model.goal?.id ?? null}
        writable={writable}
        onReload={onReload}
        onSelectNode={onSelectNode}
      />

      {sectorNodes.length > 0 && (
        <div className="mt-4">
          <div className="ultra-section-title mb-2">{t('ultra.drawer.nodes')} ({sectorNodes.length})</div>
          <ul className="m-0 list-none p-0">
            {sectorNodes.map((node) => (
              <li key={node.id} className={`ultra-row py-2${nodeChangeClass(changes, node.id)}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id, sector.sector)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="ultra-mono text-[10.5px] text-[var(--u-cyan)]">{node.id} · {typeLabel(node.type)}</span>
                    <span className="mt-0.5 block text-xs text-[var(--u-ink)]">{node.title}</span>
                  </span>
                  <span className="ultra-mono shrink-0 text-[10px] text-[var(--u-dim)]">{formatTime(node.updated || node.ts)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OverviewDrawerView({
  model,
  changes,
  onSelectBar,
}: {
  model: UltraModel;
  changes?: ReadonlyMap<string, NodeChange> | null;
  onSelectBar: (bar: UltraOrbitalBar) => void;
}) {
  const barNodeChange = (bar: UltraOrbitalBar) => {
    for (const id of bar.nodeIds) {
      const cls = nodeChangeClass(changes, id);
      if (cls) return cls;
    }
    return '';
  };
  const zeroNodeSamples = model.bars
    .filter((b) => b.status === 'cleared' && b.nodeIds.length === 0 && !(b.slice?.humanFollowups?.length))
    .slice(0, 7);
  const focusBars = model.bars
    .filter((b) => b.status === 'flagged' || b.status === 'shallow' || b.status === 'stale')
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-3">
        <div className="ultra-mono text-[10.5px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.nav.overview')}</div>
        <p className="mt-1.5 mb-0 text-xs leading-relaxed text-[var(--u-ink-2)]">
          {model.goal?.title || model.title || t('ultra.empty.title')}
        </p>
      </div>

      <div>
        <div className="ultra-section-title mb-2">{t('ultra.inspector.quickZero')}</div>
        <ul className="m-0 list-none space-y-1 p-0">
          {zeroNodeSamples.map((bar) => (
            <li key={bar.id}>
              <button
                type="button"
                onClick={() => onSelectBar(bar)}
                className="ultra-row flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-[var(--u-mint)]" />
                  <span className="ultra-mono truncate text-xs text-[var(--u-ink)]">{bar.label}</span>
                </span>
                <span className="ultra-mono shrink-0 text-[10px] text-[var(--u-mint)]">{bar.id}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {focusBars.length > 0 && (
        <div>
          <div className="ultra-section-title mb-2">{t('ultra.inspector.quickFocus')}</div>
          <ul className="m-0 list-none space-y-1 p-0">
            {focusBars.map((bar) => (
              <li key={bar.id}>
                <button
                  type="button"
                  onClick={() => onSelectBar(bar)}
                  className={`ultra-row flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left${barNodeChange(bar)}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: bar.status === 'shallow' ? 'var(--u-amber)' : 'var(--u-crimson)' }}
                    />
                    <span className="ultra-mono truncate text-xs text-[var(--u-ink)]">{bar.label}</span>
                  </span>
                  <span className="ultra-mono shrink-0 text-[10px] text-[var(--u-dim)]">
                    {bar.nodeIds.length ? bar.nodeIds[0] : bar.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
