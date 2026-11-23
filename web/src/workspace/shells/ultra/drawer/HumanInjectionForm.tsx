import { useEffect, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import * as api from '../../../../api/client';
import { typeLabel } from '../../../../canvas/graph';
import { t } from '../../../../i18n';
import { useSessionWrite } from '../../../../session-drafts';
import type { BoardNode, UltraSlice } from '../../../../types';
import type { UltraSectorView } from '../../../ultra';

export function HumanInjectionForm({
  targetNode,
  lockedSlice,
  sector,
  sectorSlices,
  goalId,
  writable,
  onReload,
  onSelectNode,
}: {
  targetNode?: BoardNode;
  lockedSlice?: UltraSlice | null;
  sector?: UltraSectorView;
  sectorSlices?: UltraSlice[];
  goalId?: string | null;
  writable: boolean;
  onReload: () => Promise<void>;
  onSelectNode: (nodeId: string, sectorName?: string) => void;
}) {
  const [nodeType, setNodeType] = useState<'question' | 'observation' | 'hint'>('question');
  const [relation, setRelation] = useState<'related-to' | 'contradicts' | 'supports'>('related-to');
  const [sliceTargetId, setSliceTargetId] = useState<string>(() => lockedSlice?.id || sectorSlices?.[0]?.id || '__sector__');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (lockedSlice) setSliceTargetId(lockedSlice.id);
    else if (!targetNode && sectorSlices) setSliceTargetId(sectorSlices[0]?.id || '__sector__');
  }, [lockedSlice, targetNode, sector?.sector, sectorSlices]);

  const activeSlice = lockedSlice
    ? lockedSlice
    : !targetNode && sliceTargetId !== '__sector__'
      ? sectorSlices?.find((s) => s.id === sliceTargetId) ?? null
      : null;

  const scopeKey = targetNode
    ? `node:${targetNode.id}`
    : activeSlice
      ? `slice:${activeSlice.id}`
      : `sector:${sector?.sector || 'unscoped'}`;
  const operation = useSessionWrite(`ultra-inject:${scopeKey}`);

  useEffect(() => {
    setSentId(null);
    setLocalError(null);
  }, [scopeKey]);

  if (!writable) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || operation.locked || operation.busy) return;
    setLocalError(null);
    setSentId(null);
    try {
      const result = targetNode
        ? await api.addNode({
            type: nodeType,
            title: title.trim(),
            ...(detail.trim() ? { detail: detail.trim() } : {}),
            target: targetNode.id,
            relation,
            status: 'open',
          }, operation)
        : activeSlice
          ? await api.addNode({
              type: nodeType,
              title: title.trim(),
              ...(detail.trim() ? { detail: detail.trim() } : {}),
              status: 'open',
              at: `${activeSlice.path}:${activeSlice.startLine}`,
              tags: [`component=${activeSlice.sector}`, `slice=${activeSlice.id}`],
              ...(goalId ? { target: goalId, relation: 'related-to' } : {}),
            }, operation)
          : await api.addNode({
              type: nodeType,
              title: title.trim(),
              ...(detail.trim() ? { detail: detail.trim() } : {}),
              status: 'open',
              tags: sector ? [`component=${sector.sector}`] : undefined,
              ...(goalId ? { target: goalId, relation: 'related-to' } : {}),
            }, operation);
      setTitle('');
      setDetail('');
      setSentId(result.node.id);
      void onReload().catch(() => { /* SSE stream or manual reload will catch up */ });
    } catch (error) {
      setLocalError(operation.error ? null : error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-[var(--u-cyan)]/35 bg-[var(--u-raise)] p-3" data-ultra-inject-form>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--u-cyan)]">{t('ultra.inject.title')}</span>
        {activeSlice && <span className="ultra-mono text-[10.5px] text-[var(--u-cyan)]">{activeSlice.id}</span>}
      </div>

      {!targetNode && !lockedSlice && sector && (
        <div className="mb-2.5 flex flex-col gap-1 text-[11px] text-[var(--u-dim)]">
          <span>{t('ultra.inject.targetLabel')}</span>
          {sectorSlices && sectorSlices.length > 0 ? (
            <select
              value={sliceTargetId}
              onChange={(e) => setSliceTargetId(e.target.value)}
              disabled={operation.locked || operation.busy}
              aria-label={t('ultra.inject.targetLabel')}
              className="ultra-mono h-8 rounded border border-[var(--u-line)] bg-[var(--u-bg)] px-2 text-xs text-[var(--u-ink)] outline-none focus:border-[var(--u-cyan)]"
            >
              {sectorSlices.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {t('ultra.inject.sliceTarget', { id: sl.id, range: `${sl.path}:${sl.startLine}-${sl.endLine}` })}
                </option>
              ))}
              <option value="__sector__">
                {t('ultra.inject.wholeSector', { sector: sector.sector })}
              </option>
            </select>
          ) : null}
        </div>
      )}

      <div className={`mb-2 grid gap-2 ${targetNode ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <label className="flex flex-col gap-1 text-[11px] text-[var(--u-dim)]">
          <span>{t('ultra.inject.type')}</span>
          <select
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value as 'question' | 'observation' | 'hint')}
            disabled={operation.locked || operation.busy}
            className="h-8 rounded border border-[var(--u-line)] bg-[var(--u-bg)] px-2 text-xs text-[var(--u-ink)] outline-none focus:border-[var(--u-cyan)]"
          >
            <option value="question">question · {typeLabel('question')}</option>
            <option value="observation">observation · {typeLabel('observation')}</option>
            <option value="hint">hint · {typeLabel('hint')}</option>
          </select>
        </label>
        {targetNode && (
          <label className="flex flex-col gap-1 text-[11px] text-[var(--u-dim)]">
            <span>{t('ultra.inject.rel')}</span>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as 'related-to' | 'contradicts' | 'supports')}
              disabled={operation.locked || operation.busy}
              className="h-8 rounded border border-[var(--u-line)] bg-[var(--u-bg)] px-2 text-xs text-[var(--u-ink)] outline-none focus:border-[var(--u-cyan)]"
            >
              <option value="related-to">related-to</option>
              <option value="contradicts">contradicts</option>
              <option value="supports">supports</option>
            </select>
          </label>
        )}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('ultra.inject.placeholder')}
        disabled={operation.locked || operation.busy}
        className="mb-2 w-full rounded border border-[var(--u-line)] bg-[var(--u-bg)] px-2.5 py-2 text-xs text-[var(--u-ink)] placeholder:text-[var(--u-dim)] outline-none focus:border-[var(--u-cyan)]"
      />
      <textarea
        rows={2}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder={t('ultra.inject.detailPlaceholder')}
        disabled={operation.locked || operation.busy}
        className="mb-2.5 w-full resize-y rounded border border-[var(--u-line)] bg-[var(--u-bg)] px-2.5 py-2 text-xs text-[var(--u-ink)] placeholder:text-[var(--u-dim)] outline-none focus:border-[var(--u-cyan)]"
      />
      {(operation.error || localError) && (
        <p role="alert" className="mb-2 text-xs text-[var(--u-crimson)]">{operation.error || localError}</p>
      )}
      {sentId && (
        <p role="status" className="mb-2 flex items-center justify-between text-xs text-[var(--u-mint)]">
          <span>{t('ultra.inject.sent')}</span>
          <button type="button" onClick={() => onSelectNode(sentId, activeSlice?.sector || sector?.sector)} className="ultra-mono underline hover:text-[var(--u-ink)]">
            {sentId}
          </button>
        </p>
      )}
      <button
        type="submit"
        disabled={!title.trim() || operation.busy || operation.locked}
        className="ultra-btn ultra-btn-sky w-full justify-center disabled:opacity-45"
      >
        <Send className="size-3.5" />
        <span>{t('ultra.inject.submit')}</span>
      </button>
    </form>
  );
}
