import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, GitBranch, MessageSquare, ShieldAlert } from 'lucide-react';
import { t } from '../../../i18n';
import type { UltraModel, UltraOrbitalBar } from '../../ultra';

type Props = {
  model: UltraModel;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectSector: (sector: string) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
};

function formatShallowReason(reason: string | null | undefined, deps?: string[], followups?: string[]) {
  if (reason === 'unverified-dependency') {
    return `${t('ultra.drawer.reasonUnverifiedDep')} (${(deps || []).join(', ')})`;
  }
  if (reason === 'human-followup') {
    return `${t('ultra.drawer.reasonHumanFollowup')}${followups?.length ? ` (${followups.join(', ')})` : ''}`;
  }
  return t('ultra.drawer.reasonInsufficient');
}

export function UltraGatesView({ model, onSelectBar, onSelectSector, onSelectNode }: Props) {
  const { gaps, metrics } = model;

  const pendingSlices = useMemo(
    () => model.bars.map((b) => b.slice).filter((sl): sl is NonNullable<typeof sl> => Boolean(sl && sl.effectiveStatus === 'pending')),
    [model.bars],
  );

  const c1Count = pendingSlices.length + gaps.untrackedFiles.length + gaps.diskStaleIds.length;
  const c2Count = gaps.shallowSlices.length + gaps.staleSlices.length;
  const c3Count = gaps.unbackedVerdicts.length;
  const s1Count = gaps.awakenedChains.length;

  const mergedS2 = useMemo(() => {
    const byId = new Map<string, { item: (typeof gaps.openThreads)[number]; isHuman: boolean; isOpen: boolean; isAnomaly: boolean }>();
    for (const item of gaps.humanSignals) {
      byId.set(item.id, { item, isHuman: true, isOpen: false, isAnomaly: false });
    }
    for (const item of gaps.openThreads) {
      const existing = byId.get(item.id);
      if (existing) existing.isOpen = true;
      else byId.set(item.id, { item, isHuman: item.author === 'human' || item.updatedBy === 'human', isOpen: true, isAnomaly: false });
    }
    for (const item of gaps.unresolvedAnomalies) {
      const existing = byId.get(item.id);
      if (existing) existing.isAnomaly = true;
      else byId.set(item.id, { item, isHuman: item.author === 'human' || item.updatedBy === 'human', isOpen: false, isAnomaly: true });
    }
    return [...byId.values()];
  }, [gaps.humanSignals, gaps.openThreads, gaps.unresolvedAnomalies]);
  const s2Count = mergedS2.length;

  const pct = Math.round(metrics.coverageRatio * 100);
  const commitmentBadge = (count: number, tone: 'crimson' | 'amber') => {
    if (count === 0) {
      return (
        <span className="ultra-mono inline-flex items-center gap-1 text-[10.5px] text-[var(--u-mint)]">
          <CheckCircle2 className="size-3" />
          <span>{t('ultra.gate.clear')}</span>
        </span>
      );
    }
    const color = tone === 'crimson' ? 'var(--u-crimson)' : 'var(--u-amber)';
    return (
      <span className="ultra-mono text-[11px] font-medium" style={{ color }}>
        {count} {t('ultra.gate.pendingItems')}
      </span>
    );
  };

  const signalBadge = (count: number, tone: 'amber' | 'cyan') => (
    <span
      className="ultra-mono text-[11px]"
      style={{ color: count === 0 ? 'var(--u-dim)' : tone === 'cyan' ? 'var(--u-cyan)' : 'var(--u-amber)' }}
    >
      {count} {t('ultra.gate.boundaryItems')}
    </span>
  );

  const summaryStatusText = model.allClear
    ? t('ultra.status.complete')
    : model.commitmentComplete
      ? t('ultra.commitmentsDoneBoundariesOpen', { count: s1Count + s2Count })
      : t('ultra.status.active');

  const jumpToSlice = (sliceId: string, fallbackSector: string) => {
    const bar = model.barById.get(sliceId);
    if (bar) onSelectBar(bar);
    else onSelectSector(fallbackSector);
  };

  return (
    <div className="ultra-constellation-stage h-full w-full overflow-y-auto px-6 py-5">
      <div className="mx-auto flex max-w-[1220px] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] px-4 py-3">
          <div>
            <div className="ultra-mono flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--u-dim)]">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: model.allClear ? 'var(--u-mint)' : model.commitmentComplete ? 'var(--u-cyan)' : 'var(--u-crimson)' }}
              />
              <span className={model.commitmentComplete && !model.allClear ? 'text-[var(--u-cyan)]' : undefined}>{summaryStatusText}</span>
              <span>·</span>
              <span>{pct}% ({metrics.clearedSlices}/{metrics.totalSlices})</span>
            </div>
            <p className="mt-1 mb-0 text-xs text-[var(--u-ink-2)]">{t('ultra.lensHint.gaps')}</p>
          </div>
          <div className="ultra-mono flex flex-wrap items-center gap-3.5 text-xs">
            <span>C1 <strong className={c1Count ? 'text-[var(--u-crimson)]' : 'text-[var(--u-mint)]'}>{c1Count}</strong></span>
            <span>C2 <strong className={c2Count ? 'text-[var(--u-amber)]' : 'text-[var(--u-mint)]'}>{c2Count}</strong></span>
            <span>C3 <strong className={c3Count ? 'text-[var(--u-crimson)]' : 'text-[var(--u-mint)]'}>{c3Count}</strong></span>
            <span className="h-3.5 w-px bg-[var(--u-line)]" aria-hidden="true" />
            <span>S1 <strong className={s1Count ? 'text-[var(--u-amber)]' : 'text-[var(--u-dim)]'}>{s1Count}</strong></span>
            <span>S2 <strong className={s2Count ? 'text-[var(--u-cyan)]' : 'text-[var(--u-dim)]'}>{s2Count}</strong></span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="ultra-section-title text-[var(--u-mint)]">{t('ultra.tier.commitments')}</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-4">
              <div className="flex items-center justify-between border-b border-[var(--u-line-soft)] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--u-ink)]">
                  <ShieldAlert className="size-3.5 text-[var(--u-crimson)]" />
                  <span>{t('ultra.gate.c1')}</span>
                </div>
                {commitmentBadge(c1Count, 'crimson')}
              </div>
              {c1Count === 0 ? (
                <p className="mt-3 mb-0 text-xs text-[var(--u-dim)]">{t('ultra.gate.nonePending')}</p>
              ) : (
                <ul className="mt-2.5 mb-0 list-none space-y-1 p-0">
                  {pendingSlices.slice(0, 14).map((slice) => (
                    <li key={slice.id}>
                      <button
                        type="button"
                        onClick={() => jumpToSlice(slice.id, model.sliceDisplaySectorMap.get(slice.id) || slice.sector)}
                        className="ultra-row flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs"
                      >
                        <span className="ultra-mono truncate text-[var(--u-ink)]">
                          <span className="mr-1.5 text-[var(--u-crimson)]">{slice.id}</span>
                          {slice.path}:{slice.startLine}-{slice.endLine}
                        </span>
                        <span className="ultra-mono shrink-0 text-[10.5px] text-[var(--u-dim)]">{slice.lines}L</span>
                      </button>
                    </li>
                  ))}
                  {gaps.untrackedFiles.slice(0, 8).map((file) => (
                    <li key={`u:${file}`} className="ultra-mono border-b border-[var(--u-line-soft)] px-2 py-1.5 text-xs text-[var(--u-amber)]">
                      + untracked · {file}
                    </li>
                  ))}
                  {gaps.diskStaleIds.map((id) => (
                    <li key={`d:${id}`} className="ultra-mono border-b border-[var(--u-line-soft)] px-2 py-1.5 text-xs text-[var(--u-crimson)]">
                      ! disk-drift · {id}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-4">
              <div className="flex items-center justify-between border-b border-[var(--u-line-soft)] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--u-ink)]">
                  <FileWarning className="size-3.5 text-[var(--u-amber)]" />
                  <span>{t('ultra.gate.c2')}</span>
                </div>
                {commitmentBadge(c2Count, 'amber')}
              </div>
              {c2Count === 0 ? (
                <p className="mt-3 mb-0 text-xs text-[var(--u-dim)]">{t('ultra.gate.noneShallow')}</p>
              ) : (
                <ul className="mt-2.5 mb-0 list-none space-y-1 p-0">
                  {gaps.shallowSlices.map((item) => (
                    <li key={`sh:${item.id}`}>
                      <button
                        type="button"
                        onClick={() => jumpToSlice(item.id, model.sliceDisplaySectorMap.get(item.id) || model.sliceSectorMap.get(item.id) || '')}
                        className="ultra-row flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left"
                      >
                        <span className="ultra-mono text-xs" style={{ color: item.reason === 'human-followup' ? 'var(--u-cyan)' : 'var(--u-amber)' }}>
                          {item.id} · {item.path}:{item.startLine}-{item.endLine}
                        </span>
                        <span className="text-[11px] text-[var(--u-dim)]">
                          {formatShallowReason(item.reason, item.unverifiedDependencies, item.humanFollowups)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {gaps.staleSlices.map((item) => (
                    <li key={`st:${item.id}`}>
                      <button
                        type="button"
                        onClick={() => jumpToSlice(item.id, model.sliceDisplaySectorMap.get(item.id) || model.sliceSectorMap.get(item.id) || '')}
                        className="ultra-row ultra-mono block w-full rounded px-2 py-1.5 text-left text-xs text-[var(--u-crimson)]"
                      >
                        {item.id} · stale · {item.path}:{item.startLine}-{item.endLine}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-4">
              <div className="flex items-center justify-between border-b border-[var(--u-line-soft)] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--u-ink)]">
                  <AlertTriangle className="size-3.5 text-[var(--u-crimson)]" />
                  <span>{t('ultra.gate.c3')}</span>
                </div>
                {commitmentBadge(c3Count, 'crimson')}
              </div>
              {c3Count === 0 ? (
                <p className="mt-3 mb-0 text-xs text-[var(--u-dim)]">{t('ultra.gate.noneUnbacked')}</p>
              ) : (
                <ul className="mt-2.5 mb-0 list-none space-y-1 p-0">
                  {gaps.unbackedVerdicts.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectNode(item.id, model.nodeDisplaySectorMap.get(item.id) || model.nodeSectorMap.get(item.id))}
                        className="ultra-row flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      >
                        <span className="ultra-mono text-[var(--u-crimson)]">{item.id}</span>
                        <span className="min-w-0 flex-1 truncate text-[var(--u-ink)]">{item.title}</span>
                        <span className="ultra-mono text-[10.5px] text-[var(--u-dim)]">{item.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="ultra-section-title text-[var(--u-cyan)]">{t('ultra.tier.signals')}</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-4">
              <div className="flex items-center justify-between border-b border-[var(--u-line-soft)] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--u-ink)]">
                  <GitBranch className="size-3.5 text-[var(--u-amber)]" />
                  <span>{t('ultra.gate.s1')}</span>
                </div>
                {signalBadge(s1Count, 'amber')}
              </div>
              {s1Count === 0 ? (
                <p className="mt-3 mb-0 text-xs text-[var(--u-dim)]">{t('ultra.gate.noneAwakened')}</p>
              ) : (
                <ul className="mt-2.5 mb-0 list-none space-y-2 p-0">
                  {gaps.awakenedChains.map((chain) => (
                    <li key={chain.hypothesis.id} className="rounded border border-[var(--u-amber)]/30 bg-[var(--u-raise)] p-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {chain.matches.map((m) => (
                          <button
                            key={m.nodeId}
                            type="button"
                            onClick={() => onSelectNode(m.nodeId, model.nodeDisplaySectorMap.get(m.nodeId) || model.nodeSectorMap.get(m.nodeId))}
                            className="ultra-btn h-6 border-[var(--u-amber)]/45 px-2 text-[11px] text-[var(--u-amber)]"
                          >
                            <span className="ultra-mono">{m.nodeId}</span>
                            <span className="max-w-[180px] truncate">{m.title}</span>
                          </button>
                        ))}
                        <span className="ultra-mono inline-flex items-center gap-1 text-[10.5px] text-[var(--u-amber)]">
                          <ArrowRight className="size-3" />
                          {chain.matches.map((m) => m.via).join(', ')}
                          <ArrowRight className="size-3" />
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectNode(chain.hypothesis.id, model.nodeDisplaySectorMap.get(chain.hypothesis.id) || model.nodeSectorMap.get(chain.hypothesis.id))}
                          className="ultra-btn h-6 border-[var(--u-mint)]/45 px-2 text-[11px] text-[var(--u-ink)]"
                        >
                          <span className="ultra-mono text-[var(--u-amber)]">{chain.hypothesis.id}</span>
                          <span className="max-w-[220px] truncate">{chain.hypothesis.title}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-[var(--u-line)] bg-[var(--u-surface)] p-4">
              <div className="flex items-center justify-between border-b border-[var(--u-line-soft)] pb-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--u-ink)]">
                  <MessageSquare className="size-3.5 text-[var(--u-cyan)]" />
                  <span>{t('ultra.gate.s2')}</span>
                </div>
                {signalBadge(s2Count, 'cyan')}
              </div>
              {s2Count === 0 ? (
                <p className="mt-3 mb-0 text-xs text-[var(--u-dim)]">{t('ultra.gate.noneThreads')}</p>
              ) : (
                <ul className="mt-2.5 mb-0 list-none space-y-1 p-0">
                  {mergedS2.map(({ item, isHuman, isOpen, isAnomaly }) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectNode(item.id, model.nodeDisplaySectorMap.get(item.id) || model.nodeSectorMap.get(item.id))}
                        className="ultra-row flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      >
                        {isHuman && (
                          <span className="ultra-mono rounded border border-[var(--u-cyan)]/45 bg-[var(--u-cyan)]/10 px-1 py-0.2 text-[10px] text-[var(--u-cyan)]">HUMAN</span>
                        )}
                        {isAnomaly && (
                          <span className="ultra-mono rounded border border-[var(--u-amber)]/45 bg-[var(--u-amber)]/10 px-1 py-0.2 text-[10px] text-[var(--u-amber)]">ANOMALY</span>
                        )}
                        <span className="ultra-mono" style={{ color: isHuman ? 'var(--u-cyan)' : 'var(--u-amber)' }}>{item.id}</span>
                        <span className="min-w-0 flex-1 truncate text-[var(--u-ink)]">{item.title}</span>
                        <span className="ultra-mono shrink-0 text-[10.5px] text-[var(--u-dim)]">
                          {item.type}{isOpen ? ` · ${item.status || 'open'}` : item.status ? ` · ${item.status}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
